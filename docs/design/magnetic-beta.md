# Magnetic: the beta

Status: built. Asked for on 2026-11-16: "Right now we are doing a beta test. We're going to eat the $500 so 100 users
can try it out. We should have 1 org that we do this on, and only the first 100 get the $5." Then: "I want to provide
a url and the first 100 people get the $5. After that users are told that the 100 users has been reached and try back
after the beta test." The monthly cap goes from $100 to $500, so the whole beta can be spent in a month.

## How it goes
1. An admin opens **Admin** and presses **Start the beta**. That makes the org `beta` ("Magnetic beta") with them as
   its owner, and shows the **beta link**, `https://<server>/beta/<code>`, with the places taken.
2. The admin hands out the link. Whoever opens it signs in (or signs up), then sees how many of the 100 places are left
   and what comes with one, and presses **Join the beta**. They join the org as a builder and get $5 of agent use.
3. Once 100 people hold a place, the link says the beta is full: "It has reached its 100 people. Try again after the
   beta test." They do not join.
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
- **Joined members build where they like**: their own workspace or the beta org's. The allowance is the person's,
  wherever they spend it.
- **The server's monthly budget is $500**, the whole beta: 100 × $5.
- Without `--beta-org` everything is as before: the first `--allowance-users` people to sign in get the allowance.

## Settings
- `MAGNETIC_BETA_ORG` / `--beta-org` (the slug, `beta` on the host), with `MAGNETIC_ALLOWANCE_USERS='100'`,
  `MAGNETIC_USER_ALLOWANCE='5'` and `MAGNETIC_MONTHLY_BUDGET='500'` in `infra/aws/host-deploy.sh`. It needs
  `MAGNETIC_SECRET_KEY`.

## As built
- `magnetic/src/beta/Beta.ts`: the code, the status, starting the org, joining, and a person's place.
- `magnetic/src/agent/Budgets.ts`: the allowance by beta place, and the refusals.
- `magnetic/src/server/betaRoutes.ts` and `magnetic/src/http/betaPage.ts`: `/beta/<code>`, in four languages.
- Admin: Start the beta and the link on the overview; "Beta place n" and the free use by place on People.
- The Agent use page says the beta is full, or that free use comes with the invite link.
- Tests: `src/server/beta.test.ts`, options.
