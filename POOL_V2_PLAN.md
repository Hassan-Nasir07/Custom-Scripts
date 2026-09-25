# 8-Ball Pool v2: 3D table, real physics, tournament mode

> **Living document.** Tick the boxes in **Progress** as work lands and record every
> deviation in the **Decision log** at the bottom. Attach this file as context in later
> sessions.
>
> Status: `IN PROGRESS`, Phases 0–3 done, Phase 4 built (awaiting test) · Last updated: 2026-09-25 · Branch: `feat/pool-v2` (from `feat/cyberpunk-hud-rework`)

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
3. **The spin control stays a tap-to-cycle of five presets**, as drawn: Center, Follow,
   Draw, Left, Right. The physics accepts any tip offset, so a free-drag picker can come
   later without engine changes.
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
| `pool-ui.js` | DOM HUD (cards, frames, spin picker, lean, power, hint, toggles), input handling, the loop, lifecycle hooks the host calls, Max layout | DOM |
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
| Spin | tap **SPIN** → popover with the ball face; drag the dot inside the 0.6R ring; Center/Follow/Draw/Left/Right chips | same |
| Lean | vertical slider, 3D only | – |
| Ball in hand | camera auto-switches to top-down; drag the cue ball with a hand cursor; red where placement is illegal | same |
| Call pocket | when on the 8, tap a pocket (accent ring) before the shot is allowed | same |

Pointer events replace the separate mouse and touch handlers at
[:4310-4445](AttendanceTimeCheckerPlus.js#L4310-L4445). The host's `switchGame`
add/remove listener blocks at [:9929](AttendanceTimeCheckerPlus.js#L9929) and
[:10004](AttendanceTimeCheckerPlus.js#L10004) collapse to `poolAttach()` / `poolDetach()`.
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

### Phase 4: HUD, controls, layouts — built 2026-09-25, awaiting the user's test
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
- [x] Shot clock: `prTimeout` in `pool-rules.js`. Running out is a foul with ball in hand to the opponent, as in today's game; on the break it passes the break across. The clock waits for the hand-off and for ball in hand.
- [x] `hud-verify.js`, **54 assertions**, in `verify-all.js` as *Pool HUD* (1,961 total):
  - every design state through `phModel`
  - no design hex or font in pool code
  - `clip-path` only on buttons, no `filter`
  - every `--pool-*` defined
  - Cyberpunk redefines everything light mode sets
  - `--rt-*` only under `.retro-theme`
- [x] `pool-table.html` became the theme harness. It uses the real `cyber-theme.css` and `cyber-hud.js` with Glassmorphic / Cyberpunk, the palettes and the four shapes; light mode follows the OS. It adds Vs CPU / 2 Players, the shot clock and the Max view.
- [x] `snapshot.js`: 27 scenes (every design state, light mode, Cyberpunk, both Max views) plus `--check`, an in-browser audit per scene: **292/292**. It checks:
  - no filter or clip-path on the viewport's ancestors
  - the 72 / 52 px rows and the 368:412 and 1232:672 viewports
  - every overlay inside the table, no overlapping controls, no clipped labels
  - tokens resolve, the bridge's colour is the Cyberpunk accent, and the backing store is CSS size × dpr
- [x] Driven in headless Chrome with real mouse events:
  - camera toggle, spin, lean, and Max open and Esc close (with the canvas moved across)
  - a foul in 2 Players showing the hand-off
  - READY restoring the footer, and the mode switch
- [ ] The user's test in `pool-table.html`.
- [ ] **At the Phase 5 splice (host side):**
  - the panel DOM replaces the pool scoreboard and control blocks ([:19649](AttendanceTimeCheckerPlus.js#L19649), [:19757](AttendanceTimeCheckerPlus.js#L19757)); the header keeps `#game-title` and the trophy button
  - `toggleGameMaxModal` gains `cfg.build(panel)`, Ludo's Max byte-identical. Pool's Max root copies the widget's `retro-theme` + shape classes and `applyCyberTokens`, as the host does for PiP
  - `poolOnThemeChange()` → `phThemeChanged` + table-cache reset, from `applyCyberpunkTheme` / `clearCyberpunkTheme`, the colour pickers and the `prefers-color-scheme` listener
  - ⚙️ *Shot camera: Overhead / Stay 3D* as `userPreferences.poolShotCam` (gap decision 9)

### Phase 5: input
- [ ] Pointer-events handlers; 3D rotate-aim; 2D point-aim; fine aim; power curve; spin
      popover; lean; ball-in-hand drag; call pocket; `Esc` cancel.
- [ ] Remove Play and move the anti-farm guard (problem 10). The test asserts that
      Reset → play → win pays once.

### Phase 6: CPU v2
- [ ] Candidates, cloned-world evaluation, position scoring, safeties, time slicing, four
      tiers, pinnable difficulty in ⚙️, pocket calling for the CPU.
- [ ] Call-every-shot in the input flow (every shot needs a pocket tap first). The rule
      itself landed in `prJudge` in Phase 2 (`state.callEvery`).
- [ ] `balance-check.js`: calibrate the tiers against the Phase 0 baseline, with
      hard ≥ today's CPU and pro above it. Record the measured win rates in the Decision
      log. Measure against the same four human models as `baseline-check.js`; the bar is
      hard ≥ 61.4% vs skilled and ≥ 72.3% vs casual.
- [ ] The first two tuning targets come straight from the baseline. Both fall out of
      evaluating shots on the real `step()` over the whole table:
  - reject any line where the cue ball scratches (74% of today's fouls)
  - reject any line where the 8 drops before the group is clear (58% of the CPU's
    self-inflicted losses)

  Target: CPU foul rate under 5% per visit on hard and under 2% on pro, from 13.4% today.

### Phase 7: tournament (humans only)
- [ ] Pure bracket model and tests: sizes 3–16, bye placement, seeding order, advancement,
      a reproducible shuffle.
- [ ] Setup, Bracket, Match intro, Match, Result, Champion and Resume screens; the
      "Pass to <name>" strip.
- [ ] Persistence and resume, including a mid-frame snapshot; corrupt or old-version
      handling.
- [ ] Trophy cabinet and history (local only).

### Phase 8: progression
- [ ] XP table above; the optional *Called It* achievement.
- [ ] Tier leaderboard: `poolWinsByTier`, the `pool:{easy,normal,hard,pro}` keys in
      `collectGameModeBests`, the only-raise restore, `LB_BOARDS.pool.modes`,
      `gameLbMode`, the score button. Update the Snake-suite assertions that pin the
      two-mode pool board.
- [ ] Sync bot (`sync.yml`): the monotonic per-key `gameModeBests` merge, shape validation,
      and the win-growth bound against the `gameSessions` delta. Ships **before** the
      client release that emits the tier keys, so no window exists where an outdated tab
      can erase them. Needs a headless test harness for the bot script (it is inline
      `github-script` today) and a push by the user.
- [ ] `BUILD_LABEL` bump; the `integration-verify.js` / `host-smoke.js` updates the new
      state needs.

### Phase 9: polish and verification
- [ ] Performance: under 4ms per frame for the compact panel in 3D on the office laptops,
      and FPS cap respected (`getFrameInterval`).
- [ ] Accessibility: every control is a real button or input with an `aria-label`;
      keyboard-only play is possible; colour-blind check on the solids/stripes trackers
      (they differ by pattern, not only hue).
- [ ] Theme pass: every artboard state checked in all four theme and mode combinations,
      and in Cyberpunk under all four shapes and the six colour presets. Text on
      `--pool-*` surfaces clears 4.5:1 (reuse `contrastRatio` from `cyber-hud.js`).
      Switching theme mid-frame repaints the canvas with no reload.
- [ ] **Portal verification** on `globalportal.mtbc.com` (the userscript only runs there).

---

## Open questions ❓

1. **Compact 2D ball size:** the design's top-down fit gives R≈4.5px, down from today's
   6px. If it reads too small in `preview.js`, should the compact 2D view rotate the table
   to portrait (R≈5px) or slim the rails?
2. ***Called It* achievement** for beating the pro CPU: add it or not?

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
