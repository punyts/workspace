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

### Names
- A block's full name is `<package>:<name>`, as in `components:layout.tree`. A host function's name has no colon, so
  the two never clash, and a document shows where each function it names comes from.
- A document names a block exactly where it names a host function today: `computes.<unit>.run`, an effect's `run`, or
  a call in an expression.
- Names carry no version. Each package is a punyts library whose `develop` is its release, and a change to a block is
  made with every use of it, as a change to a component is (owner, 2026-11-19).

### Where blocks come from
- **The component libraries** carry the blocks their components need (option A, owner, 2026-11-19). stateui-components
  exports its `BlockPackage` beside its components, under the package name `components`. A component's controller
  calls its own library's blocks directly; an app's logic calls them by name.
- **stateui-functions** holds blocks no component needs: general layout, geometry, text, scheduling and the like. It is
  a punyts repo (`github.com/punyts/stateui-functions`) built and versioned like the others, cloned by
  `bin/workspace.mjs`, and its package name is `functions`. It is named after `LogicFunctions`, which its blocks
  register into.
- There is no registry. Blocks from anyone else wait until there is a second author; the manifest and the names are
  made so that a registry would be one more source of packages, not a change to documents.

### The operator installs blocks
- The server's operator decides which blocks run, since they are liable for what the code does (owner, 2026-11-19).
  `startServer` and `mountApp` take `blocks: BlockPackage[]`; the operator's configuration lists the packages, and may
  leave out single blocks by name.
- Users cannot add blocks. A user who needs one asks the operator (owner, 2026-11-19).
- Code for the browser is served from the operator's own origin, never fetched from elsewhere: the component
  library's blocks are in its runtime bundle, and stateui-functions' browser blocks are a lazy chunk the runtime
  loads when a mounted app names one (as stateui-3d's runtime chunk is).
- Host functions stay as they are, for code that belongs to one embedder (Magnetic's billing, say).

### The agent and the validator
- The MCP lists the enabled blocks with their summaries and schemas, in a guide topic and in the validator's answer,
  so the agent sees only what this server runs.
- A document that names a block the server does not run gets `SUI-LOGIC-FUNCTION`, as an unknown host function does
  now: a warning when it mounts, an error when it runs. A unit whose inputs or outputs do not fit the block's schemas
  is refused when it is written.

### The first block: `components:layout.tree`
- Input: the nodes (`id`, `parent`, `width`, `height`), the cross links (`from`, `to`), and options (gaps, and whether
  the root's branches are shared between two sides). Output: each node's `x`, `y` and side, and each edge's path.
- It is the arithmetic Statenet's `layOut` and `drawEdges` do now, made pure. Sizes come in as input, so the block
  never measures: a component that sizes cards to their content writes their sizes to `$.runtime`, and the compute
  lays them out from there.
- A `treeDiagram` component in stateui-components draws the result from theme tokens and emits `select`, `add` and
  `open` with a node's id. Moving Statenet onto it is its own design.

## Rules and Constraints
- No code in documents. A document names blocks; packages supply them.
- A block's name is `<package>:<name>`; a host function's name has no colon.
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

