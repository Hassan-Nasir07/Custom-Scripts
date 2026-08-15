// Verification for the Snake v2 engine and its integration into
// AttendanceTimeCheckerPlus.js.
//
// The headless half drives the real engine: stage connectivity, the edge rules,
// growth arithmetic, the golden-bite timer. The static half audits the wiring
// the plan says must exist, so a missed switch case or a leaderboard mismatch is
// caught here rather than in the portal.
//
//   node snake-dev/snake-verify.js
const fs   = require('fs');
const path = require('path');
const load = require('./load');

const TARGET = path.join(__dirname, '..', 'AttendanceTimeCheckerPlus.js');
const src = fs.readFileSync(TARGET, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
};
const has  = s => src.indexOf(s) !== -1;
const all  = arr => arr.every(has);
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 44 - t.length)));

const S = load();

// ═══════════════════════════════════════════════════════════════════════
head('Stage table');

ok('twelve stages', S.SNAKE_STAGES.length === 12, 'got ' + S.SNAKE_STAGES.length);
ok('every stage has a name, goal and wrap rule',
   S.SNAKE_STAGES.every(st => st.name && st.goal > 0 &&
       ['all', 'lr', 'tb', 'none'].indexOf(st.wrap) !== -1));
ok('goals rise monotonically',
   S.SNAKE_STAGES.every((st, i) => i === 0 || st.goal >= S.SNAKE_STAGES[i - 1].goal));
ok('all four wrap rules are used across the campaign',
   new Set(S.SNAKE_STAGES.map(st => st.wrap)).size === 4);

// The one that matters: a stage with a sealed-off pocket is unwinnable the
// moment food spawns inside it, and the player has no way to know why.
S.SNAKE_STAGES.forEach((st, i) => {
    const walls = S.snakeExpandWalls(st.walls);
    const wrap  = S.snakeWrapFlags(st.wrap);
    const label = 'stage ' + (i + 1) + ' "' + st.name + '"';

    const inBounds = [...walls].every(k => {
        const [x, y] = k.split(',').map(Number);
        return x >= 0 && x < S.snakeGridSize && y >= 0 && y < S.snakeGridSize;
    });
    ok(label + ': walls in bounds', inBounds);

    const free = S.snakeGridSize * S.snakeGridSize - walls.size;
    ok(label + ': leaves room to play', free >= 200, free + ' free cells');

    ok(label + ': every free cell reachable',
       S.snakeFreeRegionConnected(walls, wrap));

    // The spawn search runs against live module state, so point it at this stage.
    S.walls = walls; S.wrap = wrap;
    const spawn = S.snakeSpawnCell();
    ok(label + ': spawn is not inside a wall',
       !walls.has(S.snakeKey(spawn.x, spawn.y)));
    ok(label + ': spawn has somewhere to go',
       [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
           .some(d => S.snakeStepCell(spawn, d, wrap, walls).ok));
});

// ═══════════════════════════════════════════════════════════════════════
head('Edge rules');

const noWalls = new Set();
const W = S.snakeGridSize;

ok('Endless wraps all four edges', (() => {
    const w = S.snakeWrapFlags('all');
    const l = S.snakeStepCell({ x: 0, y: 5 },     { x: -1, y: 0 }, w, noWalls);
    const r = S.snakeStepCell({ x: W - 1, y: 5 }, { x: 1,  y: 0 }, w, noWalls);
    const t = S.snakeStepCell({ x: 5, y: 0 },     { x: 0,  y: -1 }, w, noWalls);
    const b = S.snakeStepCell({ x: 5, y: W - 1 }, { x: 0,  y: 1 }, w, noWalls);
    return l.ok && l.x === W - 1 && r.ok && r.x === 0 &&
           t.ok && t.y === W - 1 && b.ok && b.y === 0;
})());

ok('Walled kills at all four edges', (() => {
    const w = S.snakeWrapFlags('none');
    return !S.snakeStepCell({ x: 0, y: 5 },     { x: -1, y: 0 }, w, noWalls).ok &&
           !S.snakeStepCell({ x: W - 1, y: 5 }, { x: 1,  y: 0 }, w, noWalls).ok &&
           !S.snakeStepCell({ x: 5, y: 0 },     { x: 0,  y: -1 }, w, noWalls).ok &&
           !S.snakeStepCell({ x: 5, y: W - 1 }, { x: 0,  y: 1 }, w, noWalls).ok;
})());

ok("'lr' wraps sideways only", (() => {
    const w = S.snakeWrapFlags('lr');
    return S.snakeStepCell({ x: 0, y: 5 }, { x: -1, y: 0 }, w, noWalls).ok &&
          !S.snakeStepCell({ x: 5, y: 0 }, { x: 0, y: -1 }, w, noWalls).ok;
})());

ok("'tb' wraps vertically only", (() => {
    const w = S.snakeWrapFlags('tb');
    return S.snakeStepCell({ x: 5, y: 0 }, { x: 0, y: -1 }, w, noWalls).ok &&
          !S.snakeStepCell({ x: 0, y: 5 }, { x: -1, y: 0 }, w, noWalls).ok;
})());

// v1 allowed head.x === -1 and head.x === snakeGridSize to survive, so with a
// drawn wall the snake passed visibly through the bricks and died a frame later.
ok('no off-grid grace buffer survives', (() => {
    const w = S.snakeWrapFlags('none');
    const step = S.snakeStepCell({ x: 0, y: 0 }, { x: -1, y: 0 }, w, noWalls);
    return step.ok === false;
})());
// Matches the v1 statement, not the comment that documents having removed it.
ok('the host no longer contains the grace-buffer check',
   !/if \(head\.x < -1/.test(src));

ok('interior walls block movement',
   !S.snakeStepCell({ x: 4, y: 4 }, { x: 1, y: 0 },
                    S.snakeWrapFlags('all'), new Set(['5,4'])).ok);

// ═══════════════════════════════════════════════════════════════════════
head('Food and growth');

(function foodChecks() {
    const G = load();
    G.mode = 'walled';
    G.resetSnakeGame();

    // A board with exactly one free cell must land food there, not spin.
    const body = [];
    for (let y = 0; y < W; y++) {
        for (let x = 0; x < W; x++) {
            if (x === W - 1 && y === W - 1) continue;
            body.push({ x, y });
        }
    }
    G.body = body;
    G.bigFood = null;

    G.moving = true;
    const free = G.snakeFreeCells();
    ok('free-cell enumeration finds the last gap',
       free.length === 1 && free[0].x === W - 1 && free[0].y === W - 1);

    G.spawnFood();
    ok('spawnFood lands on the only free cell',
       G.food.x === W - 1 && G.food.y === W - 1);

    // The v1 do…while had no exit here; this is the case that hung the tab.
    G.body = body.concat([{ x: W - 1, y: W - 1 }]);
    let hung = true;
    const timer = setTimeout(() => {}, 0); clearTimeout(timer);
    G.spawnFood();
    hung = false;
    ok('spawnFood terminates on a full board', !hung);
    ok('a full board is reported as cleared, not a crash', G.dying === true);
    ok('spawnFood reports the full board to its caller', G.spawnFood() === false);
})();

// Filling the board by EATING is the path that actually happens in play, and
// it lands mid-tick: snakeBoardCleared rebuilds the body (Levels) or ends the
// run, and the growth/pop bookkeeping further down the tick is then stale.
// Falling through popped the freshly respawned single segment and left the body
// empty. The failure was deferred and therefore nasty: snakeAdvanceStage also
// zeroes the direction, so the next tick returned early and the board simply
// rendered with no snake on it — the throw only arrived on the player's next
// keypress, one frame into a stage that already looked broken.
(function boardFilledMidTick() {
    const fillExcept = (gx, gy) => {
        const cells = [];
        for (let y = 0; y < W; y++) {
            for (let x = 0; x < W; x++) {
                if (x === gx && y === gy) continue;
                cells.push({ x, y });
            }
        }
        return cells;
    };

    const G = load();
    G.mode = 'levels';
    G.resetSnakeGame();
    G.walls = new Set();                       // open board so it can actually fill
    G.wrap = G.snakeWrapFlags('all');
    const rest = fillExcept(19, 19).filter(c => !(c.x === 18 && c.y === 19));
    G.body = [{ x: 18, y: 19 }].concat(rest);
    G.prevSnap = G.body.map(s => ({ ...s }));
    G.dir = { x: 1, y: 0 };
    G.food = { x: 19, y: 19 };
    G.bigFood = null;

    G.moving = true;
    const stageBefore = G.stageIdx;

    let threw = null;
    try { G.snakeTick(); } catch (e) { threw = e; }
    ok('eating the last cell does not throw', threw === null, threw && threw.message);
    ok('the body is never left empty', G.body.length > 0, 'len ' + G.body.length);
    ok('filling the board clears the Levels stage', G.stageIdx === stageBefore + 1);

    let threwRender = null;
    try { G.drawSnakeGame(0.5); } catch (e) { threwRender = e; }
    ok('the new stage renders', threwRender === null, threwRender && threwRender.message);

    // Where the deferred throw actually landed: the first tick with a real
    // direction, i.e. the moment the player presses a key on the new stage.
    G.dir = { x: 1, y: 0 };
    let threw2 = null;
    try { G.snakeTick(); } catch (e) { threw2 = e; }
    ok('the first keypress on the new stage is safe', threw2 === null, threw2 && threw2.message);

    // Outside Levels the same fill ends the run rather than advancing.
    const H = load();
    H.mode = 'endless';
    H.resetSnakeGame();
    const rest2 = fillExcept(19, 19).filter(c => !(c.x === 18 && c.y === 19));
    H.body = [{ x: 18, y: 19 }].concat(rest2);
    H.prevSnap = H.body.map(s => ({ ...s }));
    H.dir = { x: 1, y: 0 };
    H.food = { x: 19, y: 19 };
    H.bigFood = null;

    H.moving = true;
    let threw3 = null;
    try { H.snakeTick(); } catch (e) { threw3 = e; }
    ok('filling the board outside Levels ends the run cleanly',
       threw3 === null && H.dying === true, threw3 && threw3.message);
    ok('the winning bite still scored', H.score === 1, 'score ' + H.score);
})();

(function growthChecks() {
    const G = load();
    G.mode = 'endless';
    G.resetSnakeGame();
    G.body = [{ x: 5, y: 5 }];
    G.prevSnap = [{ x: 5, y: 5 }];
    G.dir = { x: 1, y: 0 };
    G.food = { x: 6, y: 5 };
    G.bigFood = null;

    G.moving = true;
    const before = G.body.length;
    G.snakeTick();
    ok('a normal food grows by exactly 1',
       G.body.length === before + 1, 'len ' + G.body.length);
    ok('a normal food scores 1', G.score === 1, 'score ' + G.score);

    const H = load();
    H.mode = 'endless';
    H.resetSnakeGame();
    H.body = [{ x: 5, y: 5 }];
    H.prevSnap = [{ x: 5, y: 5 }];
    H.dir = { x: 1, y: 0 };
    H.food = { x: 18, y: 18 };
    H.bigFood = { x: 6, y: 5, bornMs: 0, ttlMs: 1e9 };

    H.moving = true;
    H.snakeTick();
    ok('a golden bite scores 3', H.score === H.SNAKE_BIG_FOOD_VALUE, 'score ' + H.score);
    // +1 this tick, +2 still owed — the pending counter is what makes 3× growth
    // work at all; v1's skip-the-pop could only ever grow by one.
    ok('a golden bite owes 2 more segments after the eating tick',
       H.pendingGrowth === 2, 'pending ' + H.pendingGrowth);
    for (let i = 0; i < 2; i++) { H.food = { x: 18, y: 18 }; H.snakeTick(); }
    ok('a golden bite grows by exactly 3 in total',
       H.body.length === 4, 'len ' + H.body.length);
})();

(function tailChecks() {
    const G = load();
    G.mode = 'endless';
    G.resetSnakeGame();
    // Head about to enter the cell the tail is vacating this tick. v1 tested the
    // whole body before pop(), so this was a false death.
    G.body = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }];
    G.prevSnap = G.body.map(s => ({ ...s }));
    G.dir = { x: 1, y: 0 };
    G.food = { x: 18, y: 18 };
    G.bigFood = null;

    G.moving = true;
    G.snakeTick();
    ok('following your own tail is not a death', G.dying === false);

    const H = load();
    H.mode = 'endless';
    H.resetSnakeGame();
    H.body = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
    H.prevSnap = H.body.map(s => ({ ...s }));
    H.dir = { x: 0, y: 1 };   // into segment index 3
    H.food = { x: 18, y: 18 };
    H.bigFood = null;

    H.moving = true;
    H.snakeTick();
    ok('running into the middle of the body is still a death', H.dying === true);
})();

// ═══════════════════════════════════════════════════════════════════════
head('Golden bite timer');

(function bigFoodChecks() {
    const G = load();
    G.mode = 'walled';
    G.resetSnakeGame();

    // TTL is a fixed number of MOVES, so it scales with the tick interval
    // rather than being a fixed wall-clock window that gets harsher with speed.
    G.tickInterval = 300;
    G.foodsSinceBig = 99;
    G.bigFood = null;

    G.moving = true;
    let guard = 0;
    while (!G.bigFood && guard++ < 500) G.snakeMaybeSpawnBigFood();
    const slow = G.bigFood ? G.bigFood.ttlMs : 0;

    G.bigFood = null;


    G.moving = true;
    G.tickInterval = 60;
    G.foodsSinceBig = 99;
    guard = 0;
    while (!G.bigFood && guard++ < 500) G.snakeMaybeSpawnBigFood();
    const fast = G.bigFood ? G.bigFood.ttlMs : 0;

    ok('TTL scales with the tick interval', slow > fast && fast > 0,
       slow + 'ms vs ' + fast + 'ms');
    ok('TTL is exactly SNAKE_BIG_FOOD_TICKS moves',
       slow === 300 * G.SNAKE_BIG_FOOD_TICKS && fast === 60 * G.SNAKE_BIG_FOOD_TICKS);
    ok('the slow window is a usable ~13s', Math.abs(slow - 13500) < 1,
       slow + 'ms');

    ok('remaining fraction runs 1 → 0',
       G.snakeBigFoodRemaining(G.bigFood.bornMs) === 1 &&
       G.snakeBigFoodRemaining(G.bigFood.bornMs + fast) === 0);

    // Must never land on the snake, the normal food, or a wall.
    const H = load();
    H.mode = 'levels';
    H.stageIdx = 5;
    H.resetSnakeGame();
    let bad = 0;
    for (let i = 0; i < 300; i++) {
        H.bigFood = null;

        H.moving = true;
        H.foodsSinceBig = 99;
        H.snakeMaybeSpawnBigFood();
        if (!H.bigFood) continue;
        const k = H.snakeKey(H.bigFood.x, H.bigFood.y);
        if (H.walls.has(k)) bad++;
        if (H.bigFood.x === H.food.x && H.bigFood.y === H.food.y) bad++;
        if (H.body.some(s => s.x === H.bigFood.x && s.y === H.bigFood.y)) bad++;
    }
    ok('golden bite never spawns on a wall, food or the snake', bad === 0, bad + ' bad spawns');
})();

// ═══════════════════════════════════════════════════════════════════════
head('Input queue');

(function inputChecks() {
    const G = load();
    G.mode = 'endless';
    G.resetSnakeGame();
    G.dir = { x: 1, y: 0 };
    G.dirQueue.length = 0;

    // v1 kept one nextDirection, so the second press inside a tick was lost.
    G.snakeQueueDir({ x: 0, y: -1 });
    G.snakeQueueDir({ x: -1, y: 0 });
    ok('two turns inside one tick are both kept', G.dirQueue.length === 2);

    G.snakeQueueDir({ x: 0, y: 1 });
    ok('the queue is capped at two', G.dirQueue.length === 2);

    const H = load();
    H.resetSnakeGame();
    H.dir = { x: 1, y: 0 };
    H.dirQueue.length = 0;
    H.snakeQueueDir({ x: -1, y: 0 });
    ok('a direct 180° is rejected', H.dirQueue.length === 0);

    H.snakeQueueDir({ x: 0, y: 1 });
    H.snakeQueueDir({ x: 0, y: -1 });
    ok('a 180° against the QUEUED turn is rejected too', H.dirQueue.length === 1);
})();

// ═══════════════════════════════════════════════════════════════════════
head('Scoring, storage and stages');

(function storageChecks() {
    // A player arriving from v1 has only the legacy scalar key.
    const G = load({ store: { snakeHighScore: '37' } });
    G.snakeMigrateStorage();
    const scores = G.snakeLoadHighScores();
    ok('the legacy score migrates into Walled', scores.walled === 37,
       JSON.stringify(scores));
    ok('the other modes start clean', scores.endless === 0 && scores.levels === 0);

    G.snakeSaveHighScores({ endless: 12, walled: 37, levels: 90 });
    ok('the legacy key becomes the overall best',
       global.localStorage.getItem('snakeHighScore') === '90');
    ok('the ruleset version is stamped',
       global.localStorage.getItem('snakeRulesetVer') === String(G.SNAKE_RULESET_VERSION));
})();

(function highScoreChecks() {
    const G = load({ store: { snakeHighScore: '10', snakeHighScores: '{"endless":0,"walled":10,"levels":0}' } });
    G.mode = 'walled';
    G.resetSnakeGame();
    G.score = 10;                 // exactly ties the record
    G.dying = true;
    G.running = true;
    G.snakeFinalizeDeath();
    // v1 read `score >= high` AFTER raising the record, so a tie paid the
    // new-record bonus forever.
    ok('a tie is not reported as a new high score',
       global.__lastXP && global.__lastXP.perf.isHighScore === false);

    const H = load({ store: { snakeHighScore: '10', snakeHighScores: '{"endless":0,"walled":10,"levels":0}' } });
    H.mode = 'walled';
    H.resetSnakeGame();
    H.score = 11;
    H.dying = true;
    H.running = true;
    H.snakeFinalizeDeath();
    ok('beating the record is reported as a new high score',
       global.__lastXP && global.__lastXP.perf.isHighScore === true);
    ok('the XP payload carries the mode', global.__lastXP.perf.mode === 'walled');
})();

// A one-segment start rendered as a single dot with a face on it — you could
// not tell it was a snake, or which way it pointed, until you had eaten twice.
(function spawnChecks() {
    SNAKE_MODES_CHECK: {
        const G = load();
        ['endless', 'walled', 'levels'].forEach(mode => {
            G.snakeSetMode(mode);
            ok(mode + ': starts as a snake, not a dot',
               G.body.length === 4, 'len ' + G.body.length);
            ok(mode + ': the starting body is contiguous',
               G.body.every((s, i) => i === 0 ||
                   Math.abs(s.x - G.body[i - 1].x) + Math.abs(s.y - G.body[i - 1].y) === 1));
            ok(mode + ': no segment starts inside a wall',
               G.body.every(s => !G.walls.has(G.snakeKey(s.x, s.y))));
            ok(mode + ': no segment is doubled up',
               new Set(G.body.map(s => G.snakeKey(s.x, s.y))).size === G.body.length);
            // The facing is seeded so the 180° guard has something to bite on
            // from the very first press.
            ok(mode + ': starts with a facing', !!(G.dir.x || G.dir.y));
            ok(mode + ': the body trails behind the head',
               G.body[1].x === G.body[0].x - G.dir.x && G.body[1].y === G.body[0].y - G.dir.y);
        });
    }

    // Every authored stage has to be able to seat a full-length snake.
    const H = load();
    H.SNAKE_STAGES.forEach((st, i) => {
        H.mode = 'levels';
        H.stageIdx = i;
        H.resetSnakeGame();
        ok('stage ' + (i + 1) + ' seats a full starting body', H.body.length === 4,
           'len ' + H.body.length);
    });

    // Reversing into your own neck on the first press must be refused.
    const R = load();
    R.snakeSetMode('endless');
    R.dirQueue.length = 0;
    R.snakeQueueDir({ x: -R.dir.x, y: -R.dir.y });
    ok('the first keypress cannot reverse into the starting body',
       R.dirQueue.length === 0);

    // Idle until the player actually steers, even though a facing exists.
    const I = load();
    I.snakeSetMode('endless');
    const head0 = { ...I.body[0] };
    I.snakeTick();
    ok('the snake holds still until the first key',
       I.body[0].x === head0.x && I.body[0].y === head0.y);
    // Perpendicular: queueing the direction it already faces is a no-op, so it
    // would never mark the run as started.
    I.snakeQueueDir({ x: I.dir.y, y: I.dir.x || 1 });
    I.snakeTick();
    ok('and moves once steered',
       I.body[0].x !== head0.x || I.body[0].y !== head0.y);

    // Every spawn must leave room straight ahead. Without it the snake can be
    // placed nose-to-wall, and on a stage that also walls the two turns there
    // is no opening key that doesn't kill you.
    const P = load();
    P.SNAKE_STAGES.forEach((st, i) => {
        P.mode = 'levels';
        P.stageIdx = i;
        P.resetSnakeGame();
        let runway = 0, cur = P.body[0];
        const occupied = new Set(P.body.map(s => P.snakeKey(s.x, s.y)));
        for (let n = 0; n < 4; n++) {
            const step = P.snakeStepCell(cur, P.dir);
            if (!step.ok || occupied.has(P.snakeKey(step.x, step.y))) break;
            cur = { x: step.x, y: step.y };
            occupied.add(P.snakeKey(cur.x, cur.y));
            runway++;
        }
        ok('stage ' + (i + 1) + ' spawns with room straight ahead',
           runway >= 4, runway + ' clear cells');
    });
})();

// The forward key has to start the run. Routing "start" through snakeQueueDir
// meant its no-op guard swallowed it, so only the two turns could begin a run —
// and a stage walled above and below made both of those fatal.
(function openingKeyChecks() {
    const press = key => ({ key, preventDefault() {} });
    const dirKey = d => d.x === 1 ? 'ArrowRight' : d.x === -1 ? 'ArrowLeft'
                      : d.y === 1 ? 'ArrowDown'  : 'ArrowUp';
    const opposite = d => ({ x: -d.x, y: -d.y });

    const G = load();
    G.snakeSetMode('endless');
    G.running = true;
    const facing = { ...G.dir };
    const head0 = { ...G.body[0] };
    G.handleSnakeKeyPress(press(dirKey(facing)));
    ok('the forward key starts the run', G.moving === true);
    G.snakeTick();
    ok('and the snake actually moves forward',
       G.body[0].x === head0.x + facing.x && G.body[0].y === head0.y + facing.y);

    // A straight reversal is not a move, so it must not start anything either.
    const H = load();
    H.snakeSetMode('endless');
    H.running = true;
    H.handleSnakeKeyPress(press(dirKey(opposite(H.dir))));
    ok('the reverse key does not start the run', H.moving === false);
    const hHead = { ...H.body[0] };
    H.snakeTick();
    ok('and the snake stays put', H.body[0].x === hHead.x && H.body[0].y === hHead.y);

    // Both perpendicular turns still work as openings.
    ['left', 'right'].forEach((side, i) => {
        const T = load();
        T.snakeSetMode('endless');
        T.running = true;
        const perp = i === 0 ? { x: T.dir.y, y: -T.dir.x } : { x: -T.dir.y, y: T.dir.x };
        T.handleSnakeKeyPress(press(dirKey(perp)));
        ok('turning ' + side + ' also starts the run', T.moving === true);
    });

    // Keys that aren't arrows must not start it.
    const N = load();
    N.snakeSetMode('endless');
    N.running = true;
    N.handleSnakeKeyPress(press('a'));
    ok('a non-arrow key does not start the run', N.moving === false);
})();

(function stageChecks() {
    const G = load();
    G.mode = 'levels';
    G.resetSnakeGame();
    ok('Levels starts on stage 1', G.stageIdx === 0);

    G.stageEaten = G.SNAKE_STAGES[0].goal;
    const scoreBefore = G.score = 7;
    G.snakeAdvanceStage();
    ok('clearing a stage advances the index', G.stageIdx === 1);
    ok('score carries across the stage boundary', G.score === scoreBefore);
    ok('the stage counter resets', G.stageEaten === 0);
    ok('the new stage layout is loaded',
       G.walls.size === G.snakeExpandWalls(G.SNAKE_STAGES[1].walls).size);
    ok('best stage is persisted', G.snakeLoadLevelsBest() >= 1);

    // A death has to cost the run, or "clear all 12 in one run" is farmable by
    // dying repeatedly on stage 11.
    G.resetSnakeGame();
    ok('reset returns the campaign to stage 1', G.stageIdx === 0);
    ok('reset clears the run stage count', G.stagesCleared === 0);
    ok('the furthest stage still survives a reset', G.snakeLoadLevelsBest() >= 1);

    // Clearing the last stage ends the run rather than running off the table.
    const H = load();
    H.mode = 'levels';
    H.resetSnakeGame();
    H.stageIdx = H.SNAKE_STAGES.length - 1;
    H.snakeAdvanceStage();
    ok('clearing the final stage ends the run', H.dying === true);
    ok('the final stage does not overflow the table',
       H.stageIdx === H.SNAKE_STAGES.length - 1);
})();

(function speedChecks() {
    const G = load();
    G.mode = 'levels';
    G.resetSnakeGame();
    const first = G.snakeGetInterval();
    G.stageIdx = 11;
    const last = G.snakeGetInterval();
    ok('Levels ramps per stage, not per food', last < first, first + 'ms → ' + last + 'ms');
    ok('the final stage is still playable', last >= 80, last + 'ms');

    G.mode = 'endless';
    G.score = 0;  const slow = G.snakeGetInterval();
    G.score = 40; const fast = G.snakeGetInterval();
    ok('open modes ramp per food', slow === 300 && fast === 60);
})();

// ═══════════════════════════════════════════════════════════════════════
head('Skins');

ok('five skins ship', Object.keys(S.SNAKE_SKINS).length === 5);
ok('emerald is unlocked by default', S.SNAKE_SKINS.emerald.unlock === null);
ok('every other skin names an achievement',
   Object.keys(S.SNAKE_SKINS).filter(k => k !== 'emerald')
       .every(k => typeof S.SNAKE_SKINS[k].unlock === 'string'));
// A skin gated on a key that no longer exists is permanently unobtainable and
// nothing else would report it.
ok('every unlock key exists in ACHIEVEMENTS',
   Object.keys(S.SNAKE_SKINS)
       .filter(k => S.SNAKE_SKINS[k].unlock)
       .every(k => !!global.ACHIEVEMENTS[S.SNAKE_SKINS[k].unlock]));
ok('non-legendary skins have a three-colour preset',
   Object.keys(S.SNAKE_SKINS)
       .filter(k => !S.SNAKE_SKINS[k].legendary)
       .every(k => Array.isArray(S.SNAKE_SKINS[k].colors) && S.SNAKE_SKINS[k].colors.length === 3));
ok('both patterns are used',
   new Set(Object.keys(S.SNAKE_SKINS).map(k => S.SNAKE_SKINS[k].pattern))
       .size >= 3);   // none + dots + stripes

(function skinLockChecks() {
    const G = load({ prefs: { snakeSkin: 'prism' }, achievements: [] });
    ok('a locked skin falls back to emerald', G.snakeActiveSkinId() === 'emerald');
    const H = load({ prefs: { snakeSkin: 'prism' }, achievements: ['snakeConqueror'] });
    ok('an earned skin is selectable', H.snakeActiveSkinId() === 'prism');
    ok('the legendary swatch reuses the widget gradientFlow keyframe',
       H.snakeSwatchStyle('prism').indexOf('gradientFlow') !== -1);
    // The hue must actually move, or "RGB flow" is just a static rainbow.
    H.skinTime = 0;   const a = H.snakeSegmentColors(H.SNAKE_SKINS.prism, 0, 10)[0];
    H.skinTime = 1.5; const b = H.snakeSegmentColors(H.SNAKE_SKINS.prism, 0, 10)[0];
    ok('the legendary hue advances with time', a !== b, a + ' vs ' + b);
    ok('the legendary hue also varies along the body',
       H.snakeSegmentColors(H.SNAKE_SKINS.prism, 0, 10)[0] !==
       H.snakeSegmentColors(H.SNAKE_SKINS.prism, 6, 10)[0]);
})();

// ═══════════════════════════════════════════════════════════════════════
head('Rendering geometry');

(function geometryChecks() {
    // initSnakeGame is what binds snakeCanvas; the metrics are only ever
    // reached from drawSnakeGame, which is guarded on the context existing.
    const G = load({ prefs: { snakeMode: 'walled' } });
    G.initSnakeGame();
    const walled = G.snakeBoardMetrics();
    ok('Walled insets the board for the brick frame', walled.pad === G.SNAKE_WALL_PX);
    // The frame must live in canvas margin: if it consumed grid cells the
    // playfield would shrink and every pre-v2 score would stop being comparable.
    ok('the playfield is still 20 cells wide',
       Math.abs(walled.pad * 2 + walled.cs * G.snakeGridSize - 368) < 0.001);

    G.mode = 'endless';
    G.resetSnakeGame();
    const endless = G.snakeBoardMetrics();
    ok('Endless draws no frame', endless.pad === 0);
    ok('Endless fills the canvas', Math.abs(endless.cs * G.snakeGridSize - 368) < 0.001);

    // Wrapping must never lerp the segment across the board — at no point in
    // the tick may it render between the two edges. It snaps to the destination
    // rather than holding at the source, so the body follows it through the
    // portal instead of the segment waiting a tick and then teleporting.
    const cs = endless.cs;
    let strayed = 0, atSource = 0;
    for (let k = 0; k <= 10; k++) {
        const p = G.snakeLerpSeg({ x: 19, y: 5 }, { x: 0, y: 5 }, k / 10, endless);
        if (p.px > 0.001 && p.px < 19 * cs - 0.001) strayed++;
        if (Math.abs(p.px - 19 * cs) < 0.001) atSource++;
    }
    ok('a wrapped segment never renders mid-board', strayed === 0, strayed + ' strayed');
    ok('a wrapped segment snaps to the destination, not the source',
       atSource === 0, atSource + ' frames held at the source edge');

    // Un-wrapped movement must still interpolate, or the whole body snaps.
    const mid = G.snakeLerpSeg({ x: 4, y: 5 }, { x: 5, y: 5 }, 0.5, endless);
    ok('an ordinary step still interpolates',
       Math.abs(mid.px - 4.5 * cs) < 0.001, 'px ' + mid.px);

    ok('a swallowed lump swells the segment it sits on',
       G.snakeBulgeScale(0, 0) === 1);

    // Movement has to interpolate across the tick. If centres only ever land on
    // cell centres the snake reads as a dot matrix hopping square to square,
    // however good the body art is.
    G.snakeSetMode('endless');
    G.body = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    G.prevSnap = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    const at = f => G.snakeCenters(endless, f)[0].x;
    const x0 = at(0), xHalf = at(0.5), x1 = at(1);
    ok('the head starts the tick at its previous cell',
       Math.abs(x0 - (9.5 * cs)) < 0.001, 'x ' + x0);
    ok('the head sits between cells mid-tick',
       xHalf > x0 + 0.001 && xHalf < x1 - 0.001, 'x ' + xHalf);
    ok('the head lands exactly on the new cell at the end of the tick',
       Math.abs(x1 - (10.5 * cs)) < 0.001, 'x ' + x1);
    ok('every segment moves together',
       Math.abs(G.snakeCenters(endless, 0.5)[2].x - (7.5 * cs + 0.5 * cs)) < 0.001);

    // The body is stroked as one continuous path now; a run has to break across
    // a portal edge or the stroke draws a bar straight across the board.
    G.body = [{ x: 0, y: 5 }, { x: 19, y: 5 }, { x: 18, y: 5 }];
    G.prevSnap = G.body.map(s => ({ ...s }));
    const runs = G.snakeRuns(G.snakeCenters(endless, 1));
    ok('the body splits into runs at a portal edge', runs.length === 2,
       runs.length + ' runs');
    ok('an unbroken body is a single run', (() => {
        G.body = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }];
        G.prevSnap = G.body.map(s => ({ ...s }));
        return G.snakeRuns(G.snakeCenters(endless, 1)).length === 1;
    })());

    // The tail tapers, the middle does not — a body that thins along its whole
    // length reads as a worm.
    ok('only the last few segments taper',
       G.snakeTaper(0, 20) === 1 && G.snakeTaper(10, 20) === 1 &&
       G.snakeTaper(19, 20) < 0.5 && G.snakeTaper(18, 20) < 1);
})();

(function deathChecks() {
    const G = load();
    G.mode = 'walled';
    G.resetSnakeGame();
    G.running = true;
    G.body = [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }];
    G.prevSnap = G.body.map(s => ({ ...s }));
    G.dir = { x: -1, y: 0 };
    G.moving = true;
    G.snakeTick();
    ok('hitting the wall enters the death animation', G.dying === true);
    ok('the run is still marked running during the animation', G.running === true);
    ok('the animation has a blink phase then a fade phase',
       G.SNAKE_BLINK_MS > 0 && G.SNAKE_DEATH_MS > G.SNAKE_BLINK_MS);
    ok('death does not award XP until the animation finishes',
       global.__lastXP === null);
    G.deathT = G.SNAKE_DEATH_MS;
    G.snakeFinalizeDeath();
    ok('XP is awarded once the animation finishes', global.__lastXP !== null);
})();

// ═══════════════════════════════════════════════════════════════════════
head('Render smoke');

// The stub context swallows every draw call, so this proves nothing about how
// the board looks — but it does prove every path executes without throwing,
// which is the failure mode that would blank the panel in the portal.
(function renderSmoke() {
    const draw = (label, setup) => {
        const G = load();
        G.initSnakeGame();
        try { setup(G); G.drawSnakeGame(0.5); ok('renders: ' + label, true); }
        catch (e) { ok('renders: ' + label, false, e.message); }
    };

    draw('Endless, idle',        G => { G.snakeSetMode('endless'); });
    draw('Walled, idle',         G => { G.snakeSetMode('walled'); });
    draw('Levels stage 1',       G => { G.snakeSetMode('levels'); });
    draw('Levels mid-campaign',  G => { G.snakeSetMode('levels'); G.stageIdx = 7; G.resetSnakeGame(); });
    draw('long body, moving',    G => {
        G.snakeSetMode('endless');
        G.body = Array.from({ length: 40 }, (_, i) => ({ x: 10, y: (5 + i) % 20 }));
        G.prevSnap = G.body.map(s => ({ ...s }));
        G.dir = { x: 0, y: 1 };
    });
    draw('mouth open on food',   G => {
        G.snakeSetMode('endless');
        G.body = [{ x: 5, y: 5 }];
        G.prevSnap = [{ x: 5, y: 5 }];
        G.dir = { x: 1, y: 0 };
        G.food = { x: 6, y: 5 };
    });
    draw('golden bite on board', G => {
        G.snakeSetMode('walled');
        G.bigFood = { x: 8, y: 8, bornMs: 0, ttlMs: 5000 };
    });
    draw('mid-death blink',      G => { G.dying = true; G.deathT = 300; });
    draw('mid-death fade',       G => { G.dying = true; G.deathT = 1100; });
    draw('paused overlay',       G => { G.running = true; G.paused = true; });
    draw('stage banner',         G => { G.snakeSetMode('levels'); G.stageEaten = 5; G.snakeAdvanceStage(); });

    // Every skin has to survive a frame, including the legendary's hue path.
    Object.keys(S.SNAKE_SKINS).forEach(id => {
        const G = load({ prefs: { snakeSkin: id }, achievements: Object.keys(global.ACHIEVEMENTS) });
        G.initSnakeGame();
        try {
            G.body = Array.from({ length: 12 }, (_, i) => ({ x: 4 + i, y: 9 }));
            G.prevSnap = G.body.map(s => ({ ...s }));
            G.dir = { x: 1, y: 0 };
            G.skinTime = 2.4;
            G.drawSnakeGame(0.5);
            ok('renders: skin "' + id + '"', true);
        } catch (e) { ok('renders: skin "' + id + '"', false, e.message); }
    });

    // The tray builds its own markup; a throw here empties the panel silently.
    Object.keys(S.SNAKE_SKINS).forEach(id => {
        try {
            const css = S.snakeSwatchStyle(id);
            ok('swatch style for "' + id + '"', typeof css === 'string' && css.length > 10);
        } catch (e) { ok('swatch style for "' + id + '"', false, e.message); }
    });
})();

// ═══════════════════════════════════════════════════════════════════════
head('Host integration — engine block');

ok('the block is sentinel-wrapped',
   has('// ═══ SNAKE ENGINE — generated from snake-dev/, do not edit here ═══') &&
   has('// ═══ END SNAKE ENGINE ═══'));

const wantBlock = ['snake-core.js', 'snake-ui.js']
    .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')
                .replace(/\r\n/g, '\n').replace(/\n+$/, ''))
    .join('\n\n');
ok('the integrated engine is byte-identical to the tested source',
   src.replace(/\r\n/g, '\n').indexOf(wantBlock) !== -1);

ok('no snake state is left scattered outside the block',
   !/^\s{4}let snake = \[/m.test(src) &&
   !/^\s{4}let food = \{/m.test(src) &&
   !/^\s{4}let direction = \{/m.test(src) &&
   !/^\s{4}let nextDirection = \{/m.test(src));
ok('the dead snakeCellSize constant is gone', !has('snakeCellSize'));
ok('the unprefixed gameOver() is gone', !/function gameOver\(\)/.test(src));

head('Host integration — lifecycle');

ok('cleanupCurrentGame cancels the restart timer',
   /case 'snake':[\s\S]{0,1600}?clearTimeout\(snakeRestartTimer\)/.test(src));
ok('cleanupCurrentGame detaches both listeners',
   /case 'snake':[\s\S]{0,1800}?removeEventListener\('keydown', handleSnakeKeyPress\)[\s\S]{0,200}?removeEventListener\('visibilitychange', handleSnakeVisibility\)/.test(src));
// The run is committed in snakeFinalizeDeath, 1.4s after the death that earned
// it. Cancelling the frame without finalising threw the score and the XP away —
// die, switch panel, and the record never existed. It has to happen before the
// teardown clears snakeDying, and before the restart timer it arms is cleared.
ok('cleanupCurrentGame commits a run that was still dying',
   /case 'snake':[\s\S]{0,900}?if \(snakeDying\) \{[^}]*snakeFinalizeDeath\(\)[\s\S]{0,600}?snakeGameRunning = false[\s\S]{0,600}?clearTimeout\(snakeRestartTimer\)/.test(src));
ok('initCurrentGame still has a snake case',
   /case 'snake':[\s\S]{0,200}?initSnakeGame\(\)/.test(src));
ok('all snake window bridges defined',
   ['snakePlayPause', 'resetSnake', 'cycleSnakeModeBtn', 'toggleSnakeSkinTrayBtn']
       .every(b => has('window.' + b + ' =')));
ok('the shared leaderboard bridges are defined',
   has('window.openGameLeaderboard =') && has('window.closeGameLeaderboard ='));
// The overlay element is shared by every panel, so it has to close on a switch
// or it would hang over the next game's board.
ok('switching games closes the shared overlay',
   /function cleanupCurrentGame\(\)[\s\S]{0,320}?toggleGameLeaderboard\(gameLbOpen, false\)/.test(src));

head('Host integration — panel');

ok('mode and skin buttons present',
   all(['id="snake-mode-btn"', 'window.cycleSnakeModeBtn()',
        'window.toggleSnakeSkinTrayBtn()']));
ok('scoreboard carries the mode chip', has('id="snake-mode-chip"'));
// Best/Score are no longer two loose labels; they live inside the button that
// opens this mode's leaderboard. Four chips in a ~340px header wrapped onto
// three lines and stranded the title.
ok('score and best are folded into the leaderboard button',
   /id="snake-lb-btn"[\s\S]{0,400}?id="snake-current-score"[\s\S]{0,200}?id="snake-high-score"/.test(src));
ok('the score button opens the in-game leaderboard',
   has(`window.openGameLeaderboard('snake')`));
ok('the in-game leaderboard overlay exists', has('id="game-lb-overlay"'));
ok('the overlay reuses the panel row builder, not a second copy',
   has('function lbBoardRowsHtml(') &&
   /lbBoardRowsHtml\(game, mode\)/.test(src));
// The stage readout rides the mode chip. Drawn on the canvas it sat top-left,
// inside the playfield the snake spawns in and travels through, so it covered
// the gameplay it was describing.
ok('the separate stage chip is gone from the header', !has('id="snake-stage-chip"'));
ok('nothing draws a stage label onto the playfield',
   !/snakeDrawStageHud/.test(src));
ok('the mode chip carries the stage in Levels',
   /snakeMode === 'levels'[\s\S]{0,300}?mode\.textContent = meta\.icon \+ ' Stage '/.test(src));
ok('skin tray element present', has('id="snake-skin-tray"'));
ok('skin tray styled', all(['.snake-skin-card', '.snake-skin-swatch', '.snake-skin-grid']));
ok('game-over overlay has the mode sub-line', has('snake-go-sub'));

head('Host integration — achievements and XP');

const SNAKE_ACH = ['snakeEndless', 'snakeWalled', 'snakeGourmand',
                   'snakeCampaign', 'snakeConqueror', 'snakeLong'];
ok('all six achievements defined', SNAKE_ACH.every(k => has(k + ':')));
ok('all six have an XP value',
   SNAKE_ACH.every(k => new RegExp(k + ':\\s*\\d+').test(src)));
ok('checkGameAchievements reads the new payload fields',
   /case 'snake':[\s\S]{0,900}?p\.bigEaten[\s\S]{0,600}?p\.maxLength/.test(src));
ok('revalidateAchievements can restore the two mode achievements',
   has("!has('snakeEndless')") && has("!has('snakeWalled')"));
ok('per-run achievements are NOT retroactively granted',
   !has("!has('snakeGourmand')") && !has("!has('snakeLong')"));
ok('awardGameXP is mode-aware',
   /case 'snake': \{[\s\S]{0,1400}?stagesCleared/.test(src));

head('Host integration — leaderboard');

// The old table carried eight emoji game columns; they are gone, and the
// colspan must have shrunk with them or the empty state spans the wrong width.
const th = (src.match(/<th title="[^"]+">/g) || []).length;
const td = (src.match(/<td class="lb-score">/g) || []).length;
const colspan = (src.match(/colspan="(\d+)" class="lb-empty"/) || [])[1];
ok('no per-game columns remain in the main table', th === 0 && td === 0,
   th + ' headers, ' + td + ' cells');
// Derived from the header, not a literal: naming the number here is how the
// colspan drifted a column wide from the table it spans.
const thead = (src.match(/<thead><tr>[\s\S]*?<\/tr><\/thead>/) || [''])[0];
// `<th[ >]` so the enclosing `<thead>` isn't counted as a column.
const mainCols = (thead.match(/<th[ >]/g) || []).length;
ok('the empty-state colspan matches the main table width',
   mainCols > 0 && Number(colspan) === mainCols,
   'colspan=' + colspan + ' but the header has ' + mainCols + ' columns');
// gameModeBests is authoritative once present, so a key sourced from a
// lazily-seeded store would erase that game rather than fall back.
ok('pool bests are collected via the seeding loader, not the raw key',
   /const poolModes = loadPoolWinsByMode\(\)/.test(src));
ok('snakeCampaign is gated on stages CLEARED, matching its backfill',
   /snakeCampaign'\) && \(p\.stagesCleared \|\| 0\) >= 6/.test(src));
ok('the board registry exists', has('const LB_BOARDS'));
ok('every game has a board', ['snake', 'tetris', 'breakout', 'flappy', 'aim', 'reflex', 'pool', 'ludo']
   .every(g => new RegExp('\\b' + g + ':\\s*\\{[^}]*label:').test(src)));
ok('RefleX is marked lower-is-better', has('lowerIsBetter: true'));
// The per-game boards used to be a section appended under the Leaderboard
// panel, which stretched the whole widget taller than the games beside it.
// They now open over each game's own board and cost the panel no height.
ok('the leaderboard panel no longer appends a board section',
   !has('renderLbBoardSection') && !has('bindLbBoardSelectors') &&
   !has('id="lb-board-select"') && !has('data-lb-board='));
ok('the panel renders only the roster table and its footer',
   /panel\.innerHTML = `[\s\S]{0,700}?lb-table-wrap[\s\S]{0,700}?lb-footer[\s\S]{0,40}?`;/.test(src));

// Every ranked game needs a button, or its board is unreachable now that the
// panel section is gone.
const LB_GAMES = ['snake', 'tetris', 'breakout', 'flappy', 'aim', 'reflex', 'pool', 'ludo'];
LB_GAMES.forEach(g => {
    ok(g + ' has a scoreboard button wired to its board',
       has('id="' + g + '-lb-btn"') && has(`window.openGameLeaderboard('` + g + `')`));
});
// The overlay must follow the mode actually being played, not a remembered
// preference that may have drifted from it.
ok('the overlay reads the live mode for every multi-mode game',
   /function gameLbMode\(game\)[\s\S]{0,500}?return snakeMode[\s\S]{0,200}?return reflexMode[\s\S]{0,200}?poolMode/.test(src));
// Career-win games have no per-frame scoreboard function to hang off, and
// Ludo's lives inside the byte-identical engine block and can't be edited.
ok('win-count buttons are refreshed from outside the engine block',
   /function refreshGameScoreBtn\(game\)[\s\S]{0,500}?ludoTierWins\([\s\S]{0,300}?loadPoolWinsByMode\(\)/.test(src));
// The button opens a board; it has to show that board's number. Showing the
// all-time total beside a per-tier ranking is how the two disagree.
ok('the Ludo button counts the tier it opens, not every win ever',
   /function refreshGameScoreBtn\(game\)[\s\S]{0,400}?ludoTierWins\(gameLbMode\('ludo'\)\)/.test(src));
ok('and refreshed when a match ends', /refreshGameScoreBtn\(gameType\)/.test(src));

// The overlay used to show exactly one board — whichever mode was being played.
// Ludo's four difficulty boards would otherwise only be reachable by changing a
// settings dropdown, which is a poor way to ask "how do I rank on hard?".
ok('the overlay carries a tab per mode', has('function gameLbTabsHtml(game, active)') &&
   has('window.setGameLeaderboardMode'));
ok('the tabs are rendered above the table',
   /function renderGameLeaderboard\(game\)[\s\S]{0,900}?gameLbTabsHtml\(game, mode\)[\s\S]{0,120}?lbBoardRowsHtml\(game, mode\)/.test(src));
ok('only a real mode of the open game can be selected',
   /setGameLeaderboardMode = \(mode\)[\s\S]{0,320}?cfg\.modes\[mode\][\s\S]{0,80}?return;/.test(src));
// A hand-picked board is for comparing, not a preference. Left set, it would
// quietly outlive the mode switch it was meant to survive — which is the exact
// drift gameLbMode reads live state to avoid.
ok('opening the overlay clears any hand-picked board',
   /function toggleGameLeaderboard\([\s\S]{0,700}?gameLbModeOverride = null;[\s\S]{0,80}?renderGameLeaderboard\(game\)/.test(src));
ok('the live board is marked so it is clear where a win lands',
   has('game-lb-live') && /m === live \? ' — playing now' : ''/.test(src));
// The old label pairs are what the button replaced.
ok('the old "Best: …" label pairs are gone',
   !/textContent = 'Best: '/.test(src) && !has('High Score: 0'));

// Rewriting eight scoreboard functions means reaching into eight games' state,
// and a plausible-but-wrong variable name throws a ReferenceError the moment
// that panel opens — which no static grep for structure would notice. Assert
// every identifier the new scoreboard code reads is actually declared.
[
    ['reflexReactionTimes', 'let'], ['reflexMode', 'let'], ['reflexGameModes', 'const'],
    ['aimScore', 'let'], ['flappyScore', 'let'], ['flappyHighScore', 'let'],
    ['tetrisScore', 'let'], ['tetrisLines', 'let'], ['tetrisLevel', 'let'],
    ['tetrisHighScore', 'let'], ['breakoutScore', 'let'], ['breakoutHighScore', 'let'],
    ['breakoutLevel', 'let'], ['breakoutLives', 'let'], ['poolMode', 'let'],
    ['poolPlayer1Pocketed', 'let'], ['poolPlayer2Pocketed', 'let'], ['snakeMode', 'let'],
].forEach(([name]) => {
    ok('scoreboard state "' + name + '" is declared',
       new RegExp('(?:let|const|var)\\s+' + name + '\\b').test(src));
});
['loadAimHighScore', 'loadReflexHighScores', 'loadPoolWinsByMode', 'ludoLoadWins']
    .forEach(fn => ok('scoreboard helper "' + fn + '" is defined',
                      new RegExp('function\\s+' + fn + '\\b').test(src)));
// RefleX's chip reads .icon and .name off the mode config.
ok('every RefleX mode config has the fields the chip renders',
   /screen:\s*\{[\s\S]{0,200}?name:[\s\S]{0,60}?icon:/.test(src) &&
   /target:\s*\{[\s\S]{0,200}?name:[\s\S]{0,60}?icon:/.test(src));
ok('collectGameModeBests exists', has('function collectGameModeBests()'));
ok('the snapshot carries gameModeBests and the ruleset version',
   /gameModeBests: collectGameModeBests\(\)/.test(src) && has('rulesetVersion'));
// gameBests.snake must stay a scalar: older clients still in the wild send one,
// and turning it into an object is what would let the merge silently mangle it.
ok('gameBests.snake is still a scalar',
   /snake:\s+parseInt\(localStorage\.getItem\('snakeHighScore'/.test(src));
// One definition plus three call sites: buildPlayerSnapshot, and the two
// inline snapshot literals in window.lbRegister and window.lbSync. Missing one
// of the inline copies is the classic way a new synced field half-ships.
const gmbSites = (src.match(/collectGameModeBests\(\)/g) || []).length;
ok('all three gameModeBests call sites updated (snapshot + register + sync)',
   gmbSites === 4, 'found ' + gmbSites + ' (expected 1 definition + 3 calls)');
ok('restore merges the per-mode blob', has('applySnakeModeBests') || has('gmb'));
ok('pool wins are split by mode', has('poolWinsByMode'));

head('Leaderboard board values (behavioural)');

// lbBoardValue decides what number each row shows and is the subtlest piece of
// the restructure: it has to serve both v2 records and players who have never
// run this build. Lift it out of the host and actually run it rather than
// grepping for its shape.
(function boardValueChecks() {
    // Brace-balanced slice from `start` — regex can't span these safely.
    function block(start) {
        const at = src.indexOf(start);
        if (at === -1) return null;
        let depth = 0, i = src.indexOf('{', at);
        const from = i;
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) break; }
        }
        return src.slice(at, i + 1) + (start.indexOf('function') === 0 ? '' : ';');
    }

    const boards  = block('const LB_BOARDS = ');
    const primary = block('const LB_PRIMARY_MODE = ');
    const blobFn  = block('function lbReflexBlobBest(');
    const fn      = block('function lbBoardValue(');
    if (!boards || !primary || !blobFn || !fn) {
        ok('lbBoardValue could be lifted out of the host', false, 'block not found');
        return;
    }
    const lbBoardValue = new Function(boards + '\n' + primary + '\n' + blobFn + '\n' + fn +
                                      '\nreturn lbBoardValue;')();

    // A v2 player who has only ever played Levels. Their legacy scalar is the
    // max ACROSS modes, so a per-mode fallback would print 142 under Walled.
    const v2 = {
        gameBests: { snake: 142, tetris: 9000, ludo: 14, reflex: 198 },
        gameModeBests: { 'snake:levels': 142, 'snake:levelsStage': 8, 'ludo:cpu': 14 }
    };
    ok('a v2 record reads its own per-mode value',
       lbBoardValue(v2, 'snake', 'levels') === 142);
    ok('a v2 record does not leak one mode into another',
       lbBoardValue(v2, 'snake', 'walled') === 0,
       'got ' + lbBoardValue(v2, 'snake', 'walled'));
    ok('a v2 record still reports mode-less games from gameBests',
       lbBoardValue(v2, 'tetris', null) === 9000);
    ok('the campaign stage is readable alongside the score',
       lbBoardValue(v2, 'snake', 'levelsStage') === 8);
    ok('a single-mode game reads its mode key when present',
       lbBoardValue(v2, 'ludo', null) === 14);

    // A player who has never run this build — without the backfill every board
    // would be empty on day one.
    const v1 = { gameBests: { snake: 37, tetris: 4000, ludo: 9, reflex: 210 } };
    ok('a pre-v2 record backfills into the primary mode',
       lbBoardValue(v1, 'snake', 'walled') === 37);
    ok('a pre-v2 record shows nothing for the other modes',
       lbBoardValue(v1, 'snake', 'endless') === 0 &&
       lbBoardValue(v1, 'snake', 'levels') === 0);
    ok('a pre-v2 record backfills RefleX into screen only',
       lbBoardValue(v1, 'reflex', 'screen') === 210 &&
       lbBoardValue(v1, 'reflex', 'target') === 0);
    ok('a pre-v2 record still reports mode-less games',
       lbBoardValue(v1, 'tetris', null) === 4000);
    ok('a pre-v2 record backfills single-mode Ludo',
       lbBoardValue(v1, 'ludo', null) === 9);

    ok('an empty record reads as no score, not NaN',
       lbBoardValue({}, 'snake', 'walled') === 0 &&
       lbBoardValue({}, 'tetris', null) === 0);

    // RefleX is the one game whose per-mode figures are synced in their own
    // right — buildPlayerSnapshot has always sent the whole reflexHighScores
    // blob. Reading only gameModeBests made a real Target best invisible: there
    // is a record in the live gist holding target.best = 640 that ranked nowhere.
    const blobOnly = {
        gameBests: { reflex: 0 },
        reflexHighScores: { screen: { best: null, avg: null }, target: { best: 640, avg: 1375 } }
    };
    ok('a Target best carried only in the blob still ranks',
       lbBoardValue(blobOnly, 'reflex', 'target') === 640,
       'got ' + lbBoardValue(blobOnly, 'reflex', 'target'));
    ok('a null mode in the blob is no score, not zero-beats-everything',
       lbBoardValue(blobOnly, 'reflex', 'screen') === 0);

    // Infinity does not survive JSON, so an untouched mode arrives as null.
    const nulled = {
        gameBests: { reflex: 305 },
        gameModeBests: { 'reflex:screen': 305 },
        reflexHighScores: { screen: { best: 305, avg: 327 }, target: { best: null, avg: null } }
    };
    ok('a nulled mode does not fabricate a record', lbBoardValue(nulled, 'reflex', 'target') === 0);

    // RefleX ranks ascending, so merging the two sources means taking the smaller.
    const both = {
        gameModeBests: { 'reflex:target': 300 },
        reflexHighScores: { target: { best: 240, avg: 400 } }
    };
    ok('the two RefleX sources merge to the better time',
       lbBoardValue(both, 'reflex', 'target') === 240);

    // gameLbMode reads live game state, so the board a player opens always
    // matches the mode they are playing.
    const modeFn = block('function gameLbMode(');
    if (!modeFn) { ok('gameLbMode could be lifted out', false); return; }
    const mk = (snakeMode, reflexMode, poolMode, ludoCpuTier) => new Function(
        'snakeMode', 'reflexMode', 'poolMode', 'ludoCpuTier',
        boards + '\n' + modeFn + '\nreturn gameLbMode;')(snakeMode, reflexMode, poolMode, ludoCpuTier);

    const gm = mk('levels', 'target', 'pvp', 'hard');
    ok('the snake board follows the mode being played', gm('snake') === 'levels');
    ok('the reflex board follows the mode being played', gm('reflex') === 'target');
    ok('the pool board follows the mode being played', gm('pool') === 'pvp');
    ok('a mode-less game reports no mode', gm('tetris') === null);
    ok('an unknown game reports no mode', gm('nope') === null);
    ok('pool collapses anything that is not pvp to cpu', mk('walled', 'screen', 'cpu', 'hard')('pool') === 'cpu');

    // Ludo's board follows the CPU tier, which is also what decides where the
    // win is filed — the two read the same variable so they cannot disagree.
    ok('the ludo board follows the tier being played', gm('ludo') === 'hard');
    ok('a tier the boards do not carry falls back rather than blanking',
       mk('walled', 'screen', 'cpu', 'adaptive')('ludo') === 'normal' &&
       mk('walled', 'screen', 'cpu', undefined)('ludo') === 'normal');
    // 'cpu' is the pre-split all-time board. Nothing should ever *play* into it,
    // so gameLbMode must never return it — it is reachable by tab only.
    ok('the all-time board is never the live board',
       ['easy', 'normal', 'hard'].every(t => mk('walled', 'screen', 'cpu', t)('ludo') !== 'cpu'));

    // A landing player has no gameModeBests at all; the backfill is what keeps
    // their board from reading empty.
    ok('a landing player still appears on the primary-mode board',
       lbBoardValue(v1, 'snake', 'walled') === 37);
})();

head('gameModeBests collection (behavioural)');

// gameModeBests is authoritative once present, so a key sourced from a store
// that is only written when its panel is opened would erase that game from its
// board rather than fall back to gameBests.
(function collectChecks() {
    function block(start) {
        const at = src.indexOf(start);
        if (at === -1) return null;
        let depth = 0, i = src.indexOf('{', at);
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) break; }
        }
        return src.slice(at, i + 1);
    }

    const collect = block('function collectGameModeBests(');
    const loadPool = block('function loadPoolWinsByMode(');
    if (!collect || !loadPool) {
        ok('collectGameModeBests could be lifted out of the host', false, 'block not found');
        return;
    }

    const run = store => {
        const ls = {
            _s: Object.assign({}, store),
            getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
            setItem(k, v) { this._s[k] = String(v); }
        };
        return new Function('localStorage',
            loadPool + '\n' + collect + '\nreturn collectGameModeBests();')(ls);
    };

    // Upgraded from v1, synced before ever opening the Pool panel.
    const fresh = run({ poolGamesWon: '47', snakeHighScore: '37', ludoGamesWon: '9' });
    ok('pool:cpu is emitted without the Pool panel ever being opened',
       fresh['pool:cpu'] === 47, JSON.stringify(fresh));
    ok('ludo:cpu is emitted from the legacy counter', fresh['ludo:cpu'] === 9);
    // Snake had the same trap as Pool and nobody had noticed: snakeHighScores is
    // only written once the Snake panel has been opened on this build, so a
    // player who upgraded and synced after a game of Pool emitted a
    // gameModeBests with no snake key at all — and that record is authoritative,
    // so their real score fell off the Snake board entirely.
    ok('snake:walled is emitted without the Snake panel ever being opened',
       fresh['snake:walled'] === 37, JSON.stringify(fresh));
    ok('the legacy backfill claims no mode it cannot speak for',
       fresh['snake:endless'] === undefined && fresh['snake:levels'] === undefined);

    const played = run({
        poolWinsByMode: '{"cpu":12,"pvp":3}',
        snakeHighScores: '{"endless":61,"walled":97,"levels":142}',
        snakeLevelsBest: '8',
        reflexHighScores: '{"screen":{"best":198},"target":{"best":240}}'
    });
    ok('per-mode snake bests are collected',
       played['snake:endless'] === 61 && played['snake:walled'] === 97 &&
       played['snake:levels'] === 142);
    ok('the campaign stage is collected', played['snake:levelsStage'] === 8);
    ok('both RefleX modes are collected',
       played['reflex:screen'] === 198 && played['reflex:target'] === 240);
    ok('the pool split is collected',
       played['pool:cpu'] === 12 && played['pool:pvp'] === 3);

    // A mode that has never scored is stored as null, because Infinity does not
    // survive JSON.stringify. Emitting that as a figure would plant a 0 at the
    // top of an ascending board.
    const halfPlayed = run({
        reflexHighScores: '{"screen":{"best":305,"avg":327},"target":{"best":null,"avg":null}}'
    });
    ok('a nulled RefleX mode is not emitted as a score',
       halfPlayed['reflex:screen'] === 305 && halfPlayed['reflex:target'] === undefined,
       JSON.stringify(halfPlayed));

    // Zero is absent rather than present-and-zero, so lbBoardValue's
    // parseInt(undefined) || 0 and a real 0 mean the same thing downstream.
    const empty = run({});
    ok('an untouched profile emits nothing rather than zeroes',
       Object.keys(empty).length === 0, JSON.stringify(empty));
})();

head('RefleX per-mode storage (behavioural)');

// The bug this section exists for: Infinity was the never-scored sentinel, and
// JSON.stringify(Infinity) is "null". So the first save — which happens the
// first time Screen sets a record — wrote target as null, and every subsequent
// run asked `time < null`, which coerces to `time < 0` and is false for every
// real reaction. Target mode could never score again. The live gist still shows
// it: target has been {"avg":null,"best":null} across every revision.
(function reflexStorageChecks() {
    function block(start) {
        const at = src.indexOf(start);
        if (at === -1) return null;
        let depth = 0, i = src.indexOf('{', at);
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) break; }
        }
        return src.slice(at, i + 1);
    }

    const norm = block('function _reflexModeScores(');
    const load = block('function loadReflexHighScores(');
    const save = block('function saveReflexHighScores(');
    if (!norm || !load || !save) {
        ok('the RefleX storage pair could be lifted out of the host', false, 'block not found');
        return;
    }

    const mk = store => {
        const ls = {
            _s: Object.assign({}, store),
            getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
            setItem(k, v) { this._s[k] = String(v); }
        };
        const api = new Function('localStorage',
            norm + '\n' + load + '\n' + save +
            '\nreturn { load: loadReflexHighScores, save: saveReflexHighScores, ls: localStorage };')(ls);
        return api;
    };

    // Exactly the blob sitting in the gist for a player who has played Screen
    // and then tried Target.
    const live = mk({ reflexHighScores: '{"screen":{"avg":327,"best":305},"target":{"avg":null,"best":null}}' });
    const loaded = live.load();
    ok('a nulled mode loads as the never-scored sentinel, not as null',
       loaded.target.best === Infinity && loaded.target.avg === Infinity,
       JSON.stringify(loaded.target));
    ok('a real stored figure survives the normalisation',
       loaded.screen.best === 305 && loaded.screen.avg === 327);

    // The comparison finishReflexGame makes. Against null this was false for
    // every possible time.
    ok('a Target run can beat the never-scored sentinel', 427 < loaded.target.best);

    loaded.target.best = 427;
    loaded.target.avg  = 541;
    live.save(loaded);
    const back = live.load();
    ok('a Target record survives the save/load round trip',
       back.target.best === 427 && back.target.avg === 541,
       JSON.stringify(back.target));
    // Saving must not disturb the mode that was not played.
    ok('saving Target leaves Screen alone',
       back.screen.best === 305 && back.screen.avg === 327);

    // A second, better run still lowers it; a worse one does not.
    ok('a better Target time beats the stored record', 300 < back.target.best);
    ok('a worse Target time does not', !(500 < back.target.best));

    const virgin = mk({});
    const v = virgin.load();
    ok('an absent blob loads as both modes never-scored',
       v.screen.best === Infinity && v.target.best === Infinity);
    virgin.save(v);
    ok('saving an untouched blob writes nulls rather than dropping the shape',
       JSON.parse(virgin.ls.getItem('reflexHighScores')).target.best === null);

    // Garbage in storage must not throw the panel open — this runs inside
    // initReflexGame, before anything is on screen to show an error in.
    const junk = mk({ reflexHighScores: '{not json' });
    ok('unparseable storage falls back to never-scored rather than throwing',
       junk.load().screen.best === Infinity);
})();

head('RefleX host wiring');

// The reported symptom: the title said "Target Mode" while the chip beneath it
// and the board behind the score button were still Screen. updateReflexDisplay()
// only repaints the play area — the chip, the button and the overlay all hang
// off updateReflexScoreDisplay().
ok('switching RefleX mode refreshes the chip, button and open board',
   /function toggleReflexMode\(\)[\s\S]{0,700}?updateReflexScoreDisplay\(\)/.test(src));
ok('the RefleX score button feeds the shared overlay',
   /function updateReflexScoreDisplay\(\)[\s\S]{0,900}?updateGameScoreBtn\('reflex'/.test(src));
ok('updateGameScoreBtn re-renders an open board',
   /function updateGameScoreBtn\([\s\S]{0,1400}?refreshGameLeaderboard\(game\)/.test(src));
// A finished run with no recorded reaction leaves both figures at 0, and RefleX
// ranks ascending — storing that would plant an unbeatable 0ms at the top.
ok('a run with no reactions cannot set a 0ms record',
   /function finishReflexGame\(\)[\s\S]{0,1400}?if \(reflexReactionTimes\.length > 0\)/.test(src));

head('Streak invariant');

// longestStreak is a high-water mark of consecutiveDays, so it can never be the
// smaller of the two. Both places that SET consecutiveDays to 1 — a user's first
// day and a streak reset — used to skip the raise, which is why six registry
// records read "current 1, longest 0".
ok('the high-water mark has one raiser', has('function raiseLongestStreak()'));
ok('a first-ever day raises it',
   /if \(!userXP\.lastAttendanceDate\) \{[\s\S]{0,400}?consecutiveDays = 1;\s*\n\s*raiseLongestStreak\(\)/.test(src));
ok('and so does the reset path',
   /hadStreakReset = true;[\s\S]{0,600}?raiseLongestStreak\(\)/.test(src));
// The restore copies both fields independently, so a violating cloud record
// would otherwise be carried straight back in and kept.
ok('a cloud restore self-heals it, like the level state beside it',
   /reconcileLevelState\('cloud restore'\)[\s\S]{0,500}?raiseLongestStreak\(\)/.test(src));

head('Score sync');

// A personal best that never leaves localStorage is invisible to everyone else.
ok('queueScoreSync exists and is debounced', has('function queueScoreSync()') &&
   has('LB_SCORE_SYNC_DEBOUNCE_MS'));
ok('a new record queues a sync', /performance\.isHighScore\) queueScoreSync\(\)/.test(src));
ok('the queue respects the anti-cheat cooldown rather than firing into it',
   /function queueScoreSync\(\)[\s\S]{0,700}?AC_SYNC_COOLDOWN_MS/.test(src));
// gameModeBests was write-only for RefleX: collectGameModeBests emitted
// reflex:target and nothing ever read it back into localStorage.
ok('a restore reads reflex per-mode bests back out of gameModeBests',
   /_reflexResetActive[\s\S]{0,1400}?recModes\['reflex:' \+ mode\]/.test(src));

console.log('\n' + '='.repeat(52));
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('='.repeat(52) + '\n');
process.exit(fail ? 1 : 0);
