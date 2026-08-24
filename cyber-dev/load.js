// Shared loader: evaluates cyber-hud.js + cyber-audio.js as one unit and hands
// back their internals. Both files are indented blocks of the userscript's IIFE
// body, so they have no exports of their own — wrapping them in a Function is
// what makes the same source both drop-in-able and testable, the trick
// ludo-dev/ and snake-dev/ use.
const fs   = require('fs');
const path = require('path');

const FILES = ['cyber-hud.js', 'cyber-audio.js'];

const DEFAULT_PREFS = {
    displayTheme: 'retro-futuristic',
    cyberBgPrimary: '#07091a',
    cyberBgSecondary: '#11142b',
    cyberAccent: '#fff200',
    cyberHighlight: '#00e5ff',
    cyberPanelTint: '#00e5ff',
    cyberText: '#fff200',
    cyberGlow: '#fff200',
    cyberBorder: '#fff200',
    cyberGlowIntensity: 0.6,
    cyberPanelShape: 'rounded',
    cyberAudioSource: 'off',
    gameFps: 60
};

function source() {
    return FILES
        .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8'))
        .join('\n\n');
}

// A style map that records what was set, so tests can assert the exact
// property list applyCyberTokens writes and clearCyberTokens removes.
function makeStyle() {
    const props = {};
    return {
        props,
        setProperty(k, v) { props[k] = String(v); },
        removeProperty(k) { delete props[k]; },
        getPropertyValue(k) { return props[k] || ''; }
    };
}

function makeClassList() {
    const set = new Set();
    return {
        set,
        add() { for (const c of arguments) set.add(c); },
        remove() { for (const c of arguments) set.delete(c); },
        contains(c) { return set.has(c); },
        toggle(c, on) {
            const want = on === undefined ? !set.has(c) : !!on;
            if (want) set.add(c); else set.delete(c);
            return want;
        }
    };
}

function makeEl(tag) {
    const el = {
        tagName: (tag || 'div').toUpperCase(),
        style: makeStyle(),
        classList: makeClassList(),
        dataset: {},
        attrs: {},
        children: [],
        textContent: '',
        clientWidth: 300,
        clientHeight: 26,
        width: 0,
        height: 0,
        offsetWidth: 300,
        isConnected: true,
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        removeAttribute(k) { delete this.attrs[k]; },
        addEventListener() {},
        removeEventListener() {},
        querySelector(sel) { return this._q[sel] || null; },
        querySelectorAll() { return []; },
        getContext() {
            return new Proxy({}, {
                get(t, k) {
                    if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
                    if (k === 'measureText') return () => ({ width: 10 });
                    return () => {};
                },
                set() { return true; }
            });
        }
    };
    el._q = {};
    return el;
}

function stubEnvironment(prefs) {
    const noop = () => {};

    const container = makeEl('div');
    const title = makeEl('h2');
    title.textContent = 'Attendance Summary';
    container._q['.summary-title'] = title;
    container.classList.add('attendance-summary', 'retro-theme');

    const byId = { 'total-time-summary': container };

    global.window = global.window || {};
    global.document = {
        documentElement: makeEl('html'),
        body: makeEl('body'),
        getElementById: id => byId[id] || null,
        querySelector: () => null,
        addEventListener: noop,
        removeEventListener: noop,
        createElement: makeEl
    };
    global.getComputedStyle = () => ({ getPropertyValue: () => '' });
    if (typeof global.performance !== 'object') global.performance = { now: () => 0 };
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = noop;
    global.setTimeout = global.setTimeout || noop;
    global.clearTimeout = global.clearTimeout || noop;
    global.navigator = { mediaDevices: {}, permissions: null };
    global.console = console;

    global.userPreferences = Object.assign({}, DEFAULT_PREFS, prefs || {});
    global.savePreferences = noop;
    global.isPipActive = false;
    global.pipWindow = null;
    global.getFrameInterval = () => 16.67;

    // The host's single hex reader. cyber-hud.js reuses it rather than
    // carrying a second copy, so the loader must provide the real one.
    global.hexToRgbStr = function (hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        if (!m) return '0, 0, 0';
        return parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16);
    };

    return { container, title, byId };
}

// Names the modules expose back to the test. Extend when a suite needs more.
const EXPORTS = [
    'CYBER_PANEL_SHAPES', 'CYBER_TOKENS', 'CYBER_EQ_BARS', 'CYBER_EQ_SOURCES',
    'cyberTokenVarNames', 'applyCyberTokens', 'clearCyberTokens',
    'cyberPanelShape', 'applyCyberShape', 'clearCyberShape',
    'relativeLuminance', 'contrastRatio', 'cyberTextContrast', 'updateCyberContrastChip',
    'updateCyberTitleGhosts', 'triggerCyberBoot',
    'applyCyberpunkTheme', 'clearCyberpunkTheme',
    'cyberEqSource', 'cyberSimBar', 'cyberEqReadBars', 'cyberEqUpdateBeat',
    'initCyberEq', 'cleanupCyberAudio', 'cyberEqUpdateButton'
];

function load(prefs) {
    const env = stubEnvironment(prefs);
    const body = source() + '\n\n return { ' + EXPORTS.map(n => n + ': ' + n).join(', ') + ' };';
    const fn = new Function(body);
    const api = fn();
    return Object.assign({}, api, env, { source: source() });
}

module.exports = { load, source, stubEnvironment, makeEl, DEFAULT_PREFS, FILES };
