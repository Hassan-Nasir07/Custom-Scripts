    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — PHYSICS (v2)
    // ═══════════════════════════════════════════════════════════════════
    // A pure, deterministic ball model. Nothing here touches the DOM, the
    // canvas or Math.random, so the CPU can clone a world and run the real
    // physics on it, and the tests can replay a shot exactly.
    //
    // World frame: x right, y up, z up (right-handed), in table units. The
    // playfield is 1000 × 500 with the origin at its centre and R = 14, the
    // design canvas's numbers. The renderer flips y for the screen.
    //
    // Each ball is in one of four motion states, and each state has a closed
    // form, so a ball is advanced exactly rather than integrated:
    //   sliding   the contact point slips; cloth friction slows v and drives
    //             ω toward natural roll along a fixed slip direction
    //   rolling   no slip; constant rolling-resistance deceleration
    //   spinning  v = 0, only ω_z (English) left, decaying
    //   stationary
    // Collisions are found by time of impact inside each sub-step and
    // resolved one at a time, so nothing tunnels and nothing overlaps.

    const PP_DEFAULTS = {
        // Geometry, table units
        halfLength: 500,          // playfield half-length to the cushion noses
        halfWidth: 250,
        ballR: 14,
        railWidth: 48,            // cushion + rail, for the off-table fail-safe
        cornerMouth: 62,          // distance between the two nose points of a corner pocket
        sideMouth: 64,
        cornerJawAngle: 142,      // WPA-style angle between cushion face and jaw, degrees
        sideJawAngle: 103,
        cornerPocketR: 30,        // capture circle: a ball drops once its centre is inside
        cornerPocketSetback: 12,  // capture centre, outward along the diagonal from the corner
        sidePocketR: 30,
        sidePocketSetback: 30,    // capture centre, outward from the nose line
        // Cloth and collisions
        gravity: 3862,            // 9.81 m/s² in table units (1 u = 2.54 mm)
        muSlide: 0.2,             // ball–cloth sliding friction
        muRoll: 0.016,            // rolling resistance, tuned for feel (real cloth ~0.01)
        muSpin: 0.044,            // ω_z decay
        ballE: 0.95,              // ball–ball restitution
        muBall: 0.05,             // ball–ball friction: throw
        cushionE: 0.8,            // ball–cushion restitution
        muCushion: 0.3,           // effective: includes the cloth friction under the ball during the impact
        noseRise: 0.27,           // cushion contact height above the ball centre, in R
        squirt: 0.035,            // cue-ball deflection, radians per unit of side offset
        maxTip: 0.6,              // miscue radius, in R
        maxSpeed: 3200,           // break speed, u/s (≈ 8 m/s)
        // Integration
        subSteps: 4,
        maxEventsPerSubStep: 256,
    };

    const PP_EPS_V = 1e-3;        // below this a speed is zero, u/s
    const PP_EPS_W = 1e-3;        // below this an angular speed is zero, rad/s
    const PP_EPS_T = 1e-9;        // time-of-impact tolerance, s
    const PP_CONTACT = 1e-3;      // contact tolerance, table units

    // ── Table geometry ────────────────────────────────────────────────
    // Cushion noses, jaws and pockets, derived from cfg. Every collider is
    // either a one-sided segment (normal points onto the playable side) or a
    // point (a nose or jaw tip). Jaws run from each nose point, at the jaw
    // angle, until they meet the pocket's capture circle, which closes the
    // throat: a ball in the throat either drops or comes back out.
    function ppBuildTable(cfg) {
        const HL = cfg.halfLength, HW = cfg.halfWidth;
        const segments = [], points = [], pockets = [];
        const rad = d => d * Math.PI / 180;

        const addSeg = (ax, ay, bx, by, nx, ny, kind) => {
            const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
            segments.push({ ax, ay, bx, by, tx: dx / len, ty: dy / len, len, nx, ny, kind });
        };
        const addPoint = (x, y, kind) => points.push({ x, y, kind });

        // First intersection of a ray with a circle, or null.
        const rayCircle = (px, py, dx, dy, cx, cy, r) => {
            const ox = px - cx, oy = py - cy;
            const b = ox * dx + oy * dy, c = ox * ox + oy * oy - r * r;
            const disc = b * b - c;
            if (disc < 0) return null;
            const t = -b - Math.sqrt(disc);
            return t > 0 ? { x: px + dx * t, y: py + dy * t } : null;
        };

        // A jaw leaves nose point (px,py). `along` points along the cushion
        // toward the pocket; `out` is the cushion's outward normal. The jaw
        // turns from the cushion line toward the outside by (180 − angle).
        const addJaw = (px, py, alongX, alongY, outX, outY, angle, pocket, otherX, otherY) => {
            const turn = rad(180 - angle);
            const dx = alongX * Math.cos(turn) + outX * Math.sin(turn);
            const dy = alongY * Math.cos(turn) + outY * Math.sin(turn);
            const end = rayCircle(px, py, dx, dy, pocket.x, pocket.y, pocket.r);
            if (!end) throw new Error('pool table: a jaw misses its pocket; check the pocket settings');
            // Playable side of the jaw faces the opposite nose point.
            let nx = -dy, ny = dx;
            if ((otherX - px) * nx + (otherY - py) * ny < 0) { nx = -nx; ny = -ny; }
            addSeg(px, py, end.x, end.y, nx, ny, 'jaw');
            addPoint(end.x, end.y, 'jawEnd');
            pocket.jaws.push([px, py, end.x, end.y]);
        };

        const c = cfg.cornerMouth / Math.SQRT2;   // nose point distance from the corner along each cushion
        const s = cfg.sideMouth / 2;

        // Pockets, in the order the old engine used: TL, top-side, TR, BL, bottom-side, BR.
        // y is up, so "top" is +HW.
        const corner = (sx, sy) => {
            const k = cfg.cornerPocketSetback / Math.SQRT2;
            return { kind: 'corner', x: sx * (HL + k), y: sy * (HW + k), r: cfg.cornerPocketR, sx, sy, jaws: [] };
        };
        const side = sy => ({ kind: 'side', x: 0, y: sy * (HW + cfg.sidePocketSetback), r: cfg.sidePocketR, sx: 0, sy, jaws: [] });
        pockets.push(corner(-1, 1), side(1), corner(1, 1), corner(-1, -1), side(-1), corner(1, -1));

        // Long cushions (top and bottom), two runs each, split by the side pocket.
        [1, -1].forEach(sy => {
            const y = sy * HW, ny = -sy;
            addSeg(-HL + c, y, -s, y, 0, ny, 'cushion');
            addSeg(s, y, HL - c, y, 0, ny, 'cushion');
        });
        // Short cushions (left and right).
        [-1, 1].forEach(sx => {
            const x = sx * HL;
            addSeg(x, -HW + c, x, HW - c, -sx, 0, 'cushion');
        });

        // Nose points and jaws.
        pockets.forEach(p => {
            if (p.kind === 'corner') {
                const ax = p.sx * (HL - c), ay = p.sy * HW;          // on the long cushion
                const bx = p.sx * HL, by = p.sy * (HW - c);          // on the short cushion
                addPoint(ax, ay, 'nose'); addPoint(bx, by, 'nose');
                addJaw(ax, ay, p.sx, 0, 0, p.sy, cfg.cornerJawAngle, p, bx, by);
                addJaw(bx, by, 0, p.sy, p.sx, 0, cfg.cornerJawAngle, p, ax, ay);
                p.mouth = [ax, ay, bx, by];
            } else {
                const y = p.sy * HW;
                addPoint(-s, y, 'nose'); addPoint(s, y, 'nose');
                addJaw(-s, y, 1, 0, 0, p.sy, cfg.sideJawAngle, p, s, y);
                addJaw(s, y, -1, 0, 0, p.sy, cfg.sideJawAngle, p, -s, y);
                p.mouth = [-s, y, s, y];
            }
        });

        return {
            halfLength: HL, halfWidth: HW, R: cfg.ballR, segments, points, pockets,
            headX: -HL / 2, footX: HL / 2,             // head string and foot spot
            limitX: HL + cfg.railWidth, limitY: HW + cfg.railWidth,
        };
    }

    // ── World ─────────────────────────────────────────────────────────
    function ppCreateWorld(overrides) {
        const cfg = Object.assign({}, PP_DEFAULTS, overrides);
        return { cfg, table: ppBuildTable(cfg), balls: [], t: 0, log: [], escapes: 0 };
    }

    function ppMakeBall(id, x, y) {
        return { id, x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, q: [1, 0, 0, 0], state: 'stationary', pocket: -1 };
    }

    // Deep copy of the moving parts. cfg and the table are shared: they never change mid-shot.
    function ppCloneWorld(w) {
        return {
            cfg: w.cfg, table: w.table, t: w.t, log: [], escapes: w.escapes,
            balls: w.balls.map(b => Object.assign({}, b, { q: b.q.slice() })),
        };
    }

    // mulberry32. The physics never draws from it; racks and the CPU do, so a seed replays a frame.
    function ppRandom(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Standard 8-ball rack: apex on the foot spot, the 8 in the middle of the
    // third row, one solid and one stripe in the back corners. `rng` shuffles
    // the rest and jitters each ball by a hair so no two breaks are identical.
    function ppRack(w, rng) {
        const R = w.cfg.ballR, t = w.table;
        const gap = 0.02;                               // a hair between balls, so contacts are unambiguous
        const d = 2 * R + gap;
        const shuffle = a => {
            for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
            return a;
        };
        const solids = shuffle([1, 2, 3, 4, 5, 6, 7]);
        const stripes = shuffle([9, 10, 11, 12, 13, 14, 15]);
        const ids = new Array(15).fill(0);
        ids[4] = 8;
        if (rng() < 0.5) { ids[10] = solids.pop(); ids[14] = stripes.pop(); }
        else { ids[10] = stripes.pop(); ids[14] = solids.pop(); }
        const rest = shuffle(solids.concat(stripes));
        for (let i = 0; i < 15; i++) if (!ids[i]) ids[i] = rest.pop();

        w.balls = [ppMakeBall(0, t.headX, 0)];
        let i = 0;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col <= row; col++) {
                // ±0.004 u each way: under a quarter of the gap, so jitter never closes it.
                const jx = (rng() - 0.5) * 0.008, jy = (rng() - 0.5) * 0.008;
                w.balls.push(ppMakeBall(ids[i++], t.footX + row * d * Math.sqrt(3) / 2 + jx, (col - row / 2) * d + jy));
            }
        }
        w.t = 0; w.log = []; w.escapes = 0;
        return w;
    }

    // ── Small vector helpers (3D where spin needs it) ─────────────────
    const ppCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const ppDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    function ppMoving(b) { return b.state !== 'stationary' && b.state !== 'pocketed' && (b.vx !== 0 || b.vy !== 0); }

    // Contact-point slip against the cloth: u = v + ω × (−R ẑ).
    function ppSlip(b, R) { return [b.vx - R * b.wy, b.vy + R * b.wx]; }

    // Re-derives the motion state from v and ω. Called after every impulse.
    function ppClassify(b, R) {
        if (b.state === 'pocketed') return;
        if (Math.hypot(b.vx, b.vy) < PP_EPS_V) { b.vx = 0; b.vy = 0; }
        const u = ppSlip(b, R);
        if (Math.hypot(u[0], u[1]) > PP_EPS_V) { b.state = 'sliding'; return; }
        if (b.vx !== 0 || b.vy !== 0) {
            b.wx = -b.vy / R; b.wy = b.vx / R;                   // snap exactly onto natural roll
            b.state = 'rolling';
            return;
        }
        b.wx = 0; b.wy = 0;
        b.state = Math.abs(b.wz) > PP_EPS_W ? 'spinning' : 'stationary';
        if (b.state === 'stationary') b.wz = 0;
    }

    // Render-only: turns the orientation quaternion by ω over dt.
    function ppTurn(b, wx, wy, wz, dt) {
        const ang = Math.hypot(wx, wy, wz) * dt;
        if (ang < 1e-12) return;
        const s = Math.sin(ang / 2) / (ang / dt), c = Math.cos(ang / 2);
        const r = [c, wx * s, wy * s, wz * s], q = b.q;
        b.q = [
            r[0] * q[0] - r[1] * q[1] - r[2] * q[2] - r[3] * q[3],
            r[0] * q[1] + r[1] * q[0] + r[2] * q[3] - r[3] * q[2],
            r[0] * q[2] - r[1] * q[3] + r[2] * q[0] + r[3] * q[1],
            r[0] * q[3] + r[1] * q[2] - r[2] * q[1] + r[3] * q[0],
        ];
        const n = Math.hypot(b.q[0], b.q[1], b.q[2], b.q[3]);
        b.q = b.q.map(x => x / n);
    }

    // ω_z decays on its own in every state.
    function ppSpinDecay(b, cfg, dt) {
        if (!b.wz) return;
        const k = 5 * cfg.muSpin * cfg.gravity / (2 * cfg.ballR) * dt;
        b.wz = Math.abs(b.wz) <= k ? 0 : b.wz - Math.sign(b.wz) * k;
    }

    // Exact motion of one ball over dt, through any state changes on the way.
    function ppAdvanceBall(b, cfg, dt) {
        const R = cfg.ballR, g = cfg.gravity;
        let rem = dt, guard = 0;
        while (rem > 0 && guard++ < 8) {
            if (b.state === 'pocketed' || b.state === 'stationary') return;
            if (b.state === 'spinning') {
                ppTurn(b, 0, 0, b.wz, rem);
                ppSpinDecay(b, cfg, rem);
                if (!b.wz) b.state = 'stationary';
                return;
            }
            if (b.state === 'rolling') {
                const sp = Math.hypot(b.vx, b.vy), a = cfg.muRoll * g;
                if (sp === 0) { ppClassify(b, R); continue; }       // no direction to roll in
                const ux = b.vx / sp, uy = b.vy / sp;
                const tStop = sp / a, h = Math.min(rem, tStop);
                const sp2 = h === tStop ? 0 : sp - a * h;
                const dist = sp * h - 0.5 * a * h * h;
                const wz0 = b.wz;
                b.x += ux * dist; b.y += uy * dist;
                ppTurn(b, -(uy * (sp + sp2) / 2) / R, (ux * (sp + sp2) / 2) / R, wz0, h);
                ppSpinDecay(b, cfg, h);
                b.vx = ux * sp2; b.vy = uy * sp2;
                b.wx = -b.vy / R; b.wy = b.vx / R;
                rem -= h;
                if (h === tStop) { b.vx = 0; b.vy = 0; ppClassify(b, R); }
                continue;
            }
            // sliding
            const u = ppSlip(b, R), us = Math.hypot(u[0], u[1]);
            if (us === 0) { ppClassify(b, R); if (b.state === 'sliding') b.state = 'rolling'; continue; }
            const ux = u[0] / us, uy = u[1] / us;
            const a = cfg.muSlide * g, k = 5 * a / (2 * R);
            const tRoll = 2 * us / (7 * a), h = Math.min(rem, tRoll);
            const wx0 = b.wx, wy0 = b.wy;
            b.x += b.vx * h - 0.5 * a * ux * h * h;
            b.y += b.vy * h - 0.5 * a * uy * h * h;
            b.vx -= a * ux * h; b.vy -= a * uy * h;
            b.wx -= k * uy * h; b.wy += k * ux * h;
            ppTurn(b, (wx0 + b.wx) / 2, (wy0 + b.wy) / 2, b.wz, h);
            ppSpinDecay(b, cfg, h);
            rem -= h;
            if (h === tRoll) {
                // Slip is gone: land exactly on natural roll, or at rest. The
                // speed is settled first and the spin derived from it, so a
                // crawl that rounds to zero cannot leave spin behind that
                // reads as fresh slip (which once left a ball 'rolling' at v = 0).
                if (Math.hypot(b.vx, b.vy) < PP_EPS_V) { b.vx = 0; b.vy = 0; }
                b.wx = -b.vy / R; b.wy = b.vx / R;
                if (b.vx || b.vy) b.state = 'rolling';
                else if (Math.abs(b.wz) > PP_EPS_W) b.state = 'spinning';
                else { b.state = 'stationary'; b.wz = 0; }
            }
        }
    }

    // ── Time of impact (linear motion over the remaining sub-step) ─────
    // Deceleration over a 4 ms sub-step moves a ball by < 0.01 u, so a straight
    // line is exact enough to find the event; the ball is then advanced exactly.
    function ppToiCircle(px, py, vx, vy, cx, cy, r) {
        const ox = px - cx, oy = py - cy;
        const a = vx * vx + vy * vy;
        if (a < 1e-12) return Infinity;
        const b = 2 * (ox * vx + oy * vy);
        if (b >= 0) return Infinity;                     // not approaching
        const c = ox * ox + oy * oy - r * r;
        if (c <= 0) return 0;                            // already touching and closing
        const disc = b * b - 4 * a * c;
        if (disc < 0) return Infinity;
        return (-b - Math.sqrt(disc)) / (2 * a);
    }

    function ppToiSegment(b, s, R) {
        const vn = b.vx * s.nx + b.vy * s.ny;
        if (vn >= 0) return Infinity;
        const d0 = (b.x - s.ax) * s.nx + (b.y - s.ay) * s.ny - R;
        if (d0 < -R) return Infinity;                    // behind the segment
        const t = d0 <= 0 ? 0 : -d0 / vn;
        const along = (b.x + b.vx * t - s.ax) * s.tx + (b.y + b.vy * t - s.ay) * s.ty;
        return along >= 0 && along <= s.len ? t : Infinity;
    }

    // ── Collision response ────────────────────────────────────────────
    // Unit mass throughout; I = (2/5) R².
    function ppResolveBalls(A, B, cfg) {
        const R = cfg.ballR, I = 0.4 * R * R;
        let nx = B.x - A.x, ny = B.y - A.y;
        const dist = Math.hypot(nx, ny) || 1;
        nx /= dist; ny /= dist;
        const vrel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
        if (vrel <= 0) return false;
        const jn = (1 + cfg.ballE) / 2 * vrel;
        A.vx -= jn * nx; A.vy -= jn * ny;
        B.vx += jn * nx; B.vy += jn * ny;

        // Throw: friction at the contact point, capped at the impulse that stops the slip.
        const n = [nx, ny, 0];
        const rA = [R * nx, R * ny, 0], rB = [-R * nx, -R * ny, 0];
        const cA = ppCross([A.wx, A.wy, A.wz], rA), cB = ppCross([B.wx, B.wy, B.wz], rB);
        const u = [A.vx + cA[0] - B.vx - cB[0], A.vy + cA[1] - B.vy - cB[1], cA[2] - cB[2]];
        const un = ppDot(u, n);
        const ut = [u[0] - un * nx, u[1] - un * ny, u[2]];
        const uts = Math.hypot(ut[0], ut[1], ut[2]);
        if (uts > 1e-9) {
            const f = Math.min(cfg.muBall * jn, uts / 7);
            const F = [-f * ut[0] / uts, -f * ut[1] / uts, -f * ut[2] / uts];   // on A; B gets −F
            A.vx += F[0]; A.vy += F[1];
            B.vx -= F[0]; B.vy -= F[1];
            const tA = ppCross(rA, F), tB = ppCross(rB, [-F[0], -F[1], -F[2]]);
            A.wx += tA[0] / I; A.wy += tA[1] / I; A.wz += tA[2] / I;
            B.wx += tB[0] / I; B.wy += tB[1] / I; B.wz += tB[2] / I;
        }
        ppClassify(A, R); ppClassify(B, R);
        return true;
    }

    // ── Touching clusters (the break) ──────────────────────────────────
    // Resolving contacts one pair at a time is right for two balls, and for a
    // line of balls (it gives Newton's cradle), but wrong for a tight rack:
    // there the apex compresses into both balls behind it at once, each of
    // those pushes on two more, and the impulse fans out through the whole
    // triangle. Pairwise, it runs down the two edges instead and only the back
    // corners move. So when a ball hits a group of touching balls, the contact
    // itself is simulated: stiff springs over the ~0.1 ms of compression, with
    // damping chosen to give the ball–ball restitution. Only the velocity
    // change is kept; positions snap back, so at table scale the impact is
    // still instantaneous. Spin and throw are left to the pairwise path.
    const PP_CLUSTER_GAP = 0.5;       // balls closer than this count as touching, table units
    const PP_CONTACT_TIME = 1e-4;     // duration of one ball–ball contact, s
    const PP_CLUSTER_MAX_T = 5e-3;    // give up on the micro-sim after this, s

    function ppCluster(w, A, B) {
        const R2 = 2 * w.cfg.ballR + PP_CLUSTER_GAP;
        const live = w.balls.filter(b => b.state !== 'pocketed');
        const members = [A, B], seen = new Set([A, B]);
        for (let i = 0; i < members.length; i++) {
            const m = members[i];
            for (const b of live) {
                if (seen.has(b)) continue;
                if ((b.x - m.x) ** 2 + (b.y - m.y) ** 2 <= R2 * R2) { seen.add(b); members.push(b); }
            }
        }
        return members;
    }

    function ppResolveCluster(w, members) {
        const cfg = w.cfg, R = cfg.ballR, n = members.length;
        const meff = 0.5;                                              // two unit masses
        const k = Math.PI * Math.PI * meff / (PP_CONTACT_TIME * PP_CONTACT_TIME);
        const L = Math.log(cfg.ballE);
        const zeta = -L / Math.sqrt(Math.PI * Math.PI + L * L);
        const c = 2 * zeta * Math.sqrt(k * meff);
        const dt = PP_CONTACT_TIME / 30;                               // 30 steps per contact
        const x = members.map(b => b.x), y = members.map(b => b.y);
        const vx = members.map(b => b.vx), vy = members.map(b => b.vy);
        const ke = () => vx.reduce((a, v, i) => a + v * v + vy[i] * vy[i], 0);
        const ke0 = ke();
        const touched = new Set(), order = [];
        let quiet = 0, t = 0, contacted = false;
        const fx = new Float64Array(n), fy = new Float64Array(n);
        while (t < PP_CLUSTER_MAX_T) {
            fx.fill(0); fy.fill(0);
            let any = false;
            for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
                const dx = x[j] - x[i], dy = y[j] - y[i];
                const d2 = dx * dx + dy * dy;
                if (d2 >= 4 * R * R) continue;
                const d = Math.sqrt(d2) || 1e-9, nx = dx / d, ny = dy / d;
                const sep = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny;   // + when separating
                const f = Math.max(0, k * (2 * R - d) - c * sep);
                fx[i] -= f * nx; fy[i] -= f * ny; fx[j] += f * nx; fy[j] += f * ny;
                any = true;
                const key = i * n + j;
                if (!touched.has(key)) { touched.add(key); order.push([members[i].id, members[j].id]); }
            }
            for (let i = 0; i < n; i++) {
                vx[i] += fx[i] * dt; vy[i] += fy[i] * dt;
                x[i] += vx[i] * dt; y[i] += vy[i] * dt;
            }
            t += dt;
            if (any) { contacted = true; quiet = 0; } else if (contacted && ++quiet > 20) break;
        }
        // Semi-implicit Euler with damping dissipates, but guard the invariant
        // anyway: an impact never adds kinetic energy.
        const ke1 = ke();
        const s = ke1 > ke0 && ke1 > 0 ? Math.sqrt(ke0 / ke1) : 1;
        members.forEach((b, i) => {
            b.vx = vx[i] * s; b.vy = vy[i] * s;
            ppClassify(b, R);
        });
        order.forEach(([a, b]) => w.log.push({ type: 'ball', t: w.t, a, b }));
    }

    // Cushion or jaw (segment face, or a nose/jaw tip). n points from the
    // cushion into the ball. The cushion nose meets the ball above its
    // centre, so the contact sits noseRise·R up and friction there couples
    // English and follow/draw into the rebound.
    function ppResolveCushion(b, nx, ny, cfg) {
        const R = cfg.ballR, I = 0.4 * R * R;
        const vn = b.vx * nx + b.vy * ny;
        if (vn >= 0) return false;
        const jn = -(1 + cfg.cushionE) * vn;
        b.vx += jn * nx; b.vy += jn * ny;

        const s = cfg.noseRise, c = Math.sqrt(1 - s * s);
        const r = [-nx * c * R, -ny * c * R, s * R];
        const N = [-r[0] / R, -r[1] / R, -r[2] / R];
        const cw = ppCross([b.wx, b.wy, b.wz], r);
        const u = [b.vx + cw[0], b.vy + cw[1], cw[2]];
        const uN = ppDot(u, N);
        const ut = [u[0] - uN * N[0], u[1] - uN * N[1], u[2] - uN * N[2]];
        const uts = Math.hypot(ut[0], ut[1], ut[2]);
        if (uts > 1e-9) {
            const t = [ut[0] / uts, ut[1] / uts, ut[2] / uts];
            const rt = ppDot(r, t);
            const K = 1 + (R * R - rt * rt) / I;            // inverse effective mass along t
            const f = Math.min(cfg.muCushion * jn, uts / K);
            const F = [-f * t[0], -f * t[1], -f * t[2]];
            b.vx += F[0]; b.vy += F[1];                      // the vertical part is absorbed by the table
            const tq = ppCross(r, F);
            b.wx += tq[0] / I; b.wy += tq[1] / I; b.wz += tq[2] / I;
        }
        ppClassify(b, R);
        return true;
    }

    // ── Cue strike ────────────────────────────────────────────────────
    // shot = { angle (rad, world frame), speed (u/s), tipX, tipY }. tipX is
    // side offset (+ = right of centre from the shooter's view), tipY is
    // height (+ = above centre, 0.4 = natural roll), both in R, clamped to
    // the miscue circle. Right English is ω_z > 0 and squirts the ball left.
    function ppStrike(w, shot) {
        const cfg = w.cfg, R = cfg.ballR;
        const cue = w.balls.find(b => b.id === 0);
        let a = shot.tipX || 0, bt = shot.tipY || 0;
        const m = Math.hypot(a, bt);
        if (m > cfg.maxTip) { a *= cfg.maxTip / m; bt *= cfg.maxTip / m; }
        const v0 = Math.max(0, Math.min(cfg.maxSpeed, shot.speed));
        const th = shot.angle + cfg.squirt * a;                 // squirt: away from the English
        const dx = Math.cos(shot.angle), dy = Math.sin(shot.angle);
        const k = 5 * v0 / (2 * R);
        cue.vx = Math.cos(th) * v0; cue.vy = Math.sin(th) * v0;
        cue.wx = -dy * k * bt; cue.wy = dx * k * bt; cue.wz = k * a;
        ppClassify(cue, R);
        w.log.push({ type: 'strike', t: w.t, ball: 0, angle: shot.angle, speed: v0, tipX: a, tipY: bt });
        return cue;
    }

    // ── Stepping ──────────────────────────────────────────────────────
    function ppPocket(w, b, pi) {
        b.state = 'pocketed'; b.pocket = pi;
        b.vx = b.vy = b.wx = b.wy = b.wz = 0;
        w.log.push({ type: 'pocket', t: w.t, ball: b.id, pocket: pi });
    }

    // Anything inside a capture circle drops; anything that somehow left the
    // table is dropped into the nearest pocket and counted, so a geometry
    // bug is loud in the tests instead of a ball vanishing off-screen.
    function ppCheckPockets(w) {
        const t = w.table;
        for (const b of w.balls) {
            if (b.state === 'pocketed') continue;
            let hit = -1;
            for (let i = 0; i < t.pockets.length; i++) {
                const p = t.pockets[i];
                if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < p.r * p.r) { hit = i; break; }
            }
            if (hit === -1 && (Math.abs(b.x) > t.limitX || Math.abs(b.y) > t.limitY)) {
                let best = Infinity;
                t.pockets.forEach((p, i) => { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < best) { best = d; hit = i; } });
                w.escapes++;
            }
            if (hit !== -1) ppPocket(w, b, hit);
        }
    }

    // Earliest event in [0, horizon] among moving balls, or null.
    function ppNextEvent(w, horizon) {
        const R = w.cfg.ballR, t = w.table, balls = w.balls;
        let best = { t: horizon, kind: null };
        for (let i = 0; i < balls.length; i++) {
            const A = balls[i];
            if (A.state === 'pocketed') continue;
            const aMoves = ppMoving(A);
            // Rails, tips and pockets all lie on or beyond the cushion lines: skip
            // them for a ball that cannot get that far within the horizon.
            const reach = R + Math.hypot(A.vx, A.vy) * horizon + 1;
            const nearRail = Math.abs(A.x) > t.halfLength - reach || Math.abs(A.y) > t.halfWidth - reach;
            if (aMoves && nearRail) {
                for (const s of t.segments) {
                    const tt = ppToiSegment(A, s, R);
                    if (tt < best.t) best = { t: tt, kind: 'cushion', a: A, nx: s.nx, ny: s.ny, seg: s };
                }
                for (const p of t.points) {
                    const tt = ppToiCircle(A.x, A.y, A.vx, A.vy, p.x, p.y, R);
                    if (tt < best.t) best = { t: tt, kind: 'point', a: A, p };
                }
                for (let k = 0; k < t.pockets.length; k++) {
                    const p = t.pockets[k];
                    const tt = ppToiCircle(A.x, A.y, A.vx, A.vy, p.x, p.y, p.r);
                    if (tt < best.t) best = { t: tt, kind: 'pocket', a: A, pocket: k };
                }
            }
            for (let j = i + 1; j < balls.length; j++) {
                const B = balls[j];
                if (B.state === 'pocketed' || (!aMoves && !ppMoving(B))) continue;
                const tt = ppToiCircle(A.x, A.y, A.vx - B.vx, A.vy - B.vy, B.x, B.y, 2 * R);
                if (tt < best.t) best = { t: tt, kind: 'ball', a: A, b: B };
            }
        }
        return best.kind ? best : null;
    }

    function ppAdvanceAll(w, dt) {
        if (dt <= 0) return;
        for (const b of w.balls) ppAdvanceBall(b, w.cfg, dt);
        w.t += dt;
    }

    function ppSubStep(w, h) {
        const cfg = w.cfg, R = cfg.ballR;
        let t = 0, events = 0;
        while (t < h - PP_EPS_T) {
            const ev = ppNextEvent(w, h - t);
            if (!ev || events >= cfg.maxEventsPerSubStep) { ppAdvanceAll(w, h - t); break; }
            ppAdvanceAll(w, ev.t);
            t += ev.t;
            events++;
            const A = ev.a;
            if (A.state === 'pocketed') continue;
            // The linear TOI slightly overshoots a decelerating ball, so a contact
            // counts within PP_CONTACT of touching; beyond that the balls never met.
            if (ev.kind === 'ball') {
                const B = ev.b;
                if (B.state === 'pocketed') continue;
                if (Math.hypot(B.x - A.x, B.y - A.y) <= 2 * R + PP_CONTACT) {
                    const group = ppCluster(w, A, B);
                    if (group.length > 2) ppResolveCluster(w, group);
                    else if (ppResolveBalls(A, B, cfg)) w.log.push({ type: 'ball', t: w.t, a: A.id, b: B.id });
                }
            } else if (ev.kind === 'cushion') {
                const s = ev.seg;
                const d = (A.x - s.ax) * s.nx + (A.y - s.ay) * s.ny;
                if (d <= R + PP_CONTACT && ppResolveCushion(A, s.nx, s.ny, cfg)) {
                    w.log.push({ type: 'cushion', t: w.t, ball: A.id, kind: s.kind });
                }
            } else if (ev.kind === 'point') {
                const p = ev.p;
                const dx = A.x - p.x, dy = A.y - p.y, d = Math.hypot(dx, dy);
                if (d <= R + PP_CONTACT && d > 0 && ppResolveCushion(A, dx / d, dy / d, cfg)) {
                    w.log.push({ type: 'cushion', t: w.t, ball: A.id, kind: p.kind });
                }
            } else if (ev.kind === 'pocket') {
                // Resolved here rather than by the distance test: at the exact
                // boundary a float can land a hair outside and stall the loop.
                const p = w.table.pockets[ev.pocket];
                if (Math.hypot(A.x - p.x, A.y - p.y) <= p.r + PP_CONTACT) ppPocket(w, A, ev.pocket);
            }
            ppCheckPockets(w);
        }
        ppSeparate(w);
        ppCheckPockets(w);
    }

    // The time of impact assumes straight lines over the sub-step. When a front
    // ball decelerates harder than the ball behind it (or an over-spun ball
    // speeds up into a rail), contact comes up to ~0.015 u early and the pair
    // ends the sub-step slightly interpenetrating. This puts them back to
    // touching, positions only, and resolves the contact if they are still
    // closing, so nothing ever overlaps at a frame boundary.
    // Pushing one pair apart can press a ball in a packed group into a third,
    // so the pass repeats until nothing overlaps (a few rounds at most).
    // Only balls that moved this sub-step (or were pushed by this pass) can
    // be overlapping anything, so resting balls are skipped entirely.
    function ppSeparate(w) {
        const cfg = w.cfg, R = cfg.ballR, D = 2 * R, t = w.table;
        const live = w.balls.filter(b => b.state !== 'pocketed');
        const active = live.map(ppMoving);
        if (!active.some(Boolean)) return;
        for (let pass = 0; pass < 8; pass++) {
            let moved = false;
            for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
                if (!active[i] && !active[j]) continue;
                const A = live[i], B = live[j];
                const dx = B.x - A.x, dy = B.y - A.y;
                if (dx >= D || dx <= -D || dy >= D || dy <= -D) continue;
                const d = Math.hypot(dx, dy);
                if (d >= D - 1e-9 || d === 0) continue;
                const nx = dx / d, ny = dy / d, push = (D - d) / 2;
                A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
                active[i] = active[j] = true;
                moved = true;
                if (ppResolveBalls(A, B, cfg)) w.log.push({ type: 'ball', t: w.t, a: A.id, b: B.id });
            }
            for (let i = 0; i < live.length; i++) {
                if (!active[i]) continue;
                const b = live[i];
                // Cushions only matter within a ball's reach of the rails.
                if (Math.abs(b.x) < t.halfLength - R && Math.abs(b.y) < t.halfWidth - R) continue;
                for (const s of t.segments) {
                    const along = (b.x - s.ax) * s.tx + (b.y - s.ay) * s.ty;
                    if (along < 0 || along > s.len) continue;
                    const d = (b.x - s.ax) * s.nx + (b.y - s.ay) * s.ny;
                    if (d >= R - 1e-9 || d < -R) continue;
                    b.x += s.nx * (R - d); b.y += s.ny * (R - d);
                    moved = true;
                    if (ppResolveCushion(b, s.nx, s.ny, cfg)) w.log.push({ type: 'cushion', t: w.t, ball: b.id, kind: s.kind });
                }
                for (const p of t.points) {
                    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
                    if (d >= R - 1e-9 || d === 0) continue;
                    b.x = p.x + dx / d * R; b.y = p.y + dy / d * R;
                    moved = true;
                    if (ppResolveCushion(b, dx / d, dy / d, cfg)) w.log.push({ type: 'cushion', t: w.t, ball: b.id, kind: p.kind });
                }
            }
            if (!moved) break;
        }
    }

    // One logic frame. The game calls this at 60 Hz with dt = 1/60.
    function ppStep(w, dt) {
        const n = w.cfg.subSteps, h = dt / n;
        for (let i = 0; i < n; i++) ppSubStep(w, h);
    }

    function ppSettled(w) {
        return w.balls.every(b => b.state === 'pocketed' || (b.vx === 0 && b.vy === 0));
    }

    // Runs a shot to rest (or maxT seconds). Returns simulated seconds.
    function ppSimulate(w, maxT) {
        const cap = maxT || 60, t0 = w.t;
        while (!ppSettled(w) && w.t - t0 < cap) ppStep(w, 1 / 60);
        for (const b of w.balls) if (b.state === 'spinning') { b.wz = 0; b.state = 'stationary'; }
        return w.t - t0;
    }

    // Kinetic energy, translational + rotational, unit mass.
    function ppEnergy(w) {
        const I = 0.4 * w.cfg.ballR * w.cfg.ballR;
        let e = 0;
        for (const b of w.balls) {
            if (b.state === 'pocketed') continue;
            e += 0.5 * (b.vx * b.vx + b.vy * b.vy) + 0.5 * I * (b.wx * b.wx + b.wy * b.wy + b.wz * b.wz);
        }
        return e;
    }
