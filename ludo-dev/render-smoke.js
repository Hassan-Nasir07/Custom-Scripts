// Drives ludoRender() against a recording 2D-context stub so typos and
// undefined references in the drawing code surface without opening a browser.
const calls = {};
const rec = new Proxy({}, {
    get: (_, k) => {
        if (k === 'canvas') return { width: 368, height: 368 };
        return () => { calls[k] = (calls[k] || 0) + 1; };
    },
    set: (_, k) => { calls['set:' + k] = (calls['set:' + k] || 0) + 1; return true; },
});
// Must exist before ludoRender runs — it looks the canvas up by id.
global.document = {
    getElementById: id => (id === 'ludo-canvas' ? { getContext: () => rec } : null),
};

const load = require('./load');

let pass = 0, fail = 0;
const t = (name, fn) => {
    try { fn(); pass++; console.log('  ✓ ' + name); }
    catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + e.message); }
};

console.log('\n── Render smoke ──────────────────────────────────');

const L = load();

['cpu2', 'pvp2', 'pvp3', 'pvp4'].forEach(m => {
    t(`renders in ${m}`, () => { L.ludoSetMode(m); L.ludoRender(); });
});

t('renders with the ring-index overlay on', () => {
    L.debugRing = true; L.ludoRender(); L.debugRing = false;
});

t('renders a message banner and CPU tier', () => {
    L.ludoSetMode('cpu2');
    L.message = 'Three sixes — turn forfeited';
    L.cpuTier = 'hard';
    L.ludoRender();
    L.message = '';
});

t('renders tokens in base, on the ring, in a home column and home', () => {
    L.ludoSetMode('pvp4');
    L.place(0, 0, 0); L.place(1, 0, 50); L.place(2, 0, 53); L.place(3, 0, 56);
    L.ludoRender();
});

t('renders every step 0..56 for all four colours', () => {
    L.ludoSetMode('pvp4');
    for (let ci = 0; ci < 4; ci++) {
        L.ludoResetTokens();
        for (let s = 0; s <= 56; s++) { L.place(ci, 0, s); L.ludoRender(); }
    }
});

t('every token position resolves to finite coordinates', () => {
    L.ludoSetMode('pvp4');
    for (let ci = 0; ci < 4; ci++) {
        for (let s = -1; s <= 56; s++) {
            const tk = L.place(ci, 0, s);
            const p = L.ludoTokenXY(tk);
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
                throw new Error(`ci=${ci} step=${s} → ${p.x},${p.y}`);
            }
        }
    }
});

t('highlighting each seat in turn renders', () => {
    L.ludoSetMode('pvp4');
    for (let i = 0; i < 4; i++) { L.turn = i; L.ludoRender(); }
});

console.log(`\n  fill=${calls.fill} stroke=${calls.stroke} fillRect=${calls.fillRect} ` +
            `fillText=${calls.fillText} arc=${calls.arc}`);
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
