    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — CPU (v2)
    // ═══════════════════════════════════════════════════════════════════
    // Four tiers on one planner:
    //   1  geometric candidates (direct, one-rail banks and kicks, two-ball
    //      combos), each with a make probability for the tier's aim error
    //   2  the best are played out on a cloned world and judged by prJudge, so
    //      scratches, fouls and early 8s are dropped unhit; the aim is first
    //      corrected for throw and squirt from the object ball's real departure
    //   3  survivors are tried with the tier's spins and speeds, scored on the
    //      best next shot from where the cue ball stops (pro: the best two)
    //   4  when no pot is likely enough, the safety that leaves the least
    //   5  execution noise per tier
    // Time-sliced: paPlan() returns a job; job.step(ms) works until the budget
    // is spent (a full trial is one shot to rest, about 3 ms).

    const PA_DEG = Math.PI / 180;
    // Tip offsets, in R (follow +y, right +x).
    const PA_TIPS = {
        stun: { x: 0, y: 0 }, follow: { x: 0, y: 0.35 }, draw: { x: 0, y: -0.45 },
        left: { x: -0.3, y: 0 }, right: { x: 0.3, y: 0 },
        followLeft: { x: -0.25, y: 0.3 }, followRight: { x: 0.25, y: 0.3 },
        drawLeft: { x: -0.25, y: -0.35 }, drawRight: { x: 0.25, y: -0.35 },
    };
    // aim: σ in degrees on direct pots, aimAlt on banks, kicks and combos; power: σ
    // as a fraction. top: candidates played out; keep: survivors given the spin ×
    // speed search; refine: aim corrections. safeBelow: play safe when the best
    // pot's make probability is under it. robust: the top three lines are replayed
    // this many times with the tier's noise, marking down any that foul or lose
    // when missed (zero-noise tiers play what they verified); robustSafe: the same
    // for safeties and escapes. sweep: with no pot or legal safety, turn the cue
    // round in 1° steps and play out the middle of each legal-first-hit gap.
    const PA_TIERS = {
        easy:   { label: 'Easy',   desc: 'Takes simple pots · misses often',     top: 4,  keep: 1, refine: 0, spins: ['stun'], speeds: [1],
                  position: 0, bank: false, kick: false, combo: false, safeBelow: 0,    aim: 1.2, aimAlt: 1.8, power: 0.12 },
        normal: { label: 'Normal', desc: 'Solid potting · little position play', top: 10, keep: 3, refine: 1, spins: ['stun', 'follow', 'draw'], speeds: [1, 1.4],
                  position: 1, bank: true,  kick: false, combo: false, safeBelow: 0.25, aim: 0.5, aimAlt: 0.8, power: 0.06, robust: 2 },
        hard:   { label: 'Hard',   desc: 'Plays position · rarely leaves a shot', top: 20, keep: 4, refine: 2, spins: ['stun', 'follow', 'draw', 'left', 'right'], speeds: [1, 1.4],
                  position: 1, bank: true,  kick: true,  combo: true,  safeBelow: 0.4,  aim: 0.2, aimAlt: 0.4, power: 0.02, robust: 3, sweep: true },
        pro:    { label: 'Pro',    desc: 'Hardly misses · call every shot',      top: 24, keep: 5, refine: 2,
                  spins: ['stun', 'follow', 'draw', 'left', 'right', 'followLeft', 'followRight', 'drawLeft', 'drawRight'], speeds: [1, 1.4],
                  position: 2, bank: true,  kick: true,  combo: true,  safeBelow: 0.5,  aim: 0,   aimAlt: 0.15, power: 0.0025, callEvery: true, robustSafe: 3, sweep: true },
    };
    const PA_TIER_NAMES = ['easy', 'normal', 'hard', 'pro'];
    // A hair of error even at zero noise; small, as the planner verifies on the physics it plays.
    const PA_SIGMA_FLOOR = 0.02 * PA_DEG;
    // Candidates are ORDERED as a steady club player would rate them, so every
    // tier tries the easy lines first; DECISIONS use the tier's own error.
    const PA_SIGMA_RANK = 0.35 * PA_DEG;
    const PA_MAX_CUT = 78 * PA_DEG;
    const PA_PLACE_BACK = [110, 170];         // ball in hand: this far behind the ghost ball

    // Standard normal from a uniform rng (Box–Muller).
    function paGauss(rng) {
        const u = Math.max(1e-12, rng()), v = rng();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    // erf, Abramowitz and Stegun 7.1.26 (|error| < 1.5e-7).
    function paErf(x) {
        const s = x < 0 ? -1 : 1; x = Math.abs(x);
        const t = 1 / (1 + 0.3275911 * x);
        const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return s * y;
    }
    const paAngDiff = (a, b) => { let d = a - b; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); return d; };

    // Is a→b clear of every ball not in `skip`? A ball blocks when its centre comes within `gap`.
    function paClear(balls, ax, ay, bx, by, skip, gap) {
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        for (const b of balls) {
            if (b.state === 'pocketed' || skip.indexOf(b.id) !== -1) continue;
            const t = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / L2));
            if (Math.hypot(ax + dx * t - b.x, ay + dy * t - b.y) < gap) return false;
        }
        return true;
    }

    // The balls the shooter may legally hit first, and the ones that count when potted.
    function paTargets(world, frame, seat) {
        const on = world.balls.filter(b => b.id !== 0 && b.state !== 'pocketed');
        const st = prStatusFrom(frame, seat, on.map(b => b.id));
        if (st.onThe8) return on.filter(b => b.id === 8);
        return on.filter(b => b.id !== 8 && (!st.group || prGroupOf(b.id) === st.group));
    }

    // Where to send a ball into pocket p: between the mouth and the hole's centre.
    function paAimPoint(p) {
        const mx = (p.mouth[0] + p.mouth[2]) / 2, my = (p.mouth[1] + p.mouth[3]) / 2;
        return { x: (mx + p.x) / 2, y: (my + p.y) / 2 };
    }
    // How far off line a ball arriving along (dx, dy) can be and still drop;
    // corners forgive more than sides, both less as the approach flattens.
    function paPocketTol(p, dx, dy) {
        const nx = p.kind === 'corner' ? p.sx / Math.SQRT2 : 0, ny = p.kind === 'corner' ? p.sy / Math.SQRT2 : p.sy;
        const c = Math.max(0, (dx * nx + dy * ny) / (Math.hypot(dx, dy) || 1));
        return p.kind === 'corner' ? 11 * (0.55 + 0.45 * c) : Math.max(0, 15 * (c - 0.25) / 0.75);
    }
    // Aim error times the cut's gain (dθ_object / dθ_cue = d / (2R cos cut)),
    // against the pocket's angular tolerance seen from the object ball.
    function paMakeProb(dcg, cut, lop, tol, sigma, R) {
        if (tol <= 0) return 0;
        const gain = dcg / (2 * R * Math.max(0.15, Math.cos(cut)));
        const s = Math.max(sigma, PA_SIGMA_FLOOR) * gain;
        const p = paErf((tol / Math.max(lop, 1)) / (Math.SQRT2 * s));
        return p * (1 - 0.08 * Math.min(1, (dcg + lop) / 1400));
    }

    // Base speed: the object ball reaches the pocket with a little pace left.
    function paBaseSpeed(cfg, dcg, cut, lop) {
        const a = cfg.muRoll * cfg.gravity;
        const vObj = 1.4 * Math.sqrt(200 * 200 + 2 * a * lop);
        const vc = vObj / Math.max(0.2, Math.cos(cut));
        return Math.max(450, Math.min(cfg.maxSpeed * 0.85, 1.4 * Math.sqrt(vc * vc + 2 * a * dcg)));
    }

    // Every pot from (cx, cy), best first.
    function paCandidates(world, frame, seat, cx, cy, tier, directOnly) {
        const T = directOnly ? Object.assign({}, PA_TIERS[tier] || PA_TIERS.normal, { bank: false, kick: false, combo: false }) : (PA_TIERS[tier] || PA_TIERS.normal);
        const R = world.cfg.ballR, t = world.table, cfg = world.cfg, out = [];
        const targets = paTargets(world, frame, seat);
        const sigma = T.aim * PA_DEG, sigmaAlt = T.aimAlt * PA_DEG;
        const gap = 2 * R - 0.5;
        // p: the tier's make probability (decides); rank: a steady player's (orders).
        const odds = (dcg, cut, lop, tol, sig, k) => ({ p: k * paMakeProb(dcg, cut, lop, tol, sig, R), rank: k * paMakeProb(dcg, cut, lop, tol, Math.max(sig, PA_SIGMA_RANK), R) });
        const push = (c) => { if (c.rank > 0.01) out.push(c); };
        const direct = (b, p, pi, fromX, fromY, kind, extra) => {
            const ap = paAimPoint(p);
            const tx = ap.x - b.x, ty = ap.y - b.y, tl = Math.hypot(tx, ty);
            const gx = b.x - tx / tl * 2 * R, gy = b.y - ty / tl * 2 * R;
            const ax = gx - fromX, ay = gy - fromY, al = Math.hypot(ax, ay);
            if (al < 1) return null;
            const cut = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (al * tl))));
            if (cut > PA_MAX_CUT) return null;
            if (!paClear(world.balls, fromX, fromY, gx, gy, [0, b.id].concat(extra || []), gap)) return null;
            if (!paClear(world.balls, b.x, b.y, ap.x, ap.y, [0, b.id].concat(extra || []), gap)) return null;
            return { kind: kind || 'direct', ball: b.id, pocket: pi, angle: Math.atan2(ay, ax), gx, gy, dcg: al, cut, lop: tl,
                want: Math.atan2(ty, tx), tol: paPocketTol(p, tx, ty) };
        };
        // Cushion lines for a ball's centre: x = ±(HL − R), y = ±(HW − R).
        const rails = [{ axis: 'x', v: t.halfLength - R }, { axis: 'x', v: -(t.halfLength - R) }, { axis: 'y', v: t.halfWidth - R }, { axis: 'y', v: -(t.halfWidth - R) }];
        const mirror = (x, y, r) => (r.axis === 'x' ? { x: 2 * r.v - x, y } : { x, y: 2 * r.v - y });
        const railHit = (ax, ay, bx, by, r) => {
            // Where the line from a to b's mirror crosses the rail line, if it does between them.
            const m = mirror(bx, by, r);
            const da = r.axis === 'x' ? r.v - ax : r.v - ay, dm = r.axis === 'x' ? m.x - ax : m.y - ay;
            if (Math.abs(dm) < 1e-9 || da / dm <= 0 || da / dm >= 1) return null;
            const k = da / dm, hx = ax + (m.x - ax) * k, hy = ay + (m.y - ay) * k;
            // Keep clear of the pockets: a bank off a jaw is a guess.
            if (r.axis === 'x' ? Math.abs(hy) > t.halfWidth - 50 : Math.abs(hx) > t.halfLength - 50 || Math.abs(hx) < 45) return null;
            return { x: hx, y: hy, m };
        };

        for (const b of targets) {
            t.pockets.forEach((p, pi) => {
                const d = direct(b, p, pi, cx, cy);
                if (d) { Object.assign(d, odds(d.dcg, d.cut, d.lop, d.tol, sigma, 1)); d.speed = paBaseSpeed(cfg, d.dcg, d.cut, d.lop); push(d); }
                if (T.bank) rails.forEach(r => {
                    // Object ball off one rail into the pocket: aim it at the pocket's mirror.
                    const ap = paAimPoint(p), h = railHit(b.x, b.y, ap.x, ap.y, r);
                    if (!h) return;
                    if (!paClear(world.balls, b.x, b.y, h.x, h.y, [0, b.id], gap) || !paClear(world.balls, h.x, h.y, ap.x, ap.y, [0, b.id], gap)) return;
                    const tx = h.x - b.x, ty = h.y - b.y, tl = Math.hypot(tx, ty);
                    const gx = b.x - tx / tl * 2 * R, gy = b.y - ty / tl * 2 * R;
                    const ax = gx - cx, ay = gy - cy, al = Math.hypot(ax, ay);
                    const cut = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (al * tl))));
                    if (cut > 60 * PA_DEG || !paClear(world.balls, cx, cy, gx, gy, [0, b.id], gap)) return;
                    const lop = tl + Math.hypot(ap.x - h.x, ap.y - h.y);
                    const tol = paPocketTol(p, ap.x - h.x, ap.y - h.y) * 0.7;
                    push({ kind: 'bank', ball: b.id, pocket: pi, angle: Math.atan2(ay, ax), gx, gy, dcg: al, cut, lop, want: Math.atan2(ty, tx), tol,
                        ...odds(al, cut, lop, tol, sigmaAlt, 0.75), speed: paBaseSpeed(cfg, al, cut, tl + (lop - tl) / 0.64) });
                });
                if (T.kick) rails.forEach(r => {
                    // Cue ball off one rail onto the ghost ball.
                    const ap = paAimPoint(p);
                    const tx = ap.x - b.x, ty = ap.y - b.y, tl = Math.hypot(tx, ty);
                    const gx = b.x - tx / tl * 2 * R, gy = b.y - ty / tl * 2 * R;
                    if (!paClear(world.balls, b.x, b.y, ap.x, ap.y, [0, b.id], gap)) return;
                    const h = railHit(cx, cy, gx, gy, r);
                    if (!h || !paClear(world.balls, cx, cy, h.x, h.y, [0], gap) || !paClear(world.balls, h.x, h.y, gx, gy, [0, b.id], gap)) return;
                    const ix = gx - h.x, iy = gy - h.y, il = Math.hypot(ix, iy);
                    const cut = Math.acos(Math.max(-1, Math.min(1, (ix * tx + iy * ty) / (il * tl))));
                    if (cut > 50 * PA_DEG) return;
                    const dcg = Math.hypot(h.x - cx, h.y - cy) + il;
                    push({ kind: 'kick', ball: b.id, pocket: pi, angle: Math.atan2(h.y - cy, h.x - cx), gx, gy, dcg, cut, lop: tl, want: Math.atan2(ty, tx),
                        tol: paPocketTol(p, tx, ty), ...odds(dcg, cut, tl, paPocketTol(p, tx, ty), sigmaAlt, 0.55), speed: paBaseSpeed(cfg, dcg / 0.8, cut, tl) });
                });
                if (T.combo) targets.forEach(a => {
                    // Cue ball → a → b into the pocket. The first ball hit is a, so a must be legal (it is).
                    if (a === b) return;
                    const ap = paAimPoint(p);
                    const tx = ap.x - b.x, ty = ap.y - b.y, tl = Math.hypot(tx, ty);
                    const gbx = b.x - tx / tl * 2 * R, gby = b.y - ty / tl * 2 * R;       // where a must hit b
                    const ux = gbx - a.x, uy = gby - a.y, ul = Math.hypot(ux, uy);
                    if (ul < 1 || ul > 350) return;
                    const cutB = Math.acos(Math.max(-1, Math.min(1, (ux * tx + uy * ty) / (ul * tl))));
                    if (cutB > 35 * PA_DEG) return;
                    const gx = a.x - ux / ul * 2 * R, gy = a.y - uy / ul * 2 * R;
                    const ax = gx - cx, ay = gy - cy, al = Math.hypot(ax, ay);
                    const cutA = Math.acos(Math.max(-1, Math.min(1, (ax * ux + ay * uy) / (al * ul))));
                    if (cutA > 45 * PA_DEG) return;
                    if (!paClear(world.balls, cx, cy, gx, gy, [0, a.id], gap) || !paClear(world.balls, a.x, a.y, gbx, gby, [0, a.id, b.id], gap) ||
                        !paClear(world.balls, b.x, b.y, ap.x, ap.y, [0, a.id, b.id], gap)) return;
                    const oB = odds(ul, cutB, tl, paPocketTol(p, tx, ty), sigmaAlt, 1), oA = odds(al, cutA, ul, 2 * R * 0.35, sigmaAlt, 1);
                    push({ kind: 'combo', ball: a.id, pots: b.id, pocket: pi, angle: Math.atan2(ay, ax), gx, gy, dcg: al, cut: cutA, lop: ul, want: Math.atan2(uy, ux),
                        tol: 2 * R * 0.35, p: 0.8 * oA.p * oB.p, rank: 0.8 * oA.rank * oB.rank, speed: paBaseSpeed(cfg, al, cutA, (ul + tl) / Math.max(0.3, Math.cos(cutB))) });
                });
            });
        }
        return out.sort((a, b) => b.rank - a.rank);
    }

    // The pots left for `seat` from the cue ball (direct only, so cheap): what position is worth.
    function paNextShots(world, frame, seat, tier) {
        const cue = world.balls.find(b => b.id === 0);
        if (!cue || cue.state === 'pocketed') return [];
        // Steady-player ranks: at zero noise every p is near 1, and position means an easy shot.
        return paCandidates(world, frame, seat, cue.x, cue.y, tier === 'pro' ? 'hard' : tier, true).map(c => c.rank);
    }

    // The first ball the cue ball touches on this shot, or -1 (none before it stops).
    function paFirstContact(world, shot) {
        const w = ppCloneWorld(world);
        ppStrike(w, shot);
        for (let i = 0; i < 400; i++) {
            ppStep(w, 1 / 60);
            const hit = w.log.find(e => e.type === 'ball' && (e.a === 0 || e.b === 0));
            if (hit) return hit.a === 0 ? hit.b : hit.a;
            if (ppSettled(w)) return -1;
        }
        return -1;
    }

    // The angle the first object ball actually leaves at, or null.
    function paDeparture(world, shot, ballId) {
        const w = ppCloneWorld(world);
        ppStrike(w, shot);
        const t0 = w.t;
        for (let i = 0; i < 360 && w.t - t0 < 4; i++) {
            ppStep(w, 1 / 60);
            if (w.log.some(e => e.type === 'ball' && (e.a === 0 || e.b === 0))) {
                const hit = w.log.find(e => e.type === 'ball' && (e.a === 0 || e.b === 0));
                const other = hit.a === 0 ? hit.b : hit.a;
                if (other !== ballId) return null;
                const b = w.balls.find(o => o.id === ballId);
                return Math.hypot(b.vx, b.vy) > 1 ? Math.atan2(b.vy, b.vx) : null;
            }
            if (ppSettled(w)) return null;
        }
        return null;
    }
    // Corrects for throw and squirt: the departure error over the cut's gain moves the cue.
    function paRefine(world, cand, shot, n, R) {
        if (cand.kind === 'kick') return shot;
        let s = shot;
        const gain = cand.dcg / (2 * R * Math.max(0.15, Math.cos(cand.cut)));
        for (let i = 0; i < n; i++) {
            const dep = paDeparture(world, s, cand.ball);
            if (dep === null) break;
            const err = paAngDiff(dep, cand.want);
            if (Math.abs(err) < 0.05 * PA_DEG) break;
            // Turning the cue one way sends the object ball the other: dθ_object = −gain · dθ_cue.
            s = Object.assign({}, s, { angle: s.angle + err / gain });
        }
        return s;
    }

    function paTrial(world, frame, seat, shot) {
        const w = ppCloneWorld(world);
        ppStrike(w, shot);
        ppSimulate(w);
        return { w, v: prJudge(frame, w, shot.call) };
    }
    // `p` is the aimed line's make probability; position is the next shot's.
    function paScore(r, seat, tier, p) {
        const v = r.v, T = PA_TIERS[tier];
        if (v.frameOver) return v.winner === seat ? 1e6 : -1e6;
        if (v.foul) return -1000;
        if (!v.continues) return -500;
        let pos = 0;
        if (T.position) {
            const next = paNextShots(r.w, v.next, seat, tier).sort((a, b) => b - a);
            pos = (next[0] || 0) + (T.position > 1 ? 0.5 * (next[1] || 0) : 0);
        }
        return 1000 * p + 300 * pos;
    }
    // A safety's worth: the opponent's best chance after it, as low as possible.
    function paSafetyScore(r, seat) {
        const v = r.v;
        if (v.frameOver) return v.winner === seat ? 1e6 : -1e6;
        if (v.foul) return -1000;
        if (v.continues) return 600;          // a pot on a safety is a bonus
        const opp = 3 - seat;
        const best = Math.max(0, ...paNextShots(r.w, v.next, opp, 'normal'));
        return 400 * (1 - best);
    }

    // opts: { tier, rng, noise (default true), aimDeg / powerFrac (override the tier's
    // execution noise) }. job.shot = { angle, speed, tipX, tipY, call }; job.plan is
    // 'break' | 'pot' | 'safety' | 'escape' | 'fallback'; job.kind the line.
    function paPlan(world, frame, opts) {
        const o = opts || {}, seat = frame.turn, cfg = world.cfg, R = cfg.ballR;
        const tier = PA_TIERS[o.tier] ? o.tier : 'normal', T = PA_TIERS[tier];
        const cue = world.balls.find(b => b.id === 0);
        const st = prStatus(frame, world, seat);
        const job = { done: false, shot: null, tried: 0, plan: '', tier };
        let lineKind = 'direct';
        const finish = (shot, plan) => {
            const s = Object.assign({ tipX: 0, tipY: 0, call: -1 }, shot);
            if (o.noise !== false && o.rng) {
                const aim = (o.aimDeg !== undefined ? o.aimDeg : lineKind === 'direct' ? T.aim : T.aimAlt) * PA_DEG;
                const pw = o.powerFrac !== undefined ? o.powerFrac : T.power;
                s.angle += paGauss(o.rng) * aim;
                s.speed = Math.max(150, Math.min(cfg.maxSpeed, s.speed * (1 + paGauss(o.rng) * pw)));
            }
            job.shot = s; job.plan = plan; job.kind = plan === 'break' ? 'break' : lineKind; job.done = true;
        };

        // The break: near full power at the head ball, never called.
        if (frame.isBreak) {
            const apex = world.balls.filter(b => b.id !== 0 && b.state !== 'pocketed').sort((a, b) => a.x - b.x)[0];
            job.step = () => {
                finish({ angle: Math.atan2(apex.y - cue.y, apex.x - cue.x), speed: cfg.maxSpeed * (tier === 'easy' ? 0.82 : 0.96) }, 'break');
                return true;
            };
            return job;
        }

        const cands = paCandidates(world, frame, seat, cue.x, cue.y, tier).slice(0, T.top);
        const call = c => (st.callRequired ? c.pocket : -1);
        const legal = new Set(paTargets(world, frame, seat).map(b => b.id));
        const stageA = cands.map(c => ({ c }));
        const good = [], variants = [], safeties = [], scored = [], robustQ = [], safeScored = [], safeQ = [];
        let stage = 'A', bestPot = null, bestSafe = null, bestEscape = null, swept = false;
        const sweep = [], escapes = [];
        const safeReps = T.robustSafe || T.robust;

        // Safeties: each legal ball full and half-ball either side, soft; and one-rail kicks at it.
        const makeSafeties = () => {
            const tg = paTargets(world, frame, seat)
                .sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y)).slice(0, 3);
            tg.forEach(b => {
                const base = Math.atan2(b.y - cue.y, b.x - cue.x), dist = Math.hypot(b.x - cue.x, b.y - cue.y);
                const half = Math.asin(Math.min(1, R / Math.max(dist, 2 * R)));
                [0, half, -half].forEach(off => [0.45, 0.7].forEach(k => {
                    if (!paClear(world.balls, cue.x, cue.y, b.x, b.y, [0, b.id], 2 * R - 0.5)) return;
                    safeties.push({ angle: base + off, speed: Math.max(500, Math.min(1900, k * 1.4 * Math.sqrt(2 * cfg.muRoll * cfg.gravity * (dist + 400)))), call: -1 });
                }));
                const t = world.table;
                [['x', t.halfLength - R], ['x', -(t.halfLength - R)], ['y', t.halfWidth - R], ['y', -(t.halfWidth - R)]].forEach(([axis, v]) => {
                    const m = axis === 'x' ? { x: 2 * v - b.x, y: b.y } : { x: b.x, y: 2 * v - b.y };
                    const da = axis === 'x' ? v - cue.x : v - cue.y, dm = axis === 'x' ? m.x - cue.x : m.y - cue.y;
                    if (Math.abs(dm) < 1e-9 || da / dm <= 0 || da / dm >= 1) return;
                    const k = da / dm, hx = cue.x + (m.x - cue.x) * k, hy = cue.y + (m.y - cue.y) * k;
                    if (!paClear(world.balls, cue.x, cue.y, hx, hy, [0], 2 * R - 0.5) || !paClear(world.balls, hx, hy, b.x, b.y, [0, b.id], 2 * R - 0.5)) return;
                    const ang = Math.atan2(hy - cue.y, hx - cue.x), len = Math.hypot(hx - cue.x, hy - cue.y) + Math.hypot(b.x - hx, b.y - hy);
                    [1.1, 1.5].forEach(q => safeties.push({ angle: ang, speed: Math.min(2400, q * 1.4 * Math.sqrt(2 * cfg.muRoll * cfg.gravity * (len / 0.8 + 300))), call: -1 }));
                });
            });
        };

        const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        job.step = budgetMs => {
            if (job.done) return true;
            const t0 = now();
            const spent = () => budgetMs !== undefined && now() - t0 >= budgetMs;
            while (!spent()) {
                if (stage === 'A') {
                    // Stage A: does the line pot, cleanly, with stun at its base speed?
                    const item = stageA.shift();
                    if (!item) {
                        stage = 'B';
                        good.sort((a, b) => b.c.rank - a.c.rank).slice(0, T.keep).forEach(g => T.spins.forEach(sp => T.speeds.forEach(k => variants.push({ c: g.c, base: g.shot, sp, k }))));
                        continue;
                    }
                    const c = item.c;
                    let shot = { angle: c.angle, speed: c.speed, tipX: 0, tipY: 0, call: call(c) };
                    shot = paRefine(world, c, shot, T.refine, R);
                    const r = paTrial(world, frame, seat, shot);
                    job.tried++;
                    if (r.v.frameOver && r.v.winner === seat) { lineKind = c.kind; finish(shot, 'pot'); return true; }
                    if (!r.v.foul && r.v.continues && !r.v.frameOver) good.push({ c, shot, r });
                } else if (stage === 'B') {
                    // Stage B: the survivors, with the tier's spins and speeds, for position.
                    const item = variants.shift();
                    if (!item) {
                        // Robustness: the best three lines, replayed with the tier's noise.
                        if (T.robust && o.rng && o.noise !== false && scored.length) {
                            scored.sort((a, b) => b.score - a.score).slice(0, 3).forEach(e => { e.bad = 0; e.n = 0; for (let i = 0; i < T.robust; i++) robustQ.push(e); });
                            stage = 'R';
                            continue;
                        }
                        // No pot: every tier looks for an escape; an unlikely pot: safe tiers look for a safety.
                        const needSafe = !bestPot || bestPot.score <= 0 || (T.safeBelow > 0 && bestPot.c.p < T.safeBelow);
                        if (needSafe) { makeSafeties(); stage = 'S'; } else stage = 'done';
                        continue;
                    }
                    const tip = PA_TIPS[item.sp];
                    // From stage A's corrected aim; spin changes throw and squirt, so one more correction.
                    let shot = { angle: item.base.angle, speed: Math.min(cfg.maxSpeed * 0.9, item.c.speed * item.k), tipX: tip.x, tipY: tip.y, call: call(item.c) };
                    shot = paRefine(world, item.c, shot, Math.min(1, T.refine), R);
                    const r = paTrial(world, frame, seat, shot);
                    job.tried++;
                    const score = paScore(r, seat, tier, item.c.p);
                    scored.push({ c: item.c, shot, score });
                    if (!bestPot || score > bestPot.score) bestPot = { c: item.c, shot, score };
                } else if (stage === 'R') {
                    const e = robustQ.shift();
                    if (!e) {
                        // Marked down by how often the line fouls or loses the frame when missed.
                        scored.slice(0, 3).forEach(x => { if (x.n) x.score -= 900 * x.bad / x.n; });
                        bestPot = scored.slice(0, 3).reduce((m, x) => (!m || x.score > m.score ? x : m), null);
                        const needSafe = !bestPot || bestPot.score <= 0 || (T.safeBelow > 0 && bestPot.c.p < T.safeBelow);
                        if (needSafe) { makeSafeties(); stage = 'S'; } else stage = 'done';
                        continue;
                    }
                    const aim = (e.c.kind === 'direct' ? T.aim : T.aimAlt) * PA_DEG;
                    const shot = Object.assign({}, e.shot, { angle: e.shot.angle + paGauss(o.rng) * aim, speed: e.shot.speed * (1 + paGauss(o.rng) * T.power) });
                    const r = paTrial(world, frame, seat, shot);
                    job.tried++;
                    e.n++;
                    if (r.v.foul || (r.v.frameOver && r.v.winner !== seat)) e.bad += r.v.frameOver ? 2 : 1;
                } else if (stage === 'S') {
                    const shot = safeties.shift();
                    if (!shot) {
                        // Replay the best three with noise: one that fouls when slightly off is no safety.
                        if (safeReps && o.rng && o.noise !== false && safeScored.length) {
                            safeScored.sort((a, b) => b.score - a.score).slice(0, 3).forEach(e => { e.bad = 0; e.n = 0; for (let i = 0; i < safeReps; i++) safeQ.push(e); });
                            stage = 'SR';
                        } else stage = 'done';
                        continue;
                    }
                    const r = paTrial(world, frame, seat, shot);
                    job.tried++;
                    const score = paSafetyScore(r, seat);
                    safeScored.push({ shot, score });
                    if (!bestSafe || score > bestSafe.score) bestSafe = { shot, score };
                } else if (stage === 'SR') {
                    const e = safeQ.shift();
                    if (!e) {
                        safeScored.slice(0, 3).forEach(x => { if (x.n) x.score -= 1200 * x.bad / x.n; });
                        bestSafe = safeScored.slice(0, 3).reduce((m, x) => (!m || x.score > m.score ? x : m), null);
                        stage = 'done';
                        continue;
                    }
                    const shot = Object.assign({}, e.shot, { angle: e.shot.angle + paGauss(o.rng) * T.aimAlt * PA_DEG, speed: e.shot.speed * (1 + paGauss(o.rng) * T.power) });
                    const r = paTrial(world, frame, seat, shot);
                    job.tried++;
                    e.n++;
                    if (r.v.foul || (r.v.frameOver && r.v.winner !== seat)) e.bad += r.v.frameOver ? 2 : 1;
                } else if (stage === 'K') {
                    // The sweep: the first ball hit, one degree at a time.
                    const a = sweep.length;
                    if (a < 360) { sweep.push(legal.has(paFirstContact(world, { angle: a * PA_DEG, speed: 1800, tipX: 0, tipY: 0 }))); continue; }
                    // Legal gaps, widest first; each gap's middle forgives the most aim error.
                    const gaps = [];
                    const start = sweep.indexOf(false);
                    if (start === -1) gaps.push({ mid: 0, n: 360 });
                    else for (let i = 1, run = 0; i <= 360; i++) {
                        const at = (start + i) % 360;
                        if (sweep[at] && i < 360) { run++; continue; }
                        if (run) gaps.push({ mid: at - 1 - (run - 1) / 2, n: run });
                        run = 0;
                    }
                    gaps.sort((x, y) => y.n - x.n).slice(0, 10).forEach(g => [1400, 2300].forEach(sp =>
                        escapes.push({ angle: g.mid * PA_DEG, speed: Math.min(cfg.maxSpeed, sp), tipX: 0, tipY: 0, call: -1 })));
                    stage = 'K2';
                } else if (stage === 'K2') {
                    const shot = escapes.shift();
                    if (!shot) { stage = 'done'; continue; }
                    const r = paTrial(world, frame, seat, shot);
                    job.tried++;
                    if (r.v.foul || (r.v.frameOver && r.v.winner !== seat)) continue;
                    const score = paSafetyScore(r, seat);
                    if (!bestEscape || score > bestEscape.score) bestEscape = { shot, score };
                } else {
                    // Nothing pots and no legal safety: sweeping tiers look for an escape first.
                    const settled = (bestPot && bestPot.score > 0) || (bestSafe && bestSafe.score > 0) || good.length;
                    if (!settled && T.sweep && !swept) { swept = true; stage = 'K'; continue; }
                    // A likely pot; else a safety that leaves little; else the best pot; else a
                    // stage A survivor; else an escape; else a roll.
                    const potOk = bestPot && bestPot.score > 0;
                    if (potOk && (bestPot.c.p >= T.safeBelow || !bestSafe || bestSafe.score < 250)) { lineKind = bestPot.c.kind; finish(bestPot.shot, 'pot'); }
                    else if (bestSafe && bestSafe.score > 0) { lineKind = 'safety'; finish(bestSafe.shot, 'safety'); }
                    else if (potOk) { lineKind = bestPot.c.kind; finish(bestPot.shot, 'pot'); }
                    else if (good.length) { lineKind = good[0].c.kind; finish(good[0].shot, 'pot'); }
                    else if (bestEscape) { lineKind = 'safety'; finish(bestEscape.shot, 'escape'); }
                    else {
                        // Nothing clean at all: roll a legal ball, the nearest, softly.
                        const b = paTargets(world, frame, seat).sort((x, y) => Math.hypot(x.x - cue.x, x.y - cue.y) - Math.hypot(y.x - cue.x, y.y - cue.y))[0];
                        const near = b ? world.table.pockets.reduce((m, p, i) => (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(world.table.pockets[m].x - b.x, world.table.pockets[m].y - b.y) ? i : m), 0) : -1;
                        lineKind = 'safety';
                        finish(b ? { angle: Math.atan2(b.y - cue.y, b.x - cue.x), speed: 1200, call: st.callRequired ? near : -1 } : { angle: 0, speed: 1200 }, 'fallback');
                    }
                    return true;
                }
            }
            return false;
        };
        return job;
    }

    // Ball in hand: behind the easiest pot's ghost ball, straight or slightly angled;
    // on the break, mid kitchen.
    function paPlace(world, frame, rng, tier) {
        const t = world.table, R = world.cfg.ballR, zone = frame.ballInHand;
        if (zone === 'kitchen') {
            const y = rng ? (rng() - 0.5) * 120 : 0;
            return [t.headX - 60, y];
        }
        const T = PA_TIERS[tier] || PA_TIERS.normal;
        const sigma = T.aim * PA_DEG;
        let best = null;
        for (const b of paTargets(world, frame, frame.turn)) {
            t.pockets.forEach(p => {
                const ap = paAimPoint(p);
                const tx = ap.x - b.x, ty = ap.y - b.y, tl = Math.hypot(tx, ty), ux = tx / tl, uy = ty / tl;
                const gx = b.x - ux * 2 * R, gy = b.y - uy * 2 * R;
                if (!paClear(world.balls, b.x, b.y, ap.x, ap.y, [0, b.id], 2 * R - 0.5)) return;
                const tol = paPocketTol(p, tx, ty);
                PA_PLACE_BACK.forEach(D => [0, 12, -12].forEach(deg => {
                    const a = Math.atan2(uy, ux) + deg * PA_DEG;
                    const x = gx - Math.cos(a) * D, y = gy - Math.sin(a) * D;
                    if (prCanPlace(world, x, y, zone)) return;
                    if (!paClear(world.balls, x, y, gx, gy, [0, b.id], 2 * R - 0.5)) return;
                    // A slight angle is worth a little: the cue ball can be steered after it.
                    const score = paMakeProb(D, Math.abs(deg) * PA_DEG, tl, tol, sigma, R) + (deg ? 0.02 : 0);
                    if (!best || score > best.score) best = { x, y, score };
                }));
            });
        }
        if (best) return [best.x, best.y];
        // Nowhere clean: the first free spot on a coarse grid.
        for (let x = -400; x <= 400; x += 50) for (let y = -200; y <= 200; y += 50) if (!prCanPlace(world, x, y, zone)) return [x, y];
        return [t.headX - 60, 0];
    }

    // Adaptive difficulty from your record, as Ludo's. Never climbs to pro on its
    // own (pro calls every shot for you too); a pinned tier wins.
    function paAdaptiveTier(rec) {
        const wins = (rec && rec.wins) || 0, losses = (rec && rec.losses) || 0, games = wins + losses;
        if (games < 5) return 'normal';
        const rate = wins / games;
        if (rate < 0.35) return 'easy';
        if (rate <= 0.65) return 'normal';
        return 'hard';
    }
    function paTierFor(pref, rec) {
        return PA_TIERS[pref] ? pref : paAdaptiveTier(rec);
    }
