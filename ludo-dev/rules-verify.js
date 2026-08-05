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

// ── A safe square can never become a wall ────────────────────────────
// Regression: Green's own start (ring 26) is safe AND is refilled every time
// Green releases. When a pair there still sealed the track, a Blue token at
// ring 24 had exactly one legal roll (1) and was stranded until captured.
{
    const L = board();                                  // blocks ON
    L.place(GREEN, 0, 0);                               // both on Green's start
    L.place(GREEN, 1, 0);
    ok('Green\'s start is ring 26 and is safe',
       L.ludoStepToRing(GREEN, 0) === 26 && L.LUDO_SAFE_RING.has(26));
    ok('a pair on a safe square is NOT a block', !L.ludoBlockRings(BLUE).has(26));

    L.place(BLUE, 0, 24);                               // Green's gate
    const rolls = [1, 2, 3, 4, 5, 6].filter(r =>
        L.ludoLegalMoves(BLUE, r).some(m => m.token.i === 0));
    ok('every roll can now get past it', rolls.length === 6, `legal rolls: ${rolls.join()}`);

    const onto = L.ludoLegalMoves(BLUE, 2).find(m => m.token.i === 0);
    ok('landing on the shared safe square is allowed', !!onto && onto.to === 26);
    ok('and captures nothing there', onto.captures.length === 0);
}
{
    // Same for a ★ square, and a pair of stars mid-track.
    const L = board();
    const g8 = stepOnRing(L.LUDO_COLORS, GREEN, 8);
    L.place(GREEN, 0, g8);
    L.place(GREEN, 1, g8);
    ok('a pair on a ★ square is not a block', !L.ludoBlockRings(BLUE).has(8));
    L.place(BLUE, 0, 5);
    ok('and it can be passed', L.ludoLegalMoves(BLUE, 5).some(m => m.token.i === 0));
}
{
    // Ordinary squares must still block — the rule is narrowed, not removed.
    const L = board();
    const g6 = stepOnRing(L.LUDO_COLORS, GREEN, 6);
    ok('ring 6 is not safe', !L.LUDO_SAFE_RING.has(6));
    L.place(GREEN, 0, g6);
    L.place(GREEN, 1, g6);
    L.place(BLUE, 0, 3);
    ok('a pair on a plain square still blocks', L.ludoBlockRings(BLUE).has(6));
    ok('and still bars passage', !L.ludoLegalMoves(BLUE, 4).some(m => m.token.i === 0));
}
{
    // No colour can be permanently sealed in: from anywhere on the ring there is
    // always some roll that works, given only safe-square pairs on the board.
    const L = board();
    L.active = [BLUE, GREEN];
    L.ludoResetTokens();
    L.place(GREEN, 0, 0);                    // pair on Green's start (safe)
    L.place(GREEN, 1, 0);
    let stuck = [];
    for (let s = 0; s <= 45; s++) {
        L.place(BLUE, 0, s);
        const any = [1, 2, 3, 4, 5, 6].some(r =>
            L.ludoLegalMoves(BLUE, r).some(m => m.token.i === 0));
        if (!any) stuck.push(s);
    }
    ok('no ring position is a dead end', stuck.length === 0, `stuck at steps ${stuck.join()}`);
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
head('Dice accumulate before moving');
{
    // A 6 buys another die rather than forcing a move, so a sequence can hand
    // the player up to three values to spend as they like.
    const L = board();
    L.place(BLUE, 0, 10);
    const a = L.ludoRegisterRoll(BLUE, 6);
    ok('a 6 asks for another roll', a.rollAgain && a.moves.length === 0);
    ok('and banks the 6', L.pool.join() === '6');
    ok('nothing is playable yet', L.phase === undefined || a.moves.length === 0);

    const b = L.ludoRegisterRoll(BLUE, 6);
    ok('a second 6 asks again', b.rollAgain);
    ok('two dice banked', L.pool.join() === '6,6');

    const c = L.ludoRegisterRoll(BLUE, 5);
    ok('a non-6 closes the sequence', !c.rollAgain && !c.voided);
    ok('the pool is 6,6,5', L.pool.join() === '6,6,5');
    ok('moves are offered for both distinct values',
       c.moves.some(m => m.value === 6) && c.moves.some(m => m.value === 5));
    ok('the turn has not passed', L.turn === 0);
}
{
    const L = board();
    L.place(BLUE, 0, 10);                    // needs something movable, or it passes
    L.ludoRegisterRoll(BLUE, 3);
    ok('a non-6 first roll is a one-die pool', L.pool.join() === '3', L.pool.join());
}
{
    // Three is the ceiling even with threeSixes off, or the sequence never ends.
    const L = board({ ludoThreeSixes: false });
    L.place(BLUE, 0, 10);
    L.ludoRegisterRoll(BLUE, 6);
    L.ludoRegisterRoll(BLUE, 6);
    const c = L.ludoRegisterRoll(BLUE, 6);
    ok('threeSixes OFF: capped at 3 dice', !c.rollAgain && L.pool.join() === '6,6,6');
    ok('and all three are playable', c.moves.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════
head('Spending the pool');
{
    const L = board();
    L.place(BLUE, 0, 10);
    L.ludoRegisterRoll(BLUE, 6);
    const r = L.ludoRegisterRoll(BLUE, 2);
    ok('pool is 6,2', L.pool.join() === '6,2');

    const m = r.moves.find(x => x.token.i === 0 && x.value === 2);
    const after = L.ludoFinishMove(L.ludoApplyMove(m));
    ok('spending the 2 leaves the 6', L.pool.join() === '6', L.pool.join());
    ok('the turn continues rather than passing', after.continueTurn && L.turn === 0);
    ok('remaining moves are offered', after.moves.length > 0);
    ok('and they all spend the 6', after.moves.every(x => x.value === 6));

    const m2 = after.moves[0];
    const after2 = L.ludoFinishMove(L.ludoApplyMove(m2));
    ok('spending the last die ends the turn', !after2.continueTurn && L.turn === 1);
    ok('pool is empty', L.pool.length === 0);
}
{
    // Values that cannot be played are simply forfeited.
    const L = board();
    L.place(BLUE, 0, 54);                    // only a 2 finishes; 6 overshoots
    for (let i = 1; i < 4; i++) L.place(BLUE, i, 56);
    L.ludoRegisterRoll(BLUE, 6);
    const r = L.ludoRegisterRoll(BLUE, 2);
    ok('only the playable value is offered',
       r.moves.length === 1 && r.moves[0].value === 2, JSON.stringify(r.moves.map(m => m.value)));
    L.ludoFinishMove(L.ludoApplyMove(r.moves[0]));
    ok('the unplayable 6 is dropped and the turn ends', L.pool.length === 0);
}
{
    const L = board();
    ok('values for a token list only what it can spend',
       (L.place(BLUE, 0, 10), L.ludoRegisterRoll(BLUE, 6), L.ludoRegisterRoll(BLUE, 3),
        L.ludoValuesForToken(BLUE, L.tok(BLUE, 0)).join() === '3,6'));
    ok('a based token can only spend a 6',
       L.ludoValuesForToken(BLUE, L.tok(BLUE, 1)).join() === '6');
}

// ═══════════════════════════════════════════════════════════════════════
head('Another sequence on a capture');
{
    const L = board();
    ok('a capture earns another roll', L.ludoEarnsAnotherRoll({ captured: 1, finished: false }));
    ok('a token home earns another',   L.ludoEarnsAnotherRoll({ captured: 0, finished: true }));
    ok('a plain move does not',       !L.ludoEarnsAnotherRoll({ captured: 0, finished: false }));
    ok('a 6 no longer earns a turn — it earned a die',
       !L.ludoEarnsAnotherRoll({ captured: 0, finished: false }));
}
{
    const L = board();
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 3);
    L.place(GREEN, 0, gStep);
    L.place(BLUE, 0, 2);
    const r = L.ludoRegisterRoll(BLUE, 1);
    const cap = r.moves.find(m => m.token.i === 0);
    ok('the move captures', cap.captures.length === 1);
    const after = L.ludoFinishMove(L.ludoApplyMove(cap));
    ok('pool spent but the turn is kept', after.extraRoll && L.turn === 0);
    ok('the six streak is cleared for the new sequence', L.sixStreak === 0);
    ok('and a fresh roll accumulates normally',
       (L.ludoRegisterRoll(BLUE, 6).rollAgain && L.pool.join() === '6'));
}
{
    const L = board();
    L.place(BLUE, 0, 10);
    const r = L.ludoRegisterRoll(BLUE, 3);
    const after = L.ludoFinishMove(L.ludoApplyMove(r.moves.find(m => m.token.i === 0)));
    ok('a plain move passes the turn', !after.extraRoll && L.turn === 1, `turn=${L.turn}`);
}

// ═══════════════════════════════════════════════════════════════════════
head('Three sixes');
{
    const L = board();
    L.place(BLUE, 0, 10);
    L.ludoRegisterRoll(BLUE, 6);
    ok('streak = 1 after one six', L.sixStreak === 1);
    L.ludoRegisterRoll(BLUE, 6);
    ok('streak = 2 after two sixes', L.sixStreak === 2);
    const c = L.ludoRegisterRoll(BLUE, 6);
    ok('third six is voided', c.voided && c.moves.length === 0);
    ok('third six forfeits the turn', L.turn === 1, `turn=${L.turn}`);
    ok('the two banked dice are forfeited too', L.pool.length === 0);
    ok('the voided roll is discarded', L.roll === 0);
    ok('streak resets after the forfeit', L.sixStreak === 0);
}
{
    const L = board();
    L.place(BLUE, 0, 10);
    L.ludoRegisterRoll(BLUE, 6);
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
    // A 6 with nowhere to go must still terminate, not loop forever. It banks
    // dice up to the cap first, then finds nothing playable and passes.
    const L = board();
    for (let i = 0; i < 4; i++) L.place(BLUE, i, 56);
    let r = L.ludoRegisterRoll(BLUE, 6);
    let guard = 0;
    while (r.rollAgain && guard++ < 10) r = L.ludoRegisterRoll(BLUE, 6);
    ok('sixes with no legal move still pass', r.passed || r.voided, JSON.stringify(r));
    ok('and the turn moved on', L.turn !== 0);
    ok('without spinning forever', guard < 10, `guard=${guard}`);
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
    const fin = L.ludoFinishMove(res);
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
    let stalls = 0, wins = 0, illegal = 0, maxTurns = 0, maxPool = 0;
    for (let game = 0; game < 400; game++) {
        const L = board();
        L.active = [BLUE, RED, GREEN, YELLOW];
        L.ludoResetTokens();
        let turns = 0;
        while (!L.gameOver && turns < 8000) {
            turns++;
            const ci = L.active[L.turn];

            // Roll until the sequence closes (a 6 buys another die).
            let r = L.ludoRegisterRoll(ci, L.ludoRollDice());
            let rolls = 1;
            while (r.rollAgain && rolls++ < 5) r = L.ludoRegisterRoll(ci, L.ludoRollDice());
            if (rolls > L.LUDO_MAX_DICE) illegal++;      // cap must hold
            if (r.voided || r.passed) continue;
            maxPool = Math.max(maxPool, L.pool.length);

            // Spend the pool one die at a time.
            let moves = r.moves, spends = 0;
            while (moves.length && spends++ < 6) {
                const m = moves[Math.floor(Math.random() * moves.length)];
                if (m.to < 0 || m.to > 56) illegal++;
                if (!m.release && m.from >= 0 && m.to <= m.from) illegal++;
                if (!m.value) illegal++;                 // pool moves must be tagged

                const after = L.ludoFinishMove(L.ludoApplyMove(m));
                if (after.gameOver) break;
                moves = after.continueTurn ? after.moves : [];
            }
            if (L.pool.length && !L.gameOver) illegal++;  // pool must always drain
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
    ok(`the pool never exceeded the cap (peak ${maxPool})`, maxPool <= 3);
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(fail ? 1 : 0);
