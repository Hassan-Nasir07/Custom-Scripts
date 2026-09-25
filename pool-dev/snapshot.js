// Renders pool-table.html scenes in headless Chrome and saves each viewport
// as a PNG: the real canvas, real fonts and real gradients, which the
// software rasterizer in preview.js cannot show.
//
//   node pool-dev/snapshot.js [out-dir] [scene …]
//
// A scene is a name from SCENES below, or a raw query string such as
// "scene=mid&camera=3d&lean=80". With no scenes, all of SCENES render.
// Prints any page error; exits 1 if there was one. Needs Chrome at the
// usual path and Node 22 (global WebSocket and fetch).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCENES = {
    'rack-3d': 'scene=rack&camera=3d',
    'rack-2d': 'scene=rack&camera=2d',
    'mid-3d': 'scene=mid&camera=3d&power=62',
    'mid-3d-lean0': 'scene=mid&camera=3d&lean=0',
    'mid-3d-lean100': 'scene=mid&camera=3d&lean=100',
    'mid-2d': 'scene=mid&camera=2d',
    'mid-2d-red': 'scene=mid&camera=2d&felt=red',
    'mid-2d-draw': 'scene=mid&camera=2d&tip=0,-0.55&aim=-2',
    'mid-3d-follow': 'scene=mid&camera=3d&tip=0,0.45&lean=70',
    'eight-call-3d': 'scene=eight&camera=3d&aim=-20&lean=55',
    'eight-call-2d': 'scene=eight&camera=2d&call=2',
    'bih': 'scene=bih&camera=3d',
    'bih-break': 'scene=rack&camera=3d&bihbreak=1',
    'break-broadcast': 'scene=break&camera=3d&t=12',
    'break-stay3d': 'scene=break&camera=3d&shotcam=3d&t=12',
    'max-3d': 'scene=mid&camera=3d&w=1232&h=672',
};

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const outDir = process.argv[2] || path.join(os.tmpdir(), 'pool-snapshots');
const picks = process.argv.slice(3);
const list = (picks.length ? picks : Object.keys(SCENES)).map(s => [SCENES[s] ? s : s.replace(/[^\w=-]+/g, '_'), SCENES[s] || s]);
const page = 'file:///' + path.join(__dirname, 'pool-table.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    fs.mkdirSync(outDir, { recursive: true });
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-chrome-'));
    const port = 9300 + Math.floor(Math.random() * 400);
    const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port,
        '--allow-file-access-from-files', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
    let target;
    for (let i = 0; i < 60 && !target; i++) {
        await sleep(200);
        try { target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(t => t.type === 'page'); } catch (_) {}
    }
    if (!target) { console.log('chrome did not start'); proc.kill(); process.exit(1); }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0;
    const pending = {}, errors = [];
    ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
        if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    });
    const send = (method, params) => new Promise(r => { const n = ++id; pending[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1640, height: 760, deviceScaleFactor: 2, mobile: false });
    for (const [name, query] of list) {
        const before = errors.length;
        await send('Page.navigate', { url: page + '?still=1&' + query });
        let ready = false;
        for (let i = 0; i < 50 && !ready; i++) { await sleep(100); ready = await evaluate('window.__ready === true'); }
        const box = await evaluate('(() => { const r = document.getElementById("viewport").getBoundingClientRect(); return [r.left, r.top, r.width, r.height + 26]; })()');
        const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: box[0], y: box[1], width: box[2], height: box[3], scale: 1 } });
        const file = path.join(outDir, name + '.png');
        fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
        console.log((ready ? '  ✓ ' : '  ✗ not ready ') + name + '  → ' + file + (errors.length > before ? '  ERRORS: ' + errors.slice(before).join(' | ') : ''));
    }
    await send('Browser.close').catch(() => {});
    setTimeout(() => { try { proc.kill(); } catch (_) {} process.exit(errors.length ? 1 : 0); }, 300);
})();
