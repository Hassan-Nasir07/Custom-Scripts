# pool-dev

The 8-Ball Pool engine, kept outside `AttendanceTimeCheckerPlus.js` so it can be read,
diffed and tested on its own. The userscript carries a **verbatim copy** of
`pool-core.js` + `pool-ui.js`; `pool-verify.js` asserts the two are byte-identical.

**Edit the files here, never the copy in the userscript.** Editing the copy is how they
drift, and the drift is silent until the next reinsert refuses to run.

Work is tracked in [`POOL_V2_PLAN.md`](../POOL_V2_PLAN.md). As of Phase 0 these files
hold the *current* engine, moved unchanged. Phase 1 onwards replaces it.

```
node pool-dev/reinsert.js                 # splice pool-dev/ into the userscript
node pool-dev/reinsert.js --check         # exit 1 if the userscript copy differs
node pool-dev/pool-verify.js              # the pool suite
node pool-dev/physics-verify.js 2000      # the v2 physics, with a 2000-shot fuzz
node pool-dev/rules-verify.js 300         # the v2 rules, with 300 whole frames
node ludo-dev/verify-all.js               # every suite, pool included
node pool-dev/baseline-check.js 1000 1    # today's CPU vs scripted humans
node pool-dev/preview.js out.png all      # render the real canvas to a PNG
start pool-dev/pool-harness.html          # shoot and tune the v2 physics live
```

Everything needs Node 14+ because the userscript uses `??` and optional chaining. The
default `node` here is 10, so use the Volta image:

```
"$LOCALAPPDATA/Volta/tools/image/node/22.22.2/node.exe" pool-dev/pool-verify.js
```

## Files

| file | what it is |
|---|---|
| `pool-core.js` | state, constants, rack, physics, BCA turn rules, the CPU, `poolFireShot` |
| `pool-ui.js` | canvas rendering, the canvas HUD, mouse/touch input, the loop, lifecycle, `togglePoolMaximize` |
| `load.js` | evaluates both as one unit against a stub browser and returns the internals |
| `pool-verify.js` | the splice contract, host wiring, and headless engine checks |
| `baseline-check.js` | measures today's CPU; the bar the v2 hard tier has to clear |
| `preview.js` | renders `drawPoolFrame` to a PNG |
| `reinsert.js` | mechanical splice into `AttendanceTimeCheckerPlus.js` |
| `pool-physics.js` | **v2 physics** (Phase 1): table geometry, sliding/rolling ball model, cue strike, collisions, stepping. Pure and deterministic. **Not spliced yet**; it replaces the physics in `pool-core.js` when the new renderer lands |
| `physics-verify.js` | checks `pool-physics.js` against real ball behaviour, plus a fuzz for the invariants |
| `pool-harness.html` | live table running the real `pool-physics.js`: shoot with a drag, set spin, tune every constant with sliders, see trails and the shot's events |
| `pool-rules.js` | **v2 rules** (Phase 2): WPA 8-ball judged from the physics event log, seat-aware copy, cue-ball placement and re-spotting. Pure except the two table helpers. **Not spliced yet**, like the physics |
| `rules-verify.js` | one case per rule row, the rules on real shots, and a fuzz of whole frames |

## pool-rules.js

`prJudge(state, world, call)` reads a settled world and returns a verdict: the foul (if
any), whether the shooter plays on, who has ball in hand and where, any group
assignment, and the frame result. `verdict.next` is the state to play on. It mutates
nothing; the caller applies the table side:

- `prSpotBall(world, 8)` when `verdict.respot8` (the 8 dropped on the break)
- `prPlaceCue(world, x, y)` once a ball-in-hand spot passes `prCanPlace(world, x, y, zone)`,
  which refuses `'outside'`, `'kitchen'` or `'overlap'`

The judge works only from the log after the last `strike`: the first ball the cue ball
touched, cushion contacts (jaws count as cushion), and pots in the order they dropped.
Everything else, such as whether a seat is on the 8, is derived from the balls, so there
is no second copy of the table to drift. `prText(verdict, names)` gives the toast or the
frame result in the design's wording, naming whoever actually fouled; the name `'You'`
gets second-person grammar.

## pool-physics.js

The v2 engine uses a right-handed world frame: x right, **y up**, z up, in table units.
The playfield is 1000 × 500 with its origin at the centre and R = 14. The renderer flips y
for the screen.

A ball is always in one of four states, and each state has an exact closed form, so
balls are advanced analytically rather than integrated:

| state | what happens |
|---|---|
| sliding | the contact point slips. Cloth friction (μs) slows v and drives ω toward natural roll along a fixed slip direction, and ends after exactly 2\|u\|/(7 μs g) |
| rolling | no slip. Constant deceleration μr g |
| spinning | v = 0; only ω_z (English) remains, decaying at μsp |
| stationary | at rest |

Collisions are found by time of impact inside each of 4 sub-steps per 60 Hz frame and
resolved one at a time. Three details matter:

- **Touching clusters.** When a ball hits a group of balls that are touching each other,
  the contact itself is micro-simulated with stiff, damped springs. This is what makes a
  tight rack spread. One-pair-at-a-time resolution sends the whole impulse down the two
  edges of the triangle. Only the velocity change is kept.
- **Overlap sweep.** A straight-line time of impact can meet a decelerating ball up to
  ~0.015 u early. A sweep at the end of each sub-step separates any overlap and resolves
  it if the balls are still closing.
- **Pockets.** Each pocket is two jaws that run from the nose points to a capture circle.
  A ball drops when its centre enters the circle. A ball that somehow leaves the table
  is counted in `world.escapes`, which the fuzz asserts stays at zero.

The CPU (Phase 6) will call `ppCloneWorld` + `ppSimulate` to test shots, so it uses
exactly the game's physics. That fixes problem 5.

## What stays in the host

These are pool-related but live outside the sentinels, on purpose:

- **`toggleGameMaxModal`**, the shared Max modal. Ludo calls it too.
- **The storage helpers** `loadPoolHighScore` … `savePoolRecord`. The leaderboard's
  `collectGameModeBests` and the gist restore path read them, and neither is loaded with
  the pool block. `load.js` slices the real ones out of the userscript rather than
  stubbing them.
- **`prayerCount`**. It used to be declared in the middle of the pool state, but the
  Prayer Counter owns it.

## load.js

The same trick as `snake-dev/load.js`: both module files are indented blocks of the
userscript's IIFE body, so wrapping them in a `Function` makes one source both
drop-in-able and testable. Two differences:

- Host dependencies are passed as **parameters**, not globals, so two loads in one process
  never share stubs.
- Every top-level `let` gets a getter and setter, generated from the source, so tests can
  reach any piece of state without a hand-kept list.

`load({ seed })` replaces `Math.random` for that load only (mulberry32), which makes
racks, breaks and CPU decisions reproducible.

## pool-verify.js

It pins **today's** behaviour, bugs included. Assertions tagged *(problem N)* pin a
numbered problem from the plan and are meant to be rewritten when that problem is fixed.
The rewrite is the evidence that it was fixed.

## baseline-check.js

The human model is the CPU's own shot planner run for seat 1, then perturbed by Gaussian
aim and power error. Shot selection is identical on both sides, so the profiles differ
only in execution. Seat 1 always breaks, as it does in the current game.

## preview.js

It uses the software rasterizer from `ludo-dev/preview.js` (shared, not copied), plus
local patches for `scale`, `roundRect` and a no-op `clip`. The rasterizer is exact on
geometry but not on finish:

- strokes have no antialiasing and no dashes
- text uses a 3×5 bitmap font
- gradients flatten to their middle stop
- striped balls render as solid discs, because clip does nothing

Judge layout and colour from it, not polish. With no path given it writes to the OS temp
folder, so a bare run never leaves a PNG in the repo.

## The reinsert contract

`reinsert.js` finds the block between two sentinel comments:

```js
    // ═══ POOL ENGINE — generated from pool-dev/, do not edit here ═══
    …
    // ═══ END POOL ENGINE ═══
```

It refuses to write if either sentinel is missing, appears twice, or they are out of
order. It writes the block in whatever line ending the userscript already uses, so a
splice never leaves mixed endings.
