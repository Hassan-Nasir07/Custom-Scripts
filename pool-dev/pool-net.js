    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — ONLINE (LAN)
    // ═══════════════════════════════════════════════════════════════════
    // The client side of mp-server/: a lobby, challenges, and a room whose moves are relayed
    // between two portal tabs. The physics is deterministic (fixed 60 Hz steps, a seeded rack),
    // so a move is an input, not a table: the exact strike, a choice, a timeout. Both tabs
    // play every move through the same rules; the shooter's settled table is sent alongside,
    // and a tab that disagrees takes it (poolNetResync in pool-game.js).
    //
    //   poolNetConnect()          ⚙️'s server (wss://, port 7777 by default), with backoff
    //   poolNetDisconnect()       and stay off
    //   poolNetChallenge(id, o)   { game, bestOf, reds } → the server's `challenged` at the other end
    //   poolNetAnswer(id, yes)    an invite; yes starts the room (pool-game.js poolNetStart)
    //   poolNetMove(m)            a move in this room: numbered, kept until acked, resent on reconnect
    //   poolNetAim(a)             the live cue, throttled; the other tab draws it
    //   poolNetLeave()            out of the room
    //   poolNetSay(text)          a reaction or message (30 characters), shown on both tables for 4 s
    // The engine hooks in through poolNet.on (start, closed, invite); pool-game.js sets them.
    // poolNet.transport is a test seam: (url, handlers) → { send, close }.

    const POOL_NET_PORT = 7777;
    const POOL_NET_BEAT_MS = 15000;
    const POOL_NET_AIM_MS = 100;
    const POOL_NET_ID_KEY = 'poolNetId', POOL_NET_SECRET_KEY = 'poolNetKey';
    const POOL_NET_SAY_MAX = 30, POOL_NET_SAY_MS = 4000, POOL_NET_SAY_GAP = 1200;

    const poolNet = {
        state: 'off',            // off | connecting | open | down
        url: '', ws: null, err: '', tries: 0, retryT: null, beat: null, wanted: false, everOpen: false,
        id: '', key: '', lobby: [], invites: [], outgoing: null, note: '',
        room: null,              // { id, seed, game, bestOf, seat, names, ids }
        known: 0,                // the room's last move seq this tab has seen or had acked
        out: [],                 // our moves not acked yet: { seq, m }
        inbox: [],               // moves to play, in order: { seq, m, seat, replay }
        peer: 'here', peerUntil: 0,
        aim: null, peerCue: '', aimSent: '', aimAt: 0,
        said: {}, sayAt: 0,     // each seat's last reaction { text, at }, and when we last sent one
        rev: 0,
        transport: null,
        on: {},
    };
    const poolNetBump = () => { poolNet.rev++; };

    // This browser's id and secret: made once, kept. The server binds the id to the secret,
    // so another tab cannot take your seat by claiming your id.
    function poolNetIdentity() {
        const N = poolNet;
        if (N.id && N.key) return;
        const rand = n => {
            const a = new Uint8Array(n);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a); else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
            return Array.prototype.map.call(a, b => (b < 16 ? '0' : '') + b.toString(16)).join('');
        };
        try { N.id = localStorage.getItem(POOL_NET_ID_KEY) || ''; N.key = localStorage.getItem(POOL_NET_SECRET_KEY) || ''; } catch (_) {}
        if (!/^[\w-]{8,64}$/.test(N.id) || N.key.length < 16) {
            N.id = 'p-' + rand(8); N.key = rand(24);
            try { localStorage.setItem(POOL_NET_ID_KEY, N.id); localStorage.setItem(POOL_NET_SECRET_KEY, N.key); } catch (_) {}
        }
    }

    // ⚙️'s server: an address ("172.16.3.132", "pc-name:7777") or a full wss:// URL.
    function poolNetUrl(raw) {
        const s = String(raw || '').trim();
        if (!s) return '';
        if (/^wss?:\/\//i.test(s)) return s.replace(/\/+$/, '') + '/';
        const host = s.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        return 'wss://' + (/:\d+$/.test(host) ? host : host + ':' + POOL_NET_PORT) + '/';
    }
    // The page that accepts the server's certificate, for the "can't reach" note.
    const poolNetCertPage = () => poolNet.url.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');

    function poolNetConnect(raw) {
        const N = poolNet;
        if (raw !== undefined) N.url = poolNetUrl(raw);
        if (!N.url) { N.state = 'off'; N.err = 'Enter the server address'; poolNetBump(); return; }
        poolNetIdentity();
        N.wanted = true;
        clearTimeout(N.retryT); N.retryT = null;
        if (N.ws) { const old = N.ws; N.ws = null; try { old.close(); } catch (_) {} }
        N.state = 'connecting'; N.err = '';
        poolNetBump();
        let sock = null;
        const handlers = {
            open: () => {
                N.state = 'open'; N.tries = 0; N.everOpen = true; N.err = '';
                poolNetRaw({ t: 'hello', clientId: N.id, key: N.key, name: poolNetName(), build: 1 });
                clearInterval(N.beat);
                N.beat = setInterval(() => poolNetRaw({ t: 'ping' }), POOL_NET_BEAT_MS);
                poolNetBump();
            },
            message: text => { let m = null; try { m = JSON.parse(text); } catch (_) {} if (m && typeof m.t === 'string') poolNetOnMsg(m); },
            close: () => {
                if (N.ws !== sock) return;
                N.ws = null; clearInterval(N.beat); N.beat = null;
                if (!N.wanted) { N.state = 'off'; poolNetBump(); return; }
                N.state = 'down';
                if (!N.everOpen) N.err = "Can't reach the server. Open " + poolNetCertPage() + ' once and accept its certificate';
                // Back off: 1, 2, 4, 8 s, then every 10 s.
                N.retryT = setTimeout(() => poolNetConnect(), Math.min(10000, 1000 * Math.pow(2, N.tries++)));
                poolNetBump();
            },
        };
        try { sock = N.transport ? N.transport(N.url, handlers) : poolNetSocket(N.url, handlers); }
        catch (e) { N.state = 'down'; N.err = 'Bad server address'; N.wanted = false; poolNetBump(); return; }
        N.ws = sock;
    }
    function poolNetSocket(url, h) {
        const ws = new WebSocket(url);
        ws.onopen = h.open;
        ws.onmessage = e => h.message(e.data);
        ws.onclose = h.close;
        return { send: s => { if (ws.readyState === 1) ws.send(s); }, close: () => ws.close() };
    }
    function poolNetDisconnect() {
        const N = poolNet;
        N.wanted = false;
        clearTimeout(N.retryT); N.retryT = null;
        clearInterval(N.beat); N.beat = null;
        if (N.ws) { const ws = N.ws; N.ws = null; try { ws.close(); } catch (_) {} }
        N.state = 'off'; N.lobby = []; N.invites = []; N.outgoing = null;
        poolNetBump();
    }
    const poolNetRaw = msg => { if (poolNet.ws && poolNet.state === 'open') poolNet.ws.send(JSON.stringify(msg)); };
    // Your leaderboard name, else the one 2 Players knows you by.
    const poolNetName = () => (typeof poolMe === 'function' && poolMe()) || String(userPreferences.poolP1Name || '').trim().slice(0, 16) || 'Player';

    function poolNetOnMsg(m) {
        const N = poolNet, on = N.on;
        switch (m.t) {
        case 'welcome':
            // Our room ended while we were gone (the hold ran out): the engine hears it as closed.
            if (!m.room && N.room) { const r = N.room; poolNetEnd(); if (on.closed) on.closed({ reason: 'gone', room: r }); }
            // Moves still waiting for an ack go again; the server drops what it already has.
            N.out.forEach(o => poolNetRaw({ t: 'move', room: N.room && N.room.id, seq: o.seq, m: o.m }));
            break;
        case 'lobby':
            N.lobby = (m.players || []).filter(p => p.id !== N.id);
            // An invite from someone who left goes with them.
            N.invites = N.invites.filter(i => N.lobby.some(p => p.id === i.from));
            break;
        case 'challenged':
            N.invites = N.invites.filter(i => i.from !== m.from).concat([{ id: m.id, from: m.from, name: m.name, game: m.game, bestOf: m.bestOf, reds: m.reds, until: Date.now() + (m.expiresMs || 30000) }]);
            if (on.invite) on.invite(m);
            break;
        case 'challenge':
            if (m.state === 'sent') { const p = N.lobby.find(x => x.id === m.to); N.outgoing = { id: m.id, to: m.to, name: p ? p.name : '' }; N.note = ''; }
            else {
                const mine = N.outgoing && N.outgoing.id === m.id, who = mine ? N.outgoing.name : '';
                if (mine) N.outgoing = null;
                N.invites = N.invites.filter(i => i.id !== m.id);
                if (mine) N.note = m.state === 'declined' ? who + ' declined' : m.state === 'expired' ? who + " didn't answer" : m.state === 'unavailable' ? who + ' is busy' : '';
            }
            break;
        case 'start': {
            const again = !!(N.room && N.room.id === m.room);
            N.room = { id: m.room, seed: m.seed >>> 0, game: m.game === 'snooker' ? 'snooker' : 'pool', bestOf: m.bestOf || 1, seat: m.seat === 2 ? 2 : 1, names: m.names || ['', ''], ids: m.ids || [], reds: [15, 10, 6].indexOf(m.reds) >= 0 ? m.reds : 15 };
            N.invites = []; N.outgoing = null; N.note = ''; N.peer = 'here'; N.aim = null;
            if (!again) { N.known = 0; N.out = []; N.inbox = []; }
            if (on.start) on.start(N.room, again);
            break;
        }
        case 'move':
            if (!N.room || m.seq <= N.known) break;
            N.known = m.seq;
            N.inbox.push({ seq: m.seq, m: m.m, seat: m.seat, replay: !!m.replay });
            break;
        case 'ack':
            N.out = N.out.filter(o => o.seq !== m.seq);
            if (m.seq > N.known) N.known = m.seq;
            break;
        case 'resync':
            // Our numbering ran ahead of the room's (a move crossed ours): renumber what is
            // still unsent from the room's count and send it again.
            N.known = Math.max(N.known, m.have || 0);
            N.out = N.out.filter(o => o.seq > (m.have || 0)).map((o, i) => ({ seq: N.known + 1 + i, m: o.m }));
            N.out.forEach(o => poolNetRaw({ t: 'move', room: N.room && N.room.id, seq: o.seq, m: o.m }));
            break;
        case 'aim':
            N.aim = { a: +m.aim || 0, p: +m.power || 0, tip: m.tip || null, at: Date.now() };
            if (m.tip && typeof m.tip.q === 'string') N.peerCue = m.tip.q;
            break;
        case 'say':
            if (N.room && (m.seat === 1 || m.seat === 2)) poolNetHeard(m.seat, m.text);
            break;
        case 'peer':
            N.peer = m.state === 'away' ? 'away' : 'here';
            N.peerUntil = N.peer === 'away' ? Date.now() + (m.holdMs || 180000) : 0;
            break;
        case 'closed': {
            const r = N.room;
            poolNetEnd();
            if (on.closed) on.closed({ reason: m.reason, by: m.by, room: r });
            break;
        }
        case 'error':
            if (m.code === 'identity') { try { localStorage.removeItem(POOL_NET_ID_KEY); localStorage.removeItem(POOL_NET_SECRET_KEY); } catch (_) {} N.id = N.key = ''; poolNetConnect(); return; }
            if (m.code === 'replaced') { N.wanted = false; N.err = 'Online in another tab'; }
            else N.note = m.msg || '';
            break;
        }
        poolNetBump();
    }
    function poolNetEnd() { const N = poolNet; N.room = null; N.out = []; N.inbox = []; N.known = 0; N.peer = 'here'; N.aim = null; N.said = {}; }

    function poolNetChallenge(to, o) {
        o = o || {};
        poolNetRaw({ t: 'challenge', to, game: o.game === 'snooker' ? 'snooker' : 'pool', bestOf: [1, 3, 5].indexOf(o.bestOf) >= 0 ? o.bestOf : 1, reds: [15, 10, 6].indexOf(o.reds) >= 0 ? o.reds : 15 });
    }
    function poolNetCancel() { const N = poolNet; if (N.outgoing) poolNetRaw({ t: 'cancel', id: N.outgoing.id }); N.outgoing = null; poolNetBump(); }
    function poolNetAnswer(id, yes) {
        const N = poolNet;
        poolNetRaw({ t: 'answer', id, accept: !!yes });
        N.invites = N.invites.filter(i => i.id !== id);
        poolNetBump();
    }
    // A move in the room: played here at once, numbered after the last one this tab knows.
    function poolNetMove(m) {
        const N = poolNet;
        if (!N.room) return;
        const seq = Math.max(N.known, N.out.length ? N.out[N.out.length - 1].seq : 0) + 1;
        N.out.push({ seq, m });
        poolNetRaw({ t: 'move', room: N.room.id, seq, m });
    }
    // The live cue, while it is ours to play: only when it changed, at most every 100 ms.
    function poolNetAim(a) {
        const N = poolNet, now = Date.now();
        if (!N.room || now - N.aimAt < POOL_NET_AIM_MS) return;
        const tip = { x: a.tx, y: a.ty, cx: a.cx, cy: a.cy, q: a.q, ph: a.ph };
        const key = [a.a.toFixed(4), Math.round(a.p), a.tx, a.ty, a.cx, a.cy, a.q, a.ph].join();
        if (key === N.aimSent) return;
        N.aimSent = key; N.aimAt = now;
        poolNetRaw({ t: 'aim', room: N.room.id, aim: a.a, power: a.p, tip });
    }
    // Reactions: one line of up to 30 characters (an emoji counts as one), no control characters.
    const poolNetSayText = t => Array.from(String(t || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()).slice(0, POOL_NET_SAY_MAX).join('');
    function poolNetHeard(seat, text) {
        const t = poolNetSayText(text);
        if (!t) return;
        poolNet.said[seat] = { text: t, at: Date.now() };
        poolNetBump();
    }
    // Send one; shown on our own table at once. False if empty, not in a room, or too soon after the last.
    function poolNetSay(text) {
        const N = poolNet, t = poolNetSayText(text), now = Date.now();
        if (!t || !N.room || now - N.sayAt < POOL_NET_SAY_GAP) return false;
        N.sayAt = now;
        poolNetRaw({ t: 'say', room: N.room.id, text: t });
        poolNetHeard(N.room.seat, t);
        return true;
    }
    // What each seat is saying now (a bubble lasts 4 s): { 1: text | '', 2: text | '' }.
    const poolNetSaying = () => { const out = {}, now = Date.now(); [1, 2].forEach(s => { const w = poolNet.said[s]; out[s] = w && now - w.at < POOL_NET_SAY_MS ? w.text : ''; }); return out; };
    function poolNetResult(frame, winner) { const N = poolNet; if (N.room) poolNetRaw({ t: 'result', room: N.room.id, frame, winner }); }
    function poolNetLeave() {
        const N = poolNet;
        if (N.room) poolNetRaw({ t: 'leave', room: N.room.id });
        poolNetEnd();
        poolNetBump();
    }
