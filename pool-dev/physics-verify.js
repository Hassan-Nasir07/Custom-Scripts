// Pool v2 physics verification. `node pool-dev/physics-verify.js [fuzz-shots=300]`
//
// Checks pool-physics.js against how real balls behave, not just that it
// runs: exact closed-form results (5/7 stun-to-roll, v²/2μg rolling
// distance), the rules of thumb players aim by (stop shot, 90°, 30°), throw,
// English off a cushion, and the pockets. Then a fuzz run for the
// invariants: energy never rises, balls never overlap, nothing leaves the
// table, everything settles, and the same shot always plays out the same.
const P = require('./load').physics();

const FUZZ = parseInt(process.argv[2], 10) || 300;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name + (detail !== undefined ? '  (' + detail + ')' : '')); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));
const deg = r => r * 180 / Math.PI;
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// A world holding just the given balls: [[id, x, y], …].
function table(balls, cfg) {
    const w = P.ppCreateWorld(cfg);
    w.balls = balls.map(([id, x, y]) => P.ppMakeBall(id, x, y));
    return w;
}
const ball = (w, id) => w.balls.find(b => b.id === id);
// Steps in small slices until pred() holds; returns false on timeout.
function runUntil(w, pred, maxT) {
    const t0 = w.t;
    while (!pred()) {
        if (w.t - t0 > (maxT || 30) || P.ppSettled(w)) return pred();
        P.ppStep(w, 1 / 600);
    }
    return true;
}
const firstBallHit = w => w.log.some(e => e.type === 'ball');

const w0 = P.ppCreateWorld();
const R = w0.cfg.ballR, g = w0.cfg.gravity, T = w0.table;
const HL = T.halfLength, HW = T.halfWidth;

// ── 1. Table geometry ─────────────────────────────────────────────────
head('Table geometry');
ok('6 cushion runs, 12 jaws', T.segments.filter(s => s.kind === 'cushion').length === 6 &&
   T.segments.filter(s => s.kind === 'jaw').length === 12);
ok('every jaw ends exactly on its pocket\'s capture circle', T.pockets.every(p =>
    p.jaws.length === 2 && p.jaws.every(j => near(Math.hypot(j[2] - p.x, j[3] - p.y), p.r, 1e-9))));
ok('every nose and jaw tip is a collider', T.points.length === 24);
ok('corner mouths are the configured width', T.pockets.filter(p => p.kind === 'corner').every(p =>
    near(Math.hypot(p.mouth[0] - p.mouth[2], p.mouth[1] - p.mouth[3]), w0.cfg.cornerMouth, 1e-9)));
ok('side mouths are the configured width', T.pockets.filter(p => p.kind === 'side').every(p =>
    near(Math.abs(p.mouth[0] - p.mouth[2]), w0.cfg.sideMouth, 1e-9)));
{
    // A capture circle must sit behind its mouth line, or balls would drop
    // off the playing surface without entering the pocket.
    const behind = T.pockets.every(p => {
        const [ax, ay, bx, by] = p.mouth;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        let nx = -(by - ay), ny = bx - ax;
        const l = Math.hypot(nx, ny); nx /= l; ny /= l;
        if (nx * -mx + ny * -my < 0) { nx = -nx; ny = -ny; }          // toward the table centre
        const front = (p.x - mx) * nx + (p.y - my) * ny + p.r;        // circle's furthest reach toward the table
        return front <= 1e-9;
    });
    ok('no capture circle reaches in front of its mouth line', behind);
    const cjaw = T.segments.find(s => s.kind === 'jaw');
    ok('jaws converge into the pocket (corner jaw turns 38° off the cushion)',
       near(deg(Math.acos(Math.abs(cjaw.tx))), 38, 1e-6), deg(Math.acos(Math.abs(cjaw.tx))).toFixed(2) + '°');
}

// ── 2. Rack ───────────────────────────────────────────────────────────
head('Rack');
{
    const w = P.ppRack(P.ppCreateWorld(), P.ppRandom(11));
    const b = w.balls;
    ok('16 balls, ids 0–15 once each', b.length === 16 && b.map(x => x.id).sort((a, c) => a - c).join() ===
       Array.from({ length: 16 }, (_, i) => i).join());
    ok('cue ball on the head spot', b[0].id === 0 && b[0].x === T.headX && b[0].y === 0);
    ok('apex on the foot spot', near(b[1].x, T.footX, 0.02) && near(b[1].y, 0, 0.02));
    ok('the 8 in the middle of the third row', b[5].id === 8);
    const stripe = id => id > 8;
    ok('back corners are one solid and one stripe', stripe(b[11].id) !== stripe(b[15].id));
    let gap = Infinity;
    for (let i = 1; i < 16; i++) for (let j = i + 1; j < 16; j++) gap = Math.min(gap, Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) - 2 * R);
    ok('the rack is tight but never overlapping', gap >= 0 && gap < 0.05, gap.toFixed(4));
    const ids = s => P.ppRack(P.ppCreateWorld(), P.ppRandom(s)).balls.map(x => x.id).join();
    ok('a seed reproduces the rack', ids(5) === ids(5));
    ok('different seeds give different racks', ids(5) !== ids(6));
}

// ── 3. Cloth: sliding, rolling, spin ──────────────────────────────────
head('Cloth');
{
    // Natural roll from the start (tip 0.4 R above centre): no sliding at all,
    // so the run is exactly v² / (2 μr g).
    [100, 200, 300].forEach(v => {
        const w = table([[0, -400, 0]]);
        P.ppStrike(w, { angle: 0, speed: v, tipY: 0.4 });
        const was = ball(w, 0).state;
        P.ppSimulate(w);
        const expect = v * v / (2 * w.cfg.muRoll * g);
        const got = ball(w, 0).x + 400;
        ok(`a ${v} u/s natural-roll ball rolls v²/2μg = ${expect.toFixed(1)} u`,
           was === 'rolling' && near(got, expect, expect * 0.001), got.toFixed(2));
    });
    // Struck at height b (in R), a ball slides until the slip is gone and then
    // rolls at exactly (5/7)(1 + b)·v0: 5/7 for a stun ball, all of it at the
    // natural-roll height 0.4, and still forward for maximum draw. Draw only
    // comes back off another ball; on an empty table it just dies early.
    [[0, 'stun'], [-0.6, 'maximum draw'], [0.2, 'a little follow']].forEach(([tipY, label]) => {
        const w = table([[0, -400, 0]]);
        P.ppStrike(w, { angle: 0, speed: 600, tipY });
        const b = ball(w, 0);
        runUntil(w, () => b.state === 'rolling');
        // Sampled up to one 1/600 s slice into the roll, so allow one slice of rolling deceleration.
        const slack = w.cfg.muRoll * g / 600 + 1e-6;
        const expect = 600 * 5 / 7 * (1 + tipY);
        ok(`${label}: rolls on at (5/7)(1+b)·v0 = ${expect.toFixed(1)} u/s`, near(b.vx, expect, slack), b.vx.toFixed(3));
    });
    {
        const w = table([[0, -400, 0]]);
        P.ppStrike(w, { angle: 0, speed: 600 });
        const b = ball(w, 0);
        runUntil(w, () => b.state === 'rolling');
        const tr = 2 * 600 / (7 * w.cfg.muSlide * g);
        ok('a stun ball slides for 2v/(7μs g) before rolling', near(w.t, tr, 1 / 600 + 1e-6), w.t.toFixed(4) + ' s');
    }
    // English alone does not bend the path (no masse), but squirts it off line.
    {
        const w = table([[0, -300, 0]]);
        P.ppStrike(w, { angle: 0, speed: 400, tipX: 0.5 });
        const b = ball(w, 0);
        const launch = deg(Math.atan2(b.vy, b.vx));
        ok('right English squirts the ball left of the aim line', launch > 0.5 && launch < 1.5, launch.toFixed(2) + '°');
        ok('right English is counter-clockwise spin (ω_z > 0)', b.wz > 0);
        P.ppSimulate(w);
        ok('the spin decays to nothing', b.wz === 0 && b.state === 'stationary');
    }
    ok('tip offsets beyond the miscue circle are clamped', (() => {
        const w = table([[0, 0, 0]]);
        P.ppStrike(w, { angle: 0, speed: 400, tipX: 2, tipY: 2 });
        const s = w.log[0];
        return near(Math.hypot(s.tipX, s.tipY), w.cfg.maxTip, 1e-12);
    })());
}

// ── 4. Ball on ball ───────────────────────────────────────────────────
head('Ball on ball');
function straightShot(tipY, gap, speed) {
    const w = table([[0, -200, 0], [1, -200 + 2 * R + gap, 0]]);
    P.ppStrike(w, { angle: 0, speed, tipY });
    runUntil(w, () => firstBallHit(w));
    const contactX = ball(w, 0).x;
    P.ppSimulate(w);
    return { w, travel: ball(w, 0).x - contactX, obj: ball(w, 1) };
}
{
    const stop = straightShot(0, 1, 600);
    ok('stop shot: a stun ball stops dead on a full hit', Math.abs(stop.travel) < 2, stop.travel.toFixed(2) + ' u');
    ok('…and the object ball takes almost all the speed', stop.obj.x > 100);
    const follow = straightShot(0.5, 150, 800);
    ok('follow: the cue ball rolls on after the object ball', follow.travel > 120, follow.travel.toFixed(1) + ' u');
    const draw = straightShot(-0.5, 150, 1200);
    ok('draw: the cue ball comes back', draw.travel < -100, draw.travel.toFixed(1) + ' u');
    const drawMore = straightShot(-0.6, 150, 1200);
    ok('more draw brings it back further', drawMore.travel < draw.travel);
}
// Half-ball hit: cue ball travelling +x along y = −R toward an object ball at the origin.
function halfBall(opts) {
    const start = opts.start;
    const w = table([[0, -start, -R], [1, 0, 0]]);
    P.ppStrike(w, { angle: 0, speed: opts.speed, tipX: opts.tipX || 0, tipY: opts.tipY || 0 });
    const cue = ball(w, 0), obj = ball(w, 1);
    runUntil(w, () => firstBallHit(w));
    return { w, cue, obj };
}
{
    const h = halfBall({ start: Math.sqrt(3) * R + 1.5, speed: 600 });
    const a = deg(Math.atan2(h.cue.vy, h.cue.vx)), o = deg(Math.atan2(h.obj.vy, h.obj.vx));
    // Exactly 90° only for perfectly elastic, frictionless balls. Restitution
    // 0.95 leaves the cue ball ~2.5° of the normal speed and throw turns the
    // object ball ~3°, so real stun shots part a few degrees short of square.
    ok('90° rule: a stun ball and the object ball part at close to a right angle (84–90°)',
       Math.abs(a - o) > 84 && Math.abs(a - o) <= 90, Math.abs(a - o).toFixed(1) + '°');
    // Line of centres at contact is 30° above +x; throw drags the object ball toward the cue's path.
    const throwDeg = 30 - o;
    ok('cut-induced throw pushes the object ball 0.5–4° off the line of centres',
       throwDeg > 0.5 && throwDeg < 4, throwDeg.toFixed(2) + '°');
    // Gearing English removes the slip at contact, so it cancels throw and can
    // overshoot into reverse throw. The other side adds slip, but friction is
    // already at its Coulomb limit, so throw cannot grow past it.
    const thr = tipX => { const q = halfBall({ start: Math.sqrt(3) * R + 1.5, speed: 600, tipX }); return 30 - deg(Math.atan2(q.obj.vy, q.obj.vx)); };
    const plus = thr(0.3), minus = thr(-0.3), gear = Math.min(plus, minus), other = Math.max(plus, minus);
    ok('gearing English cancels throw (or reverses it)', gear < throwDeg * 0.5,
       `${gear.toFixed(2)}° vs ${throwDeg.toFixed(2)}°`);
    ok('English the other way cannot push throw past the friction limit', near(other, throwDeg, throwDeg * 0.15),
       `${other.toFixed(2)}° vs ${throwDeg.toFixed(2)}°`);
    let zero = null;
    for (let x = 0; x <= 0.3 + 1e-9; x += 0.01) { const v = thr(plus < minus ? x : -x); if (Math.abs(v) < 0.3) { zero = x; break; } }
    ok('a small amount of gearing English throws nothing at all', zero !== null && zero > 0.05, zero === null ? 'none found' : zero.toFixed(2) + ' R');
}
{
    // 30° rule: a rolling cue ball deflects about 30° on a half-ball hit, once its slip is gone.
    const h = halfBall({ start: 250, speed: 500, tipY: 0.4 });
    runUntil(h.w, () => h.cue.state === 'rolling' || h.cue.state === 'stationary');
    const dev = -deg(Math.atan2(h.cue.vy, h.cue.vx));
    ok('30° rule: a rolling cue ball deflects about 30° on a half-ball hit', dev > 26 && dev < 36, dev.toFixed(1) + '°');
}

// ── 5. Cushions ───────────────────────────────────────────────────────
head('Cushions');
function intoBottomRail(tipX, tipY, angleDeg, speed) {
    // Travels down-right at angleDeg from the cushion normal, meeting the bottom cushion near x = 0.
    const a = angleDeg * Math.PI / 180;
    const d = 200;
    const w = table([[0, -Math.sin(a) * d - 120, -HW + R + Math.cos(a) * d]]);
    P.ppStrike(w, { angle: -Math.PI / 2 + a, speed, tipX, tipY });
    const b = ball(w, 0);
    const vin = [b.vx, b.vy];
    runUntil(w, () => w.log.some(e => e.type === 'cushion'));
    return { w, b, vin, out: deg(Math.atan2(Math.abs(b.vx), b.vy)) };
}
{
    const w = table([[0, -200, -HW + R + 30]]);        // x = −200: well clear of the side pocket mouth
    P.ppStrike(w, { angle: -Math.PI / 2, speed: 800 });
    const b = ball(w, 0);
    runUntil(w, () => w.log.some(e => e.type === 'cushion'));
    const vin = 800 - w.cfg.muSlide * g * (w.log.find(e => e.type === 'cushion').t);
    ok('a square hit rebounds at about the cushion restitution', b.vy / vin > 0.65 && b.vy / vin < 0.85, (b.vy / vin).toFixed(3));
    ok('…and straight back', Math.abs(b.vx) < 1e-6);

    const plain = intoBottomRail(0, 0, 45, 700).out;
    const left = intoBottomRail(-0.5, 0, 45, 700).out;     // running English for a ball moving right into the bottom rail
    const right = intoBottomRail(0.5, 0, 45, 700).out;     // reverse
    ok('running English lengthens the rebound angle', left > plain + 3, `${left.toFixed(1)}° vs ${plain.toFixed(1)}°`);
    ok('reverse English shortens it', right < plain - 3, `${right.toFixed(1)}° vs ${plain.toFixed(1)}°`);
    ok('the English is spent on the rail (spin reduced in magnitude)', (() => {
        const q = intoBottomRail(-0.5, 0, 45, 700);
        return Math.abs(q.b.wz) < 5 * 700 * 0.5 / (2 * R);
    })());
}

// ── 6. Pockets ────────────────────────────────────────────────────────
head('Pockets');
const potted = w => w.log.filter(e => e.type === 'pocket').map(e => e.ball);
{
    // Rolling down the diagonal into the top-left corner.
    const pk = T.pockets[0];
    const w = table([[0, -300, 50]]);
    const ang = Math.atan2(pk.y - 50, pk.x + 300);
    P.ppStrike(w, { angle: ang, speed: 450, tipY: 0.4 });
    P.ppSimulate(w);
    ok('a ball rolled into the corner drops', potted(w).includes(0) && ball(w, 0).pocket === 0);

    const f = table([[0, -300, 50]]);
    P.ppStrike(f, { angle: ang, speed: 3000 });
    P.ppSimulate(f);
    ok('…even at break speed when it is centred', potted(f).includes(0));

    const s = table([[0, 0, 0]]);
    P.ppStrike(s, { angle: Math.PI / 2, speed: 2500 });
    P.ppSimulate(s);
    ok('a hard straight shot into the side pocket drops', potted(s).includes(0) && ball(s, 0).pocket === 1);

    const along = table([[0, -300, HW - R - 0.5]]);
    P.ppStrike(along, { angle: 0, speed: 700, tipY: 0.4 });
    runUntil(along, () => ball(along, 0).x > 80);
    ok('a ball running along the rail crosses the side pocket mouth', !potted(along).includes(0) && ball(along, 0).x > 80);

    // 3 u past the end of the cushion run, so the ball meets the rounded nose tip, not the flat face.
    const tip = table([[0, -29, 100]]);
    P.ppStrike(tip, { angle: Math.PI / 2, speed: 500 });
    runUntil(tip, () => tip.log.some(e => e.type === 'cushion'));
    ok('a ball driven onto a side-pocket nose bounces off the tip', tip.log.some(e => e.type === 'cushion' && e.kind === 'nose'));
    P.ppSimulate(tip);
    ok('…and stays on the table', !potted(tip).includes(0));

    // Lines into the top-left corner, stepped from the centre line toward one
    // jaw. Each result is dropped cleanly, dropped off the jaw, or rattled out.
    const corner = (off, speed) => {
        const w2 = table([[0, -300, 50 + off]]);
        P.ppStrike(w2, { angle: ang, speed, tipY: speed < 1000 ? 0.4 : 0 });
        P.ppSimulate(w2);
        const jaw = w2.log.some(e => e.type === 'cushion' && e.kind !== 'cushion');
        return potted(w2).includes(0) ? (jaw ? 'jaw-drop' : 'drop') : (jaw ? 'rattle' : 'miss');
    };
    [500, 2600].forEach(speed => {
        const res = [10, 16, 22, 25, 28, 31].map(o => corner(o, speed));
        ok(`${speed} u/s: lines near the centre drop cleanly`, res[0] === 'drop' && res[1] === 'drop', res.join(' '));
        ok(`${speed} u/s: a line that clips the jaw can still drop`, res.slice(2, 4).includes('jaw-drop'), res.join(' '));
        ok(`${speed} u/s: a line onto the jaw rattles out`, res[4] === 'rattle', res.join(' '));
        ok(`${speed} u/s: lines outside the jaw never drop`, res[5] === 'rattle' || res[5] === 'miss', res.join(' '));
    });
}

// ── 7. The break ──────────────────────────────────────────────────────
head('Break');
{
    let legal = 0, maxT = 0, ms = 0, spread = 0, rails = 0;
    const N = 40;
    for (let s = 1; s <= N; s++) {
        const rng = P.ppRandom(1000 + s);
        const w = P.ppRack(P.ppCreateWorld(), rng);
        const t0 = Date.now();
        P.ppStrike(w, { angle: (rng() - 0.5) * 0.004, speed: 0.75 * w.cfg.maxSpeed });
        maxT = Math.max(maxT, P.ppSimulate(w));
        ms += Date.now() - t0;
        const toRail = new Set(w.log.filter(e => e.type === 'cushion' && e.ball !== 0).map(e => e.ball));
        if (toRail.size >= 4 || w.log.some(e => e.type === 'pocket' && e.ball !== 0)) legal++;
        const live = w.balls.filter(b => b.id && b.state !== 'pocketed');
        if (live.length) spread += live.reduce((a, b) => a + Math.hypot(b.x - T.footX, b.y), 0) / live.length;
        rails += toRail.size;
    }
    ok('a 75% break is legal (≥4 to a rail, or a pot) at least 90% of the time', legal / N >= 0.9, `${legal}/${N}`);
    ok('on average at least 6 object balls reach a rail', rails / N >= 6, (rails / N).toFixed(1));
    ok('breaks settle inside 15 s of table time', maxT < 15, maxT.toFixed(2) + ' s');
    ok('the rack spreads (mean distance from the foot spot > 150 u)', spread / N > 150, (spread / N).toFixed(0) + ' u');
    ok('a break simulates in under 20 ms on average', ms / N < 20, (ms / N).toFixed(1) + ' ms');
}

// ── 8. Invariants under fuzz ──────────────────────────────────────────
head(`Invariants (${FUZZ} random shots)`);
{
    const rng = P.ppRandom(424242);
    let energyUp = 0, overlap = 0, escapes = 0, nan = 0, unsettled = 0, maxOverlap = 0, worstRise = 0;
    for (let n = 0; n < FUZZ; n++) {
        const w = P.ppRack(P.ppCreateWorld(), rng);
        // Half the shots are breaks from anywhere in the kitchen; half scatter the balls first.
        if (n % 2) {
            w.balls.forEach(b => {
                b.x = (rng() * 2 - 1) * (HL - R - 1); b.y = (rng() * 2 - 1) * (HW - R - 1);
            });
            // Push apart any overlaps from the scatter.
            for (let k = 0; k < 50; k++) for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) {
                const A = w.balls[i], B = w.balls[j];
                const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6;
                if (d < 2 * R + 0.01) {
                    const push = (2 * R + 0.02 - d) / 2;
                    A.x -= dx / d * push; A.y -= dy / d * push; B.x += dx / d * push; B.y += dy / d * push;
                    [A, B].forEach(q => { q.x = Math.max(-HL + R + 0.01, Math.min(HL - R - 0.01, q.x)); q.y = Math.max(-HW + R + 0.01, Math.min(HW - R - 0.01, q.y)); });
                }
            }
        } else {
            ball(w, 0).x = -HL + R + rng() * (HL / 2 - R);
            ball(w, 0).y = (rng() * 2 - 1) * (HW - R - 1);
        }
        P.ppStrike(w, {
            angle: rng() * Math.PI * 2, speed: 50 + rng() * (w.cfg.maxSpeed - 50),
            tipX: (rng() * 2 - 1) * 0.6, tipY: (rng() * 2 - 1) * 0.6,
        });
        let e = P.ppEnergy(w), t = 0;
        while (!P.ppSettled(w) && t < 40) {
            P.ppStep(w, 1 / 60); t += 1 / 60;
            const e2 = P.ppEnergy(w);
            if (e2 > e * (1 + 1e-9) + 1e-9) { energyUp++; worstRise = Math.max(worstRise, (e2 - e) / e); }
            e = e2;
            const live = w.balls.filter(b => b.state !== 'pocketed');
            for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
                const o = 2 * R - Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y);
                if (o > 1e-3) { overlap++; maxOverlap = Math.max(maxOverlap, o); }
            }
            if (w.balls.some(b => ![b.x, b.y, b.vx, b.vy, b.wx, b.wy, b.wz].every(Number.isFinite))) { nan++; break; }
        }
        if (!P.ppSettled(w)) unsettled++;
        escapes += w.escapes;
    }
    ok('energy never rises between frames', energyUp === 0, energyUp ? `${energyUp} rises, worst +${(worstRise * 100).toExponential(2)}%` : undefined);
    ok('balls never overlap by more than 0.001 u', overlap === 0, overlap ? `${overlap} frames, worst ${maxOverlap.toFixed(4)} u` : undefined);
    ok('no ball ever leaves the table outside a pocket', escapes === 0, escapes || undefined);
    ok('no NaN or Infinity, ever', nan === 0);
    ok('every shot settles inside 40 s', unsettled === 0, unsettled || undefined);
}

// ── 9. Determinism and cloning ────────────────────────────────────────
head('Determinism and cloning');
{
    const play = () => {
        const w = P.ppRack(P.ppCreateWorld(), P.ppRandom(77));
        P.ppStrike(w, { angle: 0.01, speed: 2800, tipX: 0.1, tipY: -0.2 });
        P.ppSimulate(w);
        return JSON.stringify(w.balls.map(b => [b.x, b.y, b.state, b.pocket]));
    };
    ok('the same rack and shot always play out identically', play() === play());
    const w = P.ppRack(P.ppCreateWorld(), P.ppRandom(78));
    const before = JSON.stringify(w.balls);
    const c = P.ppCloneWorld(w);
    P.ppStrike(c, { angle: 0, speed: 3000 });
    P.ppSimulate(c);
    ok('simulating a clone leaves the original untouched', JSON.stringify(w.balls) === before);
    ok('a clone shares the table and config (they never change mid-shot)', c.table === w.table && c.cfg === w.cfg);
    const a = P.ppCloneWorld(w), b = P.ppCloneWorld(w);
    [a, b].forEach(x => { P.ppStrike(x, { angle: 0.02, speed: 2000 }); P.ppSimulate(x); });
    ok('two clones of one world play the same shot the same way',
       JSON.stringify(a.balls.map(q => [q.x, q.y])) === JSON.stringify(b.balls.map(q => [q.x, q.y])));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
