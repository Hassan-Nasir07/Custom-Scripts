// pool-dev verification. `node pool-dev/pool-verify.js`
//
// Phase 0 of POOL_V2_PLAN.md: this suite pins TODAY's engine, bugs included, so
// that every later change to physics, rules or the CPU is a deliberate edit to an
// assertion rather than a silent drift. Assertions tagged "(problem N)" pin one of
// the numbered problems in the plan; they are expected to be rewritten when that
// problem is fixed, and the rewrite is the proof it was.
const fs   = require('fs');
const path = require('path');
const load = require('./load');
const { hostBlock, devBlock, trim, eolOf, OPEN, CLOSE, TARGET } = require('./reinsert');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));

const host = fs.readFileSync(TARGET, 'utf8');
const hostLF = host.replace(/\r\n/g, '\n');

// ── 1. Splice contract ────────────────────────────────────────────────
head('Splice contract');
ok('open sentinel appears exactly once', host.split(OPEN).length === 2);
ok('close sentinel appears exactly once', host.split(CLOSE).length === 2);
ok('userscript block is byte-identical to pool-dev/ (after EOL normalisation)',
   trim(hostBlock(host)) === trim(devBlock('\n')));
ok('userscript has one line ending throughout',
   eolOf(host) === '\n' ? host.indexOf('\r') === -1 : host.split('\r\n').length === host.split('\n').length);

const block = trim(hostBlock(host));
ok('shared Max modal helper stays in the host, outside the block',
   !/function toggleGameMaxModal\(/.test(block) && /function toggleGameMaxModal\(/.test(hostLF));
ok('prayerCount stays in the host (Prayer Counter owns it)',
   !/let prayerCount\b/.test(block) && /let prayerCount = 0;/.test(hostLF));
ok('pool storage helpers stay in the host (leaderboard + restore read them)',
   !/function loadPoolWinsByMode\(/.test(block) && /function loadPoolWinsByMode\(/.test(hostLF));
ok('pool frame-timing state moved into the block',
   /let poolLastFrameMs = 0;/.test(block) && hostLF.split('let poolLastFrameMs').length === 2);
ok('Breakout is no longer interleaved with Pool',
   !/breakout/i.test(block.replace(/\/\/.*$/gm, '')));

// ── 2. Host wiring (Phase 4/5 will change these on purpose) ───────────
head('Host wiring');
['handlePoolMouseDown', 'handlePoolMouseMove', 'handlePoolMouseUp',
 'handlePoolTouchStart', 'handlePoolTouchMove', 'handlePoolTouchEnd'].forEach(h => {
    ok('switchGame attaches and detaches ' + h,
       hostLF.includes("poolCanvas.addEventListener('" + h.replace('handlePool', '').replace(/^Mouse/, 'mouse').replace(/^Touch/, 'touch').toLowerCase() + "', " + h) &&
       hostLF.includes("poolCanvas.removeEventListener('" + h.replace('handlePool', '').replace(/^Mouse/, 'mouse').replace(/^Touch/, 'touch').toLowerCase() + "', " + h));
});
['startPoolGameBtn', 'resetPoolGameBtn', 'togglePoolModeBtn', 'togglePoolMaximizeBtn'].forEach(b =>
    ok('window.' + b + ' is exposed', hostLF.includes('window.' + b + ' = ')));
ok('switchGame closes the Max modal on leave', hostLF.includes('if (poolMaximized) togglePoolMaximize();'));
ok('switchGame initialises the game on enter', /case 'pool':[\s\S]{0,200}?initPoolGame\(\)/.test(hostLF));

// ── 3. Rack and geometry ──────────────────────────────────────────────
head('Rack and geometry');
{
    const P = load({ seed: 1 });
    P.initPoolGame();
    const balls = P.poolBalls;
    ok('16 balls', balls.length === 16);
    ok('ids 0–15, each once', balls.map(b => b.id).sort((a, b) => a - b).join() ===
       Array.from({ length: 16 }, (_, i) => i).join());
    ok('cue ball is first and sits on the head spot',
       balls[0].id === 0 && balls[0].x === P.POOL_W * 0.25 && balls[0].y === P.POOL_H / 2);
    // Rack order: rows 0..4, so index 1+4 = row 2 centre.
    ok('the 8 sits in the centre of the third row', balls[5].id === 8);
    const corners = [balls[11], balls[15]];
    ok('back corners are one solid and one stripe', corners[0].stripe !== corners[1].stripe);
    let minGap = Infinity;
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) {
        minGap = Math.min(minGap, Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y) - 2 * P.POOL_BALL_R);
    }
    ok('no two balls overlap in the rack', minGap >= 0, minGap.toFixed(3));
    ok('every ball is inside the cushions', balls.every(b =>
        b.x - b.r >= P.POOL_CUSHION_X1 && b.x + b.r <= P.POOL_CUSHION_X2 &&
        b.y - b.r >= P.POOL_CUSHION_Y1 && b.y + b.r <= P.POOL_CUSHION_Y2));
    ok('6 pockets', P.poolPockets.length === 6);
    ok('a new frame starts with ball in hand in the kitchen',
       P.poolPlacingBall && P.poolBallInHand && P.poolIsBreakShot && P.poolTurn === 1);
    const seeded = n => { const Q = load({ seed: n }); Q.initPoolGame(); return Q.poolBalls.map(b => b.id).join(); };
    ok('the rack is reproducible under a seed', seeded(42) === seeded(42));
    ok('different seeds give different racks', seeded(42) !== seeded(43));

    // Side-pocket window: the nearest a ball centre can reach is the cushion line,
    // 9 px from the side pocket centre, against an 11 px capture radius.
    const side = P.poolPockets[1];
    const reach = (P.POOL_CUSHION_Y1 + P.POOL_BALL_R) - side.y;
    const halfWindow = Math.sqrt(P.POOL_POCKET_R ** 2 - reach ** 2);
    ok('side pocket accepts only about ±6.3 px along the rail (problem 4)',
       Math.abs(halfWindow - 6.32) < 0.05, halfWindow.toFixed(2));
}

// ── 4. Physics ────────────────────────────────────────────────────────
head('Physics');
function settle(P, cap) {
    let f = 0;
    while (!P.poolAllStopped() && f < (cap || 5000)) { P.poolPhysicsUpdate(); f++; }
    return f;
}
function breakShot(seed) {
    const P = load({ seed });
    P.initPoolGame();
    P.poolPlacingBall = false; P.poolBallInHand = false;
    P.poolFireShot(P.poolBalls[0], 0, P.POOL_CUE_MAX_POWER);
    return { P, frames: settle(P) };
}
{
    const runs = [1, 2, 3, 4, 5, 6, 7, 8].map(breakShot);
    ok('a full-power break always settles', runs.every(r => r.frames < 5000),
       runs.map(r => r.frames).join(','));
    ok('breaks settle in a plausible time (< 12 s at 60 Hz)', runs.every(r => r.frames < 720));
    ok('no NaN anywhere after a break', runs.every(r => r.P.poolBalls.every(b =>
        [b.x, b.y, b.vx, b.vy].every(Number.isFinite))));
    let worst = 0;
    runs.forEach(({ P }) => {
        const live = P.poolBalls.filter(b => !b.pocketed);
        for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
            worst = Math.max(worst, 2 * P.POOL_BALL_R - Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y));
        }
    });
    ok('balls at rest overlap by under 0.5 px', worst < 0.5, worst.toFixed(3));
    ok('balls at rest are inside the cushions', runs.every(({ P }) => P.poolBalls.filter(b => !b.pocketed).every(b =>
        b.x - b.r >= P.POOL_CUSHION_X1 - 1e-6 && b.x + b.r <= P.POOL_CUSHION_X2 + 1e-6 &&
        b.y - b.r >= P.POOL_CUSHION_Y1 - 1e-6 && b.y + b.r <= P.POOL_CUSHION_Y2 + 1e-6)));
    const a = breakShot(9), b = breakShot(9);
    ok('the same seed and shot give the same outcome',
       JSON.stringify(a.P.poolBalls.map(x => [x.x, x.y, x.pocketed])) ===
       JSON.stringify(b.P.poolBalls.map(x => [x.x, x.y, x.pocketed])));

    // Friction: one ball on an empty table, no spin.
    const P = load({ seed: 1 });
    P.initPoolGame();
    P.poolBalls = [P.poolBalls[0]];
    Object.assign(P.poolBalls[0], { x: 60, y: P.POOL_H / 2, vx: 0, vy: 0 });
    P.poolFireShot(P.poolBalls[0], 0, 8);
    const speeds = [];
    for (let i = 0; i < 30; i++) { P.poolPhysicsUpdate(); speeds.push(Math.hypot(P.poolBalls[0].vx, P.poolBalls[0].vy)); }
    const ratio = speeds[20] / speeds[19];
    ok('friction is a constant per-frame ratio of 0.985, not a constant deceleration (problem 1)',
       Math.abs(ratio - P.POOL_FRICTION) < 1e-9, ratio);

    // Per-axis stop snap: a nearly axis-aligned ball loses its small component early.
    const Q = load({ seed: 1 });
    Q.initPoolGame();
    Q.poolBalls = [Q.poolBalls[0]];
    Object.assign(Q.poolBalls[0], { x: 60, y: Q.POOL_H / 2, vx: 6, vy: 0.07 });
    Q.poolPhysicsUpdate();
    ok('a small velocity component is zeroed independently of the other (problem 2)',
       Q.poolBalls[0].vy === 0 && Q.poolBalls[0].vx > 5);

    // Pots are credited to the shot that made them.
    const R = load({ seed: 1 });
    R.initPoolGame();
    const eight = R.poolBalls.find(x => x.id === 8);
    R.poolBalls = [R.poolBalls[0], eight];
    Object.assign(R.poolBalls[0], { x: 100, y: 40, vx: 0, vy: 0 });
    const pk = R.poolPockets[2];                                  // top-right corner
    Object.assign(eight, { x: pk.x - 30, y: pk.y + 15 });
    const dirX = pk.x - eight.x, dirY = pk.y - eight.y, dl = Math.hypot(dirX, dirY);
    const gx = eight.x - dirX / dl * 2 * R.POOL_BALL_R, gy = eight.y - dirY / dl * 2 * R.POOL_BALL_R;
    R.poolFireShot(R.poolBalls[0], Math.atan2(gy - 40, gx - 100), 10);
    settle(R);
    ok('a straight-in shot pots the object ball and records it on the shot',
       eight.pocketed && R.poolPocketedThisShot.includes(8), JSON.stringify(R.poolPocketedThisShot));
    ok('the first ball hit is recorded', R.poolFirstBallHit === 8);
}

// ── 5. Rules (poolProcessTurnResult) ──────────────────────────────────
head('Rules');
// Builds a table in the middle of a frame, then feeds poolProcessTurnResult a
// hand-written shot log. Nothing moves; this is the judge on its own.
function frame(o) {
    const P = load({ seed: 3, prefs: o.prefs });
    P.initPoolGame();
    P.poolPlacingBall = false; P.poolBallInHand = false; P.poolIsBreakShot = false;
    P.poolMode = o.mode || 'cpu';
    P.poolTurn = o.turn || 1;
    if (o.groups) {
        P.poolFirstPocket = true;
        P.poolPlayer1Group = o.groups[0];
        P.poolPlayer2Group = o.groups[1];
    }
    const sunk = (ids, into) => ids.forEach(id => { P.poolBalls.find(b => b.id === id).pocketed = true; into.push(id); });
    if (o.p1Down) sunk(o.p1Down, P.poolPlayer1Pocketed);
    if (o.p2Down) sunk(o.p2Down, P.poolPlayer2Pocketed);
    P.poolShotFired = true;
    P.poolFirstBallHit = o.first === undefined ? -1 : o.first;
    P.poolCushionAfterHit = !!o.rail;
    P.poolPocketedThisShot = (o.pots || []).slice();
    (o.pots || []).forEach(id => { P.poolBalls.find(b => b.id === id).pocketed = true; });
    P.poolProcessTurnResult();
    return P;
}
const SOLIDS_BUT_ONE = [1, 2, 3, 4, 5, 6];
const ALL_SOLIDS = [1, 2, 3, 4, 5, 6, 7];
const cases = [
    ['scratch → opponent has ball in hand', { first: 3, rail: true, pots: [0] },
        P => P.poolTurn === 2 && P.poolBallInHand && P.poolFoulMessage === 'Scratch! Ball in hand' && !P.poolBalls[0].pocketed],
    ['no ball contacted → foul', { first: -1 },
        P => P.poolTurn === 2 && P.poolBallInHand && P.poolFoulMessage === 'Foul! No ball contacted'],
    ['open table: any first contact is legal', { first: 12, rail: true },
        P => P.poolFoulMessage === '' && P.poolTurn === 2 && !P.poolBallInHand],
    ['wrong group first → foul', { groups: ['solids', 'stripes'], first: 12, rail: true },
        P => P.poolFoulMessage === "Foul! Hit opponent's ball first" && P.poolTurn === 2 && P.poolBallInHand],
    ['8 first before clearing the group → foul', { groups: ['solids', 'stripes'], first: 8, rail: true },
        P => P.poolFoulMessage === 'Foul! Hit 8-ball before clearing your group'],
    ['no rail after contact and no pot → foul', { groups: ['solids', 'stripes'], first: 3 },
        P => P.poolFoulMessage === 'Foul! No rail after contact' && P.poolTurn === 2],
    ['legal miss → turn passes, no ball in hand', { groups: ['solids', 'stripes'], first: 3, rail: true },
        P => P.poolFoulMessage === '' && P.poolTurn === 2 && !P.poolBallInHand],
    ['legal pot → same player continues', { groups: ['solids', 'stripes'], first: 3, pots: [3] },
        P => P.poolTurn === 1 && P.poolPlayer1Pocketed.includes(3)],
    ['open table first pot assigns groups to the shooter', { first: 11, rail: true, pots: [11] },
        P => P.poolPlayer1Group === 'stripes' && P.poolPlayer2Group === 'solids' && P.poolTurn === 1],
    ['open table pot by seat 2 assigns seat 2 its group', { turn: 2, first: 4, pots: [4] },
        P => P.poolPlayer2Group === 'solids' && P.poolPlayer1Group === 'stripes' && P.poolTurn === 2],
    ["potting only the opponent's ball ends the turn and credits them",
        { groups: ['solids', 'stripes'], first: 3, pots: [12] },
        P => P.poolTurn === 2 && P.poolPlayer2Pocketed.includes(12) && !P.poolBallInHand],
    ['a ball potted on a foul stays down and is credited to its owner',
        { groups: ['solids', 'stripes'], first: 12, pots: [3] },
        P => P.poolTurn === 2 && P.poolBallInHand && P.poolPlayer1Pocketed.includes(3)],
    ['on the 8: must hit the 8 first', { groups: ['solids', 'stripes'], p1Down: ALL_SOLIDS, first: 12, rail: true },
        P => P.poolFoulMessage === 'Foul! Must hit 8-ball first' && P.poolTurn === 2],
    ['8 on the open table loses', { first: 8, pots: [8] },
        P => P.poolGameOver && P.poolWinner === 2],
    ['8 before clearing the group loses', { groups: ['solids', 'stripes'], p1Down: SOLIDS_BUT_ONE, first: 7, pots: [8] },
        P => P.poolGameOver && P.poolWinner === 2 && /too early/.test(P.poolFoulMessage)],
    ['8 with a scratch loses even when on the 8', { groups: ['solids', 'stripes'], p1Down: ALL_SOLIDS, first: 8, pots: [8, 0] },
        P => P.poolGameOver && P.poolWinner === 2 && /Scratch on 8-ball/.test(P.poolFoulMessage)],
    ['8 without hitting it first loses', { groups: ['solids', 'stripes'], p1Down: ALL_SOLIDS, first: 12, pots: [8] },
        P => P.poolGameOver && P.poolWinner === 2],
    ['legal 8 wins', { groups: ['solids', 'stripes'], p1Down: ALL_SOLIDS, first: 8, pots: [8] },
        P => P.poolGameOver && P.poolWinner === 1 && P.poolFoulMessage === ''],
    ['legal 8 by seat 2 wins for seat 2', { turn: 2, groups: ['solids', 'stripes'], p2Down: [9, 10, 11, 12, 13, 14, 15], first: 8, pots: [8] },
        P => P.poolGameOver && P.poolWinner === 2],
    ['foul messages are seat-blind: the CPU scratching on the 8 reads "You lose" (problem 7)',
        { turn: 2, groups: ['solids', 'stripes'], p2Down: [9, 10, 11, 12, 13, 14, 15], first: 8, pots: [8, 0] },
        P => P.poolWinner === 1 && P.poolFoulMessage === 'Scratch on 8-ball! You lose'],
    ['the break does not require four rails (problem 6)', { first: 1, rail: false, pots: [] },
        P => P.poolFoulMessage === 'Foul! No rail after contact'],
];
cases.forEach(([name, o, check]) => {
    let P, err;
    try { P = frame(o); } catch (e) { err = e; }
    ok(name, !err && check(P), err ? err.message : (P && JSON.stringify({
        turn: P.poolTurn, bih: P.poolBallInHand, foul: P.poolFoulMessage, win: P.poolWinner,
        g1: P.poolPlayer1Group, g2: P.poolPlayer2Group })));
});

{
    const P = frame({ groups: ['solids', 'stripes'], first: 3, pots: [3, 5] });
    ok('legal pots pay 5 XP each to the human', P.host.userXP.totalXP === 10, P.host.userXP.totalXP);
    const Q = frame({ mode: 'cpu', turn: 2, groups: ['solids', 'stripes'], first: 12, pots: [12] });
    ok('the CPU earns no pot XP', Q.host.userXP.totalXP === 0);
    const R = frame({ mode: 'pvp', turn: 2, groups: ['solids', 'stripes'], first: 12, pots: [12, 13] });
    ok('PvP pays pot XP to seat 2 as well (problem 8)', R.host.userXP.totalXP === 10);
    const S = frame({ mode: 'cpu', groups: ['solids', 'stripes'], first: 3, rail: true });
    ok('handing the turn to the CPU schedules a 1.5–2.5 s think', S.poolAIDelay >= 90 && S.poolAIDelay < 150, S.poolAIDelay);
}

// ── 6. Frame end, records and the anti-farm guard ─────────────────────
head('Frame end and progression');
{
    const P = frame({ groups: ['solids', 'stripes'], p1Down: ALL_SOLIDS, first: 8, pots: [8] });
    ok('a CPU win counts toward poolGamesWon', P.store.poolGamesWon === '1');
    ok('and toward the cpu bucket of poolWinsByMode', JSON.parse(P.store.poolWinsByMode).cpu === 1);
    ok('the W/L record moves', JSON.parse(P.store.poolRecord).p1Wins === 1 && JSON.parse(P.store.poolRecord).p2Losses === 1);
    ok('awardGameXP is called once with won:true',
       P.log.xp.length === 1 && P.log.xp[0].type === 'pool' && P.log.xp[0].perf.won === true);
    P.startPoolGame();
    ok('Play after a finished frame re-racks instead of re-awarding (anti-farm)',
       P.log.xp.length === 1 && !P.poolGameOver && P.poolBalls.every(b => !b.pocketed));

    const L = frame({ groups: ['solids', 'stripes'], p1Down: SOLIDS_BUT_ONE, first: 7, pots: [8] });
    ok('a loss records p1Losses and pays the consolation award',
       JSON.parse(L.store.poolRecord).p1Losses === 1 && L.log.xp[0].perf.won === false && !L.store.poolGamesWon);

    const V = frame({ mode: 'pvp', groups: ['solids', 'stripes'], p1Down: ALL_SOLIDS, first: 8, pots: [8] });
    ok('a hot-seat win by seat 1 is filed under pvp', JSON.parse(V.store.poolWinsByMode).pvp === 1);
    ok('and still pays won:true XP', V.log.xp[0].perf.won === true);

    const T = load({ seed: 1 });
    T.initPoolGame();
    T.togglePoolMode();
    ok('togglePoolMode flips cpu → pvp and re-racks', T.poolMode === 'pvp' && T.poolPlacingBall);
    T.togglePoolMaximize();
    ok('Max delegates to the shared helper with the 2x buffer config',
       T.log.maxModal.length === 1 && T.log.maxModal[0].bufferW === T.POOL_W && T.log.maxModal[0].bufferH === T.POOL_CANVAS_H);
}

// ── 7. CPU ────────────────────────────────────────────────────────────
head('CPU');
{
    let finite = true, inRange = true, placedOk = true;
    for (let seed = 1; seed <= 12; seed++) {
        const P = load({ seed });
        P.initPoolGame();
        P.poolPlacingBall = false; P.poolBallInHand = false; P.poolIsBreakShot = false;
        P.poolFireShot(P.poolBalls[0], 0, P.POOL_CUE_MAX_POWER);
        settle(P);
        P.poolBalls[0].pocketed = false;
        P.poolTurn = 2; P.poolShotFired = false;
        P.poolAITakeShot(true);
        const s = P.poolAIPendingShot;
        if (!s || !Number.isFinite(s.angle) || !Number.isFinite(s.power)) finite = false;
        else if (s.power < 3.5 || s.power > P.POOL_CUE_MAX_POWER) inRange = false;

        P.poolPlacingBall = true; P.poolBallInHand = true;
        P.poolAIPlaceBall();
        const c = P.poolBalls[0];
        const clear = P.poolBalls.every(b => b.id === 0 || b.pocketed || Math.hypot(b.x - c.x, b.y - c.y) >= 2 * P.POOL_BALL_R);
        if (!clear || P.poolPlacingBall || c.x < P.POOL_CUSHION_X1 || c.x > P.POOL_CUSHION_X2) placedOk = false;
    }
    ok('the CPU always produces a finite shot', finite);
    ok('CPU power stays in [3.5, max]', inRange);
    ok('ball-in-hand placement never overlaps a ball and clears the flag', placedOk);

    const P = load({ seed: 5 });
    P.initPoolGame();
    P.poolPlacingBall = false; P.poolBallInHand = false; P.poolIsBreakShot = false;
    const t = P.poolBalls.find(b => b.id === 3);
    P.poolBalls = [P.poolBalls[0], t];
    Object.assign(P.poolBalls[0], { x: 120, y: 92 });
    Object.assign(t, { x: 200, y: 92 });
    P.poolTurn = 2; P.poolPlayer2Group = 'solids'; P.poolFirstPocket = true;
    P.poolAITakeShot(false);
    settle(P);
    ok('the CPU pots a simple open ball', t.pocketed);
    ok('the CPU trial sim models only the cue and target ball (problem 5)',
       /function poolTrialSim\(cueX, cueY, targetX, targetY, pocketX, pocketY, angle, power\)/.test(block) &&
       !/poolTrialSim[\s\S]{0,4000}?poolBalls\b/.test(block.slice(block.indexOf('function poolTrialSim'), block.indexOf('function poolAIRefineAngle'))));
}

// ── 8. Render smoke ───────────────────────────────────────────────────
head('Render smoke');
{
    const states = {
        'rack, placing the cue ball': P => {},
        'aiming': P => { P.poolPlacingBall = false; P.poolGameRunning = true; P.poolMouseX = 300; P.poolMouseY = 180; },
        'dragging for power': P => { P.poolPlacingBall = false; P.poolGameRunning = true; P.poolDragging = true; P.poolAimLocked = true; P.poolCuePower = 12; },
        'CPU aiming': P => { P.poolPlacingBall = false; P.poolTurn = 2; P.poolAIPendingShot = { angle: 0.3, power: 10, spinX: 0, spinY: 0 }; },
        'foul message': P => { P.poolFoulMessage = 'Scratch! Ball in hand'; },
        'groups and trays': P => { P.poolFirstPocket = true; P.poolPlayer1Group = 'solids'; P.poolPlayer2Group = 'stripes'; P.poolPlayer1Pocketed = [1, 2]; P.poolPlayer2Pocketed = [9]; },
        'game over': P => { P.poolGameOver = true; P.poolWinner = 2; },
        'Max modal (2x buffer)': P => { P.canvas.width = 736; P.canvas.height = 736; },
    };
    Object.entries(states).forEach(([name, set]) => {
        let err = null;
        try { const P = load({ seed: 2 }); P.initPoolGame(); set(P); P.drawPoolFrame(); } catch (e) { err = e; }
        ok('drawPoolFrame: ' + name, !err, err && err.message);
    });
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
