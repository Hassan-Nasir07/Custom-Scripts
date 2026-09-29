// The theme pass (POOL_V2_PLAN.md, Phase 9), in real Chrome over pool-table.html.
//
//   node pool-dev/theme-verify.js [--quick]
//
// Every design state in Glassmorphic dark and light, compact and Max, and a set of
// states in Cyberpunk under each of its four panel shapes and six colour presets.
// Each load runs the page's own layout audit (__hudAudit) and a text contrast audit:
// every visible element with its own text, its colour composited over what is really
// behind it (the stack of backgrounds; over the table, the canvas pixels under it),
// against WCAG AA: 4.5:1, or 3:1 for large text (24 px, or 18.66 px bold). Then a
// theme switch mid-frame, which must repaint the canvas with no reload.
// --quick runs one Cyberpunk shape per preset instead of all four.
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const CHROME = require('./browser').browserPath();     // Chrome, else Edge, or POOL_BROWSER
const QUICK = process.argv.includes('--quick');
const page = 'file:///' + path.join(__dirname, 'pool-table.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const STATES = [
    'scene=mid&camera=3d', 'scene=mid&camera=2d', 'scene=bih&placed=1&camera=3d', 'scene=bihbad&camera=3d', 'scene=foul&mode=pvp',
    'scene=clock&mode=pvp&hot=1', 'scene=win', 'scene=loss', 'scene=mid&camera=3d&sheet=cpu', 'scene=mid&camera=3d&sheet=pvp',
    'scene=mid&camera=3d&sheet=tour&n=8&played=4', 'scene=eight&camera=3d&aim=-20&lean=55', 'scene=eight&camera=3d&aim=-20&lean=55&call=2&power=90',
    'scene=mid&camera=3d&spinopen=1&tipx=0.2&tipy=0.3', 'scene=mid&camera=3d&open=1', 'scene=mid&camera=3d&power=62',
    'tour=setup&n=6', 'tour=bracket&n=8&played=5&tab=1', 'tour=bracket&n=16&played=9&tab=1', 'tour=intro&n=8&played=4',
    'tour=match&n=8&played=4&tframe=1&camera=3d', 'tour=result&n=8&played=5', 'tour=champion&n=6', 'tour=cabinet', 'tour=cabinet&empty=1',
    'tour=resume&n=8&played=4&tframe=1', 'tour=abandon&n=8&played=4', 'tour=pause&n=8&played=4&camera=3d',
    // Snooker (S3): the snk* states in the same HUD.
    'game=snooker&camera=3d', 'game=snooker&scene=red&camera=3d', 'game=snooker&scene=nominatePink&camera=3d', 'game=snooker&scene=foul&camera=3d',
    'game=snooker&scene=free&camera=3d', 'game=snooker&scene=concede&camera=3d', 'game=snooker&scene=century&camera=3d', 'game=snooker&scene=respot&camera=3d',
    'game=snooker&scene=win&camera=3d', 'game=snooker&scene=loss&camera=3d', 'game=snooker&scene=red&camera=3d&sheet=cpu',
];
const MAX = ['scene=mid&camera=3d&max=1', 'scene=mid&camera=3d&max=1&sheet=cpu', 'scene=win&max=1', 'scene=eight&camera=3d&aim=-20&lean=55&max=1',
    'tour=bracket&n=8&played=5&max=1', 'tour=champion&n=8&max=1', 'tour=match&n=8&played=4&tframe=1&camera=3d&max=1', 'tour=setup&n=6&max=1',
    'game=snooker&scene=nominate&camera=3d&mode=pvp&max=1', 'game=snooker&scene=win&camera=3d&max=1'];
const CYBER_STATES = ['scene=mid&camera=3d', 'scene=win', 'scene=mid&camera=3d&sheet=cpu', 'scene=eight&camera=3d&aim=-20&lean=55', 'scene=foul&mode=pvp',
    'tour=bracket&n=8&played=5&tab=1', 'tour=champion&n=6', 'tour=setup&n=6', 'scene=mid&camera=3d&max=1', 'tour=bracket&n=8&played=5&max=1',
    'game=snooker&scene=nominatePink&camera=3d', 'game=snooker&scene=free&camera=3d', 'game=snooker&scene=concede&camera=3d', 'game=snooker&scene=win&camera=3d'];
const SHAPES = ['notched', 'chamfered', 'stepped', 'rounded'];
const PALETTES = ['yellowCyan', 'bladeAmber', 'magentaNoir', 'acidGreen', 'ghostMono', 'violetHaze'];

const loads = [];
STATES.concat(MAX).forEach(q => { loads.push({ q, light: false, label: 'glass dark' }); loads.push({ q, light: true, label: 'glass light' }); });
PALETTES.forEach((pal, pi) => (QUICK ? [SHAPES[pi % 4]] : SHAPES).forEach(shape => CYBER_STATES.forEach(q =>
    loads.push({ q: q + '&theme=cyber&shape=' + shape + '&palette=' + pal, light: false, label: 'cyber ' + pal + '/' + shape }))));

// In the page: WCAG contrast of every visible text against what is behind it.
const CONTRAST = `(() => {
    // rgb()/rgba(), and color(srgb …), which is how Chrome reports a color-mix().
    const parse = c => {
        const s = /color\\(srgb ([\\d.e-]+) ([\\d.e-]+) ([\\d.e-]+)(?: \\/ ([\\d.]+))?\\)/.exec(c);
        if (s) return [s[1] * 255, s[2] * 255, s[3] * 255, s[4] === undefined ? 1 : +s[4]];
        const m = /rgba?\\(([^)]+)\\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    // The bottom layer of a background-image: the fill under decorations such as
    // Cyberpunk's corner brackets, which are thin lines, not what text sits on.
    const baseLayer = bi => { let d = 0, last = 0; for (let i = 0; i < bi.length; i++) { const ch = bi[i]; if (ch === '(') d++; else if (ch === ')') d--; else if (ch === ',' && d === 0) last = i + 1; } return bi.slice(last); };
    const over = (top, base) => { const a = top[3]; return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1]; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const root = document.querySelector('.pool-max-frame .pool-hud') || document.querySelector('#pool-root .pool-hud');
    const canvas = root.querySelector('canvas.ph-canvas'), cr = canvas.getBoundingClientRect(), cctx = canvas.getContext('2d');
    // The average colour of the canvas under a rect (the table, where an overlay sits on it).
    const under = r => {
        const k = canvas.width / cr.width;
        const x = Math.max(0, Math.floor((r.left - cr.left) * k)), y = Math.max(0, Math.floor((r.top - cr.top) * k));
        const w = Math.max(1, Math.min(canvas.width - x, Math.ceil(r.width * k))), h = Math.max(1, Math.min(canvas.height - y, Math.ceil(r.height * k)));
        const d = cctx.getImageData(x, y, w, h).data; let s = [0, 0, 0, 0], n = 0;
        for (let i = 0; i < d.length; i += 16) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; s[3] += d[i + 3]; n++; }
        return [s[0] / n, s[1] / n, s[2] / n, s[3] / n / 255];
    };
    const pageBg = parse(getComputedStyle(document.body).backgroundColor) || [0, 0, 0, 1];
    const out = { checked: 0, bad: [] };
    for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!el.getClientRects().length || el.closest('[hidden]')) continue;
        const text = [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('');
        if (!/[\\p{L}\\p{N}]/u.test(text)) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        // The background stack, nearest first, down to the first opaque colour. Over the
        // table (the overlay layer), the canvas under the element is the base.
        const stack = []; let n = el, alpha = 1, base = null;
        while (n && n.nodeType === 1) {
            const s = getComputedStyle(n);
            alpha *= +s.opacity;
            const c = parse(s.backgroundColor);
            if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
            if (s.backgroundImage !== 'none' && !/url\\(/.test(s.backgroundImage)) {
                const stops = (baseLayer(s.backgroundImage).match(/rgba?\\([^)]+\\)|color\\(srgb[^)]+\\)|#[0-9a-fA-F]{6}/g) || []).map(v => v[0] === '#' ? [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1] : parse(v)).filter(Boolean);
                if (stops.length) { const avg = [0, 1, 2, 3].map(i => stops.reduce((t, p) => t + p[i], 0) / stops.length); stack.push(avg); if (avg[3] >= 0.999) break; }
            }
            if (n.classList && n.classList.contains('ph-layer')) { base = over(under(el.getBoundingClientRect()), pageBg); break; }
            n = n.parentElement;
        }
        let bg = base || pageBg;
        for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
        const fg0 = parse(cs.color); if (!fg0) continue;
        const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * alpha], bg);
        const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
        out.checked++;
        if (ratio < (large ? 3 : 4.5) - 0.005) out.bad.push(String(el.className || el.tagName).split(' ')[0] + ' "' + text.trim().slice(0, 22) + '" ' + ratio.toFixed(2) + (large ? ' (large)' : ''));
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
    let id = 0; const pending = {}, errors = [];
    ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
        if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    });
    const send = (method, params) => new Promise(r => { const n = ++id; pending[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });

    let layoutChecks = 0, layoutFails = 0, textChecks = 0;
    const lowContrast = new Map();       // "what" → [labels]
    for (const L of loads) {
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: L.light ? 'light' : 'dark' }] });
        await send('Page.navigate', { url: page + '?still=1&' + L.q });
        let ready = false;
        for (let i = 0; i < 60 && !ready; i++) { await sleep(80); ready = await evaluate('window.__ready === true'); }
        if (!ready) { layoutFails++; console.log('  ✗ not ready: ' + L.label + ' ' + L.q); continue; }
        const audit = (await evaluate('window.__hudAudit ? window.__hudAudit() : []')) || [];
        audit.forEach(([n, pass, d]) => { layoutChecks++; if (!pass) { layoutFails++; console.log('  ✗ ' + L.label + ' ' + L.q + ' — ' + n + (d ? ' — ' + d : '')); } });
        const c = await evaluate(CONTRAST);
        textChecks += c.checked;
        c.bad.forEach(b => { const k = b.replace(/ [\d.]+( \(large\))?$/, ''); if (!lowContrast.has(k)) lowContrast.set(k, []); lowContrast.get(k).push(L.label + ' ' + b.match(/[\d.]+( \(large\))?$/)[0] + ' · ' + L.q); });
    }

    // A theme switch mid-frame repaints the canvas: no reload, no stale pixels.
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await send('Page.navigate', { url: page + '?still=1&scene=mid&camera=3d' });
    for (let i = 0; i < 60; i++) { await sleep(80); if (await evaluate('window.__ready === true')) break; }
    const sw = await evaluate(`(() => {
        const S = poolS, sum = () => { const d = S.ctx.getImageData(0, 0, S.canvas.width, S.canvas.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + 3 * d[i + 1] + 7 * d[i + 2]) >>> 0; return h; };
        const before = sum(), accent0 = phThemeTokens(S.hud).accent;
        document.querySelector('[data-theme="retro-futuristic"]').click();
        poolDraw(16);
        const after = sum(), accent1 = phThemeTokens(S.hud).accent;
        document.querySelector('[data-theme="glassmorphic"]').click();
        poolDraw(16);
        return { repainted: before !== after, accent0, accent1, back: sum() === before, retro: document.getElementById('total-time-summary').classList.contains('retro-theme') };
    })()`);

    let pass = 0, fail = 0;
    const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); } };
    console.log('\n── Theme pass: ' + loads.length + ' loads (' + (QUICK ? 'quick' : 'every Cyberpunk shape × preset') + ') ──');
    ok('the layout audit holds in every theme and state', layoutFails === 0, layoutFails + ' of ' + layoutChecks + ' failed');
    ok('text contrast meets WCAG AA (4.5:1, large 3:1) everywhere', lowContrast.size === 0,
        '\n      ' + [...lowContrast.entries()].map(([k, v]) => k + '  ×' + v.length + ' (worst: ' + v.sort()[0] + ')').join('\n      '));
    ok('switching theme mid-frame repaints the canvas with the new accent, and back', sw && sw.repainted && sw.accent0 !== sw.accent1 && sw.back && !sw.retro, JSON.stringify(sw));
    ok('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
    console.log('\n' + pass + ' passed, ' + fail + ' failed   (' + layoutChecks + ' layout checks, ' + textChecks + ' texts measured)');
    ws.close(); proc.kill();
    process.exit(fail ? 1 : 0);
})();
