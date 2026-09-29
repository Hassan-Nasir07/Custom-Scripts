// pool-dev verification: the v2 splice and the match. `node pool-dev/pool-verify.js`
//
// Phase 5 of POOL_V2_PLAN.md put the v2 engine into the userscript. This suite
// checks the contract between pool-dev/ and the host:
//   1  both spliced blocks are byte-identical to pool-dev/, in splice order
//   2  nothing of v1 is left, and the block cannot collide with the host's names
//   3  the host calls pool the way pool-game.js expects, and nothing else
//   4  the match, headless: frames, turns, the shot clock, ball in hand, XP,
//      records and the one-award-per-rack guard (pool-game.js on a stubbed host)
//   5  the stand-in CPU (pool-ai.js): it plans real pots, places legally and
//      keeps its thinking inside the frame budget
// The DOM half of pool-game.js (the panel, input, Max, theme) needs a browser:
// host-run.js drives the real userscript in Chrome.
const fs   = require('fs');
const vm   = require('vm');
const L    = require('./load');
const { BLOCKS, hostBlock, devBlock, templateProblem, trim, eolOf, TARGET, FILES } = require('./reinsert');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));

const host = fs.readFileSync(TARGET, 'utf8');
const src = host.replace(/\r\n/g, '\n');
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

// ── 1. Splice contract ────────────────────────────────────────────────
head('Splice contract');
BLOCKS.forEach(b => {
    ok(b.name + ': sentinels appear exactly once each', host.split(b.open).length === 2 && host.split(b.close).length === 2);
    ok(b.name + ': the userscript copy is byte-identical to pool-dev/', trim(hostBlock(host, b)) === trim(devBlock(b, '\n')));
});
ok('the engine is spliced in dependency order', FILES.join() === 'pool-physics.js,pool-rules.js,pool-camera.js,pool-render.js,pool-hud.js,pool-ai.js,pool-game.js');
ok('userscript has one line ending throughout', eolOf(host) === '\n' ? host.indexOf('\r') === -1 : host.split('\r\n').length === host.split('\n').length);
ok('the theme CSS is safe inside the template literal', templateProblem(devBlock(BLOCKS[1], '\n')) === null);
ok('the pool theme follows the Cyberpunk theme, as pool-table.html loads them',
   src.indexOf('/* ═══ END CYBERPUNK HUD THEME ═══ */') < src.indexOf(BLOCKS[1].open) && src.indexOf(BLOCKS[1].open) < src.indexOf('/* ═══ END POOL THEME ═══ */'));
const block = trim(hostBlock(host, BLOCKS[0]));
ok('shared Max modal helper stays in the host', !/function toggleGameMaxModal\(/.test(block) && /function toggleGameMaxModal\(/.test(src));
ok('pool storage helpers stay in the host (leaderboard + restore read them)', !/function loadPoolWinsByMode\(/.test(block) && /function loadPoolWinsByMode\(/.test(src));
ok('prayerCount stays in the host (Prayer Counter owns it)', !/let prayerCount\b/.test(block) && /let prayerCount = 0;/.test(src));

// ── 2. v1 is gone, and the block is safe in the host's scope ──────────
head('v1 removed, scope safe');
const V1 = ['drawPoolFrame', 'handlePoolMouseDown', 'handlePoolTouchStart', 'poolAnimFrame', 'poolGameRunning', 'startPoolGame',
    'poolFireShot', 'poolAITakeShot', 'poolPhysicsUpdate', 'poolBalls', 'POOL_W', 'POOL_CANVAS_H', 'poolPlayer1Pocketed', 'togglePoolModeBtn', 'startPoolGameBtn'];
const code = noComments(src);
V1.forEach(n => ok('no v1 "' + n + '" left in the code', !new RegExp('\\b' + n + '\\b').test(code)));
ok('the old square #pool-canvas and its CSS are gone', !/id="pool-canvas"/.test(src) && !/#pool-canvas\s*\{/.test(src));
let parsed = null;
try { new vm.Script(src, { filename: 'AttendanceTimeCheckerPlus.js' }); } catch (e) { parsed = e.message; }
ok('the whole userscript parses (a duplicated top-level name would be a SyntaxError)', parsed === null, parsed);
{
    const decl = s => { const out = new Map(); for (const m of s.matchAll(/^    (?:async\s+)?(?:function\s+([\w$]+)|(?:let|const|var|class)\s+([\w$]+))/gm)) { const n = m[1] || m[2]; out.set(n, (out.get(n) || 0) + 1); } return out; };
    const all = decl(src), mine = decl(block);
    const dup = [...mine.keys()].filter(n => all.get(n) > 1);
    ok('every top-level name in the engine block is declared once in the userscript', !dup.length, dup.join(', '));
}

// ── 3. Host wiring ────────────────────────────────────────────────────
head('Host wiring');
ok('switchGame enters through initPoolGame()', /case 'pool':\n\s+if \(poolCv\) poolCv\.style\.display = 'block';[\s\S]{0,160}?initPoolGame\(\);\n\s+break;/.test(src));
ok('switchGame leaves through poolDetach()', /case 'pool':[\s\S]{0,200}?poolDetach\(\);\n\s+break;/.test(src));
ok('the panel element is #pool-root, shown and hidden with the canvases', src.includes("const poolCv = document.getElementById('pool-root');") && /<div id="pool-root" class="pool-root" style="display:none;"><\/div>/.test(src));
ok('the header keeps the title and the wins button only', /<div id="pool-scoreboard" class="snake-scoreboard" style="display: none;">\n\s+<button id="pool-lb-btn"/.test(src) && !src.includes('pool-turn-label'));
ok('there is no Play button, and no controls row is shown', /<div id="pool-controls" class="snake-controls" style="display: none;"><\/div>/.test(src) &&
   !/getElementById\('pool-controls'\); if \(c\) c\.style\.display = 'flex'/.test(src));
ok('Escape no longer resets a pool frame', !/case 'pool': resetPoolGame\(\); break;/.test(src));
ok('the bridges only the old buttons used are gone', !/window\.(startPoolGameBtn|resetPoolGameBtn|togglePoolModeBtn|togglePoolMaximizeBtn) =/.test(src));
ok('userPreferences defaults poolCamera, poolLean and poolShotCam',
   /poolCamera: '3d',/.test(src) && /poolLean: 35,/.test(src) && /poolShotCam: 'overhead',/.test(src));
ok('⚙️ offers the shot camera: Overhead or Stay 3D', /data-pref="poolShotCam"[\s\S]{0,300}?value="overhead"[\s\S]{0,300}?value="3d"/.test(src));
ok('applyPreferences tells pool the theme changed', /applyGameMode\(\);\n[^\n]*\n\s+if \(typeof poolOnThemeChange === 'function'\) poolOnThemeChange\(\);\n    \}/.test(src));
{
    const m = /function toggleGameMaxModal\(cfg\) \{[\s\S]*?\n    \}\n/.exec(src);
    const fn = m ? m[0] : '';
    ok('toggleGameMaxModal: a cfg.build branch that hands the game an empty panel', /if \(!openState && cfg\.build\) \{[\s\S]*?cfg\.build\(panel\);[\s\S]*?return true;\n        \}/.test(fn));
    ok('toggleGameMaxModal: the build branch never moves a canvas', !/cfg\.build\) \{[\s\S]*?(canvas\.width|placeholder\.style)[\s\S]*?return true;\n        \}\n\n        if \(!openState\) \{/.test(fn));
    ok('toggleGameMaxModal: closing runs cfg.unbuild', /if \(openState\.unbuild\) openState\.unbuild\(\);/.test(fn));
    ok('toggleGameMaxModal: Ludo\'s canvas path is still there', /canvas\.width = cfg\.bufferW \* k;/.test(fn));
}
ok('togglePoolMaximize uses the build hook on #pool-root', /canvasId: 'pool-root',[\s\S]{0,200}?build: poolBuildMax,[\s\S]{0,60}?unbuild: poolUnbuildMax/.test(block));
ok('the leaderboard still reads poolMode, now declared by pool-game.js', /let poolMode = 'cpu';/.test(block) && /return poolMode === 'pvp' \? 'pvp' : 'cpu';/.test(src));
ok('the achievement check still finds poolGamesWon', /let poolGamesWon = 0;/.test(block) && /typeof poolGamesWon === 'number' && poolGamesWon >= 100/.test(src));

// ── 4. The match, headless ────────────────────────────────────────────
head('The match (pool-game.js)');
// Seat 1 plays planner shots through the same strike path the input uses;
// seat 2 is whatever the controller does (its CPU, or a scripted second human in pvp).
function human(P, S) {
    if (S.phase === 'bih') { const p = P.paPlace(S.world, S.frame, S.rng); P.prPlaceCue(S.world, p[0], p[1]); S.placed = true; S.phase = 'aim'; }
    if (S.phase === 'aim') {
        const job = P.paPlan(S.world, S.frame, { rng: S.rng }); job.step();
        S.called = job.shot.call; S.shot = job.shot; S.phase = 'strike'; S.strikeT = 0;
    }
}
function playFrame(P, maxTicks) {
    const S = P.poolS;
    let n = 0;
    while (S.phase !== 'over' && n++ < (maxTicks || 60000)) {
        if (S.handoff) P.poolOn.ready();
        if (S.frame.turn === 1 || P.poolMode === 'pvp') human(P, S);
        P.poolTick(16);
    }
    return S;
}
{
    const P = L.game({ seed: 11 });
    const S = P.poolS;
    P.poolNewFrame(1);
    ok('a new frame racks 16 balls with ball in hand in the kitchen', S.world.balls.length === 16 && S.phase === 'bih' && S.frame.ballInHand === 'kitchen');
    ok('the cue ball starts inside the kitchen, off the head string', S.world.balls[0].x === S.world.table.headX - 80);
    ok('seat 1 is "You" without a leaderboard name; the CPU is seat 2', P.poolNames()[1] === 'You' && P.poolNames()[2] === 'CPU');
    const named = L.game({ name: 'Ayesha Khan the Magnificent' });
    ok('a registered name is used, clipped to 16 characters', named.poolNames()[1] === 'Ayesha Khan the ');

    // Ball in hand pauses the clock; aiming runs it; the hand-off holds it.
    S.clockLeft = 30;
    for (let i = 0; i < 60; i++) P.poolTick(50);
    ok('the shot clock waits while the ball is in hand', S.clockLeft === 30);
    P.prPlaceCue(S.world, S.world.table.headX - 60, 0); S.placed = true; S.phase = 'aim';
    for (let i = 0; i < 20; i++) P.poolTick(50);
    ok('the shot clock runs while you aim', Math.abs(S.clockLeft - 29) < 1e-9, S.clockLeft);
    P.poolOn.replace();
    ok('Move cue ball goes back to placing', S.phase === 'bih' && !S.placed);
    const held = S.clockLeft;
    for (let i = 0; i < 40; i++) P.poolTick(50);
    ok('…and the clock holds there, not reset and not running', S.clockLeft === held);
    S.placed = true; S.phase = 'aim';
    S.clockLeft = 0.01;
    P.poolTick(16);
    ok('out of time on the break: the break passes to the CPU, from the kitchen',
       S.frame.turn === 2 && S.phase === 'bih' && S.frame.ballInHand === 'kitchen' && S.toast && /Out of time/.test(S.toast.title));

    // The CPU's turn, left entirely to the controller.
    let t = 0, struck = false, clockMoved = false, humanCould = false;
    const cpuClock = S.clockLeft;
    while (t++ < 4000 && !struck) {
        P.poolTick(16);
        if (S.phase === 'moving') struck = true;
        else { if (S.clockLeft !== cpuClock) clockMoved = true; if (P.poolCanAct()) humanCould = true; }
    }
    ok('the CPU places the cue ball and breaks by itself', struck && S.world.balls[0].x <= S.world.table.headX, t + ' ticks');
    ok('the shot clock never runs on the CPU\'s turn', !clockMoved);
    ok('no human input is taken on the CPU\'s turn', !humanCould);
}
{
    // Whole frames against the CPU: one award each, filed where it belongs.
    let wins = 0, losses = 0, awards = 0, bad = 0, dialogBad = 0;
    for (let k = 0; k < 6; k++) {
        const P = L.game({ seed: 100 + k });
        P.poolNewFrame(1 + (k % 2));
        const S = playFrame(P);
        if (S.phase !== 'over') { bad++; continue; }
        const r = JSON.parse(P.store.poolRecord), w = S.result.win;
        awards += P.log.xp.length;
        if (w) wins++; else losses++;
        if (P.log.xp.length !== 1 || P.log.xp[0].perf.won !== w) bad++;
        if (w && (P.store.poolGamesWon !== '1' || JSON.parse(P.store.poolWinsByMode).cpu !== 1 || r.p1Wins !== 1)) bad++;
        if (!w && (P.store.poolGamesWon || '0') !== '0' && P.store.poolGamesWon !== undefined) bad++;
        if (!w && r.p2Wins !== 1) bad++;
        const seat = w ? 1 : 2;
        if (S.frames[seat - 1] !== 1 || S.frames[2 - seat] !== 0) dialogBad++;
        if (S.result.title !== (w ? 'You win' : 'CPU wins') || S.result.delta !== (w ? '+1 WIN' : '+1 LOSS')) dialogBad++;
        // The same rack cannot pay twice, however it is asked to.
        P.poolEndFrame({ winner: 1 }); P.poolEndFrame({ winner: 2 });
        if (P.log.xp.length !== 1) bad++;
    }
    ok('6 frames vs the CPU all finish, each paying exactly once and filed by result', bad === 0, 'wins ' + wins + ', losses ' + losses + ', awards ' + awards + ', bad ' + bad);
    ok('the frame count and the frame-over dialog follow the winner', dialogBad === 0, dialogBad);
}
{
    const P = L.game({ seed: 5 });
    const S = P.poolS;
    P.poolNewFrame(1);
    const before = S.rackId;
    P.resetPoolGame();
    ok('Reset mid-frame racks again and pays nothing', S.rackId === before + 1 && P.log.xp.length === 0);
    P.poolEndFrame({ winner: 1 });
    P.poolOn.primary();
    ok('NEW FRAME is a new rack, and the breaker alternates', S.rackId === before + 2 && S.frame.breaker === 2);
    P.poolEndFrame({ winner: 1 });
    ok('…so the next win pays again', P.log.xp.length === 2);
    P.togglePoolMode();
    ok('switching mode racks again, clears the frame count and updates the wins button',
       P.poolMode === 'pvp' && S.frames.join() === '0,0' && P.log.scoreBtn.length > 0 && P.log.scoreBtn[P.log.scoreBtn.length - 1].game === 'pool');
    ok('2 Players names the seats Player 1 / Player 2', P.poolNames()[1] === 'Player 1' && P.poolNames()[2] === 'Player 2');
}
{
    // Pot XP (problem 8, kept as today until Phase 8): both seats in 2 Players, yours only vs the CPU.
    const count = mode => {
        let seat1 = 0, seat2 = 0;
        for (let k = 0; k < 4; k++) {
            const P = L.game({ seed: 40 + k });
            if (mode === 'pvp') P.togglePoolMode();
            P.poolNewFrame(1);
            const S = P.poolS;
            let last = P.log.notes.length, n = 0;
            while (S.phase !== 'over' && n++ < 60000) {
                if (S.handoff) P.poolOn.ready();
                const seat = S.frame.turn;
                if (seat === 1 || P.poolMode === 'pvp') human(P, S);
                P.poolTick(16);
                if (P.log.notes.length > last) { if (seat === 1) seat1++; else seat2++; last = P.log.notes.length; }
            }
        }
        return [seat1, seat2];
    };
    const cpu = count('cpu'), pvp = count('pvp');
    ok('vs the CPU, pot XP is paid for your pots only (problem 8)', cpu[0] > 0 && cpu[1] === 0, cpu.join('/'));
    ok('in 2 Players, pot XP is paid to both seats (problem 8, fixed in Phase 8)', pvp[0] > 0 && pvp[1] > 0, pvp.join('/'));
}
{
    // A foul in 2 Players hands the table over: the next player takes the seat first.
    const P = L.game({ seed: 9 });
    P.togglePoolMode();
    const S = P.poolS;
    P.poolNewFrame(1);
    P.prPlaceCue(S.world, S.world.table.headX - 60, 0); S.placed = true; S.phase = 'aim';
    S.shot = { angle: Math.PI, speed: 300, tipX: 0, tipY: 0, call: -1 };   // away from the rack: no contact, a foul
    S.phase = 'strike'; S.strikeT = 0;
    let n = 0;
    while (S.phase !== 'bih' && S.phase !== 'aim' && n++ < 4000) P.poolTick(16);
    ok('a foul in 2 Players: Pass to Player 2, and the clock waits for READY', S.handoff === 2 && S.frame.turn === 2 && S.fouled === 1);
    const c0 = S.clockLeft;
    for (let i = 0; i < 30; i++) P.poolTick(50);
    ok('…the clock does not run during the hand-off', S.clockLeft === c0);
    P.poolOn.ready();
    ok('READY clears the hand-off and restarts the clock', S.handoff === 0 && S.clockLeft === P.POOL_CLOCK_S);
}
{
    // Esc cancels a power stroke and stops there, so neither the Max modal nor a
    // host shortcut sees it. Other keys go on as normal.
    const P = L.game();
    const S = P.poolS;
    P.poolNewFrame(1);
    S.attached = true; S.phase = 'aim';
    S.drag = { kind: 'power', x: 0, y: 0, ax: [0, -1], reach: 140 }; S.power = 60;
    let stopped = 0, prevented = 0;
    P.poolOnKey({ key: 'Escape', preventDefault: () => prevented++, stopImmediatePropagation: () => stopped++, target: {} });
    ok('Esc cancels the stroke and nothing else sees the key', S.drag === null && S.power === 0 && stopped === 1 && prevented === 1);
    P.poolOnKey({ key: 'Escape', preventDefault: () => prevented++, stopImmediatePropagation: () => stopped++, target: {} });
    ok('with no stroke, Esc passes on (the Max modal closes itself)', stopped === 1);
    S.armed = true; const a0 = S.aim;
    P.poolOnKey({ key: 'ArrowLeft', preventDefault: () => prevented++, stopImmediatePropagation: () => {}, target: { tagName: 'DIV' } });
    ok('← turns the aim 0.1° while the table has the mouse', Math.abs(S.aim - a0 - 0.1 * Math.PI / 180) < 1e-12);
    P.poolOnKey({ key: 'ArrowLeft', preventDefault: () => prevented++, stopImmediatePropagation: () => {}, target: { tagName: 'INPUT' } });
    ok('…but not while a slider or field has focus', Math.abs(S.aim - a0 - 0.1 * Math.PI / 180) < 1e-12);
    // Free spin: the tip you place is the tip the physics strikes with.
    P.prPlaceCue(S.world, S.world.table.headX - 60, 0); S.placed = true; S.phase = 'aim';
    P.poolOn.tip({ x: 0.3, y: -0.9 });
    const clamped = S.tip;
    ok('a dragged tip is clamped to the miscue ring', Math.abs(Math.hypot(clamped.x, clamped.y) - 0.6) < 1e-12 && clamped.y < 0);
    P.poolOn.tipStep({ x: -0.05, y: 0 });
    ok('arrow steps move it and stay inside the ring', Math.hypot(S.tip.x, S.tip.y) <= 0.6 + 1e-12 && S.tip.x < clamped.x);
    const want = S.tip;
    S.power = 40; S.phase = 'strike'; S.strikeT = 0;
    for (let i = 0; i < 10 && S.phase === 'strike'; i++) P.poolTick(16);
    const strike = S.world.log.find(e => e.type === 'strike');
    ok('the strike uses exactly that tip', strike && Math.abs(strike.tipX - want.x) < 1e-12 && Math.abs(strike.tipY - want.y) < 1e-12, strike && [strike.tipX, strike.tipY]);
    for (let i = 0; i < 4000 && (S.phase === 'moving' || S.phase === 'strike'); i++) P.poolTick(16);
    ok('the tip goes back to the centre for the next shot', S.tip.x === 0 && S.tip.y === 0 && !S.spinOpen);
    P.poolOn.camera('2d'); P.poolOn.lean(80);
    ok('the camera and lean are remembered in userPreferences', P.host.userPreferences.poolCamera === '2d' && P.host.userPreferences.poolLean === 80 && P.log.saves >= 1);
    P.host.userPreferences.poolShotCam = '3d';
    ok('the shot camera comes from ⚙️ (userPreferences.poolShotCam)', P.poolCamInput().shotCam === '3d' && P.poolCamInput().camera === '2d');
}

// ── 5. The stand-in CPU ───────────────────────────────────────────────
head('The stand-in CPU (pool-ai.js)');
{
    const P = L.ai();
    // A straight pot: the planner finds it and it goes in on the real physics.
    const w = P.ppCreateWorld();
    w.balls = [P.ppMakeBall(0, -200, 0), P.ppMakeBall(3, 200, 0)];
    for (let id = 1; id <= 15; id++) if (id !== 3) w.balls.push(Object.assign(P.ppMakeBall(id, 0, 0), { state: 'pocketed' }));
    const st = Object.assign(P.prNewFrame({ breaker: 1 }), { isBreak: false, ballInHand: null, groups: { 1: 'solids', 2: 'stripes' } });
    // Cue ball, object ball and the top-right corner in one straight line.
    const pk = w.table.pockets[2];
    const d = Math.hypot(pk.x - 200, pk.y), ux = (pk.x - 200) / d, uy = pk.y / d;
    w.balls[0].x = 200 - ux * 300; w.balls[0].y = -uy * 300;
    const job = P.paPlan(w, st, { noise: false });
    job.step();
    const w2 = P.ppCloneWorld(w); P.ppStrike(w2, job.shot); P.ppSimulate(w2);
    const v = P.prJudge(st, w2, job.shot.call);
    ok('a straight pot is planned and goes in', v.continues && !v.foul && w2.balls.find(b => b.id === 3).pocket === 2);

    // Mid-frame tables: noise-free plans are nearly always legal, usually pots.
    let legal = 0, pots = 0, n = 0, placeOk = 0, kitchenOk = 0, sliced = true, worst = 0;
    for (let k = 0; k < 24; k++) {
        const rng = P.ppRandom(500 + k);
        const w3 = P.ppRack(P.ppCreateWorld(), rng);
        let s3 = P.prNewFrame({ breaker: 1 });
        w3.balls[0].x = w3.table.headX - 60;
        const b = P.paPlan(w3, s3, { rng }); b.step();
        P.ppStrike(w3, b.shot); P.ppSimulate(w3);
        const vb = P.prJudge(s3, w3, -1);
        if (vb.respot8) P.prSpotBall(w3, 8);
        s3 = vb.next;
        if (s3.over) continue;
        if (s3.ballInHand) {
            const p = P.paPlace(w3, s3, rng);
            if (!P.prCanPlace(w3, p[0], p[1], s3.ballInHand)) placeOk++;
            if (s3.ballInHand !== 'kitchen' || p[0] <= w3.table.headX) kitchenOk++;
            P.prPlaceCue(w3, p[0], p[1]);
        } else { placeOk++; kitchenOk++; }
        const j = P.paPlan(w3, s3, { noise: false });
        let steps = 0;
        const t0 = process.hrtime.bigint();
        while (!j.step(3)) { steps++; if (steps > 200) break; }
        const ms = Number(process.hrtime.bigint() - t0) / 1e6 / Math.max(1, steps + 1);
        worst = Math.max(worst, ms);
        if (steps > 200) sliced = false;
        const w4 = P.ppCloneWorld(w3); P.ppStrike(w4, j.shot); P.ppSimulate(w4);
        const v4 = P.prJudge(s3, w4, j.shot.call);
        n++; if (!v4.foul) legal++; if (v4.continues) pots++;
    }
    ok('ball in hand: the CPU always picks a legal spot, behind the string on the break', placeOk === 24 && kitchenOk === 24, placeOk + '/' + kitchenOk);
    ok('noise-free plans after the break are legal ≥ 90% of the time', legal / n >= 0.9, legal + '/' + n);
    ok('…and pot ≥ 60% of the time', pots / n >= 0.6, pots + '/' + n);
    ok('thinking is time-sliced: each step stays near its 3 ms budget', sliced && worst < 15, worst.toFixed(1) + ' ms per step at worst');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
