# Lookup Tables, Coded Logic and Effects — StateUI Logic

## Epic Summary
Gives the `logic` root three tiers that work together through state:

- **Lookup tables** for fast logic: decision tables compiled to real lookup tables, with gaps and unreachable rows found at validation.
- **Expressions** for scripted logic: kept as they are, and they can now read a table (`lookup`) and call coded functions.
- **Coded logic** for specialized, efficient code: functions the host registers. *Compute* functions are synchronous and side-effect-free; *effects* are asynchronous and do I/O.

Every tier speaks only through state. A table cell sets values, and whatever listens to those values reacts. Async work is a **request written to state**: an effect listens to it, does the I/O and writes the result back. The state system stays synchronous, so anything that is not I/O updates in the same pass.

When this epic is done:
- A shipping or permission matrix is one table that the validator proves complete.
- Its rows can live in data that the app's users edit.
- Heavy calculations run as registered code.
- A grid pages through a remote API by writing a request; nothing in the document waits on a promise.

## Jira
None: built directly in the libraries on their `develop` branches, like epics 1 and 2.

## Feature Design Reference
`knowledge-base/design/stateui-logic.md` in AI Minion (epics 1 and 2 are next to it)

---

## Design

### The logic is a state machine over state
States are values in state, transitions are lookups, and I/O happens only at the edges:

```
change ─▶ path index ─▶ units that read it ─▶ (table | expression | compute) ─▶ writes ─▶ next change …
                                                       └─▶ request written ─▶ effect (async) ─▶ result written ─▶ new chain
```

- **Synchronous core.** Tables, rules, machines and compute functions run inside a chain and commit together, as today.
- **Async edges.** An effect never runs inside a chain. It starts when its request changes, and its answer starts a new chain, as a `call` result does today.
- **Cells and commands.** A cell sets values; it never notifies, saves or calls. Side effects stay in machines, rules and effects, which listen to the values a table writes.

### Finding the units a change reaches
Today every change is checked against every transition of every unit (`findHit` in `engine.ts`). The engine compiles the trigger patterns into a **path index** instead: a tree keyed by path segment, with `*` and `{name}` branches. A change walks the tree once and gets the units whose patterns match it. Machine transitions are also indexed by the current state, so a machine looks only at the rows of the state it is in. This changes no behaviour, only the cost: it grows with the depth of the path, not with the number of units.

### Compiled lookup tables
A table names its **inputs** (state values, each with a finite set of values), its **outputs** (state paths) and **rows**. The rows are compiled once into a dense array of cells.

```jsonc
"tables": {
  "shipping": {
    "inputs": {
      "country": { "path": "$.data.order.country", "values": ["NL", "BE", "DE", "*"] },
      "total":   { "path": "$.data.order.total", "breaks": [50, 100] }
    },
    "outputs": { "fee": "$.data.order.shipping", "days": "$.data.order.eta" },
    "rows": [
      { "country": "NL", "total": ">=50", "fee": 0, "days": 1 },
      { "country": "NL",                  "fee": 5, "days": 1 },
      { "country": "*",                   "fee": 9, "days": 4 }
    ]
  }
}
```

**Inputs.** Each input has a state `path`, or a `value` expression (`"{{ size($.data.cart) == 0 }}"`), and one way to give its finite set of values:

| Values | Index of a value |
|---|---|
| `values: [...]` | Its position in the list (a `Map` lookup); `"*"` is "any other value" |
| `breaks: [50, 100]` | Its bucket by binary search: below 50, 50 up to 100, 100 and above |
| A boolean path or expression | 0 or 1 |
| From a model field: a boolean, or a validator that allows only certain values | Its position in that list |
| `values: { "keys": "$.data.countries" }` | The keys of a data map; the table is compiled again when they change |
| A machine's `state` | The states its transitions name |

**Cells.** Combining the input indexes gives one cell number (`cell = country × 3 + totalBucket`). The cell holds the number of the row that wins it. A lookup is therefore one index per input plus one array read, and then the winning row's outputs are written.

**Rows.** A row gives a value for some inputs. An input it leaves out, or gives as `"*"`, matches every value. A number input may also take a comparison (`">=50"`, `"<100"`), which the compiler turns into buckets. Where rows overlap, the first one wins. The remaining keys of a row are its outputs: a literal, or an expression (`"{{ $total * 0.1 }}"`) for a cell that needs more than a value.

**Checks at validation.** Since every cell is computed ahead of time, the validator finds what first-match rows hide:
- `SUI-LOGIC-GAP` (error): a combination no row covers ("country BE with a total below 50"), unless a last row has only `"*"` inputs.
- `SUI-LOGIC-UNREACHABLE` (warning): a row that wins no cell.
- `SUI-LOGIC-SIZE` (warning): more than `MAX_TABLE_CELLS` (4,096) cells. The table then keeps its rows and matches them first-match at run time, which still produces the same results.

**Triggers, order and writes.**
- **Triggers:** a table has no `when`; any change to an input path runs it.
- **Order:** the input paths are what it reads and the output paths are what it writes, so `logicRunOrder` sorts it after everything that feeds it. A cycle between units that declare their reads and writes is `SUI-LOGIC-CYCLE` at validation, not a depth-8 failure at run time.
- **Writes:** an output whose value is already the one in state is not written. A table that recomputes the same answer therefore triggers nothing.
- **Start:** a table only derives values, so it runs in the derive pass when the engine starts.

**Per record.** An input path with a capture (`$.data.lines.{id}.qty`) makes the table run once for each record whose inputs changed. Its outputs then use the same capture (`$.data.lines.{id}.total`).

**`lookup` in expressions.** `lookup('shipping', 'BE', 40)` reads a table's winning row as an object of its outputs, without writing anything. Its arguments follow the order of the inputs.

### Rows from data
`"rows": { "from": "$.data.shippingRates", "model": "shipping-rate" }` takes the rows from a data map, which is checked against a model whose fields are the table's inputs and outputs. The table's shape stays in the logic; only its contents move to data. This puts rates, permissions and limits in the hands of the app's users: a `table` component edits them, they sync like any data, and in Full mode they are kept on the server.

- Rows are ordered by an `order` field when the model has one, otherwise by key.
- The table is compiled again when the data changes. A version with a gap, a bad value or too many cells fails with `logic.failed` (`{ table, reason }`), and the table keeps its last good version.
- An input's `values` can come from the same data (`{ "keys": … }`).

### Coded logic
Code never goes into a document. The document **names** functions, and the host supplies them. That keeps the rule from the logic design ("no user-defined code in a document") while still letting an embedding developer run specialized code.

```ts
// one module, imported by the browser host (mountApp hooks) and by the app server (startServer)
export const logicFunctions: LogicFunctions = {
    compute: {
        'pricing.lines': ({ lines, rates }) => ({ totals: priceLines(lines, rates) })
    },
    effects: {
        'orders.fetch': async (request, { signal }) => {
            const page = await api.orders(request, { signal });
            return { first: request.first, records: page.items, total: page.total };
        }
    }
};
```

**Compute functions** are synchronous and side-effect-free. A document uses one as a unit, which runs like a table:

```json
"computes": {
  "lineTotals": { "inputs": { "lines": "$.data.lines", "rates": "$.data.rates" }, "run": "pricing.lines",
                  "outputs": { "totals": "$.data.totals" } }
}
```

- The unit's inputs and outputs are declared, so run order, write-only-real-changes and cycle checks treat it exactly like a table.
- A function registered with `expression: true` is also callable from expressions by its name, which must not clash with the built-in functions.
- An error in the function fails the transition with `logic.failed`, as a failing command does.

**Effects** are asynchronous. They are covered next.

**Unknown names.** A document that names a function the host did not register gets `SUI-LOGIC-FUNCTION` when it mounts: a warning, and an error when it runs. The app server and the preview list the registered names, so the MCP validator can check them. Apps built only through the MCP have no code; for them an unknown effect goes to the agent instead (below).

### Effects and request tokens
An effect turns **a request in state** into **a result in state**:

```json
"effects": {
  "fetchOrders": {
    "request": "$.data.orders.request",
    "run": "orders.fetch",
    "status": "$.data.orders.status",
    "records": { "into": "$.data.orders.records", "key": "id" },
    "window": "^orders",
    "cache": 20
  }
}
```

- **The request is the token.** Writing a value at `request` starts the effect. The token is a stable hash of that value in canonical JSON, so writers never compute one, and equal requests have equal tokens.
- **Status.** The engine writes `status` as `{ token, state, total?, reason?, at }`, with `state` one of `idle`, `loading`, `ready` or `error`. A table over `state` turns it into the UI: a busy flag, empty text or an error message.
- **Latest request wins.** A new token cancels the running call (its `AbortSignal` fires). An answer whose token no longer matches `status.token` is dropped, so a slow page 2 never overwrites page 3.
- **The answer.** It is `{ first?, records?, total?, value? }`, or a thrown error, which becomes `state: error` with its message as `reason`. The engine applies it in one commit:
  1. It merges `records` into `into` by `key` (the primary key).
  2. It writes the window (below).
  3. It writes `status`.
- **Records are a map keyed by primary key.** Merging the same page again updates records in place instead of duplicating them. `save-data`, `delete-data` and `pull-data` work on the map, and order is never kept in it.

**The component's state is the frame buffer.** `window` names the record view, such as a `table` or `recordList`. The answer's records go into its records property, keyed by position from `first`, with each record's primary key in its key field, plus `total`. This is the shape `query` writes today. The **server's order** is kept: the window is filled from the answer, not by sorting the local map, because the map holds only the pages fetched so far and sorting it would leave holes.
- **A row follows its record.** When `records.{pk}` changes (an edit, a save), the engine updates the window rows that hold that key. Showing the change needs no new fetch.
- **The cache.** In memory, the engine keeps the last `cache` tokens with the ordered keys and `total` of each answer. A token it already has is answered from the records map with no call, so going back a page is instant. The cache does not sync and is empty after a reload, like a timer.
- **Prefetching.** An effect may write a second request path, such as the next page, with no `window`. Its records then land in the map and its keys in the cache.

**Where an effect runs.**

| Mode | Runs it | The view receives |
|---|---|---|
| Full | The app server's authority (`startServer({ logicFunctions })`); API keys stay on the server | The window rows and the status only; the records map stays on the server |
| Persisted, Standalone | The browser (`mountApp` hooks `logicFunctions`) | Everything is local; `records` is a cache |

When no function is registered under the name, the request is queued for `ui_events_read` as a `logic.effect` event with its token. The agent then answers with `ui_effect_answer`, the same way `logic.call` works today.

### Worked example: paging orders from an API
1. **The user scrolls or pages.** The grid writes its articulation property `window` (`{ first, count }`).
2. **A rule writes the request:**
   ```json
   "ordersRequest": { "when": { "path": "^orders.window" },
     "do": [ { "command": "set", "target": "$.data.orders.request",
               "value": { "pick": { "first": "{{ $trigger.first }}", "count": 50, "sort": "^orders.sort" } } } ] }
   ```
3. **`fetchOrders` sees a new token.** The status becomes `loading`, any older call is cancelled, and `orders.fetch` runs.
4. **The answer commits in one go:** records merge into `$.data.orders.records` by `id`, rows 0–49 fill the grid's records by position, and the status becomes `ready` with `total`.
5. **A table maps the status to the UI:**
   ```json
   "ordersView": {
     "inputs": { "state": { "path": "$.data.orders.status.state", "values": ["idle", "loading", "ready", "error"] },
                 "empty": { "value": "{{ $.data.orders.status.total == 0 }}" } },
     "outputs": { "busy": "^orders.busy", "message": "^ordersMessage._text" },
     "rows": [ { "state": "loading", "busy": true, "message": "" },
               { "state": "error", "busy": false, "message": "{{ $.data.orders.status.reason }}" },
               { "state": "ready", "empty": true, "busy": false, "message": "No orders yet" },
               { "busy": false, "message": "" } ] }
   ```
6. **Back to page 1.** The token is in the cache, so the rows refill from the map with no call.

In Full mode steps 2 to 5 run on the authority, and only the rows on screen and the status reach the browser.

---

## Decisions
- **Tables are values only.** A cell sets values, and a reaction belongs to whatever listens to them. The epic 2 table form (`when`, `inputs`, rows with `do`) is replaced, not kept beside the new one: its row commands move to rules and machines that listen to the table's outputs. The project keeps no backwards compatibility.
- **First-match semantics stay.** A compiled table gives the same answers as matching its rows in order. Compiling only adds speed and the gap and unreachable checks, and is the fallback above `MAX_TABLE_CELLS`.
- **Both inline rows and rows from data.** The shape is always in the logic; the rows are written there or read from a data map with a model. They do different jobs: rules the builder writes, and settings the users own.
- **The engine stays synchronous.** Only effects are async, and they talk to the core only through state: a request in, a status and records out. A promise never runs inside a chain.
- **The request value is the token.** A canonical hash of the request, not a counter, so equal requests share a cache entry and a late answer is recognised.
- **The view's records are the frame buffer.** There is no separate frame store. The data map keyed by primary key is the record store, the record view's records by position are the frames, and the token cache links one to the other.
- **No code in documents.** Documents name compute and effect functions, and hosts register them in one module that the browser and the app server share.
- **`call` stays for now.** It is a machine waiting for an answer, while an effect is a request kept in state. Whether `call` becomes an effect with a request path is decided after L3.5 has been used.
- **Not in this epic:** effects that stream (subscriptions, server-sent updates), dropping old records from the map, and per-persona request paths (statenet direction).

## Stories

### Story list (priority order)
| Order | Story | Title | Depends on |
|-------|-------|-------|------------|
| 1 | L3.1 | Path index for dispatch | none |
| 2 | L3.2 | Compiled lookup tables | L3.1 |
| 3 | L3.3 | Rows and values from data | L3.2 |
| 4 | L3.4 | Compute functions | L3.1 |
| 5 | L3.5 | Effects and request tokens | L3.4 |
| 6 | L3.6 | MCP: tables, functions and effects | L3.2 to L3.5 |
| 7 | L3.7 | Example and documentation | L3.1 to L3.6 |

### Story L3.1: Path index for dispatch
**Objective:** A change reaches the units that listen to it without every unit being checked.
**Acceptance Criteria:**
- [ ] Trigger patterns compile into a segment tree with `*` and `{name}` branches; a change walks it once and gets the matching units with their captures.
- [ ] Machine transitions are indexed by `from`; a machine looks only at the rows of its current state and at rows with no `from`.
- [ ] All existing logic tests pass unchanged, including run order, `already-fired` traces and the derive pass.
- [ ] A benchmark test with 500 rules on distinct paths shows that dispatching one change does not grow linearly with the number of rules.
**Technical Notes:** Packages affected: `stateui-app` (`src/core/logic/engine.ts`, `pattern.ts`).

### Story L3.2: Compiled lookup tables
**Objective:** A table is compiled into a lookup table that is proven complete, and it only writes values.
**Acceptance Criteria:**
- [ ] `tables.<name>` has `inputs` (with `path` or `value`, plus `values`, `breaks`, a boolean, a model field or a machine state), `outputs` and `rows`; the epic 2 form is removed.
- [ ] Rows compile to a dense cell array. A lookup costs one index per input and one array read, and writes the winning row's outputs (literals or expressions).
- [ ] `SUI-LOGIC-GAP`, `SUI-LOGIC-UNREACHABLE` and `SUI-LOGIC-SIZE` are reported at validation; above `MAX_TABLE_CELLS` the table matches first-match at run time with the same results.
- [ ] Inputs are triggers and outputs are writes: `logicRunOrder` sorts tables after the units that feed them, `SUI-LOGIC-CYCLE` reports cycles among declared units, and an output equal to its current value is not written.
- [ ] Captured input paths run the table per record; tables run in the derive pass.
- [ ] `lookup(name, ...inputs)` is an expression function returning the winning row's outputs.
**Technical Notes:** Packages affected: `stateui-app` (logic types, `read.ts`, engine, validators, error catalog). A property test compares compiled lookups with first-match evaluation over random inputs.

### Story L3.3: Rows and values from data
**Objective:** A table's rows, and an input's values, can come from data that users edit.
**Acceptance Criteria:**
- [ ] `rows: { from, model }` reads rows from a data map whose model has the table's inputs and outputs as fields; rows are ordered by `order` or by key.
- [ ] `values: { keys: path }` takes an input's values from a data map's keys.
- [ ] The table is compiled again when that data changes; a version that fails a check raises `logic.failed` with `{ table, reason }`, and the last good version stays in use.
- [ ] In Full mode the rows stay on the authority; the views never need them.
**Technical Notes:** Packages affected: `stateui-app`, `stateui-mcp` (model check of shared datasets).

### Story L3.4: Compute functions
**Objective:** Specialized code runs as a logic unit and in expressions, supplied by the host.
**Acceptance Criteria:**
- [ ] `LogicFunctions` (`compute`, `effects`) is a type exported from `core`; `mountApp` takes it as the hook `logicFunctions` and the engine as a `LogicHost` member.
- [ ] `computes.<name>` (`inputs`, `run`, `outputs`) runs like a table: it is triggered by its inputs, ordered by its reads and writes, writes only real changes and runs in the derive pass.
- [ ] Functions registered with `expression: true` are callable in expressions; a name that clashes with a built-in function is refused when it is registered.
- [ ] A name the host did not register is `SUI-LOGIC-FUNCTION` (a warning at mount, `logic.failed` when it runs); a thrown error fails the transition.
**Technical Notes:** Packages affected: `stateui-app`.

### Story L3.5: Effects and request tokens
**Objective:** Async work starts from a request in state and ends as records, a window and a status in state.
**Acceptance Criteria:**
- [ ] `effects.<name>` (`request`, `run`, `status`, `records { into, key }`, `window`, `cache`) starts when the request's canonical hash changes, and never inside a chain.
- [ ] A new token aborts the running call; an answer with a stale token is dropped.
- [ ] The answer commits in one go: records merged by key, the window written by position in the answer's order with `total`, and `status` `{ token, state, total?, reason?, at }`.
- [ ] A change to `records.{pk}` updates the window rows holding that key.
- [ ] A cached token refills the window from the map with no call; the cache is in memory and holds `cache` tokens.
- [ ] Full mode runs effects on the authority, and only the window and status reach the views; browser modes run them in `mountApp`.
**Technical Notes:** Packages affected: `stateui-app`, `stateui-mcp` (`AppLogic.ts`, `startServer`). Tests use a fake effect with controllable timing for cancellation and stale-answer cases.

### Story L3.6: MCP: tables, functions and effects
**Objective:** An agent can write, inspect and answer the new logic.
**Acceptance Criteria:**
- [ ] `ui_logic_write` validates tables, computes and effects; gap and unreachable findings name the missing combinations and the rows.
- [ ] `ui_tree` with `logic: true` shows each table's inputs and their values, the rows, and each effect's status and cache size.
- [ ] An effect with no registered function queues `logic.effect` (`{ id, name, token, request }`) for `ui_events_read`; `ui_effect_answer` answers it, with the same token rules.
- [ ] The guide's logic topic explains the three tiers, rows from data and the request-token pattern.
**Technical Notes:** Packages affected: `stateui-mcp`.

### Story L3.7: Example and documentation
**Objective:** The example app shows all three tiers, and the docs describe them.
**Acceptance Criteria:**
- [ ] The example has an Orders section paging a fake API through an effect, a status table and a compute function, with browser tests for paging, cancelling, the cache and an edited record updating its row.
- [ ] The Logic sections of the `@punyts/stateui-app` and `@punyts/stateui-mcp` READMEs describe tables, rows from data, computes and effects, with paths in the screens model (`$.screens.<name>…`, app events on the app node's `on`).
- [ ] AI Minion's `knowledge-base/design/stateui-logic.md` gets a short section on the tiers, pointing here.
**Technical Notes:** Packages affected: `example`, `stateui-app`, `stateui-mcp`.
