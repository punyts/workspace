// Stock follows the orders. The store's logic saves an order; this job, in the store's server, then takes each line's
// quantity off the product's stock and marks the order (`stockApplied`), so an order is counted once, also across a
// restart. It uses the server's own data tools (ui_data_query, ui_data_write), so the storefront and the back office
// see the new stock at once.

const ORDERS = 'tide-orders';
const PRODUCTS = 'tide-products';

export function startInventory(tools, onPartChange, report) {
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    const run = async (name, args) => {
        const outcome = await byName[name].run(args);
        if (outcome.isError) throw new Error(`${name}: ${JSON.stringify(outcome.body).slice(0, 400)}`);
        return outcome.body;
    };

    async function apply() {
        // Before the store is built there are no orders to read
        const asked = await byName['ui_data_query'].run({ dataset: ORDERS, filter: '$record.stockApplied != true', window: { first: 0, count: 100 } });
        if (asked.isError) return;
        const waiting = asked.body;
        for (const { key, record } of waiting.records) {
            const operations = [];
            for (const [productId, line] of Object.entries(record.lines ?? {})) {
                const found = await run('ui_data_query', { dataset: PRODUCTS, filter: `$key == '${productId.replace(/'/g, '')}'` });
                const product = found.records[0]?.record;
                if (product === undefined || typeof line?.qty !== 'number') continue;
                operations.push({ op: 'set', path: `${productId}.stock`, value: Math.max(0, (product.stock ?? 0) - line.qty) });
            }
            if (operations.length > 0) await run('ui_data_write', { dataset: PRODUCTS, operations });
            await run('ui_data_write', { dataset: ORDERS, operations: [{ op: 'set', path: `${key}.stockApplied`, value: true }] });
            report.info('Stock taken for an order', { order: record.number, lines: operations.length });
        }
    }

    // One pass at a time: a write of this job changes the orders again, which asks for another (empty) pass
    let queue = Promise.resolve();
    const schedule = () => {
        queue = queue.then(apply).catch((error) => report.info('Stock was not taken', { reason: error instanceof Error ? error.message : String(error) }));
    };
    const stop = onPartChange((kind, name) => {
        if (kind === 'data' && name === ORDERS) schedule();
    });
    schedule();
    return stop;
}
