# A person's state lives under their own owner

Status: designed 2026-11-23, not built. It changes the statenet's direction (statenet-direction.md, "Owners and
paths"), the tower's area: the tower builds stages 1 to 3, and this machine builds stage 4 in Magnetic.

Asked for on 2026-11-23:

> If we think about it, a user has their own <ownerid> and that's where we could say is their "personal" org. That is
> where their state lives, and their changes to state at some level (data state might not be their data so changes
> might live on another <ownerid>)

Then, answering where a person's state for an app lives:

> yes that's the pattern, we use the same path but with the user's owner id. This replaces the personas as it
> currently exists (we could repurpose for themes and settings)

## What is there now
- An instance is what one person did in an app, laid over its definition. Its key is `{persona}.{ownerId}.{appId}`
  (stateui-mcp `src/domain/InstanceKey.ts`), and its state is the namespace `instance:<key>`.
- The persona is a name: `default` for the person's own apps, and the person's user id for an org's apps
  (Magnetic `startMagnetic.ts`, `appShellPage`), so two people in one org have two instances.
- statenet-direction.md gives every user path a persona segment (`[user].[persona].apps.[business].[app]`).

## The design
- **A person's state for an app is at the app's own path, under the person's owner id.** The app `<app>` of owner
  `<owner>` keeps its definition at `<owner>/apps/<app>`; a person `<person>` keeps their state for it at
  `<person>/apps/<owner>/<app>`, the same shape with their owner id as the root. Their own app is `<person>/apps/<person>/<app>`.
- **The state there is the delta over the definition**: reads lay it over the definition, writes go to it, reset
  deletes its entry, as the direction already says of the persona's copy.
- **Data stays where it lives.** A change to data the person does not own goes to the data's owner
  (`<owner>/data/<dataset>`), under the rights they hold there (statenet-permissions.md, statenet-requests.md); only
  what is theirs is under their owner id.
- **Personas as they are go.** There is no persona segment and no `default`; the key of an instance is the person and
  the app. One person has an app once.
- **Personas may come back for themes and settings**: a named set of a person's preferences (a theme, a language, a
  layout) that they switch between. That is a later design, not part of the path.

## Stages
1. statenet-direction.md: the path shape and the rule on persona segments follow the owner's decision. Done with this
   doc.
2. stateui-mcp and stateui-pg (the tower): the instance key becomes the person's owner and the app; the namespace is
   the person's path. The persona goes from `InstanceKey`, `InstanceViews.namespace`, the bindings and the storage.
   Databases are reset, not migrated (no users).
3. stateui-app: the blueprint's and snapshot's `persona` fields (`core/blueprint`, `core/snapshot/instance.ts`,
   `core/assemble`) go; bindings name the person's owner.
4. Magnetic: `appShellPage` and the org routes stop passing a persona; the org's support view reads a member's state at
   their path; the share and grant code that names personas follows.

## Open questions
- How someone opens the same app twice (two projects in one notes app), now that personas are not the way. The owner's
  answer to "one person has an app once" decides whether that is needed.
- Whether a person's settings (theme, language) are themselves state at `<person>/settings`, and personas a name over
  sets of them.

## Decisions
- The person's state uses the app's path under their own owner id, and replaces personas as they are (owner,
  2026-11-23).
- Personas may be repurposed for themes and settings (owner, 2026-11-23).

## Rules and Constraints
- A person's state for an app is at `<person>/apps/<owner>/<app>`, the delta over the app's definition.
- Data a person does not own is changed at its owner's path, never copied under the person.
- No persona segment in state paths.
