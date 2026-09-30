// The sync bot (github-actions-bot/.github/workflows/sync.yml), run headless.
//
//   node pool-dev/sync-verify.js
//
// The bot's logic is an inline actions/github-script block. This lifts that block
// out of the YAML verbatim and runs it as the action would (an async function of
// core, fetch and process), against an in-memory gist, so what is tested is what
// ships. It covers the gameModeBests merge Pool v2's tier boards need (Phase 8):
// shape validation, the monotonic per-key merge, and the tier-win growth bound,
// plus the gates that were already there (build token, XP budget, counters), and
// snooker's (S6): its tier and mode bounds, and the high break's 155 cap and session rule.
//
// The bot lives in its own repository, checked out beside this one; without it
// the suite says so and passes, as there is nothing to test.
const fs = require('fs'), path = require('path');

const YML = path.join(__dirname, '..', 'github-actions-bot', '.github', 'workflows', 'sync.yml');
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));

if (!fs.existsSync(YML)) {
    console.log('  · github-actions-bot/ is not checked out beside this repo; nothing to test');
    console.log('\n0 passed, 0 failed');
    process.exit(0);
}

// ── The script, lifted from the YAML ──────────────────────────────────
const lines = fs.readFileSync(YML, 'utf8').replace(/\r\n/g, '\n').split('\n');
const at = lines.findIndex(l => /^\s+script: \|\s*$/.test(l));
const indent = lines[at + 1].match(/^ */)[0].length;
const body = [];
for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() && l.match(/^ */)[0].length < indent) break;
    body.push(l.slice(indent));
}
const SCRIPT = body.join('\n');
// The release label the workflow stamps (its env block), and the userscript's own.
const LABEL = ((lines.find(l => /^\s+BUILD_LABEL_CURRENT:/.test(l)) || '').split(':')[1] || '').trim();
const HOST_LABEL = (fs.readFileSync(path.join(__dirname, '..', 'AttendanceTimeCheckerPlus.js'), 'utf8').match(/const BUILD_LABEL = '(v\d+)'/) || [])[1];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const FILE = 'attendance_widget_registry.json';

// One dispatch against a gist holding `players`. Returns what was written and what was logged.
async function dispatch(payload, players, opts) {
    const o = opts || {};
    const log = { warnings: [], notices: [], infos: [], failed: null, written: null };
    const core = {
        warning: m => log.warnings.push(String(m)), notice: m => log.notices.push(String(m)),
        info: m => log.infos.push(String(m)), setFailed: m => { log.failed = String(m); },
    };
    const gist = { lastUpdated: 'x', players: JSON.parse(JSON.stringify(players || [])) };
    const fetch = async (url, init) => {
        if (!init || !init.method || init.method === 'GET') return { ok: true, json: async () => ({ files: { [FILE]: { content: JSON.stringify(gist) } } }) };
        log.written = JSON.parse(JSON.parse(init.body).files[FILE].content);
        return { ok: true, text: async () => '' };
    };
    const env = Object.assign({
        GIST_PAT: 'pat', ADMIN_KEY: 'admin', BUILD_TOKEN_CURRENT: 'tok-now', BUILD_TOKEN_PREVIOUS: 'tok-old', BUILD_LABEL_CURRENT: LABEL,
        GIST_ID: 'gist', GIST_FILE: FILE, EVENT_TYPE: o.event || 'registry-update', PAYLOAD: JSON.stringify(payload),
    }, o.env);
    await new AsyncFunction('core', 'fetch', 'process', SCRIPT)(core, fetch, { env });
    log.player = id => log.written && log.written.players.find(p => p.clientId === id);
    return log;
}
const DAY = 86400000;
// A stored record synced an hour ago, and the same player's next sync: `games` more sessions.
function stored(gmb, extra) {
    return Object.assign({ clientId: 'c1', displayName: 'Ayesha', totalXP: 5000, gameSessions: 100, totalWorkDays: 20, longestStreak: 5,
        achievements: [], serverSync: new Date(Date.now() - DAY / 24).toISOString() }, gmb === undefined ? {} : { gameModeBests: gmb }, extra);
}
function next(gmb, games, extra) {
    return Object.assign({ clientId: 'c1', displayName: 'Ayesha', totalXP: 5000 + 80 * (games || 0), gameSessions: 100 + (games || 0), totalWorkDays: 20, longestStreak: 5,
        achievements: [] }, gmb === undefined ? {} : { gameModeBests: gmb }, extra);
}
const send = (player, players, opts) => dispatch({ player, build_token: 'tok-now' }, players, opts);

(async () => {
    head('The script');
    ok('the inline github-script block is lifted out of sync.yml', SCRIPT.length > 2000 && /mergeSinglePlayer/.test(SCRIPT), SCRIPT.length + ' chars');
    ok('it declares the gameModeBests merge', /function mergeModeBests\(/.test(SCRIPT) && /function cleanModeBests\(/.test(SCRIPT));

    head('Gates that were already there');
    let r = await dispatch({ player: next({}, 0), build_token: 'wrong' }, [stored({})]);
    ok('an unknown build token writes nothing', r.written === null && r.warnings.some(w => /Build token mismatch/.test(w)));
    r = await dispatch({ player: next({}, 1), build_token: 'tok-old' }, [stored({})]);
    ok('the previous token is still accepted (the grace window)', !!r.player('c1'));
    r = await send(next({}, 0, { totalXP: 900000 }), [stored({})]);
    ok('an XP gain past the budget flags the player', r.player('c1').flagged === true && /xp_budget/.test(r.player('c1').flagReason));
    r = await send(next({}, 0, { gameSessions: 50, totalWorkDays: 3 }), [stored({})]);
    ok('monotonic counters cannot go back', r.player('c1').gameSessions === 100 && r.player('c1').totalWorkDays === 20);
    ok('the build label is stamped', r.written.latestBuild === LABEL);
    ok('the workflow stamps the label the userscript carries (' + HOST_LABEL + '), set in the file, not a secret', /^v\d+$/.test(LABEL) && LABEL === HOST_LABEL, LABEL + ' vs ' + HOST_LABEL);

    head('gameModeBests: shape');
    r = await send(next({ 'pool:hard': 3, 'POOL:hard': 9, 'pool:': 1, 'pool:hard:x': 1, 'snake:walled': -4, 'aim:x': 1.5, 'pool:pro': '7', 'tetris:x': null, 'reflex:screen': 187.25 }, 3), [stored({})]);
    const g1 = r.player('c1').gameModeBests;
    ok('game:mode keys with whole, non-negative numbers are kept', g1['pool:hard'] === 3);
    ok('malformed keys are dropped', !('POOL:hard' in g1) && !('pool:' in g1) && !('pool:hard:x' in g1), Object.keys(g1));
    ok('negative, fractional, string and null values are dropped', !('snake:walled' in g1) && !('aim:x' in g1) && !('pool:pro' in g1) && !('tetris:x' in g1));
    ok('RefleX milliseconds may be fractional', g1['reflex:screen'] === 187.25);
    r = await send(next(['pool:hard'], 1), [stored({ 'pool:hard': 2 })]);
    ok('an array in place of the object stores nothing new and keeps what was there', r.player('c1').gameModeBests['pool:hard'] === 2 && Object.keys(r.player('c1').gameModeBests).length === 1);

    head('gameModeBests: merged per key, never replaced');
    const before = { 'pool:cpu': 40, 'pool:pvp': 3, 'pool:hard': 5, 'ludo:easy': 2, 'snake:walled': 97, 'reflex:screen': 198 };
    r = await send(next({ 'pool:cpu': 41, 'pool:pvp': 3, 'snake:walled': 90, 'reflex:screen': 240 }, 1), [stored(before)]);
    const g2 = r.player('c1').gameModeBests;
    ok('a key the client leaves out is kept (an outdated tab cannot erase Pool\'s tiers)', g2['pool:hard'] === 5 && g2['ludo:easy'] === 2, g2);
    ok('counts and scores keep the larger value', g2['pool:cpu'] === 41 && g2['snake:walled'] === 97);
    ok('RefleX keeps the smaller (better) time', g2['reflex:screen'] === 198);
    r = await send(next({ 'reflex:screen': 181 }, 1), [stored(before)]);
    ok('…and takes a better one', r.player('c1').gameModeBests['reflex:screen'] === 181);
    r = await send(next({ 'reflex:target': 0 }, 1), [stored({ 'reflex:target': 250 })]);
    ok('a RefleX 0 (never scored) does not replace a real time', r.player('c1').gameModeBests['reflex:target'] === 250);
    r = await send(next(undefined, 1), [stored(before)]);
    ok('a client that sends no gameModeBests keeps the stored ones', JSON.stringify(r.player('c1').gameModeBests) === JSON.stringify(before));
    r = await send(next(undefined, 1), [stored(undefined)]);
    ok('with neither side carrying them the field stays absent (gameBests keeps the boards)', !('gameModeBests' in r.player('c1')));
    r = await send(next({ 'pool:hard': 2 }, 0), []);
    ok('a new player is stored as sent', r.player('c1').gameModeBests['pool:hard'] === 2);

    head('gameModeBests: tier wins grow by games played');
    r = await send(next({ 'pool:easy': 1, 'pool:hard': 7 }, 3), [stored({ 'pool:hard': 5 })]);
    ok('three games, three tier wins: accepted', r.player('c1').gameModeBests['pool:hard'] === 7 && r.player('c1').gameModeBests['pool:easy'] === 1 && !r.warnings.some(w => /clamp/.test(w)));
    r = await send(next({ 'pool:easy': 2, 'pool:hard': 7 }, 3), [stored({ 'pool:hard': 5 })]);
    const g3 = r.player('c1').gameModeBests;
    ok('four tier wins in three games: the pool tiers go back to what was stored', g3['pool:hard'] === 5 && !('pool:easy' in g3), g3);
    ok('…with a warning, and the player is not flagged', r.warnings.some(w => /gameModeBests clamp for Ayesha: pool tier wins \+4 vs 3 games/.test(w)) && !r.player('c1').flagged);
    r = await send(next({ 'pool:pro': 50, 'ludo:hard': 1 }, 1), [stored({ 'pool:pro': 0, 'ludo:hard': 0 })]);
    ok('each game is bounded on its own: Ludo\'s one win stands while Pool\'s fifty go', r.player('c1').gameModeBests['ludo:hard'] === 1 && r.player('c1').gameModeBests['pool:pro'] === 0);
    r = await send(next({ 'pool:pro': 9 }, 0, { gameSessions: 90 }), [stored({ 'pool:pro': 2 })]);
    ok('a rewound session count buys no wins', r.player('c1').gameModeBests['pool:pro'] === 2);
    r = await send(next({ 'pool:cpu': 400, 'pool:hard': 12 }, 0), [stored(undefined)]);
    ok('a record adopting gameModeBests for the first time is not bounded (nothing to grow from)', r.player('c1').gameModeBests['pool:hard'] === 12 && r.player('c1').gameModeBests['pool:cpu'] === 400);
    r = await send(next({ 'pool:cpu': 400 }, 0), [stored({ 'pool:cpu': 10 })]);
    ok('the all-time and hot-seat counters are not tier keys, so the bound leaves them to the max merge', r.player('c1').gameModeBests['pool:cpu'] === 400);

    head('Snooker (S6): its bounds, the 155 cap, the session rule');
    r = await send(next({ 'snooker:pro': 1, 'snooker:hard': 2, 'snooker:cpu': 3 }, 3), [stored({ 'pool:hard': 5 })]);
    ok('three games, three snooker tier wins (and the all-time count with them): accepted',
       r.player('c1').gameModeBests['snooker:pro'] === 1 && r.player('c1').gameModeBests['snooker:cpu'] === 3 && !r.warnings.some(w => /clamp/.test(w)));
    r = await send(next({ 'snooker:easy': 3, 'snooker:pro': 2 }, 4), [stored({ 'snooker:easy': 1 })]);
    ok('snooker\'s tier wins are bounded by games played: +3 in 4 games stands', r.player('c1').gameModeBests['snooker:pro'] === 2);
    r = await send(next({ 'snooker:easy': 3, 'snooker:pro': 2 }, 2), [stored({ 'snooker:easy': 1 })]);
    ok('…+3 in 2 games goes back to what was stored', r.player('c1').gameModeBests['snooker:easy'] === 1 && !('snooker:pro' in r.player('c1').gameModeBests) && !r.player('c1').flagged);
    r = await send(next({ 'snooker:cpu': 6, 'snooker:pvp': 4 }, 3), [stored({ 'snooker:cpu': 2, 'snooker:pvp': 1 })]);
    ok('…and so are its all-time and hot-seat wins, together (+7 in 3 games)', r.player('c1').gameModeBests['snooker:cpu'] === 2 && r.player('c1').gameModeBests['snooker:pvp'] === 1);
    r = await send(next({ 'pool:cpu': 400 }, 0), [stored({ 'pool:cpu': 10 })]);
    ok('pool\'s all-time count is still left to the max merge (its older wins)', r.player('c1').gameModeBests['pool:cpu'] === 400);
    r = await send(next({ 'snooker:highBreak': 147 }, 1), [stored({ 'snooker:highBreak': 64 })]);
    ok('a high break of 147 after a game: kept', r.player('c1').gameModeBests['snooker:highBreak'] === 147);
    r = await send(next({ 'snooker:highBreak': 155 }, 1), [stored({})]);
    ok('155 (a free ball on 15 reds) is the most there is: kept', r.player('c1').gameModeBests['snooker:highBreak'] === 155);
    r = await send(next({ 'snooker:highBreak': 156 }, 1), [stored({ 'snooker:highBreak': 64 })]);
    ok('156 is dropped, and the stored 64 stays', r.player('c1').gameModeBests['snooker:highBreak'] === 64);
    r = await send(next({ 'snooker:highBreak': 900 }, 0), []);
    ok('…a new player cannot bring one in either', !('snooker:highBreak' in (r.player('c1').gameModeBests || {})));
    r = await send(next({ 'snooker:highBreak': 120 }, 0), [stored({ 'snooker:highBreak': 64 })]);
    ok('with no game played the high break cannot rise', r.player('c1').gameModeBests['snooker:highBreak'] === 64 && r.warnings.some(w => /snooker:highBreak rose with no game played/.test(w)) && !r.player('c1').flagged);
    r = await send(next({ 'snooker:highBreak': 120 }, 0), [stored({ 'pool:hard': 5 })]);
    ok('…nor appear, on a record that already has gameModeBests', !('snooker:highBreak' in r.player('c1').gameModeBests));
    r = await send(next({ 'snooker:highBreak': 30 }, 0), [stored({ 'snooker:highBreak': 64 })]);
    ok('a lower one (an old tab) keeps the stored best', r.player('c1').gameModeBests['snooker:highBreak'] === 64);

    head('The legacy whole-registry payload');
    r = await dispatch({ registry: { players: [next({ 'pool:easy': 1 }, 1)] }, build_token: 'tok-now' }, [stored({ 'pool:hard': 5 })]);
    ok('it merges gameModeBests the same way', r.player('c1').gameModeBests['pool:hard'] === 5 && r.player('c1').gameModeBests['pool:easy'] === 1);

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('✗ ' + (e.stack || e)); process.exit(1); });
