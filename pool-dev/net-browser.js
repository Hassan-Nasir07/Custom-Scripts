// Online play in real Chrome: two browsers (two profiles, so two identities) each run the REAL
// userscript on the stand-in portal (as host-run.js serves it), and meet on the real
// mp-server/ over wss:// with its self-signed certificate. By mouse: Game mode › Online, the
// server, Connect, Challenge, Accept on the invite, the break; then both tables are compared.
//
//   "/c/Program Files/nodejs/node.exe" pool-dev/net-browser.js [outDir]
//
// Needs Node 22, Chrome and mp-server/certs (bash mp-server/make-cert.sh).
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const { createServer } = require('../mp-server/server');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'pool-net-browser'));
const PORTAL = 'https://globalportal.mtbc.com/#/time-absence/attendence-record';
const CHROME = require('./browser').browserPath();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function page(name) {
    let script = fs.readFileSync(path.join(ROOT, 'AttendanceTimeCheckerPlus.js'), 'utf8');
    const end = script.lastIndexOf('})();');
    const probe = `
    lbDisplayName = ${JSON.stringify(name)};
    window.__probe = { S: poolS, N: poolNet, get mode() { return poolMode; }, poolNetHash, poolCanAct, poolRemoteTurn };
`;
    script = script.slice(0, end) + probe + script.slice(end);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Attendance</title></head>
<style>body { margin: 0; background: #1b1d2a; }</style><body>
<div class="main-attendance-table"><table><tbody id="rows"></tbody></table></div>
<script>
(function () {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    const d = String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0') + '/' + now.getFullYear();
    document.getElementById('rows').innerHTML = '<tr><td>1</td><td>' + d + '</td><td>Mon</td><td>09:00:00</td><td>In</td></tr>';
})();
window.$ = sel => ({ before: el => { const t = document.querySelector(sel); if (t) t.parentNode.insertBefore(el, t); } });
</script>
<script>${script.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;
}

async function browser(name) {
    const port = 9300 + Math.floor(Math.random() * 600);
    const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--ignore-certificate-errors',
        // The stand-in portal is served over DevTools, so Chrome files it as a public page and the
        // loopback server as local: Local Network Access would block it. In the office both are
        // private addresses (the portal is 172.16.1.142), which the Phase 0 probe showed passes.
        '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests',
        '--remote-debugging-port=' + port,
        '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'pool-net-')), '--no-first-run', '--no-default-browser-check', '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
    let target;
    for (let i = 0; i < 80 && !target; i++) {
        await sleep(200);
        try { target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(t => t.type === 'page'); } catch (_) {}
    }
    if (!target) throw new Error('Chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0;
    const pending = {}, errors = [], html = page(name);
    const send = (method, params) => new Promise(r => { const n = ++id; pending[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
    ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; return; }
        if (m.method === 'Fetch.requestPaused') {
            if (m.params.request.url.startsWith('https://globalportal.mtbc.com/')) {
                send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
                    responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: Buffer.from(html).toString('base64') });
            } else send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' });
        }
        if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: PORTAL });
    const ev = async e => {
        const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) throw new Error(e.slice(0, 80) + ': ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
        return r.result?.result?.value;
    };
    let held = false;
    const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: held || type !== 'mouseMoved' ? 'left' : 'none', buttons: held ? 1 : 0, clickCount: 1 });
    const at = sel => ev('(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e || e.closest("[hidden]") || e.disabled) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()');
    const click = async sel => {
        const r = await at(sel);
        if (!r) return false;
        await mouse('mouseMoved', r[0], r[1]); held = true; await mouse('mousePressed', r[0], r[1]); held = false; await mouse('mouseReleased', r[0], r[1]);
        await sleep(150);
        return true;
    };
    const drag = async (x0, y0, x1, y1) => {
        await mouse('mouseMoved', x0, y0); held = true; await mouse('mousePressed', x0, y0);
        for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await sleep(30); }
        held = false; await mouse('mouseReleased', x1, y1); await sleep(150);
    };
    const type = async text => { await send('Input.insertText', { text }); await sleep(100); };
    const waitFor = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await ev(expr)) return true; await sleep(100); } return false; };
    const shot = async (file, sel) => {
        const r = await ev('(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()');
        if (!r) return;
        const png = await send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, r[0] - 4), y: Math.max(0, r[1] - 4), width: r[2] + 8, height: r[3] + 8, scale: 1 } });
        fs.writeFileSync(path.join(OUT, file + '.png'), Buffer.from(png.result.data, 'base64'));
    };
    const close = async () => { try { await send('Browser.close'); } catch (_) {} try { proc.kill(); } catch (_) {} };
    return { ev, click, drag, type, waitFor, shot, close, errors, at };
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const certs = path.join(ROOT, 'mp-server', 'certs');
    const srv = createServer({ log: false, tls: { key: fs.readFileSync(path.join(certs, 'key.pem')), cert: fs.readFileSync(path.join(certs, 'cert.pem')) } });
    const port = await srv.listen(0, '127.0.0.1');
    const bail = setTimeout(() => { console.log('✗ TIMEOUT'); process.exit(2); }, 180000);
    let pass = 0, fail = 0;
    const ok = (name, cond, detail) => {
        if (cond) { pass++; console.log('  ✓ ' + name); }
        else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
    };

    const [A, B] = await Promise.all([browser('Ali'), browser('Bea')]);
    for (const T of [A, B]) {
        await T.waitFor("!!window.switchGame && !!document.getElementById('pool-root')", 15000);
        await T.ev("window.switchGame('pool')");
        await T.waitFor("!!document.querySelector('#pool-root .pool-hud')", 8000);
        // Game mode › Online › the server › Connect.
        await T.click('#pool-root [data-ph="mode"]');
        await T.click('#pool-root [data-ph-mode="net"]');
        await T.click('#pool-root [data-ph="sheetnetsrv"]');
        await T.type('127.0.0.1:' + port);
        await T.click('#pool-root [data-ph="sheetnetgo"]');
    }
    ok('both browsers connect from the portal page over wss://', await A.waitFor("window.__probe.N.state === 'open'") && await B.waitFor("window.__probe.N.state === 'open'"));
    ok('…and the Online tab lists the other player', await A.waitFor("!!document.querySelector('#pool-root [data-ph-net=\"challenge\"]')") && await B.waitFor("!!document.querySelector('#pool-root [data-ph-net=\"challenge\"]')"));
    await A.shot('online-tab', '#pool-root .pool-hud');
    await B.click('#pool-root [data-ph="sheetx"]');
    await A.click('#pool-root [data-ph-net="bo"][data-id="3"]');
    await A.click('#pool-root [data-ph-net="challenge"]');
    ok('Challenge shows "Waiting for" on the challenger', await A.waitFor("/Waiting for Bea/.test(document.querySelector('#pool-root [data-ph=\"sheetnetbody\"]').textContent)"));
    ok('the invite appears over the other table', await B.waitFor("!document.querySelector('#pool-root [data-ph=\"invite\"]').hidden"));
    ok('…naming the challenger and the match', /Ali challenges you/.test(await B.ev("document.querySelector('#pool-root [data-ph=\"invitek\"]').textContent")) && /8-Ball · best of 3/.test(await B.ev("document.querySelector('#pool-root [data-ph=\"invitet\"]').textContent")));
    await B.shot('invite', '#pool-root .pool-hud');
    await B.click('#pool-root [data-ph="invitego"]');
    ok('Accept puts both tables online', await A.waitFor("window.__probe.mode === 'net'") && await B.waitFor("window.__probe.mode === 'net'"));
    ok('…the sheet closes, the footer says Online and Reset is gone', await A.waitFor("document.querySelector('#pool-root [data-ph=\"sheet\"]').hidden && document.querySelector('#pool-root [data-ph=\"model\"]').textContent === 'Online' && document.querySelector('#pool-root [data-ph=\"reset\"]').hidden"));
    ok('…both racks the same', (await A.ev('window.__probe.poolNetHash()')) === (await B.ev('window.__probe.poolNetHash()')));
    ok('the cards name both players', /Ali/.test(await B.ev("document.querySelector('#pool-root .ph-card[data-seat=\"1\"] .ph-name').textContent")) && /Bea/.test(await A.ev("document.querySelector('#pool-root .ph-card[data-seat=\"2\"] .ph-name').textContent")));
    ok('Bea waits: no input, and her hint says Ali has the ball', !(await B.ev('window.__probe.poolCanAct()')) && /Ali has ball in hand/.test(await B.ev("document.querySelector('#pool-root [data-ph=\"hintt\"]').textContent")));

    // Ali breaks by mouse: drop the cue ball where it is, then press on the table and pull back.
    const c = await A.at('#pool-root canvas');
    await A.drag(c[0], c[1] + 60, c[0], c[1] + 60);
    await A.waitFor("window.__probe.S.phase === 'aim'", 3000);
    await A.drag(c[0], c[1], c[0], c[1] + 140);
    ok('Ali breaks', await A.waitFor("['moving', 'strike'].indexOf(window.__probe.S.phase) >= 0 || window.__probe.S.netStep > 0", 4000));
    ok('…and Bea sees the break played on her table', await B.waitFor("window.__probe.S.netStep > 0 && window.__probe.S.phase !== 'moving' && window.__probe.S.phase !== 'strike'", 15000));
    await A.waitFor("window.__probe.S.phase !== 'moving' && window.__probe.S.phase !== 'strike'", 15000);
    await sleep(500);
    const ha = await A.ev('window.__probe.poolNetHash()'), hb = await B.ev('window.__probe.poolNetHash()');
    ok('both tables come to rest the same, with no resync', ha === hb && (await A.ev('window.__probe.S.netResyncs')) === 0 && (await B.ev('window.__probe.S.netResyncs')) === 0, [ha, hb]);
    await A.shot('after-break-ali', '#pool-root .pool-hud');
    await B.shot('after-break-bea', '#pool-root .pool-hud');
    ok('no page errors in either browser', !A.errors.length && !B.errors.length, A.errors.concat(B.errors));

    clearTimeout(bail);
    await A.close(); await B.close(); await srv.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed   (PNGs in ' + OUT + ')');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
