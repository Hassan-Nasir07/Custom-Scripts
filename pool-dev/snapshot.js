// Renders pool-table.html scenes in headless Chrome and saves each viewport
// as a PNG: the real canvas, real fonts and real gradients, which the
// software rasterizer in preview.js cannot show.
//
//   node pool-dev/snapshot.js [out-dir] [scene …]
//
// A scene is a name from SCENES below, or a raw query string such as
// "scene=mid&camera=3d&lean=80". With no scenes, all of SCENES render.
// A "light:" prefix renders with prefers-color-scheme: light. Each PNG is
// the whole games panel, or the Max frame when the scene opens it.
// Prints any page error; exits 1 if there was one. Needs Chrome at the
// usual path and Node 22 (global WebSocket and fetch).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCENES = {
    // The table (Phase 3)
    'rack-3d': 'scene=rack&camera=3d',
    'mid-3d-lean0': 'scene=mid&camera=3d&lean=0',
    'mid-3d-lean100': 'scene=mid&camera=3d&lean=100',
    'mid-2d-red': 'scene=mid&camera=2d&felt=red',
    'mid-2d-draw': 'scene=mid&camera=2d&spin=2&aim=-2',
    'break-broadcast': 'scene=break&camera=3d&t=12',
    'break-stay3d': 'scene=break&camera=3d&shotcam=3d&t=12',
    'stay3d-across': 'scene=break&camera=3d&shotcam=3d&aim=-80&t=40',
    'stay3d-diag': 'scene=break&camera=3d&shotcam=3d&aim=30&lean=10&t=40',
    'max-stay3d': 'scene=break&camera=3d&shotcam=3d&max=1&t=40',
    // The design's in-match states (InMatch.dc.html variants), Glassmorphic
    'main-3d': 'scene=mid&camera=3d',
    'main-2d': 'scene=mid&camera=2d',
    'power': 'scene=mid&camera=3d&power=62',
    'bih': 'scene=bih&camera=3d',
    'bih-bad': 'scene=bihbad&camera=3d',
    'bih-break': 'scene=rack&camera=3d&bihbreak=1',
    'foul-handoff': 'scene=foul&mode=pvp',
    'call-3d': 'scene=eight&camera=3d&aim=-20&lean=55',
    'call-2d-every': 'scene=mid&camera=2d&every=1&call=1',
    'clock': 'scene=clock&mode=pvp',
    'clock-hot': 'scene=clock&mode=pvp&hot=1',
    'win': 'scene=win',
    'loss': 'scene=loss',
    'light:main-3d': 'scene=mid&camera=3d',
    'max-3d': 'scene=mid&camera=3d&max=1',
    // Cyberpunk HUD
    'cyber-main-3d': 'scene=mid&camera=3d&theme=cyber',
    'cyber-foul': 'scene=foul&mode=pvp&theme=cyber',
    'cyber-loss': 'scene=loss&theme=cyber&shape=chamfered',
    'cyber-call-3d': 'scene=eight&camera=3d&aim=-20&lean=55&theme=cyber&palette=acidGreen',
    'cyber-max': 'scene=mid&camera=3d&max=1&theme=cyber',
};

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const CHECK = process.argv.includes('--check');         // also run the page's HUD audit on each scene
const ARGS = process.argv.slice(2).filter(a => a !== '--check');
const outDir = ARGS[0] || path.join(os.tmpdir(), 'pool-snapshots');
const picks = ARGS.slice(1);
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
    let checks = 0, failed = 0;
    ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
        if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    });
    const send = (method, params) => new Promise(r => { const n = ++id; pending[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 2, mobile: false });
    for (const [name, query] of list) {
        const before = errors.length;
        const light = name.startsWith('light:');
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: light ? 'light' : 'dark' }] });
        await send('Page.navigate', { url: page + '?still=1&' + query });
        let ready = false;
        for (let i = 0; i < 50 && !ready; i++) { await sleep(100); ready = await evaluate('window.__ready === true'); }
        const box = await evaluate('(() => { const el = document.querySelector(".pool-max-frame") || document.querySelector(".snake-game-container"); const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()');
        const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: box[0], y: box[1], width: box[2], height: box[3], scale: 1 } });
        const file = path.join(outDir, name.replace(':', '-') + '.png');
        fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
        console.log((ready ? '  ✓ ' : '  ✗ not ready ') + name + '  → ' + file + (errors.length > before ? '  ERRORS: ' + errors.slice(before).join(' | ') : ''));
        if (CHECK) {
            const res = (await evaluate('window.__hudAudit ? window.__hudAudit() : []')) || [];
            res.forEach(([n, pass, detail]) => { checks++; if (!pass) { failed++; console.log('      ✗ ' + n + (detail ? ' — ' + detail : '')); } });
        }
    }
    await send('Browser.close').catch(() => {});
    if (CHECK) console.log('\n  HUD audit: ' + (checks - failed) + '/' + checks + ' passed across ' + list.length + ' scenes');
    setTimeout(() => { try { proc.kill(); } catch (_) {} process.exit(errors.length || failed ? 1 : 0); }, 300);
})();
