// The payment adapter the store's checkout calls as the server procedure `payment.charge`.
//
// - Mock (the default): approves every charge, except one whose card name contains "decline", so the refusal path can
//   be tried. No request leaves the machine.
// - Stripe test mode: with STRIPE_SECRET_KEY set to a test key (sk_test_…), each charge is a PaymentIntent confirmed
//   with one of Stripe's published test payment methods. Nothing here takes card details: the checkout never asks for
//   a card number. A key that is not a test key is refused when the server starts.

const STRIPE_API = 'https://api.stripe.com/v1/payment_intents';

/** The mode the adapter runs in, from the environment; throws for a Stripe key that is not a test key */
export function paymentMode(env = process.env) {
    const key = env.STRIPE_SECRET_KEY;
    if (key === undefined || key === '') return { mode: 'mock' };
    if (!key.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY is not a test key (sk_test_…). This store only runs Stripe in test mode');
    return { mode: 'stripe-test', key };
}

const wantsDecline = (payload) => typeof payload?.cardName === 'string' && payload.cardName.toLowerCase().includes('decline');

function mockCharge(payload) {
    if (wantsDecline(payload)) return { status: 'rejected', reason: 'The card was declined (mock: the name on the card contains "decline")' };
    return { status: 'accepted', value: { ref: `mock_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, mode: 'mock' } };
}

async function stripeCharge(payload, key, fetcher) {
    const body = new URLSearchParams({
        amount: String(Math.round(payload.amount * 100)),
        currency: String(payload.currency ?? 'usd').toLowerCase(),
        // Stripe's published test payment methods: a Visa that succeeds, or a card that is always declined
        payment_method: wantsDecline(payload) ? 'pm_card_chargeDeclined' : 'pm_card_visa',
        confirm: 'true',
        'automatic_payment_methods[enabled]': 'true',
        'automatic_payment_methods[allow_redirects]': 'never',
        description: `Tide & Timber order ${payload.orderNumber ?? ''}`.trim()
    });
    if (typeof payload.email === 'string' && payload.email !== '') body.set('receipt_email', payload.email);
    let response;
    try {
        response = await fetcher(STRIPE_API, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' }, body });
    } catch {
        return { status: 'rejected', reason: 'The payment provider could not be reached' };
    }
    const answer = await response.json().catch(() => ({}));
    if (response.ok && answer.status === 'succeeded') return { status: 'accepted', value: { ref: answer.id, mode: 'stripe-test' } };
    return { status: 'rejected', reason: answer?.error?.message ?? `The payment was not completed (${answer.status ?? response.status})` };
}

/** Makes the `payment.charge` procedure: `({ amount, currency, email, cardName, orderNumber }) => { status, value: { ref, mode } | reason }` */
export function createCharge(env = process.env, fetcher = fetch) {
    const { mode, key } = paymentMode(env);
    return async (payload) => {
        if (typeof payload?.amount !== 'number' || !(payload.amount > 0)) return { status: 'rejected', reason: 'There is nothing to pay for' };
        return mode === 'mock' ? mockCharge(payload) : stripeCharge(payload, key, fetcher);
    };
}
