# StateUI: hard IP, code that ships with the libraries

Status: designed 2026-11-19, not built.

Asked for on 2026-11-19, after asking whether Statenet's diagram could be a StateUI component with its layout as logic:
"The idea is that we can create anything with the stateui, including something as complex as magnetic. We need to
include the layout so we don't lose that ability. We have a concept similar to hard IP in FPGAs. Code that is
specialized hard code that we can include with components."

On who may add it: "Whomever is running the servers, as they are liable for what the code does on the server." On how
it is included: "Let's not restrict the type of blocks that can be used right now", "Operator only. Users would have
to ask to get blocks added", and "Let's have Option A for our punyts components. We control the versioning with those.
For blocks that are not component specific we can use the additional blocks repo, though I think it needs a more
descriptive name." The repo is stateui-functions.

On naming: "We should use the same statenet pathing as the expressions and tables, except instead of pointing to data,
it points to a function GUID or something like that." And: "That way we can see it on the statenet like that and you
know it's a hard IP."

On a review of the first design: "That's kinda why I was thinking the statenet just had a pointer (GUID). The browser
or server can load the function based on the pointer, but only as needed." "I think components shouldn't have their
blocks turned off, then they won't work. Maybe component blocks path are with the components. You can still see there
is a block there, but it's not independent or can it be disabled." "expression syntax allows calling of functions, but
those have to be exposed to the scope somehow. Let's figure that out."

## Summary

Hard IP is specialized code that a document names and never contains, like a hard IP core in an FPGA: built and tested
once, placed by name. Each piece is a **function** with a Statenet path. The value at the path is a pointer, the
function's GUID, and the browser or the server loads the code behind the pointer only when an app needs it.

Coded logic already lets a document name a function, but only the host registers one
(`stateui-logic-epic-3-lookup-tables-and-coded-logic.md`), so an app built only through the MCP can use none. Hard IP
comes with the libraries a server runs, and the server's operator chooses which. That keeps StateUI able to build
anything, Magnetic included: Statenet's tree layout, which expressions and tables cannot reasonably write, becomes a
function an app document names rather than code in Magnetic's page.

"Function" is the word in code, paths and docs. "Hard IP" is the label Statenet puts on their cards.

## The design

### What a function is
- One of the kinds coded logic already has: a **compute** (synchronous, given inputs by name, returns outputs by
  name), an **expression function**, or an **effect** (asynchronous, may do I/O). No kind is restricted (owner,
  2026-11-19).
- Its author gives it a **manifest entry**: a GUID kept for the function's life, its path, a one-line summary, its
  kind, where it may run (`server`, `browser` or both), and JSON schemas of its inputs and outputs (or arguments and
  result). The schemas let the validator check a use before it runs and let the agent use the function without
  reading code.
- A library exports a **catalog**: the manifest entries, plus a loader per entry that returns the code. Entries are
  small and always present; code is loaded only by a loader.

### Paths and pointers
- A function's path is where people and documents find it. The value at the path is a pointer, `{ fn: "<GUID>" }`,
  and nothing else. The runtime turns the GUID into code through the catalog.
- **Functions of a component** sit with their component: `$.components.<component>.functions.<name>`, as in
  `$.components.treeDiagram.functions.layoutTree`. They are part of the component: on whenever the component is,
  never disabled on their own, since the component would not work without them (owner, 2026-11-19). An app's logic may
  still call one by that path.
- **Other functions** are under `$.functions.<group>.<name>`, as in `$.functions.layout.grid`. stateui-functions keeps
  its functions in groups (layout, geometry, text, scheduling). The group `host` is reserved for the host's own
  functions, `$.functions.host.<name>`, so a function has one kind of name whoever supplies it.
- A document names a function by its path, where it names data by its path: `"run": "$.functions.layout.grid"` in a
  compute or effect, and a call in an expression.
- A function's path changes only with every use of it, in the same commits, as a rename of a component does. The GUID
  stays, so the code is found the same way after a rename, and a registry, should there be one, has an identity that
  does not depend on where a server puts the function.
- Paths carry no version: each library's `develop` is its release (owner, 2026-11-19).

### `$.functions` is the server's, not the app's
- The runtime provides `$.functions` and each component's `functions` from the catalogs the operator installed. They
  read like state (paths, links, Statenet), but are not stored in an app's state, never sync, and nothing writes them:
  no document, person or agent.
- The pointers the browser sees are the functions that run in the browser; the authority's are those that run on the
  server. A compute marked for both is in both.

### Loading only as needed
- On mount, the runtime collects the function paths the app names: every logic unit's `run`, and every expression
  callee under `$.functions` or a component's `functions`. It loads their code (the browser fetches the lazy chunks
  that hold them, from the operator's origin) before the logic engine starts. Expressions are synchronous, so their
  functions must be loaded first.
- An effect's code may load on its first request instead, since an effect is asynchronous already.
- A function that is called but not loaded, or not installed, is `SUI-LOGIC-FUNCTION`.
- A component's functions are in the component's own code, loaded with the component.

### Calling a function from an expression
- The expression syntax already has calls: the executor looks the callee's path up in the context and requires a
  function there (`expression/src/Executor.ts`, `handleExecution`). What is missing is a function at that path: the
  context holds state, and the state at a function's path is a pointer.
- `@punyts/expression` gains one option, `ExecuteOptions.callable(value, path)`: when a callee's value is not a
  function, the executor asks it for one, and fails as now when it returns none. The grammar does not change.
- The runtime passes the same `callable` to both places that run expressions: the view scope (`stateui`
  `Scope.evaluate`) and logic (`stateui-app` `evaluate`). It turns a pointer into its loaded function. stateui keeps
  its dependencies (state, expression, core): it takes `callable` as an option and knows nothing of catalogs.
- A function path read as a value, not called, is the pointer.
- The built-in functions (`LOGIC_FUNCTIONS`) keep their bare names: they are the language's own, like its operators.
  Host expression functions move under `$.functions.host`.

### Where functions come from
- **The component libraries** carry their components' functions and version them with the library (option A, owner,
  2026-11-19).
- **stateui-functions** (`github.com/punyts/stateui-functions`) holds functions no component needs. It is a punyts
  library like the others, cloned by `bin/workspace.mjs`. A function that starts in a component and is used widely
  without it moves there.
- There is no registry until there is a second author.

### The operator installs functions
- The operator decides what runs, since they are liable for what the code does (owner, 2026-11-19). `startServer` and
  `mountApp` take `catalogs`; the operator's configuration lists the libraries, and may leave out single functions of
  stateui-functions. A component's functions go with the component.
- Users cannot add functions. A user who needs one asks the operator (owner, 2026-11-19).
- Code for the browser comes only from the operator's origin.
- The host's own functions (Magnetic's HTTP effect for connections, say) are a catalog the host passes, under
  `$.functions.host`.

### The agent, the validator and moving apps
- The MCP lists the functions this server runs, with their summaries and schemas, in a guide topic and in the
  validator's answer.
- A document naming a function path the server does not run gets `SUI-LOGIC-FUNCTION`: a warning when it is written
  or mounts, an error when it runs. A unit whose inputs or outputs do not fit the function's schemas is refused when it
  is written.
- Copying, sharing or opening an app from elsewhere lists the functions it names that this server lacks before it is
  used, not when it fails.

### Statenet
- `$.functions` is a branch with a branch per group and a card per function, and each component under `$.components`
  shows its functions beneath it.
- A function's card is labelled hard IP: it shows its kind and where it runs, has no `+` and no editor, and its panel
  shows the summary and the schemas. A component's functions show they belong to it and cannot be turned off.
- A unit's link to the function it runs is an edge like its links to data, so choosing a function shows every unit
  that uses it.
- Statenet shows the functions the owner's apps use, and a pill with the count of the others, as `$.apps` shows the
  owner's other apps.

### The first function: `$.components.treeDiagram.functions.layoutTree`
- Input: the nodes (`id`, `parent`, `width`, `height`), the cross links (`from`, `to`), and options (gaps, and whether
  the root's branches are shared between two sides). Output: each node's `x`, `y` and side, and each edge's path.
- It is the arithmetic Statenet's `layOut` and `drawEdges` do now, made pure.
- The `treeDiagram` component in stateui-components calls it itself, in one pass: it measures its cards, lays them
  out and draws them, with theme tokens, and emits `select`, `add` and `open` with a node's id. Component controllers
  may read layout (`board` and `chart` do). An app that wants positions in its own state runs the same function as a
  compute.
- Moving Statenet onto it is its own design.

### Size
- Component functions add to the components' runtime bundle, which has no size gate; stateui-3d's chunk has one
  (`runtime-chunk/build.test.ts`). The first function comes with a gzip gate on the components bundle, and
  stateui-functions' chunks get one each.

## Build order
1. stateui-app: the manifest entry and catalog types, the runtime-provided `$.functions`, and loading on mount.
2. Host functions move into a host catalog under `$.functions.host`: Magnetic's HTTP effect and stateui-mcp's wiring
   (`createServices.ts`, `startServer.ts`, the guide). ai-minion registers none.
3. expression: `ExecuteOptions.callable`; stateui and stateui-app pass it.
4. stateui-mcp: the listing, the validator's checks and the missing-function list when an app moves.
5. stateui-components: `layoutTree` and `treeDiagram`, with the bundle's size gate.
6. Magnetic: Statenet's `$.functions` branch and component functions, then Statenet on `treeDiagram` (its own design).
7. stateui-functions, with its first function, when one is needed.

## Rules and Constraints
- No code in documents. A document names functions by path; catalogs supply the code.
- A path holds only a pointer, `{ fn: "<GUID>" }`. The runtime provides these paths; nothing writes them, and they never
  sync.
- Component functions are at `$.components.<component>.functions.<name>` and go with their component. Other functions
  are at `$.functions.<group>.<name>`; `host` is the host's group.
- Code loads only for functions an app names, and browser code comes only from the operator's origin.
- Only the operator installs functions.
- Every function has a manifest entry with schemas, and tests in its library.
- A change to a function changes every use of it in the same commits; nothing keeps an old version beside it.
- Functions follow the library rules: no `eval` or `new Function`, logging only through the `@punyts/core` reporter,
  and computes free of DOM and Node code so they run on both sides.

## Decisions
- No kind of function is restricted for now (owner, 2026-11-19).
- The operator alone installs functions; users ask for them (owner, 2026-11-19).
- Component functions live in the component libraries and version with them (owner, 2026-11-19); their paths are with
  their components, and they cannot be turned off apart from the component (owner, 2026-11-19).
- Functions no component needs live in stateui-functions (owner, 2026-11-19).
- Statenet holds a pointer, the function's GUID, and code loads only as needed (owner, 2026-11-19).
- Documents name the path; the GUID is the function's identity for loading and for any later registry.
- Expressions call functions through `ExecuteOptions.callable`; the grammar does not change.
- "Function" is the term; "hard IP" is Statenet's label.
- No registry until there is a second author.
