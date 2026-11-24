# Magnetic: the beta

Status: built. Asked for on 2026-11-16: "Right now we are doing a beta test. We're going to eat the $500 so 100 users
can try it out. We should have 1 org that we do this on, and only the first 100 get the $5." Then: "I want to provide
a url and the first 100 people get the $5. After that users are told that the 100 users has been reached and try back
after the beta test." The monthly cap goes from $100 to $500, so the whole beta can be spent in a month.

Then: "Let's remove the sign in with email, we're doing a beta with linkedin... let's remove the create org... Everyone
should be on my org and I'm the only admin. I want to post a link on LinkedIn and as people sign up they get added to
my org. They get $5 and can use the editor as much as they want. They need to see their budget and usage in the
editor, and when their $5 is up the chat textbox is disabled with a message saying they can continue manually. Once
the 100 person limit is hit, the login will say we've met our limit, but they can log in using LinkedIn and that we'll
contact them when we do the next beta test." That is **Signing up** below; it changes steps 1 to 4 where it says.

## Signing up (the beta as it runs now)
- **People sign in with the server's providers** (LinkedIn on the host), with an emailed sign-in link, or with their
  work email through an org's own provider ([magnetic-orgs-and-invites.md](magnetic-orgs-and-invites.md)).
- **The server makes the beta org at start** ("Magnetic beta", with personal workspaces off and its $500 a month) and
  invites the admins (`MAGNETIC_ADMIN_EMAILS`) as its owners (owner, 2026-11-23).
- **Opening the beta link signed in joins it**, as a builder with a place, while places are left. Signing in anywhere
  else joins nobody. An invite from the org's owners also adds someone, and takes a place the same way.
- **Once the places are taken**, the sign-in page says so: "The beta is full. It has reached its 100 people. You can
  still sign in with LinkedIn, and we'll contact you when we run the next beta test." They sign in without a place or
  free agent use, and the refusals and the Agent use page say the same.
- **Nobody makes an org**: Make an org is gone from Your apps and from Orgs, and making one answers 403 ("Making an org
  is not open yet."). The admin's beta org is the only one.
- **The editor shows agent use** as a small ring in the chat bar, used against the whole budget, accent, then warning
  from 80% and danger once spent, in place of the line above the bar (owner, 2026-11-18). Its tip says
  "Agent use: $1.20 of $5.00 used, $3.80 left" (from `GET /edit/<app>/budget`, again after every turn). Once the agent
  may not be asked, the request and Send are off and the tip says why; when the $5 is spent: "You have used your $5.00
  of agent use. You can carry on building by hand: select anything in your app to change it." Editing by hand has no
  limit.
- All of this holds while `--beta-org` is set; without it, sign-in and orgs are as before.

## How it goes
1. The admin opens **Admin**, which shows the **beta link**, `https://<server>/beta/<code>`, with the places taken.
2. The admin hands out the link. Whoever opens it signs in (or signs up) and comes back to it, joins the org as a
   builder and gets $5 of agent use; the page says so.
3. Once 100 people hold a place, the link says the beta is full: "It has reached its 100 people. We'll contact you when
   we run the next beta test." They do not join.
4. Someone who signs up without the link gets no free agent use. While places are left, the agent tells them it comes
   with the beta's invite link; once full, that the beta has reached its 100 people and to try again after it.

## Decisions
- **A place is a membership** of the beta org with the role builder or member, in the order people joined
  (`org_member.joined_at`). The org's owners and admins run it and hold none, so the admins' own use does not take a
  place: they can give themselves agent use on People.
- **Leaving frees a place.** Someone removed from the org loses the allowance, and the next to join gets it.
- **The code in the link** is an HMAC of the org's slug with the server's key (`MAGNETIC_SECRET_KEY`): it stays the same
  across restarts and servers, needs no table, and cannot be guessed. A wrong code, or no beta org yet, is a 404.
- **The last place is taken once.** Joins lock the org's row, so two people pressing at the same time cannot both get
  the hundredth place.
- **Members build in the beta org's workspace**: it has personal workspaces off, so `/new` makes their apps there.
  The allowance is the person's, within the org's $500 a month.
- **The server's monthly budget is $550**: the beta org's $500 and the company org's $50.
- Without `--beta-org` everything is as before: the first `--allowance-users` people to sign in get the allowance.

## Settings
- `MAGNETIC_BETA_ORG` / `--beta-org` (the slug, `beta` on the host), with `MAGNETIC_ALLOWANCE_USERS='100'`,
  `MAGNETIC_USER_ALLOWANCE='5'`, `MAGNETIC_BETA_BUDGET='500'` and `MAGNETIC_MONTHLY_BUDGET='550'` in
  `infra/aws/host-deploy.sh`. It needs
  `MAGNETIC_SECRET_KEY`.

## As built
- `magnetic/src/beta/Beta.ts`: the code, the status, joining, and a person's place. The org is made by
  `magnetic/src/orgs/ServerOrgs.ts` at start.
- `magnetic/src/agent/Budgets.ts`: the allowance by beta place, and the refusals.
- `magnetic/src/server/betaRoutes.ts` and `magnetic/src/http/betaPage.ts`: `/beta/<code>`, in four languages.
- Admin: the link on the overview; "Beta place n" and the free use by place on People.
- The Agent use page says the beta is full, or that free use comes with the invite link.
- Tests: `src/server/beta.test.ts`, options.

### Trying it locally (the development seed)
- `--seed beta|beta-full` (`MAGNETIC_SEED`; needs `--beta-org`, loopback hosts only),
  `magnetic/src/testing/betaPersonas.ts`: the beta org with the admin as its owner, and people to sign in as with
  their spend, gifts, payments and feedback. It runs on every start and adds only what is missing.
- From the workspace: `npm run magnetic:beta` (`--seed beta`) and `npm run magnetic:beta-full` (`--seed beta-full`),
  with `--migrate`, `--mock-provider` and `--mock-agent`; their settings are in `magnetic/beta.dev.env`, the host's
  beta (org `beta`, $5 each for 100 places, no daily limit, $500 a month) with a development secret key and `hash`
  embedding. `npm run magnetic:reset` deletes the local database volume and starts it empty.
- The sign-in page has a button for each persona:
  - Avery, the admin who runs the beta (owns the org, opens `/admin`);
  - Nell, who has never signed in and takes a place on first sign-in (fresh only after a reset);
  - Hana, $2.40 of $5 used;
  - Nico, $4.90 used: one more turn;
  - Uma, all $5 used: chat off, editing by hand;
  - Gia, used $5 and given $3 more by the admin;
  - Theo, used $5 and bought $10 more.
- Testers hold the other places, leaving 3 open with `beta`, or none with `beta-full`.
- The personas are development users with profiles (`/signin/dev`): the sign-in gives each a name and a verified
  email, which plain dev users do not have, and the seed adds Avery's email to the admins.
- The mock agent charges about $0.15 a turn when seeded, so allowances move as people use the editor.
