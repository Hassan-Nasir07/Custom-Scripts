// Shared loader: evaluates pool-core.js + pool-ui.js as one unit and hands back
// their internals. Both files are indented blocks of the userscript's IIFE body,
// so they have no exports of their own; wrapping them in a Function is what
// makes the same source both drop-in-able and testable (the snake-dev trick).
//
// Differences from snake-dev/load.js, both deliberate:
//   - Host dependencies arrive as Function parameters, not globals, so two
//     loads in one process cannot see each other's stubs.
//   - The pool storage helpers are the REAL ones, sliced out of the userscript,
//     because the leaderboard and restore paths depend on exactly how they seed
//     poolWinsByMode. A stub would test a copy.
//
//   const P = require('./load')({ seed: 7 });
//   P.resetPoolGame(); P.balls.length === 16
const fs   = require('fs');
const path = require('path');

const FILES  = ['pool-core.js', 'pool-ui.js'];
const TARGET = path.join(__dirname, '..', 'AttendanceTimeCheckerPlus.js');

function source() {
    return FILES.map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n\n');
}

// loadPoolHighScore … savePoolRecord, verbatim from the host.
function hostStorageHelpers() {
    const src = fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');
    const from = src.indexOf('    function loadPoolHighScore() {');
    const to   = src.indexOf('    // ludoGamesWon / ludoRecord live in the LUDO block');
    if (from === -1 || to === -1 || to < from) {
        throw new Error('pool storage helpers not found in AttendanceTimeCheckerPlus.js');
    }
    return src.slice(from, to);
}

// Every top-level `let` in the pool block, so the accessor object can expose
// all state without a hand-kept list that silently goes stale.
function stateNames(src) {
    const names = [];
    for (const line of src.split(/\r?\n/)) {
        const m = /^    let\s+(.+?);/.exec(line);
        if (!m) continue;
        m[1].split(',').forEach(part => {
            const id = part.trim().split(/[\s=]/)[0];
            if (/^[A-Za-z_$][\w$]*$/.test(id)) names.push(id);
        });
    }
    return names;
}

// mulberry32: small, fast, and good enough to make a rack or a CPU miss repeatable.
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

function makeCanvas(w, h, ctxFactory) {
    const canvas = {
        width: w, height: h, style: {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height }),
        addEventListener() {}, removeEventListener() {},
    };
    canvas.getContext = () => (ctxFactory ? ctxFactory(canvas) : stubContext(canvas));
    return canvas;
}

// Accepts every Canvas2D call and records nothing: proves the renderer runs, not what it draws.
function stubContext(canvas) {
    const noop = () => {};
    return new Proxy({}, {
        get: (t, k) => {
            if (k === 'canvas') return canvas;
            if (k in t) return t[k];
            if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
            if (k === 'measureText') return () => ({ width: 10 });
            if (k === 'getLineDash') return () => [];
            return noop;
        },
        set: (t, k, v) => { t[k] = v; return true; },
    });
}

const HOST_PARAMS = [
    'Math', 'document', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame',
    'userPreferences', 'FIXED_DT', 'getFrameInterval', 'currentGame',
    'xpSystemReady', 'userXP', 'checkLevelUp', 'saveUserXP', 'showXPNotification', 'updateXPDisplay',
    'awardGameXP', 'updateGameScoreBtn', 'toggleGameMaxModal',
];

module.exports = function load(opts) {
    opts = opts || {};
    const store = opts.store || {};
    const log = { xp: [], notes: [], scoreBtn: [], maxModal: [] };

    const canvas = opts.canvas || makeCanvas(368, 368, opts.ctxFactory);
    const els = {};
    const el = id => (els[id] = els[id] || { id, textContent: '', style: {} });
    const document = {
        getElementById: id => (id === 'pool-canvas' ? canvas : el(id)),
        querySelectorAll: () => [],
        addEventListener() {}, removeEventListener() {},
    };
    const localStorage = {
        getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
    };
    const rng = opts.seed == null ? Math.random : seededRandom(opts.seed);
    const MathShim = Object.create(Math, { random: { value: rng } });
    const userXP = { currentXP: 0, totalXP: 0, achievements: [] };
    let modalOpen = false;

    const host = {
        Math: MathShim,
        document,
        localStorage,
        requestAnimationFrame: () => 1,
        cancelAnimationFrame: () => {},
        userPreferences: Object.assign({ poolTableColor: 'green', gameFps: 60 }, opts.prefs),
        FIXED_DT: 1000 / 60,
        getFrameInterval: () => 16.67,
        currentGame: 'pool',
        xpSystemReady: opts.xpSystemReady !== false,
        userXP,
        checkLevelUp: () => {},
        saveUserXP: () => {},
        showXPNotification: (msg, kind) => log.notes.push({ msg, kind }),
        updateXPDisplay: () => {},
        awardGameXP: (type, perf) => log.xp.push({ type, perf }),
        updateGameScoreBtn: (game, score, best) => log.scoreBtn.push({ game, score, best }),
        toggleGameMaxModal: cfg => { log.maxModal.push(cfg); modalOpen = !modalOpen; return modalOpen; },
    };

    const src = source();
    const accessors = stateNames(src)
        .map(n => `get ${n}() { return ${n}; }, set ${n}(v) { ${n} = v; }`)
        .join(',\n');
    const fns = [...src.matchAll(/^    function\s+([\w$]+)/gm)].map(m => m[1]);
    const consts = [...src.matchAll(/^    const\s+(POOL_[A-Z0-9_]+)/gm)].map(m => m[1]);

    const factory = new Function(...HOST_PARAMS, hostStorageHelpers() + '\n' + src + `
        return {
            ${fns.join(', ')},
            ${consts.join(', ')},
            loadPoolHighScore, savePoolHighScore, loadPoolWinsByMode, savePoolWinByMode,
            loadPoolRecord, savePoolRecord,
            ${accessors}
        };
    `);
    const P = factory(...HOST_PARAMS.map(k => host[k]));
    P.host = host;
    P.log = log;
    P.store = store;
    P.canvas = canvas;
    P.elements = els;
    return P;
};

// The v2 physics on its own. It needs nothing from the host, so there is no
// stub environment: every pp* function and PP_* constant comes back as-is.
function physics() {
    const src = fs.readFileSync(path.join(__dirname, 'pool-physics.js'), 'utf8');
    const names = [...src.matchAll(/^    (?:function|const)\s+((?:pp|PP_)[\w$]*)/gm)].map(m => m[1]);
    return new Function(src + '\nreturn { ' + names.join(', ') + ' };')();
}

// The rules on top of the physics, in one scope as they will be in the
// userscript: every pp*/PP_* and pr*/PR_* name.
function rules() {
    const src = ['pool-physics.js', 'pool-rules.js']
        .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
    const names = [...src.matchAll(/^    (?:function|const)\s+((?:pp|PP_|pr|PR_)[\w$]*)/gm)].map(m => m[1]);
    return new Function(src + '\nreturn { ' + names.join(', ') + ' };')();
}

module.exports.source = source;
module.exports.physics = physics;
module.exports.rules = rules;
module.exports.stateNames = stateNames;
module.exports.seededRandom = seededRandom;
module.exports.makeCanvas = makeCanvas;
module.exports.FILES = FILES;
