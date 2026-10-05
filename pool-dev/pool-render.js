    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — RENDERER (v2)
    // ═══════════════════════════════════════════════════════════════════
    // Canvas2D, painted in layers:
    //   1  table shadow, apron, felt
    //   2  rail inner face, jaw faces, nose faces
    //   3  cushion tops, rail wood, lip, diamonds, spots
    //   4  pocket rims, then the pocket shafts
    //   5  kitchen tint, head string
    //   6  ball shadows, guides
    //   7  balls, far to near
    //   8  ghost ball, cue, called-pocket rings, ball-in-hand ghost and hand
    // Layers 1–4 depend only on the camera, so they can be cached.
    // Pool's pockets and ball markings are clipped as polygons (Sutherland–Hodgman),
    // not ctx.clip(), so the tests' headless rasterizer can draw them.
    // Table materials and ball colours are physical; theme colours come in via scene.theme.

    const PG_RAIL_Z = 16;              // rail top
    const PG_NOSE_Z = 10;              // cushion nose height
    const PG_POCKET_FLOOR = -64;
    // Pool's heights unless the table sets its own. Sizes drawn around a ball (cue,
    // shadow, rings) scale by pgK = R / 14, so pool's are unscaled.
    const pgRailZ = cfg => (cfg.railZ !== undefined ? cfg.railZ : PG_RAIL_Z);
    const pgNoseZ = cfg => (cfg.noseZ !== undefined ? cfg.noseZ : PG_NOSE_Z);
    const pgK = cfg => cfg.ballR / 14;

    const PG_FELTS = {
        green:     { felt: ['#2E8F70', '#1D6E55', '#114534'], cushion: '#185F4B', jaw: '#0F4234', nose: '#0E3B2F' },
        red:       { felt: ['#9C3E3B', '#7A2C2B', '#491719'], cushion: '#6B2626', jaw: '#4E1A1B', nose: '#451617' },
        blue:      { felt: ['#3272AB', '#245B8D', '#143659'], cushion: '#1F4F7D', jaw: '#163C5F', nose: '#133453' },
        lightgrey: { felt: ['#A3AEB8', '#86929D', '#59636D'], cushion: '#707C87', jaw: '#56606A', nose: '#4C565F' },
    };
    const PG_BALL_COLOURS = { 1: '#E9B825', 2: '#2457C5', 3: '#D2352B', 4: '#6A3FA0', 5: '#EE7A2E', 6: '#1F8A4C', 7: '#8C2A20', 8: '#141516' };
    // Each game's ball looks by id: { cue }, else { colour, stripe, number }. The HUD's
    // dots read it too. Snooker ids: a colour's value (yellow 2 … black 7), reds 8 upward.
    const PG_SNOOKER_COLOURS = { 2: '#E8C21E', 3: '#1F7A3F', 4: '#6B3F22', 5: '#1F4FB5', 6: '#E88FA8', 7: '#121314' };
    const PG_SNOOKER_RED = '#B3202A';
    const PG_LOOKS = {
        pool: id => (id === 0 ? { cue: true } : { colour: PG_BALL_COLOURS[id > 8 ? id - 8 : id], stripe: id > 8, number: true }),
        snooker: id => (id === 0 ? { cue: true } : { colour: id >= 8 ? PG_SNOOKER_RED : PG_SNOOKER_COLOURS[id] || PG_SNOOKER_RED, stripe: false, number: false }),
    };
    const pgLookCache = {};
    function pgBallLook(game, id) {
        const g = PG_LOOKS[game] ? game : 'pool', key = g + '|' + id;
        return pgLookCache[key] || (pgLookCache[key] = PG_LOOKS[g](id));
    }
    const PG_IVORY = '#F3EEE2';
    const PG_GUIDE = '#F4F1E8';
    const PG_THEME = { accent: '#f093fb', hot: '#ff5d73', font: 'Inter, system-ui, sans-serif' };
    const PG_HAND = 'M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15';
    const PG_STRIPE = 0.46;            // stripe caps start 0.46 R from the centre (a 27–73% band)
    const PG_NUMBER = 0.888;           // number disc: cos of its angular radius (0.46 of the diameter across)

    // ── Polygon helpers ───────────────────────────────────────────────
    function pgCirc(cx, cy, r, z, k) {
        const o = [];
        for (let i = 0; i < k; i++) { const t = i / k * Math.PI * 2; o.push([cx + r * Math.cos(t), cy + r * Math.sin(t), z]); }
        return o;
    }
    const pgRect = (hx, hy, z) => [[-hx, -hy, z], [hx, -hy, z], [hx, hy, z], [-hx, hy, z]];

    function pgTrace(ctx, poly) {
        if (!poly || poly.length < 3) return;
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
        ctx.closePath();
    }
    function pgFill(ctx, polys, style, alpha) {
        ctx.beginPath();
        polys.forEach(p => pgTrace(ctx, p));
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.fillStyle = style;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    function pgBounds(polys) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        polys.forEach(p => p.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }));
        return { x: x0, y: y0, w: Math.max(1e-6, x1 - x0), h: Math.max(1e-6, y1 - y0) };
    }

    // Sutherland–Hodgman: `subject` clipped to the convex polygon `clip`.
    function pgClipConvex(subject, clip) {
        if (!subject || subject.length < 3 || !clip || clip.length < 3) return [];
        let area = 0;
        for (let i = 0; i < clip.length; i++) { const a = clip[i], b = clip[(i + 1) % clip.length]; area += a[0] * b[1] - b[0] * a[1]; }
        const sg = area >= 0 ? 1 : -1;
        let out = subject;
        for (let i = 0; i < clip.length && out.length; i++) {
            const A = clip[i], B = clip[(i + 1) % clip.length];
            const side = p => sg * ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]));
            const cut = (S, E) => {
                const s = side(S), e = side(E), t = s / (s - e);
                return [S[0] + t * (E[0] - S[0]), S[1] + t * (E[1] - S[1])];
            };
            const input = out; out = [];
            for (let j = 0; j < input.length; j++) {
                const S = input[(j + input.length - 1) % input.length], E = input[j];
                const ein = side(E) >= 0, sin = side(S) >= 0;
                if (ein) { if (!sin) out.push(cut(S, E)); out.push(E); }
                else if (sin) out.push(cut(S, E));
            }
        }
        return out;
    }

    function pgHull(pts) {
        const P = pts.map(q => [q[0], q[1]]).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
        if (P.length < 3) return P;
        const cr = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
        const lo = [], up = [];
        P.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
        for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
        return lo.slice(0, -1).concat(up.slice(0, -1));
    }

    function pgRgb(hex, k) {
        const n = parseInt(hex.slice(1), 16);
        const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.min(255, Math.round(v * k)));
        return 'rgb(' + c.join(', ') + ')';
    }
    function pgRgba(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + a + ')';
    }

    // ── Layers 1–4: the table ─────────────────────────────────────────
    // The cushions, from the physics config so they match the colliders:
    // { top, nose: [a, b], ends: [[p, q], …] } (nose face drops to the felt; end faces
    // are jaw-coloured). Pool's are quads [nose start, nose end, rail end, rail start].
    function pgCushions(cfg) {
        if (cfg.pocketStyle === 'rounded') return pgRoundedCushions(cfg);
        const HL = cfg.halfLength, HW = cfg.halfWidth, CU = cfg.cushionWidth;
        const CB = cfg.cornerRailEnd, CN = cfg.cornerNose, SB = cfg.sideRailEnd, SN = cfg.sideNose;
        const N = pgNoseZ(cfg), T = pgRailZ(cfg), q = [];
        [-1, 1].forEach(sy => {
            [[-HL + CB, -SB, -HL + CN, -SN], [SB, HL - CB, SN, HL - CN]].forEach(g => {
                q.push([[g[2], sy * HW, N], [g[3], sy * HW, N], [g[1], sy * (HW + CU), T], [g[0], sy * (HW + CU), T]]);
            });
        });
        [-1, 1].forEach(sx => {
            q.push([[sx * HL, -HW + CN, N], [sx * HL, HW - CN, N], [sx * (HL + CU), HW - CB, T], [sx * (HL + CU), -HW + CB, T]]);
        });
        return q.map(c => ({ top: c, nose: [c[0], c[1]], ends: [[c[0], c[3]], [c[1], c[2]]] }));
    }

    // Snooker's cushions, matching ppBuildRoundedTable; the top rises from nose to rail height.
    function pgRoundedCushions(cfg) {
        const HL = cfg.halfLength, HW = cfg.halfWidth, CU = cfg.cushionWidth, RHO = cfg.noseRound;
        const c = cfg.cornerNose, s = cfg.sideNose, N = pgNoseZ(cfg), T = pgRailZ(cfg), NA = 8;
        const out = [];
        // One run from u = a to b; dirA/dirB point toward each end's pocket, jbA/jbB are the
        // jaw leans; map(u, depth, z) is the point that fraction of the way to the rail.
        const run = (a, b, dirA, dirB, jbA, jbB, map) => {
            const at = (u, dep) => map(u, dep, N + (T - N) * dep);
            const end = (e, dir, jb) => {
                const pts = [];
                for (let i = 0; i <= NA; i++) { const t = i / NA * Math.PI / 2; pts.push(at(e - dir * RHO + dir * RHO * Math.sin(t), RHO * (1 - Math.cos(t)) / CU)); }
                pts.push(at(e + dir * jb, 1));
                return pts;
            };
            const sa = end(a, dirA, jbA), sb = end(b, dirB, jbB);
            const top = sb.concat(sa.slice().reverse());
            const ends = [];
            [sa, sb].forEach(p => { for (let i = 0; i < p.length - 1; i++) ends.push([p[i], p[i + 1]]); });
            out.push({ top, nose: [sa[0], sb[0]], ends });
        };
        const cj = cfg.cornerJawBack, sj = cfg.sideJawBack;
        [-1, 1].forEach(sy => {
            const m = (u, dep, z) => [u, sy * (HW + dep * CU), z];
            run(-HL + c, -s, -1, 1, cj, sj, m);
            run(s, HL - c, -1, 1, sj, cj, m);
        });
        [-1, 1].forEach(sx => run(-HW + c, HW - c, -1, 1, cj, cj, (u, dep, z) => [sx * (HL + dep * CU), u, z]));
        return out;
    }

    // The table's own markings (snooker), else pool's foot and head spots.
    //   { spots: [{ x, y, r }], lines: [[[x, y], [x, y]]], arcs: [{ x, y, r, a0, a1 }] }
    function pgMarks(table) {
        return table.marks || { spots: [{ x: table.footX, y: 0, r: 3 }, { x: table.headX, y: 0, r: 3 }], lines: [], arcs: [] };
    }
    function pgDrawMarks(ctx, view, marks) {
        const lines = (marks.lines || []).slice();
        (marks.arcs || []).forEach(a => {
            const n = Math.max(8, Math.ceil(Math.abs(a.a1 - a.a0) / 0.08)), pts = [];
            for (let i = 0; i <= n; i++) { const t = a.a0 + (a.a1 - a.a0) * i / n; pts.push([a.x + a.r * Math.cos(t), a.y + a.r * Math.sin(t)]); }
            lines.push(pts);
        });
        lines.forEach(pts => pgStrokeLine(ctx, view, pts, 0.1, pgRgba(PG_IVORY, 0.35), 1, null, false));
        if (marks.spots && marks.spots.length) pgFill(ctx, marks.spots.map(s => pcPoly(view, pgCirc(s.x, s.y, s.r, 0.1, 10))), PG_IVORY, 0.35);
    }

    function pgDrawTable(ctx, view, cfg, table, feltName) {
        const P = pts => pcPoly(view, pts);
        const mat = PG_FELTS[feltName] || PG_FELTS.green;
        const HL = cfg.halfLength, HW = cfg.halfWidth, CU = cfg.cushionWidth, RL = cfg.railWidth - cfg.cushionWidth;
        const TZ = pgRailZ(cfg), OX = HL + CU + RL, OY = HW + CU + RL, IX = HL + CU, IY = HW + CU;
        const eye = view.eye;

        // 1. Shadow, apron, felt.
        const shadow = view.ortho ? P(pgRect(OX + 4, OY + 4, -1).map(p => [p[0], p[1] - 12, p[2]])) : P(pgRect(OX + 30, OY + 30, -90));
        ctx.save();
        if ('filter' in ctx) ctx.filter = 'blur(9px)';
        pgFill(ctx, [shadow], '#000000', 0.55);
        ctx.restore();
        if (eye) {
            const lo = -46, ap = [];
            if (eye[0] > OX) ap.push(P([[OX, -OY, TZ], [OX, OY, TZ], [OX, OY, lo], [OX, -OY, lo]]));
            if (eye[0] < -OX) ap.push(P([[-OX, -OY, TZ], [-OX, OY, TZ], [-OX, OY, lo], [-OX, -OY, lo]]));
            if (eye[1] > OY) ap.push(P([[-OX, OY, TZ], [OX, OY, TZ], [OX, OY, lo], [-OX, OY, lo]]));
            if (eye[1] < -OY) ap.push(P([[-OX, -OY, TZ], [OX, -OY, TZ], [OX, -OY, lo], [-OX, -OY, lo]]));
            pgFill(ctx, ap, '#26160E');
        }
        const felt = P(pgRect(IX, IY, 0));
        if (felt.length >= 3) {
            // Radial at (50%, 46%), r 62% of the felt's bounding box.
            const b = pgBounds([felt]);
            ctx.save();
            ctx.beginPath(); pgTrace(ctx, felt);
            ctx.translate(b.x + b.w / 2, b.y + b.h * 0.46);
            ctx.scale(1, b.h / b.w);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.62 * b.w);
            g.addColorStop(0, mat.felt[0]); g.addColorStop(0.6, mat.felt[1]); g.addColorStop(1, mat.felt[2]);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.restore();
        }

        // 2. Rail inner faces, jaw faces, nose faces.
        const cush = pgCushions(cfg);
        if (eye) {
            const ri = [];
            if (eye[0] < IX) ri.push(P([[IX, -IY, TZ], [IX, IY, TZ], [IX, IY, 0], [IX, -IY, 0]]));
            if (eye[0] > -IX) ri.push(P([[-IX, -IY, TZ], [-IX, IY, TZ], [-IX, IY, 0], [-IX, -IY, 0]]));
            if (eye[1] < IY) ri.push(P([[-IX, IY, TZ], [IX, IY, TZ], [IX, IY, 0], [-IX, IY, 0]]));
            if (eye[1] > -IY) ri.push(P([[-IX, -IY, TZ], [IX, -IY, TZ], [IX, -IY, 0], [-IX, -IY, 0]]));
            pgFill(ctx, ri, '#24150D');
            const jaws = [];
            cush.forEach(c => c.ends.forEach(([p, q]) => jaws.push(P([p, q, [q[0], q[1], 0], [p[0], p[1], 0]]))));
            pgFill(ctx, jaws, mat.jaw);
        }
        pgFill(ctx, cush.map(c => P([c.nose[0], c.nose[1], [c.nose[1][0], c.nose[1][1], 0], [c.nose[0][0], c.nose[0][1], 0]])), mat.nose);

        // 3. Cushion tops, rail wood, lip, diamonds, spots.
        pgFill(ctx, cush.map(c => P(c.top)), mat.cushion);
        const rails = [
            P([[-OX, OY, TZ], [OX, OY, TZ], [IX, IY, TZ], [-IX, IY, TZ]]),
            P([[OX, OY, TZ], [OX, -OY, TZ], [IX, -IY, TZ], [IX, IY, TZ]]),
            P([[OX, -OY, TZ], [-OX, -OY, TZ], [-IX, -IY, TZ], [IX, -IY, TZ]]),
            P([[-OX, -OY, TZ], [-OX, OY, TZ], [-IX, IY, TZ], [-IX, -IY, TZ]]),
        ];
        const rb = pgBounds(rails.filter(p => p.length >= 3));
        if (isFinite(rb.x)) {
            const wood = ctx.createLinearGradient(rb.x, rb.y, rb.x + rb.w, rb.y + rb.h);
            wood.addColorStop(0, '#7A4B2C'); wood.addColorStop(0.5, '#553220'); wood.addColorStop(1, '#3A2116');
            pgFill(ctx, rails, wood);
        }
        ctx.beginPath(); pgTrace(ctx, P(pgRect(IX, IY, TZ)));
        ctx.strokeStyle = 'rgba(243, 238, 226, 0.12)'; ctx.lineWidth = 1; ctx.stroke();
        if (cfg.diamonds !== false) {
            const dia = [];
            [-375, -250, -125, 125, 250, 375].forEach(x => {
                dia.push(P(pgCirc(x, -(IY + RL / 2), 3.6, TZ + 0.1, 8)), P(pgCirc(x, IY + RL / 2, 3.6, TZ + 0.1, 8)));
            });
            [-125, 0, 125].forEach(y => {
                dia.push(P(pgCirc(-(IX + RL / 2), y, 3.6, TZ + 0.1, 8)), P(pgCirc(IX + RL / 2, y, 3.6, TZ + 0.1, 8)));
            });
            pgFill(ctx, dia, '#E9DDBF');
        }
        pgDrawMarks(ctx, view, pgMarks(table));

        // 4. Pockets: a leather rim clamped to the rail's inner edge, then the
        // shaft seen through the opening (rail cut ∩ felt cut).
        const rims = table.pockets.map(p => P(pgCirc(p.x, p.y, p.r + 7, TZ + 0.2, 36).map(q => {
            if (Math.abs(q[0]) < IX && Math.abs(q[1]) < IY) {
                const dx = IX - Math.abs(q[0]), dy = IY - Math.abs(q[1]);
                return dx < dy ? [Math.sign(q[0]) * IX, q[1], q[2]] : [q[0], Math.sign(q[1]) * IY, q[2]];
            }
            return q;
        })));
        pgFill(ctx, rims, '#1A1410');
        const bandZ = [[TZ + 0.3, 0], [0, -22], [-22, PG_POCKET_FLOOR]];
        const bandRGB = ['#563C29', '#302117', '#150F0B'];
        const lit = [0.55, 0.8, 1.08];
        const NF = 30;
        // Snooker in 3D: a pocket sits mostly behind the cushion line, so its lip is at rail
        // height only over the rail and drops to the felt across the gap; the wall's top band
        // shows only over the rail. The cushions are then redrawn in front of the holes.
        if (cfg.pocketStyle === 'rounded' && eye) {
            const over = (x, y) => Math.abs(x) > IX || Math.abs(y) > IY;
            table.pockets.forEach(p => {
                const rim = [];
                for (let i = 0; i < 72; i++) {
                    const t0 = i / 72 * Math.PI * 2, t1 = (i + 1) / 72 * Math.PI * 2;
                    const x0 = p.x + p.r * Math.cos(t0), y0 = p.y + p.r * Math.sin(t0), x1 = p.x + p.r * Math.cos(t1), y1 = p.y + p.r * Math.sin(t1);
                    const o0 = over(x0, y0), o1 = over(x1, y1);
                    rim.push([x0, y0, o0 ? TZ + 0.3 : 0.05]);
                    if (o0 !== o1) { const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2; rim.push([xm, ym, o0 ? TZ + 0.3 : 0.05], [xm, ym, o1 ? TZ + 0.3 : 0.05]); }
                }
                const ap = P(rim);
                if (ap.length < 3) return;
                pgFill(ctx, [ap], '#040303');
                // The opening need not be convex, so this uses clip(); without it, the opening alone.
                if (typeof ctx.clip !== 'function') return;
                ctx.save();
                ctx.beginPath(); pgTrace(ctx, ap); ctx.clip();
                const walls = [[], [], [], [], [], [], [], [], []], cl = Math.hypot(p.x, p.y) || 1;
                for (let k = 0; k < NF; k++) {
                    const a0 = k / NF * Math.PI * 2, a1 = (k + 1) / NF * Math.PI * 2, am = (a0 + a1) / 2;
                    const nx = -Math.cos(am), ny = -Math.sin(am), px = p.x + p.r * Math.cos(am), py = p.y + p.r * Math.sin(am);
                    if ((eye[0] - px) * nx + (eye[1] - py) * ny <= 0) continue;
                    const face = Math.max(0, nx * (-p.x / cl) + ny * (-p.y / cl)), bi = face > 0.66 ? 2 : face > 0.25 ? 1 : 0;
                    const x0 = p.x + p.r * Math.cos(a0), y0 = p.y + p.r * Math.sin(a0), x1 = p.x + p.r * Math.cos(a1), y1 = p.y + p.r * Math.sin(a1);
                    bandZ.forEach((bz, band) => {
                        if (band === 0 && !over(px, py)) return;              // no rail wall above the felt across the gap
                        walls[band * 3 + bi].push(P([[x0, y0, bz[0]], [x1, y1, bz[0]], [x1, y1, bz[1]], [x0, y0, bz[1]]]));
                    });
                }
                walls.forEach((w, i) => { if (w.length) pgFill(ctx, w, pgRgb(bandRGB[Math.floor(i / 3)], lit[i % 3])); });
                pgFill(ctx, [P(pgCirc(p.x, p.y, p.r * 0.86, PG_POCKET_FLOOR, 36))], '#1E140E');
                pgFill(ctx, [P(pgCirc(p.x, p.y, p.r * 0.66, PG_POCKET_FLOOR, 36))], '#020303');
                ctx.restore();
            });
            const jaws = [];
            cush.forEach(c => c.ends.forEach(([p, q]) => jaws.push(P([p, q, [q[0], q[1], 0], [p[0], p[1], 0]]))));
            pgFill(ctx, jaws, mat.jaw);
            pgFill(ctx, cush.map(c => P([c.nose[0], c.nose[1], [c.nose[1][0], c.nose[1][1], 0], [c.nose[0][0], c.nose[0][1], 0]])), mat.nose);
            pgFill(ctx, cush.map(c => P(c.top)), mat.cushion);
            return;
        }
        table.pockets.forEach(p => {
            const top = P(pgCirc(p.x, p.y, p.r, TZ + 0.3, 36));
            const aperture = view.ortho ? top : pgClipConvex(top, pgHull(P(pgCirc(p.x, p.y, p.r, 0, 36))));
            if (aperture.length < 3) return;
            pgFill(ctx, [aperture], view.ortho ? '#3A281C' : '#040303');
            if (eye) {
                const walls = [[], [], [], [], [], [], [], [], []];
                const cl = Math.hypot(p.x, p.y) || 1;
                for (let k = 0; k < NF; k++) {
                    const a0 = k / NF * Math.PI * 2, a1 = (k + 1) / NF * Math.PI * 2, am = (a0 + a1) / 2;
                    const nx = -Math.cos(am), ny = -Math.sin(am);
                    const px = p.x + p.r * Math.cos(am), py = p.y + p.r * Math.sin(am);
                    if ((eye[0] - px) * nx + (eye[1] - py) * ny <= 0) continue;    // only the far wall faces us
                    const face = Math.max(0, nx * (-p.x / cl) + ny * (-p.y / cl)); // how much it faces the lamp
                    const bi = face > 0.66 ? 2 : face > 0.25 ? 1 : 0;
                    const x0 = p.x + p.r * Math.cos(a0), y0 = p.y + p.r * Math.sin(a0);
                    const x1 = p.x + p.r * Math.cos(a1), y1 = p.y + p.r * Math.sin(a1);
                    bandZ.forEach((bz, band) => {
                        walls[band * 3 + bi].push(pgClipConvex(P([[x0, y0, bz[0]], [x1, y1, bz[0]], [x1, y1, bz[1]], [x0, y0, bz[1]]]), aperture));
                    });
                }
                walls.forEach((w, i) => { if (w.length) pgFill(ctx, w, pgRgb(bandRGB[Math.floor(i / 3)], lit[i % 3])); });
            }
            pgFill(ctx, [pgClipConvex(P(pgCirc(p.x, p.y, p.r * 0.86, PG_POCKET_FLOOR, 36)), aperture)], '#1E140E');
            pgFill(ctx, [pgClipConvex(P(pgCirc(p.x, p.y, p.r * 0.66, PG_POCKET_FLOOR, 36)), aperture)], '#020303');
        });
    }

    // ── Balls ─────────────────────────────────────────────────────────
    // Body frame: x = the number's pole, z = the stripe axis (digits' up), y = z × x.
    // A fixed per-id "print" shows a fresh rack's numbers from above, each turned a
    // little; the physics quaternion rolls it from there.
    const pgPrintCache = {};
    function pgPrint(id) {
        if (pgPrintCache[id]) return pgPrintCache[id];
        const rot = ((id * 53) % 50 - 25) * Math.PI / 180, tilt = ((id * 37) % 24 - 12) * Math.PI / 180;
        const A0 = [-Math.sin(rot), Math.cos(rot), 0];                     // stripe axis, on the felt plane
        const Nn = [Math.cos(rot) * Math.sin(tilt), Math.sin(rot) * Math.sin(tilt), Math.cos(tilt)];
        const Y = pcNorm(pcCross(A0, Nn)), A = pcCross(Nn, Y);
        return (pgPrintCache[id] = [Nn, Y, A]);                            // columns: body x, y, z in the world
    }

    function pgQuatApply(q, v) {
        const [w, x, y, z] = q;
        const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
        return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
    }

    // The visible part of a spherical cap (axis `a` in view coordinates,
    // boundary at a·p = h) as a screen polygon, or null when it is behind.
    function pgCap(a, h, cx, cy, rad) {
        const rho = Math.sqrt(Math.max(0, 1 - h * h));
        let e1 = Math.abs(a[2]) < 0.9 ? pcCross(a, [0, 0, 1]) : pcCross(a, [1, 0, 0]);
        e1 = pcNorm(e1);
        const e2 = pcCross(a, e1), K = 40, rim = [];
        for (let i = 0; i < K; i++) {
            const t = i / K * Math.PI * 2, c = Math.cos(t) * rho, s = Math.sin(t) * rho;
            rim.push([h * a[0] + c * e1[0] + s * e2[0], h * a[1] + c * e1[1] + s * e2[1], h * a[2] + c * e1[2] + s * e2[2]]);
        }
        const vis = rim.map(p => p[2] >= 0);
        const scr = p => [cx + p[0] * rad, cy - p[1] * rad];
        if (vis.every(Boolean)) return rim.map(scr);
        if (!vis.some(Boolean)) return null;
        // Start where the rim comes into view, walk the visible arc, then close
        // along the silhouette on the cap's side.
        let s0 = 0;
        while (!(vis[s0] && !vis[(s0 + K - 1) % K])) s0++;
        const onSil = (P, Q) => {
            const t = P[2] / (P[2] - Q[2]);
            const x = P[0] + t * (Q[0] - P[0]), y = P[1] + t * (Q[1] - P[1]), l = Math.hypot(x, y) || 1;
            return [x / l, y / l, 0];
        };
        const pts = [onSil(rim[(s0 + K - 1) % K], rim[s0])];
        let i = s0;
        while (vis[i % K]) { pts.push(rim[i % K]); i++; }
        pts.push(onSil(rim[(i - 1) % K], rim[i % K]));
        const th0 = Math.atan2(pts[pts.length - 1][1], pts[pts.length - 1][0]), th1 = Math.atan2(pts[0][1], pts[0][0]);
        let ccw = th1 - th0; while (ccw < 0) ccw += Math.PI * 2;
        const mid = d => { const t = th0 + d / 2; return Math.cos(t) * a[0] + Math.sin(t) * a[1]; };
        const span = mid(ccw) >= mid(ccw - Math.PI * 2) ? ccw : ccw - Math.PI * 2;
        const n = Math.max(2, Math.ceil(Math.abs(span) / 0.15));
        for (let k = 1; k < n; k++) { const t = th0 + span * k / n; pts.push([Math.cos(t), Math.sin(t), 0]); }
        return pts.map(scr);
    }

    // A ball's number as a cached sprite per id, size and font: fillText is the dearest
    // call on the canvas. At 2× so foreshortening does not blur it; null without a canvas.
    function pgDigit(sprites, make, id, fs, font) {
        if (!sprites || !make) return null;
        const px = Math.round(fs * 2) / 2, key = id + '|' + px + '|' + font;
        let s = sprites.get(key);
        if (!s) {
            const w = Math.ceil(px * 1.5) * 2, h = Math.ceil(px * 1.3) * 2;
            const c = make(w, h), g = c.getContext && c.getContext('2d');
            if (!g) return null;
            g.scale(2, 2);
            g.fillStyle = '#15191B';
            g.font = '700 ' + px.toFixed(1) + 'px ' + font;
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(String(id), w / 4, h / 4);
            s = { c, w: w / 2, h: h / 2, px };
            if (sprites.size > 400) sprites.clear();
            sprites.set(key, s);
        }
        return s;
    }

    // `v` is the view basis at the ball: right, up and toward the viewer, in world vectors.
    function pgDrawBall(ctx, b, cx, cy, rad, v, theme, alpha) {
        const dd = rad * 2, id = b.id;
        const local = w => [pcDot(w, v.r), pcDot(w, v.u), pcDot(w, v.t)];
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        const disc = () => { ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.closePath(); };
        const look = pgBallLook(theme.game, id);
        if (look.cue) {
            disc();
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
            g.addColorStop(0, '#F8F4EB'); g.addColorStop(1, '#E6DFCF');
            ctx.fillStyle = g; ctx.fill();
        } else if (!look.stripe && !look.number) {
            // Plain (snooker's): nothing printed to roll.
            disc(); ctx.fillStyle = look.colour; ctx.fill();
        } else {
            disc(); ctx.fillStyle = look.colour; ctx.fill();
            const M = pgPrint(id), q = b.q || [1, 0, 0, 0];
            const N = local(pgQuatApply(q, M[0])), Y = local(pgQuatApply(q, M[1])), A = local(pgQuatApply(q, M[2]));
            const ivory = [];
            if (look.stripe) {
                ivory.push(pgCap(A, PG_STRIPE, cx, cy, rad), pgCap([-A[0], -A[1], -A[2]], PG_STRIPE, cx, cy, rad));
            }
            if (look.number) [N, [-N[0], -N[1], -N[2]]].forEach(n => ivory.push(pgCap(n, PG_NUMBER, cx, cy, rad)));
            ctx.beginPath(); ivory.forEach(p => pgTrace(ctx, p));
            ctx.fillStyle = PG_IVORY; ctx.fill();
            // Digits on the facing disc, foreshortened; hidden on small balls, faded as it turns away.
            if (look.number && dd >= 15) {
                [[N, 1], [[-N[0], -N[1], -N[2]], -1]].forEach(([n, sgn]) => {
                    const facing = n[2];
                    if (facing < 0.3) return;
                    const fs = Math.max(dd * 0.27, 6);
                    ctx.save();
                    ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * Math.min(1, (facing - 0.3) / 0.25);
                    // Text x along body y (mirrored on the far pole so it reads the right way), text down = −z.
                    ctx.transform(sgn * Y[0], -sgn * Y[1], -A[0], A[1], cx + n[0] * rad, cy - n[1] * rad);
                    const spr = pgDigit(theme.sprites, theme.makeCanvas, id, fs, theme.font);
                    if (spr) {
                        const k = fs / spr.px;
                        ctx.drawImage(spr.c, -spr.w * k / 2, -spr.h * k / 2 + fs * 0.04, spr.w * k, spr.h * k);
                    } else {
                        ctx.fillStyle = '#15191B';
                        ctx.font = '700 ' + fs.toFixed(1) + 'px ' + theme.font;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText(String(id), 0, fs * 0.04);
                    }
                    ctx.restore();
                });
            }
        }
        // Lamp highlight and rim shade, fixed to the view.
        disc();
        const hx = cx - 0.34 * rad, hy = cy - 0.46 * rad, hl = 0.991 * dd;
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hl);
        hg.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); hg.addColorStop(0.14, 'rgba(255, 255, 255, 0.22)'); hg.addColorStop(0.34, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = hg; ctx.fill();
        const sy = cy - 0.16 * rad, sl = 0.766 * dd;
        const sg = ctx.createRadialGradient(cx, sy, 0, cx, sy, sl);
        sg.addColorStop(0.48, 'rgba(0, 0, 0, 0)'); sg.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        ctx.fillStyle = sg; ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function pgViewBasis(view, p) {
        const t = view.toViewer(p);
        let r = view.right;
        r = pcNorm([r[0] - pcDot(r, t) * t[0], r[1] - pcDot(r, t) * t[1], r[2] - pcDot(r, t) * t[2]]);
        return { r, u: pcCross(t, r), t };
    }

    // ── Guides ────────────────────────────────────────────────────────
    // The shot's opening on the real physics: the cue ball's path to first contact
    // (squirt included), the object ball's line (throw included), and where the cue
    // ball goes next, so draw visibly bends back.
    function pgGuide(world, shot) {
        const w = ppCloneWorld(world);
        w.log = [];
        const cue0 = w.balls.find(b => b.id === 0);
        const start = [cue0.x, cue0.y];
        ppStrike(w, shot);
        const first = () => w.log.find(e => (e.type === 'ball' && (e.a === 0 || e.b === 0)) || (e.type === 'cushion' && e.ball === 0) || (e.type === 'pocket' && e.ball === 0));
        let ev = null, snap = null;
        for (let i = 0; i < 360 && !ev; i++) {
            snap = ppCloneWorld(w); snap.log = w.log.slice();
            ppStep(w, 1 / 60);
            ev = first();
            if (!ev && ppSettled(w)) break;
        }
        const out = { start, contact: null, hit: -1, cushion: false, pocketed: false, obj: null, after: [] };
        const cueOf = W => W.balls.find(b => b.id === 0);
        if (!ev) { const c = cueOf(w); out.contact = [c.x, c.y]; return out; }
        // Re-run the frame that held the contact in fine steps, to place it within ~1.5 u.
        const fine = snap;
        let fev = null;
        for (let i = 0; i < 32 && !fev; i++) {
            ppStep(fine, 1 / 1920);
            fev = fine.log.find(e => (e.type === 'ball' && (e.a === 0 || e.b === 0)) || (e.type === 'cushion' && e.ball === 0) || (e.type === 'pocket' && e.ball === 0));
        }
        const W2 = fev ? fine : w, e2 = fev || ev, c = cueOf(W2);
        out.contact = [c.x, c.y];
        if (e2.type === 'pocket') { out.pocketed = true; return out; }
        if (e2.type === 'cushion') out.cushion = true;
        else {
            out.hit = e2.a === 0 ? e2.b : e2.a;
            const ob = W2.balls.find(b => b.id === out.hit);
            const sp = Math.hypot(ob.vx, ob.vy);
            if (sp > 1e-6) out.obj = { x: ob.x, y: ob.y, dx: ob.vx / sp, dy: ob.vy / sp };
        }
        // Follow the cue ball alone: where its spin takes it, not later collisions (and far cheaper).
        W2.balls = [c];
        let len = 0, px = c.x, py = c.y;
        out.after.push([px, py]);
        for (let i = 0; i < 240 && len < 160; i++) {
            ppStep(W2, 1 / 120);
            const b = cueOf(W2);
            if (b.state === 'pocketed') break;
            len += Math.hypot(b.x - px, b.y - py); px = b.x; py = b.y;
            out.after.push([px, py]);
            if (b.vx === 0 && b.vy === 0) break;
        }
        return out;
    }

    function pgTrim(pts, maxLen) {
        const out = [pts[0]];
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (len + d >= maxLen) { const t = (maxLen - len) / d; out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); break; }
            len += d; out.push(b);
        }
        return out;
    }

    function pgStrokeLine(ctx, view, pts, z, style, width, dash, underlay) {
        const segs = [];
        for (let i = 1; i < pts.length; i++) {
            const s = pcSeg(view, [pts[i - 1][0], pts[i - 1][1], z], [pts[i][0], pts[i][1], z]);
            if (s) segs.push(s);
        }
        if (!segs.length) return;
        const path = () => {
            ctx.beginPath();
            segs.forEach((s, i) => { if (i === 0 || s[0][0] !== segs[i - 1][1][0]) ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); });
        };
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (underlay) {
            path(); ctx.setLineDash(dash || []); ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'; ctx.lineWidth = width + 2; ctx.stroke();
        }
        path(); ctx.setLineDash(dash || []); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke();
        ctx.setLineDash([]);
    }

    // ── The frame ─────────────────────────────────────────────────────
    // scene = {
    //   view, world, felt, theme, cache,            cache = {} kept by the caller, or null
    //   makeCanvas(w, h),                            offscreen canvas for the table layer
    //   dpr,                                         backing-store scale of ctx
    //   aim: { angle, power, gap } | null,           null hides the cue and the guides
    //   guide: pgGuide(…) | null, guideMode: 'full' | 'short' | 'off', illegal,
    //   guideLen: the object ball's line in full mode (default 150; 0 draws no paths),
    //   bih: { x, y, valid, reason } | null, zone: 'kitchen' | 'D' | null (or legacy kitchen),
    //   call: { called } | null, ring: the nominated ball's id (snooker) | null,
    //   drops: [{ ball, pocket, t }],
    // }
    function pgRender(ctx, scene) {
        const view = scene.view, w = scene.world, cfg = w.cfg, table = w.table, R = cfg.ballR, K = pgK(cfg);
        const theme = Object.assign({}, PG_THEME, scene.theme, { game: cfg.game || 'pool' });
        if (scene.cache && scene.makeCanvas) { theme.sprites = scene.cache.digits || (scene.cache.digits = new Map()); theme.makeCanvas = scene.makeCanvas; }
        const dpr = scene.dpr || 1;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, view.W, view.H);

        // Layers 1–4, cached per camera pose. While the camera moves a cache would be
        // thrown away each frame, so the table draws straight to screen until the pose holds.
        const key = JSON.stringify([view.pose, scene.felt, dpr, theme.game]);
        const moving = !!scene.cache && scene.cache.lastKey !== undefined && scene.cache.lastKey !== key;
        if (scene.cache) scene.cache.lastKey = key;
        if (scene.cache && scene.makeCanvas && moving && scene.cache.key !== key) {
            pgDrawTable(ctx, view, cfg, table, scene.felt);
        } else if (scene.cache && scene.makeCanvas) {
            const c = scene.cache;
            if (c.key !== key) {
                if (!c.canvas || c.canvas.width !== Math.round(view.W * dpr) || c.canvas.height !== Math.round(view.H * dpr)) {
                    c.canvas = scene.makeCanvas(Math.round(view.W * dpr), Math.round(view.H * dpr));
                }
                const tc = c.canvas.getContext('2d');
                tc.setTransform(1, 0, 0, 1, 0, 0);
                tc.clearRect(0, 0, c.canvas.width, c.canvas.height);
                tc.setTransform(dpr, 0, 0, dpr, 0, 0);
                pgDrawTable(tc, view, cfg, table, scene.felt);
                c.key = key;
            }
            ctx.drawImage(c.canvas, 0, 0, view.W, view.H);
        } else {
            pgDrawTable(ctx, view, cfg, table, scene.felt);
        }

        // 5. The ball-in-hand zone.
        const zone = scene.zone || (scene.kitchen ? 'kitchen' : null);
        if (zone === 'kitchen') {
            pgFill(ctx, [pcPoly(view, [[-cfg.halfLength, -cfg.halfWidth, 0.2], [table.headX, -cfg.halfWidth, 0.2], [table.headX, cfg.halfWidth, 0.2], [-cfg.halfLength, cfg.halfWidth, 0.2]])], theme.accent, 0.12);
            pgStrokeLine(ctx, view, [[table.headX, -cfg.halfWidth], [table.headX, cfg.halfWidth]], 0.3, pgRgba(theme.accent, 0.8), 1.5, [6, 5], true);
        } else if (zone === 'D' && table.marks) {
            const m = table.marks, arc = [];
            for (let i = 0; i <= 24; i++) { const t = Math.PI / 2 + i / 24 * Math.PI; arc.push([m.baulkX + m.dR * Math.cos(t), m.dR * Math.sin(t)]); }
            pgFill(ctx, [pcPoly(view, arc.map(q => [q[0], q[1], 0.2]))], theme.accent, 0.12);
            pgStrokeLine(ctx, view, arc.concat([[m.baulkX, m.dR]]), 0.3, pgRgba(theme.accent, 0.8), 1.5, [6, 5], true);
        }

        // Pocket drops: sinking into the hole, under everything still in play.
        (scene.drops || []).forEach(d => {
            const p = table.pockets[d.pocket], t = Math.max(0, Math.min(1, d.t));
            if (!p) return;
            const x = d.ball.x + (p.x - d.ball.x) * t, y = d.ball.y + (p.y - d.ball.y) * t;
            const s = pcProject(view, [x, y, R - 2.2 * R * t]);
            if (s) pgDrawBall(ctx, d.ball, s[0], s[1], R * s[2] * (1 - 0.35 * t), pgViewBasis(view, [x, y, R]), theme, 1 - t);
        });

        // 6. Shadows, then guides.
        const live = w.balls.filter(b => b.state !== 'pocketed' && !(scene.bih && b.id === 0));
        pgFill(ctx, live.map(b => pcPoly(view, pgCirc(b.x + 4 * K, b.y - 5 * K, R * 1.08, 0.3, 20))), '#000000', 0.38);
        const g = scene.aim && scene.guide && scene.guideMode !== 'off' ? scene.guide : null;
        const Z = 0.6;
        if (g && g.contact) {
            const short = scene.guideMode === 'short';
            const L = short ? 60 : typeof scene.guideLen === 'number' ? scene.guideLen : 150;
            const dx = g.contact[0] - g.start[0], dy = g.contact[1] - g.start[1], dl = Math.hypot(dx, dy) || 1;
            const ux = dx / dl, uy = dy / dl;
            if (dl > 2.3 * R) {
                pgStrokeLine(ctx, view, [[g.start[0] + ux * R * 1.3, g.start[1] + uy * R * 1.3], [g.contact[0] - ux * R, g.contact[1] - uy * R]], Z, pgRgba(PG_GUIDE, 0.85), 1.5, [5, 4]);
            }
            if (g.obj && L > 0) {
                pgStrokeLine(ctx, view, [[g.obj.x + g.obj.dx * R, g.obj.y + g.obj.dy * R], [g.obj.x + g.obj.dx * (R + L), g.obj.y + g.obj.dy * (R + L)]], Z, theme.accent, 2, null, true);
            }
            if (g.after.length > 1 && L > 0) {
                const path = pgTrim(g.after, (short ? 40 : g.cushion ? 120 : 90) + R);
                // Start the line at the ghost ball's edge.
                let k = 0, acc = 0;
                while (k < path.length - 1 && acc < R) { acc += Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]); k++; }
                const tail = path.slice(k);
                if (tail.length > 1) pgStrokeLine(ctx, view, tail, Z, pgRgba(PG_GUIDE, 0.4), 1.2, [2, 4]);
            }
        }

        // 7. Balls, far to near.
        const drawn = live.map(b => {
            const c = view.toCam([b.x, b.y, R]);
            return { b, c };
        }).filter(o => o.c[2] >= PC_NEAR + R).sort((p, q) => q.c[2] - p.c[2]);
        drawn.forEach(({ b, c }) => {
            const s = view.toScr(c), rad = R * s[2];
            if (rad < 0.8) return;
            pgDrawBall(ctx, b, s[0], s[1], rad, pgViewBasis(view, [b.x, b.y, R]), theme);
        });

        // 8. Ghost ball, cue, called-pocket rings, ball in hand.
        if (g && g.contact && !g.pocketed) {
            const s = pcProject(view, [g.contact[0], g.contact[1], R]);
            if (s && s[3] > PC_NEAR + R) {
                const gr = R * s[2];
                ctx.beginPath(); ctx.arc(s[0], s[1], gr, 0, Math.PI * 2);
                ctx.fillStyle = pgRgba(PG_GUIDE, 0.08); ctx.fill();
                ctx.setLineDash([3, 2.5]);
                ctx.strokeStyle = scene.illegal ? theme.hot : pgRgba(PG_GUIDE, 0.9); ctx.lineWidth = 1.25; ctx.stroke();
                ctx.setLineDash([]);
                if (scene.illegal) {
                    // The prohibition sign: this ball may not be hit first.
                    ctx.beginPath();
                    ctx.moveTo(s[0] - gr * 0.62, s[1] + gr * 0.62); ctx.lineTo(s[0] + gr * 0.62, s[1] - gr * 0.62);
                    ctx.strokeStyle = theme.hot; ctx.lineWidth = 2; ctx.stroke();
                }
            }
        }
        const cue = w.balls.find(b => b.id === 0);
        if (scene.aim && cue && cue.state !== 'pocketed' && !scene.bih) {
            const a = scene.aim, d = [Math.cos(a.angle), Math.sin(a.angle)];
            const gap = a.gap !== undefined ? a.gap : 8 + (a.power || 0) * 1.1;
            const L = 600;
            const pt = (u, side) => {
                // Pool's cue at every ball size.
                const along = R + gap + u, wd = 3.3 + (8 - 3.3) * (u / L), z = R + 1.5 + 60 * (u / L);
                return [cue.x - d[0] * along - d[1] * wd * side, cue.y - d[1] * along + d[0] * wd * side, z];
            };
            const stick = (u0, u1) => pcPoly(view, [pt(u0, 1), pt(u1, 1), pt(u1, -1), pt(u0, -1)]);
            const part = (u0, u1, fill, edge) => {
                const poly = stick(u0, u1);
                if (poly.length < 3) return;
                ctx.beginPath(); pgTrace(ctx, poly);
                ctx.fillStyle = fill; ctx.fill();
                if (edge) { ctx.strokeStyle = 'rgba(0, 0, 0, ' + edge + ')'; ctx.lineWidth = 0.6; ctx.stroke(); }
            };
            part(470, L, '#3B1F14', 0.35);
            part(338, 470, '#1B1C1D', 0.35);
            part(330, 338, '#C9A15A');
            part(16, 330, '#DDB77F', 0.3);
            part(3, 16, '#F2ECDF');
            part(0, 3, '#3E73B8');
        }
        if (scene.ring) {
            // Snooker's nominated ball: a see-through accent ring at r + max(3 px, 0.4 r).
            const b = w.balls.find(o => o.id === scene.ring && o.state !== 'pocketed');
            const s = b && pcProject(view, [b.x, b.y, R]);
            if (s && s[3] > PC_NEAR + R) {
                const rad = R * s[2], rr = rad + Math.max(3, rad * 0.4);
                ctx.beginPath(); ctx.arc(s[0], s[1], rr, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)'; ctx.lineWidth = 3; ctx.stroke();
                ctx.strokeStyle = pgRgba(theme.accent, 0.6); ctx.lineWidth = 1.5; ctx.stroke();
            }
        }
        // Pocket rings: the called one lit, the rest dashed. Snooker's are lighter so its small
        // pockets and a ball in their jaws still read.
        if (scene.call) {
            const lite = theme.game === 'snooker';
            table.pockets.forEach((p, i) => {
                const ring = pcPoly(view, pgCirc(p.x, p.y, p.r + 12 * K, pgRailZ(cfg) + 0.5, 32));
                if (ring.length < 3) return;
                ctx.beginPath(); pgTrace(ctx, ring);
                if (i === scene.call.called) {
                    ctx.fillStyle = pgRgba(theme.accent, lite ? 0.1 : 0.22); ctx.fill();
                    ctx.strokeStyle = lite ? pgRgba(theme.accent, 0.75) : theme.accent; ctx.lineWidth = lite ? 2.25 : 3; ctx.stroke();
                } else {
                    ctx.setLineDash([4, 3]); ctx.strokeStyle = pgRgba(theme.accent, lite ? 0.45 : 0.9); ctx.lineWidth = lite ? 1.5 : 1.75; ctx.stroke(); ctx.setLineDash([]);
                }
            });
        }
        if (scene.bih) {
            const s = pcProject(view, [scene.bih.x, scene.bih.y, R]);
            if (s && s[3] > PC_NEAR + R) {
                const gr = R * s[2], ok = scene.bih.valid !== false;
                ctx.beginPath(); ctx.arc(s[0], s[1], gr, 0, Math.PI * 2);
                ctx.fillStyle = ok ? pgRgba(PG_IVORY, 0.6) : pgRgba(theme.hot, 0.4); ctx.fill();
                ctx.setLineDash(ok ? [3, 2] : []);
                ctx.strokeStyle = ok ? theme.accent : theme.hot; ctx.lineWidth = 2; ctx.stroke();
                ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(s[0], s[1], gr + 5, 0, Math.PI * 2);
                ctx.strokeStyle = pgRgba(ok ? theme.accent : theme.hot, 0.35); ctx.lineWidth = 1; ctx.stroke();
                if (typeof Path2D === 'function') {
                    ctx.save();
                    ctx.translate(s[0] + gr * 0.2, s[1] + gr * 0.1); ctx.scale(0.95, 0.95);
                    const hand = new Path2D(PG_HAND);
                    ctx.fillStyle = '#15191B'; ctx.fill(hand);
                    ctx.strokeStyle = PG_IVORY; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(hand);
                    ctx.restore();
                }
            }
        }
        ctx.restore();
    }

    // Pocket screen positions for hit-testing a call; off-screen ones are called from the mini-map.
    function pgPocketMarks(view, table, cfg) {
        const Z = cfg ? pgRailZ(cfg) : PG_RAIL_Z, K = table.R / 14;
        return table.pockets.map((p, i) => {
            const s = pcProject(view, [p.x, p.y, Z]);
            const inView = !!s && s[0] > 10 && s[0] < view.W - 10 && s[1] > 10 && s[1] < view.H - 10;
            return { i, x: s ? s[0] : 0, y: s ? s[1] : 0, r: s ? (p.r + 12 * K) * s[2] : 0, inView };
        });
    }
