# Seeded random and scene keys

Status: built 2026-11-22.

Asked for on 2026-11-22: "Game gaps, small ones", the two gaps the games analysis
([stateui-games-and-3d-modeling.md](stateui-games-and-3d-modeling.md)) sized Small: "A seeded `random(seed, n)` among the
built-in functions" and "A key-binding entry on `scene3d` (`on.key` with the key name)".

## Seeded random

`random` joins the logic functions (`LOGIC_FUNCTIONS`, stateui-app `src/core/logic/values.ts`):

- `random(seed)` is a number in [0, 1); `random(seed, n)` is a whole number from 0 to n - 1.
- The value depends only on the seed, so every replica, the browser and the server's authority compute the same one and
  a synced game stays in step. An app seeds it from state: `random($.data.game.id + ':' + $.data.game.turn, 6)` is a die
  roll for the turn. Two draws in one turn use two seeds (`… + ':a'`, `… + ':b'`).
- The seed is any JSON value, read as its JSON text, so `7` and `'7'` are different seeds. A missing or null seed, or an
  `n` that is not a whole number from 1 to 2^32, gives `null`.
- The hash is FNV-1a over the seed text, mixed by mulberry32's output step. It is not cryptographic: a player who
  knows the seed can work out the roll. A game that must hide it keeps the seed in `$.server`.

## Scene keys

`scene3d` takes a `keys` property, a list of key names, and raises a `key` event for each:

- The names are a closed list: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Space`, `Enter`, `Escape`, the
  letters `a` to `z` and the digits `0` to `9`. A letter matches with or without Shift.
- While `keys` is not empty the scene box is focusable and names the keys in `aria-keyshortcuts`. A listed key pressed
  while focus is in the scene raises `key` on the element with `detail: { key }` (the listed name) and does nothing
  else: the camera controls do not see it and the page does not scroll. A held key repeats. A key with Alt, Control or
  Meta held is not taken, so the host's and the browser's chords keep working, and an interactive node's proxy button
  keeps Enter and Space.
- The dispatcher runs the scene node's `on.key` and, like every event, writes the payload to
  `$.raised.<scene path>.key` with `always`, so a rule triggered there runs on every press, the same key again
  included. A rule reads `$trigger.key`; a lookup table with an input at that path turns key names into moves.

```json
"rules": {
  "step": { "when": { "path": "$.raised.screens.play.children.board.key" },
    "do": [ { "command": "set", "target": "$.data.game.player",
      "value": "{{ $.functions.host.step($.data.game.player, $trigger.key) }}" } ] }
}
```

## Decisions

- One `key` event with the key in its payload, not one event per key: the event vocabulary stays closed, and the
  `$.raised` path already gives logic each press.
- `random` stays pure. Determinism from a seed is what lets replicas agree; a random source that reads the clock or
  `Math.random` would differ between the browser and the authority.
- The key listener is in the `scene3d` controller (stateui-components), not in stateui-3d's runtime chunk, which has
  little room left under its size gate.
- Held-key state (a key that is down for a frame loop) waits for the frame loop gap.

## Rules and Constraints

- No key outside the closed list is taken; a key not in `keys` behaves as before.
- `random` reads nothing but its arguments.

## As built

- stateui-app: `seededRandom` and `random` in `LOGIC_FUNCTIONS` (`src/core/logic/values.ts`); README, "Values".
  Tests: `src/core/logic/logic.test.ts` ("values: random": the same value for a seed, whole numbers below n, an even
  spread over 4,000 seeds, JSON seeds and `null` for a bad seed or n).
- stateui-components: `keys` and the event `key` on `scene3d` (`scene3d.state.json`), the key names and the
  press test in `src/shared/scene3d/keys.ts`, the listener (on the host, in the capture phase), `tabindex` and
  `aria-keyshortcuts` in `scene3d.controller.ts`; README, "Keys". Tests: `src/shared/scene3d/keys.test.ts`,
  `test/graphics3d.test.ts`, `test/composites/scene3d-events.browser.test.ts` (with the real chunk: keys taken and
  raised, the `on.key` entry, a `$.raised` write per press, the camera left alone by a taken key and moved by another,
  Enter on a proxy button pressing the node, the `tabindex` given back).
- stateui-mcp: the `scene3d-behavior` guide topic (`src/infrastructure/mcp/guide.ts`).
