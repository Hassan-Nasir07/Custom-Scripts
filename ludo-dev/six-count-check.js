// "It is super rare for me to land a single 6 while the CPU rolls double 6."
//
// Every fairness check so far measured the RATE — what fraction of a seat's
// rolls came up 6. That has always been 16.67% for both sides, and it has never
// once matched what the player reports. It cannot, because a rate is not what
// anyone watching a game counts. They count EVENTS: how many sixes showed up on
// their side of the board versus the other side, in the game they just lost.
//
// Rate and count only agree if both seats roll the same number of dice. They do
// not, and the rules are why:
//
//   * a 6 buys another die, so a seat that rolls sixes rolls again
//   * a capture or a token reaching home buys a whole fresh sequence
//   * a seat with tokens on the board can always move, so it never gets a turn
//     cut short - while a seat stuck in base plays exactly one die and is done
//
// All three feed back. Getting out first means more rolls, which means more
// sixes, which means more captures, which means more rolls. This measures the
// size of that compounding at a FAIR die, so "the CPU gets more sixes than me"
// can be answered with the number it actually deserves instead of a rate.
const load = require('./load');

const HUMAN = 0, CPU = 2;
const GAMES = 400;

function run(cpuTier, humanTier) {
    const z = () => ({ rolls: 0, sixes: 0, seqs: 0, baseTurns: 0, baseSixes: 0, caps: 0 });
    const tot = { [HUMAN]: z(), [CPU]: z() };
    // Per-game gaps, so we can talk about a typical game rather than a total.
    const gap = [];
    let humanWins = 0, done = 0, droughts = 0;

    for (let g = 0; g < GAMES; g++) {
        const L = load();
        L.ludoSetMode('cpu2');
        L.ludoResetTokens();
        L.turn = g % 2;
        const per = { [HUMAN]: z(), [CPU]: z() };
        let guard = 0;

        while (!L.gameOver && guard++ < 20000) {
            const ci = L.active[L.turn];
            const tier = ci === HUMAN ? humanTier : cpuTier;
            const stuck = L.tokens.filter(t => t.ci === ci).every(t => t.inBase || t.home);
            if (stuck) per[ci].baseTurns++;
            per[ci].seqs++;

            let r, n = 0;
            do {
                const face = L.ludoRollDice();
                per[ci].rolls++;
                if (face === 6) { per[ci].sixes++; if (stuck) per[ci].baseSixes++; }
                r = L.ludoRegisterRoll(ci, face);
            } while (r.rollAgain && ++n < L.LUDO_MAX_DICE);
            if (r.voided || r.passed) continue;

            let moves = r.moves, spends = 0;
            while (moves.length && spends++ < 6) {
                const mv = L.ludoAIChooseMove(ci, moves, tier);
                if (!mv) break;
                if (mv.captures.length) per[ci].caps++;
                const after = L.ludoFinishMove(L.ludoApplyMove(mv));
                if (after.gameOver) break;
                if (after.continueTurn) { moves = after.moves; continue; }
                if (after.extraRoll) {
                    // A capture bought a fresh sequence: roll it here, inside the
                    // same turn, exactly as ludoBeginTurn does in the live loop.
                    per[ci].seqs++;
                    let r2, n2 = 0;
                    do {
                        const face = L.ludoRollDice();
                        per[ci].rolls++;
                        if (face === 6) per[ci].sixes++;
                        r2 = L.ludoRegisterRoll(ci, face);
                    } while (r2.rollAgain && ++n2 < L.LUDO_MAX_DICE);
                    moves = (r2.voided || r2.passed) ? [] : r2.moves;
                    continue;
                }
                moves = [];
            }
        }
        if (!L.gameOver) continue;
        done++;
        if (L.ludoStandings()[0] === HUMAN) humanWins++;
        if (per[HUMAN].sixes * 2 <= per[CPU].sixes) droughts++;   // CPU saw 2x+ your sixes
        gap.push(per[CPU].sixes - per[HUMAN].sixes);
        [HUMAN, CPU].forEach(c => Object.keys(tot[c]).forEach(k => { tot[c][k] += per[c][k]; }));
    }
    return { tot, humanWins, done, droughts, gap };
}

const f2 = n => n.toFixed(2);
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%';

function report(title, cpuTier, humanTier) {
    const { tot, humanWins, done, droughts, gap } = run(cpuTier, humanTier);
    const sorted = gap.slice().sort((a, b) => a - b);
    console.log('\n' + title);
    console.log('  (CPU plays "' + cpuTier + '", you play "' + humanTier + '")\n');
    console.log('                                  YOU        CPU');
    const row = (label, f) =>
        console.log('  ' + label.padEnd(30) + f(HUMAN).padStart(8) + f(CPU).padStart(11));

    row('dice rolled per game', c => f2(tot[c].rolls / done));
    row('SIXES SEEN PER GAME', c => f2(tot[c].sixes / done));
    row('six rate (the fair 16.67%)', c => pct(tot[c].sixes, tot[c].rolls));
    row('turns stuck in base', c => f2(tot[c].baseTurns / done));
    row('captures made', c => f2(tot[c].caps / done));
    console.log('  you win                       ' + pct(humanWins, done).padStart(8));
    console.log('  games where the CPU saw 2x+ your sixes: '
        + pct(droughts, done) + '  (median gap ' + sorted[sorted.length >> 1] + ' sixes)');
}

console.log('\n' + '='.repeat(58));
console.log('  Sixes COUNTED, not rated - which is what you actually see');
console.log('='.repeat(58));

report('CONTROL - both sides reason identically', 'normal', 'normal');
report('REAL MATCH-UP on hard', 'hard', 'normal');
report('REAL MATCH-UP on hard vs a casual player', 'hard', 'easy');

console.log('\n  If "six rate" is flat but "SIXES SEEN PER GAME" is not, the die is');
console.log('  fair and the rules are compounding: a 6 buys another die, a capture');
console.log('  buys a fresh sequence, and a seat stuck in base rolls once per turn');
console.log('  and stops. Whoever gets ahead rolls more, so they see more sixes.');
console.log('  That is a real advantage and it is not in the random number.\n');
