# Magnetic: paying for agent use after the allowance

Status: built (see "As built"). Follows M8's "Not in M8": "Paying for more agent use after the $5."

## The problem
- The beta gives each person a one-time allowance of agent use (`--user-allowance`, $5 on the beta). When it is spent,
  every agent turn is refused: "You have used your $5 of agent use." Nothing lets a person go on.
- Everything else (apps, editing by hand, sharing, data) stays free. Only the agent costs money, and Magnetic already
  prices each request (`Budgets`, `agent_request`).

## What a person sees
- **Agent use** on Your apps opens `/settings/billing`:
  - what they have: the allowance, what they bought, what they spent, and what is left;
  - buttons to add agent use, one per amount the server offers (default $10, $25, $50);
  - their payments: date, amount, and refunds.
- Pressing an amount goes to the payment provider's hosted checkout page. Magnetic never sees a card.
- Coming back, the page says the payment is confirmed, or that it is being confirmed and shows in a moment.
- When the allowance and anything bought is spent, the agent's refusal says so and points to Agent use.

## Decisions
- **Stripe Checkout**, hosted, in payment mode, called with `fetch` (no SDK): a session per purchase, and a signed
  webhook that says it was paid. Card data stays with Stripe.
- **Credit is in dollars of agent use, at the prices Magnetic already charges** (`MODEL_PRICES`): paying $10 adds $10.
  Stripe's fee comes out of the operator's side. A margin, if the operator wants one, is a later change of the
  price table, not of this.
- **A ledger, `agent_credit`:** one row per payment (`+dollars`) and one per payment's refunds (`-dollars`, the
  refunded total, updated in place). The checkout session id and the payment intent are unique, so a webhook
  delivered twice adds nothing.
- **The webhook is the only thing that adds credit.** The return to `/settings/billing?paid=<session>` only reads.
  The webhook checks Stripe's signature (`Stripe-Signature`, HMAC-SHA256 of `<t>.<body>`, five minutes' tolerance),
  that the currency is usd, and that the person exists.
- **Paid use is not held to the free limits.** While a person spends what they bought (their spending is past the
  allowance and they have bought some), the daily limit and the server's monthly budget do not stop them: those
  limit what the operator gives away. An org's own monthly budget still applies to its workspace.
- **Refunds** (`charge.refunded`) take the refunded dollars off. A person whose refunds leave them below what they
  spent is simply refused until they buy more.
- **Configuration, environment only:** `MAGNETIC_STRIPE_SECRET_KEY` and `MAGNETIC_STRIPE_WEBHOOK_SECRET`. Without
  both, the page shows the balance and says buying is not available here. `MAGNETIC_TOP_UPS` (`--top-ups`) lists the
  amounts. The webhook's URL is `<origin>/billing/stripe`, with the events `checkout.session.completed`,
  `checkout.session.async_payment_succeeded` and `charge.refunded`.
- **Credit stays at cost** (decided 2026-11-16): each dollar paid buys a dollar of agent use at the model prices.
- **The beta's $5 goes to the first 100 people** (`--allowance-users 100`), by when they first signed in. Later
  people start with none, the page and the agent's refusal say why, and they may buy agent use. A deleted account
  frees its place for the next person.
- Payments need a one-time allowance (`--user-allowance`): without one there is nothing to top up, and the page says
  agent use has no limit per person here.

## Checks
- A purchase: the checkout session asks Stripe for the right amount, in usd, with the person's id; the signed webhook
  adds the credit once, however often it comes; a bad signature, an old timestamp, another currency or an unknown
  person adds nothing.
- A person past the allowance is refused, then may start a turn once the payment lands, and is not held to the daily
  limit while spending it.
- A refund takes the credit off.
- E2E against a stand-in Stripe (the test server's port + 3): the page, a purchase through the stand-in checkout page
  and its signed webhook, the balance after it, and a refund.

## As built
- `magnetic/src/billing/Stripe.ts`: the checkout session and the webhook's events, with the signature check
  (`signatureOf` makes one, for tests and the stand-in).
- `magnetic/src/billing/Credits.ts` and migration `0008_payments.sql`: the ledger.
- `magnetic/src/agent/Budgets.ts`: `spent()` has `bought`; `check()` adds it to the allowance and lets paid use past
  the daily and monthly limits.
- `magnetic/src/server/billingRoutes.ts`, `src/http/billingPage.ts`, `src/http/billingText.ts`: the page and the
  webhook. The page's `form-action` also allows Stripe's checkout origin, so its form can go on to Stripe.
- Options: `MAGNETIC_STRIPE_SECRET_KEY`, `MAGNETIC_STRIPE_WEBHOOK_SECRET`, `--top-ups` / `MAGNETIC_TOP_UPS`.
- Not done: receipts and invoices beyond Stripe's own emails; taxes; a margin over the model prices; an org paying
  for its members. Turning it on in production needs the operator's Stripe account, its keys in the environment,
  and the webhook endpoint registered at Stripe.
