# StateUI: blocks, code that ships with the libraries

Status: designed 2026-11-19, not built.

Asked for on 2026-11-19, after asking whether Statenet's diagram could be a StateUI component with its layout as logic:
"The idea is that we can create anything with the stateui, including something as complex as magnetic. We need to
include the layout so we don't lose that ability. We have a concept similar to hard IP in FPGAs. Code that is
specialized hard code that we can include with components."

On who may add one: "Whomever is running the servers, as they are liable for what the code does on the server." On
how they are included: "Let's not restrict the type of blocks that can be used right now", "Operator only. Users would
have to ask to get blocks added", and "Let's have Option A for our punyts components. We control the versioning with
those. For blocks that are not component specific we can use the additional blocks repo, though I think it needs a more
descriptive name."

## Summary

A **block** is specialized code that a document names and never contains, like a hard IP core in an FPGA: built and
tested once, placed by name. Coded logic already lets a document name a function, but only the host registers one
(`LogicFunctions`, `stateui-logic-epic-3-lookup-tables-and-coded-logic.md`), so an app built only through the MCP can
use none. Blocks are functions that come with the libraries a server runs. The server's operator chooses which run.

This keeps StateUI able to build anything, Magnetic included. Magnetic's Statenet needs a tree layout that expressions
and tables cannot reasonably write. As a block it becomes part of an app document like any other logic, rather than
code in Magnetic's page.

## The design

### What a block is
- A function of one of the kinds coded logic already has: a **compute** (synchronous, given inputs by name, returns
  outputs by name), an **expression function**, or an **effect** (asynchronous, may do I/O). No kind is restricted
  (owner, 2026-11-19).
- It comes with a manifest entry: its name, a one-line summary, its kind, where it may run (`server`, `browser` or
  both), and JSON schemas of its inputs and outputs (or arguments and result). The schemas let the validator check a
  unit's inputs and outputs before it runs, and let the agent call it right without reading code.
- A package exports its blocks as one value, `BlockPackage`: `{ package, blocks: { <name>: { kind, runs, summary,
  inputs, outputs, run } } }`. `run` is the function.

### Paths: functions are in Statenet
Asked for on 2026-11-19: "We should use the same statenet pathing as the expressions and tables, except instead of
pointing to data, it points to a function GUID or something like that." And: "That way we can see it on the statenet
like that and you know it's a hard IP."

- Every function the server runs has a path under `$.functions`: `$.functions.<package>.<name>`, as in
  `$.functions.components.layout.tree`. Host functions are under `$.functions.host`, so there is one way to name a
  function, whoever supplies it.
- The value at the path is the function's entry, not its code: `{ id, kind, runs, summary, inputs, outputs }`. `id`
  is a GUID its author gives the block in the manifest and keeps for the block's life; the runtime finds the code by
  it. The path is what people and documents read; the GUID is what the runtime calls.
- A document names a function by its path, where it names data by its path: `"run":
  "$.functions.components.layout.tree"` in a compute or an effect, and a call in an expression. Calling a path from an
  expression needs the expression grammar to take a path as the callee; that is part of building this.
- The server writes `$.functions` from the installed packages when it starts, the same on the authority and in the
  browser. It is protected: no document, person or agent writes it, and it never syncs from a client.
- Because functions are state, Statenet shows `$.functions` as a branch of the owner's tree, with a branch per package
  and a card per function. A function's card is marked as hard IP, unlike a data card: it shows its kind and where it
  runs, has no `+` and no editor, and its panel shows the summary and the schemas of its inputs and outputs. A unit's
  link to the function it runs is an edge like its links to data, so choosing a function shows every unit that uses it.
- Paths carry no version. Each package is a punyts library whose `develop` is its release, and a change to a block is
  made with every use of it, as a change to a component is (owner, 2026-11-19).

### Where blocks come from
- **The component libraries** carry the blocks their components need (option A, owner, 2026-11-19). stateui-components
  exports its `BlockPackage` beside its components, under the package name `components`. A component's controller
  calls its own library's blocks directly; an app's logic calls them by path.
- **stateui-functions** holds blocks no component needs: general layout, geometry, text, scheduling and the like. It is
  a punyts repo (`github.com/punyts/stateui-functions`) built and versioned like the others, cloned by
  `bin/workspace.mjs`, and its package name is `functions`. It is named after `LogicFunctions`, which its blocks
  register into.
- There is no registry. Blocks from anyone else wait until there is a second author; the manifest and the names are
  made so that a registry would be one more source of packages, not a change to documents.

### The operator installs blocks
- The server's operator decides which blocks run, since they are liable for what the code does (owner, 2026-11-19).
  `startServer` and `mountApp` take `blocks: BlockPackage[]`; the operator's configuration lists the packages, and may
  leave out single blocks by path.
- Users cannot add blocks. A user who needs one asks the operator (owner, 2026-11-19).
- Code for the browser is served from the operator's own origin, never fetched from elsewhere: the component
  library's blocks are in its runtime bundle, and stateui-functions' browser blocks are a lazy chunk the runtime
  loads when a mounted app names one (as stateui-3d's runtime chunk is).
- Host functions stay, for code that belongs to one embedder (Magnetic's billing, say), under `$.functions.host`.

### The agent and the validator
- The MCP lists the enabled blocks with their summaries and schemas, in a guide topic and in the validator's answer,
  so the agent sees only what this server runs.
- A document that names a function path the server does not run gets `SUI-LOGIC-FUNCTION`, as an unknown host function does
  now: a warning when it mounts, an error when it runs. A unit whose inputs or outputs do not fit the block's schemas
  is refused when it is written.

### The first block: `$.functions.components.layout.tree`
- Input: the nodes (`id`, `parent`, `width`, `height`), the cross links (`from`, `to`), and options (gaps, and whether
  the root's branches are shared between two sides). Output: each node's `x`, `y` and side, and each edge's path.
- It is the arithmetic Statenet's `layOut` and `drawEdges` do now, made pure. Sizes come in as input, so the block
  never measures: a component that sizes cards to their content writes their sizes to `$.runtime`, and the compute
  lays them out from there.
- A `treeDiagram` component in stateui-components draws the result from theme tokens and emits `select`, `add` and
  `open` with a node's id. Moving Statenet onto it is its own design.

## Rules and Constraints
- No code in documents. A document names functions by path; packages and the host supply them.
- Every function is at `$.functions.<package>.<name>` (host functions at `$.functions.host.<name>`), and its entry
  holds the GUID the runtime calls. Only the server writes `$.functions`.
- Only the operator enables blocks. Browser code comes only from the operator's origin.
- Every block has a manifest entry with schemas, and tests in its library.
- A change to a block changes every use of it in the same commits; nothing keeps an old version beside it.
- Blocks follow the library rules: no `eval` or `new Function`, logging only through the `@punyts/core` reporter, and
  compute blocks free of DOM and Node code so they run on both sides.

## Decisions
- Blocks may be computes, expression functions or effects, with no kind restricted for now (owner, 2026-11-19).
- The operator alone installs blocks; users ask for them (owner, 2026-11-19).
- Component blocks live in the component libraries and version with them (owner, 2026-11-19).
- Blocks no component needs live in stateui-functions (owner, 2026-11-19).
- No registry until there is a second author.
- Functions are named by Statenet paths under `$.functions`, whose values hold each function's GUID (owner,
  2026-11-19). Host functions move there too.

