#!/usr/bin/env node
// Checks the payment adapter without the network: the mock, and Stripe test mode against a stand-in for Stripe's API.
//   node payments.check.mjs

import { createCharge, paymentMode } from './payments.mjs';

let failed = 0;
const check = async (name, run) => {
    try {
        await run();
        console.log(`  ok    ${name}`);
    } catch (error) {
        failed += 1;
        console.log(`  FAIL  ${name}\n        ${error instanceof Error ? error.message : String(error)}`);
    }
};
const equal = (actual, expected, what) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const order = { amount: 66.98, currency: 'USD', email: 'robin@example.com', cardName: 'Robin Vale', orderNumber: 'TT-261112-193005' };

console.log('payments');
await check('the mock approves a charge and refuses one whose card name says decline, or with nothing to pay', async () => {
    const charge = createCharge({});
    const approved = await charge(order);
    equal([approved.status, approved.value.mode, approved.value.ref.startsWith('mock_')], ['accepted', 'mock', true], 'the approval');
    equal((await charge({ ...order, cardName: 'Please Decline' })).status, 'rejected', 'the refusal');
    equal((await charge({ ...order, amount: 0 })).status, 'rejected', 'nothing to pay');
});

await check('a Stripe key that is not a test key is refused', async () => {
    let message = '';
    try {
        paymentMode({ STRIPE_SECRET_KEY: 'sk_live_abc' });
    } catch (error) {
        message = error.message;
    }
    if (!message.includes('not a test key')) throw new Error(`no refusal: ${message}`);
    equal(paymentMode({ STRIPE_SECRET_KEY: 'sk_test_abc' }).mode, 'stripe-test', 'the test key');
});

await check('Stripe test mode sends a confirmed PaymentIntent in cents with a test payment method, and no card details', async () => {
    const sent = [];
    const stripe = async (url, init) => {
        sent.push({ url, auth: init.headers.authorization, body: Object.fromEntries(init.body) });
        return { ok: true, status: 200, json: async () => ({ id: 'pi_test_123', status: 'succeeded' }) };
    };
    const answer = await createCharge({ STRIPE_SECRET_KEY: 'sk_test_abc' }, stripe)(order);
    equal(answer, { status: 'accepted', value: { ref: 'pi_test_123', mode: 'stripe-test' } }, 'the answer');
    equal([sent[0].url, sent[0].auth, sent[0].body.amount, sent[0].body.currency, sent[0].body.payment_method, sent[0].body.confirm], ['https://api.stripe.com/v1/payment_intents', 'Bearer sk_test_abc', '6698', 'usd', 'pm_card_visa', 'true'], 'the request');
    if (Object.keys(sent[0].body).some((key) => /card\[|number|cvc|exp_/.test(key))) throw new Error('card details were sent');
});

await check("Stripe test mode gives Stripe's reason for a declined card, and says so when Stripe cannot be reached", async () => {
    const declined = async () => ({ ok: false, status: 402, json: async () => ({ error: { message: 'Your card was declined.' } }) });
    const down = async () => {
        throw new Error('network');
    };
    equal(await createCharge({ STRIPE_SECRET_KEY: 'sk_test_abc' }, declined)({ ...order, cardName: 'Decline' }), { status: 'rejected', reason: 'Your card was declined.' }, 'the refusal');
    equal((await createCharge({ STRIPE_SECRET_KEY: 'sk_test_abc' }, down)(order)).reason, 'The payment provider could not be reached', 'the outage');
});

console.log(failed === 0 ? 'all checks passed' : `${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
