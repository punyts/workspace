// The invented store: Tide & Timber, small-batch goods for a calmer home. Brand, categories, products and their
// pictures. The pictures are small SVG illustrations kept as data: URLs, so the store needs no image host.

export const BRAND = {
    name: 'Tide & Timber',
    tagline: 'Small-batch goods for a calmer home',
    story:
        'We work with a handful of studios along the coast: potters, weavers and woodworkers who make things slowly and well. Every piece is made in small runs, so what you buy was shaped by a person, not a line.',
    email: 'hello@tideandtimber.example',
    currency: 'USD',
    freeShippingFrom: 75,
    shippingFee: 6.5,
    taxRate: 0.08
};

export const CATEGORIES = {
    lighting: { id: 'lighting', title: 'Lighting', blurb: 'Warm, low light for evenings', tint: ['#f6e7c8', '#e9c98a'] },
    ceramics: { id: 'ceramics', title: 'Ceramics', blurb: 'Thrown and glazed by hand', tint: ['#dde9e4', '#a9c9bf'] },
    textiles: { id: 'textiles', title: 'Textiles', blurb: 'Linen, wool and cotton', tint: ['#ece1ee', '#cdb3d3'] },
    kitchen: { id: 'kitchen', title: 'Kitchen', blurb: 'Tools worth keeping out', tint: ['#f3ddd2', '#e0a98e'] }
};

/** One simple illustration per kind of object, drawn on a 400 x 300 canvas */
const ART = {
    lamp: (c) => `<rect x="192" y="150" width="16" height="92" rx="6" fill="${c.dark}"/><ellipse cx="200" cy="246" rx="58" ry="12" fill="${c.dark}"/><path d="M140 150 L170 70 H230 L260 150 Z" fill="${c.main}"/><path d="M140 150 H260 L254 162 H146 Z" fill="${c.dark}" opacity=".35"/>`,
    pendant: (c) => `<rect x="198" y="0" width="4" height="96" fill="${c.dark}"/><path d="M130 190 Q200 40 270 190 Z" fill="${c.main}"/><ellipse cx="200" cy="190" rx="70" ry="12" fill="${c.dark}"/><circle cx="200" cy="198" r="14" fill="#fff6d8"/>`,
    candle: (c) => `<rect x="165" y="120" width="70" height="120" rx="10" fill="${c.main}"/><rect x="165" y="120" width="70" height="22" rx="10" fill="${c.dark}" opacity=".3"/><rect x="198" y="96" width="4" height="26" fill="${c.dark}"/><path d="M200 60 Q216 84 200 100 Q184 84 200 60 Z" fill="#f7b955"/>`,
    lantern: (c) => `<rect x="150" y="96" width="100" height="140" rx="12" fill="${c.main}"/><rect x="166" y="112" width="68" height="108" rx="6" fill="#fff6d8"/><path d="M170 96 Q200 40 230 96" fill="none" stroke="${c.dark}" stroke-width="8"/><rect x="140" y="232" width="120" height="14" rx="6" fill="${c.dark}"/>`,
    sconce: (c) => `<rect x="120" y="60" width="26" height="180" rx="8" fill="${c.dark}"/><path d="M146 130 H210" stroke="${c.dark}" stroke-width="10"/><path d="M196 190 L214 96 H276 L294 190 Z" fill="${c.main}"/>`,
    vase: (c) => `<path d="M176 60 H224 V96 Q268 130 262 190 Q256 244 200 246 Q144 244 138 190 Q132 130 176 96 Z" fill="${c.main}"/><ellipse cx="200" cy="60" rx="24" ry="7" fill="${c.dark}"/><path d="M160 150 Q200 170 240 150" fill="none" stroke="${c.dark}" stroke-width="5" opacity=".5"/>`,
    mug: (c) => `<rect x="138" y="100" width="110" height="130" rx="16" fill="${c.main}"/><path d="M248 126 Q300 130 296 170 Q292 206 248 204" fill="none" stroke="${c.main}" stroke-width="16"/><rect x="138" y="100" width="110" height="24" rx="12" fill="${c.dark}" opacity=".3"/>`,
    bowl: (c) => `<path d="M110 130 H290 Q286 226 200 230 Q114 226 110 130 Z" fill="${c.main}"/><ellipse cx="200" cy="130" rx="90" ry="16" fill="${c.dark}"/><rect x="170" y="228" width="60" height="12" rx="5" fill="${c.dark}"/>`,
    plate: (c) => `<ellipse cx="200" cy="160" rx="120" ry="78" fill="${c.main}"/><ellipse cx="200" cy="160" rx="84" ry="52" fill="none" stroke="${c.dark}" stroke-width="5" opacity=".5"/>`,
    pitcher: (c) => `<path d="M160 70 H236 L250 86 L236 100 V224 Q236 244 200 244 Q160 244 160 224 Z" fill="${c.main}"/><path d="M160 110 Q112 116 116 160 Q120 200 160 196" fill="none" stroke="${c.main}" stroke-width="14"/><rect x="160" y="70" width="76" height="16" fill="${c.dark}" opacity=".3"/>`,
    throw: (c) => `<rect x="110" y="170" width="180" height="46" rx="12" fill="${c.dark}"/><rect x="118" y="128" width="164" height="46" rx="12" fill="${c.main}"/><rect x="126" y="88" width="148" height="44" rx="12" fill="${c.dark}" opacity=".75"/><path d="M134 110 H266 M130 152 H270 M124 194 H276" stroke="#fff" stroke-width="3" opacity=".5"/>`,
    cushion: (c) => `<rect x="118" y="78" width="164" height="150" rx="34" fill="${c.main}"/><path d="M150 110 L250 196 M250 110 L150 196" stroke="${c.dark}" stroke-width="5" opacity=".45"/><circle cx="200" cy="153" r="9" fill="${c.dark}"/>`,
    towel: (c) => `<rect x="150" y="50" width="100" height="200" rx="8" fill="${c.main}"/><path d="M150 96 H250 M150 116 H250 M150 204 H250" stroke="${c.dark}" stroke-width="7" opacity=".55"/><path d="M158 250 V262 M172 250 V262 M186 250 V262 M200 250 V262 M214 250 V262 M228 250 V262 M242 250 V262" stroke="${c.main}" stroke-width="4"/>`,
    rug: (c) => `<rect x="80" y="100" width="240" height="110" rx="6" fill="${c.main}"/><rect x="100" y="118" width="200" height="74" fill="none" stroke="${c.dark}" stroke-width="5" opacity=".6"/><path d="M130 155 L160 135 L190 155 L220 135 L250 155 L270 142" fill="none" stroke="${c.dark}" stroke-width="5" opacity=".6"/>`,
    apron: (c) => `<path d="M160 60 H240 L262 120 V236 H138 V120 Z" fill="${c.main}"/><rect x="170" y="150" width="60" height="44" rx="6" fill="${c.dark}" opacity=".4"/><path d="M160 60 Q200 20 240 60" fill="none" stroke="${c.dark}" stroke-width="6"/>`,
    board: (c) => `<rect x="110" y="96" width="170" height="120" rx="20" fill="${c.main}"/><rect x="280" y="140" width="50" height="32" rx="14" fill="${c.main}"/><circle cx="314" cy="156" r="7" fill="${c.bg}"/><path d="M134 126 Q200 146 256 122 M134 160 Q200 184 256 156" fill="none" stroke="${c.dark}" stroke-width="4" opacity=".4"/>`,
    kettle: (c) => `<path d="M130 240 Q126 120 200 116 Q274 120 270 240 Z" fill="${c.main}"/><path d="M270 170 L318 136 L322 150 L276 196 Z" fill="${c.main}"/><path d="M150 116 Q200 40 250 116" fill="none" stroke="${c.dark}" stroke-width="10"/><circle cx="200" cy="112" r="10" fill="${c.dark}"/>`,
    jar: (c) => `<rect x="146" y="96" width="108" height="148" rx="18" fill="${c.main}"/><rect x="156" y="66" width="88" height="34" rx="8" fill="${c.dark}"/><rect x="166" y="140" width="68" height="46" rx="6" fill="#fff" opacity=".7"/>`,
    spoons: (c) => `<ellipse cx="150" cy="96" rx="26" ry="36" fill="${c.main}"/><rect x="144" y="126" width="12" height="120" rx="6" fill="${c.main}"/><ellipse cx="210" cy="96" rx="22" ry="32" fill="${c.dark}"/><rect x="205" y="122" width="10" height="124" rx="5" fill="${c.dark}"/><path d="M252 60 H282 V110 Q267 124 252 110 Z" fill="${c.main}"/><rect x="262" y="116" width="10" height="130" rx="5" fill="${c.main}"/>`,
    mill: (c) => `<path d="M170 110 Q200 90 230 110 L244 236 H156 Z" fill="${c.main}"/><circle cx="200" cy="84" r="26" fill="${c.dark}"/><rect x="194" y="46" width="12" height="20" rx="5" fill="${c.dark}"/><path d="M162 170 H238" stroke="${c.dark}" stroke-width="5" opacity=".4"/>`
};

/** The picture of a product as a data: URL: its object on the soft backdrop of its category */
export function picture(kind, colours, tint) {
    const c = { main: colours[0], dark: colours[1], bg: tint[0] };
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${tint[0]}"/><stop offset="1" stop-color="${tint[1]}"/></linearGradient></defs>` +
        `<rect width="400" height="300" fill="url(#g)"/><ellipse cx="200" cy="256" rx="130" ry="14" fill="#000" opacity=".08"/>${ART[kind](c)}</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const P = (id, category, kind, colours, title, price, stock, featured, description, details) => ({ id, category, kind, colours, title, price, stock, featured, description, details });

const LIST = [
    P('harbor-lamp', 'lighting', 'lamp', ['#f2efe6', '#8a6f4d'], 'Harbor table lamp', 128, 14, true, 'A linen shade on a turned oak stem. Gives a soft, even light that suits a reading corner.', 'Oak and linen · 42 cm tall · E27 bulb, not included'),
    P('dune-pendant', 'lighting', 'pendant', ['#c98a4b', '#7a4a22'], 'Dune pendant', 164, 6, true, 'A hand-spun copper dome with a warm patina that deepens over the years.', 'Spun copper · 34 cm wide · 1.5 m cloth cord'),
    P('beeswax-pillar', 'lighting', 'candle', ['#f1d48a', '#b98a2f'], 'Beeswax pillar candle', 24, 60, false, 'Pure beeswax from a single apiary. Burns clean for around forty hours.', 'Beeswax, cotton wick · 12 cm tall'),
    P('storm-lantern', 'lighting', 'lantern', ['#3f5a63', '#22343a'], 'Storm lantern', 86, 11, false, 'Powder-coated steel and thick glass, for the porch or the dinner table.', 'Steel and glass · 30 cm tall · takes a pillar candle'),
    P('reading-sconce', 'lighting', 'sconce', ['#e9e2d2', '#55606a'], 'Reading sconce', 112, 4, false, 'A swing-arm wall light with a pleated shade. Mounts beside a bed or a desk.', 'Steel and cotton · 28 cm reach · plug-in'),

    P('tidal-vase', 'ceramics', 'vase', ['#6f9c94', '#3d6660'], 'Tidal vase', 74, 9, false, 'Stoneware with a sea-green glaze that pools where the potter’s fingers left their mark.', 'Stoneware · 26 cm tall · watertight'),
    P('morning-mug', 'ceramics', 'mug', ['#e8dccb', '#9a7b5f'], 'Morning mug', 28, 48, true, 'A generous mug with a thumb rest. The speckled glaze is different on every one.', 'Stoneware · 350 ml · dishwasher safe'),
    P('salt-bowl', 'ceramics', 'bowl', ['#f4efe6', '#bfae96'], 'Serving bowl', 58, 16, false, 'Wide, shallow and matte white. Big enough for a salad for six.', 'Stoneware · 30 cm wide'),
    P('shore-plates', 'ceramics', 'plate', ['#dfe7e3', '#8fa9a1'], 'Shore plates, set of four', 96, 12, false, 'Dinner plates with a raised rim and a soft grey-green glaze.', 'Stoneware · 26 cm · set of four'),
    P('creamer-pitcher', 'ceramics', 'pitcher', ['#d9a58b', '#9a5d43'], 'Small pitcher', 42, 3, false, 'For milk, gravy or a few stems from the garden. Terracotta glazed inside only.', 'Terracotta · 500 ml'),

    P('wool-throw', 'textiles', 'throw', ['#b98fb8', '#6e4a72'], 'Lambswool throw', 148, 8, true, 'Woven on a narrow loom in two tones of heather. Warm without the weight.', 'Lambswool · 130 × 180 cm · dry clean'),
    P('linen-cushion', 'textiles', 'cushion', ['#d8c9a8', '#8b7650'], 'Linen cushion', 54, 22, false, 'Stonewashed linen with a feather pad and a hidden zip.', 'Linen cover, feather pad · 50 × 50 cm'),
    P('waffle-towels', 'textiles', 'towel', ['#f1ede4', '#7f97a3'], 'Waffle towels, pair', 46, 30, false, 'Cotton waffle weave that dries fast and softens with every wash.', 'Cotton · 50 × 100 cm · set of two'),
    P('jute-rug', 'textiles', 'rug', ['#cfae7c', '#7c5a2c'], 'Flatweave jute rug', 220, 5, false, 'Hand-woven jute with a simple zigzag. Hard-wearing enough for a hallway.', 'Jute · 120 × 180 cm'),
    P('makers-apron', 'textiles', 'apron', ['#5b7f8c', '#2f4a55'], 'Maker’s apron', 62, 0, false, 'Heavy cotton canvas with a split pocket and cross-back straps.', 'Cotton canvas · one size'),

    P('oak-board', 'kitchen', 'board', ['#c79a66', '#7a5126'], 'Oak serving board', 68, 18, true, 'A single piece of oak, oiled by hand, with a handle that fits the palm.', 'Oak · 40 × 22 cm · oil now and then'),
    P('enamel-kettle', 'kitchen', 'kettle', ['#b9503e', '#6f271c'], 'Enamel kettle', 92, 7, false, 'Enamelled steel in a deep brick red. Works on every hob, including induction.', 'Enamelled steel · 1.6 l'),
    P('pantry-jars', 'kitchen', 'jar', ['#cfe0dc', '#5e4a36'], 'Pantry jars, set of three', 48, 20, false, 'Thick glass with oak lids and a silicone seal. Three sizes that nest.', 'Glass and oak · 0.5, 1 and 1.5 l'),
    P('olive-spoons', 'kitchen', 'spoons', ['#b08a55', '#6d5230'], 'Olive wood spoons', 36, 26, false, 'Three spoons carved from olive wood offcuts: stirring, tasting and serving.', 'Olive wood · set of three'),
    P('pepper-mill', 'kitchen', 'mill', ['#3b3a38', '#1f1e1d'], 'Pepper mill', 58, 10, false, 'A ceramic grinder in a blackened ash body. Adjusts from fine to cracked.', 'Ash and ceramic · 18 cm tall')
];

/** The product records by id: title, price, category, stock, the picture and the copy */
export const PRODUCTS = Object.fromEntries(
    LIST.map((product) => {
        const category = CATEGORIES[product.category];
        return [
            product.id,
            {
                id: product.id,
                title: product.title,
                price: product.price,
                category: product.category,
                categoryTitle: category.title,
                description: product.description,
                details: product.details,
                image: picture(product.kind, product.colours, category.tint),
                stock: product.stock,
                featured: product.featured
            }
        ];
    })
);

/** The picture a category shows: the first product of it */
export function categoryRecords() {
    return Object.fromEntries(
        Object.values(CATEGORIES).map((category) => {
            const first = LIST.find((product) => product.category === category.id);
            return [category.id, { id: category.id, title: category.title, blurb: category.blurb, image: picture(first.kind, first.colours, category.tint) }];
        })
    );
}

/** Two orders already placed, so the back office has something to show on its first day */
export const SEED_ORDERS = {
    'tt-1001': {
        number: 'TT-1001', placedAt: '2026-11-08T09:14:00.000Z', placedOn: '2026-11-08', status: 'shipped', email: 'maya@example.com', name: 'Maya Okafor',
        address: '14 Quay Street', city: 'Portland', postcode: '04101', country: 'US',
        lines: { 'morning-mug': { title: 'Morning mug', qty: 2, price: 28, lineTotal: 56 }, 'oak-board': { title: 'Oak serving board', qty: 1, price: 68, lineTotal: 68 } },
        summary: '3 pieces', items: 3, subtotal: 124, shipping: 0, tax: 9.92, total: 133.92, paymentRef: 'mock_seed_1001', paymentMode: 'mock', stockApplied: true
    },
    'tt-1002': {
        number: 'TT-1002', placedAt: '2026-11-10T16:40:00.000Z', placedOn: '2026-11-10', status: 'paid', email: 'jonas@example.com', name: 'Jonas Lind',
        address: '3 Mill Lane', city: 'Burlington', postcode: '05401', country: 'US',
        lines: { 'beeswax-pillar': { title: 'Beeswax pillar candle', qty: 2, price: 24, lineTotal: 48 } },
        summary: '2 pieces', items: 2, subtotal: 48, shipping: 6.5, tax: 3.84, total: 58.34, paymentRef: 'mock_seed_1002', paymentMode: 'mock', stockApplied: true
    }
};
