# Magnetic: its own pages editable in Magnetic

Status: built 2026-11-18 (owner: "Yes, build it", to each proposed answer).

Asked for on 2026-11-18: "We need to make magnetic fully editable, that means the login and other pages along with the
editor".

## Summary
Magnetic's own pages are StateUI apps, and each can be edited in Magnetic. An admin edits Magnetic's version of each
page (what every visitor and every new person gets) in the editor, with the agent or by hand, and publishes it. Each
person may change their own Your apps and editor. Code keeps the first version of each page, the canvas around the
editor, and the rules a page cannot break.

## The pages
| Page | App | Who edits it |
|---|---|---|
| Sign-in | `magnetic-signin` | Admins, published for every visitor |
| Share links that do not open an app | `magnetic-link` | Admins, published for every visitor |
| Your apps | `your-apps` | Admins publish Magnetic's; each person may change their own |
| The editor | `magnetic-editor` | Admins publish Magnetic's; each person may change their own |

Settings, Shared by me, privacy and the admin pages are server HTML and stay code. The canvas around the editor
(`shell.ts`, `screens.ts`, `inspect.ts`) stays code.

## The design

### Three versions of each page
- **Magnetic's code version** of each of the four pages (sign-in, link, Your apps, editor) is an app in the system
  workspace, made from its `PageSpec` with the agent's tools (`PageApps`), and made again when the spec's hash changes.
- **An admin's draft** is an app of the same name in the pages workspace, so a draft never shares models or themes with
  the code version or with a person's apps. With `--internal-org` the pages workspace is the company org's workspace
  (Magnetic's pages are in the company org, owner, 2026-11-23); without one it is a workspace of its own
  (`PAGES_WORKSPACE_ID`).
- **The published version** is what Publish stored in `magnetic_page`: the assembled document and icons the sign-in and
  link pages serve, and the app with every part it reaches, from which a person's copy is made.
- **A person's copy** of Your apps and of the editor is an app in their own workspace, made from the published version
  (or the code's, while none is published), which they may change and reset.
- Sign-in and link pages have no person's copy: a visitor has no workspace yet.

### Who edits what
- The admins (`MAGNETIC_ADMIN_EMAILS`, with a verified email) edit the drafts (owner, 2026-11-18).
  `reach(userId, appId)` in `startMagnetic.ts`, the one gate of the editor's routes, finds an admin's drafts in the
  pages workspace with `manage`. In the company org its owners and admins also manage them, as they do every app of
  the org. Nobody else reaches them: anyone else gets what any app they cannot reach gives.
- The agent works on a draft as on any app; its turns are charged to the admin's budget.
- Each person edits their own Your apps and editor (owner, 2026-11-18): "Your pages" on Your apps has Edit and Reset
  for both. The agent may work on a person's Your apps as on their editor.

### Draft and publish
Draft and Publish, not live edits (owner, 2026-11-18).
- **Pages** (`/admin/pages`) lists the four, each with: what is served (Magnetic's own, or published by whom and when),
  "The draft has changes not published", "Magnetic shipped a newer version since this one's draft was made", and the
  buttons Edit, Publish (once a draft exists) and Reset to Magnetic's.
- **Edit** makes the draft the first time, from the code, with the spec's sample data written into its state (an error,
  the beta notice, a provider, a test user), so what a page shows only sometimes is there to edit. It opens
  `/edit/<draft id>`: the editor's canvas is the preview.
- **Publish** checks the draft with `ui_validate` and the contract, and refuses it with the reasons. Then it drops the
  translations of texts whose English changed, writes Magnetic's own translations again, and stores the draft in
  `magnetic_page` (`magnetic/migrations/0001_baseline.sql`: `name`, `stamp`, `base`, `document json`, `icons json`,
  `parts json`, `english json`, `published_by`, `published_at`; `json`, not `jsonb`, as key order matters). The stamp is
  new on each publish, so every person's untouched copy is made again from it.
- **Reset** deletes the published row, so Magnetic's own is served at once, and makes the draft again from the code.

### The page contract: data in, node ids out
Every page is driven only through its data and the ids of its nodes, never through the paths of its nodes. A node the
page script acts on carries an `@id`; the runtime reports each of its events (`stateui:raised`, `{ id, event, value?,
row? }`), and the page's table (`src/http/raised.ts`, such as `SIGN_IN_HEARING`) reads `<id>.<event>` as the name the
script acts on and its payload: the event's value, the node's row, or a value the script keeps as fields change. So any node can be
moved, restyled, added or removed, and the page keeps working.
- **Sign-in:** `$.data.signin` holds `providers` and `devUsers` as records (`{ id, label }`) shown by a `list` of
  buttons (ids `provider` and `devUser`) heard as `provider` / `dev` with the row's id, and flags (`noProviders`, `noDevUsers`, `noSso`, `noNone`,
  `noError`, `noNotice`) that hide what the server lacks. The work email binds to `$.data.signin.workEmail`. What the
  server signs in with is data, so an edited page follows a change of providers.
- **Your apps:** `$.data.home` holds `noInvites`, `notAdmin`, `noMakeOrg`, `mode`, `language` and `make`; the nodes bind
  to them. The page writes only `$.data`.
- **Link:** `$.data.link` holds the title, the message and `noRemix`.
- **The server acts only on the names its tables hear** (`appPage`'s `actions`, the editor's and Your apps' handlers): an
  edited page can do nothing the code page could not.
- **Publish checks the contract** (`contractGaps`): each id in the spec's `required` must still be some node's `@id`, and
  each key in its `keys` must still be some node's key. Sign-in: `provider`, `devUser`, `workEmail`, `sso`. Link:
  `home`, `remix`. Your apps: `appCard`, `create`, `signout`, `editHome`, `resetHome`, `shareAccept`, `shareReject`.
  The editor: `request`, `home`, and the keys `stage` and `propertyFields`. A copy that lost one is refused with
  `No part has the id "<id>"`.

### Languages
- Every page is made in English with the other languages as locales (`writeLocales`). Your apps changed to this: one
  copy serves every language, and a language change no longer remakes it.
- Text an admin changes has no translation. Publish compares the English of each text with the last publish's
  (`englishOf`, kept in `english`), drops the translations of each that changed, so other languages show the new
  English, and writes Magnetic's own translations for texts it still has. The admin, or the agent, writes others with
  `ui_locale_write`.
- Removing or moving a translated node works: stateui-mcp's `ui_nodes_write` carries a screen's overlays along
  (`carryOverlays`). Before, the overlay kept naming the removed node and the write was refused.

### When Magnetic ships a new version
Keep an edited version and flag it (owner, 2026-11-18).
- The code version is made again in the system workspace.
- A draft nobody changed since it was made is made again from the new code the next time it is opened. A changed draft
  is kept. Pages says when the published version's draft was made from older code; Reset takes the new one.
- A person's copy nobody changed (its revision is the one it was made at) is made again from the published version, or
  the code's; a changed copy is kept.
- The models are always brought up to date (`ensureModels`), so new data fields exist in an old design. A new id
  that an edited page lacks is unreachable until the page is changed, and nothing breaks.

### The editor editing itself
- A person editing their own editor sees the chrome follow: the shell mounts the editor again when it changes
  (`editorChanged` in `shell.ts`).
- An admin editing Magnetic's editor edits the draft, a different app from the editor they use, so a broken draft never
  breaks the session editing it.
- The editor falls back in steps when one does not become ready in `READY_MS`: the person's own, then the published
  one (`/assets/editor.json?editor=default`), then the code's (`?editor=code`).

### Fallbacks
- A published sign-in or link page that is not ready in 10 seconds reloads with `?page=default`, which always serves
  Magnetic's code version. A bad publish cannot lock anyone out, admins included.
- Your apps that is not ready in 10 seconds shows a notice with Reset.

## Decisions
- Admins edit Magnetic's version; people edit their own copies of Your apps and the editor (owner, 2026-11-18).
- Draft and Publish for Magnetic's version, not live edits (owner, 2026-11-18).
- An edited version is kept when Magnetic ships a new one, and flagged (owner, 2026-11-18).
- The server-HTML pages (org settings, connections, data, billing, Shared by me, privacy, admin) stay code
  (owner, 2026-11-18): they are forms with CSRF tokens and secrets that are never read back.
- Drafts live in a workspace of their own, and a publish stores the app's parts, so a draft, the code version and a
  person's copy never share a model or theme that one of them changes.
- No new route for a page's actions: the existing `actions` of `appPage` and the page scripts' handlers stay the only things a
  page can trigger.
- Your apps moved to English with locales, as the editor and sign-in are.

## Rules and Constraints
- **The canvas stays code:** `shell.ts`, `screens.ts`, `inspect.ts`, the frame clipping and the pointer handling. A
  page edits what is inside its frame only.
- **A page can trigger only the names the server's tables hear,** to fixed actions. No page carries a URL the server follows, a
  script, an `on*` attribute or `innerHTML` (the library's rules already refuse them).
- **The vocabularies stay closed:** components, layouts, commands and tokens are the catalog's. Editing a page cannot
  add a component.
- **Only admins reach the drafts,** through `reach`, with a verified email.
- **Pages read their data from `$.data` only;** the server never writes node paths, so an edit cannot break a feature.
- **Sign-in can always be reached** through the timeout fallback and `?page=default`.
- **No secret, email or person's data** goes into a page's document; data is written per visit.
- **Store documents as `json`,** never `jsonb`.
- **Hash-driven remaking never discards a changed copy,** at any level.

## Checks
- An admin edits sign-in in the editor, publishes, and a signed-out visitor sees it; a non-admin cannot open the draft.
- Adding a provider to the server shows its button on an edited sign-in page.
- A draft without a required node id is refused at Publish with the reason.
- A published sign-in that never becomes ready falls back to the code's page; `?page=default` serves it.
- Magnetic shipping a new sign-in leaves an edited draft and its published page as they are, and Pages says so; Reset
  brings the new one.
- A person changes their Your apps; switching language keeps the change and translates Magnetic's texts.
- An admin's published Your apps reaches a person whose copy is untouched, and not one whose copy is changed.

## As built
Built 2026-11-18.
- `magnetic/src/pages/PageSpec.ts`: `PageSpec`, `pageStamp`, `makePage`, `ensureModels`, `contractGaps`.
- `magnetic/src/pages/PageApps.ts`: the sign-in (`SIGN_IN`) and link (`LINK`) specs, and `PageApps`, the code versions
  in the system workspace.
- `magnetic/src/pages/SitePages.ts`: drafts, publish, reset, status, the served document; `englishOf`.
- `magnetic/src/pages/PersonPages.ts`: a person's copy, kept when changed, made again when untouched, and reset;
  `HomeApps` (`src/home/HomeApp.ts`, spec `HOME`) and `EditorApps` (`src/editor/EditorApp.ts`, spec `EDITOR`) extend it.
- `magnetic/migrations/0001_baseline.sql`: `magnetic_page`. `PAGES_WORKSPACE_ID` in `src/inspector/constants.ts`.
- `magnetic/src/server/adminRoutes.ts` and `src/http/adminPage.ts`: `/admin/pages` and its Edit, Publish and Reset.
- `magnetic/src/server/startMagnetic.ts`: the sign-in and link pages served from `SitePages` with `?page=default`;
  `reach` for admins' drafts; `POST /home` and `/home/reset`; `/assets/editor.json?editor=default|code`; Your apps
  opens in the editor. `src/http/appPage.ts` (the fallback), `src/http/home.ts` ("Your pages", the not-ready notice),
  `src/http/shell.ts` (the editor's fallback steps), `src/http/text.ts`.
- stateui-mcp `src/domain/overlayCarry.ts` and `WriteNodes`: overlays follow a node write.
- Tests: Magnetic `src/server/sitePages.test.ts` (the contract check; Pages for an admin only; a draft open to an admin
  only; publish, the dropped translations and `?page=default`; a refusal naming the missing id; Reset; a person's
  changed Your apps kept and reset; an untouched one made again from a publish), `agentRoutes.test.ts`, `beta.test.ts`,
  `providerSignIn.test.ts`; `e2e/pages.spec.ts` (the admin's flow at desktop size; a person editing Your apps, in
  German, and resetting it, at both sizes); stateui-mcp `test/nodeTools.test.ts`.
- Not covered by a test: the 10-second fallbacks of sign-in, Your apps and the editor, and Magnetic shipping a new
  version under an edited draft.
