# Snake v2 — Implementation Tracking

Live checklist for the Snake update: three game modes, twelve designed stages, a timed
golden bite, death/mouth/swallow animation, achievement-gated skins, and the leaderboard
restructure that moves game scores out of the panel and onto each game's own board.

Full rationale lives in the approved plan. This file tracks execution.

---

## Status — code complete, pending portal verification

| # | Step | State |
|---|---|---|
| 1 | `SNAKE_V2_PLAN.md` tracking file | ☑ |
| 2 | Extract engine to `snake-dev/` + `reinsert.js` + byte-identity assertion | ☑ |
| 3 | Bug fixes that block the new features | ☑ |
| 4 | Mode system, per-mode storage, migration, invalidation, ruleset version | ☑ |
| 5 | Levels: stage table, loader, flood-fill validity, advance banner | ☑ |
| 6 | Golden bite + `snakePendingGrowth` refactor | ☑ |
| 7 | Death animation, mouth, swallow | ☑ |
| 8 | Skin registry, canvas painter, tray UI | ☑ |
| 9 | Panel HTML / controls / scoreboard / CSS | ☑ |
| 10 | Achievements 30 → 36 + mode-aware XP | ☑ |
| 11 | `gameModeBests` + pool mode split + all three call sites | ☑ |
| 12 | Leaderboard main table trim + board selector | ☑ |
| 13 | `snake-dev/snake-verify.js`; fix `integration-verify.js` + `host-smoke.js` | ☑ |
| 14 | `BUILD_LABEL` v2 → v3 | ☑ |
| — | **Portal verification** (see below) | ☐ |
| — | **`BUILD_TOKEN_*` repo-secret rotation** — manual, outside this repo | ☐ |

`node ludo-dev/verify-all.js` → **956 assertions passed, 0 failed** across 10 suites
(308 of them the new Snake suite).

### Bugs found during implementation and review, worth recording

Each of these now has a regression assertion; the first two were caught by tests written
before the code, the rest by the post-implementation review.

- **Stage 12 "The Vault" was unwinnable.** The first draft was a closed box, which sealed
  its own interior; food spawning inside the pocket would have made the stage silently
  impossible. The flood-fill assertion caught it before it ever ran. The four gaps at
  x/y 9–10 are load-bearing — don't close them.
- **The leaderboard backfill leaked scores between modes.** Falling back to the legacy
  scalar per-mode meant a v2 player who had only played Levels would show that score under
  Walled, since the legacy key is the max *across* modes. A record carrying
  `gameModeBests` is now authoritative for every mode of that game.
- **Filling the board mid-tick emptied the snake.** `spawnFood()` triggering
  `snakeBoardCleared()` left the rest of the tick running, so the pop removed the freshly
  respawned single segment. The failure was deferred and therefore nasty:
  `snakeAdvanceStage` also zeroes the direction, so the next tick returned early and the
  stage just rendered with no snake on it — the `TypeError` only arrived on the player's
  next keypress. `spawnFood()` now returns `false` and the tick bails.
- **Pool players vanished from their own board.** `collectGameModeBests()` read
  `poolWinsByMode` directly, but that key is only written once the Pool panel has been
  opened. Anyone who upgraded and synced without touching Pool emitted a `gameModeBests`
  with no `pool:cpu` — and since a present `gameModeBests` is authoritative, the
  `gameBests.pool` fallback never fired. Now goes through `loadPoolWinsByMode()`, which
  seeds from the legacy total.
- **The default leaderboard view was empty on day one.** The mode default took the first
  key of `LB_BOARDS.snake.modes` (Endless), which is precisely the mode no unsynced record
  can fill. Superseded by the second UI pass: `gameLbMode()` now reads the mode being
  played, so there is no stored default left to get wrong.
- **`snakeCampaign` was granted for reaching stage 6, not clearing it.** The live check
  used the stage died on while the backfill reads `snakeLevelsBest`, which is only written
  on a clear — so a death on the first move of stage 6 paid 110 XP the revalidator could
  never rebuild. Both now agree on stages *cleared*.
- **The empty-state `colspan` was one column wide**, and the test asserted the same
  off-by-one. Both now derive the width from the header rather than naming a number.
- **A scoreboard rewrite referenced a variable that doesn't exist.** RefleX's new button
  read `reflexTimes`; the real array is `reflexReactionTimes`. In strict mode that throws
  the moment the panel opens, and no structural grep would have seen it. The suite now
  asserts every piece of game state the scoreboard code reaches into is actually declared.

---

## Step 3 — v1 bugs fixed

Each one misbehaves *because of* what was being added, so none were optional. All have
regression assertions in `snake-dev/snake-verify.js`.

- [x] **`spawnFood()` non-terminating `do…while`** — hung the tab once the snake filled the
      grid, and there was no win state. Levels shrinks the playable area, which turned this
      from theoretical into reachable. Replaced with a free-cell list; empty list = run won.
- [x] **±1 off-grid grace buffer** — grid is 0–19 but `-1` and `20` survived, so the snake
      passed visibly *through* the new wall and died a frame later. Now
      `< 0 || >= snakeGridSize`.
- [x] **Self-collision counted the vacating tail** — `some()` ran before `pop()`, so tight
      turns on non-growth ticks were false deaths. Common in Level corridors.
- [x] **`isHighScore` evaluated after the raise** — was true on every tie and on the first
      game. Free +15 XP forever. Captured before the update.
- [x] **Uncancellable 3s auto-restart** — left an rAF loop on a hidden canvas when switching
      panels mid-death. Now `snakeRestartTimer`, cleared in reset and in `cleanupCurrentGame`.
      (Not an XP vector: `resetSnakeGame` zeroes the direction and the tick returns early
      forever, so the snake idles rather than dying repeatedly.)
- [x] **No input queue** — a fast ↑→← inside one tick dropped the second press. Now a 2-deep
      queue, each entry validated against the one before it.
- [x] **Nothing paused on blur** — rAF stalls in a hidden tab but not in Picture-in-Picture.
- [x] Dead `snakeCellSize` removed; unprefixed globals (`gameOver`, `snake`, `food`,
      `direction`, `nextDirection`) renamed.

---

## Modes

| id | label | edges |
|---|---|---|
| `endless` | ♾️ Endless | all four wrap |
| `walled` | 🧱 Walled | all four solid, brick frame drawn inside the canvas edge |
| `levels` | 🎯 Levels | per-stage mix + interior walls |

The wall frame renders in canvas margin, **not** in grid cells, so the playfield stays 20×20
and every score recorded before this update stays comparable.

---

## Skins

Gradient primary/secondary with a three-colour preset and a pattern.

| id | name | pattern | unlocked by |
|---|---|---|---|
| `emerald` | Emerald Green | — | default |
| `ruby` | Ruby Red | polka dots | `snakeEndless` |
| `sapphire` | Sapphire Blue | tiger stripes | `snakeWalled` |
| `gold` | Gold | polka dots | `snakeGourmand` |
| `prism` | Prism | tiger stripes | `snakeConqueror` |

Prism is the legendary: a hue wave flowing head-to-tail, the canvas equivalent of the widget's
existing `gradientFlow` / `rgbFlowBacklight` keyframes.

**Unlocks are a client-side honour system and deliberately unenforced.** Anyone willing to edit
localStorage can wear Prism; the blast radius is a colour gradient. This is not a security
boundary and should not be mistaken for one.

---

## Achievements added (30 → 36)

| key | icon | name | condition | XP |
|---|---|---|---|---|
| `snakeEndless` | ♾️ | Round Trip | 40+ in Endless | 80 |
| `snakeWalled` | 🧱 | Wallflower | 40+ in Walled | 90 |
| `snakeGourmand` | 🍯 | Gourmand | 10 golden bites in one run | 100 |
| `snakeCampaign` | 🗺️ | Pathfinder | clear stage 6 | 110 |
| `snakeConqueror` | 👑 | Grand Serpent | clear all 12 stages in one run | 200 |
| `snakeLong` | 📏 | Long Boy | reach 60 segments | 90 |

`snakeGourmand` and `snakeLong` are per-run facts with no localStorage trace, so they stay
live-only — same as `tetrisMaster` and `ludoFlawless`.

---

## Leaderboard

Main table drops to **rank · player · Lv. · XP + 🏆 badge** — four columns, `colspan` 12 → 4.
Game scores move behind an icon-tab row (one per game) with mode pills, rendering one ranked
list at a time. `lbBoardRowsHtml(game, mode)` builds those rows and is shared with the
in-game overlay the Snake panel opens.

New synced field `gameModeBests`, keyed `"<game>:<mode>"`. `collectGameBests()` is
**unchanged** — `gameBests.snake` stays a scalar so older clients keep sending a scalar into a
still-scalar field. `sync.yml` does not whitelist fields, so this needs no workflow change (and
gets no server validation).

Ludo stays single-mode: hot-seat wins aren't recorded anywhere, and its block is asserted
byte-identical to `ludo-dev/`.

---

## UI pass (post-review)

Driven by screenshots of the running panel.

- **The snake didn't read as a snake.** v1 drew one rounded square per cell, which
  left gaps on every turn and made a one-segment snake look like a stray glyph. The
  body is now stroked as a continuous rounded tube — a link plus a joint circle per
  segment, drawn tail-first so each headward segment overlaps the last. Corners round
  themselves, the tail ramps down over its last three segments, and a swallowed bite
  now visibly swells the body instead of nudging a square's inset. The head is wider
  than the body, with eyes that ride each jaw and a forked tongue that flicks and
  retracts as the mouth opens.
- **The header overflowed.** Four chips (title, mode, stage, best, score) in a ~340px
  row wrapped onto three lines. The title shortened to `🐍 Snake`, the stage readout
  moved onto the canvas as a HUD chip, and **Best/Score folded into a button** that
  opens this mode's leaderboard — the number you just scored and the number to beat
  belong next to the list of numbers to beat. The button highlights when the live run
  is at or past the record.
- **A single segment isn't a snake.** The run started one cell long, which rendered as a
  dot with a face on it — you couldn't tell what it was or which way it pointed until
  you'd eaten twice. Runs now start four segments long, laid out behind whichever facing
  has the most room, with `snakeDir` seeded so the 180°-into-yourself guard works on the
  first keypress. A separate `snakeMoving` flag holds the snake still until the player
  steers, since the direction vector can no longer double as that sentinel.

## Per-game scoreboards (second UI pass)

- **The leaderboard stopped stretching the widget.** The per-game boards were a section
  appended under the Leaderboard panel, which made the whole widget taller than the games
  beside it. That section is gone; the panel is the roster table and its footer, nothing
  more.
- **Every game got Snake's scoreboard button.** Flappy, Tetris, Breakout, Aim, RefleX,
  Pool and Ludo now carry the same `current / best 🏆` button, opening one shared
  `#game-lb-overlay` on top of their own board. Career-win games (Pool, Ludo) show wins
  alone; secondary figures — lines, level, lives, turn — became quiet `.gsb-aside` chips
  beside the button instead of full-width `Best: … Score: …` label pairs.
- **The overlay follows the mode being played.** `gameLbMode()` reads `snakeMode`,
  `reflexMode` and `poolMode` live rather than a stored preference that could drift from
  what's on screen.
- **One row builder, all views.** `lbBoardRowsHtml(game, mode)` backs every board, so no
  two can disagree about ranking, units or who is in first.
- RefleX's header used to show *both* modes' bests at once — two numbers the player can't
  act on and one they can. It now shows only the mode being played.

## Working on the engine

Snake now follows the same contract as Ludo: the userscript carries a verbatim copy of
the module pair, and the verify suite asserts they are byte-identical. **Edit
`snake-dev/`, never the copy in `AttendanceTimeCheckerPlus.js`.**

```
node snake-dev/reinsert.js         # mechanical splice, refuses to guess
node snake-dev/snake-verify.js     # 198 assertions incl. all 12 stages flood-filled
node ludo-dev/verify-all.js        # all 10 suites
```

`reinsert.js` matches on sentinel comments rather than reconstructing the previous block
from a git revision (which is what `ludo-dev/reinsert.js` does). Same guarantee, but it
still works when the copy in the file came from an uncommitted edit.

## Portal verification — still to do

The script only runs on `https://globalportal.mtbc.com/#/time-absence/attendence-record`,
so these need Tampermonkey on that page:

- [ ] **Modes** — cycle all three; Endless wraps at all four edges, Walled kills exactly at
      the brick frame with no overshoot, mode survives a reload.
- [ ] **Levels** — clear stages 1–3: score carries the banner, snake respawns safe, the
      stage chip tracks. Confirm a death drops you back to stage 1.
- [ ] **Golden bite** — +3 score and exactly 3 segments; time the ring at the 300 ms start
      tick (~13.5 s) and again near the 60 ms floor (~2.7 s).
- [ ] **Death animation** — blink then fade, no instant clear. Switch panels *during* the
      animation and confirm nothing keeps running on the hidden canvas. Open PiP, switch
      away, confirm the run pauses.
- [ ] **Skins** — 🎨 tray shows locked skins dimmed with their achievement named; earn one
      and confirm it unlocks, applies and survives a reload. Check Prism's hue actually
      flows head-to-tail.
- [ ] **Achievements** — `View All` shows 36; earn `snakeWalled` and confirm the toast, the
      XP, and the badge in both the XP panel and the leaderboard popover.
- [ ] **Leaderboard** — main table is 5 columns with no horizontal scroll at panel width.
      Switch across every board: RefleX sorts ascending, the rest descending, Snake Levels
      shows `pts · Stage n`, and a player who hasn't synced this build still appears.
- [ ] **Round-trip** — 🔄 sync, reload, confirm `gameModeBests` came back from the gist and
      per-mode scores restored only upward.

---

## Deferred

**Credential leak — tracked separately, not addressed here.** A GitHub PAT is embedded in
`AttendanceTimeCheckerPlus.js` as a `String.fromCharCode(...)` array and is publicly readable;
both the XP signature and the build token derive from it. `cloudflare-worker/worker.js` already
exists to fix exactly this and is dead code. See the appendix of the approved plan for the
verified findings.
