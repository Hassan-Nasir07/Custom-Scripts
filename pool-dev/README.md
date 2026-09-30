# pool-dev

The 8-Ball Pool engine, kept outside `AttendanceTimeCheckerPlus.js` so it can be read,
diffed and tested on its own. Since Phase 5 the userscript runs **v2**: it carries a
verbatim copy of the nine modules below (the *engine* block) and of `pool-theme.css`
(the *theme* block), and `pool-verify.js` asserts both are byte-identical.

**Edit the files here, never the copy in the userscript.** Editing the copy is how they
drift, and the drift is silent until the next reinsert refuses to run.

Work is tracked in [`POOL_V2_PLAN.md`](../POOL_V2_PLAN.md). **Snooker** (its *Snooker* section,
Phases S0–S7) is being built on the same engine: one controller, HUD and renderer for both
games, with what differs in one profile per game (`POOL_GAMES` in `pool-game.js`).

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
node pool-dev/tour-verify.js              # the tournament model: brackets, seeding, byes, breaks, saves, the cabinet
node pool-dev/snooker-verify.js           # snooker; first, pool's fingerprints from main (pool unchanged)
node pool-dev/pool-fingerprint.js         # print pool's fingerprints: table, breaks, shots, verdicts, CPU, draw calls, frames
node pool-dev/sync-verify.js              # the sync bot's script from github-actions-bot/, run headless
node pool-dev/snapshot.js [dir] [scene]   # real-Chrome PNGs of the prototype, every scene by default
node pool-dev/snapshot.js --check [dir]   # …plus an in-browser layout and theme audit per scene
node pool-dev/theme-verify.js [--quick]   # every state × theme, shape and preset: layout, WCAG AA text contrast, live theme switch
node pool-dev/perf-check.js               # frame cost (3D and 2D, the 316 px column) and the FPS cap, in Chrome
start pool-dev/pool-table.html            # the widget's own controller on host stand-ins, plus design scenes
start pool-dev/pool-harness.html          # shoot and tune the v2 physics live (?preset=snooker for snooker's table)
start "" "pool-dev/pool-table.html?game=snooker"   # snooker in the widget's own controller and HUD (Vs CPU or 2 Players)
start "" "pool-dev/pool-table.html?look=snooker"   # snooker's table alone, the design's stills (S1)
node pool-dev/balance-check.js 40         # the v2 CPU tiers vs scripted humans, beside v1's numbers
node pool-dev/snooker-balance.js 20       # snooker's CPU tiers vs scripted humans, against the plan's bands (15 reds)
node pool-dev/snooker-break-tune.js       # searches the snooker break-off scripts (PA_SN_BREAKS); rerun when the rack or physics changes
node pool-dev/v1/baseline-check.js 1000 1 # v1's CPU vs scripted humans: the bar the tiers are measured against
node ludo-dev/verify-all.js               # every suite, pool included
```

Everything needs Node 14+ because the userscript uses `??` and optional chaining;
`host-run.js` and `snapshot.js` need Node 22 (global `WebSocket` and `fetch`). The browser
tools find Chrome, else Edge (`browser.js`; `POOL_BROWSER` overrides). The
default `node` here is 10, so use a newer one:

```
"C:/Program Files/nodejs/node.exe" pool-dev/pool-verify.js
```

## Files

The engine block is these ten, in this order (`load.js` `FILES`):

| file | what it is |
|---|---|
| `pool-physics.js` | the physics: table geometry, sliding/rolling ball model, cue strike, collisions, stepping. Pure and deterministic |
| `pool-rules.js` | WPA 8-ball judged from the physics event log, seat-aware copy, cue-ball placement and the ball-in-hand clamp. Pure except the table helpers |
| `pool-snooker.js` | snooker's table (POOL_V2_PLAN.md, *Snooker*): `PS_TABLE` at true scale on the design's pockets (`ppBuildRoundedTable`: straight noses, a rounded nose of radius 6 as an arc collider and a straight jaw at every end, the design's revision 1790749498-5862), the ball ids and values, the spots and markings, `psCreateWorld`, `psRack` for 15 / 10 / 6 reds. **The rules** (S2), pure as pool's are: `psNewFrame`, `psJudge` (a verdict and the next frame from the physics log), `psApplySpots`, `psChoose` (play / put back / free ball), `psTimeout`, `psConcede`, `psStatus` (the ball on, nominations, points remaining, snookers required), `psSnookered`, `psSpotPositions`, and the copy (`psText`, `psChoiceText`, `psChoiceNotice`) |
| `pool-tour.js` | the tournament model: brackets for 3–16 players (byes to the top seeds, the standard seeding order, a reproducible shuffle), advancement, who breaks, frame recording, save validation and the trophy cabinet. Pure; per game (`t.game`, settings normalised by `ptSettings`, a save resumed only by its own game), snooker keeping each frame's points and the match's high break, and `ptRaceText` (race to N, or best of 2N − 1 in snooker) |
| `pool-camera.js` | chase, broadcast, survey and 2D poses, projection, near-plane clipping, unprojection, and the director that eases between them. Pure |
| `pool-render.js` | the table, 3D pocket shafts, rolling balls, shadows, cue, physics-true guides, rings, ball in hand, pocket drops. Canvas only |
| `pool-hud.js` | `phModel` (pure view model), `phBuild` (compact or Max DOM), `phRender`, and the canvas theme bridge `phThemeTokens` |
| `pool-tour-ui.js` | the tournament's screens (setup, bracket compact and full, match intro, result, champion, cabinet) and dialogs (resume, abandon, pause) as HTML, and one overlay per HUD that re-renders only when the controller's key changes |
| `pool-snooker-ai.js` | snooker's CPU (S4) on `pool-ai.js`'s helpers: candidates by the ghost ball with snooker's measured pocket tolerances, each played out and judged by `psJudge` (nominating and calling as it pots), scored in points expected (p·(points + γ·position) − the leave on a miss − fouls), noisy replays, safeties by the opponent's leave (a snooker a bonus), pool's sweep when snookered, a tuned break-off script per reds count, the choice after a foul, placement in the D, conceding by tier; each tier caps its trials (easy 14 … pro 120) and it thinks in 6 ms slices |
| `pool-ai.js` | the CPU: four tiers on one planner (direct pots, banks, kicks, combos, safeties), every line checked on a cloned world with the real physics and rules, aim corrected for throw, position scored, noisy replays for risk, adaptive difficulty, time-sliced |
| `pool-game.js` | the controller: the match, input, the loop, the CPU's turn, XP and records, Max, theme, lifecycle. What the host calls |

The rest:

| file | what it is |
|---|---|
| `pool-theme.css` | the `--pool-*` tokens for Glassmorphic dark/light and Cyberpunk, the HUD's component CSS, and the Max frame; the theme block |
| `load.js` | evaluates the modules as they sit in the userscript: `physics()` … `ai()` for the pure layers, `game(opts)` for everything against a stubbed host |
| `reinsert.js` | mechanical splice of both blocks |
| `pool-verify.js` | the splice contract, the host wiring, the match headless (frames, clock, ball in hand, XP, the one-award guard), the CPU and its tiers, the Game mode sheet, tournaments in the match (setup to champion, pause, leave, reload and resume, corrupt saves) |
| `snooker-balance.js` / `snooker-break-tune.js` | snooker's tiers against scripted humans (win rate, mean break, centuries and 147s per 100 frames, fouls per visit, think time) marked against the plan's bands, `SNOOKER_TIER_TUNE` to try settings; and the offline search for the break-off scripts |
| `balance-check.js` | the tiers against v1's four scripted human models (the same method as `v1/baseline-check.js`); `POOL_TIER_TUNE` tries tier settings without editing `pool-ai.js` |
| `host-run.js` | serves a stand-in portal page over DevTools, runs the real userscript in it, and plays and audits pool inside the widget; in light mode it also audits text contrast (3:1) across the whole widget, every game, ⚙️ and Max |
| `snooker-verify.js` | snooker. §0: pool's fingerprints, taken on `main` before any snooker code, must match exactly. §1 the table; §2–6 the rules: a row per ruling, the snookered test, real shots, a scripted 147 and a free-ball 155, and whole frames fuzzed with invariants |
| `pool-fingerprint.js` | digests of what pool does: `ppBuildTable`, 20 seeded breaks, 50 shots and their verdicts, the four tiers' plans on 10 positions, the draw calls of 12 scenes (a recording canvas, so no browser), and three whole frames through the controller with their XP and records |
| `browser.js` | the Chromium the browser tools drive: Chrome, else Edge, or `POOL_BROWSER` |
| `tour-verify.js` | `pool-tour.js`: every size from 3 to 16, bye placement, seeding, advancement, breaks, the shuffle, validation, the cabinet |
| `physics-verify.js` | `pool-physics.js` against real ball behaviour, plus a fuzz for the invariants |
| `rules-verify.js` | one case per rule row, the rules on real shots, and a fuzz of whole frames |
| `render-verify.js` | the cameras against the design's own projection, unprojection, the director, the clipper, the guides, rasterizer frames |
| `hud-verify.js` | the HUD's view model against every design state, and the theme contract |
| `pool-table.html` | the prototype: `pool-game.js` itself (and the CPU) on stand-ins for the host (the storage helpers copied from it, `toggleGameMaxModal`'s build path), in a host-like panel, with the themes, the 316 px column, and scenes that set design states straight onto `poolS` for `snapshot.js`. It cannot drift from the widget. *Game* switches through `poolSetVariant` as ⚙️ Cue Game does; `?game=snooker&scene=…` sets the snk* states (red, nominate, foul, free, snookers, concede, colours, century, respot, win, loss) |
| `snapshot.js` | drives `pool-table.html` in headless Chrome and saves each scene as a PNG; `--check` runs the page's HUD audit. `narrow:` scenes use the widget's 316 px column |
| `pool-harness.html` | a live table on the real physics: shoot with a drag, set spin, tune every constant. *Preset* picks pool's table or snooker's (`?preset=snooker`: its knobs, *Reds*, a break-off, and *Acceptance*, the pocket windows) |
| `v1/` | the v1 engine (`pool-core.js`, `pool-ui.js`) and its loader, frozen when v2 replaced it. `baseline-check.js` still measures v1's CPU, and `preview.js` still draws it |

## pool-game.js

The host calls six things, and reads four:

| host call | what it does |
|---|---|
| `initPoolGame()` | `switchGame` opened the panel: builds the HUD into `#pool-root` once, keeps a frame in progress, binds input, starts the loop |
| `poolDetach()` | `switchGame` left: stops the loop, drops pool's window listeners, closes Max. The frame stays |
| `resetPoolGame()` / `togglePoolMode()` | a fresh rack (refused in a tournament frame) / Vs CPU ⇄ 2 Players (from a tournament match: back to the mode before it) |
| `togglePoolMaximize()` | the Max view through `toggleGameMaxModal`'s `cfg.build` hook |
| `poolOnThemeChange()` | from `applyPreferences` (theme, colour pickers, glass options) and pool's own `prefers-color-scheme` listener |
| reads `poolMode`, `poolGamesWon`, `poolRecord`, `poolMaximized` | the leaderboard, the achievement check, tests |

**Games.** Everything the controller asks of a game is in its profile in `POOL_GAMES`: the
table and rack, the rules (`newFrame`, `status`, `judge`, `apply`, `timeout`, `text`, `legal`,
placement), the CPU, the storage keys, what a frame pays (`frameXP`, `potXP`) and how it is
filed (`fileResult`, `wins`), and its name. `poolRules()` is the profile of `poolS.game`, and
`poolUseGame(game)` switches the table config, camera and cache to it. Nothing outside
`POOL_GAMES` names a game's rules, CPU or storage (`pool-verify.js`, *Game seam*). The HUD
gets the shooter's status from the controller, and the renderer and HUD dots get ball
colours from `pgBallLook(game, id)`; sizes drawn round a ball scale by R/14, so pool's are
unchanged.

Snooker's profile (S3) adds what only it has: `prime` (the balls touching the cue ball, before
the strike), `choose` / `choices` / `choiceNotice` (the choice after a foul, phase `'choice'`),
`concede`, `resultText` (the dialog's sentence, score and high break), `keys.frame` (the quick
frame kept for a reload), `rackPref`, `aimClear` and its aim steps. `poolSetVariant(game)`
parks the frame on the table (`poolSnapshotTable`) and restores the other game's; each game keeps
its own tournament state. The HUD's snooker parts (`phSnookerModel`) are the score and third
line on the cards, the tracker row, the colour chips, the toast's choice buttons, the dialog's
stats and the concede question, all built for pool too and hidden there. Once a colour is
nominated the chips fold to that one chip and the caption; pressing it opens the six again
(`poolS.chipsOpen`).

**Out of the way of the shot** (both games). Each frame `poolShotPath(view)` projects the
shot to view pixels: the aim line from the cue ball to the first contact, the object ball's
path on to the pocket it is heading for (else to the cushion), and as circles the contact,
the object ball and that pocket. `phShy` marks every corner overlay it passes under
(`data-shy`: camera toggle, pill, lean, spin, hint, call card, chips, Move cue ball) and
the theme fades it to 0.22; it stays a working control. In 3D it comes back while the
pointer is on it (3D aim follows the mouse's movement); in 2D the pointer is the aim, so
it stays see-through. A prompt still waiting on the player (the open chips, the call card
before a pocket) never fades. `pool-table.html?pot=0..5&cut=` sets up a pot into any pocket
for the audit, which checks exactly the overlays over the shot fade.

**Max keeps them off the table.** In Max the table sits between two bars (`--ph-bar-t` 60 px,
`--ph-bar-b` 68 px; the canvas is sized between them and `poolFit` measures it): the camera
toggle and the pill above; spin, Move cue ball (centred), and the hint, the six chips in a
row or the call card in a row below. Only the lean slider and the power gauge stay on the
table. Anything placed in canvas pixels on the layer (the ball-in-hand note) is offset by
the top bar, and `phShy` works in canvas pixels. That is ⚙️ *Max View*'s *Table between bars*
(`data-bars` on the HUD); its default, *Full table*, keeps the design's 1232 × 672 table and
puts the overlays on the long cushions between the corner and middle pockets.

⚙️ *Aim Guide* (Long / Medium / Short) sets how far the object ball's line runs (150 / 100 / 60
u, `scene.guideLen`). **Snooker's call pocket** is a frame rule, `frame.call`: `'off'`,
`'colours'` (reds are not called) or `'all'`; a ball on potted with none in the pocket called
is the foul `wrongPocket`. Each profile's `lockCall(frame, tier)` sets the call rule when the
tier locks (pool: call every shot at Pro; snooker: a picked Hard calls the colours, Pro every
ball, and a tournament its own), and `tourDefaults.calls` lists the tournament's choices.

The match lives in one object, `poolS`. A frame is recorded once per rack (`rackId` against
`awardedRack`): Reset or a new frame is a new rack, and a finished rack cannot pay twice.
XP (Phase 8): a CPU win pays 60 / 80 / 100 / 120 by the tier locked for the frame and a loss
15; 2 Players pays Player 1 80 / 15; a tournament pays the YOU seat 80 / 15 per match. Pot
XP (+5) is for your pots against the CPU only. CPU wins are also filed by tier
(`poolWinsByTier`), which the tier boards, the wins button and *Called It* read.
The shot clock (30 s) runs only while a human aims; it waits in ball in hand, in the
hand-off and on the CPU's turn. Escape cancels a power stroke and nothing else: the host's
Escape-resets-the-game shortcut no longer applies to pool.

Spin is free: `poolS.tip` is the cue tip in R (follow +y, right +x), clamped by
`phClampTip` to the physics' miscue radius (0.6 R). The dot on the SPIN control drags
directly; a click opens the picker (a big ball face and the presets): letting go of the
ball or taking a preset confirms and closes it; arrow keys nudge, Enter confirms. The tip resets to the centre after every shot.

The cards' trackers dim a group's balls as they drop, whoever potted them. While the table
is open, each card instead lists the balls that player has potted this frame (`poolS.pots`,
the break's included; the 8 is left out as it re-spots). Calling a pocket says each thing
once: the pill gives the state (*On the 8*), and in 3D one call card in the hint's corner
(bottom right, the near rail in the chase camera) holds the pocket map and the hint's line
(*Tap a pocket*, *Drag to shoot*, *Release · 62%*). While it shows, the power gauge steps up
over it and Move cue ball goes bottom left; it steps aside for the spin picker. 2D has no
card: every pocket is on screen, and the hint names the call.

The compact HUD is fluid. The widget's column is 400 px wide on big screens but 350 on
screens up to 1400 px (316 for the HUD), and full width when the layout stacks below
1200. The viewport keeps 368:412, the lean slider, power gauge and padlock are anchored to
its height (they land on the design's pixels at 368), below 360 px the camera toggle drops
its *AUTO* suffix and the card tag *BALL IN HAND* reads *IN HAND*, and the panel stops
growing at 420 px. Max is the design's fixed 1280 × 800, scaled to fit the window.

### Tournaments

`poolMode` is `'tour'` only while a tournament match is on the table; the bracket itself
(`poolS.tour.t`) outlives that, so you can leave for quick play and come back. The
Game mode sheet's Tournament tab sets one up or resumes it; the screens and dialogs
(`pool-tour-ui.js`) cover the panel and stop the clock, the CPU and every input under
them.

- **Seats.** A match's upper line is seat 1, the lower seat 2; the cards read *Seed n*.
  The lower seed breaks the first frame, then breaks alternate, and every seat change
  (a new frame included) shows the hand-off.
- **Table settings** come from setup: the shot clock (30 s, 45 s or off), the guideline
  (full, short, off) and call pocket (8 only, every shot). Leaving puts quick play's back.
- **Recording.** A frame goes into the bracket (`ptRecordFrame`), not into the quick-match
  records, XP or the CPU record (tournament XP is Phase 8). A won match waits 1.1 s for the
  last pot, then shows its result; the final fills the trophy cabinet.
- **Saving.** `localStorage.poolTournament` holds the bracket, rewritten after every frame,
  with a snapshot of the table (balls, rules state, clock) after every shot, and when the
  panel is left. A finished tournament is removed. The first `initPoolGame` of a page
  offers a saved one back; a corrupt or other-version save is dropped behind a toast, and a
  damaged snapshot restarts the frame. `poolTrophyCabinet` keeps titles by name (trimmed,
  lowercased) and the last 20 tournaments.
- **Pause** stops the clock; *Leave for now* keeps the match saved and goes back to quick
  play.

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
   (full and half-ball hits, one-rail kicks), also replayed for risk (`robust`, pro's
   `robustSafe`)
6. when nothing pots and no safety is legal (snookered), hard and pro `sweep`: the cue turns
   all the way round in 1° steps, each stepped to its first contact only; the gaps where
   that is a legal ball are kept and the middle of each (the angle that forgives the most
   aim error) is played out. The old last resort, a blind roll at the nearest legal ball,
   fouled 53 times in 62 for hard and 44 in 46 for pro
7. adds the tier's execution noise

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

Frame cost (Phase 9, `perf-check.js`, software canvas so an upper bound): a full 3D repaint
while aiming ~1.8 ms median, 3.5 p95; a rolling shot ~0.7 ms; an unchanged frame ~0. Two
things made it: while the camera moves the table is drawn straight to the screen instead
of into its cache and then copied (the cache is rebuilt once the pose holds), and ball
numbers are small cached images (`pgDigit`) rather than text drawn every frame.

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

## The sync bot

The leaderboard's gist is written by a GitHub Action in its own repository, checked out
beside this one as `github-actions-bot/`. `sync-verify.js` lifts its inline script out of
`sync.yml` and runs it headless: the `gameModeBests` merge the tier boards depend on (shape,
per-key max, the tier-win bound), and the gates that were already there. The bot has to be
pushed before a client that emits `pool:{easy,normal,hard,pro}` goes out.

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
