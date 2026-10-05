    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — TOURNAMENT MODEL (v2)
    // ═══════════════════════════════════════════════════════════════════
    // A single-elimination bracket for 3–16 humans on one computer. Pure plain
    // objects, so it is tested in Node and saved as JSON.
    //   size   S = next power of two ≥ N (min 4); the S − N byes go to the top seeds
    //   seeds  seed s meets 2n+1−s, every other pair flipped (1v8, 4v5, 3v6, 2v7)
    //   play   round by round, left to right; match j feeds j >> 1, side j & 1
    //   breaks the lower seed (higher number) first, then alternating
    // A tournament: { v, id, game, seed, name, created, settings, slots, size,
    // rounds, matches: [{ id, round, index, a, b, raceTo, frames, points, high,
    // winner, status }], snapshot }. a/b index `slots` (a the upper line). A save
    // with no game is pool's. Snooker matches also keep per-frame points ([a, b])
    // and the high break ({ slot, frame, value }); its raceTo reads as best of 2N − 1.

    const PT_VERSION = 1;
    const PT_MIN = 3, PT_MAX = 16;
    const PT_NAMES = { 4: 'Club Cup', 8: 'City Open', 16: 'Masters' };
    // Race-to by round, as setup defaults them: the semi and final longer.
    const PT_RACE_DEFAULT = { 4: [2, 3], 8: [1, 2, 3], 16: [1, 1, 2, 3] };

    const ptSizeFor = n => (n <= 4 ? 4 : n <= 8 ? 8 : 16);
    const ptGameOf = x => (x && x.game === 'snooker' ? 'snooker' : 'pool');
    const ptRaceText = (t, n) => (ptGameOf(t) === 'snooker' ? 'Best of ' + (2 * n - 1) : 'Race to ' + n);
    // Settings normalised for the game: race 1–5 per round, clock 0/30/45 (/60 snooker),
    // guideline, pool's call (8 or every), snooker's reds and call pocket.
    function ptSettings(game, s0, rounds, size) {
        const s = s0 || {}, snk = game === 'snooker';
        const race = (Array.isArray(s.race) && s.race.length === rounds ? s.race : PT_RACE_DEFAULT[size]).map(x => Math.max(1, Math.min(5, x | 0 || 1)));
        const out = {
            race, clock: [0, 30, 45].concat(snk ? [60] : []).indexOf(s.clock) >= 0 ? s.clock : 30,
            guide: s.guide === 'short' || s.guide === 'off' ? s.guide : 'full', shuffle: !!s.shuffle,
        };
        if (snk) { out.reds = [15, 10, 6].indexOf(s.reds) >= 0 ? s.reds : 15; out.call = ['off', 'colours', 'all'].indexOf(s.call) >= 0 ? s.call : 'off'; }
        else out.call = s.call === 'every' ? 'every' : '8';
        return out;
    }
    const ptRoundsFor = size => Math.round(Math.log2(size));

    function ptRoundName(rounds, r) {
        const fromEnd = rounds - 1 - r;
        return fromEnd === 0 ? 'Final' : fromEnd === 1 ? 'Semi-final' : fromEnd === 2 ? 'Quarter-final' : 'Round of ' + Math.pow(2, fromEnd + 1);
    }
    // Setup's short column names: the rounds before the semi share one race.
    function ptRaceColumns(size) {
        const rounds = ptRoundsFor(size);
        return rounds === 2 ? [{ label: 'Semi', rounds: [0] }, { label: 'Final', rounds: [1] }]
            : [{ label: rounds === 3 ? 'Quarter' : 'Round 1', rounds: Array.from({ length: rounds - 2 }, (_, i) => i) },
               { label: 'Semi', rounds: [rounds - 2] }, { label: 'Final', rounds: [rounds - 1] }];
    }

    // Bracket positions by seed: order(2) = [1, 2]; order(2n) pairs each seed s
    // of order(n) with 2n+1−s, flipping every other pair.
    function ptSeedOrder(size) {
        let order = [1, 2];
        while (order.length < size) {
            const n2 = order.length * 2 + 1, next = [];
            order.forEach((s, i) => { if (i % 2 === 0) next.push(s, n2 - s); else next.push(n2 - s, s); });
            order = next;
        }
        return order;
    }

    // A reproducible shuffle (Fisher–Yates on mulberry32), so a seed replays the draw.
    function ptShuffle(list, seed) {
        const rng = ppRandom(seed >>> 0), a = list.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
        return a;
    }

    // opts: { game, names: [...], you: the account owner's slot (or -1), settings (see
    //         ptSettings, plus shuffle), name, seed, created (ms) }
    function ptCreate(opts) {
        const o = opts || {};
        const names = (o.names || []).map(n => String(n || '').trim().slice(0, 16)).slice(0, PT_MAX);
        if (names.length < PT_MIN) throw new Error('a tournament needs at least ' + PT_MIN + ' players');
        const size = ptSizeFor(names.length), rounds = ptRoundsFor(size);
        const seed = (o.seed === undefined ? Date.now() : o.seed) >>> 0;
        const game = ptGameOf(o), set = ptSettings(game, o.settings, rounds, size), race = set.race;
        // Seeding: entry order, or the shuffled order. Seed k is slot k − 1.
        const entries = names.map((name, i) => ({ name: name || 'Player ' + (i + 1), you: i === (o.you === undefined ? 0 : o.you) }));
        const seeded = set.shuffle ? ptShuffle(entries, seed) : entries;
        const slots = seeded.map((e, i) => ({ name: e.name, seed: i + 1, you: e.you }));
        const t = {
            v: PT_VERSION, id: 't' + seed.toString(36), game, seed, name: String(o.name || '').trim().slice(0, 24) || PT_NAMES[size],
            created: o.created || Date.now(), settings: set, slots, size, rounds, matches: [], snapshot: null,
        };
        const order = ptSeedOrder(size);
        for (let r = 0, count = size / 2; r < rounds; r++, count /= 2) {
            for (let j = 0; j < count; j++) {
                t.matches.push({ id: 'r' + r + 'm' + j, round: r, index: j, a: null, b: null, raceTo: race[r], frames: [], points: [], high: null, winner: null, status: 'pending' });
            }
        }
        // Round one: the better seed on the upper line; a seed past N is a bye.
        for (let j = 0; j < size / 2; j++) {
            const s1 = order[2 * j], s2 = order[2 * j + 1];
            const hi = Math.min(s1, s2), lo = Math.max(s1, s2);
            const m = ptMatch(t, 0, j);
            m.a = hi <= slots.length ? hi - 1 : null;
            m.b = lo <= slots.length ? lo - 1 : null;
            if (m.b === null) { m.status = 'bye'; m.winner = m.a; ptAdvance(t, m); }
        }
        return t;
    }

    const ptMatch = (t, round, index) => t.matches.find(m => m.round === round && m.index === index);
    const ptById = (t, id) => t.matches.find(m => m.id === id);

    function ptAdvance(t, m) {
        if (m.round === t.rounds - 1) return;
        const next = ptMatch(t, m.round + 1, m.index >> 1);
        if (m.index % 2 === 0) next.a = m.winner; else next.b = m.winner;
    }

    // Matches in play order, byes left out.
    const ptPlayable = t => t.matches.filter(m => m.status !== 'bye').sort((x, y) => x.round - y.round || x.index - y.index);
    function ptNext(t) {
        return ptPlayable(t).find(m => m.status !== 'done' && m.a !== null && m.b !== null) || null;
    }
    function ptMatchNumber(t, m) {
        const list = ptPlayable(t);
        return { n: list.indexOf(m) + 1, of: list.length };
    }
    function ptScore(m) {
        return [m.frames.filter(w => w === m.a).length, m.frames.filter(w => w === m.b).length];
    }
    function ptBreaker(t, m, k) {
        const aSeed = t.slots[m.a].seed, bSeed = t.slots[m.b].seed;
        const lower = aSeed > bSeed ? m.a : m.b, upper = lower === m.a ? m.b : m.a;
        return k % 2 === 0 ? lower : upper;
    }

    // Pure (t is copied). extra (snooker): { points: [a, b], high: [a, b] } for the frame.
    function ptRecordFrame(t0, matchId, winnerSlot, extra) {
        const t = JSON.parse(JSON.stringify(t0));
        const m = ptById(t, matchId);
        if (!m || m.status === 'done' || m.status === 'bye' || (winnerSlot !== m.a && winnerSlot !== m.b)) return { t: t0, matchOver: false, winner: null };
        m.frames.push(winnerSlot);
        if (extra && Array.isArray(extra.points)) {
            if (!Array.isArray(m.points)) m.points = [];
            m.points[m.frames.length - 1] = extra.points.map(n => Math.max(0, n | 0));
        }
        if (extra && Array.isArray(extra.high)) {
            const hi = extra.high.map(n => Math.max(0, n | 0)), side = hi[1] > hi[0] ? 1 : 0;
            if (hi[side] > 0 && (!m.high || hi[side] > m.high.value)) m.high = { slot: side ? m.b : m.a, frame: m.frames.length, value: hi[side] };
        }
        m.status = 'live';
        const [sa, sb] = ptScore(m);
        let matchOver = false;
        if (sa >= m.raceTo || sb >= m.raceTo) {
            m.winner = sa > sb ? m.a : m.b;
            m.status = 'done';
            matchOver = true;
            ptAdvance(t, m);
        }
        t.snapshot = null;
        return { t, matchOver, winner: matchOver ? m.winner : null };
    }

    function ptChampion(t) {
        const f = ptMatch(t, t.rounds - 1, 0);
        return f && f.status === 'done' ? f.winner : null;
    }
    // The round a player went out in, or null.
    function ptOut(t, slot) {
        const lost = t.matches.find(m => m.status === 'done' && (m.a === slot || m.b === slot) && m.winner !== slot);
        return lost ? lost.round : null;
    }
    // A player's run, round by round: bye, a win, or the loss that ended it.
    function ptRun(t, slot) {
        const out = [];
        for (let r = 0; r < t.rounds; r++) {
            const m = t.matches.find(x => x.round === r && (x.a === slot || x.b === slot));
            if (!m) break;
            const name = ptRoundName(t.rounds, r);
            if (m.status === 'bye') { out.push({ round: r, name, kind: 'bye', text: 'Bye as top seed', score: '' }); continue; }
            if (m.status !== 'done') { out.push({ round: r, name, kind: 'pending', text: '', score: '' }); break; }
            const [sa, sb] = ptScore(m), mine = m.a === slot ? sa : sb, theirs = m.a === slot ? sb : sa;
            const opp = t.slots[m.a === slot ? m.b : m.a].name;
            if (m.winner === slot) out.push({ round: r, name, kind: 'won', text: 'beat ' + opp, score: mine + '–' + theirs });
            else { out.push({ round: r, name, kind: 'lost', text: 'lost to ' + opp, score: mine + '–' + theirs }); break; }
        }
        return out;
    }
    function ptFrames(t, slot) {
        let won = 0, lost = 0;
        t.matches.forEach(m => { if (m.a === slot || m.b === slot) m.frames.forEach(w => { if (w === slot) won++; else lost++; }); });
        return { won, lost };
    }

    // A resumable save for `game`, or null. Checked field by field: a half-loaded
    // bracket is worse than none.
    function ptValidate(x, game) {
        try {
            if (!x || typeof x !== 'object' || x.v !== PT_VERSION) return null;
            if (game && ptGameOf(x) !== (game === 'snooker' ? 'snooker' : 'pool')) return null;
            if (!Array.isArray(x.slots) || x.slots.length < PT_MIN || x.slots.length > PT_MAX) return null;
            if ([4, 8, 16].indexOf(x.size) === -1 || x.rounds !== ptRoundsFor(x.size) || x.slots.length > x.size) return null;
            if (!Array.isArray(x.matches) || x.matches.length !== x.size - 1) return null;
            const ok = s => s === null || (Number.isInteger(s) && s >= 0 && s < x.slots.length);
            for (const m of x.matches) {
                if (!ok(m.a) || !ok(m.b) || !ok(m.winner) || !Array.isArray(m.frames) || !m.frames.every(ok)) return null;
                if (['pending', 'live', 'done', 'bye'].indexOf(m.status) === -1 || !(m.raceTo >= 1 && m.raceTo <= 5)) return null;
                if (m.points !== undefined && !(Array.isArray(m.points) && m.points.every(p => p === null || (Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))))) return null;
                if (m.high !== undefined && m.high !== null && !(ok(m.high.slot) && Number.isFinite(m.high.value) && Number.isInteger(m.high.frame))) return null;
            }
            if (!x.slots.every(s => s && typeof s.name === 'string' && Number.isInteger(s.seed))) return null;
            x.game = ptGameOf(x);
            x.settings = ptSettings(x.game, x.settings, x.rounds, x.size);
            return x;
        } catch (_) { return null; }
    }

    // ── Trophy cabinet (local only) ───────────────────────────────────
    // { v, titles: { key: { name, 4, 8, 16 } }, recent: [{ name, date, players, size, champ }] }.
    // A player is their name trimmed and lowercased, so Ayesha and ayesha are one person.
    const PT_RECENT = 20;
    const ptKey = name => String(name || '').trim().toLowerCase();
    function ptCabinetEmpty() { return { v: 1, titles: {}, recent: [] }; }
    function ptCabinetAdd(cab0, t) {
        const cab = cab0 && cab0.v === 1 && cab0.titles && Array.isArray(cab0.recent) ? JSON.parse(JSON.stringify(cab0)) : ptCabinetEmpty();
        const c = ptChampion(t);
        if (c === null || cab.recent.some(r => r.id === t.id)) return cab;
        const name = t.slots[c].name, k = ptKey(name);
        const row = cab.titles[k] || (cab.titles[k] = { name, 4: 0, 8: 0, 16: 0 });
        row.name = name;
        row[t.size]++;
        cab.recent.unshift({ id: t.id, name: t.name, date: Date.now(), players: t.slots.length, size: t.size, champ: name });
        cab.recent = cab.recent.slice(0, PT_RECENT);
        return cab;
    }
    function ptCabinetRows(cab) {
        return Object.keys((cab && cab.titles) || {}).map(k => {
            const r = cab.titles[k];
            return { name: r.name, 4: r[4] || 0, 8: r[8] || 0, 16: r[16] || 0, total: (r[4] || 0) + (r[8] || 0) + (r[16] || 0) };
        }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    }
