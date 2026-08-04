# `ludo-dev/` — scaffolding for the Ludo game

Working area for the Ludo feature described in
[`LUDO_IMPLEMENTATION_PLAN.md`](../LUDO_IMPLEMENTATION_PLAN.md).

`AttendanceTimeCheckerPlus.js` self-guards to a single portal URL, so iterating inside it
is slow. The engine is built and tested here first, then inserted into that file as one
reviewed diff.

| File | Purpose |
|---|---|
| `ludo-core.js` | The `// ═══ LUDO GAME ═══` block itself, written at the userscript's 4-space IIFE indent so it drops in verbatim. **This is the source of truth while building.** |
| `ludo-verify.js` | `node ludo-dev/ludo-verify.js` — headless assertions over the board tables and rules. Exits non-zero on failure. |
| `render-smoke.js` | `node ludo-dev/render-smoke.js` — drives `ludoRender()` against a recording 2D-context stub; catches typos and undefined refs without a browser. |
| `ludo-harness.html` | Open directly in a browser. 368×368 canvas, mode buttons, ring-index overlay, and a step 0→56 token walk with a live cell/ring/safe-square trace. |

## Board geometry, in one paragraph

15×15 grid, 20px cells → a 300×300 board centred in a 368×368 canvas, leaving 34px HUD
strips. A token's position is a single integer `step`: `0–50` walk the 52-square shared
ring starting at the colour's own `startIndex` (0/13/26/39), `51–55` are its own five-cell
home column, `56` is the centre. Every colour therefore travels 51 shared squares and
arrives at its own gate exactly one step before turning inward.

**The ring contains four diagonal steps** (pairs 4→5, 17→18, 30→31, 43→44). That is
correct — the track wraps the outer corner of each 6×6 base, e.g. `(6,5)→(5,6)` rounds
Blue's corner at `(5,5)`. Anything walking the ring cell-by-cell must tolerate it.

## Disposition

Delete this directory at Phase 11, **or** keep `ludo-verify.js` as a standing regression
test for the board tables. Decide when the feature lands; note the choice in the plan's
decision log.
