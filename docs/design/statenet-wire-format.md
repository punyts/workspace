# A binary wire format for sync and the mesh

Status: designed 2026-11-23, not built. The first of the direction's transport items
([statenet-direction.md](statenet-direction.md), "Transport and encoding", item 1).

Asked for on 2026-11-23: "Ok, let's do all of that starting with your recommendation", to the list of next steps that
ended with "the binary wire format. That needs a design first".

## Why
Every message on the browser's socket and between nodes is JSON text today: a change carries its field names, its full
`$.` path and its id as text, and every message is parsed as text. Between nodes the JSON is sealed (AES-GCM) and sent
as bytes, so it is text inside bytes. The direction asks for an encoding with no field names and no text parsing,
which needs no new infrastructure.

## What is there to build on
- **Sync protocol 3** (`state-sync/src/Messages.ts`): 13 message types (`hello`, `welcome`, `changes`, `durable`,
  `change`, `ack`, `requested`, `decided`, `approve`, `reject`, `withdraw`, `emit`, `error`), each a JSON object with a `type`. `SyncTransport` and `TransportConnection` carry text
  (`send(text)`, `onMessage(text)`); `Authority.connect` sessions `receive(text)`. `Validate.ts` checks each parsed
  message; `maxMessageBytes` bounds it.
- **Mesh protocol 4** (`statenet/src/mesh/protocol.ts`): `link-hello`, `link-welcome` and `link-proof` in clear JSON,
  then `frame` messages of `MeshMessage`s, each frame JSON text sealed by `LinkSeal.seal(text): Buffer`.
- **Who speaks sync**: the browser runtime (stateui-app's runtime frame, through stateui-mcp's view host), the server's
  dataset sessions (`DatasetSession`, in process), statenet's `ClientServer`, and tunnelled sessions (`open`/`say`
  through the mesh, whose `say` carries a sync message as text).

## The design
- **CBOR (RFC 8949), a subset, written in state-sync.** Values are maps, arrays, text, integers, floats, booleans and
  null, as JSON's are; map keys are text and keep the order they were written in (StateUI's key order matters). CBOR
  over MessagePack because it is a standard with a defined deterministic form and a tag for big integers (owner ids
  are 64-bit). The codec is ours (`state-sync/src/Cbor.ts`, browser-safe, no dependency): about 300 lines, with the
  limits an authority needs on untrusted bytes (depth, item count, string and total size), refusing what JSON cannot
  hold (undefined, byte strings, tags other than big integers, non-text keys, NaN and infinities) so a decoded value is
  always a `JsonValue`.
- **Messages are arrays, not maps.** Each message is `[code, …fields]` in a fixed order per type: `change` is
  `[5, id, path, op, base, value?]`, `changes` is `[3, [[revision, id, path, op, base, value?], …]]`. Codes and op
  codes are small integers listed in `Messages.ts`; field names never travel.
- **Paths by number, per connection.** Each side of a connection keeps a table of the paths it has sent: the first time
  a path goes out it is sent as `[pathNumber, "$.data.records.tea"]`, after that as the number. Tables hold at most
  4,096 paths per direction; past that, paths go as text. Numbers are not global: global path ids belong to the
  direction's registry and tags, which this design does not need.
- **Change ids as bytes when they are uuids.** A change id that is a uuid travels as its 16 bytes (a CBOR byte string,
  the one byte string allowed, only in an id field); any other id as text.
- **Sync protocol 4 is binary after hello.** `hello` stays JSON text and gains nothing new: protocol 4 means "binary
  from here". The authority answers a protocol 4 hello with a binary `welcome`, and every later message both ways is a
  binary WebSocket frame. `SyncTransport`, `TransportConnection` and authority sessions carry `string | Uint8Array`;
  a text frame after hello on a protocol 4 connection is `invalid-message`. Clients below 4 keep JSON (`PROTOCOL_VERSIONS`
  gains 4).
- **Mesh protocol 5 seals CBOR.** The link handshake stays JSON; after it, a frame's messages are encoded as CBOR
  before sealing, and `say` carries a sync message as bytes. Nodes of protocol 4 and 5 do not link (the mesh already
  refuses a protocol it does not speak); a deploy restarts every node.
- **Validation stays one check.** `Validate.ts` checks a decoded message as it checks a parsed one today; the codec
  only guarantees the value is JSON-shaped. Errors keep their codes (`invalid-json` becomes `invalid-message` for
  bytes that do not decode).
- **Reporting** names message types and sizes, as now; no value is decoded for a report.
- **Measured before and after.** A script (`state-sync/scripts/wire-size.ts`) encodes a recorded session (a welcome
  snapshot of the example's Northwind data, and 1,000 record changes) both ways and prints bytes and encode/decode time,
  and the CHANGELOG states the numbers.

Typed values by model (a field's value encoded by the model's type, so a record goes as its field values in model
order) are the direction's next step and need the model version on both sides; they get a design of their own once
this is measured.

## Rules and Constraints
- A decoded message is always a `JsonValue` tree; nothing the JSON form could not carry crosses the wire.
- Map keys keep their order. Integer-like keys stay forbidden where they are today.
- The codec refuses input past its limits before allocating for it.
- `hello` and the link handshake stay text, so a connection can always say which protocol it speaks.
- Every transport still ends at a node, and nothing here changes what a relay sees or decides.

## Stages
1. **W1, the codec** (state-sync): `Cbor.ts` encode and decode with limits, round-trip and refusal tests, and a
   property test against `JSON.parse(JSON.stringify(x))` over generated values; the size script.
2. **W2, sync protocol 4** (state-sync, stateui-mcp, statenet's `ClientServer`): binary messages after hello, path
   tables, transports of bytes. The browser runtime's transport (stateui-app) sends `Uint8Array`; the UI machine
   rebuilds the runtime bundle.
3. **W3, mesh protocol 5** (statenet): CBOR frames under the seal; `say` as bytes.

Checks: the example's suites and Magnetic's e2e suite pass over protocol 4; the size script's numbers are in the
CHANGELOG; a protocol 3 client still syncs with an authority that speaks 4.

## Decisions
Proposed, for the owner:
- **Our own CBOR subset rather than a library** (`cbor-x`, `msgpackr`): the subset is small, the limits and the
  refusals are what an authority needs, and state-sync stays dependency-free in the browser.
- **CBOR rather than MessagePack**, for the standard's deterministic form and big-integer tag.
- **Paths numbered per connection**, not globally, until the registry exists.
- **Text protocols 1 to 3 stay** until the runtime bundle every open browser runs speaks 4; they are removed by a later
  change once a deploy has carried protocol 4.

## Open items
- Typed values by model, and how a model version selects them.
- Whether the mesh's frames should batch more messages once each is smaller.
