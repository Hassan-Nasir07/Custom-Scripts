// Phase 6 verification: adaptive difficulty tiers, the move scorer's priorities,
// and a head-to-head check that the tiers are actually ordered by strength.
const load = require('./load');
const stepOnRing = load.stepOnRing;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else      { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);

function board(prefs) {
    const L = load(prefs);
    L.active = [0, 1, 2, 3];
    L.ludoResetTokens();
    L.turn = 0;
    return L;
}
const BLUE = 0, GREEN = 2;

// ═══════════════════════════════════════════════════════════════════════
head('Adaptive difficulty tier');
{
    const L = board();
    const tier = (w, l) => L.ludoDifficultyTier({ wins: w, losses: l });
    ok('no record at all → normal',        tier(0, 0) === 'normal');
    ok('4 games is too small a sample',    tier(4, 0) === 'normal');
    ok('5 games starts adapting',          tier(0, 5) === 'easy');
    ok('win rate 0.20 → easy',             tier(2, 8) === 'easy');
    ok('win rate 0.39 → easy',             tier(39, 61) === 'easy');
    ok('win rate 0.40 → normal (boundary)', tier(40, 60) === 'normal');
    ok('win rate 0.65 → normal (boundary)', tier(65, 35) === 'normal');
    ok('win rate 0.66 → hard',             tier(66, 34) === 'hard');
    ok('undefeated → hard',                tier(20, 0) === 'hard');
    ok('missing fields do not throw',      tier(undefined, undefined) === 'normal');
    ok('null record is safe',              L.ludoDifficultyTier(null) === 'normal');
}

// ═══════════════════════════════════════════════════════════════════════
head('Scorer priorities');
{
    // A capture must outrank a plain advance of the same length.
    const L = board();
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 3);
    L.place(GREEN, 0, gStep);
    L.place(BLUE, 0, 2);     // 2 -> 3 captures
    L.place(BLUE, 1, 20);    // 20 -> 21 does not
    const moves = L.ludoLegalMoves(BLUE, 1);
    const chosen = L.ludoAIChooseMove(BLUE, moves, 'hard');
    ok('prefers the capture', chosen.captures.length === 1, `picked token ${chosen.token.i}`);
}
{
    // Finishing beats ordinary progress.
    const L = board();
    L.place(BLUE, 0, 54);    // 54 -> 56 finishes
    L.place(BLUE, 1, 20);
    const chosen = L.ludoAIChooseMove(BLUE, L.ludoLegalMoves(BLUE, 2), 'hard');
    ok('prefers finishing a token', chosen.finishes);
}
{
    // A ★ square beats a plain square.
    const L = board();
    L.place(BLUE, 0, 7);     // 7 -> 8, ring 8 is ★
    L.place(BLUE, 1, 30);    // 30 -> 31, a plain square further along
    const chosen = L.ludoAIChooseMove(BLUE, L.ludoLegalMoves(BLUE, 1), 'hard');
    ok('prefers landing on a ★ square', chosen.to === 8, `landed on ${chosen.to}`);
    ok('ring 21 is ★ too, so the plain comparison used ring 31',
       L.LUDO_SAFE_RING.has(21) && !L.LUDO_SAFE_RING.has(31));
}
{
    // Pairing up to form a block beats an equivalent lone advance.
    const L = board();
    L.place(BLUE, 0, 12);
    L.place(BLUE, 1, 11);    // 11 -> 12 pairs with token 0
    L.place(BLUE, 2, 30);    // 30 -> 31 does not
    const moves = L.ludoLegalMoves(BLUE, 1);
    const sPair  = L.ludoScoreMove(BLUE, moves.find(m => m.token.i === 1), 'normal');
    const sAlone = L.ludoScoreMove(BLUE, moves.find(m => m.token.i === 2), 'normal');
    ok('forming a block scores higher than an equal advance', sPair > sAlone,
       `${sPair.toFixed(1)} vs ${sAlone.toFixed(1)}`);
}
{
    // Releasing from base is worth something.
    const L = board();
    L.place(BLUE, 0, 20);
    const moves = L.ludoLegalMoves(BLUE, 6);
    const rel  = moves.find(m => m.release);
    const adv  = moves.find(m => !m.release);
    ok('a release is generated alongside advances', !!rel && !!adv);
    ok('release outscores a mid-board shuffle',
       L.ludoScoreMove(BLUE, rel, 'normal') > L.ludoScoreMove(BLUE, adv, 'normal'));
}

// ═══════════════════════════════════════════════════════════════════════
head('Threat awareness (hard only)');
{
    const L = board();
    // Put a green token 3 squares behind blue's landing square (ring 20).
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 17);
    L.place(GREEN, 0, gStep);
    ok('ring 20 reads as threatened', L.ludoUnderThreat(BLUE, 20));
    ok('a square 9 back is not threatened', !L.ludoUnderThreat(BLUE, 26));

    L.place(BLUE, 0, 19);    // 19 -> 20, exposed
    L.place(BLUE, 1, 30);    // 30 -> 31, out of that token's reach
    const moves = L.ludoLegalMoves(BLUE, 1);
    const exposed = moves.find(m => m.token.i === 0);
    const quiet   = moves.find(m => m.token.i === 1);

    // The tiers differ by exactly the enemy-range term and nothing else, so
    // compare the same move across tiers rather than two different moves.
    const eHard = L.ludoScoreMove(BLUE, exposed, 'hard');
    const eNorm = L.ludoScoreMove(BLUE, exposed, 'normal');
    const qHard = L.ludoScoreMove(BLUE, quiet, 'hard');
    const qNorm = L.ludoScoreMove(BLUE, quiet, 'normal');

    ok('hard docks the exposed square exactly 60', Math.abs((eNorm - eHard) - 60) < 1e-9,
       `normal ${eNorm.toFixed(1)} vs hard ${eHard.toFixed(1)}`);
    ok('normal is blind to the threat — same move, no penalty', eNorm > eHard);
    ok('an unthreatened move scores identically in both tiers', Math.abs(qHard - qNorm) < 1e-9,
       `hard ${qHard.toFixed(1)} vs normal ${qNorm.toFixed(1)}`);
    ok('hard avoids the exposed square in practice',
       L.ludoAIChooseMove(BLUE, moves, 'hard').token.i === 1);
}
{
    const L = board();
    // A token already past its gate cannot come back around to threaten.
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 17);
    L.place(GREEN, 0, gStep);
    ok('an opponent 3 back does threaten', L.ludoUnderThreat(BLUE, 20));
    L.place(GREEN, 0, 49);   // near its own gate; +gap would exceed 50
    ok('an opponent about to turn inward does not threaten',
       !L.ludoUnderThreat(BLUE, L.ludoStepToRing(GREEN, 49) + 3));
    ok('a based opponent does not threaten', !L.ludoUnderThreat(BLUE, 5));
}

// ═══════════════════════════════════════════════════════════════════════
head('Chooser contract');
{
    const L = board();
    ok('no moves → null', L.ludoAIChooseMove(BLUE, [], 'hard') === null);
    ok('undefined move list → null', L.ludoAIChooseMove(BLUE, undefined, 'hard') === null);
    L.place(BLUE, 0, 10);
    const one = L.ludoLegalMoves(BLUE, 3);
    ok('a single move is returned as-is', L.ludoAIChooseMove(BLUE, one, 'easy') === one[0]);
}
{
    // easy is 70% random: over many draws it must NOT always pick the best.
    const L = board();
    const gStep = stepOnRing(L.LUDO_COLORS, GREEN, 3);
    L.place(GREEN, 0, gStep);
    L.place(BLUE, 0, 2);     // the capture
    L.place(BLUE, 1, 20);
    L.place(BLUE, 2, 30);
    const moves = L.ludoLegalMoves(BLUE, 1);
    let bestPicks = 0;
    for (let i = 0; i < 2000; i++) {
        if (L.ludoAIChooseMove(BLUE, moves, 'easy').captures.length) bestPicks++;
    }
    const rate = bestPicks / 2000;
    ok(`easy takes the best move only sometimes (${(rate * 100).toFixed(1)}%)`,
       rate > 0.25 && rate < 0.65, `expected roughly 30% + 70%/3`);

    let hardPicks = 0;
    for (let i = 0; i < 200; i++) {
        if (L.ludoAIChooseMove(BLUE, moves, 'hard').captures.length) hardPicks++;
    }
    ok('hard always takes the best move', hardPicks === 200);
}

// ═══════════════════════════════════════════════════════════════════════
head('Tier strength ordering (head-to-head)');
{
    // Blue plays `a`, Green plays `b`. Returns Blue's win share.
    function duel(a, b, games) {
        const L = load();
        let blueWins = 0;
        for (let g = 0; g < games; g++) {
            L.active = [BLUE, GREEN];
            L.ludoResetTokens();
            L.turn = g % 2;                  // alternate who starts
            let guard = 0;
            while (!L.gameOver && guard++ < 6000) {
                const ci   = L.active[L.turn];
                const tier = ci === BLUE ? a : b;

                // Accumulate the sequence: a 6 buys another die.
                let r = L.ludoRegisterRoll(ci, L.ludoRollDice());
                let rolls = 1;
                while (r.rollAgain && rolls++ < L.LUDO_MAX_DICE + 1) {
                    r = L.ludoRegisterRoll(ci, L.ludoRollDice());
                }
                if (r.voided || r.passed) continue;

                // Then spend it, greediest move first.
                let moves = r.moves, spends = 0;
                while (moves.length && spends++ < 6) {
                    const m = L.ludoAIChooseMove(ci, moves, tier);
                    if (!m) break;
                    const after = L.ludoFinishMove(L.ludoApplyMove(m));
                    if (after.gameOver) break;
                    moves = after.continueTurn ? after.moves : [];
                }
            }
            if (L.ludoStandings()[0] === BLUE) blueWins++;
        }
        return blueWins / games;
    }

    const N = 600;
    const hardVsEasy   = duel('hard', 'easy', N);
    const hardVsNormal = duel('hard', 'normal', N);
    const normalVsEasy = duel('normal', 'easy', N);

    console.log(`     hard vs easy   ${(hardVsEasy * 100).toFixed(1)}%`);
    console.log(`     hard vs normal ${(hardVsNormal * 100).toFixed(1)}%`);
    console.log(`     normal vs easy ${(normalVsEasy * 100).toFixed(1)}%`);

    ok('hard beats easy', hardVsEasy > 0.55, `${(hardVsEasy * 100).toFixed(1)}%`);
    ok('normal beats easy', normalVsEasy > 0.55, `${(normalVsEasy * 100).toFixed(1)}%`);
    ok('hard is at least normal\'s equal', hardVsNormal >= 0.48,
       `${(hardVsNormal * 100).toFixed(1)}%`);
    ok('no tier is a walkover (dice keeps it a game)',
       hardVsEasy < 0.95 && normalVsEasy < 0.95);
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(fail ? 1 : 0);
