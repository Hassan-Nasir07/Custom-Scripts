// Paste into the DevTools console of the portal tab on a SECOND PC, with probe.js running
// on the host PC. Set HOST first. Prints a pass/fail line per route.
//
// Before Route A: open https://HOST:7777 in a tab once and click Advanced > Proceed.
(async () => {
    const HOST = '172.16.3.132';
    const out = {};
    const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timed out')), ms))]);

    // Route A1: TLS fetch (cert accepted, firewall open, no private-network block).
    try {
        const r = await timeout(fetch('https://' + HOST + ':7777/ping'), 5000);
        out['A1 https fetch'] = 'PASS ' + JSON.stringify(await r.json());
    } catch (e) { out['A1 https fetch'] = 'FAIL ' + e.message; }

    // Route A2: wss:// straight from the portal tab.
    try {
        out['A2 wss echo'] = 'PASS ' + await timeout(new Promise((ok, no) => {
            const ws = new WebSocket('wss://' + HOST + ':7777/');
            ws.onopen = () => ws.send('hello A');
            ws.onmessage = e => { ok(e.data); ws.close(); };
            ws.onerror = () => no(new Error('socket error (cert not accepted, or blocked)'));
        }), 5000);
    } catch (e) { out['A2 wss echo'] = 'FAIL ' + e.message; }

    // Route B: popup bridge over plain HTTP.
    try {
        const win = window.open('http://' + HOST + ':7778/bridge.html', 'poolLink', 'width=360,height=160');
        if (!win) throw new Error('popup blocked');
        out['B bridge echo'] = 'PASS ' + await timeout(new Promise(ok => {
            const hi = setInterval(() => win.postMessage({ poolBridge: true, hello: true }, 'http://' + HOST + ':7778'), 300);
            addEventListener('message', function on(e) {
                if (!e.data || !e.data.poolBridge) return;
                const m = e.data.m;
                if (m.t === 'bridge' && m.state === 'open') { clearInterval(hi); win.postMessage({ poolBridge: true, m: 'hello B' }, 'http://' + HOST + ':7778'); }
                if (m.t === 'data') { removeEventListener('message', on); ok(m.data); win.close(); }
            });
        }), 8000);
    } catch (e) { out['B bridge echo'] = 'FAIL ' + e.message; }

    console.table(out);
})();
