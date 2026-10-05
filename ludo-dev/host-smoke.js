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
        _attrs: {},
        setAttribute(k, v) { this._attrs[k] = String(v); },
        getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
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
        applyPlayerRecordToLocal, ACHIEVEMENTS, ACHIEVEMENT_XP, achTier, achMedal, achRarestFirst,
        collectGameModeBests, applySnakeModeBests, LB_BOARDS,
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
ok('each has a glyph and a name',
   ['ludoChamp', 'ludoFlawless', 'ludoHunter']
       .every(k => H.ACHIEVEMENTS[k].d && H.ACHIEVEMENTS[k].name));
ok('each has an XP value',
   ['ludoChamp', 'ludoFlawless', 'ludoHunter'].every(k => H.ACHIEVEMENT_XP[k] > 0));
// 30 before Snake v2, which added six (snakeEndless, snakeWalled,
// snakeGourmand, snakeCampaign, snakeConqueror, snakeLong); Pool v2 added Called It, and
// snooker (S6) Century and Maximum.
const total = Object.keys(H.ACHIEVEMENTS).length;
ok('achievement grid total is 39', total === 39, 'got ' + total);

head('Achievement icons (POOL_V2_PLAN.md, Achievement icons)');
{
    const keys = Object.keys(H.ACHIEVEMENTS), A = H.ACHIEVEMENTS;
    ok('every achievement is a stroke glyph, no emoji: a d of path commands and numbers only, no icon',
       keys.every(k => /^[MLHVCSQTAZmlhvcsqtaz0-9.,\s-]+$/.test(A[k].d) && !('icon' in A[k])),
       keys.filter(k => !A[k].d || 'icon' in A[k]).join());
    ok('no two share a glyph', new Set(keys.map(k => A[k].d)).size === keys.length);
    const by = {};
    keys.forEach(k => { const t = H.achTier(k); by[t] = (by[t] || 0) + 1; });
    ok('tiers follow ACHIEVEMENT_XP: 12 common, 18 rare, 7 epic, 2 legendary',
       by.common === 12 && by.rare === 18 && by.epic === 7 && by.legendary === 2, JSON.stringify(by));
    ok('Centurion and Legend are the legendary pair, Maximum is epic',
       H.achTier('centurion') === 'legendary' && H.achTier('level100') === 'legendary' && H.achTier('snookerMaximum') === 'epic');
    const leg = H.achMedal('level100', 40), lock = H.achMedal('level100', 40, true), small = H.achMedal('firstDay', 20);
    ok('a 40 px Legendary medallion: its tier class, a 2 px ring, a 22 px glyph, no padlock',
       /class="ach-md ach-t-legendary"/.test(leg) && /border-width:2px/.test(leg) && /width="22"/.test(leg) && !/ach-md-lock/.test(leg));
    ok('locked: no tier class (so no tier colour), a 1 px ring, and the padlock badge (15 px, 6% outside)',
       /class="ach-md ach-t-locked"/.test(lock) && /border-width:1px/.test(lock) && /ach-md-lock" style="width:15px;height:15px;right:-3px;bottom:-3px"/.test(lock));
    ok('a 20 px Common medallion: a 1 px ring round a 14 px glyph', /border-width:1px/.test(small) && /width="14"/.test(small));
    ok('only the toast\'s medallion draws its stroke (pathLength 1)', /pathLength="1"/.test(H.achMedal('firstDay', 40, false, true)) && !/pathLength/.test(leg));
    const order = H.achRarestFirst(['firstDay', 'retiredKey', 'week1', 'centurion', 'workdays20', 'level100']);
    ok('rarest first, ACHIEVEMENTS\' order within a tier, retired keys dropped',
       order.join() === 'centurion,level100,workdays20,week1,firstDay', order.join());
}

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
// The wins per cue (their levels): each cue's own highest count, from either side.
store.poolCueRecord = JSON.stringify({ ember: 12, crown: 3 });
const cueSnap = H.buildPlayerSnapshot();
store.poolCueRecord = JSON.stringify({ ember: 4, malachite: 9 });
H.applyPlayerRecordToLocal(cueSnap);
const cues = JSON.parse(store.poolCueRecord);
ok('restore keeps each cue\'s highest win count', cueSnap.poolCueRecord.ember === 12 && cues.ember === 12 && cues.crown === 3 && cues.malachite === 9, store.poolCueRecord);

// A corrupt value reads as its default: the snapshot and the restore carry on.
Object.assign(store, { poolRecord: '{bad', snookerRecord: 'nope', reflexHighScores: '{', prayerCount: 'x', userXP: '{' });
let corrupt = null;
try { corrupt = H.buildPlayerSnapshot(); H.applyPlayerRecordToLocal(snap); } catch (e) { corrupt = e; }
ok('corrupt storage neither throws nor syncs garbage',
   corrupt && !(corrupt instanceof Error) && corrupt.poolRecord.p1Wins === 0 && corrupt.prayerCount === 0, String(corrupt));
ok('…and the restore rewrites the corrupt record whole', JSON.parse(store.snookerRecord).p1Wins === 0 && 'p2Losses' in JSON.parse(store.snookerRecord));

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

// Pool v2 (Phase 8): Called It, for a win against the Pro CPU, live and from the tier record.
ok('Called It is registered with a glyph, a name and 120 XP', !!(H.ACHIEVEMENTS.calledIt && H.ACHIEVEMENTS.calledIt.d && H.ACHIEVEMENTS.calledIt.name) && H.ACHIEVEMENT_XP.calledIt === 120);
H.userXP.achievements = [];
H.checkGameAchievements('pool', { vsCPU: true, won: true, tier: 'hard' });
H.checkGameAchievements('pool', { vsCPU: false, won: true, tier: 'pro' });
ok('a Hard win or a hot-seat win does not unlock Called It', H.userXP.achievements.indexOf('calledIt') === -1, H.userXP.achievements.join());
H.checkGameAchievements('pool', { vsCPU: true, won: true, tier: 'pro' });
ok('a Pro win unlocks Called It', H.userXP.achievements.indexOf('calledIt') !== -1);
H.userXP.achievements = [];
store.poolWinsByTier = JSON.stringify({ pro: 1 });
H.revalidateAchievements();
ok('revalidate restores Called It from poolWinsByTier', H.userXP.achievements.indexOf('calledIt') !== -1);
{
    // The tables: what storage proves comes back, silently; per-run facts never do.
    const x = H.userXP, has = id => x.achievements.indexOf(id) !== -1, xp0 = x.totalXP;
    const saved = JSON.stringify(x);
    Object.assign(x, { achievements: [], totalWorkDays: 20, level: 26, gameSessions: 50, consecutiveDays: 2, longestStreak: 8 });
    store.snakeHighScores = JSON.stringify({ endless: 41, walled: 12 });
    store.snakeLevelsBest = '6';
    H.revalidateAchievements();
    ok('revalidate restores by table: work days, levels, sessions, best streak, snake modes and stages',
       ['firstDay', 'week1', 'workdays20', 'level10', 'level25', 'gamer', 'streak7', 'snakeEndless', 'snakeCampaign'].every(has) &&
       !['centurion', 'level50', 'gamer50', 'streak30', 'snakeWalled', 'snakeConqueror', 'snakeGourmand', 'snakeLong'].some(has) && x.totalXP === xp0);
    x.achievements = [];
    H.checkGameAchievements('snooker', { vsCPU: false, highBreak: 147 });
    H.checkGameAchievements('reflex', { avgTime: 210, falseStarts: 1 });
    H.checkGameAchievements('snake', { mode: 'walled', score: 40, bigEaten: 10, stagesCleared: 5 });
    ok('live checks: 2 Players\' breaks and a false start earn nothing; a walled 40 and 10 golden bites do',
       !has('snookerCentury') && !has('lightning') && has('snakeWalled') && has('snakeCharmer') && has('snakeGourmand') && !has('snakeEndless') && !has('snakeCampaign'));
    delete store.snakeHighScores; delete store.snakeLevelsBest;
    Object.assign(x, JSON.parse(saved));
    // The score ladders: the first step reached pays, plus that game's bonuses (and any achievement).
    const paid = (game, perf) => {
        const a0 = x.achievements.slice(), t0 = x.totalXP;
        H.awardGameXP(game, perf);
        return x.totalXP - t0 - x.achievements.filter(k => a0.indexOf(k) < 0).reduce((n, k) => n + (H.ACHIEVEMENT_XP[k] || 50), 0);
    };
    ok('XP ladders: flappy 10 pipes 45, reflex 200 ms clean 65 + 15, breakout 99 at level 2 12 + 16, aim 0 pts at 80% 12 + 15',
       paid('flappy', { score: 10 }) === 45 && paid('reflex', { avgTime: 200, falseStarts: 0 }) === 80 &&
       paid('breakout', { score: 99, level: 2 }) === 28 && paid('aim', { score: 0, accuracy: 80 }) === 27);
}
{
    const xp0 = H.userXP.totalXP, s0 = H.userXP.gameSessions || 0;
    H.awardGameXP('pool', { won: true, vsCPU: true, tier: 'pro', xp: 999 });
    ok('a pool award is clamped to AC_MAX_XP_PER_GAME and counts one session', H.userXP.totalXP - xp0 <= H.AC_MAX_XP_PER_GAME && (H.userXP.gameSessions || 0) === s0 + 1, H.userXP.totalXP - xp0);
    const xp1 = H.userXP.totalXP;
    H.awardGameXP('pool', { won: true, vsCPU: true, tier: 'easy' });
    ok('an award without an xp figure pays nothing (every pool call site computes one)', H.userXP.totalXP === xp1);
}

// Snooker (S6): its own XP type, Century and Maximum, the High break board and sync keys.
head('Snooker progression');
ok('Century (150 XP) and Maximum (300 XP) are registered with icons and names',
   ['snookerCentury', 'snookerMaximum'].every(k => H.ACHIEVEMENTS[k] && H.ACHIEVEMENTS[k].d && H.ACHIEVEMENTS[k].name) &&
   H.ACHIEVEMENT_XP.snookerCentury === 150 && H.ACHIEVEMENT_XP.snookerMaximum === 300);
delete store.poolWinsByTier;
H.userXP.achievements = [];
H.checkGameAchievements('snooker', { vsCPU: true, won: true, tier: 'pro', highBreak: 40 });
H.awardGameXP('snooker', { won: true, vsCPU: true, tier: 'pro', reds: 15, highBreak: 40, xp: 180 });
ok('a Pro snooker win never unlocks pool\'s Called It', H.userXP.achievements.indexOf('calledIt') === -1, H.userXP.achievements.join());
H.checkGameAchievements('snooker', { vsCPU: false, won: true, highBreak: 147 });
ok('2 Players breaks unlock nothing (either seat is this account)', !H.userXP.achievements.some(a => /^snooker/.test(a)), H.userXP.achievements.join());
H.checkGameAchievements('snooker', { vsCPU: true, won: false, highBreak: 99 });
ok('a 99 is no century', H.userXP.achievements.indexOf('snookerCentury') === -1);
H.checkGameAchievements('snooker', { vsCPU: true, won: false, highBreak: 104 });
ok('a century against the CPU unlocks Century, even in a lost frame', H.userXP.achievements.indexOf('snookerCentury') !== -1 && H.userXP.achievements.indexOf('snookerMaximum') === -1);
H.checkGameAchievements('snooker', { vsCPU: true, won: true, highBreak: 147 });
ok('a 147 unlocks Maximum', H.userXP.achievements.indexOf('snookerMaximum') !== -1);
H.userXP.achievements = [];
store.snookerHighBreak = '112';
H.revalidateAchievements();
ok('revalidate restores Century from snookerHighBreak (112), not Maximum', H.userXP.achievements.indexOf('snookerCentury') !== -1 && H.userXP.achievements.indexOf('snookerMaximum') === -1);
store.snookerHighBreak = '147';
H.revalidateAchievements();
ok('…and Maximum from a 147', H.userXP.achievements.indexOf('snookerMaximum') !== -1 && H.userXP.achievements.indexOf('calledIt') === -1);
{
    const xp0 = H.userXP.totalXP, s0 = H.userXP.gameSessions || 0;
    H.awardGameXP('snooker', { won: true, vsCPU: true, tier: 'pro', reds: 15, highBreak: 147, xp: 999 });
    ok('a snooker award is clamped to AC_MAX_XP_PER_GAME and counts one session', H.userXP.totalXP - xp0 <= H.AC_MAX_XP_PER_GAME && (H.userXP.gameSessions || 0) === s0 + 1, H.userXP.totalXP - xp0);
    const xp1 = H.userXP.totalXP;
    H.awardGameXP('snooker', { won: true, vsCPU: false, tour: true, round: 'Final', xp: 80 });
    ok('a tournament match pays its 80', H.userXP.totalXP - xp1 === 80);
}
{
    store.snookerWinsByMode = JSON.stringify({ cpu: 7, pvp: 2 });
    store.snookerWinsByTier = JSON.stringify({ easy: 3, normal: 0, hard: 3, pro: 1 });
    store.snookerHighBreak = '400';
    const g = H.collectGameModeBests();
    ok('the snapshot carries snooker:{cpu, pvp, easy, hard, pro} (no zeros) and the high break, clamped at 155',
       g['snooker:cpu'] === 7 && g['snooker:pvp'] === 2 && g['snooker:easy'] === 3 && g['snooker:pro'] === 1 && !('snooker:normal' in g) && g['snooker:highBreak'] === 155, JSON.stringify(g));
    ok('every snooker key passes the bot\'s key pattern', Object.keys(g).filter(k => /^snooker:/.test(k)).every(k => /^[a-z]+:[a-zA-Z]+$/.test(k)));
    store.snookerHighBreak = '60';
    H.applySnakeModeBests({ 'snooker:cpu': 9, 'snooker:pvp': 1, 'snooker:normal': 4, 'snooker:pro': 0, 'snooker:highBreak': 999 });
    const byMode = JSON.parse(store.snookerWinsByMode), byTier = JSON.parse(store.snookerWinsByTier);
    ok('the restore only raises: all-time 7 → 9, hot-seat stays 2, Normal 0 → 4, Pro stays 1', byMode.cpu === 9 && byMode.pvp === 2 && byTier.normal === 4 && byTier.pro === 1, JSON.stringify({ byMode, byTier }));
    ok('…and the high break never past 155', store.snookerHighBreak === '155', store.snookerHighBreak);
    H.applySnakeModeBests({ 'snooker:highBreak': 80 });
    ok('…nor down', store.snookerHighBreak === '155');
    store.snookerRecord = JSON.stringify({ p1Wins: 5, p1Losses: 2, p2Wins: 2, p2Losses: 5 });
    ok('the player snapshot carries snooker\'s seat record', JSON.stringify(H.buildPlayerSnapshot().snookerRecord) === store.snookerRecord);
    const B = H.LB_BOARDS.snooker;
    ok('the Snooker board: Pro, Hard, Normal, Easy, All-time, Hot-seat and High break, points on the last',
       Object.keys(B.modes).join() === 'pro,hard,normal,easy,cpu,pvp,highBreak' && B.unit === 'wins' && B.units.highBreak === 'pts' && B.notes.highBreak && B.icon === '🔴');
    ok('pool\'s and Ludo\'s boards keep their All-time notes', /predate/.test(H.LB_BOARDS.pool.notes.cpu) && /predate/.test(H.LB_BOARDS.ludo.notes.cpu));
}

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

head('Shared Max modal — cfg.build (Pool v2)');
{
    // Pool brings its own Max layout: the helper hands it an empty panel and
    // leaves every canvas alone.
    const c = elements['pool-canvas'];
    c.width = 368; c.height = 368;
    const homeParent = c.parentNode, kidsBefore = gamePanel.children.length;
    let built = null, unbuilt = 0;
    const cfg = { canvasId: 'pool-canvas', title: '8-Ball Pool', panelClass: 'pool-max-panel',
        build: p => { built = p; }, unbuild: () => { unbuilt++; } };
    ok('opens through cfg.build', H.toggleGameMaxModal(cfg) === true);
    ok('build gets the modal panel, with the caller\'s class', !!built && /pool-modal-panel/.test(built.className) && /pool-max-panel/.test(built.className), built && built.className);
    ok('no placeholder, and the canvas neither moves nor resizes',
       gamePanel.children.length === kidsBefore && c.parentNode === homeParent && c.width === 368 && c.height === 368);
    ok('closes, and unbuild runs once', H.toggleGameMaxModal(cfg) === false && unbuilt === 1);
    ok('reopens cleanly after closing', H.toggleGameMaxModal(cfg) === true && H.toggleGameMaxModal(cfg) === false && unbuilt === 2);
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
