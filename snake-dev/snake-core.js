    // ═══════════════════════════════════════════════════════════════════
    // SNAKE GAME — CORE
    // ═══════════════════════════════════════════════════════════════════
    // 20×20 grid on a 368×368 canvas. Three modes share one engine and differ
    // only in their edge rule and obstacle set, so nothing below branches on
    // the mode name except snakeApplyRules().
    //
    // The render loop (snake-ui.js) is unchanged in shape from v1: a fixed
    // logic tick with an accumulator, interpolated between ticks from
    // snakePrevSnap, capped at userPreferences.gameFps. That foundation was
    // already right; what v1 got wrong was the collision code, which could
    // not carry a visible wall (see snakeStepCell).

    // ── State ──────────────────────────────────────────────────────────
    let snakeCanvas, snakeCtx;
    let snakeBody      = [{ x: 10, y: 10 }];
    let snakeFood      = { x: 15, y: 15 };
    let snakeBigFood   = null;      // { x, y, bornMs, ttlMs } — the timed golden bite
    let snakeDir       = { x: 0, y: 0 };
    let snakeDirQueue  = [];        // up to 2 buffered turns, see snakeQueueDir
    let snakeScore     = 0;
    let snakeHighScore = 0;         // best across all modes (the legacy key)
    let snakeAnimFrame = null;
    let snakeLastTickMs   = 0;
    let snakeLastRenderMs = 0;
    let snakeAccumulatorMs = 0;
    let snakePrevSnap  = [];        // segment positions before the last tick
    let snakeTickInterval = 300;
    let snakeGameRunning = false;
    let snakeGamePaused  = false;
    let snakeMoving      = false;   // set by the first arrow press of a run
    let snakeRestartTimer = null;   // v1 leaked this one; cleanup clears it now

    let snakePendingGrowth = 0;     // segments still owed — a golden bite owes 3
    let snakeBulges    = [];        // [{ pos, size }] swallowed lumps travelling tailward
    let snakeDying     = false;
    let snakeDeathT    = 0;
    let snakeDeathCell = null;      // where it went wrong, for the red flash
    let snakeSkinTime  = 0;         // seconds, drives the legendary hue flow
    let snakeBannerT   = 0;
    let snakeBannerText = '';

    let snakeMode      = 'walled';
    let snakeStageIdx  = 0;
    let snakeStageEaten = 0;        // food eaten toward the current stage goal
    let snakeStagesCleared = 0;     // this run
    let snakeBigEaten  = 0;         // golden bites this run
    let snakeMaxLength = 1;         // longest the body got this run
    let snakeWrap      = { left: false, right: false, top: false, bottom: false };
    let snakeWalls     = new Set(); // "x,y" interior obstacles

    const snakeGridSize = 20;

    // ── Tuning ─────────────────────────────────────────────────────────
    // The golden bite's lifetime is measured in MOVES, not seconds. Wall-clock
    // TTL would make it strictly harder as the snake speeds up; a fixed move
    // count means the window is always the same distance, which is the thing
    // the player is actually judging.
    // Four, not one. A single-segment start renders as a dot with a face on it.
    const SNAKE_START_LEN = 4;
    // Clear cells the spawn tries to leave straight ahead, so the first forward
    // press is never the one that kills you.
    const SNAKE_MIN_RUNWAY = 4;

    const SNAKE_BIG_FOOD_TICKS  = 45;
    const SNAKE_BIG_FOOD_CHANCE = 0.22;
    const SNAKE_BIG_FOOD_VALUE  = 3;   // points AND segments
    const SNAKE_BIG_MIN_GAP     = 3;   // normal foods between golden bites

    const SNAKE_DEATH_MS   = 1400;     // blink 0-900, fade 900-1400
    const SNAKE_BLINK_MS   = 900;
    const SNAKE_RESTART_MS = 1600;     // after the animation finishes
    const SNAKE_BANNER_MS  = 1300;

    // Bumped whenever a scoring rule changes. Stamped into every synced record
    // so a later reader can tell which ruleset a score was set under — without
    // it, a rule change silently makes old and new scores incomparable.
    const SNAKE_RULESET_VERSION = 2;

    let snakeFoodsSinceBig = 0;

    // ── Modes ──────────────────────────────────────────────────────────
    const SNAKE_MODES = ['endless', 'walled', 'levels'];
    const SNAKE_MODE_META = {
        endless: { icon: '♾️', label: 'Endless', desc: 'Edges wrap around' },
        walled:  { icon: '🧱', label: 'Walled',  desc: 'Walls are lethal' },
        levels:  { icon: '🎯', label: 'Levels',  desc: '12 designed stages' }
    };

    // 'all' | 'lr' | 'tb' | 'none' → which edges teleport rather than kill.
    function snakeWrapFlags(spec) {
        return {
            left:   spec === 'all' || spec === 'lr',
            right:  spec === 'all' || spec === 'lr',
            top:    spec === 'all' || spec === 'tb',
            bottom: spec === 'all' || spec === 'tb'
        };
    }

    // ── Stages ─────────────────────────────────────────────────────────
    // Authored as wall RUNS rather than 20×20 ASCII art: twelve literal grids
    // would be 240 lines of characters nobody can diff or edit in place.
    //   ['h', y, x0, x1]  horizontal run, inclusive
    //   ['v', x, y0, y1]  vertical run, inclusive
    // Every stage is flood-filled at load and by snake-verify.js, so an
    // unwinnable layout is caught at author time rather than by a player.
    const SNAKE_STAGES = [
        { name: 'Open Road', goal: 5,  wrap: 'all',  walls: [] },
        { name: 'The Gate',  goal: 6,  wrap: 'lr',   walls: [['v', 10, 0, 7], ['v', 10, 12, 19]] },
        { name: 'Crossroads', goal: 7, wrap: 'lr',   walls: [['h', 10, 1, 7], ['h', 10, 12, 18],
                                                             ['v', 10, 1, 7], ['v', 10, 12, 18]] },
        { name: 'Pillars',   goal: 7,  wrap: 'all',  walls: [['v', 5, 4, 8],  ['v', 14, 4, 8],
                                                             ['v', 5, 11, 15], ['v', 14, 11, 15]] },
        { name: 'Corridor',  goal: 8,  wrap: 'tb',   walls: [['h', 6, 1, 18], ['h', 13, 1, 18]] },
        { name: 'Chambers',  goal: 8,  wrap: 'none', walls: [['v', 9, 0, 7],  ['v', 9, 12, 19],
                                                             ['h', 9, 0, 7],  ['h', 9, 12, 19]] },
        { name: 'Zigzag',    goal: 9,  wrap: 'lr',   walls: [['h', 4, 0, 13], ['h', 9, 6, 19],
                                                             ['h', 14, 0, 13]] },
        { name: 'The Combs', goal: 9,  wrap: 'tb',   walls: [['v', 3, 0, 12], ['v', 8, 7, 19],
                                                             ['v', 13, 0, 12], ['v', 17, 7, 19]] },
        { name: 'Diamond',   goal: 10, wrap: 'all',  walls: [['h', 5, 7, 12], ['h', 14, 7, 12],
                                                             ['v', 6, 7, 12], ['v', 13, 7, 12]] },
        { name: 'The Lattice', goal: 10, wrap: 'lr', walls: [['h', 3, 2, 6],  ['h', 3, 13, 17],
                                                             ['h', 9, 2, 6],  ['h', 9, 13, 17],
                                                             ['h', 15, 2, 6], ['h', 15, 13, 17]] },
        { name: 'Bottleneck', goal: 11, wrap: 'tb',  walls: [['v', 6, 0, 8],  ['v', 6, 11, 19],
                                                             ['v', 13, 0, 8], ['v', 13, 11, 19]] },
        // The four gaps at x/y 9-10 are load-bearing: a closed box seals its own
        // interior, and food spawning inside an unreachable pocket makes the
        // stage silently unwinnable. snake-verify.js flood-fills for exactly this.
        { name: 'The Vault', goal: 12, wrap: 'none', walls: [['h', 4, 4, 8],  ['h', 4, 11, 15],
                                                             ['h', 15, 4, 8], ['h', 15, 11, 15],
                                                             ['v', 4, 5, 8],  ['v', 4, 11, 14],
                                                             ['v', 15, 5, 8], ['v', 15, 11, 14],
                                                             ['h', 9, 8, 11], ['h', 10, 8, 11]] }
    ];

    const snakeKey = (x, y) => x + ',' + y;

    function snakeExpandWalls(runs) {
        const set = new Set();
        (runs || []).forEach(run => {
            const [kind, fixed, from, to] = run;
            const lo = Math.min(from, to), hi = Math.max(from, to);
            for (let i = lo; i <= hi; i++) {
                if (kind === 'h') set.add(snakeKey(i, fixed));
                else              set.add(snakeKey(fixed, i));
            }
        });
        return set;
    }

    // Is every free cell reachable from every other? A stage that fails this is
    // unwinnable the moment food spawns in the sealed-off pocket.
    function snakeFreeRegionConnected(walls, wrap) {
        const total = snakeGridSize * snakeGridSize - walls.size;
        if (total <= 0) return false;
        let start = null;
        for (let y = 0; y < snakeGridSize && !start; y++) {
            for (let x = 0; x < snakeGridSize; x++) {
                if (!walls.has(snakeKey(x, y))) { start = { x, y }; break; }
            }
        }
        const seen = new Set([snakeKey(start.x, start.y)]);
        const queue = [start];
        const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
        while (queue.length) {
            const cur = queue.shift();
            for (const d of dirs) {
                const step = snakeStepCell(cur, d, wrap, walls);
                if (!step.ok) continue;
                const k = snakeKey(step.x, step.y);
                if (seen.has(k)) continue;
                seen.add(k);
                queue.push({ x: step.x, y: step.y });
            }
        }
        return seen.size === total;
    }

    // ── The one place edges and obstacles are resolved ─────────────────
    // v1 checked `head.x < -1 || head.x > snakeGridSize`, which let the snake
    // survive a full cell outside the board. That was invisible when the board
    // had no border; with a drawn wall the snake passes through the bricks and
    // dies a frame later, which just reads as broken. Bounds are exact here.
    function snakeStepCell(from, dir, wrap, walls) {
        let x = from.x + dir.x, y = from.y + dir.y;
        const W = wrap || snakeWrap;
        if (x < 0)                { if (!W.left)   return { ok: false }; x = snakeGridSize - 1; }
        if (x >= snakeGridSize)   { if (!W.right)  return { ok: false }; x = 0; }
        if (y < 0)                { if (!W.top)    return { ok: false }; y = snakeGridSize - 1; }
        if (y >= snakeGridSize)   { if (!W.bottom) return { ok: false }; y = 0; }
        if ((walls || snakeWalls).has(snakeKey(x, y))) return { ok: false };
        return { ok: true, x, y };
    }

    function snakeApplyRules() {
        if (snakeMode === 'levels') {
            const stage = SNAKE_STAGES[snakeStageIdx] || SNAKE_STAGES[0];
            snakeWrap  = snakeWrapFlags(stage.wrap);
            snakeWalls = snakeExpandWalls(stage.walls);
        } else {
            snakeWrap  = snakeWrapFlags(snakeMode === 'endless' ? 'all' : 'none');
            snakeWalls = new Set();
        }
    }

    // Lay the starting body out behind the spawn cell, facing whichever way has
    // the most room. Starting as ONE segment rendered as a single dot with a
    // face on it — you couldn't tell it was a snake, or which way it pointed,
    // until you had already eaten twice.
    //
    // The returned facing also seeds snakeDir, so the 180°-into-yourself guard
    // works on the very first keypress rather than letting the player reverse
    // straight into their own body.
    function snakeSpawnBody() {
        const head = snakeSpawnCell();
        const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
        let best = null;

        for (let i = 0; i < dirs.length; i++) {
            const d = dirs[i];

            // Trailing body, laid out opposite to the facing.
            const body = [head];
            const taken = new Set([snakeKey(head.x, head.y)]);
            let cur = head;
            for (let n = 1; n < SNAKE_START_LEN; n++) {
                const step = snakeStepCell(cur, { x: -d.x, y: -d.y });
                if (!step.ok || taken.has(snakeKey(step.x, step.y))) break;
                cur = { x: step.x, y: step.y };
                taken.add(snakeKey(cur.x, cur.y));
                body.push(cur);
            }

            // Clear cells straight ahead. Without this the snake could spawn
            // nose-to-wall on a Levels stage, and the very first forward press
            // would kill it — the player's only other options being the two
            // turns, which the same wall layout may also block.
            let runway = 0, ahead = head;
            while (runway < SNAKE_MIN_RUNWAY) {
                const step = snakeStepCell(ahead, d);
                if (!step.ok || taken.has(snakeKey(step.x, step.y))) break;
                ahead = { x: step.x, y: step.y };
                taken.add(snakeKey(ahead.x, ahead.y));
                runway++;
            }

            // Runway outranks tail length: a short snake facing open space is
            // playable, a full-length one facing a brick is not.
            const score = runway * 100 + body.length;
            if (!best || score > best.score) best = { body, dir: d, runway, score };
        }
        return best;
    }

    // Nearest-to-centre free cell with the most free neighbours. A stage whose
    // centre is walled would otherwise spawn the snake inside a brick.
    function snakeSpawnCell() {
        const mid = (snakeGridSize - 1) / 2;
        let best = null, bestScore = -Infinity;
        for (let y = 0; y < snakeGridSize; y++) {
            for (let x = 0; x < snakeGridSize; x++) {
                if (snakeWalls.has(snakeKey(x, y))) continue;
                let room = 0;
                [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
                    .forEach(d => { if (snakeStepCell({ x, y }, d).ok) room++; });
                const dist = Math.abs(x - mid) + Math.abs(y - mid);
                const score = room * 100 - dist;
                if (score > bestScore) { bestScore = score; best = { x, y }; }
            }
        }
        return best || { x: 0, y: 0 };
    }

    // ── Storage ────────────────────────────────────────────────────────
    // Per-mode invalidation, ready before there is any data to invalidate.
    // REFLEX_RESET_FLAG exists because "raise, never lower" makes one bad score
    // immortal — it re-infects every clean client from the gist forever — and
    // that guard had to be retrofitted under fire. Bumping a mode's number here
    // wipes it locally and makes applyPlayerRecordToLocal refuse to restore it,
    // which breaks the loop. Cheap now, expensive later.
    const SNAKE_RESET_FLAGS = { endless: 0, walled: 0, levels: 0 };

    function snakeResetFlagKey(mode) { return 'snakeReset_' + mode + '_' + SNAKE_RESET_FLAGS[mode]; }
    function snakeModeInvalidated(mode) {
        return SNAKE_RESET_FLAGS[mode] > 0 && !!localStorage.getItem(snakeResetFlagKey(mode));
    }

    function loadSnakeHighScore() {
        const saved = localStorage.getItem('snakeHighScore');
        return saved ? (parseInt(saved, 10) || 0) : 0;
    }
    function saveSnakeHighScore(score) {
        localStorage.setItem('snakeHighScore', String(score));
    }

    function snakeLoadHighScores() {
        let raw = null;
        try { raw = JSON.parse(localStorage.getItem('snakeHighScores') || 'null'); } catch (_) {}
        const out = { endless: 0, walled: 0, levels: 0 };
        if (raw && typeof raw === 'object') {
            SNAKE_MODES.forEach(m => { out[m] = parseInt(raw[m], 10) || 0; });
        } else {
            // First run on this build. The pre-v2 game had lethal edges, so the
            // legacy score belongs to Walled — that is where it was actually set.
            out.walled = loadSnakeHighScore();
        }
        SNAKE_MODES.forEach(m => { if (snakeModeInvalidated(m)) out[m] = 0; });
        return out;
    }

    function snakeSaveHighScores(scores) {
        localStorage.setItem('snakeHighScores', JSON.stringify(scores));
        // Keep the legacy key as the overall best. collectGameBests(),
        // revalidateAchievements() and the cloud restore all still read it, so
        // retiring it would mean touching all three for no gain.
        const best = Math.max(scores.endless || 0, scores.walled || 0, scores.levels || 0);
        if (best > loadSnakeHighScore()) saveSnakeHighScore(best);
    }

    function snakeLoadLevelsBest() {
        return parseInt(localStorage.getItem('snakeLevelsBest') || '0', 10) || 0;
    }
    function snakeSaveLevelsBest(stage) {
        if (stage > snakeLoadLevelsBest()) localStorage.setItem('snakeLevelsBest', String(stage));
    }

    function snakeModeBest(mode) { return snakeLoadHighScores()[mode] || 0; }

    // Run once per load: creates snakeHighScores from the legacy key if absent,
    // and drops any mode whose reset flag has been bumped.
    function snakeMigrateStorage() {
        SNAKE_MODES.forEach(mode => {
            if (SNAKE_RESET_FLAGS[mode] > 0 && !localStorage.getItem(snakeResetFlagKey(mode))) {
                const scores = snakeLoadHighScores();
                scores[mode] = 0;
                localStorage.setItem('snakeHighScores', JSON.stringify(scores));
                localStorage.setItem(snakeResetFlagKey(mode), '1');
            }
        });
        if (!localStorage.getItem('snakeHighScores')) snakeSaveHighScores(snakeLoadHighScores());
        localStorage.setItem('snakeRulesetVer', String(SNAKE_RULESET_VERSION));
    }

    // ── Mode control ───────────────────────────────────────────────────
    function snakeSetMode(mode) {
        if (SNAKE_MODES.indexOf(mode) === -1) return snakeMode;
        snakeMode = mode;
        try {
            userPreferences.snakeMode = mode;
            savePreferences();
        } catch (_) {}
        snakeStageIdx = 0;
        resetSnakeGame();
        return snakeMode;
    }

    function cycleSnakeMode() {
        return snakeSetMode(SNAKE_MODES[(SNAKE_MODES.indexOf(snakeMode) + 1) % SNAKE_MODES.length]);
    }

    // ── Input ──────────────────────────────────────────────────────────
    // v1 kept a single nextDirection, so a fast ↑ then ← inside one 300ms tick
    // silently dropped the ←. Two buffered turns is enough for every real input
    // burst and still can't run the snake into itself: each entry is validated
    // against the one before it, not against the direction currently drawn.
    function snakeQueueDir(nd) {
        const prev = snakeDirQueue.length ? snakeDirQueue[snakeDirQueue.length - 1] : snakeDir;
        if (prev.x === nd.x && prev.y === nd.y) return;             // no-op
        if (prev.x === -nd.x && prev.y === -nd.y && (prev.x || prev.y)) return; // 180°
        if (snakeDirQueue.length >= 2) return;
        snakeDirQueue.push(nd);
    }

    function handleSnakeKeyPress(e) {
        if (!snakeGameRunning || snakeGamePaused || snakeDying) return;
        const key = e.key;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(key) === -1) return;
        e.preventDefault();

        const nd = key === 'ArrowUp'   ? { x: 0,  y: -1 }
                 : key === 'ArrowDown' ? { x: 0,  y: 1 }
                 : key === 'ArrowLeft' ? { x: -1, y: 0 }
                 :                       { x: 1,  y: 0 };

        // Starting the run is NOT the same as queueing a turn. Routing both
        // through snakeQueueDir meant its no-op guard swallowed the forward key,
        // so a resting snake could only be started by turning — and on a stage
        // with a wall directly above and below, both turns were fatal.
        //
        // A straight reversal is still not a move, so it starts nothing.
        const reverse = nd.x === -snakeDir.x && nd.y === -snakeDir.y;
        if (!reverse) snakeMoving = true;
        snakeQueueDir(nd);
    }

    // rAF already stalls in a hidden tab, but the widget also runs inside a
    // Picture-in-Picture document where it does not — so a run left in PiP kept
    // playing unattended.
    function handleSnakeVisibility() {
        if (document.hidden && snakeGameRunning && !snakeGamePaused) {
            snakeGamePaused = true;
            updateSnakePlayButton();
        }
    }

    // ── Speed ──────────────────────────────────────────────────────────
    function snakeGetInterval() {
        if (snakeMode === 'levels') {
            // Ramp per STAGE, not per food. Ramping per food on top of twelve
            // stages of accumulated score puts stage 12 past the point of being
            // playable rather than merely hard.
            return Math.max(80, 260 - snakeStageIdx * 14);
        }
        return Math.max(60, 300 - snakeScore * 8);
    }

    // ── Lifecycle ──────────────────────────────────────────────────────
    function startSnakeGame() {
        if (snakeGameRunning) return;
        snakeGameRunning = true;
        snakeGamePaused  = false;
        snakeDying = false;
        snakeDeathT = 0;
        hideSnakeGameOver();

        snakeTickInterval  = snakeGetInterval();
        snakeLastTickMs    = performance.now();
        snakeAccumulatorMs = 0;
        snakePrevSnap      = snakeBody.map(s => ({ ...s }));

        if (snakeAnimFrame) cancelAnimationFrame(snakeAnimFrame);
        snakeAnimFrame = requestAnimationFrame(snakeRenderLoop);
        updateSnakePlayButton();
    }

    function pauseSnakeGame() {
        if (snakeDying) return;
        snakeGamePaused = !snakeGamePaused;
        updateSnakePlayButton();
    }

    function resetSnakeGame() {
        // v1 left this timer running, so switching panels within 3s of dying
        // resurrected the loop on a hidden canvas and burned a core until the
        // page was reloaded.
        if (snakeRestartTimer) { clearTimeout(snakeRestartTimer); snakeRestartTimer = null; }

        // Levels restarts from stage 1, not from wherever you died. The run is
        // the unit — score, stages cleared and the campaign all reset together,
        // and "clear all 12 in one run" only means anything if a death costs
        // the run. snakeLevelsBest keeps the furthest stage you ever reached.
        snakeStageIdx = 0;
        snakeApplyRules();

        const spawn    = snakeSpawnBody();
        snakeBody      = spawn.body;
        snakeDir       = spawn.dir;
        snakeMoving    = false;      // facing set, but idle until the first key
        snakeDirQueue  = [];
        snakeScore     = 0;
        snakeStageEaten = 0;
        snakeStagesCleared = 0;
        snakeBigEaten  = 0;
        snakeMaxLength = snakeBody.length;
        snakePendingGrowth = 0;
        snakeFoodsSinceBig = 0;
        snakeBulges    = [];
        snakeBigFood   = null;
        snakeGameRunning = false;
        snakeGamePaused  = false;
        snakeDying     = false;
        snakeDeathT    = 0;
        snakeDeathCell = null;
        snakeBannerT   = 0;
        snakeTickInterval = snakeGetInterval();

        if (snakeAnimFrame) { cancelAnimationFrame(snakeAnimFrame); snakeAnimFrame = null; }
        snakePrevSnap = [];
        snakeLastTickMs = 0;
        snakeAccumulatorMs = 0;

        if (snakeCtx) snakeCtx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);

        spawnFood();
        updateSnakeScoreDisplay();
        drawSnakeGame();
        hideSnakeGameOver();
        updateSnakePlayButton();
    }

    // ── Food ───────────────────────────────────────────────────────────
    // v1 rejection-sampled in a `do…while` with no exit, so a full board hung
    // the tab outright. At 20×20 open that was theoretical; Levels shrinks the
    // playable area enough to reach it, and this runs inside an HR portal where
    // a hung tab is a visible incident. Enumerate instead: an empty list is a
    // won board, not an infinite loop.
    function snakeFreeCells() {
        const taken = new Set(snakeBody.map(s => snakeKey(s.x, s.y)));
        if (snakeBigFood) taken.add(snakeKey(snakeBigFood.x, snakeBigFood.y));
        const cells = [];
        for (let y = 0; y < snakeGridSize; y++) {
            for (let x = 0; x < snakeGridSize; x++) {
                const k = snakeKey(x, y);
                if (snakeWalls.has(k) || taken.has(k)) continue;
                cells.push({ x, y });
            }
        }
        return cells;
    }

    // Returns false when the board was full, i.e. the caller's tick is over:
    // snakeBoardCleared has either advanced the stage (rebuilding the body) or
    // ended the run, and any further bookkeeping in that tick is stale.
    function spawnFood() {
        const cells = snakeFreeCells();
        if (!cells.length) { snakeBoardCleared(); return false; }
        snakeFood = cells[Math.floor(Math.random() * cells.length)];
        return true;
    }

    function snakeMaybeSpawnBigFood() {
        if (snakeBigFood) return;
        if (snakeFoodsSinceBig < SNAKE_BIG_MIN_GAP) return;
        if (Math.random() > SNAKE_BIG_FOOD_CHANCE) return;
        const cells = snakeFreeCells().filter(c => !(c.x === snakeFood.x && c.y === snakeFood.y));
        if (!cells.length) return;
        const spot = cells[Math.floor(Math.random() * cells.length)];
        snakeBigFood = {
            x: spot.x,
            y: spot.y,
            bornMs: performance.now(),
            ttlMs: snakeTickInterval * SNAKE_BIG_FOOD_TICKS
        };
        snakeFoodsSinceBig = 0;
    }

    function snakeBigFoodRemaining(nowMs) {
        if (!snakeBigFood) return 0;
        return Math.max(0, 1 - (nowMs - snakeBigFood.bornMs) / snakeBigFood.ttlMs);
    }

    // Filling the board is a win, not a crash. In Levels it clears the stage;
    // anywhere else it ends the run with the score intact.
    function snakeBoardCleared() {
        if (snakeMode === 'levels') snakeAdvanceStage();
        else snakeGameOver('cleared');
    }

    // ── Stage progression ──────────────────────────────────────────────
    function snakeAdvanceStage() {
        snakeStagesCleared++;
        snakeSaveLevelsBest(snakeStageIdx + 1);

        if (snakeStageIdx >= SNAKE_STAGES.length - 1) {
            snakeBannerText = '🏆 All ' + SNAKE_STAGES.length + ' stages cleared!';
            snakeBannerT = SNAKE_BANNER_MS;
            snakeGameOver('conquered');
            return;
        }

        snakeStageIdx++;
        snakeStageEaten = 0;
        snakeBannerText = 'Stage ' + (snakeStageIdx + 1) + ' — ' + SNAKE_STAGES[snakeStageIdx].name;
        snakeBannerT = SNAKE_BANNER_MS;

        // New layout, fresh snake, score carries over.
        snakeApplyRules();
        const spawn   = snakeSpawnBody();
        snakeBody     = spawn.body;
        snakeDir      = spawn.dir;
        snakeMoving   = false;
        snakeDirQueue = [];
        snakePendingGrowth = 0;
        snakeBulges   = [];
        snakeBigFood  = null;
        snakePrevSnap = snakeBody.map(s => ({ ...s }));
        snakeTickInterval = snakeGetInterval();
        spawnFood();
        updateSnakeScoreDisplay();
    }

    // ── Logic tick ─────────────────────────────────────────────────────
    function snakeTick() {
        if (snakeGamePaused || snakeDying) return;

        snakePrevSnap = snakeBody.map(s => ({ ...s }));

        // snakeDir now carries the spawn facing, so it can't double as the
        // "hasn't started yet" sentinel the way a zero vector did.
        if (snakeDirQueue.length) { snakeDir = snakeDirQueue.shift(); snakeMoving = true; }
        if (!snakeMoving) return;

        const step = snakeStepCell(snakeBody[0], snakeDir);
        if (!step.ok) {
            // Record where it ended for the death flash. The cell may be off the
            // board (a wall hit), which is fine — the renderer clamps it.
            snakeDeathCell = { x: snakeBody[0].x + snakeDir.x, y: snakeBody[0].y + snakeDir.y };
            snakeGameOver('wall');
            return;
        }
        const head = { x: step.x, y: step.y };

        const eatsFood = head.x === snakeFood.x && head.y === snakeFood.y;
        const eatsBig  = !!snakeBigFood && head.x === snakeBigFood.x && head.y === snakeBigFood.y;
        const willGrow = eatsFood || eatsBig || snakePendingGrowth > 0;

        // The tail vacates this tick unless something is owed, so the cell it is
        // leaving is not a collision. v1 tested the whole body before pop(),
        // which killed a snake following its own tail — rare on an open 20×20,
        // routine in a Level corridor.
        const limit = willGrow ? snakeBody.length : snakeBody.length - 1;
        for (let i = 0; i < limit; i++) {
            if (snakeBody[i].x === head.x && snakeBody[i].y === head.y) {
                snakeDeathCell = { x: head.x, y: head.y };
                snakeGameOver('self');
                return;
            }
        }

        snakeBody.unshift(head);

        if (eatsBig) {
            snakeScore += SNAKE_BIG_FOOD_VALUE;
            snakePendingGrowth += SNAKE_BIG_FOOD_VALUE;
            snakeBulges.push({ pos: 0, size: 1 });
            snakeBigFood = null;
            snakeBigEaten++;
            snakeStageEaten++;
        } else if (eatsFood) {
            snakeScore += 1;
            snakePendingGrowth += 1;
            snakeBulges.push({ pos: 0, size: 0 });
            snakeFoodsSinceBig++;
            snakeStageEaten++;
            // A full board either advances the stage (which rebuilds the body
            // from one segment) or ends the run. Falling through would then pop
            // that single segment and leave an empty body for the next tick to
            // dereference.
            if (!spawnFood()) return;
            snakeMaybeSpawnBigFood();
        }

        if (snakePendingGrowth > 0) snakePendingGrowth--;
        else snakeBody.pop();

        snakeMaxLength = Math.max(snakeMaxLength, snakeBody.length);

        // Lumps travel one segment per tick and fall off the tail.
        snakeBulges.forEach(b => { b.pos++; });
        snakeBulges = snakeBulges.filter(b => b.pos < snakeBody.length);

        if (eatsBig || eatsFood) {
            updateSnakeScoreDisplay();
            snakeTickInterval = snakeGetInterval();
            if (snakeMode === 'levels') {
                const stage = SNAKE_STAGES[snakeStageIdx];
                if (snakeStageEaten >= stage.goal) { snakeAdvanceStage(); return; }
            }
        }

        // A golden bite that ran out of time just vanishes.
        if (snakeBigFood && snakeBigFoodRemaining(performance.now()) <= 0) snakeBigFood = null;
    }

    // Kept so any stray caller from v1 still resolves.
    function updateSnakeGame() { snakeTick(); }

    // ── Death ──────────────────────────────────────────────────────────
    // Enters the animation rather than ending the run outright — v1 cleared the
    // canvas here, which left nowhere for a death animation to exist. Scoring
    // and XP happen in snakeFinalizeDeath once the animation has played.
    function snakeGameOver(cause) {
        if (snakeDying) return;
        snakeDying  = true;
        snakeDeathT = 0;
        snakeGamePaused = false;
        snakeDirQueue = [];
        if (cause === 'cleared' || cause === 'conquered') snakeDeathCell = null;
        updateSnakePlayButton();
    }

    function snakeFinalizeDeath() {
        snakeDying = false;
        snakeGameRunning = false;
        if (snakeAnimFrame) { cancelAnimationFrame(snakeAnimFrame); snakeAnimFrame = null; }
        snakeAccumulatorMs = 0;

        // v1 read `snakeScore >= snakeHighScore` AFTER raising the high score,
        // so it was true on every tie and on the very first game — a permanent
        // free +15 XP. Capture it first.
        const scores  = snakeLoadHighScores();
        const wasHigh = snakeScore > (scores[snakeMode] || 0);
        if (wasHigh) {
            scores[snakeMode] = snakeScore;
            snakeSaveHighScores(scores);
        }
        snakeHighScore = snakeModeBest(snakeMode);
        updateSnakeScoreDisplay();

        awardGameXP('snake', {
            score: snakeScore,
            isHighScore: wasHigh,
            mode: snakeMode,
            // Stages CLEARED, not the stage number reached. snakeLevelsBest is
            // only written on a clear, so reporting the stage you died on would
            // let checkGameAchievements grant a badge revalidateAchievements
            // could never rebuild.
            stagesCleared: snakeStagesCleared,
            bigEaten: snakeBigEaten,
            maxLength: snakeMaxLength,
            allStages: snakeStagesCleared >= SNAKE_STAGES.length
        });

        showSnakeGameOver();
        updateSnakePlayButton();

        snakeRestartTimer = setTimeout(() => {
            snakeRestartTimer = null;
            resetSnakeGame();
            startSnakeGame();
        }, SNAKE_RESTART_MS);
    }
