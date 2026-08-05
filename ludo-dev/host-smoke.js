// Executes the real AttendanceTimeCheckerPlus.js under a minimal DOM and plays
// a full Ludo match through the integrated code path.
//
// The static audit proves the wiring exists; this proves it *runs* — that the
// Ludo block resolves every host symbol it references (awardGameXP,
// getFrameInterval, AC_MAX_XP_PER_GAME, userPreferences...) and that XP,
// achievements and localStorage all land where they should.
//
// Needs a Node new enough for optional chaining:
//   <node22> ludo-dev/host-smoke.js
const fs = require('fs');
const path = require('path');

// AttendanceTimeCheckerPlus.js uses optional chaining, so parsing it needs
// Node 14+. This repo's default node is 10, so find a newer one via Volta and
// re-exec into it; if there isn't one, skip loudly rather than fail the suite.
(function ensureModernNode() {
    if (parseInt(process.versions.node.split('.')[0], 10) >= 14) return;
    const root = path.join(process.env.LOCALAPPDATA || '', 'Volta', 'tools', 'image', 'node');
    let exe = null;
    if (fs.existsSync(root)) {
        for (const v of fs.readdirSync(root).sort().reverse()) {
            const cand = path.join(root, v, 'node.exe');
            if (parseInt(v, 10) >= 14 && fs.existsSync(cand)) { exe = cand; break; }
        }
    }
    if (!exe) {
        console.log('\n  SKIP host-smoke — needs Node 14+, found ' + process.versions.node + '\n');
        process.exit(0);
    }
    try {
        require('child_process').execFileSync(exe, [__filename], { stdio: 'inherit' });
        process.exit(0);
    } catch (e) {
        process.exit(e.status == null ? 1 : e.status);
    }
})();

const TARGET = path.join(__dirname, '..', 'AttendanceTimeCheckerPlus.js');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 44 - t.length)));

// ── Minimal DOM ────────────────────────────────────────────────────────
const store = {};
const canvasStub = require('./canvas-stub');
const elements = {};
let anonSeq = 0;

// Tracks real parent/child links, because toggleGameMaxModal genuinely moves the
// canvas between the panel and the overlay and puts it back again — a stub that
// no-ops appendChild would let a broken modal pass.
function makeEl(id, tag) {
    const el = {
        id, tagName: (tag || 'div').toUpperCase(),
        style: {}, dataset: {}, children: [], _l: {}, _parent: null,
        className: '', textContent: '', innerHTML: '',
        width: 0, height: 0,
        classList: {
            _s: new Set(),
            add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
            toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
            contains(c) { return this._s.has(c); },
        },
        getContext: () => canvasStub(344, 416).ctx,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 344, height: 416 }),
        addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); },
        removeEventListener(t, f) {
            if (this._l[t]) this._l[t] = this._l[t].filter(x => x !== f);
        },
        appendChild(c) {
            if (c._parent) c._parent.children = c._parent.children.filter(x => x !== c);
            this.children.push(c); c._parent = this; return c;
        },
        insertBefore(c, ref) {
            if (c._parent) c._parent.children = c._parent.children.filter(x => x !== c);
            const at = ref ? this.children.indexOf(ref) : -1;
            if (at === -1) this.children.push(c); else this.children.splice(at, 0, c);
            c._parent = this; return c;
        },
        removeChild(c) {
            this.children = this.children.filter(x => x !== c); c._parent = null; return c;
        },
        querySelector(sel) {
            const want = String(sel).replace(/^\./, '');
            const walk = n => {
                for (const c of n.children) {
                    if (c.className && String(c.className).split(/\s+/).indexOf(want) !== -1) return c;
                    const deep = walk(c);
                    if (deep) return deep;
                }
                return null;
            };
            return walk(this);
        },
        querySelectorAll: () => [],
        closest() { return this._container || null; },
        remove() { if (this._parent) this._parent.removeChild(this); },
        get offsetWidth() { return 300; },
        get offsetHeight() { return 363; },
        get parentNode() { return this._parent; },
    };
    if (id) elements[id] = el;
    return el;
}

// A game panel that both canvases live in, so `canvas.closest(...)` resolves.
const gamePanel = makeEl('game-panel');
const ludoCanvas = makeEl('ludo-canvas', 'canvas');
const poolCanvas = makeEl('pool-canvas', 'canvas');
ludoCanvas._container = gamePanel;
poolCanvas._container = gamePanel;
gamePanel.appendChild(ludoCanvas);
gamePanel.appendChild(poolCanvas);

['ludo-mode-label', 'ludo-home-label', 'ludo-turn-label', 'ludo-mode-btn',
 'game-title', 'ludo-controls', 'ludo-scoreboard'].forEach(id => makeEl(id));

global.window = {
    location: { href: 'https://globalportal.mtbc.com/#/time-absence/attendence-record' },
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {} }),
    setTimeout, clearTimeout, setInterval, clearInterval,
};
global.document = {
    getElementById: id => elements[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: tag => makeEl(null, tag),
    addEventListener() {}, removeEventListener() {},
    body: makeEl('body'),
    head: makeEl('head'),
    documentElement: makeEl('html'),
    readyState: 'complete',
};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
global.navigator = { userAgent: 'node' };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.fetch = () => Promise.reject(new Error('offline in smoke test'));
global.MutationObserver = function () { return { observe() {}, disconnect() {} }; };
global.getComputedStyle = () => ({ getPropertyValue: () => '' });

// ── Load the userscript ────────────────────────────────────────────────
// It is an IIFE that returns early unless the URL matches, and it exposes
// nothing. Append a return so we can reach the internals under test.
const raw = fs.readFileSync(TARGET, 'utf8');
const open = raw.indexOf('(function() {');
const close = raw.lastIndexOf('})();');
if (open === -1 || close === -1) { console.error('could not find the IIFE wrapper'); process.exit(1); }

const body = raw.slice(open + '(function() {'.length, close);
const EXPORTS = `
    return {
        initLudoGame, startLudoGame, resetLudoGame, cleanupLudoGame,
        cycleLudoModeAndReset, endLudoGame, updateLudoScoreboard,
        ludoUpdate, ludoRender, ludoSetMode, ludoRollDice, ludoDoRoll, ludoPlayMove,
        ludoBlockRings, ludoLegalMoves, ludoStepToRing, ludoSeat, ludoResetTokens,
        toggleGameMaxModal, awardGameXP, checkGameAchievements,
        revalidateAchievements, collectGameBests, buildPlayerSnapshot,
        applyPlayerRecordToLocal, ACHIEVEMENTS, ACHIEVEMENT_XP,
        AC_MAX_XP_PER_GAME, LUDO_CANVAS_W, LUDO_CANVAS_H, LUDO_SAFE_RING,
        get userXP() { return userXP; },
        get prefs() { return userPreferences; },
        get phase() { return ludoPhase; },
        get legal() { return ludoLegal; },
        get pool() { return ludoPool; },
        get tokens() { return ludoTokens; },
        get active() { return ludoActive; },
        get turn() { return ludoTurn; },
        set turn(v) { ludoTurn = v; },
        get cpuTier() { return ludoCpuTier; },
        set cpuTier(v) { ludoCpuTier = v; },
        get placements() { return ludoPlacements; },
        get stats() { return ludoStats; },
        get gameOver() { return ludoGameOver; },
        place(ci, i, step) {
            const t = ludoTokens.find(x => x.ci === ci && x.i === i);
            t.inBase = step < 0; t.step = step; t.home = step === LUDO_HOME_STEP;
            return t;
        },
    };
`;

let H;
try {
    H = new Function(body + EXPORTS)();
} catch (e) {
    console.error('\n  ✗ userscript failed to evaluate: ' + e.message);
    console.error(e.stack.split('\n').slice(0, 6).join('\n'));
    process.exit(1);
}

head('Userscript evaluates with Ludo inside');
ok('IIFE body ran without throwing', !!H);
ok('host globals the engine depends on are reachable',
   typeof H.awardGameXP === 'function' && typeof H.AC_MAX_XP_PER_GAME === 'number');
ok('Ludo lifecycle is callable', typeof H.initLudoGame === 'function');
ok('shared Max modal helper is callable', typeof H.toggleGameMaxModal === 'function');

head('Achievements registered in the host');
ok('all three Ludo achievements in ACHIEVEMENTS',
   ['ludoChamp', 'ludoFlawless', 'ludoHunter'].every(k => H.ACHIEVEMENTS[k]));
ok('each has an icon and a name',
   ['ludoChamp', 'ludoFlawless', 'ludoHunter']
       .every(k => H.ACHIEVEMENTS[k].icon && H.ACHIEVEMENTS[k].name));
ok('each has an XP value',
   ['ludoChamp', 'ludoFlawless', 'ludoHunter'].every(k => H.ACHIEVEMENT_XP[k] > 0));
const total = Object.keys(H.ACHIEVEMENTS).length;
ok('achievement grid total is 30', total === 30, 'got ' + total);

head('Boot and play through the host');
H.initLudoGame();
ok('init leaves the game idle', H.phase === 'idle');
ok('scoreboard populated', elements['ludo-turn-label'].textContent === 'Press Play');
ok('mode label populated', elements['ludo-mode-label'].textContent === 'PvCPU');

H.startLudoGame();
ok('play starts a turn', H.phase === 'awaitRoll');

// Drive a whole PvCPU match on the simulated clock. The human seat is played
// here rather than left to time out on the 20s turn clock — waiting for the
// clock converges far too slowly to bound with an iteration guard.
let guard = 0;
while (H.phase !== 'over' && guard++ < 200000) {
    H.ludoUpdate(16);
    if (H.phase === 'awaitRoll') H.ludoDoRoll();
    else if (H.phase === 'awaitMove' && H.legal.length) H.ludoPlayMove(H.legal[0]);
}
ok('a full PvCPU match completes through the host', H.phase === 'over', 'guard=' + guard);
ok('someone brought all four home', H.active.some(ci =>
    H.tokens.filter(t => t.ci === ci && t.home).length === 4));

head('XP and storage after the match');
ok('gameSessions incremented', (H.userXP.gameSessions || 0) >= 1);
ok('XP was awarded', (H.userXP.totalXP || 0) > 0, 'totalXP=' + H.userXP.totalXP);
ok('award respected the per-game clamp',
   (H.userXP.totalXP || 0) <= H.AC_MAX_XP_PER_GAME, 'totalXP=' + H.userXP.totalXP);
ok('ludoRecord persisted', !!store.ludoRecord, JSON.stringify(store.ludoRecord));
const rec = JSON.parse(store.ludoRecord || '{}');
ok('record has exactly one result', (rec.wins || 0) + (rec.losses || 0) === 1,
   JSON.stringify(rec));
ok('ludoGamesWon only set on a win',
   (rec.wins ? store.ludoGamesWon === '1' : !store.ludoGamesWon),
   'wins=' + rec.wins + ' ludoGamesWon=' + store.ludoGamesWon);

head('Anti-farm through the host');
const xpAfterMatch = H.userXP.totalXP;
H.endLudoGame(); H.endLudoGame();
ok('replaying endLudoGame awards nothing', H.userXP.totalXP === xpAfterMatch);
H.startLudoGame();
ok('Play on a finished board resets instead of re-awarding',
   H.userXP.totalXP === xpAfterMatch && H.tokens.every(t => t.inBase));

head('Cloud sync round-trip');
store.ludoGamesWon = '42';
store.ludoRecord = JSON.stringify({ wins: 42, losses: 8 });
const bests = H.collectGameBests();
ok('collectGameBests reports ludo', bests.ludo === 42, 'got ' + bests.ludo);
const snap = H.buildPlayerSnapshot();
ok('snapshot carries ludoRecord', snap.ludoRecord && snap.ludoRecord.wins === 42);
ok('snapshot gameBests carries ludo', snap.gameBests.ludo === 42);

// Wipe locally, then restore from the snapshot — both must come back.
store.ludoGamesWon = '0';
store.ludoRecord = JSON.stringify({ wins: 0, losses: 0 });
H.applyPlayerRecordToLocal(snap);
ok('restore brings back ludoGamesWon', store.ludoGamesWon === '42', store.ludoGamesWon);
ok('restore brings back ludoRecord',
   JSON.parse(store.ludoRecord).wins === 42, store.ludoRecord);

// Only-raise: a lower cloud value must not clobber a higher local one.
store.ludoGamesWon = '99';
store.ludoRecord = JSON.stringify({ wins: 99, losses: 1 });
H.applyPlayerRecordToLocal(snap);
ok('restore never lowers ludoGamesWon', store.ludoGamesWon === '99', store.ludoGamesWon);
ok('restore never lowers ludoRecord', JSON.parse(store.ludoRecord).wins === 99);

head('Achievement unlock paths');
store.ludoGamesWon = '150';
H.userXP.achievements = [];
H.revalidateAchievements();
ok('revalidate restores ludoChamp at 100+ wins',
   H.userXP.achievements.indexOf('ludoChamp') !== -1);

H.userXP.achievements = [];
H.checkGameAchievements('ludo', { vsCPU: true, won: true, tokensLost: 0, captures: 6, gamesWon: 120 });
ok('a flawless CPU win unlocks ludoFlawless',
   H.userXP.achievements.indexOf('ludoFlawless') !== -1);
ok('6 captures unlocks ludoHunter', H.userXP.achievements.indexOf('ludoHunter') !== -1);

H.userXP.achievements = [];
H.checkGameAchievements('ludo', { vsCPU: false, won: true, tokensLost: 0, captures: 9, gamesWon: 500 });
ok('hot-seat unlocks nothing', H.userXP.achievements.length === 0,
   H.userXP.achievements.join());

head('Settings toggles reach the rules engine');
ok('defaults present in userPreferences',
   H.prefs.ludoBlocks === true && H.prefs.ludoThreeSixes === true &&
   H.prefs.ludoExactHome === true && H.prefs.ludoFreeRelease === false);
H.ludoSetMode('pvp2');
H.place(0, 0, -1);
ok('six needed to release by default', H.ludoLegalMoves(0, 3).length === 0);
H.prefs.ludoFreeRelease = true;
ok('freeRelease toggle takes effect immediately', H.ludoLegalMoves(0, 3).length > 0);
H.prefs.ludoFreeRelease = false;

head('Shared Max modal — Pool regression');
{
    // Pool's modal was working code before the refactor, so prove the extracted
    // helper still moves the canvas out, doubles its buffer, and puts it back
    // exactly as it found it.
    const c = elements['pool-canvas'];
    c.width = 368; c.height = 368;
    c.style.width = ''; c.style.height = '';
    const homeParent = c.parentNode;
    const kidsBefore = gamePanel.children.length;

    const opened = H.toggleGameMaxModal({
        canvasId: 'pool-canvas', title: '🎱 8-Ball Pool',
        bufferW: 368, bufferH: 368,
    });
    ok('Pool modal reports open', opened === true);
    ok('canvas left the panel', c.parentNode !== homeParent);
    ok('buffer doubled to 736x736', c.width === 736 && c.height === 736,
       c.width + 'x' + c.height);
    ok('a placeholder holds the panel open', gamePanel.children.length === kidsBefore);
    ok('canvas stretched to fill the modal', c.style.width === '100%');

    const closed = H.toggleGameMaxModal({
        canvasId: 'pool-canvas', title: '🎱 8-Ball Pool',
        bufferW: 368, bufferH: 368,
    });
    ok('Pool modal reports closed', closed === false);
    ok('canvas returned to the panel', c.parentNode === homeParent);
    ok('buffer restored to 368x368', c.width === 368 && c.height === 368,
       c.width + 'x' + c.height);
    ok('placeholder removed', gamePanel.children.length === kidsBefore);
    ok('inline width restored', c.style.width === '');
}

head('Shared Max modal — Ludo');
{
    const c = elements['ludo-canvas'];
    c.width = 344; c.height = 416;
    const homeParent = c.parentNode;

    ok('Ludo modal opens', H.toggleGameMaxModal({
        canvasId: 'ludo-canvas', title: '🎲 Ludo',
        bufferW: H.LUDO_CANVAS_W, bufferH: H.LUDO_CANVAS_H,
    }) === true);
    ok('buffer doubled to 688x832', c.width === 688 && c.height === 832,
       c.width + 'x' + c.height);
    // ludoRender divides canvas.width by LUDO_CANVAS_W, so the board must draw
    // at 2x rather than in a quarter of the canvas.
    ok('render scale derived from the doubled buffer',
       c.width / H.LUDO_CANVAS_W === 2);
    ok('rendering at 2x does not throw', (H.ludoRender(), true));

    ok('Ludo modal closes', H.toggleGameMaxModal({
        canvasId: 'ludo-canvas', title: '🎲 Ludo',
        bufferW: H.LUDO_CANVAS_W, bufferH: H.LUDO_CANVAS_H,
    }) === false);
    ok('buffer restored to 344x416', c.width === 344 && c.height === 416,
       c.width + 'x' + c.height);
    ok('canvas returned to the panel', c.parentNode === homeParent);
}

head('Board rotation, through the host');
{
    // The setting is labelled by where Blue ends up, so check that against the
    // host's own pref object and its own seat function.
    const want = ['top-left', 'bottom-left', 'bottom-right', 'top-right'];
    H.ludoSetMode('cpu2');
    [0, 1, 2, 3].forEach(r => {
        H.prefs.ludoRotation = r;
        const s = H.ludoSeat(0);
        ok(`rotation ${r}: Blue sits ${want[r]}`,
           s.strip + '-' + s.side === want[r], `got ${s.strip}-${s.side}`);
    });

    // Legality must be identical at every rotation — this is the whole safety
    // claim, re-checked against the integrated copy rather than only ludo-dev/.
    H.prefs.ludoRotation = 0;
    H.ludoResetTokens();
    H.place(0, 0, 12); H.place(2, 0, 30);
    const baseline = [1, 2, 3, 4, 5, 6]
        .map(r => H.ludoLegalMoves(0, r).map(m => m.token.i + '>' + m.to).join(',')).join('|');
    let same = true;
    [1, 2, 3].forEach(r => {
        H.prefs.ludoRotation = r;
        const got = [1, 2, 3, 4, 5, 6]
            .map(x => H.ludoLegalMoves(0, x).map(m => m.token.i + '>' + m.to).join(',')).join('|');
        if (got !== baseline) same = false;
    });
    ok('legal moves are identical at every rotation', same);

    let threw = null;
    [0, 1, 2, 3].forEach(r => {
        H.prefs.ludoRotation = r;
        try { H.ludoRender(); } catch (e) { threw = 'rot ' + r + ': ' + e.message; }
    });
    ok('the board renders at every rotation', threw === null, threw);

    H.prefs.ludoRotation = 'nonsense';
    ok('a corrupt rotation pref falls back to 0 rather than throwing',
       (H.ludoRender(), H.ludoSeat(0).strip + '-' + H.ludoSeat(0).side) === 'top-left');
    H.prefs.ludoRotation = 0;
}

head('Reported bug 1 — safe squares walling the track');
H.ludoSetMode('cpu2');
H.place(2, 0, 0); H.place(2, 1, 0);        // two CPU tokens on their start (ring 26)
H.place(0, 0, 24);                          // player token on Green's gate
ok('safe square is not a block', !H.ludoBlockRings(0).has(26));
const legal = [1, 2, 3, 4, 5, 6].filter(r =>
    H.ludoLegalMoves(0, r).some(m => m.token.i === 0));
ok('all six rolls are playable', legal.length === 6, 'legal rolls: ' + legal.join());

head('Reported bug 2 — a block on the very next square');
{
    // Blue on ring 30 with a Green pair on ring 31: every roll has to cross it.
    H.ludoSetMode('cpu2');
    H.ludoResetTokens();
    const greenStep = (31 - 26 + 52) % 52;
    H.place(2, 0, greenStep); H.place(2, 1, greenStep);
    H.place(0, 0, 30);

    H.prefs.ludoBlockPassing = true;
    const walled = [1, 2, 3, 4, 5, 6].filter(r =>
        H.ludoLegalMoves(0, r).some(m => m.token.i === 0));
    ok('default rule: the token is walled in completely', walled.length === 0,
       'legal rolls: ' + walled.join());

    H.prefs.ludoBlockPassing = false;
    const free = [1, 2, 3, 4, 5, 6].filter(r =>
        H.ludoLegalMoves(0, r).some(m => m.token.i === 0));
    ok('jumping allowed: every roll but the landing one works',
       free.join() === '2,3,4,5,6', 'legal rolls: ' + free.join());
    ok('the pair still cannot be landed on',
       !H.ludoLegalMoves(0, 1).some(m => m.token.i === 0));
    ok('and still cannot be captured',
       H.ludoLegalMoves(0, 3).filter(m => m.token.i === 0)[0].captures.length === 0);
    H.prefs.ludoBlockPassing = true;
}

console.log('\n' + '='.repeat(52));
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('='.repeat(52) + '\n');
process.exit(fail ? 1 : 0);
