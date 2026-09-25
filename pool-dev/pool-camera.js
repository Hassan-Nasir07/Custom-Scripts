    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — CAMERA (v2)
    // ═══════════════════════════════════════════════════════════════════
    // Poses, projection and unprojection for the two cameras in the design
    // (Table.dc.html), plus the director that moves between them.
    //
    //   chase      perspective, behind the cue ball along the aim. Lean 0–100
    //              maps to pitch 19.5°→48° and distance 110→420, focal 1.1·H,
    //              with the cue ball held 0.34·H below the centre
    //   broadcast  perspective, high over the table, framed like the 2D view;
    //              the camera eases here while balls run
    //   ortho      the 2D top-down view, fitted with an 8 px margin
    //
    // World frame is the physics frame: x right, y up, z up (right-handed).
    // The design's frame is left-handed (y down), which mirrors its 3D view
    // left to right; this one is not mirrored, so what is on your right in
    // 3D is on your right on the real table. Screen space is CSS pixels,
    // y down. Pure: no DOM.

    const PC_NEAR = 4;                 // near plane, table units in front of the eye
    const PC_MARGIN = 8;               // 2D fit margin, px

    const pcSub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const pcDot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const pcCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const pcNorm = p => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
    const pcLerp = (a, b, t) => a + (b - a) * t;
    const pcLerp3 = (a, b, t) => [pcLerp(a[0], b[0], t), pcLerp(a[1], b[1], t), pcLerp(a[2], b[2], t)];

    // Outer size of the table, rails included, from the physics config.
    function pcTableExtent(cfg) {
        return { OX: cfg.halfLength + cfg.railWidth, OY: cfg.halfWidth + cfg.railWidth };
    }

    // A perspective pose is an eye, a point it looks at, an up hint and a
    // focal length; poses of that kind blend by lerping all four.
    function pcChase(cue, aim, lean, W, H, cfg) {
        const R = cfg ? cfg.ballR : 14;
        const lt = Math.max(0, Math.min(100, lean)) / 100;
        const phi = (19.5 + 28.5 * lt) * Math.PI / 180;
        const dist = 110 + 310 * lt;
        const F = 1.1 * H;
        const pitch = phi - Math.atan(0.34 / 1.1);
        const d = [Math.cos(aim), Math.sin(aim)];
        const eye = [cue[0] - d[0] * dist * Math.cos(phi), cue[1] - d[1] * dist * Math.cos(phi), R + dist * Math.sin(phi)];
        const f = [d[0] * Math.cos(pitch), d[1] * Math.cos(pitch), -Math.sin(pitch)];
        const k = eye[2] / Math.sin(pitch);       // where the centre ray meets the felt
        return { kind: 'persp', eye, target: [eye[0] + f[0] * k, eye[1] + f[1] * k, 0], up: [0, 0, 1], F, W, H };
    }

    // Straight down on the table centre, screen-up = +y, framed like the 2D
    // view. The long focal length keeps it close to orthographic, so the
    // cut to and from 2D barely moves anything.
    function pcBroadcast(W, H, cfg) {
        const { OX, OY } = pcTableExtent(cfg);
        const F = 4 * H, top = cfg.ballR + 2;     // fit the rail top
        const h = top + F * Math.max(OX / (W / 2 - PC_MARGIN), OY / (H / 2 - PC_MARGIN));
        return { kind: 'persp', eye: [0, 0, h], target: [0, 0, 0], up: [0, 1, 0], F, W, H };
    }

    function pcOrtho(W, H, cfg) {
        const { OX, OY } = pcTableExtent(cfg);
        return { kind: 'ortho', s: Math.min((W - 2 * PC_MARGIN) / (2 * OX), (H - 2 * PC_MARGIN) / (2 * OY)), W, H };
    }

    // Perspective poses blend; anything involving ortho cuts at the midpoint.
    function pcBlend(a, b, t) {
        if (t <= 0) return a;
        if (t >= 1) return b;
        if (a.kind !== 'persp' || b.kind !== 'persp') return t < 0.5 ? a : b;
        return {
            kind: 'persp', eye: pcLerp3(a.eye, b.eye, t), target: pcLerp3(a.target, b.target, t),
            up: pcNorm(pcLerp3(a.up, b.up, t)), F: pcLerp(a.F, b.F, t), W: b.W, H: b.H,
        };
    }

    // Smoothstep: eases in and out.
    const pcEase = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

    // A view is a pose made usable: toCam (world → camera, z = depth),
    // toScr (camera → [sx, sy, px-per-unit]), project, unproject.
    function pcView(pose) {
        const W = pose.W, H = pose.H;
        if (pose.kind === 'ortho') {
            const s = pose.s;
            return {
                pose, W, H, ortho: true, eye: null,
                right: [1, 0, 0], upv: [0, 1, 0], fwd: [0, 0, -1],
                toCam: p => [p[0], p[1], 1000 - p[2]],
                toScr: c => [W / 2 + s * c[0], H / 2 - s * c[1], s],
                // The point on the plane z = h under a screen pixel.
                unproject: (sx, sy) => [(sx - W / 2) / s, (H / 2 - sy) / s],
                // Unit vector from a world point toward the viewer.
                toViewer: () => [0, 0, 1],
            };
        }
        const eye = pose.eye, F = pose.F;
        const f = pcNorm(pcSub(pose.target, eye));
        let r = pcCross(f, pose.up);
        if (Math.hypot(r[0], r[1], r[2]) < 1e-9) r = pcCross(f, [0, 1, 0]);
        r = pcNorm(r);
        const u = pcCross(r, f);
        const toCam = p => { const q = pcSub(p, eye); return [pcDot(q, r), pcDot(q, u), pcDot(q, f)]; };
        return {
            pose, W, H, ortho: false, eye, right: r, upv: u, fwd: f,
            toCam,
            toScr: c => [W / 2 + F * c[0] / c[2], H / 2 - F * c[1] / c[2], F / c[2]],
            unproject: (sx, sy, h) => {
                const a = (sx - W / 2) / F, b = (H / 2 - sy) / F;
                const dir = [r[0] * a + u[0] * b + f[0], r[1] * a + u[1] * b + f[1], r[2] * a + u[2] * b + f[2]];
                if (Math.abs(dir[2]) < 1e-12) return null;
                const t = ((h || 0) - eye[2]) / dir[2];
                return t > 0 ? [eye[0] + dir[0] * t, eye[1] + dir[1] * t] : null;
            },
            toViewer: p => pcNorm(pcSub(eye, p)),
        };
    }

    // World point → [sx, sy, px-per-unit, depth], or null behind the near plane.
    function pcProject(view, p) {
        const c = view.toCam(p);
        if (c[2] < PC_NEAR) return null;
        const s = view.toScr(c);
        return [s[0], s[1], s[2], c[2]];
    }

    // World polygon → screen polygon [[sx, sy], …], clipped at the near
    // plane. Fewer than 3 points means nothing to draw.
    function pcPoly(view, pts) {
        const cam = pts.map(view.toCam), out = [];
        for (let i = 0; i < cam.length; i++) {
            const A = cam[i], B = cam[(i + 1) % cam.length];
            const ain = A[2] >= PC_NEAR, bin = B[2] >= PC_NEAR;
            if (ain) out.push(A);
            if (ain !== bin) {
                const t = (PC_NEAR - A[2]) / (B[2] - A[2]);
                out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), PC_NEAR]);
            }
        }
        return out.map(c => { const s = view.toScr(c); return [s[0], s[1]]; });
    }

    // World segment → [[sx, sy], [sx, sy]] clipped at the near plane, or null.
    function pcSeg(view, p, q) {
        let A = view.toCam(p), B = view.toCam(q);
        if (A[2] < PC_NEAR && B[2] < PC_NEAR) return null;
        const cut = (X, Y) => { const t = (PC_NEAR - X[2]) / (Y[2] - X[2]); return [X[0] + t * (Y[0] - X[0]), X[1] + t * (Y[1] - X[1]), PC_NEAR]; };
        if (A[2] < PC_NEAR) A = cut(A, B);
        if (B[2] < PC_NEAR) B = cut(B, A);
        const a = view.toScr(A), b = view.toScr(B);
        return [[a[0], a[1]], [b[0], b[1]]];
    }

    // ── Director ──────────────────────────────────────────────────────
    // Chooses the pose for each frame and eases between them:
    //   aim     chase behind the cue ball (or 2D if the player picked it)
    //   moving  balls are running: ease out to broadcast, or, with the
    //           shot camera set to stay in 3D, hold the aim view
    //   rest    back to the chase pose once everything stops
    //   bih     ball in hand always cuts to 2D
    // input = { camera: '3d'|'2d', shotCam: 'overhead'|'3d', phase: 'aim'|'moving'|'bih', cue, aim, lean }
    const PC_TWEEN_MS = { moving: 650, aim: 500 };

    function pcDirector(W, H, cfg) {
        return { W, H, cfg, key: null, from: null, t: 1, ms: 1, pose: null, hold: null };
    }

    function pcTarget(dir, input) {
        const two = input.camera === '2d' || input.phase === 'bih';
        if (two) return { key: 'ortho', pose: pcOrtho(dir.W, dir.H, dir.cfg) };
        if (input.phase === 'moving') {
            if (input.shotCam !== '3d') return { key: 'broadcast', pose: pcBroadcast(dir.W, dir.H, dir.cfg) };
            // Stay in 3D: keep the view the shot was aimed from, frozen where it was.
            if (dir.key !== 'hold') dir.hold = dir.pose || pcChase(input.cue, input.aim, input.lean, dir.W, dir.H, dir.cfg);
            return { key: 'hold', pose: dir.hold };
        }
        return { key: 'chase', pose: pcChase(input.cue, input.aim, input.lean, dir.W, dir.H, dir.cfg) };
    }

    // Advances by dtMs and returns this frame's pose. A chase target is live
    // (it follows aim and lean), so the blend is always toward where the
    // camera should be now, not where it was when the move started.
    function pcDirect(dir, input, dtMs) {
        const tg = pcTarget(dir, input);
        if (dir.key !== tg.key) {
            const cut = !dir.pose || tg.key === 'ortho' || dir.key === 'ortho';
            dir.from = dir.pose;
            dir.key = tg.key;
            dir.t = cut ? 1 : 0;
            dir.ms = tg.key === 'broadcast' ? PC_TWEEN_MS.moving : PC_TWEEN_MS.aim;
        } else {
            dir.t = Math.min(1, dir.t + (dtMs || 0) / dir.ms);
        }
        dir.pose = dir.t >= 1 ? tg.pose : pcBlend(dir.from, tg.pose, pcEase(dir.t));
        return dir.pose;
    }

    function pcResize(dir, W, H) {
        dir.W = W; dir.H = H; dir.key = null; dir.pose = null;
    }
