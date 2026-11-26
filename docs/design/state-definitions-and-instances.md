# Apps are composite components: one definition, an instance per person

Status: designed 2026-11-25; nothing built. It changes the statenet's direction (statenet-direction.md, "Owners and
paths") and the owner's own state in person-state.md.

Asked for on 2026-11-25, looking at the editor's statenet:

> I'm looking at the editor's statenet, it's really flat. The editor model has a ton of properties. Models is really
> a data thing also. For an application's state, we want the statenet to branch often, at the component level. Let's
> figure out how to separate models and component props (aka app state). We can still use models in the app state,
> for things like showing data. But for things like if a modal is open or not, that's app state data.

Then, resetting how state, StateUI and the statenet fit together:

> When a node loads an app, it loads the state version of the app's owner, then layers its own state on top. This is
> similar to how JavaScript prototypes shadow the object.

> Components each have their own state. Components are attached to the state based on a path provided to the
> component at render time.

> The one gap, if a user has their personal apps, and the app's state owner is both the app state owner and the app
> user owner.

The asks that settled the design are quoted where they apply below.

## Why
Magnetic's editor keeps everything it shows in one record, `$.data.editor` of the `magnetic-editor` model, about 120
fields: real data (app and workspace names, the budget, models), component state (about 40 `…Hidden` flags, `tab`,
`tool`, `view`, `size`, `frame`) and values derived from other values (`toolLook`, `toolTone`, `budgetTone`, the
`no…` flags). Its statenet is one wide branch. The starter apps do the same in a smaller way (Northwind's `view`,
`ui`, `selectedOrder`, `wizard`; magnetic-starter-apps.md). And the owner's own state of an app is the app's
definition itself (person-state.md), so using your own app changes it, which is why Magnetic needed test runs.

## The design

### An owner's tree
`$` is an owner (statenet-direction.md). Under it:

| Branch | What it holds |
|---|---|
| `$.components` | definitions: bedrock and composite components, and apps, which are composite components |
| `$.apps` | instances: one per app the owner uses, its own apps included |
| `$.data` | data, shaped by models; never shadowed |
| `$.theme`, `$.logic` | themes and shared logic |
| `$.mounts` | what the owner's state is laid over: definitions, shared data, shared branches |

### An app is a composite component
> If you think about it, an app is like a composite component, it has a state that includes the state of it's
> children and those children hold the state of their children, and so on.

- A component's state is one branch, holding its content, style, logic and values together. Its children's state
  is in branches under it, named by the component (a form's `fields`, a header's `toolbar`), not under a generic
  `children` map. A node that only wraps others for layout goes away: layout is a prop of the component that owns
  the region.
- A component's definition gives its structure and defaults. An app's definition is the same: its screens, their
  components, defaults, logic and the data it uses, at `<owner>.components.<app>`.

### Every user of an app, its owner included, has an instance
> 4242 accepts and 4242.apps.<appid> is created from the definition and the user can articulate the application on
> their device without modifying the original. Every user gets their copy.

```
7001.components.orders        the definition: what the editor changes
7001.apps.orders              7001's own instance
4242.apps.orders              4242's instance, made when 4242 accepted the share
```

- The owner follows the same rule as everyone else. Editing changes `7001.components.orders`; using the app changes
  `7001.apps.orders`, which nobody else loads. This closes the gap the owner named without a layer of its own: a
  definition is to an app instance what `$.components.field` is to a placed field.
- An instance names its definition in `@from`, followed (the newest version) or pinned (`@v4`).
- App ids stay unique (person-state.md), so an instance is at `<person>.apps.<app>` with no segment for the app's
  owner.

### An instance is a diff, with history
> Let's use diffs, that way we can undo or replay changes and have history.

- An instance stores only the changes its person made over `@from`, as a log of changes, not a copy. Undo drops or
  inverts a change, replay applies the log again, and the log is the instance's history.
- When the definition changes, every instance picks up the change except at the paths its person changed. A change
  in the log to a path the definition no longer has is kept in the log and not applied.
- How much history is kept follows the owner's versioning scheme per path pattern (statenet-direction.md, "Versions
  and history"); app state such as a scroll position keeps none. The aggregate compacts what falls out of the kept
  history into the base diff.
- Any value may be changed, labels included:

```
with 4242.apps.orders.screens.login
.form.fields.username.label._text = "Work email"
```

### `$` on the device is composed, not stored
> We don't need to literally shadow the values when we stack them. We just need the state on the device to be the
> representation like that.

The device builds `$` from `$.mounts`: each instance laid over its definition, `$.data` from the data's owners with
the person's extension records, and branches others share with the person. Layers stay apart in storage. A write goes
to the person's own instance, or through to the owner of a mounted branch (data, a shared branch), never into a
definition the person is using.

### Data is never shadowed, but a model can be extended
> Agreed, data is different. There is no shadow, although there are extensions (if I extend a model and add a couple
> of fields of my own we need a record that extends the original record)

```
with 4242.models.myOrder
.@extends = 9100.models.order
.fields.priority = enum(low, high)

with 4242.data.ordersMine.records.o1042     # the same key; only 4242's fields
.priority = "high"
```

A write to the original's fields goes through to its owner, if 4242 may write there (statenet-permissions.md). A write
to an added field goes to the extension record. The extension never repeats or overrides the original's fields.

### State changes are the events
> No events, remember that since we have server side logic we can't tie things to browser events. The state and
> statenet provide the events through state changes.

- A component writes its own state, and logic on the device or the server reacts to the change. A press is a count
  or a time (`.signIn.pressed = 4`), so pressing twice is two changes.
- Every change goes to the node's server half by default. The server listens to the paths its logic declares, and an
  external listener is a relay on a path.
- Emits go, and with them Magnetic's page contract of data in and emits out (magnetic-editable.md). The server reads
  a page's state at its paths.

### Metadata on a branch
> I'm wondering if we can get similar results by added metadata properties to state branches?

The default is that a change syncs, is stored and is laid over. Metadata marks a branch that behaves otherwise, the
way `_` marks translatable text. A key `@<flag>` on a branch is `true` (the branch and everything under it) or a list
of the children it marks:

| Key | Effect |
|---|---|
| `@local` | Stays on the device, in localStorage. Never sent. |
| `@secret` | Sent to the node's server half; only logic that declares the path reads it. Never stored, logged or relayed. |
| `@transient` | Synced and seen by listeners, never stored: the direction's no-history path class. |
| `@share` | Who besides the person may read the branch of each instance; `peers` is everyone using the same app. |

Metadata is read from definitions only (a component's defaults, an app's definition). An instance cannot set or clear
it, so a person cannot unmark a secret. On the edge, metadata becomes entries in the owner's path-pattern tables
(statenet-permissions.md, versioning), which are what the engine checks.

```
with $.components.secretField
.@extends = field
.@secret  = ["value"]

with $.components.button
.pressed    = 0
.busy       = false
.@transient = ["busy"]
```

The password is the case `@secret` covers:

> The password example brings to mind the fact that the password needs to make it's way to the server.

```
with 7001.logic.auth.signIn
.listens = $.apps.orders.screens.login.form.actions.signIn.pressed
.reads   = .form.fields.username.value, .form.fields.password.value     # declared, so readable here
.sets    = .form.actions.signIn.busy = true
           ok   → .form.fields.password.value = "", .screen = "orders"
           fail → .form.fields.password.error = "auth.failed"
```

### Seeing other people's app state
> For example if we have a shared drawing board, we'll want to share cursor position state from each user to each
> user. Each user would share their mouse coordinates over the diagram.

Each cursor stays in its person's instance. The definition shares the branch with the app's other users, and a link
rooted at `$peers` reads the same branch in every instance it may read, keyed by owner:

```
with 7001.components.board.screens.diagram
.mousePosition = { x: 0, y: 0 }
.@transient    = ["mousePosition"]
.@share        = { mousePosition: peers }
"<-cursors"    = "$peers.mousePosition"

$.apps.board.screens.diagram.cursors = { o4242: { x: 412, y: 188 }, o5150: { x: 90, y: 301 } }
```

The strokes on the board are not app state: they are data in `$.data`, written through to their owner. To share a
whole branch of app state with one person (looking at the same screen together), the owner grants it and the other
person mounts it; their writes to it go through, as writes to shared data do:

```
with 4242.mounts
.apps.orders.screens.orders = 5150.apps.orders.screens.orders     # granted by 5150, read and write
```

### Offline
localStorage holds the device's copy of the composed `$`, the `@local` branches and the changes not yet sent. On
reconnect the device sends them in order. Changes to the person's own instance cannot conflict with anyone's. Writes
through to shared data or a shared branch can be refused, and the app shows them as refused.

### The editor's record, under this design
```
with magnetic.components.editor.screens.edit
.chat.hidden   = true
"<-chat.messages" = "$.data.chat.messages"
.toolbar.tool  = "pick"
"<-toolbar.tools.use.look" = "..tool == 'use' ? 'solid' : 'ghost'"

with 4242.apps.editor.screens.edit
.chat.hidden  = false
.toolbar.tool = "use"
```

The `…Hidden` flags become the state of the panels they hide, derived looks become links, and what is left in
`$.data` is data: chat messages, the budget, the models, the feed.

## Stages
1. **state**: metadata keys read from definitions; the composed view of an instance over its definition, generalizing
   `layInstance`; the `$peers` link root.
2. **stateui-app**: definitions at `$.components.<app>`; a node's children in the branches its component names, with
   layout as a prop; emits removed, presses as state; the validator warns when a model field is bound only to a
   component's own props (`hidden`, `open`, a look).
3. **state-sync and statenet**: an instance's change log kept per the owner's history scheme, with undo and replay;
   `@transient` never persisted, `@secret` to the server half only, `@local` never sent; offline changes queued in
   localStorage.
4. **Permissions**: accepting a share makes the instance and its entries; `@share` entries made from the definition.
5. **stateui-mcp and stateui-pg**: tools write definitions at `components` and instances at `apps`; stored instances
   keep their log.
6. **Magnetic**: the editor edits the definition and its preview runs the owner's instance; the page contract reads
   state at paths; the editor's own record splits as above; the Statenet view draws an instance's tree, branching at
   components. Whether test runs remain, now that the owner has an instance of their own, is decided here.

## Rules and Constraints
- An app's definition is at `<owner>.components.<app>`; every user's state of it, the owner's included, is an
  instance at `<person>.apps.<app>`. Nothing that runs the app writes the definition.
- An instance stores changes over its definition, never a copy.
- Data is never shadowed: a write to another owner's data goes through to that owner; added fields go to an
  extension record.
- No events: components write their own state, and logic reacts to state changes.
- Metadata (`@local`, `@secret`, `@transient`, `@share`) is read from definitions only.
- A `@secret` value is never stored, logged or relayed; a `@local` value never leaves the device.

## Decisions
- An app is a composite component; a consumer's instance starts from the owner's definition and every user gets
  their own (owner, 2026-11-25).
- Definitions are at `$.components`, so the owner's own use of an app is an instance like anyone's. Proposed in
  design discussion to close the gap the owner named; the owner accepted the design on 2026-11-25.
- Instances are diffs with history, for undo, replay and history (owner, 2026-11-25).
- Data is never shadowed; models are extended with extension records (owner, 2026-11-25).
- Anyone may override any value of their instance, labels included (owner, 2026-11-25).
- A component's state stays one branch: content, logic, definition and style together (owner, 2026-11-25).
- No events; state changes are the events, and the server listens to paths (owner, 2026-11-25).
- Behaviour that differs from the default is metadata on branches, not separate structure (owner, 2026-11-25).
- Device-only and offline state exist: localStorage holds them and the changes not yet sent (owner, 2026-11-25).
- Reading peers' state is a link root, `$peers`, not an expression function: it needs the engine's permission check
  and a listener at the edge, which expressions do not do. The owner left the choice to design (2026-11-25).

## Open questions
- The form of metadata on a leaf: a list on the parent (as above) or a mark on the key's name, as `_` is.
- Whether an org may lay team defaults between an app's definition and its members' instances.
- How much history an instance keeps by default, and when the aggregate compacts it.
- Whether `@transient` values reach the people a branch is shared with live.
