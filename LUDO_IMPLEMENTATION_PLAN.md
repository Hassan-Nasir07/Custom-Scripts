# Add "Ludo" (Ludo Star clone) to the Attendance Widget game panel

> **Living document.** Attach this file as context in later sessions. Tick the boxes in
> **Progress tracking** as work lands, and record any deviation from this plan in the
> **Decision log** at the bottom.
>
> Target file: [`AttendanceTimeCheckerPlus.js`](AttendanceTimeCheckerPlus.js) · 13,671 lines
> Branch: `feat/ludo-game` (off `main` @ `efbf33d`)
> Status: **Phases 0–7 complete** — the game is finished and playable standalone in
> [`ludo-dev/`](ludo-dev/) (309 assertions green). `AttendanceTimeCheckerPlus.js` is
> still untouched; Phases 8–11 are the integration.
> Last updated: 2026-08-04

## ⚠️ How to read the line numbers in this document

Every line number below was **verified against a clean `AttendanceTimeCheckerPlus.js` at
`main`/`efbf33d`** (see the Anchor table). They are navigation hints, not contracts.

The Ludo block gets inserted **before line 6382**, so the moment it lands, *every anchor
after 6382 shifts down by the size of the block*. Do not trust a post-6382 number after
Phase 1 — **re-find the symbol by name** (`grep -n "function initCurrentGame"`), and use
`git diff` to see exactly what moved. Anchors before 6382 stay stable.

## Context

`AttendanceTimeCheckerPlus.js` (single IIFE, injected only on
`https://globalportal.mtbc.com/#/time-absence/attendence-record`) hosts a multi-game
panel in the widget's left column: Snake, Flappy, Tetris, RefleX, Aim, Breakout,
8-Ball Pool, Prayer Counter, Leaderboard. Every game feeds one shared progression
system (XP → level → achievements) and one shared cloud leaderboard.

We want a 9th game: **Ludo**, a copy of Ludo Star — the first *board* game in the
panel, and the only one with 3- and 4-player support. It must plug into the existing
XP/achievement/leaderboard plumbing rather than growing a parallel one, and must not
open an XP-farming hole (the file already carries anti-farm guards, e.g. the comment in
`startPoolGame` at [4270](AttendanceTimeCheckerPlus.js#L4270) and the sync XP-budget
gate around [916](AttendanceTimeCheckerPlus.js#L916)).

**Decisions already made (from Q&A):**

| Topic | Decision |
|---|---|
| Modes | **PvCPU = 2P only**; **PvP = 2P / 3P / 4P** hot-seat |
| Rules | **Full Ludo Star ruleset**, with blocks / 3-sixes / exact-home exposed as ⚙️ settings toggles |
| CPU | **Adaptive difficulty** driven by recorded win-rate |
| XP | **Performance-scaled** (placement + tokens home + captures) × difficulty × board-size |
| Leaderboard 🎲 column | **CPU wins** (`ludoGamesWon`), mirroring Pool |
| Turn UX | **Tap dice → tap token**, auto-play when only one legal move |
| Dice | **True random both sides** (`1 + floor(random*6)`), no bias, no pity timer |
| Achievements | **3 new**: 🎲 Ludo Champion (100 CPU wins), 🛡️ Flawless (win, zero tokens lost), 🔥 Hunter (5 captures in a match) |

---

## Anchor table — verified at `efbf33d`

Everything the implementation has to touch, with the **actual** line number. Corrections
against the first draft of this plan are flagged ⚠️.

### Stable (before the insertion point — these do not move)

| Symbol / site | Line | Note |
|---|---|---|
| `const ACHIEVEMENTS` | 262 | add 3 entries to the "Gaming" group |
| `let userPreferences` | 314 | add 4 flat rule flags |
| `poolGamesWon` localStorage get/set | 551 / 555 | template for `load/saveLudoWins` |
| `loadPoolRecord` / `savePoolRecord` | 557 / 561 | template for `load/saveLudoRecord` |
| `AC_MAX_XP_PER_GAME = 300` | 657 | the XP clamp |
| `collectGameBests` | **759** ⚠️ *(plan said 762)* | `pool:` key at 767 |
| `buildPlayerSnapshot` | 774 | `poolRecord:` at 795 |
| sync XP-budget gate | ~916 | anti-cheat budget |
| `applyPlayerRecordToLocal` | 960 | `raise('poolGamesWon', …)` at 1000 |
| `poolRecord` only-raise merge | 1041–1049 | mirror for `ludoRecord` |
| `renderLeaderboardPanel` | 1270 | `colspan="11"` at **1327** → becomes 12 |
| `poolGamesWon` / `poolRecord` state | 1407 / 1408 | declare Ludo state alongside |
| `POOL_SHOT_CLOCK = 30` | 1449 | Ludo uses 20 |
| `POOL_TABLE_OFFSET_Y` | 1457 | the "table + HUD margins" pattern |
| `poolAITakeShot` | 2938 | scorer template |
| pool scoreboard W/L render | 3962–3963 | HUD template |
| `handlePoolMouseDown` | 4079 | scale-aware hit-testing |
| `initPoolGame` | 4223 | |
| `resetPoolGame` | 4234 | |
| `startPoolGame` | 4270 | anti-farm comment lives here |
| `poolLoop` | 4287 | fixed-timestep + FPS cap |
| `endPoolGame` | 4357 | win bookkeeping 4363–4372 |
| `togglePoolMode` | 4396 | |
| `togglePoolMaximize` | 4408–4530 | → extract to `toggleGameMaxModal` |
| `.pool-modal-panel` query | 4518 | inside the modal helper |
| **`// GAME SWITCHING SYSTEM`** | **6382** | ⬅ **insertion point — Ludo block goes immediately before this** |

### Shifting (after the insertion point — re-find by name after Phase 1)

| Symbol / site | Line @ `efbf33d` | Note |
|---|---|---|
| `cleanupCurrentGame` | **6401** ⚠️ *(plan said 6402)* | `case 'pool'` at 6447 |
| `initCurrentGame` | **6467** ⚠️ *(plan said 6482 — off by 15)* | `case 'pool'` at 6517 |
| `updateGameSwitcher` | **6542** ⚠️ *(plan said 6543)* | ids array |
| `updateGameControls` | **6550** ⚠️ *(plan said 6551)* | `ctrlIds`/`statIds`, `case 'pool'` at 6583 |
| `revalidateAchievements` | 7007 | `poolShark` at 7047, session-only comment 7048–7050 |
| `checkGameAchievements` | 7068 | `case 'pool'` at **7104** |
| `ACHIEVEMENT_XP` | 7114 | |
| achievement grid count | 7169, 7261 | auto-updates via `Object.keys(ACHIEVEMENTS).length` |
| `awardGameXP` | 7321 | `case 'pool'` at **7468** |
| `.pool-modal-*` CSS | 8885–8970 | + dark/light overrides at 9633–9646 and 12108–12121 |
| `.toggle-switch` CSS | 9014 | settings toggle styling |
| `#pool-canvas` CSS | 11675 | add `#ludo-canvas` after |
| settings toggles / `data-pref` | 12483–12553 | generic handler at **12573**, writes flat |
| pool switcher button | 13768 | add 🎲 after |
| `pool-scoreboard` | **13800** ⚠️ *(plan said 13804)* | |
| `pool-canvas` | 13819 | add `ludo-canvas` after |
| `pool-controls` | **13884** ⚠️ *(plan said 13889)* | buttons 13886–13888 |
| keyboard game switch | `case '8'` = leaderboard at **14090** | ⚠️ **`8` is taken** — Ludo gets `9` |
| Escape reset switch | `case 'pool'` at 14102 | |
| window bridges | 14157–14160 | `startPoolGameBtn` … `togglePoolMaximizeBtn` |
| `lbRegister` `gameBests` literal | fn 14165, `pool:` at **14192** ⚠️ *(plan said 14187)* | |
| `lbSync` `gameBests` literal | fn 14203, `pool:` at **14222** ⚠️ *(plan said 14217)* | |
| `updateGameTitle` | **14232** ⚠️ *(plan said 14236)* | |

---

## Architecture: follow the 8-Ball Pool template

Pool is the closest existing analogue — turn-based, PvP/PvCPU toggle, turn clock,
canvas-drawn HUD, 2× "Max" modal, W/L record persisted. Ludo mirrors its shape:

| Concern | Pool reference | Ludo equivalent |
|---|---|---|
| Fixed-timestep loop + FPS cap | `poolLoop` (4287) | `ludoLoop` |
| Init / reset / start | `initPoolGame` (4223) · `resetPoolGame` (4234) · `startPoolGame` (4270) | `initLudoGame` / `resetLudoGame` / `startLudoGame` |
| Scale-aware canvas hit-testing | `handlePoolMouseDown` (4079) | `handleLudoPointerDown` |
| CPU scorer | `poolAITakeShot` (2938) | `ludoAIChooseMove` |
| Turn clock | `POOL_SHOT_CLOCK` (1449) | `LUDO_TURN_CLOCK = 20` |
| End-of-match XP | `endPoolGame` (4357) | `endLudoGame` |
| Mode toggle | `togglePoolMode` (4396) | `cycleLudoMode` |
| 2× Max modal | `togglePoolMaximize` (4408) | shared helper — see below |

**Placement:** one contiguous `// ═══ LUDO GAME ═══` section (state + constants + all
functions) immediately **before** `// GAME SWITCHING SYSTEM` at line 6382. All game state
is IIFE-scoped `let`, and nothing runs until `initLudoGame()` is called post-IIFE, so
declaration order is safe. One block keeps the diff reviewable.

### Reuse: extract the Max-modal helper

`togglePoolMaximize` (~120 lines, 4408–4530) is already fully generic apart from
hardcoded names and buffer constants. Extract it to
`toggleGameMaxModal({ canvasId, title, bufferW, bufferH, stateRef })` placed near line
4400, migrate Pool to call it, and have Ludo call it too. Avoids a second 120-line copy.

**Keep the `.pool-modal-*` class names** rather than renaming to `.game-max-modal-*`:
the classes appear in three separate CSS blocks (8885–8970, plus dark/light overrides at
9633–9646 and 12108–12121) and a `querySelector` at 4518. Renaming is four times the
diff for a cosmetic gain. Pool's behaviour must be re-verified (see Verification).

---

## Board model

15×15 grid, **cell = 20px → board 300×300**, inside a **344×416** canvas: 58px HUD
strips top and bottom (`LUDO_STRIP_H`), 22px side margins, 8px wooden frame. Same
"table + HUD margins" split Pool uses via `POOL_TABLE_OFFSET_Y` (1457). Everything
(player chips, dice, turn clock, banners, game-over standings) is **canvas-drawn**,
because the Max modal relocates only the `<canvas>`.

Seats map to quadrants — Blue TL, Red TR, Green BR, Yellow BL — and each player's chip
sits in the strip on their own side of the board. The dice renders in whichever strip
belongs to the player to move, so attention follows the turn.

```
LUDO_RING      52 × {r,c}, clockwise         // shared track
LUDO_COLORS    blue(TL) → red(TR) → green(BR) → yellow(BL)   // turn order = clockwise
               each: { startIndex, homeCol: [5 × {r,c}], baseSlots: [4 × {x,y}], hex }
               startIndex = 0 / 13 / 26 / 39
LUDO_SAFE_RING Set([0,8,13,21,26,34,39,47])  // 4 starts + 4 ★ squares
```

**Token position = single integer `step`, 0…56** (plus a `base` flag):

- `step 0…50` → ring cell `(startIndex + step) % 52` — 51 shared squares
- `step 51…55` → own colour home column (5 squares)
- `step 56` → home (centre triangle)

57 steps to home, standard Ludo King/Star geometry. `exactHome` on ⇒ a move is only
legal if `step + roll <= 56`.

**Active colours per mode:** PvCPU-2P and PvP-2P = blue + green (diagonal);
PvP-3P = blue + red + green; PvP-4P = all four. Inactive quadrants draw dimmed.

---

## Rules

Implemented in full; the first three are toggleable in ⚙️ settings.

- **Six to release** — token leaves base only on a 6 (`freeRelease` toggle, default
  off, allows any roll)
- **Extra turn** on a 6, on a capture, and on landing a token home
- **`threeSixes`** (default on) — three consecutive 6s forfeits the turn and voids
  the third roll
- **`blocks`** (default on) — 2+ own tokens on one ring cell: opponents can neither
  land on nor pass through it
- **`exactHome`** (default on) — exact roll required to reach step 56; otherwise
  overshoot is allowed
- **Safe squares** — no capture on `LUDO_SAFE_RING` cells or in any home column
- **Capture** — landing on a lone opponent token on a non-safe ring cell sends it to
  base and grants an extra turn
- **Win** — first player to bring all 4 tokens home; remaining players are ranked by
  (tokens home, total steps) for 3P/4P placement

---

## Turn flow

1. Turn starts → dice pulses; `LUDO_TURN_CLOCK = 20` begins counting down
2. Tap dice → 600ms tumble animation (random faces) → settles on
   `ludoRollDice() = 1 + Math.floor(Math.random() * 6)`
3. Legal tokens get a bouncing ▼ marker + ghost preview of the destination
4. Tap a token → it hops square-by-square (~90ms/square), then resolves
   capture / home / extra-turn
5. **0 legal moves** → "No moves" banner, auto-pass after 800ms.
   **Exactly 1 legal move** → auto-plays after 400ms
6. Clock expiry → auto-roll if unrolled, else auto-play the CPU-scorer's best move

Pointer input via a single `handleLudoPointerDown` (+ touch variant) that converts client
coords using `rect.width / LUDO_CANVAS_W`, exactly as `handlePoolMouseDown` does (4079).

---

## Adaptive CPU

`ludoRecord = { wins, losses }` (**CPU matches only**) → tier locked at match start
into `ludoCpuTier`, and rendered in the HUD so the player can see it:

```
games = wins + losses
games < 5            → 'normal'      // sample guard
rate < 0.40          → 'easy'
rate <= 0.65         → 'normal'
else                 → 'hard'
```

`ludoAIChooseMove()` scores every legal (token, roll) pair — same shape as
`poolAITakeShot`'s scoring pass:

```
capture opponent          +120
land token home           +100
reach ★ safe square        +45
form a block               +35
release from base          +30
forward progress          +0.4 × step
destination in enemy       −60   // within 1..6 of an opponent behind us
```

- `hard` — full scorer
- `normal` — scorer with the enemy-range term disabled
- `easy` — 70% random legal move, 30% best

---

## XP

New `case 'ludo'` in `awardGameXP` (fn 7321, beside `case 'pool'` at 7468), called once
from `endLudoGame`:

```
base        win 90  |  runner-up (3P/4P) 40  |  otherwise 15
+ 8  per own token home   (cap 32)
+ 3  per capture made     (cap 18)
× tier multiplier         easy 0.6 / normal 1.0 / hard 1.35
× 1.15                    if 3P or 4P
PvP hot-seat              → flat 20 XP, no multipliers (nothing to beat)
clamp                     → 300   // AC_MAX_XP_PER_GAME, line 657
```

Realistic ceiling: `(90+32+18) × 1.35 × 1.15 ≈ 217` — comfortably inside the sync
anti-cheat budget (~916). The adaptive tier makes this self-correcting: throwing matches
to drop to `easy` also drops the multiplier to 0.6.

**Anti-farm requirements** (match the reasoning in the comment at 4270):

- `endLudoGame` is idempotent — guard on `ludoGameOver`
- `startLudoGame` force-resets when `ludoGameOver` is set
- Reset / mode-switch / tab-switch mid-match awards nothing
- PvP hot-seat never increments `ludoGamesWon` or `ludoRecord`

---

## Integration points

One file: [`AttendanceTimeCheckerPlus.js`](AttendanceTimeCheckerPlus.js). See the
**Anchor table** for verified line numbers; the summary below is the *what*.

**New code**
- `// ═══ LUDO GAME ═══` block before 6382 — state, constants, board tables, rules
  engine, AI, renderer, input handlers, `endLudoGame`
- `toggleGameMaxModal(cfg)` helper near 4400 (Pool migrated onto it)

**Preferences & storage**
- `userPreferences` (314): flat flags `ludoBlocks`, `ludoThreeSixes`, `ludoExactHome`,
  `ludoFreeRelease` — flat because the settings handler at 12573 writes
  `userPreferences[pref]` directly
- localStorage helpers beside `loadPoolRecord`/`savePoolRecord` (557/561):
  `load/saveLudoWins` (`ludoGamesWon`), `load/saveLudoRecord` (`ludoRecord`)

**Cloud sync / leaderboard** — add `ludo` everywhere `pool` appears:
- `collectGameBests` (759) → `ludo:` beside `pool:` (767)
- `buildPlayerSnapshot` (774) → `ludoRecord` beside `poolRecord` (795)
- `applyPlayerRecordToLocal` (960) → `raise('ludoGamesWon', gb.ludo)` (beside 1000) +
  only-raise merge of `ludoRecord` (mirror 1041–1049)
- `renderLeaderboardPanel` (1270) → `<th title="Ludo">🎲</th>` + `<td>${fmt(gb.ludo)}</td>`,
  **`colspan` 11 → 12** (1327)
- the two inline `gameBests` literals: `lbRegister` (14192) and `lbSync` (14222)
- No server change needed — `github-actions-bot/.github/workflows/sync.yml` and
  `cloudflare-worker/worker.js` don't enumerate `gameBests` keys

**XP & achievements**
- `ACHIEVEMENTS` (262) → `ludoChamp` 🎲, `ludoFlawless` 🛡️, `ludoHunter` 🔥 in the
  "Gaming" group (grid count auto-updates 27 → 30 via `Object.keys(ACHIEVEMENTS).length`
  at 7169/7261)
- `ACHIEVEMENT_XP` (7114) → `ludoChamp: 150, ludoFlawless: 120, ludoHunter: 80`
- `checkGameAchievements` (7068) → `case 'ludo'` beside `case 'pool'` (7104)
- `revalidateAchievements` (7007) → `ludoChamp` when `ludoGamesWon >= 100` (beside
  `poolShark`, 7047); extend the session-only comment at 7048–7050 to name
  Flawless/Hunter

**Game-switcher plumbing** — add a `'ludo'` case/entry in each:
`cleanupCurrentGame` (6401, pool case 6447) · `initCurrentGame` (6467, pool case 6517) ·
`updateGameSwitcher` ids array (6542) · `updateGameControls` `ctrlIds`/`statIds` +
case (6550, pool case 6583) · `updateGameTitle` (14232)

**HTML in `renderFullContent`**
- switcher button after Pool (13768): `<button id="game-switch-ludo" … onclick="window.switchGame('ludo')" title="Ludo">🎲</button>`
- `ludo-scoreboard` div after `pool-scoreboard` (13800) — coloured dots + tokens-home
  per active player + turn label
- `<canvas id="ludo-canvas" width="344" height="416" style="display:none; cursor:pointer;">`
  after 13819 — **not** Pool's 368×368; see the decision log
- `ludo-controls` div after `pool-controls` (13884): `🔄 PvCPU` (cycles PvCPU → PvP 2P →
  PvP 3P → PvP 4P) · `▶ Play` · `🔄 Reset` · `⛶ Max`

**Window bridges** (beside 14157–14160): `startLudoGameBtn`, `resetLudoGameBtn`,
`cycleLudoModeBtn`, `toggleLudoMaximizeBtn`

**Keyboard** — `8` is already **leaderboard** (14090), so Ludo takes `9`:
`case '9': window.switchGame('ludo')`; add `case 'ludo': resetLudoGame()` to the Escape
switch at 14102

**CSS** in the `modernStyles` template
- `/* ==================== LUDO STYLES ==================== */` after the `#pool-canvas`
  rule (11675): `#ludo-canvas` (radius, glow, `aspect-ratio: 1/1`, `width: 100%`) and
  `.ludo-rule-toggles`
- light-mode override near 12087–12121 if the board needs it
- `.pool-modal-*` (8885) reused as-is by the shared modal — **not renamed**

**Settings modal** — after the Pool colour swatches block (~12531), a `🎲 Ludo Rules`
group of four `.toggle-switch` elements. The generic handler at 12573 writes
`userPreferences[pref]` flat, which is why the rule flags are stored flat.

---

## Progress tracking

Build order is top to bottom — geometry first, because everything else reads off the
board tables.

### Phase 0 — Setup
- [x] Copy this plan to `Desktop/Custom Scripts/LUDO_IMPLEMENTATION_PLAN.md`
- [x] ~~Back up `AttendanceTimeCheckerPlus.js`~~ → **superseded by git**: work happens on
      branch `feat/ludo-game` off `main` @ `efbf33d`; the redundant
      `AttendanceTimeCheckerPlus.pre-ludo.bak.js` was verified hash-identical to the
      tracked file and deleted
- [x] Verify every line-number anchor against the real file → **Anchor table** above
- [x] Scratchpad harness — `ludo-harness.html` (368×368 canvas + stubs for
      `awardGameXP` / `showXPNotification` / `getFrameInterval` / `FIXED_DT`),
      `ludo-verify.js` (headless geometry assertions), `render-smoke.js`
      (drives `ludoRender` against a stub 2D context)

### Phase 1 — Board & renderer
> Built and verified in the scratchpad as `ludo-core.js`. **Not yet inserted into
> `AttendanceTimeCheckerPlus.js`** — insertion happens once the engine phases are done,
> so the file takes one clean, reviewed diff.
- [x] `LUDO_RING` (52 cells, clockwise), `LUDO_COLORS`, `LUDO_SAFE_RING`
- [x] Static board render: 4 quadrants, cross track, centre triangles, ★ squares
- [x] HUD strips (player chips + tokens-home, turn label, message, CPU tier)
- [x] Tokens rendered in base slots (+ ring, home column and centre)
- [x] Geometry check: **78/78 headless assertions pass** — ring closure, the four
      base-corner turns, gate→home-column continuity, per-colour 0→56 walks,
      safe-square derivation, quadrant/base containment

### Phase 2 — Dice & turn clock
- [x] `ludoRollDice()` — `1 + Math.floor(Math.random() * 6)`; verified flat over
      60,000 rolls (worst face deviation 1.33%)
- [x] 620ms tumble animation with face flicker; dice breathes when awaiting a tap
- [x] `LUDO_TURN_CLOCK = 20` as a depleting ring around the dice; expiry auto-rolls,
      or auto-plays the scorer's pick if already rolled
- [x] Dice hit-testing via `rect.width / LUDO_CANVAS_W` (tested at half scale)

### Phase 3 — Movement
- [x] `step` 0…56 model + step→cell resolution (ring → own home column → home)
- [x] Legal-move generation (`ludoLegalMoves` → `{token, from, to, release, captures, finishes}`)
- [x] Capture → opponent token to base, with per-player capture/loss tallies
- [x] Bouncing ▼ marker + gold glow + ghost destination preview on legal tokens
- [x] Square-by-square hop animation (95ms/square) with a parabolic lift;
      tolerates the four diagonal corner steps (explicitly tested)
- [x] Auto-play on single legal move (420ms); auto-pass on zero (850ms banner)
- [x] Stacked tokens spread apart with a count badge, so a block never reads as
      one piece

### Phase 4 — Full rule set
*All six implemented and covered by `rules-verify.js`.*
- [x] Six-to-release (+ `freeRelease` override)
- [x] Extra turn on 6 / capture / token-home
- [x] `threeSixes` — third consecutive 6 forfeits **and** voids the roll
- [x] `blocks` — 2+ **same-colour** tokens bar landing *and* passing; counted
      per (colour, square) so two colours sharing a ★ is not a block
- [x] `exactHome` — on: `step + roll <= 56`; off: overshoot clamps to 56 and finishes
- [x] Safe squares (`LUDO_SAFE_RING` + all home columns)

### Phase 5 — Match resolution
- [x] Win detection (all 4 tokens home); turn rotation skips finished players
- [x] 3P/4P placement ranking by (finish order, then tokens home, then total steps)
- [x] Termination proven: 400 random 4P self-play games all reach a winner,
      zero illegal moves or token states
- [x] `endLudoGame` — idempotent, guarded on `ludoAwarded`; calls the host's
      `awardGameXP('ludo', …)` once and writes `ludoGamesWon` / `ludoRecord`
- [x] `startLudoGame` force-resets a finished board before replaying
- [x] Game-over overlay with final standings
- [x] Anti-farm proven: replayed `endLudoGame`, ▶ Play on a finished board,
      mid-match reset and mid-match mode switch all award nothing extra

### Phase 6 — CPU
- [x] `ludoAIChooseMove` weighted scorer
- [x] Adaptive tier from `ludoRecord` win-rate (+ `games < 5` sample guard);
      boundaries asserted at 0.39/0.40 and 0.65/0.66
- [x] easy / normal / hard degradations — `hard` alone applies the −60
      enemy-range term (asserted as an exact 60-point delta on the same move)
- [x] **Strength ordering measured, not assumed** — 600-game head-to-head:
      hard beats easy 84.5%, normal beats easy 79.8%, hard edges normal 57.8%
- [x] Tier locked at match start into `ludoCpuTier` from the stored record, and
      printed on the CPU's HUD chip

### Phase 7 — Modes
- [x] `cycleLudoMode` — PvCPU-2P → PvP-2P → PvP-3P → PvP-4P, wrapping
- [x] Active-colour sets per mode (`LUDO_MODE_COLORS`); 2P uses the diagonal
      pair so both starts are 26 squares apart
- [x] Turn order = clockwise, skipping inactive colours and finished players
- [x] Switching mode fully resets tokens, placements, roll, streak and stats
- [x] Inactive quadrants dimmed — desaturate toward the colour's own luminance
      then lift toward paper (blending straight to grey turned red to mud and
      yellow to olive)

### Phase 8 — Panel wiring
> Anchors below shift once the Ludo block lands — re-find by symbol name.
- [ ] `cleanupCurrentGame` — cancel `ludoAnimFrame`, detach listeners
- [ ] `initCurrentGame`
- [ ] `updateGameSwitcher` ids array
- [ ] `updateGameControls` `ctrlIds` / `statIds` + case
- [ ] `updateGameTitle`
- [ ] HTML: 🎲 switcher button, `ludo-scoreboard`, `ludo-canvas`, `ludo-controls`
- [ ] Window bridges: `startLudoGameBtn`, `resetLudoGameBtn`, `cycleLudoModeBtn`, `toggleLudoMaximizeBtn`
- [ ] Keyboard: `case '9'` (**not `8`** — that's leaderboard) + Escape reset
- [ ] CSS: `#ludo-canvas` + `.ludo-rule-toggles` after the `#pool-canvas` rule; light-mode override

### Phase 9 — Progression & cloud
- [ ] `userPreferences` flat rule flags (314)
- [ ] localStorage helpers beside `savePoolRecord` (557/561)
- [ ] ⚙️ settings `🎲 Ludo Rules` toggle group
- [ ] `awardGameXP` → `case 'ludo'`
- [ ] `ACHIEVEMENTS` + `ACHIEVEMENT_XP` → `ludoChamp` / `ludoFlawless` / `ludoHunter`
- [ ] `checkGameAchievements` → `case 'ludo'`
- [ ] `revalidateAchievements` → `ludoChamp` at 100 wins + comment update
- [ ] `collectGameBests` (759) → `ludo`
- [ ] `buildPlayerSnapshot` (795) → `ludoRecord`
- [ ] `applyPlayerRecordToLocal` (1000, 1041–1049) → raise `ludoGamesWon`, merge `ludoRecord`
- [ ] `renderLeaderboardPanel` → 🎲 `<th>`/`<td>`, colspan 11 → 12 (1327)
- [ ] Inline `gameBests` literals in `lbRegister` and `lbSync`

### Phase 10 — Shared Max modal
- [ ] Extract `toggleGameMaxModal(cfg)` near 4400
- [ ] Migrate `togglePoolMaximize` onto it
- [ ] Wire Ludo's ⛶ Max
- [ ] Pool regression pass

### Phase 11 — Verification
- [ ] Harness checks (see Verification)
- [ ] In-app checks (see Verification)

---

## Verification

The script self-guards to one URL (43–48), so iterating in-place is slow.

**Fast loop (Phases 1–7)** — everything lives in [`ludo-dev/`](ludo-dev/), which has its
own [README](ludo-dev/README.md). One command:

```
node ludo-dev/verify-all.js     # 309 assertions across 6 suites, non-zero exit on failure
```

| Suite | Covers | Assertions |
|---|---|---|
| `ludo-verify.js` | Board geometry | 78 |
| `rules-verify.js` | Dice, legal moves, rule toggles, turn flow, 400 self-play games | 75 |
| `ai-verify.js` | Tiers, scorer, 600-game strength ordering | 36 |
| `modes-verify.js` | Mode cycling, seats, turn order | 38 |
| `ui-verify.js` | State machine, animation, clock, pointer input, anti-farm, XP | 72 |
| `render-smoke.js` | `ludoRender()` across all modes and steps | 10 |

Plus `node ludo-dev/preview.js out.png <scenario>` to render the board to a PNG, and
`ludo-dev/ludo-harness.html` to actually play it. Verify there:

- All 4 quadrants, the cross track, and the centre triangle land on grid lines
- A token walked step 0 → 56 traces the full ring and turns into its **own** colour column
- Safe squares render ★ at ring indices 0, 8, 13, 21, 26, 34, 39, 47
- Dice over ~600 rolls is flat across 1–6 (no bias)
- Each rule toggle observably changes legality (block passage, third six, overshoot)
- CPU-vs-CPU auto-play at all three tiers completes without stalling or illegal moves

**In-app (Phases 8–10)** — on `https://globalportal.mtbc.com/#/time-absence/attendence-record`
with the userscript loaded:

- 🎲 tab appears after 🎱; `9` and click both switch to it; switching away cancels
  `ludoAnimFrame` and detaches listeners (check via `getEventListeners` / no console noise)
- Win a PvCPU match → XP toast fires once, `ludoGamesWon` increments, Level/Total XP
  update in the right panel
- Click ▶ Play again **without** Reset → no second XP award
- Win a PvP hot-seat match → flat 20 XP, `ludoGamesWon` unchanged
- Force each achievement by seeding localStorage (`ludoGamesWon = 99` then win;
  capture 5 in one match; win untouched) → badge + XP toast, grid reads `n/30`
- ⚙️ → toggle each Ludo rule, reload, confirm it persisted in `attendancePrefs`
- ⛶ Max → 2× crisp board, Esc and backdrop close, canvas returns to the panel
- **Pool regression:** ⛶ Max on 8-Ball Pool still opens/scales/closes correctly after
  the helper extraction
- 🏆 Leaderboard → 🎲 column present, own row shows the CPU-win count, header/row
  cell counts match (12 columns), `🔄` sync succeeds without an anti-cheat warning
- Set `ludoGamesWon`/`ludoRecord` to 0, sync, then restore from cloud → both come back

**Git-based safety net (new this session):** each phase is a checkpoint commit on
`feat/ludo-game`. `git diff main...HEAD -- AttendanceTimeCheckerPlus.js` is the review
surface; `git checkout main -- AttendanceTimeCheckerPlus.js` is the instant rollback.

---

## Decision log

Record anything that diverges from the plan above, so a later session reading this file
doesn't re-derive it from the code.

| Date | Decision / deviation | Why |
|---|---|---|
| 2026-08-04 | PvCPU is 2P only; PvP offers 2P/3P/4P | User's call — keeps the CPU scorer to one opponent |
| 2026-08-04 | Full rule set, three rules exposed as ⚙️ toggles | User's call |
| 2026-08-04 | Adaptive CPU difficulty (win-rate driven), not a manual selector | User's call |
| 2026-08-04 | Rule flags stored **flat**, not nested under `ludoRules` | The settings handler at 12573 writes `userPreferences[pref]` flat; every existing pref follows that |
| 2026-08-04 | 🎲 leaderboard column = CPU wins, PvP excluded | Mirrors `poolGamesWon`; hot-seat wins would be trivially farmable |
| 2026-08-04 | Board 300×300 (cell 20) inside a 368×368 canvas, all HUD canvas-drawn | The ⛶ Max modal relocates only the `<canvas>`, so DOM-based HUD would vanish in the modal |
| 2026-08-04 | Extract the Max modal into a shared helper and migrate Pool | Avoids a second 120-line copy of `togglePoolMaximize` |
| 2026-08-04 | Rules sourced from standard Ludo Star/King rules + the reference screenshot | The linked Scribd doc requires auth and could not be read — **verify the rule set against it and log any differences here** |
| **2026-08-04** | **Git is the safety net; the `.bak` file is deleted** | Git was not detected in the first session, so a manual `.pre-ludo.bak.js` was made. Git *is* available: work is on `feat/ludo-game` off `efbf33d`, the backup was verified hash-identical (`80DDAA3E…`) and removed. Phase checkpoints are commits. |
| **2026-08-04** | **Anchor table added; line numbers are hints, not contracts** | The first draft's anchors were partly stale — `initCurrentGame` was off by 15 (6467, not 6482), plus ~8 smaller drifts. All anchors re-verified at `efbf33d`; anchors after 6382 shift once the Ludo block lands. |
| **2026-08-04** | **Keyboard shortcut is `9`, not `8`** | `case '8'` at 14090 is already **leaderboard**. The first draft implied 8 was free. |
| **2026-08-04** | **`.pool-modal-*` CSS classes kept, not renamed to `.game-max-modal-*`** | The classes span three CSS blocks (8885–8970, 9633–9646, 12108–12121) plus a `querySelector` at 4518; renaming quadruples the diff for a cosmetic gain. |
| **2026-08-04** | **The ring contains 4 *diagonal* steps — this is correct, not a bug** | At ring pairs 4→5, 17→18, 30→31, 43→44 the track wraps the outer corner of a 6×6 base (e.g. `(6,5)→(5,6)` rounds Blue's corner at `(5,5)`). That is how a physical Ludo board is laid out, and the canonical 52-cell path requires it — inserting corner cells would give 56. **Consequence for Phase 3:** the hop animation must not assume `\|Δr\|+\|Δc\| === 1`. Asserted explicitly in `ludo-verify.js` (exactly 4 turns, each pivoting on a base corner and never through the centre). |
| **2026-08-04** | **Home columns are 5 cells and stop one square short of the centre** | `step 51–55` are the coloured column, `step 56` moves the token off-grid into the triangle. So the last column cell (e.g. Blue `(7,5)`) touches the centre **3×3 block**, not the single square `(7,7)`. |
| **2026-08-04** | **Engine is built in the scratchpad first, inserted into the userscript once** | The script self-guards to one URL, so in-place iteration is slow. `ludo-core.js` + a headless verifier gives a sub-second feedback loop; the 13.6k-line file then takes one reviewed diff instead of dozens. |
| **2026-08-04** | **Source split into `ludo-core.js` (engine) + `ludo-ui.js` (render/interaction)** | One file passed 650 lines. They are concatenated in that order at insertion time, so the userscript still gets one contiguous block. |
| **2026-08-04** | **Canvas is 344×416, not Pool's 368×368** | Ludo needs a square board *plus* HUD room. 58px strips clear the dice's turn-ring (r=19) from the board frame — at 52px it clipped. Narrowing 368→344 puts the board at 87% of canvas width instead of 81%, which is worth real pixels in a ~300px panel column. Set `aspect-ratio: 344/416` in CSS. |
| **2026-08-04** | **Timers run off the animation loop, never `setTimeout`** | `cleanupCurrentGame` cancels `ludoAnimFrame`; a stray `setTimeout` would keep firing after the player switched tabs. `ludoAfter(ms, fn)` is drained inside `ludoUpdate`. |
| **2026-08-04** | **Inactive quadrants desaturate toward their own luminance, then lighten** | Blending straight to grey turned red into mud and yellow into olive — they read as "dirty" rather than "not in play". Verified visually with `preview.js`. |
| **2026-08-04** | **Dice breathes instead of showing a "TAP" label** | The label did not fit in the strip without colliding with the board frame, and a pulsing scale is a clearer affordance anyway. |
| **2026-08-04** | **`preview.js` — a from-scratch software rasterizer** | No `canvas`/`playwright`/`puppeteer` available and Node is 10.24, so the board could not otherwise be *seen*. It implements enough Canvas2D (transforms, arc/arcTo/ellipse paths, nonzero fill, strokes, gradients, a 3×5 bitmap font) to render real `ludoRender()` output to a PNG. Caught the turn-ring/frame collision and the muddy dim colours, neither of which any assertion would have found. |
