# Magnetic: the admin pages

Status: built. Asked for on 2026-11-16: "We'll need ui for us to admin".

## Who sees them
- The people whose **verified** email is in `MAGNETIC_ADMIN_EMAILS` (comma-separated, any case). An unverified
  email that matches is not enough, so signing up with someone's address gives nothing.
- Anyone else, signed in, gets a 404 at `/admin` and below: the pages do not say they exist. Signed out, the sign-in
  page, then back.
- **Admin** shows on Your apps, by Agent use and Sign out, only for an admin.
- The host deploy reads the list from SSM `/magnetic/admin-emails`, or else uses the privacy contact
  (`MAGNETIC_CONTACT_EMAIL`), so whoever gets the feedback email can act on it.

## The pages
Plain HTML, as the settings pages are, with the same styles; English only, as only the operator reads them. A bar at
the top: Overview, Feedback, People, Your apps.

- **Overview** (`/admin`): people, and new this week; agent use today and this month (against the monthly budget);
  what people paid; what admins gave; open feedback. A line on the free use: how much, to whom, and the places left
  when it goes only to the first people.
- **Feedback** (`/admin/feedback`): open, done or all, and every kind or one; up to 200, newest first. Each shows the
  kind, the sender and their email to reply to, when, the app, the frame size and the language, the text as written
  (escaped, line breaks kept) and the browser. **Done** marks it handled (who and when are kept); **Reopen** undoes it.
  The filters stay as they were after either.
- **The beta** (on the overview, with `--beta-org`): Start the beta, then the link to hand out and the places taken
  (`docs/design/magnetic-beta.md`).
- **People** (`/admin/people`): everyone in the order they signed in, with their beta place when they hold one, which
  is what the allowance goes by in a beta (otherwise sign-in order); for each, what they got free, paid, were given, used and have left, and a form to **give agent use**.

## Giving agent use
- Up to $500 at a time, in cents, more than 0; a leading `$` is fine. A note says why.
- It is a row in the ledger `agent_credit` of kind `gift` (migration 0010), with the note and the admin who gave it,
  so Budgets count it the same as a payment: it lets a person past the daily limit and the monthly budget while they
  spend it.
- The person sees it on Agent use as **Given by Magnetic**.
- A gift cannot be taken back from the page. Run SQL if one was a mistake.

## Not here
- Per person app counts: apps are behind row-level security, which the admin's queries respect.
- Refunds: Stripe's dashboard does them, and its webhook takes them off.
- Deleting people, or making someone an admin from the page: that is the environment's job.

## As built
- `magnetic/src/admin/Admin.ts`: `AdminList` (who is an admin) and `Admin` (the numbers, people, feedback, gifts).
- `magnetic/src/server/adminRoutes.ts`: the routes; `magnetic/src/http/adminPage.ts`: the pages.
- `magnetic/migrations/0010_admin.sql`: feedback's status, the `gift` kind, the note and who gave it.
- `MAGNETIC_ADMIN_EMAILS` in `magnetic/src/server/options.ts`; `infra/aws/host-deploy.sh` sets it.
- Tests: `src/server/admin.test.ts`, `e2e/admin.spec.ts`.
