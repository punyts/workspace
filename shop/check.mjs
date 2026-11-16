#!/usr/bin/env node
// Checks the built store end to end through the MCP tools and a real (headless) browser: browse, open a product, add
// it to the bag, change the bag, check out with a declined and an approved payment, and find the order in the account
// and in the back office. Needs the view server and the statenet (npm run mcp in the workspace) and a built ./data.
//
//   node check.mjs
//
// It places a real order in ./data (with the mock payment), so run `node build.mjs --fresh` afterwards for a clean store.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = dirname(fileURLToPath(import.meta.url));
const client = new Client({ name: 'store-check', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(here, 'server.mjs'), '--quiet'], stderr: 'inherit' }));

const STORE = 'tide-store';
const P = '$.screens.product.children.content.children.detail.children';
const C = '$.screens.checkout.children.content.children.form.children';
let failed = 0;

async function tool(name, args) {
    const result = await client.callTool({ name, arguments: args });
    const body = JSON.parse(result.content.find((item) => item.type === 'text')?.text ?? '{}');
    if (result.isError) throw new Error(`${name}: ${JSON.stringify(body).slice(0, 1200)}`);
    return body;
}
const state = async (path) => (await tool('ui_state_get', { app: STORE, path, full: true })).value;
const act = (actions) => tool('ui_interact', { app: STORE, actions });
const go = async (screen) => {
    await tool('ui_command', { app: STORE, target: screen, command: 'navigate' });
    await wait(async () => (await state('$.route.screen')) === screen, `the ${screen} screen`);
};

async function wait(check, what, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (await check().catch(() => false)) return;
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise((done) => setTimeout(done, 150));
    }
}

async function check(name, run) {
    try {
        await run();
        console.log(`  ok    ${name}`);
    } catch (error) {
        failed += 1;
        console.log(`  FAIL  ${name}\n        ${error instanceof Error ? error.message : String(error)}`);
    }
}
const equal = (actual, expected, what) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

console.log('store');
await tool('ui_state_reset', { app: STORE });
const preview = await tool('ui_preview', { app: STORE });
if (!preview.rendered) throw new Error('The store did not render: is the view server running (npm run mcp in the workspace)?');

await check('the home page shows the featured pieces and starts with an empty bag', async () => {
    await wait(async () => (await state('$.data.session.featured.total')) === 5, 'five featured pieces');
    equal(await state('$.data.bag'), {}, 'the bag');
    equal(await state('$.data.totals.items'), 0, 'the bag count');
});

await check('the collection filters by room and by search', async () => {
    await go('shop');
    await wait(async () => (await state('$.data.session.results.total')) === 20, 'all 20 pieces');
    await tool('ui_state_set', { app: STORE, path: '$.data.session.category', value: 'ceramics' });
    await wait(async () => (await state('$.data.session.results.total')) === 5, 'five ceramics');
    equal(await state('$.data.session.notice'), '5 pieces', 'the count line');
    await tool('ui_state_set', { app: STORE, path: '$.data.session.search', value: 'mug' });
    await wait(async () => (await state('$.data.session.results.total')) === 1, 'one mug');
    await tool('ui_state_set', { app: STORE, path: '$.data.session.search', value: '' });
    await tool('ui_state_set', { app: STORE, path: '$.data.session.category', value: 'all' });
    await wait(async () => (await state('$.data.session.results.total')) === 20, 'all 20 pieces again');
});

await check('pressing a product card opens its page', async () => {
    const tree = await tool('ui_tree', { app: STORE, screen: 'shop', rendered: true });
    const card = /(\$\.screens\.shop\.children\.content\.children\.grid\.[^\s]*slots\.[^\s.]+)/.exec(tree.text)?.[1];
    if (card === undefined) throw new Error(`no rendered card in the tree:\n${tree.text.slice(0, 600)}`);
    await act([{ action: 'click', path: card }]);
    await wait(async () => (await state('$.route.screen')) === 'product', 'the product screen');
    const opened = await state('$.data.session.product');
    if (typeof opened?.id !== 'string' || opened.id === '') throw new Error(`no product was opened: ${JSON.stringify(opened).slice(0, 200)}`);
    await wait(async () => (await state('$.data.session.stockNote')) !== '', 'the stock line');
});

await check('add to bag adds a line, and adding again raises its quantity', async () => {
    const mug = (await tool('ui_data_query', { dataset: 'tide-products', filter: "$key == 'morning-mug'" })).records[0].record;
    await tool('ui_state_set', { app: STORE, path: '$.data.session.product', value: mug });
    await wait(async () => (await state('$.data.session.stockNote')) === 'In stock', 'the mug in stock');
    await act([{ action: 'click', path: `${P}.buy.children.add` }]);
    await wait(async () => (await state('$.data.bag.morning-mug.qty')) === 1, 'one mug in the bag');
    await act([{ action: 'click', path: `${P}.buy.children.add` }]);
    await wait(async () => (await state('$.data.bag.morning-mug.qty')) === 2, 'two mugs in the bag');
    await wait(async () => (await state('$.data.totals.items')) === 2, 'the bag count');
    equal(await state('$.data.bag.morning-mug.lineTotal'), 56, 'the line total');
    equal(await state('$.data.session.addedOpen'), true, 'the added note');
});

await check('a sold-out piece cannot be added', async () => {
    const apron = (await tool('ui_data_query', { dataset: 'tide-products', filter: "$key == 'makers-apron'" })).records[0].record;
    await tool('ui_state_set', { app: STORE, path: '$.data.session.product', value: apron });
    await wait(async () => (await state('$.data.session.soldOut')) === true, 'sold out');
    equal(await state('$.data.session.stockNote'), 'Sold out', 'the stock line');
});

await check('the totals follow the bag: delivery under $75, tax, and free delivery over it', async () => {
    await wait(async () => (await state('$.data.totals.total')) === 66.98, 'the total of two mugs');
    equal(await state('$.data.totals'), { items: 2, empty: false, subtotal: 56, shipping: 6.5, tax: 4.48, total: 66.98 }, 'the totals');
    const board = (await tool('ui_data_query', { dataset: 'tide-products', filter: "$key == 'oak-board'" })).records[0].record;
    await tool('ui_state_set', { app: STORE, path: '$.data.session.product', value: board });
    await wait(async () => (await state('$.data.session.soldOut')) === false, 'the board in stock');
    await act([{ action: 'click', path: `${P}.buy.children.add` }]);
    await wait(async () => (await state('$.data.totals.items')) === 3, 'three items');
    equal(await state('$.data.totals'), { items: 3, empty: false, subtotal: 124, shipping: 0, tax: 9.92, total: 133.92 }, 'the totals');
});

await check('the bag changes a quantity and removes a line', async () => {
    await go('bag');
    await tool('ui_state_set', { app: STORE, path: '$.data.bag.morning-mug.qty', value: 1 });
    await wait(async () => (await state('$.data.totals.subtotal')) === 96, 'the subtotal after the change');
    const tree = await tool('ui_tree', { app: STORE, screen: 'bag', rendered: true });
    const remove = /(\$\.screens\.bag[^\s]*remove[^\s]*)/.exec(tree.text)?.[1];
    if (remove === undefined) throw new Error(`no remove button in the tree:\n${tree.text.slice(0, 900)}`);
    await act([{ action: 'click', path: remove }]);
    await wait(async () => Object.keys(await state('$.data.bag')).length === 1, 'one line left');
});

const fill = (name, value) => ({ action: 'fill', path: `${C}.details.children.${name}`, value });
await check('a declined payment keeps the bag and says why', async () => {
    await go('checkout');
    await act([
        fill('name', 'Robin Vale'),
        fill('email', 'robin@example.com'),
        fill('address', '8 Tern Road'),
        { action: 'fill', path: `${C}.details.children.place.children.city`, value: 'Camden' },
        { action: 'fill', path: `${C}.details.children.place.children.postcode`, value: '04843' },
        fill('cardName', 'Decline Me'),
        { action: 'click', path: `${C}.summary.children.place` }
    ]);
    await wait(async () => (await state('$.data.checkout.failed')) === true, 'the refusal');
    equal(await state('$.data.checkout.phase'), 'idle', 'the checkout phase');
    if (!String(await state('$.data.checkout.error')).includes('declined')) throw new Error(`the reason: ${await state('$.data.checkout.error')}`);
    if (Object.keys(await state('$.data.bag')).length !== 1) throw new Error('the bag was emptied');
});

let orderNumber = '';
await check('an approved payment saves the order, empties the bag and shows the confirmation', async () => {
    const total = await state('$.data.totals.total');
    await act([fill('cardName', 'Robin Vale'), { action: 'click', path: `${C}.summary.children.place` }]);
    await wait(async () => (await state('$.route.screen')) === 'confirmation', 'the confirmation screen', 15000);
    orderNumber = await state('$.data.checkout.orderNumber');
    if (!/^TT-\d{6}-\d{6}$/.test(orderNumber)) throw new Error(`the order number: ${orderNumber}`);
    equal(await state('$.data.bag'), {}, 'the bag');
    equal(await state('$.data.checkout.orderTotal'), total, 'the amount paid');
    const saved = (await tool('ui_data_query', { dataset: 'tide-orders', filter: `$record.number == '${orderNumber}'` })).records[0]?.record;
    if (saved === undefined) throw new Error('the order is not in the orders dataset');
    equal([saved.email, saved.status, saved.total, saved.paymentMode], ['robin@example.com', 'paid', total, 'mock'], 'the saved order');
    if (Object.keys(saved.lines).length !== 1) throw new Error(`the order lines: ${JSON.stringify(saved.lines).slice(0, 200)}`);
});

await check('the order takes its piece off the stock, once', async () => {
    const stock = async () => (await tool('ui_data_query', { dataset: 'tide-products', filter: "$key == 'oak-board'" })).records[0].record.stock;
    await wait(async () => (await stock()) === 17, 'one board fewer in stock');
    await new Promise((done) => setTimeout(done, 600));
    equal(await stock(), 17, 'the stock after the job settled');
});

await check('the account keeps the details and lists the order', async () => {
    await go('account');
    equal(await state('$.data.account.email'), 'robin@example.com', 'the saved email');
    await wait(async () => (await state('$.data.session.orders.total')) === 1, 'one order in the account');
    equal(Object.values(await state('$.data.session.orders.records'))[0].number, orderNumber, 'the order listed');
});

console.log('back office');
const ADMIN = 'tide-admin';
const adminState = async (path) => (await tool('ui_state_get', { app: ADMIN, path, full: true })).value;
await check('the back office counts the new order and its revenue', async () => {
    const rendered = await tool('ui_preview', { app: ADMIN });
    if (!rendered.rendered) throw new Error('the back office did not render');
    await wait(async () => (await adminState('$.data.desk.orders')) === 3, 'three orders');
    const desk = await adminState('$.data.desk');
    if (!(desk.revenue > 192)) throw new Error(`the revenue: ${desk.revenue}`);
    equal(desk.open, 2, 'the orders to ship');
});

await check('marking the order shipped in the back office shows in the customer account', async () => {
    await tool('ui_data_write', { dataset: 'tide-orders', operations: [{ op: 'set', path: `${orderNumber.toLowerCase()}.status`, value: 'shipped' }] });
    await wait(async () => Object.values(await state('$.data.session.orders.records'))[0].status === 'shipped', 'the shipped status in the account');
    await wait(async () => (await adminState('$.data.desk.open')) === 1, 'one order left to ship');
});

await client.close();
console.log(failed === 0 ? 'all checks passed' : `${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
