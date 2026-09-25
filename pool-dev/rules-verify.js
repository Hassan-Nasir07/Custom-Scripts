// Pool v2 rules verification. `node pool-dev/rules-verify.js [fuzz-frames=40]`
//
// Three layers:
//   1. One table-driven case per rule row, fed a hand-written shot log, so
//      each rule is pinned on its own. The Phase 0 BCA cases are carried over
//      where they still apply; the two that pinned problems 6 and 7 now pin
//      the fixes.
//   2. The same rules on real shots from pool-physics.js: breaks, a pot, a
//      called pot in the wrong pocket, the 8, a scratch, a short tap.
//   3. A fuzz of whole frames played by a crude ghost-ball shooter, checking
//      the invariants a frame must keep from the break to the 8.
const P = require('./load').rules();

const FUZZ = parseInt(process.argv[2], 10) || 40;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name + (detail !== undefined ? '  (' + detail + ')' : '')); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));

const SOLIDS = [1, 2, 3, 4, 5, 6, 7], STRIPES = [9, 10, 11, 12, 13, 14, 15];
const TL = 0, TS = 1, TR = 2, BL = 3, BS = 4, BR = 5;

// ── 1. Rule rows ──────────────────────────────────────────────────────
head('Rule rows');
// A racked table with `down` already pocketed, then a shot log: the cue
// ball hits `first`, `rail` puts a ball on a cushion after that, `railed`
// lists object balls that reached a cushion (the break count) and `pots`
// are [ball, pocket] in the order they drop.
function judge(o) {
    const w = P.ppRack(P.ppCreateWorld(), P.ppRandom(1));
    const byId = id => w.balls.find(b => b.id === id);
    (o.down || []).forEach(id => { byId(id).state = 'pocketed'; });
    w.log = [{ type: 'strike', t: 0, ball: 0 }];
    if (o.first !== undefined && o.first !== -1) w.log.push({ type: 'ball', t: 0.1, a: 0, b: o.first });
    (o.railed || []).forEach(id => w.log.push({ type: 'cushion', t: 0.2, ball: id, kind: 'cushion' }));
    if (o.rail) w.log.push({ type: 'cushion', t: 0.2, ball: 0, kind: 'cushion' });
    (o.pots || []).forEach(([id, pocket]) => {
        byId(id).state = 'pocketed'; byId(id).pocket = pocket;
        w.log.push({ type: 'pocket', t: 0.3, ball: id, pocket });
    });
    const s = P.prNewFrame({ breaker: o.turn || 1, callEvery: o.callEvery });
    if (!o.isBreak) { s.isBreak = false; s.ballInHand = null; s.shots = 1; }
    if (o.groups) s.groups = { 1: o.groups[0], 2: o.groups[1] };
    return { v: P.prJudge(s, w, o.call), s, w };
}
const G = ['solids', 'stripes'];
const cases = [
    // Break
    ['break: a pot makes it legal, the breaker plays on, the table stays open',
        { isBreak: true, first: 1, pots: [[5, TL]] },
        v => !v.foul && v.legalBreak && v.continues && v.nextTurn === 1 && !v.assigned && v.next.groups[1] === null],
    ['break: 4 object balls to a rail and no pot is legal, the turn passes',
        { isBreak: true, first: 1, railed: [2, 3, 4, 5] },
        v => !v.foul && v.legalBreak && !v.continues && v.nextTurn === 2 && v.ballInHand === null],
    ['break: 3 balls to a rail and no pot is an illegal break (problem 6)',
        { isBreak: true, first: 1, railed: [2, 3, 4], rail: true },
        v => v.foul === 'illegalBreak' && v.legalBreak === false && v.nextTurn === 2 && v.ballInHand === 'anywhere'],
    ['break: missing the rack is an illegal break', { isBreak: true, first: -1 },
        v => v.foul === 'illegalBreak'],
    ['break: a scratch is a foul, the pots stay down, the table stays open',
        { isBreak: true, first: 1, pots: [[3, TL], [0, BR]] },
        v => v.foul === 'scratch' && v.nextTurn === 2 && v.ballInHand === 'anywhere' && v.next.groups[1] === null],
    ['break: the 8 is re-spotted and the breaker plays on', { isBreak: true, first: 1, pots: [[8, BS]] },
        v => !v.frameOver && v.respot8 && v.continues && v.notice === 'respot8'],
    ['break: the 8 and a scratch re-spot the 8, ball in hand to the opponent', { isBreak: true, first: 1, pots: [[8, TR], [0, TL]] },
        v => !v.frameOver && v.respot8 && v.foul === 'scratch' && v.nextTurn === 2],
    ['break: the 8 first is fine on the break', { isBreak: true, first: 8, railed: [1, 2, 3, 4] },
        v => !v.foul],
    ['break: the next state is no longer a break and the kitchen is gone',
        { isBreak: true, first: 1, railed: [2, 3, 4, 5] },
        (v, s) => s.isBreak && s.ballInHand === 'kitchen' && !v.next.isBreak && v.next.ballInHand === null],
    // Open table
    ['open table: either group may be hit first', { first: 12, rail: true },
        v => !v.foul && v.nextTurn === 2 && !v.ballInHand],
    ['open table: the 8 first is a foul', { first: 8, rail: true },
        v => v.foul === 'eightFirst' && v.ballInHand === 'anywhere'],
    ['open table: the first pot assigns the shooter its group', { first: 11, pots: [[11, TR]] },
        v => v.assigned === 'stripes' && v.next.groups[1] === 'stripes' && v.next.groups[2] === 'solids' && v.continues],
    ['open table: seat 2 pots a solid and takes solids', { turn: 2, first: 4, pots: [[4, BL]] },
        v => v.next.groups[2] === 'solids' && v.next.groups[1] === 'stripes' && v.nextTurn === 2],
    ['open table: one of each drops, the first to drop decides', { first: 3, pots: [[12, TL], [3, TR]] },
        v => v.assigned === 'stripes' && v.continues],
    ['open table: a pot on a foul assigns nothing', { first: 12, pots: [[3, TL], [0, TR]] },
        v => v.foul === 'scratch' && !v.assigned && v.next.groups[1] === null],
    // Groups set
    ['scratch → opponent has ball in hand', { groups: G, first: 3, rail: true, pots: [[0, TL]] },
        v => v.foul === 'scratch' && v.nextTurn === 2 && v.ballInHand === 'anywhere'],
    ['no ball contacted → foul', { groups: G, first: -1 },
        v => v.foul === 'noContact' && v.nextTurn === 2 && v.ballInHand === 'anywhere'],
    ["opponent's ball first → foul", { groups: G, first: 12, rail: true },
        v => v.foul === 'wrongBall' && v.nextTurn === 2 && v.ballInHand === 'anywhere'],
    ['the 8 first before clearing the group → foul', { groups: G, first: 8, rail: true },
        v => v.foul === 'eightFirst'],
    ['no rail after contact and no pot → foul', { groups: G, first: 3 },
        v => v.foul === 'noRail' && v.nextTurn === 2],
    ['a pot needs no rail', { groups: G, first: 3, pots: [[3, TL]] },
        v => !v.foul && v.continues],
    ['legal miss → turn passes, no ball in hand', { groups: G, first: 3, rail: true },
        v => !v.foul && v.nextTurn === 2 && !v.ballInHand],
    ['legal pot → same player continues', { groups: G, first: 3, pots: [[3, TL]] },
        v => v.nextTurn === 1 && v.continues && v.counted.join() === '3'],
    ["potting only the opponent's ball ends the turn without a foul",
        { groups: G, first: 3, pots: [[12, TL]] },
        v => !v.foul && v.nextTurn === 2 && !v.ballInHand && v.counted.length === 0],
    ['own and opponent ball together → continue', { groups: G, first: 3, pots: [[12, TL], [3, BR]] },
        v => v.continues && v.counted.join() === '3'],
    ['a ball potted on a foul stays down but does not count', { groups: G, first: 12, pots: [[3, TL]] },
        (v, s, w) => v.foul === 'wrongBall' && v.nextTurn === 2 && v.counted.length === 0 && w.balls.find(b => b.id === 3).state === 'pocketed'],
    // Call every shot
    ['call-every: a ball in the called pocket counts', { groups: G, callEvery: true, call: TL, first: 3, pots: [[3, TL]] },
        v => v.callRequired && v.continues && v.counted.join() === '3'],
    ['call-every: the wrong pocket ends the turn without a foul', { groups: G, callEvery: true, call: TR, first: 3, pots: [[3, TL]] },
        v => !v.foul && !v.continues && v.nextTurn === 2 && v.notice === 'wrongPocket' && !v.ballInHand],
    ['call-every: one in, one elsewhere still counts', { groups: G, callEvery: true, call: BR, first: 3, pots: [[4, TL], [3, BR]] },
        v => v.continues && v.counted.join() === '3'],
    ['call-every: on the open table the called ball picks the group', { callEvery: true, call: BR, first: 3, pots: [[12, TL], [3, BR]] },
        v => v.assigned === 'solids'],
    ['call-every: the break is never called', { isBreak: true, callEvery: true, first: 1, pots: [[5, TL]] },
        v => !v.callRequired && v.continues],
    ['call-every off: a call is ignored away from the 8', { groups: G, call: TR, first: 3, pots: [[3, TL]] },
        v => !v.callRequired && v.continues && v.call === -1],
    // On the 8
    ['on the 8: the 8 must be called', { groups: G, down: SOLIDS, first: 8, rail: true },
        v => v.onThe8 && v.callRequired],
    ['on the 8: must hit the 8 first', { groups: G, down: SOLIDS, first: 12, rail: true },
        v => v.foul === 'notEight' && v.nextTurn === 2],
    ['on the 8: a scratch without the 8 is only a foul', { groups: G, down: SOLIDS, first: 8, pots: [[0, TL]] },
        v => v.foul === 'scratch' && !v.frameOver && v.nextTurn === 2],
    ['legal 8 in the called pocket wins', { groups: G, down: SOLIDS, call: TR, first: 8, pots: [[8, TR]] },
        v => v.frameOver && v.winner === 1 && v.reason === 'eightPotted' && v.next.over],
    ['the 8 in another pocket loses', { groups: G, down: SOLIDS, call: TL, first: 8, pots: [[8, TR]] },
        v => v.frameOver && v.winner === 2 && v.reason === 'eightWrongPocket'],
    ['the 8 with no call loses', { groups: G, down: SOLIDS, first: 8, pots: [[8, TR]] },
        v => v.frameOver && v.winner === 2 && v.reason === 'eightWrongPocket'],
    ['the 8 with a scratch loses, even called', { groups: G, down: SOLIDS, call: TR, first: 8, pots: [[8, TR], [0, BL]] },
        v => v.frameOver && v.winner === 2 && v.reason === 'eightScratch'],
    ['the 8 without hitting it first loses', { groups: G, down: SOLIDS, call: TR, first: 12, pots: [[8, TR]] },
        v => v.frameOver && v.winner === 2 && v.reason === 'eightFoul' && v.foul === 'notEight'],
    ['the 8 on the open table loses', { first: 8, pots: [[8, TR]] },
        v => v.frameOver && v.winner === 2 && v.reason === 'eightEarly'],
    ['the 8 before clearing the group loses', { groups: G, down: [1, 2, 3, 4, 5, 6], first: 7, pots: [[8, TR]] },
        v => v.frameOver && v.winner === 2 && v.reason === 'eightEarly'],
    ['the last group ball and the 8 together lose', { groups: G, down: [1, 2, 3, 4, 5, 6], call: TR, first: 7, pots: [[7, TL], [8, TR]] },
        v => v.frameOver && v.winner === 2 && v.reason === 'eightEarly'],
    ['legal 8 by seat 2 wins for seat 2', { turn: 2, groups: G, down: STRIPES, call: BS, first: 8, pots: [[8, BS]] },
        v => v.frameOver && v.winner === 2],
    ['call-every: the 8 still decides by its own call', { groups: G, callEvery: true, down: SOLIDS, call: BL, first: 8, pots: [[8, BL]] },
        v => v.frameOver && v.winner === 1],
];
cases.forEach(([name, o, check]) => {
    let r, err;
    try { r = judge(o); } catch (e) { err = e; }
    ok(name, !err && check(r.v, r.s, r.w), err ? err.stack : JSON.stringify({
        foul: r.v.foul, reason: r.v.reason, next: r.v.nextTurn, cont: r.v.continues, bih: r.v.ballInHand,
        assigned: r.v.assigned, counted: r.v.counted, notice: r.v.notice, winner: r.v.winner }));
});

{
    const r = judge({ groups: G, first: 3, pots: [[3, TL]] });
    const s0 = JSON.stringify(r.s), w0 = JSON.stringify(r.w);
    P.prJudge(r.s, r.w, -1);
    ok('prJudge mutates neither the state nor the world', JSON.stringify(r.s) === s0 && JSON.stringify(r.w) === w0);
    const b = P.prNewFrame({ breaker: 2, callEvery: true });
    ok('a new frame: the breaker has ball in hand in the kitchen', b.turn === 2 && b.isBreak && b.ballInHand === 'kitchen' && b.callEvery);
    ok('only the log after the last strike is judged', (() => {
        const q = judge({ groups: G, first: 3, rail: true });
        q.w.log.unshift({ type: 'strike' }, { type: 'pocket', ball: 0, pocket: 0 });
        return !P.prJudge(q.s, q.w, -1).foul;
    })());
}

// ── 2. Messages ───────────────────────────────────────────────────────
head('Messages (problem 7)');
{
    const cpu = { 1: 'You', 2: 'CPU' }, pvp = { 1: 'Ayesha', 2: 'Bilal' };
    const t = (o, names) => P.prText(judge(o).v, names);
    const a = t({ groups: G, first: 12, rail: true }, pvp);
    ok("the design's foul toast: 'Foul · Hit opponent's ball first' / 'Ball in hand to Bilal'",
        a.kind === 'foul' && a.title === "Foul · Hit opponent's ball first" && a.sub === 'Ball in hand to Bilal', a.title + ' / ' + a.sub);
    const b = t({ groups: G, down: SOLIDS, call: TR, first: 8, pots: [[8, TR]] }, pvp);
    ok("the design's win: 'Ayesha wins' / 'Potted the 8 in the called pocket.'",
        b.title === 'Ayesha wins' && b.sub === 'Potted the 8 in the called pocket.');
    const c = t({ turn: 2, groups: G, down: STRIPES, call: TR, first: 8, pots: [[8, TR], [0, TL]] }, cpu);
    ok('the CPU scratching on the 8 reads "You win" / "CPU scratched on the 8."', c.title === 'You win' && c.sub === 'CPU scratched on the 8.', c.title + ' / ' + c.sub);
    const d = t({ groups: G, down: SOLIDS, call: TR, first: 8, pots: [[8, TR], [0, TL]] }, cpu);
    ok('you scratching on the 8 reads "CPU wins" / "You scratched on the 8."', d.title === 'CPU wins' && d.sub === 'You scratched on the 8.');
    const e = t({ turn: 2, groups: G, first: 3, rail: true }, cpu);
    ok('a CPU foul hands ball in hand to "you"', e.sub === 'Ball in hand to you', e.sub);
    const f = t({ first: 11, pots: [[11, TR]] }, cpu);
    ok("group assignment: \"You're on stripes\"", f.title === "You're on stripes" && f.sub === 'Your shot', f.title + ' / ' + f.sub);
    const g = t({ groups: G, callEvery: true, call: TR, first: 3, pots: [[3, TL]] }, pvp);
    ok('a wrong called pocket names who shoots next', g.title === 'Not in the called pocket' && g.sub === 'Bilal to shoot');
    ok('a plain miss needs no toast', t({ groups: G, first: 3, rail: true }, pvp) === null);
    const every = ['scratch', 'noContact', 'wrongBall', 'eightFirst', 'notEight', 'noRail', 'illegalBreak'];
    ok('every foul has copy', every.every(k => typeof P.PR_FOUL_TEXT[k] === 'string'));
}

// ── 3. Table helpers ──────────────────────────────────────────────────
head('Table helpers');
{
    const w = P.ppRack(P.ppCreateWorld(), P.ppRandom(2));
    const T = w.table, R = w.cfg.ballR;
    ok('kitchen: behind the head string is fine', P.prCanPlace(w, T.headX - 10, 0, 'kitchen') === null);
    ok('kitchen: past the head string is refused', P.prCanPlace(w, T.headX + 10, 0, 'kitchen') === 'kitchen');
    ok('anywhere: past the head string is fine', P.prCanPlace(w, 0, 0, 'anywhere') === null);
    ok('touching a ball is refused', P.prCanPlace(w, T.footX - 2 * R + 1, 0, 'anywhere') === 'overlap');
    ok('into the cushion is refused', P.prCanPlace(w, 0, T.halfWidth - R + 1, 'anywhere') === 'outside');
    ok('NaN is refused', P.prCanPlace(w, NaN, 0, 'anywhere') === 'outside');

    const cue = w.balls[0];
    Object.assign(cue, { state: 'pocketed', pocket: 3 });
    P.prPlaceCue(w, -300, 40);
    ok('placing the cue ball brings it back to rest', cue.state === 'stationary' && cue.pocket === -1 && cue.x === -300 && cue.y === 40);

    const e = w.balls.find(b => b.id === 8);
    Object.assign(e, { state: 'pocketed', pocket: 1 });
    P.prSpotBall(w, 8);
    const clear = w.balls.every(o => o === e || o.state === 'pocketed' || Math.hypot(o.x - e.x, o.y - e.y) >= 2 * R);
    ok('the 8 re-spots behind a racked foot spot, clear of every ball', e.state === 'stationary' && e.y === 0 && e.x > T.footX && clear, e.x.toFixed(1));
    const w2 = P.ppCreateWorld();
    w2.balls = [P.ppMakeBall(0, -250, 0), Object.assign(P.ppMakeBall(8, 0, 0), { state: 'pocketed' })];
    P.prSpotBall(w2, 8);
    ok('the 8 re-spots on a free foot spot exactly', w2.balls[1].x === T.footX && w2.balls[1].y === 0);
    const w3 = P.ppCreateWorld();
    w3.balls = [P.ppMakeBall(8, 0, 0)];
    for (let x = T.footX; x <= T.halfLength - R; x += R) w3.balls.push(P.ppMakeBall(1, x, 0));
    w3.balls[0].state = 'pocketed';
    P.prSpotBall(w3, 8);
    ok('with no room behind, the 8 goes in front of the foot spot', w3.balls[0].x < T.footX);
}

// ── 4. Real shots ─────────────────────────────────────────────────────
head('Real shots');
function world(balls) {
    const w = P.ppCreateWorld();
    w.balls = balls.map(([id, x, y]) => P.ppMakeBall(id, x, y));
    return w;
}
function play(w, shot) { w.log = []; P.ppStrike(w, shot); P.ppSimulate(w); return w; }
function state(o) {
    const s = P.prNewFrame({ breaker: o.turn || 1, callEvery: o.callEvery });
    if (!o.isBreak) { s.isBreak = false; s.ballInHand = null; }
    if (o.groups) s.groups = { 1: o.groups[0], 2: o.groups[1] };
    return s;
}
// A straight-in pot into the top-right corner at 45°.
const straightIn = extra => world([[0, 300, 50], [3, 400, 150]].concat(extra || []));
const at45 = { angle: Math.PI / 4, speed: 900, tipX: 0, tipY: 0 };
{
    const breaks = { n: 0, legal: 0, agree: 0, pots: 0, groupsSet: 0, respot: 0 };
    for (let seed = 1; seed <= 40; seed++) {
        const w = P.ppRack(P.ppCreateWorld(), P.ppRandom(seed));
        const cy = ((seed * 37) % 100 - 50);
        P.prPlaceCue(w, w.table.headX, cy);
        play(w, { angle: Math.atan2(-cy, w.table.footX - w.table.headX), speed: 0.75 * w.cfg.maxSpeed });
        const v = P.prJudge(P.prNewFrame({ breaker: 1 }), w, -1);
        const s = v.summary, objPots = s.pots.filter(p => p.ball !== 0).length;
        breaks.n++;
        if (v.legalBreak) breaks.legal++;
        if (v.legalBreak === (s.first !== -1 && (objPots > 0 || s.objectRails >= 4))) breaks.agree++;
        if (objPots) breaks.pots++;
        if (v.next.groups[1] || v.next.groups[2]) breaks.groupsSet++;
        if (v.respot8) breaks.respot++;
    }
    ok('real breaks: the verdict matches the pot-or-4-rails rule on every break', breaks.agree === breaks.n, breaks.agree + '/' + breaks.n);
    ok('real breaks at 75%: nearly all legal', breaks.legal >= 38, breaks.legal + '/40 legal, ' + breaks.pots + ' potted');
    ok('real breaks never assign groups', breaks.groupsSet === 0);

    const w = play(straightIn(), at45);
    const v = P.prJudge(state({ groups: G }), w, -1);
    ok('a real straight-in pot: ball 3 drops in the top-right corner and the shooter plays on',
        v.summary.first === 3 && v.summary.pots.length === 1 && v.summary.pots[0].pocket === TR && v.continues && !v.foul,
        JSON.stringify(v.summary.pots));
    const vc = P.prJudge(state({ groups: G, callEvery: true }), play(straightIn(), at45), TR);
    ok('called top right: counts', vc.continues);
    const vw = P.prJudge(state({ groups: G, callEvery: true }), play(straightIn(), at45), BL);
    ok('called bottom left: no foul, the turn passes', !vw.foul && !vw.continues && vw.nextTurn === 2 && vw.notice === 'wrongPocket');

    const eight = () => world([[0, 300, 50], [8, 400, 150], [12, -300, -100]].concat(SOLIDS.map(id => [id, 0, 0])))
        .balls.map(b => (SOLIDS.includes(b.id) ? Object.assign(b, { state: 'pocketed' }) : b));
    const ew = () => { const w = P.ppCreateWorld(); w.balls = eight(); return w; };
    const win = P.prJudge(state({ groups: G }), play(ew(), at45), TR);
    ok('a real 8 into the called pocket wins', win.frameOver && win.winner === 1 && win.reason === 'eightPotted', win.reason);
    const lose = P.prJudge(state({ groups: G }), play(ew(), at45), TL);
    ok('the same 8 called elsewhere loses', lose.frameOver && lose.winner === 2 && lose.reason === 'eightWrongPocket');

    const sw = play(world([[0, 300, 50], [3, -300, -150]]), at45);
    const sv = P.prJudge(state({ groups: G }), sw, -1);
    ok('a real scratch: the cue ball drops and it is a foul', sv.foul === 'scratch' && sw.balls[0].state === 'pocketed');

    const tw = play(world([[0, -100, 0], [3, -60, 0]]), { angle: 0, speed: 120 });
    const tv = P.prJudge(state({ groups: G }), tw, -1);
    ok('a real tap that reaches no rail is a foul', tv.foul === 'noRail' && tv.summary.first === 3, JSON.stringify(tv.summary));
}

// ── 5. Whole frames ───────────────────────────────────────────────────
head('Whole frames (' + FUZZ + ')');
{
    const t0 = Date.now();
    const stats = { frames: 0, done: 0, shots: 0, fouls: 0, reasons: {}, violations: [] };
    const bad = (f, msg) => { if (stats.violations.length < 5) stats.violations.push('frame ' + f + ': ' + msg); };
    for (let f = 0; f < FUZZ; f++) {
        const rng = P.ppRandom(1000 + f);
        const w = P.ppRack(P.ppCreateWorld(), rng);
        const T = w.table, R = w.cfg.ballR;
        let s = P.prNewFrame({ breaker: 1 + (f % 2), callEvery: f % 3 === 0 });
        let lockedGroups = null;
        stats.frames++;
        for (let shot = 0; shot < 150 && !s.over; shot++) {
            // Ball in hand: a random spot the rules accept.
            if (s.ballInHand) {
                let x, y, tries = 0;
                do {
                    x = s.ballInHand === 'kitchen' ? -T.halfLength + R + rng() * (T.halfLength / 2 - R) : (rng() * 2 - 1) * (T.halfLength - R);
                    y = (rng() * 2 - 1) * (T.halfWidth - R);
                } while (P.prCanPlace(w, x, y, s.ballInHand) && ++tries < 500);
                if (tries >= 500) { bad(f, 'no place for the cue ball'); break; }
                P.prPlaceCue(w, x, y);
            }
            const cue = w.balls[0];
            if (cue.state === 'pocketed') { bad(f, 'shooting with the cue ball down'); break; }
            // A ghost-ball shot at a legal target, into a random pocket.
            const st = P.prStatus(s, w);
            const on = w.balls.filter(b => b.id !== 0 && b.state !== 'pocketed');
            const legal = on.filter(b => (st.onThe8 ? b.id === 8 : b.id !== 8 && (!st.group || P.prGroupOf(b.id) === st.group)));
            const target = legal.length ? legal[Math.floor(rng() * legal.length)] : on[0];
            const pi = Math.floor(rng() * 6), p = T.pockets[pi];
            const d = Math.hypot(p.x - target.x, p.y - target.y);
            const gx = target.x - (p.x - target.x) / d * 2 * R, gy = target.y - (p.y - target.y) / d * 2 * R;
            const angle = s.isBreak ? Math.atan2(-cue.y, T.footX - cue.x) : Math.atan2(gy - cue.y, gx - cue.x) + (rng() - 0.5) * 0.03;
            const speed = s.isBreak ? w.cfg.maxSpeed * 0.8 : 400 + rng() * 1400;
            play(w, { angle, speed, tipX: (rng() - 0.5) * 0.4, tipY: (rng() - 0.5) * 0.8 });
            const v = P.prJudge(s, w, st.callRequired ? pi : -1);
            stats.shots++;
            if (v.foul) stats.fouls++;

            const n = v.next;
            if (v.frameOver) {
                if (n.winner !== 1 && n.winner !== 2) bad(f, 'frame over without a winner');
                stats.reasons[v.reason] = (stats.reasons[v.reason] || 0) + 1;
            } else {
                if (v.foul && (n.ballInHand !== 'anywhere' || n.turn === s.turn)) bad(f, 'a foul without ball in hand to the opponent');
                if (!v.foul && n.ballInHand) bad(f, 'ball in hand without a foul');
                if (v.continues !== (n.turn === s.turn)) bad(f, 'turn and continues disagree');
                if (v.continues && !s.isBreak && !v.counted.length) bad(f, 'continued without a counted ball');
                if (n.isBreak) bad(f, 'still a break after a shot');
            }
            const g1 = n.groups[1], g2 = n.groups[2];
            if (!!g1 !== !!g2 || (g1 && g1 === g2)) bad(f, 'groups not complementary: ' + g1 + '/' + g2);
            if (lockedGroups && (g1 !== lockedGroups[0] || g2 !== lockedGroups[1])) bad(f, 'groups changed after being set');
            if (g1 && !lockedGroups) lockedGroups = [g1, g2];
            if (v.respot8) {
                P.prSpotBall(w, 8);
                const e = w.balls.find(b => b.id === 8);
                if (w.balls.some(o => o !== e && o.state !== 'pocketed' && Math.hypot(o.x - e.x, o.y - e.y) < 2 * R - 1e-6)) bad(f, 'the re-spotted 8 overlaps a ball');
            }
            if (!v.frameOver && w.balls.find(b => b.id === 8).state === 'pocketed') bad(f, 'the 8 is down but the frame goes on');
            s = n;
        }
        if (s.over) stats.done++;
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    ok('whole frames keep every invariant', stats.violations.length === 0, stats.violations.join('; ') || stats.shots + ' shots in ' + secs + ' s');
    ok('most frames reach the 8', stats.done >= FUZZ * 0.8, stats.done + '/' + FUZZ + ' finished; ' + JSON.stringify(stats.reasons));
    ok('fouls happen but do not dominate', stats.fouls > 0 && stats.fouls < stats.shots * 0.6, stats.fouls + ' fouls in ' + stats.shots + ' shots');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
