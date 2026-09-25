    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — RULES (v2)
    // ═══════════════════════════════════════════════════════════════════
    // WPA 8-ball with the Miniclip-style choices in POOL_V2_PLAN.md:
    //   - the break is played from the kitchen and never called; it is legal
    //     if a ball drops or at least four object balls reach a rail, and an
    //     illegal break is a foul
    //   - the table stays open after the break, whatever dropped; the 8 on
    //     the break is re-spotted and the breaker plays on
    //   - on an open table any solid or stripe may be hit first (not the 8);
    //     the first counted pot decides the groups
    //   - the 8 is always called; call-every-shot is an option (the pro tier
    //     forces it), and then only a ball in the called pocket counts
    //   - after any foul the opponent has ball in hand anywhere
    //
    // Pure: the judge reads a settled physics world and its event log and
    // returns a verdict plus the next frame state. It never mutates either;
    // the caller re-spots the 8 and places the cue ball with the helpers at
    // the bottom. Seats are 1 and 2, as in the rest of the widget.

    const PR_FOUL_TEXT = {
        scratch: 'Scratch',
        noContact: 'No ball hit',
        wrongBall: "Hit opponent's ball first",
        eightFirst: 'Hit the 8 first',
        notEight: 'Must hit the 8 first',
        noRail: 'No rail after contact',
        illegalBreak: 'Illegal break',
    };

    const prGroupOf = id => (id >= 1 && id <= 7 ? 'solids' : id >= 9 && id <= 15 ? 'stripes' : null);
    const prOtherGroup = g => (g === 'solids' ? 'stripes' : 'solids');

    // opts: { breaker: 1|2, callEvery: bool }
    function prNewFrame(opts) {
        const o = opts || {};
        const breaker = o.breaker === 2 ? 2 : 1;
        return {
            v: 1, breaker, turn: breaker, isBreak: true,
            groups: { 1: null, 2: null }, callEvery: !!o.callEvery,
            ballInHand: 'kitchen', shots: 0, over: false, winner: 0,
        };
    }

    // What happened on the last shot, from the physics log: the first ball
    // the cue ball touched, whether any ball reached a cushion after that,
    // how many object balls reached a cushion at all (the break count), and
    // the pots in the order they dropped. Jaws count as cushion: they are
    // the cushion rubber cut back at the pocket.
    function prSummarize(log) {
        let start = 0;
        for (let i = log.length - 1; i >= 0; i--) if (log[i].type === 'strike') { start = i + 1; break; }
        let first = -1, railAfterFirst = false;
        const railed = new Set(), pots = [];
        for (let i = start; i < log.length; i++) {
            const e = log[i];
            if (e.type === 'ball') {
                if (first === -1 && (e.a === 0 || e.b === 0)) first = e.a === 0 ? e.b : e.a;
            } else if (e.type === 'cushion') {
                if (e.ball !== 0) railed.add(e.ball);
                if (first !== -1) railAfterFirst = true;
            } else if (e.type === 'pocket') {
                pots.push({ ball: e.ball, pocket: e.pocket });
            }
        }
        return { first, railAfterFirst, objectRails: railed.size, pots, scratch: pots.some(p => p.ball === 0) };
    }

    // A seat's position in the frame, for the HUD and the CPU. `onTable` is
    // the list of object-ball ids still in play.
    function prStatusFrom(state, seat, onTable) {
        const group = state.groups[seat];
        const left = group ? onTable.filter(id => prGroupOf(id) === group).length : 7;
        const onThe8 = !!group && left === 0;
        return { group, open: !group, left, onThe8, callRequired: !state.isBreak && (state.callEvery || onThe8) };
    }

    function prStatus(state, world, seat) {
        const on = world.balls.filter(b => b.id !== 0 && b.state !== 'pocketed').map(b => b.id);
        return prStatusFrom(state, seat || state.turn, on);
    }

    // Judges the shot that just settled. `call` is the called pocket index
    // (0–5, the table's pocket order), or -1/undefined when nothing was
    // called. Returns the verdict; verdict.next is the state to play on.
    function prJudge(state, world, call) {
        const s = prSummarize(world.log);
        const me = state.turn, them = 3 - me;
        const potted = new Set(s.pots.map(p => p.ball));
        // Everything that was on the table when the shot started.
        const before = world.balls
            .filter(b => b.id !== 0 && (b.state !== 'pocketed' || potted.has(b.id)))
            .map(b => b.id);
        const st = prStatusFrom(state, me, before);
        const group = st.group;
        const called = st.callRequired && Number.isInteger(call) && call >= 0 ? call : -1;

        let foul = null;
        if (s.scratch) foul = 'scratch';
        else if (s.first === -1) foul = state.isBreak ? 'illegalBreak' : 'noContact';
        else if (!state.isBreak) {
            if (st.onThe8) { if (s.first !== 8) foul = 'notEight'; }
            else if (s.first === 8) foul = 'eightFirst';
            else if (group && prGroupOf(s.first) !== group) foul = 'wrongBall';
        }
        const objectPots = s.pots.filter(p => p.ball !== 0);
        if (!foul) {
            if (state.isBreak) { if (!objectPots.length && s.objectRails < 4) foul = 'illegalBreak'; }
            else if (!objectPots.length && !s.railAfterFirst) foul = 'noRail';
        }

        const v = {
            shooter: me, foul, reason: foul, frameOver: false, winner: 0,
            continues: false, nextTurn: them, ballInHand: foul ? 'anywhere' : null,
            respot8: false, assigned: null, counted: [], notice: null,
            callRequired: st.callRequired, call: called, onThe8: st.onThe8,
            wasBreak: state.isBreak, legalBreak: state.isBreak ? foul !== 'illegalBreak' : null,
            summary: s,
        };

        // The 8 decides the frame, except on the break, where it comes back.
        if (potted.has(8) && !state.isBreak) {
            const eight = s.pots.find(p => p.ball === 8);
            let reason;
            if (!st.onThe8) reason = 'eightEarly';
            else if (foul) reason = foul === 'scratch' ? 'eightScratch' : 'eightFoul';
            else if (eight.pocket !== called) reason = 'eightWrongPocket';
            else reason = 'eightPotted';
            v.reason = reason;
            v.frameOver = true;
            v.winner = reason === 'eightPotted' ? me : them;
            v.nextTurn = 0;
            v.ballInHand = null;
            v.next = Object.assign({}, state, {
                groups: Object.assign({}, state.groups), isBreak: false, shots: state.shots + 1,
                ballInHand: null, over: true, winner: v.winner,
            });
            return v;
        }

        const groups = Object.assign({}, state.groups);
        if (state.isBreak) {
            v.respot8 = potted.has(8);
            v.continues = !foul && objectPots.length > 0;
        } else {
            const mine = objectPots.filter(p => p.ball !== 8 && (!group || prGroupOf(p.ball) === group));
            // A foul counts nothing: the balls stay down but earn no turn.
            const counted = foul ? [] : st.callRequired ? mine.filter(p => p.pocket === called) : mine;
            v.counted = counted.map(p => p.ball);
            v.continues = counted.length > 0;
            if (!foul && mine.length && !counted.length) v.notice = 'wrongPocket';
            if (v.continues && !group) {
                const g = prGroupOf(counted[0].ball);
                groups[me] = g; groups[them] = prOtherGroup(g);
                v.assigned = g;
            }
        }
        if (v.respot8 && !foul) v.notice = 'respot8';
        v.nextTurn = v.continues ? me : them;
        v.next = Object.assign({}, state, {
            groups, turn: v.nextTurn, isBreak: false, shots: state.shots + 1,
            ballInHand: v.ballInHand,
        });
        return v;
    }

    // Seat-aware copy for the toast and the frame result. names = { 1, 2 };
    // the name 'You' gets second-person grammar ("You win").
    function prText(v, names) {
        const n = seat => names[seat];
        const you = seat => n(seat) === 'You';
        if (v.frameOver) {
            const who = n(v.shooter);
            const sub = v.reason === 'eightPotted' ? 'Potted the 8 in the called pocket.'
                : v.reason === 'eightEarly' ? who + ' potted the 8 early.'
                : v.reason === 'eightScratch' ? who + ' scratched on the 8.'
                : v.reason === 'eightFoul' ? who + ' potted the 8 on a foul (' + PR_FOUL_TEXT[v.foul].toLowerCase() + ').'
                : who + ' potted the 8 in the wrong pocket.';
            return { kind: 'frame', title: you(v.winner) ? 'You win' : n(v.winner) + ' wins', sub };
        }
        if (v.foul) {
            return {
                kind: 'foul', title: 'Foul · ' + PR_FOUL_TEXT[v.foul],
                sub: 'Ball in hand to ' + (you(v.nextTurn) ? 'you' : n(v.nextTurn)),
            };
        }
        const shoots = seat => (you(seat) ? 'Your shot' : n(seat) + ' to shoot');
        if (v.notice === 'respot8') return { kind: 'notice', title: 'The 8 is re-spotted', sub: shoots(v.nextTurn) };
        if (v.notice === 'wrongPocket') return { kind: 'notice', title: 'Not in the called pocket', sub: shoots(v.nextTurn) };
        if (v.assigned) {
            return { kind: 'notice', title: (you(v.shooter) ? "You're" : n(v.shooter) + ' is') + ' on ' + v.assigned, sub: shoots(v.nextTurn) };
        }
        return null;
    }

    // ── Table helpers (these do mutate the world) ─────────────────────
    // Why a cue-ball spot is refused, or null if it is fine: 'outside',
    // 'kitchen' (behind the head string only) or 'overlap'.
    function prCanPlace(world, x, y, zone) {
        const t = world.table, R = world.cfg.ballR;
        if (!(Math.abs(x) <= t.halfLength - R && Math.abs(y) <= t.halfWidth - R)) return 'outside';
        if (zone === 'kitchen' && x > t.headX) return 'kitchen';
        for (const b of world.balls) {
            if (b.id === 0 || b.state === 'pocketed') continue;
            if ((b.x - x) ** 2 + (b.y - y) ** 2 < 4 * R * R) return 'overlap';
        }
        return null;
    }

    function prPlaceCue(world, x, y) {
        let cue = world.balls.find(b => b.id === 0);
        if (!cue) { cue = ppMakeBall(0, x, y); world.balls.unshift(cue); }
        Object.assign(cue, { x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, state: 'stationary', pocket: -1 });
        return cue;
    }

    // Spots a ball on the long string: on the foot spot, or as close behind
    // it (toward the foot rail) as room allows, else in front of it.
    function prSpotBall(world, id) {
        const t = world.table, R = world.cfg.ballR, b = world.balls.find(o => o.id === id);
        const free = x => world.balls.every(o => o === b || o.state === 'pocketed' || (o.x - x) ** 2 + o.y ** 2 >= (2 * R + 0.02) ** 2);
        let x = null;
        for (let cx = t.footX; cx <= t.halfLength - R && x === null; cx += 0.5) if (free(cx)) x = cx;
        for (let cx = t.footX; cx >= -t.halfLength + R && x === null; cx -= 0.5) if (free(cx)) x = cx;
        Object.assign(b, { x: x === null ? t.footX : x, y: 0, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, state: 'stationary', pocket: -1 });
        return b;
    }
