    // ═══════════════════════════════════════════════════════════════════
    // SNOOKER — TABLE (v2 engine)
    // ═══════════════════════════════════════════════════════════════════
    // Snooker on pool's engine (POOL_V2_PLAN.md, Snooker). The physics, cameras and
    // renderer are pool's; this module is what makes the table a snooker table: its
    // config, its balls, its markings and its rack; and, below the table, its rules (Phase S2).
    //
    // True scale on the same 1000 × 500 bed (1 u = 3.569 mm, a 3569 mm bed): 52.5 mm balls
    // are R 7.36. The pockets, cushion ends and markings are the design's
    // (pool-dev/ref/design/Table.dc.html, revision 1790715495-3a1b), so what is drawn is
    // what plays. The design's y points down the screen; ours points up, so its +y is
    // our −y (yellow sits at y < 0: on the right of the D, seen from the baulk end).
    //
    // Ball ids: 0 the cue ball; a colour's id is its value (yellow 2, green 3, brown 4,
    // blue 5, pink 6, black 7); reds are 8 upward (8–22 with 15 reds). No id means what
    // it means in pool.

    const PS_TABLE = {
        game: 'snooker',
        ballR: 7.36,
        // The design's pockets: the cushions stop 17 u from each corner (mouth 17·√2 ≈ 24 u)
        // and 14.5 u either side of each middle pocket (mouth 29 u); every end is a
        // quarter-round of radius 12, the cushion's depth.
        pocketStyle: 'rounded',
        cornerNose: 17, sideNose: 14.5, cushionCut: 12,
        cornerPocketOffset: 3, cornerPocketR: 17,       // holes at (±503, ±253)
        sidePocketOffset: 9, sidePocketR: 15.5,         // holes at (0, ±259)
        // A 12 ft table's cloth on a 1000 u bed: gravity in these units, the same 8 m/s top
        // speed as pool, and snooker cloth's lower rolling resistance (a feel number; see
        // the harness).
        gravity: 2749,                                  // 9.81 m/s² at 3.569 mm/u
        maxSpeed: 2240,
        muRoll: 0.011,
        clusterGap: 0.26,                               // pool's 0.5, scaled with R
        // Pool's rail and nose heights, as the design draws them (a nose at 1.36 R is close
        // to a real snooker table's), set explicitly so the wide shots fit the real rail.
        railZ: 16, noseZ: 10,
        diamonds: false,
    };

    const PS_RED = 8;                                   // the first red's id
    const PS_COLOURS = [2, 3, 4, 5, 6, 7];              // yellow … black, by value
    const PS_NAMES = { 0: 'cue ball', 2: 'yellow', 3: 'green', 4: 'brown', 5: 'blue', 6: 'pink', 7: 'black' };
    const PS_REDS = [15, 10, 6];                        // the frame lengths offered

    // The markings, in our frame: the baulk line 206.5 u from the baulk cushion, the D's
    // radius, and each colour's spot.
    const PS_BAULK_X = -293.5, PS_D_R = 81.8;
    const PS_SPOTS = {
        2: [PS_BAULK_X, -PS_D_R],                       // yellow
        3: [PS_BAULK_X, PS_D_R],                        // green
        4: [PS_BAULK_X, 0],                             // brown
        5: [0, 0],                                      // blue
        6: [250, 0],                                    // pink
        7: [409.2, 0],                                  // black
    };

    const psIsRed = id => id >= PS_RED;
    const psValue = id => (id >= PS_RED ? 1 : PS_COLOURS.indexOf(id) >= 0 ? id : 0);
    const psName = id => (psIsRed(id) ? 'red' : PS_NAMES[id] || '');
    const psRedsOf = n => (PS_REDS.indexOf(n) >= 0 ? n : 15);

    // The markings as the renderer draws them (pgDrawMarks: spots, the baulk line across the
    // bed, the D's half-circle toward the baulk cushion), plus the numbers the rules and
    // ball in hand read.
    function psMarks(cfg) {
        const HW = cfg.halfWidth;
        return {
            baulkX: PS_BAULK_X, dR: PS_D_R, spotOf: PS_SPOTS,
            spots: PS_COLOURS.map(id => ({ x: PS_SPOTS[id][0], y: PS_SPOTS[id][1], r: 2 })),
            lines: [[[PS_BAULK_X, -HW], [PS_BAULK_X, HW]]],
            arcs: [{ x: PS_BAULK_X, y: 0, r: PS_D_R, a0: Math.PI / 2, a1: 3 * Math.PI / 2 }],
        };
    }

    // A snooker world: pool's physics on the snooker table, with its markings.
    function psCreateWorld(overrides) {
        const w = ppCreateWorld(Object.assign({}, PS_TABLE, overrides));
        w.table.marks = psMarks(w.cfg);
        return w;
    }

    // The rack: the reds in a pyramid (5, 4 or 3 rows) with its apex as close behind the pink
    // as it can be without touching it, the colours exactly on their spots, and the cue ball
    // in the D. `rng` jitters each red by a hair, as pool's rack does, so no two break-offs
    // are the same; the colours are never jittered.
    function psRack(w, rng, reds) {
        const R = w.cfg.ballR, n = psRedsOf(reds);
        const d = 2 * R + 0.02;                         // a hair between balls, as pool's rack
        const rows = n === 15 ? 5 : n === 10 ? 4 : 3;
        const apex = PS_SPOTS[6][0] + 2 * R + 0.05;
        w.balls = [ppMakeBall(0, -320, -30)];           // the design's break-off spot, in the D
        PS_COLOURS.forEach(id => w.balls.push(ppMakeBall(id, PS_SPOTS[id][0], PS_SPOTS[id][1])));
        let id = PS_RED;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col <= row; col++) {
                const jx = (rng() - 0.5) * 0.008, jy = (rng() - 0.5) * 0.008;
                w.balls.push(ppMakeBall(id++, apex + row * d * Math.sqrt(3) / 2 + jx, (col - row / 2) * d + jy));
            }
        }
        w.t = 0; w.log = []; w.escapes = 0;
        return w;
    }

    // ═══════════════════════════════════════════════════════════════════
    // SNOOKER — RULES (v2 engine)
    // ═══════════════════════════════════════════════════════════════════
    // Snooker to the 147 (POOL_V2_PLAN.md, Snooker: the rules table and the user's calls):
    //   - the break-off is played from the D, on reds; there is no other break rule
    //   - on reds any red may be hit first (several at once too), 1 a red; then a colour,
    //     nominated every time, re-spotted when potted; after the last red, any colour once,
    //     then the clearance, yellow to black, where potted balls stay down
    //   - a foul costs max(4, the ball on, every ball involved), capped at 7, never a sum; a
    //     foul before nominating is 7. The offender scores nothing, reds stay down and colours
    //     come back. The incoming player chooses: play, make the offender play again, or
    //     (snookered, and the cue ball not in-off) a free ball. No miss rule, no re-racks
    //   - a cue ball in-off is ball in hand in the D for whoever plays next
    //   - the frame ends when the table is cleared, on a foul with only the black left, or
    //     on a concession; a tie re-spots the black, played from the D, the first player
    //     drawn by the frame's seeded lot
    //
    // Pure, as pool's judge is: psJudge reads a settled world and its event log and returns
    // a verdict plus the next frame state, mutating neither. The caller applies the re-spots
    // (psApplySpots) and places the cue ball when it is in hand. Seats are 1 and 2.
    //
    // frame = { v, game, reds, breaker, turn, isBreak, lot, scores {1, 2}, brk, high {1, 2},
    //   fouls {1, 2}, shots, phase 'reds' | 'colour' | 'clearance', next (the clearance's ball
    //   on, 2–7), freeBall, ballInHand 'D' | null, touching [ids], pending, respotBlack, over,
    //   winner, conceded }
    // pending = { offender, chooser, options: ['play', 'back'(, 'free')], penalty }

    const PS_FOUL_TEXT = {
        inOff: 'In-off',
        noContact: 'No ball hit',
        noNomination: 'No colour nominated',
        timeout: 'Out of time',
        freeSnooker: 'Snookered behind the free ball',
    };
    // Which foul names the toast when a shot commits several: the one that set the penalty,
    // and on equal values the first here.
    const PS_FOUL_ORDER = ['wrongFirst', 'wrongPot', 'wrongPocket', 'noContact', 'inOff', 'noNomination', 'freeSnooker', 'timeout'];
    const PS_TOUCH_GAP = 0.1;                           // a ball this close to the cue ball is touching it
    // The call pocket, as it is played where the user is from: 'off' (the rules as written),
    // 'colours' (every colour is called, reds are not) or 'all' (every ball). A ball on potted
    // with none in the pocket called is a foul on its value. The break-off is never called.
    const PS_CALLS = ['off', 'colours', 'all'];
    const psCallNeeded = state => !state.isBreak && (state.call === 'all' || (state.call === 'colours' && state.phase !== 'reds'));

    // opts: { breaker: 1|2, reds: 15|10|6, seed, call: 'off'|'colours'|'all' }
    function psNewFrame(opts) {
        const o = opts || {};
        const breaker = o.breaker === 2 ? 2 : 1;
        return {
            v: 1, game: 'snooker', reds: psRedsOf(o.reds), breaker, turn: breaker, isBreak: true,
            lot: (o.seed >>> 0) || 1,
            scores: { 1: 0, 2: 0 }, brk: 0, high: { 1: 0, 2: 0 }, fouls: { 1: 0, 2: 0 }, shots: 0,
            phase: 'reds', next: 2, freeBall: false, ballInHand: 'D', touching: [],
            pending: null, respotBlack: false, over: false, winner: 0, conceded: 0,
            call: PS_CALLS.indexOf(o.call) >= 0 ? o.call : 'off',
        };
    }

    const psLiveIds = balls => balls.filter(b => b.id !== 0 && b.state !== 'pocketed').map(b => b.id);

    // The colours a player may nominate now: any colour after a red (or after the last red);
    // on a free ball, any colour that is not the ball on.
    function psNominable(state, live) {
        const cols = PS_COLOURS.filter(id => live.indexOf(id) >= 0);
        if (state.freeBall) return state.phase === 'clearance' ? cols.filter(id => id !== state.next) : cols;
        return state.phase === 'colour' ? cols : [];
    }

    // What the shooter is on. ids: the balls that may be hit first and potted; also: the balls
    // a free ball may be hit or potted together with (the reds, or the clearance's ball on);
    // value: what a foul on it costs at least (a free ball takes the value of the ball it
    // stands for; nothing nominated when a nomination is needed is 7).
    function psBallOn(state, live, nominated) {
        const nominable = psNominable(state, live);
        const needsNomination = state.freeBall || state.phase === 'colour';
        const nom = needsNomination && nominable.indexOf(nominated) >= 0 ? nominated : -1;
        const reds = live.filter(psIsRed);
        if (state.freeBall) {
            const also = state.phase === 'clearance' ? [state.next] : reds;
            return { ids: nom >= 0 ? [nom] : [], also, value: nom >= 0 ? (state.phase === 'clearance' ? state.next : 1) : 7, freeId: nom, nominated: nom, needsNomination, nominable };
        }
        if (state.phase === 'reds') return { ids: reds, also: [], value: 1, freeId: -1, nominated: -1, needsNomination, nominable };
        if (state.phase === 'colour') return { ids: nom >= 0 ? [nom] : [], also: [], value: nom >= 0 ? nom : 7, freeId: -1, nominated: nom, needsNomination, nominable };
        return { ids: [state.next], also: [], value: state.next, freeId: -1, nominated: -1, needsNomination, nominable };
    }

    // The last shot from the physics log: the ball(s) the cue ball met first (all those met
    // at the same instant), what dropped, and whether the cue ball went in. Contacts with a
    // ball the cue ball was touching at rest are left out: playing away from it is not a hit.
    function psSummarize(log, touching) {
        const touch = touching || [];
        let start = 0;
        for (let i = log.length - 1; i >= 0; i--) if (log[i].type === 'strike') { start = i + 1; break; }
        let firstT = null;
        const first = [], pots = [];
        for (let i = start; i < log.length; i++) {
            const e = log[i];
            if (e.type === 'ball' && (e.a === 0 || e.b === 0)) {
                const other = e.a === 0 ? e.b : e.a;
                if (touch.indexOf(other) >= 0) continue;
                if (firstT === null) firstT = e.t;
                if (Math.abs(e.t - firstT) < 1e-9 && first.indexOf(other) < 0) first.push(other);
            } else if (e.type === 'pocket') pots.push({ ball: e.ball, pocket: e.pocket });
        }
        return { firstT, first, pots, cueDown: pots.some(p => p.ball === 0) };
    }

    // The balls as they will stand once the re-spots are applied (and without the cue ball
    // when it is in hand): what the snookered and touching tests look at.
    function psAfter(world, spots, cueInHand) {
        const at = {};
        (spots || []).forEach(s => { at[s.id] = s; });
        return world.balls.filter(b => at[b.id] || (b.state !== 'pocketed' && !(cueInHand && b.id === 0)))
            .map(b => (at[b.id] ? { id: b.id, x: at[b.id].x, y: at[b.id].y, state: 'stationary' } : b));
    }

    // Is the cue ball snookered on `onIds`? The cue ball's path to a ball on is a band 2R
    // either side of its centre line; it is blocked by any ball not on (cushions are not
    // looked at). mode 'free' (the free-ball test): snookered unless some ball on can be hit
    // on both of its extreme edges. mode 'full': snookered only if no part of any ball on
    // can be hit. `balls`: live balls, the cue ball among them; `R` the ball radius.
    function psSnookered(balls, R, onIds, mode) {
        const cue = balls.find(b => b.id === 0 && b.state !== 'pocketed');
        const on = balls.filter(b => b.state !== 'pocketed' && onIds.indexOf(b.id) >= 0);
        if (!cue || !on.length) return false;
        const others = balls.filter(b => b.id !== 0 && b.state !== 'pocketed' && onIds.indexOf(b.id) < 0);
        const R2 = 2 * R;
        // The line from the cue ball that passes `off` from the object ball's centre (|off| < 2R),
        // up to where the cue ball would meet it: is any other ball within 2R of that path?
        const blocked = (o, off, extra) => {
            const dx = o.x - cue.x, dy = o.y - cue.y, d = Math.hypot(dx, dy);
            if (d <= R2 + 1e-9) return false;                              // touching: it can be hit
            const a = Math.atan2(dy, dx) + Math.asin(off / d);
            const vx = Math.cos(a), vy = Math.sin(a);
            const len = d * Math.cos(Math.asin(off / d)) - Math.sqrt(Math.max(0, R2 * R2 - off * off));
            return others.concat(extra || []).some(b => {
                const px = b.x - cue.x, py = b.y - cue.y, s = Math.max(0, Math.min(len, px * vx + py * vy));
                return (px - s * vx) ** 2 + (py - s * vy) ** 2 < (R2 - 1e-6) ** 2;
            });
        };
        const edge = R2 - 1e-3;
        if (mode === 'full') {
            const offs = [];
            for (let k = 0; k <= 40; k++) offs.push(-edge + 2 * edge * k / 40);
            return on.every(o => offs.every(off => blocked(o, off)));
        }
        return !on.some(o => !blocked(o, edge) && !blocked(o, -edge));
    }

    // The ids of the balls touching the cue ball at rest.
    function psTouching(balls, R) {
        const cue = balls.find(b => b.id === 0 && b.state !== 'pocketed');
        if (!cue) return [];
        return balls.filter(b => b.id !== 0 && b.state !== 'pocketed' && Math.hypot(b.x - cue.x, b.y - cue.y) <= 2 * R + PS_TOUCH_GAP).map(b => b.id);
    }

    // Where re-spotted colours go, highest value first, each one occupying its place for the
    // next: its own spot; else the highest-value free spot; else as close as it fits behind
    // its own spot toward the top cushion; else in front of it. A place is free when no ball
    // on the table (or already re-spotted) would touch the one placed there. Solved on the
    // line exactly, not stepped.
    function psSpotPositions(world, ids) {
        const R = world.cfg.ballR, gap = 2 * R + 0.02, hx = world.table.halfLength - R;
        const occ = world.balls.filter(b => b.state !== 'pocketed' && ids.indexOf(b.id) < 0).map(b => [b.x, b.y]);
        const free = (x, y) => occ.every(([ox, oy]) => (ox - x) ** 2 + (oy - y) ** 2 >= gap * gap - 1e-9);
        return ids.slice().sort((a, b) => b - a).map(id => {
            const own = PS_SPOTS[id];
            let p = null;
            if (free(own[0], own[1])) p = own.slice();
            for (let k = PS_COLOURS.length - 1; k >= 0 && !p; k--) { const s = PS_SPOTS[PS_COLOURS[k]]; if (free(s[0], s[1])) p = s.slice(); }
            if (!p) {
                // On the line through its own spot, each ball near it rules out an interval.
                const cuts = occ.filter(([, oy]) => Math.abs(oy - own[1]) < gap)
                    .map(([ox, oy]) => { const h = Math.sqrt(gap * gap - (oy - own[1]) ** 2); return [ox - h, ox + h]; });
                const walk = (x, dir) => {
                    for (let moved = true; moved;) {
                        moved = false;
                        for (const [lo, hi] of cuts) if (x > lo + 1e-9 && x < hi - 1e-9) { x = dir > 0 ? hi : lo; moved = true; }
                    }
                    return x;
                };
                const back = walk(own[0], 1), front = walk(own[0], -1);
                p = [back <= hx ? back : front >= -hx ? front : own[0], own[1]];
            }
            occ.push(p);
            return { id, x: p[0], y: p[1] };
        });
    }

    // Puts the verdict's re-spotted colours back on the table (this mutates the world).
    function psApplySpots(world, spots) {
        (spots || []).forEach(s => {
            const b = world.balls.find(o => o.id === s.id);
            if (b) Object.assign(b, { x: s.x, y: s.y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, state: 'stationary', pocket: -1 });
        });
    }

    // Points still on the table for the player at it: a red and a black for every red, then
    // the colours (27); after a red, the colour that follows it; in the clearance, the ball
    // on and everything after it.
    function psRemaining(state, live) {
        if (state.respotBlack) return 7;
        if (state.phase === 'clearance') { let s = 0; for (let c = state.next; c <= 7; c++) s += c; return s; }
        return live.filter(psIsRed).length * 8 + 27 + (state.phase === 'colour' ? 7 : 0);
    }

    // How many snookers `seat` needs: none while the points left can still level it, else
    // enough fouls on the lowest ball on (at least 4 each) to close the rest.
    function psSnookersRequired(state, live, seat) {
        const lead = state.scores[3 - seat] - state.scores[seat], rem = psRemaining(state, live);
        if (lead <= rem) return 0;
        const low = state.phase === 'clearance' ? state.next : 1;
        return Math.ceil((lead - rem) / Math.max(4, low));
    }

    // The frame for the HUD and the CPU. `nominated` is the colour tapped so far (or -1).
    function psStatus(state, world, seat, nominated) {
        const live = psLiveIds(world.balls);
        const on = psBallOn(state, live, nominated === undefined ? -1 : nominated);
        return {
            on, needsNomination: on.needsNomination && on.nominated < 0, nominable: on.nominable,
            remaining: psRemaining(state, live),
            snookersRequired: { 1: psSnookersRequired(state, live, 1), 2: psSnookersRequired(state, live, 2) },
            pending: state.pending, scores: state.scores, brk: state.brk, high: state.high,
            phase: state.phase, next: state.next, freeBall: state.freeBall, respotBlack: state.respotBlack,
            redsLeft: live.filter(psIsRed).length,
            colours: PS_COLOURS.map(id => ({ id, down: live.indexOf(id) < 0 })),
            seat: seat || state.turn, turn: state.turn, ballInHand: state.ballInHand,
            callRequired: psCallNeeded(state), call: state.call || 'off',
        };
    }

    // The frame is decided (the table cleared, or a foul with only the black left): the
    // higher score wins; a tie re-spots the black, played from the D by the lot's pick.
    function psEndFrame(v, state, next) {
        if (next.scores[1] !== next.scores[2]) {
            v.frameOver = true; v.winner = next.scores[1] > next.scores[2] ? 1 : 2;
            v.continues = false; v.nextTurn = 0; v.ballInHand = null; v.options = [];
            Object.assign(next, { over: true, winner: v.winner, pending: null, turn: 0, ballInHand: null, brk: 0 });
            return;
        }
        const first = ppRandom(state.lot + state.shots)() < 0.5 ? 1 : 2;
        v.respotBlack = true; v.notice = 'respotBlack'; v.continues = false; v.nextTurn = first; v.ballInHand = 'D'; v.options = [];
        v.spots = v.spots.filter(s => s.id !== 7).concat([{ id: 7, x: PS_SPOTS[7][0], y: PS_SPOTS[7][1] }]);
        Object.assign(next, { respotBlack: true, phase: 'clearance', next: 7, turn: first, ballInHand: 'D', pending: null, brk: 0, freeBall: false, touching: [] });
    }

    // After a foul: the points to the other seat, the colours back, and the choice.
    function psFoulOutcome(v, state, world, next, fouls, onValue) {
        const me = state.turn, them = 3 - me;
        const worst = fouls.reduce((m, f) => Math.max(m, f.value), onValue);
        v.penalty = Math.min(7, Math.max(4, worst));
        const top = fouls.slice().sort((a, b) => b.value - a.value || PS_FOUL_ORDER.indexOf(a.code) - PS_FOUL_ORDER.indexOf(b.code))[0];
        v.foul = top.code; v.reason = top.code; v.foulBall = top.ball; v.fouls = fouls;
        v.continues = false; v.nextTurn = them; v.points = 0; v.scored = [];
        next.scores = Object.assign({}, state.scores, { [them]: state.scores[them] + v.penalty });
        next.fouls = Object.assign({}, state.fouls, { [me]: state.fouls[me] + 1 });
        next.brk = 0; next.turn = them; next.freeBall = false;
        const liveAfter = psLiveIds(psAfter(world, v.spots, v.ballInHand === 'D'));
        const reds = liveAfter.filter(psIsRed).length;
        if (state.respotBlack || (state.phase === 'clearance' && state.next === 7)) {
            next.phase = 'clearance'; next.next = 7;
            psEndFrame(v, state, next);
            return;
        }
        next.phase = reds ? 'reds' : 'clearance';
        next.next = state.phase === 'clearance' ? state.next : 2;
        const options = ['play', 'back'];
        if (v.ballInHand !== 'D') {
            const after = psAfter(world, v.spots, false);
            const onNext = next.phase === 'reds' ? liveAfter.filter(psIsRed) : [next.next];
            if (psSnookered(after, world.cfg.ballR, onNext, 'free')) options.push('free');
        }
        v.options = options;
        next.pending = { offender: me, chooser: them, options, penalty: v.penalty };
    }

    // Judges the shot that just settled. `nominated`: the colour tapped for it, or -1;
    // `called`: the pocket called for it (when the frame's call rule asks), or -1.
    // Returns the verdict; verdict.next is the state to play on.
    function psJudge(state, world, nominated, called) {
        const call = Number.isInteger(called) && called >= 0 ? called : -1;
        const me = state.turn, them = 3 - me;
        const s = psSummarize(world.log, state.touching);
        const potted = new Set(s.pots.map(p => p.ball));
        // Everything that was on the table when the shot started.
        const before = world.balls.filter(b => b.id !== 0 && (b.state !== 'pocketed' || potted.has(b.id))).map(b => b.id);
        const on = psBallOn(state, before, nominated);
        const free = on.freeId >= 0;
        const legalPot = new Set(on.ids.concat(free ? on.also : []));
        const v = {
            shooter: me, foul: null, fouls: [], reason: null, penalty: 0, points: 0, scored: [],
            frameOver: false, winner: 0, continues: false, nextTurn: them, ballInHand: s.cueDown ? 'D' : null,
            options: [], freeBall: state.freeBall, respotBlack: false, spots: [], notice: null,
            on, nominated: on.nominated, summary: s, wasBreak: state.isBreak, foulBall: -1,
            callRequired: psCallNeeded(state), called: call,
        };
        const next = Object.assign({}, state, {
            scores: Object.assign({}, state.scores), high: Object.assign({}, state.high), fouls: Object.assign({}, state.fouls),
            isBreak: false, shots: state.shots + 1, freeBall: false, pending: null, ballInHand: v.ballInHand,
        });
        v.next = next;

        // Fouls, each with the value of the balls it involves.
        const fouls = [];
        const add = (code, ids) => {
            const ball = ids.reduce((m, id) => (psValue(id) > psValue(m) ? id : m), ids.length ? ids[0] : -1);
            fouls.push({ code, ball, value: ids.reduce((m, id) => Math.max(m, psValue(id)), 0) });
        };
        if (on.needsNomination && on.nominated < 0) add('noNomination', [7]);
        const touchingOn = (state.touching || []).some(id => on.ids.indexOf(id) >= 0);
        if (!s.first.length) { if (!touchingOn) add('noContact', []); }
        else {
            const firstOk = free ? s.first.indexOf(on.freeId) >= 0 && s.first.every(id => id === on.freeId || on.also.indexOf(id) >= 0)
                : s.first.every(id => on.ids.indexOf(id) >= 0);
            if (!firstOk) {
                const wrong = s.first.filter(id => (free ? id !== on.freeId && on.also.indexOf(id) < 0 : on.ids.indexOf(id) < 0));
                add('wrongFirst', wrong.length ? wrong : s.first);
            }
        }
        const badPots = s.pots.map(p => p.ball).filter(id => id !== 0 && !legalPot.has(id));
        if (badPots.length) add('wrongPot', badPots);
        if (s.cueDown) add('inOff', []);
        // The call: a ball on went down, and none of them in the pocket called. Other reds
        // that drop beside a red in the called pocket still count, as reds do.
        const onPots = s.pots.filter(p => p.ball !== 0 && legalPot.has(p.ball));
        if (v.callRequired && onPots.length && !onPots.some(p => p.pocket === call)) add('wrongPocket', onPots.map(p => p.ball));

        const colourPots = s.pots.map(p => p.ball).filter(id => PS_COLOURS.indexOf(id) >= 0);
        if (fouls.length) {
            // Every colour that went down comes back; reds stay down.
            v.spots = psSpotPositions(world, colourPots);
            psFoulOutcome(v, state, world, next, fouls, on.value);
            next.touching = psTouching(psAfter(world, v.spots, v.ballInHand === 'D'), world.cfg.ballR);
            return v;
        }

        // A fair shot.
        const scored = s.pots.map(p => p.ball).filter(id => legalPot.has(id));
        const liveReds = psLiveIds(world.balls).filter(psIsRed).length;
        let points = 0, spotIds = [];
        if (state.phase === 'reds') {
            points = scored.length;                                    // a red, or the free ball as one, 1 each
            if (free && scored.indexOf(on.freeId) >= 0) spotIds = [on.freeId];
            next.phase = points ? 'colour' : liveReds ? 'reds' : 'clearance';
            next.next = 2;
        } else if (state.phase === 'colour') {
            points = scored.length ? psValue(scored[0]) : 0;
            spotIds = scored.slice();
            next.phase = liveReds ? 'reds' : 'clearance';
            next.next = 2;
        } else {
            // The clearance: the ball on (or the free ball for it) scores the ball on's value
            // once; the free ball comes back, the ball on stays down.
            points = scored.length ? state.next : 0;
            if (free && scored.indexOf(on.freeId) >= 0) spotIds = [on.freeId];
            if (scored.indexOf(state.next) >= 0) next.next = state.next + 1;
            next.phase = 'clearance';
        }
        v.points = points; v.scored = scored; v.continues = points > 0;
        v.spots = psSpotPositions(world, spotIds);
        v.nextTurn = v.continues ? me : them;
        next.turn = v.nextTurn;
        next.scores[me] += points;
        if (v.continues) {
            next.brk = state.brk + points;
            next.high[me] = Math.max(next.high[me], next.brk);
            if (state.brk < 100 && next.brk >= 100) v.notice = 'century';
            if (state.brk < 147 && next.brk >= 147) v.notice = 'maximum';
        } else next.brk = 0;

        // Snookered behind the free ball: a foul, unless only the pink and black are left.
        if (free && !v.continues) {
            const after = psAfter(world, [], false), live = psLiveIds(after);
            const onNext = live.some(psIsRed) ? live.filter(psIsRed) : [next.next];
            const pinkBlack = !live.some(psIsRed) && live.every(id => id >= 6);
            if (!pinkBlack && psSnookered(after, world.cfg.ballR, onNext, 'full') &&
                !psSnookered(after.filter(b => b.id !== on.freeId), world.cfg.ballR, onNext, 'full')) {
                Object.assign(next, { scores: Object.assign({}, state.scores), brk: 0 });
                psFoulOutcome(v, state, world, next, [{ code: 'freeSnooker', ball: on.freeId, value: 0 }], on.value);
                next.touching = psTouching(after, world.cfg.ballR);
                return v;
            }
        }
        // The table cleared (or the re-spotted black taken): the frame is decided.
        if ((state.respotBlack && points) || next.next > 7) {
            next.next = Math.min(next.next, 7);
            psEndFrame(v, state, next);
        }
        next.touching = psTouching(psAfter(world, v.spots, v.ballInHand === 'D'), world.cfg.ballR);
        return v;
    }

    // The incoming player's choice after a foul: 'play', 'back' (the offender plays again,
    // from where the balls lie; no free ball) or 'free'.
    function psChoose(state, choice) {
        const p = state.pending;
        if (!p || p.options.indexOf(choice) < 0) return state;
        return Object.assign({}, state, { pending: null, turn: choice === 'back' ? p.offender : p.chooser, freeBall: choice === 'free', brk: 0 });
    }

    // The shot clock ran out: a foul on the ball on (7 with nothing nominated when a colour
    // was needed), with the usual choice; nothing moved, so the cue ball stays where it is,
    // or in hand in the D if it was.
    function psTimeout(state, world, nominated) {
        const me = state.turn, them = 3 - me;
        const on = psBallOn(state, psLiveIds(world.balls), nominated === undefined ? -1 : nominated);
        const v = {
            shooter: me, foul: null, fouls: [], reason: null, penalty: 0, points: 0, scored: [],
            frameOver: false, winner: 0, continues: false, nextTurn: them, ballInHand: state.ballInHand,
            options: [], freeBall: state.freeBall, respotBlack: false, spots: [], notice: null,
            on, nominated: on.nominated, summary: null, wasBreak: state.isBreak, foulBall: -1,
        };
        const next = Object.assign({}, state, { scores: Object.assign({}, state.scores), fouls: Object.assign({}, state.fouls), shots: state.shots + 1, pending: null });
        v.next = next;
        const value = on.needsNomination && on.nominated < 0 ? 7 : on.value;
        psFoulOutcome(v, state, Object.assign({}, world, { balls: state.ballInHand === 'D' ? world.balls.filter(b => b.id !== 0) : world.balls }), next, [{ code: 'timeout', ball: -1, value }], on.value);
        if (v.ballInHand === 'D' && v.options.indexOf('free') >= 0) v.options.splice(v.options.indexOf('free'), 1);
        next.isBreak = state.isBreak;                     // the break-off is still to be played
        return v;
    }

    // A seat gives the frame away.
    function psConcede(state, seat) {
        const winner = 3 - seat;
        const next = Object.assign({}, state, { over: true, winner, conceded: seat, pending: null, turn: 0, ballInHand: null });
        return {
            shooter: seat, foul: null, fouls: [], reason: 'concede', penalty: 0, points: 0, scored: [],
            frameOver: true, winner, continues: false, nextTurn: 0, ballInHand: null, options: [],
            freeBall: false, respotBlack: false, spots: [], notice: null, conceded: seat, summary: null, next,
        };
    }

    // Seat-aware copy for the toast and the frame result, as prText's. names = { 1, 2 }; the
    // name 'You' gets second-person grammar.
    function psText(v, names) {
        const n = seat => names[seat];
        const you = seat => n(seat) === 'You';
        const nx = v.next;
        if (v.frameOver) {
            const w = v.winner, sc = nx.scores, line = sc[w] + '–' + sc[3 - w];
            const how = v.reason === 'concede' ? (you(v.conceded) ? 'you conceded' : n(v.conceded) + ' conceded')
                : v.foul ? 'foul on the black' : nx.respotBlack ? 'potted the re-spotted black' : 'potted the black';
            return { kind: 'frame', title: you(w) ? 'You win' : n(w) + ' wins', sub: line + ' · ' + how };
        }
        // SnkRespot: an info toast. SnkCentury: the trophy, in the accent.
        if (v.respotBlack) return { kind: 'notice', title: 'Scores level · re-spotted black', sub: (you(v.nextTurn) ? 'You have' : n(v.nextTurn) + ' has') + ' ball in hand in the D' };
        if (v.foul) {
            const why = v.foul === 'wrongFirst' ? 'Hit the ' + psName(v.foulBall) + ' first'
                : v.foul === 'wrongPot' ? 'Potted the ' + psName(v.foulBall)
                : v.foul === 'wrongPocket' ? 'Potted the ' + psName(v.foulBall) + ' in the wrong pocket'
                : PS_FOUL_TEXT[v.foul];
            return {
                kind: 'foul', title: 'Foul · ' + v.penalty + ' to ' + (you(v.nextTurn) ? 'you' : n(v.nextTurn)),
                sub: why + (v.options.indexOf('free') >= 0 ? ' · Free ball' : ''),
            };
        }
        const keeps = (you(v.shooter) ? 'You keep' : n(v.shooter) + ' keeps') + ' the break going';
        if (v.notice === 'maximum') return { kind: 'notice', icon: 'trophy', title: 'Maximum break · ' + nx.brk, sub: v.frameOver ? '' : keeps };
        if (v.notice === 'century') return { kind: 'notice', icon: 'trophy', title: 'Century break · ' + nx.brk, sub: keeps };
        return null;
    }

    // The choice after a foul, as buttons: { id, label, short } in the order offered.
    function psChoiceText(pending, names) {
        const off = names[pending.offender];
        return pending.options.map(id => (id === 'play' ? { id, label: 'Play', short: 'Play' }
            : id === 'back' ? { id, label: off === 'You' ? 'Make you play again' : 'Make ' + off + ' play again', short: 'Put back' }
            : { id, label: 'Free ball', short: 'Free ball' }));
    }

    // What the chooser decided, for a notice when it was not the viewer (the CPU, say):
    // CPU plays on / CPU takes the free ball / CPU puts you back in.
    function psChoiceNotice(pending, choice, names) {
        const who = names[pending.chooser], me = who === 'You', off = names[pending.offender];
        if (choice === 'back') return (me ? 'You put ' : who + ' puts ') + (off === 'You' ? 'you' : off) + ' back in';
        if (choice === 'free') return (me ? 'You take' : who + ' takes') + ' the free ball';
        return (me ? 'You play on' : who + ' plays on');
    }

    // The frame-over dialog's words (SnkWin / SnkLoss): the reason in a sentence, the score
    // in seat order, and the frame's high break with who made it.
    function psResultText(v, names) {
        const n = seat => (names[seat] === 'You' ? 'You' : names[seat]);
        const nx = v.next, sc = nx.scores, h = nx.high;
        const reason = v.reason === 'concede' ? n(v.conceded) + ' conceded.'
            : v.foul ? n(v.shooter) + ' fouled on the black.'
            : nx.respotBlack ? n(v.winner) + ' won on the re-spotted black.' : 'Potted the black.';
        const top = h[2] > h[1] ? 2 : 1;
        return { reason, score: sc[1] + '–' + sc[2], high: h[top] ? h[top] + ' · ' + n(top) : '0' };
    }

    // ═══════════════════════════════════════════════════════════════════
    // SNOOKER — THE STAND-IN CPU (until Phase S4)
    // ═══════════════════════════════════════════════════════════════════
    // Enough of a CPU for Vs CPU to play whole frames before S4's planner
    // (pool-snooker-ai.js) replaces it: straight pots by the ghost ball, each checked on
    // a copy of the table through the rules, a thin break-off off the back of the pack,
    // and a plain safety when nothing goes. Its tiers differ only in how straight it
    // hits. The interface is pool's CPU's: plan() returns a time-sliced job whose shot
    // carries the colour it nominates.

    const PS_CPU_TIERS = {
        easy:   { label: 'Easy',   aim: 0.9 },
        normal: { label: 'Normal', aim: 0.35 },
        // Picked (not by Adaptive), hard calls the colours and pro every ball (lockCall).
        hard:   { label: 'Hard',   aim: 0.12, call: 'colours' },
        pro:    { label: 'Pro',    aim: 0.04, call: 'all' },
    };
    const PS_CPU_NAMES = ['easy', 'normal', 'hard', 'pro'];
    const PS_DEG = Math.PI / 180;

    // A free spot in the D for the cue ball in hand: the design's break-off spot, else a
    // walk out over the D.
    function psCueHome(w) {
        const tries = [[-320, -30], [-330, 0], [-320, 30]];
        for (let r = 10; r <= 80; r += 10) for (let a = 0; a < 12; a++) tries.push([PS_BAULK_X - r * Math.sin(a * Math.PI / 12 + 0.01), r * Math.cos(a * Math.PI / 12 + 0.01)]);
        return tries.find(([x, y]) => !prCanPlace(w, x, y, 'D')) || tries[0];
    }

    // Is the straight path clear of every ball but `skip`? A ball blocks within 2R.
    function psPathClear(balls, ax, ay, bx, by, skip, R) {
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        return balls.every(b => {
            if (b.state === 'pocketed' || skip.indexOf(b.id) >= 0) return true;
            const s = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / L2));
            return (b.x - ax - s * dx) ** 2 + (b.y - ay - s * dy) ** 2 >= (2 * R - 0.05) ** 2;
        });
    }

    // Straight pots from (cx, cy), best first: each ball the shooter may play (with the colour
    // it nominates for it) into each pocket whose mouth faces it, through clear paths.
    function psCpuLines(world, frame, cx, cy) {
        const R = world.cfg.ballR, balls = world.balls, t = world.table;
        const st = psStatus(frame, world, frame.turn, -1);
        const targets = st.on.needsNomination ? st.nominable.map(id => ({ id, nominate: id })) : st.on.ids.map(id => ({ id, nominate: -1 }));
        const out = [];
        targets.forEach(tg => {
            const b = balls.find(o => o.id === tg.id);
            if (!b || b.state === 'pocketed') return;
            t.pockets.forEach((p, pi) => {
                const ex = p.x - b.x, ey = p.y - b.y, d2 = Math.hypot(ex, ey), ux = ex / d2, uy = ey / d2;
                // The mouth: a middle pocket takes a ball within 55° of square on, a corner
                // within 50° of its diagonal.
                const side = Math.abs(p.x) < 1;
                const mx = side ? 0 : Math.sign(p.x) / Math.SQRT2, my = side ? Math.sign(p.y) : Math.sign(p.y) / Math.SQRT2;
                if (ux * mx + uy * my < Math.cos((side ? 55 : 50) * PS_DEG)) return;
                const gx = b.x - 2 * R * ux, gy = b.y - 2 * R * uy, d1 = Math.hypot(gx - cx, gy - cy);
                if (d1 < 1) return;
                const cut = Math.acos(Math.max(-1, Math.min(1, ((gx - cx) * ux + (gy - cy) * uy) / d1)));
                if (cut > 70 * PS_DEG) return;
                if (!psPathClear(balls, b.x, b.y, p.x, p.y, [0, b.id], R) || !psPathClear(balls, cx, cy, gx, gy, [0, b.id], R)) return;
                const ease = Math.cos(cut) ** 2 * Math.exp(-(d1 + d2) / 700);
                out.push({
                    ball: b.id, pocket: pi, nominate: tg.nominate, cut,
                    angle: Math.atan2(gy - cy, gx - cx),
                    speed: Math.max(260, Math.min(world.cfg.maxSpeed * 0.7, 230 + 1.05 * (d1 + d2 / Math.max(0.35, Math.cos(cut))))),
                    score: ease * (1 + 0.25 * psValue(b.id) / 7),
                });
            });
        });
        return out.sort((a, b) => b.score - a.score);
    }

    // Ball in hand in the D: where the best straight pot is, else the break-off spot.
    function psCpuPlace(world, frame, rng) {
        const w = world;
        if (frame.isBreak) { const y = rng && rng() < 0.5 ? 30 : -30; return !prCanPlace(w, -320, y, 'D') ? [-320, y] : psCueHome(w); }
        let best = null;
        for (let x = PS_BAULK_X - 4; x >= PS_BAULK_X - PS_D_R; x -= 12) {
            for (let y = -PS_D_R; y <= PS_D_R; y += 12) {
                if (prCanPlace(w, x, y, 'D')) continue;
                const l = psCpuLines(w, frame, x, y)[0];
                if (l && (!best || l.score > best.s)) best = { x, y, s: l.score };
            }
        }
        return best ? [best.x, best.y] : psCueHome(w);
    }

    // The shot. opts: { rng, tier }. The job's step(ms) works through candidates on copies of
    // the table and stops at the first that pots legally; job.shot = { angle, speed, tipX,
    // tipY, nominate }.
    function psCpuPlan(world, frame, opts) {
        const o = opts || {}, T = PS_CPU_TIERS[o.tier] || PS_CPU_TIERS.normal, R = world.cfg.ballR;
        const cue = world.balls.find(b => b.id === 0);
        const job = { done: false, shot: null, tried: 0, plan: '' };
        const trial = s => {
            const w = ppCloneWorld(world);
            ppStrike(w, { angle: s.angle, speed: s.speed, tipX: s.tipX || 0, tipY: s.tipY || 0 });
            ppSimulate(w, 40);
            job.tried++;
            return psJudge(Object.assign({}, frame, { touching: psTouching(world.balls, R) }), w, s.nominate === undefined ? -1 : s.nominate, s.call === undefined ? -1 : s.call);
        };
        const finish = (s, plan) => {
            const g = () => { const u = Math.max(1e-12, o.rng ? o.rng() : 0.5), v = o.rng ? o.rng() : 0.5; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
            const shot = Object.assign({ tipX: 0, tipY: 0, nominate: -1, call: -1 }, s);
            if (o.noise !== false && o.rng) {
                shot.angle += g() * T.aim * PS_DEG;
                shot.speed = Math.max(150, Math.min(world.cfg.maxSpeed, shot.speed * (1 + g() * 0.04)));
            }
            job.shot = shot; job.plan = plan; job.done = true;
        };
        // The queue of shots to try, in order.
        const queue = [];
        if (frame.isBreak) {
            const reds = world.balls.filter(b => psIsRed(b.id) && b.state !== 'pocketed');
            const side = cue.y > 0 ? 1 : -1;
            // The back corner red on the cue ball's side, taken thin so the cue ball runs off
            // the side and top cushions back to baulk.
            const back = reds.reduce((a, b) => (b.x > a.x + 1 || (Math.abs(b.x - a.x) <= 1 && b.y * side > a.y * side) ? b : a), reds[0]);
            [1.6, 1.75, 1.45, 1.9].forEach(k => [1000, 1150, 900].forEach(v => queue.push({ angle: Math.atan2(back.y + side * k * R - cue.y, back.x - 0.2 * R - cue.x), speed: v, plan: 'break' })));
        } else {
            psCpuLines(world, frame, cue.x, cue.y).slice(0, 8).forEach(l => [1, 1.35, 0.8].forEach(k => queue.push({ angle: l.angle, speed: l.speed * k, nominate: l.nominate, call: l.pocket, tipY: -0.15, plan: 'pot' })));
        }
        let i = 0;
        job.step = budgetMs => {
            if (job.done) return true;
            const t0 = Date.now();
            while (i < queue.length) {
                const s = queue[i++], v = trial(s);
                if (!v.foul && (s.plan === 'break' || v.points > 0)) { finish(s, s.plan); return true; }
                if (Date.now() - t0 >= (budgetMs || 3)) return false;
            }
            // Nothing went: a safety, rolling up to the nearest ball on (nominating the nearest
            // colour when one is needed), the softest that does not foul.
            const st = psStatus(frame, world, frame.turn, -1);
            const ids = st.on.needsNomination ? st.nominable : st.on.ids;
            // Called, if it drops: the pocket nearest it.
            const nearPocket = b => world.table.pockets.reduce((bi, p, pi, all) => (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(all[bi].x - b.x, all[bi].y - b.y) ? pi : bi), 0);
            const near = world.balls.filter(b => ids.indexOf(b.id) >= 0 && b.state !== 'pocketed')
                .sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y));
            for (const b of near.slice(0, 3)) {
                for (const v of [420, 650, 900]) {
                    const s = { angle: Math.atan2(b.y - cue.y, b.x - cue.x), speed: v, nominate: st.on.needsNomination ? b.id : -1, call: nearPocket(b) };
                    if (!trial(s).foul) { finish(s, 'safety'); return true; }
                }
            }
            const b = near[0];
            finish(b ? { angle: Math.atan2(b.y - cue.y, b.x - cue.x), speed: 600, nominate: st.on.needsNomination ? b.id : -1 } : { angle: 0, speed: 600 }, 'last');
            return true;
        };
        return job;
    }

    // After a foul against it: a free ball when it has one, else it plays on.
    function psCpuChoose(frame) {
        const p = frame.pending;
        if (!p) return 'play';
        return p.options.indexOf('free') >= 0 ? 'free' : 'play';
    }
