// Loads the v2 pool modules the way the userscript holds them: one scope, in
// splice order. Each file is an indented block of the userscript's IIFE body,
// so wrapping the concatenation in a Function makes the same source both
// drop-in-able and testable (the snake-dev trick).
//
//   require('./load').physics()   pp*                  the physics alone
//   require('./load').rules()     + pr*                the rules
//   require('./load').render()    + pc*, pg*           camera and renderer
//   require('./load').hud()       + ph*                the HUD (its DOM parts need a browser)
//   require('./load').ai()        physics, rules, pa*  the stand-in CPU
//   require('./load').game(opts)  everything, pool-game.js included, against a
//                                 stubbed host: the match, the CPU's turn, XP and
//                                 records run headless; the DOM parts do not
//
// The v1 engine and its loader are frozen in v1/ for baseline-check.js.
const fs   = require('fs');
const path = require('path');

// Splice order: each file only uses names from the ones before it at call time,
// but keeping the dependency order makes the block read top-down.
const FILES = ['pool-physics.js', 'pool-rules.js', 'pool-camera.js', 'pool-render.js', 'pool-hud.js', 'pool-ai.js', 'pool-game.js'];
const TARGET = path.join(__dirname, '..', 'AttendanceTimeCheckerPlus.js');
// Module prefixes, plus the host-facing names pool-game.js keeps from v1.
const PREFIX = /^    (?:function|const)\s+((?:pp|PP_|pr|PR_|pc|PC_|pg|PG_|ph|PH_|pa|PA_|pool|POOL_|initPool|resetPool|togglePool)[\w$]*)/gm;

const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

function v2(files) {
    const src = files.map(read).join('\n');
    const names = [...src.matchAll(PREFIX)].map(m => m[1]);
    return new Function(src + '\nreturn { ' + names.join(', ') + ' };')();
}

// The v2 physics on its own. It needs nothing from the host.
function physics() { return v2(['pool-physics.js']); }
// The rules on top of the physics, in one scope as they will be in the userscript.
function rules() { return v2(['pool-physics.js', 'pool-rules.js']); }
// Physics, rules, camera and renderer together.
function render() { return v2(['pool-physics.js', 'pool-rules.js', 'pool-camera.js', 'pool-render.js']); }
// Everything above plus the HUD. Its DOM functions touch `document` only when
// called, so the pure view model (phModel) loads and runs in Node.
function hud() { return v2(['pool-physics.js', 'pool-rules.js', 'pool-camera.js', 'pool-render.js', 'pool-hud.js']); }
// The rules plus the stand-in CPU.
function ai() { return v2(['pool-physics.js', 'pool-rules.js', 'pool-ai.js']); }

// loadPoolHighScore … savePoolRecord, verbatim from the host: the leaderboard
// and restore paths depend on exactly how they seed poolWinsByMode.
function hostStorageHelpers() {
    const src = fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');
    const from = src.indexOf('    function loadPoolHighScore() {');
    const to   = src.indexOf('    // ludoGamesWon / ludoRecord live in the LUDO block');
    if (from === -1 || to === -1 || to < from) throw new Error('pool storage helpers not found in AttendanceTimeCheckerPlus.js');
    return src.slice(from, to);
}

// mulberry32, for a reproducible Math.random / Date.now inside one load.
function seededRandom(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const HOST_PARAMS = [
    'document', 'window', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date',
    'userPreferences', 'savePreferences', 'getFrameInterval', 'currentGame', 'lbDisplayName',
    'xpSystemReady', 'userXP', 'checkLevelUp', 'saveUserXP', 'showXPNotification', 'updateXPDisplay',
    'awardGameXP', 'updateGameScoreBtn', 'toggleGameMaxModal',
    'applyCyberTokens', 'applyCyberShape', 'clearCyberTokens', 'clearCyberShape',
];

// opts: { store, prefs, name, seed, xpSystemReady }
function game(opts) {
    opts = opts || {};
    const store = opts.store || {};
    const log = { xp: [], notes: [], scoreBtn: [], maxModal: [], saves: 0 };
    const localStorage = {
        getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
    };
    const noop = () => {};
    // No panel in Node: initPoolGame() finds no #pool-root and returns.
    const document = { getElementById: () => null, createElement: () => ({ getContext: () => null }), documentElement: { addEventListener: noop, removeEventListener: noop } };
    const window = { addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1, innerWidth: 1400, innerHeight: 900 };
    const rng = seededRandom(opts.seed == null ? 7 : opts.seed);
    let clock = 1.7e12;
    const DateShim = { now: () => (clock += Math.floor(rng() * 1e6)) };
    const userXP = { currentXP: 0, totalXP: 0, achievements: [] };
    let modalOpen = false;
    const host = {
        document, window, localStorage,
        requestAnimationFrame: () => 1, cancelAnimationFrame: noop, Date: DateShim,
        userPreferences: Object.assign({ poolTableColor: 'green', gameFps: 60, poolShotCam: 'overhead', poolCamera: '3d', poolLean: 35 }, opts.prefs),
        savePreferences: () => { log.saves++; },
        getFrameInterval: () => 1000 / 60,
        currentGame: 'pool',
        lbDisplayName: opts.name || '',
        xpSystemReady: opts.xpSystemReady !== false,
        userXP,
        checkLevelUp: noop, saveUserXP: noop, updateXPDisplay: noop,
        showXPNotification: (msg, kind) => log.notes.push({ msg, kind }),
        awardGameXP: (type, perf) => log.xp.push({ type, perf }),
        updateGameScoreBtn: (g, score, best) => log.scoreBtn.push({ game: g, score, best }),
        toggleGameMaxModal: cfg => { log.maxModal.push(cfg); modalOpen = !modalOpen; return modalOpen; },
        applyCyberTokens: noop, applyCyberShape: noop, clearCyberTokens: noop, clearCyberShape: noop,
    };
    const src = FILES.map(read).join('\n');
    const names = [...src.matchAll(PREFIX)].map(m => m[1]);
    const lets = ['poolMode', 'poolGamesWon', 'poolRecord', 'poolMaximized', 'poolCpuTier'];
    const factory = new Function(...HOST_PARAMS, hostStorageHelpers() + '\n' + src + `
        return {
            ${names.join(', ')},
            loadPoolHighScore, savePoolHighScore, loadPoolWinsByMode, savePoolWinByMode, loadPoolRecord, savePoolRecord,
            ${lets.map(n => `get ${n}() { return ${n}; }, set ${n}(v) { ${n} = v; }`).join(',\n')}
        };
    `);
    const P = factory(...HOST_PARAMS.map(k => host[k]));
    P.host = host;
    P.log = log;
    P.store = store;
    return P;
}

module.exports = { physics, rules, render, hud, ai, game, FILES, TARGET, seededRandom, hostStorageHelpers };
