// Pool v2 camera and renderer verification. `node pool-dev/render-verify.js`
//
//   1. The cameras against the design's own projection code: 2D exactly,
//      3D exactly up to the design's left–right mirror (its frame is
//      left-handed, ours is not; see pool-camera.js).
//   2. Unprojection: a screen click maps back to the table point it came
//      from, in every camera, including mid-blend.
//   3. Near-plane clipping, the director's cuts and eases.
//   4. The polygon clipper and the ball-marking caps.
//   5. The guides on the real physics: squirt, throw, draw bending back.
//   6. Whole frames through the headless rasterizer: every scene draws
//      without throwing, and the pixels land where they should.
// What it looks like is judged with snapshot.js in real Chrome.
const P = require('./load').render();
const { Raster, Ctx } = require('../ludo-dev/preview.js');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name + (detail !== undefined ? '  (' + detail + ')' : '')); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));
const rng = P.ppRandom(11);
const rand = (a, b) => a + (b - a) * rng();
const cfg = P.ppCreateWorld().cfg;
const W = 368, H = 412, DEG = Math.PI / 180;

// ── 1. The design's projection ────────────────────────────────────────
head("Against the design's projection");
// Table.dc.html's camera, verbatim apart from packaging. Its frame is y-down.
function designCamera(mode, cue, aimDeg, lean) {
    const R = 14, HL = 500, HW = 250, CU = 12, RL = 36, OX = HL + CU + RL, OY = HW + CU + RL;
    const a = aimDeg * Math.PI / 180, d = [Math.cos(a), Math.sin(a)];
    const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const nrm = p => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
    if (mode === '3d') {
        const F = 1.1 * H, lt = lean / 100;
        const phi = (19.5 + 28.5 * lt) * Math.PI / 180, dist = 110 + 310 * lt;
        const pitch = phi - Math.atan(0.34 / 1.1);
        const camPos = [cue[0] - d[0] * dist * Math.cos(phi), cue[1] - d[1] * dist * Math.cos(phi), R + dist * Math.sin(phi)];
        const f = [d[0] * Math.cos(pitch), d[1] * Math.cos(pitch), -Math.sin(pitch)];
        const r = nrm([f[1], -f[0], 0]);
        const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
        const toCam = p => { const q = sub(p, camPos); return [dot(q, r), dot(q, u), dot(q, f)]; };
        return p => { const c = toCam(p); return [W / 2 + F * c[0] / c[2], H / 2 - F * c[1] / c[2], F / c[2]]; };
    }
    const s = Math.min((W - 16) / (2 * OX), (H - 16) / (2 * OY));
    return p => [W / 2 + s * p[0], H / 2 + s * p[1], s];
}
{
    let worst3 = 0, worst2 = 0, n = 0;
    for (let k = 0; k < 20; k++) {
        const cueD = [rand(-450, 450), rand(-220, 220)], aimD = rand(-180, 180), lean = rand(0, 100);
        const des3 = designCamera('3d', cueD, aimD, lean), des2 = designCamera('2d');
        const ours3 = P.pcView(P.pcChase([cueD[0], -cueD[1]], -aimD * DEG, lean, W, H, cfg));
        const ours2 = P.pcView(P.pcOrtho(W, H, cfg));
        for (let i = 0; i < 25; i++) {
            const pD = [rand(-550, 550), rand(-300, 300), rand(-60, 20)], p = [pD[0], -pD[1], pD[2]];
            const c = ours3.toCam(p);
            if (c[2] > 4) {
                const a = des3(pD), b = ours3.toScr(c);
                worst3 = Math.max(worst3, Math.abs(b[0] - (W - a[0])), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
                n++;
            }
            const a2 = des2(pD), b2 = ours2.toScr(ours2.toCam(p));
            worst2 = Math.max(worst2, Math.abs(b2[0] - a2[0]), Math.abs(b2[1] - a2[1]), Math.abs(b2[2] - a2[2]));
        }
    }
    ok('2D is the design\'s projection exactly', worst2 < 1e-9, 'worst ' + worst2.toExponential(1) + ' px');
    ok('3D chase is the design\'s projection, mirrored left–right', worst3 < 1e-6, n + ' points, worst ' + worst3.toExponential(1) + ' px');
    const v = P.pcView(P.pcChase([0, 0], 0, 35, W, H, cfg));
    const cue = P.pcProject(v, [0, 0, cfg.ballR]);
    ok('the chase camera holds the cue ball 0.34·H below the centre', Math.abs(cue[0] - W / 2) < 1e-9 && Math.abs(cue[1] - (H / 2 + 0.34 * H)) < 1, cue[1].toFixed(1));
    const right = P.pcProject(v, [200, -100, 0]), left = P.pcProject(v, [200, 100, 0]);
    ok('aiming along +x, the table\'s −y side is on screen right (not mirrored)', right[0] > W / 2 && left[0] < W / 2);
}

// ── 2. Unprojection ───────────────────────────────────────────────────
head('Unprojection');
{
    const poses = [
        ['chase lean 0', P.pcChase([-160, -70], 0.3, 0, W, H, cfg)],
        ['chase lean 100', P.pcChase([200, 100], 2.4, 100, W, H, cfg)],
        ['broadcast', P.pcBroadcast(W, H, cfg)],
        ['ortho', P.pcOrtho(W, H, cfg)],
        ['half-way chase → broadcast', P.pcBlend(P.pcChase([0, 0], -1.2, 50, W, H, cfg), P.pcBroadcast(W, H, cfg), 0.5)],
        ['max-size chase', P.pcChase([-300, 0], 0, 35, 1232, 672, cfg)],
    ];
    poses.forEach(([name, pose]) => {
        const v = P.pcView(pose);
        let worst = 0, tried = 0;
        for (let i = 0; i < 300; i++) {
            const x = rand(-500, 500), y = rand(-250, 250), z = cfg.ballR;
            const s = P.pcProject(v, [x, y, z]);
            if (!s || s[0] < 0 || s[0] > v.W || s[1] < 0 || s[1] > v.H) continue;
            const back = v.unproject(s[0], s[1], z);
            worst = Math.max(worst, Math.hypot(back[0] - x, back[1] - y));
            tried++;
        }
        ok(name + ': screen → table → screen round-trips', tried > 20 && worst < 1e-6, tried + ' on-screen points, worst ' + worst.toExponential(1) + ' u');
    });
    const v = P.pcView(P.pcChase([0, 0], 0, 35, W, H, cfg));
    ok('a pixel above the horizon unprojects to nothing', v.unproject(W / 2, 0, cfg.ballR) === null);
}

// ── 3. Clipping and the director ──────────────────────────────────────
head('Clipping and the director');
{
    const v = P.pcView(P.pcChase([0, 0], 0, 35, W, H, cfg));
    const behind = P.pcPoly(v, [[-400, -20, 0], [-380, -20, 0], [-380, 20, 0], [-400, 20, 0]]);
    ok('a polygon behind the eye is dropped', behind.length === 0);
    const across = P.pcPoly(v, [[-400, -20, 0], [300, -20, 0], [300, 20, 0], [-400, 20, 0]]);
    ok('a polygon through the near plane is cut, not wrapped', across.length >= 3 && across.every(p => isFinite(p[0]) && isFinite(p[1])), across.length + ' points');
    const seg = P.pcSeg(v, [-400, 0, 0], [300, 0, 0]);
    ok('a segment through the near plane keeps its visible part', seg && seg[1][1] < H && isFinite(seg[0][1]));
    ok('a segment wholly behind is dropped', P.pcSeg(v, [-400, 0, 0], [-390, 0, 0]) === null);

    const d = P.pcDirector(W, H, cfg);
    const inp = o => Object.assign({ camera: '3d', phase: 'aim', cue: [-250, 0], aim: 0, lean: 35 }, o);
    const p0 = P.pcDirect(d, inp(), 0);
    ok('the first pose is the chase camera', p0.kind === 'persp' && d.key === 'chase');
    const p1 = P.pcDirect(d, inp({ phase: 'moving' }), 0);
    ok('a shot starts an ease, not a cut', d.key === 'broadcast' && d.t === 0 && Math.hypot(...p1.eye.map((e, i) => e - p0.eye[i])) < 1e-9);
    P.pcDirect(d, inp({ phase: 'moving' }), 325);
    const mid = d.pose;
    const bc = P.pcBroadcast(W, H, cfg);
    ok('half-way through, the camera is between the two', mid.eye[2] > p0.eye[2] && mid.eye[2] < bc.eye[2]);
    P.pcDirect(d, inp({ phase: 'moving' }), 400);
    ok('after 650 ms it is the broadcast camera', d.t === 1 && d.pose === d.pose && Math.abs(d.pose.eye[2] - bc.eye[2]) < 1e-9);
    const last = d.pose;
    P.pcDirect(d, inp({ phase: 'aim', cue: [100, 50], aim: 1 }), 16);
    const noJump = d.pose === last;
    P.pcDirect(d, inp({ phase: 'aim', cue: [100, 50], aim: 1 }), 16);
    ok('when the balls stop it eases back from where it was, with no jump', d.key === 'chase' && noJump && d.t > 0 && d.t < 1);
    P.pcDirect(d, inp({ phase: 'aim', cue: [100, 50], aim: 1.4 }), 1000);
    const live = P.pcChase([100, 50], 1.4, 35, W, H, cfg);
    ok('the chase target is live: it follows aim changes during the ease', Math.hypot(...d.pose.eye.map((e, i) => e - live.eye[i])) < 1e-9);
    P.pcDirect(d, inp({ phase: 'bih' }), 16);
    ok('ball in hand cuts straight to 2D', d.pose.kind === 'ortho' && d.t === 1);
    P.pcDirect(d, inp({ phase: 'aim' }), 16);
    ok('and leaving it cuts back to 3D', d.pose.kind === 'persp' && d.t === 1);
    P.pcDirect(d, inp({ camera: '2d', phase: 'moving' }), 16);
    ok('the 2D camera stays 2D while balls run', d.pose.kind === 'ortho');
    // Shot camera set to stay in 3D: the camera stands up into the survey
    // (the whole table, in 3D) while the balls run, then comes back down.
    const dist3 = (p, q) => Math.hypot(...p.eye.map((e, i) => e - q.eye[i]));
    const heading = p => Math.atan2(p.target[1] - p.eye[1], p.target[0] - p.eye[0]);
    const pitchOf = p => Math.atan2(p.eye[2] - p.target[2], Math.hypot(p.eye[0] - p.target[0], p.eye[1] - p.target[1])) / DEG;
    const inFrame = pose => {
        const sv = P.pcView(pose), OX = cfg.halfLength + cfg.railWidth, OY = cfg.halfWidth + cfg.railWidth;
        let worst = Infinity;
        [16, -46].forEach(z => [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
            const p = P.pcProject(sv, [a * OX, b * OY, z]);
            worst = Math.min(worst, p ? Math.min(p[0], sv.W - p[0], p[1] - 38, sv.H - p[1]) : -Infinity);
        }));
        return worst;
    };
    [[W, H, 'compact'], [1232, 672, 'Max']].forEach(([w, h, name]) => {
        for (const a of [0, 0.7, Math.PI / 2, 2.4, -1.2]) {
            const sp = P.pcSurvey(a, w, h, cfg), room = inFrame(sp);
            if (room < 13.5 || room > 40) { ok('stay 3D: the survey fits the whole table, ' + name + ', aim ' + a, false, room.toFixed(1)); return; }
        }
        ok('stay 3D: the survey fits the whole table, rails and apron, clear of the top overlays, at any aim (' + name + ')', true);
    });
    const sv0 = P.pcSurvey(0.7, W, H, cfg);
    ok('stay 3D: the survey faces the way the shot went, from above the lean range', Math.abs(heading(sv0) - 0.7) < 1e-9 && pitchOf(sv0) > 48 && sv0.up[2] === 1);
    const s3 = P.pcDirector(W, H, cfg);
    const aimPose = P.pcDirect(s3, inp({ shotCam: '3d' }), 0);
    P.pcDirect(s3, inp({ shotCam: '3d', phase: 'moving', cue: [300, 100] }), 16);
    P.pcDirect(s3, inp({ shotCam: '3d', phase: 'moving', cue: [300, 100] }), 400);
    const rising = s3.pose;
    ok('stay 3D: the camera rises and backs off, keeping the shot\'s heading', pitchOf(rising) > pitchOf(aimPose) + 3 && dist3(rising, { eye: rising.target }) > dist3(aimPose, { eye: aimPose.target }) && Math.abs(heading(rising)) < 1e-9);
    P.pcDirect(s3, inp({ shotCam: '3d', phase: 'moving', cue: [310, 90] }), 2000);
    const up = s3.pose;
    ok('stay 3D: and stands in the survey, whatever the cue ball does', dist3(up, P.pcSurvey(0, W, H, cfg)) < 1e-9);
    P.pcDirect(s3, inp({ shotCam: '3d', phase: 'aim', cue: [310, 90], aim: 2 }), 16);
    P.pcDirect(s3, inp({ shotCam: '3d', phase: 'aim', cue: [310, 90], aim: 2 }), 300);
    ok('stay 3D: once the balls stop it holds a beat to show the table', dist3(s3.pose, up) < 1e-9);
    P.pcDirect(s3, inp({ shotCam: '3d', phase: 'aim', cue: [310, 90], aim: 2 }), 500);
    const back = P.pcChase([310, 90], 2, 35, W, H, cfg), swing = s3.pose;
    const swung = heading(swing) > 0.05 && heading(swing) < 1.95;
    ok('stay 3D: then swings round to the new aim, not across the table', dist3(swing, back) > 1 && dist3(swing, up) > 1 && swung && swing.eye[2] > 20, heading(swing).toFixed(2));
    P.pcDirect(s3, inp({ shotCam: '3d', phase: 'aim', cue: [310, 90], aim: 2 }), 900);
    ok('stay 3D: and lands on the chase pose behind the cue ball', dist3(s3.pose, back) < 1e-9);
    const s3b = P.pcDirector(W, H, cfg);
    P.pcDirect(s3b, inp({ shotCam: '3d' }), 0);
    P.pcDirect(s3b, inp({ shotCam: '3d', phase: 'moving' }), 16);
    P.pcDirect(s3b, inp({ shotCam: '3d', phase: 'moving' }), 100);
    P.pcDirect(s3b, inp({ shotCam: '3d', phase: 'aim', aim: 1 }), 16);
    const quick = s3b.t;
    P.pcDirect(s3b, inp({ shotCam: '3d', phase: 'aim', aim: 1 }), 2000);
    const firstSurvey = s3b.survey;
    P.pcDirect(s3b, inp({ shotCam: '3d', phase: 'moving', aim: 1 }), 16);
    ok('stay 3D: a soft shot that barely rose gets a shorter beat', quick > -P.PC_SURVEY_DWELL_MS / P.PC_TWEEN_MS.back / 2 && quick < 0);
    ok('stay 3D: each shot surveys from its own heading, not the last one', s3b.survey !== firstSurvey && Math.abs(heading(s3b.survey) - 1) < 1e-9);
    const b = P.pcBroadcast(W, H, cfg), bv = P.pcView(b), ov = P.pcView(P.pcOrtho(W, H, cfg));
    const corner = [cfg.halfLength + cfg.railWidth, cfg.halfWidth + cfg.railWidth, 16];
    const pb = P.pcProject(bv, corner), po = P.pcProject(ov, corner);
    ok('broadcast frames the table like the 2D view', Math.hypot(pb[0] - po[0], pb[1] - po[1]) < 3, Math.hypot(pb[0] - po[0], pb[1] - po[1]).toFixed(2) + ' px apart at the rail corner');
}

// ── 4. Polygons and ball markings ─────────────────────────────────────
head('Polygons and ball markings');
{
    const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return Math.abs(a) / 2; };
    const sq = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
    ok('clip: overlapping squares leave the overlap', Math.abs(area(P.pgClipConvex(sq(0, 0, 10), sq(5, 5, 10))) - 25) < 1e-9);
    ok('clip: the clip polygon\'s winding does not matter', Math.abs(area(P.pgClipConvex(sq(0, 0, 10), sq(5, 5, 10).reverse())) - 25) < 1e-9);
    ok('clip: disjoint polygons leave nothing', P.pgClipConvex(sq(0, 0, 4), sq(10, 10, 4)).length === 0);

    const cap = (a, h) => P.pgCap(P.pcNorm(a), h, 0, 0, 100);
    const face = cap([0, 0, 1], 0.46);
    const rho = Math.sqrt(1 - 0.46 * 0.46) * 100;
    ok('a cap facing the viewer is its full rim circle', face.length === 40 && face.every(p => Math.abs(Math.hypot(p[0], p[1]) - rho) < 1e-6));
    ok('a cap facing away is not drawn', cap([0, 0, -1], 0.46) === null);
    const side = cap([1, 0, 0], 0.46);
    const inDisc = side.every(p => Math.hypot(p[0], p[1]) <= 100 + 1e-6);
    // Seen side-on, the cap is the disc's sliver beyond x = 46: area r²(θ − sin θ cos θ), θ = acos 0.46.
    const th = Math.acos(0.46), expect = 100 * 100 * (th - Math.sin(th) * Math.cos(th));
    ok('a cap seen side-on is the sliver of the disc beyond its rim', inDisc && Math.abs(area(side) - expect) / expect < 0.02, area(side).toFixed(0) + ' vs ' + expect.toFixed(0) + ' px²');
    const tilt = cap([0.6, 0.2, 0.3], 0.46);
    ok('a tilted cap stays inside the ball', tilt && tilt.every(p => Math.hypot(p[0], p[1]) <= 100 + 1e-6));
}

// ── 5. Guides ─────────────────────────────────────────────────────────
head('Guides on the real physics');
{
    const world = balls => { const w = P.ppCreateWorld(); w.balls = balls.map(([id, x, y]) => P.ppMakeBall(id, x, y)); return w; };
    const straight = P.pgGuide(world([[0, -200, 0], [3, 100, 0]]), { angle: 0, speed: 1600, tipX: 0, tipY: 0 });
    ok('straight in: contact one ball-width short of the object ball', straight.hit === 3 && Math.abs(straight.contact[0] - (100 - 28)) < 2 && Math.abs(straight.contact[1]) < 1e-6, straight.contact.map(v => v.toFixed(2)).join(', '));
    ok('straight in: the object ball goes straight on', straight.obj && Math.abs(straight.obj.dy) < 1e-6 && straight.obj.dx > 0.999);
    const draw = P.pgGuide(world([[0, -200, 0], [3, 100, 0]]), { angle: 0, speed: 1600, tipX: 0, tipY: -0.55 });
    const back = draw.after[draw.after.length - 1][0];
    ok('draw: the cue ball\'s path after contact comes back', back < draw.contact[0] - 20, (back - draw.contact[0]).toFixed(0) + ' u');
    const follow = P.pgGuide(world([[0, -200, 0], [3, 100, 0]]), { angle: 0, speed: 1600, tipX: 0, tipY: 0.45 });
    ok('follow: it runs on through', follow.after[follow.after.length - 1][0] > follow.contact[0] + 20);
    const cut = P.pgGuide(world([[0, -200, 0], [3, 100, 14]]), { angle: 0, speed: 1600, tipX: 0, tipY: 0 });
    const tangent = Math.atan2(cut.after[cut.after.length - 1][1] - cut.contact[1], cut.after[cut.after.length - 1][0] - cut.contact[0]);
    ok('a half-ball cut sends the two balls apart on opposite sides', cut.obj.dy > 0 && tangent < 0, 'object ' + (Math.atan2(cut.obj.dy, cut.obj.dx) / DEG).toFixed(1) + '°, cue ' + (tangent / DEG).toFixed(1) + '°');
    const eng = P.pgGuide(world([[0, -200, 0], [3, 300, 0]]), { angle: 0, speed: 1600, tipX: 0.5, tipY: 0 });
    ok('right English squirts the contact left of the aim line', eng.contact[1] > 0.5, eng.contact[1].toFixed(2) + ' u');
    const rail = P.pgGuide(world([[0, 0, 0]]), { angle: Math.PI / 2 - 0.3, speed: 1200, tipX: 0, tipY: 0 });
    ok('no ball in the way: contact is the cushion, with a rebound path', rail.cushion && rail.hit === -1 && Math.abs(rail.contact[1] - (cfg.halfWidth - cfg.ballR)) < 2 && rail.after.length > 3);
    const scratch = P.pgGuide(world([[0, 300, 50]]), { angle: Math.PI / 4, speed: 900, tipX: 0, tipY: 0 });
    ok('straight at a pocket: the guide ends in it', scratch.pocketed);
    const w = world([[0, -200, 0], [3, 100, 0]]), snap = JSON.stringify(w);
    P.pgGuide(w, { angle: 0, speed: 1600 });
    ok('computing a guide leaves the real world alone', JSON.stringify(w) === snap);
    const t0 = Date.now();
    const rack = P.ppRack(P.ppCreateWorld(), P.ppRandom(3));
    for (let i = 0; i < 50; i++) P.pgGuide(rack, { angle: rand(-0.2, 0.2), speed: 1600, tipX: 0, tipY: rand(-0.5, 0.5) });
    const ms = (Date.now() - t0) / 50;
    ok('a guide on a full rack costs under 4 ms', ms < 4, ms.toFixed(2) + ' ms');
}

// ── 6. Frames through the rasterizer ──────────────────────────────────
head('Frames');
Ctx.prototype.scale = function (sx, sy) { const m = this.m; this.m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]]; };
Ctx.prototype.transform = function (a, b, c, d, e, f) {
    const m = this.m;
    this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
};
Ctx.prototype.drawImage = function () {};
Ctx.BACKDROP = '#000000';
function frame(scene, w, h) {
    const r = new Raster(w || W, h || H), ctx = new Ctx(r, 1);
    P.pgRender(ctx, scene);
    const px = (x, y) => { const i = ((Math.round(y) * r.w) + Math.round(x)) * 4; return [r.buf[i], r.buf[i + 1], r.buf[i + 2]]; };
    return { px };
}
{
    const rack = P.ppRack(P.ppCreateWorld(), P.ppRandom(5));
    const chase = P.pcView(P.pcChase([rack.table.headX, 0], 0, 35, W, H, cfg));
    const ortho = P.pcView(P.pcOrtho(W, H, cfg));
    const guide = P.pgGuide(rack, { angle: 0, speed: 1600 });
    const scenes = {
        '3D aim with guides': { view: chase, world: rack, aim: { angle: 0, power: 40 }, guide, guideMode: 'full' },
        '2D aim with guides': { view: ortho, world: rack, aim: { angle: 0, power: 0 }, guide, guideMode: 'short', illegal: true },
        'broadcast, no cue': { view: P.pcView(P.pcBroadcast(W, H, cfg)), world: rack, aim: null },
        'ball in hand on the break': { view: ortho, world: rack, bih: { x: -300, y: 20, valid: true }, kitchen: true },
        'ball in hand, invalid': { view: ortho, world: rack, bih: { x: rack.table.footX, y: 0, valid: false } },
        'call pocket in 3D': { view: chase, world: rack, aim: { angle: 0, power: 0 }, call: { called: 2 } },
        'pocket drop': { view: chase, world: rack, drops: [{ ball: rack.balls[5], pocket: 2, t: 0.5 }] },
        'every felt': { view: ortho, world: rack, felt: 'red' },
        'max size': { view: P.pcView(P.pcChase([-250, 0], 0, 35, 1232, 672, cfg)), world: rack, aim: { angle: 0, power: 20 }, size: [1232, 672] },
        'lean 0 near the rail': { view: P.pcView(P.pcChase([-480, 230], -0.4, 0, W, H, cfg)), world: rack, aim: { angle: -0.4, power: 0 } },
    };
    Object.entries(scenes).forEach(([name, s]) => {
        let err = null;
        try { frame(s, s.size && s.size[0], s.size && s.size[1]); } catch (e) { err = e; }
        ok(name + ' draws', !err, err ? err.stack.split('\n').slice(0, 2).join(' ') : undefined);
    });
    ['green', 'red', 'blue', 'lightgrey'].forEach(felt => {
        const f = frame({ view: ortho, world: P.ppCreateWorld(), felt }).px(W / 2 + 60, H / 2 + 40);
        ok(felt + ' felt fills the playfield', f[0] + f[1] + f[2] > 60, f.join(','));
    });
    const top = frame({ view: ortho, world: rack });
    const s = ortho.pose.s, at = (x, y) => [W / 2 + s * x, H / 2 - s * y];
    const felt = top.px(...at(-100, 100)), cue = top.px(...at(rack.table.headX, 0)), hole = top.px(...at(0, cfg.halfWidth + 16));
    ok('2D: green felt at (−100, 100)', felt[1] > felt[0] && felt[1] > felt[2], felt.join(','));
    // The rasterizer flattens each gradient to its middle stop, so the rim
    // shade darkens the whole ball here; "neutral and light" is the check.
    const ivory = c => Math.max(...c) - Math.min(...c) < 16 && c[0] > 90;
    ok('2D: the cue ball is ivory', ivory(cue), cue.join(','));
    ok('2D: the top side pocket is dark', hole.every(c => c < 70), hole.join(','));
    const apex = top.px(...at(rack.table.footX, 0));
    ok('2D: the apex ball (the 1 or a stripe) is not felt', Math.abs(apex[1] - felt[1]) > 20 || Math.abs(apex[0] - felt[0]) > 20, apex.join(','));
    const t3 = frame({ view: chase, world: rack });
    const c3 = P.pcProject(chase, [rack.table.headX, 0, cfg.ballR]);
    const cue3 = t3.px(c3[0], c3[1]);
    ok('3D: the cue ball sits where the camera puts it', ivory(cue3), cue3.join(','));
    const sky = t3.px(W / 2, 20);
    ok('3D: above the far rail is the (cleared) backdrop', sky.every(c => c < 10), sky.join(','));
    const hidden = frame({ view: ortho, world: rack, bih: { x: 0, y: 0, valid: true } }).px(...at(rack.table.headX, 0));
    ok('ball in hand hides the real cue ball', !ivory(hidden), hidden.join(','));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
