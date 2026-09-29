// The tournament model (pool-tour.js). `node pool-dev/tour-verify.js`
//
// Pure, so everything here is exact: every size from 3 to 16, where the byes go,
// the seeding order the design's brackets draw, a reproducible shuffle, frames
// and advancement to a champion, who breaks, match numbering, the run summary,
// saved-state validation, and the trophy cabinet.
const P = require('./load').tour();

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));
const NAMES = ['You', 'Ayesha', 'Bilal', 'Hamza', 'Sana', 'Usman', 'Zara', 'Omar', 'Hira', 'Faisal', 'Maryam', 'Ali', 'Noor', 'Saad', 'Iqra', 'Danish'];
const make = (n, extra) => P.ptCreate(Object.assign({ names: NAMES.slice(0, n), seed: 42, created: 0 }, extra));

// Plays a whole tournament: the upper line wins every frame unless `pick` says otherwise.
function playOut(t, pick) {
    let guard = 0, m;
    while ((m = P.ptNext(t)) && guard++ < 200) {
        const r = P.ptRecordFrame(t, m.id, pick ? pick(t, m) : m.a);
        t = r.t;
    }
    return t;
}

head('Sizes and byes');
{
    let bad = [];
    for (let n = 3; n <= 16; n++) {
        const t = make(n), S = n <= 4 ? 4 : n <= 8 ? 8 : 16;
        const r1 = t.matches.filter(m => m.round === 0);
        const byes = r1.filter(m => m.status === 'bye');
        const byeSeeds = byes.map(m => t.slots[m.a].seed).sort((a, b) => a - b);
        if (t.size !== S || t.matches.length !== S - 1 || byes.length !== S - n) bad.push(n + ': size/byes');
        if (byeSeeds.join() !== Array.from({ length: S - n }, (_, i) => i + 1).join()) bad.push(n + ': byes not to the top seeds ' + byeSeeds);
        if (r1.some(m => m.a === null && m.b === null)) bad.push(n + ': bye against bye');
        if (P.ptPlayable(t).length !== n - 1) bad.push(n + ': playable ' + P.ptPlayable(t).length);
        const champ = P.ptChampion(playOut(t));
        if (champ === null) bad.push(n + ': no champion');
    }
    ok('3–16 players: the bracket size, S − N byes, all to the top seeds, never bye against bye', !bad.length, bad.join('; '));
    ok('…and N − 1 matches to play, ending in a champion, for every size', !bad.length);
    let threw = 0;
    try { make(2); } catch (_) { threw++; }
    ok('fewer than 3 players is refused', threw === 1);
    ok('more than 16 names keeps the first 16', make(16, { names: NAMES.concat(['Extra', 'More']) }).slots.length === 16);
}

head('Seeding order');
{
    ok('order(8) = 1, 8, 5, 4, 3, 6, 7, 2', P.ptSeedOrder(8).join() === '1,8,5,4,3,6,7,2');
    ok('order(16) pairs 1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15 (the design\'s 16-player tree)',
       (() => { const o = P.ptSeedOrder(16), pairs = []; for (let i = 0; i < 16; i += 2) pairs.push(Math.min(o[i], o[i + 1]) + 'v' + Math.max(o[i], o[i + 1])); return pairs.join(); })() ===
       '1v16,8v9,5v12,4v13,3v14,6v11,7v10,2v15');
    const t = make(8);
    const r1 = t.matches.filter(m => m.round === 0).map(m => t.slots[m.a].seed + 'v' + t.slots[m.b].seed);
    ok('8 players: QF 1v8, 4v5, 3v6, 2v7, the better seed on the upper line', r1.join() === '1v8,4v5,3v6,2v7', r1.join());
    const six = make(6);
    const q = six.matches.filter(m => m.round === 0).map(m => m.status === 'bye' ? six.slots[m.a].seed + ' bye' : six.slots[m.a].seed + 'v' + six.slots[m.b].seed);
    ok('6 players: seeds 1 and 2 get the byes, 4v5 and 3v6 play (the design\'s City Open)', q.join() === '1 bye,4v5,3v6,2 bye', q.join());
    const sf = six.matches.filter(m => m.round === 1);
    ok('…and a bye advances at once: seed 1 already waits in SF 1, seed 2 in SF 2', six.slots[sf[0].a].seed === 1 && sf[0].b === null && six.slots[sf[1].b].seed === 2);
    ok('entry order is the seeding when shuffle is off', make(8).slots.map(s => s.name).join() === NAMES.slice(0, 8).join());
    const s1 = make(8, { settings: { shuffle: true } }), s2 = make(8, { settings: { shuffle: true } }), s3 = make(8, { seed: 43, settings: { shuffle: true } });
    ok('shuffle is reproducible: the same seed draws the same bracket', s1.slots.map(s => s.name).join() === s2.slots.map(s => s.name).join());
    ok('…and a different seed draws a different one', s1.slots.map(s => s.name).join() !== s3.slots.map(s => s.name).join());
    ok('the YOU tag follows the player through the shuffle', s1.slots.filter(s => s.you).length === 1 && s1.slots.find(s => s.you).name === 'You');
}

head('Rounds, races, names');
{
    ok('round names from the end: Round of 16, Quarter-final, Semi-final, Final',
       [0, 1, 2, 3].map(r => P.ptRoundName(4, r)).join() === 'Round of 16,Quarter-final,Semi-final,Final' && P.ptRoundName(2, 0) === 'Semi-final');
    ok('default races: 4 → 2, 3; 8 → 1, 2, 3; 16 → 1, 1, 2, 3',
       make(4).settings.race.join() === '2,3' && make(8).settings.race.join() === '1,2,3' && make(16).settings.race.join() === '1,1,2,3');
    ok('each match carries its round\'s race', make(8).matches.every(m => m.raceTo === [1, 2, 3][m.round]));
    ok('setup\'s race columns: Round 1 covers every round before the semi',
       JSON.stringify(P.ptRaceColumns(16)) === JSON.stringify([{ label: 'Round 1', rounds: [0, 1] }, { label: 'Semi', rounds: [2] }, { label: 'Final', rounds: [3] }]) &&
       P.ptRaceColumns(4).map(c => c.label).join() === 'Semi,Final' && P.ptRaceColumns(8)[0].label === 'Quarter');
    ok('default names by size: Club Cup, City Open, Masters; a given name wins',
       make(4).name === 'Club Cup' && make(8).name === 'City Open' && make(12).name === 'Masters' && make(5, { name: '  Friday Frames ' }).name === 'Friday Frames');
    ok('races are kept to 1–5', make(8, { settings: { race: [9, 0, 3] } }).settings.race.join() === '5,1,3');
}

head('Playing it out');
{
    let t = make(6);
    const first = P.ptNext(t);
    ok('play starts with the first round, left to right: QF 2 (4v5)', first.id === 'r0m1' && t.slots[first.a].seed === 4);
    ok('match numbering skips byes: match 1 of 5', JSON.stringify(P.ptMatchNumber(t, first)) === '{"n":1,"of":5}');
    ok('the lower seed breaks first, then breaks alternate', P.ptBreaker(t, first, 0) === first.b && P.ptBreaker(t, first, 1) === first.a && P.ptBreaker(t, first, 2) === first.b);
    const r = P.ptRecordFrame(t, first.id, first.b);
    ok('a frame is recorded without touching the old object (pure)', t.matches[1].frames.length === 0 && r.t.matches[1].frames.length === 1);
    ok('race to 1: one frame ends the match, and the winner goes up to SF 1\'s lower line',
       r.matchOver && r.winner === first.b && P.ptMatch(r.t, 1, 0).b === first.b);
    t = r.t;
    ok('a finished match takes no more frames', P.ptRecordFrame(t, first.id, first.a).t === t);
    ok('a frame for someone not in the match is refused', P.ptRecordFrame(t, 'r0m2', 0).t === t);
    // Semi-finals are race to 2: 2–1.
    t = P.ptRecordFrame(t, 'r0m2', P.ptById(t, 'r0m2').a).t;
    const sf1 = P.ptNext(t);
    ok('the semi-finals wait until the quarter-finals are done', sf1.round === 1 && sf1.index === 0);
    t = P.ptRecordFrame(t, sf1.id, sf1.a).t;
    ok('race to 2: 1–0 is not a result yet', P.ptById(t, sf1.id).status === 'live' && P.ptScore(P.ptById(t, sf1.id)).join() === '1,0');
    t = P.ptRecordFrame(t, sf1.id, sf1.b).t;
    const done = P.ptRecordFrame(t, sf1.id, sf1.a);
    ok('2–1 is', done.matchOver && P.ptScore(P.ptById(done.t, sf1.id)).join() === '2,1');
    t = playOut(done.t);
    const c = P.ptChampion(t);
    ok('played out, there is one champion and nobody else is still in', c !== null && t.slots.every((s, i) => i === c || P.ptOut(t, i) !== null));
    const run = P.ptRun(t, 0);
    ok('the champion\'s run: a bye, then beat … in each round (seed 1 in a 6-player bracket)',
       run[0].kind === 'bye' && run[0].text === 'Bye as top seed' && run.slice(1).every(x => x.kind === 'won' && /^beat /.test(x.text)), run);
    const fr = P.ptFrames(t, 0);
    ok('frames won and lost add up across the rounds', fr.won >= 5 && fr.lost >= 0);
    const loser = t.slots.findIndex((s, i) => i !== c && P.ptOut(t, i) === 2);
    ok('the finalist\'s run ends with the final it lost', loser >= 0 && P.ptRun(t, loser).slice(-1)[0].kind === 'lost');
}

head('Saved state');
{
    const t = make(8);
    ok('a fresh tournament validates, and so does its JSON round trip', P.ptValidate(t) === t && !!P.ptValidate(JSON.parse(JSON.stringify(t))));
    const bad = [
        ['another version', Object.assign({}, t, { v: 2 })],
        ['not an object', 'nope'],
        ['a missing match', Object.assign({}, t, { matches: t.matches.slice(1) })],
        ['a slot out of range', Object.assign({}, t, { matches: t.matches.map((m, i) => (i ? m : Object.assign({}, m, { a: 99 }))) })],
        ['a bad status', Object.assign({}, t, { matches: t.matches.map((m, i) => (i ? m : Object.assign({}, m, { status: 'odd' }))) })],
        ['a size that is not 4/8/16', Object.assign({}, t, { size: 6 })],
        ['null', null],
    ];
    ok('anything else is refused whole: ' + bad.map(b => b[0]).join(', '), bad.every(b => P.ptValidate(b[1]) === null), bad.filter(b => P.ptValidate(b[1]) !== null).map(b => b[0]));
}

head('Trophy cabinet');
{
    let cab = P.ptCabinetEmpty();
    const a = playOut(make(4, { names: ['Ayesha', 'Bilal', 'Sana'], seed: 1 }));
    const b = playOut(make(8, { names: ['ayesha ', 'Bilal', 'Sana', 'Zara', 'Omar'], seed: 2 }));
    cab = P.ptCabinetAdd(cab, a);
    cab = P.ptCabinetAdd(cab, a);
    ok('a title is added once per tournament', cab.recent.length === 1);
    cab = P.ptCabinetAdd(cab, b);
    const rows = P.ptCabinetRows(cab);
    ok('names are one person trimmed and lowercased (Ayesha, ayesha)', rows.length === 1 && rows[0].total === 2 && rows[0][4] === 1 && rows[0][8] === 1, rows);
    ok('recent keeps the newest first', cab.recent[0].id === b.id && cab.recent[0].players === 5 && cab.recent[0].size === 8);
    let many = P.ptCabinetEmpty();
    for (let i = 0; i < 25; i++) many = P.ptCabinetAdd(many, playOut(make(3, { seed: 100 + i })));
    ok('…and the last 20 only', many.recent.length === 20);
    ok('an unfinished tournament adds nothing', P.ptCabinetAdd(P.ptCabinetEmpty(), make(4)).recent.length === 0);
    ok('a broken cabinet starts over rather than throwing', P.ptCabinetAdd({ v: 7 }, a).recent.length === 1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
