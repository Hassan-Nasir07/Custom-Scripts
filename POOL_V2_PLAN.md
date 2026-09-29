# 8-Ball Pool v2 and Snooker: 3D table, real physics, tournament mode

> **Living document.** Tick the boxes in **Progress** as work lands and record every
> deviation in the **Decision log** at the bottom. Attach this file as context in later
> sessions.
>
> Status: **Pool v2 `DONE`**: Phases 0–9 complete and merged to `main` (PR #14, `6c6af10`), v9 in the userscript ·
> **Snooker `IN PROGRESS`**: S0 (the seam), S1 (the table), S2 (the rules) and S3 (the controller, HUD and ⚙️ switch) done; Phases S0–S7 in [*Snooker*](#snooker-the-second-game-on-the-v2-table-phases-s0s7), sharing this table, engine block, panel and harnesses with pool ·
> Last updated: 2026-09-30 · Branch: `feat/snooker` (from `main`); v2 was built on `feat/pool-v2` (from `feat/cyberpunk-hud-rework`)

## Context

Pool is the oldest board-style game in `AttendanceTimeCheckerPlus.js`, and it looks it:

- The table is flat 2D and fills only half the 368×368 canvas (184px tall). The other half
  is HUD drawn on the canvas.
- The physics is a per-frame velocity multiplier with hacks layered on to fake spin.
- The CPU is one near-perfect tier.
- There is no tournament mode.

This plan covers three things:

1. **Visuals.** Follow the **layout, components and interactions** of the Claude Design
   canvas *"8-Ball Pool, compact panel, both cameras"*
   ([design](https://claude.ai/artifact/F7VD7gEuEFbWNNuqYVCPMs), 29 artboards; inventory
   below). **Colour, type and shape come from the widget's existing theme presets,
   Glassmorphic Aurora and Cyberpunk HUD, not from the design's amber palette.** See
   *Theme mapping*.
2. **Gameplay feel.** Replace the physics, rules and CPU with models that behave like real
   pool.
3. **Tournament mode.** An offline single-elimination bracket, in the style of Miniclip's
   8 Ball Pool tournaments. You pick the number of contestants (**humans only**, playing
   hot-seat on one machine), the app builds the tree, and players advance round by round.

Pool is ~3,000 lines at [AttendanceTimeCheckerPlus.js:1749-4762](AttendanceTimeCheckerPlus.js#L1749-L4762)
(state, physics, rules, AI, render, input, lifecycle, shared Max modal). The rest of it is
spread around the file:

- storage at [:511-541](AttendanceTimeCheckerPlus.js#L511-L541)
- XP at [:10982](AttendanceTimeCheckerPlus.js#L10982)
- game switching at [:9925](AttendanceTimeCheckerPlus.js#L9925) and [:10000](AttendanceTimeCheckerPlus.js#L10000)
- panel HTML at [:19649](AttendanceTimeCheckerPlus.js#L19649), [:19681](AttendanceTimeCheckerPlus.js#L19681) and [:19757](AttendanceTimeCheckerPlus.js#L19757)
- CSS at [:16464](AttendanceTimeCheckerPlus.js#L16464)
- table-colour swatches at [:17620](AttendanceTimeCheckerPlus.js#L17620)

---

## What the design specifies

The design's graphite and amber palette and its Chakra Petch/Sora type are **not used**
(user decision, 2026-09-25). They are replaced role by role in *Theme mapping* below.
Everything else in this table is followed.

| Element | Spec (from the artboards) |
|---|---|
| Materials (theme-independent) | felt radial `#2E8F70 → #1D6E55 → #114534`; wood rail `#7A4B2C → #553220 → #3A2116`; cushion `#185F4B`; apron `#26160E`; pocket `#030404` inside a `#1A1410` rim; diamonds `#E9DDBF`. The table is a physical object, so it looks the same in every theme. The table-colour preference still tints the felt |
| Ball colours (theme-independent) | 1 `#E9B825` · 2 `#2457C5` · 3 `#D2352B` · 4 `#6A3FA0` · 5 `#EE7A2E` · 6 `#1F8A4C` · 7 `#8C2A20` · 8 `#141516`; stripes use an ivory band 27–73% |
| World | playfield 1000×500 units, origin at centre, z up; `R=14`, cushion 12, rail 36, rail top z=16; corner pocket r=27, side pocket r=24; spots at x=±250 |
| 3D camera | a chase camera behind the cue ball along the aim. **Lean** 0–100 maps to pitch 19.5°→48° and distance 110→420, focal length `1.1·H`, near-plane clip at z=4 |
| 2D camera | orthographic top-down, fitted with an 8px margin |
| Compact panel (400×640) | header (logo, title, trophy pill) → player cards (72px: name, `TO SHOOT` tag, W·L, 7-ball group tracker) with a `0–0 FRAMES` centre → **table viewport 368×412** → 3 buttons (Vs CPU / Reset / Max). **There is no Play button.** |
| On-table overlays | 2D/3D segmented toggle (top-left); group pill (top-right); vertical **LEAN** slider (3D only, left); vertical power gauge (right); **SPIN** button with a cue-ball dot (bottom-left); hint pill (bottom-right) |
| Input | 3D: horizontal mouse movement rotates the aim (0.3°/px). 2D: point to aim. Both: press, drag for power (distance/1.4 → %), release to shoot, and the cue snaps forward over 260ms |
| Aim guides | dashed aim line → dashed ghost ball → object-ball path in the felt accent (150u) + faint cue-deflection path (90u); rail bounce preview when no ball is hit |
| Cue | chalk `#3E73B8` → ferrule → shaft `#DDB77F` → joint `#C9A15A` → wrap `#1B1C1D` → butt `#3B1F14`, tapering 3.3→8 wide, butt raised 60u. Pull-back is `8 + power·1.1` |
| Max (1280×800) | player cards + frames centred in the header; controls on the right; table 1232×672; spin control 72px |

### Artboard inventory

Most in-match states are one component, `InMatch.dc.html`, switched by a `variant` prop.
`Table.dc.html` grew `layout`, `bih`, `kitchen`, `pockets`, `called` and `onCall`.

| Artboard | Implements | Details the code must match |
|---|---|---|
| `Main`, `PanelTopDown`, `Max` | the compact panel in both cameras; the full view | the table above |
| `Table` | the renderer | pocket rings are projected circles at `r+12`. Pockets outside the 3D view are still callable through the mini-map |
| `BracketTree` | the bracket renderer (4/8/16, full or `mini`) | column = `(W − 188 − rounds × 40) ÷ rounds`; card height = `min(64, slot − 12)`; champion column 188px (78px mini); connector elbows at the gutter midpoint; completed path drawn as a separate highlighted path |
| 1 `ModeSheet` | a bottom sheet (432px high) over a scrim | three modes (Vs CPU / 2 Players / Tournament). CPU difficulty is a radio list: Adaptive (with a `NOW NORMAL` chip) · Easy · Normal · Hard · Pro, each with a one-line description. 2 Players and Tournament each get an explainer and a CTA |
| 2a–c `BallInHand*` | ball-in-hand drag | the camera is forced to 2D and the toggle reads `2D · AUTO`; a hand glyph; a dashed ring when the spot is valid, a solid hot ring when it is not, with a chip underneath (`Overlaps a ball` / `Behind the head string only`); the kitchen is tinted on the break; the hint changes to `Placed · aim when ready` |
| 3 `FoulHandoff` | the foul toast and the seat hand-off | the toast **replaces** the camera toggle and group pill (warning icon, reason, `Ball in hand to <name>`). The footer is replaced by a `Pass to <name>` strip with a `<NAME>'S READY` button |
| 4a–b `CallPocket*` | the called pocket | the power gauge dims and shows a **padlock** until a pocket is called; the lean slider hides. 3D adds a **mini-map** (172×116, top-left) of all six pockets. The pill reads `On the 8 · call it` / `Pro · call every shot`; the hint names the called pocket (`Top right called · drag to shoot`) |
| 5a–b `InMatch`, `ShotClockHot` | the shot clock | a 3px bar along the bottom of the active card; the tag shows the seconds (`18s`); in the last 5s the bar and border go hot and the tag pulses |
| 6a–b `FrameWin`, `FrameLoss` | frame over vs CPU | a dialog over the table: result, reason, updated W·L with a `+1 WIN` / `+1 LOSS` delta, an **adaptive note** (`Adaptive steps up to Hard next frame`), `NEW FRAME` and `Change difficulty`. The CPU card shows `Adaptive · Normal` in place of a W·L record |
| 7 `TournamentSetup` | setup | a stepper with a `Bracket of 8 · 2 byes to top seeds` note; a 140px scrolling name list with seed numbers, slot 01 tagged `YOU`, names up to 16 characters; race-to selects for **three** columns (16 players shows Round 1 / Semi / Final, so rounds before the semi use the Round 1 value); shot clock, guideline and call-pocket segments; a Shuffle switch; `START TOURNAMENT` |
| 8 `BracketCompact` | the compact bracket | round tabs (completed rounds get a check); 102px match cards with LIVE / NEXT / DONE / BYE chips; a mini `BracketTree` under the later rounds; `PLAY NEXT MATCH` names the next match |
| 9a–b `BracketFull*` | the full-view bracket | legend (LIVE, NEXT, completed path); a CTA that resumes the next or live match |
| 10 `MatchIntro` | the match intro | `MATCH 3 OF 5`; the round and race; the two players with their seed and route (`Seed 4 · beat Zara 1–0`); **the lower seed breaks first and breaks alternate after**; `READY` |
| 11 `MatchLive` | the in-match tournament header | the tournament name and `Semi-final · race to 2` replace the title; a `FRAME 2` pill replaces the trophy; the cards show seeds; the footer is **Bracket / Pause / Max**, with no Reset |
| 12 `MatchResult` | the match result | the winner with the match score; one row per frame naming its winner; `<loser> is out · Semi-final finish`; a mini bracket; `CONTINUE` names the next match |
| 13a–b `Champion*` | the champion screen | a rise-in animation; the name; meta (`6 players · date · frames won/lost`); a per-round run list; the final mini bracket; `NEW TOURNAMENT`, `Trophy cabinet` |
| 14a–b `Resume*` | resume and abandon | a dialog over the table with the live score. Abandon asks for confirmation and warns that every result for all N players will be deleted |
| 15 `TrophyCabinet` | the local trophy cabinet | a title table **by player name** × bracket size (4/8/16/total, a crown on the leader); recent tournaments with their name, date, size and champion; labelled `SAVED ON THIS COMPUTER` |

### Gaps the artboards leave open (decided here)

1. **Tournament name.** Every screen shows one (*City Open*, *Office Cup*, *Friday
   Frames*), but setup has no field for it. Setup gains an optional name field that
   defaults by size: *Club Cup* at 4, *City Open* at 8, *Masters* at 16.
2. **Pause** in the tournament footer is not specified. It freezes the shot clock and
   covers the table with a `Paused · Resume` dialog in the same style as the resume
   prompt. Nothing is saved, because saving already happens at every shot boundary.
3. **Spin is free, not five presets** (revised 2026-09-29, the user's test: v1 allowed any
   spin). Drag the dot on the SPIN control's ball, or click the control for a big picker:
   drag or press anywhere inside the miscue ring (0.6 R) and letting go confirms and closes
   it (the user's follow-up); Center / Follow / Draw / Left / Right stay as quick picks and
   close it too; arrow keys step 0.05 R and Enter confirms.
   The tip resets to the centre after every shot.
4. **The shot clock waits for the hand-off.** In PvP and tournaments the clock starts only
   after `<NAME>'S READY` is pressed.
5. **Adaptive difficulty re-evaluates between frames, not between matches.** The tier is
   locked when a frame starts; the frame-over dialog says what the next frame will be.
6. **Trophy cabinet identity** is the name trimmed and lowercased, so *Ayesha* and
   *ayesha* are one person.
7. **Max variants of the in-match states** are not drawn. They follow `Max.dc.html`'s
   scale-up of the compact overlays.
8. **The YOU slot's name** comes from `lbDisplayName`, the leaderboard name the widget
   already registers ([:634](AttendanceTimeCheckerPlus.js#L634)). It falls back to
   "You" if the user never registered.
9. **Shot camera setting** (not in the artboards; the user's call): *Overhead* (default,
   as designed: ease up to the broadcast view while balls run) or *Stay 3D* (the camera
   stands up: it rises to a 58° pitch and backs off, still facing the way the shot went,
   until the whole table is in frame; when everything stops it holds a beat, then swings
   round behind the cue ball for the next shot). Lives in ⚙️ next to the difficulty pin, persisted in `userPreferences` as
   `poolShotCam: 'overhead' | '3d'`. It only affects the 3D camera; 2D stays 2D.

### Rendering spec (from `Table.dc.html`, revision `1790325931-f598`)

**Layer order**, back to front. The canvas renderer paints in exactly this order. The
design's ball-over-overlay bug cannot happen on a canvas, but the order is what fixed it,
so it is the contract:

1. Table shadow, apron, felt.
2. Rail inner face, jaw faces, nose faces (the rubber drops to the felt).
3. Cushion tops, rail wood, lip, diamonds, spots.
4. Pocket leather rim, then the **pocket interior**.
5. Kitchen tint, head string.
6. Ball shadows, then the aim, deflection and object-ball guides.
7. **Balls**, sorted by camera depth.
8. Ghost ball, cue, called-pocket rings, ball-in-hand ghost and hand.
9. The DOM overlays (pocket mini-map, ball-in-hand chip, then the whole HUD) sit above
   the canvas in their own layer.

**Pockets in 3D** are real shafts, not discs:
- **Shape.** A cylinder from the rail top (z = 16) down to z = −64.
- **Opening.** Clipped to the intersection of the rail cut (the circle at rail height) and
  the felt cut (the circle at z = 0), so the felt no longer runs flat into the corner.
- **Walls.** 30 facets, of which only the far wall facing the camera is drawn. There are
  3 depth bands (rail→felt, felt→−22, −22→−64) in darkening browns, and each facet is lit
  0.55 / 0.8 / 1.08 by how directly it faces the table centre (the lamp).
- **Floor.** The ring texture sits on the floor (0.86 r and 0.66 r at z = −64), so it
  reads from directly above in 2D and is partly hidden by the near edge in 3D.
- **Rim.** No outline around the top; a leather rim (r + 7) is clamped to the rail's
  inner edge.
- **2D.** The same floor rings, looking straight down.

**The design's table geometry is authoritative** (user decision, 2026-09-25: "the mocks
are final"). The physics table is rebuilt to it, and the renderer draws the same numbers:

| | corner | side |
|---|---|---|
| hole (capture circle) | centre (±504, ±254), r 27 | centre (0, ±266), r 24 |
| cushion nose ends | 36 u from the corner along each cushion (mouth 36·√2 ≈ 50.9 u) | 30 u either side of centre (mouth 60 u) |
| cushion rail ends | 22 u from the corner, at the rail line (HW + 12) | 24 u from centre, at the rail line |
| jaw | nose end → rail end, continued to the hole edge | same |

The rail ends sit on the hole edges (27.2 vs 27, 24.3 vs 24), so each jaw closes its
throat against its hole.

### Theme mapping

Pool renders under both display themes (`userPreferences.displayTheme`, `glassmorphic` |
`retro-futuristic`, [:274](AttendanceTimeCheckerPlus.js#L274)), each in light and dark.
Cyberpunk also has four panel shapes and user-picked colours
(`CYBER_TOKENS`, `cyber-dev/cyber-hud.js:55`).

The pool UI uses only its own semantic `--pool-*` custom properties. Two CSS blocks map
them: one to the aurora tokens (`--aurora-1…4`), one to the `--rt-*` tokens. **The
design's hex values never appear in pool code**, and a static audit in `pool-verify.js`
enforces that.

| Role (design value) | Glassmorphic Aurora | Cyberpunk HUD |
|---|---|---|
| Panel ground (`#0E1113`) | nothing added: the panel sits in `.snake-game-container`'s glass | nothing added: `.snake-game-container` already carries `--rt-panel`, brackets and hazard edge |
| Cards and controls (`#161C1F`, `#1C2327`) | glass tile `rgba(255,255,255,.08)` + 1px `rgba(255,255,255,.18)`; light mode `rgba(0,0,0,.04)` + `rgba(0,0,0,.10)` | `--rt-panel-strong` + 1px `--rt-border` |
| Hover (`#242C31`) | +6% white | inverted, like `.snake-btn:hover`: fill `--rt-text`, text `--rt-bg-1` |
| Text / muted / faint | the host's text colour at 100 / 70 / 45% | `--rt-text` / `--rt-text-dim` / `--rt-text-faint` |
| **Primary fill** (amber buttons, selected segment, NEXT chip) | `linear-gradient(135deg, var(--aurora-1), var(--aurora-2))`, white text: the same fill as `.snake-btn`, so pool matches its sibling panels | `--rt-accent` fill, `--rt-bg-1` text |
| **Accent line** (active card border and glow, `TO SHOOT`, lean and power fill, bracket path) | `--aurora-4` | `--rt-accent`, glow via `--rt-glow-soft` |
| **Accent on the felt** (object-ball path, called-pocket rings, kitchen tint, ball-in-hand ring) | `--aurora-3`. Blue on green felt is too low in contrast; confirm in `preview.js` | `--rt-accent` |
| **Hot** (fouls, the last 5s, power ≥85%, invalid placement, abandon) | coral `#ff5d73`. There is no aurora warning token, so this one is added | `#ff4d6d` plus the `--rt-hazard` stripe on the element's edge. User-picked colours can land anywhere, so the hot state must not depend on hue alone |
| Ivory guides (aim line, ghost ball, the hand) | unchanged: they are drawn on the felt | unchanged |
| Overlays on the table (pills, toast, mini-map, sheet scrim) | dark glass (`rgba(8,10,11,.66)` + blur) **in light mode too**, because they sit on the felt, not on the panel | `--rt-panel-strong` + `--rt-border`, **no blur** (Cyberpunk sets `backdrop-filter: none` throughout) |
| Display type and numerals (Chakra Petch) | Inter 700, `tabular-nums`, uppercase labels with 0.12em tracking | Orbitron for titles, Share Tech Mono for labels and numbers, as in the `.snake-game-title` / `.snake-score` rules |
| Body (Sora) | Inter | Share Tech Mono |
| Shape (radius 20/14/12, pills) | the host's glass radii (12–16) | `--rt-radius` / `--rt-radius-sm`. Buttons get the `.snake-btn` corner cut. **Never** a `clip-path` or `filter` on the table viewport or any ancestor of the canvas or popovers (the rule at `cyber-dev/cyber-theme.css:1343`) |
| Backdrop around the table (radial `#25383A → #07090A`) | a near-black radial tinted with `--aurora-2` at ~18% | an `--rt-bg-1 → --rt-bg-2` radial with `--rt-grid` hairlines |
| Rail lip | as designed | plus a 1px `--rt-border` hairline |

**The canvas bridge.** The canvas cannot read CSS variables, so `poolThemeTokens()` reads
the computed `--pool-*` values off the panel, parses them into RGB and caches them. The
cache and the cached table layer are invalidated by `poolOnThemeChange()`, which is called
from:

- `applyCyberpunkTheme` / `clearCyberpunkTheme`
- the Cyberpunk colour-picker listener ([:17753](AttendanceTimeCheckerPlus.js#L17753))
- the `prefers-color-scheme` listener ([:19300](AttendanceTimeCheckerPlus.js#L19300))

**Where it lives.** Both mapping blocks are in `pool-dev/pool-theme.css`, spliced into
the style template under their own sentinels. Pool never writes theme tokens itself,
which keeps Cyberpunk's token write/teardown contract (`cyber-verify.js`) intact. No new
fonts are imported: Inter, Orbitron and Share Tech Mono are already loaded at
[:11124](AttendanceTimeCheckerPlus.js#L11124).

---

## Problems in the current engine

Found while reading the code. Each one becomes a regression test in `pool-verify.js`.

1. **Friction is exponential, not physical.** `v *= 0.985` per frame
   ([:2807](AttendanceTimeCheckerPlus.js#L2807)) removes too much speed from fast balls and
   lets slow balls creep. Real cloth decelerates at a constant rate. This is the biggest
   single cause of the "floaty" feel.
2. **Per-axis stop snapping** ([:2815](AttendanceTimeCheckerPlus.js#L2815)) zeroes `vx` and
   `vy` independently, so a ball rolling nearly along an axis bends at the end of its run.
3. **Spin is faked.** Follow and draw are an instant velocity kick at contact
   ([:2724](AttendanceTimeCheckerPlus.js#L2724)), plus a decaying `spinDrift`. Side spin on
   a cushion adds velocity instead of changing the rebound angle. Neither curves the way
   masse and draw do on real cloth.
4. **The cushion is an axis-aligned box with no pocket jaws.** Pockets are distance checks
   ([:2771](AttendanceTimeCheckerPlus.js#L2771)). The side-pocket target is only about
   ±6px (one ball width) because its centre sits 9px from the nearest reachable ball
   centre, while corners are generous. No ball can rattle in the jaws.
5. **The CPU simulates different physics from the game.** `poolTrialSim`
   ([:3118](AttendanceTimeCheckerPlus.js#L3118)) models only the cue and target balls, with
   no spin and no other balls. It is a second copy of the physics that has already drifted
   from the real one. The CPU has one tier with zero aim noise on direct shots
   ([:3449](AttendanceTimeCheckerPlus.js#L3449)).
6. **Groups are assigned by a pot on the break** ([:2953](AttendanceTimeCheckerPlus.js#L2953)).
   Under WPA and Miniclip rules the table stays open after the break. There is also no
   legal-break rule, no rule for the 8 on the break, and no called pocket on the 8.
7. **Foul messages are seat-blind.** "Scratch on 8-ball! You lose" is shown when the CPU
   scratches.
8. **Pot XP is paid to both seats in PvP** ([:2981](AttendanceTimeCheckerPlus.js#L2981)).
   One person playing hot-seat collects 5 XP per pot for both sides. This is small today,
   but it becomes a real farm once tournaments allow hot-seat seats.
9. **There is no devicePixelRatio scaling.** The 368px backing store is blurry on HiDPI
   screens.
10. **Play, Reset and "Click Reset to play again" overlap in meaning.** The design drops
    Play, and the anti-farm guard in `startPoolGame`
    ([:4496](AttendanceTimeCheckerPlus.js#L4496)) has to survive that change.

---

## Decisions (confirmed unless marked ❓)

| Topic | Decision | Why |
|---|---|---|
| Rendering | **Canvas2D with our own perspective projection**, ported from `Table.dc.html`'s `toCam`/`toScr`/`clip`. No WebGL, no three.js | The design is already a flat-polygon projection, so the port is direct. Canvas2D also keeps `ludo-dev/preview.js` (the software rasterizer) usable for PNG previews, and adds no dependency to a userscript |
| Source layout | Extract to **`pool-dev/`** with sentinel splice + byte-identity assertion, as `snake-dev/` does | Proven pattern: a sub-second headless loop instead of iterating inside a 20k-line file |
| Canvas | **368×412** compact viewport, backing store ×`min(devicePixelRatio, 2)` | Matches the design viewport. Fixes blur |
| HUD | **DOM, not canvas**: player cards, frames, trophy pill, overlays, buttons | The design draws them in DOM. Real `<button>`/`<input type=range>` give focus, aria and hit areas for free, and the canvas becomes only the table |
| Play button | **Removed.** The rack is live when the panel opens, and the first placement or shot starts the frame. The anti-farm guard moves to `endPoolGame` (one award per rack id) | Follows the design and removes the Play/Reset ambiguity |
| Physics | **Sliding/rolling ball model with real angular velocity**, constant-deceleration friction, cue-tip impact model, throw, spin-aware cushions, jawed pockets. Deterministic (fixed dt + seeded RNG) | Fixes problems 1–4. Determinism lets the CPU, replays and tests all use *the* physics |
| Ball size | Keep the design's `R=14` on a 1000-unit table (≈24% larger than regulation) | Readability at 368px. Regulation would be R≈11.25 |
| Rules | **WPA 8-ball**, with Miniclip-style choices: open table after the break; legal break = pot or ≥4 balls to a rail; 8 on the break re-spots; **called pocket on the 8** (a tap on a pocket); ball in hand anywhere after a foul, kitchen-only on the break. **Call pocket on every shot** is a rule that the pro tier switches on, and a setting for PvP and tournaments | Fixes problem 6 and matches what Miniclip players expect. Calling every shot removes lucky pots, which is how the top difficulty gets harder for the human as well as through the CPU |
| CPU tiers | **easy / normal / hard / pro**. **Hard = today's CPU, fine-tuned**: it keeps zero noise on direct shots and gains the new physics, position play and safeties. **Pro hardly misses** and plays with call-every-shot on. Easy and normal are new, weaker tiers below the current CPU. Calibrated by measurement (a `balance-check.js` equivalent). Adaptive by default, visible, and pinnable in ⚙️, as in Ludo | The user's call (2026-09-25): the current CPU is already tough, so it becomes the reference point rather than being nerfed. Ludo's log shows a hidden adaptive ladder must be visible and pinnable |
| Camera default | **3D aim camera**. During the shot the camera eases to an overhead broadcast view, then returns behind the cue ball when everything stops. Ball-in-hand forces top-down | 3D aiming is the design's headline. Watching a break from ankle height is useless |
| Theme | **The existing presets, not the design's palette.** Glassmorphic Aurora and Cyberpunk HUD, light and dark, through `--pool-*` tokens (see *Theme mapping*). The design supplies layout, components and states only | The user's call (2026-09-25). Pool stays consistent with its sibling panels and honours the user's Cyberpunk colour picks |
| Audio | None | The audio module was removed from the build (`a2b2f85`) |
| Tournament sizes | **3–16 contestants**, padded to the next power of two with **byes to the top seeds** | "Select the number of contestants" should not be limited to 4/8/16 |
| Tournament seats | **Humans only.** Every slot is a named human player, playing hot-seat on one machine. There are no CPU slots and no CPU-vs-CPU matches | The user's call (2026-09-25). It also removes the resolver, the Watch mode and the tier seeding |
| Hand-off | A **match intro** screen ("Next up: Ayesha vs Bilal · Semi-final · race to 2 · Ready") before every match, and a **"Pass to <name>"** strip whenever the turn changes seat | On one machine, players need a clear moment to swap seats |
| Match length | Race-to-N frames per round (default: R1 race-to-1, semis race-to-2, final race-to-3), set in setup | Gives the design's `FRAMES` counter meaning, and makes finals feel like finals |
| Persistence | Tournament state and the **mid-frame table state (saved at each shot boundary)** go in `localStorage` under `poolTournament` `{v:1,…}`. You can resume after a portal reload | The portal reloads. Losing a semi-final to a refresh would be the #1 complaint |
| Names | Tournaments are named in setup. The default is our own cup name (*Club Cup* at 4, *City Open* at 8, *Masters* at 16), **not Miniclip's venue names or branding** | Miniclip's names are their IP |

---

## Architecture

### `pool-dev/` layout (mirrors `snake-dev/`)

| File | Contents | Pure? |
|---|---|---|
| `pool-physics.js` | world constants, table geometry (rail segments, jaw segments, pocket capture circles), ball state, `step(world, dt)`, `strike(world, aim, power, tip)`, event-driven collision (TOI), RNG | ✅ no DOM |
| `pool-rules.js` | shot bookkeeping (first contact, rails after contact, pots, scratch), `judgeShot(state, shotLog)` → `{foul, reason, nextTurn, ballInHand, frameOver, winner}`, group assignment, called pocket | ✅ |
| `pool-ai.js` | candidate generation (direct, bank, kick, combo, safety), **evaluation by cloning the world and running the real `step`**, position scoring, tier noise | ✅ |
| `pool-camera.js` | `project(world→screen)` for the 2D ortho and 3D chase cameras, near-plane clip, camera tweening, screen→table unprojection for input | ✅ |
| `pool-render.js` | the table layer (cached per camera pose), balls with orientation, shadows, cue, guides, pocket drop animation, overlays drawn on canvas (ghost ball in hand, called-pocket marker) | canvas |
| `pool-hud.js` | the DOM HUD (cards, frames, spin, lean, power, hint, toggles, Max layout) as a pure view model plus a diffing renderer | DOM |
| `pool-game.js` | the controller: input, the loop, the CPU's turn, XP and records, lifecycle hooks the host calls, Max, theme (was `pool-ui.js` in the first draft of this plan) | DOM |
| `pool-tournament.js` | bracket model (pure section), setup/bracket/intro/result/champion/cabinet screens (DOM section), persistence | mixed |
| `pool-theme.css` | the `--pool-*` token mappings for Glassmorphic (light and dark) and Cyberpunk, plus pool's component CSS; spliced into the style template under its own sentinels | CSS |
| `load.js`, `reinsert.js`, `pool-verify.js`, `preview.js`, `pool-harness.html`, `README.md` | tooling, same contracts as Snake | – |

Sentinels in the userscript:

```js
    // ═══ POOL ENGINE — generated from pool-dev/, do not edit here ═══
    …
    // ═══ END POOL ENGINE ═══
```

The shared `toggleGameMaxModal` ([:4641](AttendanceTimeCheckerPlus.js#L4641)) stays in the
host, outside the sentinels, because Ludo uses it. It gains an optional `cfg.build(panel)`
hook so pool can supply the design's Max layout without changing Ludo's behaviour.

### Physics model (`pool-physics.js`)

Units are world units (u) and seconds. Constants start from published measurements
(Marlow; Alciatore's "Dr. Dave" technical proofs) and are then tuned by feel in the
harness. Every change goes in the Decision log.

- **Ball state:** `p (x,y)`, `v (x,y)`, `ω (x,y,z)`, orientation quaternion `q` (render
  only), `state ∈ {sliding, rolling, spinning, stationary, pocketed}`.
- **Contact-point velocity:** `u = v + ω × (−R·ẑ)`.
  - **Sliding** (`|u| > ε`): friction `μs·g` opposes `û`. It slows `v` and drives `ω`
    toward rolling (`Δω` factor `5/(2R)`). The ball reaches natural roll when `u → 0`.
    This is what makes follow and draw **curve** after contact, with no special cases.
  - **Rolling:** constant deceleration `μr·g`, with `ω_xy` locked to `v`.
  - **Spin** (`ω_z`): decays at `5·μsp·g/(2R)`, independent of translation.
  - Starting values: `μs≈0.2`, `μr≈0.01`, `μsp≈0.044` (scaled to u/s²).
- **Cue strike:** aim `θ`, speed `V` (power² curve, max ≈ break speed), and tip offset
  `(a, b)` in units of R, clamped to a **0.6R miscue radius**.
  - `v0 = V·dir`
  - `ω_perp = 5·V·b/(2R)` (follow is +b, draw is −b)
  - `ω_z = −5·V·a/(2R)` (English)
  - **Squirt:** the launch direction deflects slightly away from the side spin
    (≈0.5–1° at max English), so English has a cost as it does in real play.
- **Ball–ball:** equal-mass impulse along the normal with restitution `e≈0.95`, plus
  **throw** from tangential contact friction `μbb≈0.05`, capped by the tangential slip.
  This covers both cut-induced throw and spin-induced throw. Spin is not transferred
  otherwise.
- **Cushions:** line segments for the six rail runs plus **angled jaw segments** at each
  pocket mouth, derived from the design's pocket radii.
  - Normal restitution `e≈0.75–0.8`.
  - Running or reverse English changes the rebound angle through the cushion's friction
    impulse, and topspin gives the familiar "shorter" rebound off a rail.
  - A ball can rattle between the jaws.
- **Pockets:** capture when the ball centre crosses the pocket's throat circle, or drops
  past the jaw line with enough inward velocity. A ball that hits a jaw too fast can
  reject (the pocket "spits" it).
- **Integration:** fixed 60 Hz logic step (the existing `FIXED_DT`) split into 4
  sub-steps. Each sub-step finds the **earliest time of impact** (ball–ball quadratic,
  ball–segment linear) and advances to it, up to 32 events per sub-step, so no tunneling
  and no overlap correction are needed. State transitions (sliding→rolling→stationary)
  are events too, so balls stop cleanly with no per-axis snapping.
- **Determinism:** no `Math.random` in the physics. The break rack jitter and AI noise
  come from a seeded PRNG stored with the frame. The same inputs always produce the same
  outcome, and a CPU "trial sim" is literally `step()` on a cloned world.

### Rendering (`pool-camera.js` + `pool-render.js`)

- **Two layers:**
  1. The **table layer** (shadow, apron, felt, cushions, rails, lip, diamonds, spots,
     pocket rims and holes) goes to an offscreen canvas and is re-rendered **only when the
     camera pose changes**. In 2D that is once. In 3D it is on aim or lean change.
  2. The **dynamic layer** (ball shadows, balls, guides, cue) is drawn every frame.
- **Balls:**
  - A projected disc (radius `R·F/z`) with a base colour.
  - The stripe band drawn as the projection of a great-circle band around the ball's
    local axis (from `q`), clipped to the disc.
  - The number disc drawn as a foreshortened ellipse at the ball's local pole. It is
    hidden when it faces away, and fades out below ~15px diameter, as in the design.
  - Specular highlight and rim darkening fixed to the light, not rotating with the ball
    (the design's two radial gradients).
  - Sort back to front by camera depth.
  - This gives **true 3D rolling**: stripes tumble and numbers roll over the top. It
    replaces the orbiting label at [:3736](AttendanceTimeCheckerPlus.js#L3736).
- **Shadows:** offset contact shadows under a single overhead light (design: +4, +5u,
  1.08R, 38% black) plus a blurred table shadow.
- **Pocketing:** the ball sinks and shrinks into the hole over ~250ms, then its tracker
  dot on the owner's card dims.
- **Cue:** six segments as in the design. The stroke plays as pull-back while you drag,
  then a 90ms forward strike on release. The ball launches at contact, not on mouse-up.
- **Guides:** the design's dashed aim line and ghost ball, the object-ball path in the
  theme's felt accent, and a faint cue path. The cue path **reflects the selected spin**:
  it is computed by a short cloned `step()` of the cue ball, so a draw shot visibly bends
  back. The illegal-target prohibition sign from
  [:3911](AttendanceTimeCheckerPlus.js#L3911) is kept, in the theme's hot colour. Every
  coloured stroke on the felt gets a 1px dark underlay, so a user-picked Cyberpunk accent
  still reads against green. Guide length is a tournament setting (full / short / off).
- **Table colour preference** ([:277](AttendanceTimeCheckerPlus.js#L277)): green, red, blue
  and grey stay, as felt tint ramps in the new material model.
- **Theme:** every non-material colour comes from `poolThemeTokens()` (see *Theme
  mapping*). Canvas text uses the theme's font: Inter, or Share Tech Mono in Cyberpunk.
  Wait for `document.fonts.load` before the first text draw, and fall back to
  `system-ui`.

### Input (`pool-ui.js`)

| Action | 3D camera | 2D camera |
|---|---|---|
| Aim | horizontal mouse or touch movement rotates the aim (0.3°/px). **Keeps aiming after the mouse leaves the canvas** (up to 240 px out); lets go when the mouse moves onto another control, goes further, or presses elsewhere | point at a target, also from outside the canvas |
| Fine aim | `Shift`+move = 0.05°/px; `←/→` = ±0.1° (only while the pool panel has focus) | same |
| Power | press, then **pull back or push forward along the shot line** (the old engine's rule; sideways movement adds nothing). Full power = the longer of the two runs from the press point to the canvas edge, at most 140 px, and the pointer is clamped to the canvas, so a full stroke always fits inside the table. The gauge fills; the hint shows `Release to shoot · 62%` | same |
| Cancel | return to under 3% and release, or `Esc` | same |
| Spin | drag the red dot on **SPIN**'s ball; or click **SPIN** → a big ball face: press or drag anywhere inside the 0.6R miscue ring and let go to confirm and close, or take a Center/Follow/Draw/Left/Right chip (also closes); ←↑→↓ step it and Enter confirms. The button names it (*Follow · Right*, *Follow R* in the narrow column); the picker reads *Follow 50% · Right 20%* | same |
| Lean | vertical slider, 3D only | – |
| Ball in hand | camera auto-switches to top-down; press anywhere to pick the cue ball up and drag it with a hand cursor. **It stops at the cushions and, on the break, at the head string** (`prClampPlace`, as v1 did), sliding along them even with the pointer off the canvas, so there is no kitchen warning to read. Only a spot on another ball is refused (red, *Overlaps a ball*). Release to put it down | same |
| Move cue ball | after placing, a small **Move cue ball** button (above the hint) picks the ball up again, any time before the shot. The shot clock pauses while the ball is in hand and carries on from where it was, so re-placing never buys time back | same |
| Call pocket | when on the 8, tap a pocket (accent ring) before the shot is allowed | same |

Pointer events replace the separate mouse and touch handlers at
[:4310-4445](AttendanceTimeCheckerPlus.js#L4310-L4445). The host's `switchGame`
add/remove listener blocks at [:9929](AttendanceTimeCheckerPlus.js#L9929) and
[:10004](AttendanceTimeCheckerPlus.js#L10004) collapse to `initPoolGame()` / `poolDetach()` (done in Phase 5).
Keyboard handlers are scoped to the pool panel and do not collide with the `1-9` game
shortcuts at [:19994](AttendanceTimeCheckerPlus.js#L19994).

### CPU (`pool-ai.js`)

1. **Generate candidates.** For each legal target × pocket: a direct cut (ghost ball),
   one-rail bank, one-rail kick, a simple two-ball combo, and 2–4 safety lines. Prune by
   clear paths and cut angle under 80°.
2. **Simulate.** For the top K candidates, try a small grid of power × spin (`draw /
   stun / follow`) with the **real `step()`** on a cloned world. Score the result: a
   legal pot, then cue-ball position quality (the best next shot's make probability),
   then whether a scratch or foul risk remains.
3. **Choose safety** when no pot scores above a tier-specific threshold. The safety is
   scored by the opponent's best make-probability afterwards.
4. **Execute with tier noise.**

| Tier | Candidates simulated | Spin options | Position play | Aim σ | Power σ | Rules |
|---|---|---|---|---|---|---|
| easy | 4 | stun only | no | 1.2° | 12% | call the 8 |
| normal | 10 | stun, follow, draw | 1-ball look-ahead | 0.5° | 6% | call the 8 |
| hard (today's CPU, tuned) | 20 | + side | 1-ball | **0** on direct shots (as today) | 0.5% (as today) | call the 8 |
| pro ("hardly misses") | 32 | full grid | 2-ball look-ahead + safety duel | 0 | 0.25% | **call every shot**, both seats |

Hard must never measure weaker than today's CPU. Phase 0 records a baseline win rate for
the current `poolAITakeShot` against the scripted human models, and hard has to match or
beat it. Pro's edge comes from three things:

- It evaluates its shots on the real physics, so a zero-noise shot actually goes in.
- It plays position two balls ahead.
- It plays safe instead of taking a low-percentage pot.

With call-every-shot on, the CPU calls the pocket its chosen line targets. A called ball
that drops in a different pocket is no foul, but it does not count and the turn ends
(WPA).

The σ values for easy and normal are starting points. `pool-dev/balance-check.js` measures win rates against a
scripted "casual" and "skilled" human model, and the Decision log records the calibrated
numbers. The work is time-sliced across animation frames (≤4ms per frame) so aiming never
janks the panel. The CPU shows its aim by rotating the cue toward its line over its think
delay, as it does today.

### Tournament (`pool-tournament.js`)

**Bracket model (pure, fully tested):**

- `S = nextPow2(N)`, `byes = S − N`, `rounds = log2(S)`.
- Standard seeding order (1v16, 8v9, 5v12, …). Byes pair with the top seeds, so no round-1
  match is bye vs bye.
- Seeding: entry order by default, with a *Shuffle* option (the tournament's seeded
  PRNG, so the draw is reproducible).
- Byes are walkovers. The seeded player advances with no match played.
- Round labels from the end: *Final*, *Semi-final*, *Quarter-final*, *Round of 16*.
- The match record is `{id, round, slotA, slotB, raceTo, frames:[…], winner, status}`.
  Winners feed forward by index, so there is no linked-list bookkeeping to corrupt.
- Match order: finish a round before starting the next, left to right, so the bracket
  fills evenly.

**Screens (DOM, in the pool panel's skin; Max shows the full tree):**

1. **Setup:** a tournament name (defaulted by size); a contestants stepper (3–16); a name
   field per player, with slot 1 tagged `YOU` and prefilled with the display name; the
   frames per round
   (race-to for R1, SF, F); shot clock (30s / 45s / off); guideline (full / short / off);
   call pocket (8 only / every shot); *Shuffle seeds*; **Start tournament**.
2. **Bracket:**
   - Compact (368px) shows **one round per page**, with tabs and swipe, and the next match
     highlighted in the accent colour.
   - Max shows the full tree with connector lines.
   - Match cards show names, frame scores and a `LIVE` / `NEXT` / `DONE` / `BYE` state.
   - CTA: **Play next match**.
3. **Match intro:** both names, the round, race-to-N, who breaks, **Ready**.
4. **Match:** the normal table, with the frames counter showing `race to N`, a round label
   in the header, and a "Pass to <name>" strip on every seat change.
5. **Match result:** the winner, the frame scores, "<loser> is out", the bracket-advance
   animation, and **Continue**.
6. **Champion:** a trophy card, the run summary (frames won and lost per round), the final
   bracket, and **New tournament**.
7. **Resume prompt:** shown when the panel opens with a tournament in progress. It offers
   **Resume** or **Abandon**, and abandoning asks for confirmation.

**Persistence:** `poolTournament = {v:1, id, seed, settings, slots, matches, currentMatchId,
frameSnapshot}`.

- `frameSnapshot` is the full world, turn, groups and shot clock, written after every shot
  resolves, never mid-motion.
- On load, a version mismatch or corrupt JSON is discarded behind a *"couldn't resume"*
  toast. It is never half-loaded.
- Quick matches outside tournaments keep today's keys unchanged.

---

## Progression, XP and anti-farm

| Source | XP | Guard |
|---|---|---|
| Quick match vs CPU | win `60/80/100/120` by tier (easy→pro), loss 15 | one award per rack id; Reset mid-frame pays nothing |
| Quick match PvP (hot-seat) | unchanged from today: Player 1 wins 80, loses 15; no pot XP | pot XP is what paid both seats (problem 8) |
| Pot XP (+5) | **only when the potting seat is "You" against a CPU** | fixes problem 8 |
| Tournament match, **You** win | **80** per match won, the same as a won game today | one award and one `gameSessions` increment per match, so the sync budget (`newGames × AC_MAX_XP_PER_GAME`, [:926](AttendanceTimeCheckerPlus.js#L926)) covers it. 80 is well under the 300 cap |
| Tournament match, **You** lose | 15 | same |
| Tournament match without You | 0 | – |
| Bye | 0 | no match was played |
| Tournament title | 0 XP | – |

**Who "You" is:** the first slot in setup is the account owner. It is tagged `YOU` and
prefilled with the widget's display name. The XP lands on this machine's account, so it
follows that seat and not whoever happens to win.

**Why this is enough of a guard:** each match is a real race-to-N of pool, so it takes
the same time to play whether the opponent is a friend or a name you typed yourself.
Entering 16 names buys nothing either. You still play only your own path through the
bracket: at most 4 matches, the same XP as 4 quick wins in the same time. What stays out
is anything that pays for the bracket rather than the match:

- a title bonus
- tournament achievements
- a tournament leaderboard

Tournaments are rewarded **locally** on top of the match XP:

- a trophy cabinet (titles won, by bracket size)
- tournament history (the last 20 brackets with their champions)

None of it syncs.

**Achievements:** none added for tournaments, for the same reason. Pro-tier CPU wins are
not farmable, so one CPU achievement is worth considering:

- 🎯 *Called It*: beat the pro CPU. It sits next to `poolShark` at
  [:248](AttendanceTimeCheckerPlus.js#L248), with backfill at
  [:10517](AttendanceTimeCheckerPlus.js#L10517) and XP at
  [:10628](AttendanceTimeCheckerPlus.js#L10628) ❓

**Leaderboard: split by CPU tier, the same way as Ludo** (confirmed 2026-09-25):

- **Storage.** New `poolWinsByTier {easy, normal, hard, pro}`, written in `endPoolGame`
  under the vs-CPU guard and keyed on the tier **locked when the frame started**, so
  changing difficulty mid-frame cannot re-file a win.
  - `poolGamesWon` and `poolWinsByMode.cpu` stay as the all-time total.
  - Legacy wins are **not** backfilled into a tier; their difficulty was never recorded.
  - There is no tournament board, because tournaments are farmable.
- **Client sync**, following the Ludo pattern:
  - `collectGameModeBests` ([:756](AttendanceTimeCheckerPlus.js#L756)) emits
    `pool:easy|normal|hard|pro` next to the existing `pool:cpu` (all-time) and `pool:pvp`.
    It reads `poolWinsByTier` inline, not through a pool-block helper, because that block
    may not be loaded.
  - The restore merge ([:1147](AttendanceTimeCheckerPlus.js#L1147)) raises only, per tier.
- **Boards.** `LB_BOARDS.pool.modes` ([:1400](AttendanceTimeCheckerPlus.js#L1400))
  becomes `{ pro, hard, normal, easy, cpu: All-time, pvp: Hot-seat }`.
  - `gameLbMode('pool')` returns the tier being played (or `pvp`).
  - The score button shows that tier's wins.
  - The mode tab strip Ludo added works unchanged.

**Gist and sync bot** (`github-actions-bot/.github/workflows/sync.yml`, a separate repo):

What the bot does today:
- The client syncs through `repository_dispatch` to the bot, which is the path at
  [:688](AttendanceTimeCheckerPlus.js#L688). `cloudflare-worker/` is no longer on the
  sync path.
- The bot **replaces each player record wholesale** (`mergeSinglePlayer`). Only
  `totalXP`, `totalWorkDays`, `gameSessions` and `longestStreak` are protected.
- `gameModeBests` is never inspected. New `pool:*` keys therefore already pass through,
  but nothing protects them:
  - An outdated tab (still accepted during the `BUILD_TOKEN_PREVIOUS` grace window) that
    syncs without the tier keys **erases them from the gist**.
  - A modified client can write any number to any key.

Required bot changes, which apply to Ludo's tiers as well:
1. **Monotonic per-key merge of `gameModeBests`.** Keep `max(prev, next)` for count and
   score keys, and the smaller positive value for `reflex:*`, which is lower-is-better. A
   key the client omits is kept from the stored record, never dropped.
2. **Shape validation.** Keys must match `^[a-z]+:[a-zA-Z]+$`; values must be finite
   non-negative integers. Anything else is dropped from the incoming payload, not stored.
3. **Growth bound for win counters.** The summed increase across `pool:{easy,normal,hard,pro}`
   in one sync cannot exceed that sync's `gameSessions` delta (each win is one session);
   the same holds for `ludo:{easy,normal,hard}`. A breach clamps the keys back to their
   stored values and logs a `core.warning`. It does not flag the player, because an old
   tab racing a new one can trip it innocently.
4. `MAX_XP_PER_GAME` on the bot is 250 against the client's `AC_MAX_XP_PER_GAME` of 300.
   Pool's largest award (120 for a pro win) fits either, so nothing needs changing, but
   the mismatch is noted here.

The bot lives in its own repo and deploys on push, so these land as a reviewed change
to `sync.yml` pushed by the user. They are not bundled with a userscript release.

---

## Phases

Each phase ends green on `node pool-dev/pool-verify.js` and `node ludo-dev/verify-all.js`
(which gains the pool suite).

### Phase 0: extraction (no behaviour change) — done 2026-09-25
- [x] Branch `feat/pool-v2`, **cut from `feat/cyberpunk-hud-rework`, not `main`** (see the
      Decision log).
- [x] Pool engine moved into `pool-dev/pool-core.js` (1,108 lines) + `pool-ui.js`
      (1,150), spliced back between `POOL ENGINE` sentinels. `reinsert.js` has a
      `--check` mode and keeps the userscript's own line ending.
  - Left in the host: the shared Max modal, the storage helpers, and `prayerCount`
    (which had been declared in the middle of the pool state).
  - Moved into the block: the `poolLastFrameMs` timing trio, from line 337.
  - Proof that nothing but moves happened: a line-multiset diff of the file before and
    after shows **0 lines removed**; the only additions are the two module headers and
    the sentinels.
- [x] `load.js`: host dependencies passed as parameters, the real storage helpers sliced
      from the userscript, a seedable `Math.random`, and accessors generated for every
      `let`.
- [x] `pool-verify.js`: **91 assertions**. They cover:
  - the splice contract and host wiring
  - rack geometry and reproducibility
  - break settling, overlap, bounds and determinism
  - 21 rules cases
  - pot XP
  - frame end, the W/L record and the anti-farm guard
  - CPU sanity
  - 8 render states

  Problems 1, 2, 4, 5, 6, 7 and 8 are each pinned by a tagged assertion. A planted rule
  bug was caught three times (parity check plus two rule assertions).
- [x] `preview.js`: `rack aim power break foul groups cpu gameover max`, or `all` for a
      contact sheet. The output matches the current in-game look.
- [x] `verify-all.js` runs the pool suite: **1,679 assertions, 0 failed** (1,588 before,
      plus 91).
- [x] **Baseline strength of today's CPU** (`baseline-check.js 1000 1`: 1,000 frames per
      profile, seat 1 always breaks). This is the bar for Phase 6:

      | human model | aim σ | power σ | today's CPU wins |
      |---|---|---|---|
      | mirror (itself) | 0° | 0% | 53.4% [50–56] |
      | skilled | 0.4° | 5% | **61.4%** [58–64] |
      | casual | 1.2° | 12% | **72.3%** [69–75] |
      | novice | 3° | 25% | 75.1% [72–78] |

  - Across all 32,351 visits, the CPU pots on **~65%** of them and **fouls on 13.4%**.
  - Fouls by cause: **74% scratches**, 17% wrong ball first, 4% 8 hit early, 3% not the
    8 first, 2% no contact.
  - Frames it loses on its own shot: **58% the 8 potted too early**, 38% a scratch on the
    8, 3% the 8 on the open table.
  - Both leading causes come from problem 5: the trial sim never tracks the cue ball
    into a pocket and ignores every ball except the target. That is why even a 3° novice
    takes a quarter of the frames.

### Phase 0b: close the design gaps (user, in Claude Design)
- [x] Run the prompt in [Appendix A](#appendix-a-design-prompt-for-the-missing-screens)
      in the existing design canvas. 29 artboards delivered on 2026-09-25.
- [x] Re-read the canvas and update this plan: *Artboard inventory*, *Gaps*, *Theme
      mapping*.
- [x] Copy the canvas into `pool-dev/ref/design/` as the frozen reference, the way
      `cyber-dev/ref/design/` does. Version `1790325931-f598`, 29 files; revisions are
      tracked in `pool-dev/ref/README.md`.

### Phase 1: physics v2 — done 2026-09-25
- [x] `pool-dev/pool-physics.js`, a pure and deterministic module with the `pp*`
      functions and `PP_*` constants. It is **not spliced into the userscript yet**; the
      live game keeps today's engine until the new renderer lands (see the Decision log).
- [x] Table geometry built from parameters (`ppBuildTable`):
  - 6 cushion runs
  - 12 jaws at WPA-style angles (142° corner, 103° side), each ending exactly on its
    pocket's capture circle
  - 24 nose and jaw tips as point colliders
  - pockets whose capture circles sit behind their mouth lines

  The renderer will draw from the same numbers.
- [x] Ball model with an exact closed form per state (sliding, rolling, spinning,
      stationary):
  - cue strike with tip offset, a 0.6 R miscue clamp and squirt
  - ball–ball contact with restitution and friction-limited throw
  - cushions contacting above the ball's centre, so English and follow/draw change the
    rebound
- [x] Event-driven time of impact over 4 sub-steps per frame, plus:
  - a **cluster contact solver** for the break
  - an **overlap sweep**
  - a seeded PRNG
  - `ppCloneWorld`
- [x] `physics-verify.js`, **70 assertions**, including a 2,000-shot fuzz. Measured
      results:

      | check | result |
      |---|---|
      | rolling distance | exactly v²/2μg, 3 speeds, within 0.1% |
      | roll-on speed | (5/7)(1+b)·v₀ for stun, max draw and follow |
      | stop shot | stops within 1.1 u |
      | follow / draw | +172 u / −396 u |
      | stun separation (the 90° rule) | 84.4° (restitution plus throw, as on a real table) |
      | cut-induced throw | 2.9°; gearing English cancels it at 0.19 R and the other side can't exceed the friction limit |
      | 30° rule | 34.0° |
      | cushion restitution | 0.79 |
      | English at 45° | running 54.0°, plain 36.6°, reverse 31.5° |
      | corner pocket | clean drops, jaw-assisted drops and rattle-outs at both 500 and 2,600 u/s |
      | break at 75% | 40/40 legal, 8.8 balls to a rail, 225 u mean spread, settles < 6 s, **8 ms per break** |
      | fuzz | energy never rises, no overlap > 0.001 u, 0 escapes, no NaN, every shot settles |
      | determinism | same shot → same result; clones are independent |

- [x] `pool-harness.html`: the real physics on a top-down table, with drag-to-shoot, a
      spin pad, 12 live sliders, trails and a shot report. Driven in headless Chrome: no
      page errors, and a break sends 10 balls to a rail.
- [x] Tested by the user in the harness: "the harness and physics are doing great".
      Committed as tested.
- [x] **Follow-up: `ppBuildTable` rebuilt on the design's geometry** (the table under
      *Rendering spec*). The config is now `cushionWidth`, `cornerNose`/`cornerRailEnd`,
      `sideNose`/`sideRailEnd`, and the hole offsets and radii, in place of mouth widths
      and jaw angles. 72 assertions pass, including the 2,000-shot fuzz with 0 escapes.
      - **Corner:** lines up to 10 u off centre (in start y on a 45° line) drop cleanly;
        16–18 u drop off the jaw; from 20 u they rattle.
      - **Side:** a line 21 u off centre drops slowly but **spits out at full pace**. That
        is the pocket "spit" listed as missing below, and the design's jaw shape produces
        it naturally.
      - **Breaks:** they pot at the same rate as before (5% at 75% power, 11.5% at full),
        so potting on the break is still a tuning item, not a geometry one.
      - **Harness:** sliders are now `cornerNose` and `sideNose`; re-checked in headless
        Chrome with no page errors.
- [ ] **Tuning, by feel, in the harness (open).** Breaks pot a ball only 5–17% of the
      time against about one per break on a real table. The geometry is fixed by the design, so the levers are
      `muRoll`, `ballE` and `maxSpeed`. (Pocket spit now appears on the side pockets with the
      design geometry; see above.)

### Phase 2: rules v2 — done 2026-09-25
- [x] `pool-dev/pool-rules.js`: `prJudge(state, world, call)` (the plan's `judgeShot`),
      pure, judged from the physics event log after the last strike. Like the physics it
      is **not spliced yet**. The rules it implements:

      | situation | ruling |
      |---|---|
      | break | from the kitchen, never called. Legal = a ball drops or ≥4 object balls reach a rail. Illegal = foul |
      | 8 on the break | re-spotted (`prSpotBall`: foot spot, else behind it, else in front); the breaker plays on unless it was a foul |
      | after the break | table open whatever dropped. Either group may be hit first, **the 8 may not** |
      | group choice | the first counted pot (with call-every, the ball in the called pocket) |
      | fouls | scratch · no ball hit · opponent's ball first · 8 first too early · not the 8 first when on it · no rail after contact without a pot |
      | after a foul | ball in hand anywhere to the opponent; balls potted on the foul stay down and count for nothing |
      | own + opponent ball | own ball counts, shooter continues; only the opponent's = turn ends, no foul |
      | call every shot | a pocket is called (not a ball); only an own ball in that pocket counts. Wrong pocket = turn ends, no foul |
      | the 8 | always called. Wins only in the called pocket on a legal shot. Loses if early (incl. with the last group ball), on any foul, with a scratch, or in another pocket. A scratch **without** the 8 is only a foul |

      Copy comes from `prText(verdict, names)` in the design's wording ("Foul · Hit
      opponent's ball first" / "Ball in hand to Bilal", "Ayesha wins" / "Potted the 8 in
      the called pocket."), naming whoever fouled. **Problem 7 fixed:** the CPU scratching
      on the 8 now reads "You win" / "CPU scratched on the 8.". **Problem 6 fixed:** open
      table after the break, legal-break rule, the 8 on the break, called 8.
- [x] `rules-verify.js`, **80 assertions**:
  - 45 rule rows, one per case above, including the 21 Phase 0 BCA cases where they still
    apply (the two that pinned problems 6 and 7 now pin the fixes)
  - 3 contract checks (the judge mutates nothing, a new frame starts in the kitchen,
    only the log after the last strike counts), 9 copy checks, 10 table-helper checks
    (placement, re-spotting)
  - real shots on `pool-physics.js`: 40 breaks (40/40 legal at 75%, the verdict matches
    pot-or-4-rails on every one), a straight-in pot, the same pot called right and wrong,
    the 8 called right and wrong, a scratch, a short tap with no rail
  - whole frames played by a ghost-ball shooter with ball in hand: **300 frames, 18,023
    shots, no invariant broken** (groups complementary and fixed once set, a foul always
    hands ball in hand across, the 8 never down while the frame goes on, a re-spot never
    overlaps); 299/300 reach the 8. 44 s at 300, 6 s at the default 40
- [x] `verify-all.js` runs it as *Pool rules*: **1,831 assertions, 0 failed**.

### Phase 3: renderer — done 2026-09-25
- [x] `pool-camera.js` (port of `Table.dc.html`). Checked against the design's own
      projection code: 2D identical, 3D identical to 1e-9 px apart from the deliberate
      left–right mirror (see the Decision log). Unprojection round-trips to 1e-12 u in
      every camera, including mid-blend and at Max size.
- [x] Cached table layer (per camera pose); balls rolled by the physics quaternion
      (stripes and number discs are projected spherical caps, digits foreshortened with
      their disc, hidden under 15 px as designed); contact shadows; the six-part cue
      with pull-back and a 90 ms strike; pocket drop (sink, shrink, fade over 250 ms).
- [x] **Guides on the real physics** (`pgGuide`): cue line to first contact with squirt,
      object-ball line with throw, and the cue ball's own path after contact, so draw
      bends back and follow runs through. Full / short / off. The prohibition sign on
      an illegal first ball. Every coloured stroke on the felt has a dark underlay.
- [x] Painted in the *Rendering spec* layer order. The 3D pockets are shafts clipped to
      rail cut ∩ felt cut, with banded, lamp-lit far walls and floor rings, all from
      `ppBuildTable`/`PP_DEFAULTS`, so drawn pockets are the playing pockets. No
      `ctx.clip()` anywhere: a convex polygon clipper does it exactly.
- [x] Camera director: aim (chase) → shot (650 ms ease to broadcast) → rest (500 ms ease
      back, following aim live, no jump) → ball in hand (cut to 2D). The 2D camera stays
      2D throughout. With the shot camera on *Stay 3D* it stands up into the survey pose
      (`pcSurvey`: the whole table fitted in 3D from the shot's heading, 900 ms), holds
      450 ms once balls stop (less after a soft shot that barely rose), then orbits back
      to the chase pose in 750 ms.
- [x] DPR: the renderer draws in CSS px under a `dpr` transform; the prototype uses a
      backing store ×`min(devicePixelRatio, 2)`. Felt ramps for green, red, blue and grey.
- [x] `render-verify.js`, **73 assertions**, in `verify-all.js` as *Pool render*
      (1,897 total, 0 failed). Visual checks use `snapshot.js` (16 scenes in real
      Chrome) instead of `preview.js`, whose rasterizer flattens gradients.
- [x] `pool-table.html`: a playable prototype (renderer, camera, physics and rules with
      a stand-in HUD) for testing by feel. Driven in headless Chrome through ball in
      hand, a break and several shots with no page errors.
- [x] First round of the user's feedback: the cue stays as designed; aiming keeps
      working outside the canvas; power along the shot line both ways, always within
      the bounds; the *Overhead / Stay 3D* shot-camera switch.
- [x] The user's test of those changes: "Its a pass."

### Phase 4: HUD, controls, layouts — done 2026-09-29
Built as `pool-dev/` modules and exercised on the prototype page; they go into the
userscript with the input in Phase 5 (Decision log). The host-side items are listed at the
end, since they belong to that splice.

- [x] `pool-hud.js` (`ph*`), in three layers:
  - `phModel(game)`: pure. A game snapshot becomes every string, tag, flag and tone the
    HUD shows, so it is tested in Node against the design's states.
  - `phBuild(root, { layout, on, canvas })`: the DOM, compact (`Main.dc.html`) or Max
    (`Max.dc.html`). It adopts the host's existing canvas.
  - `phRender(hud, vm)`: applies a view model, touching only what changed.
- [x] Every `InMatch.dc.html` variant:
  - player cards with group trackers (potted balls dim) and `FRAMES`
  - `TO SHOOT` / `18s` / `BALL IN HAND` / `TO BREAK` / `FOUL` tags
  - the shot-clock bar, hot and pulsing in the last 5 s
  - camera toggle (`2D · AUTO` in ball in hand), group pill, lean slider with the pitch label, power gauge (hot ≥ 85%, padlock until a call)
  - spin presets, hint pill, `Overlaps a ball` / `Behind the head string only` chip
  - 3D pocket mini-map
  - foul toast replacing the toggle and pill
  - `Pass to <name>` / `<NAME>'S READY` replacing the footer
  - frame-over dialog
- [x] Max layout: cards in the header with avatars (CPU chip), the frame count, trophy, mode, reset, exit; overlays scaled as designed (`2D TOP-DOWN` / `3D AIM`, 72 px spin, `Your shot · Solids`).
- [x] `pool-theme.css`: `--pool-*` tokens for Glassmorphic dark, Glassmorphic light (`prefers-color-scheme`) and Cyberpunk, and component CSS that reads only `--pool-*`. It drops into the style template (12-space indent, no backticks).
- [x] Canvas bridge `phThemeTokens(hud)` (the plan's `poolThemeTokens`): the renderer's felt accent, hot colour and font from computed `--pool-*`, normalised to hex, cached until `phThemeChanged(hud)`.
- [x] Ball in hand (the user's review): the drag is clamped to the felt and, on the break, to the kitchen (`prClampPlace` in `pool-rules.js`), and **Move cue ball** (`vm.replace`, `on.replace`) goes back to placing until the shot. Both driven in Chrome: dragged 300 px past the head string and off the top of the canvas, the ball sat on the string and the top cushion with no warning; after *Move cue ball* the clock held for 2 s in hand, then ran on.
- [x] Shot clock: `prTimeout` in `pool-rules.js`. Running out is a foul with ball in hand to the opponent, as in today's game; on the break it passes the break across. The clock waits for the hand-off and for ball in hand.
- [x] `hud-verify.js`, **57 assertions**, in `verify-all.js` as *Pool HUD* (1,968 total):
  - every design state through `phModel`
  - no design hex or font in pool code
  - `clip-path` only on buttons, no `filter`
  - every `--pool-*` defined
  - Cyberpunk redefines everything light mode sets
  - `--rt-*` only under `.retro-theme`
- [x] `pool-table.html` became the theme harness. It uses the real `cyber-theme.css` and `cyber-hud.js` with Glassmorphic / Cyberpunk, the palettes and the four shapes; light mode follows the OS. It adds Vs CPU / 2 Players, the shot clock and the Max view.
- [x] `snapshot.js`: 34 scenes (every design state, light mode, Cyberpunk, both Max views, Stay 3D, the placed cue ball) plus `--check`, an in-browser audit per scene: **391/391**. It checks:
  - no filter or clip-path on the viewport's ancestors
  - the 72 / 52 px rows and the 368:412 and 1232:672 viewports
  - every overlay inside the table, no overlapping controls (*Move cue ball* against the hint, gauge, spin, toast and padlock), no clipped labels
  - tokens resolve, the bridge's colour is the Cyberpunk accent, and the backing store is CSS size × dpr
- [x] Driven in headless Chrome with real mouse events:
  - camera toggle, spin, lean, and Max open and Esc close (with the canvas moved across)
  - a foul in 2 Players showing the hand-off
  - READY restoring the footer, and the mode switch
- [x] The user's test in `pool-table.html`: "testing passed" (2026-09-29).
- [x] **At the Phase 5 splice (host side)**, all done in Phase 5:
  - the panel DOM replaces the pool scoreboard and control blocks ([:19649](AttendanceTimeCheckerPlus.js#L19649), [:19757](AttendanceTimeCheckerPlus.js#L19757)); the header keeps `#game-title` and the trophy button
  - `toggleGameMaxModal` gains `cfg.build(panel)`, Ludo's Max byte-identical. Pool's Max root copies the widget's `retro-theme` + shape classes and `applyCyberTokens`, as the host does for PiP
  - `poolOnThemeChange()` → `phThemeChanged` + table-cache reset, from `applyCyberpunkTheme` / `clearCyberpunkTheme`, the colour pickers and the `prefers-color-scheme` listener
  - ⚙️ *Shot camera: Overhead / Stay 3D* as `userPreferences.poolShotCam` (gap decision 9)

### Phase 5: input and the splice — done 2026-09-29
v2 replaces v1 in the userscript. The engine block is now the seven modules in load order
(physics, rules, camera, render, HUD, the stand-in CPU, the controller), and
`pool-theme.css` is a second spliced block right after the Cyberpunk theme. v1 is frozen
in `pool-dev/v1/` for `baseline-check.js`.

- [x] `pool-game.js`, the controller (the prototype's loop, made the real thing):
  - input on pointer events: 3D rotate-aim (0.3°/px, Shift 0.05°/px) that keeps following
    past the table's edge, 2D point-aim, ←/→ fine aim, along-the-line power, ball-in-hand
    drag with the kitchen clamp, *Move cue ball*, pocket calls, spin presets, lean
  - **Esc** cancels a power stroke and stops the key there; with no stroke it passes on
    and the Max modal closes itself. The host's Escape-resets-the-game no longer applies
    to pool (Decision log)
  - the fixed 60 Hz physics step every animation frame; drawing honours the FPS setting
    and skips the canvas when nothing on it changed
  - the shot clock (30 s, human turns only), the hot-seat hand-off, the frame-over dialog,
    NEW FRAME alternating the break
  - records and XP through the host's own helpers, **once per rack** (`rackId` /
    `awardedRack`): Reset or a new frame is a new rack, and a finished rack cannot pay
    twice. The win's per-mode split is seeded before the all-time count moves. Pot XP
    keeps today's rule until Phase 8
  - a frame in progress survives switching to another game and back
  - camera, lean and shot camera in `userPreferences` (`poolCamera`, `poolLean`, `poolShotCam`)
  - names: your leaderboard name (16 characters) or *You* against the CPU; *Player 1* /
    *Player 2* in 2 Players
- [x] `pool-ai.js`, a **stand-in CPU** until Phase 6, so Vs CPU works on the new engine:
  direct pots only, checked on a cloned world with the real physics and `prJudge`, aim
  noise 0.2° and power 3%, time-sliced in 3 ms steps. Self-play: pots on 52% of visits,
  fouls on 6.3% (v1 today: 65% / 13.4%); without noise it pots 78%. It places ball in hand
  behind its easiest pot, calls its pocket when a call is required, and takes its turn in
  stages the player can follow: a beat, the cue turning onto the line, the draw, the strike
- [x] Host edits: `#pool-root` replaces `#pool-canvas`; the header keeps the title and the
  wins button; no controls row and no Play; `switchGame` calls `initPoolGame()` /
  `poolDetach()`; the four window bridges only the old buttons used are gone; the old
  `#pool-canvas` CSS is gone; `applyPreferences` calls `poolOnThemeChange()`; ⚙️ gains
  *Pool Shot Camera*; `toggleGameMaxModal` gains `cfg.build` (Ludo's canvas path unchanged)
- [x] **The compact HUD is fluid** (found by the real-host run): the widget's column is
  350 px on screens up to 1400 px, so the HUD gets 316, not the design's 368. The viewport
  keeps 368:412; the lean slider, gauge and padlock are anchored to its height (exactly
  the design's pixels at 368); under 360 px the toggle drops *· AUTO* and the card tag
  *BALL IN HAND* reads *IN HAND*; the panel caps at 420 px. Max stays the fixed 1280 × 800,
  scaled to the window
- [x] `pool-verify.js` rewritten for v2, **81 assertions**: both blocks byte-identical and
  in order; no v1 name left; the whole userscript parses and every engine name is
  declared once; the host wiring; the match headless (the clock, ball in hand, the CPU's
  turn, 6 whole frames each paying once and filed right, Reset / NEW FRAME / mode switch,
  pot XP per seat, the 2 Players hand-off, Esc and arrows, the preferences); the stand-in
  CPU (a straight pot, legal placement, ≥ 90% legal and ≥ 60% pots without noise, the
  3 ms slices)
- [x] `host-run.js`: **the real userscript in Chrome**. It serves a stand-in portal page at
  the portal's URL over DevTools (one attendance row, the script inline, every other
  request failed), then boots the widget, opens pool, places and breaks by mouse, Esc
  mid-stroke, lets the CPU play, opens and closes Max, switches Glassmorphic dark →
  Cyberpunk → light with the layout audit in each (compact and Max), switches games and
  back, sets the shot camera in ⚙️, and records a win through the real host helpers:
  **79–90 checks, 0 failed** (the audit's overlap pairs count only what is on screen).
  `--open` runs the same fake portal in a visible Chrome, to play by hand
- [x] **Light mode across the widget** (the user's go-ahead, 2026-09-29). `host-run.js` gained a
  contrast audit: every visible text composited over what is really behind it (gradients
  by the average of their stops), in light mode, on the widget, every game's panel, ⚙️ and
  pool's Max; under 3:1 fails. It found, and these now pass:
  - every game's header score button: white on the white header (no light style at all)
  - the header's side figures (lines, level, mode, turn) at 2.9:1
  - ⚙️ and Ludo's Max panel: their light rules were scoped under `.attendance-summary`,
    but both live on `<body>`, so they never applied; now keyed off the page not being in
    Cyberpunk (pool's Max panel excluded), including the Ludo rule rows
  - the worked and remaining timers, the XP milestone, *View All*, the image placeholder,
    the prayer counter's labels
  - pool's own: the card tags and the Max trophy use `--pool-accent-ink` / `--pool-hot-ink`,
    deeper in light mode, while the overlays on the felt keep the bright accent
- [x] **Free spin** (the user's test): the tip goes anywhere inside the miscue ring instead of
  five presets (gap decision 3, revised). `hud-verify.js` +7 (the clamp, labels, readout,
  preset lighting, when the picker opens); `pool-verify.js` +4 (the strike uses exactly the
  placed tip, then it resets); `host-run.js` +7, by real mouse: drag the small dot, open
  the picker, press on the big ball, a chip, ↑ without turning the aim, close on the table;
  `snapshot.js` +7 picker scenes (normal, free, Max, Cyberpunk, light, two narrow)
- [x] Other suites: `integration-verify.js` (pool's Max through `cfg.build`),
  `host-smoke.js` (+5: the build path hands over an empty panel, moves no canvas,
  unbuilds once), `snake-verify.js` (the pool header reads only `poolMode` now)
- [x] `snapshot.js` gains 15 `narrow:` scenes at the widget's 316 px: **649/649** across 49
- [x] `verify-all.js`: **1,962 assertions, 0 failed**
- [x] **`pool-table.html` runs the real controller** (the user's ask: keep it alongside). It loads
  `pool-ai.js` and `pool-game.js` on stand-ins for the host, and its scenes set design states
  straight onto `poolS`, so it can no longer drift from the widget. Running it found two real
  widget issues, both fixed: a name beside its card tag was cut off in 2 Players (*Player 2*
  is longer than the design's *Bilal*), so a card whose name would not fit shows the tag's
  short form (*SHOOT*, *BREAK*, *IN HAND*), measured only when name, tag or width change; and
  the hand-off strip's *Pass to Player 2* was squeezed by *PLAYER 2'S READY*, so when tight the
  button reads *READY*. The narrow column also slims the frames column and card padding.
  The audit gained a hand-off overflow check: **768/768** across 56 scenes
- [x] Two settings on `poolS` for later phases: `guideMode` (full / short / off) and `callEvery`
- [x] The user's test in the widget: "The testing passed" (2026-09-29)

### Phase 6: CPU v2 — done 2026-09-29
- [x] `pool-ai.js` replaces the stand-in: one planner, four tiers (`PA_TIERS`). Candidates
      from geometry (direct pots, one-rail banks, one-rail kicks, two-ball combos), each with
      a make probability for the tier's own aim error; the best played out on a cloned world
      and judged by `prJudge` (a line that scratches, fouls or drops the 8 early is never
      hit); position scored on the next shot (pro: the next two); the top three replayed with
      the tier's noise so a line that fouls when a little off is marked down; safeties and
      escapes (full and half-ball hits, one-rail kicks) when no pot is likely enough; then
      the tier's execution noise. Time-sliced in 3 ms steps.
- [x] **The throw and squirt correction.** The planner steps a copy to the first contact,
      reads the object ball's real departure and turns the cue by the error over the cut's
      gain. Median departure error ~1.8° → ~0.02°; 192 of 199 candidate lines pot on the real
      physics, against 162 without it. (The first version had the sign wrong and made it
      worse; the measurement caught it.)
- [x] Four tiers, **adaptive by default**, locked when a frame starts (`poolCpuTier`), from
      a new vs-CPU record (`poolCpuRecord`): under 5 frames Normal, under 35% Easy, over 65%
      Hard, never Pro. Pinnable in ⚙️ (*Pool CPU*, `userPreferences.poolDifficulty`) and in
      the Game mode sheet.
- [x] **Pro calls every shot, both seats**: `frame.callEvery` for the frame; the CPU names the
      pocket its line targets, and your shots need a pocket tap (the Phase 4 input flow).
- [x] **The Game mode sheet** (ModeSheet): the footer's mode button and the frame-over
      dialog's *Change difficulty* open it. Vs CPU with the difficulty list (Adaptive carries
      a *NOW NORMAL* chip), or 2 Players with *START 2-PLAYER FRAME*. A difficulty picked
      before the break applies at once; after it, from the next frame, and the sheet says so.
      Tournament joins it in Phase 7.
- [x] The CPU card reads *Adaptive · Normal* (or the pinned tier); the frame-over dialog's note
      says what adaptive does next (*Adaptive steps up to Hard next frame*).
- [x] `balance-check.js` (the Phase 0 method: the human model is the hard planner's shot
      selection with the profile's noise; seat 1 always breaks). 40 frames per cell, CPU
      wins over decided frames, Wilson 95%:

      | tier | vs mirror | vs skilled | vs casual | vs novice | pots / visit | fouls / visit | ms / shot |
      |---|---|---|---|---|---|---|---|
      | easy | 0.0% [0–9] | 10.0% [4–23] | 52.5% [37–67] | 82.5% [68–91] | 33.0% | 15.5% | 12 |
      | normal | 12.5% [5–26] | 40.0% [26–55] | 85.0% [71–93] | 92.5% [80–97] | 47.2% | 8.8% | 64 |
      | hard | 15.0% [7–29] | 80.0% [65–90] | 97.5% [87–100] | 97.5% [87–100] | 59.4% | 6.0% | 101 |
      | pro | 65.0% [50–78] | 92.5% [80–97] | 97.5% [87–100] | 100.0% [91–100] | 75.2% | 4.5% | 135 |
      | v1 today | 53.4% | 61.4% | 72.3% | 75.1% | ~65% | 13.4% | – |

      Hard beats v1 against skilled and casual (the Phase 0 bar), pro beats hard, and the
      tiers step up evenly. **The foul targets are not met**: hard averages 6.0% a visit
      (target under 5%; 4.6% against skilled, more against casual players, whose messier
      tables leave more snookers to escape) and pro 4.5% (target under 2%), mostly *hit the
      wrong ball first* on escapes. Both are far under v1's 13.4%. Carried to Phase 9.
- [x] Tests: `pool-verify.js` (the tiers, the straight pot for every tier, the throw
      correction, hard's legal and pot rates, placement, time slicing, adaptive, the lock,
      pro's calls, the sheet, the record), `hud-verify.js` (+8: the sheet), `host-run.js`
      (the sheet and the ⚙️ pin by real mouse), `snapshot.js` (+9 sheet and pro scenes),
      `integration-verify.js` (Pool CPU select, scoped apart from Ludo's)
- [x] The user's test in the widget: "verified the changes and they're good" (2026-09-29).

### Phase 7: tournament (humans only) — done 2026-09-29
- [x] `pool-tour.js`, the pure bracket model: sizes 3–16 padded to 4/8/16 with byes to the
      top seeds, the standard seeding order (every other pair flipped, as the design draws
      it), a reproducible shuffle, winners fed forward by index, the lower seed breaking
      first and breaks alternating, frames recorded without mutating the saved object,
      field-by-field validation of a save, and the trophy cabinet. `tour-verify.js` (41).
- [x] `pool-tour-ui.js`, the screens from the design: setup (name, stepper, names with
      YOU, race-to columns, clock / guideline / call segments, shuffle), the bracket (compact:
      a round per tab, match cards with LIVE / NEXT / DONE / BYE, the whole tree under it;
      Max: the full tree at the design's geometry, the path highlighted), the match intro,
      the result, the champion (compact and Max), the trophy cabinet, and the resume,
      abandon and pause dialogs. Names are escaped.
- [x] In the match: the tournament header (name, *Semi-final · race to 2*, *FRAME n*), seeds on
      the cards, Bracket / Pause for Mode / Reset (compact and Max), the hand-off on every
      seat change, the frame-over dialog's *NEXT FRAME* and *Bracket*. The Game mode sheet
      gains its Tournament tab: set up, or resume with Abandon, and the Trophy cabinet.
- [x] Persistence: `poolTournament` after every frame, with a whole-table snapshot after
      every shot and when the panel is left; the resume prompt on the first open of a page;
      corrupt and other-version saves dropped behind a toast; a damaged snapshot restarts
      the frame. `poolTrophyCabinet` by normalised name, the last 20 tournaments.
- [x] Tests: `pool-verify.js` (+47: setup to champion headless, pause, leave, a reload
      mid-frame restoring the same table, corrupt / old / stale saves), `host-run.js` (+16:
      the whole flow by mouse in the real widget, through a real page reload),
      `snapshot.js` (+41 scenes: every screen and dialog, 4 to 16 players, Max, Cyberpunk,
      light, the 316 px column), `hud-verify.js` (the theme contract covers the screens).
- [x] From the user's test: the trackers kept the last frame's dots when a seat's group
      changed, so a potted ball could stay lit (fixed, and `snapshot.js` has a scene that
      catches it); an open table now lists each player's pots; calling a pocket is one small card
      bottom right (the map and the hint's line), with the pill giving the state only.
- [x] The user's test in the widget (2026-09-29).

### Phase 8: progression — done 2026-09-29
- [x] The XP table above, computed in `pool-game.js` and re-clamped in `awardGameXP` as
      Ludo's is: a CPU win 60 / 80 / 100 / 120 by the tier locked for the frame, a loss 15;
      2 Players 80 / 15 as before; a tournament match 80 / 15 for the YOU seat only (once per
      match; other matches, byes and titles pay nothing). Pot XP only for your pots against
      the CPU: 2 Players pays no pots (problem 8).
- [x] 📣 *Called It* (120 XP): beat the Pro CPU. Live from the award, and restored from
      `poolWinsByTier` after a wipe.
- [x] Tier leaderboard: `poolWinsByTier` (written under the vs-CPU win, keyed on
      `poolCpuTier`, not backfilled), `pool:{easy,normal,hard,pro}` in
      `collectGameModeBests` (read inline), the raise-only restore, `LB_BOARDS.pool.modes`
      `{ pro, hard, normal, easy, cpu: All-time, pvp: Hot-seat }` with the all-time note,
      `gameLbMode` (the tier being played; All-time in a tournament), and the wins button
      and Max trophy showing that tier's wins. Snake-suite assertions updated.
- [x] Sync bot (`sync.yml`, in `github-actions-bot/`): the monotonic per-key
      `gameModeBests` merge (RefleX keeps the smaller time; an omitted key is kept), shape
      validation (`game:mode` keys, finite non-negative whole numbers, RefleX may be
      fractional), and the tier-win growth bound against the `gameSessions` delta for Pool
      and Ludo (clamped with a warning, never flagged; skipped when a record adopts
      `gameModeBests` for the first time). `sync-verify.js` runs the real inline script
      headless: 28 checks, 14 of which fail on the bot as it was.
- [x] `BUILD_LABEL` v9; `host-smoke.js` (+6: Called It, the award clamp), `cyber-verify.js`
      (the label), `host-run.js` (+4: tier filing, XP, the button, Called It, the board).
      Phase 6's time-slicing check now forgives one step (a garbage-collection pause failed
      it about one full run in five); a stage that stopped slicing still fails it by ~8x.
- [ ] **The user pushes the bot first**, then installs the v9 userscript: the bot must be live
      before any client emits the tier keys.
- [x] The user's test in the widget (2026-09-29).

### Phase 9: polish and verification — done 2026-09-29
- [x] **CPU fouls to the Phase 6 targets.** `balance-check.js` now tallies fouls by the line
      played: nearly all came from the last resort, a blind roll at the nearest legal ball
      when snookered (hard 53 fouls in 62, pro 44 in 46). Hard and pro now sweep the cue
      round (1°, first contact only), keep the gaps where the first ball is legal and play
      the middle of each out (`sweep`); pro also replays its safeties for risk
      (`robustSafe: 3`). 40 frames a cell, seed 1:

      | tier | vs skilled | vs casual | vs novice | fouls / visit | ms / shot |
      |---|---|---|---|---|---|
      | hard | 65.0% [50–78] | 97.5% [87–100] | 97.5% [87–100] | 3.9% (was 6.0%) | ~111 |
      | pro | 97.5% [87–100] | 100% [91–100] | 97.5% [87–100] | 0.8% (was 4.5%) | ~149 |

      Like for like (seed 2, 100 frames, hard vs skilled): with the sweep 75.0% [66–82] and
      2.6% fouls, without it 60.0% [50–69] and 6.2%; the 80% seed 1 gave in Phase 6 was that
      seed. Easy and normal keep the blind roll: their fouls are part of their level.
      `pool-verify.js` pins the sweep on a real snookered position from balance play.
- [x] **Performance** (`perf-check.js`, headless Chrome's software canvas, so an upper bound
      on a laptop with GPU canvas): compact 3D, a full repaint while aiming 1.8 ms median
      (3.5 p95), a rolling shot 0.7 ms, an unchanged frame ~0; the 316 px column and 2D are
      lower. Was 5.0 ms median (6.6 p95) for the 3D repaint: the table no longer goes into
      its cache and back out while the camera moves, and ball numbers are cached images, not
      text. The 60 and 30 FPS settings give 60.5 and 29.5 draws a second.
- [x] **Accessibility.** Every control a keyboard or screen reader reaches has a name
      (`snapshot.js` audits it on every scene); every button and field in the HUD, the
      sheet and the tournament screens is reachable by Tab. Shooting stays with the mouse
      (see the Decision log): the only key the table takes is ←/→ fine aim, as before.
      The trackers carry their state in words for a screen reader
      (*Solids: 1, 3 on the table; 2, 4 potted*); solids and stripes differ by pattern, and a
      potted ball by brightness, not hue.
- [x] **Theme pass** (`theme-verify.js`): 36 states in Glassmorphic dark and light, compact
      and Max, and 10 states under every Cyberpunk shape × preset (312 loads): the layout audit
      (6,552 checks) and WCAG AA text contrast (4.5:1, large 3:1) on 11,244 texts, measured
      against what is really behind them (over the table, the canvas pixels). It found the
      dark accent and hot tags at 3.2–4.0:1, the light inks at 4.1–4.4:1, faint text at
      3.8–4.1:1, the hot button's white on red at 3:1 and the button sub-lines at 85%; all
      fixed in the tokens. Switching theme mid-frame repaints the canvas with the new accent.
- [x] **Portal verification** on `globalportal.mtbc.com` (the userscript only runs there):
      the user's test of the v9 userscript, 2026-09-29; keyboard shooting came out of it (see
      the Decision log).

---

## Snooker: the second game on the v2 table (Phases S0–S7)

> Status: `IN PROGRESS`, S0 done · Branch: `feat/snooker` (from `main` at `6c6af10`, the v2 merge) ·
> Scheduled 2026-09-29, after v2 shipped. This section replaces the old *Later: Snooker*
> note (its text is kept at the end of this section for reference).

### Why and what

v2 was built so a second game could share it. The physics is pure and deterministic and is
driven entirely by per-world config (`ppCreateWorld(overrides)`; R is only ever read from
`cfg.ballR`). The judge reads the physics event log. The CPU evaluates every line on a cloned
world through the judge.

The job is **full snooker, up to the 147 maximum**, on the same table component, with every
pool mode:

- Vs CPU (easy/normal/hard/pro, adaptive, pinnable)
- 2 Players hot-seat
- Tournament (humans only)

Pool vs Snooker is chosen in ⚙️. The 8-ball assumptions sit in `ppRack`, `pool-rules.js`, and
about a dozen hardcoded ids and counts in the controller, HUD, renderer and AI. So the work
is:

1. a seam
2. a snooker table, rules and CPU behind it
3. the HUD, tournaments and progression generalised over both games

### One space, two games

Pool and snooker **coexist in the same space**. Nothing is forked:

- **Userscript.** Both games use the one engine block between the `POOL ENGINE` sentinels,
  the one `#pool-root` panel, game switcher button 7 and shortcut `7`, one Max modal, and the
  one theme block.
  - The host sees one game, `pool`. It asks the block for the title (`poolTitle()`) and the
    wins button.
  - The ⚙️ *Cue Game* row picks the game. Everything in the panel then belongs to that game:
    its modes, its tournament, its cabinet and its records.
- **Harnesses.** The existing pages gain a game switch; no new pages:
  - `pool-table.html` (the widget's own controller on host stand-ins):
    - a *Game* select (8-Ball Pool / Snooker) that writes `userPreferences.poolVariant` and
      calls `poolSetVariant()`, exactly as ⚙️ does
    - a *Reds* select (15 / 10 / 6)
    - the *Call every shot* toggle, shown for pool only
    - `snooker:` design scenes next to pool's (break-off in the D, nominate, free ball, put
      back, snookers required, frame over, Max)
    - `?game=snooker` to open on snooker
    - the XP log shows snooker awards
  - `pool-harness.html` (the live physics): a *Table* preset select (Pool / Snooker) that
    swaps `PP_DEFAULTS` for `PS_TABLE`. It rebuilds the knobs with snooker's ranges, racks
    with `psRack` (reds 15/10/6), draws the D, spots and baulk line, and adds an *Acceptance*
    button that fires the pocket-window probe lines.
  - `snapshot.js`, `theme-verify.js` and `perf-check.js` drive the same `pool-table.html` with
    `?game=snooker` scenes.
  - `host-run.js` drives the real widget and switches game through ⚙️.
  - `load.js` loads both games in one scope (`game(opts)` gains `opts.variant`).
  - `balance-check.js` stays pool's; `snooker-balance.js` is its sibling on the same loader.

### Review of this plan against the shipped v2 (2026-09-29)

| # | Finding | Action |
|---|---|---|
| 1 | The status line still said *Snooker is a later, unscheduled mode · Branch: `feat/pool-v2`*, and v2 is merged to `main` | Updated (this commit) |
| 2 | The old note said *carries over as is: … the pocket jaws model*. The jaws are straight segments, and authentic rounded cuts need **arc colliders** (new code, guarded so pool never runs it) | S1 |
| 3 | The old note said *the renderer's table and ball drawing carry over*, but several sizes are absolute and only right at R = 14: the camera `top = cfg.ballR + 2` (equal to the rail height only by coincidence), cue width 3.3→8, pull-back `8 + 1.1·power`, shadow offset (+4, −5), and pocket rings `r + 12`. The table cache key has no variant either | S0: R-relative (`k = R/14`, so pool stays identical) |
| 4 | The physics runs at **1 u = 2.54 mm** (gravity 3862), a 9 ft bed. True snooker scale on the same bed is 1 u = 3.569 mm, so gravity and top speed are rescaled | S1 `PS_TABLE` |
| 5 | The ❓ on ball size is answered: true scale, no zoom, Max is the clear view. *The miss rule and re-racks stay out* is confirmed. **New:** the put-back choice, which the old note did not list | User decisions below |
| 6 | Unticked v2 items: Phase 1 *break-pot tuning (open)*; Phase 8 *the user pushes the bot first* (v9 has shipped since) | Confirm the bot's state before S6; snooker's bot change stacks on it |
| 7 | Hazard: the pool case in `checkGameAchievements` unlocks *Called It* on any win with `tier === 'pro'` (host :13349). If snooker reused the `'pool'` XP type, a Pro snooker win would unlock it | S6: snooker gets its own `'snooker'` type |
| 8 | Existing bug: ⚙️ is built once (`createSettingsModal` :21351), so the *Pool CPU* select goes stale after the Game mode sheet changes the difficulty | S3: every `[data-pref]` control re-syncs on open |
| 9 | The Context's line references (`:1749-4762` and others) are from before the extraction; the engine block is now :2432–7372 | Cosmetic, left as history |

### User decisions (2026-09-29)

| Topic | Decision |
|---|---|
| Scale | **True scale**: R ≈ 7.36 (52.5 mm on a 3569 mm bed), authentic narrow pockets with rounded cuts, markings at true positions, on the same 1000 × 500 bed |
| Compact 2D | **No zoom.** Whole-table 2D with ~2 px balls; **Max is the clear view**. 3D is snooker's default camera |
| Fouls | Standard values (min 4, max 7). After any foul the incoming player chooses **Play** or **Make ‹name› play again** (and **Free ball** when snookered); the CPU decides for itself. **No miss rule.** A cue ball in-off gives ball in hand **in the D**; otherwise play from where it lies |
| Nomination | **Tap a colour every time** you are on a colour (after a red) or on a free ball; the power gauge padlocks until you do. The clearance (yellow→black) needs none |
| Reds | **15 / 10 / 6**, 15 by default and the only count where a 147 is possible. ⚙️ sets it for quick play and tournament setup for tournaments |
| Leaderboard | Own **Snooker** board: Pro/Hard/Normal/Easy/All-time/Hot-seat wins, **plus a High break tab** (best break vs CPU). 💯 *Century* and 🏅 *Maximum* (147, vs CPU, 15 reds). The bot bounds the new keys and caps a break at 155; it is pushed before the client |
| XP | Vs CPU win, easy→pro: 15 reds 90/120/150/180; 10 reds 75/100/125/150; 6 reds 60/80/100/120. Loss 20. Break bonus vs CPU: +10 for 50+, +25 for 100+, +50 for a 147, best break only. At most 230 a frame (the bot allows 250). 2 Players and tournaments pay as pool (80/15). No per-pot XP |
| Selector | Pool / Snooker in the ⚙️ settings tab |
| Harness | **The existing harnesses host both games** (see *One space, two games*) |

### Implementer's calls (each is easy to flip)

| # | Call | Why |
|---|---|---|
| 1 | Ball ids: 0 is the cue; a colour's id is its value (yellow 2 … black 7); reds are 8…22 (8…17 for 10 reds, 8…13 for 6) | Value lookups are free, and no id is shared with pool's meaning of 8 |
| 2 | Everything belongs to the selected game. Separate records, tournaments and cabinets; switching parks the frame in progress, and switching back restores it | The setting then means one thing: which game the panel is |
| 3 | Snooker quick frames survive a reload (`snookerFrame` at every shot boundary, removed before the award). Pool keeps today's behaviour | A 15-red frame is long |
| 4 | Shot clock 45 s in snooker quick play; tournaments offer 30 / 45 / 60 / off | Aiming at true scale in 3D is slower |
| 5 | Adaptive never climbs to Pro in snooker either | Pro is a challenge you choose, as in pool |
| 6 | A foul committed before nominating costs 7 (WPBSA). Only a timeout can cause it, because the gauge is padlocked | The rule book's value |
| 7 | On a tie, the black is re-spotted and played from the D; a seeded lot decides who goes first | Reproducible, like the rest of the frame |
| 8 | *Snookered behind the free ball* is a foul, except when only pink and black remain | Cheap to judge, and it is the rule |
| 9 | A touching ball that is a ball on counts as hit. There is no push-shot foul | The physics cannot tell a push |
| 10 | No diamonds on the snooker table | Snooker tables have no sights |
| 11 | Concede is offered to a human who needs snookers, with a confirmation. The CPU concedes by tier | 15-red frames can be long after they are decided |
| 12 | The break bonus pays on wins and losses vs CPU. Achievement XP: Century 150, Maximum 300, inside `AC_MAX_XP_PER_ACHIEVEMENT` (600), which is separate from the per-game budget | The sync gate counts achievements on their own |
| 13 | Tournament copy says *best of 2N−1* in snooker; `raceTo` is still what is stored | Snooker's convention, with no change to the model |
| 14 | Out of scope: miss, re-racks, nap, push/jump/double-hit fouls, "angled" free balls | The physics cannot produce most of them, and each would be an extra prompt |

### What the design specifies (revision `1790715495-3a1b`, 2026-09-30)

The user added snooker to the same Claude Design canvas from the prompt in
[Appendix B](#appendix-b-design-prompt-for-snooker). It is frozen in `pool-dev/ref/design/` beside
pool's artboards (56 files; `pool-dev/ref/README.md`). As with pool, **layout, components,
copy and table geometry are followed; colour and type map to the Glassmorphic and Cyberpunk
tokens** (*Theme mapping*). Pool's artboards are byte-identical in this revision; the shared
components only gained snooker branches.

**Artboard inventory.** 27 `Snk*` artboards, drawn as `snooker` variants of the existing
components:

| Row | Artboards | Component (variant) |
|---|---|---|
| In match (compact 400 × 640) | S1 Break-off in the D · S2 On a red, 3D · S3a/b Nominate (tap a colour / on the pink) · S4a/b Foul choice (CPU table / 2 Players, hand-off first) · S5a/b Free ball (three choices / nominate) · S6a/b Snookers required / Concede · S7 The colours · S8a/b Frame over win / loss · S9a Century notice · S9b Re-spotted black · S10 2D overview at true scale | `InMatch` (`snk*`), `Table` (`snooker-*` layouts) |
| Sheet and tournament | S11 Game mode sheet · S12 Setup · S13a/b Bracket compact / full · S14 Match intro · S15 Match in progress · S16 Match result · S17 Trophy cabinet | `InMatch` (`snkMode`, `snkLive`), `TournamentSetup`, `BracketCompact`, `BracketFull`, `BracketTree` (`format: 'bestof'`), `MatchIntro`, `MatchResult`, `TrophyCabinet` (`game: 'snooker'`) |
| Full view (1280 × 800) | S18 On a red · S19 Nominate · S20 Frame over | `Max` (`snkRed`, `snkNom`, `snkOver`) |

**The table** (`Table.dc.html`, layouts `snooker`, `snooker-break`, `-nominate`, `-free`,
`-late`, `-colours`, `-black`, `-empty`). The design's y is down-screen; ours is up, so its
+y is our −y:

| | Design | Notes |
|---|---|---|
| Balls | R 7.36, plain; red `#B3202A`, yellow `#E8C21E`, green `#1F7A3F`, brown `#6B3F22`, blue `#1F4FB5`, pink `#E88FA8`, black `#121314` | materials, theme-independent |
| Markings | baulk line x −293.5 across the bed; D r 81.8 (a 24-segment half-circle toward the baulk cushion); six 2 u spots: brown (−293.5, 0), yellow (−293.5, −81.8 ours), green (−293.5, +81.8 ours), blue (0, 0), pink (250, 0), black (409.2, 0); no diamonds | in faint ivory, as pool's spots |
| Corner pocket | hole at (±503, ±253), r 17; cushion noses end 17 u from the corner (mouth 17·√2 ≈ 24 u) | **replaces** the plan's estimate (throat 24.1, cut r 7, jaw 45°, offset 7, r 13.5) |
| Middle pocket | hole at (0, ±259), r 15.5; noses end 14.5 u either side of centre (mouth 29 u) | **replaces** throat 29.4, cut r 10, jaw 75°, offset 9, r 14.5 |
| Cushion ends | a **quarter-round of radius 12** (the cushion's depth) at every nose end, centred on the rail line behind the nose, from the nose tip to the rail | the rounded cut; the arc colliders model exactly this |
| Heights | rail top 16, nose 10: **pool's**, unscaled | the plan's `railZ 16k / noseZ 10k` is dropped; 10 u is 1.36 R, close to a real snooker nose |
| Camera and cue | the chase camera's 110 → 420 distance and pool's cue (width 3.3 → 8, pull-back 8 + 1.1·power, lift R + 1.5), **unscaled** | S0 scaled both by R/14; S1 takes that back for snooker (pool is k = 1 either way) |
| Shadows | offset (R·0.29, R·0.36), r 1.08 R | = S0's ×k; pool keeps its exact (4, 5) |
| Nominated ball | an accent ring of radius r + max(3 px, 0.4 r) | |
| Ball in hand | the D tinted and outlined like the kitchen; the note *Inside the D only* | the clamp keeps it unreachable, as pool's kitchen note is |
| Rack | apex 265.7, rows 12.75 apart, 14.8 across | illustrative; the physics rack is touching (`psRack`) |

**The compact panel** (`InMatch`):
- **Vertical rhythm.** Snooker's panel is tighter so the tracker row fits in 640: padding
  12 / 16, gaps 8, header 32, footer 48; the table viewport stays 368 × 412.
- **Header.** A red-ball mark, *Snooker*, and the wins pill.
- **Cards** (72 px). Name, record, and a third line with the tag (*TO BREAK*, *FOUL*,
  *YOUR CHOICE*, *BALL IN HAND*) or *BREAK 34*. The score sits at 28 px on the outer side, in
  the accent's light tone when active. *FRAMES* is 44 px wide.
- **Tracker row** (20 px).
  - Left: a red dot with *REDS × 9* (dimmed at 0), then six 9 px colour dots (0.22 once
    potted, an accent ring on the ball on).
  - Right: *99 REMAINING*. With snookers needed it reads *43 LEFT*, with a hot
    *SNOOKERS REQ. 1* chip and a *Concede* button. The row's aria label reads it all out.
- **Chips.**
  - A 160 px card in the bottom-right slot: a 3 × 2 grid of 44 px rows, 30 px balls carrying
    their value (dark ink on yellow and pink, light on the rest).
  - The caption reads *Tap a colour*, then *Drag to shoot*.
  - While it shows, the gauge moves up to top 118 with the padlock at 96, and the hint is
    hidden.
- **Pill.** *Break-off · in the D* · *On a red* · *Nominate a colour* → *On the pink* ·
  *Free ball* → *Free ball · Pink* · *On the yellow* · *Re-spotted black*.
- **Foul toast.** It is replaced by the choice while the choice is pending.
  - Text: *Foul · 6 to Bilal* / *Hit the pink first*.
  - Buttons: a row of 44 px buttons, the first (*Play*) primary. The free-ball case reads
    *Snookered on every red · free ball*, with *Play* · *Free ball* · *Make Ayesha play
    again*.
  - In 2 Players the hand-off comes first; the toast reads *Bilal chooses how play
    continues* until *BILAL'S READY*.
- **Frame over.**
  - Reasons: *Potted the black.* / *CPU won on the re-spotted black.*
  - A two-up stat row: *SCORE 72–41* and *HIGH BREAK 58 · You*.
  - Record and delta, the adaptive note, *NEW FRAME* and *Change difficulty*, with slightly
    tighter padding (16 / 10).
- **Notices.**
  - Century: a trophy icon in the accent, *Century break · 104* / *Ayesha keeps the break
    going*.
  - Re-spot, an info toast: *Scores level · re-spotted black* / *Ayesha has ball in hand in
    the D*.
- **Concede.**
  - An alert dialog: *Concede the frame?* / *Bilal wins 68–22*.
  - Actions: *CONCEDE* (hot) and *Keep playing*.
- **Game mode sheet.** Easy *Pots the simple ones · leaves chances*; Normal *Builds small breaks ·
  plays some safe*; Hard *Plays position and safety · regular 50s*; Pro *Hardly misses ·
  centuries*.

**Max** (`Max`). Cards 250 px wide with an avatar and a 34 px score; the tracker row centred under
the header; chips in a 212 px card (58 px rows, 42 px balls); padding 12 / 24 / 16, gaps 8;
the pill *Bilal's shot · On a red*.

**Tournament.**
- **Setup.**
  - The kicker reads *SNOOKER · HUMANS ONLY*.
  - *FRAMES PER ROUND · BEST OF*, offering 1 / 3 / 5 / 7 / 9. Defaults: 4 players 3 / 5,
    8 players 1 / 3 / 5, 16 players 1 / 1 / 3 / 5. These are race-to 1–5, and pool's own
    defaults.
  - Shot clock 30s / 45s / 60s / Off; *Reds* 15 / 10 / 6 in place of *Call pocket*.
- **Bracket.** *CITY OPEN · SNOOKER*, *BEST OF 3* (`BracketTree` `format: 'bestof'` prints
  2N − 1); the full view reads *SNOOKER · 8 PLAYERS*.
- **Intro.** *Ayesha breaks off*, *Best of 3*, *· 15 reds*.
- **Result.** One row per frame (*FRAME 1 · Ayesha · 74–32*), a *HIGH BREAK · Ayesha · frame 3 ·
  61* row, and a 112 px mini tree.
- **Cabinet.** Titled *Snooker*, with the kicker *TROPHY CABINET · THIS COMPUTER*.

**Calls the artboards leave open** (decided here):

1. **The CPU as the chooser.** The design shows a human choosing. When you foul against the
   CPU, the CPU's card tag reads *CHOOSING* for its 700 ms beat, then a notice names the
   choice (*CPU plays on* / *CPU takes the free ball* / *CPU puts you back in*).
2. **Concede's touch target.** The drawn button is 20 px tall inside the 20 px row. It keeps
   that look with a 44 px hit area (an invisible pad reaching into the gaps above and below),
   so the rule of 44 px targets holds.
3. **Narrow labels (316 px column).** The long choice *Make Ayesha play again* falls back to
   *Put back* when the row would overflow, as *BILAL'S READY* falls back to *READY*.
   *SNOOKERS REQ. n* keeps its full form; *n LEFT* is already the short form of
   *n REMAINING*.
4. **Shot clock default.** Tournament setup defaults to 30s, as drawn. Quick play keeps
   45 s (implementer's call 4).
5. **The rack.** Drawn = played still holds: the renderer draws the physics rack, which is
   touching as a real rack is, so the design's 1 u gaps are not copied.

### Architecture

**Files**

| File | Change |
|---|---|
| `pool-physics.js` | + `ppBuildRoundedTable`, chosen when `cfg.pocketStyle === 'rounded'` <br> + `table.arcs` colliders in `ppNextEvent` / `ppSubStep` / `ppSeparate`, each guarded by `if (t.arcs)` <br> + `cfg.clusterGap`, falling back to `PP_CLUSTER_GAP` <br> + `cfg.railZ: 16`, `cfg.noseZ: 10` <br> Pool's path is untouched |
| `pool-rules.js` | `prCanPlace` / `prClampPlace` gain zone `'D'`: refused when `x > baulkX` or outside the circle; the clamp projects onto the baulk line or radially onto the arc |
| **new** `pool-snooker.js` (`ps*` / `PS_*`) | `PS_TABLE`, `psCreateWorld(reds)`, `psRack`, marks, rules, spotting, the snookered test, copy |
| `pool-ai.js` | game seam `paGame(frame)`: the pool profile is today's code verbatim |
| **new** `pool-snooker-ai.js` (`paSn*` / `PA_SNOOKER_*`) | the snooker CPU profile |
| `pool-render.js`, `pool-camera.js` | `pgBallLook`, marks, zone tint, rounded cushions and shafts, a ring on the nominated ball, R-relative sizes, the variant in the cache key |
| `pool-hud.js`, `pool-theme.css` | `phModel` reads `g.status`; `phPoolParts` / `phSnookerParts`; tracker row, colour chips, toast actions, dialog stats |
| `pool-game.js` | `POOL_GAMES` dispatch, `poolUseGame`, `poolSetVariant`, parking, nomination, choices, concede, snooker XP and records |
| `pool-tour.js`, `pool-tour-ui.js` | `t.game`, keys per game, normalised settings, `m.points`, `ptRaceText` |
| `load.js` | `FILES` = physics, rules, **snooker**, tour, camera, render, hud, tour-ui, ai, **snooker-ai**, game (still one engine block, since `reinsert.js` reads `FILES`); `PREFIX` gains `ps(?=[A-Z])\|PS_`; loaders `snooker()` and `snookerAi()` |
| `pool-table.html`, `pool-harness.html` | the game switch (see *One space, two games*) |
| **new** `snooker-verify.js`, `snooker-balance.js`, `snooker-break-tune.js` (offline) | tests, balance, the break-off script search |
| host `AttendanceTimeCheckerPlus.js` | ⚙️ rows and listener, `poolTitle()` in `updateGameTitle`, the switcher tooltip, `#snooker-lb-btn`, storage, `awardGameXP('snooker')`, achievements, `LB_BOARDS.snooker`, sync keys, `BUILD_LABEL` v10 |

The prefix `ps` has 0 hits for `\bps[A-Z]` and `PS_` in the userscript. `sr` is a live local
(`const sr` in `ppBuildTable`) and `sk` has 94 hits, so neither was used.

**The seam (S0): `POOL_GAMES` in `pool-game.js`.**

`const poolRules = () => POOL_GAMES[poolS.game] || POOL_GAMES.pool`. Each profile carries:

- **Identity:** `id`, `title`, `icon`, `lb`, `xpType`, `diffPref`, `clock`, and
  `keys{cpuRec, byTier, tour, cab, frame}`.
- **Table:** `world()`, `rack(w, rng, reds)`, `cueHome(w)`, `ballCount(f)`, `tracksPot(id)`.
- **Rules:** `newFrame(o)`, `status(f, w, seat)`, `judge(f, w, {call, nominate})`,
  `apply(w, v)` (pool re-spots the 8, snooker runs `psApplySpots`), `timeout`, `text`,
  `legal(f, w, id, nom)`, `validFrame`, and snooker's `choose` and `concede`.
- **Placement:** `canPlace`, `clampPlace`, `placeCue`.
- **CPU:** `cpu{tiers, names, plan, place, tierFor, adaptive, choose, concede}`.
- **Results:** `xp(ctx)`, `fileResult(ctx)`, `tourDefaults`.

These call sites route through it:

- the config build (159, 179, 698, which become `poolUseGame`)
- `poolNewFrame` 160–168, `poolLockTier` / `poolDifficulty` / the CPU record (94–139)
- `poolEndFrame` 200–226, with `poolAwardPots` for pool only
- `poolAfterTurn` / `poolSettle` 255–293, `poolLegalTarget` 296–302
- the CPU tick 332–342, the pot filter 393, the timeout 404
- `poolDraw` 437–457, `poolPlace` 535, `poolOnDown` 549, `poolOnUp` 589
- the tournament keys, snapshot and restore 778–849 (dropping the `=== 16` and `id !== 8` checks)
- the setup defaults 943 and 980, and the titles 1105 and 1123

`poolUseGame(game)` sets `S.game` and `S.cfg = R.world().cfg`, clears
`S.director / cache / W / H / drawKey / guide`, and selects `S.tour = S.tours[game]`.

- **HUD.** `phModel` stops calling `prStatusFrom` (104). It reads `g.status`, the difficulty
  list is `g.diffs || PH_DIFFS`, and the title is `vm.title`.
- **Renderer.**
  - `pgBallLook(variant, id)` returns `{cue, colour, stripe, number}` and is cached.
    `pgDrawBall` skips the caps, the discs and the digits when both are false.
  - The marks come from `table.marks` when it is present, else pool's two spots, so pool's
    table object does not change.
  - The diamonds are drawn unless `cfg.diamonds === false`.
  - The zone tint comes from `scene.zone`, with `scene.kitchen` kept as an alias.
  - The cache key is `[pose, felt, dpr, cfg.game || 'pool']`.
- **R-relative sizes** (k = R/14, so pool's k = 1 draws identically):
  - camera `top = cfg.railZ`
  - chase near distance `110k`
  - cue width and ferrule ×k, pull-back `(8 + 1.1·power)·k` (render 615, game 439)
  - shadow offset ×k, pocket rings `r + 12k`, `pgPocketMarks` projected at `railZ`
  - **revised by the design (2026-09-30):** the chase camera and the cue stay pool's size in
    snooker, so S1 takes the ×k off both, which changes nothing for pool; the shadow keeps it,
    and snooker sets `railZ` 16 so the wide shots fit the real rail

**Pool fingerprints** are taken on `main` before any change and hardcoded in
`snooker-verify.js` §0:

- a SHA-256 of `JSON.stringify(ppBuildTable(PP_DEFAULTS))`
- the final ball states of 20 seeded breaks and 50 fuzz shots
- `paPlan` shots for 4 tiers × 10 positions, with their `prJudge` verdicts

The `snapshot.js` PNGs must also be pixel-identical to `main`'s across all 56 scenes.

**Table and physics (`PS_TABLE`, 3.569 mm per unit)**

| Key | Value |
|---|---|
| Ball and cloth | `ballR` 7.36 (the design's) · `gravity` 2749 · `maxSpeed` 2240 (8 m/s) · `muRoll` 0.011 (tune 0.009–0.013) · `cushionE` 0.8 (tune toward 0.75) · `clusterGap` 0.26 · `railZ` 16 and `noseZ` 10 (pool's, as designed) · `diamonds` false |
| Unchanged (dimensionless) | `muSlide`, `muSpin`, `ballE`, `muBall`, `squirt`, `maxTip`, `noseRise`; `railWidth` 48 and `cushionWidth` 12, so the camera framing is unchanged |
| Corner pocket | `pocketStyle: 'rounded'` (the design's, 2026-09-30): nose ends 17 u from the corner (mouth ≈ 24 u), hole centre offset 3 (at ±503, ±253), capture r 17 |
| Middle pocket | nose ends 14.5 u from centre (mouth 29 u), hole offset 9 (at 0, ±259), r 15.5 |
| Cushion ends | a quarter-round of radius `cushionWidth` (12) at every nose end, centred on the rail line behind the nose |
| Markings | baulk line x −293.5; D r 81.8; brown (−293.5, 0); **yellow (−293.5, −81.8)**, on the right of the D seen from the baulk end; green (−293.5, +81.8); blue (0, 0); pink (250, 0); black (409.2, 0) |
| Rack `psRack(w, rng, reds)` | a 5-, 4- or 3-row pyramid with its apex at 250 + 2R + 0.05; only the reds are jittered; the colours sit exactly on their spots; the cue ball starts at (baulkX − 15, −40) with ball in hand `'D'` |

- **Rounded cut** (as designed). Each cushion runs straight to its nose end. There a
  quarter circle of radius 12, centred on the rail line directly behind the nose, turns the
  cushion from the nose tip back to the rail, and the arc ends inside the pocket's hole. The
  builder throws if an arc misses its hole, as pool's does for a jaw.
- **Arc colliders, not a polyline.** The arcs are true circle colliders. A polyline would
  give up to 2.8° of normal error and make every near-rail event check about 5× more
  expensive.
- **Pocket sizes come from the design** (2026-09-30), not from estimates. The acceptance
  windows in the tests measure how they play, and any tuning goes in the Decision log.
- **Absolute constants re-derived for R = 7.355** (snooker profile only):
  - `paClear` slack `2R − 0.26`
  - `paPocketTol` fitted from the measured windows
  - rail-hit clearances 30 / 25
  - `paBaseSpeed` floor 120
  - finish speed floor 40
  - safety speeds from `muRoll·g`
  - spotting analytic, not in 0.5 u steps

**Rules (`pool-snooker.js`)**

```
frame = { v:1, game:'snooker', reds, breaker, turn, isBreak, lot, scores:{1,2}, brk,
  high:{1,2}, fouls:{1,2}, shots, phase:'reds'|'colour'|'clearance', next:2..7,
  freeBall, ballInHand:'D'|null, touching:[ids],
  pending:null|{offender, chooser, options:['play','back'(,'free')]},
  respotBlack, over, winner, conceded }
```

- **Frame and judging:**
  - `psNewFrame({breaker, reds, seed})`
  - `psSummarize(log)` returns `{firstT, first:[ids sharing the first contact's t], pots,
    cueDown}`
  - `psJudge(state, world, nominated)`
  - `psApplySpots(world, v.spots)`
- **Choices and endings:**
  - `psChoose(state, 'play'|'back'|'free')`
  - `psTimeout(state, world)`
  - `psConcede(state, seat)`
- **Geometry:** `psSnookered(world, onIds)`, `psSpotPositions`
- **Copy:** `psText(v, names)`, `psChoiceText`
- **Status:** `psStatus(state, world, seat)` returns `{on:{ids, value, freeId},
  needsNomination, nominable, remaining, snookersRequired:{1,2}, pending, scores, brk,
  phase, next, redsLeft, colours:[{id, down}], high}`

The verdict is `{shooter, foul, fouls, reason, penalty, points, scored, frameOver, winner,
continues, nextTurn, ballInHand, options, freeBall, respotBlack, spots, notice, on, summary,
next}`. It is a superset of what the AI reads (`frameOver`, `winner`, `foul`, `continues`,
`next`).

| Situation | Ruling |
|---|---|
| Break-off | Ball in hand in the D, on reds; no other break rule |
| On reds | Hit a red first (reds hit together are fine); 1 point per red potted; then nominate a colour |
| On a colour | Hit the nominated colour first; score its value; it is re-spotted; back to reds |
| Last red potted legally | Any colour, nominated, which is re-spotted; then the clearance starts at yellow |
| Clearance | Yellow → black in order; potted balls stay down |
| Foul penalty | `min(7, max(4, ball on, every ball involved))`, never a sum. A foul before nominating is 7. The offender scores nothing; reds stay down; colours are re-spotted |
| After a foul | The incoming player picks **Play**, **Put back** (the offender plays from where the ball lies) or, if `psSnookered` after the re-spots, **Free ball**. They are on reds if any remain, else the lowest colour |
| Cue ball in-off | Ball in hand in the D for whoever plays next; no free ball |
| Free ball, reds remain | The nominated colour acts as a red: hit it first, it scores 1 and is re-spotted, then a colour. A free ball and reds potted together score 1 each |
| Free ball, clearance | Scores the value of the ball on, is re-spotted, and the same ball stays on. With the ball on also potted, it scores once |
| Snookered test | For each ball on, both tangent lines from the cue ball; a line is blocked by any ball not on within 2R. Snookered if every ball on has a blocked side. Cushions are ignored |
| Re-spot | Its own spot; else the highest-value free spot; else the nearest free point behind its own spot toward the top cushion; else in front. Highest value first, each placed ball occupying its spot |
| Frame end | The table is empty, or a foul on the last black. The higher score wins. A tie re-spots the black, played from the D, with the first player by seeded lot. Concession also ends it |
| Points remaining / snookers | Reds phase 8r + 27; the colour phase adds 7; clearance Σ next…7. Snookers = ⌈(lead − remaining) / max(4, lowest ball on)⌉ |
| Shot clock | A foul worth max(4, ball on), or 7 if no colour was nominated; the usual options |

Copy is in `prText`'s style: *Foul · 4 to Bilal* / *Hit the pink first* (· *Free ball*),
*Ayesha wins* / *74–51 · potted the black*, *CPU puts you back in*.

**CPU (`pool-snooker-ai.js` on the `paPlan` pipeline)**

- **Targets.** `paSnTargets` returns `[{ball, nominate}]`. The nomination rides with the
  candidate, and the CPU nominates its line.
- **Pot value.** EV = `p·(points + γ·Pos) − (1−p)·M − f·(penalty+3)`.
  - `Pos` weights the next ball on by its value: after a red, black and pink win; after a
    colour, a red is worth about 4.
  - `M` is the opponent's threat when the pot misses.
  - `f` is the foul rate in the noisy replays.
- **Safety.** EV = `−Threat + 1.5·[opponent snookered] − f·(penalty+3)`, with a 0.75 factor on
  the make probability when the cue ball is near a cushion. The candidates are the 3 nearest
  balls on × contact fractions × 4 speeds, followed by a refine pass.
- **Break-off.** A scripted `{place, cut, speed, tip}` for each reds count, plus its mirror.
  `snooker-break-tune.js` finds it offline; at runtime 1–2 trials verify it, with a local
  search of at most 24 trials as the fallback.
- **Choose** (`paSnChoose`): free ball, play or put back, by best make chance and safety EV.
- **Concede** (`paSnConcede`): easy never; normal when it needs more than 2 snookers in the
  clearance; hard and pro when they need more than 1, or more than 2 with 3 or fewer reds left.
- **Placement** (`paSnPlace`): a grid over the D. After N safeties in a row, an attack bias
  kicks in so frames don't stall.
- **Tiers.**
  - Aim σ is about ¼ of pool's: easy 0.30°, normal 0.12°, hard 0.05°, pro 0.02° (never 0).
  - Each tier also sets top/keep, spins, robust and `safeTrials`. There is no `callEvery`.
  - Slices are 4 ms. Target time per shot: easy 60 ms, normal 200, hard 450, pro 800.

`snooker-balance.js` target bands:

| Tier | Win vs casual | Mean break | Centuries / 100 frames | 147s / 100 frames | Fouls / visit |
|---|---|---|---|---|---|
| easy | 30–50% | 2–5 | – | – | ≤18% |
| normal | 55–75% | 5–10 | – | – | ≤10% |
| hard | 80–92% | 10–20 | 2–10 | – | ≤5% |
| pro | ≥92% | 20–40 | 15–50 | 0.3–3 | ≤2% |

**Controller and input (`pool-game.js`)**

- **State.** `poolS` gains `game`, `nom` (−1), `parked{pool, snooker}`, `tours{pool, snooker}`
  and `confirm`. The pending choice lives in the frame state, so it survives snapshots and the
  CPU.
- **Nomination.**
  - While a nomination is needed, the power press is refused and the gauge padlocks.
  - The main way in is the **DOM colour chips** (`poolOn.nominate(id)`). In 3D and Max, a
    press on a nominable ball also works. Its hit radius is `max(12 px, R·scale)`, and it only
    applies while nothing is nominated, so it never swallows a power press.
  - The CPU nominates through `shot.call`.
- **Choices.**
  - When the CPU fouls, the toast shows the buttons at once. In hot-seat the hand-off comes
    first.
  - A CPU chooser takes a 700 ms beat, then shows a notice toast.
  - `poolCanAct` is false while a choice or the concede confirmation is open, and the clock
    pauses.
- **Ball in hand in the D.** The break-off and an in-off start in phase `'bih'`, zone `'D'`.
  The camera cuts to 2D as it does today, and *Move cue ball* is unchanged.
- **Precision at true scale.** Shift fine aim is 0.0125°/px and ←/→ is 0.025°. The power curve
  is tuned in the prototype for soft shots.
- **Switching game** (`poolSetVariant`).
  - It works while pool is detached and closes Max first.
  - A shot in flight is simulated to rest and settled first.
  - It then parks the frame through `poolSnapshotTable()` (the general form of
    `poolTourSnapshot`: game, reds, mode, tier), and restores the other game's parked or saved
    frame, or racks a new one.
  - Finally `poolSyncChrome()` updates `#game-title` (`poolTitle()`: *🎱 8-Ball Pool* or
    *🔴 Snooker*), the switcher tooltip, the wins button and the Max title.

**HUD (`phSnookerParts`)**

- **Cards.** Name, record or tier, tag, the **score** in large numerals, and **Break 34** on
  the active card.
- **Tracker row** (about 20 px, under the cards).
  - Reds × n and six colour dots (dimmed when down, with a ring on the ball on).
  - *35 remaining*, a hot *SNOOKERS REQ. n* chip and **Concede**, with an aria label.
- **Pill.** In priority order:
  1. *Ball in hand · the D* or *Break-off · in the D*
  2. *Free ball*
  3. *Nominate a colour*
  4. *On the pink*
  5. *Snookers required: n*
  6. *On a red* / *On the yellow*

  Max prefixes it with *Bilal's shot ·*.
- **Chips.** A 3 × 2 grid in the call card's slot and footprint, in both 2D and 3D, captioned
  *Tap a colour* / *Drag to shoot* / *Release · n%*.
- **Foul toast.** It gains actions: *Play* / *Make Ayesha play again* (*Put back* when narrow) /
  *Free ball*. It also carries notices such as *Century break*.
- **Frame-over dialog.** It gains stats: *SCORE 72–41*, *HIGH BREAK 58 · You*.
- **Max.** The tracker spans the top bar.
- **Colours.** The HUD uses `--pool-*` tokens only. Ball and chip colours are materials set
  inline from `pgBallLook`, and the chip ink passes 4.5:1.

**⚙️ and the host**

- **Defaults** (`userPreferences` :271–299): `poolVariant: 'pool'`, `snookerReds: 15`,
  `snookerDifficulty: 'adaptive'`.
- **New rows** after *Pool CPU* (:21499), in the existing select pattern:
  - 🎱 *Cue Game* (8-Ball Pool / Snooker)
  - 🔴 *Snooker Reds* (15 full / 10 / 6 quick)
  - 🔴 *Snooker CPU*
- **The listener** (:21574) adds `snookerReds` to `numericPrefs`.
  - `poolVariant` calls `poolSetVariant(v)`.
  - `snookerReds` and `snookerDifficulty` call `poolOnPrefChange(pref)`. It applies on a fresh
    frame, else from the next frame, like the difficulty does.
- **Stale controls.** `toggleSettingsModal` re-syncs every `[data-pref]` control on open.
- **Title.** `updateGameTitle` (nested at :24050) calls the exported `poolTitle()`.
- **Wins button.** `#pool-scoreboard` gains `#snooker-lb-btn` / `#snooker-wins`, which show
  in place of pool's.

**Tournament**

- **Saves.** Separate `snookerTournament` and `snookerTrophyCabinet` keys, plus a `t.game`
  field.
- **Validation.** `ptValidate(x, game)` rejects a save for the other game. It normalises the
  settings:
  - the race has one entry per round, each 1–5
  - clock is one of {0, 30, 45, 60}
  - pool keeps `call`; snooker has `reds` of {6, 10, 15}
- **Setup.** Snooker's setup shows a **Reds** segment and hides *Call pocket*.
- **Frame scores.** `m.points` stores `[a, b]` per frame, parallel to `frames`, via
  `ptRecordFrame(t, id, winner, {points})`. The result screen lists them.
- **Wording.** `ptRaceText(t, n)` replaces every "race to" (`puMatchCard`, `puIntroHTML`,
  `puResultHTML`, the setup labels, `poolTourHead`, `poolTourResult`). Snooker's intro says
  *breaks off*.

**Progression, leaderboard, bot**

- **Storage.** These live in the block, and the host reads them inline:
  - `snookerWinsByMode {cpu, pvp}`
  - `snookerWinsByTier`
  - `snookerRecord`
  - `snookerCpuRecord`
  - `snookerHighBreak`: vs CPU, written at every frame end, including losses and concessions
- **XP.** `awardGameXP('snooker', {won, vsCPU, tier, reds, highBreak, tour, xp})` gets its own
  case, clamped to `AC_MAX_XP_PER_GAME`. It pays the XP table above, once per rack.
- **Achievements.** `snookerCentury` 💯 (150) and `snookerMaximum` 🏅 (300), both vs CPU. They
  are checked live and backfilled from `snookerHighBreak`; a break of 147 or more implies a
  15-red frame.
- **Board.** `LB_BOARDS.snooker = {icon:'🔴', unit:'wins', units:{highBreak:'pts'}, notes:{…},
  modes:{pro, hard, normal, easy, cpu, pvp, highBreak}}`.
  - `lbBoardRowsHtml` (:1484) uses `cfg.units?.[mode] || cfg.unit`, and the footer note uses
    `cfg.notes[mode]`.
  - `gameLbMode` and `refreshGameScoreBtn` both get a `'snooker'` case.
- **Sync.** `collectGameModeBests` emits `snooker:{easy, normal, hard, pro, cpu, pvp,
  highBreak}`. The restore only raises values and clamps the high break at 155.
- **Bot** (`github-actions-bot/.github/workflows/sync.yml`), pushed first:
  - bound the growth of `snooker:{easy…pro, cpu, pvp}` against the `gameSessions` delta
  - `snooker:highBreak` is at most 155 and rises only when the `gameSessions` delta is ≥ 1
  - the key regex already passes
- **Release.** `BUILD_LABEL` becomes `'v10'`, following the release steps at host lines 8–11.

### Progress

> **Where snooker stands (2026-09-30):** S0–S3 done: the table, the rules, and snooker in the
> widget with the ⚙️ Pool/Snooker switch, 2 Players and Vs CPU (a stand-in CPU). **Next:** the
> overlay fix above (S3 follow-up), then S4 (the real CPU), S5 (tournaments: *best of*, Reds in
> setup), S6 (XP, the board, the bot), S7 (polish). Nothing is committed yet (branch
> `feat/snooker`); verify-all is 2,352 / 0, and pool's fingerprints hold.

Each phase ends green on `node pool-dev/pool-verify.js` and `node ludo-dev/verify-all.js`,
with `reinsert --check` passing. Run everything on Node 22
(`"C:/Program Files/nodejs/node.exe"`), because the default `node` is 10.

#### Phase S0: the seam, no behaviour change — done 2026-09-29
- [x] Branch `feat/snooker` from `main`; this section compiled into the plan
      (2026-09-29).
- [x] **Pool fingerprints, taken on `main` before any change** (`pool-fingerprint.js`, held in
      `snooker-verify.js` §0). They cover:
  - the table
  - 20 seeded breaks, 50 shots played on from them, and the verdict on each
  - the four tiers' plans on 10 positions
  - the draw calls of 12 scenes (a recording canvas: 2,400–4,800 calls a scene, no browser)
  - three whole frames through the controller, with their XP and records

  A mutation check proves they bite: drawing sizes at R/13.9 instead of R/14 moves the render
  digest.
- [x] **The seam.**
  - `pool-game.js`:
    - `POOL_GAMES.pool` holds everything the controller asks of a game: table and rack, the
      rules, the CPU, storage keys, `frameXP` / `potXP`, `fileResult`, `wins`, title, icon,
      difficulty list.
    - `poolRules()` is the one in `poolS.game`; `poolUseGame(game)` swaps the table config and
      drops the camera and cache.
    - 52 edits route every call site through it, including the tournament keys and the
      snapshot checks: `=== 16` and `id !== 8` are now the profile's `ballCount` and
      `tracksPot`.
  - `pool-hud.js`:
    - `phModel` reads `g.status` (no rules calls), `g.game`, `g.title` and `g.diffs`
    - the sheet's difficulty words follow the model
    - dots go through `pgBallLook`
  - `pool-render.js`:
    - `pgBallLook(game, id)`; a plain ball skips the stripe, discs and digits
    - marks come from `table.marks`, else pool's two spots (`pgMarks` / `pgDrawMarks`, with
      lines and arcs ready for S1)
    - diamonds unless `cfg.diamonds === false`
    - `scene.zone`, with `kitchen` kept as an alias
    - the game in the cache key
    - every size drawn round a ball ×`pgK` = R/14: cue width, tip and ferrule, pull-back,
      lift, shadow offset, rings, pocket marks
    - rail and nose heights from the table when it sets them
  - `pool-camera.js`: the chase camera's near distance ×R/14; broadcast and survey fit
    `pcRailTop(cfg)` (the table's `railZ`, else R + 2 as before).
  - `load.js`: `PREFIX` takes `ps` / `PS_` for `pool-snooker.js`.
- [x] Harnesses:
  - `pool-table.html`:
    - a *Game* select: Snooker is listed but disabled until S1; it writes `poolVariant` and
      calls `poolSetVariant` when that exists
    - *Reds*, shown for snooker; *Call every shot*, shown for pool only
    - `?game=`, and snooker's prefs in its stub
  - `pool-harness.html`: a *Preset* select over a `PRESETS` map (defaults, knobs, rack), pool
    only.
- [x] Tests:
  - `pool-verify.js` *Game seam* (+12):
    - `POOL_GAMES` is the one place a game's rules, CPU, rack and storage are named
    - the HUD calls no rules, and ball colours go only through `pgBallLook`
    - the profile is complete, with pool's keys; `pgBallLook('pool')` is pool's balls
    - sizes are exact at k = 1; rail heights; pool's marks; `poolUseGame`
  - `snooker-verify.js` §0 (8), in `verify-all.js` as *Snooker*: **2,158 assertions, 0 failed**
  - `snapshot.js --check`: **2,434 / 2,434** across 125 scenes. PNG identity with `main` is not
    a usable gate (Decision log). Of the 59 scenes that render identically twice on `main`, the
    rest differ by at most 2/255 (the rig page's own layout), or in the shot clock's bar,
    which also differs between two renders of `main`
  - `perf-check.js` (Phase 9 was 1.8 ms):

    | view | repaint | rolling | unchanged frame |
    |---|---|---|---|
    | 3D | 1.4 ms median (2.0 p95) | 0.6 ms | 0 |
    | 2D | 1.2 ms | 0.6 ms | 0 |

    The 60 and 30 FPS caps are kept.
  - `host-run.js`: 140–147 checks; its one failure is the same as on `main` (below)
  - `theme-verify.js --quick`: the same one failure as on `main` (below)
- [x] Found on the way, fixed:
  - Chrome is no longer installed on this machine. `browser.js` finds Chrome, else Edge
    (`POOL_BROWSER` overrides), for `snapshot`, `theme-verify`, `perf-check` and `host-run`.
  - `host-run.js` closed ⚙️ and waited a fixed 400 ms. The overlay's 0.3 s fade can take longer
    in a busy headless browser, and until it ends the overlay takes the clicks meant for the
    panel, so the Game mode sheet and the tournament flow failed in a cascade (4 of 6 runs,
    `main` included). It now waits for the overlay to be hidden; 3 of 3 runs clean.
- [ ] Found on the way, **not fixed (they fail on `main` too, outside pool)**:
  - `host-run` light mode: the widget's *🎉 Congratulations! You'…* completion banner reads
    2.23:1. It shows once the workday is done, so it depends on the time of day.
  - `theme-verify`: the Max champion screen's name and meta read 1.00:1 in Glassmorphic dark,
    most likely measured while its 0.7 s rise-in (from opacity 0) is still running.
- [x] Not done in S0; moved to the phase that has a second game to shape it (Decision log):
      the CPU's internal game seam (`paGame`, S4) and splitting the HUD's pool parts into
      `phPoolParts` (S3). The controller already picks the CPU and rules per game.

#### Phase S1: the snooker table
- [x] The design: 27 snooker artboards reviewed and frozen in `pool-dev/ref/design/` (revision
      `1790715495-3a1b`, 2026-09-30); see *What the design specifies*.
- [x] **The table** (2026-09-30).
  - **`pool-snooker.js`** (`ps*` / `PS_*`, spliced after the rules):
    - `PS_TABLE` on the design's numbers
    - ball ids and values (`psValue`, `psIsRed`, `psName`), `PS_SPOTS`
    - `psMarks`: the baulk line, the D and the six 2 u spots, plus `baulkX` / `dR` / `spotOf` for
      the rules
    - `psCreateWorld`
    - `psRack(w, rng, reds)`: 5, 4 or 3 rows, apex 0.05 u behind the pink, colours exactly on
      their spots, the cue ball at the design's break-off spot in the D
  - **`pool-physics.js`:**
    - `ppBuildRoundedTable` for `pocketStyle: 'rounded'`: six cushion runs and twelve
      quarter-round **arc colliders** (radius 12, centred on the rail line behind each nose,
      only the quarter that is there, `ppOnArc`), each checked to end inside its hole
    - the arcs in `ppNextEvent`, `ppSubStep` and `ppSeparate`, all behind `if (t.arcs)`
    - `cfg.clusterGap`
  - **`pool-rules.js`:** zone `'D'` in `prCanPlace` / `prClampPlace` (`prInD`), stopping at the
    baulk line and sliding round the arc.
  - **`pool-render.js`:**
    - `PG_LOOKS.snooker`: plain balls, the design's colours
    - `pgCushions` returns `{ top, nose, ends }`, and `pgRoundedCushions` draws the
      quarter-rounds; pool's quads are the same draw calls
    - the D tinted and outlined for ball in hand
    - `scene.ring`: the nominated ball's accent ring, r + max(3, 0.4 r)
  - **As designed, S0's ×k is taken off the chase camera and the cue.** Pool is unchanged
    either way.
- [x] Harnesses:
  - **`pool-harness.html`, Preset *Snooker*:**
    - its knobs, including the pocket radii, and *Reds* 15 / 10 / 6
    - the arcs, the D, the baulk line and spots drawn
    - *Break-off (50%)*, thinning the back red
    - *Acceptance*: lines into a corner and a middle pocket, 0–10 u off centre, slow and fast
    - `?preset=snooker`
  - **`pool-table.html`, `?look=snooker`:**
    - the real camera and renderer on the snooker table in the panel's viewport: compact, the
      316 px column, or Max 1232 × 672
    - the design's six layouts, 3D (move to aim, wheel to lean) or 2D, and a draggable ball in
      hand in the D
    - reachable from the rig's *Game* select until snooker has its controller (S3), with its
      own audit for `snapshot.js --check`
- [x] Tests:
  - **`snooker-verify.js` §1 (+44, 52 in all):**
    - **Geometry:** the design's holes, noses, quarter-rounds, tangency, arcs ending in their
      holes, no hole reaching a resting ball, pool's table untouched; markings and spots; ball
      ids.
    - **The rack** for 15, 10 and 6 reds: counts, nothing touching, apex, the black clear, the
      cue in the D, seeded.
    - **The D:** refusals, 400 clamped drags, stops at the line and slides round the arc.
    - **The pockets, measured:**

      | pocket | line | drops |
      |---|---|---|
      | corner | down the diagonal | clean within ±2 u, off a cushion end at ±4, out from ±6, at 300 and 1500 u/s |
      | middle | square on | takes ±4 u |
      | middle | at 30° / 45° / 60° | the window narrows: 5 / 4 / 3 of 9 lines |
      | corner | rolling along the cushion | drops at every pace |

      A ball driven into a rounded end rebounds.
    - **40 break-offs** settle within 9 s of table time, at 9 ms each to simulate.
    - **A 300-shot fuzz:** energy never rises, the worst overlap is 2e-6 u, no NaN, 0 escapes,
      and everything settles.
  - **`render-verify.js` (+15, 88):**
    - snooker frames draw: 2D with the D, 3D, broadcast, survey, the ring, a drop, Max
    - plain balls
    - the game in the table cache key
    - no diamonds; the black on its spot; the D tinted
    - rounded cushion ends
    - pool's cue and camera distance
  - **`snapshot.js`:** 18 snooker scenes (and 3 in the 316 px column). The look audit is
    72 / 72, and the whole suite runs with every pool scene as before.
  - **Pool is unchanged:** the fingerprints (§0) all hold; `verify-all.js` **2,217 assertions,
    0 failed**.
- [ ] The user's test by feel:
  - the pockets and cloth in `pool-harness.html?preset=snooker`
  - the look in `pool-table.html?look=snooker` (compact, the 316 px column, Max; 2D and 3D)

#### Phase S2: the rules — done 2026-09-30
- [x] **`pool-snooker.js` rules**, pure as pool's are (a verdict and the next frame from the physics
  log; the caller applies the re-spots and places the cue ball):
  - `psNewFrame`, `psJudge`, `psApplySpots`, `psChoose`, `psTimeout`, `psConcede`
  - `psStatus`: the ball on (`psBallOn`: ids, the balls a free ball may go with, the foul value),
    what may be nominated, points remaining, snookers required, the tracker's colours
  - `psSummarize` (the first contact, several at one instant; contacts with a touching ball left
    out), `psTouching`, `psSnookered` (`'free'`: no ball on hittable on both edges; `'full'`: no
    part of any), `psSpotPositions` (solved on the line, not stepped)
  - copy: `psText` (*Foul · 6 to Bilal* / *Potted the pink* · *Free ball*, *You win* / *57–40 ·
    potted the black*, *Re-spotted black*, *Century break*, *Maximum break*), `psChoiceText` (*Play* /
    *Make Bilal play again*, short *Put back* / *Free ball*), `psChoiceNotice` (*CPU puts you back
    in*)
  - the verdict is the planned superset: `frameOver`, `winner`, `foul`, `continues`, `next` for
    the CPU, plus `fouls`, `penalty`, `points`, `scored`, `options`, `spots`, `notice`, `on`
- [x] **`snooker-verify` §2–6 (+76, 128 in all):**
  - **a row per ruling:** reds and colours (12), fouls and the choice (12, touching ball
    included), the free ball (10), re-spotting (6), the end of the frame (8: cleared, a foul on the
    last black, the tie and its seeded lot, the re-spotted black, concession), points remaining,
    snookers, the clock and the copy (10)
  - **the snookered test** (7), including the free-ball offer after the re-spots
  - **real shots on the physics:** a red into the corner, an in-off, the blue in the way,
    10 break-offs that all meet a red first
  - **a scripted 147** (15 reds and blacks, the black back on its spot each time, the century
    and maximum noticed once) and **a free-ball 155** (159 with the foul)
  - **whole frames fuzzed:** 30 frames at 15 / 10 / 6 reds and 16 late starts (pink and black,
    the scores close), 1,357 shots, 726 of them on the physics; 386 fouls, 17 free balls, 177
    put back, 2 re-spotted blacks. Every invariant holds: the scores move by exactly the points
    and the penalty; penalties 4–7; no red comes back; the colours on the table always match the
    phase; no overlap after the re-spots; the break and high break; every frame finishes, the
    winner ahead. 3 s
- [x] **`pool-table.html?look=snooker` plays a frame** (its default *Play a frame* layout; the
  design's stills stay under their names): 2 players, drag in the D, aim as the look view
  does, power and spin in the rig, Space to shoot; the rules judge each shot; the nominate
  chips padlock *Shoot* until a colour is tapped; the choice after a foul as buttons; the
  score, the break, what is on, points remaining, snookers required. Driven headless: a
  break-off and 16 shots, no page errors
- [x] Pool unchanged: the fingerprints hold; `verify-all.js` **2,293 assertions, 0 failed**
- [ ] The user's test by feel: a frame in `pool-table.html?look=snooker`

#### Phase S3: controller, HUD and the ⚙️ switch (2 Players playable) — done 2026-09-30
- [x] **Controller (`pool-game.js`), all through `POOL_GAMES.snooker`:**
  - nomination (`poolS.nom`): the padlock until a colour is tapped, the chips
    (`poolOn.nominate`), and in 3D / Max a press on a nominable ball (`poolBallAt`, 12 px
    minimum); the CPU nominates through its shot
  - the choice after a foul: phase `'choice'` (the table and clock wait), the buttons in the foul
    toast, the hand-off first in 2 Players, a CPU chooser's 700 ms beat (CHOOSING) and its notice
    (*CPU plays on* / *takes the free ball* / *puts you back in*); `poolChoose`
  - the D: the break-off, an in-off and the re-spotted black start in ball in hand, zone `'D'`
    (`poolStartTurn` puts the cue ball home in the D when it is not there)
  - concede (asked, then confirmed), the frame-over dialog's sentence, score and high break
  - the touching balls noted before each strike (`prime`); aim steps ←/→ 0.025°, Shift 0.0125°/px;
    the first aim of a turn at a ball on with a clear line (`aimClear`)
  - `poolSetVariant`: closes Max, runs a shot in flight to rest and judges it, saves a tournament
    match and leaves it, parks the frame (`poolSnapshotTable`) and brings the other game's back;
    each game keeps its own tournament state; `poolSyncChrome` sets the title, the switcher's
    tooltip and the wins button
  - `snookerFrame`: saved at every shot boundary and on leaving, restored on the way in, removed
    before the award; pool keeps no such save
  - `poolOnPrefChange`: the game, the difficulty, and ⚙️ Reds (a fresh rack) from ⚙️
  - records only: `snookerRecord`, `snookerWinsByMode`, `snookerWinsByTier`,
    `snookerCpuRecord`; no XP (S6)
  - **the stand-in CPU** (`pool-snooker.js`, `psCpu*`) until S4: ghost-ball pots checked on a copy
    of the table through the rules, a thin break-off, a plain safety, the free ball when it has
    one; tiers differ only in aim noise
- [x] **HUD (`phSnookerModel`, `pool-theme.css`):** the score and third line on each card (FOUL,
  YOUR CHOICE, CHOOSING, TO BREAK, BALL IN HAND, BREAK 34), the tracker row (reds, the six colours
  with the ball on ringed, REMAINING or LEFT, SNOOKERS REQ. n, Concede with a 44 px target), the pill
  in priority order, the chips (160 px; 212 in Max) with the gauge and padlock above them, the
  toast's 44 px choice buttons (the long label falls back to *Put back*), the dialog's SCORE and
  HIGH BREAK, *Concede the frame?*, the Max header and tracker, the tighter snooker rhythm
- [x] **Host (`AttendanceTimeCheckerPlus.js`):** the defaults (`poolVariant`, `snookerReds`,
  `snookerDifficulty`); ⚙️ *Cue Game*, *Snooker Reds* and *Snooker CPU* after *Pool CPU*; the
  listener (`snookerReds` a number, `poolOnPrefChange`); every ⚙️ select re-synced on open;
  `updateGameTitle` through `poolTitle()`; `#snooker-lb-btn` / `#snooker-wins` in the header
- [x] **`pool-table.html`:** *Game* switches through `poolSetVariant`; *CPU* and *Reds* follow
  the game; `?game=snooker&scene=…` sets the snk* states; S2's rig frame is gone and
  `?look=snooker` is the stills again
- [x] **Tests** (`verify-all.js` **2,352 assertions, 0 failed**; pool's fingerprints hold):
  - `pool-verify` (+33): the switch and back, the padlock and chips, the CPU as chooser, the D
    after an in-off, the hand-off before the choice, put back, free ball, snookers required,
    concede, whole frames Vs CPU and 2 Players filed once with no XP, the reload, switching
    mid-shot, ⚙️ Reds, out of time; the seam guard now bans snooker's names outside the profile too
  - `hud-verify` (+26): every snk* state of InMatch and Max
  - `snapshot` (+40 snooker scenes, 185 in all): the audit, extended to the tracker, chips, choice
    buttons and concede question, is **3,293 / 3,293**
  - `theme-verify` (+17 snooker states): only main's champion fade-in fails, as before
  - `perf-check` (+2): the 22-ball rack and a snooker mid-frame repaint, 20 / 20
  - `host-run` (+6): ⚙️ Cue Game → Snooker in the real userscript, the cue ball placed in the D
    and the break-off by mouse, the saved frame, and back to pool's frame as it was
- [ ] The user's test in the widget: **begun 2026-09-30**. Snooker plays in the panel (aim, drag
  to power, release, nominate, the choice after a foul). Open items below.
- [ ] **Open: overlays cover the table where the shot goes** (the user's screenshots, Max view,
  2026-09-30). At true scale the balls and pockets are small and sit near the cushions, so the
  fixed overlay corners land on play:
  1. **Top left: the camera toggle (2D TOP-DOWN / 3D AIM) covers the top-left corner pocket.** A
     green on the top cushion was aimed into that pocket, and the pocket and the object ball's
     path ran under the toggle.
  2. **Bottom right: the colour chips (212 px card) cover the bottom-right corner.** A black cut
     toward the bottom right had its line run under the chips while *Drag to shoot* was up.
  3. **Bottom left: the spin control covers the bottom-left corner pocket.** A red close to that
     pocket and its path to the pocket sat under SPIN · Center.

  Pool shares the corners but its larger balls and pockets rarely end there. Fixes to weigh (S3
  follow-up, before S7):
  - **Get out of the way of the shot.** Each corner overlay (toggle, pill, spin, chips, hint) fades
    to about 0.25 and lets the pointer through while the aim line, the object ball's path, the
    cue ball, or the target pocket passes under it. The guide's segments and the pocket rings are
    already known in screen space.
  - **Move them off the felt in Max.** Max has spare height (the tracker row and the 1232 × 672
    viewport leave room): the toggle and pill could go in the header strip, spin and chips in a
    rail below or beside the table, so nothing overlays the bed. Compact keeps them on the table
    (no room) and uses the fade.
  - **Chips: collapse after nominating.** Once a colour is picked, the chips could shrink to a single
    chip (the nominated ball plus *Drag to shoot*) that expands on tap, freeing the corner for the
    stroke.
  - **Tests:** a snapshot audit rule, "no overlay covers the aim line, the object ball's path or the
    target pocket", over scenes with shots aimed into each corner (compact and Max, 2D and 3D).

#### Phase S4: the CPU
- [ ] `pool-snooker-ai.js`, `snooker-break-tune.js`, the tiers in the Game mode sheet, ⚙️
      *Snooker CPU*, and adaptive difficulty from `snookerCpuRecord`.
- [ ] Measure `snooker-balance.js` against the bands and record the numbers in the Decision
      log. `pool-verify` covers the CPU's stages and time slicing.
- [ ] The user's test against the CPU.

#### Phase S5: tournaments
- [ ] Tests:
  - `tour-verify`: game check, normalisation, points, `ptRaceText`
  - `pool-verify`: a snooker tournament from setup to champion, and a reload mid-frame
  - `snapshot`: the snooker screens
  - `host-run`: the flow by mouse
- [ ] The user's test.

#### Phase S6: progression and the bot
- [ ] XP, achievements, the board with its High break tab, the sync keys, and v10.
- [ ] Tests:
  - `pool-verify`: the XP table and the bonus
  - `host-smoke`: the clamp, the achievements, and *Called It* never unlocked by snooker
  - `sync-verify`: the snooker bound, the 155 cap, the session rule
  - `host-run`: the board and the button
- [ ] **The user pushes the bot, then installs v10.**

#### Phase S7: polish
- [ ] Theme pass: every snooker state × theme × shape.
- [ ] Performance: CPU ms per shot, and the repaint.
- [ ] Accessibility: the chips have names, and the tracker is read out.
- [ ] Final balance numbers.
- [ ] Portal verification on `globalportal.mtbc.com`.

### Verification

```
node pool-dev/reinsert.js --check
node pool-dev/snooker-verify.js 300        # pool fingerprints, table, rules, 147/155, fuzz
node pool-dev/pool-verify.js               # seam guards + the snooker match headless
node pool-dev/hud-verify.js && node pool-dev/render-verify.js && node pool-dev/tour-verify.js
node pool-dev/snapshot.js --check          # every scene incl. snooker:, layout audit
node pool-dev/theme-verify.js              # WCAG AA across themes and shapes, both games
node pool-dev/perf-check.js                # 22-ball repaint, CPU slices
node pool-dev/snooker-balance.js 20        # tier bands
node pool-dev/host-run.js                  # real userscript: ⚙️ switch, the D, chips, put back, reload, board
node pool-dev/sync-verify.js               # the bot's script (needs github-actions-bot/ checked out)
node ludo-dev/verify-all.js                # every suite
```

To play by hand: `node pool-dev/host-run.js --open` for the fake portal, `start
pool-dev/pool-table.html?game=snooker`, then the real portal once v10 is installed.

### Risks and tuning
- **Pocket templates** are estimates. Throat, cut radius, jaw angle and depth are tuned
  against the acceptance windows, and "fast along the cushion rattles" may need a
  speed-dependent capture.
- **Snooker cloth and cushions** are unmeasured: `muRoll`, `cushionE`, `noseRise`.
- **CPU cost with 22 balls** is unknown (~4–8 ms a trial). Trials are capped per tier and
  measured early in S4.
- **The break-off script drifts** if the rack or the physics changes; re-run
  `snooker-break-tune.js`.
- **The pool fingerprints break if `ppNextEvent`'s tie order changes.** Do not reorder it.
- **Soft-shot power and fine aim** at true scale are tuned by feel in the prototype.

### The original note (superseded, kept for reference)

> The user's review of the Phase 3 table: it is good enough to carry snooker rules. Carries
> over: the physics, the cameras and director, the renderer's table and ball drawing, the
> event log, ball in hand with a clamp, the hot-seat hand-off, the tournament bracket and the
> theme layer; the playfield stays 1000 × 500. New: a table config (R ≈ 7.4, narrower pockets
> with rounded cuts), the markings (baulk line ≈ 206.5 from the baulk cushion, D r ≈ 81.8, six
> spots, a `'d'` zone for `prClampPlace`), the rules as a sibling of `pool-rules.js` (red then
> colour, re-spots, clearance, 1–7 points, fouls max(4, value), free ball, re-spotted black;
> no miss or re-rack), a HUD of scores, break, ball on, points remaining and snookers required,
> nomination in place of the pocket call, and a CPU with a snooker (safety) evaluation. Open
> then: ball size on the compact panel.

---

## Open questions ❓


1. ~~**Compact 2D ball size:** the design's top-down fit gives R≈4.5px, down from today's
   6px. If it reads too small in `preview.js`, should the compact 2D view rotate the table
   to portrait (R≈5px) or slim the rails?~~ Settled by use: the landscape fit stayed through
   the user's tests of Phases 3–9 with no call to change it.
2. ~~***Called It* achievement** for beating the pro CPU: add it or not?~~ Added in Phase 8 (📣, 120 XP).
3. ~~**Snooker ball size on the compact panel**~~ True scale, no zoom; Max is the clear view (the user, 2026-09-29).
4. **Is the Phase 8 sync-bot change live?** The box is unticked, but v9 has shipped. Snooker's bot change (S6) stacks on it, and again has to go out before the client does.
5. **Snooker implementer's calls** (the *Implementer's calls* table in *Snooker*): the 45 s clock, adaptive never reaching Pro, 7 for a foul before nominating, the seeded lot on a re-spotted black, concede only when snookers are needed. Each is easy to flip.

---

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-09-25 | Plan drafted from the design canvas + a full read of the current engine | – |
| 2026-09-25 | **Tournaments are humans only.** No CPU slots, no CPU-vs-CPU resolver, no Watch mode | The user's call |
| 2026-09-25 | ~~Tournaments pay PvP-rate XP only (15 per match)~~ **Superseded the same day:** the **You** seat earns **80 per match won and 15 per match lost**, the same as a game today. There is still no title bonus, tournament achievement or tournament leaderboard. The quick PvP payout stays as it is today | The user's call: every match takes the same time to play, so match XP is rate-limited by the clock. Only per-bracket rewards could be multiplied by typing extra names |
| 2026-09-25 | **Difficulty ladder: easy / normal / hard / pro, adaptive and pinnable.** Hard is today's CPU fine-tuned and must measure at least as strong. Pro hardly misses and turns on call-every-shot | The user's call: the current CPU is already tough, so it can be tuned tougher rather than rebuilt weaker |
| 2026-09-25 | **Call pocket on every shot** exists as a rule. The pro tier forces it on, and PvP and tournaments offer it as a setting | The user's call, as the way to raise difficulty through rules as well as through the CPU |
| 2026-09-25 | **The missing screens are designed by the user in Claude Design from the prompt in Appendix A**, not generated by the implementer | The user's call |
| 2026-09-25 | **29 artboards received.** Inventory and seven gap decisions recorded: tournament name field, Pause behaviour, spin stays as presets, the clock waits for the hand-off, adaptive re-evaluates per frame, cabinet identity by normalised name, Max variants derived from compact | The design was delivered |
| 2026-09-25 | **Leaderboard split by CPU tier, as in Ludo, and the sync bot must protect the new keys.** `pool:{easy,normal,hard,pro}` join `pool:cpu`/`pool:pvp`, with no legacy backfill. The bot gets a monotonic per-key `gameModeBests` merge, shape validation and a win-growth bound, shipped before the client emits the keys | The user's call. The bot currently replaces records wholesale, so an outdated tab would erase the tier keys and a modified client could write anything to them |
| 2026-09-25 | **`feat/pool-v2` cut from `feat/cyberpunk-hud-rework`, not `main`** | That branch is 10 commits ahead of `main` and has re-spliced large parts of the userscript. Extracting pool from `main`'s older file would guarantee a painful merge. Pool and the Cyberpunk work touch disjoint regions, and the uncommitted `cyber-theme.css` edit was left unstaged |
| 2026-09-25 | **Pool's `reinsert.js` writes the userscript's own line ending; dev files are LF** | The userscript is pure LF in the working tree (with `core.autocrlf=true`), while `snake-dev/reinsert.js` always writes CRLF blocks. Copying that would have left the file with mixed endings. An anchor check in the extraction script caught the wrong assumption before anything was written |
| 2026-09-25 | **`prayerCount` stays in the host; the pool timing trio moves into the block** | `let prayerCount` was declared in the middle of the pool state, but the Prayer Counter owns it. `poolLastFrameMs`/`LogicMs`/`Accumulator` are pool-only. No outside code touches pool state at load time (checked with a reference scan, and by `host-smoke.js`, which evaluates the whole IIFE), so the move carries no temporal-dead-zone risk |
| 2026-09-25 | **Baseline: today's CPU wins 61.4% vs skilled and 72.3% vs casual, fouls on 13.4% of visits** | Measured by `baseline-check.js` over 4,000 frames. 74% of its fouls are scratches and 58% of its self-inflicted losses are an early 8. This sets the bar and the first two targets for Phase 6 |
| 2026-09-25 | **Design revision `1790325931-f598` is final and frozen into `pool-dev/ref/design/`. Its table geometry is authoritative: the physics adopts the design's pockets, cushion ends and jaws** | The user's call: "the mocks are final", and the pockets are how they should be. The physics had its own mouths (62/64 u) and capture circles (r 30), so the two disagreed. Drawing one and playing the other would show balls dropping where no hole is drawn |
| 2026-09-25 | **The v2 physics stays out of the userscript until Phase 3** | The live renderer works in 368 px table space with a 184 px table. Wiring the new physics into it would mean a coordinate adapter that is thrown away as soon as the new renderer arrives. Phase 3 swaps both at once. Until then `pool-physics.js` is exercised by its own suite and the harness |
| 2026-09-25 | **Physics world frame is right-handed: x right, y up, z up** | Spin is a cross product. The design's `Table.dc.html` treats +y as down-screen with z up, which is left-handed, and would flip the sign of every English effect. The renderer flips y instead |
| 2026-09-25 | **Tight-rack impacts are micro-simulated (cluster contact solver)** | Pairwise resolution put the break's energy into the two back corners: 3 balls to a rail and 0/40 legal breaks, whatever the rack gap. A real tight rack compresses all at once. Stiff damped springs over the ~0.1 ms contact (30 steps per contact, damping from the 0.95 restitution) give 8.8 balls to a rail and 40/40 legal breaks, while pairs and lines still behave as before |
| 2026-09-25 | **Effective cushion friction 0.3, not 0.2** | At 0.2 the plain rebound already reached the sticking limit, so reverse English could not shorten it (39.9° vs 39.3°). 0.3 folds in the cloth friction under the ball during the cushion impact, which Mathavan's measurements include, and gives running 54.0° / plain 36.6° / reverse 31.5° at 45° |
| 2026-09-25 | **Rolling resistance 0.016, above real cloth (~0.010)** | At 0.010 a firm shot rolls for over 10 s. 0.016 keeps a break under 6 s. It is a feel number and is exposed in the harness |
| 2026-09-25 | **Fixed during Phase 1: a ball could be left `rolling` at v = 0** | Found by the fuzz, which caught NaN on 1 shot in 300. When a crawl's slip ended, the speed rounded to zero after the spin had already been derived from it. The leftover slip read as sliding, and a follow-up line forced the ball to rolling with a zero-length direction. The speed is now settled before the spin, the state is never forced, and both closed forms reclassify instead of dividing by zero |
| 2026-09-25 | **Cyberpunk primary fill is `--rt-text` with `--rt-bg-1` type, not `--rt-accent`** (revises the *Theme mapping* row) | `cyber-theme.css` allows exactly one inversion, a text-coloured fill with background-coloured glyphs, and forbids text on an accent fill, because a dark user-picked highlight would hide the label |
| 2026-09-25 | **Pool's theme scope is `.retro-theme .pool-hud`, and the Max root carries copies of the widget's theme classes and tokens** | The host's Max modal is body-level, outside `.attendance-summary`, and Cyberpunk's derived tokens (panel, border, shape) are declared on `.retro-theme`. Copying the classes and calling `applyCyberTokens` on the Max root, as the host does for its PiP clone, makes them resolve. Checked in Chrome: the Cyberpunk Max frame renders with the user's accent |
| 2026-09-25 | **Shot clock expiry is a foul (`prTimeout`): ball in hand anywhere to the opponent; on the break the break passes across** | Today's game already treats it as a foul. On the break there is no shot to foul, so the incoming player breaks |
| 2026-09-25 | **Card tags use the mono face in Cyberpunk and 0.06em tracking in Glassmorphic** | Orbitron and wide tracking made `BALL IN HAND` squeeze `Ayesha` to an ellipsis; the in-browser audit caught it |
| 2026-09-25 | **The cue stays as designed in 3D**, even though past ~40% power at the default lean the pulled-back tip leaves the bottom of the frame | The user's call. The design's own camera math does the same; the power gauge and hint still show the stroke |
| 2026-09-25 | **Power counts only movement along the shot line, both ways, scaled to fit inside the canvas; aiming keeps following the mouse outside the canvas** | The user's report from the prototype: aiming stopped at the canvas edge and pulling back ran out of room. The old engine already let you pull back or push forward; full power is now always reachable within the bounds. Checked in headless Chrome: a 200 px sweep below the table turns the aim exactly 60°, and sideways drags add 0% power |
| 2026-09-25 | **A shot-camera setting: Overhead (default) or Stay 3D** | Players split on the ease to the overhead view; the user's call is to offer both (gap decision 9) |
| 2026-09-25 | **Revised: Stay 3D stands up to a whole-table 3D view while balls run, instead of freezing the aim view** | Frozen at a low lean, the balls that matter roll out of frame. The survey is what a player sees standing up after the shot: same heading, higher and further back, fitted so every rail and the apron clear the HUD's top overlays. Upright poses now blend as an orbit, so the return to a new aim swings round the table rather than cutting across it |
| 2026-09-25 | **Revised: the v2 engine goes into the userscript with the new HUD and input (end of Phase 5), not at Phase 3.** Phase 3 ships as `pool-dev/` modules plus the `pool-table.html` prototype | The live game's HUD is drawn on the canvas in the old 368 × 184 table space, and its input and rules glue read the old ball state. Swapping only the renderer would need throwaway adapters for all three. The prototype gives a real table to test by feel in the meantime |
| 2026-09-25 | **The 3D view is not mirrored like the design's** | The design's frame is left-handed, so its 3D chase view is the mirror image of its 2D view: aiming up-table, the 2D top rail appears on the right. Ours keeps both views consistent. Measured: otherwise identical to the design's projection to 1e-9 px |
| 2026-09-25 | **Broadcast camera: straight down, long lens (F = 4·H), framed exactly like 2D** | Watching the balls run then reads like the 2D view (0 px apart at the rail corners), and the ease from the chase camera needs no second framing |
| 2026-09-25 | **Guides follow only the cue ball after first contact** | The guide shows where the cue ball's spin takes it, not what it collides with next. Simulating the rack scattering cost about 10× more for a line no one reads |
| 2026-09-25 | **Rules choices where WPA offers options (Phase 2).** An illegal break is a plain foul with ball in hand anywhere, not WPA's re-rack-or-accept choice. The 8 on the break is always re-spotted, never re-racked. The 8 may not be hit first on an open table. A call names a pocket, not a ball. There is no three-foul rule | Each WPA option is an extra prompt at the table, and the design has screens for none of them. These are the Miniclip-style defaults the plan already names. Each is one line in `prJudge` if the user wants it the other way |
| 2026-09-25 | **The judge derives everything from the world and its log; the frame state holds only turn, groups, break flag and ball in hand** | Today's engine keeps per-seat potted lists beside the balls, a second copy of the table. Deriving "on the 8" from the balls on the table means the two can never disagree, and the CPU can judge a cloned world with no extra bookkeeping |
| 2026-09-25 | **The design's amber palette and Chakra Petch/Sora are dropped. Pool renders in the existing Glassmorphic Aurora and Cyberpunk HUD presets** through `--pool-*` tokens, with a canvas bridge. Table materials and ball colours stay physical and theme-independent | The user's call. It keeps pool consistent with the other panels and honours the user's Cyberpunk colour picks. No new font imports are needed |
| 2026-09-29 | **Ball in hand is clamped, not warned: the cue ball stops at the cushions and, on the break, at the head string** | The user's review, and v1's behaviour: a drag cannot reach an illegal spot, so the *Behind the head string only* prompt no longer comes up. Overlapping a ball is still refused, because pushing balls aside would be a table change the player did not ask for |
| 2026-09-29 | **Move cue ball: the shooter can pick the placed cue ball up again until the shot** | The user's review. The clock pauses in hand and resumes rather than resets, so re-placing gives no time back. It waits while the ball is in hand, as it already did for the first placement |
| 2026-09-29 | **Snooker is recorded as a later mode, not scheduled** | The user's review of the table. Everything but the rules, the markings, the HUD's scores and the CPU's evaluation is shared with 8-ball |
| 2026-09-29 | **v2 ships in Phase 5 with a stand-in CPU (`pool-ai.js`)**, not v1's CPU and not a wait for Phase 6 | v1's CPU reads v1's ball state and physics, so it cannot drive the new table, and Vs CPU cannot be missing from the widget between phases. The stand-in checks every candidate on the real physics and rules (so it never plans a scratch) and adds execution noise; measured at 52% pots and 6.3% fouls per visit, a little under v1 (65% / 13.4%). Phase 6 replaces it with the four tiers |
| 2026-09-29 | **Escape no longer resets a pool frame.** In pool it cancels a power stroke (and stops there), else the Max modal closes itself | The host's Escape resets the current game, which in pool would throw away a frame in progress, and Esc is already pool's cancel key (Input). Reset stays one click away in the footer |
| 2026-09-29 | **The compact HUD is fluid, not fixed at 368 px** | The widget's side column is 350 px wide on screens up to 1400 px, so the HUD gets 316; on stacked layouts it is full width. Found by running the real userscript (`host-run.js`): at 316 the toggle hit the pill and the lean slider hit spin. The viewport keeps the design's 368:412 and the overlays are anchored so they sit on the design's pixels at 368; a container query shortens two labels under 360; the panel caps at 420 so a stacked layout does not get a table taller than the screen |
| 2026-09-29 | **v1 is frozen in `pool-dev/v1/`**, not deleted | `baseline-check.js` measures v1's CPU, which is the bar Phase 6 has to clear, and it needs v1's engine to run |
| 2026-09-29 | **The frame-over dialog's second button reads *Change mode* until Phase 6** | The design's *Change difficulty* has nothing to open before the tiers exist |
| 2026-09-29 | **The real-host harness (`host-run.js`) is the integration test for the controller**; `pool-table.html` stays the design and theme harness with its own loop | The prototype sets design states directly (a foul toast, a clock at 4 s, a won frame), which the controller should not expose. The controller is tested headless in `pool-verify.js` and inside the real widget in `host-run.js` |
| 2026-09-29 | **Light-mode fixes outside pool are in this phase** (the header score buttons, ⚙️, Ludo's Max, the timers and XP card, the prayer labels) | The user's call: "fix all the light mode issues". Found by `host-run.js`'s contrast audit; each fix keeps the hue and deepens it, or restores a light rule that never matched. Cyberpunk and dark mode are untouched (every rule is scoped to not-Cyberpunk inside the light media query) |
| 2026-09-29 | **Revised: spin is free, anywhere inside the miscue ring**, with the five presets kept as quick picks | The user's test: v1 let you set any amount of spin, and five fixed spots were a step back. The physics always took any tip; only the control changes. The small ball on the SPIN control is draggable (the user's ask), and a click opens a bigger face for precise placement, because a 34 px ball is coarse under a mouse |
| 2026-09-29 | **Revised: `pool-table.html` runs the widget's controller**, not its own loop | The user asked for the prototype to be kept alongside the widget. Loading `pool-game.js` on host stand-ins does that by construction, and the scenes need no production API because `poolS` is one object they can set. This replaces the earlier row that kept the prototype's own loop |
| 2026-09-29 | **Revised: hard gets 0.2° of aim noise on direct pots**, not zero | With the planner checking every line on the real physics and correcting for throw, zero noise means hard never misses: measured, it won every frame against every human model, level with pro. The plan's intent was *hard at least as strong as today's CPU*, so hard is calibrated to that: 80.0% [65–90] against skilled and 97.5% [87–100] against casual, against v1's 61.4% and 72.3%. Pro keeps zero noise |
| 2026-09-29 | **Adaptive never climbs to pro** | Pro makes you call every shot. That is a rule change, so it should be chosen, not handed to a player for winning |
| 2026-09-29 | **A noisy replay stage (`robust`) for normal and hard** | The plan's *whether a scratch or foul risk remains*: the top three lines (pots and safeties) are replayed with the tier's own noise and marked down if they foul or lose the frame when a little off. Hard's fouls fell from 9% to under 5% against skilled players |
| 2026-09-29 | **The Game mode sheet ships in Phase 6 with Vs CPU and 2 Players**; Tournament joins in Phase 7 | *Change difficulty* needs somewhere to go. The *NOW* chip rides on Adaptive's name line, not the far right, so the description is not cut off at 316 px |
| 2026-09-29 | **Setup starts at 4 players**, only slot 1 prefilled (with your leaderboard name) | 4 is the smallest full bracket. Placeholder names (*Player 2*) typed into the other slots would end up on the bracket and in the cabinet; an empty slot becomes *Player n* only if it is left empty at the start |
| 2026-09-29 | **The name list scrolls with the setup screen**, not in a 140 px box of its own | Two nested scrollers in a 560 px panel fought each other for the wheel. The primary button stays pinned either way |
| 2026-09-29 | **The champion screen has a close button** | The design has only *New tournament* and *Trophy cabinet*, which leaves no way back to quick play. Closing lets the finished tournament go (it is already in the cabinet) |
| 2026-09-29 | **Pause adds *Leave for now*** | The tournament footer has no mode button, so without it the only ways out of a match were finishing it or switching games. The match stays saved and resumes from the Game mode sheet |
| 2026-09-29 | **Back from the bracket**: to the table when a match is in progress, else to quick play | The bracket is reached from a match (the footer, the frame-over dialog) or from the sheet; back returns to where you were |
| 2026-09-29 | **A won match goes straight to its result screen** (after 1.1 s for the last pot), with no frame-over dialog first | The dialog would say the same thing one tap earlier |
| 2026-09-29 | **Reset is refused in a tournament frame; tournament frames pay no XP yet** | Reset would undo a lost frame. Match XP (80 / 15 for You) is Phase 8's |
| 2026-09-29 | **Narrow columns use short round names** (*Last 16*, *Quarters*, *Semis*) in the round tabs, the champion's run and the tree's column heads | *Quarter-final · race to 1* and *Round of 16* do not fit a 320 px panel's columns |
| 2026-09-29 | **On an open table each card lists the balls that player has potted** (*Potted* and the balls; beyond three, the balls alone) | The user's test: after the break nothing showed which balls were down, and the design shows only *Open table* there. Once groups are decided the tracker takes over |
| 2026-09-29 | **Calling a pocket: the pill keeps the state, one call card bottom right carries the map and the hint** (was: *On the 8 · call it* pill, *Tap a pocket to call it* hint and a 172 × 116 mini-map top left) | The user's test: three labels said the same thing, and at the design's top-left spot the chase camera puts the far pockets and the aim line under the map (covered at 32 of 72 aims on the 8). A corner-hopping fix and then a fixed bottom-left map were tried; the user asked for one smaller element, bottom right, without the clutter. The pill now reads *On the 8* (with call-every-shot it keeps the group; the CPU card already says Pro). The card (at least 88 × 80, six 24 px targets) sits in the hint's corner, the near rail in the chase camera, and its caption follows the shot: *Tap a pocket*, *Drag to shoot*, *Release · n%*; the lit pocket names the call. The gauge steps up 16 px over it, Move cue ball goes bottom left, and it gives way to the spin picker. 2D keeps its hint, since every pocket is on screen |
| 2026-09-29 | **The tier-win growth bound is skipped for a record adopting `gameModeBests` for the first time** | Such a record has no stored figures to grow from; bounding it would clamp an upgrading player's real tier wins away on every sync, for good. Any later sync is bounded |
| 2026-09-29 | **The all-time and hot-seat counters (`pool:cpu`, `pool:pvp`, `ludo:cpu`) are not in the growth bound** | The plan bounds the tier keys. The all-time keys predate `gameModeBests` on many records, so a bound on them would drop players off the boards the first time they sync this build; the max merge still keeps them from going down |
| 2026-09-29 | **A tournament shows the All-time board on the wins button** | Tournaments have no board (they are farmable), and All-time is the board a CPU win would also count towards |
| 2026-09-29 | **Called It is 📣, 120 XP** | 🎯 is Sharpshooter's; 120 sits between Pool Shark (150) and the per-match Ludo achievements |
| 2026-09-29 | **The escape sweep is hard's and pro's only** | Easy's and normal's fouls are part of what makes them beatable; the plan's targets were for hard and pro |
| 2026-09-29 | **Contrast is WCAG AA (4.5:1, large text 3:1)**, not a flat 4.5:1 | Large text (the frame count, titles) is held to 3:1 by WCAG itself; everything else meets 4.5 |
| 2026-09-29 | **Text colours on dark surfaces are mixed toward white (`color-mix`)** rather than new fixed colours | The accent follows the widget's aurora colours and the user's Cyberpunk picks; a mix keeps following them. Chrome 111 or later (the portal's browsers are) |
| 2026-09-29 | **No keyboard shooting** (power, Enter to shoot, pocket keys, ball-in-hand keys, `[` `]`): built, then removed | The user's test: confusing, and nobody would shoot with keys; pool is a mouse game. The plan's *keyboard-only play is possible* is dropped. ←/→ fine aim stays as it was |
| 2026-09-29 | **Snooker scheduled** as Phases S0–S7 on `feat/snooker`, cut from `main` after the v2 merge. The plan is compiled into this document, not a separate one | v2 has shipped, which was the precondition. The user asked for one plan document |
| 2026-09-29 | **Pool and snooker coexist in one space**: one engine block, one `#pool-root` panel, one switcher button, one Max modal, and ⚙️ *Cue Game* choosing which game the panel is. The existing harnesses (`pool-table.html`, `pool-harness.html`, `snapshot.js`, `theme-verify.js`, `perf-check.js`, `host-run.js`, `load.js`) gain a game switch; no pages are forked | The user's call. One controller and renderer means the two cannot drift, and every pool test keeps guarding the shared code |
| 2026-09-29 | **Snooker at true scale** (R ≈ 7.36, authentic rounded pockets), no zoom in compact 2D, Max as the clear view | The user's call. It answers the old ❓ on ball size |
| 2026-09-29 | **Snooker fouls**: standard values; the incoming player may put the offender back in (and take a free ball when snookered); no miss rule; in-off → the D, otherwise play from where the ball lies | The user's call. The put-back choice is one prompt, on the foul toast; the miss rule's judgement of a "good attempt" is left out |
| 2026-09-29 | **Tap to nominate every colour**, with DOM colour chips (canvas taps in 3D and Max too) | The user's call. At true scale a ball is ~2 px in compact 2D, too small to tap |
| 2026-09-29 | **Reds 15 / 10 / 6; XP scaled to frame length; own Snooker board with a High break tab; Century and Maximum achievements** | The user's calls. Frame XP of at most 230 fits the bot's 250 per game; achievement XP has its own 600 budget in the sync gate |
| 2026-09-29 | **Snooker uses its own XP type, `'snooker'`** | The `'pool'` case unlocks *Called It* on any win with `tier === 'pro'`, which a Pro snooker win would trigger |
| 2026-09-29 | **Pool fingerprints before the seam** (table hash, seeded breaks, fuzz shots, CPU plans, PNGs identical to `main`) | S0 reroutes every 8-ball call site. Fingerprints prove, not just argue, that pool plays exactly as it does today |
| 2026-09-29 | **Revised: the draw-call fingerprint replaces PNG identity with `main`** as S0's rendering gate | Two renders of `main` itself match on only 59 of 125 scenes: the prototype racks from `Date.now()` and some scenes are timed. The headless digest of every canvas call in 12 scenes is exact and fast, and a planted 0.7% size change moves it. The PNGs were still compared (at most 2/255 off where `main` is stable) and the in-browser audit still runs on every scene |
| 2026-09-29 | **`paGame` (S0 → S4) and `phPoolParts` (S0 → S3) are built with snooker, not before it** | With one game there is nothing to shape the split against, and the controller already chooses the CPU and the rules per game through `POOL_GAMES`. Built beside snooker's profile, each seam takes exactly what the second game needs |
| 2026-09-29 | **The browser tools find Chrome, else Edge** (`browser.js`, `POOL_BROWSER` overrides) | Chrome was uninstalled from this machine; Edge is Chromium with the same DevTools protocol, and every suite ran on it unchanged |
| 2026-09-30 | **Snooker design received and frozen** (revision `1790715495-3a1b`, 27 artboards from Appendix B). Its table geometry is authoritative, as pool's is: corner holes r 17 at (±503, ±253), middle r 15.5 at (0, ±259), noses 17 / 14.5 u from the pocket, quarter-round cushion ends of radius 12. These replace the plan's WPBSA estimates | The same rule as pool: what is drawn is what plays |
| 2026-09-30 | **Snooker keeps pool's rail and nose heights, chase-camera distance and cue size**; only the shadow scales with the ball | The design draws them unscaled, and at true scale a nose at 10 u is 1.36 R, close to a real table. S0's ×k on the chase camera and the cue is taken back in S1; pool is k = 1 either way |
| 2026-09-30 | **Snooker's compact panel is tighter** (padding 12 / 16, gaps 8, header 32, footer 48) so the 20 px tracker row fits and the table stays 368 × 412 | As designed |
| 2026-09-30 | **Snooker's pockets play as measured** (S1): a corner takes a line within ±2 u clean and ±4 u off a cushion end (the ball is 14.7 u across, the mouth 24); a middle pocket ±4 u square on, narrowing with the angle. Rolling along a cushion into a corner drops at every pace, since the capture circle takes any speed | The design's geometry, measured, not tuned. A pace-dependent rattle is a tuning item for the user's test in the harness, not a geometry change |
| 2026-09-30 | **`pool-table.html` shows snooker's table through `?look=snooker` until S3**, not through the controller | Snooker has no rules, HUD model or controller profile before S2–S3. The look view uses the real camera, renderer, rack, markings and placement clamp in the panel's viewport, so the table can be judged by feel now; S3 replaces it with the real game |
| 2026-09-30 | **Free ball: the nominated ball must be hit first** (or together with the ball on). With reds left, a red hit first is a foul (4). A free ball and reds potted together score 1 each; in the clearance the free ball scores the ball on's value once, even with the ball on potted too, and comes back | WPBSA's free-ball rule. The rules table said *hit it first*; this pins the case of a red hit first |
| 2026-09-30 | **Touching ball:** the controller records the balls touching the cue ball at rest (within 0.1 u) before each shot. Playing away from one is not a hit and not a miss when it is on; a ball not on hit after playing away is a foul. No push shots | Implementer's call 9, made exact: the physics can log a contact with a ball it is leaving, so those contacts are ignored |
| 2026-09-30 | **Snookered behind the free ball means a full snooker the free ball causes:** no part of any ball on is hittable, and would be without the free ball | The rule's words (*snookered by the free ball*); a partial snooker, or one another ball makes as well, is not a foul |
| 2026-09-30 | **A colour's spot is taken when the ball would touch another** (2R + 0.02 u, the rack's gap). Every spot taken: the nearest free point behind its own spot toward the top cushion, else in front, solved exactly on the line | Real tables re-spot by eye; exact keeps the fuzz free of overlaps |
| 2026-09-30 | **Out of time on the break-off is a foul** (4); the cue ball stays in hand in the D and the chooser picks Play or Put back. Pool passes its break across without one | Snooker has no special break rule; the clock is a foul everywhere else |
| 2026-09-30 | **`?look=snooker` opens on a playable frame** (the *Play a frame* layout: 2 players, the rules; the design's stills keep their layout names, so `snapshot.js` is unchanged). Amends the row above: the view is still replaced by the real controller in S3 | The user found the S1 view could not play the break-off; S2's rules are what it needed |
| 2026-09-30 | **The choice after a foul lives in the foul toast on the table** (S3). S2's rig showed it in the side panel, so the table looked frozen after a foul; the rig frame is removed and `?look=snooker` is the stills again | The user's test of S2 |
| 2026-09-30 | **A stand-in CPU plays snooker from S3** (`psCpu*`: ghost-ball pots checked through the rules, a thin break-off, a plain safety, the free ball when offered; tiers differ only in aim), and ⚙️ gets *Snooker CPU* now rather than in S4 | Vs CPU is the panel's default mode; S4's planner replaces the stand-in behind the same profile |
| 2026-09-30 | **Snooker files records from S3 but pays no XP until S6.** The wins button shows snooker's wins and opens no board until `LB_BOARDS.snooker` exists | XP and the board go in with the bot's bounds (S6) |
| 2026-09-30 | **The free-ball toast keeps the foul's reason** (*No ball hit · Free ball*), not the design's *Snookered on every red · free ball* | The reason says what the foul was; *Free ball* on the button says the rest |
| 2026-09-30 | **While the choice is open the lean slider is hidden**, and the first aim of a snooker turn goes to a ball on with a clear line (from the D the nearest red is behind the brown) | The slider covered the toast's first button; aiming through the brown made the obvious break-off a foul |
| 2026-09-30 | **The tracker row fits the compact panel:** with SNOOKERS REQ. and Concede showing it drops the word REDS (the dot and count stay), and in the 316 px column the colour dots too. The high break in the dialog wraps rather than being cut | Our fonts run wider than the design's; the audit found both |
| 2026-09-30 | **Switching game during a tournament match** saves the match (its snapshot) and leaves tournament mode; it is resumed from the Game mode sheet as after *Leave for now* | A match is never parked twice |
| 2026-09-30 | **Open issue logged: the fixed overlay corners cover shots at snooker's scale** (the camera toggle over the top-left pocket, the chips over the bottom-right, spin over the bottom-left; the user's Max screenshots). Fix before S7: fade them out of the shot's way, move them off the felt in Max, collapse the chips once a colour is picked; see S3 | Found in the user's first test of S3 |
| 2026-09-30 | **Gaps in the artboards, decided:** a CPU chooser shows *CHOOSING*, then a notice; *Concede* keeps its 20 px look with a 44 px hit area; long choice labels fall back to *Put back* in the 316 px column; tournament setup defaults the clock to 30s as drawn, quick play keeps 45 s; the physics rack (touching) is drawn, not the design's gapped one | The design shows a human choosing only, draws a button under the 44 px rule, and is drawn at 368 px |
| 2026-09-29 | **`host-run.js` waits for ⚙️ to be hidden instead of 400 ms** | The fade could outlast the wait, leaving the overlay over the panel: 4 of 6 runs failed in a cascade from the Game mode sheet onward, `main` included |

---

## Appendix A: design prompt for the missing screens

Paste this into the existing Claude Design canvas (*"8-Ball Pool, compact panel, both
cameras"*).

```text
Add the missing screens for this 8-Ball Pool game to this canvas. Match the existing Main, Max and Table artboards exactly: same palette (ground #07090A, panel #0E1113, card #161C1F, button #1C2327 hover #242C31, text #ECE8DF, muted #9CA5A8, accent amber #F0B44C, hot #EC6A3D, ivory #F3EEE2), same type (Chakra Petch 500–700 for titles, numerals and tracked uppercase labels; Sora 400–600 for body), same radii (20 panel, 14 cards, 12 buttons, pill overlays with 0.66 black and a blur), and the same inline stroke icons. Reuse the Table component for every screen that shows the table. Compact artboards are 400×640 with the 368×412 table viewport; full-view artboards are 1280×800.

Context: the game runs inside a small widget panel on a work portal. It is offline. Modes are Vs CPU, 2 Players (hot-seat on one machine) and Tournament. Tournaments are HUMANS ONLY: every contestant is a person taking turns on the same computer. There are no CPU players in tournaments. Use realistic placeholder names (Ayesha, Bilal, Hamza, Sana, Usman, Zara, Omar, Hira, and so on).

Row 1, in-match states (compact 400×640, table visible):
1. Mode & difficulty sheet: opened from the mode button. Three options: Vs CPU, 2 Players, Tournament. Under Vs CPU, a difficulty control: Adaptive (default, shows which tier it is currently on) or pinned Easy / Normal / Hard / Pro, with one line explaining each. Pro says "Hardly misses · call every shot".
2. Ball in hand: the camera has switched to top-down automatically. The cue ball is a draggable ghost with a hand cursor. Show a valid position and an invalid one (hot colour, overlapping a ball). Include the break variant, where only the kitchen (behind the head string) is allowed and is shaded.
3. Foul and turn change: a foul toast at the top of the table ("Foul · Hit opponent's ball first", with "Ball in hand to Bilal" underneath), and a "Pass to Bilal" hand-off strip for 2 Players and Tournament, so the players know to swap seats.
4. Called pocket: the player must tap a pocket before shooting. This happens on the 8, or on every shot at Pro / when the rule is on. Show the six pockets with amber target rings, one selected, the hint pill saying "Tap a pocket to call it", and the shoot state disabled until a pocket is called. Show it in 3D and in 2D.
5. Shot clock: the active player's card has a thin amber bar draining along its bottom edge. It turns hot in the last 5 seconds.
6. Frame over, Vs CPU: a win and a loss version, with the reason ("Potted the 8 in the called pocket" / "Scratched on the 8"), the updated W·L record, and New frame / Change difficulty actions.

Row 2, tournament (compact 400×640; the same screens again at 1280×800 where noted):
7. Tournament setup: a contestants stepper (3 to 16); an editable name list, scrollable when long, where the first slot is tagged YOU and prefilled with the user's name; frames per round (race-to for first round, semi-final and final, for example 1 / 2 / 3); shot clock (30s / 45s / off); guideline (full / short / off); call pocket (8 only / every shot); a Shuffle seeds toggle; and a primary Start tournament button. Show it with 6 names entered.
8. Bracket, compact: one round per page with round tabs (Quarter-final · Semi-final · Final). Match cards show two names, frame scores, and a state chip: LIVE / NEXT / DONE / BYE. The next match is highlighted in amber, and the primary button is Play next match. Use a 6-player bracket, so two top seeds have BYEs into the semi-finals.
9. Bracket, full view 1280×800: the whole tree with connector lines, the champion slot at the end, and a completed path highlighted. Show 8 players mid-tournament, and make sure the layout visibly scales to 16 (note the 16-player column widths).
10. Match intro: the hand-off before a match. Both names large, facing each other; the round name; "Race to 2"; who breaks; a Ready button.
11. Match in progress: the normal compact table screen, but the header shows the round ("Semi-final · race to 2") and the FRAMES counter shows the running score, for example 1–0.
12. Match result: the winner, the frame scores, "Bilal is out", a small preview of the bracket with the winner advancing, and Continue.
13. Champion: a trophy moment, restrained and premium with no confetti clichés. The champion's name, their run through each round with its scores, the final bracket, and New tournament / View trophy cabinet. Also at 1280×800.
14. Resume prompt: when the panel opens with a tournament in progress, show "City Open · Semi-final · Ayesha vs Bilal, frame 2", with Resume and Abandon. Abandon asks for confirmation.
15. Trophy cabinet: local history, with titles won by bracket size (4 / 8 / 16) and a list of the last tournaments showing their champion, date and size.

Rules for all of these:
- No emoji; use stroke icons.
- Real buttons and inputs, touch targets of at least 44px, and text contrast of at least 4.5:1.
- Keep the table the hero on in-match screens; overlays must not cover the cue ball or the aim line.
- Title each artboard clearly and group the two rows with row titles.
```

---

## Appendix B: design prompt for snooker

Pasted into the same canvas on 2026-09-29; the 27 artboards it produced are revision
`1790715495-3a1b` (*What the design specifies*, in *Snooker*).

```text
Add a SNOOKER set of screens to this canvas, as three new rows below the existing ones. Snooker is a second game on the same table component; pool and snooker share one panel, and the player picks the game in the widget's settings, not in this panel. Match the existing Main, Max and Table artboards exactly (palette, type, radii, icons, the component layout: header, two 72px player cards with FRAMES between them, the 368×412 table viewport, the 3-button footer; compact 400×640, full view 1280×800). Reuse the existing InMatch and Table components and add variants for snooker rather than new one-offs. The title reads "Snooker" wherever "8-Ball Pool" appears.

THE TABLE (a Table variant, layout "snooker"): true-scale plain balls, radius 7.36 (red #B3202A, yellow #E8C21E, green #1F7A3F, brown #6B3F22, blue #1F4FB5, pink #E88FA8, black #121314); the baulk line at x = −293.5, the D (radius 81.8), six spots (brown (−293.5, 0), yellow and green at (−293.5, ±81.8) with yellow on the right from the baulk end, blue (0, 0), pink (250, 0), black (409.2, 0)); 15 reds in a triangle behind the pink; narrower snooker pockets with rounded cushion cuts (corner mouth about 24, middle about 29); no diamonds; the tiny 2D balls drawn at true scale, not enlarged.

ROW S1, in match (compact): 1 break-off, ball in hand in the D · 2 on a red, 3D: scores on the cards, BREAK 34, a 20px tracker row (REDS × 9, six colour dots, 67 REMAINING) · 3 nominate a colour: the gauge padlocked, six colour chips (value on each, at least 24px) in the call card's slot, "Tap a colour"; and pink chosen · 4 foul with a choice ("Foul · 6 to Bilal" / "Hit the blue first", Play / Make Ayesha play again), and the 2 Players hand-off first · 5 free ball (Play / Free ball / Make Ayesha play again), then "Free ball" with the chips · 6 snookers required (SNOOKERS REQ. 1, Concede) and the concede confirmation · 7 the colours (REDS × 0, the ball on ringed, "On the yellow") · 8 frame over vs CPU, win and loss, with SCORE and HIGH BREAK rows · 9 notices: "Century break · 104", "Scores level · re-spotted black" · 10 the compact 2D overview at true scale.

ROW S2: 11 the Game mode sheet with snooker's difficulty lines · 12 tournament setup (Reds 15 · 10 · 6 in place of Call pocket; 30s / 45s / 60s / off; best of 1 / 3 / 5) · 13 bracket compact and full ("Best of 3") · 14 match intro ("Ayesha breaks off", "15 reds") · 15 match in progress · 16 match result with each frame's points and the high break · 17 the snooker trophy cabinet.

ROW S3 (1280×800): 18 Max on a red · 19 Max nominate · 20 Max frame over.

Rules: no emoji; real buttons and inputs; touch targets of at least 44px (chips at least 24px in a 44px row); text contrast of at least 4.5:1, chip digits included; the table stays the hero and the tracker row never sits on the felt; artboards titled "S3 Nominate" and so on, under the row titles "Snooker · in match", "Snooker · sheet and tournament", "Snooker · full view".
```

The full text as pasted is in the session that wrote it; this is its substance, kept with
the design it produced.
