# Add "Ludo" (Ludo Star clone) to the Attendance Widget game panel

> **Living document.** This file is copied to
> `Desktop/Custom Scripts/LUDO_IMPLEMENTATION_PLAN.md` as the first execution step, so it
> sits beside the other guides in the repo (`WFH_WFO_Feature_Guide.md`, `README.md`) and can
> be attached as context in later sessions. Tick the boxes in **Progress tracking** as work
> lands, and record any deviation from this plan in the **Decision log** at the bottom.
>
> Status: `NOT STARTED` · Last updated: 2026-08-04

## Context

`AttendanceTimeCheckerPlus.js` (13,671 lines, single IIFE, injected only on
`https://globalportal.mtbc.com/#/time-absence/attendence-record`) hosts a multi-game
panel in the widget's left column: Snake, Flappy, Tetris, RefleX, Aim, Breakout,
8-Ball Pool, Prayer Counter, Leaderboard. Every game feeds one shared progression
system (XP → level → achievements) and one shared cloud leaderboard.

We want a 9th game: **Ludo**, a copy of Ludo Star — the first *board* game in the
panel, and the only one with 3- and 4-player support. It must plug into the existing
XP/achievement/leaderboard plumbing rather than growing a parallel one, and must not
open an XP-farming hole (the file already carries anti-farm guards, e.g.
`startPoolGame` at line 4272 and the sync XP-budget gate at line 916).

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

## Architecture: follow the 8-Ball Pool template

Pool is the closest existing analogue — turn-based, PvP/PvCPU toggle, turn clock,
canvas-drawn HUD, 2× "Max" modal, W/L record persisted. Ludo mirrors its shape:

| Concern | Pool reference | Ludo equivalent |
|---|---|---|
| Fixed-timestep loop + FPS cap | [`poolLoop`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L4287) (uses `FIXED_DT`, `getFrameInterval()`) | `ludoLoop` |
| Init / reset / start | [`initPoolGame`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L4223) · [`resetPoolGame`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L4234) · [`startPoolGame`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L4270) | `initLudoGame` / `resetLudoGame` / `startLudoGame` |
| Scale-aware canvas hit-testing | [`handlePoolMouseDown`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L4079) (`rect.width / POOL_W`) | `handleLudoPointerDown` |
| CPU scorer | [`poolAITakeShot`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L2938) (weighted candidate scoring) | `ludoAIChooseMove` |
| Turn clock | `POOL_SHOT_CLOCK` (line 1449) | `LUDO_TURN_CLOCK = 20` |
| End-of-match XP | [`endPoolGame`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L4357) | `endLudoGame` |
| Mode toggle | [`togglePoolMode`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L4396) | `cycleLudoMode` |
| 2× Max modal | [`togglePoolMaximize`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L4408) | shared helper — see below |

**Placement:** add one contiguous `// ═══ LUDO GAME ═══` section (state + constants +
all functions) immediately **before** `// GAME SWITCHING SYSTEM` at line 6382. All
game state is IIFE-scoped `let`, and nothing runs until `initLudoGame()` is called
post-IIFE, so declaration order is safe. One block keeps the diff reviewable.

### Reuse: extract the Max-modal helper

`togglePoolMaximize` (~120 lines, 4408–4530) is already fully generic apart from
hardcoded names and buffer constants. Extract it to
`toggleGameMaxModal({ canvasId, title, bufferW, bufferH, stateRef })` placed near
line 4400, migrate Pool to call it, and have Ludo call it too. Avoids a second
120-line copy. Pool's behaviour must be re-verified (see Verification).

---

## Board model

15×15 grid, **cell = 20px → board 300×300**, centred in a 368×368 canvas
(`LUDO_BOARD_OFFSET = 34`), leaving 34px HUD strips top and bottom — the same
"table + HUD margins" split Pool uses via `POOL_TABLE_OFFSET_Y`. Everything
(player chips, dice, turn clock, messages) is **canvas-drawn**, because the Max
modal relocates only the `<canvas>`.

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

Implemented in full; the first three are toggleable in ⚙️ settings via
`userPreferences.ludoRules`.

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

Pointer input via a single `handleLudoPointerDown` (+ touch variant) that converts
client coords using `rect.width / LUDO_CANVAS_W`, exactly as
`handlePoolMouseDown` does at line 4089.

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

New `case 'ludo'` in [`awardGameXP`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L7321),
called once from `endLudoGame`:

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
anti-cheat budget at line 930. The adaptive tier makes this self-correcting:
throwing matches to drop to `easy` also drops the multiplier to 0.6.

**Anti-farm requirements** (match the reasoning in the comment at line 4272):

- `endLudoGame` is idempotent — guard on `ludoGameOver`
- `startLudoGame` force-resets when `ludoGameOver` is set
- Reset / mode-switch / tab-switch mid-match awards nothing
- PvP hot-seat never increments `ludoGamesWon` or `ludoRecord`

---

## Integration points

One file: `Desktop/Custom Scripts/AttendanceTimeCheckerPlus.js`.

**New code**
- `// ═══ LUDO GAME ═══` block inserted before line 6382 — state, constants, board
  tables, rules engine, AI, renderer, input handlers, `endLudoGame`
- `toggleGameMaxModal(cfg)` helper near line 4400 (Pool migrated onto it)

**Preferences & storage**
- `userPreferences` (line 314): `ludoRules: { blocks: true, threeSixes: true, exactHome: true, freeRelease: false }`
- localStorage helpers beside `loadPoolRecord`/`savePoolRecord` (lines 550–563):
  `load/saveLudoWins` (`ludoGamesWon`), `load/saveLudoRecord` (`ludoRecord`)

**Cloud sync / leaderboard** — add `ludo` everywhere `pool` appears:
- [`collectGameBests`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L762) → `ludo: parseInt(localStorage.getItem('ludoGamesWon') || '0', 10)`
- [`buildPlayerSnapshot`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L774) → `ludoRecord` (beside `poolRecord`, line 795)
- [`applyPlayerRecordToLocal`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L960) → `raise('ludoGamesWon', gb.ludo)` (line 1000) + only-raise merge of `ludoRecord` (mirror lines 1041–1050)
- [`renderLeaderboardPanel`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L1270) → `<th title="Ludo">🎲</th>` + `<td>${fmt(gb.ludo)}</td>`, **`colspan` 11 → 12** (line 1327)
- the two inline `gameBests` literals in `window.lbRegister` (line 14187) and `window.lbSync` (line 14217)
- No server change needed — `github-actions-bot/.github/workflows/sync.yml` and
  `cloudflare-worker/worker.js` don't enumerate `gameBests` keys

**XP & achievements**
- [`ACHIEVEMENTS`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L262) → `ludoChamp` 🎲, `ludoFlawless` 🛡️, `ludoHunter` 🔥 in the "Gaming" group (grid count auto-updates 27 → 30 via `Object.keys(ACHIEVEMENTS).length`, line 7261)
- [`ACHIEVEMENT_XP`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L7114) → `ludoChamp: 150, ludoFlawless: 120, ludoHunter: 80`
- [`checkGameAchievements`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L7068) → `case 'ludo'` checking all three from the `performance` object
- [`revalidateAchievements`](../../Desktop/Custom%20Scripts/AttendanceTimeCheckerPlus.js#L7007) → `ludoChamp` when `ludoGamesWon >= 100`; extend the comment at line 7048 noting Flawless/Hunter are session-only

**Game-switcher plumbing** — add a `'ludo'` case/entry in each:
`cleanupCurrentGame` (6402) · `initCurrentGame` (6482) · `updateGameSwitcher` ids
array (6543) · `updateGameControls` `ctrlIds`/`statIds` + case (6551) ·
`updateGameTitle` (14236)

**HTML in `renderFullContent`**
- switcher button after Pool (line 13768): `<button id="game-switch-ludo" … onclick="window.switchGame('ludo')" title="Ludo">🎲</button>`
- `ludo-scoreboard` div after `pool-scoreboard` (13804) — coloured dots + tokens-home per active player + turn label
- `<canvas id="ludo-canvas" width="368" height="368" style="display:none; cursor:pointer;">` after line 13819
- `ludo-controls` div after `pool-controls` (13889): `🔄 PvCPU` (cycles PvCPU → PvP 2P → PvP 3P → PvP 4P) · `▶ Play` · `🔄 Reset` · `⛶ Max`

**Window bridges** (beside lines 14157–14160): `startLudoGameBtn`,
`resetLudoGameBtn`, `cycleLudoModeBtn`, `toggleLudoMaximizeBtn`

**Keyboard** (line 14082): `case '9': window.switchGame('ludo')`; add
`case 'ludo': resetLudoGame()` to the Escape switch at 14102

**CSS** in the `modernStyles` template (line 7593)
- `/* ==================== LUDO STYLES ==================== */` after the
  `#pool-canvas` rule (line 11675): `#ludo-canvas` (radius, glow, `aspect-ratio: 1/1`,
  `width: 100%`) and `.ludo-rule-toggles`
- light-mode override near line 11908 if the board needs it
- `.pool-modal-*` classes (line 8885) become the shared modal's classes — either
  rename to `.game-max-modal-*` and update both, or keep the pool names and reuse

**Settings modal** — after the Pool colour swatches block (line 12566), a
`🎲 Ludo Rules` group of four `.toggle-switch` elements. The generic handler at
12573 writes `userPreferences[pref]` flat, so either add a `data-pref-group="ludoRules"`
branch there or store the flags flat (`ludoBlocks`, `ludoThreeSixes`,
`ludoExactHome`, `ludoFreeRelease`) — **flat is simpler and matches every existing
pref**; prefer it.

---

## Progress tracking

Build order is top to bottom — geometry first, because everything else reads off the
board tables.

### Phase 0 — Setup
- [ ] Copy this plan to `Desktop/Custom Scripts/LUDO_IMPLEMENTATION_PLAN.md`
- [ ] Back up `AttendanceTimeCheckerPlus.js` (13,671-line single file, no git)
- [ ] Scratchpad harness `ludo-harness.html` with a 368×368 canvas + stubs for
      `awardGameXP` / `showXPNotification` / `getFrameInterval` / `FIXED_DT`

### Phase 1 — Board & renderer
- [ ] `LUDO_RING` (52 cells, clockwise), `LUDO_COLORS`, `LUDO_SAFE_RING`
- [ ] Static board render: 4 quadrants, cross track, centre triangle, ★ squares
- [ ] HUD strips (player chips, turn label, message banner)
- [ ] Tokens rendered in base slots
- [ ] Geometry check: quadrants/track/triangle align to grid lines

### Phase 2 — Dice & turn clock
- [ ] `ludoRollDice()` — `1 + Math.floor(Math.random() * 6)`
- [ ] 600ms tumble animation, dice pulse when awaiting a tap
- [ ] `LUDO_TURN_CLOCK = 20` countdown + expiry auto-roll / auto-play
- [ ] Dice hit-testing via `rect.width / LUDO_CANVAS_W`

### Phase 3 — Movement
- [ ] `step` 0…56 model + step→cell resolution (ring → own home column → home)
- [ ] Legal-move generation
- [ ] ▼ marker + ghost destination preview on legal tokens
- [ ] Square-by-square hop animation (~90ms/square)
- [ ] Capture → opponent token to base
- [ ] Auto-play on single legal move; auto-pass on zero

### Phase 4 — Full rule set
- [ ] Six-to-release (+ `freeRelease` override)
- [ ] Extra turn on 6 / capture / token-home
- [ ] `threeSixes` — third consecutive 6 forfeits and voids the roll
- [ ] `blocks` — 2+ own tokens bar landing *and* passing
- [ ] `exactHome` — `step + roll <= 56`
- [ ] Safe squares (`LUDO_SAFE_RING` + all home columns)

### Phase 5 — Match resolution
- [ ] Win detection (all 4 tokens home)
- [ ] 3P/4P placement ranking by (tokens home, total steps)
- [ ] `endLudoGame` — idempotent, guarded on `ludoGameOver`
- [ ] `startLudoGame` force-resets when `ludoGameOver`

### Phase 6 — CPU
- [ ] `ludoAIChooseMove` weighted scorer
- [ ] Adaptive tier from `ludoRecord` win-rate (+ `games < 5` sample guard)
- [ ] Tier locked at match start into `ludoCpuTier`, shown in HUD
- [ ] easy / normal / hard degradations

### Phase 7 — Modes
- [ ] `cycleLudoMode` — PvCPU-2P → PvP-2P → PvP-3P → PvP-4P
- [ ] Active-colour sets per mode; inactive quadrants dimmed
- [ ] Turn order = clockwise, skipping inactive colours

### Phase 8 — Panel wiring
- [ ] `cleanupCurrentGame` (6402) — cancel `ludoAnimFrame`, detach listeners
- [ ] `initCurrentGame` (6482)
- [ ] `updateGameSwitcher` ids array (6543)
- [ ] `updateGameControls` `ctrlIds` / `statIds` + case (6551)
- [ ] `updateGameTitle` (14236)
- [ ] HTML: 🎲 switcher button (13768), `ludo-scoreboard` (13804), `ludo-canvas` (13819), `ludo-controls` (13889)
- [ ] Window bridges (14157): `startLudoGameBtn`, `resetLudoGameBtn`, `cycleLudoModeBtn`, `toggleLudoMaximizeBtn`
- [ ] Keyboard: `case '9'` (14082) + Escape reset (14102)
- [ ] CSS: `#ludo-canvas` + `.ludo-rule-toggles` after line 11675; light-mode override near 11908

### Phase 9 — Progression & cloud
- [ ] `userPreferences` flat rule flags (`ludoBlocks`, `ludoThreeSixes`, `ludoExactHome`, `ludoFreeRelease`) at line 314
- [ ] localStorage helpers beside `savePoolRecord` (550–563)
- [ ] ⚙️ settings `🎲 Ludo Rules` toggle group after line 12566
- [ ] `awardGameXP` → `case 'ludo'` (7468)
- [ ] `ACHIEVEMENTS` + `ACHIEVEMENT_XP` → `ludoChamp` / `ludoFlawless` / `ludoHunter`
- [ ] `checkGameAchievements` → `case 'ludo'` (7104)
- [ ] `revalidateAchievements` → `ludoChamp` at 100 wins (7047) + comment update (7048)
- [ ] `collectGameBests` (762) → `ludo`
- [ ] `buildPlayerSnapshot` (795) → `ludoRecord`
- [ ] `applyPlayerRecordToLocal` (1000, 1041–1050) → raise `ludoGamesWon`, merge `ludoRecord`
- [ ] `renderLeaderboardPanel` → 🎲 `<th>`/`<td>`, colspan 11 → 12 (1327)
- [ ] Inline `gameBests` literals in `lbRegister` (14187) and `lbSync` (14217)

### Phase 10 — Shared Max modal
- [ ] Extract `toggleGameMaxModal(cfg)` near line 4400
- [ ] Migrate `togglePoolMaximize` onto it
- [ ] Wire Ludo's ⛶ Max
- [ ] Pool regression pass

### Phase 11 — Verification
- [ ] Harness checks (see Verification)
- [ ] In-app checks (see Verification)

## Verification

The script self-guards to one URL (lines 43–48), so iterating in-place is slow.

**Fast loop (steps 1–7):** write a throwaway `ludo-harness.html` in the scratchpad
(`C:\Users\HASSAN~1\AppData\Local\Temp\claude\C--Users-HASSANNASIR2\d8be33af-5678-4c7b-8338-09678101e991\scratchpad`)
containing just a 368×368 canvas plus the Ludo block, with stubs for `awardGameXP` /
`showXPNotification` / `getFrameInterval` / `FIXED_DT`. Verify there:

- All 4 quadrants, the cross track, and the centre triangle land on grid lines
- A token walked step 0 → 56 traces the full ring and turns into its **own** colour column
- Safe squares render ★ at ring indices 0, 8, 13, 21, 26, 34, 39, 47
- Dice over ~600 rolls is flat across 1–6 (no bias)
- Each rule toggle observably changes legality (block passage, third six, overshoot)
- CPU-vs-CPU auto-play at all three tiers completes without stalling or illegal moves

**In-app (steps 8–10)** — on `https://globalportal.mtbc.com/#/time-absence/attendence-record`
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

---

## Decision log

Record anything that diverges from the plan above, so a later session reading this file
doesn't re-derive it from the code.

| Date | Decision / deviation | Why |
|---|---|---|
| 2026-08-04 | PvCPU is 2P only; PvP offers 2P/3P/4P | User's call — keeps the CPU scorer to one opponent |
| 2026-08-04 | Full rule set, three rules exposed as ⚙️ toggles | User's call |
| 2026-08-04 | Adaptive CPU difficulty (win-rate driven), not a manual selector | User's call |
| 2026-08-04 | Rule flags stored **flat**, not nested under `ludoRules` | The settings handler at line 12573 writes `userPreferences[pref]` flat; every existing pref follows that |
| 2026-08-04 | 🎲 leaderboard column = CPU wins, PvP excluded | Mirrors `poolGamesWon`; hot-seat wins would be trivially farmable |
| 2026-08-04 | Board 300×300 (cell 20) inside a 368×368 canvas, all HUD canvas-drawn | The ⛶ Max modal relocates only the `<canvas>`, so DOM-based HUD would vanish in the modal |
| 2026-08-04 | Extract the Max modal into a shared helper and migrate Pool | Avoids a second 120-line copy of `togglePoolMaximize` |
| 2026-08-04 | Rules sourced from standard Ludo Star/King rules + the reference screenshot | The linked Scribd doc requires auth and could not be read — **verify the rule set against it and log any differences here** |
