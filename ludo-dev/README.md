# `ludo-dev/` — scaffolding for the Ludo game

Working area for the Ludo feature described in
[`LUDO_IMPLEMENTATION_PLAN.md`](../LUDO_IMPLEMENTATION_PLAN.md).

`AttendanceTimeCheckerPlus.js` self-guards to a single portal URL, so iterating inside it
is slow. The engine is built and tested here first, then inserted into that file as one
reviewed diff.

```
node ludo-dev/verify-all.js              # every suite — 612 assertions
node ludo-dev/preview.js out.png fourplayer   # render a PNG of the board
start ludo-dev/ludo-harness.html         # play it
```

### Source — concatenated in this order at insertion time

| File | Purpose |
|---|---|
| `ludo-core.js` | Tables, state, rules, turn flow, modes, CPU. Written at the userscript's 4-space IIFE indent so it drops in verbatim. |
| `ludo-ui.js` | Pixel geometry, rendering, interaction, lifecycle (`initLudoGame` / `startLudoGame` / `resetLudoGame` / `cleanupLudoGame` / `endLudoGame`). |

Split because the engine outgrew one file. Everything is canvas-drawn — the ⛶ Max
modal relocates only the `<canvas>`, so a DOM HUD would disappear inside it.

### Tooling

| File | Purpose |
|---|---|
| `load.js` | Evaluates core + UI in a `Function` wrapper and exposes their internals plus test helpers (`place`, `tok`, `forceDice`). Neither source file has exports of its own — this is what makes the same code both drop-in-able and testable. |
| `canvas-stub.js` | Recording stand-in for `CanvasRenderingContext2D`; returns usable objects from `createLinearGradient` and `measureText` so draw code runs to completion. |
| `verify-all.js` | Runs every suite and prints one summary. Non-zero exit if any fails. |
| `preview.js` | Software rasterizer — renders the real `ludoRender()` output to a PNG with no native dependencies, so layout can be inspected without a browser. Scenarios: `fresh`, `midgame`, `fourplayer`, `gameover`, `rolling`, `recap`, `recap4p`, `pool`, `rot0`–`rot3`. |
| `fairness-check.js` | Answers "is the CPU cheating?" with numbers. 400 games, per-seat roll and six-rate counts, plus a two-proportion z-test. Exits non-zero if either side is measurably favoured. |
| `balance-check.js` | Answers the different question of how *one-sided the results* are: win rate with both seats identical, how often the loser gets 0/4, whether getting out first predicts winning, and what triple-six forfeits cost. |
| `ludo-harness.html` | The playable harness. Mimics the widget's ~330px game column, with mode/play/reset controls, live rule toggles, a state readout, ring-index overlay, a 0→56 token walk, a dice histogram and CPU-vs-CPU auto-play. |

### Suites

| Suite | Covers | Assertions |
|---|---|---|
| `ludo-verify.js` | Board geometry — ring closure, corner turns, home columns, safe squares, quadrants | 78 |
| `rules-verify.js` | Dice fairness, legal moves, every rule toggle, capture/safe behaviour, dice accumulation, pool spending, safe-square blocks, jumping blocks, match resolution, 400 random self-play games | 121 |
| `ai-verify.js` | Difficulty tiers, scorer priorities, threat awareness, 600-game head-to-head strength ordering | 36 |
| `modes-verify.js` | Mode cycling, active colour sets, turn order, CPU seats, reset-on-switch | 38 |
| `ui-verify.js` | Turn state machine, dice tumble, hop animation, turn clock, scale-aware pointer input, die-choice popover, roll recap, anti-farm guards, XP maths | 126 |
| `rotation-verify.js` | Board rotation: quadrants land where the setting promises, seats never collide, all 225 cells stay distinct and on-board, legal moves and ring indices are identical at every turn, hit-testing follows | 76 |
| `render-smoke.js` | `ludoRender()` across every mode and all 57 steps × 4 colours | 10 |
| `integration-verify.js` | Every wiring point in `AttendanceTimeCheckerPlus.js` — switcher cases, DOM ids, CSS, keyboard, bridges, XP, achievements, leaderboard columns — plus engine parity | 61 |
| `host-smoke.js` | **Executes the real userscript** under a minimal DOM: boots Ludo, plays a full PvCPU match, checks XP/achievements/cloud round-trip and both Max modals, board rotation | 66 |

`ui-verify.js` simulates time by pumping `ludoUpdate(dt)` instead of waiting on real
frames, so a full PvCPU match plays out in milliseconds and is deterministic.

`fairness-check.js` and `balance-check.js` are **not** in `verify-all.js` — they are
statistical rather than pass/fail, take a few seconds, and answer questions about game
feel rather than correctness. Run them by hand when someone asks whether the dice are
rigged; the answer is measured, not argued.

## Board geometry, in one paragraph

15×15 grid, 20px cells → a 300×300 board inside a **344×416** canvas: 58px HUD strips top
and bottom, 22px side margins, and an 8px wooden frame. A token's position is a single
integer `step`: `0–50` walk the 52-square shared ring starting at the colour's own
`startIndex` (0/13/26/39), `51–55` are its own five-cell home column, `56` is the centre.
Every colour therefore travels 51 shared squares and arrives at its own gate exactly one
step before turning inward.

Seats map to quadrants — Blue top-left, Red top-right, Green bottom-right, Yellow
bottom-left — and each player's chip sits in the strip on their side of the board. The
dice renders in whichever strip belongs to the player to move.

**The ring contains four diagonal steps** (pairs 4→5, 17→18, 30→31, 43→44). That is
correct — the track wraps the outer corner of each 6×6 base, e.g. `(6,5)→(5,6)` rounds
Blue's corner at `(5,5)`. Anything walking the ring cell-by-cell must tolerate it.

## Integration status

The engine is **already inserted** into `../AttendanceTimeCheckerPlus.js`, and
`integration-verify.js` asserts the copy there is byte-identical to the files here.
Edit the sources in this directory, re-run the suite, then re-insert — never patch the
userscript's copy directly, or the two will drift and that assertion will fail.

Note `host-smoke.js` needs Node 14+ (the userscript uses optional chaining, and the
default node here is 10). It finds a newer Volta node and re-execs itself automatically.

## Disposition

**Keep this directory.** The original plan floated deleting it once the feature landed,
but the parity assertion means it is no longer scaffolding: it is the source of truth for
the engine, and `integration-verify.js` + `host-smoke.js` are the only regression tests
covering the Ludo wiring *and* Pool's Max modal. Deleting it would leave 2,286 lines of
`AttendanceTimeCheckerPlus.js` with no tests at all.
