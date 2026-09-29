# pool-dev

The 8-Ball Pool engine, kept outside `AttendanceTimeCheckerPlus.js` so it can be read,
diffed and tested on its own. Since Phase 5 the userscript runs **v2**: it carries a
verbatim copy of the seven modules below (the *engine* block) and of `pool-theme.css`
(the *theme* block), and `pool-verify.js` asserts both are byte-identical.

**Edit the files here, never the copy in the userscript.** Editing the copy is how they
drift, and the drift is silent until the next reinsert refuses to run.

Work is tracked in [`POOL_V2_PLAN.md`](../POOL_V2_PLAN.md).

```
node pool-dev/reinsert.js                 # splice both blocks into the userscript
node pool-dev/reinsert.js --check         # exit 1 if either copy differs
node pool-dev/pool-verify.js              # the splice, the host wiring, the match headless, the CPU and its tiers
node pool-dev/host-run.js [dir]           # the REAL userscript in Chrome: boot, play, Max, themes, awards
node pool-dev/host-run.js --open          # the same fake portal in a visible Chrome, to play by hand
node pool-dev/physics-verify.js 2000      # the v2 physics, with a 2000-shot fuzz
node pool-dev/rules-verify.js 300         # the v2 rules, with 300 whole frames
node pool-dev/render-verify.js            # the v2 camera and renderer
node pool-dev/hud-verify.js               # the v2 HUD view model and theme contract
node pool-dev/snapshot.js [dir] [scene]   # real-Chrome PNGs of the prototype, every scene by default
node pool-dev/snapshot.js --check [dir]   # …plus an in-browser layout and theme audit per scene
start pool-dev/pool-table.html            # the widget's own controller on host stand-ins, plus design scenes
start pool-dev/pool-harness.html          # shoot and tune the v2 physics live
node pool-dev/balance-check.js 40         # the v2 CPU tiers vs scripted humans, beside v1's numbers
node pool-dev/v1/baseline-check.js 1000 1 # v1's CPU vs scripted humans: the bar the tiers are measured against
node ludo-dev/verify-all.js               # every suite, pool included
```

Everything needs Node 14+ because the userscript uses `??` and optional chaining;
`host-run.js` and `snapshot.js` need Node 22 (global `WebSocket` and `fetch`). The
default `node` here is 10, so use a newer one:

```
"C:/Program Files/nodejs/node.exe" pool-dev/pool-verify.js
```

## Files

The engine block is these seven, in this order (`load.js` `FILES`):

| file | what it is |
|---|---|
| `pool-physics.js` | the physics: table geometry, sliding/rolling ball model, cue strike, collisions, stepping. Pure and deterministic |
| `pool-rules.js` | WPA 8-ball judged from the physics event log, seat-aware copy, cue-ball placement and the ball-in-hand clamp. Pure except the table helpers |
| `pool-camera.js` | chase, broadcast, survey and 2D poses, projection, near-plane clipping, unprojection, and the director that eases between them. Pure |
| `pool-render.js` | the table, 3D pocket shafts, rolling balls, shadows, cue, physics-true guides, rings, ball in hand, pocket drops. Canvas only |
| `pool-hud.js` | `phModel` (pure view model), `phBuild` (compact or Max DOM), `phRender`, and the canvas theme bridge `phThemeTokens` |
| `pool-ai.js` | the CPU: four tiers on one planner (direct pots, banks, kicks, combos, safeties), every line checked on a cloned world with the real physics and rules, aim corrected for throw, position scored, noisy replays for risk, adaptive difficulty, time-sliced |
| `pool-game.js` | the controller: the match, input, the loop, the CPU's turn, XP and records, Max, theme, lifecycle. What the host calls |

The rest:

| file | what it is |
|---|---|
| `pool-theme.css` | the `--pool-*` tokens for Glassmorphic dark/light and Cyberpunk, the HUD's component CSS, and the Max frame; the theme block |
| `load.js` | evaluates the modules as they sit in the userscript: `physics()` … `ai()` for the pure layers, `game(opts)` for everything against a stubbed host |
| `reinsert.js` | mechanical splice of both blocks |
| `pool-verify.js` | the splice contract, the host wiring, the match headless (frames, clock, ball in hand, XP, the one-award guard), the CPU and its tiers, the Game mode sheet |
| `balance-check.js` | the tiers against v1's four scripted human models (the same method as `v1/baseline-check.js`); `POOL_TIER_TUNE` tries tier settings without editing `pool-ai.js` |
| `host-run.js` | serves a stand-in portal page over DevTools, runs the real userscript in it, and plays and audits pool inside the widget; in light mode it also audits text contrast (3:1) across the whole widget, every game, ⚙️ and Max |
| `physics-verify.js` | `pool-physics.js` against real ball behaviour, plus a fuzz for the invariants |
| `rules-verify.js` | one case per rule row, the rules on real shots, and a fuzz of whole frames |
| `render-verify.js` | the cameras against the design's own projection, unprojection, the director, the clipper, the guides, rasterizer frames |
| `hud-verify.js` | the HUD's view model against every design state, and the theme contract |
| `pool-table.html` | the prototype: `pool-game.js` itself (and the CPU) on stand-ins for the host (the storage helpers copied from it, `toggleGameMaxModal`'s build path), in a host-like panel, with the themes, the 316 px column, and scenes that set design states straight onto `poolS` for `snapshot.js`. It cannot drift from the widget |
| `snapshot.js` | drives `pool-table.html` in headless Chrome and saves each scene as a PNG; `--check` runs the page's HUD audit. `narrow:` scenes use the widget's 316 px column |
| `pool-harness.html` | a live table on the real physics: shoot with a drag, set spin, tune every constant |
| `v1/` | the v1 engine (`pool-core.js`, `pool-ui.js`) and its loader, frozen when v2 replaced it. `baseline-check.js` still measures v1's CPU, and `preview.js` still draws it |

## pool-game.js

The host calls six things, and reads four:

| host call | what it does |
|---|---|
| `initPoolGame()` | `switchGame` opened the panel: builds the HUD into `#pool-root` once, keeps a frame in progress, binds input, starts the loop |
| `poolDetach()` | `switchGame` left: stops the loop, drops pool's window listeners, closes Max. The frame stays |
| `resetPoolGame()` / `togglePoolMode()` | a fresh rack / Vs CPU ⇄ 2 Players |
| `togglePoolMaximize()` | the Max view through `toggleGameMaxModal`'s `cfg.build` hook |
| `poolOnThemeChange()` | from `applyPreferences` (theme, colour pickers, glass options) and pool's own `prefers-color-scheme` listener |
| reads `poolMode`, `poolGamesWon`, `poolRecord`, `poolMaximized` | the leaderboard, the achievement check, tests |

The match lives in one object, `poolS`. A frame is recorded once per rack (`rackId` against
`awardedRack`): Reset or a new frame is a new rack, and a finished rack cannot pay twice.
Pot XP follows today's rule until Phase 8 (yours against the CPU, both seats in 2 Players).
The shot clock (30 s) runs only while a human aims; it waits in ball in hand, in the
hand-off and on the CPU's turn. Escape cancels a power stroke and nothing else: the host's
Escape-resets-the-game shortcut no longer applies to pool.

Spin is free: `poolS.tip` is the cue tip in R (follow +y, right +x), clamped by
`phClampTip` to the physics' miscue radius (0.6 R). The dot on the SPIN control drags
directly; a click opens the picker (a big ball face and the presets): letting go of the
ball or taking a preset confirms and closes it; arrow keys nudge, Enter confirms. The tip resets to the centre after every shot.

The compact HUD is fluid. The widget's column is 400 px wide on big screens but 350 on
screens up to 1400 px (316 for the HUD), and full width when the layout stacks below
1200. The viewport keeps 368:412, the lean slider, power gauge and padlock are anchored to
its height (they land on the design's pixels at 368), below 360 px the camera toggle drops
its *AUTO* suffix and the card tag *BALL IN HAND* reads *IN HAND*, and the panel stops
growing at 420 px. Max is the design's fixed 1280 × 800, scaled to fit the window.

## pool-ai.js

One planner, four tiers (`PA_TIERS`). For a shot it:

1. lists candidates from geometry: every legal ball × pocket as a direct pot (ghost
   ball), and for the tiers that play them one-rail banks, one-rail kicks and two-ball
   combos. Each gets `p`, its make probability for the tier's own aim error (the cue's
   error times the cut's gain, `d / (2R cos cut)`, against the pocket's angular
   tolerance), and `rank`, the same for a steady player, which orders them
2. plays the best `top` out on a cloned world and judges each with `prJudge`, after
   correcting the aim for throw and squirt: it steps a copy to the first contact, reads
   the object ball's real departure and turns the cue by the error over the gain (this
   takes the median departure error from ~1.8° to ~0.02°)
3. tries the best `keep` survivors with the tier's spins and speeds and scores where the
   cue ball stops: the best next shot's rank (pro: the best two)
4. replays the top three with the tier's noise (`robust`) and marks down lines that foul
   or lose the frame when a little off
5. when no pot is likely enough (`safeBelow`), or none works, plays a safety or an escape
   (full and half-ball hits, one-rail kicks), also replayed for risk
6. adds the tier's execution noise

| tier | top · keep | spins | extra lines | aim σ (direct / other) | power σ | notes |
|---|---|---|---|---|---|---|
| easy | 4 · 1 | stun | – | 1.2° / 1.8° | 12% | no position, no safeties |
| normal | 10 · 3 | stun, follow, draw | banks | 0.5° / 0.8° | 6% | 1-ball position |
| hard | 20 · 4 | + left, right | banks, kicks, combos | 0.2° / 0.4° | 2% | 1-ball position; calibrated to beat v1 |
| pro | 24 · 5 | + the four diagonals | banks, kicks, combos | 0 / 0.15° | 0.25% | 2-ball position; calls every shot, both seats |

Adaptive (`paAdaptiveTier`) follows your record against the CPU (`poolCpuRecord`): under
5 frames Normal, under 35% Easy, over 65% Hard, and never Pro, which changes the rules for
you. A pin (`userPreferences.poolDifficulty`, in ⚙️ and the Game mode sheet) wins. The tier
is locked when a frame starts (`poolCpuTier`); a new pick applies at once only before
the break. `balance-check.js` has the measured win rates.

## pool-camera.js and pool-render.js

The chase camera is the design's, number for number. `render-verify.js` runs the
design's own `toCam`/`toScr` beside ours and they agree to 1e-9 px. One thing differs
on purpose: the design's world frame is left-handed, so its 3D view is the mirror image
of its 2D view. Ours is not mirrored, so the table's right side is on your right in both
cameras, and English goes the way it looks.

With the shot camera on *Stay 3D*, the director stands up into `pcSurvey` while balls
run: the shot's heading at a 58° pitch, with the distance fitted so the whole table (rails
and apron) sits inside the viewport clear of the top overlays. Upright poses blend as an
orbit around the look point, so the camera swings round to a new aim instead of cutting
across the table.

The renderer paints only polygons. The pocket shafts and the ball markings are clipped
with a convex polygon clipper, not `ctx.clip()`, so a frame also draws on the headless
rasterizer. Ball markings come from the physics quaternion: stripes and number discs are
spherical caps projected onto the disc, so they tumble as the ball rolls.

The guides run the real physics on a cloned world: the cue ball's line to first contact
(squirt included), the object ball's line off it (throw included), and the cue ball's
own path after contact, so draw bends back and follow runs through. After contact the
clone keeps only the cue ball: 1.4 ms on a full rack, 0.4 ms mid-frame.

Judge the look with `snapshot.js` or `host-run.js` (real Chrome). The rasterizer flattens
gradients, so its frames prove geometry and layer order, not finish.

## pool-rules.js

`prJudge(state, world, call)` reads a settled world and returns a verdict: the foul (if
any), whether the shooter plays on, who has ball in hand and where, any group
assignment, and the frame result. `verdict.next` is the state to play on. It mutates
nothing; the caller applies the table side:

- `prSpotBall(world, 8)` when `verdict.respot8` (the 8 dropped on the break)
- `prPlaceCue(world, x, y)` once a ball-in-hand spot passes `prCanPlace(world, x, y, zone)`,
  which refuses `'outside'`, `'kitchen'` or `'overlap'`. Run a drag through
  `prClampPlace(world, x, y, zone)` first: it holds the spot on the felt and, for
  `'kitchen'`, behind the head string, so only `'overlap'` can come back

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

## What stays in the host

These are pool-related but live outside the sentinels, on purpose:

- **`toggleGameMaxModal`**, the shared Max modal. Ludo uses its canvas path; pool uses the
  `cfg.build` path, which hands it an empty panel and moves no canvas.
- **The storage helpers** `loadPoolHighScore` … `savePoolRecord`. The leaderboard's
  `collectGameModeBests` and the gist restore path read them, and neither is loaded with
  the pool block. `load.js` slices the real ones out of the userscript rather than
  stubbing them.
- **The panel markup**: `#pool-scoreboard` (the header's wins button), `#pool-root` (the
  HUD is built in here) and an empty `#pool-controls` (pool's footer is part of the HUD).
- **The ⚙️ options** *Pool Table Color* and *Pool Shot Camera* (`userPreferences.poolTableColor`,
  `poolShotCam`), and the defaults for `poolCamera` and `poolLean`, which the HUD writes.
- **`prayerCount`**. It used to be declared in the middle of the pool state, but the
  Prayer Counter owns it.

## The reinsert contract

`reinsert.js` finds each block between its two sentinel comments:

```js
    // ═══ POOL ENGINE — generated from pool-dev/, do not edit here ═══
    …
    // ═══ END POOL ENGINE ═══

            /* ═══ POOL THEME — generated from pool-dev/pool-theme.css, do not edit here ═══ */
            …
            /* ═══ END POOL THEME ═══ */
```

It refuses to write if a sentinel is missing, appears twice, or the pair is out of order.
The theme block sits inside the `modernStyles` template literal, right after the
Cyberpunk theme, so a backtick, `${` or an unbalanced brace in `pool-theme.css` is
refused before anything is written. Each block is written in whatever line ending the
userscript already uses, so a splice never leaves mixed endings.
