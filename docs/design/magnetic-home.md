# Magnetic: Your apps as tabs, with shares to accept or reject

Status: built 2026-11-18.

Asked for on 2026-11-18: "I think our home screen needs some work. We want to show a user their apps in a grid, with
the shared ones marked. Users should be able to accept and reject shares in that grid. This is basically a screen with
a tab heading that let's users switch between seeing their apps, orgs, usage and profile"

Then, after a first build: "Let's make the app tiles all one size. Let's remove the text under Your apps. Let's
separate the "shared" from the buttons. Let's use icons for the accept / reject"

## Summary
Your apps (`/`) is one screen with the title Magnetic and four tabs: **Apps**, **Orgs**, **Usage** and **Profile**. The
Apps tab holds Make an app and one grid of tiles: the person's own apps and the apps shared with them, the shared ones
marked. A share the person has not answered waits at the front of the grid with Accept and Reject.

## The tabs
- **Apps:** a notice while org invites wait ("Orgs have invited you: see Orgs."), Make an app, the heading Your apps and
  the grid. Nothing under the heading.
- **Orgs:** the invites that wait (Join, Decline), the heading Your orgs with Make an org (hidden in the beta), a hint,
  and a grid of the person's orgs; an org opens its settings.
- **Usage:** a ring of the agent use spent against all the person may spend (allowance plus what they bought), accent,
  then warning from 80% and danger once spent; the line "You have used $1.20 of $5.00." (or "You have used $1.20." with
  no limit), what today cost, and Agent use, which opens `/settings/billing`.
- **Profile:** the person's name and email, the appearance and language menus, Connections, Data, Admin (admins only)
  and Sign out; then Your pages (Edit and Reset for Your apps and for the editor).
- The tab shown is kept in the page's data (`$.data.home.tab`), so coming back to `/` shows the tab last left.

## The grid
- One record grid of every app, each tile the same size (the grid's item height; a short card stretches to it). The
  order: shares waiting for an answer, the person's own apps (latest change first), then the shares they accepted.
- A shared tile has a **Shared** badge in its top corner, apart from its buttons. Its note says who shares it and the
  right ("alice · use").
- A waiting share has two icon buttons at its foot, Accept (check, success) and Reject (x, danger), and does not open
  until accepted. An accepted share opens like the person's own app and keeps its Shared badge.
- Reject asks first ("Reject this app? It leaves your apps, and opens for you again only through its link."), then the
  page reloads.

## Answers to shares
- A share is an app a link was opened for (`link_grant_member`) or an app of one of the person's orgs they may open.
- New shares wait (owner, 2026-11-18). `share_answer` (migration `0012_share_answers.sql`) holds each person's answer per
  app: `accepted` or `rejected`. The migration records every link already opened as accepted, so nothing that was
  on Your apps before starts to wait.
- `POST /shares/<app>/accept` and `POST /shares/<app>/reject` (signed in, same origin) answer `{ answered }`.
- **Accept** keeps the app as one of the person's tiles.
- **Reject** removes the tile and, in one transaction, drops the person's link membership for every link to that app,
  so the link list no longer gives it to them. An org app stays reachable through the org but no longer shows.
- Opening a link to a rejected app again makes the person a member anew, which deletes the rejection: the share waits
  again.

## Decisions
- New shares wait for an answer rather than joining the grid at once (owner, 2026-11-18).
- The card model of the grids has no field defaults. A persona binding starts as its model's defaults, which on a map
  of cards would be keys beside the cards; the server writes `own` and `answered` on every app card.
- A write keeps the keys a map has where they are and appends new ones, so `HomeApps.show` empties a list first when its
  cards must change order (a new share goes to the front).

## As built
- `magnetic/migrations/0012_share_answers.sql`, `magnetic/src/sharing/ShareAnswers.ts`, `magnetic/src/sharing/Grants.ts`
  (`join` clears a rejection).
- `magnetic/src/home/HomeApp.ts` (`homeScreen`, `appGrid`, the models, `show`), `magnetic/src/http/home.ts`
  (`shareAccept`, `shareReject`), `magnetic/src/http/text.ts` (the `home.tab*`, `home.shared`, `home.accept`,
  `home.reject`, `home.usage*` and `home.profileText` texts in four languages), `magnetic/src/server/startMagnetic.ts`
  (`homeRoute`, the `/shares/…` route).
- `stateui-components`: `record-grid` slots are one-cell grids, so a short item stretches to the item height.
- Tests: `magnetic/src/server/sharing.test.ts` ("should keep an accepted share among the apps, drop a rejected one with
  its link, and make it wait again when the link is opened anew"); `magnetic/e2e/share.spec.ts` (Accept, and "a share
  rejected on Your apps goes, and comes back waiting when its link is opened again"); `magnetic/e2e/home.spec.ts` (the
  tabs, the tab kept); `stateui-components/test/composites/record-grid.browser.test.ts` ("should stretch a short item
  to the item height, so every tile is one size").
