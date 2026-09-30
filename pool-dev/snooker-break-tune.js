// Finds the snooker CPU's break-off script offline (POOL_V2_PLAN.md, Snooker, S4): where in
// the D, how thin on the back red, how hard and with what side, so the cue ball comes back
// to baulk and the reds give little away. Prints PA_SN_BREAKS for pool-snooker-ai.js.
//
//   node pool-dev/snooker-break-tune.js [reds=15,10,6] [racks=4]
//
// A coarse grid on one rack first, then the best 40 on `racks` racks, each at the script's
// aim and ±0.1° (the tiers' noise is at most 0.3°), scored by paSnBreakScore (a foul -100,
// the cue ball home +3, less for every 100 u out of baulk and 3 × the opponent's best pot).
// Rerun it when the rack or the physics changes: the script drifts with them.
const L = require('./load');
const P = L.snookerAi();

const REDS = (process.argv[2] || '15,10,6').split(',').map(Number);
const RACKS = parseInt(process.argv[3], 10) || 4;
const DEG = Math.PI / 180;

function breakShot(w, cfg, side) {
    const cue = w.balls[0], R = w.cfg.ballR;
    const reds = w.balls.filter(b => P.psIsRed(b.id) && b.state !== 'pocketed');
    const back = reds.reduce((a, b) => (b.x > a.x + 1 || (Math.abs(b.x - a.x) <= 1 && b.y * side > a.y * side) ? b : a), reds[0]);
    return { angle: Math.atan2(back.y + side * cfg.off * R - cue.y, back.x - cue.x), speed: cfg.speed, tipX: cfg.tipX * side, tipY: cfg.tipY };
}
function score(reds, seed, cfg, side, dAim) {
    const w = P.psRack(P.psCreateWorld(), P.ppRandom(seed), reds);
    if (P.prCanPlace(w, cfg.x, cfg.y * side, 'D')) return -1000;
    P.prPlaceCue(w, cfg.x, cfg.y * side);
    const f = P.psNewFrame({ breaker: 1, reds, seed });
    const shot = breakShot(w, cfg, side);
    shot.angle += (dAim || 0) * DEG;
    w.log = [];
    P.ppStrike(w, shot);
    P.ppSimulate(w, 40);
    const v = P.psJudge(Object.assign({}, f, { touching: P.psTouching(w.balls, w.cfg.ballR) }), w, -1, -1);
    return P.paSnBreakScore({ w, v });
}

const found = {};
for (const reds of REDS) {
    const t0 = Date.now();
    const grid = [];
    [-305, -320, -335].forEach(x => [15, 30, 45, 60].forEach(y => [1.45, 1.6, 1.7, 1.8, 1.9, 2.0].forEach(off =>
        [800, 950, 1100, 1250, 1400].forEach(speed => [0, 0.2, 0.35].forEach(tipX => [0, -0.2].forEach(tipY => grid.push({ x, y, off, speed, tipX, tipY })))))));
    grid.forEach(c => { c.coarse = score(reds, 1, c, 1, 0); });
    const top = grid.filter(c => c.coarse > -100).sort((a, b) => b.coarse - a.coarse).slice(0, 40);
    top.forEach(c => {
        const all = [];
        for (let k = 0; k < RACKS; k++) [-0.1, 0, 0.1].forEach(d => [1, -1].forEach(side => all.push(score(reds, 11 + k * 7, c, side, d))));
        c.fouls = all.filter(s => s <= -100).length;
        c.mean = all.reduce((a, b) => a + b, 0) / all.length;
        c.worst = Math.min(...all);
    });
    top.sort((a, b) => b.mean - a.mean);
    const b = top[0];
    found[reds] = { x: b.x, y: b.y, off: b.off, speed: b.speed, tipX: b.tipX, tipY: b.tipY };
    console.log(reds + ' reds: ' + grid.length + ' coarse, best mean ' + b.mean.toFixed(2) + ' (worst ' + b.worst.toFixed(1) + ', fouls ' + b.fouls + '/' + (RACKS * 6) + ')  ' +
        JSON.stringify(found[reds]) + '  (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
    top.slice(1, 4).forEach(c => console.log('   next: mean ' + c.mean.toFixed(2) + ' worst ' + c.worst.toFixed(1) + ' fouls ' + c.fouls + '  ' + JSON.stringify({ x: c.x, y: c.y, off: c.off, speed: c.speed, tipX: c.tipX, tipY: c.tipY })));
}
console.log('\n    const PA_SN_BREAKS = {');
REDS.forEach(r => { const s = found[r]; console.log('        ' + (String(r) + ':').padEnd(4) + ' { x: ' + s.x + ', y: ' + s.y + ', off: ' + s.off + ', speed: ' + s.speed + ', tipX: ' + s.tipX + ', tipY: ' + s.tipY + ' },'); });
console.log('    };');
