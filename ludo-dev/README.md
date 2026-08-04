# `ludo-dev/` — scaffolding for the Ludo game

Working area for the Ludo feature described in
[`LUDO_IMPLEMENTATION_PLAN.md`](../LUDO_IMPLEMENTATION_PLAN.md).

`AttendanceTimeCheckerPlus.js` self-guards to a single portal URL, so iterating inside it
is slow. The engine is built and tested here first, then inserted into that file as one
reviewed diff.

```
node ludo-dev/verify-all.js     # every suite — 237 assertions
```

| File | Purpose |
|---|---|
| `ludo-core.js` | The `// ═══ LUDO GAME ═══` block itself, written at the userscript's 4-space IIFE indent so it drops in verbatim. **This is the source of truth while building.** |
| `load.js` | Evaluates `ludo-core.js` in a `Function` wrapper and exposes its internals plus test helpers (`place`, `tok`). The core has no exports of its own — this is what makes the same source both drop-in-able and testable. |
| `verify-all.js` | Runs every suite below and prints one summary. Non-zero exit if any suite fails. |
| `ludo-verify.js` | Board geometry — ring closure, corner turns, home columns, safe squares, quadrants. **78 assertions.** |
| `rules-verify.js` | Dice fairness, legal moves, every rule toggle, capture/safe behaviour, turn flow, match resolution, plus 400 random self-play games. **75 assertions.** |
| `ai-verify.js` | Difficulty tiers, scorer priorities, threat awareness, and a 600-game head-to-head proving the tiers are ordered by strength. **36 assertions.** |
| `modes-verify.js` | Mode cycling, active colour sets, turn order, CPU seats, reset-on-switch. **38 assertions.** |
| `render-smoke.js` | Drives `ludoRender()` against a recording 2D-context stub; catches typos and undefined refs without a browser. **10 assertions.** |
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
