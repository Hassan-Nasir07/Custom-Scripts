// Calibrates the v2 CPU tiers against scripted humans (POOL_V2_PLAN.md, Phase 6).
//
//   node pool-dev/balance-check.js [frames=60] [tiers=easy,normal,hard,pro] [profiles=all] [seed=1]
//
// The same method as v1/baseline-check.js, so the numbers compare: the human
// model is the CPU's own shot selection (the hard planner) with Gaussian aim
// and power error on top, so the profiles differ only in execution. Seat 1 (the
// human) always breaks. The bar from v1's baseline: hard must beat 61.4% of
// frames against "skilled" and 72.3% against "casual", and pro must beat hard.
// POOL_CUES=1: the CPU plays its tier's cue (pool-cues.js PQ_CPU), the human model Standard.
const L = require('./load');
const P = L.ai();
const CUES = process.env.POOL_CUES === '1' ? L.render() : null;
// The table as the tier's cue reaches it: its power cap and spin reach.
const cueCfg = (cfg, tier, game) => { if (!CUES) return cfg; const s = CUES.pqCpuStats(tier, game); return Object.assign({}, cfg, { maxSpeed: cfg.maxSpeed * s.power, maxTip: cfg.maxTip * s.spin }); };

// Tuning without editing pool-ai.js: POOL_TIER_TUNE='{"hard":{"aim":0.2,"power":0.02}}'
if (process.env.POOL_TIER_TUNE) {
    const tune = JSON.parse(process.env.POOL_TIER_TUNE);
    Object.keys(tune).forEach(t => Object.assign(P.PA_TIERS[t], tune[t]));
    console.log('tuned: ' + JSON.stringify(tune));
}

const FRAMES = parseInt(process.argv[2], 10) || 60;
const TIERS = (process.argv[3] || 'easy,normal,hard,pro').split(',');
const PROFILE_PICK = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : null;
const SEED = parseInt(process.argv[5], 10) || 1;
const SHOT_CAP = 300;

const PROFILES = [
    { name: 'mirror',  aimDeg: 0,   power: 0    },
    { name: 'skilled', aimDeg: 0.4, power: 0.05 },
    { name: 'casual',  aimDeg: 1.2, power: 0.12 },
    { name: 'novice',  aimDeg: 3.0, power: 0.25 },
].filter(p => !PROFILE_PICK || PROFILE_PICK.includes(p.name));
// v1's CPU against the same profiles (v1/baseline-check.js, 1,000 frames each).
const V1 = { mirror: 53.4, skilled: 61.4, casual: 72.3, novice: 75.1 };

function wilson(k, n) {
    if (!n) return [0, 0];
    const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
    const r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [100 * (c - r) / d, 100 * (c + r) / d];
}

function playFrame(tier, prof, rng, st) {
    const w = P.ppRack(P.ppCreateWorld(), rng), base = w.cfg, mine = cueCfg(base, tier, 'pool');
    let frame = P.prNewFrame({ breaker: 1, callEvery: !!P.PA_TIERS[tier].callEvery });
    let shots = 0;
    while (!frame.over && shots < SHOT_CAP) {
        const seat = frame.turn;
        const cpu = seat === 2;
        w.cfg = cpu ? mine : base;
        if (frame.ballInHand) {
            const p = P.paPlace(w, frame, rng, cpu ? tier : 'hard');
            P.prPlaceCue(w, p[0], p[1]);
        }
        const job = cpu ? P.paPlan(w, frame, { rng, tier })
            : P.paPlan(w, frame, { rng, tier: 'hard', aimDeg: prof.aimDeg, powerFrac: prof.power, noise: prof.aimDeg > 0 || prof.power > 0 });
        const t0 = process.hrtime.bigint();
        job.step();
        if (cpu) st.thinkMs += Number(process.hrtime.bigint() - t0) / 1e6;
        w.log = [];
        P.ppStrike(w, job.shot);
        P.ppSimulate(w);
        const v = P.prJudge(frame, w, job.shot.call);
        if (v.respot8) P.prSpotBall(w, 8);
        if (cpu && !frame.isBreak) {
            st.cpuVisits++;
            if (v.continues) st.cpuPots++;
            if (v.foul) {
                st.cpuFouls++; st.foulWhy[v.foul] = (st.foulWhy[v.foul] || 0) + 1;
                // Which line fouled: the plan and the kind of line it was.
                const k = job.plan + '/' + job.kind; st.foulLine[k] = (st.foulLine[k] || 0) + 1;
            }
            { const k = job.plan + '/' + job.kind; st.lines[k] = (st.lines[k] || 0) + 1; }
            if (job.plan === 'safety') st.cpuSafeties++;
        }
        if (v.frameOver && v.winner === 1 && cpu) st.lossWhy[v.reason] = (st.lossWhy[v.reason] || 0) + 1;
        frame = v.next;
        shots++;
    }
    st.shots += shots;
    if (!frame.over) st.stalemates++;
    else if (frame.winner === 2) st.cpuWins++;
    else st.humanWins++;
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0');
console.log('\nv2 CPU tiers vs scripted humans: ' + FRAMES + ' frames per cell, seed ' + SEED + (CUES ? ', the CPU with its cue' : '') + '\n');
console.log('tier     profile   aim σ   power σ   CPU wins             v1 CPU   human   stale   CPU pot/visit   foul    safety   ms/shot');
const out = [];
for (const tier of TIERS) {
    for (const prof of PROFILES) {
        const rng = P.ppRandom(SEED * 7919 + tier.length * 31 + prof.name.length);
        const st = { cpuWins: 0, humanWins: 0, stalemates: 0, cpuVisits: 0, cpuPots: 0, cpuFouls: 0, cpuSafeties: 0, shots: 0, thinkMs: 0, foulWhy: {}, lossWhy: {}, foulLine: {}, lines: {} };
        const t0 = Date.now();
        for (let i = 0; i < FRAMES; i++) playFrame(tier, prof, rng, st);
        const decided = st.cpuWins + st.humanWins, [lo, hi] = wilson(st.cpuWins, decided);
        out.push({ tier, prof: prof.name, win: 100 * st.cpuWins / Math.max(1, decided), lo, hi, st });
        console.log(tier.padEnd(9) + prof.name.padEnd(9) + (prof.aimDeg + '°').padStart(6) + ((prof.power * 100) + '%').padStart(10) +
            (pct(st.cpuWins, decided) + '% [' + lo.toFixed(0) + '–' + hi.toFixed(0) + ']').padStart(21) + (V1[prof.name] + '%').padStart(9) +
            (pct(st.humanWins, decided) + '%').padStart(8) + String(st.stalemates).padStart(8) +
            (pct(st.cpuPots, st.cpuVisits) + '%').padStart(16) + (pct(st.cpuFouls, st.cpuVisits) + '%').padStart(8) +
            (pct(st.cpuSafeties, st.cpuVisits) + '%').padStart(9) + (st.thinkMs / Math.max(1, st.cpuVisits)).toFixed(0).padStart(10) +
            '   (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
    }
}
const fouls = {};
out.forEach(r => Object.entries(r.st.foulWhy).forEach(([k, v]) => { fouls[r.tier] = fouls[r.tier] || {}; fouls[r.tier][k] = (fouls[r.tier][k] || 0) + v; }));
console.log('\nCPU fouls by reason, per tier: ' + JSON.stringify(fouls));
// Fouls by the line that was played (plan/kind), against how often each was played.
const lines = {};
out.forEach(r => { const t = lines[r.tier] = lines[r.tier] || {};
    Object.entries(r.st.lines).forEach(([k, v]) => { t[k] = t[k] || { played: 0, fouled: 0 }; t[k].played += v; });
    Object.entries(r.st.foulLine).forEach(([k, v]) => { t[k].fouled += v; }); });
Object.entries(lines).forEach(([tier, t]) => console.log('fouls by line, ' + tier + ': ' +
    Object.entries(t).sort((a, b) => b[1].fouled - a[1].fouled).map(([k, x]) => k + ' ' + x.fouled + '/' + x.played).join(', ')));
console.log('CPU wins are over decided frames; the bracket is a Wilson 95% interval. Seat 1 (the human model) always breaks.\n');
module.exports = out;
