// Board rotation: proves a quarter-turn moves pixels and nothing else.
//
// The whole safety argument for this feature is that rotation is presentational
// — it must not be able to change a single legal move, a ring index or a token's
// step. These assertions hold rotation to that, and separately check that what
// *is* meant to move (quadrants, HUD chips, dice, hit-testing) all moves
// together and stays on the board.
const canvasStub = require('./canvas-stub');

const RECT = { left: 0, top: 0, width: 344, height: 416 };
const stub = {
    width: 0, height: 0,
    getContext: () => canvasStub(344, 416).ctx,
    getBoundingClientRect: () => RECT,
    addEventListener() {}, removeEventListener() {},
};
global.document = { getElementById: id => (id === 'ludo-canvas' ? stub : null) };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
};
global.awardGameXP = () => {};
global.getFrameInterval = () => 0;

const load = require('./load');
const { forceDice, restoreDice } = load;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else      { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);

const TURNS = [0, 1, 2, 3];
const BLUE = 0, RED = 1, GREEN = 2, YELLOW = 3;
const NAME = { 0: 'Blue', 1: 'Red', 2: 'Green', 3: 'Yellow' };

function board(rot) {
    const L = load({ ludoRotation: rot });
    L.active = [0, 1, 2, 3];
    L.ludoResetTokens();
    L.turn = 0;
    return L;
}

// ═══════════════════════════════════════════════════════════════════════
head('Reading the preference');
{
    ok('missing pref means no rotation', load({}).ludoRotation() === 0);
    TURNS.forEach(t => ok(`rotation ${t} reads back as ${t}`, load({ ludoRotation: t }).ludoRotation() === t));
    ok('a numeric string is accepted', load({ ludoRotation: '2' }).ludoRotation() === 2);
    ok('out of range wraps', load({ ludoRotation: 5 }).ludoRotation() === 1);
    ok('negative wraps forward', load({ ludoRotation: -1 }).ludoRotation() === 3);
    ok('garbage falls back to 0', load({ ludoRotation: 'sideways' }).ludoRotation() === 0);
    ok('null falls back to 0', load({ ludoRotation: null }).ludoRotation() === 0);
}

// ═══════════════════════════════════════════════════════════════════════
head('Quadrants land where the setting promises');
{
    // The setting is labelled by where Blue ends up, so that had better be true.
    const expect = ['top-left', 'bottom-left', 'bottom-right', 'top-right'];
    TURNS.forEach(t => {
        const L = board(t);
        const s = L.ludoSeat(BLUE);
        ok(`rotation ${t}: Blue is ${expect[t]}`,
           s.strip + '-' + s.side === expect[t], `got ${s.strip}-${s.side}`);
    });
}
{
    // Turn order must stay clockwise on screen, or the board reads wrong.
    TURNS.forEach(t => {
        const L = board(t);
        const corner = ci => {
            const s = L.ludoSeat(ci);
            return (s.strip === 'top' ? 0 : 2) + (s.side === 'left' ? 0 : 1);
        };
        // Clockwise from any corner: TL(0) → TR(1) → BR(3) → BL(2)
        const cw = [0, 1, 3, 2];
        const seats = [BLUE, RED, GREEN, YELLOW].map(corner);
        const start = cw.indexOf(seats[0]);
        const wanted = [0, 1, 2, 3].map(k => cw[(start + k) % 4]);
        ok(`rotation ${t}: seats stay in clockwise order`,
           seats.join() === wanted.join(), `${seats.join()} vs ${wanted.join()}`);
    });
}
{
    TURNS.forEach(t => {
        const L = board(t);
        const slots = [BLUE, RED, GREEN, YELLOW]
            .map(ci => { const s = L.ludoSeat(ci); return s.strip + '-' + s.side; });
        ok(`rotation ${t}: four seats occupy four distinct slots`,
           new Set(slots).size === 4, slots.join(' '));
    });
}

// ═══════════════════════════════════════════════════════════════════════
head('Rotation is a rigid transform of the grid');
{
    TURNS.forEach(t => {
        const L = board(t);
        const seen = new Set();
        let out = 0;
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const p = L.ludoCellCenter(r, c);
                seen.add(Math.round(p.x) + ':' + Math.round(p.y));
                if (p.x < L.LUDO_BOARD_X || p.x > L.LUDO_BOARD_X + L.LUDO_BOARD ||
                    p.y < L.LUDO_BOARD_Y || p.y > L.LUDO_BOARD_Y + L.LUDO_BOARD) out++;
            }
        }
        ok(`rotation ${t}: all 225 cells map to distinct pixels`, seen.size === 225, 'got ' + seen.size);
        ok(`rotation ${t}: no cell leaves the board`, out === 0, out + ' outside');
    });
}
{
    TURNS.forEach(t => {
        const L = board(t);
        const mid = L.ludoPointXY(7.5, 7.5);
        ok(`rotation ${t}: the board centre is a fixed point`,
           Math.abs(mid.x - (L.LUDO_BOARD_X + L.LUDO_BOARD / 2)) < 1e-9 &&
           Math.abs(mid.y - (L.LUDO_BOARD_Y + L.LUDO_BOARD / 2)) < 1e-9);
    });
}
{
    const L = board(1);
    const q = L.ludoRectXY(0, 0, 6, 6);
    ok('a rotated rect stays axis-aligned and 6 cells square',
       q.w === 6 * L.LUDO_CELL && q.h === 6 * L.LUDO_CELL, `${q.w}x${q.h}`);
    ok('and starts on the board', q.x >= L.LUDO_BOARD_X && q.y >= L.LUDO_BOARD_Y);
}

// ═══════════════════════════════════════════════════════════════════════
head('Every token position stays on the board');
{
    TURNS.forEach(t => {
        const L = board(t);
        let bad = 0, nonFinite = 0;
        for (let ci = 0; ci < 4; ci++) {
            for (let i = 0; i < 4; i++) {
                for (let s = -1; s <= L.LUDO_HOME_STEP; s++) {
                    const p = L.ludoPosForStep(ci, i, s);
                    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { nonFinite++; continue; }
                    if (p.x < L.LUDO_BOARD_X || p.x > L.LUDO_BOARD_X + L.LUDO_BOARD ||
                        p.y < L.LUDO_BOARD_Y || p.y > L.LUDO_BOARD_Y + L.LUDO_BOARD) bad++;
                }
            }
        }
        ok(`rotation ${t}: every position finite`, nonFinite === 0, nonFinite + ' bad');
        ok(`rotation ${t}: every position inside the board`, bad === 0, bad + ' outside');
    });
}

// ═══════════════════════════════════════════════════════════════════════
head('The model is untouched');
{
    // The point of the whole design: turning the board cannot change the rules.
    const base = board(0);
    const cells = [];
    for (let ci = 0; ci < 4; ci++) {
        for (let s = 0; s <= 55; s++) {
            const c = base.ludoStepToCell(ci, s);
            cells.push(ci + ':' + s + '=' + c.r + ',' + c.c + '/' + base.ludoStepToRing(ci, s));
        }
    }
    TURNS.slice(1).forEach(t => {
        const L = board(t);
        const other = [];
        for (let ci = 0; ci < 4; ci++) {
            for (let s = 0; s <= 55; s++) {
                const c = L.ludoStepToCell(ci, s);
                other.push(ci + ':' + s + '=' + c.r + ',' + c.c + '/' + L.ludoStepToRing(ci, s));
            }
        }
        ok(`rotation ${t}: step → cell and ring indices are identical`,
           other.join('|') === cells.join('|'));
    });
}
{
    // Same board state, every rotation: the legal move set must not budge.
    const setup = L => {
        L.active = [BLUE, GREEN];
        L.ludoResetTokens();
        L.place(BLUE, 0, 12); L.place(BLUE, 1, 12); L.place(BLUE, 2, 40);
        L.place(GREEN, 0, 3); L.place(GREEN, 1, 20); L.place(GREEN, 2, 54);
    };
    const sig = L => {
        const out = [];
        for (let ci of [BLUE, GREEN]) {
            for (let roll = 1; roll <= 6; roll++) {
                out.push(ci + ':' + roll + '=' + L.ludoLegalMoves(ci, roll)
                    .map(m => m.token.i + '>' + m.to + (m.captures.length ? 'x' : ''))
                    .sort().join(','));
            }
        }
        return out.join('|');
    };
    const b = board(0); setup(b);
    const want = sig(b);
    TURNS.slice(1).forEach(t => {
        const L = board(t); setup(L);
        ok(`rotation ${t}: identical legal moves`, sig(L) === want);
    });
    const blocked = board(0); setup(blocked);
    ok('the fixture actually produces moves', want.length > 40 && /\d>\d/.test(want));
}

// ═══════════════════════════════════════════════════════════════════════
head('Input follows the board round');
{
    TURNS.forEach(t => {
        const L = board(t);
        L.ludoSetMode('pvp2');
        L.startLudoGame();
        L.place(BLUE, 0, 10);
        forceDice(4);
        L.ludoDoRoll();
        for (let e = 0; e < L.LUDO_DICE_MS + 40; e += 16) L.ludoUpdate(16);
        restoreDice();

        L.ludoRender();                                   // fills renderPos
        const target = L.legal.filter(m => m.token.i === 0)[0];
        const rp = target && L.renderPos.get(target.token);
        ok(`rotation ${t}: the moving token has a drawn position`, !!rp);
        if (!rp) return;

        L.handleLudoPointerDown({ clientX: rp.x, clientY: rp.y, preventDefault() {} });
        ok(`rotation ${t}: tapping it at its rotated position moves it`,
           L.phase === 'moving' && L.hop.move.token === target.token, L.phase);
    });
}
{
    TURNS.forEach(t => {
        const L = board(t);
        L.ludoSetMode('pvp2');
        L.startLudoGame();
        const seat = L.ludoSeat(L.active[L.turn]);
        const cy = seat.strip === 'top'
            ? L.LUDO_STRIP_H / 2
            : L.LUDO_CANVAS_H - L.LUDO_STRIP_H / 2;
        ok(`rotation ${t}: the dice hit-box sits in the mover's strip`,
           L.ludoDiceHit({ x: L.LUDO_CANVAS_W / 2, y: cy }));
        const other = seat.strip === 'top'
            ? L.LUDO_CANVAS_H - L.LUDO_STRIP_H / 2
            : L.LUDO_STRIP_H / 2;
        ok(`rotation ${t}: and not in the opposite strip`,
           !L.ludoDiceHit({ x: L.LUDO_CANVAS_W / 2, y: other }));
    });
}

// ═══════════════════════════════════════════════════════════════════════
head('Rendering at every rotation');
{
    TURNS.forEach(t => {
        const L = board(t);
        let threw = null;
        try {
            ['cpu2', 'pvp2', 'pvp3', 'pvp4'].forEach(m => {
                L.ludoSetMode(m);
                L.ludoRender();
                // Only seated colours have tokens — 2P modes have just two.
                L.active.forEach(ci => {
                    L.ludoResetTokens();
                    for (let s = -1; s <= L.LUDO_HOME_STEP; s++) { L.place(ci, 0, s); L.ludoRender(); }
                });
            });
        } catch (e) { threw = e.message; }
        ok(`rotation ${t}: renders every mode and every step`, threw === null, threw);
    });
}

// ═══════════════════════════════════════════════════════════════════════
head('Turning the board mid-match');
{
    // Rotation is a display pref, so changing it during play must be harmless.
    const L = load({ ludoRotation: 0 });
    L.ludoSetMode('pvp2');
    L.startLudoGame();
    L.place(BLUE, 0, 17); L.place(BLUE, 1, 33);
    L.place(GREEN, 0, 8);
    forceDice(4);
    L.ludoDoRoll();
    for (let e = 0; e < L.LUDO_DICE_MS + 40; e += 16) L.ludoUpdate(16);
    restoreDice();

    const before = L.tokens.map(t => t.ci + ':' + t.i + ':' + t.step + ':' + t.inBase).join('|');
    const legalBefore = L.legal.length;
    const phaseBefore = L.phase;

    global.userPreferences.ludoRotation = 2;              // turn it, mid-turn
    L.ludoRender();

    ok('tokens are untouched',
       L.tokens.map(t => t.ci + ':' + t.i + ':' + t.step + ':' + t.inBase).join('|') === before);
    ok('the pending move list is untouched', L.legal.length === legalBefore);
    ok('the phase is untouched', L.phase === phaseBefore);
    ok('the board draws in its new orientation', L.ludoRotation() === 2);

    // And the match still finishes from here. Drive both seats rather than
    // waiting on the 20s turn clock to time each one out — that converges far
    // too slowly to bound with an iteration guard, and made this flaky.
    let guard = 0;
    while (L.phase !== 'over' && guard++ < 200000) {
        L.ludoUpdate(16);
        if (L.phase === 'awaitRoll') L.ludoDoRoll();
        else if (L.phase === 'awaitMove' && L.legal.length) L.ludoPlayMove(L.legal[0]);
    }
    ok('the match still completes after turning', L.phase === 'over', 'guard=' + guard);
    global.userPreferences.ludoRotation = 0;
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(fail ? 1 : 0);
