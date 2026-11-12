// The back office app: a dashboard, the orders and the products. It shares the products and orders datasets with the
// storefront, so an order placed there shows here at once, and a price, a stock level or an order status changed here
// shows there.

const DESK = '$.data.desk';
const usd = { format: 'currency', currency: 'USD' };

const STATUSES = { paid: { _label: 'Paid, to ship' }, packed: { _label: 'Packed' }, shipped: { _label: 'Shipped' }, delivered: { _label: 'Delivered' }, cancelled: { _label: 'Cancelled' } };
const ROOMS = { lighting: { _label: 'Lighting' }, ceramics: { _label: 'Ceramics' }, textiles: { _label: 'Textiles' }, kitchen: { _label: 'Kitchen' } };

/** A screen's root: the side menu and the content */
const page = (title, children) => ({
    component: 'panel',
    padding: 'none',
    layout: { type: 'grid', cols: 6, gap: 'none', collapseBelow: 'md' },
    children: {
        menu: {
            component: 'nav',
            orientation: 'vertical',
            placement: { span: 1 },
            _label: 'Back office',
            header: { component: 'text', textRole: 'heading', _text: 'Tide & Timber' },
            children: {
                home: { component: 'menuItem', icon: 'layout-dashboard', _label: 'Dashboard', screen: 'home' },
                orders: { component: 'menuItem', icon: 'package', _label: 'Orders', screen: 'orders' },
                products: { component: 'menuItem', icon: 'category', _label: 'Products', screen: 'products' }
            }
        },
        content: { component: 'panel', padding: 'lg', placement: { span: 5 }, layout: { type: 'column' }, _title: title, children }
    }
});

const orderColumns = {
    number: { _title: 'Order', field: 'number', sortable: true },
    placedOn: { _title: 'Placed', field: 'placedOn', sortable: true },
    name: { _title: 'Customer', field: 'name' },
    status: { _title: 'Status', cell: { component: 'badge', variant: 'soft', tone: 'accent', '<-_text': '$row.status' } },
    total: { _title: 'Total', field: 'total', align: 'end', ...usd }
};

export function adminApp(brand) {
    const home = page('Dashboard', {
        stats: {
            component: 'panel',
            padding: 'none',
            layout: { type: 'grid', cols: 4, collapseBelow: 'sm' },
            children: {
                orders: { component: 'panel', bordered: true, children: { stat: { component: 'stat', _label: 'Orders', '<-value': `${DESK}.orders` } } },
                revenue: { component: 'panel', bordered: true, children: { stat: { component: 'stat', _label: 'Revenue', ...usd, '<-value': `${DESK}.revenue` } } },
                open: { component: 'panel', bordered: true, children: { stat: { component: 'stat', _label: 'To ship', '<-value': `${DESK}.open` } } },
                low: { component: 'panel', bordered: true, children: { stat: { component: 'stat', _label: 'Running low', '<-value': `${DESK}.lowStockCount` } } }
            }
        },
        lists: {
            component: 'panel',
            padding: 'none',
            layout: { type: 'grid', cols: 2, collapseBelow: 'md' },
            children: {
                latest: {
                    component: 'panel',
                    bordered: true,
                    _title: 'Latest orders',
                    layout: { type: 'column' },
                    children: { table: { component: 'table', placement: { height: '300px' }, _empty: 'No orders yet.', '<-items': `${DESK}.latest.records`, columns: orderColumns } }
                },
                stock: {
                    component: 'panel',
                    bordered: true,
                    _title: 'Running low',
                    _description: 'Fewer than six left',
                    layout: { type: 'column' },
                    children: {
                        table: {
                            component: 'table',
                            placement: { height: '300px' },
                            _empty: 'Every piece is well stocked.',
                            '<-items': `${DESK}.lowStock.records`,
                            columns: { title: { _title: 'Piece', field: 'title', width: '2fr' }, room: { _title: 'Room', field: 'categoryTitle' }, stock: { _title: 'Left', field: 'stock', align: 'end', format: 'number' } }
                        }
                    }
                }
            }
        }
    });

    const orders = page('Orders', {
        split: {
            component: 'panel',
            padding: 'none',
            layout: { type: 'grid', cols: 5, gap: 'lg', collapseBelow: 'lg' },
            children: {
                orderList: {
                    component: 'table',
                    placement: { span: 3, height: 'calc(100vh - 140px)' },
                    selectable: 'single',
                    striped: true,
                    sortBy: 'placedOn',
                    sortDir: 'desc',
                    _empty: 'No orders yet.',
                    '<-items': '$.data.orders',
                    columns: orderColumns
                },
                detail: {
                    component: 'panel',
                    bordered: true,
                    placement: { span: 2 },
                    layout: { type: 'column' },
                    _title: 'The order',
                    _description: 'Pick an order to see it and move it along',
                    children: {
                        status: { component: 'selectField', _label: 'Status', options: STATUSES, '<-value': '^orderList.current.status' },
                        facts: {
                            component: 'descriptionList',
                            '<-record': '^orderList.current',
                            items: {
                                number: { _term: 'Order', field: 'number' },
                                name: { _term: 'Customer', field: 'name' },
                                email: { _term: 'Email', field: 'email' },
                                address: { _term: 'Street', field: 'address' },
                                city: { _term: 'City', field: 'city' },
                                postcode: { _term: 'Postcode', field: 'postcode' },
                                subtotal: { _term: 'Subtotal', field: 'subtotal', ...usd },
                                shipping: { _term: 'Delivery', field: 'shipping', ...usd },
                                tax: { _term: 'Tax', field: 'tax', ...usd },
                                total: { _term: 'Total', field: 'total', ...usd },
                                paymentRef: { _term: 'Payment', field: 'paymentRef' }
                            }
                        },
                        lines: {
                            component: 'table',
                            placement: { height: '220px' },
                            _empty: 'No order picked.',
                            '<-items': '^orderList.current.lines',
                            columns: { title: { _title: 'Piece', field: 'title', width: '2fr' }, qty: { _title: 'Qty', field: 'qty', align: 'end', format: 'number' }, lineTotal: { _title: 'Total', field: 'lineTotal', align: 'end', ...usd } }
                        }
                    }
                }
            }
        }
    });

    const products = page('Products', {
        split: {
            component: 'panel',
            padding: 'none',
            layout: { type: 'grid', cols: 5, gap: 'lg', collapseBelow: 'lg' },
            children: {
                catalog: {
                    component: 'table',
                    placement: { span: 3, height: 'calc(100vh - 140px)' },
                    selectable: 'single',
                    striped: true,
                    sortBy: 'title',
                    '<-items': '$.data.products',
                    columns: {
                        title: { _title: 'Piece', field: 'title', width: '2fr', sortable: true },
                        room: { _title: 'Room', field: 'categoryTitle', sortable: true },
                        price: { _title: 'Price', field: 'price', align: 'end', sortable: true, ...usd },
                        stock: { _title: 'In stock', field: 'stock', align: 'end', format: 'number', sortable: true }
                    }
                },
                editor: {
                    component: 'panel',
                    bordered: true,
                    placement: { span: 2 },
                    _title: 'The piece',
                    _description: 'Pick a piece to change it. Every change is live in the store at once',
                    children: {
                        picture: { component: 'image', ratio: '16:9', radius: 'md', fit: 'cover', '<-src': '^catalog.current.image', _alt: 'The picked piece' },
                        title: { component: 'textField', _label: 'Name', '<-value': '^catalog.current.title' },
                        numbers: {
                            component: 'panel',
                            padding: 'none',
                            layout: { type: 'grid', cols: 2 },
                            children: {
                                price: { component: 'numberField', _label: 'Price', min: 0, step: 1, ...usd, '<-value': '^catalog.current.price' },
                                stock: { component: 'numberField', _label: 'In stock', stepper: true, min: 0, step: 1, '<-value': '^catalog.current.stock' }
                            }
                        },
                        room: { component: 'selectField', _label: 'Room', options: ROOMS, '<-value': '^catalog.current.category' },
                        featured: { component: 'switchField', _label: 'Show on the home page', '<-checked': '^catalog.current.featured' },
                        description: { component: 'textareaField', _label: 'Description', rows: 4, '<-value': '^catalog.current.description' }
                    }
                }
            }
        }
    });

    const logic = {
        // The dashboard's numbers follow the orders and the products
        'rules.order-stats': {
            when: { path: '$.data.orders' },
            do: [
                { command: 'set', target: `${DESK}.orders`, value: '{{ size($.data.orders) }}' },
                { command: 'set', target: `${DESK}.revenue`, value: "{{ round(sum($.data.orders, 'total'), 2) }}" },
                { command: 'set', target: `${DESK}.open`, value: "{{ count($.data.orders, 'status', 'paid') }}" },
                { command: 'query', from: '$.data.orders', sort: '-placedAt', window: { first: 0, count: 5 }, into: `${DESK}.latest` }
            ]
        },
        'rules.low-stock': {
            when: { path: '$.data.products' },
            do: [{ command: 'query', from: '$.data.products', filter: '$record.stock < 6', sort: 'stock', into: `${DESK}.lowStock` }]
        },
        'rules.low-stock-count': { when: { path: `${DESK}.lowStock.total` }, do: [{ command: 'set', target: `${DESK}.lowStockCount`, value: `{{ ${DESK}.lowStock.total }}` }] },
        // A piece moved to another room takes that room's name
        'tables.room-title': {
            inputs: { room: { path: '$.data.products.{id}.category', values: Object.keys(ROOMS) } },
            outputs: { title: '$.data.products.{id}.categoryTitle' },
            rows: Object.entries(ROOMS).map(([room, { _label }]) => ({ room, title: _label }))
        }
    };

    return {
        name: 'tide-admin',
        create: {
            name: 'tide-admin',
            title: `${brand.name} back office`,
            themes: ['tide'],
            data: { products: { dataset: 'tide-products' }, orders: { dataset: 'tide-orders' }, desk: { model: 'tide-desk', scope: 'persona' } }
        },
        screens: [
            { name: 'home', root: home },
            { name: 'orders', title: 'Orders', root: orders },
            { name: 'products', title: 'Products', root: products }
        ],
        logic
    };
}
