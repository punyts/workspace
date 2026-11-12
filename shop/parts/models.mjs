// The models of the store's data. A field is { type, default?, required? }.

const text = (extra = {}) => ({ type: 'string', ...extra });
const blank = { type: 'string', default: '' };
const zero = { type: 'number', default: 0 };

export const MODELS = {
    'tide-product': {
        id: text({ required: true }),
        title: text({ required: true }),
        price: { type: 'number', required: true },
        category: text({ required: true }),
        categoryTitle: blank,
        description: blank,
        details: blank,
        image: blank,
        stock: { type: 'integer', default: 0 },
        featured: { type: 'boolean', default: false }
    },
    'tide-category': { id: text({ required: true }), title: text({ required: true }), blurb: blank, image: blank },
    // One line of the bag, keyed by the product's id. No field has a default: a visitor's binding starts as the
    // model's defaults, and a bag must start with no lines
    'tide-bag-line': {
        id: text({ required: true }),
        title: text({ required: true }),
        price: { type: 'number', required: true },
        image: text(),
        qty: { type: 'integer', required: true },
        lineTotal: { type: 'number' }
    },
    'tide-totals': { items: { type: 'integer', default: 0 }, empty: { type: 'boolean', default: true }, subtotal: zero, shipping: zero, tax: zero, total: zero },
    // What the visitor is looking at and has asked for: one flat record per visitor
    'tide-session': {
        // The product the visitor opened: a copy of its record (every field there from the start, so the page can link to them)
        product: { type: 'object', default: { id: '', title: '', price: 0, category: '', categoryTitle: '', description: '', details: '', image: '', stock: 0, featured: false } },
        category: { type: 'string', default: 'all' },
        search: blank,
        // The results of the queries the grids and lists show: { records, total }
        results: { type: 'object', default: { records: {}, total: 0 } },
        featured: { type: 'object', default: { records: {}, total: 0 } },
        orders: { type: 'object', default: { records: {}, total: 0 } },
        notice: blank,
        // The product page: the quantity to add, the stock line and whether the added note shows
        qty: { type: 'integer', default: 1 },
        stockNote: blank,
        stockTone: { type: 'string', default: 'success' },
        soldOut: { type: 'boolean', default: false },
        addedOpen: { type: 'boolean', default: false }
    },
    'tide-checkout': {
        name: blank, email: blank, address: blank, city: blank, postcode: blank, country: { type: 'string', default: 'US' },
        cardName: blank,
        phase: { type: 'string', default: 'idle' },
        busy: { type: 'boolean', default: false },
        failed: { type: 'boolean', default: false },
        error: blank,
        orderNumber: blank,
        orderTotal: zero,
        paymentRef: blank,
        paymentMode: blank
    },
    'tide-account': { name: blank, email: blank, address: blank, city: blank, postcode: blank, country: { type: 'string', default: 'US' }, saved: { type: 'boolean', default: false }, unsaved: { type: 'boolean', default: true } },
    'tide-order': {
        number: text({ required: true }),
        placedAt: text({ required: true }),
        placedOn: blank,
        status: { type: 'string', default: 'paid' },
        email: blank, name: blank, address: blank, city: blank, postcode: blank, country: blank,
        lines: { type: 'object', default: {} },
        summary: blank,
        items: { type: 'integer', default: 0 },
        subtotal: zero, shipping: zero, tax: zero, total: zero,
        paymentRef: blank, paymentMode: blank,
        // Set by the server once the order's quantities are taken off the stock (inventory.mjs)
        stockApplied: { type: 'boolean', default: false }
    },
    // The back office's own working values
    'tide-desk': {
        orders: { type: 'integer', default: 0 },
        revenue: zero,
        open: { type: 'integer', default: 0 },
        lowStockCount: { type: 'integer', default: 0 },
        lowStock: { type: 'object', default: { records: {}, total: 0 } },
        latest: { type: 'object', default: { records: {}, total: 0 } }
    }
};
