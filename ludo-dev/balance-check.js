// The dice are fair (see fairness-check.js). This asks the different question:
// how one-sided are the RESULTS, and what actually drives that?
//
// Both seats play with the same scorer and the same tier, so any imbalance here
// is the game's structure, not skill and not the RNG.
const load = require('./load');

const A = 0, B = 2;
const GAMES = 600;

let aWins = 0, blowouts = 0, games = 0;
let firstOutWon = 0, firstOutCounted = 0;
let capsByWinner = 0, capsByLoser = 0;
let tripleSix = 0, pipsBurned = 0, totalTurns = 0;
const marginHist = {};                    // tokens the loser got home

for (let g = 0; g < GAMES; g++) {
    const L = load();
    L.active = [A, B];
    L.ludoResetTokens();
    L.turn = g % 2;

    let firstOut = null;
    let guard = 0;

    while (!L.gameOver && guard++ < 20000) {
        const ci = L.active[L.turn];
        totalTurns++;

        // Roll the sequence out, tracking what a triple six costs.
        let r, rolls = 0, banked = 0;
        do {
            const face = L.ludoRollDice();
            r = L.ludoRegisterRoll(ci, face);
            if (r.voided) { tripleSix++; pipsBurned += banked; }
            else banked += face;
        } while (r.rollAgain && ++rolls < L.LUDO_MAX_DICE);

        if (r.voided || r.passed) continue;

        let moves = r.moves, spends = 0;
        while (moves.length && spends++ < 6) {
            const m = L.ludoAIChooseMove(ci, moves, 'normal');
            if (!m) break;
            const after = L.ludoFinishMove(L.ludoApplyMove(m));
            if (after.gameOver) break;
            moves = after.continueTurn ? after.moves : [];
        }

        if (firstOut === null) {
            const outA = L.tokens.some(t => t.ci === A && !t.inBase);
            const outB = L.tokens.some(t => t.ci === B && !t.inBase);
            if (outA !== outB) firstOut = outA ? A : B;
        }
    }
    if (!L.gameOver) continue;
    games++;

    const winner = L.ludoStandings()[0];
    const loser  = winner === A ? B : A;
    if (winner === A) aWins++;

    const loserHome = L.ludoTokensHome(loser);
    marginHist[loserHome] = (marginHist[loserHome] || 0) + 1;
    if (loserHome === 0) blowouts++;

    capsByWinner += L.stats[winner].captures;
    capsByLoser  += L.stats[loser].captures;

    if (firstOut !== null) {
        firstOutCounted++;
        if (firstOut === winner) firstOutWon++;
    }
}

const pct = (n, d) => (100 * n / d).toFixed(1) + '%';

console.log(`\n${games} games, both seats identical (same scorer, same tier)\n`);
console.log('  seat A win rate              ' + pct(aWins, games) + '   (fair = 50%)');
console.log('  games where the loser got');
console.log('  ZERO tokens home             ' + pct(blowouts, games) + '   <- the "one-sided" feeling');

console.log('\n  how close the games were (tokens the loser got home):');
for (let k = 0; k <= 3; k++) {
    const n = marginHist[k] || 0;
    console.log('    ' + k + '/4  ' + String(n).padStart(4) + '  ' + pct(n, games).padStart(7) +
                '  ' + '#'.repeat(Math.round(60 * n / games)));
}

console.log('\n  whoever got a token out first went on to win  ' +
            pct(firstOutWon, firstOutCounted) +
            '   (no snowball = 50%)');

console.log('\n  captures per game   by winner ' + (capsByWinner / games).toFixed(2) +
            '   by loser ' + (capsByLoser / games).toFixed(2) +
            '   ratio ' + (capsByWinner / Math.max(1, capsByLoser)).toFixed(2) + 'x');

console.log('\n  triple-six forfeits   ' + tripleSix + ' in ' + totalTurns + ' turns (' +
            pct(tripleSix, totalTurns) + ' of turns)');
console.log('  pips burned by them   ' + pipsBurned +
            '  (avg ' + (pipsBurned / Math.max(1, tripleSix)).toFixed(1) + ' per forfeit)');
console.log('  NOTE: banked dice are lost too, which real Ludo does not do —');
console.log('        there you keep the moves you already made on the first two 6s.\n');
