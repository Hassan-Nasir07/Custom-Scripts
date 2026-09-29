    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — CPU (v2 stand-in)
    // ═══════════════════════════════════════════════════════════════════
    // A deliberately plain opponent so Vs CPU plays on the new engine until
    // the Phase 6 CPU (four tiers, position play, safeties) replaces it:
    //   - direct pots only: every legal ball × pocket, aimed at the ghost
    //     ball, ranked by cut angle and distance
    //   - the best few are played out on a cloned world with the real
    //     physics and judged by prJudge, so a line that scratches, fouls or
    //     drops the 8 early is thrown away before it is ever hit
    //   - execution noise (aim 0.5°, power 6%), so it misses like a decent
    //     club player rather than never
    // Pure. paPlan() returns a job; job.step(ms) does as much work as the
    // budget allows (each trial is one full shot, about 3 ms), so the
    // controller spreads the thinking over animation frames.

    const PA_MAX_CUT = 78 * Math.PI / 180;
    const PA_TRIALS = 8;                       // candidates played out on the real physics
    const PA_SPEEDS = [900, 1500, 2300];       // u/s tried per candidate, softest first
    const PA_AIM_SIGMA = 0.2 * Math.PI / 180;
    const PA_POWER_SIGMA = 0.03;
    const PA_PLACE_BACK = 120;                 // ball in hand: this far behind the ghost ball

    // Standard normal from a uniform rng (Box–Muller).
    function paGauss(rng) {
        const u = Math.max(1e-12, rng()), v = rng();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // Is the straight path from (ax, ay) to (bx, by) clear of every ball but
    // the ones in `skip`? A ball blocks when its centre comes within `gap`.
    function paClear(balls, ax, ay, bx, by, skip, gap) {
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        for (const b of balls) {
            if (b.state === 'pocketed' || skip.indexOf(b.id) !== -1) continue;
            const t = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / L2));
            if (Math.hypot(ax + dx * t - b.x, ay + dy * t - b.y) < gap) return false;
        }
        return true;
    }

    // The balls the shooter may legally hit first.
    function paTargets(world, frame, seat) {
        const on = world.balls.filter(b => b.id !== 0 && b.state !== 'pocketed');
        const st = prStatusFrom(frame, seat, on.map(b => b.id));
        if (st.onThe8) return on.filter(b => b.id === 8);
        return on.filter(b => b.id !== 8 && (!st.group || prGroupOf(b.id) === st.group));
    }

    // Every direct pot from (cx, cy): target × pocket, with its ghost-ball
    // aim, best first. `from` lets ball-in-hand ask about a spot it has not
    // placed yet.
    function paCandidates(world, frame, seat, cx, cy) {
        const R = world.cfg.ballR, out = [];
        for (const b of paTargets(world, frame, seat)) {
            world.table.pockets.forEach((p, pi) => {
                const tx = p.x - b.x, ty = p.y - b.y, tl = Math.hypot(tx, ty);
                const gx = b.x - tx / tl * 2 * R, gy = b.y - ty / tl * 2 * R;
                const ax = gx - cx, ay = gy - cy, al = Math.hypot(ax, ay);
                if (al < 1) return;
                const cut = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (al * tl))));
                if (cut > PA_MAX_CUT) return;
                if (!paClear(world.balls, cx, cy, gx, gy, [0, b.id], 2 * R - 0.5)) return;
                if (!paClear(world.balls, b.x, b.y, p.x, p.y, [0, b.id], 2 * R - 0.5)) return;
                // Straighter and shorter is easier; a thin cut over a long way is a guess.
                const score = Math.cos(cut) * Math.cos(cut) / (1 + (al + tl) / 600);
                out.push({ ball: b.id, pocket: pi, angle: Math.atan2(ay, ax), score });
            });
        }
        return out.sort((a, b) => b.score - a.score);
    }

    // Plays a shot out on a copy of the table and scores it for the shooter.
    function paTrial(world, frame, seat, shot) {
        const w = ppCloneWorld(world);
        ppStrike(w, shot);
        ppSimulate(w);
        const v = prJudge(frame, w, shot.call);
        if (v.frameOver) return { v, score: v.winner === seat ? 1e6 : -1e6 };
        if (v.foul) return { v, score: -1000 };
        // A pot that keeps the table: more follow-up pots from where the cue
        // ball stopped is better position. Cheap: geometry only, no trials.
        const cue = w.balls.find(b => b.id === 0);
        const next = v.continues && cue ? paCandidates(w, v.next, seat, cue.x, cue.y).length : 0;
        return { v, score: (v.continues ? 1000 : 0) + Math.min(next, 5) * 20 - shot.speed / 1000 };
    }

    // opts: { rng, noise: bool }. The job's shot is { angle, speed, tipX, tipY, call }.
    function paPlan(world, frame, opts) {
        const o = opts || {}, seat = frame.turn, cfg = world.cfg;
        const cue = world.balls.find(b => b.id === 0);
        const st = prStatus(frame, world, seat);
        const job = { done: false, shot: null, tried: 0 };
        const finish = shot => {
            let s = Object.assign({ tipX: 0, tipY: 0, call: -1 }, shot);
            if (o.noise !== false && o.rng) {
                s.angle += paGauss(o.rng) * PA_AIM_SIGMA;
                s.speed = Math.max(200, Math.min(cfg.maxSpeed, s.speed * (1 + paGauss(o.rng) * PA_POWER_SIGMA)));
            }
            job.shot = s; job.done = true;
        };

        // The break: full power at the head ball, never called.
        if (frame.isBreak) {
            const apex = world.balls.filter(b => b.id !== 0).sort((a, b) => a.x - b.x)[0];
            job.step = () => { finish({ angle: Math.atan2(apex.y - cue.y, apex.x - cue.x), speed: cfg.maxSpeed * 0.96 }); return true; };
            return job;
        }

        const cands = paCandidates(world, frame, seat, cue.x, cue.y).slice(0, PA_TRIALS);
        const queue = [];
        cands.forEach(c => PA_SPEEDS.forEach(speed => queue.push({ angle: c.angle, speed, call: st.callRequired ? c.pocket : -1 })));
        // No clean pot in sight: roll a legal ball full, at a few speeds, and
        // take whichever is not a foul.
        if (!queue.length) {
            paTargets(world, frame, seat)
                .sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))
                .slice(0, 3)
                .forEach(b => [1100, 1800].forEach(speed => {
                    const near = world.table.pockets.reduce((m, p, i) => (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(world.table.pockets[m].x - b.x, world.table.pockets[m].y - b.y) ? i : m), 0);
                    queue.push({ angle: Math.atan2(b.y - cue.y, b.x - cue.x), speed, call: st.callRequired ? near : -1 });
                }));
        }
        let best = null;
        const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        job.step = budgetMs => {
            if (job.done) return true;
            const t0 = now();
            while (queue.length) {
                const shot = queue.shift();
                const r = paTrial(world, frame, seat, shot);
                job.tried++;
                if (!best || r.score > best.score) best = Object.assign({ shot }, r);
                if (budgetMs !== undefined && now() - t0 >= budgetMs) break;
            }
            if (queue.length) return false;
            // Nothing even legal: a soft roll at the nearest legal ball is the least bad.
            if (!best) {
                const b = paTargets(world, frame, seat)[0];
                finish(b ? { angle: Math.atan2(b.y - cue.y, b.x - cue.x), speed: 1200 } : { angle: 0, speed: 1200 });
            } else finish(best.shot);
            return true;
        };
        return job;
    }

    // Where to put the cue ball with ball in hand: straight behind the ghost
    // ball of the easiest pot, or, on the break, in the middle of the kitchen.
    function paPlace(world, frame, rng) {
        const t = world.table, R = world.cfg.ballR, zone = frame.ballInHand;
        if (zone === 'kitchen') {
            const y = rng ? (rng() - 0.5) * 120 : 0;
            return [t.headX - 60, y];
        }
        const seat = frame.turn;
        const spots = [];
        for (const b of paTargets(world, frame, seat)) {
            t.pockets.forEach(p => {
                const tx = p.x - b.x, ty = p.y - b.y, tl = Math.hypot(tx, ty);
                const ux = tx / tl, uy = ty / tl;
                const gx = b.x - ux * 2 * R, gy = b.y - uy * 2 * R;
                const x = gx - ux * PA_PLACE_BACK, y = gy - uy * PA_PLACE_BACK;
                if (prCanPlace(world, x, y, zone)) return;
                if (!paClear(world.balls, x, y, gx, gy, [0, b.id], 2 * R - 0.5)) return;
                if (!paClear(world.balls, b.x, b.y, p.x, p.y, [0, b.id], 2 * R - 0.5)) return;
                spots.push({ x, y, score: 1 / (1 + tl / 600) });
            });
        }
        spots.sort((a, b) => b.score - a.score);
        if (spots.length) return [spots[0].x, spots[0].y];
        // Nowhere clean: the first free spot on a coarse grid.
        for (let x = -400; x <= 400; x += 50) for (let y = -200; y <= 200; y += 50) if (!prCanPlace(world, x, y, zone)) return [x, y];
        return [t.headX - 60, 0];
    }
