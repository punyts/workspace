# Magnetic: the company org, the beta org and invites

Status: built (local); the hosted database is reset with the next deploy. Asked for on 2026-11-23: "Let's have our ai-minion org which is for our internal company. Let's have
a beta test org that we'll use for our beta test. Everyone that uses the beta test url and log in will be added to the
beta test org." Then:

> The beta test will stop inviting users when the org reaches 100 users. Those users will have $5 of AI usage plus
> unlimited manual editing. The beta org will have a budget of $500. The ai-minion org should be an additional $50.
> Our org permissions should set each user as able to view their own apps. User's can make their app "org public" to
> allow others in the org to see their apps. The admin, my user, will have permissions to see all apps. Let's set up a
> workflow we'll use for adding users to an org. The org admin can add users by email, an email is sent inviting the
> person, that takes them to a sign up workflow where they verify their email address, then are added to the org they
> were invited to. For the ai-minion org, I need to be invited when the system first spins up; rodger@ai-minion.com.
> Reset the database.

The owner chose (2026-11-23): an invited person signs in afterwards with an emailed link; the admin is one account,
owner of both orgs; each org's budget is per month; the local database is reset now and the hosted one with the next
deploy. Later the same day:

> Also, magnetic should be in the ai-minion org. That includes the sign in, home and editor. That is all magnetic.
> It's set to public which allows external users to edit it for their local state, edits aren't pushed to the org's
> version.

This changes how people join in [magnetic-beta.md](magnetic-beta.md) ("Signing up"); the places, the $5, the full
notice and the agent use ring stay as they are.

## The two orgs
- **The company org** (`--internal-org`, `ai-minion` on the host, named after its slug): the company's own work.
  People join it only by invite. It holds Magnetic's own pages: the drafts of sign-in, the link page, Your apps and the
  editor are apps in its workspace, which its owners and admins manage and publish
  ([magnetic-editable.md](magnetic-editable.md)). What is published is public: everyone gets a copy of Your apps and the
  editor in their own workspace and may change it there; nothing they change reaches the org's version.
- **The beta org** (`--beta-org`, `beta`, "Magnetic beta"): the beta test. People join it through the beta link, as
  builders, while fewer than 100 hold a place (`--allowance-users`); each place comes with $5 of agent use
  (`--user-allowance`) and editing by hand has no limit. An invite also adds someone to it, and takes a place like the
  link does.
- **Both are made when the server starts**, if they are not there, with no members yet. Each gets the policies below.
  After that the policies are the org's own: an owner changes them on the org's settings page.
- **The admins are invited as owners of both.** Each address in `MAGNETIC_ADMIN_EMAILS` (`rodger@ai-minion.com` on the
  host) gets an invite to each org while it is not a member there and has no invite waiting; the invite is from
  Magnetic itself. Accepting the first one makes the account and makes them owner of that org; the other waits on Your
  apps and in their email.

## Policies the server gives them
| | company org | beta org |
|---|---|---|
| Apps in members' own workspaces (`personalWorkspaces`) | off | off |
| Agent budget per UTC month (`monthlyBudget`) | $50 (`--internal-budget`) | $500 (`--beta-budget`) |

- **Apps live in the org.** With personal workspaces off, a member's new app is made in the org's workspace (`/new`
  picks, of the orgs that turn them off and where they are builder or above, the first by name). There:
  - whoever made an app manages it, and nobody else in the org sees it;
  - **org public** is the app's "open to the org" switch: every member may then open and use it (`open`, `read`);
  - the org's owners and admins see and manage every app (`admins`): the admin, as owner of both, sees all.
- **Budgets follow the workspace.** A turn in an org's app counts against that org's budget, and with personal
  workspaces off that is where its members build, so the org's budget is what its members spend. The server's own
  monthly cap is the sum, $550 (`MAGNETIC_MONTHLY_BUDGET`). A beta tester's $5 still holds within the beta's $500.

## Adding someone by email
1. An owner or admin of the org enters an email and a role on the org's settings page (as built in P3), and Magnetic
   emails the invite (SES). The link is `/invites/<token>`; it works once, for 7 days.
2. Opening the link, signed out or signed in as someone with another email, shows **Join <org>**: the org, the role,
   who invited them, the address the invite was sent to, and a name field (filled when the account exists). The link
   came to that address, so opening it verifies the email.
3. **Join** signs them in as the account of that address, made now if there is none (an `email` identity whose subject
   is the address; an account that already has the address verified gets that identity added), accepts the invite and
   opens the org. Signed in already with the invited address, the page has only Join.
4. A beta invite takes a place like the link; once the beta is full, the invite still adds them, without a place.

## Signing in with an email link
- The sign-in page's email field (shown when the server can send email, or an org has its own sign-in) signs in by
  email: an address at a domain an org verified and signs in itself goes to that org's provider, as before; any other
  address gets an email with a sign-in link, when an account has that address verified.
- The page then says the same either way: "If an account uses <address>, we sent it a link to sign in. It works once,
  for 10 minutes." So the field tells nobody which addresses have accounts.
- The link is a one-time sign-in link (`device_link`, as for signing in another device): opening it asks to confirm,
  so a mail scanner that opens it signs nobody in.
- At most three links per address in 10 minutes.

## The beta link
- `/beta/<code>` joins a signed-in person to the beta org at once while places are left, and then shows what they
  joined. Signed out, it sends them to sign in (LinkedIn) and back to the link.
- Signing in anywhere else joins nobody. They get their own workspace and no free agent use, as the agent tells them.
- Once 100 hold a place the link says the beta is full; they can still sign in.

## Decisions
- **Orgs are made by the server, not by people.** Making an org stays closed (403) while `--beta-org` is set.
- **An invite from Magnetic has no inviter** (`org_invite.created_by` is null); the email and the page say "Magnetic".
- **An account is found by its verified address**, never by an unverified one, so a provider that does not check
  email cannot be used to take over an invited account.
- **Joining through an invite replaces the session**: whoever was signed in in that browser is signed out.
- Without `--internal-org` there is no company org; without `--beta-org` everything is as before the beta.

## Settings
- `MAGNETIC_INTERNAL_ORG` / `--internal-org` (`ai-minion`), `MAGNETIC_INTERNAL_BUDGET` / `--internal-budget` (`50`),
  `MAGNETIC_BETA_BUDGET` / `--beta-budget` (`500`), `MAGNETIC_MONTHLY_BUDGET` (`550`), in `infra/aws/host-deploy.sh`.
- `MAGNETIC_ADMIN_EMAILS` (SSM, us-east-1) must hold `rodger@ai-minion.com`.
- Sending needs `MAGNETIC_MAIL_FROM` (SES, out of the sandbox to reach any address).

## As built
- `magnetic/migrations/0001_baseline.sql`: `org.created_by` and `org_invite.created_by` may be null (made or
  invited by the server).
- `magnetic/src/orgs/ServerOrgs.ts`: `ensureServerOrgs` (before the pages are made) and `inviteServerAdmins` (once
  the server's address is known), both under the advisory lock `server-orgs`. `MAGNETIC` in `Orgs.ts` and
  `Policies.ts` is the server as actor; `Orgs.bySlug`, `Orgs.unasked`, `Orgs.invitation`.
- `magnetic/src/server/options.ts` and `src/cli.ts`: `--internal-org`, `--internal-budget`, `--beta-budget`.
- `magnetic/src/server/inviteRoutes.ts` and `invitePage` in `src/http/orgSettings.ts`: `/invites/<token>`, signed
  in or not. `Accounts.signInByEmail` and `Accounts.byVerifiedEmail`; `Accounts.signIn` links a provider's first
  sign-in with a verified email to the account that has it verified.
- `magnetic/src/server/startMagnetic.ts`: the email-link branch of `/signin/sso` (`mailSignInLink`, three per address
  in ten minutes per server); `/new` in the org; org apps the person edits or manages on Your apps, with the org's
  name in the note; `GET /edit/<id>/share` answers `org`, `POST /edit/<id>/share/org` sets org public; the pages
  workspace is the company org's.
- `magnetic/src/mail/Mailer.ts`: `signInLink`. The editor's Share sheet has the org public switch (`orgOpen`,
  `src/editor/EditorApp.ts`, `src/http/shell.ts`).
- Removed: Start the beta (`POST /admin/beta`, `Beta.start`), the beta page's Join button, and joining the beta at
  sign-in.
- `magnetic/src/testing/betaPersonas.ts`: the seed makes both orgs with Avery as owner, so a seeded server invites
  no one. `beta.dev.env` matches the host.

## Tests
- `src/mail/mail.test.ts`: the sign-in link (same answer for every address, at most three, signs in once); the
  server's orgs made once with their budgets and each admin invited and emailed once, from Magnetic.
- `src/server/orgSettings.test.ts`: the invite page signed in and out; joining with no account makes a verified
  account and a session; an org app on Your apps and org public from Share.
- `src/server/beta.test.ts`: the beta org made at start, the admin invited as owner, joining by opening the link,
  nobody joined at sign-in.
- `src/server/enterprise.test.ts`: `/new` in the org, refused to a member.
- `src/accounts/accounts.test.ts`: one account per verified address.
- `src/server/options.test.ts`; `e2e/signin.spec.ts`, `e2e/errors.spec.ts`.
