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
// snooker's (S6): its tier and mode bounds, and the high break's 155 cap and session rule;
// Game Mode's access keys: one use each, rotating, surviving every other write; and progress
// recovery: set once, changed only with the current proof, out of reach of ordinary syncs; and
// login (name + password, checked against a private store): enrol, log in, rest, change, reset;
// and Plus in the cloud: no licensed browser's secret, no leaderboard, password or recovery.
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
const UNLOCK = 'test-unlock-secret-0123456789abcdef';
const { keyFor } = require('../tools/games-key');
// By default every dispatch comes from a licensed (Plus) browser: its secret rides along as plus
// and its tag is listed in the gist. opts.noPlus sends none.
const PLUS = 'f'.repeat(64), PLUS_TAG = require('crypto').createHash('sha256').update(PLUS).digest('hex').slice(0, 32);
const FILE = 'attendance_widget_registry.json';

// One dispatch against a gist holding `players`. Returns what was written and what was logged.
// What readers see (the widget, the pool server): the board, with the account files over the
// older fields. The bot's own accountsView must agree with this.
function viewOf(files) {
    const parse = (raw, fb) => { try { return JSON.parse(raw); } catch { return fb; } };
    const reg = parse(files[FILE], { players: [] }), legacy = reg.gamesUnlock || {};
    const tags = Object.assign({}, legacy.tags || {}), grants = Object.assign({}, legacy.grants || {}), accts = {};
    let n = Number.isInteger(legacy.n) ? legacy.n : 0;
    for (const [name, raw] of Object.entries(files)) {
        let m;
        if ((m = /^plus-([0-9a-f]{32})\.json$/.exec(name))) { const d = parse(raw, null); if (!d || d.revoked) { delete tags[m[1]]; delete grants[m[1]]; } else { tags[m[1]] = d; if (d.grant) grants[m[1]] = d.grant; } }
        else if (name === 'keys.json') { const d = parse(raw, {}); if (Number.isInteger(d.n) && d.n > n) n = d.n; }
        else if (/^acct-.+\.json$/.test(name)) { const d = parse(raw, null); if (d && d.clientId) accts[d.clientId] = d; }
    }
    const players = (reg.players || []).map(p => { const x = accts[p.clientId]; return x ? Object.assign({}, p, { login: !!x.login }, x.loginAt ? { loginAt: x.loginAt } : {}, x.name ? { displayName: x.name } : {}) : p; });
    return Object.assign({}, reg, { players, gamesUnlock: { n, tags, grants } });
}
// The private store as one object again: { logins: { lowercase name: entry } } (reset names gone).
function loginsOf(files) {
    const parse = (raw, fb) => { try { return JSON.parse(raw); } catch { return fb; } };
    const out = { logins: Object.assign({}, (parse(files['logins.json'], {}) || {}).logins || {}) };
    for (const [name, raw] of Object.entries(files)) {
        if (!/^l-[0-9a-f]{24}\.json$/.test(name)) continue;
        const d = parse(raw, null);
        if (!d) continue;
        const key = d.name ? String(d.name).trim().replace(/\s+/g, ' ').toLowerCase() : null;
        if (d.reset) { for (const k of Object.keys(out.logins)) if (require('crypto').createHash('sha256').update(k).digest('hex').slice(0, 24) === name.slice(2, 26)) delete out.logins[k]; }
        else if (key) out.logins[key] = d;
    }
    return out;
}

// One dispatch against a gist holding `players` (and opts.gist's extra fields, opts.files beside
// it), and the private login store (opts.logins: the older one-file shape; opts.loginFiles).
// Returns what was written and logged: written is the merged view, if anything public was written.
async function dispatch(payload, players, opts) {
    const o = opts || {};
    if (!o.noPlus && payload && payload.plus === undefined) payload = Object.assign({}, payload, { plus: PLUS });
    const log = { warnings: [], notices: [], infos: [], failed: null, written: null, patches: [] };
    const core = {
        warning: m => log.warnings.push(String(m)), notice: m => log.notices.push(String(m)),
        info: m => log.infos.push(String(m)), setFailed: m => { log.failed = String(m); },
        setSecret: m => { log.secrets = (log.secrets || []).concat(String(m)); },
    };
    const gist = Object.assign({ lastUpdated: 'x', players: JSON.parse(JSON.stringify(players || [])) }, o.gist ? JSON.parse(JSON.stringify(o.gist)) : {});
    if (!o.noPlus) { gist.gamesUnlock = gist.gamesUnlock || { n: 0, tags: {} }; gist.gamesUnlock.tags = Object.assign({ [PLUS_TAG]: { at: 'x', n: 0 } }, gist.gamesUnlock.tags || {}); }
    const pub = Object.assign({ [FILE]: JSON.stringify(gist) }, o.files || {});
    const priv = Object.assign({ 'logins.json': JSON.stringify(o.logins || { logins: {} }) }, o.loginFiles || {});
    let wrotePub = false, wrotePriv = false;
    const fetch = async (url, init) => {
        const store = /logins-gist/.test(url) ? priv : pub;
        if (!init || !init.method || init.method === 'GET') {
            const files = {};
            for (const [name, content] of Object.entries(store)) files[name] = { content };
            return { ok: true, json: async () => ({ files }) };
        }
        const body = JSON.parse(init.body);
        for (const [name, file] of Object.entries(body.files)) { if (file === null) delete store[name]; else store[name] = file.content; }
        if (store === priv) wrotePriv = true;
        else { log.patches.push(Object.keys(body.files)); if (Object.keys(body.files).some(n => !/^status-/.test(n))) wrotePub = true; }
        return { ok: true, text: async () => '' };
    };
    const env = Object.assign({
        GIST_PAT: 'pat', ADMIN_KEY: 'admin', BUILD_TOKEN_CURRENT: 'tok-now', BUILD_TOKEN_PREVIOUS: 'tok-old', BUILD_LABEL_CURRENT: LABEL,
        GIST_ID: 'gist', GIST_FILE: FILE, EVENT_TYPE: o.event || 'registry-update', PAYLOAD: o.context ? '' : JSON.stringify(payload), UNLOCK_SECRET: UNLOCK, LOGIN_GIST_ID: 'logins-gist',
    }, o.env);
    // github-script hands the script require() as well.
    // o.context: the payload as the real action reads it (context.payload.client_payload).
    let thrown = null;
    try { await new AsyncFunction('core', 'fetch', 'process', 'require', 'context', SCRIPT)(core, fetch, { env }, require, o.context ? { payload: { client_payload: payload } } : undefined); }
    catch (e) { thrown = e; }
    if (wrotePub) log.written = viewOf(pub);
    if (wrotePriv) log.logins = loginsOf(priv);
    log.files = pub;
    log.status = tag => { try { return JSON.parse(pub['status-' + tag + '.json']); } catch { return null; } };
    log.player = id => log.written && log.written.players.find(p => p.clientId === id);
    if (thrown) { log.thrown = thrown; if (!o.catch) throw thrown; }
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

    head('Game Mode access keys');
    const TAG = 'a'.repeat(32), TAG2 = 'b'.repeat(32);
    const unlock = (tag, key, gist, extra) => dispatch(Object.assign({ tag, key, build_token: 'tok-now' }, extra), [stored({})], { event: 'games-unlock', gist });
    const k0 = keyFor(UNLOCK, 0), k1 = keyFor(UNLOCK, 1);
    ok('keys are 16 Crockford base32 characters, and differ by n', /^[0-9A-HJKMNP-TV-Z]{16}$/.test(k0) && k0 !== k1);
    r = await unlock(TAG, k0.match(/.{4}/g).join('-').toLowerCase());
    ok('key #0 (dashed, any case) unlocks the tag and moves the counter to #1',
        r.written && r.written.gamesUnlock.n === 1 && !!r.written.gamesUnlock.tags[TAG] && r.written.gamesUnlock.tags[TAG].n === 0);
    ok('…and the key is masked in the logs', (r.secrets || []).includes(k0));
    const after = { gamesUnlock: r.written.gamesUnlock };
    r = await unlock(TAG2, k0, after);
    ok('key #0 again: rejected, nothing written (one use)', r.written === null && r.warnings.some(w => /key rejected/.test(w)));
    r = await unlock(TAG2, k1, after);
    ok('key #1 is the next one, for the next browser', r.written && r.written.gamesUnlock.n === 2 && !!r.written.gamesUnlock.tags[TAG2] && !!r.written.gamesUnlock.tags[TAG]);
    r = await unlock(TAG2, keyFor(UNLOCK, 2), after);
    ok('a key from further ahead does not work yet', r.written === null);
    r = await unlock(TAG, k1, after);
    ok('an unlocked browser does not use up the key it sends', r.written === null && r.infos.some(m => /already unlocked/.test(m)));
    r = await unlock(TAG2, 'ZZZZZZZZZZZZZZZZ');
    ok('a wrong key writes nothing', r.written === null);
    r = await unlock('not-a-tag', k0);
    ok('a malformed tag is refused', r.written === null && r.warnings.some(w => /malformed/.test(w)));
    r = await unlock(TAG, 'short');
    ok('…and a malformed key', r.written === null && r.warnings.some(w => /malformed/.test(w)));
    r = await unlock(TAG, k0, null, { build_token: 'wrong' });
    ok('the build-token gate applies', r.written === null && r.warnings.some(w => /Build token mismatch/.test(w)));
    r = await dispatch({ tag: TAG, key: k0, build_token: 'tok-now' }, [], { event: 'games-unlock', env: { UNLOCK_SECRET: '' } });
    ok('with no UNLOCK_SECRET configured nothing unlocks', r.written === null && /UNLOCK_SECRET/.test(r.failed || ''));
    r = await dispatch({ player: next({}, 1), build_token: 'tok-now' }, [stored({})], { gist: after });
    ok('a leaderboard sync keeps every unlock and the counter', r.written.gamesUnlock && r.written.gamesUnlock.n === 1 && !!r.written.gamesUnlock.tags[TAG]);
    r = await dispatch({ registry: { players: [next({}, 1)] }, build_token: 'tok-now' }, [stored({})], { gist: after });
    ok('…the legacy whole-registry sync too', r.written.gamesUnlock && r.written.gamesUnlock.n === 1);
    r = await dispatch({ tag: TAG, build_token: 'tok-now' }, [], { event: 'admin-games-revoke', gist: after });
    ok('revoke needs the admin key', r.written === null && /admin_key invalid/.test(r.failed || ''));
    r = await dispatch({ tag: TAG, admin_key: 'admin', build_token: 'tok-now' }, [], { event: 'admin-games-revoke', gist: after });
    ok('…with it, the browser is locked again; the counter stays', r.written && !r.written.gamesUnlock.tags[TAG] && r.written.gamesUnlock.n === 1);
    r = await dispatch({ admin_key: 'admin', build_token: 'tok-now' }, [], { event: 'admin-games-rotate', gist: after });
    ok('rotate kills the current key: #1 is skipped, #2 is current', r.written && r.written.gamesUnlock.n === 2);
    r = await dispatch({ build_token: 'tok-now' }, [], { event: 'admin-games-rotate', gist: after });
    ok('…and needs the admin key', r.written === null && /admin_key invalid/.test(r.failed || ''));
    {
        // The userscript derives keys on WebCrypto for atcAdminGamesKey: lifted out, it agrees with the bot.
        const host = fs.readFileSync(path.join(__dirname, '..', 'AttendanceTimeCheckerPlus.js'), 'utf8').replace(/\r\n/g, '\n');
        const from = host.indexOf('    async function gamesKeyFor(secret, n) {'), to = host.indexOf('\n    }\n', from);
        const alpha = (host.match(/const GAMES_ALPHA = '([0-9A-Z]+)';/) || [])[1];
        const clientKeyFor = from > 0 && to > from && alpha ? new Function('GAMES_ALPHA', host.slice(from, to + 6) + '\nreturn gamesKeyFor;')(alpha) : null;
        let same = !!clientKeyFor;
        for (let n = 0; same && n <= 5; n++) same = (await clientKeyFor(UNLOCK, n)) === keyFor(UNLOCK, n);
        ok('the userscript\'s keys match the bot\'s, #0 to #5', same);
        const botFrom = SCRIPT.indexOf('function gamesKeyFor(secret, n) {');
        const botKeyFor = new Function('require', 'GAMES_ALPHA', SCRIPT.slice(botFrom, SCRIPT.indexOf('\n}\n', botFrom) + 2) + '\nreturn gamesKeyFor;')(require, alpha);
        ok('…and tools/games-key.js derives them as the bot does', [0, 1, 7, 42].every(n => botKeyFor(UNLOCK, n) === keyFor(UNLOCK, n)));
    }

    head('Progress recovery');
    {
        // The browser's derivation (atcSetRecovery), in Node: lookup and verifier from code + password.
        const nc = require('crypto');
        const sha = v => nc.createHash('sha256').update(v).digest('hex');
        const make = (code, pw, salt) => {
            const proof = nc.pbkdf2Sync(pw, salt + ':' + code, 100000, 32, 'sha256').toString('hex');
            return { proof, rec: { v: 1, lookup: sha('atc-rcv-lookup:' + code).slice(0, 32), salt, verifier: sha(proof), it: 100000 } };
        };
        const A = make('ABCDEFGHJKMNPQRS', 'hunter22', '1'.repeat(32)), B = make('TVWXYZ0123456789', 'swordfish', '2'.repeat(32));
        const setRcv = (players, extra) => dispatch(Object.assign({ client_id: 'c1', build_token: 'tok-now' }, extra), players, { event: 'recovery-set' });
        r = await setRcv([stored({})], { recovery: A.rec });
        ok('a first recovery is stored on the record, stamped', r.player('c1').recovery && r.player('c1').recovery.lookup === A.rec.lookup && !!r.player('c1').recovery.setAt);
        const withA = [stored({}, { recovery: Object.assign({ setAt: 'x' }, A.rec) })];
        r = await setRcv(withA, { recovery: B.rec });
        ok('a second one without the current proof is refused', r.written === null && r.warnings.some(w => /already has a recovery/.test(w)));
        r = await setRcv(withA, { recovery: B.rec, old_proof: B.proof });
        ok('…and with a wrong proof', r.written === null);
        r = await setRcv(withA, { recovery: B.rec, old_proof: A.proof });
        ok('with the current proof it is replaced, and the proof is masked in the logs', r.player('c1').recovery.lookup === B.rec.lookup && (r.secrets || []).includes(A.proof));
        r = await setRcv([stored({})], { recovery: Object.assign({}, A.rec, { it: 1000 }) });
        ok('too few PBKDF2 rounds are refused', r.written === null && r.warnings.some(w => /malformed/.test(w)));
        r = await setRcv([stored({})], { recovery: Object.assign({}, A.rec, { verifier: 'xyz' }) });
        ok('…and a malformed verifier', r.written === null);
        r = await setRcv([stored({})], { client_id: 'nobody', recovery: A.rec });
        ok('…and an unknown player', r.written === null && r.warnings.some(w => /no player/.test(w)));
        r = await setRcv([stored({}), stored({}, { clientId: 'c2', recovery: A.rec })], { recovery: A.rec });
        ok('…and a code another player already uses', r.written === null && r.warnings.some(w => /already in use/.test(w)));
        r = await setRcv(withA, { recovery: B.rec, old_proof: A.proof, build_token: 'wrong' });
        ok('the build-token gate applies', r.written === null);
        r = await send(next({}, 1), withA);
        ok('a sync that leaves recovery out keeps it', r.player('c1').recovery && r.player('c1').recovery.lookup === A.rec.lookup);
        r = await send(next({}, 1, { recovery: B.rec }), withA);
        ok('a sync cannot replace it', r.player('c1').recovery.lookup === A.rec.lookup);
        r = await send(next({}, 1, { recovery: B.rec }), [stored({})]);
        ok('…nor bring one in', !r.player('c1').recovery);
        r = await send(Object.assign(next({}, 0), { clientId: 'c9', recovery: B.rec }), []);
        ok('…nor a new record', !r.player('c9').recovery);
        r = await dispatch({ registry: { players: [next({}, 1, { recovery: B.rec })] }, build_token: 'tok-now' }, withA);
        ok('…nor the legacy whole-registry sync', r.player('c1').recovery.lookup === A.rec.lookup);
        r = await dispatch({ client_id: 'c1', build_token: 'tok-now' }, withA, { event: 'admin-recovery-clear' });
        ok('clearing it needs the admin key', r.written === null && /admin_key invalid/.test(r.failed || ''));
        r = await dispatch({ client_id: 'c1', admin_key: 'admin', build_token: 'tok-now' }, withA, { event: 'admin-recovery-clear' });
        ok('…with it, the record has none, and a new one can be set', r.player('c1') && !r.player('c1').recovery);
    }

    head('Login: name + password');
    {
        const nc = require('crypto');
        // What the browser sends: PBKDF2(password, 'atc-login:' + lowercase name), never the password.
        const pwOf = (name, password) => nc.pbkdf2Sync(password, 'atc-login:' + name.toLowerCase(), 100000, 32, 'sha256').toString('hex');
        const TAG = 'c'.repeat(32), NEW_TAG = 'd'.repeat(32), PW = pwOf('Hann', 'pool-shark-7');
        const unlocked = { gamesUnlock: { n: 1, tags: { [TAG]: { at: 'x', n: 0 } } } };
        const me = extra => [stored({}, Object.assign({ displayName: 'Hann' }, extra))];
        const call = (event, payload, players, opts) => dispatch(Object.assign({ build_token: 'tok-now' }, payload), players, Object.assign({ event, context: true }, opts));

        r = await call('login-enroll', { client_id: 'c1', tag: TAG, name: 'Hann', pw: PW }, me(), { gist: unlocked, noPlus: true });
        ok('enrolling needs a Plus browser: a listed tag quoted without its secret is not enough', r.written === null && r.warnings.some(w => /no Plus license/.test(w)));
        r = await call('login-enroll', { client_id: 'nobody', tag: TAG, name: 'Hann', pw: PW }, me(), { gist: unlocked });
        ok('…and a player on the board', r.written === null && r.warnings.some(w => /no player/.test(w)));
        r = await call('login-enroll', { client_id: 'c1', tag: TAG, name: 'Hann', pw: 'not-a-hash' }, me(), { gist: unlocked });
        ok('…and a hashed password, never a raw one', r.written === null && r.warnings.some(w => /malformed/.test(w)));
        r = await call('login-enroll', { client_id: 'c1', tag: TAG, name: 'Hann', pw: PW }, me(), { gist: unlocked });
        const store = r.logins;
        ok('enrolling stores a salted hash in the private store, keyed by the lowercase name', store && store.logins.hann && store.logins.hann.clientId === 'c1' && /^[0-9a-f]{64}$/.test(store.logins.hann.hash) && store.logins.hann.hash !== PW);
        ok('…marks the public record (login: true, loginAt), with no password material in it', r.player('c1').login === true && !!r.player('c1').loginAt && !JSON.stringify(r.written).includes(store.logins.hann.hash));
        ok('…and masks what it was sent', (r.secrets || []).includes(PW));
        ok('the payload is read from the event (context), not the env the log prints', !!store);
        r = await call('login-enroll', { client_id: 'c1', tag: TAG, name: 'Hann', pw: PW }, me({ login: true }), { gist: unlocked, logins: store });
        ok('a second enrolment is refused (that is login-change)', r.written === null && r.warnings.some(w => /already has a password/.test(w)));
        r = await call('login-enroll', { client_id: 'c2', tag: TAG, name: 'HANN', pw: PW }, me().concat(stored({}, { clientId: 'c2', displayName: 'Hann' })), { gist: unlocked, logins: store });
        ok('a name another player enrolled is taken, whatever the case', r.written === null && r.warnings.some(w => /is taken/.test(w)));
        r = await call('login-enroll', { client_id: 'c2', tag: TAG, name: 'Hann R.', pw: pwOf('Hann R.', 'x1234567') }, me().concat(stored({}, { clientId: 'c2', displayName: 'Hann' })), { gist: unlocked, logins: store });
        ok('…a different one is fine, and renames that player on the board', r.player('c2').displayName === 'Hann R.' && r.player('c2').login === true);

        const board = me({ login: true, loginAt: 'old' }), rest = { gist: unlocked, logins: store };
        r = await call('login', { tag: NEW_TAG, name: 'hann', pw: PW }, board, rest);
        ok('logging in on a new browser unlocks Game Mode there', r.written && !!r.written.gamesUnlock.tags[NEW_TAG] && r.written.gamesUnlock.tags[NEW_TAG].via === 'login');
        ok('…tells it which account to restore', r.written.gamesUnlock.grants[NEW_TAG].clientId === 'c1');
        ok('…and keeps the access-key counter and the other unlocks', r.written.gamesUnlock.n === 1 && !!r.written.gamesUnlock.tags[TAG]);
        r = await call('login', { tag: NEW_TAG, name: 'Hann', pw: pwOf('Hann', 'wrong') }, board, rest);
        ok('a wrong password writes nothing public, and counts a failed try privately', r.written === null && r.logins.logins.hann.fails.length === 1);
        r = await call('login', { tag: NEW_TAG, name: 'Nobody', pw: PW }, board, rest);
        ok('an unknown name writes nothing', r.written === null && !r.logins);
        let tired = rest.logins;
        for (let i = 0; i < 5; i++) { const x = await call('login', { tag: NEW_TAG, name: 'Hann', pw: pwOf('Hann', 'wrong' + i) }, board, { gist: unlocked, logins: tired }); tired = x.logins; }
        r = await call('login', { tag: NEW_TAG, name: 'Hann', pw: PW }, board, { gist: unlocked, logins: tired });
        ok('after 5 wrong tries the name rests: even the right password is refused', r.written === null && r.warnings.some(w => /resting/.test(w)));
        const later = JSON.parse(JSON.stringify(tired));
        later.logins.hann.fails = later.logins.hann.fails.map(t => t - 16 * 60000);
        r = await call('login', { tag: NEW_TAG, name: 'Hann', pw: PW }, board, { gist: unlocked, logins: later });
        ok('…15 minutes on, it works again and the count is cleared', !!r.written && r.logins.logins.hann.fails.length === 0);
        r = await call('login', { tag: NEW_TAG, name: 'Hann', pw: PW }, board, { gist: unlocked, logins: store });
        ok('a login writes only that browser\'s own file, never the board (so syncs cannot clash with it)', r.patches.length === 1 && r.patches[0].join() === 'plus-' + NEW_TAG + '.json');

        const PW2 = pwOf('Hann', 'new-password-9');
        r = await call('login-change', { client_id: 'c1', name: 'Hann', old_pw: pwOf('Hann', 'nope'), pw: PW2 }, board, rest);
        ok('changing the password needs the current one', r.written === null && r.logins.logins.hann.hash === store.logins.hann.hash);
        r = await call('login-change', { client_id: 'c1', name: 'Hann', old_pw: PW, pw: PW2 }, board, rest);
        ok('…with it, the new one is stored (new salt) and the old one masked', r.logins.logins.hann.hash !== store.logins.hann.hash && (r.secrets || []).includes(PW));
        ok('…and loginAt moves, so the browser can tell it went through', !!r.written && r.player('c1').loginAt && r.player('c1').loginAt !== 'old');
        r = await call('login', { tag: NEW_TAG, name: 'Hann', pw: PW2 }, board, { gist: unlocked, logins: r.logins });
        ok('…and is the one that logs in', !!r.written);

        r = await send(next({}, 1, { login: false }), board);
        ok('a sync cannot remove login: true, nor move loginAt', r.player('c1').login === true && r.player('c1').loginAt === 'old');
        r = await send(next({}, 1, { login: true }), [stored({})]);
        ok('…nor add it', !r.player('c1').login);
        r = await dispatch({ name: 'Hann', build_token: 'tok-now' }, board, { event: 'admin-login-reset', logins: store });
        ok('resetting a login needs the admin key', r.written === null && /admin_key invalid/.test(r.failed || ''));
        r = await dispatch({ name: 'HANN', admin_key: 'admin', build_token: 'tok-now' }, board, { event: 'admin-login-reset', logins: store });
        ok('…with it, the name is free and the record can enrol again', !r.logins.logins.hann && !r.player('c1').login);

        // Answers in seconds: each account request reports its outcome to its browser's status file.
        const RID = 'a1b2c3d4e5f6';
        r = await call('login', { tag: NEW_TAG, rid: RID, name: 'Hann', pw: pwOf('Hann', 'nope') }, board, rest);
        let st = r.status(NEW_TAG);
        ok('a wrong password is reported to the browser at once, with its request id', st && st.rid === RID && st.ok === false && st.code === 'wrong_password' && st.event === 'login');
        r = await call('login', { tag: NEW_TAG, rid: RID, name: 'Hann', pw: PW }, board, rest);
        st = r.status(NEW_TAG);
        ok('…and so is a success', st && st.ok === true && st.code === 'ok');
        r = await call('login', { tag: NEW_TAG, rid: RID, name: 'Nobody', pw: PW }, board, rest);
        ok('an unknown name: "no_login"', r.status(NEW_TAG).code === 'no_login');
        r = await call('login-enroll', { client_id: 'c1', tag: TAG, rid: RID, name: 'Hann', pw: PW }, me(), { gist: unlocked, noPlus: true });
        ok('enrolling without Plus: "no_plus"', r.status(TAG).code === 'no_plus' && !r.written);
        r = await call('login-enroll', { client_id: 'c2', tag: TAG, rid: RID, name: 'HANN', pw: PW }, me().concat(stored({}, { clientId: 'c2', displayName: 'Hann' })), { gist: unlocked, logins: store });
        ok('a taken name: "taken"', r.status(TAG).code === 'taken');
        r = await call('login', { tag: NEW_TAG, rid: RID, name: 'Hann', pw: PW }, board, Object.assign({}, rest, { env: { LOGIN_GIST_ID: '' }, catch: true }));
        st = r.status(NEW_TAG);
        ok('a crash (here: LOGIN_GIST_ID not set) still answers the browser, then fails the run', st && st.ok === false && st.code === 'error' && /LOGIN_GIST_ID/.test(st.msg) && !!r.thrown);
        r = await call('login', { tag: NEW_TAG, name: 'Hann', pw: PW }, board, rest);
        ok('without a request id nothing extra is written (older widgets)', !r.patches.some(p => p.some(n => /^status-/.test(n))));

        // Account actions write only their own small files, so a leaderboard sync can never clash with them.
        const enrolled = await call('login-enroll', { client_id: 'c1', tag: TAG, name: 'Hann', pw: PW }, me(), { gist: unlocked });
        ok('enrolling writes the account\'s own file and the private store, never the board', enrolled.patches.length === 1 && /^acct-c1\.json$/.test(enrolled.patches[0].join()) && !!enrolled.logins);
        const changed = await call('login-change', { client_id: 'c1', name: 'Hann', old_pw: PW, pw: PW2 }, me(), { gist: unlocked, logins: enrolled.logins });
        ok('changing a password: the same', changed.patches.length === 1 && /^acct-c1\.json$/.test(changed.patches[0].join()));
        const again = await call('login-change', { client_id: 'c1', name: 'Hann', old_pw: PW, pw: PW2, tag: TAG, rid: RID }, me(), { gist: unlocked, logins: changed.logins });
        ok('a change sent twice (a resend) is done, not a wrong try', again.status(TAG).ok === true && !(again.logins && again.logins.logins.hann.fails.length));
        const keyed = await dispatch({ tag: 'b'.repeat(32), key: keyFor(UNLOCK, 0), build_token: 'tok-now' }, [stored({})], { event: 'games-unlock' });
        ok('activating a key writes that browser\'s file and the key counter, never the board', keyed.patches.length === 1 && keyed.patches[0].sort().join() === 'keys.json,plus-' + 'b'.repeat(32) + '.json');
        ok('…and the view sees both: the browser unlocked, the next key current', keyed.written.gamesUnlock.tags['b'.repeat(32)] && keyed.written.gamesUnlock.n === 1);
        const synced = await dispatch({ player: next({}, 1), build_token: 'tok-now' }, [stored({})], { files: keyed.files });
        ok('a sync after it leaves the account files alone', synced.files['keys.json'] === keyed.files['keys.json'] && synced.files['plus-' + 'b'.repeat(32) + '.json'] === keyed.files['plus-' + 'b'.repeat(32) + '.json']);
        const revoked = await dispatch({ tag: 'b'.repeat(32), admin_key: 'admin', build_token: 'tok-now' }, [stored({})], { event: 'admin-games-revoke', files: keyed.files });
        ok('a revoke marks the file, and the view drops the browser', !revoked.written.gamesUnlock.tags['b'.repeat(32)]);
        let thrown = null;
        try { await dispatch({ tag: NEW_TAG, name: 'Hann', pw: PW, build_token: 'tok-now' }, board, { event: 'login', logins: store, env: { LOGIN_GIST_ID: '' } }); } catch (e) { thrown = e; }
        ok('with no LOGIN_GIST_ID configured, logins fail loudly (the run fails)', !!thrown && /LOGIN_GIST_ID/.test(thrown.message));
    }

    head('Plus in the cloud');
    {
        const crackSync = (player, players, extra) => dispatch(Object.assign({ player, build_token: 'tok-now' }, extra), players, { noPlus: true });
        r = await crackSync(next({}, 3), [stored({})]);
        ok('a sync with no Plus proof writes nothing for the player', r.written === null || r.player('c1').gameSessions === 100);
        ok('…and is logged', r.warnings.some(w => /no Plus license for c1/.test(w)));
        ok('…and, having played games (Game Mode opened by editing the script), it restricts the stored record', r.written && r.player('c1').restricted === 'no_plus' && !!r.player('c1').restrictedAt);
        ok('…changing nothing else on it', r.player('c1').gameSessions === 100 && r.player('c1').totalXP === 5000);
        r = await crackSync(next({}, 0, { totalXP: 5100 }), [stored({})]);
        ok('without game activity it is just ignored, not restricted', r.written === null);
        r = await crackSync(next({ 'pool:hard': 9 }, 0), [stored({ 'pool:hard': 2 })]);
        ok('a higher game score alone counts as game activity', r.written && r.player('c1').restricted === 'no_plus');
        r = await crackSync(Object.assign(next({}, 1), { clientId: 'c-new', displayName: 'Cracker' }), [stored({})]);
        ok('a new player without Plus cannot join the board', r.written === null && r.warnings.some(w => /new player refused/.test(w)));
        r = await crackSync(next({}, 2), [stored({})], { plus: 'nothex' });
        ok('…nor with a malformed secret', !r.written || r.player('c1').gameSessions === 100);
        r = await crackSync(next({}, 2), [stored({})], { plus: 'e'.repeat(64) });
        ok('…nor with a well-formed secret whose browser never got Plus', !r.written || r.player('c1').gameSessions === 100);
        ok('…which is masked in the logs either way', (r.secrets || []).includes('e'.repeat(64)));
        r = await dispatch({ registry: { players: [next({}, 2)] }, build_token: 'tok-now' }, [stored({})], { noPlus: true });
        ok('the legacy whole-registry payload is held to the same rule', r.written && r.player('c1').restricted === 'no_plus' && r.player('c1').gameSessions === 100);
        r = await send(next({}, 2), [stored({}, { restricted: 'no_plus', restrictedAt: 'x' })]);
        ok('a licensed sync goes through and lifts the restriction', r.player('c1').gameSessions === 102 && !r.player('c1').restricted && !r.player('c1').restrictedAt);
        r = await send(next({}, 1, { restricted: false }), [stored({}, { restricted: 'no_plus' })], { noPlus: true });
        ok('a client cannot clear its own restriction without Plus', r.player('c1') ? r.player('c1').restricted === 'no_plus' : true);
        r = await send(Object.assign(next({}, 0), { clientId: 'c-new', displayName: 'New' }), []);
        ok('a licensed new player joins as before', !!r.player('c-new'));
        r = await dispatch({ client_id: 'c1', recovery: { v: 1, lookup: '1'.repeat(32), salt: '2'.repeat(32), verifier: '3'.repeat(64), it: 100000 }, build_token: 'tok-now' }, [stored({})], { event: 'recovery-set', noPlus: true });
        ok('setting a recovery code needs Plus too', r.written === null && r.warnings.some(w => /no Plus license/.test(w)));
    }

    head('The legacy whole-registry payload');
    r = await dispatch({ registry: { players: [next({ 'pool:easy': 1 }, 1)] }, build_token: 'tok-now' }, [stored({ 'pool:hard': 5 })]);
    ok('it merges gameModeBests the same way', r.player('c1').gameModeBests['pool:hard'] === 5 && r.player('c1').gameModeBests['pool:easy'] === 1);

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('✗ ' + (e.stack || e)); process.exit(1); });
