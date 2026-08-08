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
// Roll a whole sequence: each face in turn, letting 6s buy another die.
// Leaves the game in whatever phase the last roll produced.
function rollSeq(L, faces) {
    faces.forEach(f => {
        forceDice(f);
        L.ludoDoRoll();
        pump(L, L.LUDO_DICE_MS + 40);
    });
    restoreDice();
}

function diceCenter(L) {
    const seat = L.ludoSeat(L.active[L.turn]);
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
    // A 6 hands the dice straight back rather than forcing a move.
    ok('a 6 returns to awaitRoll', L.phase === 'awaitRoll', L.phase);
    ok('and banks the die', L.pool.join() === '6');
    restoreDice();

    rollSeq(L, [2]);
    ok('the non-6 closes the sequence', L.phase === 'awaitMove');
    ok('pool is 6,2', L.pool.join() === '6,2');
    ok('release moves are offered for the 6',
       L.legal.filter(m => m.release && m.value === 6).length === 4);

    const rel = L.legal.filter(m => m.release && m.value === 6)[0];
    L.ludoPlayMove(rel);
    ok('choosing a move starts the hop', L.phase === 'moving' && L.hop !== null);
    pump(L, L.LUDO_HOP_MS * 2 + 40);
    ok('hop completes and the token leaves base', !L.tok(0, 0).inBase && L.tok(0, 0).step === 0);
    ok('the 6 is spent, the 2 remains', L.pool.join() === '2', L.pool.join());
    ok('still the same player, still spending', L.turn === 0 && L.phase === 'awaitMove');
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
    restoreDice();
    ok('the 6 hands the dice back', L.phase === 'awaitRoll');

    // Close the sequence with a 6 as well, so every token has exactly one
    // playable value and a tap moves it without asking.
    rollSeq(L, [6, 3]);
    ok('four release moves offered', L.legal.filter(m => m.release).length === 4);

    L.ludoRender();                                  // populates renderPos
    const target = L.legal.filter(m => m.release)[2].token;
    const rp = L.renderPos.get(target);
    click(L, rp.x, rp.y);
    ok('tapping a based token plays that exact token',
       L.phase === 'moving' && L.hop.move.token === target,
       L.phase);
}
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    rollSeq(L, [6, 3]);
    L.ludoRender();
    click(L, 5, L.LUDO_CANVAS_H / 2);                // empty board edge
    ok('a tap far from any token is ignored', L.phase === 'awaitMove');
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
head('Die-choice popover');
{
    // 6,6,5 with one token already out: that token can spend the 6 or the 5,
    // so tapping it must ask rather than guess.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 10);
    rollSeq(L, [6, 6, 5]);
    ok('the sequence banked three dice', L.pool.join() === '6,6,5', L.pool.join());
    ok('and closed into awaitMove', L.phase === 'awaitMove');

    const out = L.tok(0, 0);
    ok('the token on the board can spend either value',
       L.ludoValuesForToken(0, out).join() === '5,6');
    ok('a based token can only spend a 6',
       L.ludoValuesForToken(0, L.tok(0, 1)).join() === '6');

    L.ludoRender();
    click(L, L.renderPos.get(out).x, L.renderPos.get(out).y);
    ok('tapping the ambiguous token opens a popover', L.popover !== null);
    ok('it did not move yet', L.phase === 'awaitMove' && L.tok(0, 0).step === 10);

    const lay = L.ludoPopoverLayout();
    ok('the popover offers both values', lay && lay.values.join() === '5,6');
    ok('it stays inside the board', lay.x >= L.LUDO_BOARD_X &&
       lay.x + lay.w <= L.LUDO_BOARD_X + L.LUDO_BOARD);

    // Pick the 6.
    const six = lay.cells.filter(c => c.value === 6)[0];
    click(L, six.x, six.y);
    ok('tapping a value plays that value', L.phase === 'moving' && L.hop.move.value === 6);
    pump(L, L.LUDO_HOP_MS * 8 + 60);
    ok('the token advanced by 6', L.tok(0, 0).step === 16, `step=${L.tok(0, 0).step}`);
    ok('one 6 was spent', L.pool.join() === '6,5', L.pool.join());
    ok('the popover closed', L.popover === null);
}
{
    // Tapping a token with only one playable value must not open a popover.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    rollSeq(L, [6, 3]);
    const based = L.legal.filter(m => m.release)[0].token;
    L.ludoRender();
    click(L, L.renderPos.get(based).x, L.renderPos.get(based).y);
    ok('one playable value moves immediately', L.popover === null && L.phase === 'moving');
}
{
    // Tapping away dismisses without moving anything.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 10);
    rollSeq(L, [6, 6, 5]);
    L.ludoRender();
    const out = L.tok(0, 0);
    click(L, L.renderPos.get(out).x, L.renderPos.get(out).y);
    ok('popover open', L.popover !== null);
    click(L, L.LUDO_BOARD_X + 4, L.LUDO_BOARD_Y + L.LUDO_BOARD - 4);
    ok('a tap outside dismisses it', L.popover === null);
    ok('and nothing moved', L.tok(0, 0).step === 10 && L.pool.length === 3);
}
{
    // The whole 6,6,5 spend: release two tokens, then advance one by 5.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    rollSeq(L, [6, 6, 5]);
    ok('three dice to spend', L.pool.join() === '6,6,5');

    L.ludoPlayMove(L.legal.filter(m => m.release && m.value === 6)[0]);
    pump(L, L.LUDO_HOP_MS * 3 + 60);
    ok('first token released', L.tokens.filter(t => t.ci === 0 && !t.inBase).length === 1);

    L.ludoPlayMove(L.legal.filter(m => m.release && m.value === 6)[0]);
    pump(L, L.LUDO_HOP_MS * 3 + 60);
    ok('second token released', L.tokens.filter(t => t.ci === 0 && !t.inBase).length === 2);
    ok('only the 5 is left', L.pool.join() === '5', L.pool.join());
    ok('and it is still the same player', L.turn === 0 && L.phase === 'awaitMove');

    L.ludoPlayMove(L.legal[0]);
    pump(L, L.LUDO_HOP_MS * 8 + 60);
    ok('spending the last die hands over', L.turn === 1, `turn=${L.turn}`);
    ok('pool empty', L.pool.length === 0);
}
{
    // A capture mid-spend earns a whole new sequence.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    const gStep = stepOnRing(L.LUDO_COLORS, 2, 3);
    L.place(2, 0, gStep);        // green sitting on ring 3
    L.place(0, 0, 2);            // blue one square behind it
    rollSeq(L, [1]);
    const cap = L.legal.filter(m => m.token === L.tok(0, 0))[0];
    ok('the move is a capture', cap && cap.captures.length === 1);
    L.ludoPlayMove(cap);
    pump(L, L.LUDO_HOP_MS * 3 + 60);
    ok('victim sent home', L.tok(2, 0).inBase);
    ok('capture earns a fresh roll, same player',
       L.turn === 0 && L.phase === 'awaitRoll', `turn=${L.turn} phase=${L.phase}`);
    ok('banner says so', L.banner && /roll again/i.test(L.banner.text),
       L.banner && L.banner.text);

    rollSeq(L, [6, 4]);
    ok('the new sequence accumulates normally', L.pool.join() === '6,4', L.pool.join());
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
    // Accumulation banks rolls without snapshotting; only handover recaps.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(0, 0, 10);

    rollSeq(L, [6]);
    ok('a 6 banks a die without recapping', L.recap === null);
    ok('the 6 is held in the running tally', L.turnRolls.join() === '6');

    rollSeq(L, [3]);
    ok('still no recap while dice remain', L.recap === null);

    // Spend both dice; the turn only hands over once the pool is empty.
    L.ludoPlayMove(L.legal[0]);
    pump(L, L.LUDO_HOP_MS * 8 + 60);
    L.ludoPlayMove(L.legal[0]);
    pump(L, L.LUDO_HOP_MS * 8 + 60);
    ok('handover recaps the whole turn, both rolls',
       L.recap && L.recap.faces.join() === '6,3', JSON.stringify(L.recap));
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
head('Capture warning');
{
    // The warning must agree EXACTLY with the term the hard scorer applies.
    // If it flagged different squares than the CPU avoids, it would be worse
    // than useless — it would teach the player the wrong instinct.
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();

    // Green sitting 3 back from ring 20; landing there is reachable.
    const gStep = stepOnRing(L.LUDO_COLORS, 2, 17);
    L.place(2, 0, gStep);
    L.place(0, 0, 19);          // 19 -> 20, exposed
    L.place(0, 1, 30);          // 30 -> 31, out of that token's range

    const moves = L.ludoLegalMoves(0, 1);
    const risky = moves.filter(m => m.token.i === 0)[0];
    const safeM = moves.filter(m => m.token.i === 1)[0];

    ok('flags a move that lands within reach', L.ludoMoveIsExposed(risky));
    ok('does not flag one out of reach', !L.ludoMoveIsExposed(safeM));

    // The scorer's penalty and the warning must fire on exactly the same moves.
    const penalised = m =>
        L.ludoScoreMove(0, m, 'normal') - L.ludoScoreMove(0, m, 'hard') > 0;
    ok('warning matches the hard scorer exactly on the risky move',
       L.ludoMoveIsExposed(risky) === penalised(risky));
    ok('warning matches the hard scorer exactly on the safe move',
       L.ludoMoveIsExposed(safeM) === penalised(safeM));
}
{
    const L = fresh();
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    // A ★ square cannot be captured on, so it must never be flagged.
    const gStep = stepOnRing(L.LUDO_COLORS, 2, 5);
    L.place(2, 0, gStep);
    L.place(0, 0, 7);           // 7 -> 8, and ring 8 is safe
    const onStar = L.ludoLegalMoves(0, 1).filter(m => m.token.i === 0)[0];
    ok('a ★ destination is never flagged', !L.ludoMoveIsExposed(onStar));

    L.place(0, 1, 54);          // 54 -> 56, finishing
    const finishing = L.ludoLegalMoves(0, 2).filter(m => m.token.i === 1)[0];
    ok('finishing is never flagged', !L.ludoMoveIsExposed(finishing));
    ok('a null move is handled', !L.ludoMoveIsExposed(null));
}
{
    const L = fresh({ ludoWarnCapture: false });
    ok('the setting can be turned off', !L.ludoWarnsCapture());
    const on = fresh();
    ok('and defaults to on', on.ludoWarnsCapture());
}
{
    // Warnings are presentation only — they must not alter legality.
    const sig = warn => {
        const L = fresh({ ludoWarnCapture: warn });
        L.ludoSetMode('pvp2');
        L.ludoResetTokens();
        L.place(0, 0, 19); L.place(0, 1, 30);
        L.place(2, 0, stepOnRing(L.LUDO_COLORS, 2, 17));
        return [1, 2, 3, 4, 5, 6]
            .map(r => L.ludoLegalMoves(0, r).map(m => m.token.i + '>' + m.to).join(',')).join('|');
    };
    ok('legal moves are identical with warnings on and off', sig(true) === sig(false));
}

// ═══════════════════════════════════════════════════════════════════════
head('Dice audit log');
{
    // The log exists so the player can audit the die from real play. If it
    // itself miscounted — dropped a seat's rolls, or logged a face other than
    // the one played — it would manufacture exactly the bias it is meant to
    // disprove. So check it against the rolls the engine actually used.
    const L = fresh();
    L.ludoDiceReset();
    ok('starts empty', Object.keys(L.ludoDiceStats()).length === 0);

    L.ludoSetMode('pvp2');
    L.startLudoGame();
    const played = { 0: [0, 0, 0, 0, 0, 0, 0], 2: [0, 0, 0, 0, 0, 0, 0] };
    let lastRecap = null, guard = 0;
    while (L.phase !== 'over' && guard++ < 200000) {
        L.ludoUpdate(16);
        if (L.recap && L.recap !== lastRecap) {
            lastRecap = L.recap;
            L.recap.faces.forEach(f => played[L.recap.ci][f]++);
        }
        if (L.phase === 'awaitRoll') L.ludoDoRoll();
        else if (L.phase === 'awaitMove' && L.legal.length) L.ludoPlayMove(L.legal[0]);
    }

    const stats = L.ludoDiceStats();
    ok('both seats appear in the log', Object.keys(stats).length === 2, Object.keys(stats).join());

    // Every roll the engine committed must appear, and no extras. The recap
    // misses the final turn (no handover), so the log may lead by a little.
    const logged = n => (stats[n] || {}).rolls || 0;
    const sum = a => a.reduce((x, y) => x + y, 0);
    [[0, 'Blue'], [2, 'Green']].forEach(([ci, name]) => {
        const seen = sum(played[ci]), got = logged(name);
        ok(`${name}: logged ${got} rolls vs ${seen} observed`,
           got >= seen && got - seen <= L.LUDO_MAX_DICE, `diff ${got - seen}`);
    });

    ok('percentages are reported per face',
       ['1', '2', '3', '4', '5', '6'].every(f => /%$/.test(stats['Blue'][f])));

    L.ludoDiceReset();
    ok('reset clears it', Object.keys(L.ludoDiceStats()).length === 0);
}
{
    // Auditing must never be able to break play, however hostile storage is.
    const L = fresh();
    const real = global.localStorage;
    global.localStorage = {
        getItem: () => '{ this is not json',
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => { throw new Error('nope'); },
    };
    let threw = null;
    try {
        L.ludoSetMode('pvp2');
        L.startLudoGame();
        for (let i = 0; i < 400; i++) {
            L.ludoUpdate(16);
            if (L.phase === 'awaitRoll') L.ludoDoRoll();
            else if (L.phase === 'awaitMove' && L.legal.length) L.ludoPlayMove(L.legal[0]);
        }
        L.ludoDiceStats();
        L.ludoDiceReset();
    } catch (e) { threw = e.message; }
    global.localStorage = real;
    ok('corrupt storage and a full quota do not break the game', threw === null, threw);
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
    ok('CPU rolled a 6 and asked for another', L.phase === 'awaitRoll' && L.pool.join() === '6');

    // Re-pin the dice between pumps so the CPU's second roll closes the sequence.
    forceDice(4);
    pump(L, L.LUDO_CPU_THINK_MS + L.LUDO_DICE_MS + 80);
    restoreDice();
    ok('CPU banked 6,4', L.pool.join() === '6,4' || L.phase === 'moving', L.pool.join());

    pump(L, (L.LUDO_CPU_THINK_MS + L.LUDO_HOP_MS * 8 + 120) * 2);
    ok('CPU committed a move', L.tokens.some(t => t.ci === 2 && !t.inBase));
    ok('CPU spent its whole pool', L.pool.length === 0, L.pool.join());
}
{
    // With one token already out and a plain roll, the CPU should just move.
    const L = fresh();
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.turn = 1;
    L.place(2, 0, 10);
    L.ludoBeginTurn();
    forceDice(4);
    pump(L, L.LUDO_CPU_THINK_MS * 2 + L.LUDO_DICE_MS + L.LUDO_HOP_MS * 8 + 200);
    restoreDice();
    ok('CPU advanced its token', L.tok(2, 0).step === 14, `step=${L.tok(2, 0).step}`);
    ok('and handed the turn back', L.turn === 0, `turn=${L.turn}`);
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
