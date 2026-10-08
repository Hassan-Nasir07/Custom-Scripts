// Phase 0 connectivity probe: can a portal tab on another PC reach a server on this one?
//
//   bash mp-server/make-cert.sh
//   "/c/Program Files/nodejs/node.exe" mp-server/probe.js
//
// Route A  https://<ip>:7777   TLS: /ping (fetch) and a wss:// echo, straight from the portal tab.
// Route B  http://<ip>:7778    plain: /bridge.html, a popup that holds a ws:// echo and relays
//                              it to the portal tab over postMessage (no cert needed).
// Every request is logged with the caller's address: a line from another PC's IP is the
// proof the firewall let it in. Then paste probe-client.js into the portal's console there.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const { upgrade } = require('./ws');

const TLS_PORT = 7777, PLAIN_PORT = 7778;
const certDir = path.join(__dirname, 'certs');
const ip = r => (r.socket.remoteAddress || '').replace(/^::ffff:/, '');
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

const OK_PAGE = `<!doctype html><meta charset="utf-8"><title>Pool server</title>
<body style="font:16px system-ui;background:#0b1220;color:#d8e2f0;padding:40px">
<h1 style="color:#4ade80">&#10003; Certificate accepted</h1>
<p>This browser now trusts the pool server. Close this tab and go back to the portal.</p></body>`;

const BRIDGE_PAGE = fs.readFileSync(path.join(__dirname, 'bridge.html'), 'utf8');

function handle(req, res, route) {
    log(route, req.method, req.url, 'from', ip(req), 'origin', req.headers.origin || '-');
    // CORS for the portal's fetch, and Chrome's Private Network Access preflight.
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.url.startsWith('/ping')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, route, you: ip(req), server: os.hostname() }));
    } else if (req.url.startsWith('/bridge.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(BRIDGE_PAGE);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(OK_PAGE);
    }
}

function echo(req, socket, route) {
    const ws = upgrade(req, socket);
    if (!ws) return;
    log(route, 'socket open from', ws.ip, 'origin', ws.origin || '-');
    ws.on('message', text => ws.send(JSON.stringify({ echo: text, route, you: ws.ip })));
    ws.on('close', () => log(route, 'socket closed', ws.ip));
}

let tls = null;
try {
    tls = https.createServer({ key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')) },
        (q, s) => handle(q, s, 'A'));
    tls.on('upgrade', (q, s) => echo(q, s, 'A'));
    tls.listen(TLS_PORT, '0.0.0.0');
} catch (e) {
    console.log('No certificate (' + e.code + '): run  bash mp-server/make-cert.sh  for Route A. Route B still runs.');
}
const plain = http.createServer((q, s) => handle(q, s, 'B'));
plain.on('upgrade', (q, s) => echo(q, s, 'B'));
plain.listen(PLAIN_PORT, '0.0.0.0');

const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
console.log('Pool probe on ' + os.hostname() + ' (' + addrs.join(', ') + ')');
if (tls) console.log('  Route A  https://' + addrs[0] + ':' + TLS_PORT);
console.log('  Route B  http://' + addrs[0] + ':' + PLAIN_PORT + '/bridge.html');
console.log('Waiting for another PC. Ctrl+C to stop.\n');
