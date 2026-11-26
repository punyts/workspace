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
definition itself (person-state.md), so using your own app changes it.

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

- A component's state is one branch, holding its content, style, logic and values together. A component with a
  fixed shape declares its child branches in its definition (a form's `fields`, a header's `toolbar`), and a prop
  may not share a name with a declared branch. A container that holds whatever it is given (a panel, a grid) keeps
  its children in an ordered `children` map, as nodes do now. A node that only wraps others for layout goes away
  where a component owns the region: layout is a prop of that component.
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
- An instance names its definition in `@from`, followed (the newest published version) or pinned (`@v4`). Only the
  owner's preview in the editor runs over the working definition; nobody else sees an edit before it is published.
- **An instance changes values, never structure.** Its changes may set any value under a branch the definition has,
  but never which component sits on a branch, and never add or remove a declared branch. Metadata is looked up by
  the definition's structure, so no change of a person's can take a `@secret` off a value. Items a person adds to a
  container's `children` or to a map the definition declares as open (a list's rows) are the exception, and take
  the metadata of the component the definition allows there.
- App ids stay unique (person-state.md), so an instance is at `<person>.apps.<app>` with no segment for the app's
  owner.

### An instance is a diff, with history
> Let's use diffs, that way we can undo or replay changes and have history.

- An instance stores only the changes its person made over `@from`, as a log of changes, not a copy. Undo drops or
  inverts a change, replay applies the log again, and the log is the instance's history.
- When the definition changes, every instance picks up the change except at the paths its person changed. A change
  in the log to a path the definition no longer has is kept in the log and not applied.
- **Applying the log is not acting.** Logic reacts to live changes only: a person's, or another rule's. Changes
  applied by loading an instance, replaying its log or undoing do not fire logic, so a replay never signs anyone in
  or sends anything again. An effect runs once for the change that started it.
- `@secret` and `@transient` values never enter the log.
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
Deleting the original record deletes its extension records, so a key used again later starts with none.

### State changes are the events
> No events, remember that since we have server side logic we can't tie things to browser events. The state and
> statenet provide the events through state changes.

- A component writes its own state, and logic on the device or the server reacts to the change. A press records
  when and on which device (`.signIn.pressed = { at, device }`), so pressing twice is two changes even when two of a
  person's devices press at once. A press is `@transient`: it reaches the logic that listens and is never stored.
- Every change goes to the node's server half by default. The server listens to the paths its logic declares, and an
  external listener is a relay on a path.
- **Logic addresses components by id, not by path.** A branch in a definition may carry an id unique in its app
  (`@id = "signIn"`), and logic, relays, links and expressions name it as `#signIn` (`#signIn.pressed`,
  `"<-busy": "#signIn.busy"`, `{{ #signIn.busy ? 'Signing in…' : 'Sign in' }}`); the engine resolves the id to the
  branch's current path. A component can then be moved or renamed without breaking the logic, which is what
  Magnetic's page contract of data in and emits out protected (magnetic-editable.md). Publishing checks that every
  id the logic, relays and links name exists, on a component that has the prop they read.
- `#` means what an HTML id and the CSS `#id` selector mean: one name in the document, found wherever it is now.
  Every state path starts with `$`, so `#signIn` never reads as a place in state. `@punyts/expression` gains `#name`
  as a path root. The metadata is `@id`, not `@key`, because StateUI's `key` already names a repeated item.
- **Ids in a repeat.** A component in a repeated template has a copy per row. Inside the template, `#delete` is the
  copy in the same row. Outside it there is no `#delete`: logic reads the list through the list's own id
  (`#orders.selected`). Publishing refuses an id used twice in one scope.
- Emits go, and with them that page contract: the server reads a page's state through ids.

### Metadata on a branch
> I'm wondering if we can get similar results by added metadata properties to state branches?

The default is that a change syncs, is stored and is laid over. Metadata marks a branch that behaves otherwise, the
way `_` marks translatable text. A key `@<flag>` on a branch is `true` (the branch and everything under it) or a list
of the children it marks:

| Key | Effect |
|---|---|
| `@local` | Stays on the device, in its store. Never sent. |
| `@secret` | Sent to the node's server half, and only while the device is online; only logic that declares the path reads it. Never stored, logged or relayed, and never in the device's store, its queue of unsent changes or an instance's log. |
| `@transient` | Synced and seen by listeners, never stored: the direction's no-history path class. |
| `@share` | Who besides the person may read the branch of each instance: `peers of <path>`, the people whose instances are on the same data (see below). |
| `@id` | The name logic, relays, links and expressions use for the branch (see "State changes are the events"). |

Metadata is read from definitions only (a component's defaults, an app's definition). An instance cannot set or clear
it, so a person cannot unmark a secret. On the edge, metadata becomes entries in the owner's path-pattern tables
(statenet-permissions.md, versioning), which are what the engine checks.

```
with $.components.secretField
.@extends = field
.@secret  = ["value"]

with $.components.button
.pressed    = null              # { at, device } on each press
.busy       = false
.@transient = ["pressed", "busy"]
```

The password is the case `@secret` covers:

> The password example brings to mind the fact that the password needs to make it's way to the server.

```
with 7001.components.orders.screens.login.form
.fields.username.@id    = "username"
.fields.password.@id    = "password"
.actions.signIn.@id     = "signIn"

with 7001.logic.auth.signIn
.listens = #signIn.pressed
.reads   = #username.value, #password.value      # declared, so the secret is readable here
.sets    = #signIn.busy = true
           ok   → #password.value = "", .screen = "orders"
           fail → #password.error = "auth.failed"
```

### Seeing other people's app state
> For example if we have a shared drawing board, we'll want to share cursor position state from each user to each
> user. Each user would share their mouse coordinates over the diagram.

Each cursor stays in its person's instance. People work together around data, not around an app: the people looking
at one board are peers, not everyone who uses the board app. So the definition shares the branch with the peers of a
path, the people whose instances have the same value there (the board open), and a link rooted at `$peers` reads the
same branch in every instance it may read, keyed by owner:

```
with 7001.components.board.screens.diagram
.board         = null                                   # the key of the board open
.mousePosition = { x: 0, y: 0 }
.@transient    = ["mousePosition"]
.@share        = { mousePosition: "peers of .board" }
"<-cursors"    = "$peers.mousePosition"

$.apps.board.screens.diagram.cursors = { o4242: { x: 412, y: 188 }, o5150: { x: 90, y: 301 } }
```

A person may narrow what they share (hide their cursor) by a value in their instance; no instance can widen it. Only
people who may read the board itself are peers of it.

The strokes on the board are not app state: they are data in `$.data`, written through to their owner. To share a
whole branch of app state with one person (looking at the same screen together), the owner grants it and the other
person mounts it; their writes to it go through, as writes to shared data do:

```
with 4242.mounts
.apps.orders.screens.orders = 5150.apps.orders.screens.orders     # granted by 5150, read and write
```

Mounts are layered in their order in `$.mounts`, the person's own instance among them: a layer mounted later
overrides an earlier one at the paths both set. A shared branch mounted first can be overridden by the mounts after
it. The layers stay apart, so what a person's own instance holds under a branch mounted over it is still there when
the mount ends. A write to a path goes to the layer that wins there: through to the shared branch's owner when that
mount wins, to the person's instance when theirs does.

### Offline
The device's store holds its copy of the composed `$`, the `@local` branches and the changes not yet sent, never a
`@secret` value. The store is IndexedDB: a composed copy with datasets outgrows localStorage's few megabytes, which
can still hold small settings. On reconnect the device sends the queued changes in order. Changes to the person's own instance cannot conflict with anyone's. Writes
through to shared data or a shared branch can be refused, and the app shows them as refused.

### The editor's record, under this design
```
with magnetic.components.editor.screens.edit
.chat.hidden            = true
.chat."<-messages"      = "$.data.chat.messages"
.toolbar.tool           = "pick"
.toolbar.tools.use.look = "{{ toolbar.tool == 'use' ? 'solid' : 'ghost' }}"

with 4242.apps.editor.screens.edit
.chat.hidden  = false
.toolbar.tool = "use"
```

The `…Hidden` flags become the state of the panels they hide, derived looks become expressions, and what is left in
`$.data` is data: chat messages, the budget, the models, the feed.

## Stages
1. **state**: metadata keys read from the definition's structure; the composed view of an instance over its
   definition, generalizing `layInstance`, refusing changes to structure; ids resolved to paths; the `$peers` link
   root.
2. **stateui-app**: definitions at `$.components.<app>`; declared child branches for fixed-shape components,
   `children` for containers, layout as a prop; emits removed, presses as transient state; logic that fires on live
   changes only and names components by id (`#name`, a new path root in `@punyts/expression`); publishing checks ids; the validator warns when a model field is bound
   only to a component's own props (`hidden`, `open`, a look).
3. **state-sync and statenet**: an instance's change log kept per the owner's history scheme, with undo and replay
   that fire no logic; `@transient` never persisted, `@secret` to the server half only while online and never in a
   store, queue or log, `@local` never sent; the device's store and its offline queue in IndexedDB.
4. **Permissions**: accepting a share makes the instance and its entries; `@share` entries for the peers of a path,
   made from the definition. statenet-permissions.md (the `use`, `view`, `remix`, `edit` and `manage` entries read
   `$.components.<app>`), statenet-network.md (its table of what `$.apps` means) and magnetic-show-views.md (the
   Statenet view's branches) change with it.
5. **stateui-mcp and stateui-pg**: tools write definitions at `components` and instances at `apps`; stored instances
   keep their log.
6. **Magnetic**: the editor edits the definition and its preview runs the owner's instance over the working
   definition; the server reads pages through ids; the editor's own record splits as above; the Statenet view draws
   an instance's tree, branching at components. Test runs stay: they keep trying an app from changing its seed
   records (stateui-test-runs.md), which the owner's own instance would still do.

## Rules and Constraints
- An app's definition is at `<owner>.components.<app>`; every user's state of it, the owner's included, is an
  instance at `<person>.apps.<app>`. Nothing that runs the app writes the definition.
- An instance stores changes over its definition, never a copy. It changes values, never which component sits on a
  branch or which branches a definition declares.
- Instances follow published versions; only the owner's preview runs over the working definition.
- Loading, replaying or undoing changes fires no logic; an effect runs once.
- Logic, relays, links and expressions name components by id (`#name`, set by `@id`); publishing checks every id
  they name, and refuses an id used twice in one scope.
- Peers are the people on the same data, never every user of an app; a person may narrow what they share, never
  widen it.
- Data is never shadowed: a write to another owner's data goes through to that owner; added fields go to an
  extension record, which is deleted with the record it extends.
- Mounts are layered in their order in `$.mounts`; a later mount overrides an earlier one, and a write goes to the
  layer that wins at its path. `$.mounts` is an ordered map, so its keys are never integer-like.
- No events: components write their own state, and logic reacts to state changes.
- Metadata (`@local`, `@secret`, `@transient`, `@share`) is read from definitions only.
- A `@secret` value is never stored, logged or relayed, never kept on the device, and sent only while online; a
  `@local` value never leaves the device.

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
- Device-only and offline state exist: the device's store holds them and the changes not yet sent (owner,
  2026-11-25).
- Reading peers' state is a link root, `$peers`, not an expression function: it needs the engine's permission check
  and a listener at the edge, which expressions do not do. The owner left the choice to design (2026-11-25).
- From a review of this design, accepted by the owner ("Yes, revise the doc with those fixes", 2026-11-25):
  - An instance changes values, never structure, so metadata cannot be taken off.
  - `@secret` values stay out of the device's store, the offline queue and the log, and are sent only online.
  - Loading, replay and undo fire no logic; effects run once.
  - A press is `{ at, device }` and transient.
  - Instances follow published versions; only the owner's preview runs over the working definition.
  - Peers are scoped to a path's value (the people on the same board), and a person may narrow their share.
  - Logic names components by id, which keeps what the page contract protected; publishing checks the ids.
  - Test runs stay, for the seed records they protect.
  - Containers keep an ordered `children` map; props and declared branches never share a name.
  - The device's store is IndexedDB.
- Extension records do not survive the deletion of the record they extend (owner, 2026-11-25).
- Components are named by id as `#name`, set by `@id`; inside a repeated template an id is the copy in the same
  row (owner, 2026-11-25: "Let's do it", on the recommendation).
- Shared branches are layered in mount order: one mounted first can be overridden by later mounts (owner,
  2026-11-25). That the person's own instance is a layer in the same order, and that writes go to the winning layer,
  follows from it in design.

## Open questions
- The form of metadata on a leaf: a list on the parent (as above) or a mark on the key's name, as `_` is.
- Whether an org may lay team defaults between an app's definition and its members' instances.
- How much history an instance keeps by default, and when the aggregate compacts it.
- Whether `@transient` values reach the people a branch is shared with live.
