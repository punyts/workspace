// The storefront app: its shared header and footer and its screens, as the arguments of the build tools.
// The logic is in storeLogic.mjs.

import { CHECKOUT, SESSION, storeLogic } from './storeLogic.mjs';

const money = (term, field) => ({ _term: term, field, format: 'currency', currency: 'USD' });

/** A screen's root: the shared header, the content and the shared footer */
const page = (children) => ({
    component: 'panel',
    padding: 'none',
    layout: { type: 'column', gap: 'none' },
    children: {
        // The header is shared; each screen links its bag count to the visitor's totals
        header: { component: 'tide-header', children: { bag: { children: { count: { '<-count': '$.data.totals.items' } } } } },
        content: { component: 'panel', padding: 'lg', placement: { grow: 1 }, layout: { type: 'column' }, children },
        footer: { component: 'tide-footer' }
    }
});

/** A product card of a grid: the picture, the name, the room and the price; pressing it opens the product */
const productCard = {
    component: 'card',
    interactive: true,
    padding: 'sm',
    '<-_title': '$row.title',
    '<-_subtitle': '$row.categoryTitle',
    media: { component: 'image', '<-src': '$row.image', '<-_alt': '$row.title', ratio: '4:3' },
    children: {
        price: { component: 'stat', size: 'sm', format: 'currency', currency: 'USD', fractionDigits: 0, _label: 'Price', '<-value': '$row.price' }
    },
    on: {
        press: [
            { command: 'set', target: `${SESSION}.product`, value: '$row' },
            { command: 'navigate', target: 'product' }
        ]
    }
};

const productGrid = (records, height) => ({
    component: 'recordGrid',
    placement: { height },
    '<-records': records,
    theme: { recordgrid: { itemmin: '230px', itemheight: '330px' } },
    row: productCard
});

const field = (label, path, extra = {}) => ({ component: 'textField', _label: label, required: true, '<-value': path, ...extra });

/** The fields of a name and an address, linked to the record at `base` */
const addressFields = (base) => ({
    name: field('Full name', `${base}.name`),
    email: field('Email address', `${base}.email`, { inputType: 'email', pattern: 'email' }),
    address: field('Street address', `${base}.address`),
    place: {
        component: 'panel',
        padding: 'none',
        layout: { type: 'grid', cols: 3, collapseBelow: 'sm' },
        children: {
            city: field('City', `${base}.city`),
            postcode: field('Postcode', `${base}.postcode`),
            country: { component: 'selectField', _label: 'Country', required: true, '<-value': `${base}.country`, options: { US: { _label: 'United States' }, CA: { _label: 'Canada' }, GB: { _label: 'United Kingdom' } } }
        }
    }
});

const totalsList = {
    component: 'descriptionList',
    '<-record': '$.data.totals',
    items: { subtotal: money('Subtotal', 'subtotal'), shipping: money('Delivery', 'shipping'), tax: money('Tax', 'tax'), total: money('Total', 'total') }
};

export function storeApp(brand) {
    const header = {
        name: 'tide-header',
        summary: 'The Tide & Timber header: the name, the menu and the bag',
        category: 'navigation',
        purposes: ['show the store header on every screen', 'open the bag from any screen', 'move between the store screens'],
        exposes: [{ path: 'children.bag.children.count.count', description: 'The number of items in the bag: link it to the totals' }],
        tree: {
            component: 'panel',
            bordered: true,
            padding: 'sm',
            layout: { type: 'row', align: 'center', gap: 'md' },
            children: {
                brand: { component: 'link', _text: brand.name, screen: 'home', tone: 'neutral' },
                menu: {
                    component: 'nav',
                    orientation: 'horizontal',
                    placement: { grow: 1 },
                    _label: 'Store',
                    children: {
                        home: { component: 'menuItem', _label: 'Home', screen: 'home' },
                        shop: { component: 'menuItem', _label: 'Shop', screen: 'shop' },
                        account: { component: 'menuItem', _label: 'Account', screen: 'account' }
                    }
                },
                bag: {
                    component: 'toolbar',
                    align: 'end',
                    children: {
                        count: { component: 'badge', tone: 'accent', variant: 'solid', count: 0 },
                        open: { component: 'button', variant: 'soft', icon: 'shopping-bag', _title: 'Bag', on: { press: { command: 'navigate', target: 'bag' } } }
                    }
                }
            }
        }
    };
    const footer = {
        name: 'tide-footer',
        summary: 'The Tide & Timber footer: the story in a line and the contact address',
        category: 'navigation',
        purposes: ['show the store footer on every screen', 'show how to contact the store', 'close a store page with the brand line'],
        tree: {
            component: 'panel',
            padding: 'lg',
            layout: { type: 'grid', cols: 3, collapseBelow: 'md' },
            children: {
                about: { component: 'panel', padding: 'none', _title: brand.name, children: { line: { component: 'text', element: 'p', _text: brand.tagline } } },
                help: {
                    component: 'panel',
                    padding: 'none',
                    _title: 'Good to know',
                    children: { line: { component: 'text', element: 'p', _text: `Free delivery over $${brand.freeShippingFrom}. Thirty days to change your mind.` } }
                },
                contact: { component: 'panel', padding: 'none', _title: 'Say hello', children: { line: { component: 'text', element: 'p', _text: brand.email } } }
            }
        }
    };

    const home = page({
        hero: {
            component: 'panel',
            elevation: 'raised',
            padding: 'lg',
            layout: { type: 'grid', cols: 2, collapseBelow: 'md' },
            children: {
                words: {
                    component: 'panel',
                    padding: 'none',
                    children: {
                        title: { component: 'text', element: 'h1', textRole: 'display', _text: brand.tagline },
                        story: { component: 'text', element: 'p', _text: brand.story },
                        go: { component: 'button', size: 'lg', _title: 'Shop the collection', on: { press: [{ command: 'set', target: `${SESSION}.category`, value: 'all' }, { command: 'navigate', target: 'shop' }] } }
                    }
                },
                picture: { component: 'image', ratio: '4:3', radius: 'lg', '<-src': '$.data.products.wool-throw.image', _alt: 'A folded lambswool throw' }
            }
        },
        categories: {
            component: 'panel',
            padding: 'none',
            _title: 'Shop by room',
            layout: { type: 'column' },
            children: {
                grid: {
                    component: 'recordGrid',
                    placement: { height: '270px' },
                    '<-records': '$.data.categories',
                    theme: { recordgrid: { itemmin: '200px', itemheight: '250px' } },
                    row: {
                        component: 'card',
                        interactive: true,
                        padding: 'sm',
                        '<-_title': '$row.title',
                        '<-_subtitle': '$row.blurb',
                        media: { component: 'image', '<-src': '$row.image', '<-_alt': '$row.title', ratio: '4:3' },
                        on: { press: [{ command: 'set', target: `${SESSION}.category`, value: '$row.id' }, { command: 'navigate', target: 'shop' }] }
                    }
                }
            }
        },
        featured: {
            component: 'panel',
            padding: 'none',
            _title: 'Made this season',
            _description: 'A few pieces the studios are proud of right now',
            layout: { type: 'column' },
            children: { grid: productGrid(`${SESSION}.featured.records`, '350px') }
        }
    });

    const shop = page({
        top: {
            component: 'panel',
            padding: 'none',
            _title: 'The collection',
            layout: { type: 'row', align: 'center', wrap: true },
            children: {
                category: {
                    component: 'segmented',
                    _label: 'Room',
                    placement: { grow: 1 },
                    '<-value': `${SESSION}.category`,
                    options: { all: { _label: 'Everything' }, lighting: { _label: 'Lighting' }, ceramics: { _label: 'Ceramics' }, textiles: { _label: 'Textiles' }, kitchen: { _label: 'Kitchen' } }
                },
                search: { component: 'searchBox', _label: 'Search the collection', _placeholder: 'Search', '<-value': `${SESSION}.search` }
            }
        },
        count: { component: 'text', textRole: 'caption', '<-_text': `${SESSION}.notice` },
        grid: productGrid(`${SESSION}.results.records`, 'calc(100vh - 230px)')
    });

    const product = page({
        back: { component: 'link', _text: '← Back to the collection', screen: 'shop' },
        detail: {
            component: 'panel',
            padding: 'none',
            layout: { type: 'grid', cols: 2, gap: 'lg', collapseBelow: 'md' },
            children: {
                picture: { component: 'image', ratio: '4:3', radius: 'lg', placement: { rowSpan: 3 }, '<-src': `${SESSION}.product.image`, '<-_alt': `${SESSION}.product.title` },
                words: {
                    component: 'panel',
                    padding: 'none',
                    children: {
                        room: { component: 'text', textRole: 'caption', tone: 'accent', '<-_text': `${SESSION}.product.categoryTitle` },
                        title: { component: 'text', element: 'h1', textRole: 'display', '<-_text': `${SESSION}.product.title` },
                        price: { component: 'stat', format: 'currency', currency: 'USD', fractionDigits: 0, _label: 'Price', '<-value': `${SESSION}.product.price` },
                        description: { component: 'text', element: 'p', '<-_text': `${SESSION}.product.description` },
                        details: { component: 'text', element: 'p', textRole: 'caption', '<-_text': `${SESSION}.product.details` },
                        stock: { component: 'badge', variant: 'soft', '<-_text': `${SESSION}.stockNote`, '<-tone': `${SESSION}.stockTone` }
                    }
                },
                buy: {
                    component: 'panel',
                    bordered: true,
                    layout: { type: 'row', align: 'end', wrap: true },
                    children: {
                        // The field fills the row beside the button (no width of its own, which would be a count of characters)
                        qty: { component: 'numberField', _label: 'Quantity', stepper: true, min: 1, max: 20, step: 1, placement: { grow: 1 }, '<-value': `${SESSION}.qty` },
                        add: { component: 'button', size: 'lg', icon: 'shopping-bag-plus', _title: 'Add to bag', '<-disabled': `${SESSION}.soldOut` }
                    }
                },
                added: {
                    component: 'alert',
                    tone: 'success',
                    variant: 'soft',
                    _title: 'Added to your bag',
                    _text: 'It will wait there while you look around.',
                    '<-open': `${SESSION}.addedOpen`,
                    actions: { component: 'button', variant: 'outline', size: 'sm', _title: 'See the bag', on: { press: { command: 'navigate', target: 'bag' } } }
                }
            }
        }
    });

    const bag = page({
        lines: {
            component: 'panel',
            padding: 'none',
            _title: 'Your bag',
            layout: { type: 'grid', cols: 3, gap: 'lg', collapseBelow: 'md' },
            children: {
                table: {
                    component: 'table',
                    placement: { span: 2, height: '420px' },
                    _empty: 'Your bag is empty. The collection is one click away.',
                    '<-items': '$.data.bag',
                    columns: {
                        item: { _title: 'Piece', field: 'title', width: '2fr' },
                        price: { _title: 'Price', field: 'price', format: 'currency', currency: 'USD', align: 'end' },
                        qty: {
                            _title: 'Quantity',
                            width: '170px',
                            cell: { component: 'numberField', _label: 'Quantity', titlePosition: 'hidden', size: 'sm', stepper: true, min: 1, max: 20, step: 1, '<-value': '$row.qty' }
                        },
                        lineTotal: { _title: 'Total', field: 'lineTotal', format: 'currency', currency: 'USD', align: 'end' },
                        remove: {
                            _title: 'Remove',
                            width: '90px',
                            align: 'end',
                            cell: { component: 'button', variant: 'ghost', tone: 'danger', size: 'sm', icon: 'trash', iconPosition: 'only', _title: 'Remove from the bag', on: { press: { command: 'delete', target: '$row' } } }
                        }
                    }
                },
                summary: {
                    component: 'panel',
                    bordered: true,
                    _title: 'Summary',
                    children: {
                        totals: totalsList,
                        note: { component: 'text', textRole: 'caption', _text: `Delivery is free over $${brand.freeShippingFrom}.` },
                        checkout: { component: 'button', size: 'lg', fill: true, _title: 'Check out', '<-disabled': '$.data.totals.empty', on: { press: { command: 'navigate', target: 'checkout' } } },
                        more: { component: 'link', _text: 'Keep shopping', screen: 'shop' }
                    }
                }
            }
        }
    });

    const checkout = page({
        title: { component: 'text', element: 'h1', textRole: 'title', _text: 'Checkout' },
        problem: { component: 'alert', tone: 'danger', variant: 'soft', _title: 'The payment did not go through', '<-_text': `${CHECKOUT}.error`, '<-open': `${CHECKOUT}.failed` },
        form: {
            component: 'form',
            validateOn: 'submit',
            layout: { type: 'grid', cols: 3, gap: 'lg', collapseBelow: 'md' },
            children: {
                details: {
                    component: 'panel',
                    bordered: true,
                    placement: { span: 2 },
                    _title: 'Where should it go?',
                    children: {
                        ...addressFields(CHECKOUT),
                        payment: { component: 'divider', _label: 'Payment' },
                        cardName: field('Name on card', `${CHECKOUT}.cardName`, {
                            _help: 'This demo checkout asks for no card number: the payment goes to the store’s payment adapter (a mock, or Stripe in test mode).'
                        })
                    }
                },
                summary: {
                    component: 'panel',
                    bordered: true,
                    _title: 'Your order',
                    children: {
                        totals: totalsList,
                        place: { component: 'button', size: 'lg', fill: true, _title: 'Place order', '<-busy': `${CHECKOUT}.busy`, '<-disabled': '$.data.totals.empty', on: { press: { command: 'submit', target: '$parent' } } },
                        back: { component: 'link', _text: 'Back to the bag', screen: 'bag' }
                    }
                }
            }
        }
    });

    const confirmation = page({
        thanks: {
            component: 'panel',
            elevation: 'raised',
            padding: 'lg',
            children: {
                title: { component: 'text', element: 'h1', textRole: 'display', _text: 'Thank you. It’s on its way to being packed.' },
                line: { component: 'text', element: 'p', _text: 'We have your order and a studio has been told. You can follow it under Account.' },
                facts: {
                    component: 'descriptionList',
                    '<-record': CHECKOUT,
                    items: { orderNumber: { _term: 'Order', field: 'orderNumber' }, orderTotal: money('Paid', 'orderTotal'), paymentRef: { _term: 'Payment reference', field: 'paymentRef' }, paymentMode: { _term: 'Paid through', field: 'paymentMode' } }
                },
                next: {
                    component: 'toolbar',
                    children: {
                        orders: { component: 'button', _title: 'See my orders', on: { press: { command: 'navigate', target: 'account' } } },
                        shop: { component: 'button', variant: 'outline', _title: 'Keep shopping', on: { press: { command: 'navigate', target: 'shop' } } }
                    }
                }
            }
        }
    });

    const account = page({
        title: { component: 'text', element: 'h1', textRole: 'title', _text: 'Your account' },
        profile: {
            component: 'form',
            validateOn: 'submit',
            children: {
                box: { component: 'panel', bordered: true, _title: 'Your details', _description: 'Used to fill in the checkout and to find your orders', children: addressFields('$.data.account') }
            },
            actions: {
                component: 'toolbar',
                children: {
                    save: { component: 'button', _title: 'Save details', on: { press: { command: 'submit', target: '$parent' } } },
                    saved: { component: 'badge', tone: 'success', variant: 'soft', icon: 'check', _text: 'Saved', '<-hidden': '$.data.account.unsaved' }
                }
            }
        },
        orders: {
            component: 'panel',
            bordered: true,
            _title: 'Your orders',
            _description: 'Orders placed with the email address above',
            layout: { type: 'column' },
            children: {
                table: {
                    component: 'table',
                    placement: { height: '320px' },
                    _empty: 'No orders yet for this email address.',
                    '<-items': `${SESSION}.orders.records`,
                    columns: {
                        number: { _title: 'Order', field: 'number' },
                        placedOn: { _title: 'Placed', field: 'placedOn' },
                        summary: { _title: 'Contents', field: 'summary' },
                        status: { _title: 'Status', cell: { component: 'badge', variant: 'soft', tone: 'accent', '<-_text': '$row.status' } },
                        total: { _title: 'Total', field: 'total', format: 'currency', currency: 'USD', align: 'end' }
                    }
                }
            }
        }
    });

    return {
        name: 'tide-store',
        composed: [header, footer],
        create: {
            name: 'tide-store',
            title: brand.name,
            themes: ['tide'],
            data: {
                products: { dataset: 'tide-products' },
                categories: { dataset: 'tide-categories' },
                orders: { dataset: 'tide-orders' },
                bag: { model: 'tide-bag-line', scope: 'persona' },
                totals: { model: 'tide-totals', scope: 'persona' },
                session: { model: 'tide-session', scope: 'persona' },
                checkout: { model: 'tide-checkout', scope: 'persona' },
                account: { model: 'tide-account', scope: 'persona' }
            }
        },
        screens: [
            { name: 'home', root: home },
            { name: 'shop', title: 'Shop', root: shop },
            { name: 'product', title: 'Product', root: product },
            { name: 'bag', title: 'Bag', root: bag },
            { name: 'checkout', title: 'Checkout', root: checkout },
            { name: 'confirmation', title: 'Thank you', root: confirmation },
            { name: 'account', title: 'Account', root: account }
        ],
        logic: storeLogic(brand)
    };
}
