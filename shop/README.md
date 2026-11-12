# Tide & Timber

A storefront and a back office for an invented store (small-batch home goods), built as two StateUI apps through
the tools of `@punyts/stateui-mcp`. Nothing here serves HTTP: the pages are the static view page (Vite locally), the
live state goes through the statenet, and the store's server runs the logic, takes the payments and keeps the stock.

## Run it

From the workspace root, once (`npm run setup` or `npm run mcp:build` built the libraries):

```sh
npm run mcp                  # the statenet (4200) and the view page (5180); leave it running
node shop/build.mjs --fresh  # build the store into shop/data through the MCP tools
node shop/server.mjs --serve # run the store: its logic, orders, payments and stock
```

`build.mjs` prints the address of each app, such as `http://127.0.0.1:5180/?app=<id>&statenet=…`; the list at
http://127.0.0.1:5180/ has both (`tide-store`, `tide-admin`). Stop `server.mjs --serve` before building again: one
server owns `shop/data` at a time.

To let an agent change the store, register `node shop/server.mjs` (no `--serve`) as a stdio MCP server instead of
`stateui-mcp`: the same tools, with the store's payment procedure and stock job running.

## What is in it

| File | What |
|---|---|
| `catalog.mjs` | The brand, four rooms, twenty products with their copy, and the pictures (small SVG illustrations kept as `data:` URLs) |
| `parts/models.mjs` | The models: product, category, bag line, totals, order, and the per-visitor records (session, checkout, account, desk) |
| `parts/store.mjs` | The storefront: a shared header and footer and seven screens (home, shop, product, bag, checkout, confirmation, account) |
| `parts/storeLogic.mjs` | The storefront's logic, which runs on the server: search and filter, add to bag, totals, the checkout machine, the account's orders |
| `parts/admin.mjs` | The back office: dashboard, orders (with the status to move them along) and products (edit name, price, stock, room) |
| `build.mjs` | Builds all of it through the tools, as an agent would: theme, models, datasets, components, apps, screens, logic, then validates and previews. `--shots` saves a picture of every screen in `shots/` |
| `server.mjs` | The MCP server with the store's payment procedure and stock job |
| `payments.mjs` | The payment adapter (`payment.charge`): a mock, or Stripe in test mode |
| `inventory.mjs` | Takes each order's quantities off the stock, once |
| `check.mjs`, `payments.check.mjs` | End-to-end checks through the tools and a headless browser, and the adapter's checks |

## How it works

- **Shared data.** Products, categories and orders are datasets both apps bind, so an order placed in the store
  shows in the back office at once, and a price, a stock level or an order status changed there shows in the store.
- **Per-visitor data.** The bag, its totals, the checkout form, the account details and what the visitor is looking
  at are persona bindings: each visitor has their own.
- **Events are state.** The server's logic never sees a click, only state. Pressing "Add to bag" writes
  `$.raised.screens.product…add.press`, submitting the checkout form writes `…form.submitted`, and rules and the
  checkout machine trigger on those paths.
- **Checkout.** A machine: `idle` → (form submitted) `paying`, which calls the server procedure `payment.charge` →
  (accepted) `saving`, which saves the order → `idle`, with the bag emptied, the details kept for the account and the
  confirmation shown. A refused payment goes back to `idle` with the reason shown and the bag kept.
- **Totals.** Delivery is $6.50, free from $75; tax is 8%. `catalog.mjs` holds the numbers.

## Payments

No card number is ever asked for or stored. The checkout calls `payment.charge` with the amount, the email and the
name on the card.

- **Mock** (the default): approves, unless the name on the card contains "decline".
- **Stripe test mode**: start the server with a test key in the environment and each charge is a PaymentIntent
  confirmed with one of Stripe's published test payment methods (`pm_card_visa`, or `pm_card_chargeDeclined` for a
  name containing "decline"):

  ```sh
  STRIPE_SECRET_KEY=sk_test_… node shop/server.mjs --serve
  ```

  A key that is not a test key (`sk_test_…`) is refused when the server starts. The Stripe path is checked against
  a stand-in for Stripe's API (`payments.check.mjs`); it has not been run against Stripe itself.

## Checks

```sh
node shop/payments.check.mjs   # the payment adapter, no network
node shop/build.mjs --fresh && node shop/check.mjs   # the whole store, in a headless browser
```

`check.mjs` browses, filters, opens a product from its card, adds to the bag, changes and removes lines, pays with a
declined and then an approved card, and finds the order in the account, in the back office and in the stock. It places
a real order in `shop/data`, so build again afterwards for a clean store.

## What it is not

- **Accounts have no sign-in.** The local server has one visitor (the default persona): "Account" is that visitor's
  details and the orders placed with their email address. Real sign-in with one workspace per person is what
  `@punyts/magnetic` adds.
- **Orders are visible to the store app.** The storefront binds the whole orders dataset to list the visitor's own,
  so a real deployment would keep orders behind the server (`$.server`) or a per-customer view.
- **The statenet has no authentication** and listens on loopback only: this runs on one machine.
- **One currency, one language, no emails, no refunds.** An order's status is moved by hand in the back office.
