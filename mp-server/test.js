// Server test: two (and three) fake clients against an in-process server over plain ws://.
//
//   "/c/Program Files/nodejs/node.exe" mp-server/test.js
//
// Short timers stand in for the real ones (3 min hold, 30 s challenge), so it runs in ~2 s.
const http = require('http');
const { createServer } = require('./server');

let fails = 0, passes = 0;
const ok = (cond, what) => { if (cond) passes++; else { fails++; console.log('  FAIL', what); } };
const wait = ms => new Promise(r => setTimeout(r, ms));

function client(port, id, key, name) {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/');
    const inbox = [], waiters = [];
    const c = {
        ws, inbox,
        send: m => ws.send(JSON.stringify(m)),
        // The next message of a type (skipping others), or null after ms.
        next: (t, ms = 1000) => new Promise(r => {
            const i = inbox.findIndex(m => m.t === t);
            if (i >= 0) return r(inbox.splice(i, 1)[0]);
            const w = { t, r }; waiters.push(w);
            setTimeout(() => { const j = waiters.indexOf(w); if (j >= 0) { waiters.splice(j, 1); r(null); } }, ms);
        }),
        none: async (t, ms = 150) => { await wait(ms); return !inbox.some(m => m.t === t); },
        close: () => new Promise(r => { ws.onclose = r; ws.close(); }),
    };
    ws.onmessage = e => {
        const m = JSON.parse(e.data), i = waiters.findIndex(w => w.t === m.t);
        if (i >= 0) waiters.splice(i, 1)[0].r(m); else inbox.push(m);
    };
    c.ready = new Promise(r => { ws.onopen = () => { c.send({ t: 'hello', clientId: id, key, name }); r(c); }; });
    return c;
}

(async () => {
    const s = createServer({ log: false, holdMs: 400, challengeMs: 300 });
    const port = await s.listen(0, '127.0.0.1');
    const KA = 'key-aaaaaaaaaaaaaaaa', KB = 'key-bbbbbbbbbbbbbbbb';

    console.log('lobby');
    const a = await client(port, 'client-aaaa', KA, 'Ali').ready;
    ok((await a.next('welcome')).you === 'client-aaaa', 'welcome');
    const b = await client(port, 'client-bbbb', KB, 'Bea <b>').ready;
    await b.next('welcome');
    let lob; do lob = await a.next('lobby'); while (lob && lob.players.length < 2);
    ok(lob && lob.players.length === 2, 'lobby lists both');
    ok(lob && lob.players.some(p => p.name === 'Bea b'), 'name sanitised');

    console.log('identity');
    const imp = await client(port, 'client-aaaa', 'key-wrong-wrong-wrong', 'Fake').ready;
    ok((await imp.next('error')).code === 'identity', 'wrong key refused');
    await imp.close();

    console.log('challenge expiry');
    a.send({ t: 'challenge', to: 'client-bbbb', game: 'pool' });
    ok((await a.next('challenge')).state === 'sent', 'sent');
    ok(!!(await b.next('challenged')), 'target notified');
    ok((await a.next('challenge')).state === 'expired', 'expired for challenger');
    ok((await b.next('challenge')).state === 'expired', 'expired for target');

    console.log('decline');
    a.send({ t: 'challenge', to: 'client-bbbb', game: 'pool' });
    let ch = await b.next('challenged');
    b.send({ t: 'answer', id: ch.id, accept: false });
    await a.next('challenge');
    ok((await a.next('challenge')).state === 'declined', 'declined');

    console.log('start');
    a.send({ t: 'challenge', to: 'client-bbbb', game: 'snooker', bestOf: 3 });
    ch = await b.next('challenged');
    ok(ch.game === 'snooker' && ch.bestOf === 3 && ch.name === 'Ali', 'challenge details');
    b.send({ t: 'answer', id: ch.id, accept: true });
    const sa = await a.next('start'), sb = await b.next('start');
    ok(sa && sb && sa.room === sb.room && sa.seed === sb.seed, 'same room and seed');
    ok(sa.seat === 1 && sb.seat === 2, 'challenger is seat 1');
    ok(sa.game === 'snooker' && sb.bestOf === 3, 'options carried');
    const room = sa.room;

    console.log('moves');
    a.send({ t: 'move', room, seq: 1, m: { k: 'strike', shot: { angle: 0.5, speed: 300 } } });
    ok((await a.next('ack')).seq === 1, 'ack');
    let mv = await b.next('move');
    ok(mv && mv.seq === 1 && mv.seat === 1 && mv.m.shot.angle === 0.5, 'relayed with seat');
    a.send({ t: 'move', room, seq: 1, m: { k: 'strike' } });
    ok((await a.next('ack')).seq === 1 && await b.none('move'), 'resend acked, not relayed');
    a.send({ t: 'move', room, seq: 5, m: { k: 'x' } });
    ok((await a.next('resync')).have === 1, 'gap → resync');
    b.send({ t: 'move', room: 'nope', seq: 2, m: { k: 'x' } });
    ok(await a.none('move'), 'wrong room ignored');
    b.send({ t: 'move', room, seq: 2, m: { k: 'place', x: 1, y: 2 } });
    ok((await a.next('move')).seat === 2, 'seat 2 move');
    a.send({ t: 'aim', room, aim: 1.25, power: 40, tip: { x: 0, y: 0 } });
    ok((await b.next('aim')).aim === 1.25, 'aim relayed');

    console.log('busy');
    const c3 = await client(port, 'client-cccc', 'key-cccccccccccccccc', 'Cy').ready;
    c3.send({ t: 'challenge', to: 'client-aaaa', game: 'pool' });
    ok((await c3.next('error')).code === 'challenge', 'cannot challenge a playing player');

    console.log('reconnect');
    await b.close();
    ok((await a.next('peer')).state === 'away', 'opponent away');
    const b2 = await client(port, 'client-bbbb', KB, 'Bea').ready;
    ok((await b2.next('welcome')).room === room, 'welcome names the room');
    ok((await b2.next('start')).seat === 2, 'start resent');
    const r1 = await b2.next('move'), r2 = await b2.next('move');
    ok(r1 && r2 && r1.replay && r1.seq === 1 && r2.seq === 2, 'log replayed in order');
    ok((await a.next('peer')).state === 'back', 'opponent back');

    console.log('replaced tab');
    const b3 = await client(port, 'client-bbbb', KB, 'Bea').ready;
    ok((await b2.next('error')).code === 'replaced', 'old tab told');
    ok((await b3.next('start')).room === room, 'new tab gets the room');

    console.log('hold expires');
    await b3.close();
    await a.next('peer');
    const cl = await a.next('closed', 1500);
    ok(cl && cl.reason === 'timeout' && cl.by === 2, 'room closed, seat 2 timed out');
    ok(!s.state.clients.has('client-bbbb'), 'dropped player forgotten');

    console.log('leave');
    a.send({ t: 'challenge', to: 'client-cccc', game: 'pool' });
    ch = await c3.next('challenged');
    c3.send({ t: 'answer', id: ch.id, accept: true });
    const s2 = await a.next('start'); await c3.next('start');
    c3.send({ t: 'leave', room: s2.room });
    const lc = await a.next('closed');
    ok(lc && lc.reason === 'left' && lc.by === 2, 'leave closes the room');

    console.log('origin');
    const code = await new Promise(r => {
        const req = http.request({ port, host: '127.0.0.1', headers: { Connection: 'Upgrade', Upgrade: 'websocket', Origin: 'https://evil.example',
            'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13' } });
        req.on('upgrade', () => r(101));
        req.on('response', res => r(res.statusCode));
        req.on('error', () => r('closed'));
        req.end();
    });
    ok(code !== 101, 'foreign origin refused (' + code + ')');

    console.log('flood');
    const f = await client(port, 'client-ffff', 'key-ffffffffffffffff', 'F').ready;
    const closed = new Promise(r => { f.ws.onclose = () => r(true); });
    for (let i = 0; i < 100; i++) f.send({ t: 'ping' });
    ok(await Promise.race([closed, wait(1000).then(() => false)]), 'flood closes the socket');

    await a.close(); await c3.close();
    await s.close();
    console.log('\n' + passes + ' passed, ' + fails + ' failed');
    process.exit(fails ? 1 : 0);
})();
