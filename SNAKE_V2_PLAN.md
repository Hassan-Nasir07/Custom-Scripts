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
| 12 | Leaderboard main table trim + per-game boards | ☑ |
| 13 | `snake-dev/snake-verify.js`; fix `integration-verify.js` + `host-smoke.js` | ☑ |
| 14 | `BUILD_LABEL` v2 → v3, then v3 → **v4** for the scoring round-trip pass | ☑ |
| 15 | UI pass — continuous snake body, header, score button | ☑ |
| 16 | Per-game scoreboards on all eight panels; panel stops stretching | ☑ |
| 17 | Playability — stage label off the board, every arrow opens a run | ☑ |
| 18 | `snake-dev/preview.js` — render the real canvas to a PNG | ☑ |
| — | **Portal verification** (see below) | ☐ |
| — | **`BUILD_TOKEN_*` repo-secret rotation** — manual, outside this repo | ☐ |

`node ludo-dev/verify-all.js` → **1002 assertions passed, 0 failed** across 10 suites
(354 of them the new Snake suite).

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
- **Only two of the four arrow keys could start a run.** Reported from play. Starting the
  run was routed *through* `snakeQueueDir`, which correctly rejects the forward key as a
  no-op — you already face that way — so the queue stayed empty, `snakeMoving` never
  flipped, and only the two turns could begin a run. On a stage walled directly above and
  below, both of those were fatal, so there was no opening key that didn't kill you.
  Starting and turning are now separate: any arrow starts the run, `snakeQueueDir` still
  drops the no-op, and a straight reversal starts nothing because it isn't a legal move.
- **The spawn could face a wall.** The latent half of the same trap: `snakeSpawnBody` only
  looked *behind* the head to lay out the tail, so it could place the snake nose-to-brick.
  It now also measures clear cells **ahead** and weights runway above tail length — a short
  snake facing open space is playable, a full-length one facing a wall is not. All twelve
  stages are asserted to spawn with at least `SNAKE_MIN_RUNWAY` clear cells forward.
- **The stage label was drawn over the gameplay.** The Levels readout was painted top-left
  *inside* the playfield — which is where the snake spawns and travels, so it sat on top of
  the thing it was describing. Any on-canvas position has that problem, since the snake can
  reach every cell. It moved to the mode chip in the header, which had room because the
  mode name is already on the button below it.

---

## Scoring round-trip pass (fourth) — reported from play

Two games were losing scores. Both were reported as "the leaderboard is wrong"; both
turned out to be somewhere other than the leaderboard.

- **RefleX Target mode could not record a score at all, and had not been able to for
  months.** `Infinity` was the never-scored sentinel and `JSON.stringify(Infinity)` is the
  string `"null"`. So the first time the blob was persisted — which happens the first time
  *Screen* sets a record — Target was written as `{ best: null, avg: null }`. Every run
  after that asked `time < null`, which coerces to `time < 0` and is false for every real
  reaction time. The gist proves it: `target` has been `{"avg":null,"best":null}` in every
  revision going back to 2026-08-12 despite the mode being played. `loadReflexHighScores()`
  now normalises on the way in, which repairs every blob already in the wild — including
  the ones restored from the gist — with no migration. `saveReflexHighScores()` writes an
  explicit `null` so the shape means the same thing to every reader.
- **Switching RefleX mode left the header and the board on the previous mode.**
  `toggleReflexMode()` called only `updateReflexDisplay()`, which repaints the play area.
  The mode chip, the best/current button and the shared leaderboard overlay all hang off
  `updateReflexScoreDisplay()`. The visible result was a panel whose title read
  *Target Mode* over a chip reading *Screen Mode* over Screen's scores.
- **A genuine Target best in the gist ranked nowhere.** `buildPlayerSnapshot` has always
  synced the whole `reflexHighScores` blob, and it is keyed by mode — but `lbBoardValue`
  only ever read `gameModeBests`, so a pre-v2 record holding `target.best = 640` (there is
  one live) was invisible. RefleX now merges both sources, taking the smaller, since it
  ranks ascending. This is safe where the snake scalar is not: the blob is already
  per-mode, so there is nothing to guess and no mode can leak into another's heading.
- **`gameModeBests` was write-only for RefleX.** `collectGameModeBests()` emitted
  `reflex:target`, and nothing ever read it back — so a Target record could reach the gist
  and still not survive a restore onto a fresh browser. The restore now merges all three
  sources (legacy scalar, `gameModeBests`, blob) in one only-lower pass.
- **Snake had the Pool bug and nobody had noticed.** `collectGameModeBests()` read
  `snakeHighScores` directly, and that key is only written once the Snake panel has been
  opened on this build. A player who upgraded and synced after a game of Pool emitted a
  `gameModeBests` with no snake key at all — and a present `gameModeBests` is
  authoritative, so `gameBests.snake` never fired and their real score fell off the Snake
  board. Backfilled from the legacy scalar into Walled, matching `snakeLoadHighScores()`.
- **Dying and leaving the panel threw the whole run away.** The run is committed in
  `snakeFinalizeDeath`, which the render loop calls 1.4 s after the death that earned it.
  `cleanupCurrentGame` cancelled the frame and cleared `snakeDying` without finalising, so
  die-then-switch-panel lost the mode high score *and* the XP. A backgrounded tab widens
  the window indefinitely, since rAF stops and the animation never reaches its own end.
  Cleanup now commits first, then tears down.
- **Nothing pushed a new record to the gist.** Every game wrote its best to localStorage
  and stopped; the score only left the machine if the player happened to press 🔄
  afterwards. So a mode could sit at a genuine local high — 39 in Endless, in the report
  that started this — and simply be absent from the board everyone else reads.
  `queueScoreSync()` now fires on any `isHighScore`, debounced 8 s and re-armed rather
  than dropped when the anti-cheat cooldown would bite (a silent return there is exactly
  how a record goes missing). Worst case is one dispatch per `AC_SYNC_COOLDOWN_MS`
  (2 min) and only while records keep falling — worth watching if Actions minutes get
  tight.
- **A RefleX run with no recorded reaction could set a 0 ms record.** Both figures fall
  back to 0 and the board ranks ascending, so it would have sat at the top unbeatable.
  Guarded on `reflexReactionTimes.length`.

### Cutting v4

`BUILD_LABEL` is now `v4`. **`BUILD_SEED` is deliberately unchanged** — `BUILD_TOKEN`
derives from the seed, not the label, so bumping the label alone cannot break a sync,
while rotating the seed without also rotating `BUILD_TOKEN_CURRENT` in the bot repo would
make every dispatch fail silently. The label is what the update banner reads, and that is
all this bump is for.

⚠️ **The banner will not fire until `sync.yml` starts stamping `latestBuild` again.** The
gist has read `latestBuild: "v2"` since before v3 shipped, even though v3 clients have
been syncing successfully for days — so the workflow is evidently not writing the field
from `client_payload.build_label`. Until that is fixed, a v4 bump advertises nothing:
clients on older builds keep syncing happily and never see the refresh prompt. Worth
checking next time the bot repo is open, since it is the whole mechanism for retiring an
old client.

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

Main table drops to **rank · player · Lv. · XP + 🏆 badge** — four columns, `colspan` 12 → 4,
and nothing else. Game scores left the panel entirely: each game panel carries its own
scoreboard button that opens the shared `#game-lb-overlay` on top of its board.
`lbBoardRowsHtml(game, mode)` builds the ranked rows for every one of them.

*(This landed in three passes: eight emoji columns → a selector section under the panel →
per-game buttons. The middle step was the one that stretched the widget.)*

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
  row wrapped onto three lines. The title shortened to `🐍 Snake`, and **Best/Score folded
  into a button** that opens this mode's leaderboard — the number you just scored and the
  number to beat belong next to the list of numbers to beat. The button highlights when
  the live run is at or past the record. The stage readout went to the canvas here and
  then to the mode chip a pass later, once it turned out to cover the gameplay.
- **A single segment isn't a snake.** The run started one cell long, which rendered as a
  dot with a face on it — you couldn't tell what it was or which way it pointed until
  you'd eaten twice. Runs now start four segments long, facing whichever direction has
  the most clear space ahead, with `snakeDir` seeded so the 180°-into-yourself guard works
  on the first keypress. A separate `snakeMoving` flag holds the snake still until the
  player steers, since the direction vector can no longer double as that sentinel.

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

## Playability pass (third)

Both reported from actually playing it, and both are cases where a rule that reads fine in
isolation combines badly with an authored wall layout.

- **The stage label moved off the board** and into the mode chip, which now reads
  `🎯 Stage 4/12`. The stage *name* and food progress live in the chip's tooltip; the name
  still gets its moment in the stage-change banner, and goal progress is the bar along the
  bottom of the board.
- **Every arrow key starts a run now**, not just the two turns — see the bug log above. The
  spawn also guarantees clear cells ahead, so "forward" is never the fatal choice.

## Working on the engine

Snake now follows the same contract as Ludo: the userscript carries a verbatim copy of
the module pair, and the verify suite asserts they are byte-identical. **Edit
`snake-dev/`, never the copy in `AttendanceTimeCheckerPlus.js`.**

```
node snake-dev/reinsert.js              # mechanical splice, refuses to guess
node snake-dev/snake-verify.js          # 328 assertions, all 12 stages flood-filled
node ludo-dev/verify-all.js             # all 10 suites
node snake-dev/preview.js out.png long  # render the real canvas to a PNG
```

`reinsert.js` matches on sentinel comments rather than reconstructing the previous block
from a git revision (which is what `ludo-dev/reinsert.js` does). Same guarantee, but it
still works when the copy in the file came from an uncommitted edit.

`preview.js` exists because the headless suite draws against a stub context: it proves
nothing throws and nothing about whether the snake *looks* like a snake. It runs the real
`drawSnakeGame` through the software rasterizer in `ludo-dev/preview.js` (shared, not
copied) and writes a PNG. It caught the body beading, the bulge/taper staircasing, and a
gradient bug that was in the tool rather than the game.

⚠️ **Check your edits land.** One `handleSnakeKeyPress` edit didn't survive into the file
during this work and was only noticed because the new tests failed. `git diff snake-dev/`
after a change is cheap insurance.

## Portal verification — still to do

The script only runs on `https://globalportal.mtbc.com/#/time-absence/attendence-record`,
so these need Tampermonkey on that page:

- [ ] **Modes** — cycle all three; Endless wraps at all four edges, Walled kills exactly at
      the brick frame with no overshoot, mode survives a reload.
- [ ] **Levels** — clear stages 1–3: score carries the banner, snake respawns safe, the
      mode chip tracks `Stage n/12`. Confirm a death drops you back to stage 1, and that
      nothing is drawn over the playfield.
- [ ] **Opening keys** — on a stage with walls above and below the spawn, confirm the
      forward arrow starts the run. Confirm the reverse arrow does nothing.
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
- [ ] **Leaderboard panel** — four columns, no horizontal scroll at panel width, and the
      panel is no taller than the game panels beside it.
- [ ] **Per-game boards** — open the 🏆 button on all eight games. RefleX sorts ascending,
      the rest descending; Snake Levels shows `pts · Stage n`; Pool and Ludo show wins;
      a player who hasn't synced this build still appears via the backfill. Switch Snake's
      mode with the overlay open and confirm the board follows.
- [ ] **Round-trip** — 🔄 sync, reload, confirm `gameModeBests` came back from the gist and
      per-mode scores restored only upward.
- [ ] **RefleX Target records at all** — play a Target run, then check
      `JSON.parse(localStorage.reflexHighScores).target` is a number rather than `null`.
      This is the one that was broken; everything else in this pass follows from it.
- [ ] **RefleX mode switch** — hit 🔄 Switch Mode with the board open and confirm the
      title, the chip and the ranked list all move together.
- [ ] **Auto-sync** — set any personal best and, without touching 🔄, confirm a run
      appears in the bot repo's Actions tab within ~30 s and the figure lands in the gist.
- [ ] **Die and leave** — die in Endless, switch panels inside the death animation, come
      back and confirm the score stuck and the XP was paid.

---

## Deferred

**Credential leak — tracked separately, not addressed here.** A GitHub PAT is embedded in
`AttendanceTimeCheckerPlus.js` as a `String.fromCharCode(...)` array and is publicly readable;
both the XP signature and the build token derive from it. `cloudflare-worker/worker.js` already
exists to fix exactly this and is dead code. See the appendix of the approved plan for the
verified findings.
