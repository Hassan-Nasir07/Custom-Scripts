    // ═══════════════════════════════════════════════════════════════════
    // SNOOKER — CPU (Phase S4)
    // ═══════════════════════════════════════════════════════════════════
    // pool-ai.js's pipeline on snooker's rules (POOL_V2_PLAN.md, Snooker, CPU):
    //   A  candidates from geometry: each ball the shooter may play (with the colour it
    //      nominates and the pocket it calls) into each pocket that takes it, with the
    //      tier's make probability against snooker's tight pockets; each played out on a
    //      copy of the table, the aim corrected for throw first, and judged by psJudge
    //   B  the survivors with the tier's spins and paces, scored in points expected:
    //      p·(points + γ·position) − (1−p)·what a miss leaves − fouls·(penalty + 3)
    //   R  the best lines replayed with the tier's own noise: how often they foul, and
    //      what a miss leaves the opponent
    //   S  safeties: the three nearest balls on, full, half-ball and thin either side and
    //      one-rail kicks, at four paces, scored by the opponent's best shot after them (a
    //      quarter less with the cue ball on a cushion, a snooker a bonus), then refined
    //   K  snookered: pool's sweep, the cue turned round for the gaps that meet a ball on (every
    //      tier: pro a degree at a time, easy every 6°)
    // The break-off is a script per reds count (snooker-break-tune.js), checked in a trial
    // or two, with a local search as the fallback. Pure and time-sliced like paPlan: each
    // tier caps its trials (one shot to rest, 5–8 ms at 22 balls), and that is its time.

    // aim / power: execution σ (degrees, fraction); top: candidates played out; keep: how
    // many survivors get the spin × pace search; refine: aim corrections; robust: noisy
    // replays of the best lines; safeTrials: safeties tried; gamma: what position is worth;
    // miss: how much the leave on a miss counts; attack: points of bias toward the pot over
    // the safety; safeBelow: look for a safety when the best pot's p is under it; trials:
    // the cap on shots played out; maxMs: the thinking time, once a legal shot is in hand (the
    // worst positions, a sweep and a full safety search, would run on well past it). Picked
    // (not by Adaptive), hard calls the colours and pro
    // every ball (lockCall).
    const PA_SN_TIERS = {
        easy:   { label: 'Easy',   aim: 0.28, power: 0.10,  top: 5,  keep: 1, refine: 1, spins: ['stun'], speeds: [1],
                  robust: 0, safeTrials: 8,  gamma: 0,   miss: 0.2, attack: 3,   safeBelow: 0.1,  trials: 16,  maxMs: 250,  sweepStep: 6 },
        normal: { label: 'Normal', aim: 0.12, power: 0.05,  top: 8,  keep: 2, refine: 1, spins: ['stun', 'follow', 'draw'], speeds: [1, 1.3],
                  robust: 2, safeTrials: 12, gamma: 0.5, miss: 0.6, attack: 1,   safeBelow: 0.5,  trials: 36,  maxMs: 600,  sweepStep: 3 },
        hard:   { label: 'Hard',   aim: 0.05, power: 0.025, top: 12, keep: 3, refine: 2, spins: ['stun', 'follow', 'draw', 'left', 'right'], speeds: [0.8, 1, 1.3],
                  robust: 3, safeTrials: 20, gamma: 0.8, miss: 1,   attack: 0.3, safeBelow: 0.7,  trials: 70,  maxMs: 1000, sweepStep: 1.5, call: 'colours' },
        pro:    { label: 'Pro',    aim: 0.02, power: 0.012, top: 14, keep: 4, refine: 2,
                  spins: ['stun', 'follow', 'draw', 'left', 'right', 'followLeft', 'followRight', 'drawLeft', 'drawRight'], speeds: [0.8, 1, 1.3],
                  robust: 3, safeTrials: 28, gamma: 1,   miss: 1,   attack: 0,   safeBelow: 0.8,  trials: 120, maxMs: 1400, sweepStep: 1, call: 'all' },
    };
    const PA_SN_NAMES = ['easy', 'normal', 'hard', 'pro'];
    // What a steady club player's odds are: candidates are ordered, and leaves judged, by it.
    const PA_SN_RANK = 0.12 * PA_DEG;
    // The break-off (snooker-break-tune.js): the cue ball placed at (x, y·side) in the D, the
    // back red on that side taken `off` R wide of its centre, at `speed`, with the tip at
    // (tipX·side, tipY). side is the cue ball's side of the table, so each has its mirror.
    const PA_SN_BREAKS = {
        // snooker-break-tune.js, 2026-09-30: no foul on 4 racks × ±0.1° × both sides for each.
        15: { x: -305, y: 45, off: 1.6, speed: 1100, tipX: 0, tipY: 0 },
        10: { x: -305, y: 30, off: 1.6, speed: 1250, tipX: 0, tipY: 0 },
        6:  { x: -335, y: 15, off: 1.45, speed: 1250, tipX: 0, tipY: 0 },
    };

    // Where to send a ball into snooker's pocket p: a little in from the hole's centre.
    function paSnAimPoint(p) {
        const k = 0.35 * p.r;
        return p.kind === 'corner' ? { x: p.x - p.sx * k / Math.SQRT2, y: p.y - p.sy * k / Math.SQRT2 } : { x: p.x, y: p.y - p.sy * k };
    }
    // How far off line a ball arriving along (dx, dy) can be and still drop, as S1 measured
    // (snooker-verify §1): a corner takes about ±3 u down its diagonal and still takes a ball
    // rolled along the cushion; a middle pocket ±4 square on, closing fast as the angle opens.
    function paSnPocketTol(p, dx, dy) {
        const L = Math.hypot(dx, dy) || 1;
        if (p.kind === 'corner') {
            const c = (dx * p.sx + dy * p.sy) / (Math.SQRT2 * L);
            return c < Math.cos(55 * PA_DEG) ? 0 : 3.2 * (0.35 + 0.65 * c);
        }
        const c = dy * p.sy / L;
        return c < Math.cos(62 * PA_DEG) ? 0 : 4 * Math.pow(c, 4);
    }
    // What potting the ball on is worth now, and a little for what it opens (a red leads to
    // a colour).
    function paSnPoints(frame, id) {
        if (frame.freeBall) return frame.phase === 'clearance' ? frame.next : 1;
        if (frame.phase === 'reds') return 1;
        if (frame.phase === 'colour') return psValue(id);
        return frame.next;
    }
    const paSnFollow = frame => (frame.phase === 'reds' && !frame.freeBall ? 2.5 : frame.phase === 'clearance' ? 0.4 * Math.min(7, frame.next + 1) : 0);

    // Every direct pot from (cx, cy), best first by a steady player's odds: the ball on (or
    // each colour that may be nominated, with that nomination) into each pocket that faces
    // it, through clear paths. p is the make probability at `sigma`.
    function paSnCandidates(world, frame, cx, cy, sigma) {
        const R = world.cfg.ballR, t = world.table, cfg = world.cfg, gap = 2 * R - 0.05, out = [];
        const st = psStatus(frame, world, frame.turn, -1);
        const ids = st.on.needsNomination ? st.nominable : st.on.ids;
        for (const id of ids) {
            const b = world.balls.find(o => o.id === id);
            if (!b || b.state === 'pocketed') continue;
            const points = paSnPoints(frame, id);
            t.pockets.forEach((p, pi) => {
                const ap = paSnAimPoint(p);
                const tx = ap.x - b.x, ty = ap.y - b.y, tl = Math.hypot(tx, ty);
                const tol = paSnPocketTol(p, tx, ty);
                if (tol <= 0) return;
                const gx = b.x - tx / tl * 2 * R, gy = b.y - ty / tl * 2 * R;
                const ax = gx - cx, ay = gy - cy, al = Math.hypot(ax, ay);
                if (al < 1) return;
                const cut = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (al * tl))));
                if (cut > 75 * PA_DEG) return;
                if (!paClear(world.balls, cx, cy, gx, gy, [0, b.id], gap) || !paClear(world.balls, b.x, b.y, ap.x, ap.y, [0, b.id], gap)) return;
                const rank = paMakeProb(al, cut, tl, tol, PA_SN_RANK, R), p1 = sigma === PA_SN_RANK ? rank : paMakeProb(al, cut, tl, tol, sigma, R);
                if (rank < 0.01 && p1 < 0.05) return;
                out.push({
                    kind: 'direct', ball: b.id, pocket: pi, nominate: st.on.needsNomination ? b.id : -1, points,
                    angle: Math.atan2(ay, ax), gx, gy, dcg: al, cut, lop: tl, want: Math.atan2(ty, tx), tol,
                    p: p1, rank, speed: paBaseSpeed(cfg, al, cut, tl) * 0.9,
                });
            });
        }
        return out.sort((a, b) => b.rank * (b.points + 1) - a.rank * (a.points + 1));
    }

    // The best pot `seat` would have from where the cue ball lies (or anywhere in the D with
    // it in hand), in points expected at a steady player's odds: what a leave is worth to
    // whoever is at the table next. The cue ball tight on a cushion is harder to cue: 0.75.
    // two: the best and half the second (a leave with a choice is worth more to a break).
    function paSnLeave(world, frame, two) {
        if (frame.over) return 0;
        const cue = world.balls.find(b => b.id === 0), R = world.cfg.ballR, t = world.table;
        const best = (x, y) => {
            const vals = paSnCandidates(world, frame, x, y, PA_SN_RANK).map(c => c.rank * (c.points + paSnFollow(frame))).sort((a, b) => b - a);
            return (vals[0] || 0) + (two ? 0.5 * (vals.find((v, i) => i > 0) || 0) : 0);
        };
        if (frame.ballInHand === 'D' || !cue || cue.state === 'pocketed') {
            let m = 0;
            [[-300, 0], [-320, 40], [-320, -40], [-340, 60], [-340, -60], [-360, 0]].forEach(([x, y]) => { if (!prCanPlace(world, x, y, 'D')) m = Math.max(m, best(x, y)); });
            return m;
        }
        const tight = t.halfLength - Math.abs(cue.x) < R + 5 || t.halfWidth - Math.abs(cue.y) < R + 5;
        return best(cue.x, cue.y) * (tight ? 0.75 : 1);
    }

    // Is the next player snookered on everything they are on?
    function paSnSnookered(world, frame) {
        if (frame.over || frame.ballInHand === 'D') return false;
        const st = psStatus(frame, world, frame.turn, -1), ids = st.on.needsNomination ? st.nominable : st.on.ids;
        return ids.length > 0 && psSnookered(world.balls, world.cfg.ballR, ids, 'full');
    }

    // How good a break-off (or any safety) left the table: the opponent's leave, the cue ball
    // back in baulk. Shared with snooker-break-tune.js.
    function paSnBreakScore(r) {
        if (r.v.foul) return -100;
        const cue = r.w.balls.find(b => b.id === 0);
        const home = cue && cue.state !== 'pocketed' && cue.x < PS_BAULK_X ? 3 : 0;
        const deep = cue && cue.state !== 'pocketed' ? (cue.x + r.w.table.halfLength) / 100 : 5;
        return home - deep - 3 * paSnLeave(r.w, r.v.next);
    }

    // opts: { tier, rng, noise (default true), aimDeg / powerFrac (override the tier's
    // execution noise, for snooker-balance.js's human models), safeRun (safeties in a row:
    // from 3 the CPU leans to the pot, so frames do not stall), timeCap (default true: stop at
    // the tier's maxMs once something legal is found; snooker-balance.js turns it off so its
    // numbers do not depend on the machine) }. job.shot = { angle, speed,
    // tipX, tipY, nominate, call }; job.plan: 'break' | 'pot' | 'safety' | 'escape' | 'fallback'.
    function paSnPlan(world, frame, opts) {
        const o = opts || {}, cfg = world.cfg, R = cfg.ballR, seat = frame.turn;
        const tier = PA_SN_TIERS[o.tier] ? o.tier : 'normal', T = PA_SN_TIERS[tier];
        const cue = world.balls.find(b => b.id === 0);
        const f0 = Object.assign({}, frame, { touching: psTouching(world.balls, R) });
        const st = psStatus(f0, world, seat, -1);
        const callOf = pocket => (st.callRequired ? pocket : -1);
        const job = { done: false, shot: null, tried: 0, plan: '', kind: '', tier, ev: 0, ms: 0 };
        const noisy = o.noise !== false && !!o.rng;
        const aimSig = (o.aimDeg !== undefined ? o.aimDeg : T.aim) * PA_DEG, powSig = o.powerFrac !== undefined ? o.powerFrac : T.power;
        const clampSpeed = v => Math.max(150, Math.min(cfg.maxSpeed, v));
        const finish = (shot, plan, kind, ev) => {
            const s = Object.assign({ tipX: 0, tipY: 0, nominate: -1, call: -1 }, shot);
            if (noisy) { s.angle += paGauss(o.rng) * aimSig; s.speed = clampSpeed(s.speed * (1 + paGauss(o.rng) * powSig)); }
            job.shot = s; job.plan = plan; job.kind = kind || plan; job.ev = ev || 0; job.done = true;
        };
        const trial = shot => {
            const w = ppCloneWorld(world);
            w.log = [];
            ppStrike(w, shot);
            ppSimulate(w, 40);
            job.tried++;
            return { w, v: psJudge(f0, w, shot.nominate === undefined ? -1 : shot.nominate, shot.call === undefined ? -1 : shot.call) };
        };
        const jitter = shot => Object.assign({}, shot, { angle: shot.angle + paGauss(o.rng) * aimSig, speed: clampSpeed(shot.speed * (1 + paGauss(o.rng) * powSig)) });
        const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        const onIds = st.on.needsNomination ? st.nominable : st.on.ids;
        const nomFor = id => (st.on.needsNomination && st.nominable.indexOf(id) >= 0 ? id : -1);
        const nearPocket = b => world.table.pockets.reduce((bi, p, pi, all) => (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(all[bi].x - b.x, all[bi].y - b.y) ? pi : bi), 0);

        // ── The break-off: the script for the reds count, then a local search round it.
        if (frame.isBreak) {
            const S0 = PA_SN_BREAKS[frame.reds] || PA_SN_BREAKS[15];
            const side = cue.y >= 0 ? 1 : -1;
            const reds = world.balls.filter(b => psIsRed(b.id) && b.state !== 'pocketed');
            const back = reds.reduce((a, b) => (b.x > a.x + 1 || (Math.abs(b.x - a.x) <= 1 && b.y * side > a.y * side) ? b : a), reds[0]);
            const shotOf = (off, speed, tipX, tipY) => ({ angle: Math.atan2(back.y + side * off * R - cue.y, back.x - cue.x), speed, tipX: tipX * side, tipY, nominate: -1, call: -1 });
            const queue = [shotOf(S0.off, S0.speed, S0.tipX, S0.tipY)];
            [[0.1, 1], [-0.1, 1], [0, 1.1], [0, 0.9], [0.2, 1], [-0.2, 1], [0.1, 1.1], [-0.1, 0.9]].forEach(([d, k]) => queue.push(shotOf(S0.off + d, S0.speed * k, S0.tipX, S0.tipY)));
            let best = null;
            job.step = budgetMs => {
                const t0 = now();
                while (queue.length && job.tried < 24) {
                    const s = queue.shift(), r = trial(s), sc = paSnBreakScore(r);
                    if (!best || sc > best.sc) best = { s, sc };
                    // The script (or a near neighbour) is good: legal, the cue ball home, little on.
                    if (best.sc > 0.5 && job.tried <= 2) break;
                    if (budgetMs !== undefined && now() - t0 >= budgetMs && queue.length) return false;
                }
                finish(best.s, 'break', 'break', best.sc);
                return true;
            };
            return job;
        }

        const snookered = psSnookered(world.balls, R, onIds, 'full');
        const cands = snookered ? [] : paSnCandidates(world, f0, cue.x, cue.y, Math.max(aimSig, 0.02 * PA_DEG)).slice(0, T.top);
        const pen = id => Math.min(7, Math.max(4, psValue(id)));
        const good = [], variants = [], scored = [], robustQ = [], safeties = [], safeScored = [], safeQ = [], sweep = [], escapes = [];
        let stage = cands.length ? 'A' : 'S0', bestPot = null, bestSafe = null, bestEscape = null, swept = false;
        const attack = T.attack + ((o.safeRun || 0) >= 3 ? 2 : 0);
        const budgetLeft = reserve => job.tried < T.trials - reserve;

        // A pot's value on the table after it: points, and what the next shot is worth.
        const potEV = (c, r) => {
            const v = r.v;
            if (v.frameOver) return v.winner === seat ? 1000 : -1000;
            if (v.foul || !v.continues) return null;
            return v.points + T.gamma * paSnLeave(r.w, v.next, T.pos2);
        };
        const safeEV = r => {
            const v = r.v;
            if (v.frameOver) return v.winner === seat ? 1000 : -1000;
            if (v.foul) return -(v.penalty + 3) - paSnLeave(r.w, v.next);
            if (v.continues) return v.points + T.gamma * paSnLeave(r.w, v.next);
            return -paSnLeave(r.w, v.next) + (paSnSnookered(r.w, v.next) ? 1.5 : 0);
        };
        // Safeties: the three nearest balls on, full, half and thin either side, four paces;
        // then one-rail kicks at them when the direct way is blocked.
        const makeSafeties = () => {
            const mu = cfg.muRoll * cfg.gravity;
            const tg = world.balls.filter(b => onIds.indexOf(b.id) >= 0 && b.state !== 'pocketed')
                .sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y)).slice(0, 3);
            const direct = [], rest = [];
            tg.forEach(b => {
                const dist = Math.hypot(b.x - cue.x, b.y - cue.y), base = Math.atan2(b.y - cue.y, b.x - cue.x);
                const clear = paClear(world.balls, cue.x, cue.y, b.x, b.y, [0, b.id], 2 * R - 0.05);
                // Each contact on its own line: the cue ball's path to where it meets the ball, so a
                // half-ball or thin contact past a ball in the way still counts.
                const open = off => {
                    const s = dist * Math.sin(off), t = dist * Math.cos(off) - Math.sqrt(Math.max(0, 4 * R * R - s * s)), a = base + off;
                    return t > 0 && paClear(world.balls, cue.x, cue.y, cue.x + t * Math.cos(a), cue.y + t * Math.sin(a), [0, b.id], 2 * R - 0.05);
                };
                const half = Math.asin(Math.min(1, R / Math.max(dist, 2 * R))), thin = Math.asin(Math.min(0.97, 1.8 * R / Math.max(dist, 2 * R)));
                const pace = k => clampSpeed(k * 1.4 * Math.sqrt(2 * mu * (dist + 500)));
                [[0, 0.6], [half, 0.6], [-half, 0.6], [thin, 0.8], [-thin, 0.8]].forEach(([off, k]) => { if (open(off)) direct.push({ angle: base + off, speed: pace(k), nominate: nomFor(b.id), call: callOf(nearPocket(b)) }); });
                [[0, 0.9], [half, 0.9], [-half, 0.9], [thin, 0.5], [-thin, 0.5], [0, 0.4], [half, 1.2], [-half, 1.2]].forEach(([off, k]) => { if (open(off)) rest.push({ angle: base + off, speed: pace(k), nominate: nomFor(b.id), call: callOf(nearPocket(b)) }); });
                const t = world.table;
                [['x', t.halfLength - R], ['x', -(t.halfLength - R)], ['y', t.halfWidth - R], ['y', -(t.halfWidth - R)]].forEach(([axis, v]) => {
                    const m = axis === 'x' ? { x: 2 * v - b.x, y: b.y } : { x: b.x, y: 2 * v - b.y };
                    const da = axis === 'x' ? v - cue.x : v - cue.y, dm = axis === 'x' ? m.x - cue.x : m.y - cue.y;
                    if (Math.abs(dm) < 1e-9 || da / dm <= 0 || da / dm >= 1) return;
                    const k = da / dm, hx = cue.x + (m.x - cue.x) * k, hy = cue.y + (m.y - cue.y) * k;
                    if (!paClear(world.balls, cue.x, cue.y, hx, hy, [0], 2 * R - 0.05) || !paClear(world.balls, hx, hy, b.x, b.y, [0, b.id], 2 * R - 0.05)) return;
                    const len = Math.hypot(hx - cue.x, hy - cue.y) + Math.hypot(b.x - hx, b.y - hy);
                    [1, 1.4].forEach(q => (clear ? rest : direct).push({ angle: Math.atan2(hy - cue.y, hx - cue.x), speed: clampSpeed(q * 1.4 * Math.sqrt(2 * mu * (len / 0.8 + 300))), nominate: nomFor(b.id), call: callOf(nearPocket(b)) }));
                });
            });
            direct.concat(rest).slice(0, T.safeTrials).forEach(s => safeties.push(s));
        };

        const capped = t0 => o.timeCap !== false && job.ms + now() - t0 >= T.maxMs && (bestPot || bestSafe || bestEscape || good.length || scored.length);
        job.step = budgetMs => {
            if (job.done) return true;
            const t0 = now();
            const spent = () => budgetMs !== undefined && now() - t0 >= budgetMs;
            try {
            while (!spent()) {
                // Out of time with something legal in hand: value what is scored, and choose.
                if (capped(t0) && stage !== 'done') { if (!bestPot && scored.length && (stage === 'A' || stage === 'B' || stage === 'R')) { stage = 'P'; } else if (stage !== 'P') stage = 'done'; }
                if (stage === 'A') {
                    // A: does the line pot, fairly, with stun at its base pace?
                    const c = cands.shift();
                    if (!c || !budgetLeft(3 * T.robust + T.safeTrials)) {
                        stage = 'B';
                        good.sort((a, b) => b.ev - a.ev).slice(0, T.keep).forEach(g => T.spins.forEach(sp => T.speeds.forEach(k => {
                            if (sp === 'stun' && k === 1) return;             // played in A
                            variants.push({ c: g.c, base: g.shot, sp, k });
                        })));
                        good.forEach(g => scored.push({ c: g.c, shot: g.shot, ev0: g.ev }));
                        continue;
                    }
                    let shot = { angle: c.angle, speed: c.speed, tipX: 0, tipY: 0, nominate: c.nominate, call: callOf(c.pocket) };
                    shot = paRefine(world, c, shot, T.refine, R);
                    const r = trial(shot), ev = potEV(c, r);
                    if (r.v.frameOver && r.v.winner === seat) { finish(shot, 'pot', 'direct', 1000); return true; }
                    if (ev !== null) good.push({ c, shot, ev });
                } else if (stage === 'B') {
                    // B: the survivors with the tier's spins and paces, for position.
                    const item = variants.shift();
                    if (!item || !budgetLeft(3 * T.robust + (T.safeBelow > 0 ? T.safeTrials : 0))) {
                        scored.sort((a, b) => b.c.p * b.ev0 - a.c.p * a.ev0);
                        if (T.robust && noisy && scored.length) {
                            scored.slice(0, 3).forEach(e => { e.fouls = 0; e.miss = 0; e.missLeave = 0; e.n = 0; for (let i = 0; i < T.robust; i++) robustQ.push(e); });
                            stage = 'R';
                        } else stage = 'P';
                        continue;
                    }
                    const tip = PA_TIPS[item.sp];
                    let shot = { angle: item.base.angle, speed: Math.min(cfg.maxSpeed * 0.9, item.c.speed * item.k), tipX: tip.x, tipY: tip.y, nominate: item.c.nominate, call: callOf(item.c.pocket) };
                    shot = paRefine(world, item.c, shot, Math.min(1, T.refine), R);
                    const ev = potEV(item.c, trial(shot));
                    if (ev !== null) scored.push({ c: item.c, shot, ev0: ev });
                } else if (stage === 'R') {
                    // R: the best lines with the tier's noise: fouls, and the leave on a miss.
                    const e = robustQ.shift();
                    if (!e) { stage = 'P'; continue; }
                    const r = trial(jitter(e.shot));
                    e.n++;
                    if (r.v.foul) e.fouls++;
                    else if (!r.v.continues) { e.miss++; e.missLeave += paSnLeave(r.w, r.v.next); }
                } else if (stage === 'P') {
                    // The pots, valued: p·(points + γ·position) − (1−p)·leave − fouls·(penalty + 3).
                    scored.forEach(e => {
                        const p = e.c.p, M = e.miss ? e.missLeave / e.miss : 2.5, f = e.n ? e.fouls / e.n : 0;
                        e.ev = p * e.ev0 - (1 - p) * T.miss * M - f * (pen(e.c.ball) + 3);
                        if (!bestPot || e.ev > bestPot.ev) bestPot = e;
                    });
                    stage = !bestPot || bestPot.c.p < T.safeBelow ? 'S0' : 'done';
                } else if (stage === 'S0') {
                    makeSafeties();
                    stage = 'S';
                } else if (stage === 'S') {
                    const shot = safeties.shift();
                    if (!shot || (!budgetLeft(0) && bestSafe)) {
                        // Refine the best: a hair either way, a little firmer and softer.
                        if (bestSafe && budgetLeft(-4)) [[0.4, 1], [-0.4, 1], [0, 1.12], [0, 0.88]].forEach(([d, k]) => safeQ.push({ refine: true, shot: Object.assign({}, bestSafe.shot, { angle: bestSafe.shot.angle + d * PA_DEG, speed: clampSpeed(bestSafe.shot.speed * k) }) }));
                        stage = 'SF';
                        continue;
                    }
                    const r = trial(shot), ev = safeEV(r);
                    safeScored.push({ shot, ev, foul: !!r.v.foul });
                    if (!r.v.foul && (!bestSafe || ev > bestSafe.ev)) bestSafe = { shot, ev };
                } else if (stage === 'SF') {
                    const item = safeQ.shift();
                    if (!item) {
                        // The best safety replayed with the tier's noise: one that fouls a little off is no safety.
                        if (bestSafe && noisy && T.robust) { bestSafe.n = 0; bestSafe.fouls = 0; for (let i = 0; i < T.robust; i++) safeQ.push({ check: true }); stage = 'SR'; }
                        else stage = 'done';
                        continue;
                    }
                    const r = trial(item.shot), ev = safeEV(r);
                    if (!r.v.foul && ev > bestSafe.ev) bestSafe = { shot: item.shot, ev };
                } else if (stage === 'SR') {
                    const item = safeQ.shift();
                    if (!item) { if (bestSafe.n) bestSafe.ev -= (bestSafe.fouls / bestSafe.n) * 6; stage = 'done'; continue; }
                    const r = trial(jitter(bestSafe.shot));
                    bestSafe.n++;
                    if (r.v.foul) bestSafe.fouls++;
                } else if (stage === 'K') {
                    // The sweep: the first ball met, a degree at a time.
                    const n = Math.round(360 / T.sweepStep), a = sweep.length;
                    if (a < n) { sweep.push(onIds.indexOf(paFirstContact(world, { angle: a * T.sweepStep * PA_DEG, speed: 1600, tipX: 0, tipY: 0 })) >= 0); continue; }
                    const gaps = [], start = sweep.indexOf(false);
                    if (start === -1) gaps.push({ mid: 0, n });
                    else for (let i = 1, run = 0; i <= n; i++) {
                        const at = (start + i) % n;
                        if (sweep[at] && i < n) { run++; continue; }
                        if (run) gaps.push({ mid: at - 1 - (run - 1) / 2, n: run });
                        run = 0;
                    }
                    gaps.sort((x, y) => y.n - x.n).slice(0, 8).forEach(g => [1100, 1800].forEach(sp => escapes.push({ angle: g.mid * T.sweepStep * PA_DEG, speed: sp, tipX: 0, tipY: 0, nominate: -1, call: -1 })));
                    stage = 'K2';
                } else if (stage === 'K2') {
                    const shot = escapes.shift();
                    if (!shot) { stage = 'done'; continue; }
                    // What it met first decides the nomination; played out as a safety.
                    const first = paFirstContact(world, shot);
                    const s = Object.assign({}, shot, { nominate: nomFor(first), call: first > 0 ? callOf(nearPocket(world.balls.find(b => b.id === first))) : -1 });
                    const r = trial(s);
                    if (r.v.foul) continue;
                    const ev = safeEV(r);
                    if (!bestEscape || ev > bestEscape.ev) bestEscape = { shot: s, ev };
                } else {
                    // Snookered with nothing legal found: the sweep before a roll.
                    if (!bestPot && !bestSafe && !swept) { swept = true; stage = 'K'; continue; }
                    if (bestPot && (!bestSafe || bestPot.ev + attack >= bestSafe.ev)) finish(bestPot.shot, 'pot', bestPot.c.kind, bestPot.ev);
                    else if (bestSafe) finish(bestSafe.shot, 'safety', 'safety', bestSafe.ev);
                    else if (bestEscape) finish(bestEscape.shot, 'escape', 'safety', bestEscape.ev);
                    else if (good.length) finish(good[0].shot, 'pot', good[0].c.kind, good[0].ev);
                    else {
                        // Nothing clean: roll up to the nearest ball on.
                        const b = world.balls.filter(x => onIds.indexOf(x.id) >= 0 && x.state !== 'pocketed').sort((x, y) => Math.hypot(x.x - cue.x, x.y - cue.y) - Math.hypot(y.x - cue.x, y.y - cue.y))[0];
                        finish(b ? { angle: Math.atan2(b.y - cue.y, b.x - cue.x), speed: 800, nominate: nomFor(b.id), call: callOf(nearPocket(b)) } : { angle: 0, speed: 800 }, 'fallback', 'safety');
                    }
                    return true;
                }
            }
            return false;
            } finally { job.ms += now() - t0; }
        };
        return job;
    }

    // Ball in hand in the D: for the break-off, the script's spot on a side of the D; else
    // the point on a grid over the D with the best pot from it, else the break-off spot.
    function paSnPlace(world, frame, rng) {
        const S0 = PA_SN_BREAKS[frame.reds] || PA_SN_BREAKS[15];
        if (frame.isBreak) {
            const side = rng && rng() < 0.5 ? -1 : 1;
            return !prCanPlace(world, S0.x, S0.y * side, 'D') ? [S0.x, S0.y * side] : psCueHome(world);
        }
        let best = null;
        for (let x = PS_BAULK_X - 3; x >= PS_BAULK_X - PS_D_R; x -= 9) {
            for (let y = -PS_D_R; y <= PS_D_R; y += 9) {
                if (prCanPlace(world, x, y, 'D')) continue;
                const c = paSnCandidates(world, frame, x, y, PA_SN_RANK)[0];
                const s = c ? c.rank * (c.points + 0.5) : 0;
                if (c && (!best || s > best.s)) best = { x, y, s };
            }
        }
        return best ? [best.x, best.y] : psCueHome(world);
    }

    // After a foul against it: a free ball when it has one and a pot to play with it; else
    // play on when there is a pot or a fair hit, and put the offender back in when the
    // table is worse for whoever is at it (snookered, nothing on).
    function paSnChoose(frame, world) {
        const p = frame.pending;
        if (!p) return 'play';
        const as = id => psChoose(frame, id);
        const mine = id => paSnLeave(world, as(id));
        if (p.options.indexOf('free') >= 0 && mine('free') >= 0.3) return 'free';
        const play = mine('play'), stuck = paSnSnookered(world, as('play'));
        if (p.options.indexOf('back') >= 0 && (stuck || play < 0.15) && !(p.options.indexOf('free') >= 0)) return 'back';
        return p.options.indexOf('free') >= 0 && stuck ? 'free' : 'play';
    }

    // Does the CPU give the frame away (POOL_V2_PLAN.md, Snooker, implementer's calls)? Easy
    // never; normal in the clearance needing more than 2 snookers; hard and pro in the
    // clearance needing more than 1, or more than 2 with 3 reds or fewer left.
    function paSnConcede(frame, world, tier) {
        if (tier === 'easy' || frame.over || frame.isBreak) return false;
        const live = world.balls.filter(b => b.id !== 0 && b.state !== 'pocketed').map(b => b.id);
        const need = psSnookersRequired(frame, live, frame.turn), reds = live.filter(psIsRed).length;
        if (tier === 'normal') return frame.phase === 'clearance' && need > 2;
        return (frame.phase === 'clearance' && need > 1) || (reds <= 3 && need > 2);
    }
