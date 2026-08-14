// Renders the real snake canvas to a PNG so the art can be judged without a
// browser. The headless suite proves drawSnakeGame doesn't throw; it says
// nothing about whether the snake looks like a snake, which is the only thing
// this file is for.
//
//   node snake-dev/preview.js [out.png] [scenario]
//
// Scenarios: idle | crawling | turning | eating | swallow | wrap | levels |
//            walled | dying | long | skins
//
// The rasterizer is borrowed from ludo-dev/preview.js rather than duplicated.
// Not pixel-perfect against a real canvas — no antialiasing on strokes, a 3×5
// bitmap font, gradients flattened to their middle stop — but exact on
// geometry, which is what it is for.

const fs   = require('fs');
const path = require('path');
const { Raster, Ctx, encodePNG, downsample, SS, DOWN } = require('../ludo-dev/preview.js');

const W = 368, H = 368;

// ── Fill the two gaps the Ludo renderer never needed ───────────────────
// roundRect: sampled by hand rather than via arcTo, so it doesn't depend on
// how the shim threads subpaths through corner arcs.
Ctx.prototype.roundRect = function (x, y, w, h, rad) {
    const r = Math.max(0, Math.min(rad || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    const corner = (cx, cy, a0, a1) => {
        for (let i = 0; i <= 8; i++) {
            const a = a0 + (a1 - a0) * i / 8;
            this.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
    };
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    corner(x + w - r, y + r,     -Math.PI / 2, 0);
    this.lineTo(x + w, y + h - r);
    corner(x + w - r, y + h - r,  0, Math.PI / 2);
    this.lineTo(x + r, y + h);
    corner(x + r, y + h - r,      Math.PI / 2, Math.PI);
    this.lineTo(x, y + r);
    corner(x + r, y + r,          Math.PI, Math.PI * 1.5);
    this.closePath();
};

// hsl(): the legendary skin's hue wave is expressed in hsl, which the Ludo
// renderer never emitted, so it would otherwise rasterize as transparent.
function hslToRgb(str) {
    const m = /hsla?\(\s*([-\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)/.exec(str);
    if (!m) return str;
    const h = ((+m[1] % 360) + 360) % 360 / 360, s = +m[2] / 100, l = +m[3] / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = t => {
        t = (t + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const to = v => Math.round((s === 0 ? l : v) * 255);
    return 'rgba(' + to(hue(h + 1 / 3)) + ',' + to(hue(h)) + ',' + to(hue(h - 1 / 3)) +
           ',' + (m[4] === undefined ? 1 : +m[4]) + ')';
}
const baseRgba = Ctx.prototype._rgba;
Ctx.prototype._rgba = function (style) {
    if (typeof style === 'string' && style.slice(0, 3) === 'hsl') style = hslToRgb(style);
    return baseRgba.call(this, style);
};
// Gradients too: the shim flattens one to its middle stop, and the legendary
// head's stops are hsl. Without this the preview renders that head black and
// looks like a bug in the game rather than in the tool. createRadialGradient
// delegates to createLinearGradient in the shim, so one patch covers both.
const baseGrad = Ctx.prototype.createLinearGradient;
Ctx.prototype.createLinearGradient = function () {
    const g = baseGrad.apply(this, arguments);
    const mid = g.mid.bind(g);
    g.mid = () => hslToRgb(mid());
    return g;
};

// ── Environment ────────────────────────────────────────────────────────
const raster = new Raster(W * SS, H * SS);
const ctx = new Ctx(raster, SS);
const canvasStub = {
    width: W, height: H,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
    addEventListener() {}, removeEventListener() {},
};

const store = {};
global.localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
};
global.document = {
    hidden: false,
    getElementById: id => (id === 'snake-canvas' ? canvasStub : null),
    addEventListener() {}, removeEventListener() {},
};
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.userPreferences = { gameFps: 60, snakeMode: 'endless', snakeSkin: 'emerald' };
global.savePreferences = () => {};
global.userXP = { achievements: [] };
global.ACHIEVEMENTS = {};
global.escapeHtml = s => String(s);
global.getFrameInterval = () => 16.67;
global.awardGameXP = () => {};
global.leaderboardData = [];

const src = ['snake-core.js', 'snake-ui.js']
    .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8'))
    .join('\n\n');

const S = new Function(src + `
    return {
        SNAKE_STAGES, SNAKE_SKINS, snakeWrapFlags, snakeExpandWalls,
        initSnakeGame, resetSnakeGame, snakeSetMode, drawSnakeGame, snakeApplyRules,
        set body(v){ snakeBody = v; }, get body(){ return snakeBody; },
        set prevSnap(v){ snakePrevSnap = v; },
        set dir(v){ snakeDir = v; },
        set food(v){ snakeFood = v; },
        set bigFood(v){ snakeBigFood = v; },
        set score(v){ snakeScore = v; },
        set bulges(v){ snakeBulges = v; },
        set dying(v){ snakeDying = v; },
        set deathT(v){ snakeDeathT = v; },
        set deathCell(v){ snakeDeathCell = v; },
        set skinTime(v){ snakeSkinTime = v; },
        set stageIdx(v){ snakeStageIdx = v; },
        set stageEaten(v){ snakeStageEaten = v; },
        set paused(v){ snakeGamePaused = v; },
        set running(v){ snakeGameRunning = v; },
    };
`)();

// ── Scenarios ──────────────────────────────────────────────────────────
const line = (x0, y0, dx, dy, n) =>
    Array.from({ length: n }, (_, i) => ({ x: x0 + dx * i, y: y0 + dy * i }));

const SCENARIOS = {
    idle(t) {
        S.snakeSetMode('endless');
        S.food = { x: 14, y: 10 };
        return t;
    },
    crawling(t) {
        S.snakeSetMode('endless');
        S.body = line(11, 10, -1, 0, 9);
        S.prevSnap = line(10, 10, -1, 0, 9);
        S.dir = { x: 1, y: 0 };
        S.food = { x: 16, y: 10 };
        S.score = 8;
        return 0.5;
    },
    turning(t) {
        S.snakeSetMode('endless');
        S.body = [{ x: 10, y: 6 }, { x: 10, y: 7 }, { x: 10, y: 8 },
                  { x: 9, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 9 }, { x: 8, y: 10 },
                  { x: 7, y: 10 }, { x: 6, y: 10 }, { x: 6, y: 11 }, { x: 6, y: 12 }];
        S.prevSnap = S.body.map(s => ({ ...s }));
        S.dir = { x: 0, y: -1 };
        S.food = { x: 15, y: 4 };
        S.score = 10;
        return 1;
    },
    eating(t) {
        S.snakeSetMode('endless');
        S.body = line(9, 10, -1, 0, 7);
        S.prevSnap = line(8, 10, -1, 0, 7);
        S.dir = { x: 1, y: 0 };
        S.food = { x: 10, y: 10 };     // directly ahead → jaws open
        S.score = 6;
        return 0.95;
    },
    swallow(t) {
        S.snakeSetMode('endless');
        S.body = line(13, 10, -1, 0, 14);
        S.prevSnap = S.body.map(s => ({ ...s }));
        S.dir = { x: 1, y: 0 };
        S.food = { x: 17, y: 4 };
        S.bulges = [{ pos: 3, size: 1 }, { pos: 9, size: 0 }];
        S.score = 21;
        return 1;
    },
    wrap(t) {
        S.snakeSetMode('endless');
        S.body = [{ x: 1, y: 10 }, { x: 0, y: 10 },
                  { x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }, { x: 16, y: 10 }];
        S.prevSnap = S.body.map(s => ({ ...s }));
        S.dir = { x: 1, y: 0 };
        S.food = { x: 8, y: 5 };
        S.score = 5;
        return 1;
    },
    walled(t) {
        S.snakeSetMode('walled');
        S.body = line(10, 10, 0, 1, 11);
        S.prevSnap = S.body.map(s => ({ ...s }));
        S.dir = { x: 0, y: -1 };
        S.food = { x: 3, y: 3 };
        S.bigFood = { x: 15, y: 6, bornMs: -4000, ttlMs: 13500 };
        S.score = 10;
        return 1;
    },
    levels(t) {
        S.snakeSetMode('levels');
        S.stageIdx = 5;
        S.snakeApplyRules();
        S.body = line(13, 12, 1, 0, 8);
        S.prevSnap = S.body.map(s => ({ ...s }));
        S.dir = { x: -1, y: 0 };
        S.food = { x: 3, y: 3 };
        S.stageEaten = 4;
        S.score = 33;
        return 1;
    },
    dying(t) {
        S.snakeSetMode('walled');
        S.body = line(2, 10, 1, 0, 10);
        S.prevSnap = S.body.map(s => ({ ...s }));
        S.dir = { x: -1, y: 0 };
        S.food = { x: 14, y: 14 };
        S.dying = true;
        S.deathT = 1050;               // into the fade
        S.deathCell = { x: 1, y: 10 };
        S.score = 18;
        return 1;
    },
    long(t) {
        S.snakeSetMode('endless');
        const body = [];
        for (let row = 0; row < 8; row++) {
            const y = 3 + row * 2;
            const rtl = row % 2 === 1;
            for (let i = 0; i < 14; i++) body.push({ x: rtl ? 3 + i : 16 - i, y });
            if (row < 7) body.push({ x: rtl ? 16 : 3, y: y + 1 });
        }
        S.body = body.reverse();
        S.prevSnap = S.body.map(s => ({ ...s }));
        S.dir = { x: 0, y: -1 };
        S.food = { x: 18, y: 18 };
        S.bulges = [{ pos: 6, size: 1 }];
        S.score = 118;
        return 1;
    },
};

// A strip of every skin on the same pose, so they can be compared directly.
function renderSkins(outPath) {
    const ids = Object.keys(S.SNAKE_SKINS);
    const cell = 180;
    const cols = 3, rows = Math.ceil(ids.length / cols);
    const sheetW = cell * cols, sheetH = cell * rows;
    const sheet = new Raster(sheetW * SS, sheetH * SS);
    // Paint the backdrop first — an odd skin count leaves a trailing tile, and
    // an untouched raster is transparent, which reads as a blown-out white gap.
    const sheetCtx = new Ctx(sheet, SS);
    sheetCtx.fillStyle = '#0b1a12';
    sheetCtx.fillRect(0, 0, sheetW, sheetH);

    ids.forEach((id, i) => {
        global.userPreferences.snakeSkin = id;
        global.userXP.achievements = Object.keys(S.SNAKE_SKINS)
            .map(k => S.SNAKE_SKINS[k].unlock).filter(Boolean);
        const r = new Raster(W * SS, H * SS);
        const c = new Ctx(r, SS);
        canvasStub.getContext = () => c;
        S.initSnakeGame();
        S.snakeSetMode('endless');
        S.body = [{ x: 12, y: 10 }, { x: 11, y: 10 }, { x: 10, y: 10 }, { x: 9, y: 10 },
                  { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 7, y: 11 }, { x: 7, y: 12 },
                  { x: 8, y: 12 }, { x: 9, y: 12 }, { x: 10, y: 12 }];
        S.prevSnap = S.body.map(s => ({ ...s }));
        S.dir = { x: 1, y: 0 };
        S.food = { x: 16, y: 6 };
        S.skinTime = 1.7;
        S.drawSnakeGame(1);

        // Nearest-neighbour blit of the 368² board into a `cell`-sized tile.
        const cx = (i % cols) * cell * SS, cy = Math.floor(i / cols) * cell * SS;
        const scale = (W * SS) / (cell * SS);
        for (let y = 0; y < cell * SS; y++) {
            for (let x = 0; x < cell * SS; x++) {
                const sx = Math.min(W * SS - 1, Math.floor(x * scale));
                const sy = Math.min(H * SS - 1, Math.floor(y * scale));
                const si = (sy * W * SS + sx) * 4;
                const di = ((cy + y) * sheetW * SS + cx + x) * 4;
                for (let k = 0; k < 4; k++) sheet.buf[di + k] = r.buf[si + k];
            }
        }
    });

    const small = downsample(sheet.buf, sheetW * SS, sheetH * SS, DOWN);
    fs.writeFileSync(outPath, encodePNG(small.w, small.h, small.buf));
    console.log(`skins → ${outPath}  (${small.w}×${small.h})  ${ids.join(', ')}`);
}

// ── Run ────────────────────────────────────────────────────────────────
const outPath  = process.argv[2] || path.join(__dirname, 'preview.png');
const scenario = process.argv[3] || 'crawling';

if (scenario === 'skins') {
    renderSkins(outPath);
} else {
    const fn = SCENARIOS[scenario];
    if (!fn) {
        console.error('unknown scenario: ' + scenario);
        console.error('try: ' + Object.keys(SCENARIOS).concat('skins').join(' | '));
        process.exit(1);
    }
    S.initSnakeGame();
    S.skinTime = 1.7;
    const t = fn(1);
    S.drawSnakeGame(typeof t === 'number' ? t : 1);

    const small = downsample(raster.buf, W * SS, H * SS, DOWN);
    fs.writeFileSync(outPath, encodePNG(small.w, small.h, small.buf));
    console.log(`${scenario} → ${outPath}  (${small.w}×${small.h})  len=${S.body.length}`);
}
