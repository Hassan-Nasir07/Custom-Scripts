// Runs the REAL userscript in Chrome and plays pool v2 inside the actual widget.
//
//   node pool-dev/host-run.js [outDir]          headless: the checks below, plus PNGs
//   node pool-dev/host-run.js --open            a visible Chrome on the fake portal, to play by hand
//
// The userscript only runs at the portal's exact URL, so this intercepts that
// URL over the DevTools protocol and serves a stand-in page: one attendance row
// for today (so the widget renders) and the userscript inline. Every other
// request (fonts, sync, leaderboard) is failed at once, so nothing leaves the
// machine. For the checks, a probe is appended inside the script's own closure
// (test-only; the shipped file never has it) so the harness can read pool's state.
//
// Needs Node 22 (global WebSocket and fetch) and Chrome.
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.join(__dirname, '..');
const OPEN = process.argv.includes('--open');
const OUT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(os.tmpdir(), 'pool-host-run'));
const PORTAL = 'https://globalportal.mtbc.com/#/time-absence/attendence-record';
const CHROME = require('./browser').browserPath();     // Chrome, else Edge, or POOL_BROWSER
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Game Mode's lock: this stand-in browser has redeemed an access key. Its secret and a recent
// unlock are in storage before the userscript runs, and the stub registry (the gist, served
// below) lists its tag, so the games are open. GAMES.open = false serves it without the tag.
const GAMES = { secret: '5eed'.repeat(16), open: true };
GAMES.tag = require('crypto').createHash('sha256').update(GAMES.secret).digest('hex').slice(0, 32);
const gamesRegistry = () => JSON.stringify({ files: { 'attendance_widget_registry.json': { content: JSON.stringify({ lastUpdated: new Date().toISOString(), players: GAMES.players || [],
    gamesUnlock: { n: 1, tags: GAMES.open ? { [GAMES.tag]: { at: new Date().toISOString(), n: 0 } } : {}, grants: GAMES.grants || {} } }) } } });
const GAMES_PRESET = '<script>localStorage.setItem("atc_games_secret", "' + GAMES.secret + '"); localStorage.setItem("atc_games_ok", String(Date.now() + 864e5));</script>';

function page() {
    let script = fs.readFileSync(path.join(ROOT, 'AttendanceTimeCheckerPlus.js'), 'utf8');
    const end = script.lastIndexOf('})();');
    // Test-only window onto the closure: pool's state and the host helpers the checks call.
    const probe = `
    window.__probe = {
        checkGamesUnlock, get gamesUnlocked() { return gamesUnlocked; },
        get lbClientId() { return lbClientId; }, get lbRegistered() { return lbRegistered; },
        acctPoll, fetchLeaderboard, renderMiniBoard,
        S: poolS, get mode() { return poolMode; }, get maximized() { return poolMaximized; }, get tier() { return poolCpuTier; },
        get currentGame() { return currentGame; }, get prefs() { return userPreferences; },
        applyPreferences, poolEndFrame, poolNewFrame, resetPoolGame, prCanPlace, phThemeTokens, pcProject, pcView,
        toggleSettingsModal: typeof toggleSettingsModal === 'function' ? toggleSettingsModal : null,
        collectGameModeBests, toggleGameLeaderboard, get xp() { return userXP; },
        unlockAchievement, poolOnPrefChange,
    };
`;
    if (!OPEN) script = script.slice(0, end) + probe + script.slice(end);
    // The portal's markup, reduced to what the widget reads: the attendance table.
    return `<!doctype html><html><head><meta charset="utf-8"><title>Attendance</title></head>
<style>body { margin: 0; background: #1b1d2a; } @media (prefers-color-scheme: light) { body { background: #eef1f6; } }</style>
<body>
<div class="main-attendance-table"><table><tbody id="rows"></tbody></table></div>
<script>
(function () {
    // Today in Asia/Karachi, the day the widget counts, checked in at 09:00.
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    const d = String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0') + '/' + now.getFullYear();
    document.getElementById('rows').innerHTML = '<tr><td>1</td><td>' + d + '</td><td>Mon</td><td>09:00:00</td><td>In</td></tr>';
})();
// The portal ships jQuery; the widget uses it once, to put itself above the table.
window.$ = sel => ({ before: el => { const t = document.querySelector(sel); if (t) t.parentNode.insertBefore(el, t); } });
</script>
${GAMES_PRESET}
<script>${script.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = CHROME;
    const port = 9300 + Math.floor(Math.random() * 400);
    const args = ['--remote-debugging-port=' + port, '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'pool-host-')),
        '--no-first-run', '--no-default-browser-check', '--window-size=1400,1000', 'about:blank'];
    if (!OPEN) args.unshift('--headless=new', '--disable-gpu');
    const proc = spawn(exe, args, { stdio: 'ignore' });
    const bail = OPEN ? null : setTimeout(() => { console.log('✗ TIMEOUT'); try { proc.kill(); } catch (_) {} process.exit(2); }, 240000);

    let target;
    for (let i = 0; i < 80 && !target; i++) {
        await sleep(200);
        try { target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(t => t.type === 'page'); } catch (_) {}
    }
    if (!target) { console.log('✗ Chrome did not start'); process.exit(2); }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0;
    const pending = {}, errors = [], consoleErrors = [];
    const html = page();
    const send = (method, params) => new Promise(r => { const n = ++id; pending[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
    ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; return; }
        if (m.method === 'Fetch.requestPaused') {
            const u = m.params.request.url;
            if (u.startsWith('https://globalportal.mtbc.com/')) {
                send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
                    responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: Buffer.from(html).toString('base64') });
            } else if (m.params.request.url.startsWith('https://api.github.com/gists/')) {
                // The registry read carries an Authorization header, so it is preflighted: both get CORS.
                const cors = [{ name: 'Access-Control-Allow-Origin', value: 'https://globalportal.mtbc.com' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Accept' },
                    { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' }];
                if (m.params.request.method === 'OPTIONS') send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 204, responseHeaders: cors });
                else send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
                    responseHeaders: cors.concat([{ name: 'Content-Type', value: 'application/json' }]), body: Buffer.from(gamesRegistry()).toString('base64') });
            } else if (GAMES.bot && u.startsWith('https://api.github.com/repos/') && /\/dispatches$/.test(u)) {
                // A stand-in for the sync bot (its rules are tested in sync-verify.js): it answers
                // as the real one would, by changing the stub registry.
                const cors = [{ name: 'Access-Control-Allow-Origin', value: 'https://globalportal.mtbc.com' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Accept, Content-Type' },
                    { name: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' }];
                if (m.params.request.method === 'POST') { try { const d = JSON.parse(m.params.request.postData || '{}'); GAMES.bot(d.event_type, d.client_payload || {}); } catch (e) { errors.push('stand-in bot: ' + e.message); } }
                send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 204, responseHeaders: cors });
            } else send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' });
        }
        if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map(a => a.value || a.description).join(' '));
    });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    if (!OPEN) await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: PORTAL });
    if (OPEN) {
        console.log('Chrome is open on the fake portal. Close the window (or Ctrl+C here) when done.');
        await sleep(2500);
        await send('Runtime.evaluate', { expression: "window.switchGame && window.switchGame('pool')" });
        proc.on('exit', () => process.exit(0));
        return;
    }

    const ev = async e => {
        const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) throw new Error(e.slice(0, 80) + ': ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
        return r.result?.result?.value;
    };
    // ⚙️ fades out over 0.3 s (visibility included), and a busy headless browser can take far
    // longer: until it has, its overlay still takes the clicks meant for the panel under it.
    const settingsClosed = async () => {
        for (let i = 0; i < 50; i++) {
            if (await ev("(() => { const o = document.getElementById('settings-modal-overlay'); return !o || getComputedStyle(o).visibility === 'hidden'; })()")) return;
            await sleep(100);
        }
    };
    let pass = 0, fail = 0;
    const ok = (name, cond, detail) => {
        if (cond) { pass++; console.log('  ✓ ' + name); }
        else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
    };
    const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));
    let held = false;
    const mouse = (type, x, y, extra) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: held || type !== 'mouseMoved' ? 'left' : 'none', buttons: held ? 1 : 0, clickCount: 1 }, extra));
    const click = async sel => {
        const r = await ev('(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e || e.closest("[hidden]")) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()');
        if (!r) return false;
        await mouse('mouseMoved', r[0], r[1]); held = true; await mouse('mousePressed', r[0], r[1]); held = false; await mouse('mouseReleased', r[0], r[1]);
        await sleep(150);
        return true;
    };
    const key = async k => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k }); await sleep(120); };
    const shot = async (name, sel) => {
        const r = await ev('(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()');
        if (!r) return;
        const png = await send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, r[0] - 4), y: Math.max(0, r[1] - 4), width: r[2] + 8, height: r[3] + 8, scale: 1 } });
        fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(png.result.data, 'base64'));
    };
    const waitFor = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await ev(expr)) return true; await sleep(100); } return false; };
    // The in-page layout audit, the same checks as pool-table.html's __hudAudit, against the real host CSS.
    const audit = () => ev(`(() => {
        const S = window.__probe.S, hud = S.hud, out = [];
        const ok = (n, c, d) => out.push([n, !!c, d === undefined ? '' : String(d)]);
        const vr = hud.view.getBoundingClientRect();
        const visible = el => !el.closest('[hidden]') && el.getClientRects().length > 0;
        let chain = [], n = hud.view;
        while (n && n.nodeType === 1) { const cs = getComputedStyle(n); if (cs.filter !== 'none' || cs.clipPath !== 'none') chain.push((n.className || n.tagName) + ' {filter: ' + cs.filter + '; clip-path: ' + cs.clipPath + '}'); n = n.parentElement; }
        ok('no filter or clip-path on the viewport or any ancestor', !chain.length, chain.join(' < '));
        if (hud.layout === 'compact') {
            ok('cards row is 72 px', Math.abs(hud.el.querySelector('.ph-cards').getBoundingClientRect().height - 72) < 0.5, hud.el.querySelector('.ph-cards').getBoundingClientRect().height);
            if (visible(hud.foot)) ok('footer is 52 px', Math.abs(hud.foot.getBoundingClientRect().height - 52) < 0.5, hud.foot.getBoundingClientRect().height);
            ok('viewport keeps the design\\'s 368:412', Math.abs(vr.width / vr.height - 368 / 412) < 0.01, (vr.width / vr.height).toFixed(4));
            const col = hud.el.parentElement.clientWidth, w = hud.el.getBoundingClientRect().width;
            ok('the panel fills its column, up to 420 px', Math.abs(w - Math.min(420, col)) < 1, w + ' in ' + col);
        } else ok('Max viewport keeps 1232:672', Math.abs(vr.width / vr.height - 1232 / 672) < 0.01, (vr.width / vr.height).toFixed(4));
        const layer = Array.from(hud.view.querySelectorAll('.ph-layer > *')).filter(visible);
        const outside = layer.filter(el => { const r = el.getBoundingClientRect(); return r.left < vr.left - 1 || r.right > vr.right + 1 || r.top < vr.top - 1 || r.bottom > vr.bottom + 1; });
        ok('every overlay stays inside the table', !outside.length, outside.map(e => e.className).join(', '));
        const hit = (a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom; };
        [['spin', 'hint'], ['cam', 'pill'], ['lean', 'spin'], ['mini', 'lean'], ['replace', 'hint'], ['replace', 'gauge']].forEach(([a, b]) => {
            if (hud[a] && hud[b] && visible(hud[a]) && visible(hud[b])) ok(a + ' and ' + b + ' do not overlap', !hit(hud[a], hud[b]));
        });
        const clipped = Array.from(hud.el.querySelectorAll('.ph-name, .ph-tag, .ph-hint span, .ph-pill span, .ph-cam span, .ph-frames-n, .ph-btn span, .ph-replace span'))
            .filter(visible).filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline');
        ok('no label is cut off', !clipped.length, clipped.map(e => e.className + ' "' + e.textContent + '"').join(', '));
        const cs = getComputedStyle(hud.el), card = cs.getPropertyValue('--pool-card').trim();
        ok('--pool-card resolves', card && !/var\\(/.test(card), card);
        ok('canvas backing store is its CSS size × dpr', S.canvas.width === Math.round(S.W * S.dpr) && S.W === S.canvas.clientWidth, S.canvas.width + ' for ' + S.W);
        // Host rules that reach into the panel: buttons must keep pool's own look.
        const btn = hud.el.querySelector('.ph-btn'), bcs = btn && getComputedStyle(btn);
        ok('host button rules do not restyle the footer buttons', !bcs || (bcs.textTransform !== 'uppercase' || document.getElementById('total-time-summary').classList.contains('retro-theme')), bcs && bcs.textTransform);
        return out;
    })()`);
    const report = async label => { const r = await audit(); r.forEach(([n, c, d]) => ok(label + ': ' + n, c, d || undefined)); };
    // Text contrast against what is really behind it: every visible element with its own
    // text, its colour composited over the stack of background colours down to the page.
    // Elements over a gradient or an image are skipped (no single colour to measure), as
    // are the canvases. Returns the ones under 3:1.
    const contrast = sel => ev(`(() => {
        const root = document.querySelector(${JSON.stringify(sel)}); if (!root) return ['missing ' + ${JSON.stringify(sel)}];
        const parse = c => { const m = /rgba?\\(([^)]+)\\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
        const over = (top, base) => { const a = top[3]; return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1]; };
        const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const pageBg = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1];
        const bad = [];
        const els = [root, ...root.querySelectorAll('*')];
        for (const el of els) {
            // An overlay faded out of the way of the shot (data-shy) is meant to be see-through.
            // …and screen-reader text (.ph-sr) is never seen.
            if (!el.getClientRects().length || el.closest('[hidden]') || el.closest('[data-shy]') || el.closest('.ph-sr')) continue;
            const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
            if (!own) continue;
            // Emoji carry their own colour; text with a dark shadow carries its own contrast.
            const text = [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('');
            if (!/[\\p{L}\\p{N}]/u.test(text)) continue;
            const cs = getComputedStyle(el);
            if (/rgba\\(0, 0, 0, 0\\.[3-9]/.test(cs.textShadow)) continue;
            if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'transparent') continue;
            // The background stack, nearest first; stop at the first opaque colour.
            // A gradient counts as the average of its colour stops; an image cannot be measured.
            const stack = []; let n = el, skip = false, alpha = 1;
            while (n && n.nodeType === 1) {
                const s = getComputedStyle(n);
                alpha *= +s.opacity;
                if (/url\\(/.test(s.backgroundImage)) { skip = true; break; }
                const c = parse(s.backgroundColor);
                if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
                if (s.backgroundImage !== 'none') {
                    const stops = (s.backgroundImage.match(/rgba?\\([^)]+\\)/g) || []).map(parse).filter(Boolean);
                    if (stops.length) {
                        const avg = [0, 1, 2, 3].map(i => stops.reduce((t, p) => t + p[i], 0) / stops.length);
                        stack.push(avg);
                        if (avg[3] >= 0.999) break;
                    }
                }
                n = n.parentElement;
            }
            if (skip) continue;
            let bg = pageBg;
            for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
            const fg0 = parse(cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? cs.webkitTextFillColor : cs.color);
            if (!fg0) continue;
            const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * alpha], bg);
            const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
            if (ratio < 3) bad.push((el.id ? '#' + el.id : '') + '.' + String(el.className || el.tagName).split(' ').slice(0, 2).join('.') + ' "' + el.textContent.trim().slice(0, 24) + '" ' + ratio.toFixed(2));
        }
        return bad;
    })()`);

    // ── Boot ──────────────────────────────────────────────────────────
    head('Boot');
    const booted = await waitFor('!!document.getElementById("total-time-summary") && !!window.switchGame && !!window.__probe', 15000);
    ok('the userscript boots on the fake portal and renders the widget', booted);
    if (!booted) { console.log(errors); process.exit(1); }
    await sleep(800);
    ok('no page errors while booting', !errors.length, errors.slice(0, 3));

    // ── The pool panel ────────────────────────────────────────────────
    head('The pool panel');
    await ev("window.switchGame('pool')");
    await sleep(900);
    const st = await ev(`(() => { const S = window.__probe.S; const root = document.getElementById('pool-root');
        return { game: window.__probe.currentGame, shown: root && getComputedStyle(root).display !== 'none', hud: !!root.querySelector('.pool-hud[data-layout="compact"]'),
            canvas: S.W + 'x' + S.H, running: S.running, phase: S.phase, names: [...root.querySelectorAll('[data-ph=name]')].map(e => e.textContent),
            controls: getComputedStyle(document.getElementById('pool-controls')).display, wins: document.getElementById('pool-wins').textContent,
            title: document.getElementById('game-title').textContent, scoreboard: getComputedStyle(document.getElementById('pool-scoreboard')).display }; })()`);
    ok('switchGame("pool") shows #pool-root with the compact HUD', st.game === 'pool' && st.shown && st.hud, st);
    ok('the canvas is sized from the panel and the loop runs', /^\d{3}x\d{3}$/.test(st.canvas) && st.running, st.canvas);
    ok('a frame waits for the break: ball in hand, "You" vs "CPU"', st.phase === 'bih' && st.names.join() === 'You,CPU', st.names);
    ok('no controls row under the panel; the header keeps the title and the wins button', st.controls === 'none' && st.scoreboard === 'flex' && /Pool/.test(st.title), st);
    await report('compact, Glassmorphic dark');
    await shot('host-compact-dark', '.snake-game-container');

    // ── Ball in hand, by mouse ────────────────────────────────────────
    head('Break, by mouse');
    const box = await ev('(() => { const r = window.__probe.S.canvas.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()');
    const x0 = box[0] + box[2] * 0.3, y0 = box[1] + box[3] * 0.5;
    await mouse('mouseMoved', x0, y0); held = true; await mouse('mousePressed', x0, y0);
    for (let i = 1; i <= 12; i++) { await mouse('mouseMoved', x0 + i * 30, y0 - i * 25); await sleep(16); }
    const drag = await ev('(() => { const S = window.__probe.S, c = S.world.balls[0]; return { x: c.x, y: c.y, head: S.world.table.headX, bad: window.__probe.prCanPlace(S.world, c.x, c.y, S.frame.ballInHand) }; })()');
    ok('dragged past the head string and off the table, the cue ball waits on the string', drag.x <= drag.head + 1e-9 && drag.bad === null, drag);
    await mouse('mouseMoved', x0, y0); await sleep(30);
    held = false; await mouse('mouseReleased', x0, y0); await sleep(200);
    const placed = await ev('(() => { const S = window.__probe.S; return { phase: S.phase, placed: S.placed, replace: !S.hud.replace.hidden }; })()');
    ok('releasing places it and shows Move cue ball', placed.phase === 'aim' && placed.placed && placed.replace, placed);
    await shot('host-placed', '.snake-game-container');

    // Free spin, by mouse: drag the dot on the small ball, open the picker with a click,
    // press on the big ball, take a preset, nudge with an arrow, close from outside.
    head('Spin, by mouse');
    const rectOf = sel => ev('(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e || e.closest("[hidden]")) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()');
    const tipNow = () => ev('(() => { const S = window.__probe.S; return { x: S.tip.x, y: S.tip.y, open: S.spinOpen, label: document.querySelector("#pool-root [data-ph=spinv]").textContent }; })()');
    const sb = await rectOf('#pool-root [data-ph=spinball]');
    const scx = sb[0] + sb[2] / 2, scy = sb[1] + sb[3] / 2;
    await mouse('mouseMoved', scx, scy); held = true; await mouse('mousePressed', scx, scy);
    for (let i = 1; i <= 6; i++) { await mouse('mouseMoved', scx + i * 1.6, scy - i * 2); await sleep(16); }
    held = false; await mouse('mouseReleased', scx + 9.6, scy - 12); await sleep(150);
    const t1 = await tipNow();
    ok('dragging the dot on the small ball sets follow and right English', t1.x > 0.2 && t1.y > 0.3 && Math.hypot(t1.x, t1.y) <= 0.6 + 1e-9 && !t1.open, t1);
    ok('…and names it on the button', /Follow/.test(t1.label) && /R/.test(t1.label), t1.label);
    await click('#pool-root [data-ph=spin] .ph-spin-text');
    ok('a click on the spin control opens the picker', (await tipNow()).open && !!(await rectOf('#pool-root [data-ph=spinpop]')));
    const bb = await rectOf('#pool-root [data-ph=spinbig]');
    const bx = bb[0] + bb[2] * 0.3, by = bb[1] + bb[3] * 0.7;          // lower left: draw and left English
    await mouse('mouseMoved', bx, by); held = true; await mouse('mousePressed', bx, by); held = false; await mouse('mouseReleased', bx, by); await sleep(150);
    const t2 = await tipNow();
    ok('a press on the big ball puts the tip under the pointer, and letting go confirms and closes', Math.abs(t2.x + 0.4) < 0.03 && Math.abs(t2.y + 0.4) < 0.03 && !t2.open, t2);
    // A drag: open while the dot moves, closed with the tip where it was let go.
    await click('#pool-root [data-ph=spin] .ph-spin-text');
    const bb2 = await rectOf('#pool-root [data-ph=spinbig]');
    const dcx = bb2[0] + bb2[2] / 2, dcy = bb2[1] + bb2[3] / 2;
    await mouse('mouseMoved', dcx, dcy); held = true; await mouse('mousePressed', dcx, dcy);
    for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', dcx + i * 2, dcy - i * 3); await sleep(16); }
    const mid2 = await tipNow();
    held = false; await mouse('mouseReleased', dcx + 16, dcy - 24); await sleep(150);
    const t2b = await tipNow();
    ok('dragging on the big ball keeps it open until the release, which confirms the tip', mid2.open && !t2b.open && t2b.x > 0.2 && t2b.y > 0.3, { mid2, t2b });
    await click('#pool-root [data-ph=spin] .ph-spin-text');
    await click('#pool-root [data-ph-tip="1"]');
    const t3 = await tipNow();
    ok('the Follow chip sets the preset, confirms and closes', t3.x === 0 && Math.abs(t3.y - 0.45) < 1e-9 && !t3.open, t3);
    await click('#pool-root [data-ph=spin] .ph-spin-text');
    await ev('document.querySelector("#pool-root [data-ph=spinbig]").focus()');
    const aim0 = await ev('window.__probe.S.aim');
    await key('ArrowUp');
    const t4 = await tipNow();
    ok('↑ on the focused picker adds follow and keeps it open, without turning the aim', Math.abs(t4.y - 0.5) < 1e-9 && t4.open && (await ev('window.__probe.S.aim')) === aim0, t4);
    await shot('host-spin-open', '.snake-game-container');
    await key('Enter');
    const t4b = await tipNow();
    ok('Enter confirms and closes, keeping the tip', !t4b.open && Math.abs(t4b.y - 0.5) < 1e-9, t4b);
    await click('#pool-root [data-ph=spin] .ph-spin-text');
    const vb = await rectOf('#pool-root .ph-canvas');
    await mouse('mouseMoved', vb[0] + vb[2] * 0.7, vb[1] + 40); held = true; await mouse('mousePressed', vb[0] + vb[2] * 0.7, vb[1] + 40); held = false;
    await mouse('mouseReleased', vb[0] + vb[2] * 0.7, vb[1] + 40); await sleep(150);
    const t5 = await tipNow();
    ok('a press on the table closes the picker, keeping the tip', !t5.open && Math.abs(t5.y - 0.5) < 1e-9 && (await ev('window.__probe.S.phase')) === 'aim', t5);
    // Esc during a power stroke cancels it and leaves the frame alone.
    const rack0 = await ev('window.__probe.S.rackId');
    const cx = box[0] + box[2] / 2, cy = box[1] + box[3] - 70;
    await mouse('mouseMoved', cx, cy); held = true; await mouse('mousePressed', cx, cy); await mouse('mouseMoved', cx, cy - 50); await sleep(60);
    const mid = await ev('window.__probe.S.power');
    await key('Escape');
    held = false; await mouse('mouseReleased', cx, cy - 50); await sleep(150);
    const esc = await ev('(() => { const S = window.__probe.S; return { power: S.power, phase: S.phase, rack: S.rackId, drag: S.drag }; })()');
    ok('Esc cancels a power stroke without resetting the frame', mid > 5 && esc.power === 0 && esc.phase === 'aim' && esc.rack === rack0 && !esc.drag, { mid, esc });
    // The break itself: press and push forward along the shot line.
    await mouse('mouseMoved', cx, cy); held = true; await mouse('mousePressed', cx, cy);
    for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', cx, cy - i * 14); await sleep(16); }
    held = false; await mouse('mouseReleased', cx, cy - 140);
    ok('a full push breaks the rack', await waitFor('window.__probe.S.phase === "moving"', 2000));
    await sleep(700);
    await shot('host-break-running', '.snake-game-container');
    const settled = await waitFor('["aim","bih","over"].includes(window.__probe.S.phase) && !["moving","strike"].includes(window.__probe.S.phase)', 15000);
    const after = await ev('(() => { const S = window.__probe.S; return { phase: S.phase, turn: S.frame.turn, isBreak: S.frame.isBreak, toast: S.toast && S.toast.title }; })()');
    ok('the break settles and is judged', settled && after.isBreak === false, after);

    // Let the CPU play whenever it is at the table: it must strike by itself.
    head('The CPU at the table');
    let cpuShots = 0;
    for (let round = 0; round < 6 && cpuShots < 2; round++) {
        const turn = await ev('window.__probe.S.frame.turn');
        if (turn === 2) {
            const struck = await waitFor('window.__probe.S.phase === "moving"', 9000);
            if (struck) cpuShots++;
            await waitFor('!["moving","strike"].includes(window.__probe.S.phase)', 15000);
        } else {
            // Our turn: shoot along the current aim, medium power.
            await ev('(() => { const S = window.__probe.S; if (S.phase === "bih") { const w = S.world; for (let x = -400; x <= 400; x += 40) for (let y = -200; y <= 200; y += 40) if (!window.__probe.prCanPlace(w, x, y, S.frame.ballInHand)) { const c = w.balls[0]; Object.assign(c, { x, y, state: "stationary" }); S.phase = "aim"; S.placed = true; return; } } })()');
            await sleep(200);
            await mouse('mouseMoved', cx, cy); held = true; await mouse('mousePressed', cx, cy);
            for (let i = 1; i <= 6; i++) { await mouse('mouseMoved', cx, cy - i * 12); await sleep(16); }
            held = false; await mouse('mouseReleased', cx, cy - 72);
            await waitFor('window.__probe.S.phase === "moving"', 3000);
            await waitFor('!["moving","strike"].includes(window.__probe.S.phase)', 15000);
        }
        if (await ev('window.__probe.S.phase === "over"')) break;
    }
    ok('the CPU took its turns by itself', cpuShots >= 1 || await ev('window.__probe.S.phase === "over"'), cpuShots + ' CPU shots');
    ok('no page errors during play', !errors.length, errors.slice(0, 3));

    // ── Max ───────────────────────────────────────────────────────────
    head('Max');
    await click('#pool-root [data-ph=max]');
    await sleep(500);
    const mx = await ev(`(() => { const f = document.querySelector('.pool-modal-overlay .pool-max-frame'); const S = window.__probe.S;
        return { frame: !!f, canvasIn: !!(f && f.contains(S.canvas)), maximized: window.__probe.maximized, W: S.W, H: S.H, VH: S.canvas.parentElement.clientHeight,
            header: !!document.querySelector('.pool-modal-overlay .pool-modal-header'), size: f && [f.getBoundingClientRect().width | 0, f.getBoundingClientRect().height | 0] }; })()`);
    // ⚙️ Max View's default: the whole 1232 × 672 view is the table (the bars would take 128 px of it).
    ok('Max opens the design\'s full view with the table moved into it, the whole view the table', mx.frame && mx.canvasIn && mx.maximized && Math.abs(mx.W - 1230) <= 2 &&
       Math.abs(mx.VH - 670) <= 3 && Math.abs(mx.H - mx.VH) <= 1, mx);
    ok('…inside the shared modal, without its canvas header', !mx.header, mx);
    await report('Max, Glassmorphic dark');
    await shot('host-max-dark', '.pool-max-frame');
    await key('Escape');
    await sleep(450);
    const closed = await ev(`(() => { const S = window.__probe.S; return { overlay: !!document.querySelector('.pool-modal-overlay'), back: document.getElementById('pool-root').contains(S.canvas), maximized: window.__probe.maximized, W: S.W }; })()`);
    ok('Esc closes Max and the table comes back to the panel', !closed.overlay && closed.back && !closed.maximized && closed.W > 260 && closed.W < 400, closed);

    // ── Theme ─────────────────────────────────────────────────────────
    head('Theme');
    await ev("(() => { const p = window.__probe.prefs; p.displayTheme = 'retro-futuristic'; window.__probe.applyPreferences(); })()");
    // The theme's boot-in animation filters the panels while it plays; audit after it.
    await waitFor('!document.getElementById("total-time-summary").classList.contains("rt-booting")', 6000);
    await sleep(300);
    const cy1 = await ev('(() => { const S = window.__probe.S; return { accent: window.__probe.phThemeTokens(S.hud).accent, pick: (window.__probe.prefs.cyberAccent || "").toLowerCase(), retro: document.getElementById("total-time-summary").classList.contains("retro-theme") }; })()');
    ok('switching to Cyberpunk repaints the felt accent with the user\'s accent, no reload', cy1.retro && cy1.accent === cy1.pick, cy1);
    await report('compact, Cyberpunk');
    await shot('host-compact-cyber', '.snake-game-container');
    await click('#pool-root [data-ph=max]');
    await sleep(500);
    const mcy = await ev(`(() => { const f = document.querySelector('.pool-max-frame'); return { retro: f && f.classList.contains('retro-theme'), token: f && getComputedStyle(f).getPropertyValue('--rt-accent').trim() }; })()`);
    ok('the Max frame carries the Cyberpunk classes and tokens', mcy.retro && !!mcy.token, mcy);
    await report('Max, Cyberpunk');
    await shot('host-max-cyber', '.pool-max-frame');
    await key('Escape'); await sleep(450);
    await ev("(() => { const p = window.__probe.prefs; p.displayTheme = 'glassmorphic'; window.__probe.applyPreferences(); })()");
    await sleep(300);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await sleep(500);
    await report('compact, Glassmorphic light');
    await shot('host-compact-light', '.snake-game-container');
    await click('#pool-root [data-ph=max]'); await sleep(500);
    await report('Max, Glassmorphic light');
    await shot('host-max-light', '.pool-max-frame');
    await key('Escape'); await sleep(450);
    await shot('host-widget-light', '#total-time-summary');
    // Light mode across the widget: every text at 3:1 or better against what is behind it.
    head('Light mode contrast');
    const lightBad = await contrast('#total-time-summary');
    ok('light: the widget\'s text is readable (pool panel open)', !lightBad.length, lightBad.slice(0, 8).join(' | '));
    for (const g of ['snake', 'flappy', 'tetris', 'reflex', 'aim', 'breakout', 'ludo', 'prayer']) {
        await ev("window.switchGame('" + g + "')"); await sleep(500);
        await shot('host-' + g + '-light', '.snake-game-container');
        const b = await contrast('.snake-game-container');
        ok('light: ' + g + ' panel text is readable', !b.length, b.slice(0, 8).join(' | '));
    }
    await ev("window.switchGame('pool')"); await sleep(400);
    await click('#pool-root [data-ph=max]'); await sleep(500);
    const maxBad = await contrast('.pool-max-frame');
    ok('light: pool Max text is readable', !maxBad.length, maxBad.slice(0, 8).join(' | '));
    await key('Escape'); await sleep(450);
    if (await ev('!!window.__probe.toggleSettingsModal')) {
        await ev('window.__probe.toggleSettingsModal()'); await sleep(500);
        await shot('host-settings-light', '.settings-modal');
        const sb = await contrast('.settings-modal');
        ok('light: ⚙️ settings text is readable', !sb.length, sb.slice(0, 8).join(' | '));
        await ev('window.__probe.toggleSettingsModal()'); await settingsClosed();
    }
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });

    // ── Switching games, settings, awards ─────────────────────────────
    // ── The Game mode sheet, by mouse ─────────────────────────────────
    head('Game mode sheet');
    const pre = await ev(`(() => { const S = window.__probe.S, m = document.querySelector('#pool-root [data-ph=mode]'), b = m.getBoundingClientRect();
        const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        const ov = document.getElementById('settings-modal-overlay'), oc = ov && getComputedStyle(ov);
        return { phase: S.phase, sheet: S.sheet.open, handoff: S.handoff, footHidden: !!m.closest('[hidden]'), top: top && (top.className || top.tagName), maxed: window.__probe.maximized,
            overlay: ov ? ov.className + ' · ' + oc.visibility + ' · ' + oc.opacity : 'none' }; })()`);
    const clicked = await click('#pool-root [data-ph=mode]');
    const sh1 = await ev(`(() => { const S = window.__probe.S, h = document.querySelector('#pool-root [data-ph=sheet]');
        return { open: S.sheet.open, shown: !!h && !h.closest('[hidden]'), tab: S.sheet.mode, rows: [...document.querySelectorAll('#pool-root [data-ph-diff] .ph-sheet-dn > span:first-child')].map(b => b.textContent) }; })()`);
    ok('the footer Vs CPU button opens the Game mode sheet on Vs CPU', sh1.open && sh1.shown && sh1.tab === 'cpu' && sh1.rows.join() === 'Adaptive,Easy,Normal,Hard,Pro', { sh1, pre, clicked });
    await report('sheet open, compact');
    await shot('host-sheet', '.snake-game-container');
    const tier0 = await ev('window.__probe.tier');
    await click('#pool-root [data-ph-diff="pro"]');
    const sh2 = await ev(`(() => ({ tier: window.__probe.tier, open: window.__probe.S.sheet.open, pref: window.__probe.prefs.poolDifficulty,
        note: document.querySelector('#pool-root [data-ph=sheetnote]').closest('[hidden]') ? '' : document.querySelector('#pool-root [data-ph=sheetnote]').textContent }))()`);
    ok('mid-frame, a pick is remembered for the next frame and the sheet says so', sh2.pref === 'pro' && sh2.tier === tier0 && sh2.open && /Pro from the next frame/.test(sh2.note), sh2);
    await key('Escape');
    ok('Esc closes the sheet', !(await ev('window.__probe.S.sheet.open')));
    await click('#pool-root [data-ph=mode]');
    await click('#pool-root [data-ph-mode="pvp"]');
    await click('#pool-root [data-ph=sheetstart]');
    const sh3 = await ev('(() => ({ mode: window.__probe.mode, open: window.__probe.S.sheet.open, fresh: window.__probe.S.frame.isBreak }))()');
    ok('2 Players → START 2-PLAYER FRAME: a fresh 2-player rack', sh3.mode === 'pvp' && !sh3.open && sh3.fresh, sh3);
    await click('#pool-root [data-ph=mode]');
    await click('#pool-root [data-ph-mode="cpu"]');          // the sheet opens on 2 Players; switch the tab first
    await click('#pool-root [data-ph-diff="adaptive"]');
    const sh4 = await ev('(() => ({ mode: window.__probe.mode, open: window.__probe.S.sheet.open, tier: window.__probe.tier, rec: document.querySelector(".ph-card[data-seat=\'2\'] [data-ph=rec]").textContent }))()');
    ok('a difficulty from 2 Players switches back to Vs CPU, adaptive', sh4.mode === 'cpu' && !sh4.open && /^Adaptive · /.test(sh4.rec), sh4);

    // ── A tournament, by mouse, through a page reload ─────────────────
    head('Tournament');
    const tq = async () => ev(`(() => { const S = window.__probe.S, T = S.tour, pu = S.hud.pu;
        return { mode: window.__probe.mode, screen: T.screen, dialog: T.dialog, n: T.setup && T.setup.n, t: !!T.t, current: T.t && T.t.current,
            shown: !!pu && !pu.screen.hidden, dlg: !!pu && !pu.dialog.hidden, saved: !!localStorage.getItem('poolTournament'), game: window.__probe.currentGame }; })()`);
    await click('#pool-root [data-ph=mode]');
    await click('#pool-root [data-ph-mode="tour"]');
    ok('the sheet\'s Tournament tab: SET UP TOURNAMENT and the cabinet link', await ev(`(() => { const b = document.querySelector('#pool-root [data-ph=sheettourgo]'); return !!b && !b.closest('[hidden]') && /SET UP TOURNAMENT/.test(b.textContent); })()`));
    await click('#pool-root [data-ph=sheettourgo]');
    let tr = await tq();
    ok('SET UP TOURNAMENT opens setup over the panel', tr.screen === 'setup' && tr.shown && tr.n === 4, tr);
    await click('#pool-root .pu-stepper [data-pu-arg="1"]'); await click('#pool-root .pu-stepper [data-pu-arg="1"]');
    ok('the + stepper adds contestants, and keeps focus on itself across the re-render', (await tq()).n === 6 &&
       await ev(`document.activeElement && document.activeElement.getAttribute('data-pu-arg') === '1'`));
    // Below the fold of the setup body a click would land on the pinned START button: scroll first, as a person would.
    const typeInto = async (sel, text) => { await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`); await sleep(60); await click(sel); await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.select(); })()`); await send('Input.insertText', { text }); await sleep(80); };
    const who = ['Bilal', 'Hamza', 'Sana', 'Usman', 'Zara'];
    for (let i = 0; i < who.length; i++) await typeInto('#pool-root #pu-p' + (i + 1), who[i]);
    ok('names typed into the list land in the draft', (await ev('window.__probe.S.tour.setup.names.slice(1, 6).join()')) === who.join());
    await click('#pool-root select[data-pu-in="race:0"]');
    await key('Escape');
    await ev(`document.querySelector('#pool-root select[data-pu-in="race:0"]').focus()`);
    await key('3');
    ok('a number typed on a race-to select stays in the select (the host\'s 1–9 game keys do not fire)', (await tq()).game === 'pool');
    await shot('host-tour-setup', '.snake-game-container');
    await click('#pool-root [data-pu-act="start"]');
    tr = await tq();
    ok('START TOURNAMENT: the bracket, saved to localStorage', tr.screen === 'bracket' && tr.saved && tr.t, tr);
    await shot('host-tour-bracket', '.snake-game-container');
    await click('#pool-root .pu-screen [data-pu-act="play"]');
    ok('PLAY NEXT MATCH: the match intro', (await tq()).screen === 'intro');
    await click('#pool-root .pu-screen [data-pu-act="ready"]');
    tr = await tq();
    const hm = await ev(`(() => { const h = window.__probe.S.hud, v = el => !!el && !el.closest('[hidden]');
        return { head: v(h.tourhead) && h.tourk.textContent, title: h.tourn.textContent, bracket: v(h.bracket), pause: v(h.pause), mode: v(h.mode), reset: v(h.reset),
            rec: document.querySelector('#pool-root .ph-card[data-seat="1"] [data-ph=rec]').textContent }; })()`);
    ok('READY: the match on the table, the tournament header, Bracket / Pause for Mode / Reset', tr.mode === 'tour' && !tr.shown && hm.head && /race to/.test(hm.title) && hm.bracket && hm.pause && !hm.mode && !hm.reset && /^Seed \d+$/.test(hm.rec), { tr, hm });
    await shot('host-tour-match', '.snake-game-container');
    await click('#pool-root [data-ph=pause]');
    ok('Pause: the paused dialog over the table', (await tq()).dialog === 'pause' && (await tq()).dlg);
    await key('Escape');
    ok('Esc resumes', (await tq()).dialog === null);
    const matchId = (await tq()).current;

    // The portal reloads: the tournament comes back.
    await send('Page.reload');
    const rebooted = await waitFor('!!document.getElementById("total-time-summary") && !!window.switchGame && !!window.__probe', 15000);
    await sleep(800);
    await ev("window.switchGame('pool')");
    await sleep(700);
    tr = await tq();
    ok('after a reload, opening pool offers the tournament back', rebooted && tr.dialog === 'resume' && tr.dlg && tr.current === matchId, tr);
    await shot('host-tour-resume', '.snake-game-container');
    await click('#pool-root .pu-scrim [data-pu-act="resumeTour"]');
    tr = await tq();
    ok('RESUME: the same match is back on the table, the seat handed over first', tr.mode === 'tour' && tr.current === matchId && (await ev('window.__probe.S.handoff')) > 0, tr);
    await click('#pool-root [data-ph=ready]');
    await click('#pool-root [data-ph=pause]');
    await click('#pool-root .pu-scrim [data-pu-act="leave"]');
    tr = await tq();
    ok('Pause → Leave for now: quick play again, the tournament still saved', tr.mode === 'cpu' && tr.saved && tr.current === matchId, tr);
    await click('#pool-root [data-ph=mode]');
    await click('#pool-root [data-ph-mode="tour"]');
    await click('#pool-root [data-ph=sheetabandon]');
    ok('Abandon from the sheet asks first', (await tq()).dialog === 'abandon');
    await click('#pool-root .pu-scrim [data-pu-act="abandonYes"]');
    tr = await tq();
    ok('ABANDON TOURNAMENT deletes it from this computer', !tr.t && !tr.saved && tr.mode === 'cpu', tr);
    ok('no page errors through the tournament', !errors.length, errors.slice(0, 3));

    head('Around the panel');
    const keep = await ev('window.__probe.S.rackId');
    await ev("window.switchGame('snake')");
    await sleep(300);
    const away = await ev('(() => ({ running: window.__probe.S.running, shown: getComputedStyle(document.getElementById("pool-root")).display }))()');
    ok('switching away stops pool\'s loop and hides the panel', !away.running && away.shown === 'none', away);
    await ev("window.switchGame('pool')");
    await sleep(400);
    ok('switching back picks up the same frame', (await ev('window.__probe.S.rackId')) === keep && await ev('window.__probe.S.running'));
    // The cue collection: the header's pill, a cue an achievement earns, equipping it.
    const cue = await ev(`(() => { const pill = document.getElementById('pool-cue-pill'), out = { pill: pill && pill.textContent };
        window.__probe.unlockAchievement('streak7');
        out.notice = window.__probe.S.cueNew;
        if (pill) pill.click();
        return out; })()`);
    await sleep(400);
    const picked = await ev(`(() => { const p = document.querySelector('#pool-root .ph-cues');
        const out = { open: !!p && !p.hidden, cards: p ? p.querySelectorAll('.ph-cue-card:not(.is-hero)').length : 0, drawn: !!p && [...p.querySelectorAll('canvas')].every(c => c.width > 0) };
        const b = p && p.querySelector('[data-ph-equip="ember"]');
        if (b) b.click();
        return out; })()`);
    await sleep(400);
    const worn = await ev(`(() => ({ pref: window.__probe.prefs.poolCue, pill: document.getElementById('pool-cue-pill').textContent, just: !!document.querySelector('#pool-root .ph-cue-just') }))()`);
    ok('the header\'s cue pill names the cue; a cue an achievement earns is noticed; the pill opens the collection, every cue drawn',
       cue.pill === 'Standard' && cue.notice === 'ember' && picked.open && picked.cards === 10 && picked.drawn, [cue, picked]);
    ok('Equip puts it on: the setting, the pill and the "equipped" line', worn.pref === 'ember' && worn.pill === 'Ember' && worn.just, worn);
    await ev(`(() => { document.querySelector('#pool-root .ph-cues [data-ph-cuesx]').click(); window.__probe.prefs.poolCue = 'standard'; window.__probe.poolOnPrefChange('poolCue'); return 1; })()`);
    await sleep(300);
    if (await ev('!!window.__probe.toggleSettingsModal')) {
        await ev('window.__probe.toggleSettingsModal()');
        await sleep(400);
        const sel = await ev(`(() => { const s = document.querySelector('select[data-pref="poolShotCam"]'); if (!s) return null; s.value = '3d'; s.dispatchEvent(new Event('change', { bubbles: true })); return [...s.options].map(o => o.value); })()`);
        ok('⚙️ has the Pool Shot Camera select, and it sets userPreferences.poolShotCam', sel && sel.join() === 'overhead,3d' && (await ev('window.__probe.prefs.poolShotCam')) === '3d', sel);
        const dsel = await ev(`(() => { const s = document.querySelector('select[data-pref="poolDifficulty"]'); if (!s) return null; s.value = 'hard'; s.dispatchEvent(new Event('change', { bubbles: true })); return [...s.options].map(o => o.value); })()`);
        ok('⚙️ has the Pool CPU pin, and it sets userPreferences.poolDifficulty', dsel && dsel.join() === 'adaptive,easy,normal,hard,pro' && (await ev('window.__probe.prefs.poolDifficulty')) === 'hard', dsel);
        const tabs = await ev(`(() => { const m = document.getElementById('attendance-settings-modal'), shown = () => [...m.querySelectorAll('.settings-group')].filter(g => !g.hidden).map(g => g.dataset.settingsGroup).join();
            const out = { open: shown(), lit: (m.querySelector('.settings-tab.is-active') || {}).dataset };
            out.lit = out.lit && out.lit.settingsTab;
            m.querySelector('[data-settings-tab="ludo"]').click(); out.ludo = shown();
            m.querySelector('[data-settings-tab="cue"]').click(); out.back = shown();
            const cue = m.querySelector('[data-settings-group="cue"]').getBoundingClientRect(); out.h = Math.round(cue.height);
            return out; })()`);
        ok('⚙️ opens on the Cue Games tab while pool is up, one group at a time; the tabs switch it', tabs.open === 'cue' && tabs.lit === 'cue' && tabs.ludo === 'ludo' && tabs.back === 'cue' && tabs.h > 200, tabs);
        await ev('window.__probe.toggleSettingsModal()');
        await settingsClosed();
    } else ok('⚙️ settings modal reachable', false, 'toggleSettingsModal not found');

    // ── Snooker, through the header switch (POOL_V2_PLAN.md, Snooker, S3) ─
    head('Snooker, through the header switch');
    if (await ev('!!window.__probe.toggleSettingsModal')) {
        await waitFor('!["moving","strike"].includes(window.__probe.S.phase)', 20000);
        await ev('window.__probe.toggleSettingsModal()'); await sleep(400);
        const opts = await ev(`(() => { const out = {}; ['poolVariant', 'snookerReds', 'snookerDifficulty', 'poolClock', 'snookerClock', 'poolGuideLen'].forEach(p => { const s = document.querySelector('select[data-pref="' + p + '"]'); out[p] = s ? [...s.options].map(o => o.value).join() : null; }); return out; })()`);
        await ev('window.__probe.toggleSettingsModal()'); await settingsClosed(); await sleep(300);
        ok('⚙️ offers Snooker Reds and CPU, both shot clocks and Aim Guide None, and no Cue Game', opts.poolVariant === null && opts.snookerReds === '15,10,6' && opts.snookerDifficulty === 'adaptive,easy,normal,hard,pro' &&
           opts.poolClock === '30,45,0' && opts.snookerClock === '30,45,60,0' && opts.poolGuideLen === 'long,medium,short,none', opts);
        // The pool frame as it stands, and the switch, in one step (so the CPU cannot move a ball between).
        const sw = await ev(`(() => { const S = window.__probe.S, out = { balls: JSON.stringify(S.world.balls.map(b => [b.id, b.x, b.y, b.state])) };
            const b = document.querySelector('#game-title .pool-cue-switch'); out.found = !!b; out.label = b && b.getAttribute('aria-label'); if (b) b.click(); return out; })()`);
        await sleep(300);
        ok('the header carries the cue game switch', sw.found && sw.label === 'Switch to Snooker', sw.label);
        const sn = await ev(`(() => { const S = window.__probe.S, h = S.hud.el, t = document.getElementById('game-title'); return { game: S.game, balls: S.world.balls.length,
            title: (t.querySelector('.pool-cue-name') || t).textContent, lit: (t.querySelector('.pool-cue-opt.is-on') || {}).innerHTML, next: (t.querySelector('.pool-cue-switch') || { getAttribute: () => '' }).getAttribute('aria-label'),
            poolBtn: getComputedStyle(document.getElementById('pool-lb-btn')).display, snkBtn: getComputedStyle(document.getElementById('snooker-lb-btn')).display,
            dg: h.getAttribute('data-game'), track: !h.querySelector('[data-ph=track]').hidden, pref: window.__probe.prefs.poolVariant, zone: S.frame.ballInHand, phase: S.phase,
            tip: document.getElementById('game-switch-pool').title }; })()`);
        ok('the switch → Snooker: the panel plays snooker: its title (the snooker icon lit), wins button and tracker, 22 balls, ball in hand in the D',
           sn.game === 'snooker' && sn.balls === 22 && sn.title === 'Snooker' && /data-icon="snooker"/.test(sn.lit) && sn.next === 'Switch to 8-Ball Pool' && sn.poolBtn === 'none' && sn.snkBtn !== 'none' && sn.dg === 'snooker' && sn.track && sn.pref === 'snooker' && sn.zone === 'D' && sn.phase === 'bih' && sn.tip === 'Snooker', sn);
        await shot('host-snooker-break', '.snake-game-container');
        // In the D by mouse, then the break-off by the power drag.
        const cb = await ev('(() => { const S = window.__probe.S, v = window.__probe.pcView(S.director.pose), q = window.__probe.pcProject(v, [-335, 25, S.cfg.ballR]), r = S.canvas.getBoundingClientRect(), k = r.width / S.W; return [r.left + q[0] * k, r.top + q[1] * k, r.left + r.width / 2, r.top + r.height - 70]; })()');
        await mouse('mouseMoved', cb[0], cb[1]); held = true; await mouse('mousePressed', cb[0], cb[1]); await mouse('mouseMoved', cb[0] + 2, cb[1]); await sleep(30);
        held = false; await mouse('mouseReleased', cb[0] + 2, cb[1]); await sleep(200);
        const pl = await ev('(() => { const S = window.__probe.S, c = S.world.balls[0]; return { phase: S.phase, inD: window.__probe.prCanPlace(S.world, c.x, c.y, "D") === null, x: c.x, y: c.y }; })()');
        ok('the cue ball is placed in the D by mouse', pl.phase === 'aim' && pl.inD, pl);
        await mouse('mouseMoved', cb[2], cb[3]); held = true; await mouse('mousePressed', cb[2], cb[3]);
        for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', cb[2], cb[3] - i * 10); await sleep(16); }
        held = false; await mouse('mouseReleased', cb[2], cb[3] - 80);
        ok('press, drag and release breaks off', await waitFor('["moving","strike"].includes(window.__probe.S.phase) || window.__probe.S.frame.shots > 0', 2000));
        const done = await waitFor('!["moving","strike"].includes(window.__probe.S.phase) && window.__probe.S.frame.shots > 0', 20000);
        const af = await ev('(() => { const S = window.__probe.S, saved = JSON.parse(localStorage.getItem("snookerFrame") || "null"); return { shots: S.frame.shots, phase: S.phase, saved: !!saved && saved.frame.shots >= 1 }; })()');
        ok('the break-off is judged, and the frame is saved for a reload', done && af.shots >= 1 && af.saved, af);
        const live = await ev(`(() => { const e = document.querySelector('#pool-root [data-ph=trlive]'); return e && { text: e.textContent, polite: e.getAttribute('aria-live'), w: e.getBoundingClientRect().width }; })()`);
        ok('the tracker is read out once the shot is over (a polite live region, never seen)', !!live && live.polite === 'polite' && /points remaining\.$/.test(live.text) && live.w <= 1, live);
        // The CPU at the table (S4): it plans in slices, turns the cue and plays its shot; or, when
        // the break-off fouled, makes its choice (play on, the free ball, or you back in).
        if (await ev('window.__probe.S.frame.turn === 2 && window.__probe.mode === "cpu"')) {
            const chose = await ev('!!window.__probe.S.frame.pending');
            const took = await waitFor(chose ? '!window.__probe.S.frame.pending && window.__probe.S.phase !== "choice"'
                : 'window.__probe.S.frame.shots >= 2 && !["moving","strike"].includes(window.__probe.S.phase)', 40000);
            const cp = await ev('(() => { const S = window.__probe.S; return { shots: S.frame.shots, phase: S.phase, turn: S.frame.turn }; })()');
            ok(chose ? 'the break-off fouled: the snooker CPU makes its choice' : 'the snooker CPU takes its turn after the break-off (plans, turns the cue, plays)', took, cp);
        }
        await shot('host-snooker-after', '.snake-game-container');
        // A snooker tournament's setup by mouse (S5): its words, best of, a 60 s clock, Reds and the call pocket.
        await click('#pool-root [data-ph=mode]'); await sleep(200);
        await click('#pool-root [data-ph-mode="tour"]'); await sleep(150);
        await click('#pool-root [data-ph=sheettourgo]'); await sleep(250);
        const stp = await ev(`(() => { const s = document.querySelector('#pool-root .pu-screen-in'); if (!s) return null;
            const segs = [...s.querySelectorAll('.pu-seg-row')].map(r => r.getAttribute('aria-label') + ':' + [...r.querySelectorAll('button')].map(b => b.textContent).join('/'));
            return { kicker: (s.querySelector('.pu-kicker') || {}).textContent, races: (s.querySelector('.pu-group .pu-kicker') || {}).textContent,
                opts: [...s.querySelectorAll('select[data-pu-in="race:0"] option')].map(o => o.textContent).join(), segs }; })()`);
        ok('snooker\'s tournament setup by mouse: SNOOKER · HUMANS ONLY, best of 1–9, a 60 s clock, Reds and the call pocket',
           !!stp && stp.kicker === 'SNOOKER · HUMANS ONLY' && /BEST OF/.test(stp.races) && stp.opts === '1,3,5,7,9' && stp.segs.includes('Shot clock:30s/45s/60s/Off') &&
           stp.segs.includes('Reds:15/10/6') && stp.segs.includes('Call pocket:Off/Colours/All balls'), stp);
        await click('#pool-root [data-pu-act=close]'); await sleep(200);
        // Snooker's progression through the real host (S6): a Pro win with a 104 break pays its XP
        // and Century, files the win and the break, and the Snooker board opens on Pro.
        const snk = await ev(`(() => { const P = window.__probe, S = P.S, xp0 = P.xp.totalXP, s0 = P.xp.gameSessions || 0, called0 = P.xp.achievements.includes('calledIt');
            P.prefs.snookerDifficulty = 'pro'; P.poolNewFrame(1);
            P.poolEndFrame({ winner: 1, next: Object.assign({}, S.frame, { high: { 1: 104, 2: 0 } }) });
            P.toggleGameLeaderboard('snooker', true);
            const box = document.getElementById('game-lb-overlay');
            const tabs = [...box.querySelectorAll('.game-lb-tab')].map(b => b.textContent.replace('•', '').trim());
            const active = (box.querySelector('.game-lb-tab.is-active') || {}).textContent || '';
            const head = (box.querySelector('.game-lb-head') || {}).textContent || '';
            window.setGameLeaderboardMode('highBreak');
            const foot = (box.querySelector('.game-lb-foot') || {}).textContent || '';
            const g = P.collectGameModeBests(), byTier = JSON.parse(localStorage.getItem('snookerWinsByTier') || '{}');
            const res = { tier: P.tier, gained: P.xp.totalXP - xp0, sessions: (P.xp.gameSessions || 0) - s0, century: P.xp.achievements.includes('snookerCentury'),
                calledIt: P.xp.achievements.includes('calledIt') !== called0, wins: document.getElementById('snooker-wins').textContent, pro: byTier.pro || 0,
                tabs, active, head, foot, shown: box.style.display, high: localStorage.getItem('snookerHighBreak'), sync: g['snooker:pro'], syncHigh: g['snooker:highBreak'] };
            P.toggleGameLeaderboard('snooker', false); P.prefs.snookerDifficulty = 'adaptive'; P.poolNewFrame(1);
            return res; })()`);
        ok('a Pro snooker win with a 104 break pays 180 + 25 (and Century\'s 150), one session, and never Called It',
           snk.tier === 'pro' && snk.gained >= 205 && snk.sessions === 1 && snk.century && !snk.calledIt, snk);
        ok('…the win and the break are filed: the wins button shows Pro\'s wins, the sync snapshot carries them and the 104',
           snk.pro >= 1 && snk.wins === String(snk.pro) && snk.sync === snk.pro && snk.high === '104' && snk.syncHigh === 104, snk);
        ok('the Snooker board: the four tiers, All-time, Hot-seat, Online and High break, opening on the tier being played',
           snk.shown === 'flex' && /Snooker/.test(snk.head) && snk.tabs.join() === 'Pro,Hard,Normal,Easy,All-time,Hot-seat,Online,High break' && /Pro/.test(snk.active) && /best break/.test(snk.foot), snk);
        await click('#snooker-lb-btn'); await sleep(250);
        await ev(`window.setGameLeaderboardMode('highBreak')`); await sleep(100);
        await shot('host-snooker-board', '.snake-game-container');
        const tabFit = await ev(`(() => { const box = document.getElementById('game-lb-overlay'), r = box.getBoundingClientRect();
            const b = box.querySelector('.game-lb-tab.is-active'), q = b && b.getBoundingClientRect();
            return !!q && q.width > 0 && q.left >= r.left - 0.5 && q.right <= r.right + 0.5 && /High break/.test(b.textContent); })()`);
        ok('…opened by its wins button; the strip scrolls, and the board shown (High break, the last) is in view', tabFit && (await ev(`document.getElementById('game-lb-overlay').style.display`)) === 'flex');
        await ev(`window.closeGameLeaderboard()`); await sleep(100);
        // Back to pool: its frame as it was left.
        await ev(`document.querySelector('#game-title .pool-cue-switch').click()`); await sleep(300);
        const back = await ev(`(() => { const S = window.__probe.S; return { game: S.game, balls: JSON.stringify(S.world.balls.map(b => [b.id, b.x, b.y, b.state])), title: document.getElementById('game-title').textContent, poolBtn: getComputedStyle(document.getElementById('pool-lb-btn')).display }; })()`);
        ok('…and back to 8-Ball Pool: its frame as it was left, its title and wins button', back.game === 'pool' && back.balls === sw.balls && /8-Ball Pool/.test(back.title) && back.poolBtn !== 'none', { game: back.game, title: back.title, same: back.balls === sw.balls });
    }
    const award = await ev(`(() => { const P = window.__probe, before = +(localStorage.getItem('poolGamesWon') || 0), xp0 = P.xp.totalXP, s0 = P.xp.gameSessions || 0;
        P.poolNewFrame(1); const tier = P.tier;
        P.poolEndFrame({ winner: 1 }); P.poolEndFrame({ winner: 1 });
        const byTier = JSON.parse(localStorage.getItem('poolWinsByTier') || '{}');
        return { before, after: +(localStorage.getItem('poolGamesWon') || 0), wins: document.getElementById('pool-wins').textContent, tier,
            tierWins: byTier[tier] || 0, gained: P.xp.totalXP - xp0, sessions: (P.xp.gameSessions || 0) - s0, sync: P.collectGameModeBests()['pool:' + tier],
            byMode: JSON.parse(localStorage.getItem('poolWinsByMode') || '{}') }; })()`);
    const TIER_XP = { easy: 60, normal: 80, hard: 100, pro: 120 };
    ok('a won frame is recorded once through the real host helpers, filed under the tier it was played at',
       award.after === award.before + 1 && award.tierWins >= 1 && award.sessions === 1, award);
    ok('it pays that tier\'s XP (achievement XP on top, if one unlocked)', award.gained >= TIER_XP[award.tier], award);
    ok('the wins button shows that tier\'s wins, and the sync snapshot carries them', award.wins === String(award.tierWins) && award.sync === award.tierWins, award);
    const pro = await ev(`(() => { const P = window.__probe; P.prefs.poolDifficulty = 'pro';
        P.poolNewFrame(1); const tier = P.tier; P.poolEndFrame({ winner: 1 });
        P.toggleGameLeaderboard('pool', true);
        const tabs = [...document.querySelectorAll('#game-lb-overlay .game-lb-tab')].map(b => b.textContent.replace('•', '').trim());
        const active = document.querySelector('#game-lb-overlay .game-lb-tab.is-active');
        const res = { tier, calledIt: P.xp.achievements.includes('calledIt'), tabs, active: active && active.textContent, proSync: P.collectGameModeBests()['pool:pro'] };
        P.toggleGameLeaderboard('pool', false); P.prefs.poolDifficulty = 'adaptive'; P.poolNewFrame(1);
        return res; })()`);
    ok('a Pro win unlocks Called It', pro.tier === 'pro' && pro.calledIt, pro);
    ok('the Pool board has the four tiers, All-time, Hot-seat and Online, and opens on the tier being played',
       pro.tabs.join() === 'Pro,Hard,Normal,Easy,All-time,Hot-seat,Online' && /Pro/.test(pro.active || '') && pro.proSync >= 1, pro);
    head('Game Mode lock');
    // The registry stops listing this browser: the next check locks it.
    GAMES.open = false;
    ok('a browser the registry does not list is locked', (await ev('window.__probe.checkGamesUnlock()')) === false && !(await ev('window.__probe.gamesUnlocked')));
    const lockState = () => ev(`(() => { const c = document.getElementById('total-time-summary'); return {
        hidden: c.querySelector('.left-panel').classList.contains('game-mode-hidden'), off: c.classList.contains('game-mode-off'),
        pref: window.__probe.prefs.gameModeHidden, game: window.__probe.currentGame,
        title: c.querySelector('#game-mode-emoji-toggle').title, toasts: document.querySelectorAll('.xp-notif-game').length }; })()`);
    let lk = await lockState();
    ok('…its games panel is hidden, and the emoji says it is locked', lk.hidden && lk.off && /locked/.test(lk.title), lk);
    const gameBefore = lk.game, prefBefore = lk.pref;
    await click('#game-mode-emoji-toggle');
    let lk2 = await lockState();
    ok('the face does not turn Game Mode on; it opens "Welcome back" to log in', lk2.hidden && lk2.pref === prefBefore &&
        await waitFor("(() => { const m = document.getElementById('acct-modal'); return m && m.classList.contains('active') && /Welcome back/.test(m.textContent); })()", 3000), lk2);
    await ev("document.querySelector('#acct-modal .achievements-modal-close').click()");
    await ev("window.switchGame('" + (gameBefore === 'pool' ? 'snake' : 'pool') + "')");
    await key('1');
    ok('switchGame and the number keys do nothing', (await lockState()).game === gameBefore);
    await ev("window.startTetrisGameBtn && window.startTetrisGameBtn()");
    ok('…nor do the games\' own buttons from the console', (await lockState()).game === gameBefore);
    ok('a key in the wrong shape is refused at once', /not an access key/.test(await ev("window.atcUnlockGames('nope')")));
    ok('a well-formed key is sent to the bot (here unreachable, and it says so plainly)', /Can't reach the leaderboard/.test(await ev("window.atcUnlockGames('ABCD-EFGH-JKMN-PQRS')")));
    ok('…and a second try within 30 s waits', /30 seconds/.test(await ev("window.atcUnlockGames('ABCD-EFGH-JKMN-PQRS')")));
    ok('atcGamesTag gives this browser\'s tag (what a revoke takes)', (await ev('window.atcGamesTag()')) === GAMES.tag);
    await ev('window.__probe.toggleSettingsModal && window.__probe.toggleSettingsModal()'); await sleep(400);
    ok('⚙️\'s Game Mode switch is disabled while locked', !!(await ev("(() => { const t = document.querySelector('.toggle-switch[data-pref=\"gameModeHidden\"]'); return t && t.classList.contains('disabled'); })()")));
    await ev('window.__probe.toggleSettingsModal && window.__probe.toggleSettingsModal()'); await sleep(400);
    await settingsClosed();
    GAMES.open = true;
    ok('listed again: the next check unlocks it, live', (await ev('window.__probe.checkGamesUnlock()')) === true);
    lk = await lockState();
    ok('…the panel is back as the preference had it', lk.hidden === !lk.pref, lk);

    head('Accounts: name + password');
    {
        const nc = require('crypto'), sha = v => nc.createHash('sha256').update(v).digest('hex');
        const pwOf = (name, password) => nc.pbkdf2Sync(password, 'atc-login:' + name.toLowerCase(), 100000, 32, 'sha256').toString('hex');
        const PASS = { current: 'pool-shark-7' };
        // An enrolled player on the board, plus an old recovery code (the console fallback).
        const CODE = 'K7QDM3XA9PZRT2WF', CODE_PW = 'correct horse', SALT = '3c'.repeat(16), IT = 150000;
        const proof = nc.pbkdf2Sync(CODE_PW, SALT + ':' + CODE, IT, 32, 'sha256').toString('hex');
        const rina = { clientId: 'acct-1', displayName: 'Rina R.', totalXP: 54321, level: 1, currentXP: 0, gameSessions: 300, totalWorkDays: 40, achievements: [],
            login: true, loginAt: 'a', recovery: { v: 1, lookup: sha('atc-rcv-lookup:' + CODE).slice(0, 32), salt: SALT, verifier: sha(proof), it: IT, setAt: 'x' } };
        GAMES.players = [rina]; GAMES.grants = {};
        // The stand-in bot: logins against Rina's password, enrolment, and a password change.
        GAMES.bot = (event, p) => {
            if (event === 'login' && p.name.toLowerCase() === 'rina r.' && p.pw === pwOf('Rina R.', PASS.current)) {
                GAMES.open = true; GAMES.grants[p.tag] = { clientId: 'acct-1', at: new Date().toISOString() };
            } else if (event === 'login-enroll' && p.client_id === 'acct-1') {
                rina.login = true; rina.loginAt = new Date().toISOString(); rina.displayName = p.name; PASS.enrolled = p.pw;
            } else if (event === 'login-change' && p.old_pw === pwOf(rina.displayName, PASS.current)) {
                rina.loginAt = new Date().toISOString(); PASS.changed = p.pw;
            }
        };
        await ev('Object.assign(window.__probe.acctPoll, { every: 150, tries: 12, gap: 0 })');
        // Locked, on a computer that is not this player's.
        GAMES.open = false;
        await ev('window.__probe.checkGamesUnlock()');
        const modalText = () => ev("(document.getElementById('acct-modal') || {}).textContent || ''");
        const jargon = t => /\b(tag|gist|clientId|dispatch|GitHub|payload|hash)\b/i.test(t);
        const status = () => ev("(document.querySelector('#acct-modal .rcv-status') || {}).textContent || ''");
        const set = (id, v) => ev(`(() => { const i = document.getElementById(${JSON.stringify(id)}); i.value = ${JSON.stringify(v)}; })()`);
        const opened = title => waitFor(`(() => { const m = document.getElementById('acct-modal'); return m && m.classList.contains('active') && ${JSON.stringify(title)} === m.querySelector('.achievements-modal-title').textContent; })()`, 3000);
        await click('#game-mode-emoji-toggle');
        ok('locked: the face opens "Welcome back", name and password', await opened('Welcome back') && !!(await ev("!!document.getElementById('acct-name') && document.getElementById('acct-pw').type === 'password'")));
        await shot('account-login', '#acct-modal');
        ok('…in plain words (no technical terms)', !jargon(await modalText()), await modalText());
        await set('acct-name', 'rina r.'); await set('acct-pw', 'not it');
        await click('#acct-modal .rcv-go');
        ok('while it checks, it says how long it takes', await waitFor("/half a minute/.test(document.querySelector('#acct-modal .rcv-status').textContent) && document.querySelector('#acct-modal .rcv-status').classList.contains('is-busy')", 3000));
        ok('a wrong password: "don\'t match", and still locked', await waitFor("/don't match/.test(document.querySelector('#acct-modal .rcv-status').textContent)", 8000) && !(await ev('window.__probe.gamesUnlocked')), await status());
        await set('acct-pw', PASS.current);
        await click('#acct-modal .rcv-go');
        ok('the right password: "Welcome back, Rina R.!"', await waitFor("/Welcome back, Rina R\\.!/.test(document.getElementById('acct-modal').textContent)", 8000), await status());
        ok('…Game Mode opens on this computer', (await ev('window.__probe.gamesUnlocked')) === true && !(await lockState()).hidden);
        ok('…and this computer is now Rina, with her progress', (await ev('window.__probe.lbClientId')) === 'acct-1' && (await ev('window.__probe.lbRegistered')) === true && (await ev('window.__probe.xp.totalXP')) === 54321);
        await ev("document.querySelector('#acct-modal .rcv-ok').click()");

        // Locked again for the key field (an open browser would just say "You're in").
        GAMES.open = false;
        await ev('window.__probe.checkGamesUnlock()');
        ok('"New here? I have an access key" swaps to a key field', (await ev("window.atcAccountDialog('login')")) === 'login' && await opened('Welcome back') &&
            (await click('#acct-to-key')) && await opened('Unlock Game Mode') && !!(await ev("!!document.getElementById('acct-key')")));
        await set('acct-key', 'nope');
        await click('#acct-modal .rcv-go');
        ok('…a key in the wrong shape is refused plainly', await waitFor("/not an access key/.test(document.querySelector('#acct-modal .rcv-status').textContent)", 3000), await status());
        await shot('account-key', '#acct-modal');
        await ev("document.querySelector('#acct-modal .achievements-modal-close').click()");
        GAMES.open = true;
        await ev('window.__probe.checkGamesUnlock()');

        // Joined, no password yet: the key button nudges, and sets one.
        rina.login = false;
        await ev('window.__probe.fetchLeaderboard().then(() => window.__probe.renderMiniBoard())');
        ok('joined without a password: the key button carries a dot and says what it is for', await waitFor("(() => { const b = document.querySelector('#total-time-summary .ws-board-rcv'); return b && !b.hidden && b.classList.contains('is-nudge') && /log in anywhere/.test(b.title); })()", 4000));
        ok('…it opens "Set your password", naming the login', (await ev('window.atcAccountDialog()')) === 'set' && await opened('Set your password') && /Your login name is Rina R\./.test(await modalText()));
        await shot('account-set', '#acct-modal');
        ok('…in plain words', !jargon(await modalText()), await modalText());
        await set('acct-pw', 'abcdef1'); await set('acct-pw2', 'abcdef2');
        await click('#acct-modal .rcv-go');
        ok('two different passwords: it says so', /different/.test(await status()));
        await set('acct-pw2', 'abcdef1');
        await click('#acct-modal .rcv-go');
        ok('saved: "Use Rina R. and this password to log in on any computer"', await waitFor("/Use Rina R\\. and this password/.test(document.getElementById('acct-modal').textContent)", 8000) && PASS.enrolled === pwOf('Rina R.', 'abcdef1'), await status());
        ok('…only a hash of the password left this browser', PASS.enrolled !== 'abcdef1' && /^[0-9a-f]{64}$/.test(PASS.enrolled));
        await ev("document.querySelector('#acct-modal .rcv-ok').click()");
        PASS.current = 'abcdef1';
        await ev('window.__probe.fetchLeaderboard().then(() => window.__probe.renderMiniBoard())');
        ok('with a password: the dot goes, and the key button opens "Change password"', await waitFor("!document.querySelector('#total-time-summary .ws-board-rcv').classList.contains('is-nudge')", 4000) &&
            (await ev('window.atcAccountDialog()')) === 'change' && await opened('Change password'));
        await set('acct-old', 'abcdef1'); await set('acct-pw', 'newpass9'); await set('acct-pw2', 'newpass9');
        await click('#acct-modal .rcv-go');
        ok('…a change goes through with the current password', await waitFor("/Password changed/.test(document.getElementById('acct-modal').textContent)", 8000) && PASS.changed === pwOf('Rina R.', 'newpass9'), await status());
        await ev("document.querySelector('#acct-modal .rcv-ok').click()");

        ok('the Join box offers "Already on the leaderboard? Log in" (not a recovery code)', /Already on the leaderboard\? Log in/.test(page()) && !/Restore it|recovery code/i.test(await ev("document.getElementById('total-time-summary').textContent")));
        ok('an old recovery code still restores from the console', /✓ Restored Rina R\./.test(await ev(`window.atcRestore('${CODE}', ${JSON.stringify(CODE_PW)})`)));
        ok('atcRestoreByClientId is still admin only', (await ev("window.atcRestoreByClientId('acct-1')")) === false);
        GAMES.bot = null;
        GAMES.players = [];
    }

    ok('no page errors anywhere', !errors.length, errors.slice(0, 3));
    if (consoleErrors.length) console.log('  · console errors (fonts and sync are blocked on purpose):', consoleErrors.length);

    console.log('\n' + pass + ' passed, ' + fail + ' failed   (PNGs in ' + OUT + ')');
    clearTimeout(bail);
    await send('Browser.close').catch(() => {});
    setTimeout(() => { try { proc.kill(); } catch (_) {} process.exit(fail ? 1 : 0); }, 300);
}
main().catch(e => { console.error('✗ ' + (e.stack || e)); process.exit(1); });
