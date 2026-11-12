// The storefront's logic: it runs on the store's server, on the state the pages sync through the statenet.
// A press or a submitted form reaches it as a change under $.raised (events are state).

export const SESSION = '$.data.session';
export const CHECKOUT = '$.data.checkout';
export const BAG = '$.data.bag';
const PRODUCT = `${SESSION}.product`;

/** The events of the screens the logic acts on, as the state paths the runtime writes them to */
export const EVENTS = {
    add: '$.raised.screens.product.children.content.children.detail.children.buy.children.add.press',
    place: '$.raised.screens.checkout.children.content.children.form.submitted',
    saveProfile: '$.raised.screens.account.children.content.children.profile.submitted'
};

const DETAILS = ['name', 'email', 'address', 'city', 'postcode', 'country'];

export function storeLogic(brand) {
    const subtotal = `sum(${BAG}, 'lineTotal')`;
    const shipping = `(${subtotal} == 0 ? 0 : ${subtotal} >= ${brand.freeShippingFrom} ? 0 : ${brand.shippingFee})`;
    const tax = `round(${subtotal} * ${brand.taxRate}, 2)`;
    const pieces = (count) => `{{ ${count} == 1 ? '1 piece' : join([string(${count}), 'pieces'], ' ') }}`;

    const results = {
        command: 'query',
        from: '$.data.products',
        filter: `(${SESSION}.category == 'all' || $record.category == ${SESSION}.category) && (empty(${SESSION}.search) || includes(lower($record.title), lower(${SESSION}.search)))`,
        sort: 'title',
        into: `${SESSION}.results`
    };
    const myOrders = {
        command: 'query',
        from: '$.data.orders',
        filter: '!empty($.data.account.email) && lower($record.email) == lower($.data.account.email)',
        sort: '-placedAt',
        into: `${SESSION}.orders`
    };
    // TT-261112-193005: the date and the time the order was placed
    const stamp = (from, to) => `slice(now(), ${from}, ${to})`;
    const orderNumber = `{{ join(['TT', join([${stamp(2, 4)}, ${stamp(5, 7)}, ${stamp(8, 10)}], ''), join([${stamp(11, 13)}, ${stamp(14, 16)}, ${stamp(17, 19)}], '')], '-') }}`;

    return {
        // What the grids show: the featured products, and the collection filtered by room and by the search words
        'rules.featured': {
            when: { path: '$.data.products' },
            do: [{ command: 'query', from: '$.data.products', filter: '$record.featured == true', sort: 'title', into: `${SESSION}.featured` }]
        },
        'rules.results-products': { when: { path: '$.data.products' }, do: [results] },
        'rules.results-category': { when: { path: `${SESSION}.category` }, do: [results] },
        'rules.results-search': { when: { path: `${SESSION}.search`, debounce: 250 }, do: [results] },
        'rules.result-count': { when: { path: `${SESSION}.results.total` }, do: [{ command: 'set', target: `${SESSION}.notice`, value: pieces(`${SESSION}.results.total`) }] },

        // The product page: its stock line, and a fresh quantity for each product opened
        'tables.stock': {
            inputs: { stock: { path: `${PRODUCT}.stock`, breaks: [1, 6] } },
            outputs: { note: `${SESSION}.stockNote`, tone: `${SESSION}.stockTone`, soldOut: `${SESSION}.soldOut` },
            rows: [
                { stock: '<1', note: 'Sold out', tone: 'danger', soldOut: true },
                { stock: '<6', note: 'Only a few left', tone: 'warning', soldOut: false },
                { note: 'In stock', tone: 'success', soldOut: false }
            ]
        },
        'rules.opened': {
            when: { path: `${PRODUCT}.id` },
            do: [
                { command: 'set', target: `${SESSION}.qty`, value: 1 },
                { command: 'set', target: `${SESSION}.addedOpen`, value: false }
            ]
        },

        // Add to bag: every press of the button is a change of state the server sees. One rule for a new line and for
        // one already there: merge makes the line when it is missing, then the quantity is raised
        'rules.add': {
            when: { path: EVENTS.add, if: `!empty(${PRODUCT}.id) && ${PRODUCT}.stock > 0` },
            do: [
                {
                    command: 'merge',
                    target: `${BAG}.{{ ${PRODUCT}.id }}`,
                    value: { id: `{{ ${PRODUCT}.id }}`, title: `{{ ${PRODUCT}.title }}`, price: `{{ ${PRODUCT}.price }}`, image: `{{ ${PRODUCT}.image }}` }
                },
                { command: 'increment', target: `${BAG}.{{ ${PRODUCT}.id }}.qty`, value: `{{ ${SESSION}.qty }}` },
                { command: 'set', target: `${SESSION}.addedOpen`, value: true }
            ]
        },

        // The bag: each line's total, then the totals of the bag
        'rules.line-total': {
            // The line is read as $trigger: a product id has hyphens (morning-mug), which an expression would read as a minus
            when: { path: `${BAG}.{id}` },
            do: [{ command: 'set', target: `${BAG}.{id}.lineTotal`, value: '{{ $trigger.qty * $trigger.price }}' }]
        },
        'rules.totals': {
            when: { path: BAG },
            do: [
                { command: 'set', target: '$.data.totals.items', value: `{{ sum(${BAG}, 'qty') }}` },
                { command: 'set', target: '$.data.totals.empty', value: `{{ sum(${BAG}, 'qty') == 0 }}` },
                { command: 'set', target: '$.data.totals.subtotal', value: `{{ ${subtotal} }}` },
                { command: 'set', target: '$.data.totals.shipping', value: `{{ ${shipping} }}` },
                { command: 'set', target: '$.data.totals.tax', value: `{{ ${tax} }}` },
                { command: 'set', target: '$.data.totals.total', value: `{{ round(${subtotal} + ${shipping} + ${tax}, 2) }}` }
            ]
        },

        // Checkout: fill the form from the saved details, then pay, then save the order
        'rules.prefill': {
            when: { path: '$.route.screen', is: 'checkout', if: `$.data.account.saved == true && empty(${CHECKOUT}.name)` },
            do: DETAILS.map((name) => ({ command: 'copy', from: `$.data.account.${name}`, target: `${CHECKOUT}.${name}` }))
        },
        'machines.checkout': {
            state: `${CHECKOUT}.phase`,
            initial: 'idle',
            transitions: [
                {
                    from: 'idle',
                    when: { path: EVENTS.place, if: '$.data.totals.items > 0' },
                    to: 'paying',
                    do: [
                        { command: 'set', target: `${CHECKOUT}.failed`, value: false },
                        { command: 'set', target: `${CHECKOUT}.busy`, value: true },
                        { command: 'set', target: `${CHECKOUT}.orderNumber`, value: orderNumber },
                        {
                            command: 'call',
                            target: 'payment.charge',
                            as: 'pay',
                            value: { amount: '{{ $.data.totals.total }}', currency: brand.currency, email: `{{ ${CHECKOUT}.email }}`, cardName: `{{ ${CHECKOUT}.cardName }}`, orderNumber }
                        }
                    ]
                },
                {
                    from: 'paying',
                    when: { result: 'pay', is: 'accepted' },
                    to: 'saving',
                    do: [
                        { command: 'set', target: `${CHECKOUT}.paymentRef`, value: '{{ $result.value.ref }}' },
                        { command: 'set', target: `${CHECKOUT}.paymentMode`, value: '{{ $result.value.mode }}' },
                        { command: 'set', target: `${CHECKOUT}.orderTotal`, value: '{{ $.data.totals.total }}' },
                        {
                            command: 'save-data',
                            into: '$.data.orders',
                            key: `{{ lower(${CHECKOUT}.orderNumber) }}`,
                            as: 'saved',
                            value: {
                                number: `{{ ${CHECKOUT}.orderNumber }}`,
                                placedAt: '{{ now() }}',
                                placedOn: '{{ today() }}',
                                status: 'paid',
                                ...Object.fromEntries(DETAILS.map((name) => [name, `{{ ${CHECKOUT}.${name} }}`])),
                                lines: `{{ ${BAG} }}`,
                                summary: pieces('$.data.totals.items'),
                                items: '{{ $.data.totals.items }}',
                                subtotal: '{{ $.data.totals.subtotal }}',
                                shipping: '{{ $.data.totals.shipping }}',
                                tax: '{{ $.data.totals.tax }}',
                                total: '{{ $.data.totals.total }}',
                                paymentRef: '{{ $result.value.ref }}',
                                paymentMode: '{{ $result.value.mode }}'
                            }
                        }
                    ]
                },
                {
                    from: 'paying',
                    when: { result: 'pay', is: 'rejected' },
                    to: 'idle',
                    do: [
                        { command: 'set', target: `${CHECKOUT}.error`, value: '{{ $result.reason }}' },
                        { command: 'set', target: `${CHECKOUT}.failed`, value: true },
                        { command: 'set', target: `${CHECKOUT}.busy`, value: false }
                    ]
                },
                {
                    from: 'saving',
                    when: { result: 'saved', is: 'accepted' },
                    to: 'idle',
                    do: [
                        { command: 'set', target: BAG, value: {} },
                        { command: 'set', target: `${CHECKOUT}.busy`, value: false },
                        { command: 'set', target: `${CHECKOUT}.cardName`, value: '' },
                        ...DETAILS.map((name) => ({ command: 'copy', from: `${CHECKOUT}.${name}`, target: `$.data.account.${name}` })),
                        { command: 'set', target: '$.data.account.saved', value: true },
                        { command: 'set', target: '$.data.account.unsaved', value: false },
                        { command: 'navigate', target: 'confirmation' }
                    ]
                },
                {
                    from: 'saving',
                    when: { result: 'saved', is: 'rejected' },
                    to: 'idle',
                    do: [
                        { command: 'set', target: `${CHECKOUT}.error`, value: 'Your payment went through but the order could not be saved. Write to us and we will put it right.' },
                        { command: 'set', target: `${CHECKOUT}.failed`, value: true },
                        { command: 'set', target: `${CHECKOUT}.busy`, value: false }
                    ]
                }
            ]
        },

        // The account: saving the details, and the orders placed with its email address
        'rules.profile-saved': {
            when: { path: EVENTS.saveProfile },
            do: [{ command: 'set', target: '$.data.account.saved', value: true }, { command: 'set', target: '$.data.account.unsaved', value: false }, myOrders]
        },
        'rules.my-orders': { when: { path: '$.data.orders' }, do: [myOrders] },
        'rules.my-orders-email': { when: { path: '$.data.account.email', debounce: 400 }, do: [myOrders] }
    };
}
