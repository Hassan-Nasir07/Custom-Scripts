// pool-dev verification: the v2 splice and the match. `node pool-dev/pool-verify.js`
//
// Phase 5 of POOL_V2_PLAN.md put the v2 engine into the userscript. This suite
// checks the contract between pool-dev/ and the host:
//   1  both spliced blocks are byte-identical to pool-dev/, in splice order
//   2  nothing of v1 is left, and the block cannot collide with the host's names
//   3  the host calls pool the way pool-game.js expects, and nothing else
//   4  the match, headless: frames, turns, the shot clock, ball in hand, XP,
//      records and the one-award-per-rack guard (pool-game.js on a stubbed host)
//   5  the CPU (pool-ai.js): the tiers, real pots, the throw correction, legal
//      placement, adaptive difficulty, the frame budget
//   6  the tiers in the match: the lock, pro's calls, the Game mode sheet, the record
//  10  snooker in the controller (POOL_V2_PLAN.md, Snooker, S3): the switch, nomination,
//      the choice after a foul, the D, concede, one award per rack, parking, a reload
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
ok('the engine is spliced in dependency order', FILES.join() === 'pool-physics.js,pool-rules.js,pool-snooker.js,pool-tour.js,pool-camera.js,pool-render.js,pool-hud.js,pool-tour-ui.js,pool-ai.js,pool-snooker-ai.js,pool-game.js');
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
ok('switchGame enters through initPoolGame(), on #pool-root, with no controls row', /pool: \{ el: 'pool-root', noControls: true, title: '🎱 8-Ball Pool', start: \(\) => initPoolGame\(\) \}/.test(src));
ok('switchGame leaves through poolDetach()', /case 'pool':[\s\S]{0,200}?poolDetach\(\);\n\s+break;/.test(src));
ok('the panel element is #pool-root, shown and hidden with the canvases', /<div id="pool-root" class="pool-root" style="display:none;"><\/div>/.test(src));
ok('the header keeps the title and the wins button only', /<div id="pool-scoreboard" class="snake-scoreboard" style="display: none;">\n\s+\$\{gameScoreBtn\('pool', 'pool-wins'\)\}/.test(src) && !src.includes('pool-turn-label'));
ok('there is no Play button, and no controls row is shown', /<div id="pool-controls" class="snake-controls" style="display: none;"><\/div>/.test(src) &&
   !/getElementById\('pool-controls'\); if \(c\) c\.style\.display = 'flex'/.test(src));
ok('Escape no longer resets a pool frame', !/case 'pool': resetPoolGame\(\); break;/.test(src));
ok('the bridges only the old buttons used are gone', !/window\.(startPoolGameBtn|resetPoolGameBtn|togglePoolModeBtn|togglePoolMaximizeBtn) =/.test(src));
ok('userPreferences defaults poolCamera, poolLean and poolShotCam',
   /poolCamera: '3d',/.test(src) && /poolLean: 35,/.test(src) && /poolShotCam: 'overhead',/.test(src));
ok('⚙️ offers the shot camera: Overhead or Stay 3D', /sel\('poolShotCam', [^\n]*?\['overhead', [^\n]*?\['3d', /.test(src));
{
    const m = /function createSettingsModal\(\) \{[\s\S]*?\n    \}\n/.exec(src), fn = m ? m[0] : '';
    // A dropdown's values, from its sel('pref', label, [[value, text], ...]) row.
    const opts = pref => { const r = new RegExp("sel\\('" + pref + "', '(?:[^'\\\\]|\\\\.)*', \\[(.*)\\]\\]").exec(fn); return r ? [...r[1].matchAll(/\['([^']*)', /g)].map(x => x[1]).join() : null; };
    ok('⚙️ groups its rows behind a tab strip: General, Theme, Cue Games, Ludo',
       [...fn.matchAll(/data-settings-tab="(\w+)"/g)].map(x => x[1]).join() === 'general,theme,cue,ludo' &&
       [...fn.matchAll(/data-settings-group="(\w+)"/g)].map(x => x[1]).join() === 'general,theme,cue,ludo');
    ok('…the cue games\' tab heads its rows: both games, then pool, then snooker',
       /data-settings-group="cue"[\s\S]*?Both games[\s\S]*?sel\('poolShotCam'[\s\S]*?🎱 8-Ball Pool[\s\S]*?sel\('poolClock'[\s\S]*?🔴 Snooker[\s\S]*?sel\('snookerClock'[\s\S]*?data-settings-group="ludo"/.test(fn));
    ok('the cue game is not a ⚙️ setting any more (the header switches it)', opts('poolVariant') === null);
    ok('⚙️ Aim Guide offers None', opts('poolGuideLen') === 'long,medium,short,none');
    ok('⚙️ Shot Clock: the tournament\'s choices for each game', opts('poolClock') === '30,45,0' && opts('snookerClock') === '30,45,60,0');
    ok('…read back as numbers, and the panel follows them', /numericPrefs = \[[^\]]*'poolClock', 'snookerClock'\]/.test(fn) && /\n\s*if \(typeof poolOnPrefChange === 'function'\) poolOnPrefChange\(pref\);/.test(fn));
    ok('userPreferences defaults the clocks and 2 Players\' names', /poolClock: 30,/.test(src) && /snookerClock: 45,/.test(src) && /poolP1Name: '',/.test(src) && /poolP2Name: '',/.test(src));
    ok('the pool panel\'s title goes through poolRenderTitle', /if \(gameKey === 'pool' && typeof poolRenderTitle === 'function'\) poolRenderTitle\(el\);/.test(src));
}
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
ok('the leaderboard reads poolMode and poolCpuTier, declared by pool-game.js', /let poolMode = 'cpu';/.test(block) && /let poolCpuTier = /.test(block) &&
   /if \(game === 'pool'\)\s+return poolMode === 'pvp' \? 'pvp'\s+: poolMode === 'cpu' && LB_BOARDS\.pool\.modes\[poolCpuTier\] \? poolCpuTier : 'cpu';/.test(src));
ok('the achievement check still finds poolGamesWon', /let poolGamesWon = 0;/.test(block) && /typeof poolGamesWon === 'number' && poolGamesWon >= 100/.test(src));

// ── 3b. The game seam (POOL_V2_PLAN.md, Snooker, Phase S0) ─────────────
// Pool and snooker share the controller, HUD and renderer. What differs is one profile per
// game in POOL_GAMES; nothing else may name a game's rules, CPU, rack or storage, or the
// second game would have to be threaded through by hand. pool-fingerprint.js
// (snooker-verify.js §0) proves pool itself plays, judges, plans and draws as before.
head('Game seam');
{
    const rd = f => fs.readFileSync(require('path').join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');
    const gameSrc = noComments(rd('pool-game.js'));
    const a = gameSrc.indexOf('    const POOL_GAMES = {'), b = gameSrc.indexOf('    const poolRules = ');
    const outside = a > 0 && b > a ? gameSrc.slice(0, a) + gameSrc.slice(b) : gameSrc;
    const named = (outside.match(/\b(?:pr|pa|ps)[A-Z]\w*|\bP[AS]_\w*|\bPG_BALL_COLOURS\b|\bppRack\b|\bPOOL_(?:TOUR|CAB)_KEY\b|'(?:pool|snooker)(?:WinsByTier|CpuRecord|Frame|Record|WinsByMode)'|userPreferences\.(?:poolDifficulty|snooker\w+)/g) || []);
    ok('pool-game.js: POOL_GAMES is the one place a game\'s rules, CPU, rack and storage are named', a > 0 && b > a && !named.length, [...new Set(named)].join(', '));
    const hudSrc = noComments(rd('pool-hud.js'));
    const rulesCalls = hudSrc.match(/\bp[rs][A-Z]\w*\(/g) || [];
    ok('pool-hud.js: the HUD takes the shooter\'s status from the controller, and calls no rules', !rulesCalls.length, rulesCalls.join(', '));
    const renderSrc = noComments(rd('pool-render.js'));
    ok('pool-render.js: ball colours only through pgBallLook', (renderSrc.match(/PG_BALL_COLOURS/g) || []).length === 2 && !/PG_BALL_COLOURS/.test(hudSrc));
    const P = L.game({ seed: 3 }), R = P.POOL_GAMES.pool;
    const need = ['id', 'title', 'icon', 'lb', 'xpType', 'diffPref', 'diffs', 'keys', 'world', 'rack', 'cueHome', 'newFrame', 'status', 'judge', 'apply', 'timeout', 'text',
        'legal', 'canPlace', 'clampPlace', 'placeCue', 'tracksPot', 'ballCount', 'validFrame', 'tourDefaults', 'cpu', 'frameXP', 'fileResult', 'wins'];
    ok('the pool profile has every part the controller asks for', need.every(k => R[k] !== undefined), need.filter(k => R[k] === undefined).join(', '));
    const SN = P.POOL_GAMES.snooker;
    ok('the snooker profile has every part the pool profile has, and its own choice, concede and reload parts',
       need.every(k => SN[k] !== undefined) && ['choose', 'choices', 'choiceNotice', 'concede', 'resultText', 'prime', 'rackPref'].every(k => SN[k]) && SN.keys.frame === 'snookerFrame' && !R.keys.frame,
       need.filter(k => SN[k] === undefined).join(', '));
    ok('pool\'s storage keys are the ones the host and old saves use',
       R.keys.cpuRec === 'poolCpuRecord' && R.keys.byTier === 'poolWinsByTier' && R.keys.tour === 'poolTournament' && R.keys.cab === 'poolTrophyCabinet' && R.xpType === 'pool' && R.lb === 'pool');
    ok('poolRules() is pool by default, and for an unknown game', P.poolRules() === R && (P.poolS.game = 'nope', P.poolRules() === R));
    P.poolS.game = 'pool';
    let looks = true;
    for (let id = 0; id < 16; id++) {
        const l = P.pgBallLook('pool', id);
        if (id === 0 ? !l.cue : l.colour !== P.PG_BALL_COLOURS[id > 8 ? id - 8 : id] || l.stripe !== (id > 8) || !l.number) looks = false;
    }
    ok('pgBallLook(\'pool\') is pool\'s balls: the cue, eight colours, stripes above 8, every one numbered', looks);
    ok('an unknown game draws pool\'s balls', P.pgBallLook('nope', 9).stripe === true);
    const cfg = P.ppCreateWorld().cfg;
    ok('sizes drawn round a ball scale by R/14, which is exactly 1 at pool\'s R', P.pgK(cfg) === 1 && cfg.ballR === 14);
    ok('rail and nose heights: pool\'s 16 and 10 unless a table sets its own', P.pgRailZ(cfg) === 16 && P.pgNoseZ(cfg) === 10 && P.pcRailTop(cfg) === 16 &&
       P.pgRailZ(Object.assign({}, cfg, { railZ: 8.4 })) === 8.4 && P.pcRailTop(Object.assign({}, cfg, { railZ: 8.4 })) === 8.4);
    ok('pool\'s table has no marks of its own: the renderer draws its two spots', !P.ppCreateWorld().table.marks &&
       JSON.stringify(P.pgMarks(P.ppCreateWorld().table).spots.map(s => [s.x, s.y, s.r])) === JSON.stringify([[250, 0, 3], [-250, 0, 3]]));
    P.poolUseGame('pool');
    ok('poolUseGame sets the game and its table config, and drops the camera and cache', P.poolS.game === 'pool' && P.poolS.cfg.ballR === 14 && P.poolS.director === null);
}

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
    // Pot XP (problem 8, fixed in Phase 8): your pots against the CPU only; 2 Players pays no pots.
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
    ok('in 2 Players, pots pay nothing: the XP would land on this account for either seat (problem 8)', pvp[0] === 0 && pvp[1] === 0, pvp.join('/'));
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

{
    // A foul's toast has no timer. Against the CPU no hand-off clears it, so placing the cue
    // ball must, or the spin control (and the hint and call card) stay hidden all shot.
    const P = L.game({ seed: 12 }), S = P.poolS;
    P.poolNewFrame(1);
    Object.assign(S.frame, { isBreak: false, ballInHand: 'anywhere', turn: 1 });
    S.phase = 'bih'; S.placed = false; S.fouled = 2;
    P.poolShowToast({ kind: 'foul', title: 'Foul · scratch', sub: 'Ball in hand to You' });
    S.drag = { kind: 'place' }; P.prPlaceCue(S.world, -200, 100);
    P.poolOnUp();
    ok('ball in hand after a CPU foul: placing the ball takes the foul toast down, the FOUL tag stays',
       S.phase === 'aim' && S.placed && S.toast === null && S.fouled === 2);
    P.poolShowToast({ kind: 'notice', title: 'CPU plays on', sub: '' });
    S.phase = 'bih'; S.drag = { kind: 'place' }; P.poolOnUp();
    ok('…a notice keeps its own timer', S.toast && S.toast.kind === 'notice');
}
{
    // 2 Players' names, from the Game mode sheet.
    const P = L.game({ name: 'Ayesha' }), S = P.poolS;
    P.poolNewFrame(1); P.togglePoolMode();
    ok('2 Players, unnamed: you (by your leaderboard name) and Player 2', P.poolNames()[1] === 'Ayesha' && P.poolNames()[2] === 'Player 2');
    P.poolOn.pvpName({ seat: 1, value: '  Bilal ' }); P.poolOn.pvpName({ seat: 2, value: 'Zainab the Very Long Name' });
    ok('typed names play at once, trimmed, 16 characters at most', P.poolNames()[1] === 'Bilal' && P.poolNames()[2] === 'Zainab the Very' && P.host.userPreferences.poolP2Name.length === 16);
    P.poolOn.pvpName({ seat: 1, value: '' });
    ok('an emptied name goes back to its default', P.poolNames()[1] === 'Ayesha');
    P.togglePoolMode();
    ok('Vs CPU keeps You and CPU', P.poolNames()[1] === 'Ayesha' && P.poolNames()[2] === 'CPU');
    const before = JSON.stringify(P.host.userPreferences);
    P.poolOn.pvpName({ seat: 3, value: 'x' });
    ok('a seat that is not 1 or 2 is ignored', JSON.stringify(P.host.userPreferences) === before);
}
{
    // ⚙️ Shot Clock for quick frames, per game; a tournament keeps its own.
    const P = L.game({ prefs: { poolClock: 45, snookerClock: 0 } }), S = P.poolS;
    P.poolNewFrame(1);
    ok('⚙️ Pool Shot Clock 45: the quick frame runs a 45 s clock', S.clockTotal === 45 && S.clockLeft === 45);
    P.poolSetVariant('snooker');
    ok('⚙️ Snooker Shot Clock Off: no clock', S.clockTotal === 0);
    P.host.userPreferences.snookerClock = 60; P.poolOnPrefChange('snookerClock');
    ok('turned on mid-turn, it starts full', S.clockTotal === 60 && S.clockLeft === 60);
    S.clockLeft = 50; P.host.userPreferences.snookerClock = 30; P.poolOnPrefChange('snookerClock');
    ok('shortened mid-turn, the turn keeps what it has within the new limit', S.clockTotal === 30 && S.clockLeft === 30);
    P.host.userPreferences.snookerClock = 'nonsense'; P.poolOnPrefChange('snookerClock');
    ok('a value it does not offer falls back to the game\'s own (snooker 45)', S.clockTotal === 45);
    P.poolSetVariant('pool');
    ok('pool keeps its own pick', S.clockTotal === 45);
    S.clockLeft = 40; P.poolSetVariant('snooker'); P.host.userPreferences.poolClock = 30; P.poolSetVariant('pool');
    ok('a parked frame comes back within a clock lowered meanwhile', S.clockTotal === 30 && S.clockLeft === 30);
}
{
    // ⚙️ Aim Guide None: the shot the HUD keeps its overlays off ends at the contact.
    const P = L.game(), S = P.poolS;
    P.poolNewFrame(1);
    S.world.balls.forEach(b => { if (b.id > 1) b.state = 'pocketed'; });
    P.prPlaceCue(S.world, -300, 0);
    Object.assign(S.world.balls.find(b => b.id === 1), { x: 0, y: 0 });
    S.phase = 'aim'; S.aim = 0; S.guideKey = ''; P.poolRefreshGuide();
    const v = P.pcView(P.pcOrtho(400, 300, S.cfg));
    const full = P.poolShotPath(v);
    P.host.userPreferences.poolGuideLen = 'none';
    const none = P.poolShotPath(v);
    ok('Aim Guide None: guide length 0, and the shot path stops at the contact', P.poolGuideLen() === 0 && none.dots.length === 1 && full.dots.length > 1 && none.segs.length < full.segs.length);
    P.host.userPreferences.poolGuideLen = 'bogus';
    ok('an unknown Aim Guide reads as Long', P.poolGuideLen() === 150);
}
{
    // The header's 🎱 | 🔴 switch, in place of ⚙️ Cue Game.
    const P = L.game({ seed: 4 }), S = P.poolS;
    P.poolNewFrame(1);
    P.poolToggleVariant();
    ok('the header switch plays snooker and remembers it', S.game === 'snooker' && P.host.userPreferences.poolVariant === 'snooker' && P.log.saves >= 1);
    P.poolToggleVariant();
    ok('…and switches back', S.game === 'pool' && P.host.userPreferences.poolVariant === 'pool');
    const el = { innerHTML: '', firstChild: { addEventListener: (t, f) => { el.click = t === 'click' ? f : null; } } };
    P.poolRenderTitle(el);
    ok('the title: both games\' icons with pool lit, its name, and a click that switches', /class="pool-cue-switch"[^>]*aria-label="Switch to Snooker"/.test(el.innerHTML) &&
       /<span class="pool-cue-opt is-on">🎱<\/span><span class="pool-cue-opt">🔴<\/span>/.test(el.innerHTML) && /<span class="pool-cue-name">8-Ball Pool<\/span>/.test(el.innerHTML) && el.click === P.poolToggleVariant);
}

// ── 5. The CPU (pool-ai.js) ───────────────────────────────────────────
head('The CPU (pool-ai.js)');
{
    const P = L.ai();
    ok('four tiers, easy to pro, each with its design description', P.PA_TIER_NAMES.join() === 'easy,normal,hard,pro' &&
       P.PA_TIER_NAMES.every(t => P.PA_TIERS[t].label && P.PA_TIERS[t].desc));
    ok('only pro calls every shot', P.PA_TIER_NAMES.filter(t => P.PA_TIERS[t].callEvery).join() === 'pro');
    ok('the tiers search more, and miss less, as they go up',
       P.PA_TIER_NAMES.every((t, i, a) => !i || (P.PA_TIERS[t].top >= P.PA_TIERS[a[i - 1]].top && P.PA_TIERS[t].aim <= P.PA_TIERS[a[i - 1]].aim && P.PA_TIERS[t].spins.length >= P.PA_TIERS[a[i - 1]].spins.length)));

    // A straight pot: planned and in, for every tier, noise-free.
    const w = P.ppCreateWorld();
    w.balls = [P.ppMakeBall(0, -200, 0), P.ppMakeBall(3, 200, 0)];
    for (let id = 1; id <= 15; id++) if (id !== 3) w.balls.push(Object.assign(P.ppMakeBall(id, 0, 0), { state: 'pocketed' }));
    const st = Object.assign(P.prNewFrame({ breaker: 1 }), { isBreak: false, ballInHand: null, groups: { 1: 'solids', 2: 'stripes' } });
    // Cue ball, object ball and the top-right corner in one straight line.
    const pk = w.table.pockets[2];
    const d = Math.hypot(pk.x - 200, pk.y), ux = (pk.x - 200) / d, uy = pk.y / d;
    w.balls[0].x = 200 - ux * 300; w.balls[0].y = -uy * 300;
    const straight = P.PA_TIER_NAMES.every(t => {
        const job = P.paPlan(w, st, { noise: false, tier: t }); job.step();
        const r = P.paTrial(w, st, 1, job.shot);
        return r.v.continues && !r.v.foul && r.w.balls.find(b => b.id === 3).pocket === 2;
    });
    ok('a straight pot is planned and goes in, every tier', straight);

    // Throw and squirt: the correction takes a cut's departure error to nearly nothing.
    let raw = [], fixed = [];
    for (let k = 0; k < 12; k++) {
        const rng = P.ppRandom(900 + k), w3 = P.ppRack(P.ppCreateWorld(), rng);
        w3.balls[0].x = w3.table.headX - 60;
        P.ppStrike(w3, { angle: 0, speed: w3.cfg.maxSpeed * 0.96, tipX: 0, tipY: 0 }); P.ppSimulate(w3);
        if (w3.balls[0].state === 'pocketed') P.prPlaceCue(w3, -300, 0);
        const s3 = Object.assign(P.prNewFrame({ breaker: 1 }), { isBreak: false, ballInHand: null });
        const c = P.paCandidates(w3, s3, 1, w3.balls[0].x, w3.balls[0].y, 'hard', true).find(x => x.cut > 20 * Math.PI / 180);
        if (!c) continue;
        const shot = { angle: c.angle, speed: c.speed, tipX: 0, tipY: 0, call: -1 };
        const d0 = P.paDeparture(w3, shot, c.ball), d1 = P.paDeparture(w3, P.paRefine(w3, c, shot, 2, 14), c.ball);
        if (d0 !== null && d1 !== null) { raw.push(Math.abs(P.paAngDiff(d0, c.want))); fixed.push(Math.abs(P.paAngDiff(d1, c.want))); }
    }
    const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1] * 180 / Math.PI;
    ok('the aim correction takes out throw: the median departure error drops below 0.1°', raw.length >= 6 && med(fixed) < 0.1 && med(fixed) < med(raw) / 5,
       raw.length + ' cuts, ' + med(raw).toFixed(2) + '° → ' + med(fixed).toFixed(3) + '°');

    // Mid-frame, noise-free, hard: legal nearly always, and it pots.
    let legal = 0, pots = 0, n = 0, placeOk = 0, kitchenOk = 0, sliced = true, stepMs = [];
    for (let k = 0; k < 16; k++) {
        const rng = P.ppRandom(500 + k);
        const w3 = P.ppRack(P.ppCreateWorld(), rng);
        let s3 = P.prNewFrame({ breaker: 1 });
        w3.balls[0].x = w3.table.headX - 60;
        const b = P.paPlan(w3, s3, { rng, tier: 'hard' }); b.step();
        P.ppStrike(w3, b.shot); P.ppSimulate(w3);
        const vb = P.prJudge(s3, w3, -1);
        if (vb.respot8) P.prSpotBall(w3, 8);
        s3 = vb.next;
        if (s3.over) continue;
        if (s3.ballInHand) {
            const p = P.paPlace(w3, s3, rng, 'hard');
            if (!P.prCanPlace(w3, p[0], p[1], s3.ballInHand)) placeOk++;
            if (s3.ballInHand !== 'kitchen' || p[0] <= w3.table.headX) kitchenOk++;
            P.prPlaceCue(w3, p[0], p[1]);
        } else { placeOk++; kitchenOk++; }
        const j = P.paPlan(w3, s3, { noise: false, tier: 'hard' });
        let steps = 0;
        while (true) {
            const t0 = process.hrtime.bigint();
            const done = j.step(3);
            stepMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
            if (done) break;
            if (++steps > 400) { sliced = false; break; }
        }
        const r4 = P.paTrial(w3, s3, s3.turn, j.shot);
        n++; if (!r4.v.foul) legal++; if (r4.v.continues) pots++;
    }
    ok('ball in hand: the CPU always picks a legal spot, behind the string on the break', placeOk === 16 && kitchenOk === 16, placeOk + '/' + kitchenOk);
    ok('hard, noise-free: legal ≥ 90% of the time after the break', legal / n >= 0.9, legal + '/' + n);
    ok('…and it pots ≥ 75% of the time', pots / n >= 0.75, pots + '/' + n);
    // Wall-clock: one garbage-collection pause can land in any step, so the slowest step is
    // forgiven and the next is judged. A stage that stopped slicing would run long in every
    // one of these 16 plans, so it still fails.
    stepMs.sort((a, b) => b - a);
    ok('thinking is time-sliced: no step runs far past its 3 ms budget (one trial is ~3–6 ms)', sliced && stepMs.length > 1 && stepMs[1] < 25,
       (stepMs[1] || 0).toFixed(1) + ' ms second-slowest of ' + stepMs.length + ' (slowest ' + (stepMs[0] || 0).toFixed(1) + ')');

    // Adaptive: eased off when you struggle, pushed when you win, never to pro; a pin wins.
    const rec = (w, l) => ({ wins: w, losses: l });
    ok('adaptive waits for 5 frames, then follows your win rate', P.paAdaptiveTier(rec(4, 0)) === 'normal' && P.paAdaptiveTier(rec(1, 9)) === 'easy' &&
       P.paAdaptiveTier(rec(5, 5)) === 'normal' && P.paAdaptiveTier(rec(9, 1)) === 'hard');
    ok('adaptive never climbs to pro, however well you play', P.paAdaptiveTier(rec(100, 0)) === 'hard');
    ok('a pinned tier wins over the record; anything else is adaptive', P.paTierFor('pro', rec(0, 50)) === 'pro' && P.paTierFor('easy', rec(50, 0)) === 'easy' &&
       P.paTierFor('adaptive', rec(9, 1)) === 'hard' && P.paTierFor('bogus', rec(0, 0)) === 'normal');
}

// ── 6. Tiers in the match (pool-game.js) ──────────────────────────────
head('Tiers in the match');
{
    const P = L.game({ seed: 21 });
    const S = P.poolS;
    P.poolNewFrame(1);
    ok('a new frame locks the tier: adaptive with no record plays Normal', P.poolCpuTier === 'normal' && P.poolRecordText(2) === 'Adaptive · Normal');
    P.host.userPreferences.poolDifficulty = 'hard';
    P.poolNewFrame(1);
    ok('a pinned tier is locked in at the next frame', P.poolRecordText(2) === 'Hard');
    P.host.userPreferences.poolDifficulty = 'pro';
    ok('…and changing the pin mid-frame does not change this frame', P.poolRecordText(2) === 'Hard');
    P.poolNewFrame(1);
    ok('pro calls every shot, for you too', S.frame.callEvery === true && P.poolRecordText(2) === 'Pro');
    P.host.userPreferences.poolDifficulty = 'adaptive';
    P.poolNewFrame(1);
    ok('adaptive shows on the CPU card with the tier it plays', P.poolRecordText(2) === 'Adaptive · Normal' && S.frame.callEvery === false);

    // The Game mode sheet: the footer's mode button opens it, and it takes the table.
    P.poolOn.mode();
    ok('the mode button opens the Game mode sheet on the current mode', S.sheet.open && S.sheet.mode === 'cpu' && !P.poolCanAct());
    P.poolOn.sheetTab('pvp');
    ok('the tabs switch the sheet, not the match', S.sheet.mode === 'pvp' && P.poolMode === 'cpu');
    P.poolOn.sheetTab('cpu');
    P.poolOn.difficulty('easy');
    ok('picking a difficulty before the break applies it at once and closes the sheet',
       !S.sheet.open && P.host.userPreferences.poolDifficulty === 'easy' && P.poolRecordText(2) === 'Easy' && P.log.saves > 0);
    // After the break, a new pick waits for the next frame, and the sheet says so.
    S.frame.isBreak = false;
    P.poolOn.mode(); P.poolOn.difficulty('hard');
    ok('after the break, a new pick waits for the next frame, and the sheet says so',
       S.sheet.open && P.poolRecordText(2) === 'Easy' && /Hard from the next frame/.test(P.poolSheetNote()), P.poolSheetNote());
    let stopped = 0;
    S.attached = true;                          // keys only count while the panel is up
    P.poolOnKey({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() { stopped++; }, target: {} });
    S.attached = false;
    ok('Esc closes the sheet, and nothing else sees it', !S.sheet.open && stopped === 1);
    P.poolOn.mode(); P.poolOn.startPvp();
    ok('START 2-PLAYER FRAME switches to 2 Players on a fresh rack', P.poolMode === 'pvp' && !S.sheet.open && S.frame.isBreak);
    P.poolOn.mode(); P.poolOn.difficulty('normal');
    ok('a difficulty picked from 2 Players switches back to Vs CPU', P.poolMode === 'cpu' && !S.sheet.open && P.poolRecordText(2) === 'Normal');

    // The record behind adaptive: frames against the CPU only.
    P.host.userPreferences.poolDifficulty = 'adaptive';
    P.poolNewFrame(1);
    for (let i = 0; i < 8; i++) { P.poolNewFrame(1); P.poolEndFrame({ winner: 1 }); }
    const cpuRec = JSON.parse(P.store.poolCpuRecord);
    ok('frames against the CPU go into the adaptive record', cpuRec.wins === 8 && cpuRec.losses === 0);
    P.poolNewFrame(1);
    ok('…and a strong record moves adaptive up at the next frame', P.poolRecordText(2) === 'Adaptive · Hard');
    ok('the frame-over note says what adaptive will do next', P.poolAdaptiveNote() === 'Adaptive stays at Hard');
    P.togglePoolMode();
    P.poolNewFrame(1); P.poolEndFrame({ winner: 2 });
    ok('2 Players frames stay out of it', JSON.parse(P.store.poolCpuRecord).losses === 0);

    // The CPU calls its pocket when every shot must be called.
    const Q = L.game({ seed: 22, prefs: { poolDifficulty: 'pro' } });
    const T = Q.poolS;
    Q.poolNewFrame(2);                          // the CPU breaks; then play until it must call
    let calls = 0, asked = 0;
    for (let i = 0; i < 20000 && T.phase !== 'over' && asked < 3; i++) {
        if (T.frame.turn === 1) { human(Q, T); }
        const before = T.phase;
        Q.poolTick(16);
        if (before === 'aim' && T.phase === 'strike' && T.frame.turn === 2 && !T.frame.isBreak && T.frame.callEvery) { asked++; if (T.called >= 0 && T.shot && T.shot.call === T.called) calls++; }
    }
    ok('pro: the CPU names its pocket on every shot it takes', asked > 0 && calls === asked, calls + '/' + asked);
}

// ── 6b. Pots on an open table ─────────────────────────────────────────
head('Pots on an open table (pool-game.js)');
{
    const P = L.game({ seed: 1 });
    const S = P.poolS;
    P.poolNewFrame(1);
    // The break: whatever drops goes on the breaker's list (the 8 excepted).
    P.prPlaceCue(S.world, S.world.table.headX - 60, 0); S.placed = true; S.phase = 'aim'; S.aim = 0;
    S.shot = { angle: -0.01, speed: S.cfg.maxSpeed, tipX: 0, tipY: 0 }; S.phase = 'strike'; S.strikeT = 0;   // this break pots two
    const breaker = S.frame.turn;
    for (let i = 0; i < 6000 && (S.phase === 'strike' || S.phase === 'moving'); i++) P.poolTick(16);
    const down = S.world.balls.filter(b => b.id !== 0 && b.id !== 8 && b.state === 'pocketed').map(b => b.id).sort((a, b) => a - b);
    ok('the break\'s pots are the breaker\'s, and only those', down.length >= 2 && S.pots[breaker].slice().sort((a, b) => a - b).join() === down.join() && !S.pots[3 - breaker].length, S.pots[breaker].join() + ' vs ' + down.join());
    P.poolNewFrame(2);
    ok('a new frame clears them', !S.pots[1].length && !S.pots[2].length);

}

// ── 7. Tournaments in the match (pool-game.js on pool-tour.js) ────────
head('Tournament (pool-game.js)');
{
    const P = L.game({ seed: 31, name: 'Ayesha' });
    const S = P.poolS, T = S.tour, O = P.poolTourOn;
    P.poolNewFrame(1);
    P.poolOn.tourGo();
    ok('Tournament → set up: the setup screen, four players, your name in slot 1', T.screen === 'setup' && T.setup.n === 4 && T.setup.names[0] === 'Ayesha' && T.setup.names[1] === '');
    O.count('1'); O.count('1');
    ok('the stepper grows the field: six players make a bracket of 8, with three race columns', T.setup.n === 6 && T.setup.size === 8 && T.setup.race.join() === '1,2,3');
    O.count('-1'); O.count('-1'); O.count('-1'); O.count('-1');
    ok('…and stops at 3', T.setup.n === 3 && T.setup.race.join() === '2,3');
    O.count('3');
    ['Bilal', 'Hamza', 'Sana', 'Usman', 'Zara'].forEach((n, i) => O.edit('name:' + (i + 1), n));
    O.edit('race:0', '2'); O.set('clock:45'); O.set('guide:short'); O.set('call:every'); O.edit('tname', 'Office Cup');
    const rev = T.rev; O.edit('name:1', 'Bilal');
    ok('typing a name does not re-render the screen (the caret stays)', T.rev === rev);
    O.start();
    const t0 = T.t;
    ok('START TOURNAMENT: the bracket, saved to poolTournament', T.screen === 'bracket' && t0.name === 'Office Cup' && t0.slots.length === 6 && JSON.parse(P.store.poolTournament).id === t0.id);
    ok('the race columns become per-round races (Quarter, Semi, Final)', t0.settings.race.join() === '2,2,3');
    ok('quick play stays the mode until a match starts', P.poolMode === 'cpu');

    const m1 = P.ptNext(t0);
    O.play();
    ok('PLAY NEXT MATCH: the intro for the next match', T.screen === 'intro' && T.introId === m1.id);
    O.ready();
    ok('READY: the match is on the table, in tour mode', P.poolMode === 'tour' && T.matchId === m1.id && T.t.current === m1.id && T.screen === null);
    ok('the table takes the tournament\'s settings', S.guideMode === 'short' && S.callEvery && S.frame.callEvery && S.clockTotal === 45 && S.clockLeft === 45);
    const A = T.t.slots[m1.a], B = T.t.slots[m1.b];
    ok('the seats are the match\'s players, with their seeds', P.poolNames()[1] === A.name && P.poolNames()[2] === B.name && P.poolRecordText(1) === 'Seed ' + A.seed && P.poolRecordText(2) === 'Seed ' + B.seed);
    ok('the lower seed breaks the first frame', (S.breaker === 1 ? A : B).seed === Math.max(A.seed, B.seed));
    ok('nobody is at the CPU seat', !P.poolCpuTurn());
    const rack = S.rackId; P.resetPoolGame();
    ok('Reset is refused mid-match (it would undo a lost frame)', S.rackId === rack);

    // Pause stops the clock; unpause lets it run.
    P.prPlaceCue(S.world, S.world.table.headX - 60, 0); S.placed = true; S.phase = 'aim';
    P.poolOn.tourPause();
    for (let i = 0; i < 20; i++) P.poolTick(50);
    ok('Pause: a dialog, and the shot clock is stopped', T.dialog === 'pause' && S.clockLeft === 45 && !P.poolCanAct());
    O.unpause();
    for (let i = 0; i < 20; i++) P.poolTick(50);
    ok('RESUME: the clock runs again', T.dialog === null && Math.abs(S.clockLeft - 44) < 1e-9, S.clockLeft);

    // One shot: the table is snapshotted at the boundary.
    const shooter = S.frame.turn;
    human(P, S);
    for (let i = 0; i < 4000 && (S.phase === 'strike' || S.phase === 'moving'); i++) P.poolTick(16);
    const snap = JSON.parse(P.store.poolTournament).snapshot;
    ok('after the shot the whole table is saved: the balls, the rules state, the clock', snap && snap.match === m1.id && snap.balls.length === 16 && snap.frame.turn === S.frame.turn && snap.frames === 0);
    ok('the table changing hands shows the hand-off', S.frame.over || S.frame.turn === shooter || S.handoff === S.frame.turn);

    // A reload mid-frame: the same table comes back.
    const P2 = L.game({ seed: 32, name: 'Ayesha', store: JSON.parse(JSON.stringify(P.store)) });
    P2.poolNewFrame(1);
    const t2 = P2.poolTourLoad();
    ok('a reload finds the tournament in progress', t2 && t2.id === t0.id && t2.current === m1.id);
    P2.poolS.tour.t = t2; P2.poolS.tour.dialog = 'resume';
    P2.poolTourOn.resumeTour();
    const S2 = P2.poolS;
    const same = S2.world.balls.every((b, i) => b.id === S.world.balls[i].id && Math.abs(b.x - S.world.balls[i].x) < 1e-9 && Math.abs(b.y - S.world.balls[i].y) < 1e-9 && b.state === S.world.balls[i].state);
    ok('RESUME puts back the table as it was after the last shot', P2.poolMode === 'tour' && same && S2.frame.turn === S.frame.turn && JSON.stringify(S2.frame.groups) === JSON.stringify(S.frame.groups));
    ok('…and whoever is on the shot takes the seat first', S2.handoff === S2.frame.turn);
    ok('…with the tournament\'s settings', S2.clockTotal === 45 && S2.guideMode === 'short' && S2.callEvery);

    // Frames until the match is won: the frame-over dialog says NEXT FRAME; breaks alternate.
    const finish = w => P.poolAfterTurn({ frameOver: true, winner: w, shooter: w, reason: 'eightPotted', foul: null, next: Object.assign({}, S.frame, { over: true, winner: w }) });
    const breakers = [S.breaker];
    finish(1);
    ok('a frame that leaves the match going: the frame-over dialog, scored for the match', S.phase === 'over' && S.result && S.result.recordLabel === 'MATCH · RACE TO 2' && S.result.record === '1–0' && S.frames.join() === '1,0');
    ok('the frame is in the saved bracket', JSON.parse(P.store.poolTournament).matches.find(m => m.id === m1.id).frames.length === 1);
    ok('tournament frames pay no XP and touch no quick-match record (Phase 8)', !P.log.xp.length && !P.store.poolRecord && !P.store.poolCpuRecord);
    P.poolOn.primary();
    breakers.push(S.breaker);
    ok('NEXT FRAME: the other player breaks, and takes the seat first', breakers[1] === 3 - breakers[0] && S.handoff === S.breaker && S.phase === 'bih');
    finish(1);
    ok('the match is won: no frame dialog, the result waits for the last pot to drop', S.result === null && T.pending > 0 && T.screen === null && !P.poolCanAct());
    for (let i = 0; i < 80; i++) P.poolTick(16);
    ok('…then the match result', T.screen === 'result' && T.t.current === null && P.ptById(T.t, m1.id).winner === m1.a);
    O.bracket();
    ok('CONTINUE: the bracket, on the next match\'s round', T.screen === 'bracket' && T.tab === P.ptNext(T.t).round);
    O.close();
    ok('leaving the bracket with no match in progress goes back to quick play, the table\'s settings with it',
       P.poolMode === 'cpu' && S.clockTotal === 30 && S.guideMode === 'full' && !S.callEvery && T.t && T.t.id === t0.id);

    // Pause → Leave for now keeps the match; the sheet resumes it.
    P.poolOn.tourGo(); O.play(); O.ready();
    const m2 = T.t.current;
    P.poolOn.tourPause(); O.leave();
    ok('Pause → Leave for now: back to quick play, the match kept', P.poolMode === 'cpu' && T.t.current === m2 && JSON.parse(P.store.poolTournament).current === m2);
    ok('the sheet\'s Tournament tab offers it back', P.poolTourSheet().saved && /vs/.test(P.poolTourSheet().where));
    P.poolOn.tourGo();
    ok('RESUME from the sheet: the same match, back on the table', P.poolMode === 'tour' && T.matchId === m2);

    // The rest of the tournament, seat 1 winning every frame; the final fills the cabinet.
    for (let guard = 0; guard < 40 && P.ptChampion(T.t) === null; guard++) {
        if (P.poolMode !== 'tour' || !T.t.current) { T.screen = null; O.play(); O.ready(); }
        finish(1);
        if (T.pending) { for (let i = 0; i < 80; i++) P.poolTick(16); } else P.poolOn.primary();
    }
    const champ = P.ptChampion(T.t);
    ok('the final won: the result screen, then the champion', champ !== null && T.screen === 'result');
    O.champion();
    ok('CONTINUE on the final: the champion screen', T.screen === 'champion');
    const cab = JSON.parse(P.store.poolTrophyCabinet);
    ok('the title is in the trophy cabinet, under the champion\'s name', cab.recent[0].id === t0.id && cab.titles[T.t.slots[champ].name.toLowerCase()][8] === 1);
    ok('a finished tournament is not kept to resume', P.store.poolTournament === undefined);
    O.cabinet();
    ok('Trophy cabinet from the champion, and back', T.screen === 'cabinet' && (O.cabinetBack(), T.screen === 'champion'));
    O.close();
    ok('closing the champion lets the tournament go', T.t === null && P.poolMode === 'cpu' && T.screen === null);

    // Abandon, corrupt and old saves.
    P.poolOn.tourGo(); O.start();
    ok('NEW: setup again, then a bracket saved', T.screen === 'bracket' && !!P.store.poolTournament);
    P.poolOn.tourAbandon();
    ok('Abandon asks first', T.dialog === 'abandon' && !!P.store.poolTournament);
    O.keep();
    ok('Keep tournament keeps it', T.dialog === null && !!T.t);
    P.poolOn.tourAbandon(); O.abandonYes();
    ok('ABANDON TOURNAMENT deletes it', T.t === null && P.store.poolTournament === undefined);
    const bad = L.game({ store: { poolTournament: '{"v":1,"slots":' } });
    ok('a corrupt save is dropped behind a toast, never half-loaded', bad.poolTourLoad() === null && bad.store.poolTournament === undefined && /Couldn't resume/.test(bad.poolS.toast.title));
    const old = L.game({ store: { poolTournament: JSON.stringify(Object.assign({}, t0, { v: 0 })) } });
    ok('so is one from another version', old.poolTourLoad() === null && old.store.poolTournament === undefined);
    const stale = JSON.parse(JSON.stringify(t0)); stale.current = 'r9m9';
    const st = L.game({ store: { poolTournament: JSON.stringify(stale) } });
    const back = st.poolTourLoad();
    ok('a save pointing at a match that is not there resumes to the bracket', back && back.current === null);
    const snapBad = L.game({ seed: 5, store: JSON.parse(JSON.stringify(P2.store)) });
    const sb = JSON.parse(snapBad.store.poolTournament); sb.snapshot.balls[3].x = 'NaN'; snapBad.store.poolTournament = JSON.stringify(sb);
    snapBad.poolNewFrame(1); snapBad.poolS.tour.t = snapBad.poolTourLoad(); snapBad.poolTourOn.resumeTour();
    ok('a damaged table snapshot restarts the frame instead', snapBad.poolMode === 'tour' && snapBad.poolS.frame.isBreak && snapBad.poolS.world.balls.length === 16);
}

// ── 8. Progression (Phase 8) ──────────────────────────────────────────
head('Progression (pool-game.js)');
{
    // A CPU frame pays by the tier locked when it started: 60 / 80 / 100 / 120, 15 for a loss.
    const pay = {};
    ['easy', 'normal', 'hard', 'pro'].forEach(tier => {
        const P = L.game({ prefs: { poolDifficulty: tier } });
        P.poolNewFrame(1); P.poolEndFrame({ winner: 1 });
        P.poolNewFrame(1); P.poolEndFrame({ winner: 2 });
        pay[tier] = P.log.xp.map(x => x.perf.xp).join('/') + (P.log.xp.every(x => x.perf.vsCPU && x.perf.tier === tier) ? '' : ' (untagged)');
    });
    ok('vs the CPU a win pays 60 / 80 / 100 / 120 by tier, and a loss 15', pay.easy === '60/15' && pay.normal === '80/15' && pay.hard === '100/15' && pay.pro === '120/15', JSON.stringify(pay));

    // The win is filed under the tier the frame was locked to, whatever is picked mid-frame.
    const P = L.game({ prefs: { poolDifficulty: 'hard' } });
    const S = P.poolS;
    P.poolNewFrame(1);
    S.phase = 'aim'; S.frame.isBreak = false;                          // play has started
    P.poolOn.difficulty('easy');
    ok('a pick made mid-frame leaves this frame on its tier', P.poolCpuTier === 'hard');
    P.poolEndFrame({ winner: 1 });
    ok('…so the win is filed under Hard and pays Hard', JSON.parse(P.store.poolWinsByTier).hard === 1 && !JSON.parse(P.store.poolWinsByTier).easy && P.log.xp[0].perf.xp === 100);
    ok('the all-time totals still count it', JSON.parse(P.store.poolWinsByMode).cpu === 1 && P.store.poolGamesWon === '1');
    P.poolNewFrame(1);
    ok('the next frame takes the new pick', P.poolCpuTier === 'easy');
    ok('the wins button shows the tier being played (0 on Easy, not the Hard win)', P.log.scoreBtn[P.log.scoreBtn.length - 1].best === 0 && P.poolS.wins === 0);
    P.poolEndFrame({ winner: 2 });
    ok('a loss files nothing by tier', JSON.parse(P.store.poolWinsByTier).easy === undefined || JSON.parse(P.store.poolWinsByTier).easy === 0);
    const byTier = P.poolWinsByTier();
    ok('poolWinsByTier reads all four tiers', Object.keys(byTier).join() === 'easy,normal,hard,pro' && byTier.hard === 1);
    const corrupt = L.game({ store: { poolWinsByTier: '{not json' } });
    ok('a corrupt poolWinsByTier reads as no wins', corrupt.poolWinsByTier().pro === 0);

    // 2 Players pays Player 1 as it always has, and files nothing by tier.
    const Q = L.game({});
    Q.togglePoolMode();
    Q.poolNewFrame(1); Q.poolEndFrame({ winner: 1 });
    Q.poolNewFrame(1); Q.poolEndFrame({ winner: 2 });
    ok('2 Players: Player 1 wins 80, loses 15; nothing is filed by tier', Q.log.xp.map(x => x.perf.xp).join('/') === '80/15' && !Q.log.xp[0].perf.vsCPU && !Q.store.poolWinsByTier);
    ok('the Pro win tags the tier the achievement check reads', (() => { const R = L.game({ prefs: { poolDifficulty: 'pro' } }); R.poolNewFrame(1); R.poolEndFrame({ winner: 1 }); const p = R.log.xp[0].perf; return p.won && p.vsCPU && p.tier === 'pro'; })());
}
{
    // Tournaments: 80 / 15 per match for the YOU seat only; other matches and byes pay nothing.
    const P = L.game({ seed: 51, name: 'Ayesha' });
    const S = P.poolS, T = S.tour, O = P.poolTourOn;
    P.poolNewFrame(1);
    P.poolOn.tourGo(); O.count('1'); O.count('1');                       // six players, two byes
    ['Bilal', 'Hamza', 'Sana', 'Usman', 'Zara'].forEach((n, i) => O.edit('name:' + (i + 1), n));
    O.start();
    const finish = w => P.poolAfterTurn({ frameOver: true, winner: w, shooter: w, reason: 'eightPotted', foul: null, next: Object.assign({}, S.frame, { over: true, winner: w }) });
    const you = T.t.slots.findIndex(s => s.you);
    const pays = [];
    for (let guard = 0; guard < 60 && P.ptChampion(T.t) === null; guard++) {
        if (P.poolMode !== 'tour' || !T.t.current) { T.screen = null; O.play(); O.ready(); }
        const m = P.ptById(T.t, T.matchId), mine = m.a === you || m.b === you;
        // You win your first match and lose the next; everyone else's goes to seat 1.
        const yourSeat = m.a === you ? 1 : 2, played = pays.filter(p => p.mine).length;
        const before = P.log.xp.length;
        finish(mine ? (played === 0 ? yourSeat : 3 - yourSeat) : 1);
        const fresh = P.log.xp.slice(before);
        if (T.pending) { pays.push({ mine, xp: fresh.map(x => x.perf.xp) }); for (let i = 0; i < 80; i++) P.poolTick(16); }
        else { if (fresh.length) pays.push({ mine, stray: true }); P.poolOn.primary(); }
    }
    const mineP = pays.filter(p => p.mine), others = pays.filter(p => !p.mine);
    ok('your matches pay once each: 80 won, then 15 lost', mineP.length === 2 && mineP[0].xp.join() === '80' && mineP[1].xp.join() === '15', JSON.stringify(mineP));
    ok('matches between other names pay nothing, and no frame pays on its own', others.every(p => !p.xp || !p.xp.length) && !pays.some(p => p.stray), JSON.stringify(others));
    ok('the award says it is a tournament match, not a CPU win', P.log.xp.every(x => x.perf.tour && !x.perf.vsCPU && x.perf.round));
    ok('the title pays nothing, and no CPU tier is touched', P.log.xp.length === 2 && !P.store.poolWinsByTier && !P.store.poolCpuRecord);
}

// ── 8b. The escape sweep (Phase 9) ────────────────────────────────────
head('Escapes (pool-ai.js)');
{
    // A real position (balance play, seed 4, shot 12): the CPU is on stripes with only the 11
    // left, snookered behind the solids. The old last resort, a blind roll at the nearest legal
    // ball, hit a solid first. Hard and pro now sweep the cue round for a legal first contact.
    const P = L.ai();
    const at = [[0, 470.841, 46.233], [2, 285.277, -141.786], [1, 479.415, -83.165], [8, 455.657, -15.608], [6, 257.967, 71.712],
        [5, 127.622, 110.832], [11, -127.626, -163.325], [4, 302.415, -25.411], [3, 356.728, 29.976]];
    const w = P.ppCreateWorld();
    w.balls = at.map(([id, x, y]) => P.ppMakeBall(id, x, y));
    for (let id = 1; id <= 15; id++) if (!at.some(a => a[0] === id)) w.balls.push(Object.assign(P.ppMakeBall(id, 0, 0), { state: 'pocketed' }));
    const frame = Object.assign(P.prNewFrame({ breaker: 1 }), { turn: 2, isBreak: false, groups: { 1: 'solids', 2: 'stripes' }, ballInHand: null, shots: 12 });
    const plan = tier => { const j = P.paPlan(w, frame, { tier, noise: false }); let n = 0; while (!j.step(3) && n++ < 5000); return j; };
    const hard = plan('hard');
    const v = P.paTrial(w, frame, 2, hard.shot).v;
    ok('snookered, hard sweeps and finds a legal escape', hard.plan === 'escape' && !v.foul, hard.plan + ' / ' + v.foul);
    const T = P.PA_TIERS.hard, keep = T.sweep;
    T.sweep = false;
    const blind = plan('hard');
    T.sweep = keep;
    ok('…where the blind roll it replaces fouls', blind.plan === 'fallback' && P.paTrial(w, frame, 2, blind.shot).v.foul === 'wrongBall', blind.plan);
    ok('pro sweeps too; easy and normal keep the blind roll (their fouls are part of their level)',
       plan('pro').plan === 'escape' && plan('easy').plan === 'fallback' && P.PA_TIERS.normal.sweep !== true);
    ok('pro replays its safeties for risk (robustSafe), as hard does', P.PA_TIERS.pro.robustSafe >= 3 && P.PA_TIERS.hard.robust >= 3);
}

// ── 9. Keys (a mouse game) ────────────────────────────────────────────
head('Keys (pool-game.js)');
{
    // Pool is played with the mouse. The one key it takes is ←/→ fine aim, 0.1°, while the
    // mouse is over the table or Max is open; nothing shoots, sets power or calls from the keyboard.
    const P = L.game({ seed: 61 });
    const S = P.poolS;
    P.poolNewFrame(1);
    S.attached = true; S.phase = 'aim'; S.placed = true;
    const key = (k, target) => P.poolOnKey({ key: k, shiftKey: false, target: target || {}, preventDefault() {}, stopImmediatePropagation() {} });
    const a0 = S.aim;
    key('ArrowLeft');
    ok('← does nothing unless the mouse is over the table', S.aim === a0);
    S.armed = true;
    key('ArrowLeft');
    ok('with the mouse over the table, ← turns the aim 0.1°', Math.abs((S.aim - a0) / (Math.PI / 180) - 0.1) < 1e-9);
    ['ArrowUp', 'Enter', ' ', 'q', ']'].forEach(k => key(k));
    ok('no key sets power, shoots or calls a pocket', S.power === 0 && S.phase === 'aim' && S.called === -1);
}

// ── 10. Snooker in the controller (S3) ─────────────────────────────────
head('Snooker in the controller (pool-game.js)');
// Seat 1 (and seat 2 in 2 Players) plays the snooker CPU's easy shots, without noise (cheap and
// sure), through the strike path the
// input uses; a choice after a foul takes the free ball when there is one.
function snkHuman(P, S) {
    if (S.phase === 'choice' && !S.handoff && !P.poolCpuTurn()) P.poolOn.choose(S.frame.pending.options.indexOf('free') >= 0 ? 'free' : 'play');
    if (S.phase === 'bih' && P.poolCanAct()) { const p = P.paSnPlace(S.world, S.frame, S.rng); P.prPlaceCue(S.world, p[0], p[1]); S.placed = true; S.phase = 'aim'; }
    if (S.phase === 'aim' && P.poolCanAct()) {
        const job = P.paSnPlan(S.world, S.frame, { rng: S.rng, tier: 'easy', noise: false });
        while (!job.step(1e9));
        if (job.shot.nominate >= 0) P.poolOn.nominate(job.shot.nominate);
        S.shot = job.shot; S.phase = 'strike'; S.strikeT = 0;
    }
}
function snkFrame(P, maxTicks) {
    const S = P.poolS;
    let n = 0;
    while (S.phase !== 'over' && n++ < (maxTicks || 400000)) {
        if (S.handoff) P.poolOn.ready();
        if (S.frame.turn === 1 || P.poolMode === 'pvp') snkHuman(P, S);
        P.poolTick(16);
    }
    return S;
}
// A table set by hand on the controller: [id, x, y] balls, the rest of 6 reds down.
function snkTable(P, cue, balls, frame) {
    const S = P.poolS, w = P.psCreateWorld();
    w.balls = [P.ppMakeBall(0, cue[0], cue[1])];
    [2, 3, 4, 5, 6, 7].concat([8, 9, 10, 11, 12, 13]).forEach(id => {
        const b = balls.find(q => q[0] === id);
        w.balls.push(Object.assign(P.ppMakeBall(id, b ? b[1] : 0, b ? b[2] : 0), b ? {} : { state: 'pocketed' }));
    });
    S.world = w;
    Object.assign(S.frame, { isBreak: false, ballInHand: null }, frame);
    S.phase = 'aim'; S.placed = false; S.nom = -1;
    return w;
}
const COLOURS = [2, 3, 4, 5, 6, 7].map(id => [id].concat([[-293.5, -81.8], [-293.5, 81.8], [-293.5, 0], [0, 0], [250, 0], [409.2, 0]][id - 2]));
{
    const P = L.game({ seed: 71, prefs: { snookerReds: 6 } }), S = P.poolS;
    P.poolNewFrame(1);
    const poolBalls = JSON.stringify(S.world.balls.map(b => [b.id, b.x, b.y]));
    P.poolSetVariant('snooker');
    ok('the cue game → snooker: its table (6 reds from ⚙️, so 13 balls), ball in hand in the D, the 45 s clock, its title',
       S.game === 'snooker' && S.world.balls.length === 13 && S.phase === 'bih' && S.frame.ballInHand === 'D' && S.clockTotal === 45 && P.poolRules().title === 'Snooker' &&
       P.prCanPlace(S.world, S.world.balls[0].x, S.world.balls[0].y, 'D') === null);
    ok('the Game mode sheet lists snooker\'s words, and the CPU is snooker\'s', P.poolRules().diffs[3].desc === 'Position and safety · call the colours' && P.poolRules().cpu.tiers.hard.label === 'Hard');
    P.poolSetVariant('pool');
    ok('switching back brings pool\'s frame back exactly as it was left', S.game === 'pool' && JSON.stringify(S.world.balls.map(b => [b.id, b.x, b.y])) === poolBalls && S.world.balls.length === 16);
    P.poolSetVariant('snooker');

    // Nomination: the padlock until a colour is tapped, only colours that may be nominated.
    snkTable(P, [-100, 0], COLOURS.concat([[8, 300, 40]]), { phase: 'colour' });
    let st = P.poolRules().status(S.frame, S.world);
    ok('after a red: a colour must be nominated, and the gauge is padlocked', st.needsNomination && st.nominable.join() === '2,3,4,5,6,7');
    P.poolOn.nominate(8);
    ok('a red cannot be nominated', S.nom === -1);
    P.poolOn.nominate(6);
    st = P.poolRules().status(S.frame, S.world);
    ok('tapping the pink nominates it; the padlock opens', S.nom === 6 && !st.needsNomination && st.on.ids.join() === '6');
    // The call pocket comes with a picked tier (lockCall), in Vs CPU; Adaptive hands no rule change.
    {
        const callOf = diff => { const Q = L.game({ seed: 73, prefs: { snookerDifficulty: diff } }); Q.poolSetVariant('snooker'); Q.poolNewFrame(1); return Q.poolS.frame.call; };
        ok('Vs CPU: hard calls the colours, pro every ball; easy, normal and Adaptive none', callOf('hard') === 'colours' && callOf('pro') === 'all' && callOf('easy') === 'off' && callOf('normal') === 'off' && callOf('adaptive') === 'off');
        const Q = L.game({ seed: 74 }); Q.poolSetVariant('snooker');
        const d = Q.poolTourSetupFresh(); Q.poolS.tour.setup = d;
        ok('a snooker tournament offers Off / Colours / All balls, Off to start', d.call === 'off' && d.calls.map(c => c[0]).join() === 'off,colours,all');
        Q.poolTourOn.set('call:colours'); const c1 = d.call; Q.poolTourOn.set('call:every'); const c2 = d.call;
        ok('…a pick is kept, and pool\'s own choices are not snooker\'s', c1 === 'colours' && c2 === 'off');
        Q.poolS.tour.t = { settings: { call: 'all', clock: 30, guide: 'full' } }; Q.poolTourApply();
        ok('…and its matches play by it', Q.poolS.callMode === 'all' && !Q.poolS.callEvery);
        // A snooker tournament from setup to champion, through the controller (S5).
        {
            const G = L.game({ seed: 77 }), GS = G.poolS;
            G.poolSetVariant('snooker');
            GS.tour.setup = G.poolTourSetupFresh();
            const d = GS.tour.setup;
            ['Bilal', 'Hamza', 'Sana'].forEach((nm, i) => G.poolTourOn.edit('name:' + (i + 1), nm));
            G.poolTourOn.set('clock:60'); G.poolTourOn.set('reds:6'); G.poolTourOn.set('call:all');
            ok('snooker\'s setup: 60 s, 6 reds, calls on every ball', d.game === 'snooker' && d.clock === 60 && d.reds === 6 && d.call === 'all');
            G.poolTourOn.start();
            const T = GS.tour;
            ok('…starts a snooker tournament with them', T.t.game === 'snooker' && T.t.settings.reds === 6 && T.t.settings.clock === 60 && T.t.settings.call === 'all');
            G.poolTourOn.play(); G.poolTourOn.ready();
            ok('its matches rack 6 reds, play to its clock and call every ball', GS.world.balls.length === 13 && GS.clockTotal === 60 && GS.frame.call === 'all');
            // A reload mid-frame: the table saved, the tournament read back as snooker's, the frame restored.
            GS.world.balls[3].x += 40; GS.frame.scores = { 1: 12, 2: 5 };
            G.poolTourSnapshot();
            const back = G.poolTourLoad(), mm = back && G.ptById(back, back.current);
            const x3 = GS.world.balls[3].x;
            GS.world.balls[3].x = 0;
            const restored = !!mm && G.poolTourRestore(back.snapshot, mm);
            ok('a reload mid-frame: the saved tournament is the snooker one, and its frame comes back as it was', !!back && back.game === 'snooker' && restored &&
               Math.abs(GS.world.balls[3].x - x3) < 1e-9 && GS.frame.scores[1] === 12 && GS.frame.reds === 6);
            // Every frame won by the upper line, 70–30 with a 45 break, until there is a champion.
            for (let guard = 0; guard < 40 && G.ptChampion(T.t) === null; guard++) {
                const m = G.poolTourMatch();
                if (!m) { G.poolTourOn.play(); G.poolTourOn.ready(); continue; }
                GS.rackId++;
                G.poolEndFrame({ winner: 1, next: { scores: { 1: 70, 2: 30 }, high: { 1: 45, 2: 12 } } });
                if (G.poolTourMatch() && G.poolTourMatch().status !== 'done') G.poolTourNextFrame();
                else { T.screen = null; T.matchId = null; }
            }
            const done = T.t && G.ptChampion(T.t) !== null ? T.t : null;
            const fm = done && done.matches.find(x => x.round === done.rounds - 1);
            ok('…played to a champion, each frame\'s points and the high break kept', !!fm && fm.points.every(pp => pp[0] === 70 && pp[1] === 30) && fm.high && fm.high.value === 45,
               fm && JSON.stringify({ points: fm.points, high: fm.high }));
            ok('…and it goes into snooker\'s cabinet, not pool\'s', GS.tour.cab && GS.tour.cab.recent.length === 1 && GS.tour.cab.recent[0].id === done.id);
            ok('…each of your matches pays as pool\'s does (80 won, 15 lost) as snooker XP; no break is kept (no CPU)',
               G.log.xp.length >= 1 && G.log.xp.every(x => x.type === 'snooker' && x.perf.tour && !x.perf.vsCPU && (x.perf.xp === 80 || x.perf.xp === 15)) && !G.store.snookerHighBreak,
               G.log.xp.map(x => x.type + ' ' + x.perf.xp).join(', '));
        }
        const Pp = L.game({ seed: 75 }), dp = Pp.poolTourSetupFresh();
        ok('pool\'s tournament keeps 8 only / every shot', dp.call === '8' && dp.calls.map(c => c[0]).join() === '8,every');
    }
    P.poolOn.nominate(7);
    ok('…and another colour may be tapped before the stroke', S.nom === 7 && !S.chipsOpen);
    P.poolOn.nominate(7);
    ok('the folded chip (the colour nominated) opens the chips, keeping it', S.nom === 7 && S.chipsOpen);
    P.poolOn.nominate(7);
    ok('…pressed again, they fold back', S.nom === 7 && !S.chipsOpen);
    P.poolOn.nominate(7); P.poolOn.nominate(5);
    ok('…or another colour from them, nominated, and folded', S.nom === 5 && !S.chipsOpen);
    // The shot on screen, for the HUD to keep its overlays off: aimed at the blue on its
    // spot, the path runs on to the pocket it is heading for, which is one of the circles.
    {
        const v = P.pcView({ kind: 'ortho', W: 1000, H: 520, s: 0.9 }), cue = P.poolCueBall(), blue = S.world.balls.find(b => b.id === 5);
        const pk = S.world.table.pockets[2], L = Math.hypot(pk.x - blue.x, pk.y - blue.y), ux = (blue.x - pk.x) / L, uy = (blue.y - pk.y) / L;
        cue.x = blue.x + ux * 200; cue.y = blue.y + uy * 200;
        S.aim = Math.atan2(-uy, -ux); S.phase = 'aim'; S.guideKey = ''; P.poolRefreshGuide();
        const sp = P.poolShotPath(v), end = sp && sp.segs[sp.segs.length - 1], pq = P.pcProject(v, [pk.x, pk.y, S.cfg.ballR]);
        ok('the shot path runs from the cue ball through the blue into the top-right pocket', !!sp && sp.dots.some(d => Math.hypot(d[0] - pq[0], d[1] - pq[1]) < 0.5 && d[2] > 5) &&
           Math.hypot(end[2] - pq[0], end[3] - pq[1]) < 0.5, sp && JSON.stringify(sp.dots.map(d => d.map(n => Math.round(n)))));
        S.guide = null;
        ok('…and nothing when there is no shot to show', P.poolShotPath(v) === null);
    }

    // A foul by you against the CPU: it chooses, after a beat, and says what it chose.
    snkTable(P, [-100, 0], COLOURS.concat([[8, 300, 40], [9, 320, -60]]), { phase: 'reds', turn: 1 });
    S.world.log = [{ type: 'strike', t: 0, ball: 0 }, { type: 'ball', t: 0.1, a: 0, b: 5 }];
    P.poolSettle();
    ok('your foul: the CPU is the chooser (CHOOSING), the table waits for it', S.phase === 'choice' && S.frame.pending.chooser === 2 && S.toast && S.toast.title === 'Foul · 5 to CPU' && !P.poolCanAct());
    for (let i = 0; i < 60 && S.phase === 'choice'; i++) P.poolTick(16);
    ok('…it chooses after its beat, and a notice says so', S.phase !== 'choice' && S.frame.turn === 2 && !S.frame.pending && S.toast && /^CPU (plays on|takes the free ball)$/.test(S.toast.title), S.toast && S.toast.title);

    // The CPU gives away a frame it cannot win (hard: in the clearance, needing more than a snooker).
    {
        const Q = L.game({ seed: 76, prefs: { snookerDifficulty: 'hard' } }), QS = Q.poolS;
        Q.poolSetVariant('snooker'); Q.poolNewFrame(1);
        snkTable(Q, [-100, 0], [[6, 250, 0], [7, 409.2, 0]], { phase: 'clearance', next: 6, turn: 2, scores: { 1: 40, 2: 0 } });
        for (let i = 0; i < 80 && QS.phase !== 'over'; i++) Q.poolTick(16);
        ok('the hard CPU, needing 5 snookers on the pink and black, concedes at its turn', QS.phase === 'over' && QS.frame.winner === 1 && QS.frame.conceded === 2, QS.phase + ' ' + QS.frame.conceded);
        ok('…its CPU thinks in 12 ms slices (a snooker trial is 5–8 ms)', Q.poolRules().cpu.slice === 12 && Q.POOL_GAMES.pool.cpu.slice === undefined);
    }

    // In-off: ball in hand in the D, the cue ball there.
    snkTable(P, [440, 190], COLOURS.concat([[8, 300, 40]]), { phase: 'reds', turn: 1 });
    S.world.log = [];
    P.ppStrike(S.world, { angle: Math.PI / 4, speed: 500 });
    P.ppSimulate(S.world, 30);
    P.poolSettle();
    ok('a cue ball in-off: the CPU\'s choice waits, the ball is in hand in the D', S.frame.ballInHand === 'D' && S.phase === 'choice');
    for (let i = 0; i < 60 && S.phase === 'choice'; i++) P.poolTick(16);
    const c = S.world.balls[0];
    ok('…then whoever plays places it in the D', S.phase === 'bih' && c.state !== 'pocketed' && P.prCanPlace(S.world, c.x, c.y, 'D') === null);
}
{
    // 2 Players: the hand-off first, then the choice; put back hands the table back.
    const P = L.game({ seed: 72, prefs: { snookerReds: 6 } }), S = P.poolS;
    P.poolSetVariant('snooker');
    P.poolSetMode('pvp');
    P.poolNewFrame(1);
    snkTable(P, [-30, 0], COLOURS.concat([[8, 290, 2], [9, 306, -4], [10, 322, 7]]), { phase: 'reds', turn: 1 });
    S.world.log = [{ type: 'strike', t: 0, ball: 0 }];
    P.poolSettle();
    ok('2 Players, a miss that leaves you snookered: the hand-off to the chooser comes first', S.phase === 'choice' && S.handoff === 2 && S.frame.pending.options.join() === 'play,back,free');
    P.poolOn.choose('play');
    ok('…no choice is taken before the seat is', S.phase === 'choice');
    P.poolOn.ready();
    ok('…READY keeps the foul toast and the FOUL tag while the choice is open', S.toast && S.toast.kind === 'foul' && S.fouled === 1 && !S.handoff);
    P.poolOn.choose('back');
    ok('Put back: the offender plays again, and takes the seat back', S.frame.turn === 1 && S.handoff === 1 && S.phase === 'aim' && !S.frame.freeBall && !S.toast);
    P.poolOn.ready();
    snkTable(P, [-30, 0], COLOURS.concat([[8, 290, 2], [9, 306, -4], [10, 322, 7]]), { phase: 'reds', turn: 1 });
    S.world.log = [{ type: 'strike', t: 0, ball: 0 }];
    P.poolSettle(); P.poolOn.ready();
    P.poolOn.choose('free');
    const st = P.poolRules().status(S.frame, S.world);
    ok('Free ball: the chooser plays, nominating the free ball first', S.frame.turn === 2 && S.frame.freeBall && st.needsNomination && st.nominable.length === 6);
    // Concede, confirmed.
    snkTable(P, [100, -150], COLOURS.concat([[8, 330, 40]]), { phase: 'reds', turn: 1, scores: { 1: 10, 2: 70 } });
    S.handoff = 0;
    ok('snookers required for the player at the table (60 behind, 35 left: 7)', P.poolRules().status(S.frame, S.world).snookersRequired[1] === 7);
    P.poolOn.concede();
    ok('Concede asks first, and the table waits', S.confirm && !P.poolCanAct());
    P.poolOn.concedeNo();
    ok('Keep playing closes it', !S.confirm && P.poolCanAct());
    P.poolOn.concede(); P.poolOn.concedeYes();
    ok('CONCEDE ends the frame for the other player, the dialog says so with the score',
       S.phase === 'over' && S.result && S.result.reason === 'Player 1 conceded.' && S.result.stats[0].value === '10–70' && S.frames[1] === 1);
}
{
    // Whole frames against the snooker CPU and in 2 Players, 6 reds: one award each, filed
    // where snooker files them, paid as snooker XP (S6).
    const store = {};
    let frames = 0, bad = 0, awards = 0;
    const paid = [];
    for (let k = 0; k < 2; k++) {
        const P = L.game({ seed: 80 + k, store, prefs: { snookerReds: 6 } });
        P.poolSetVariant('snooker');
        if (k === 1) P.poolSetMode('pvp');
        P.poolNewFrame(1);
        const S = snkFrame(P);
        if (S.phase === 'over') frames++; else bad++;
        P.poolEndFrame({ winner: S.frame.winner });
        awards += P.log.xp.length;
        paid.push(...P.log.xp.map(x => Object.assign({ type: x.type, high: S.frame.high[1] }, x.perf)));
    }
    const rec = JSON.parse(store.snookerRecord || 'null'), byMode = JSON.parse(store.snookerWinsByMode || 'null');
    ok('a frame against the CPU and a 2 Players frame, 6 reds, play to the end through the controller', frames === 2 && !bad, frames + ' of 2');
    ok('each is filed once, in snooker\'s own records (the second award of a rack is refused)', rec && rec.p1Wins + rec.p1Losses === 2 && byMode && !store.poolRecord, JSON.stringify(rec));
    ok('each pays once, as snooker XP with the reds and your best break, and pool\'s counts are untouched',
       awards === 2 && paid.every(x => x.type === 'snooker' && x.xp > 0 && x.reds === 6 && x.highBreak === x.high) && !store.poolGamesWon,
       paid.map(x => x.type + ' ' + x.xp + ' ' + x.reds + ' ' + x.highBreak).join(', '));
    ok('…the frame against the CPU keeps your best break, the 2 Players one does not raise it',
       (+store.snookerHighBreak || 0) === paid[0].high && paid[1].vsCPU === false);
    ok('a decided frame leaves no saved frame behind', !store.snookerFrame);
}
{
    // Snooker's XP table (S6, the user's numbers): a CPU win by the reds and the tier, a loss
    // 20, the break bonus for your best break won or lost; 2 Players as pool.
    const P = L.game({ seed: 3 }), SN = P.POOL_GAMES.snooker;
    const fr = (reds, high) => ({ reds, high: { 1: high || 0, 2: 99 } });
    const x = (won, vsCPU, tier, f) => SN.frameXP({ won, vsCPU, tier, frame: f });
    const T = { 15: [90, 120, 150, 180], 10: [75, 100, 125, 150], 6: [60, 80, 100, 120] };
    const tiers = ['easy', 'normal', 'hard', 'pro'];
    ok('a CPU win pays by the reds and the tier: 15 reds 90–180, 10 reds 75–150, 6 reds 60–120',
       Object.keys(T).every(r => tiers.every((t, i) => x(true, true, t, fr(+r)) === T[r][i])),
       Object.keys(T).map(r => tiers.map(t => x(true, true, t, fr(+r))).join('/')).join(' · '));
    ok('a loss pays 20 at any tier and any reds', tiers.every(t => x(false, true, t, fr(15)) === 20 && x(false, true, t, fr(6)) === 20));
    const bonus = h => x(true, true, 'normal', fr(15, h)) - 120;
    ok('the break bonus: +10 from 50, +25 from 100, +50 for a 147 (the best break only)',
       [0, 49, 50, 99, 100, 146, 147, 155].map(bonus).join() === '0,0,10,10,25,25,50,50', [0, 49, 50, 99, 100, 146, 147, 155].map(bonus).join());
    ok('…won or lost: a century in a lost frame pays 45', x(false, true, 'hard', fr(15, 104)) === 45);
    ok('…only seat 1\'s break counts (the CPU\'s 99 pays you nothing)', x(true, true, 'easy', fr(10)) === 75);
    ok('the most a frame can pay is 230 (pro, 15 reds, 147+), inside the bot\'s 250 a game',
       x(true, true, 'pro', fr(15, 155)) === 230 && 230 <= 250 && tiers.every(t => [15, 10, 6].every(r => x(true, true, t, fr(r, 155)) <= 230)));
    ok('2 Players pays as pool, 80 / 15, with no break bonus', x(true, false, null, fr(15, 147)) === 80 && x(false, false, null, fr(15, 147)) === 15);
    ok('the award reports the reds and your best break, never past 155', JSON.stringify(SN.xpPerf(fr(10, 64))) === '{"reds":10,"highBreak":64}' && SN.xpPerf({ reds: 15, high: { 1: 400 } }).highBreak === 155);
    ok('pool\'s award reports nothing more, and pays as before', JSON.stringify(P.POOL_GAMES.pool.xpPerf()) === '{}' && P.POOL_GAMES.pool.frameXP({ won: true, vsCPU: true, tier: 'pro' }) === 120);
    // Through the controller: a Pro win with a 64 break, a Pro loss with a 30 break.
    const store = {};
    const Q = L.game({ seed: 4, store, prefs: { snookerDifficulty: 'pro' } }), QS = Q.poolS;
    Q.poolSetVariant('snooker'); Q.poolNewFrame(1);
    Q.poolEndFrame({ winner: 1, next: Object.assign({}, QS.frame, { high: { 1: 64, 2: 20 } }) });
    Q.poolNewFrame(2);
    Q.poolEndFrame({ winner: 2, next: Object.assign({}, QS.frame, { high: { 1: 30, 2: 88 } }) });
    ok('a Pro win with a 64 break pays 190, tagged snooker, Pro, 15 reds, the 64', Q.log.xp[0].type === 'snooker' && Q.log.xp[0].perf.xp === 190 &&
       Q.log.xp[0].perf.tier === 'pro' && Q.log.xp[0].perf.vsCPU && Q.log.xp[0].perf.reds === 15 && Q.log.xp[0].perf.highBreak === 64, JSON.stringify(Q.log.xp[0]));
    ok('…a loss with a 30 break pays 20, and the High break stays 64 (the CPU\'s 88 is not yours)', Q.log.xp[1].perf.xp === 20 && store.snookerHighBreak === '64', store.snookerHighBreak);
    ok('…filed under Pro, and nothing under pool', JSON.parse(store.snookerWinsByTier).pro === 1 && !store.poolWinsByTier && !store.poolGamesWon);
}
{
    // A reload: the saved frame at every shot boundary, and back as it was.
    const store = {};
    const P = L.game({ seed: 90, store, prefs: { snookerReds: 6 } }), S = P.poolS;
    P.poolSetVariant('snooker');
    P.poolNewFrame(1);
    snkHuman(P, S);
    for (let i = 0; i < 4000 && (S.phase === 'strike' || S.phase === 'moving'); i++) P.poolTick(16);
    const saved = store.snookerFrame && JSON.parse(store.snookerFrame);
    ok('a snooker frame is saved at the shot boundary', !!saved && saved.game === 'snooker' && saved.balls.length === 13 && saved.frame.shots === 1);
    const Q = L.game({ seed: 91, store, prefs: { snookerReds: 6 } });
    Q.poolUseGame('snooker');
    const back = Q.poolRestoreTable(Q.poolLoadSaved());
    ok('…and a reload brings it back: the balls, the score, whose turn', back && JSON.stringify(Q.poolS.world.balls.map(b => [b.id, b.x, b.y, b.state])) === JSON.stringify(S.world.balls.map(b => [b.id, b.x, b.y, b.state])) &&
       Q.poolS.frame.turn === S.frame.turn && JSON.stringify(Q.poolS.frame.scores) === JSON.stringify(S.frame.scores));
    ok('pool keeps no such save', (() => { const G = L.game({ seed: 92, store: {} }); G.poolNewFrame(1); G.poolSaveFrame(); return !Object.keys(G.store).some(k => /Frame$/.test(k)); })());
    // Switching mid-shot: the shot is run to rest and judged, then parked.
    for (let i = 0; i < 4000 && S.phase !== 'moving'; i++) { if (S.frame.turn === 1) snkHuman(P, S); P.poolTick(16); }
    const shots = S.frame.shots;
    P.poolSetVariant('pool');
    ok('switching mid-shot: the shot is run to rest and judged, then parked', S.game === 'pool' && P.poolS.parked.snooker && P.poolS.parked.snooker.frame.shots === shots + 1);
    P.poolSetVariant('snooker');
    ok('…and it is there when snooker comes back', S.game === 'snooker' && S.frame.shots === shots + 1 && !P.poolS.parked.snooker);
    // Reds from ⚙️: a fresh frame re-racks; once play has started it waits.
    P.poolNewFrame(1);
    P.host.userPreferences.snookerReds = 10; P.poolOnPrefChange('snookerReds');
    ok('⚙️ Snooker Reds re-racks a fresh frame (10 reds, 17 balls)', S.world.balls.length === 17 && S.frame.reds === 10);
    S.frame.isBreak = false;
    P.host.userPreferences.snookerReds = 15; P.poolOnPrefChange('snookerReds');
    ok('…and leaves a frame in play alone', S.world.balls.length === 17);
    // The clock: 45 s, and out of time is a foul with the choice.
    P.poolSetMode('pvp');
    snkTable(P, [-100, 0], COLOURS.concat([[8, 300, 40]]), { phase: 'reds', turn: 1 });
    S.handoff = 0; S.clockLeft = 0.01;
    P.poolTick(16);
    ok('out of time: a foul (4), the choice to the other player', S.phase === 'choice' && S.frame.pending && S.frame.scores[2] >= 4 && S.toast && /Out of time/.test(S.toast.sub));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
