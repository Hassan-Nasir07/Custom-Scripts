// Phase 2–5 verification: dice, legal-move generation, every rule toggle,
// capture/safe-square behaviour, turn flow and match resolution.
const load = require('./load');
const stepOnRing = load.stepOnRing;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else      { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);

// Fresh 4-player board with the given rule overrides.
function board(prefs) {
    const L = load(prefs);
    L.active = [0, 1, 2, 3];
    L.ludoResetTokens();
    L.turn = 0;
    return L;
}
const BLUE = 0, RED = 1, GREEN = 2, YELLOW = 3;

// ═══════════════════════════════════════════════════════════════════════
head('Dice');
{
    const L = board();
    const N = 60000, hist = [0, 0, 0, 0, 0, 0, 0];
    let outOfRange = 0, nonInt = 0;
    for (let i = 0; i < N; i++) {
        const r = L.ludoRollDice();
        if (r < 1 || r > 6) outOfRange++;
        else if (r !== Math.floor(r)) nonInt++;
        else hist[r]++;
    }
    ok('always an integer in 1..6', outOfRange === 0 && nonInt === 0);
    const exp = N / 6;
    const worst = Math.max(...hist.slice(1).map(v => Math.abs(v - exp) / exp));
    ok(`flat across 1–6 over ${N} rolls (worst deviation ${(worst * 100).toFixed(2)}%)`,
       worst < 0.05, hist.slice(1).join('/'));
    ok('every face appears', hist.slice(1).every(v => v > 0));
}

// ═══════════════════════════════════════════════════════════════════════
head('Six to release');
{
    const L = board();
    [1, 2, 3, 4, 5].forEach(r => {
        ok(`roll ${r} cannot leave base`, L.ludoLegalMoves(BLUE, r).length === 0);
    });
    const six = L.ludoLegalMoves(BLUE, 6);
    ok('roll 6 releases — one move per based token', six.length === 4, `got ${six.length}`);
    ok('release lands on step 0', six.every(m => m.to === 0 && m.release));
}
{
    const L = board({ ludoFreeRelease: true });
    ok('freeRelease: roll 3 releases', L.ludoLegalMoves(BLUE, 3).length === 4);
    ok('freeRelease: still lands on step 0',
       L.ludoLegalMoves(BLUE, 3).every(m => m.to === 0));
}

// ═══════════════════════════════════════════════════════════════════════
head('Capture and safe squares');
{
    // Ring 3 is an ordinary square. Blue reaches it at step 3.
    const L = board();
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 3);
    L.place(BLUE, 0, 2);
    L.place(GREEN, 0, gStep);
    const m = L.ludoLegalMoves(BLUE, 1).find(x => x.token.i === 0);
    ok('lone opponent on a plain square is capturable', m && m.captures.length === 1);
    L.ludoApplyMove(m);
    ok('captured token returns to base', L.tok(GREEN, 0).inBase && L.tok(GREEN, 0).step === -1);
    ok('capture counted for the capturer', L.stats[BLUE].captures === 1);
    ok('loss counted for the victim', L.stats[GREEN].lost === 1);
}
{
    // Ring 8 is a ★ safe square.
    const L = board();
    ok('ring 8 is safe', L.LUDO_SAFE_RING.has(8));
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 8);
    L.place(BLUE, 0, 7);
    L.place(GREEN, 0, gStep);
    const m = L.ludoLegalMoves(BLUE, 1).find(x => x.token.i === 0);
    ok('landing on a ★ square captures nothing', m && m.captures.length === 0);
    L.ludoApplyMove(m);
    ok('opponent stays put on the ★ square', !L.tok(GREEN, 0).inBase);
    ok('two colours may share a ★ square',
       L.ludoStepToRing(BLUE, L.tok(BLUE, 0).step) === 8 &&
       L.ludoStepToRing(GREEN, L.tok(GREEN, 0).step) === 8);
}
{
    const L = board();
    L.LUDO_COLORS.forEach((col, ci) => {
        ok(`${col.label}: own start square is safe`, L.LUDO_SAFE_RING.has(col.startIndex));
    });
    // Home columns are private: nothing can be captured there.
    const L2 = board();
    L2.place(BLUE, 0, 52);
    ok('no captures are possible in a home column',
       L2.ludoCaptures(BLUE, 53).length === 0 && L2.ludoCaptures(RED, 53).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════
head('Blocks');
{
    const L = board();                                  // blocks ON
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 6);  // green pair on ring 6
    L.place(GREEN, 0, gStep);
    L.place(GREEN, 1, gStep);
    ok('a same-colour pair registers as a block', L.ludoBlockRings(BLUE).has(6));

    L.place(BLUE, 0, 3);
    ok('cannot pass through a block',
       !L.ludoLegalMoves(BLUE, 4).some(m => m.token.i === 0));   // 3 -> 7 crosses ring 6
    ok('cannot land on a block',
       !L.ludoLegalMoves(BLUE, 3).some(m => m.token.i === 0));   // 3 -> 6
    ok('moving short of a block is fine',
       L.ludoLegalMoves(BLUE, 2).some(m => m.token.i === 0));    // 3 -> 5

    const solo = board();
    const s = stepOnRing(solo.LUDO_COLORS, GREEN, 6);
    solo.place(GREEN, 0, s);
    solo.place(BLUE, 0, 3);
    ok('a single token is not a block', !solo.ludoBlockRings(BLUE).has(6));
    ok('and may be passed and captured',
       solo.ludoLegalMoves(BLUE, 3).some(m => m.token.i === 0 && m.captures.length === 1));

    const own = board();
    own.place(BLUE, 0, 6);
    own.place(BLUE, 1, 6);
    ok('own pair never blocks its owner', !own.ludoBlockRings(BLUE).has(6));
    ok('owner may still move off its own stack',
       own.ludoLegalMoves(BLUE, 2).filter(m => m.from === 6).length === 2);
}
{
    const L = board({ ludoBlocks: false });
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 6);
    L.place(GREEN, 0, gStep);
    L.place(GREEN, 1, gStep);
    L.place(BLUE, 0, 3);
    ok('blocks OFF: passage allowed', L.ludoLegalMoves(BLUE, 4).some(m => m.token.i === 0));
    const land = L.ludoLegalMoves(BLUE, 3).find(m => m.token.i === 0);
    ok('blocks OFF: landing allowed', !!land);
    ok('blocks OFF: landing captures both', land && land.captures.length === 2);
}

// ═══════════════════════════════════════════════════════════════════════
head('Exact home');
{
    const L = board();                                   // exactHome ON
    L.place(BLUE, 0, 54);
    ok('exact roll finishes', L.ludoLegalMoves(BLUE, 2).some(m => m.finishes && m.to === 56));
    ok('overshoot is illegal', !L.ludoLegalMoves(BLUE, 3).some(m => m.token.i === 0));
    ok('undershoot stays in the column',
       L.ludoLegalMoves(BLUE, 1).some(m => m.to === 55 && !m.finishes));
}
{
    const L = board({ ludoExactHome: false });
    L.place(BLUE, 0, 54);
    const m = L.ludoLegalMoves(BLUE, 5).find(x => x.token.i === 0);
    ok('exactHome OFF: overshoot is legal', !!m);
    ok('exactHome OFF: overshoot clamps to 56 and finishes', m && m.to === 56 && m.finishes);
}
{
    const L = board();
    L.place(BLUE, 0, 56);
    ok('a finished token generates no moves',
       L.ludoLegalMoves(BLUE, 1).every(m => m.token.i !== 0));
}

// ═══════════════════════════════════════════════════════════════════════
head('Extra turns');
{
    const L = board();
    ok('a 6 grants another roll',  L.ludoGrantsExtraTurn(6, { captured: 0, finished: false }));
    ok('a capture grants another', L.ludoGrantsExtraTurn(3, { captured: 1, finished: false }));
    ok('finishing grants another', L.ludoGrantsExtraTurn(3, { captured: 0, finished: true }));
    ok('a plain move does not',   !L.ludoGrantsExtraTurn(3, { captured: 0, finished: false }));
}
{
    const L = board();
    L.place(BLUE, 0, 10);
    L.turn = 0;
    const r = L.ludoRegisterRoll(BLUE, 3);
    L.ludoFinishMove(3, L.ludoApplyMove(r.moves.find(m => m.token.i === 0)));
    ok('a plain move passes the turn', L.turn === 1, `turn=${L.turn}`);
}
{
    const L = board();
    L.place(BLUE, 0, 10);
    const r = L.ludoRegisterRoll(BLUE, 6);
    const res = L.ludoFinishMove(6, L.ludoApplyMove(r.moves.find(m => m.token.i === 0)));
    ok('a 6 keeps the turn', res.extraTurn && L.turn === 0);
    ok('and clears the roll so the player must roll again', L.roll === 0);
}

// ═══════════════════════════════════════════════════════════════════════
head('Three sixes');
{
    const L = board();
    L.place(BLUE, 0, 10);
    const a = L.ludoRegisterRoll(BLUE, 6); L.ludoApplyMove(a.moves[0]); L.ludoFinishMove(6, { captured: 0, finished: false });
    ok('streak = 1 after one six', L.sixStreak === 1);
    const b = L.ludoRegisterRoll(BLUE, 6); L.ludoApplyMove(b.moves[0]); L.ludoFinishMove(6, { captured: 0, finished: false });
    ok('streak = 2 after two sixes', L.sixStreak === 2);
    const c = L.ludoRegisterRoll(BLUE, 6);
    ok('third six is voided', c.voided && c.moves.length === 0);
    ok('third six forfeits the turn', L.turn === 1, `turn=${L.turn}`);
    ok('the voided roll is discarded', L.roll === 0);
    ok('streak resets after the forfeit', L.sixStreak === 0);
}
{
    const L = board({ ludoThreeSixes: false });
    L.place(BLUE, 0, 10);
    L.sixStreak = 2;
    const c = L.ludoRegisterRoll(BLUE, 6);
    ok('threeSixes OFF: a third six still plays', !c.voided && c.moves.length > 0);
}
{
    const L = board();
    L.place(BLUE, 0, 10);
    L.ludoRegisterRoll(BLUE, 6); L.ludoApplyMove(L.ludoLegalMoves(BLUE, 6)[0]);
    L.ludoFinishMove(6, { captured: 0, finished: false });
    L.ludoRegisterRoll(BLUE, 2);
    ok('a non-six breaks the streak', L.sixStreak === 0);
}

// ═══════════════════════════════════════════════════════════════════════
head('No legal move');
{
    const L = board();                       // all four tokens in base
    const r = L.ludoRegisterRoll(BLUE, 3);   // cannot release without a 6
    ok('a dead roll reports passed', r.passed && r.moves.length === 0);
    ok('and hands the turn on', L.turn === 1);
}
{
    // A 6 with nowhere to go must also pass, not loop forever.
    const L = board();
    for (let i = 0; i < 4; i++) L.place(BLUE, i, 56);
    const r = L.ludoRegisterRoll(BLUE, 6);
    ok('a 6 with no legal move still passes', r.passed && L.turn !== 0);
}

// ═══════════════════════════════════════════════════════════════════════
head('Match resolution');
{
    const L = board();
    L.active = [BLUE, GREEN];
    L.ludoResetTokens();
    for (let i = 0; i < 3; i++) L.place(BLUE, i, 56);
    L.place(BLUE, 3, 54);
    ok('not over with one token left', !L.ludoCheckGameOver());

    const r = L.ludoRegisterRoll(BLUE, 2);
    const m = r.moves.find(x => x.token.i === 3);
    const res = L.ludoApplyMove(m);
    ok('the fourth token finishes', res.finished && L.ludoTokensHome(BLUE) === 4);
    ok('placement recorded', L.placements[0] === BLUE);
    const fin = L.ludoFinishMove(2, res);
    ok('2P: first to finish ends the match', fin.gameOver && L.gameOver);
    ok('standings put the winner first', L.ludoStandings()[0] === BLUE);
}
{
    // 4P: the match runs until only one player is unfinished.
    const L = board();
    [BLUE, RED].forEach(ci => { for (let i = 0; i < 4; i++) L.place(ci, i, 56); });
    L.placements.push(BLUE, RED);
    ok('4P: not over with two still playing', !L.ludoCheckGameOver());
    for (let i = 0; i < 4; i++) L.place(GREEN, i, 56);
    L.placements.push(GREEN);
    ok('4P: over once only one is unfinished', L.ludoCheckGameOver());
    ok('finishers keep their order', L.ludoStandings().slice(0, 3).join() === [BLUE, RED, GREEN].join());
    ok('the straggler comes last', L.ludoStandings()[3] === YELLOW);
}
{
    // Unfinished players rank by tokens home, then distance.
    const L = board();
    L.active = [BLUE, RED, GREEN];
    L.ludoResetTokens();
    for (let i = 0; i < 4; i++) L.place(BLUE, i, 56);
    L.placements.push(BLUE);
    L.place(RED, 0, 56); L.place(RED, 1, 10);
    L.place(GREEN, 0, 40);
    const s = L.ludoStandings();
    ok('more tokens home outranks more distance', s[1] === RED && s[2] === GREEN,
       `standings=${s.join()}`);
}
{
    const L = board();
    L.active = [BLUE, RED, GREEN];
    L.ludoResetTokens();
    for (let i = 0; i < 4; i++) L.place(BLUE, i, 56);
    L.placements.push(BLUE);
    L.place(RED, 0, 30);
    L.place(GREEN, 0, 12);
    const s = L.ludoStandings();
    ok('equal tokens home fall back to distance', s[1] === RED && s[2] === GREEN,
       `standings=${s.join()}`);
}
{
    // A finished player must be skipped in the rotation.
    const L = board();
    L.active = [BLUE, RED, GREEN, YELLOW];
    L.ludoResetTokens();
    for (let i = 0; i < 4; i++) L.place(RED, i, 56);
    L.turn = 0;
    L.ludoAdvanceTurn();
    ok('turn rotation skips a finished player', L.active[L.turn] === GREEN,
       `landed on ${L.active[L.turn]}`);
}

// ═══════════════════════════════════════════════════════════════════════
head('Random self-play (no illegal states)');
{
    let stalls = 0, wins = 0, illegal = 0, maxTurns = 0;
    for (let game = 0; game < 400; game++) {
        const L = board();
        L.active = [BLUE, RED, GREEN, YELLOW];
        L.ludoResetTokens();
        let turns = 0;
        while (!L.gameOver && turns < 8000) {
            turns++;
            const ci = L.active[L.turn];
            const r  = L.ludoRegisterRoll(ci, L.ludoRollDice());
            if (r.voided || r.passed) continue;
            const m = r.moves[Math.floor(Math.random() * r.moves.length)];

            if (m.to < 0 || m.to > 56) illegal++;
            if (!m.release && m.from >= 0 && m.to <= m.from) illegal++;

            const res = L.ludoApplyMove(m);
            L.ludoFinishMove(L.roll || 6, res);
        }
        maxTurns = Math.max(maxTurns, turns);
        if (L.gameOver) wins++; else stalls++;

        // Invariants that must hold at the end of every game.
        L.active.forEach(ci => {
            const ts = L.tokens.filter(t => t.ci === ci);
            if (ts.length !== 4) illegal++;
            ts.forEach(t => {
                if (t.home && t.step !== 56) illegal++;
                if (t.inBase && t.step !== -1) illegal++;
                if (!t.inBase && !t.home && (t.step < 0 || t.step > 55)) illegal++;
            });
        });
    }
    ok('400 random 4P games all reach a winner', stalls === 0, `${stalls} stalled`);
    ok('no illegal move or token state observed', illegal === 0, `${illegal} violations`);
    ok(`longest game stayed bounded (${maxTurns} turns)`, maxTurns < 8000);
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(fail ? 1 : 0);
