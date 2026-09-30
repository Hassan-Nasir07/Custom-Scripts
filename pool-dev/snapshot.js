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
    'bih-placed': 'scene=bih&placed=1&camera=3d',
    'bih-placed-2d': 'scene=bih&placed=1&camera=2d',
    'max-bih-placed': 'scene=bih&placed=1&camera=3d&max=1',
    'cyber-bih-placed': 'scene=bih&placed=1&camera=3d&theme=cyber&shape=chamfered',
    'foul-handoff': 'scene=foul&mode=pvp',
    'call-3d': 'scene=eight&camera=3d&aim=-20&lean=55',
    'call-2d-every': 'scene=mid&camera=2d&every=1&call=1',
    'clock': 'scene=clock&mode=pvp',
    'clock-hot': 'scene=clock&mode=pvp&hot=1',
    'win': 'scene=win',
    'loss': 'scene=loss',
    'light:main-3d': 'scene=mid&camera=3d',
    'max-3d': 'scene=mid&camera=3d&max=1',
    'sheet-cpu': 'scene=mid&camera=3d&sheet=cpu&diff=hard',
    'sheet-pvp': 'scene=mid&camera=3d&sheet=pvp',
    'max-sheet': 'scene=mid&camera=3d&max=1&sheet=cpu',
    'cyber-sheet-cpu': 'scene=mid&camera=3d&theme=cyber&sheet=cpu',
    'light:sheet-cpu': 'scene=mid&camera=3d&sheet=cpu&diff=pro',
    'pro-call': 'scene=mid&camera=3d&diff=pro',
    'spin-open': 'scene=mid&camera=3d&spinopen=1&tipx=0.22&tipy=0.3',
    'spin-free': 'scene=mid&camera=3d&tipx=-0.35&tipy=-0.4',
    'max-spin-open': 'scene=mid&camera=3d&max=1&spinopen=1&tipx=-0.3&tipy=0.25',
    'cyber-spin-open': 'scene=mid&camera=3d&theme=cyber&spinopen=1&tipx=0.4&tipy=-0.2',
    'light:spin-open': 'scene=mid&camera=3d&spinopen=1&tipx=0.1&tipy=0.45',
    // Cyberpunk HUD
    'cyber-main-3d': 'scene=mid&camera=3d&theme=cyber',
    'cyber-foul': 'scene=foul&mode=pvp&theme=cyber',
    'cyber-loss': 'scene=loss&theme=cyber&shape=chamfered',
    'cyber-call-3d': 'scene=eight&camera=3d&aim=-20&lean=55&theme=cyber&palette=acidGreen',
    'cyber-max': 'scene=mid&camera=3d&max=1&theme=cyber',
    // The trackers: a new frame's groups must not keep last frame's dots; an open table's pots
    'tracker-swap': 'scene=mid&camera=3d&swap=1',
    'max-tracker-swap': 'scene=mid&camera=3d&swap=1&max=1',
    'open-potted': 'scene=mid&camera=3d&open=1',
    'open-potted-4': 'scene=mid&camera=3d&open=4',
    'max-open-potted': 'scene=mid&camera=3d&open=1&max=1',
    'cyber-open-potted': 'scene=mid&camera=3d&open=1&theme=cyber',
    'light:open-potted': 'scene=mid&camera=3d&open=1',
    'max-call-3d': 'scene=eight&camera=3d&aim=-20&lean=55&max=1',
    'call-3d-called': 'scene=eight&camera=3d&aim=-20&lean=55&call=2',
    'call-3d-power': 'scene=eight&camera=3d&aim=-20&lean=55&call=2&power=90',
    'call-3d-replace': 'scene=eight&camera=3d&aim=-20&lean=55&bihcall=1&placed=1',
    'max-call-3d-replace': 'scene=eight&camera=3d&aim=-20&lean=55&bihcall=1&placed=1&max=1',
    'light:call-3d': 'scene=eight&camera=3d&aim=-20&lean=55',
    'cyber-call-3d-called': 'scene=eight&camera=3d&aim=-20&lean=55&call=2&theme=cyber',
    // Tournament (Phase 7): the screens over the panel, the in-match header, the dialogs
    'sheet-tour': 'scene=mid&camera=3d&sheet=tour',
    'sheet-tour-saved': 'scene=mid&camera=3d&sheet=tour&n=8&played=4',
    'tour-setup': 'tour=setup&n=6',
    'tour-setup-16': 'tour=setup&n=13',
    'tour-bracket-r1': 'tour=bracket&n=6&played=1&tab=0',
    'tour-bracket-sf': 'tour=bracket&n=8&played=5&tab=1',
    'tour-bracket-16': 'tour=bracket&n=16&played=9&tab=1',
    'max-tour-bracket': 'tour=bracket&n=8&played=5&max=1',
    'max-tour-bracket-16': 'tour=bracket&n=16&played=11&max=1',
    'tour-intro': 'tour=intro&n=8&played=4',
    'tour-match': 'tour=match&n=8&played=4&tframe=1&camera=3d',
    'max-tour-match': 'tour=match&n=8&played=4&tframe=1&camera=3d&max=1',
    'tour-result': 'tour=result&n=8&played=5',
    'tour-result-final': 'tour=result&n=6&played=5',
    'tour-champion': 'tour=champion&n=6',
    'tour-champion-16': 'tour=champion&n=16',
    'max-tour-champion': 'tour=champion&n=8&max=1',
    'tour-cabinet': 'tour=cabinet',
    'tour-cabinet-empty': 'tour=cabinet&empty=1',
    'tour-resume': 'tour=resume&n=8&played=4&tframe=1',
    'tour-abandon': 'tour=abandon&n=8&played=4',
    'tour-pause': 'tour=pause&n=8&played=4&camera=3d',
    'max-tour-intro': 'tour=intro&n=8&played=4&max=1',
    'cyber-tour-bracket': 'tour=bracket&n=8&played=5&tab=1&theme=cyber',
    'cyber-tour-champion': 'tour=champion&n=8&theme=cyber&shape=chamfered',
    'cyber-tour-setup': 'tour=setup&n=6&theme=cyber',
    'light:tour-setup': 'tour=setup&n=6',
    'light:tour-bracket-sf': 'tour=bracket&n=8&played=5&tab=1',
    'light:tour-match': 'tour=match&n=8&played=4&tframe=1&camera=3d',
    'light:tour-champion': 'tour=champion&n=6',
    // Snooker's table (POOL_V2_PLAN.md, Snooker, S1): the real camera and renderer on it,
    // through pool-table.html's ?look=snooker view (the HUD joins it in S3).
    'snooker-break-d': 'look=snooker&layout=break',
    'snooker-break-10': 'look=snooker&layout=break&reds=10',
    'snooker-break-6': 'look=snooker&layout=break&reds=6',
    'snooker-mid-3d': 'look=snooker&layout=mid&camera=3d',
    'snooker-mid-3d-lean0': 'look=snooker&layout=mid&camera=3d&lean=0',
    'snooker-mid-3d-lean100': 'look=snooker&layout=mid&camera=3d&lean=100',
    'snooker-mid-2d': 'look=snooker&layout=mid&camera=2d',
    'snooker-nominate-pink': 'look=snooker&layout=nominate&camera=3d&ring=6',
    'snooker-late-3d': 'look=snooker&layout=late&camera=3d',
    'snooker-colours-3d': 'look=snooker&layout=colours&camera=3d&ring=2',
    'snooker-black-d': 'look=snooker&layout=black',
    'snooker-mid-red-felt': 'look=snooker&layout=mid&camera=2d&felt=red',
    'max-snooker-mid-3d': 'look=snooker&layout=mid&camera=3d&max=1',
    'max-snooker-mid-2d': 'look=snooker&layout=mid&camera=2d&max=1',
    'max-snooker-break-d': 'look=snooker&layout=break&max=1',
    'cyber-snooker-mid-3d': 'look=snooker&layout=mid&camera=3d&theme=cyber&shape=chamfered',
    'light:snooker-nominate-pink': 'look=snooker&layout=nominate&camera=3d&ring=6',
    // Snooker in the widget's HUD (S3): InMatch.dc.html's and Max.dc.html's snk* states,
    // set straight onto the real controller (pool-table.html's snooker scenes).
    'snk-break': 'game=snooker&camera=3d',
    'snk-red': 'game=snooker&scene=red&camera=3d',
    'snk-red-2d': 'game=snooker&scene=red&camera=2d',
    'snk-nominate': 'game=snooker&scene=nominate&camera=3d',
    'snk-nominate-pink': 'game=snooker&scene=nominatePink&camera=3d',
    'snk-nominate-power': 'game=snooker&scene=nominatePink&camera=3d&power=62',
    'snk-nominate-2d': 'game=snooker&scene=nominate&camera=2d',
    'snk-foul': 'game=snooker&scene=foul&camera=3d',
    'snk-foul-handoff': 'game=snooker&scene=foulHand&camera=3d',
    'snk-free': 'game=snooker&scene=free&camera=3d',
    'snk-free-nominate': 'game=snooker&scene=freeNom&camera=3d',
    'snk-snookers': 'game=snooker&scene=snookers&camera=3d',
    'snk-concede': 'game=snooker&scene=concede&camera=3d',
    'snk-colours': 'game=snooker&scene=colours&camera=3d',
    'snk-century': 'game=snooker&scene=century&camera=3d',
    'snk-respot': 'game=snooker&scene=respot&camera=3d',
    'snk-win': 'game=snooker&scene=win&camera=3d',
    'snk-loss': 'game=snooker&scene=loss&camera=3d',
    'snk-sheet': 'game=snooker&scene=red&camera=3d&sheet=cpu',
    'snk-pvp': 'game=snooker&scene=red&camera=3d&mode=pvp',
    'max-snk-red': 'game=snooker&scene=red&camera=3d&mode=pvp&max=1',
    'max-snk-nominate': 'game=snooker&scene=nominate&camera=3d&mode=pvp&max=1',
    'max-snk-win': 'game=snooker&scene=win&camera=3d&max=1',
    'max-snk-foul': 'game=snooker&scene=foul&camera=3d&max=1',
    'cyber-snk-nominate': 'game=snooker&scene=nominatePink&camera=3d&theme=cyber&shape=chamfered',
    'cyber-snk-foul': 'game=snooker&scene=free&camera=3d&theme=cyber&shape=notched',
    'cyber-snk-concede': 'game=snooker&scene=concede&camera=3d&theme=cyber&shape=rounded',
    'light:snk-red': 'game=snooker&scene=red&camera=3d',
    'light:snk-free': 'game=snooker&scene=free&camera=3d',
    'light:snk-win': 'game=snooker&scene=win&camera=3d',
    // Out of the way of the shot (S3 follow-up): pots into each corner of Max's 2D view,
    // where the table fills the viewport and every corner overlay sits on a pocket. The audit
    // checks exactly the overlays the shot passes under are faded; the open chips (a colour
    // still to tap) stay up. Compact 2D and 3D keep their overlays off the pockets.
    'max-snk-pot-tl': 'game=snooker&scene=nominatePink&camera=2d&max=1&mode=pvp&pot=0&cut=20',
    'max-snk-pot-tr': 'game=snooker&scene=nominatePink&camera=2d&max=1&mode=pvp&pot=2',
    'max-snk-pot-bl': 'game=snooker&scene=nominatePink&camera=2d&max=1&mode=pvp&pot=3',
    'max-snk-pot-br': 'game=snooker&scene=nominatePink&camera=2d&max=1&mode=pvp&pot=5',
    'max-snk-pot-br-open': 'game=snooker&scene=nominate&camera=2d&max=1&mode=pvp&pot=5',
    'max-snk-pot-br-red': 'game=snooker&scene=red&camera=2d&max=1&mode=pvp&pot=5',
    'max-snk-pot-tl-3d': 'game=snooker&scene=nominatePink&camera=3d&max=1&mode=pvp&pot=0&cut=30',
    'snk-pot-br': 'game=snooker&scene=nominatePink&camera=2d&pot=5',
    'snk-fold-3d': 'game=snooker&scene=nominatePink&camera=3d&pot=3&cut=-30',
    'cyber-max-snk-pot-tl': 'game=snooker&scene=nominatePink&camera=2d&max=1&mode=pvp&pot=0&theme=cyber&shape=chamfered',
    'light:max-snk-pot-bl': 'game=snooker&scene=nominatePink&camera=2d&max=1&mode=pvp&pot=3',
    // ⚙️ Max View: between bars (the full table is the default above).
    'max-bars-snk-pot-tl': 'game=snooker&scene=nominatePink&camera=2d&max=1&mode=pvp&pot=0&cut=20&maxlayout=bars',
    'max-bars-snk-nominate': 'game=snooker&scene=nominate&camera=3d&max=1&mode=pvp&maxlayout=bars',
    'max-bars-call-3d': 'scene=eight&camera=3d&aim=-20&lean=55&max=1&maxlayout=bars',
    'max-bars-bih-placed': 'scene=bih&placed=1&camera=3d&max=1&maxlayout=bars',
    'cyber-max-bars-snk-red': 'game=snooker&scene=red&camera=2d&max=1&maxlayout=bars&theme=cyber&shape=notched',
    // Snooker's call pocket (colours / all), and ⚙️ Aim Guide.
    'snk-call-red-3d': 'game=snooker&scene=red&camera=3d&snkcall=all',
    'snk-call-red-2d': 'game=snooker&scene=red&camera=2d&snkcall=all',
    'snk-call-colour-3d': 'game=snooker&scene=nominatePink&camera=3d&snkcall=colours',
    'snk-call-colour-called': 'game=snooker&scene=nominatePink&camera=3d&snkcall=colours&call=5',
    'snk-call-colour-2d': 'game=snooker&scene=nominatePink&camera=2d&snkcall=colours',
    'max-snk-call-colour-3d': 'game=snooker&scene=nominatePink&camera=3d&mode=pvp&max=1&snkcall=colours',
    'max-snk-call-red-2d': 'game=snooker&scene=red&camera=2d&mode=pvp&max=1&snkcall=all',
    'cyber-snk-call-colour-3d': 'game=snooker&scene=nominatePink&camera=3d&snkcall=colours&theme=cyber&shape=chamfered',
    'snk-guide-short': 'game=snooker&scene=red&camera=2d&guidelen=short',
    'snk-guide-medium': 'game=snooker&scene=red&camera=2d&guidelen=medium',
    'snk-tour-setup': 'game=snooker&tour=setup',
};

const CHROME = require('./browser').browserPath();     // Chrome, else Edge, or POOL_BROWSER
const CHECK = process.argv.includes('--check');         // also run the page's HUD audit on each scene
const ARGS = process.argv.slice(2).filter(a => a !== '--check');
const outDir = ARGS[0] || path.join(os.tmpdir(), 'pool-snapshots');
const picks = ARGS.slice(1);
// The widget's narrow column (350 wide on screens up to 1400 px, so 316 for the HUD):
// the same states again, derived so they cannot drift from the originals.
['main-3d', 'main-2d', 'power', 'bih', 'bih-break', 'foul-handoff', 'call-3d', 'clock-hot', 'win', 'bih-placed',
    'cyber-main-3d', 'cyber-call-3d', 'cyber-foul', 'light:main-3d', 'break-stay3d', 'spin-open', 'cyber-spin-open', 'sheet-cpu', 'cyber-sheet-cpu', 'sheet-pvp',
    'tracker-swap', 'open-potted', 'open-potted-4', 'call-3d-power', 'call-3d-replace', 'sheet-tour-saved', 'tour-setup', 'tour-bracket-sf', 'tour-bracket-16', 'tour-intro', 'tour-match', 'tour-result', 'tour-champion', 'tour-cabinet', 'tour-resume', 'tour-pause',
    'snooker-break-d', 'snooker-mid-3d', 'snooker-mid-2d',
    'snk-call-colour-3d', 'snk-break', 'snk-red', 'snk-nominate', 'snk-foul', 'snk-foul-handoff', 'snk-free', 'snk-snookers', 'snk-concede', 'snk-win', 'snk-respot'].forEach(n => { SCENES['narrow:' + n] = SCENES[n] + '&narrow=1'; });

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
        const light = name.includes('light:');
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: light ? 'light' : 'dark' }] });
        await send('Page.navigate', { url: page + '?still=1&' + query });
        let ready = false;
        for (let i = 0; i < 50 && !ready; i++) { await sleep(100); ready = await evaluate('window.__ready === true'); }
        const box = await evaluate('(() => { const el = document.querySelector(".pool-max-frame") || document.querySelector(".snake-game-container"); const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()');
        const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: box[0], y: box[1], width: box[2], height: box[3], scale: 1 } });
        const file = path.join(outDir, name.replace(/:/g, '-') + '.png');
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
