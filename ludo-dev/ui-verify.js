// Interaction-layer verification: the turn state machine, dice tumble, hop
// animation, turn clock, pointer hit-testing, and the anti-farm guards on
// startLudoGame / endLudoGame.
//
// Time is simulated by pumping ludoUpdate(dt) rather than waiting on real
// frames, so the whole suite runs in milliseconds and is fully deterministic.

const { ctx: rec } = require('./canvas-stub')(344, 416);

// Canvas laid out at half scale, to prove hit-testing is scale-aware.
const RECT = { left: 40, top: 20, width: 172, height: 208 };
const canvasStub = {
    width: 0, height: 0,
    getContext: () => rec,
    getBoundingClientRect: () => RECT,
    addEventListener: (t, f) => { (canvasStub._l[t] = canvasStub._l[t] || []).push(f); },
    removeEventListener: (t, f) => {
        if (canvasStub._l[t]) canvasStub._l[t] = canvasStub._l[t].filter(x => x !== f);
    },
    _l: {},
};
global.document = { getElementById: id => (id === 'ludo-canvas' ? canvasStub : null) };

let rafCount = 0, rafCancelled = 0;
global.requestAnimationFrame = () => ++rafCount;
global.cancelAnimationFrame  = () => { rafCancelled++; };

const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
};

let xpCalls = [];
global.awardGameXP = (type, perf) => { xpCalls.push({ type, perf }); };
global.getFrameInterval = () => 0;

const load = require('./load');
const { forceDice, restoreDice, stepOnRing } = load;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else      { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);

// Advance the simulated clock in small slices so timers and animations tick.
function pump(L, ms, slice) {
    const step = slice || 16;
    for (let el = 0; el < ms; el += step) L.ludoUpdate(step);
}

function fresh(prefs) {
    Object.keys(store).forEach(k => delete store[k]);
    xpCalls = [];
    canvasStub._l = {};
    const L = load(prefs);
    L.initLudoGame();
    return L;
}

// Board coords -> client coords for the half-scale canvas.
function click(L, bx, by) {
    L.handleLudoPointerDown({
        clientX: RECT.left + bx * (RECT.width / L.LUDO_CANVAS_W),
        clientY: RECT.top  + by * (RECT.height / L.LUDO_CANVAS_H),
        preventDefault() {},
    });
}
function diceCenter(L) {
    const seat = L.LUDO_SEATS[L.active[L.turn]];
    return {
        x: L.LUDO_CANVAS_W / 2,
        y: seat.strip === 'top' ? L.LUDO_STRIP_H / 2 : L.LUDO_CANVAS_H - L.LUDO_STRIP_H / 2,
    };
}

// ═══════════════════════════════════════════════════════════════════════
head('Canvas & lifecycle');
{
    const L = fresh();
    ok('canvas sized from the constants',
       canvasStub.width === L.LUDO_CANVAS_W && canvasStub.height === L.LUDO_CANVAS_H,
       `${canvasStub.width}×${canvasStub.height}`);
    ok('the test rect matches those constants at half scale',
       RECT.width * 2 === L.LUDO_CANVAS_W && RECT.height * 2 === L.LUDO_CANVAS_H,
       `rect ${RECT.width}×${RECT.height} vs canvas ${L.LUDO_CANVAS_W}×${L.LUDO_CANVAS_H}`);
    ok('board is 300px square with equal strips',
       L.LUDO_BOARD === 300 && L.LUDO_CANVAS_H === 300 + L.LUDO_STRIP_H * 2);
    // The dice turn-ring must not reach the board frame (inset 8px).
    ok('turn ring clears the board frame', L.LUDO_STRIP_H / 2 + 19 <= L.LUDO_STRIP_H - 8,
       `strip=${L.LUDO_STRIP_H}`);
    ok('mousedown and touchstart bound',
       (canvasStub._l.mousedown || []).length === 1 && (canvasStub._l.touchstart || []).length === 1);
    ok('starts idle, not started', L.phase === 'idle' && L.started === false);
    ok('an animation frame is running', L.animFrame !== null);

    const before = rafCancelled;
    L.cleanupLudoGame();
    ok('cleanup cancels the animation frame', rafCancelled === before + 1);
    ok('cleanup detaches both listeners',
       (canvasStub._l.mousedown || []).length === 0 && (canvasStub._l.touchstart || []).length === 0);
    ok('cleanup clears any pending timer', L.pending === null);
}

// ═══════════════════════════════════════════════════════════════════════
head('Turn state machine');
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    ok('play → awaitRoll', L.phase === 'awaitRoll');
    ok('turn clock is full', Math.abs(L.turnLeft - L.LUDO_TURN_CLOCK) < 1e-9);

    forceDice(6);
    L.ludoDoRoll();
    ok('rolling starts a tumble', L.phase === 'rolling' && L.diceSpin > 0);
    pump(L, L.LUDO_DICE_MS + 40);
    ok('tumble settles on the rolled face', L.diceFace === 6, `face=${L.diceFace}`);
    ok('a 6 opens four release moves', L.phase === 'awaitMove' && L.legal.length === 4);

    L.ludoPlayMove(L.legal[0]);
    ok('choosing a move starts the hop', L.phase === 'moving' && L.hop !== null);
    pump(L, L.LUDO_HOP_MS * 2 + 40);
    ok('hop completes and the token leaves base', !L.tok(0, 0).inBase && L.tok(0, 0).step === 0);
    ok('a 6 keeps the turn with the same player', L.turn === 0 && L.phase === 'awaitRoll');
    restoreDice();
}
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    forceDice(3);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    ok('a dead roll shows a banner naming the roll',
       L.banner && /rolled 3/i.test(L.banner.text), L.banner && L.banner.text);
    pump(L, L.LUDO_PASS_MS + 60);
    ok('and passes to the next player', L.turn === 1 && L.phase === 'awaitRoll');
    restoreDice();
}

// ═══════════════════════════════════════════════════════════════════════
head('Hop animation');
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 10);
    forceDice(5);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    const m = L.legal.find(x => x.token.i === 0 && !x.release);
    L.ludoPlayMove(m);
    ok('path has one entry per square crossed', L.hop.path.length === 5,
       `got ${L.hop && L.hop.path.length}`);

    // Position must stay finite and inside the canvas the whole way, including
    // the four diagonal corner turns.
    let bad = 0;
    for (let i = 0; i < 5 * (L.LUDO_HOP_MS / 8) + 12; i++) {
        if (L.hop) {
            const p = L.ludoPosForStep(0, 0, L.hop.path[L.hop.idx]);
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad++;
        }
        L.ludoUpdate(8);
    }
    ok('every intermediate position is finite', bad === 0);
    ok('token lands exactly on the destination', L.tok(0, 0).step === 15,
       `step=${L.tok(0, 0).step}`);
    ok('hop cleared afterwards', L.hop === null);
    restoreDice();
}
{
    // A hop that crosses a diagonal corner turn must still finish cleanly.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 2);          // ring 2 → crossing ring 4→5, the first corner
    forceDice(5);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    L.ludoPlayMove(L.legal.find(x => x.token.i === 0 && !x.release));
    pump(L, L.LUDO_HOP_MS * 6 + 60);
    ok('a hop across a corner turn lands correctly', L.tok(0, 0).step === 7,
       `step=${L.tok(0, 0).step}`);
    restoreDice();
}

// ═══════════════════════════════════════════════════════════════════════
head('Auto-play and auto-pass');
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 10);
    for (let i = 1; i < 4; i++) L.place(0, i, 56);   // only one movable token
    forceDice(4);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    ok('exactly one legal move', L.legal.length === 1);
    ok('it does not fire instantly', L.phase === 'awaitMove');
    pump(L, L.LUDO_AUTOPLAY_MS + 60);
    ok('it auto-plays after the delay', L.phase !== 'awaitMove');
    pump(L, L.LUDO_HOP_MS * 5 + 60);
    ok('and the token actually moved', L.tok(0, 0).step === 14);
    restoreDice();
}

// ═══════════════════════════════════════════════════════════════════════
head('Turn clock');
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    ok('clock counts down while awaiting a roll',
       (pump(L, 2000), L.turnLeft < L.LUDO_TURN_CLOCK && L.turnLeft > 0));

    forceDice(6);
    L.turnLeft = 0.05;
    pump(L, 200);
    ok('expiry auto-rolls', L.phase === 'rolling' || L.phase === 'awaitMove');
    ok('and the clock is reset', L.turnLeft > L.LUDO_TURN_CLOCK - 1);
    restoreDice();
}
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 10);
    L.place(0, 1, 20);
    forceDice(4);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    ok('two choices wait for the player', L.phase === 'awaitMove' && L.legal.length >= 2);
    L.turnLeft = 0.05;
    pump(L, 200);
    ok('expiry auto-moves rather than stalling', L.phase === 'moving' || L.phase === 'awaitRoll');
    restoreDice();
}

// ═══════════════════════════════════════════════════════════════════════
head('Pointer input (scale-aware)');
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    const d = diceCenter(L);
    ok('dice hit-test accepts its centre', L.ludoDiceHit(d));
    ok('dice hit-test rejects the board middle',
       !L.ludoDiceHit({ x: L.LUDO_CANVAS_W / 2, y: L.LUDO_CANVAS_H / 2 }));

    forceDice(6);
    click(L, d.x, d.y);
    ok('tapping the dice rolls, at half canvas scale', L.phase === 'rolling');
    pump(L, L.LUDO_DICE_MS + 40);
    ok('four release moves offered', L.legal.length === 4);

    L.ludoRender();                                  // populates renderPos
    const target = L.legal[2].token;
    const rp = L.renderPos.get(target);
    click(L, rp.x, rp.y);
    ok('tapping a token plays that exact token',
       L.phase === 'moving' && L.hop.move.token === target);
    restoreDice();
}
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    forceDice(6);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    L.ludoRender();
    click(L, 5, L.LUDO_CANVAS_H / 2);                // empty board edge
    ok('a tap far from any token is ignored', L.phase === 'awaitMove');
    restoreDice();
}
{
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.turn = 1;                                      // CPU seat (green)
    const d = diceCenter(L);
    forceDice(6);
    click(L, d.x, d.y);
    ok('input is ignored during the CPU turn', L.phase === 'awaitRoll');
    restoreDice();
}
{
    const L = fresh();
    ok('input before ▶ Play does nothing',
       (click(L, 184, 26), L.phase === 'idle'));
}

// ═══════════════════════════════════════════════════════════════════════
head('Roll recap');
{
    // The case that prompted this: everything in base, roll a 4, turn passes.
    // Previously nothing on screen said what had been rolled.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    ok('no recap before anything is rolled', L.recap === null);

    forceDice(4);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    ok('the dead roll is recapped', L.recap && L.recap.faces.join() === '4',
       JSON.stringify(L.recap));
    ok('recap is attributed to the player who rolled it', L.recap.ci === 0);
    ok('the banner names the number and the reason',
       L.banner && /rolled 4/i.test(L.banner.text) && /need a 6/i.test(L.banner.text),
       L.banner && L.banner.text);
    restoreDice();
}
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    forceDice(4);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + L.LUDO_PASS_MS + 80);
    ok('recap survives into the next player\'s turn', L.recap !== null);
    L.ludoDoRoll();
    ok('and clears the moment the next roll starts', L.recap === null);
    restoreDice();
}
{
    // Three sixes must recap all three, including the voided one.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 10);
    forceDice(6);
    for (let i = 0; i < 2; i++) {
        L.ludoDoRoll();
        pump(L, L.LUDO_DICE_MS + 40);
        L.ludoPlayMove(L.legal.find(m => !m.release) || L.legal[0]);
        pump(L, L.LUDO_HOP_MS * 8 + 60);
    }
    ok('two sixes so far, no handover yet', L.recap === null && L.turnRolls.length === 2);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    ok('the voided third six is still recapped',
       L.recap && L.recap.faces.join() === '6,6,6', JSON.stringify(L.recap));
    restoreDice();
}
{
    // An extra turn accumulates rather than snapshotting mid-turn.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 10);
    forceDice(6);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    L.ludoPlayMove(L.legal.find(m => !m.release));
    pump(L, L.LUDO_HOP_MS * 8 + 60);
    ok('a 6 grants an extra roll without recapping', L.recap === null);
    ok('the 6 is held in the running tally', L.turnRolls.join() === '6');

    forceDice(3);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    L.ludoPlayMove(L.legal[0]);
    pump(L, L.LUDO_HOP_MS * 5 + 60);
    ok('handover recaps the whole turn, both rolls',
       L.recap && L.recap.faces.join() === '6,3', JSON.stringify(L.recap));
    restoreDice();
}
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    forceDice(4);
    L.ludoDoRoll();
    pump(L, L.LUDO_DICE_MS + 40);
    L.resetLudoGame();
    ok('reset clears the recap', L.recap === null && L.turnRolls.length === 0);
    restoreDice();
}
{
    // Layout: the recap must not collide with the live dice, in any mode.
    const L = fresh();
    const CHIP_W = 88, PAD = 6, GAP = 6, RING = 19;
    const WIDEST = Math.max(3 * 15 + 2 * 2, 4 * 11 + 3 * 2);   // 3 big or 4 small
    const leftEnd    = PAD + CHIP_W + GAP + WIDEST;
    const rightStart = L.LUDO_CANVAS_W - CHIP_W - PAD - GAP - WIDEST;
    ok('recap beside a left chip clears the dice ring',
       leftEnd <= L.LUDO_CANVAS_W / 2 - RING, `${leftEnd} vs ${L.LUDO_CANVAS_W / 2 - RING}`);
    ok('recap beside a right chip clears the dice ring',
       rightStart >= L.LUDO_CANVAS_W / 2 + RING,
       `${rightStart} vs ${L.LUDO_CANVAS_W / 2 + RING}`);

    // And it renders in every mode with a recap present.
    ['cpu2', 'pvp2', 'pvp3', 'pvp4'].forEach(m => {
        L.ludoSetMode(m);
        L.recap = { ci: L.active[0], faces: [6, 6, 6] };
        L.ludoRender();
        L.recap = { ci: L.active[L.active.length - 1], faces: [1, 2, 3, 4, 5] };
        L.ludoRender();
    });
    ok('recap renders in every mode, including >4 rolls', true);
}

// ═══════════════════════════════════════════════════════════════════════
head('CPU seat plays itself');
{
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.turn = 1;
    L.ludoBeginTurn();
    ok('CPU schedules its own roll', L.pending !== null);
    forceDice(6);
    pump(L, L.LUDO_CPU_THINK_MS + L.LUDO_DICE_MS + 80);
    ok('CPU rolled and has moves', L.legal.length > 0 || L.phase === 'moving');
    pump(L, L.LUDO_CPU_THINK_MS + L.LUDO_HOP_MS * 3 + 120);
    ok('CPU committed a move', L.tokens.some(t => t.ci === 2 && !t.inBase));
    restoreDice();
}

// ═══════════════════════════════════════════════════════════════════════
head('Full match, driven end to end');
{
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    let guard = 0;
    while (L.phase !== 'over' && guard++ < 400000) L.ludoUpdate(16);
    ok('a real-time PvCPU match reaches a result', L.phase === 'over', `guard=${guard}`);
    ok('someone brought all four home',
       L.active.some(ci => L.ludoTokensHome(ci) === 4));
    ok('XP awarded exactly once', xpCalls.length === 1, `${xpCalls.length} calls`);
    ok('render survives the game-over overlay', (L.ludoRender(), true));
}

// ═══════════════════════════════════════════════════════════════════════
head('Anti-farm guards');
{
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    for (let i = 0; i < 4; i++) L.place(0, i, 56);
    L.placements.push(0);
    L.phase = 'over';
    const first = L.endLudoGame();
    ok('first end awards XP', xpCalls.length === 1 && first > 0, `xp=${first}`);
    L.endLudoGame(); L.endLudoGame();
    ok('endLudoGame is idempotent', xpCalls.length === 1, `${xpCalls.length} calls`);

    const winsAfter = L.ludoLoadWins();
    L.startLudoGame();
    ok('▶ Play on a finished board resets instead of re-awarding',
       xpCalls.length === 1 && L.tokens.every(t => t.inBase));
    ok('and the win count did not double', L.ludoLoadWins() === winsAfter);
}
{
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.place(0, 0, 30);
    L.resetLudoGame();
    ok('reset mid-match awards nothing', xpCalls.length === 0);
    ok('reset returns every token to base', L.tokens.every(t => t.inBase));
    ok('reset clears the started flag', L.started === false && L.phase === 'idle');
}
{
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.place(0, 0, 30);
    L.cycleLudoModeAndReset();
    ok('switching mode mid-match awards nothing', xpCalls.length === 0);
    ok('and clears the board', L.tokens.every(t => t.inBase));
}

// ═══════════════════════════════════════════════════════════════════════
head('XP and records');
{
    // PvP hot-seat is a flat award and must not touch the CPU record.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    for (let i = 0; i < 4; i++) L.place(0, i, 56);
    L.placements.push(0);
    const xp = L.endLudoGame();
    ok('hot-seat pays a flat 20', xp === 20, `xp=${xp}`);
    ok('hot-seat does not touch ludoGamesWon', L.ludoLoadWins() === 0);
    ok('hot-seat does not touch ludoRecord',
       L.ludoLoadRecord().wins === 0 && L.ludoLoadRecord().losses === 0);
}
{
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.cpuTier = 'hard';
    for (let i = 0; i < 4; i++) L.place(0, i, 56);
    L.placements.push(0);
    L.stats[0].captures = 6;
    const xp = L.endLudoGame();
    // (90 win + 32 tokens + 18 captures) × 1.35 hard × 1.0 (2P) = 189
    ok('a hard 2P win scores 189', xp === 189, `xp=${xp}`);
    ok('win increments ludoGamesWon', L.ludoLoadWins() === 1);
    ok('win recorded in ludoRecord', L.ludoLoadRecord().wins === 1);
    ok('inside the 300 XP clamp', xp <= 300);
}
{
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.cpuTier = 'easy';
    for (let i = 0; i < 4; i++) L.place(2, i, 56);
    L.placements.push(2);
    const xp = L.endLudoGame();
    ok('a loss still pays something', xp > 0, `xp=${xp}`);
    ok('loss does not increment ludoGamesWon', L.ludoLoadWins() === 0);
    ok('loss recorded in ludoRecord', L.ludoLoadRecord().losses === 1);
    ok('easy tier scales the award down', xp < 60, `xp=${xp}`);
}
{
    // Worst case must stay under the anti-cheat ceiling.
    const L = fresh();
    L.ludoSetMode('pvp4');
    L.active = [0, 1, 2, 3];
    L.ludoSetMode('cpu2');
    L.cpuTier = 'hard';
    L.startLudoGame();
    L.active = [0, 1, 2, 3];
    for (let i = 0; i < 4; i++) L.place(0, i, 56);
    L.placements.push(0);
    L.stats[0].captures = 99;
    const xp = L.endLudoGame();
    ok(`max realistic award stays under 300 (${xp})`, xp <= 300);
}
{
    const L = fresh();
    store.ludoRecord = JSON.stringify({ wins: 9, losses: 1 });
    L.initLudoGame();
    L.startLudoGame();
    ok('tier is locked from the stored record at match start', L.cpuTier === 'hard',
       `tier=${L.cpuTier}`);
}
{
    const L = fresh();
    store.ludoRecord = 'not json at all';
    ok('a corrupt ludoRecord does not throw',
       (L.initLudoGame(), L.cpuTier === 'normal'));
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(fail ? 1 : 0);
