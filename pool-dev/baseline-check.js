// Measures today's CPU so the v2 "hard" tier has a bar to clear (POOL_V2_PLAN.md,
// Phase 0: "hard must never measure weaker than today's CPU").
//
//   node pool-dev/baseline-check.js [frames-per-profile=200] [seed=1]
//
// The human model is the CPU's own shot planner run for seat 1 (by swapping its
// group into the slot the planner reads), then perturbed by Gaussian aim and
// power error. Using the same planner keeps shot SELECTION equal, so the
// profiles differ only in execution, which is the thing skill actually changes.
//
// Faithful to the current game: seat 1 always breaks, from the head spot, and
// the frame runs through the real poolPhysicsUpdate / poolProcessTurnResult.
const load = require('./load');

const FRAMES = parseInt(process.argv[2], 10) || 200;
const SEED   = parseInt(process.argv[3], 10) || 1;
const SHOT_CAP = 400;   // a frame this long is a stalemate, not a result

const PROFILES = [
    { name: 'mirror',  aimDeg: 0,    power: 0    },   // sanity: same player both seats
    { name: 'skilled', aimDeg: 0.4,  power: 0.05 },
    { name: 'casual',  aimDeg: 1.2,  power: 0.12 },
    { name: 'novice',  aimDeg: 3.0,  power: 0.25 },
];

function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function settle(P) {
    let f = 0;
    while (!P.poolAllStopped() && f < 6000) { P.poolPhysicsUpdate(); f++; }
}

// Runs fn as if seat 1 were the planner's seat 2.
function asSeat1(P, fn) {
    const g2 = P.poolPlayer2Group;
    P.poolPlayer2Group = P.poolPlayer1Group;
    try { return fn(); } finally { P.poolPlayer2Group = g2; }
}

function humanShot(P, prof, rng) {
    const cue = P.poolBalls[0];
    if (P.poolIsBreakShot) {
        cue.x = P.POOL_W * 0.25; cue.y = P.POOL_H / 2;
        P.poolPlacingBall = false; P.poolBallInHand = false;
        const apex = P.poolBalls.slice(1).reduce((a, b) => (b.x < a.x ? b : a));
        const aim = Math.atan2(apex.y - cue.y, apex.x - cue.x) + gaussian(rng) * prof.aimDeg * Math.PI / 180;
        P.poolCueSpinX = 0; P.poolCueSpinY = 0;
        P.poolFireShot(cue, aim, P.POOL_CUE_MAX_POWER * 0.95 * (1 + gaussian(rng) * prof.power));
        return;
    }
    if (P.poolPlacingBall || P.poolBallInHand) asSeat1(P, () => P.poolAIPlaceBall());
    asSeat1(P, () => P.poolAITakeShot(true));
    const s = P.poolAIPendingShot;
    P.poolAIPendingShot = null;
    const angle = s.angle + gaussian(rng) * prof.aimDeg * Math.PI / 180;
    const power = Math.max(1, Math.min(P.POOL_CUE_MAX_POWER, s.power * (1 + gaussian(rng) * prof.power)));
    P.poolCueSpinX = s.spinX; P.poolCueSpinY = s.spinY;
    P.poolFireShot(cue, angle, power);
}

function cpuShot(P) {
    if (P.poolPlacingBall || P.poolBallInHand) P.poolAIPlaceBall();
    P.poolAIPendingShot = null;
    P.poolAITakeShot(false);
}

function playFrame(P, prof, rng, st) {
    P.resetPoolGame();
    P.poolGameRunning = true;
    let shots = 0;
    while (!P.poolGameOver && shots < SHOT_CAP) {
        const seat = P.poolTurn;
        const mine = () => (seat === 1 ? P.poolPlayer1Pocketed : P.poolPlayer2Pocketed).length;
        const before = mine();
        if (seat === 2) cpuShot(P); else humanShot(P, prof, rng);
        shots++;
        settle(P);
        P.poolProcessTurnResult();
        if (seat === 2 && !P.poolGameOver) {
            st.cpuShots++;
            if (mine() > before) st.cpuPots++;
            if (P.poolBallInHand && P.poolTurn === 1) {
                st.cpuFouls++;
                st.foulWhy[P.poolFoulMessage] = (st.foulWhy[P.poolFoulMessage] || 0) + 1;
            }
        } else if (seat === 2 && P.poolWinner === 1) {
            // The CPU lost the frame on its own shot: which 8-ball rule did it break?
            st.lossWhy[P.poolFoulMessage] = (st.lossWhy[P.poolFoulMessage] || 0) + 1;
        }
    }
    st.shots += shots;
    if (!P.poolGameOver) st.stalemates++;
    else if (P.poolWinner === 2) st.cpuWins++;
    else st.humanWins++;
}

// Wilson 95% interval, in percent.
function wilson(k, n) {
    if (!n) return [0, 0];
    const z = 1.96, p = k / n;
    const d = 1 + z * z / n;
    const c = p + z * z / (2 * n);
    const r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [100 * (c - r) / d, 100 * (c + r) / d];
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0');
console.log(`\nToday's CPU vs scripted humans — ${FRAMES} frames per profile, seed ${SEED}\n`);
console.log('profile   aim σ   power σ   CPU wins            human   stalemate   CPU pot/visit   CPU foul   shots/frame');
const results = [];
for (const prof of PROFILES) {
    const t0 = Date.now();
    const P = load({ seed: SEED });
    P.initPoolGame();
    const rng = load.seededRandom(SEED * 7919 + prof.name.length);
    const st = { cpuWins: 0, humanWins: 0, stalemates: 0, cpuShots: 0, cpuPots: 0, cpuFouls: 0, shots: 0,
                 foulWhy: {}, lossWhy: {} };
    for (let i = 0; i < FRAMES; i++) playFrame(P, prof, rng, st);
    const decided = st.cpuWins + st.humanWins;
    const [lo, hi] = wilson(st.cpuWins, decided);
    results.push({ prof, st, lo, hi });
    console.log(
        prof.name.padEnd(9) + (prof.aimDeg + '°').padStart(6) + ((prof.power * 100) + '%').padStart(10) +
        (pct(st.cpuWins, decided) + '% [' + lo.toFixed(0) + '–' + hi.toFixed(0) + ']').padStart(20) +
        (pct(st.humanWins, decided) + '%').padStart(8) + String(st.stalemates).padStart(12) +
        (pct(st.cpuPots, st.cpuShots) + '%').padStart(16) + (pct(st.cpuFouls, st.cpuShots) + '%').padStart(11) +
        (st.shots / FRAMES).toFixed(1).padStart(14) + `   (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
// Why the CPU fouls and how it loses, pooled across profiles: the CPU plays the
// same way whoever it faces, so splitting these by profile only adds noise.
const tally = key => {
    const all = {};
    results.forEach(r => Object.entries(r.st[key]).forEach(([k, v]) => { all[k] = (all[k] || 0) + v; }));
    const total = Object.values(all).reduce((a, b) => a + b, 0);
    return Object.entries(all).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => '    ' + pct(v, total).padStart(5) + '%  ' + (k || '(none)')).join('\n');
};
const visits = results.reduce((a, r) => a + r.st.cpuShots, 0);
const fouls = results.reduce((a, r) => a + r.st.cpuFouls, 0);
console.log(`\nCPU fouls by reason (${fouls} of ${visits} visits):\n` + tally('foulWhy'));
console.log('\nCPU frame losses on its own shot, by reason:\n' + tally('lossWhy'));
console.log('\nCPU wins are over decided frames; the bracket is a Wilson 95% interval.');
console.log('Seat 1 (the human model) always breaks, as in the current game.\n');
module.exports = results;
