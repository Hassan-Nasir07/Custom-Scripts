// Pool fingerprints: digests of what 8-ball pool does today, so the snooker work can
// prove (not argue) that pool still plays exactly the same. `node pool-dev/pool-fingerprint.js`
// prints them; snooker-verify.js §0 holds the values taken on main before Phase S0 and
// fails on any difference (POOL_V2_PLAN.md, Snooker, Phase S0).
//
//   table    ppBuildTable(PP_DEFAULTS), every segment, point and pocket
//   breaks   20 seeded racks broken at different speeds, aims and tips, to rest
//   fuzz     50 seeded shots played on from those tables
//   judge    prJudge's verdict on every one of those shots
//   cpu      paPlan for all four tiers on 10 positions, with the verdict of the shot played
//   render   the draw calls of 12 scenes (2D, 3D, broadcast, ball in hand, calls, drops, Max)
//   match    three whole frames through pool-game.js on the stubbed host: the balls, the
//            frame score, the records and every XP award
//
// Every digest is over exact floats: the engine is deterministic, so any change to a
// result, however small, changes its digest.
const crypto = require('crypto');
const L = require('./load');

const H = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);
const ballsOf = w => w.balls.map(b => [b.id, b.x, b.y, b.vx, b.vy, b.wx, b.wy, b.wz, b.q, b.state, b.pocket]);
const judged = v => [v.shooter, v.foul, v.reason, v.frameOver, v.winner, v.continues, v.nextTurn, v.ballInHand, v.counted, v.notice, v.next];

// A canvas context that records every call and property write, numbers rounded so the
// log reads the same on any machine that computes the same floats.
function recorder() {
    const log = [];
    const num = v => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);
    const arg = v => (v && v.__rec ? v.__rec : Array.isArray(v) ? v.map(num) : num(v));
    const grad = kind => ({ __rec: kind + '#' + log.length, addColorStop: (o, c) => log.push(['stop', num(o), c]) });
    const target = {
        createLinearGradient: (...a) => { log.push(['lin', ...a.map(num)]); return grad('lin'); },
        createRadialGradient: (...a) => { log.push(['rad', ...a.map(num)]); return grad('rad'); },
        measureText: t => ({ width: String(t).length * 6 }),
        drawImage: (img, ...a) => log.push(['img', img && img.__rec ? img.__rec : 'canvas', ...a.map(num)]),
    };
    const ctx = new Proxy(target, {
        get: (t, k) => (k in t ? t[k] : (...a) => { log.push([k, ...a.map(arg)]); }),
        set: (t, k, v) => { log.push(['=' + String(k), arg(v)]); return true; },
    });
    return { ctx, log };
}
function offscreen() {
    const { ctx, log } = recorder();
    return { width: 0, height: 0, __rec: 'off', getContext: () => ctx, log };
}

function fingerprints() {
    const P = L.game({ seed: 5 });
    const out = {};
    out.table = H(P.ppBuildTable(P.PP_DEFAULTS));

    // Breaks, then shots played on from each table, each judged.
    const breaks = [], fuzz = [], verdicts = [], tables = [];
    for (let s = 1; s <= 20; s++) {
        const w = P.ppRack(P.ppCreateWorld(), P.ppRandom(s));
        w.balls[0].x = w.table.headX - 80; w.balls[0].y = (s % 5 - 2) * 12;
        const frame = P.prNewFrame({ breaker: 1 });
        w.log = [];
        P.ppStrike(w, { angle: (s - 10) * 0.002, speed: w.cfg.maxSpeed * (0.55 + 0.02 * s), tipX: (s % 3 - 1) * 0.2, tipY: (s % 4 - 1.5) * 0.25 });
        P.ppSimulate(w, 60);
        breaks.push(ballsOf(w));
        const v = P.prJudge(frame, w, -1);
        verdicts.push(judged(v));
        tables.push({ w, frame: v.next });
    }
    const rnd = P.ppRandom(99);
    for (let i = 0; i < 50; i++) {
        const t = tables[i % 20], w = t.w;
        if (w.balls[0].state === 'pocketed') P.prPlaceCue(w, w.table.headX - 60, 0);
        if (t.frame.over) continue;
        w.log = [];
        P.ppStrike(w, { angle: rnd() * 2 * Math.PI, speed: 200 + rnd() * 2600, tipX: (rnd() - 0.5) * 0.8, tipY: (rnd() - 0.5) * 0.8 });
        P.ppSimulate(w, 60);
        fuzz.push(ballsOf(w));
        const v = P.prJudge(t.frame, w, rnd() < 0.3 ? Math.floor(rnd() * 6) : -1);
        verdicts.push(judged(v));
        if (v.respot8) P.prSpotBall(w, 8);
        t.frame = v.next;
    }
    out.breaks = H(breaks); out.fuzz = H(fuzz); out.judge = H(verdicts);

    // The CPU: every tier plans the same ten positions; the chosen shot is played out.
    const plans = [];
    for (let s = 1; s <= 10; s++) {
        const base = tables[s - 1];
        P.PA_TIER_NAMES.forEach(tier => {
            const w = P.ppCloneWorld(base.w), frame = JSON.parse(JSON.stringify(base.frame));
            if (frame.over) return;
            const rng = P.ppRandom(1000 + s);
            if (frame.ballInHand || w.balls[0].state === 'pocketed') { const p = P.paPlace(w, frame, rng, tier); P.prPlaceCue(w, p[0], p[1]); }
            const job = P.paPlan(w, frame, { rng, tier });
            let n = 0;
            while (!job.step(1e9) && n++ < 1000);
            const shot = job.shot;
            w.log = [];
            P.ppStrike(w, shot);
            P.ppSimulate(w, 60);
            plans.push([tier, s, shot, job.plan, job.kind, judged(P.prJudge(frame, w, shot.call))]);
        });
    }
    out.cpu = H(plans);

    // The renderer's draw calls: the table layer through the cache, then each frame.
    const cfg = P.PP_DEFAULTS, W = 368, Hh = 412;
    const rack = P.ppRack(P.ppCreateWorld(), P.ppRandom(5));
    rack.balls[0].x = rack.table.headX - 80;
    const mid = tables[3].w;
    const chase = P.pcView(P.pcChase([rack.balls[0].x, 0], 0, 35, W, Hh, cfg));
    const ortho = P.pcView(P.pcOrtho(W, Hh, cfg));
    const guide = P.pgGuide(rack, { angle: 0, speed: 1600, tipX: 0, tipY: -0.3 });
    const theme = { accent: '#7ee0c3', hot: '#ff5d73', font: 'Inter, system-ui, sans-serif' };
    const scenes = [
        { view: chase, world: rack, aim: { angle: 0, power: 40, gap: 52 }, guide, guideMode: 'full' },
        { view: ortho, world: rack, aim: { angle: 0, power: 0, gap: 8 }, guide, guideMode: 'short', illegal: true },
        { view: P.pcView(P.pcBroadcast(W, Hh, cfg)), world: mid },
        { view: P.pcView(P.pcSurvey(0.4, W, Hh, cfg)), world: mid },
        { view: ortho, world: rack, bih: { x: -300, y: 20, valid: true }, kitchen: true },
        { view: ortho, world: rack, bih: { x: rack.table.footX, y: 0, valid: false } },
        { view: chase, world: mid, aim: { angle: 0.3, power: 0, gap: 8 }, call: { called: 2 } },
        { view: ortho, world: mid, call: { called: -1 } },
        { view: chase, world: rack, drops: [{ ball: rack.balls[5], pocket: 2, t: 0.5 }] },
        { view: ortho, world: mid, felt: 'red' },
        { view: P.pcView(P.pcChase([-250, 0], 0, 35, 1232, 672, cfg)), world: mid, aim: { angle: 0, power: 20, gap: 30 } },
        { view: P.pcView(P.pcChase([-480, 230], -0.4, 0, W, Hh, cfg)), world: rack, aim: { angle: -0.4, power: 0, gap: 8 } },
    ];
    const sizes = [];
    const drawn = scenes.map(sc => {
        const cache = {}, offs = [];
        const { ctx, log } = recorder();
        P.pgRender(ctx, Object.assign({ dpr: 2, cache, theme, felt: 'green', makeCanvas: () => { const c = offscreen(); offs.push(c); return c; } }, sc));
        sizes.push(log.length + offs.reduce((a, c) => a + c.log.length, 0));
        return H([log, offs.map(c => c.log)]);
    });
    out.render = H(drawn);

    // Whole frames through the controller: seat 1 plays the hard planner, seat 2 is the CPU.
    const G = L.game({ seed: 21 }), S = G.poolS;
    G.poolNewFrame(1);
    const match = [];
    for (let f = 0; f < 3; f++) {
        let n = 0;
        while (S.phase !== 'over' && n++ < 60000) {
            if (S.handoff) G.poolOn.ready();
            if (S.frame.turn === 1) {
                if (S.phase === 'bih') { const p = G.paPlace(S.world, S.frame, S.rng, 'hard'); G.prPlaceCue(S.world, p[0], p[1]); S.placed = true; S.phase = 'aim'; }
                if (S.phase === 'aim') {
                    const job = G.paPlan(S.world, S.frame, { rng: S.rng, tier: 'hard' });
                    let k = 0; while (!job.step(1e9) && k++ < 1000);
                    S.called = job.shot.call; S.shot = job.shot; S.phase = 'strike'; S.strikeT = 0;
                }
            }
            G.poolTick(16);
        }
        match.push([ballsOf(S.world), S.frames.slice(), S.frame, S.result]);
        G.poolOn.primary();
    }
    match.push([G.log.xp, G.poolRecord, G.poolGamesWon, G.store]);
    out.match = H(match);
    // Not hashed: what the digests were taken over, so an empty scene or a frame that never
    // finished cannot pass as a match.
    const detail = { drawCalls: sizes, frames: match.slice(0, 3).map(m => m[1].join('–')), awards: G.log.xp.length };
    return { digests: out, detail };
}

module.exports = { fingerprints };
if (require.main === module) {
    const t0 = Date.now();
    const { digests, detail } = fingerprints();
    Object.entries(digests).forEach(([k, v]) => console.log(k.padEnd(7) + ' ' + v));
    console.log('draw calls per scene ' + detail.drawCalls.join(' ') + ' · frames ' + detail.frames.join(', ') + ' · ' + detail.awards + ' awards');
    console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
}
