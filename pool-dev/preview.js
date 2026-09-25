// Renders the real pool canvas to a PNG so the art can be judged without a
// browser. pool-verify.js proves drawPoolFrame does not throw; this is for
// whether it looks right.
//
//   node pool-dev/preview.js [out.png] [scenario]
//
// Scenarios: rack | aim | power | break | foul | groups | cpu | gameover | max | all
// `all` (the default) renders every scenario on one contact sheet.
//
// The rasterizer is borrowed from ludo-dev/preview.js, as snake-dev does. It is
// exact on geometry but not on finish: no antialiasing on strokes, no dashes, a
// 3×5 bitmap font, gradients flattened to their middle stop, and clip() is a
// no-op here, so striped balls render as solid discs. Judge layout, not polish.
const fs   = require('fs');
const path = require('path');
const { Raster, Ctx, encodePNG, downsample, SS, DOWN } = require('../ludo-dev/preview.js');
const load = require('./load');

const W = 368, H = 368;

// ── Fill the gaps the Ludo renderer never needed ───────────────────────
Ctx.prototype.scale = function (sx, sy) {
    const m = this.m;
    this.m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]];
};
Ctx.prototype.clip = function () {};
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
    corner(x + w - r, y + r, -Math.PI / 2, 0);
    this.lineTo(x + w, y + h - r);
    corner(x + w - r, y + h - r, 0, Math.PI / 2);
    this.lineTo(x + r, y + h);
    corner(x + r, y + h - r, Math.PI / 2, Math.PI);
    this.lineTo(x, y + r);
    corner(x + r, y + r, Math.PI, Math.PI * 1.5);
    this.closePath();
};

function settle(P, frames) {
    for (let f = 0; f < frames && !P.poolAllStopped(); f++) P.poolPhysicsUpdate();
}

// Each scenario receives a loaded engine with a fresh rack and sets up the moment to draw.
const SCENARIOS = {
    rack(P) {},
    aim(P) {
        P.poolPlacingBall = false; P.poolBallInHand = false; P.poolGameRunning = true;
        P.poolMouseX = 300; P.poolMouseY = 200; P.poolCueAngle = 0.05;
    },
    power(P) {
        P.poolPlacingBall = false; P.poolBallInHand = false; P.poolGameRunning = true;
        P.poolAimLocked = true; P.poolLockedAngle = 0.02; P.poolDragging = true; P.poolCuePower = 16;
    },
    break(P) {
        P.poolPlacingBall = false; P.poolBallInHand = false; P.poolGameRunning = true;
        P.poolFireShot(P.poolBalls[0], 0, P.POOL_CUE_MAX_POWER);
        settle(P, 40);
    },
    foul(P) {
        P.poolFireShot(P.poolBalls[0], 0, P.POOL_CUE_MAX_POWER);
        settle(P, 6000);
        P.poolTurn = 2; P.poolPlacingBall = true; P.poolBallInHand = true; P.poolIsBreakShot = false;
        P.poolFoulMessage = 'Scratch! Ball in hand';
        P.poolMouseX = 120; P.poolMouseY = 180;
    },
    groups(P) {
        P.poolFireShot(P.poolBalls[0], 0, P.POOL_CUE_MAX_POWER);
        settle(P, 6000);
        P.poolPlacingBall = false; P.poolBallInHand = false; P.poolGameRunning = true;
        P.poolFirstPocket = true; P.poolPlayer1Group = 'solids'; P.poolPlayer2Group = 'stripes';
        P.poolPlayer1Pocketed = [1, 4, 6]; P.poolPlayer2Pocketed = [10, 13];
        P.poolBalls.forEach(b => { if ([1, 4, 6, 10, 13].includes(b.id)) b.pocketed = true; });
        P.poolBalls[0].pocketed = false;
        P.poolShotTimer = 11;
        P.poolMouseX = 260; P.poolMouseY = 150;
    },
    cpu(P) {
        P.poolFireShot(P.poolBalls[0], 0, P.POOL_CUE_MAX_POWER);
        settle(P, 6000);
        P.poolBalls[0].pocketed = false;
        P.poolPlacingBall = false; P.poolBallInHand = false; P.poolTurn = 2; P.poolShotFired = false;
        P.poolAITakeShot(true);
    },
    gameover(P) {
        P.poolFireShot(P.poolBalls[0], 0, P.POOL_CUE_MAX_POWER);
        settle(P, 6000);
        P.poolGameOver = true; P.poolWinner = 2;
    },
    max(P) {
        SCENARIOS.aim(P);
    },
};

function render(name) {
    const scale = name === 'max' ? 2 : 1;
    const w = W * scale, h = H * scale;
    const raster = new Raster(w * SS, h * SS);
    const ctx = new Ctx(raster, SS);
    ctx.fillStyle = '#0b0f12';
    ctx.fillRect(0, 0, w, h);
    const canvas = load.makeCanvas(w, h, () => ctx);
    const P = load({ seed: 4, canvas });
    P.initPoolGame();
    SCENARIOS[name](P);
    P.drawPoolFrame();
    return { raster, w, h };
}

function writePNG(file, raster, w, h) {
    const small = downsample(raster.buf, raster.w, raster.h, DOWN);
    fs.writeFileSync(file, encodePNG(small.w, small.h, small.buf));
    console.log('  wrote ' + path.relative(process.cwd(), file) + ` (${w * SS / DOWN}×${h * SS / DOWN})`);
}

// Defaults outside the repo (there is no .gitignore), so a bare run never leaves a PNG to commit.
const out = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'pool-preview.png'));
const which = process.argv[3] || 'all';

if (which === 'all') {
    const names = Object.keys(SCENARIOS).filter(n => n !== 'max');
    const cols = 4, rows = Math.ceil(names.length / cols);
    const sheet = new Raster(W * cols * SS, H * rows * SS);
    names.forEach((n, i) => {
        const { raster } = render(n);
        const ox = (i % cols) * W * SS, oy = Math.floor(i / cols) * H * SS;
        for (let y = 0; y < raster.h; y++) {
            const src = y * raster.w * 4, dst = ((oy + y) * sheet.w + ox) * 4;
            sheet.buf.set(raster.buf.subarray(src, src + raster.w * 4), dst);
        }
    });
    writePNG(out, sheet, W * cols, H * rows);
    console.log('  scenarios, left to right: ' + names.join(', '));
} else if (SCENARIOS[which]) {
    const { raster, w, h } = render(which);
    writePNG(out, raster, w, h);
} else {
    console.error('unknown scenario "' + which + '"; try: ' + Object.keys(SCENARIOS).join(' | ') + ' | all');
    process.exit(1);
}
