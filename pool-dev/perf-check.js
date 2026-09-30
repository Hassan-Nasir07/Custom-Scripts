// Frame cost and the FPS cap (POOL_V2_PLAN.md, Phase 9), in real Chrome over pool-table.html.
//
//   node pool-dev/perf-check.js
//
// For the compact panel (and the widget's 316 px column) in 3D and 2D it times poolDraw:
//   aim     a full repaint every frame (the aim turning, so the camera and the guide move)
//   moving  a shot rolling, stepped between draws
//   idle    nothing changed (the HUD's model and diff only)
// then runs the real loop for two seconds at the 60 and 30 FPS settings and counts draws.
// Headless Chrome here rasterises the canvas in software, so these are an upper bound on a
// laptop with GPU canvas. The bar: a 3D repaint under 4 ms (median), and the cap within 10%.
// Snooker's CPU (S7): each tier plans a shot from three mid-frame positions, in the 12 ms
// slices the controller gives it. The bar: a shot within its tier's time cap (maxMs) plus a
// slice, and slices near their budget: 95% within 20 ms, none past 30 (a slice stops before a
// trial its recent cost says would overrun it, so only an unusually long one can).
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const CHROME = require('./browser').browserPath();     // Chrome, else Edge, or POOL_BROWSER
const page = 'file:///' + path.join(__dirname, 'pool-table.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MEASURE = `(async () => {
    const S = poolS, out = {};
    const time = (n, fn) => { const t = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); fn(i); t.push(performance.now() - t0); } t.sort((a, b) => a - b); return { median: +t[n >> 1].toFixed(2), p95: +t[Math.floor(n * 0.95)].toFixed(2) }; };
    for (let i = 0; i < 20; i++) { S.aim += 0.004; S.drawKey = ''; poolDraw(16); }     // warm up the caches and the JIT
    out.aim = time(150, () => { S.aim += 0.004; S.drawKey = ''; poolDraw(16); });
    S.phase = 'aim';
    ppStrike(S.world, { angle: S.aim, speed: S.cfg.maxSpeed * 0.8, tipX: 0, tipY: 0 }); S.phase = 'moving';
    out.moving = time(150, () => { ppStep(S.world, 1 / 60); poolDraw(16); });
    S.phase = 'aim'; poolDraw(16); poolDraw(5000);
    out.idle = time(200, () => poolDraw(16));
    const real = poolDraw;
    let draws = 0;
    window.poolDraw = function (dt) { draws++; return real(dt); };
    for (const fps of [60, 30]) {
        userPreferences.gameFps = fps; draws = 0;
        S.running = true; S.lastMs = 0; S.sinceDraw = 0; S.raf = requestAnimationFrame(poolLoop);
        await new Promise(r => setTimeout(r, 2000));
        S.running = false; cancelAnimationFrame(S.raf);
        out['fps' + fps] = +(draws / 2).toFixed(1);
    }
    window.poolDraw = real;
    return out;
})()`;

// Snooker's CPU, per tier: several plans from the position on the table, each stepped in the
// controller's slices; the time a shot takes to plan, and the longest slice.
const SNK_CPU = `(() => {
    const S = poolS, out = {}, slice = POOL_GAMES.snooker.cpu.slice;
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1); };
    for (const tier of ['easy', 'normal', 'hard', 'pro']) {
        const totals = [], steps = [];
        for (let k = 0; k < 4; k++) {
            const job = paSnPlan(S.world, S.frame, { rng: ppRandom(11 + k), tier, safeRun: 0 });
            let total = 0;
            for (let n = 0; n < 5000; n++) {
                const t0 = performance.now(), done = job.step(slice), dt = performance.now() - t0;
                total += dt; steps.push(dt);
                if (done) break;
            }
            totals.push(total);
        }
        out[tier] = { median: q(totals, 0.5), max: q(totals, 1), stepP95: q(steps, 0.95), stepMax: q(steps, 1), cap: PA_SN_TIERS[tier].maxMs, slice };
    }
    return out;
})()`;

(async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-chrome-'));
    const port = 9300 + Math.floor(Math.random() * 400);
    const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--allow-file-access-from-files', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
    let target;
    for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(t => t.type === 'page'); } catch (_) {} }
    if (!target) { console.log('chrome did not start'); proc.kill(); process.exit(1); }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0; const pending = {};
    ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });
    const send = (method, params) => new Promise(r => { const n = ++id; pending[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    let pass = 0, fail = 0;
    const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓ ' + name + (detail ? '  ' + detail : '')); } else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); } };
    const fmt = t => t.median + ' ms median, ' + t.p95 + ' p95';
    for (const [label, q] of [['compact 3D', 'scene=mid&camera=3d'], ['316 px column 3D', 'scene=mid&camera=3d&narrow=1'], ['compact 2D', 'scene=mid&camera=2d'],
        // Snooker (S3): 22 balls on the smaller table, in 2D (the rack) and 3D.
        ['snooker 2D, the 22-ball rack', 'game=snooker&camera=2d'], ['snooker 3D, mid-frame', 'game=snooker&scene=red&camera=3d']]) {
        await send('Page.navigate', { url: page + '?still=1&' + q });
        for (let i = 0; i < 60; i++) { await sleep(80); if (await evaluate('window.__ready === true')) break; }
        const r = await evaluate(MEASURE);
        console.log('\n── ' + label);
        ok('a full repaint (aiming) under 4 ms', r.aim.median < 4, fmt(r.aim));
        ok('a shot rolling under 4 ms', r.moving.median < 4, fmt(r.moving));
        ok('an unchanged frame costs next to nothing', r.idle.median < 0.5, fmt(r.idle));
        ok('the 60 and 30 FPS settings are kept', Math.abs(r.fps60 - 60) <= 6 && Math.abs(r.fps30 - 30) <= 3, r.fps60 + ' and ' + r.fps30 + ' draws a second');
    }
    for (const [label, q] of [['on a red', 'game=snooker&scene=red&camera=3d'], ['on the colours', 'game=snooker&scene=colours&camera=3d'], ['needing snookers', 'game=snooker&scene=snookers&camera=3d']]) {
        await send('Page.navigate', { url: page + '?still=1&' + q });
        for (let i = 0; i < 60; i++) { await sleep(80); if (await evaluate('window.__ready === true')) break; }
        const r = await evaluate(SNK_CPU);
        console.log('\n── snooker CPU, ' + label);
        for (const tier of ['easy', 'normal', 'hard', 'pro']) {
            const t = r[tier];
            ok(tier + ': a shot within its ' + t.cap + ' ms cap', t.max <= t.cap + 2 * t.slice + 10, t.median + ' ms median, ' + t.max + ' ms at most');
            ok(tier + ': slices near their 12 ms (95% within 20 ms), none past 30 ms', t.stepP95 <= 20 && t.stepMax <= 30, 'slices ' + t.stepP95 + ' ms p95, ' + t.stepMax + ' ms at most');
        }
    }
    console.log('\n' + pass + ' passed, ' + fail + ' failed   (software canvas: an upper bound)');
    ws.close(); proc.kill();
    process.exit(fail ? 1 : 0);
})();
