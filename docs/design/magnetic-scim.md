# Magnetic: SCIM provisioning per org

Status: proposed, 2026-11-20. Follows `magnetic-postgres.md` ("SCIM fits the shapes here and comes after") and S12 of
`statenet-network.md` (SAML).

Asked for on 2026-11-20: "Design SCIM".

An org's identity provider (Okta, Entra ID, Google Workspace, OneLogin) pushes its people and groups to Magnetic over
SCIM 2.0 (RFC 7643, RFC 7644): who is in the org, and which groups they are in. Removing a person at the provider
removes them from the org in Magnetic. Sign-in stays OpenID Connect or SAML; SCIM only says who may join and with which
groups.

## Rules and Constraints
- **Nobody gets an account by SCIM.** A pushed person is held, keyed by email, until they sign in; only then do they
  have an account and a membership (owner, 2026-11-20: "Hold until sign-in").
- **A pushed email must be at one of the org's verified domains.** A provider cannot place someone outside the org's
  domains in the org, nor claim an account that signs in with another address.
- **SCIM never sets a role.** Pushed people join as `member`; owners and admins change roles in Magnetic. SCIM cannot
  make an owner or an admin (owner, 2026-11-20: "No, roles stay in Magnetic").
- **Pushed groups are the provider's.** Admins give them app access, but cannot rename them, delete them or change their
  members; hand-made groups are untouched by SCIM (owner, 2026-11-20: "Pushed groups are read-only").
- **Deactivating or deleting a person removes them from the org**, as an admin's removal does; their account and
  personal workspace stay (owner, 2026-11-20: "Remove from the org").
- The token is a secret: only its SHA-256 is kept, it is shown once, and it is never logged. SCIM bodies hold names
  and emails: they are never logged, and errors name the attribute, never its value.
- Every change SCIM makes is in the org's audit log, with `via: 'scim'`.
- Only the owner turns SCIM on, makes or replaces its token, or turns it off, as for the org's sign-in provider.

## The endpoint
- Base URL `<origin>/scim/v2/<orgId>`, shown on the org's settings page beside the token. The token is a bearer token
  (`Authorization: Bearer …`); it must be the org's current token, or the answer is 401 with no hint of why.
- Served by the same server as everything else, on the main origin. A provider's server sends no `Origin` and no
  cookies, so stateui-mcp's same-origin rule does not stand in its way and no session is involved.
- Content type `application/scim+json` (`application/json` is taken too). Bodies up to 1 MB. Errors are SCIM error
  bodies (`status`, `scimType`, `detail`).
- Resources:
  - `GET /ServiceProviderConfig`, `/ResourceTypes`, `/Schemas`: what is supported. PATCH yes; bulk, sort, ETags,
    password change and `/Me` no; filter yes, `maxResults` 100.
  - `Users`: `GET` (list with `startIndex`, `count`, and a filter), `GET /<id>`, `POST`, `PUT /<id>`, `PATCH /<id>`,
    `DELETE /<id>`.
  - `Groups`: the same, and `excludedAttributes=members` on reads (Entra asks for it).
- Filters: `userName eq "…"`, `externalId eq "…"`, `emails[type eq "work"].value eq "…"` for Users, and
  `displayName eq "…"` and `externalId eq "…"` for Groups. These are the ones Okta and Entra send; anything else is
  400 `invalidFilter`. `eq` on `userName` and emails ignores case.
- PATCH takes `add`, `replace` and `remove`, with or without a `path`, including Entra's forms: a value-filtered path
  (`members[value eq "<id>"]`), booleans sent as the strings `"True"` and `"False"`, and a `replace` with no path whose
  value names `active`.

## A User
- Kept: `id` (made by Magnetic, `randomUUID()`), `externalId`, `userName`, the email, `displayName` or `name`
  (`givenName`, `familyName`), `active`, `meta.created` and `meta.lastModified`. Other attributes sent are accepted and
  not kept; a read returns only what is kept.
- **The email** is the primary of `emails`, else the first, else `userName` when it is an address. With none, or one at
  a domain the org has not verified, the answer is 400 `invalidValue` ("The email is not at one of the org's verified
  domains."). Two users of one org may not share an email or a `userName`: 409 `uniqueness`.
- **Held, then linked.** A pushed person is a row in `scim_user` with no `user_id`. They are linked to a Magnetic
  account:
  - at once, when an account with that **verified** email is already a member of the org;
  - otherwise at their next sign-in whose email is verified and equal to it, by any way in that the org allows: the
    org's OpenID Connect or SAML provider (which vouches only for its verified domains), or another provider with a
    verified email when `requireSso` is off. The same step that runs `autoJoin` today (`SignInRules.signedIn`) does it.
- **Linking** makes the membership (`member`, unless they already are one, whose role stays) and adds them to the pushed
  groups that hold them. Once linked, the link follows the account, not the email: a later change of the email at the
  provider changes the `scim_user` row only.
- **`active: false`, or `DELETE`,** removes the linked member from the org through `Orgs.remove` (groups, app access, the
  org's read grant on their state), closes their open views of the org's apps (1008 `Removed from org`), and keeps their
  instances for hand-over. A deactivated user's row stays (with `active` false) so the provider can turn them on again;
  `DELETE` removes the row. Turning them on again makes them a member once more, as `member`.
- The org's last owner cannot be removed this way: 409 with "The org's last owner is removed in Magnetic, not by its
  identity provider."
- A held person who never signs in costs a row and nothing else.

## A Group
- An `org_group` with `scim_id` and `external_id` set. Its members are kept as `scim_user` ids
  (`scim_group_member`), so a group can hold people not yet linked; `org_group_member` holds the linked ones, which is
  what app access reads, unchanged.
- `displayName` is the group's name. A name already used by a hand-made group of the org is 409 `uniqueness`; the
  admin renames the hand-made group or the provider's.
- On Magnetic's pages a pushed group shows "From your identity provider"; its members can't be added or removed there,
  and it can't be renamed or deleted. Giving it app access works as for any group.
- Members removed from a pushed group lose the access it gave; their open views of apps they can no longer reach close
  (`closeLostViews`, as a group change does today). `DELETE` of a group deletes it and its app access the same way.

## Joining while SCIM is on
- **`autoJoin` gives way to SCIM.** While SCIM is on, a sign-in joins the org only someone SCIM pushed and has active;
  someone at the org's domains whom the provider has not pushed signs in to their own account and is not joined. The
  settings page says so beside `autoJoin`.
- Invites still work, for people the provider does not hold (a contractor). Such members are not SCIM's: it never
  removes them.
- Members already in the org when SCIM is turned on stay. Those the provider then pushes are linked at once (the rule
  above) and become SCIM's; the others stay hand-managed.
- An admin cannot remove a member SCIM holds, nor can that member leave: the page says to remove them at the provider,
  which would otherwise put them back at their next sign-in. Roles change as for any member.

## The settings page
- On the org's settings page (`/settings/orgs/<id>`), owner-only, beside sign-in: **Provisioning (SCIM)**.
  - Off: **Turn on SCIM**, which needs a verified domain. It makes the token and shows it once, with the base URL.
  - On: the base URL; when the token was made and last used; how many people and groups the provider has pushed, and
    how many are still held; **Make a new token** (the old one stops at once); **Turn off SCIM**.
- **Turning SCIM off** deletes the token and the held people, keeps every member and their groups, and makes the pushed
  groups ordinary hand-made groups. Turning it on again starts empty, and the provider pushes everyone again; groups
  of the same name are then 409 until renamed, which the page warns of before turning it off.
- Texts in English, German, French and Spanish, as the rest of the settings page.

## Storage (migration 0022)
| Table | Columns | Notes |
|---|---|---|
| `org_scim` | `org_id` PK, `token_hash` unique, `created_by`, `created_at`, `last_used_at` | A row is SCIM on |
| `scim_user` | `id` PK, `org_id`, `external_id`, `user_name`, `email`, `display_name`, `given_name`, `family_name`, `active`, `user_id` null, `created_at`, `updated_at` | Unique (`org_id`, lower(`user_name`)), (`org_id`, lower(`email`)), (`org_id`, `user_id`) |
| `scim_group_member` | `group_id`, `scim_user_id` | Both cascade |
| `org_group` | gains `scim_id` null, `external_id` null | Unique (`org_id`, `scim_id`) |

`last_used_at` is written at most once a minute, so a busy sync does not write it on every request.

## Audit actions
`scim.enabled`, `scim.token_replaced`, `scim.disabled` (the owner); `scim.user_pushed`, `scim.user_changed`,
`scim.user_deleted`, `scim.group_pushed`, `scim.group_changed`, `scim.group_deleted` (no actor, `via: 'scim'`, the
SCIM id as the target); `member.provisioned` (a link that made a membership) and `member.deprovisioned` (a removal by
SCIM). Details name what changed (`active`, `members` added and removed by count), never names or emails.

## Code
- `src/orgs/Scim.ts`: `OrgScim` (`enable`, `replaceToken`, `disable`, `orgOfToken`), and the user and group
  operations over the tables in one transaction each.
- `src/scim/` for the protocol: `schemas.ts` (the resource shapes and the three discovery documents), `filter.ts` (the
  filters above, parsed, never evaluated as SQL text), `patch.ts` (PATCH operations applied to a resource, Entra's
  forms included).
- `src/server/scimRoutes.ts`: `scimRoutes(context)` in the route chain, with its own bearer check and error bodies.
- `SignInRules.signedIn` links held people and gives way to SCIM for `autoJoin`; `Orgs.remove` and
  `Orgs.setGroupMember` refuse what SCIM holds unless SCIM calls them.

## Checks
- `scim.test.ts` against a test database, with request bodies shaped as Okta and Entra send them:
  - discovery documents; a wrong, old or other org's token is 401;
  - a pushed user is held; their sign-in through the org's provider makes them a member with their pushed groups;
  - a user already a member is linked at once;
  - an email outside the verified domains, and a second user with the same email, are refused;
  - `active: false` (PATCH, Entra's string form, and PUT) and `DELETE` remove the member and close their views; turning
    them on again rejoins them; the last owner is refused;
  - groups: push, rename, members added and removed by PATCH (both path forms), a clash with a hand-made group, delete;
    access given to a pushed group follows its members;
  - while SCIM is on, `autoJoin` joins nobody unpushed, and an invite still works;
  - an admin cannot remove a SCIM member or edit a pushed group;
  - turning SCIM off keeps members and makes pushed groups ordinary;
  - the audit log holds the actions and no name or email.
- `filter.test.ts`, `patch.test.ts`: the supported forms, and refusals of the rest.
- e2e (`e2e/orgs.spec.ts`): the owner turns SCIM on, sees the token once, and makes a new one.
- By hand, the owner's: an Okta and an Entra ID test tenant pointed at a hosted Magnetic.

## Not in this design
- Roles from the provider (by group or attribute).
- Pushing more than people and groups (manager, department, enterprise extension attributes).
- Bulk requests, sorting, ETags.
- SCIM for orgs whose people sign in without a verified domain.
