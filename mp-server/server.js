// The LAN game server for online Pool and Snooker: a lobby, challenges, and rooms that
// relay shot inputs between two portal tabs. The engine is deterministic, so a move is a
// few hundred bytes (the strike, a placement, a choice); nothing streams ball positions.
//
//   bash mp-server/make-cert.sh                                   # once
//   "/c/Program Files/nodejs/node.exe" mp-server/server.js        # or start.cmd
//
// It must run under C:\Program Files\nodejs\node.exe: that is the program the domain
// firewall's inbound allow rule names. State is in memory; a restart ends every room.
//
// Protocol (JSON text frames, `t` is the type):
//   client → server
//     hello     {clientId, key, name, build, plus}   first message; key is the client's own secret,
//                                              plus its Plus proof (online play is Plus, see plusTags)
//     challenge {to, game, bestOf, reds}      → the target gets `challenged`
//     answer    {id, accept}                   accept → both get `start`
//     cancel    {id}
//     move      {room, seq, m}                 seq = 1, 2, 3… per room; relayed and logged
//     aim       {room, aim, power, tip}        relayed only (the opponent's cue, live)
//     say       {room, text}                   a reaction or message, 30 characters, 1 a second; relayed only
//     result    {room, frame, winner}          each side's verdict, compared
//     leave     {room}
//     ping
//   server → client
//     welcome {you, room?}  lobby {players}  challenged {...}  challenge {id, state}
//     start {room, seed, game, bestOf, reds, seat, names, ids}  move {seq, m, seat}  say {text, seat}
//     ack {seq}  resync {have}  aim {...}  peer {state, holdMs?}  closed {reason, by?}
//     error {code, msg}  pong
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const crypto = require('crypto');
const { upgrade } = require('./ws');

const DEFAULTS = {
    port: 7777,
    // The portal, plus local pages for development (file:// sends "null").
    origins: ['https://globalportal.mtbc.com', /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, 'null'],
    holdMs: 3 * 60 * 1000,      // a dropped player's seat is kept this long
    challengeMs: 30 * 1000,
    idleMs: 45 * 1000,          // no traffic (pings included) this long → dropped
    maxMsg: 64 * 1024,
    ratePerSec: 60,
    log: true,
    // async (tag) => Set of Plus tags (gamesUnlock.tags in the leaderboard gist); null: no check.
    // The tag asked about lets a fetcher refresh early for one it has not seen.
    plusTags: null,
};

function createServer(opts = {}) {
    const o = Object.assign({}, DEFAULTS, opts);
    const say = (...a) => { if (o.log) console.log(new Date().toLocaleTimeString(), ...a); };

    const keys = new Map();        // clientId → key, first seen wins (in memory)
    const clients = new Map();     // clientId → {id, name, ws, room}
    const challenges = new Map();  // id → {id, from, to, game, bestOf, reds, timer}
    const rooms = new Map();       // id → {id, seed, game, bestOf, reds, ids: [p1, p2], names, log, away, results}

    const allowed = origin => o.origins.some(a => typeof a === 'string' ? a === origin : a.test(origin));
    const send = (c, msg) => { if (c && c.ws) c.ws.send(JSON.stringify(msg)); };
    const cleanName = s => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 24) || 'Player';
    const shortId = () => crypto.randomBytes(4).toString('hex');

    function lobby() {
        const players = [...clients.values()].filter(c => c.ws).map(c => ({ id: c.id, name: c.name, status: c.room ? 'playing' : 'idle' }));
        clients.forEach(c => send(c, { t: 'lobby', players }));
    }

    function startRoom(ch) {
        const a = clients.get(ch.from), b = clients.get(ch.to);
        const room = {
            id: shortId(), seed: crypto.randomInt(1, 2 ** 31), game: ch.game, bestOf: ch.bestOf, reds: ch.reds,
            ids: [a.id, b.id], names: [a.name, b.name], log: [], away: new Map(), results: new Map(),
        };
        rooms.set(room.id, room);
        a.room = b.room = room.id;
        [a, b].forEach(c => send(c, startMsg(room, c.id)));
        say('room', room.id, room.game, a.name, 'v', b.name);
        lobby();
    }
    const startMsg = (room, id) => ({ t: 'start', room: room.id, seed: room.seed, game: room.game, bestOf: room.bestOf, reds: room.reds,
        seat: room.ids.indexOf(id) + 1, names: room.names, ids: room.ids });
    const other = (room, id) => clients.get(room.ids[room.ids[0] === id ? 1 : 0]);

    function closeRoom(room, reason, by) {
        if (!rooms.has(room.id)) return;
        rooms.delete(room.id);
        room.away.forEach(t => clearTimeout(t));
        room.ids.forEach(id => {
            const c = clients.get(id);
            if (!c || c.room !== room.id) return;
            c.room = null;
            if (c.ws) send(c, { t: 'closed', reason, by }); else clients.delete(id);
        });
        say('room', room.id, 'closed:', reason);
        lobby();
    }

    function dropChallenges(id) {
        challenges.forEach(ch => {
            if (ch.from !== id && ch.to !== id) return;
            clearTimeout(ch.timer); challenges.delete(ch.id);
            send(clients.get(ch.from === id ? ch.to : ch.from), { t: 'challenge', id: ch.id, state: 'cancelled' });
        });
    }

    // Online play is Plus: the hello's secret must hash to a tag the gist lists.
    async function plusOk(ws, m) {
        if (!o.plusTags) return true;
        const secret = typeof m.plus === 'string' && /^[0-9a-f]{64}$/.test(m.plus) ? m.plus : '';
        const refuse = (code, msg) => { send({ ws }, { t: 'error', code, msg }); setTimeout(() => ws.close(4001), 50); return false; };
        if (!secret) return refuse('plus', 'Online play is part of Plus.');
        const tag = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 32);
        let tags;
        try { tags = await o.plusTags(tag); } catch (e) { say('Plus check failed:', e.message); return refuse('plus-check', "Can't check Plus right now. Try again in a minute."); }
        return tags.has(tag) ? true : refuse('plus', 'Online play is part of Plus.');
    }

    async function onHello(ws, m) {
        if (!(await plusOk(ws, m)) || !ws.open) return;
        const id = String(m.clientId || '').slice(0, 64), key = String(m.key || '').slice(0, 128);
        if (!/^[\w-]{8,64}$/.test(id) || key.length < 16) return send({ ws }, { t: 'error', code: 'hello', msg: 'bad identity' });
        if (keys.has(id) && keys.get(id) !== key) return send({ ws }, { t: 'error', code: 'identity', msg: 'that id is taken' });
        keys.set(id, key);
        let c = clients.get(id);
        // A second tab or a reload: the newest connection wins.
        if (c && c.ws && c.ws !== ws) { send(c, { t: 'error', code: 'replaced', msg: 'opened elsewhere' }); c.ws.close(4000); }
        if (!c) clients.set(id, c = { id, room: null });
        c.ws = ws; c.name = cleanName(m.name);
        ws.clientId = id;
        const room = c.room && rooms.get(c.room);
        send(c, { t: 'welcome', you: id, room: room ? room.id : null });
        if (room) {
            // Back within the hold: the seat is theirs again, with every move so far.
            clearTimeout(room.away.get(id)); room.away.delete(id);
            send(c, startMsg(room, id));
            room.log.forEach((m2, i) => send(c, { t: 'move', seq: i + 1, m: m2.m, seat: m2.seat, replay: true }));
            send(other(room, id), { t: 'peer', state: 'back' });
            say(c.name, 'rejoined', room.id);
        }
        say('hello', c.name, ws.ip);
        lobby();
    }

    function onMessage(ws, text) {
        let m;
        try { m = JSON.parse(text); } catch { return; }
        if (!m || typeof m.t !== 'string') return;
        if (m.t === 'ping') return ws.send('{"t":"pong"}');
        if (m.t === 'hello') return onHello(ws, m);
        const c = clients.get(ws.clientId);
        if (!c || c.ws !== ws) return send({ ws }, { t: 'error', code: 'hello', msg: 'say hello first' });
        const room = c.room && rooms.get(c.room);
        const inRoom = room && m.room === room.id;

        switch (m.t) {
        case 'challenge': {
            const to = clients.get(m.to);
            if (!to || !to.ws || to.id === c.id) return send(c, { t: 'error', code: 'challenge', msg: 'player is not online' });
            if (c.room || to.room) return send(c, { t: 'error', code: 'challenge', msg: 'already in a match' });
            const ch = { id: shortId(), from: c.id, to: to.id, game: m.game === 'snooker' ? 'snooker' : 'pool',
                bestOf: [1, 3, 5].includes(m.bestOf) ? m.bestOf : 1, reds: [15, 10, 6].includes(m.reds) ? m.reds : 15 };
            ch.timer = setTimeout(() => {
                challenges.delete(ch.id);
                [c, to].forEach(x => send(clients.get(x.id), { t: 'challenge', id: ch.id, state: 'expired' }));
            }, o.challengeMs);
            challenges.set(ch.id, ch);
            send(c, { t: 'challenge', id: ch.id, state: 'sent', to: to.id });
            send(to, { t: 'challenged', id: ch.id, from: c.id, name: c.name, game: ch.game, bestOf: ch.bestOf, reds: ch.reds, expiresMs: o.challengeMs });
            return;
        }
        case 'answer': case 'cancel': {
            const ch = challenges.get(m.id);
            if (!ch || (m.t === 'answer' ? ch.to : ch.from) !== c.id) return;
            clearTimeout(ch.timer); challenges.delete(ch.id);
            const accept = m.t === 'answer' && m.accept === true;
            const a = clients.get(ch.from), b = clients.get(ch.to);
            if (accept && a && a.ws && b && b.ws && !a.room && !b.room) { dropChallenges(a.id); dropChallenges(b.id); startRoom(ch); return; }
            const state = m.t === 'cancel' ? 'cancelled' : accept ? 'unavailable' : 'declined';
            [a, b].forEach(x => send(x, { t: 'challenge', id: ch.id, state }));
            return;
        }
        case 'move': {
            if (!inRoom || !Number.isInteger(m.seq) || !m.m || typeof m.m !== 'object') return;
            const have = room.log.length;
            if (m.seq <= have) return send(c, { t: 'ack', seq: m.seq });          // a resend: already logged
            if (m.seq !== have + 1) return send(c, { t: 'resync', have });        // a gap
            const seat = room.ids.indexOf(c.id) + 1;
            room.log.push({ seat, m: m.m });
            send(c, { t: 'ack', seq: m.seq });
            send(other(room, c.id), { t: 'move', seq: m.seq, m: m.m, seat });
            return;
        }
        case 'aim':
            if (inRoom) send(other(room, c.id), { t: 'aim', aim: m.aim, power: m.power, tip: m.tip });
            return;
        case 'say': {
            // One line, 30 characters (an emoji is one), at most one a second; never logged.
            const text = Array.from(String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 30).join('');
            if (!inRoom || !text || Date.now() - (c.sayAt || 0) < 1000) return;
            c.sayAt = Date.now();
            send(other(room, c.id), { t: 'say', text, seat: room.ids.indexOf(c.id) + 1 });
            return;
        }
        case 'result': {
            if (!inRoom || !Number.isInteger(m.frame)) return;
            const r = room.results.get(m.frame) || {};
            r[c.id] = m.winner;
            room.results.set(m.frame, r);
            const v = room.ids.map(id => r[id]);
            if (v[0] !== undefined && v[1] !== undefined && v[0] !== v[1]) say('room', room.id, 'frame', m.frame, 'DISAGREES', JSON.stringify(r));
            return;
        }
        case 'leave':
            if (inRoom) closeRoom(room, 'left', room.ids.indexOf(c.id) + 1);
            return;
        }
    }

    function onClose(ws) {
        const c = clients.get(ws.clientId);
        if (!c || c.ws !== ws) return;
        c.ws = null;
        dropChallenges(c.id);
        const room = c.room && rooms.get(c.room);
        if (room) {
            send(other(room, c.id), { t: 'peer', state: 'away', holdMs: o.holdMs });
            room.away.set(c.id, setTimeout(() => closeRoom(room, 'timeout', room.ids.indexOf(c.id) + 1), o.holdMs));
        } else clients.delete(c.id);
        say('bye', c.name);
        lobby();
    }

    function onUpgrade(req, socket) {
        const origin = req.headers.origin || 'null';
        if (!allowed(origin)) { say('refused origin', origin); socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
        const ws = upgrade(req, socket);
        if (!ws) return;
        let seen = Date.now(), win = Date.now(), n = 0;
        ws.on('message', text => {
            seen = Date.now();
            if (seen - win > 1000) { win = seen; n = 0; }
            if (++n > o.ratePerSec || text.length > o.maxMsg) { say('flood from', ws.ip); ws.close(1008); return; }
            // One at a time, in order: a hello (its Plus check is async) finishes before what follows it.
            ws.chain = (ws.chain || Promise.resolve()).then(() => onMessage(ws, text)).catch(e => say('message error:', e.message));
        });
        ws.on('pong', () => { seen = Date.now(); });
        const beat = setInterval(() => { if (Date.now() - seen > o.idleMs) ws.close(1001); else ws.ping(); }, Math.min(15000, o.idleMs / 3));
        ws.on('close', () => { clearInterval(beat); onClose(ws); });
    }

    const OK_PAGE = '<!doctype html><meta charset="utf-8"><title>Pool server</title><body style="font:16px system-ui;background:#0b1220;color:#d8e2f0;padding:40px">'
        + '<h1 style="color:#4ade80">&#10003; Certificate accepted</h1><p>This browser now trusts the pool server. Close this tab and go back to the portal.</p></body>';
    const onRequest = (req, res) => {
        if (req.url.startsWith('/health')) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, players: [...clients.values()].filter(c => c.ws).length, rooms: rooms.size }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(OK_PAGE);
    };

    const srv = o.tls ? https.createServer(o.tls, onRequest) : http.createServer(onRequest);
    srv.on('upgrade', onUpgrade);
    return {
        server: srv,
        listen: (port = o.port, host = '0.0.0.0') => new Promise(r => srv.listen(port, host, () => r(srv.address().port))),
        close: () => new Promise(r => { rooms.forEach(rm => closeRoom(rm, 'shutdown')); challenges.forEach(ch => clearTimeout(ch.timer)); clients.forEach(c => c.ws && c.ws.close()); srv.close(() => r()); }),
        state: { clients, rooms, challenges },
    };
}

// The Plus list from the leaderboard gist (public, read without auth), cached for 2 minutes and
// refetched (at most every 20 s) for a tag it has not seen. Fails, without a list, by throwing.
const GIST_URL = 'https://api.github.com/gists/b97357da4f32cfea822c9db36cd48088', GIST_FILE = 'attendance_widget_registry.json';
// The Plus browsers in a gist's files: the board's older gamesUnlock.tags, then one
// plus-<tag>.json per browser the bot added since ({ revoked: true } takes one away).
function plusTagsOf(files) {
    const parse = f => { const t = String((f && f.content) || ''), i = t.indexOf('{'); if (i < 0) return null; try { return JSON.parse(t.slice(i)); } catch (_) { return null; } };
    const reg = parse(files[GIST_FILE]) || {}, tags = new Set(Object.keys((reg.gamesUnlock && reg.gamesUnlock.tags) || {}));
    for (const name of Object.keys(files)) {
        const m = /^plus-([0-9a-f]{32})\.json$/.exec(name);
        if (!m) continue;
        const d = parse(files[name]);
        if (!d || d.revoked) tags.delete(m[1]); else tags.add(m[1]);
    }
    return tags;
}

function gistPlusTags() {
    let tags = null, at = 0, pending = null;
    const load = async () => {
        const r = await fetch(GIST_URL, { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'atc-pool-server' } });
        if (!r.ok) throw new Error('gist ' + r.status);
        const g = await r.json();
        tags = plusTagsOf((g && g.files) || {});
        at = Date.now();
        return tags;
    };
    return async tag => {
        const age = Date.now() - at;
        if (tags && (age < 120000 && (tags.has(tag) || age < 20000))) return tags;
        if (!pending) pending = load().finally(() => { pending = null; });
        try { return await pending; } catch (e) { if (tags) return tags; throw e; }
    };
}

module.exports = { createServer, gistPlusTags, plusTagsOf };

if (require.main === module) {
    const dir = path.join(__dirname, 'certs');
    let tls;
    try { tls = { key: fs.readFileSync(path.join(dir, 'key.pem')), cert: fs.readFileSync(path.join(dir, 'cert.pem')) }; }
    catch { console.error('No certificate: run  bash mp-server/make-cert.sh  first.'); process.exit(1); }
    // PLUS_CHECK=off skips the Plus check (local experiments only).
    const plusTags = process.env.PLUS_CHECK === 'off' ? null : gistPlusTags();
    const s = createServer({ tls, plusTags });
    if (plusTags) plusTags('').then(t => console.log('Plus check: gist reachable (' + t.size + ' Plus browsers).'))
        .catch(e => console.log('Plus check: CAN\'T reach the gist (' + e.message + '). Online play will be refused until it can. Start with start.cmd (it trusts the office proxy).'));
    else console.log('Plus check: OFF (PLUS_CHECK=off).');
    s.listen().then(port => {
        const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
        console.log('Pool server on ' + os.hostname() + ':  wss://' + addrs[0] + ':' + port);
        console.log('Players: open https://' + addrs[0] + ':' + port + ' once and accept the certificate.  Ctrl+C to stop.\n');
    });
}
