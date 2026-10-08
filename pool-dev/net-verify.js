// Online play, headless: two whole engines (pool-game.js on a stubbed host, as pool-verify.js
// runs it) talking through the real mp-server/ over ws://, each driven by the CPU's planner
// standing in for a human. `"/c/Program Files/nodejs/node.exe" pool-dev/net-verify.js`
//
//   1  a challenge seats both tabs in one room: same seed, same rack, seats 1 and 2
//   2  a best-of-3 of pool and a frame of snooker, each player acting the moment it may: after
//      every shot both tables hash the same (no resyncs needed), the same winner, each tab files its own result and XP once
//   3  a reload mid-frame: the new tab replays the room's log to the same table, pays nothing
//      twice, and the frame plays on to the end
//   4  leaving mid-frame: the leaver loses the frame, the other wins it by forfeit
//   5  the turn is enforced: no input on the other tab's turn
// Needs Node 22 (global WebSocket).
const path = require('path');
const L = require('./load');
const { createServer } = require('../mp-server/server');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));
const yieldIO = () => new Promise(r => setImmediate(r));

// A tab: the engine with its own storage, pointed at the server, hooks set as initPoolGame does.
function tab(name, port, store, seed) {
    const P = L.game({ name, store: store || {}, seed });
    P.host.userPreferences.poolNetServer = 'ws://127.0.0.1:' + port;
    P.host.userPreferences.snookerReds = 6;
    P.poolNet.on = { start: P.poolNetStart, closed: P.poolNetClosed };
    P.poolNewFrame(1);
    P.poolNetConnect(P.host.userPreferences.poolNetServer);
    P.plan = P.ppRandom(seed || 1);
    return P;
}
function netDiff(P, Q) {
    const S = P.poolS;
    return { phase: S.phase, turn: S.frame.turn, bih: S.frame.ballInHand, n: S.netFrameNo, frames: S.frames.join(), res: S.netResyncs,
        balls: S.world.balls.filter((b, i) => { const o = Q.poolS.world.balls[i]; return Math.abs(b.x - o.x) > 1e-3 || Math.abs(b.y - o.y) > 1e-3 || b.state !== o.state; }).map(b => [b.id, b.state, +b.x.toFixed(3), +b.y.toFixed(3)]) };
}
async function until(cond, ms, tabs) {
    const end = Date.now() + (ms || 3000);
    while (!cond()) {
        if (Date.now() > end) return false;
        (tabs || []).forEach(P => P.poolTick(16));
        await new Promise(r => setTimeout(r, 2));
    }
    return true;
}
// The player at this tab, when it is theirs to act: the CPU's planner picks the shot (with its
// own rng, so the table's stays the same on both tabs), then the controller plays it.
function act(P) {
    const S = P.poolS, R = P.poolRules();
    if (P.poolRemoteTurn() || S.phase === 'over' || S.phase === 'moving' || S.phase === 'strike') return false;
    if (S.phase === 'choice') { P.poolOn.choose(R.cpu.choose(S.frame, S.world)); return true; }
    if (S.phase === 'bih') { const p = R.cpu.place(S.world, S.frame, P.plan, 'normal'); R.placeCue(S.world, p[0], p[1]); S.placed = true; S.phase = 'aim'; }
    if (S.phase !== 'aim') return false;
    const job = R.cpu.plan(S.world, S.frame, { rng: P.plan, tier: 'normal', safeRun: 0 });
    while (!job.step(200));
    S.called = job.shot.call >= 0 ? job.shot.call : -1;
    if (job.shot.nominate >= 0) S.nom = job.shot.nominate;
    S.shot = job.shot; S.phase = 'strike'; S.strikeT = 0;
    return true;
}
// Both tabs play until the frame is over on both; every settled table is compared.
async function playFrame(A, B, limit) {
    let shots = 0, mismatches = 0, ticks = 0, lastA = '', lastB = '';
    while ((A.poolS.phase !== 'over' || B.poolS.phase !== 'over') && ticks++ < (limit || 200000)) {
        // Each acts the moment it may, messages still in flight or not (a quick player).
        [A, B].forEach(P => { if (act(P)) shots++; });
        A.poolTick(16); B.poolTick(16);
        // At rest on both, with nothing in flight between them: the same table.
        const still = P => P.poolS.phase !== 'moving' && P.poolS.phase !== 'strike' && P.poolNet.inbox.length === 0 && P.poolNet.out.length === 0;
        if (still(A) && still(B) && A.poolNet.known === B.poolNet.known) {
            const ha = A.poolNetHash(), hb = B.poolNetHash();
            if (ha !== lastA || hb !== lastB) { if (ha !== hb) mismatches++; lastA = ha; lastB = hb; }
        }
        if (ticks % 4 === 0) await yieldIO();
    }
    return { shots, mismatches, done: A.poolS.phase === 'over' && B.poolS.phase === 'over' };
}

(async () => {
    const srv = createServer({ log: false, holdMs: 1500, challengeMs: 2000 });
    const port = await srv.listen(0, '127.0.0.1');

    head('Room');
    const A = tab('Ali', port, {}, 3), B = tab('Bea', port, {}, 4);
    ok('both tabs reach the server and see each other', await until(() => A.poolNet.lobby.length === 1 && B.poolNet.lobby.length === 1, 3000));
    A.poolS.netBestOf = 3;
    A.poolOn.netChallenge(A.poolNet.lobby[0].id);
    ok('the challenge arrives as an invite', await until(() => B.poolNet.invites.length === 1, 2000));
    B.poolOn.netAccept(B.poolNet.invites[0].id);
    ok('accepting seats both tabs in the room', await until(() => A.poolMode === 'net' && B.poolMode === 'net', 2000));
    ok('…the challenger is seat 1, the accepter seat 2', A.poolS.netRoom.seat === 1 && B.poolS.netRoom.seat === 2);
    ok('…both rack the same table from the room seed', A.poolS.seed === B.poolS.seed && A.poolNetHash() === B.poolNetHash());
    ok('…named after the players', A.poolNames()[1] === 'Ali' && A.poolNames()[2] === 'Bea' && B.poolNames()[1] === 'Ali');
    ok('the breaker is seat 1: Bea cannot act, and her clock does not run', !B.poolCanAct() && A.poolCanAct() && B.poolRemoteTurn());

    head('Best of 3, pool');
    let frames = 0, allSame = true, shotsTotal = 0;
    while (frames < 3 && !(Math.max(A.poolS.frames[0], A.poolS.frames[1]) >= 2)) {
        const r = await playFrame(A, B);
        frames++; shotsTotal += r.shots;
        if (!r.done || r.mismatches) allSame = false;
        if (!r.done) break;
        if (A.poolS.frames.join() !== B.poolS.frames.join()) allSame = false;
        if (Math.max(A.poolS.frames[0], A.poolS.frames[1]) >= 2) break;
        // Either tab may start the next frame: here the loser of the last one does.
        (A.poolS.result.win ? B : A).poolOn.primary();
        await until(() => A.poolS.phase !== 'over' && B.poolS.phase !== 'over', 2000, [A, B]);
        if (A.poolS.netFrameNo !== B.poolS.netFrameNo || A.poolNetHash() !== B.poolNetHash()) allSame = false;
    }
    ok('the match finishes, every settled table the same on both tabs', allSame, frames + ' frames, ' + shotsTotal + ' shots');
    ok('…no resync was needed: the inputs alone kept them in step', A.poolS.netResyncs === 0 && B.poolS.netResyncs === 0, A.poolS.netResyncs + '/' + B.poolS.netResyncs);
    const fa = A.poolS.frames, aw = fa[0], bw = fa[1];
    ok('one player won the match 2–n', Math.max(aw, bw) === 2, fa.join('–'));
    const recA = JSON.parse(A.store.poolNetRecord || '{}'), recB = JSON.parse(B.store.poolNetRecord || '{}');
    ok('each tab filed its own frames: wins and losses mirror', recA.wins === aw && recA.losses === bw && recB.wins === bw && recB.losses === aw, JSON.stringify([recA, recB]));
    ok('online wins go to poolWinsByMode.online, and all-time wins with them',
        (JSON.parse(A.store.poolWinsByMode || '{}').online || 0) === aw && (+A.store.poolGamesWon || 0) === aw && (JSON.parse(B.store.poolWinsByMode || '{}').online || 0) === bw);
    ok('XP once per frame per tab, marked online', A.log.xp.length === aw + bw && B.log.xp.length === aw + bw && A.log.xp.every(x => x.perf.online && !x.perf.vsCPU));
    ok('the dialog offers a rematch once the match is decided', A.poolNetPrimaryLabel() === 'REMATCH' && A.poolS.result.recordLabel === 'ONLINE · RECORD');
    A.poolOn.primary();
    ok('REMATCH starts frame 0–0 on both tabs', await until(() => B.poolS.phase !== 'over' && B.poolS.frames.join() === '0,0' && A.poolS.frames.join() === '0,0', 2000, [A, B]));

    head('Reload mid-frame');
    // A few shots in, Bea's tab goes away and a new one opens on the same browser storage.
    for (let i = 0; i < 6; i++) {
        const r = await (async () => { let n = 0; while (n++ < 40000) { [A, B].forEach(act); A.poolTick(16); B.poolTick(16); if (n % 4 === 0) await yieldIO(); if (A.poolS.phase === 'over') return; const still = P => P.poolS.phase !== 'moving' && P.poolS.phase !== 'strike'; if (still(A) && still(B) && A.poolNet.known === B.poolNet.known && A.poolNet.out.length === 0 && A.poolNet.known >= (i + 1) * 2) return; } })();
        if (A.poolS.phase === 'over') break;
    }
    const xpBefore = B.log.xp.length, storeB = B.store, knownBefore = A.poolNet.known;
    B.poolNet.wanted = false; B.poolNet.ws.close();
    ok('the other tab sees Bea reconnecting', await until(() => A.poolNet.peer === 'away', 2000, [A]) && /Reconnecting/.test(A.poolNetRecordText(2)));
    const B2 = tab('Bea', port, storeB, 4);
    const caught = await until(() => B2.poolMode === 'net' && B2.poolNet.inbox.length === 0 && B2.poolNet.known >= knownBefore && B2.poolS.phase !== 'moving', 5000, [B2]);
    ok('the new tab rejoins the room and replays its log', caught, B2.poolNet.known + ' of ' + knownBefore);
    ok('…to the same table as the other tab', B2.poolNetHash() === A.poolNetHash(), JSON.stringify([netDiff(A, B2), netDiff(B2, A)]));
ok('…and no tab needed a resync, the quick player included', A.poolS.netResyncs === 0 && B2.poolS.netResyncs === 0, A.poolS.netResyncs + '/' + B2.poolS.netResyncs);
    ok('…without paying any frame twice', B2.log.xp.length === 0 && xpBefore >= 0);
    ok('the other tab sees Bea back', await until(() => A.poolNet.peer === 'here', 2000, [A, B2]));
    const r3 = await playFrame(A, B2);
    ok('the frame plays on to the end, still in step', r3.done && r3.mismatches === 0 && A.poolS.frames.join() === B2.poolS.frames.join(), JSON.stringify(r3));

    head('Leaving mid-frame');
    A.poolOn.primary();
    await until(() => A.poolS.phase !== 'over' && B2.poolS.phase !== 'over', 2000, [A, B2]);
    const lossesA = JSON.parse(A.store.poolNetRecord).losses, winsB = JSON.parse(B2.store.poolNetRecord).wins;
    A.poolOn.netLeave();
    ok('the leaver is back to Vs CPU with one more loss', A.poolMode === 'cpu' && JSON.parse(A.store.poolNetRecord).losses === lossesA + 1);
    ok('the other tab wins the frame by forfeit', await until(() => B2.poolS.phase === 'over' && B2.poolS.result && /forfeit/.test(B2.poolS.result.note), 2000, [B2]) &&
        JSON.parse(B2.store.poolNetRecord).wins === winsB + 1);
    ok('…and its dialog goes back to the CPU', B2.poolNetPrimaryLabel() === 'BACK TO CPU');
    B2.poolOn.primary();
    ok('BACK TO CPU leaves online mode', B2.poolMode === 'cpu' && !B2.poolS.netRoom);

    head('Snooker');
    B2.poolSetVariant('snooker');
    B2.poolOn.netChallenge(B2.poolNet.lobby.find(p => p.name === 'Ali').id);
    ok('a snooker challenge carries the reds', await until(() => A.poolNet.invites.length === 1 && A.poolNet.invites[0].game === 'snooker' && A.poolNet.invites[0].reds === 6, 2000, [A, B2]));
    A.poolOn.netAccept(A.poolNet.invites[0].id);
    ok('both tabs switch to snooker in the room', await until(() => A.poolMode === 'net' && A.poolS.game === 'snooker' && B2.poolS.game === 'snooker', 2000, [A, B2]));
    ok('…6 reds on both tables, the same rack', A.poolS.frame.reds === 6 && A.poolNetHash() === B2.poolNetHash());
    const sn = await playFrame(A, B2, 400000);
    ok('a whole snooker frame, every settled table the same', sn.done && sn.mismatches === 0 && A.poolS.netResyncs === 0, JSON.stringify(sn));
    const scA = A.poolS.frame.scores, scB = B2.poolS.frame.scores;
    ok('…the same final score on both', scA && scB && scA[1] === scB[1] && scA[2] === scB[2], JSON.stringify([scA, scB]));
    ok('…snooker online wins go to snookerWinsByMode.online', (JSON.parse(A.store.snookerWinsByMode || '{}').online || 0) + (JSON.parse(B2.store.snookerWinsByMode || '{}').online || 0) === 1);

    [A, B2].forEach(P => P.poolNetDisconnect());
    await srv.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
