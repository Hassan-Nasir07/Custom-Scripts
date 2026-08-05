// Renders the Ludo canvas to a PNG so the layout can be inspected without a
// browser. Implements just enough of CanvasRenderingContext2D for ludo-ui.js:
// transforms, polygon paths (incl. arc / ellipse / arcTo), solid + gradient
// fills, strokes, alpha, and a 3×5 bitmap font for labels.
//
//   node ludo-dev/preview.js [out.png] [scenario]
//
// Scenarios: fresh | midgame | fourplayer | gameover | rolling
// Not pixel-perfect against a real canvas — antialiasing and font differ — but
// exact on geometry, which is what it is for.

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const SS = 4;          // supersample factor
const DOWN = 2;        // downsample divisor → output is SS/DOWN × CSS size

// ── 3×5 bitmap font ────────────────────────────────────────────────────
const GLYPHS = {
    A:'25755', B:'65656', C:'34443', D:'65556', E:'74647', F:'74644', G:'34553',
    H:'55755', I:'72227', J:'11152', K:'55655', L:'44447', M:'57755', N:'57775',
    O:'25552', P:'65644', Q:'25573', R:'65655', S:'34216', T:'72222', U:'55557',
    V:'55552', W:'55775', X:'55255', Y:'55222', Z:'71247',
    0:'75557', 1:'26227', 2:'61247', 3:'61216', 4:'55711', 5:'74616', 6:'34757',
    7:'71222', 8:'75757', 9:'75716',
    ' ':'00000', '/':'11244', '.':'00002', ':':'02020', '-':'00700', '!':'22202',
    '+':'02720', ',':'00022', '?':'61202', "'":'22000',
};
const GLYPH_W = 4;     // 3px + 1px gap, in font units

// ── Colour ─────────────────────────────────────────────────────────────
function parseColour(c) {
    if (!c || typeof c !== 'string') return [0, 0, 0, 0];
    if (c[0] === '#') {
        const h = c.slice(1);
        const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
        const p = m[1].split(',').map(s => parseFloat(s.trim()));
        return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
    }
    return [0, 0, 0, 1];
}

// ── Rasterizer ─────────────────────────────────────────────────────────
class Raster {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.buf = new Uint8ClampedArray(w * h * 4);
    }
    blend(x, y, rgba, cov) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const a = rgba[3] * cov;
        if (a <= 0) return;
        const i = (y * this.w + x) * 4;
        const b = this.buf;
        b[i]     = rgba[0] * a + b[i]     * (1 - a);
        b[i + 1] = rgba[1] * a + b[i + 1] * (1 - a);
        b[i + 2] = rgba[2] * a + b[i + 2] * (1 - a);
        b[i + 3] = 255 * a + b[i + 3] * (1 - a);
    }
    // Nonzero-winding scanline fill over a list of closed subpaths.
    fillPolys(polys, rgba) {
        let minY = Infinity, maxY = -Infinity;
        polys.forEach(p => p.forEach(pt => {
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        }));
        if (!isFinite(minY)) return;
        const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.h - 1, Math.ceil(maxY));
        for (let y = y0; y <= y1; y++) {
            const sy = y + 0.5;
            const xs = [];
            polys.forEach(p => {
                for (let i = 0; i < p.length; i++) {
                    const a = p[i], b = p[(i + 1) % p.length];
                    if (a.y === b.y) continue;
                    if ((sy >= a.y && sy < b.y) || (sy >= b.y && sy < a.y)) {
                        const t = (sy - a.y) / (b.y - a.y);
                        xs.push({ x: a.x + t * (b.x - a.x), w: b.y > a.y ? 1 : -1 });
                    }
                }
            });
            if (!xs.length) continue;
            xs.sort((p, q) => p.x - q.x);
            let wind = 0;
            for (let i = 0; i < xs.length - 1; i++) {
                wind += xs[i].w;
                if (wind === 0) continue;
                const xa = Math.max(0, Math.ceil(xs[i].x - 0.5));
                const xb = Math.min(this.w - 1, Math.floor(xs[i + 1].x - 0.5));
                for (let x = xa; x <= xb; x++) this.blend(x, y, rgba, 1);
            }
        }
    }
}

// ── Context shim ───────────────────────────────────────────────────────
class Ctx {
    constructor(raster, scale) {
        this.r = raster;
        this.s = scale;
        this.stack = [];
        this.m = [scale, 0, 0, scale, 0, 0];       // a b c d e f
        this.fillStyle = '#000'; this.strokeStyle = '#000';
        this.lineWidth = 1; this.globalAlpha = 1;
        this.font = '10px sans-serif';
        this.textAlign = 'left'; this.textBaseline = 'alphabetic';
        this.shadowColor = ''; this.shadowBlur = 0; this.shadowOffsetY = 0;
        this.lineCap = 'butt';
        this.subpaths = []; this.cur = null; this._pt = null;
    }
    get canvas() { return { width: this.r.w / this.s, height: this.r.h / this.s }; }

    save() {
        this.stack.push({
            m: this.m.slice(), fill: this.fillStyle, stroke: this.strokeStyle,
            lw: this.lineWidth, ga: this.globalAlpha, font: this.font,
            ta: this.textAlign, tb: this.textBaseline,
        });
    }
    restore() {
        const s = this.stack.pop();
        if (!s) return;
        this.m = s.m; this.fillStyle = s.fill; this.strokeStyle = s.stroke;
        this.lineWidth = s.lw; this.globalAlpha = s.ga; this.font = s.font;
        this.textAlign = s.ta; this.textBaseline = s.tb;
    }
    translate(x, y) {
        this.m[4] += this.m[0] * x + this.m[2] * y;
        this.m[5] += this.m[1] * x + this.m[3] * y;
    }
    rotate(a) {
        const c = Math.cos(a), s = Math.sin(a);
        const [m0, m1, m2, m3] = this.m;
        this.m[0] = m0 * c + m2 * s;  this.m[1] = m1 * c + m3 * s;
        this.m[2] = m0 * -s + m2 * c; this.m[3] = m1 * -s + m3 * c;
    }
    // ludoRender calls setTransform(s,0,0,s,0,0) where s is derived from
    // canvas.width. Compose it onto the supersample scale rather than replacing
    // it, or the preview would render at 1/SS size.
    setTransform(a, b, c, d, e, f) {
        this.m = [a * this.s, b * this.s, c * this.s, d * this.s, e * this.s, f * this.s];
    }

    tp(x, y) {
        return { x: this.m[0] * x + this.m[2] * y + this.m[4],
                 y: this.m[1] * x + this.m[3] * y + this.m[5] };
    }
    scaleLen(v) { return v * Math.hypot(this.m[0], this.m[1]); }

    // Dashes are ignored — the preview only needs the stroke's position and
    // colour, and a solid ring reads the same for layout checking.
    setLineDash() {}
    getLineDash() { return []; }

    beginPath() { this.subpaths = []; this.cur = null; this._pt = null; }
    moveTo(x, y) { this.cur = [this.tp(x, y)]; this.subpaths.push(this.cur); this._pt = { x, y }; }
    lineTo(x, y) {
        if (!this.cur) return this.moveTo(x, y);
        this.cur.push(this.tp(x, y)); this._pt = { x, y };
    }
    closePath() { this.cur = null; }
    rect(x, y, w, h) {
        this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h);
        this.closePath();
    }
    arc(cx, cy, r, a0, a1, ccw) {
        let da = a1 - a0;
        if (!ccw && da < 0) da += Math.PI * 2;
        if (ccw && da > 0) da -= Math.PI * 2;
        const steps = Math.max(6, Math.ceil(Math.abs(da) * Math.max(4, this.scaleLen(r)) / 3));
        for (let i = 0; i <= steps; i++) {
            const a = a0 + da * (i / steps);
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            i === 0 && !this.cur ? this.moveTo(x, y) : this.lineTo(x, y);
        }
    }
    ellipse(cx, cy, rx, ry, rot, a0, a1) {
        const steps = 48;
        for (let i = 0; i <= steps; i++) {
            const a = a0 + (a1 - a0) * (i / steps);
            const px = Math.cos(a) * rx, py = Math.sin(a) * ry;
            const x = cx + px * Math.cos(rot) - py * Math.sin(rot);
            const y = cy + px * Math.sin(rot) + py * Math.cos(rot);
            i === 0 && !this.cur ? this.moveTo(x, y) : this.lineTo(x, y);
        }
    }
    arcTo(x1, y1, x2, y2, r) {
        const p0 = this._pt;
        if (!p0) return this.moveTo(x1, y1);
        const v1 = { x: p0.x - x1, y: p0.y - y1 }, v2 = { x: x2 - x1, y: y2 - y1 };
        const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y);
        if (!l1 || !l2 || !r) return this.lineTo(x1, y1);
        const u1 = { x: v1.x / l1, y: v1.y / l1 }, u2 = { x: v2.x / l2, y: v2.y / l2 };
        const ang = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)));
        if (ang < 1e-6 || Math.abs(ang - Math.PI) < 1e-6) return this.lineTo(x1, y1);
        const d = r / Math.tan(ang / 2);
        const t0 = { x: x1 + u1.x * d, y: y1 + u1.y * d };
        const t1 = { x: x1 + u2.x * d, y: y1 + u2.y * d };
        const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
        const bl = Math.hypot(bis.x, bis.y) || 1;
        const cd = r / Math.sin(ang / 2);
        const c = { x: x1 + bis.x / bl * cd, y: y1 + bis.y / bl * cd };
        this.lineTo(t0.x, t0.y);
        let a0 = Math.atan2(t0.y - c.y, t0.x - c.x);
        let a1 = Math.atan2(t1.y - c.y, t1.x - c.x);
        let da = a1 - a0;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const steps = Math.max(3, Math.ceil(Math.abs(da) / 0.25));
        for (let i = 1; i <= steps; i++) {
            const a = a0 + da * (i / steps);
            this.lineTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
        }
    }

    _rgba(style) {
        const c = parseColour(typeof style === 'object' && style ? style.mid() : style);
        return [c[0], c[1], c[2], c[3] * this.globalAlpha];
    }
    fill() { this.r.fillPolys(this.subpaths.filter(p => p.length > 2), this._rgba(this.fillStyle)); }
    stroke() {
        const rgba = this._rgba(this.strokeStyle);
        const wpx = Math.max(1, this.scaleLen(this.lineWidth));
        this.subpaths.forEach(p => {
            for (let i = 0; i < p.length - 1; i++) this._seg(p[i], p[i + 1], wpx, rgba);
        });
    }
    _seg(a, b, w, rgba) {
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        if (!len) return;
        const nx = -dy / len * w / 2, ny = dx / len * w / 2;
        this.r.fillPolys([[
            { x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
            { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny },
        ]], rgba);
    }
    fillRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.fill(); }
    strokeRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.closePath();
        const rgba = this._rgba(this.strokeStyle), wpx = Math.max(1, this.scaleLen(this.lineWidth));
        const p = this.subpaths[0];
        for (let i = 0; i < p.length; i++) this._seg(p[i], p[(i + 1) % p.length], wpx, rgba);
    }
    // Resets to the panel colour rather than to transparent. In the widget the
    // canvas has a CSS background behind it, so clearing to alpha 0 would make
    // every translucent HUD fill composite against nothing and read far too
    // bright — an artefact of the preview, not of the renderer.
    clearRect(x, y, w, h) {
        const a = this.tp(x, y), b = this.tp(x + w, y + h);
        const bg = parseColour(Ctx.BACKDROP);
        for (let yy = Math.max(0, a.y | 0); yy < Math.min(this.r.h, b.y | 0); yy++)
            for (let xx = Math.max(0, a.x | 0); xx < Math.min(this.r.w, b.x | 0); xx++) {
                const i = (yy * this.r.w + xx) * 4;
                this.r.buf[i] = bg[0]; this.r.buf[i + 1] = bg[1];
                this.r.buf[i + 2] = bg[2]; this.r.buf[i + 3] = 255;
            }
    }
    createLinearGradient() {
        const stops = [];
        return { addColorStop(o, c) { stops.push(c); }, mid() { return stops[Math.floor(stops.length / 2)] || '#888'; } };
    }
    createRadialGradient() { return this.createLinearGradient(); }

    _fontPx() { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return m ? parseFloat(m[1]) : 10; }
    measureText(s) { return { width: String(s).length * this._fontPx() * 0.56 }; }
    fillText(str, x, y) {
        const px = this._fontPx();
        const unit = px / 5.6;                       // glyph cell height ≈ font size
        const text = String(str).toUpperCase();
        const w = text.length * GLYPH_W * unit;
        let ox = x;
        if (this.textAlign === 'center') ox -= w / 2;
        else if (this.textAlign === 'right') ox -= w;
        let oy = y - unit * 5;
        if (this.textBaseline === 'middle') oy = y - unit * 2.5;
        else if (this.textBaseline === 'top') oy = y;
        const rgba = this._rgba(this.fillStyle);
        for (let i = 0; i < text.length; i++) {
            const g = GLYPHS[text[i]];
            const gx = ox + i * GLYPH_W * unit;
            if (!g) {                                 // unknown glyph → hollow box
                this.beginPath(); this.rect(gx, oy, unit * 3, unit * 5);
                const keep = this.fillStyle; this.strokeStyle = keep;
                this.lineWidth = unit * 0.4; this.stroke();
                continue;
            }
            for (let row = 0; row < 5; row++) {
                const bits = parseInt(g[row], 8);
                for (let col = 0; col < 3; col++) {
                    if (!(bits & (4 >> col))) continue;
                    const a = this.tp(gx + col * unit, oy + row * unit);
                    const b = this.tp(gx + (col + 1) * unit, oy + (row + 1) * unit);
                    this.r.fillPolys([[
                        { x: a.x, y: a.y }, { x: b.x, y: a.y },
                        { x: b.x, y: b.y }, { x: a.x, y: b.y },
                    ]], rgba);
                }
            }
        }
    }
}

// ── PNG ────────────────────────────────────────────────────────────────
const CRC = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (w * 4 + 1)] = 0;
        Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}
function downsample(src, w, h, f) {
    const ow = w / f | 0, oh = h / f | 0;
    const out = new Uint8ClampedArray(ow * oh * 4);
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
            const i = ((y * f + dy) * w + x * f + dx) * 4;
            r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
        }
        const n = f * f, o = (y * ow + x) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
    return { buf: out, w: ow, h: oh };
}

// ── Drive the real renderer ────────────────────────────────────────────
// Canvas size is read out of ludo-core.js so this never drifts from the game.
const coreSrc = fs.readFileSync(path.join(__dirname, 'ludo-core.js'), 'utf8');
const num = name => parseInt(new RegExp(name + '\\s*=\\s*(\\d+)').exec(coreSrc)[1], 10);
const W = num('LUDO_CANVAS_W');
const H = num('LUDO_GRID') * num('LUDO_CELL') + num('LUDO_STRIP_H') * 2;

Ctx.BACKDROP = '#1c1b38';                 // matches the widget's game panel
const raster = new Raster(W * SS, H * SS);
const ctx = new Ctx(raster, SS);
ctx.fillStyle = Ctx.BACKDROP;
ctx.fillRect(0, 0, W, H);

const canvasStub = {
    width: W, height: H,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
    addEventListener() {}, removeEventListener() {},
};
global.document = { getElementById: id => (id === 'ludo-canvas' ? canvasStub : null) };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
};
global.awardGameXP = () => {};
global.getFrameInterval = () => 0;

const load = require('./load');
const L = load();
L.initLudoGame();

const scenario = process.argv[3] || 'midgame';
const outPath  = process.argv[2] || path.join(__dirname, 'preview.png');

function pump(ms) { for (let i = 0; i < ms; i += 16) L.ludoUpdate(16); }

if (scenario === 'fresh') {
    L.ludoSetMode('cpu2');
} else if (scenario === 'fourplayer') {
    L.ludoSetMode('pvp4');
    L.startLudoGame();
    [[0, 0, 7], [0, 1, 22], [0, 2, 22], [1, 0, 13], [1, 1, 40], [2, 0, 3], [2, 1, 53],
     [3, 0, 30], [3, 1, 56], [3, 2, 47]].forEach(([c, i, s]) => L.place(c, i, s));
    L.turn = 1;
} else if (scenario === 'gameover') {
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    for (let i = 0; i < 4; i++) L.place(0, i, 56);
    L.place(2, 0, 40); L.place(2, 1, 12);
    L.placements.push(0);
    L.phase = 'over';
} else if (scenario === 'recap') {
    // The reported case: everything still in base, rolled a 4, turn passed.
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    load.forceDice(4);
    L.ludoDoRoll();
    pump(L.LUDO_DICE_MS + 40);
    load.restoreDice();
} else if (scenario === 'recap4p') {
    // Worst case for layout: 3P, where two chips share the top strip with the
    // live dice, and the recap is three sixes.
    L.ludoSetMode('pvp3');
    L.startLudoGame();
    L.place(0, 0, 12);
    L.recap = { ci: 0, faces: [6, 6, 6] };
    L.turn = 1;
} else if (scenario === 'pool') {
    // 6,6,5 banked, one token out, popover open on it.
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.place(0, 0, 12);
    L.place(2, 0, 20);
    [6, 6, 5].forEach(f => {
        load.forceDice(f);
        L.ludoDoRoll();
        pump(L.LUDO_DICE_MS + 40);
    });
    load.restoreDice();
    L.ludoRender();                       // populate renderPos for the anchor
    L.popover = { token: L.tok(0, 0) };
} else if (scenario === 'rolling') {
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.place(0, 0, 8); L.place(0, 1, 21);
    L.ludoDoRoll();
    pump(200);
} else {                                   // midgame — the default
    L.ludoSetMode('cpu2');
    L.startLudoGame();
    L.place(0, 0, 8); L.place(0, 1, 24); L.place(0, 2, 52);
    L.place(2, 0, 3); L.place(2, 1, 3); L.place(2, 2, 45);
    load.forceDice(3);
    L.ludoDoRoll();
    pump(L.LUDO_DICE_MS + 40);
    load.restoreDice();
}

L.ludoRender();

const small = downsample(raster.buf, W * SS, H * SS, DOWN);
fs.writeFileSync(outPath, encodePNG(small.w, small.h, small.buf));
console.log(`${scenario} → ${outPath}  (${small.w}×${small.h})`);
console.log(`phase=${L.phase} turn=${L.LUDO_COLORS[L.active[L.turn]].label} ` +
            `dice=${L.diceFace} legal=${L.legal.length}`);
