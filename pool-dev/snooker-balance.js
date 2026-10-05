// Calibrates the snooker CPU tiers against scripted humans (POOL_V2_PLAN.md, Snooker, S4).
//
//   node pool-dev/snooker-balance.js [frames=20] [tiers=easy,normal,hard,pro] [profiles=casual] [reds=15] [seed=1]
//
// The method is balance-check.js's: the human model is the CPU's own shot selection (the
// hard planner) with Gaussian aim and pace error on top, so the profiles differ only in
// execution. Seat 1 (the human) breaks off. The bands (the plan's table):
//
//   tier     win vs casual   mean break   centuries / 100   147s / 100   fouls / visit
//   easy     30–50%          2–5          –                 –            ≤18%
//   normal   55–75%          5–10         –                 –            ≤10%
//   hard     80–92%          10–20        2–10              –            ≤5%
//   pro      ≥92%            20–40        15–50             0.3–3        ≤2%
//
// A break is a visit's points, counted over the visits that scored.
// POOL_CUES=1: the CPU plays its tier's cue (pool-cues.js PQ_CPU), the human model Standard.
const L = require('./load');
const P = L.snookerAi();
const CUES = process.env.POOL_CUES === '1' ? L.render() : null;
const cueCfg = (cfg, tier) => { if (!CUES) return cfg; const s = CUES.pqCpuStats(tier, 'snooker'); return Object.assign({}, cfg, { maxSpeed: cfg.maxSpeed * s.power, maxTip: cfg.maxTip * s.spin }); };

// Tuning without editing pool-snooker-ai.js: SNOOKER_TIER_TUNE='{"hard":{"aim":0.06}}'
if (process.env.SNOOKER_TIER_TUNE) {
    const tune = JSON.parse(process.env.SNOOKER_TIER_TUNE);
    Object.keys(tune).forEach(t => Object.assign(P.PA_SN_TIERS[t], tune[t]));
    console.log('tuned: ' + JSON.stringify(tune));
}

const FRAMES = parseInt(process.argv[2], 10) || 20;
const TIERS = (process.argv[3] || 'easy,normal,hard,pro').split(',');
const PROFILE_PICK = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : ['casual'];
const REDS = parseInt(process.argv[5], 10) || 15;
const SEED = parseInt(process.argv[6], 10) || 1;
const SHOT_CAP = 400;

const PROFILES = [
    // As balance-check.js's: casual aims as the easy tier does, and picks its shots as hard does.
    { name: 'skilled', aimDeg: 0.12, power: 0.05 },
    { name: 'casual',  aimDeg: 0.3,  power: 0.1  },
    { name: 'novice',  aimDeg: 0.6,  power: 0.15 },
].filter(p => PROFILE_PICK.includes(p.name) || PROFILE_PICK.includes('all'));
const BANDS = {
    easy: { win: [30, 50], brk: [2, 5], cent: null, max: null, foul: 18 },
    normal: { win: [55, 75], brk: [5, 10], cent: null, max: null, foul: 10 },
    hard: { win: [80, 92], brk: [10, 20], cent: [2, 10], max: null, foul: 5 },
    pro: { win: [92, 100], brk: [20, 40], cent: [15, 50], max: [0.3, 3], foul: 2 },
};

function wilson(k, n) {
    if (!n) return [0, 0];
    const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
    const r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [100 * (c - r) / d, 100 * (c + r) / d];
}

function playFrame(tier, prof, rng, st) {
    const w = P.psRack(P.psCreateWorld(), rng, REDS), R = w.cfg.ballR, base = w.cfg, mine = cueCfg(base, tier);
    let f = P.psNewFrame({ breaker: 1, reds: REDS, seed: Math.floor(rng() * 1e9) });
    let shots = 0, safeRun = 0;
    const endVisit = (seat, brk) => {
        if (seat !== 2 || brk <= 0) return;
        st.breaks++; st.breakSum += brk; st.high = Math.max(st.high, brk);
        if (brk >= 100) st.cent++;
        if (brk >= 147) st.max++;
    };
    while (!f.over && shots < SHOT_CAP) {
        const cpu = f.turn === 2;
        if (f.pending) {
            // The choice after a foul: the CPU its own way; the human model takes a free ball, else plays on.
            const ch = f.pending.chooser === 2 ? P.paSnChoose(f, w) : f.pending.options.indexOf('free') >= 0 ? 'free' : 'play';
            f = P.psChoose(f, ch);
            continue;
        }
        if (cpu && P.paSnConcede(f, w, tier)) { st.conceded++; f = P.psConcede(f, 2).next; break; }
        if (!cpu && !f.isBreak) {
            // The human model concedes a frame it needs more than two snookers for in the clearance.
            const live = w.balls.filter(b => b.id !== 0 && b.state !== 'pocketed').map(b => b.id);
            if (f.phase === 'clearance' && P.psSnookersRequired(f, live, 1) > 2) { f = P.psConcede(f, 1).next; break; }
        }
        if (f.ballInHand === 'D' || w.balls[0].state === 'pocketed') {
            const p = P.paSnPlace(w, f, rng);
            P.prPlaceCue(w, p[0], p[1]);
        }
        f = Object.assign({}, f, { touching: P.psTouching(w.balls, R) });
        // No time cap: the numbers must not depend on the machine (the trial caps still hold).
        w.cfg = cpu ? mine : base;
        const job = cpu ? P.paSnPlan(w, f, { rng, tier, safeRun, timeCap: false })
            : P.paSnPlan(w, f, { rng, tier: 'hard', aimDeg: prof.aimDeg, powerFrac: prof.power, timeCap: false });
        const t0 = process.hrtime.bigint();
        job.step();
        if (cpu) { st.thinkMs += Number(process.hrtime.bigint() - t0) / 1e6; st.trials += job.tried; st.maxMs = Math.max(st.maxMs, Number(process.hrtime.bigint() - t0) / 1e6); }
        w.log = [];
        P.ppStrike(w, job.shot);
        P.ppSimulate(w, 40);
        const v = P.psJudge(f, w, job.shot.nominate, job.shot.call);
        P.psApplySpots(w, v.spots);
        if (cpu) {
            safeRun = job.plan === 'safety' ? safeRun + 1 : 0;
            if (!f.isBreak) {
                st.visitsShots++;
                if (v.foul) { st.fouls++; st.foulWhy[v.foul] = (st.foulWhy[v.foul] || 0) + 1; const k = job.plan; st.foulLine[k] = (st.foulLine[k] || 0) + 1; }
                st.lines[job.plan] = (st.lines[job.plan] || 0) + 1;
            }
        }
        if (!v.continues) {
            endVisit(f.turn, f.brk + (v.foul ? 0 : v.points));
            if (cpu && !f.isBreak) st.visits++;
        }
        f = v.next;
        shots++;
    }
    st.shots += shots;
    if (!f.over) st.stalemates++;
    else if (f.winner === 2) st.cpuWins++;
    else st.humanWins++;
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0');
const band = (x, b) => (!b ? ' ' : x >= b[0] && x <= b[1] ? '✓' : '✗');
console.log('\nSnooker CPU tiers vs scripted humans: ' + FRAMES + ' frames per cell, ' + REDS + ' reds, seed ' + SEED + '\n');
console.log('tier     profile  CPU wins               mean brk  high  cent/100  147/100  fouls/visit  safety  ms/shot  trials  max ms');
const out = [];
for (const tier of TIERS) {
    for (const prof of PROFILES) {
        const rng = P.ppRandom(SEED * 7919 + tier.length * 31 + prof.name.length);
        const st = { cpuWins: 0, humanWins: 0, stalemates: 0, conceded: 0, visits: 0, visitsShots: 0, fouls: 0, shots: 0, thinkMs: 0, trials: 0, maxMs: 0,
            breaks: 0, breakSum: 0, high: 0, cent: 0, max: 0, foulWhy: {}, foulLine: {}, lines: {} };
        const t0 = Date.now();
        for (let i = 0; i < FRAMES; i++) playFrame(tier, prof, rng, st);
        const decided = st.cpuWins + st.humanWins, [lo, hi] = wilson(st.cpuWins, decided), B = BANDS[tier];
        const win = 100 * st.cpuWins / Math.max(1, decided), brk = st.breakSum / Math.max(1, st.breaks);
        const cent = 100 * st.cent / FRAMES, max = 100 * st.max / FRAMES, foul = 100 * st.fouls / Math.max(1, st.visitsShots);
        out.push({ tier, prof: prof.name, win, lo, hi, brk, cent, max, foul, st });
        console.log(tier.padEnd(9) + prof.name.padEnd(9) + (win.toFixed(1) + '% [' + lo.toFixed(0) + '–' + hi.toFixed(0) + '] ' + (prof.name === 'casual' ? band(win, B.win) : ' ')).padStart(22) +
            (brk.toFixed(1) + ' ' + band(brk, B.brk)).padStart(10) + String(st.high).padStart(6) + (cent.toFixed(1) + ' ' + band(cent, B.cent)).padStart(10) +
            (max.toFixed(1) + ' ' + band(max, B.max)).padStart(9) + (foul.toFixed(1) + '% ' + (foul <= B.foul ? '✓' : '✗')).padStart(13) +
            (pct(st.lines.safety || 0, st.visitsShots) + '%').padStart(8) + (st.thinkMs / Math.max(1, st.visitsShots)).toFixed(0).padStart(9) +
            (st.trials / Math.max(1, st.visitsShots)).toFixed(0).padStart(8) + st.maxMs.toFixed(0).padStart(8) +
            '   (' + ((Date.now() - t0) / 1000).toFixed(0) + 's, ' + st.stalemates + ' stale, ' + st.conceded + ' conceded)');
    }
}
const fouls = {};
out.forEach(r => Object.entries(r.st.foulWhy).forEach(([k, v]) => { fouls[r.tier] = fouls[r.tier] || {}; fouls[r.tier][k] = (fouls[r.tier][k] || 0) + v; }));
console.log('\nCPU fouls by reason, per tier: ' + JSON.stringify(fouls));
out.forEach(r => console.log('lines, ' + r.tier + ' vs ' + r.prof + ': ' + Object.entries(r.st.lines).map(([k, v]) => k + ' ' + v + (r.st.foulLine[k] ? ' (' + r.st.foulLine[k] + ' fouled)' : '')).join(', ')));
console.log('Centuries and 147s are per 100 frames (15 reds for the bands); the bracket is a Wilson 95% interval. Seat 1 (the human model) breaks off.\n');
module.exports = out;
