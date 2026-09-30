// Snooker verification. `node pool-dev/snooker-verify.js`
//
// POOL_V2_PLAN.md, Snooker. Snooker shares pool's engine, so the first thing this suite
// checks is that pool is unchanged:
//   0  pool fingerprints: the table, breaks, shots, verdicts, CPU plans, draw calls and whole
//      frames hash exactly as they did on main before Phase S0 (pool-fingerprint.js)
//   1  the snooker table (S1): the design's geometry, the markings, the rack for 15, 10 and 6
//      reds, the D, how the pockets take a ball, break-offs, and a fuzz of the physics on it
//   2–6 the rules (S2): a row per ruling (reds and colours, fouls and the choice, the free ball,
//      re-spotting, the end of the frame, the clock and the copy), the snookered test, real
//      shots on the physics, a scripted 147 and a free-ball 155, and whole frames fuzzed
// The CPU (S4) joins later.
//
//   node pool-dev/snooker-verify.js [fuzz shots, default 300]
const { fingerprints } = require('./pool-fingerprint');
const L = require('./load');
const FUZZ = parseInt(process.argv[2], 10) || 300;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));

// ── 0. Pool is unchanged ──────────────────────────────────────────────
// Taken on main (6c6af10, the v2 merge) with Node 22, before any snooker code. A digest
// that moves means pool now plays, judges, plans or draws differently: find out why before
// updating it, and record any deliberate change in the Decision log.
const POOL_ON_MAIN = {
    table: '1d1012657f807af2',
    breaks: 'ad93085bd4e0dc53',
    fuzz: 'c5cb3113d060a822',
    judge: 'b7dd7e7f76a57efe',
    cpu: '0cdfe55ec4e4a8a7',
    render: '5eb79e0b5248dfaa',
    match: 'e289d26219154ce4',
};
const WHAT = {
    table: 'the table geometry (segments, points, pockets)',
    breaks: '20 seeded breaks, to rest',
    fuzz: '50 shots played on from them',
    judge: 'the rules’ verdict on every shot',
    cpu: 'the CPU’s plans, four tiers × ten positions',
    render: 'the draw calls of 12 scenes',
    match: 'three whole frames through the controller, XP and records',
};
head('Pool unchanged');
{
    const { digests, detail } = fingerprints();
    Object.keys(POOL_ON_MAIN).forEach(k => ok('pool: ' + WHAT[k], digests[k] === POOL_ON_MAIN[k], digests[k] + ' ≠ ' + POOL_ON_MAIN[k]));
    ok('the digests are over real work (every scene drew, every frame finished)',
       detail.drawCalls.every(n => n > 1000) && detail.frames.length === 3 && detail.awards === 3, JSON.stringify(detail));
}

// ── 1. The snooker table ──────────────────────────────────────────────
const P = L.snooker();
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);
const R = P.PS_TABLE.ballR;

head('Snooker table: geometry (the design)');
{
    const w = P.psCreateWorld(), t = w.table, cfg = w.cfg;
    ok('true scale: R 7.36 on the 1000 × 500 bed, snooker cloth and top speed', cfg.ballR === 7.36 && cfg.halfLength === 500 && cfg.halfWidth === 250 && cfg.gravity === 2749 && cfg.maxSpeed === 2240 && cfg.muRoll === 0.011);
    ok('six straight cushion runs and twelve rounded ends, no nose points', t.segments.length === 6 && t.arcs.length === 12 && t.points.length === 0);
    const want = [[-503, 253, 17], [0, 259, 15.5], [503, 253, 17], [-503, -253, 17], [0, -259, 15.5], [503, -253, 17]];
    ok('the holes are the design\'s: corners r 17 at (±503, ±253), middles r 15.5 at (0, ±259), in pool\'s order',
       t.pockets.every((p, i) => near(p.x, want[i][0]) && near(p.y, want[i][1]) && p.r === want[i][2]));
    const long = t.segments.filter(s => s.ay === s.by), short = t.segments.filter(s => s.ax === s.bx);
    ok('the cushions stop 17 u from each corner and 14.5 u from each middle pocket (mouths ≈ 24 and 29 u)',
       long.every(s => [483, 14.5].includes(Math.abs(s.ax)) && [483, 14.5].includes(Math.abs(s.bx))) && short.every(s => Math.abs(s.ay) === 233 && Math.abs(s.by) === 233));
    ok('every end is a quarter-round of radius 12 centred on the rail line behind its nose',
       t.arcs.every(a => a.r === 12 && near(a.half, Math.PI / 4) && (Math.abs(Math.abs(a.cy) - 262) < 1e-9 || Math.abs(Math.abs(a.cx) - 512) < 1e-9)));
    ok('the quarter-round meets its cushion tangentially at the nose tip', t.arcs.every(a => {
        const p = t.pockets[a.pocket], m = p.mouth, tips = [[m[0], m[1]], [m[2], m[3]]];
        return tips.some(([x, y]) => near(Math.hypot(x - a.cx, y - a.cy), a.r) && P.ppOnArc(a, x, y));
    }));
    ok('every rounded end finishes inside its hole (it closes the throat)', t.arcs.every(a => {
        const p = t.pockets[a.pocket], e0 = a.mid + a.half, e1 = a.mid - a.half;
        return [e0, e1].some(th => Math.hypot(a.cx + a.r * Math.cos(th) - p.x, a.cy + a.r * Math.sin(th) - p.y) < p.r);
    }));
    ok('a ball resting against a cushion is never in a hole', long.concat(short).every(s => {
        for (let k = 0; k <= 20; k++) {
            const x = s.ax + (s.bx - s.ax) * k / 20 + s.nx * R, y = s.ay + (s.by - s.ay) * k / 20 + s.ny * R;
            if (t.pockets.some(p => Math.hypot(x - p.x, y - p.y) < p.r)) return false;
        }
        return true;
    }));
    ok('pool\'s table is still built its own way (straight jaws, nose points, no arcs)', !P.ppCreateWorld().table.arcs && P.ppCreateWorld().table.points.length === 24);
    const m = t.marks;
    ok('markings: the baulk line at −293.5 across the bed, the D r 81.8 toward the baulk cushion', m.baulkX === -293.5 && m.dR === 81.8 &&
       m.lines.length === 1 && m.lines[0][0][0] === -293.5 && m.lines[0][0][1] === -250 && m.arcs[0].a0 === Math.PI / 2 && m.arcs[0].a1 === 3 * Math.PI / 2);
    ok('six spots: yellow (y < 0, the right of the D from baulk), green, brown, blue, pink, black',
       JSON.stringify(P.PS_COLOURS.map(id => m.spotOf[id])) === JSON.stringify([[-293.5, -81.8], [-293.5, 81.8], [-293.5, 0], [0, 0], [250, 0], [409.2, 0]]) && m.spots.length === 6);
    ok('no diamonds; pool\'s rail and nose heights', cfg.diamonds === false && cfg.railZ === 16 && cfg.noseZ === 10);
    ok('ball ids: a colour\'s id is its value, reds from 8', P.psValue(2) === 2 && P.psValue(7) === 7 && P.psValue(8) === 1 && P.psValue(22) === 1 && P.psValue(0) === 0 && P.psName(6) === 'pink' && P.psName(9) === 'red');
}

head('Snooker table: the rack');
[15, 10, 6].forEach(n => {
    const w = P.psRack(P.psCreateWorld(), P.ppRandom(n), n), b = w.balls;
    const reds = b.filter(o => P.psIsRed(o.id)), cols = b.filter(o => P.PS_COLOURS.includes(o.id));
    let gap = Infinity;
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) gap = Math.min(gap, Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) - 2 * R);
    const pink = cols.find(o => o.id === 6), apex = reds.reduce((a, o) => (o.x < a.x ? o : a));
    ok(n + ' reds: ' + (n + 7) + ' balls, reds 8–' + (7 + n) + ', the six colours exactly on their spots',
       b.length === n + 7 && reds.length === n && reds.every((o, i) => o.id === 8 + i) && cols.every(o => o.x === P.PS_SPOTS[o.id][0] && o.y === P.PS_SPOTS[o.id][1]));
    ok(n + ' reds: nothing touches (closest gap ' + gap.toFixed(3) + ' u), and the apex red is a hair behind the pink', gap > 0 && gap < 0.05 &&
       Math.hypot(apex.x - pink.x, apex.y - pink.y) - 2 * R > 0 && Math.hypot(apex.x - pink.x, apex.y - pink.y) - 2 * R < 0.1);
    ok(n + ' reds: the pyramid clears the black', reds.every(o => Math.hypot(o.x - P.PS_SPOTS[7][0], o.y) > 2 * R + 1));
    ok(n + ' reds: the cue ball starts in the D', P.prCanPlace(w, b[0].x, b[0].y, 'D') === null && b[0].id === 0);
});
{
    const a = P.psRack(P.psCreateWorld(), P.ppRandom(3), 15), b = P.psRack(P.psCreateWorld(), P.ppRandom(3), 15), c = P.psRack(P.psCreateWorld(), P.ppRandom(4), 15);
    ok('a seed replays its rack; another seed jitters the reds (never the colours)', JSON.stringify(a.balls) === JSON.stringify(b.balls) && JSON.stringify(a.balls) !== JSON.stringify(c.balls) &&
       a.balls.filter(o => !P.psIsRed(o.id)).every((o, i) => JSON.stringify(o) === JSON.stringify(c.balls.filter(q => !P.psIsRed(q.id))[i])));
    ok('an unknown reds count racks 15', P.psRack(P.psCreateWorld(), P.ppRandom(1), 7).balls.length === 22);
}

head('Snooker table: ball in hand in the D');
{
    const w = P.psRack(P.psCreateWorld(), P.ppRandom(1), 15);
    ok('the D refuses a spot in front of the baulk line and one outside the half-circle', P.prCanPlace(w, -290, 0, 'D') === 'D' && P.prCanPlace(w, -300, 90, 'D') === 'D' && P.prCanPlace(w, -380, 20, 'D') === 'D');
    ok('…and takes one on its lines and one inside (overlaps still refused)', P.prCanPlace(w, -293.5, 40, 'D') === null && P.prCanPlace(w, -340, 10, 'D') === null && P.prCanPlace(w, -293.5, 2, 'D') === 'overlap');
    const rnd = P.ppRandom(11);
    let inside = true, still = true;
    for (let i = 0; i < 400; i++) {
        const x = -520 + rnd() * 1040, y = -280 + rnd() * 560, q = P.prClampPlace(w, x, y, 'D');
        if (P.prCanPlace(Object.assign({}, w, { balls: [] }), q[0], q[1], 'D') !== null) inside = false;
        const q2 = P.prClampPlace(w, q[0], q[1], 'D');
        if (Math.hypot(q2[0] - q[0], q2[1] - q[1]) > 1e-9) still = false;
    }
    ok('400 drags anywhere clamp to a spot inside the D, and a spot in the D stays put', inside && still);
    const q = P.prClampPlace(w, 0, 0, 'D'), q2 = P.prClampPlace(w, -293.5 - 200, 0, 'D');
    ok('dragged past the baulk line it stops on the line; past the arc it slides round it', near(q[0], -293.5) && near(q[1], 0) && near(Math.hypot(q2[0] + 293.5, q2[1]), 81.8, 1e-6));
    ok('pool\'s zones are unchanged by the D', P.prCanPlace(P.ppCreateWorld(), -300, 0, 'kitchen') === null && JSON.stringify(P.prClampPlace(P.ppCreateWorld(), 0, 0, 'kitchen')) === '[-250,0]');
}

head('Snooker table: how the pockets take a ball');
{
    // One ball, straight down a line; 'o' dropped clean, 'j' dropped off a cushion end, 'x' out.
    const probe = (x, y, angle, speed) => {
        const w = P.psCreateWorld();
        w.balls = [P.ppMakeBall(0, x, y)];
        P.ppStrike(w, { angle, speed, tipX: 0, tipY: 0 });
        P.ppSimulate(w, 30);
        const pk = w.log.find(ev => ev.type === 'pocket');
        return pk ? (w.log.some(ev => ev.type === 'cushion') ? 'j' : 'o') : 'x';
    };
    const line = (sx, sy, th, offs, v) => offs.map(o => probe(sx - Math.sin(th) * o, sy + Math.cos(th) * o, th, v)).join('');
    const offs = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
    const diag = Math.atan2(1, -1);
    [300, 1500].forEach(v => {
        const s = line(-300, 50, diag, offs, v);
        ok('corner, down the diagonal at ' + v + ' u/s: clean within ±2 u, off a cushion end at ±4, out from ±6 (' + s + ')', s === 'xxjooojxx');
    });
    const mid = (ang, v) => {
        const th = Math.PI / 2 - ang * Math.PI / 180;
        return line(-Math.cos(th) * 150, 250 - Math.sin(th) * 150, th, offs, v);
    };
    const drops = s => (s.match(/[oj]/g) || []).length;
    [300, 1500].forEach(v => {
        const s0 = mid(0, v), s30 = mid(30, v), s45 = mid(45, v), s60 = mid(60, v);
        ok('middle, square on at ' + v + ' u/s: takes ±4 u (' + s0 + ')', s0 === 'xxoooooxx');
        ok('middle at ' + v + ' u/s: the window shrinks with the angle (0° ' + drops(s0) + ', 30° ' + drops(s30) + ', 45° ' + drops(s45) + ', 60° ' + drops(s60) + ' of 9)',
           drops(s0) >= drops(s30) && drops(s30) >= drops(s45) && drops(s45) > drops(s60) && drops(s60) >= 1);
    });
    const along = [200, 600, 1500].map(v => probe(300, 250 - R, 0, v)).join('');
    ok('rolling along the cushion into the corner drops, slow or fast (' + along + '; no pace-dependent rattle yet: Risks)', along === 'ooo');
    // Straight up at x = 486: it meets the top-right nose's quarter-round (centre (483, 262)) at
    // about −81°, before the hole, and comes back down the table.
    const w = P.psCreateWorld();
    w.balls = [P.ppMakeBall(0, 486, 150)];
    P.ppStrike(w, { angle: Math.PI / 2, speed: 800 });
    P.ppSimulate(w, 30);
    const cb = w.balls[0];
    ok('a ball driven into a rounded end rebounds off it (logged as a jaw), and stays on the table', w.log.some(ev => ev.type === 'cushion' && ev.kind === 'jaw') && cb.state !== 'pocketed' && cb.y < 240);
}

head('Snooker table: break-offs and a fuzz');
{
    let worst = 0, ms = 0, escapes = 0, overlap = 0, nan = 0, settled = true;
    const check = w => {
        const live = w.balls.filter(b => b.state !== 'pocketed');
        for (let i = 0; i < live.length; i++) {
            const b = live[i];
            if (![b.x, b.y, b.vx, b.vy, b.wx, b.wy, b.wz].every(Number.isFinite)) nan++;
            for (let j = i + 1; j < live.length; j++) overlap = Math.max(overlap, 2 * R - Math.hypot(b.x - live[j].x, b.y - live[j].y));
        }
    };
    for (let i = 0; i < 40; i++) {
        const w = P.psRack(P.psCreateWorld(), P.ppRandom(100 + i), [15, 10, 6][i % 3]);
        const reds = w.balls.filter(b => P.psIsRed(b.id));
        const back = reds.reduce((a, b) => (b.x > a.x + 1 || (Math.abs(b.x - a.x) <= 1 && b.y < a.y) ? b : a), reds[0]);
        const c = w.balls[0];
        const t0 = Date.now();
        P.ppStrike(w, { angle: Math.atan2(back.y - (1.5 + (i % 5) * 0.1) * R - c.y, back.x - 0.2 * R - c.x), speed: 900 + i * 20, tipX: (i % 3 - 1) * 0.3, tipY: 0 });
        const s = P.ppSimulate(w, 60);
        ms += Date.now() - t0; worst = Math.max(worst, s); escapes += w.escapes;
        settled = settled && P.ppSettled(w);
        check(w);
    }
    ok('40 break-offs (15, 10 and 6 reds) all settle, the slowest in ' + worst.toFixed(1) + ' s of table time', settled && worst < 20);
    ok('a break-off costs ' + (ms / 40).toFixed(1) + ' ms to simulate (under 40)', ms / 40 < 40);
    const rnd = P.ppRandom(2024);
    let w = P.psRack(P.psCreateWorld(), P.ppRandom(5), 15), rise = 0;
    for (let i = 0; i < FUZZ; i++) {
        if (w.balls.filter(b => b.state !== 'pocketed').length < 3 || i % 40 === 0) w = P.psRack(P.psCreateWorld(), P.ppRandom(500 + i), 15);
        const cue = w.balls.find(b => b.id === 0);
        if (cue.state === 'pocketed') P.prPlaceCue(w, -330, 0);
        if (P.prCanPlace(w, cue.x, cue.y, null) === 'overlap') continue;
        w.log = [];
        P.ppStrike(w, { angle: rnd() * 2 * Math.PI, speed: 100 + rnd() * 2100, tipX: (rnd() - 0.5) * 1.1, tipY: (rnd() - 0.5) * 1.1 });
        let e0 = P.ppEnergy(w);
        for (let k = 0; k < 3600 && !P.ppSettled(w); k++) {
            P.ppStep(w, 1 / 60);
            const e1 = P.ppEnergy(w);
            if (e1 > e0 * (1 + 1e-9) + 1e-6) rise++;
            e0 = e1;
        }
        settled = settled && P.ppSettled(w);
        escapes += w.escapes;
        check(w);
    }
    ok(FUZZ + ' random shots: energy never rises', rise === 0, rise + ' rises');
    ok(FUZZ + ' random shots: nothing overlaps (worst ' + Math.max(0, overlap).toExponential(1) + ' u), no NaN, 0 escapes, all settle', overlap < 1e-3 && nan === 0 && escapes === 0 && settled, JSON.stringify({ overlap, nan, escapes, settled }));
}

// ── 2–6. The rules (S2) ───────────────────────────────────────────────
// A table set by hand: the cue ball and [id, x, y] balls, nothing else.
const table = (cue, balls) => {
    const w = P.psCreateWorld();
    w.balls = [P.ppMakeBall(0, cue[0], cue[1])].concat(balls.map(([id, x, y]) => P.ppMakeBall(id, x, y)));
    return w;
};
const onSpots = ids => ids.map(id => [id, P.PS_SPOTS[id][0], P.PS_SPOTS[id][1]]);
// A shot written straight into the log: the cue ball meets `hit` (together), then `pots` drop
// (0 is the cue ball). Nothing moves; the judge reads only the log and the ball states.
const fake = (w, hit, pots) => {
    w.log = [{ type: 'strike', t: 0, ball: 0 }];
    (hit || []).forEach(id => w.log.push({ type: 'ball', t: 0.1, a: 0, b: id }));
    (pots || []).forEach((id, i) => {
        const b = w.balls.find(o => o.id === id);
        Object.assign(b, { state: 'pocketed', pocket: 0 });
        w.log.push({ type: 'pocket', t: 0.2 + i * 0.01, ball: id, pocket: 0 });
    });
    return w;
};
// Judges it and applies the verdict to the table as the controller will: the re-spots, and
// the cue ball back in the D when it is in hand.
const judge = (f, w, hit, pots, nom) => {
    const v = P.psJudge(f, fake(w, hit, pots), nom === undefined ? -1 : nom);
    P.psApplySpots(w, v.spots);
    if (v.ballInHand === 'D') P.prPlaceCue(w, -330, 0);
    return v;
};
const frame = o => Object.assign(P.psNewFrame({ reds: 15, seed: 9 }), { isBreak: false, ballInHand: null }, o);
const NAMES = { 1: 'You', 2: 'Bilal' };
const REDS3 = [[8, 300, 40], [9, 320, -60], [10, 150, 120]];

head('Snooker rules: reds and colours');
{
    const f0 = P.psNewFrame({ reds: 15, seed: 9 }), w0 = P.psRack(P.psCreateWorld(), P.ppRandom(1), 15);
    const st = P.psStatus(f0, w0, 1);
    ok('the break-off: ball in hand in the D, on the 15 reds, 147 on the table, nothing to nominate',
       f0.ballInHand === 'D' && f0.isBreak && f0.phase === 'reds' && st.on.ids.length === 15 && st.remaining === 147 && !st.needsNomination && f0.game === 'snooker');
    let w = table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3)), v = judge(frame(), w, [8], [8, 9]);
    ok('on reds: a red first, two reds potted score 2, the break goes on, and a colour must be nominated',
       !v.foul && v.points === 2 && v.continues && v.next.phase === 'colour' && v.next.brk === 2 && v.next.turn === 1 &&
       P.psStatus(v.next, w, 1).needsNomination && P.psStatus(v.next, w, 1).nominable.join() === '2,3,4,5,6,7');
    v = judge(frame(), table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3)), [8, 9], []);
    ok('reds hit together are a fair hit; no pot passes the turn, still on reds', !v.foul && !v.continues && v.next.turn === 2 && v.next.phase === 'reds' && v.next.brk === 0);
    w = table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3));
    v = judge(frame({ phase: 'colour', brk: 2 }), w, [6], [6], 6);
    ok('on a colour: the nominated pink potted scores 6, is re-spotted, and it is back to reds',
       !v.foul && v.points === 6 && v.spots.length === 1 && v.spots[0].id === 6 && v.spots[0].x === 250 && v.next.phase === 'reds' && v.next.brk === 8 &&
       w.balls.find(b => b.id === 6).state === 'stationary');
    const col = (nom, hit, pots) => P.psJudge(frame({ phase: 'colour' }), fake(table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3)), hit, pots), nom);
    v = col(6, [5], []);
    ok('on a colour, another colour first is a foul at the higher value: pink nominated, blue hit (6); green nominated, black hit (7); yellow, green (4)',
       v.foul === 'wrongFirst' && v.penalty === 6 && col(3, [7], []).penalty === 7 && col(2, [3], []).penalty === 4 && v.next.scores[2] === 6 && v.next.phase === 'reds');
    ok('potting a colour that was not nominated is a foul, and it comes back', col(2, [2], [2, 7]).foul === 'wrongPot' && col(2, [2], [2, 7]).penalty === 7 && col(2, [2], [2, 7]).spots.map(s => s.id).join() === '7,2');
    ok('a shot on a colour with none nominated costs 7', col(-1, [2], [2]).foul === 'noNomination' && col(-1, [2], [2]).penalty === 7 && col(-1, [], []).penalty === 7);
    ok('…and a red potted while on a colour is a foul too', col(5, [5], [5, 8]).foul === 'wrongPot' && col(5, [5], [5, 8]).penalty === 5);
    // The last red.
    w = table([-100, 0], onSpots(P.PS_COLOURS).concat([[8, 300, 40]]));
    v = judge(frame(), w, [8], [8]);
    const v2 = judge(v.next, w, [5], [5], 5);
    ok('the last red potted: any colour next, nominated, which is re-spotted; then the clearance from the yellow',
       v.next.phase === 'colour' && v2.points === 5 && v2.spots[0].id === 5 && v2.next.phase === 'clearance' && v2.next.next === 2 && P.psStatus(v2.next, w, 1).on.ids.join() === '2');
    w = table([-100, 0], onSpots(P.PS_COLOURS));
    v = judge(Object.assign(frame(), { phase: 'colour' }), w, [5], [], 5);
    ok('…a miss on that colour hands the clearance over, from the yellow', !v.foul && v.next.turn === 2 && v.next.phase === 'clearance' && v.next.next === 2);
    w = table([-100, 0], onSpots(P.PS_COLOURS));
    v = judge(frame({ phase: 'clearance', next: 2 }), w, [2], [2]);
    ok('the clearance: the yellow potted scores 2 and stays down; on the green', v.points === 2 && !v.spots.length && v.next.next === 3 && w.balls.find(b => b.id === 2).state === 'pocketed');
    const clr = hit => P.psJudge(frame({ phase: 'clearance', next: 2 }), fake(table([-100, 0], onSpots(P.PS_COLOURS)), hit, []), -1);
    ok('in the clearance a colour out of order first is a foul: green on the yellow 4, black 7', clr([3]).penalty === 4 && clr([7]).penalty === 7 && clr([7]).foul === 'wrongFirst');
}

head('Snooker rules: fouls and the choice');
{
    let w = table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3)), v = judge(frame(), w, [8], [8, 5, 6]);
    ok('a foul costs the worst ball involved, never a sum: a red, then the blue and pink potted, is 6', v.foul === 'wrongPot' && v.penalty === 6 && v.foulBall === 6);
    ok('the offender scores nothing, the reds stay down, the colours come back', v.points === 0 && v.next.scores[1] === 0 && v.next.scores[2] === 6 &&
       v.spots.map(s => s.id).join() === '6,5' && w.balls.find(b => b.id === 8).state === 'pocketed' && w.balls.find(b => b.id === 6).x === 250);
    ok('the other player chooses: play, or make the offender play again (no free ball when not snookered)',
       v.next.pending && v.next.pending.chooser === 2 && v.next.pending.offender === 1 && v.options.join() === 'play,back' && v.next.turn === 2);
    ok('Play: the chooser is at the table; Put back: the offender plays again; a choice not offered changes nothing',
       P.psChoose(v.next, 'play').turn === 2 && P.psChoose(v.next, 'back').turn === 1 && !P.psChoose(v.next, 'back').pending && P.psChoose(v.next, 'free') === v.next);
    ok('a miss (no ball hit) costs 4 on reds, the ball on\'s value on a colour', P.psJudge(frame(), fake(table([-100, 0], REDS3), [], []), -1).penalty === 4 &&
       P.psJudge(frame({ phase: 'clearance', next: 6 }), fake(table([-100, 0], onSpots([6, 7])), [], []), -1).penalty === 6);
    // Snookered: the cue ball tight behind the blue, the reds up by the pink.
    const snk = () => table([-30, 0], onSpots(P.PS_COLOURS).concat(REDS3.map(([id, , y], i) => [id, 290 + i * 16, y / 4])));
    v = judge(frame({ turn: 2 }), snk(), [], []);
    ok('a foul that leaves the other player snookered offers a free ball', v.options.join() === 'play,back,free' && v.next.pending.options.indexOf('free') === 2);
    ok('a cue ball in-off: ball in hand in the D, and no free ball, snookered or not', (() => { const u = judge(frame({ turn: 2 }), snk(), [], [0]); return u.foul === 'noContact' && u.fouls.some(x => x.code === 'inOff') && u.ballInHand === 'D' && u.options.join() === 'play,back' && u.next.ballInHand === 'D'; })());
    ok('a cue ball in-off after a fair pot is still a foul: 4, the red stays down, the D', (() => { const u = judge(frame(), table([-100, 0], REDS3), [8], [8, 0]); return u.foul === 'inOff' && u.penalty === 4 && u.points === 0 && u.ballInHand === 'D'; })());
    const back = P.psChoose(v.next, 'back');
    ok('putting the offender back in withdraws the free ball', back.turn === 2 && !back.freeBall);
    // Touching ball.
    w = table([-100, 0], onSpots(P.PS_COLOURS).concat([[8, -100 + 2 * R + 0.05, 0], [9, 300, 100]]));
    const ft = frame({ touching: P.psTouching(w.balls, R) });
    ok('a touching ball is found at rest (' + ft.touching.join() + ')', ft.touching.join() === '8');
    ok('touching a red: playing away without hitting anything is fair, and a contact with it is not the first hit',
       !P.psJudge(ft, fake(table([-100, 0], [[8, -100 + 2 * R + 0.05, 0], [9, 300, 100]]), [], []), -1).foul &&
       !P.psJudge(ft, fake(table([-100, 0], [[8, -100 + 2 * R + 0.05, 0], [9, 300, 100]]), [8], []), -1).foul);
    ok('…but hitting a colour after playing away is a foul', P.psJudge(ft, fake(table([-100, 0], onSpots(P.PS_COLOURS).concat([[8, -100 + 2 * R + 0.05, 0]])), [5], []), -1).penalty === 5);
}

head('Snooker rules: the free ball');
{
    const fr = o => frame(Object.assign({ freeBall: true }, o));
    const w = () => table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3));
    let st = P.psStatus(fr(), w(), 1);
    ok('a free ball must be nominated, any colour while reds remain', st.needsNomination && st.nominable.join() === '2,3,4,5,6,7');
    let t = w(), v = judge(fr(), t, [7], [7], 7);
    ok('reds left: the nominated black stands for a red: 1, re-spotted, then a colour', !v.foul && v.points === 1 && v.spots[0].id === 7 && v.next.phase === 'colour' && !v.next.freeBall && t.balls.find(b => b.id === 7).x === 409.2);
    ok('the free ball and a red potted together score 1 each', judge(fr(), w(), [7], [7, 8], 7).points === 2);
    ok('the free ball and a red hit together are fair; a red hit first is a foul (4); a colour not nominated first, its value',
       !judge(fr(), w(), [7, 8], [], 7).foul && judge(fr(), w(), [8], [], 7).penalty === 4 && judge(fr(), w(), [6], [], 7).penalty === 6);
    const cl = () => table([-100, 0], onSpots([3, 4, 5, 6, 7]));
    st = P.psStatus(fr({ phase: 'clearance', next: 3 }), cl(), 1);
    ok('in the clearance any colour but the ball on can be the free ball', st.nominable.join() === '4,5,6,7');
    t = cl(); v = judge(fr({ phase: 'clearance', next: 3 }), t, [7], [7], 7);
    ok('in the clearance the free ball scores the ball on\'s value, comes back, and the same ball is on', v.points === 3 && v.spots.map(s => s.id).join() === '7' && v.next.next === 3);
    t = cl(); v = judge(fr({ phase: 'clearance', next: 3 }), t, [7, 3], [7, 3], 7);
    ok('…with the ball on potted too it scores once; the ball on stays down', v.points === 3 && v.spots.map(s => s.id).join() === '7' && v.next.next === 4 && t.balls.find(b => b.id === 3).state === 'pocketed');
    // Snookered behind the free ball: the black between the cue ball and every red.
    const hide = () => table([-100, 0], [[7, -60, 0], [8, 200, 0], [9, 200, 15], [10, 215, 8]]);
    v = judge(fr(), hide(), [7], [], 7);
    ok('leaving the other player snookered behind the free ball is a foul (4 to them)', v.foul === 'freeSnooker' && v.penalty === 4 && v.next.scores[2] === 4 && v.next.pending.chooser === 2);
    v = judge(fr({ phase: 'clearance', next: 6 }), table([-100, 0], [[7, -60, 0], [6, 200, 0]]), [7], [], 7);
    ok('…except with only the pink and black left', !v.foul && v.next.turn === 2);
    v = judge(fr(), table([-100, 0], [[7, -60, 0], [5, -20, 0], [8, 200, 0], [9, 200, 15], [10, 215, 8]]), [7], [], 7);
    ok('…and not when another ball does the snookering as well', !v.foul);
}

head('Snooker rules: re-spotting');
{
    const at = (w, ids) => P.psSpotPositions(w, ids).map(s => s.id + '@' + s.x.toFixed(2) + ',' + s.y.toFixed(2)).join(' ');
    let w = table([-100, 0], onSpots([2, 3, 4, 5, 7]));
    ok('a colour goes back on its own spot', at(w, [6]) === '6@250.00,0.00');
    w = table([-100, 0], onSpots([2, 4, 5, 7]).concat([[8, 250, 0]]));
    ok('its spot taken: the highest-value free spot (pink → green, black and blue being taken)', at(w, [6]) === '6@-293.50,81.80');
    w = table([-100, 0], onSpots([2, 3, 4, 5, 6]).concat([[8, 409.2, 0]]));
    ok('every spot taken: as close as it fits behind its own spot, toward the top cushion', at(w, [7]) === '7@' + (409.2 + 2 * R + 0.02).toFixed(2) + ',0.00');
    w = table([-100, 0], onSpots([2, 3, 4, 5, 6]).concat([0, 1, 2, 3, 4].map(k => [8 + k, 409.2 + 20 * k, 0])));
    ok('…and no room behind it: in front of it', at(w, [7]) === '7@' + (409.2 - 2 * R - 0.02).toFixed(2) + ',0.00');
    w = table([-100, 0], onSpots([2, 4, 5]).concat([[8, 250, 0]]));
    ok('two to spot: the higher value first (the black takes its own spot, then the pink the next free one)', at(w, [6, 7]) === '7@409.20,0.00 6@-293.50,81.80');
    ok('the cue ball takes up a spot too (the pink\'s, with every other spot taken: behind it)', at(table([250, 0], onSpots([2, 3, 4, 5, 7])), [6]) === '6@' + (250 + 2 * R + 0.02).toFixed(2) + ',0.00');
}

head('Snooker rules: the end of the frame');
{
    const bl = () => table([-100, 0], onSpots([7]));
    let v = judge(frame({ phase: 'clearance', next: 7, scores: { 1: 50, 2: 40 } }), bl(), [7], [7]);
    ok('the black potted clears the table: the frame to the higher score', v.frameOver && v.winner === 1 && v.next.over && v.next.scores[1] === 57 && P.psText(v, NAMES).title === 'You win' && P.psText(v, NAMES).sub === '57–40 · potted the black');
    v = judge(frame({ phase: 'clearance', next: 7, scores: { 1: 50, 2: 45 } }), bl(), [], []);
    ok('a foul with only the black left ends the frame (7 to the other player)', v.frameOver && v.winner === 2 && v.next.scores[2] === 52 && P.psText(v, NAMES).sub === '52–50 · foul on the black');
    v = judge(frame({ phase: 'clearance', next: 7, scores: { 1: 40, 2: 47 } }), bl(), [7], [7]);
    ok('a tie re-spots the black, played from the D; the lot picks who plays first',
       !v.frameOver && v.respotBlack && v.next.respotBlack && v.next.ballInHand === 'D' && [1, 2].includes(v.next.turn) && v.spots.some(s => s.id === 7 && s.x === 409.2) && P.psText(v, NAMES).title === 'Scores level · re-spotted black' && /ha(s|ve) ball in hand in the D$/.test(P.psText(v, NAMES).sub));
    const again = judge(frame({ phase: 'clearance', next: 7, scores: { 1: 40, 2: 47 } }), bl(), [7], [7]);
    const lots = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => judge(frame({ lot: s, phase: 'clearance', next: 7, scores: { 1: 40, 2: 47 } }), bl(), [7], [7]).next.turn));
    ok('the lot is the frame\'s seed: the same frame draws the same player, other frames both', again.next.turn === v.next.turn && lots.size === 2);
    const rb = v.next, w = bl();
    const miss = judge(rb, w, [7], []);
    ok('on the re-spotted black a miss passes the turn', !miss.frameOver && miss.next.turn === 3 - rb.turn && miss.next.respotBlack);
    const end = judge(miss.next, w, [7], [7]);
    ok('…and the first score ends it', end.frameOver && end.winner === miss.next.turn && P.psText(end, NAMES).sub.endsWith('potted the re-spotted black'));
    ok('…as does the first foul', judge(rb, bl(), [], []).frameOver && judge(rb, bl(), [], []).winner === 3 - rb.turn);
    const c = P.psConcede(frame({ scores: { 1: 12, 2: 70 } }), 1);
    ok('a concession ends the frame for the other player', c.frameOver && c.winner === 2 && c.next.over && c.next.conceded === 1 && P.psText(c, NAMES).sub === '70–12 · you conceded');
}

head('Snooker rules: points remaining, snookers, the clock, the copy');
{
    const rem = (o, balls) => P.psStatus(frame(o), table([-100, 0], balls), 1);
    const reds = n => Array.from({ length: n }, (_, i) => [8 + i, 200 + 16 * i, 100]);
    ok('points remaining: 8 a red and 27 (147); a colour to come adds 7; the clearance sums what is left',
       rem({}, onSpots(P.PS_COLOURS).concat(reds(15))).remaining === 147 && rem({ phase: 'colour' }, onSpots(P.PS_COLOURS).concat(reds(14))).remaining === 146 &&
       rem({ phase: 'clearance', next: 2 }, onSpots(P.PS_COLOURS)).remaining === 27 && rem({ phase: 'clearance', next: 5 }, onSpots([5, 6, 7])).remaining === 18);
    const sr = rem({ phase: 'clearance', next: 4, scores: { 1: 0, 2: 60 } }, onSpots([4, 5, 6, 7])).snookersRequired;
    ok('snookers required: 60 behind with 22 left needs 10 fouls of 4; 20 behind with 13 left, 2 of 6', sr[1] === 10 && sr[2] === 0 &&
       rem({ phase: 'clearance', next: 6, scores: { 1: 0, 2: 20 } }, onSpots([6, 7])).snookersRequired[1] === 2 &&
       rem({ phase: 'clearance', next: 6, scores: { 1: 0, 2: 13 } }, onSpots([6, 7])).snookersRequired[1] === 0);
    const w = table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3));
    const to = (o, nom) => P.psTimeout(frame(o), w, nom);
    ok('out of time: a foul on the ball on (4 on reds, 6 with the pink nominated, 7 with nothing nominated), with the choice',
       to({}).penalty === 4 && to({ phase: 'colour' }, 6).penalty === 6 && to({ phase: 'colour' }).penalty === 7 && to({}).foul === 'timeout' && to({}).options.join() === 'play,back' && to({}).next.scores[2] === 4);
    const tb = P.psTimeout(P.psNewFrame({ reds: 15, seed: 1 }), P.psRack(P.psCreateWorld(), P.ppRandom(1), 15));
    ok('…on the break-off the ball stays in hand in the D and the break-off is still to come', tb.next.ballInHand === 'D' && tb.next.isBreak && tb.next.turn === 2 && tb.penalty === 4);
    const v = P.psJudge(frame(), fake(table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3)), [8], [6]), -1);
    const t1 = P.psText(v, { 1: 'Ayesha', 2: 'Bilal' });
    ok('the copy: "Foul · 6 to Bilal" / "Potted the pink"; to you, "Foul · 6 to you"', t1.kind === 'foul' && t1.title === 'Foul · 6 to Bilal' && t1.sub === 'Potted the pink' && P.psText(v, { 1: 'Bilal', 2: 'You' }).title === 'Foul · 6 to you');
    const hitFirst = P.psText(P.psJudge(frame(), fake(table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3)), [5], []), -1), NAMES);
    ok('"Hit the blue first", "In-off", "No ball hit"', hitFirst.sub === 'Hit the blue first' &&
       P.psText(P.psJudge(frame(), fake(table([-100, 0], REDS3), [8], [0]), -1), NAMES).sub === 'In-off' &&
       P.psText(P.psJudge(frame(), fake(table([-100, 0], REDS3), [], []), -1), NAMES).sub === 'No ball hit');
    const snkd = P.psJudge(frame({ turn: 2 }), fake(table([-30, 0], onSpots(P.PS_COLOURS).concat(REDS3.map(([id, , y], i) => [id, 290 + i * 16, y / 4]))), [], []), -1);
    ok('a free ball is named in the toast: "No ball hit · Free ball"', P.psText(snkd, NAMES).sub === 'No ball hit · Free ball' && P.psText(snkd, NAMES).title === 'Foul · 4 to you');
    const ch = P.psChoiceText(snkd.next.pending, NAMES);
    ok('the choice as buttons: Play / Make Bilal play again (Put back) / Free ball', ch.map(c => c.label).join('|') === 'Play|Make Bilal play again|Free ball' && ch[1].short === 'Put back');
    ok('what the CPU chose: "CPU puts you back in", "CPU takes the free ball", "CPU plays on"',
       P.psChoiceNotice({ offender: 1, chooser: 2 }, 'back', { 1: 'You', 2: 'CPU' }) === 'CPU puts you back in' &&
       P.psChoiceNotice({ offender: 1, chooser: 2 }, 'free', { 1: 'You', 2: 'CPU' }) === 'CPU takes the free ball' &&
       P.psChoiceNotice({ offender: 1, chooser: 2 }, 'play', { 1: 'You', 2: 'CPU' }) === 'CPU plays on');
    ok('a plain pot says nothing (no toast)', P.psText(judge(frame(), table([-100, 0], REDS3), [8], [8]), NAMES) === null);
}

head('Snooker rules: the snookered test');
{
    const sn = (cue, balls, on, mode) => P.psSnookered(table(cue, balls).balls, R, on, mode);
    ok('a clear line to the red: not snookered', !sn([-100, 0], [[8, 200, 0]], [8], 'free') && !sn([-100, 0], [[8, 200, 0]], [8], 'full'));
    ok('the blue right in front: snookered, fully', sn([-100, 0], [[5, -60, 0], [8, 200, 0]], [8], 'free') && sn([-100, 0], [[5, -60, 0], [8, 200, 0]], [8], 'full'));
    ok('one edge of the red blocked: snookered for a free ball, but part of it can be hit', sn([-100, 0], [[5, 50, 10], [8, 200, 0]], [8], 'free') && !sn([-100, 0], [[5, 50, 10], [8, 200, 0]], [8], 'full'));
    ok('one red of two in the open: not snookered', !sn([-100, 0], [[5, -60, 0], [8, 200, 0], [9, -100, 150]], [8, 9], 'free'));
    ok('only balls not on obstruct: a red in front of a red is no snooker on reds', !sn([-100, 0], [[9, -60, 0], [8, 200, 0]], [8, 9], 'free'));
    ok('touching a ball on: not snookered', !sn([-100, 0], [[5, -60, 0], [8, -100 + 2 * R, 0], [9, 200, 0]], [8, 9], 'free'));
    ok('the free-ball offer uses this test after the re-spots', (() => {
        // The pink goes down on a foul and comes back to its spot, right between the cue ball and the red.
        const w = table([200, 0], [[6, 250, 0], [8, 320, 0]]);
        return P.psJudge(frame({ turn: 2 }), fake(w, [6], [6]), -1).options.indexOf('free') >= 0;
    })());
}

head('Snooker rules: real shots on the physics');
{
    const shoot = (f, w, angle, speed, tipY, nom) => {
        w.log = [];
        P.ppStrike(w, { angle, speed, tipX: 0, tipY: tipY || 0 });
        P.ppSimulate(w, 30);
        return P.psJudge(f, w, nom === undefined ? -1 : nom);
    };
    // A red on the corner's diagonal, the cue ball straight behind it, a touch of screw.
    let w = table([380, 130], onSpots([2, 3, 4, 5, 6]).concat([[8, 460, 210]]));
    let v = shoot(frame(), w, Math.PI / 4, 700, -0.3);
    ok('a red potted into the corner: 1, and on a colour', !v.foul && v.points === 1 && v.scored.join() === '8' && v.next.phase === 'colour', JSON.stringify(v.summary));
    w = table([440, 190], onSpots([2, 3, 4, 5, 6, 7]).concat(REDS3));
    v = shoot(frame(), w, Math.PI / 4, 500);
    ok('the cue ball straight into the corner: no ball hit, in-off, 4, ball in hand in the D', v.foul === 'noContact' && v.fouls.some(x => x.code === 'inOff') && v.penalty === 4 && v.ballInHand === 'D', JSON.stringify(v.summary));
    w = table([-100, 0], onSpots([2, 3, 4, 5, 6, 7]).concat([[8, 200, 100]]));
    v = shoot(frame(), w, 0, 600);
    ok('on reds, the blue in the way is hit first: a foul, 5', v.foul === 'wrongFirst' && v.penalty === 5 && v.summary.first.join() === '5');
    let firstRed = 0, judged = 0;
    for (let i = 0; i < 10; i++) {
        const r = P.psRack(P.psCreateWorld(), P.ppRandom(300 + i), 15), reds = r.balls.filter(b => P.psIsRed(b.id));
        const back = reds.reduce((a, b) => (b.x > a.x + 1 || (Math.abs(b.x - a.x) <= 1 && b.y < a.y) ? b : a), reds[0]);
        const c = r.balls[0];
        const u = shoot(P.psNewFrame({ reds: 15, seed: i }), r, Math.atan2(back.y - 1.7 * R - c.y, back.x - 0.2 * R - c.x), 1000 + i * 30, 0);
        judged++;
        if (u.summary.first.length && u.summary.first.every(P.psIsRed)) firstRed++;
    }
    ok('10 break-offs off the back of the pack: every one meets a red first (' + firstRed + ' of ' + judged + ')', firstRed === judged);
}

head('Snooker rules: a 147 and a 155');
{
    // The maximum: 15 reds, each with the black, then the colours; nothing moves but the log.
    const w = P.psRack(P.psCreateWorld(), P.ppRandom(2), 15);
    P.prPlaceCue(w, -330, 0);
    let f = Object.assign(P.psNewFrame({ reds: 15, seed: 4 }), { ballInHand: null }), v, notices = [], blackBack = true;
    for (let red = 8; red <= 22; red++) {
        v = judge(f, w, [red], [red]); f = v.next;
        v = judge(f, w, [7], [7], 7); f = v.next;
        if (v.notice) notices.push(v.notice);
        blackBack = blackBack && w.balls.find(b => b.id === 7).x === 409.2;
    }
    const afterReds = f.phase + ' ' + f.next + ' ' + f.scores[1];
    for (let c = 2; c <= 7; c++) { v = judge(f, w, [c], [c]); f = v.next; if (v.notice) notices.push(v.notice); }
    ok('a scripted 147: 15 reds and 15 blacks (120, the black back on its spot each time), then the colours', afterReds === 'clearance 2 120' && blackBack && f.scores[1] === 147);
    ok('…the frame is won, the break and the high break are 147, and the century and the maximum are noticed once each',
       v.frameOver && v.winner === 1 && f.high[1] === 147 && notices.join() === 'century,maximum' && P.psText(v, NAMES).sub === '147–0 · potted the black');
    // The free-ball 155: Bilal misses and leaves you snookered behind the blue; you take a free
    // ball (the black, as a red), the black, then the 147.
    const s = P.psRack(P.psCreateWorld(), P.ppRandom(2), 15);
    P.prPlaceCue(s, -30, 0);
    f = Object.assign(P.psNewFrame({ reds: 15, seed: 4, breaker: 2 }), { ballInHand: null, isBreak: false });
    v = judge(f, s, [], []);
    ok('the 155: a miss leaves you snookered, a free ball is offered', v.options.indexOf('free') >= 0 && v.next.scores[1] === 4);
    f = P.psChoose(v.next, 'free');
    v = judge(f, s, [7], [7], 7); f = v.next;
    const fb = v.points;
    v = judge(f, s, [7], [7], 7); f = v.next;
    for (let red = 8; red <= 22; red++) { v = judge(f, s, [red], [red]); f = v.next; v = judge(f, s, [7], [7], 7); f = v.next; }
    for (let c = 2; c <= 7; c++) { v = judge(f, s, [c], [c]); f = v.next; }
    ok('…the free ball scores 1, the black after it 7, then 15 reds and blacks and the colours: a 155 break (159 with the foul)', fb === 1 && f.high[1] === 155 && f.scores[1] === 159 && v.frameOver && v.winner === 1);
}

head('Snooker rules: the call pocket');
{
    // Pots into given pockets: [id, pocket].
    const fakeAt = (w, hit, pots) => {
        w.log = [{ type: 'strike', t: 0, ball: 0 }];
        hit.forEach(id => w.log.push({ type: 'ball', t: 0.1, a: 0, b: id }));
        pots.forEach(([id, pk], i) => { Object.assign(w.balls.find(o => o.id === id), { state: 'pocketed', pocket: pk }); w.log.push({ type: 'pocket', t: 0.2 + i * 0.01, ball: id, pocket: pk }); });
        return w;
    };
    const cj = (o, hit, pots, nom, call) => P.psJudge(frame(o), fakeAt(table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3)), hit, pots), nom === undefined ? -1 : nom, call);
    const st = o => P.psStatus(frame(o), table([-100, 0], onSpots(P.PS_COLOURS).concat(REDS3)), 1);
    ok('a frame plays without calls unless asked; the break-off is never called',
       P.psNewFrame({}).call === 'off' && P.psNewFrame({ call: 'all' }).call === 'all' && P.psNewFrame({ call: 'x' }).call === 'off' &&
       !P.psStatus(P.psNewFrame({ call: 'all' }), table([-100, 0], REDS3), 1).callRequired);
    ok('off: nothing is called; colours: the colours and the clearance, not the reds; all: every ball',
       !st({ phase: 'colour' }).callRequired && !st({ call: 'colours' }).callRequired && st({ call: 'colours', phase: 'colour' }).callRequired &&
       st({ call: 'colours', phase: 'clearance', next: 2 }).callRequired && st({ call: 'all' }).callRequired);
    ok('…a free ball on the reds stands for a red: colours does not call it, all does', !st({ call: 'colours', freeBall: true }).callRequired && st({ call: 'all', freeBall: true }).callRequired);
    let v = cj({ call: 'colours', phase: 'colour' }, [6], [[6, 2]], 6, 2);
    ok('colours: the pink in the pocket called scores 6', !v.foul && v.points === 6 && v.callRequired && v.called === 2);
    v = cj({ call: 'colours', phase: 'colour' }, [6], [[6, 5]], 6, 2);
    ok('…in another pocket: a foul on its value (6), the pink back on its spot, the choice to the other player',
       v.foul === 'wrongPocket' && v.penalty === 6 && v.next.scores[2] === 6 && v.spots.map(s => s.id).join() === '6' && v.next.pending && v.next.pending.chooser === 2);
    ok('…the yellow in the wrong pocket costs 4, the least a foul costs', cj({ call: 'colours', phase: 'colour' }, [2], [[2, 0]], 2, 3).penalty === 4);
    ok('…a red is not called under colours', !cj({ call: 'colours' }, [8], [[8, 4]], -1, -1).foul);
    ok('…the clearance is called: the yellow in the wrong pocket is a foul', cj({ call: 'colours', phase: 'clearance', next: 2 }, [2], [[2, 3]], -1, 0).foul === 'wrongPocket');
    v = cj({ call: 'all' }, [8], [[8, 4]], -1, 1);
    ok('all: a red in another pocket is a foul, 4 away, and it stays down', v.foul === 'wrongPocket' && v.penalty === 4 && !v.spots.length);
    v = cj({ call: 'all' }, [8], [[8, 1], [9, 3]], -1, 1);
    ok('…a red in the pocket called scores, and a second red elsewhere with it counts too (2)', !v.foul && v.points === 2);
    ok('…nothing potted, nothing to judge', !cj({ call: 'all' }, [8], [], -1, -1).foul);
    ok('the toast: "Potted the pink in the wrong pocket"', P.psText(cj({ call: 'colours', phase: 'colour' }, [6], [[6, 5]], 6, 2), NAMES).sub === 'Potted the pink in the wrong pocket');
    ok('the tiers: hard calls the colours, pro every ball, easy and normal nothing', P.PS_CPU_TIERS.hard.call === 'colours' && P.PS_CPU_TIERS.pro.call === 'all' && !P.PS_CPU_TIERS.easy.call && !P.PS_CPU_TIERS.normal.call);
    // The stand-in CPU calls the pocket of the pot it plays, and plans it fair under the call.
    const w = table([-150, 60], onSpots(P.PS_COLOURS).concat([[8, 280, 150], [9, 320, -60]]));
    const job = P.psCpuPlan(w, frame({ call: 'all' }), { tier: 'pro', noise: false });
    while (!job.step(50));
    const wc = P.ppCloneWorld(w); wc.log = [];
    P.ppStrike(wc, job.shot); P.ppSimulate(wc, 40);
    const vc = P.psJudge(frame({ call: 'all' }), wc, job.shot.nominate, job.shot.call);
    ok('the CPU calls the pocket of the pot it plays, and it goes there', job.plan === 'pot' && job.shot.call >= 0 && !vc.foul && vc.points > 0, job.plan + ' call ' + job.shot.call + ' ' + (vc.foul || vc.points));
}

head('Snooker rules: whole frames, fuzzed');
{
    // Frames played to the end: most shots on the real physics, aimed roughly at a ball on;
    // the rest written into the log as a pot of a ball on (sometimes with a second ball or the
    // cue ball), so frames finish. Random nominations; after a foul a free ball is taken when
    // offered, otherwise a random choice. A third as many frames again start late (the pink
    // and black, the scores close) so the re-spotted black comes up.
    const FRAMES = 30, LATE = 16, rnd = P.ppRandom(77);
    const bad = [], inv = (c, m) => { if (!c && bad.length < 8) bad.push(m); };
    let finished = 0, shots = 0, phys = 0, fouls = 0, frees = 0, backs = 0, respots = 0, maxShots = 0;
    const t0 = Date.now();
    for (let fi = 0; fi < FRAMES + LATE; fi++) {
        const reds = P.PS_REDS[fi % 3];
        const w = P.psRack(P.psCreateWorld(), P.ppRandom(900 + fi), reds);
        let f = P.psNewFrame({ reds, breaker: 1 + (fi % 2), seed: 50 + fi }), n = 0;
        if (fi >= FRAMES) {
            w.balls.forEach(b => { if (b.id !== 0 && b.id < 6 || P.psIsRed(b.id)) b.state = 'pocketed'; });
            f = Object.assign(f, { phase: 'clearance', next: 6, isBreak: false, scores: { 1: 40, 2: 40 + [0, 7, 13, 6][fi % 4] } });
        }
        while (!f.over && n < 800) {
            n++;
            if (f.pending) {
                const opts = f.pending.options, o = opts.indexOf('free') >= 0 && rnd() < 0.8 ? 'free' : opts[Math.floor(rnd() * opts.length)];
                if (o === 'free') frees++; if (o === 'back') backs++;
                inv(o !== 'free' || w.balls[0].state !== 'pocketed', 'a free ball offered with the cue ball in hand');
                f = P.psChoose(f, o);
            }
            const cue = w.balls.find(b => b.id === 0);
            inv(cue.state !== 'pocketed' || f.ballInHand === 'D', 'the cue ball is down but not in hand');
            if (f.ballInHand === 'D') {
                let q = [-330, 0];
                for (let k = 0; k < 60; k++) {
                    q = P.prClampPlace(w, -293.5 - rnd() * 90, (rnd() - 0.5) * 170, 'D');
                    if (!P.prCanPlace(Object.assign({}, w, { balls: w.balls.filter(b => b.id !== 0) }), q[0], q[1], 'D')) break;
                }
                P.prPlaceCue(w, q[0], q[1]);
            }
            f = Object.assign({}, f, { touching: P.psTouching(w.balls, R) });
            const st = P.psStatus(f, w, f.turn);
            const nom = st.needsNomination ? (rnd() < 0.03 ? -1 : st.nominable[Math.floor(rnd() * st.nominable.length)]) : -1;
            const on = P.psStatus(f, w, f.turn, nom).on;
            const live = w.balls.filter(b => b.id !== 0 && b.state !== 'pocketed');
            const pick = on.ids.length ? on.ids[Math.floor(rnd() * on.ids.length)] : live[Math.floor(rnd() * live.length)].id;
            const redsBefore = live.filter(b => P.psIsRed(b.id)).length, sc = Object.assign({}, f.scores);
            let v;
            if (rnd() < 0.55) {
                const c = w.balls[0], tb = w.balls.find(b => b.id === pick);
                w.log = [];
                P.ppStrike(w, { angle: Math.atan2(tb.y - c.y, tb.x - c.x) + (rnd() - 0.5) * 0.14, speed: 150 + rnd() * 1400, tipX: (rnd() - 0.5) * 0.6, tipY: (rnd() - 0.5) * 0.8 });
                P.ppSimulate(w, 60);
                v = P.psJudge(f, w, nom);
                phys++;
            } else {
                const extra = rnd() < 0.1 ? live.filter(b => b.id !== pick).map(b => b.id)[0] : null;
                const pots = [pick].concat(extra ? [extra] : []).concat(rnd() < 0.05 ? [0] : []);
                v = P.psJudge(f, fake(w, [pick], pots), nom);
            }
            P.psApplySpots(w, v.spots);
            shots++;
            if (v.foul) fouls++;
            if (v.respotBlack) respots++;
            const nx = v.next, me = f.turn;
            // Invariants.
            inv(nx.scores[me] - sc[me] === v.points && nx.scores[3 - me] - sc[3 - me] === v.penalty, 'the scores moved by other than the points and the penalty');
            inv(v.foul ? v.penalty >= 4 && v.penalty <= 7 && v.points === 0 : v.penalty === 0, 'a penalty outside 4–7, or points on a foul');
            inv(v.foul || f.phase !== 'colour' || v.points === 0 || (v.points >= 2 && v.points <= 7), 'a colour worth ' + v.points);
            inv(!v.continues || (!v.foul && v.points > 0), 'the turn kept without a fair pot');
            inv(!v.frameOver && !v.respotBlack ? nx.turn === (v.continues ? me : 3 - me) : true, 'the wrong seat to play');
            inv(!nx.pending || (nx.pending.options[0] === 'play' && nx.pending.options[1] === 'back' && nx.pending.chooser === 3 - me), 'a malformed choice');
            inv(nx.brk === (v.continues && !v.frameOver ? f.brk + v.points : 0) || v.frameOver, 'the break is ' + nx.brk + ' after ' + f.brk + ' + ' + v.points);
            inv(nx.high[1] >= (nx.turn === 1 ? nx.brk : 0) && nx.high[2] >= (nx.turn === 2 ? nx.brk : 0), 'a high break below the break');
            const after = w.balls.filter(b => b.state !== 'pocketed' && !(v.ballInHand === 'D' && b.id === 0));
            const redsAfter = after.filter(b => P.psIsRed(b.id)).length;
            inv(redsAfter <= redsBefore, 'a red came back');
            for (let i = 0; i < after.length; i++) for (let j = i + 1; j < after.length; j++)
                inv(Math.hypot(after[i].x - after[j].x, after[i].y - after[j].y) >= 2 * R - 1e-3, 'balls overlap after the re-spots (' + after[i].id + ', ' + after[j].id + ' by ' + (2 * R - Math.hypot(after[i].x - after[j].x, after[i].y - after[j].y)).toExponential(1) + ' u)');
            const colsLive = P.PS_COLOURS.filter(id => after.some(b => b.id === id)).join('');
            if (nx.over) { /* decided */ }
            else if (nx.respotBlack) inv(colsLive === '7' && redsAfter === 0, 'a re-spotted black with ' + colsLive + ' on the table');
            else if (nx.phase === 'clearance') inv(redsAfter === 0 && colsLive === P.PS_COLOURS.filter(id => id >= nx.next).join(''), 'the clearance on ' + nx.next + ' with ' + colsLive);
            else inv(colsLive === '234567' && (nx.phase === 'colour' || redsAfter > 0), 'on ' + nx.phase + ' with colours ' + colsLive + ' and ' + redsAfter + ' reds');
            const s2 = P.psStatus(nx, w, 1);
            inv(s2.remaining >= 0 && s2.snookersRequired[1] >= 0 && s2.snookersRequired[2] >= 0, 'negative points remaining or snookers');
            f = nx;
        }
        maxShots = Math.max(maxShots, n);
        if (f.over) {
            finished++;
            inv(f.scores[f.winner] > f.scores[3 - f.winner], 'the winner scored less');
        }
    }
    ok(FRAMES + ' frames (15, 10 and 6 reds) and ' + LATE + ' late ones played to the end, the longest ' + maxShots + ' shots', finished === FRAMES + LATE, finished + ' finished');
    ok(shots + ' shots (' + phys + ' on the physics): ' + fouls + ' fouls, ' + frees + ' free balls, ' + backs + ' put back, ' + respots + ' re-spotted blacks; every invariant held',
       !bad.length && fouls > 0 && frees >= 5 && backs > 0 && respots > 0, bad.join(' | '));
    ok('…in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s', true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
