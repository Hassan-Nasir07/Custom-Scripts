// "Is the CPU cheating on the dice?" — measured, not asserted.
//
// Plays a large number of real PvCPU games through the engine and counts, per
// seat: rolls, sixes, six-rate, and how many turns each side needed to get its
// first token out. If the CPU were favoured in any way this is where it shows.
const load = require('./load');

const HUMAN = 0, CPU = 2;
const GAMES = 400;

const stat = () => ({ rolls: 0, sixes: 0, faces: [0, 0, 0, 0, 0, 0, 0], firstOut: [] });
const s = { [HUMAN]: stat(), [CPU]: stat() };

for (let g = 0; g < GAMES; g++) {
    const L = load();
    L.ludoSetMode('cpu2');
    L.ludoResetTokens();
    L.turn = g % 2;                      // alternate who starts

    const turnsTaken = { [HUMAN]: 0, [CPU]: 0 };
    const out = { [HUMAN]: null, [CPU]: null };
    let guard = 0;

    while (!L.gameOver && guard++ < 20000) {
        const ci = L.active[L.turn];
        turnsTaken[ci]++;

        // Roll out the whole sequence (a 6 buys another die).
        let r, rolls = 0;
        do {
            const face = L.ludoRollDice();
            s[ci].rolls++;
            s[ci].faces[face]++;
            if (face === 6) s[ci].sixes++;
            r = L.ludoRegisterRoll(ci, face);
        } while (r.rollAgain && ++rolls < L.LUDO_MAX_DICE);

        if (r.voided || r.passed) continue;

        // Both seats play with the same scorer, so strategy is not a variable.
        let moves = r.moves, spends = 0;
        while (moves.length && spends++ < 6) {
            const m = L.ludoAIChooseMove(ci, moves, 'normal');
            if (!m) break;
            const after = L.ludoFinishMove(L.ludoApplyMove(m));
            if (after.gameOver) break;
            moves = after.continueTurn ? after.moves : [];
        }

        [HUMAN, CPU].forEach(c => {
            if (out[c] === null && L.tokens.some(t => t.ci === c && !t.inBase)) {
                out[c] = turnsTaken[c];
            }
        });
    }
    [HUMAN, CPU].forEach(c => { if (out[c] !== null) s[c].firstOut.push(out[c]); });
}

const pct = (n, d) => (100 * n / d).toFixed(2) + '%';
const mean = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);

console.log(`\n${GAMES} full PvCPU games, both seats using the same scorer\n`);
console.log('                        YOU (blue)      CPU (green)');
console.log('  total rolls        ' + String(s[HUMAN].rolls).padStart(12) + String(s[CPU].rolls).padStart(17));
console.log('  sixes rolled       ' + String(s[HUMAN].sixes).padStart(12) + String(s[CPU].sixes).padStart(17));
console.log('  six rate           ' + pct(s[HUMAN].sixes, s[HUMAN].rolls).padStart(12) +
            pct(s[CPU].sixes, s[CPU].rolls).padStart(17) + '     (fair = 16.67%)');
console.log('  turns to 1st token ' + mean(s[HUMAN].firstOut).padStart(12) + mean(s[CPU].firstOut).padStart(17));

console.log('\n  full face distribution (fair = 16.67% each)');
for (let f = 1; f <= 6; f++) {
    console.log('    ' + f + '  ' + pct(s[HUMAN].faces[f], s[HUMAN].rolls).padStart(9) +
                pct(s[CPU].faces[f], s[CPU].rolls).padStart(17));
}

// Two-proportion z-test on the six rates. |z| > 1.96 would be a real difference
// at 95% confidence; anything under that is noise.
const p1 = s[HUMAN].sixes / s[HUMAN].rolls, n1 = s[HUMAN].rolls;
const p2 = s[CPU].sixes / s[CPU].rolls,     n2 = s[CPU].rolls;
const pool = (s[HUMAN].sixes + s[CPU].sixes) / (n1 + n2);
const z = (p1 - p2) / Math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2));
console.log('\n  z-score for the difference in six rates: ' + z.toFixed(3));
console.log('  ' + (Math.abs(z) < 1.96
    ? 'Within noise — no measurable advantage to either side.'
    : '*** SIGNIFICANT DIFFERENCE — investigate. ***'));

// How often does a fair die simply refuse to give you a 6? This is the number
// that actually explains the feeling.
console.log('\n  with a perfectly fair die, chance of NO six in N turns stuck in base:');
[3, 5, 8, 10, 15].forEach(n =>
    console.log('    ' + String(n).padStart(2) + ' turns   ' +
                (100 * Math.pow(5 / 6, n)).toFixed(1) + '%'));

process.exit(Math.abs(z) < 1.96 ? 0 : 1);
