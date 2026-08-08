// "The CPU always has the exact roll it needs to capture me, and I always land
// right in front of it." Both are real observations. This measures whether the
// cause is the die or something else.
//
// Two candidate mechanisms that need no dice bias at all:
//   1. OPTIONS. The CPU picks the best of up to (tokens x distinct dice) moves.
//      More tokens on the board and more banked dice means more chances that
//      *one* of them lands on you. It looks like precision; it is breadth.
//   2. THREAT BLINDNESS. On 'hard' the scorer subtracts 60 for finishing within
//      an opponent's reach, so the CPU actively refuses to park in front of you.
//      A human gets no such warning and no such calculation.
const load = require('./load');

const HUMAN = 0, CPU = 2;
const GAMES = 300;

function run(cpuTier, humanTier) {
    const m = {
        [HUMAN]: { turns: 0, moves: 0, capChances: 0, capsTaken: 0, landings: 0, exposed: 0 },
        [CPU]:   { turns: 0, moves: 0, capChances: 0, capsTaken: 0, landings: 0, exposed: 0 },
    };
    let humanWins = 0, done = 0;

    for (let g = 0; g < GAMES; g++) {
        const L = load();
        L.ludoSetMode('cpu2');
        L.ludoResetTokens();
        L.turn = g % 2;
        let guard = 0;

        while (!L.gameOver && guard++ < 20000) {
            const ci = L.active[L.turn];
            const tier = ci === HUMAN ? humanTier : cpuTier;
            m[ci].turns++;

            let r, n = 0;
            do { r = L.ludoRegisterRoll(ci, L.ludoRollDice()); }
            while (r.rollAgain && ++n < L.LUDO_MAX_DICE);
            if (r.voided || r.passed) continue;

            let moves = r.moves, spends = 0;
            while (moves.length && spends++ < 6) {
                m[ci].moves += moves.length;
                if (moves.some(x => x.captures.length)) m[ci].capChances++;

                const mv = L.ludoAIChooseMove(ci, moves, tier);
                if (!mv) break;
                if (mv.captures.length) m[ci].capsTaken++;

                // Did this move park the token where an opponent can reach it?
                if (mv.to <= 50) {
                    const ring = L.ludoStepToRing(ci, mv.to);
                    if (!L.LUDO_SAFE_RING.has(ring)) {
                        m[ci].landings++;
                        if (L.ludoUnderThreat(ci, ring)) m[ci].exposed++;
                    }
                }

                const after = L.ludoFinishMove(L.ludoApplyMove(mv));
                if (after.gameOver) break;
                moves = after.continueTurn ? after.moves : [];
            }
        }
        if (!L.gameOver) continue;
        done++;
        if (L.ludoStandings()[0] === HUMAN) humanWins++;
    }
    return { m, humanWins, done };
}

const pct = (a, b) => (100 * a / b).toFixed(1) + '%';

function report(title, cpuTier, humanTier) {
    const { m, humanWins, done } = run(cpuTier, humanTier);
    console.log('\n' + title);
    console.log('  (CPU plays "' + cpuTier + '", you play "' + humanTier + '")\n');
    console.log('                              YOU        CPU');
    const row = (label, f) =>
        console.log('  ' + label.padEnd(26) + f(HUMAN).padStart(8) + f(CPU).padStart(11));

    row('legal moves per decision', c => (m[c].moves / Math.max(1, m[c].turns)).toFixed(2));
    row('turns with a capture on', c => pct(m[c].capChances, m[c].turns));
    row('captures actually made', c => String(m[c].capsTaken));
    row('landed within enemy reach', c => pct(m[c].exposed, Math.max(1, m[c].landings)));
    console.log('  you win                   ' + pct(humanWins, done).padStart(8));
}

console.log('\n' + '═'.repeat(56));
console.log('  Where the CPU\'s "precision" actually comes from');
console.log('═'.repeat(56));

report('CONTROL — both sides reason identically', 'normal', 'normal');
report('REAL MATCH-UP on hard — only the CPU dodges danger', 'hard', 'normal');
report('REAL MATCH-UP on hard vs a casual player', 'hard', 'easy');

console.log('\n  "landed within enemy reach" is the line that matters. Only the');
console.log('  hard tier subtracts for it, so only the CPU avoids parking in');
console.log('  front of you. You are not being out-rolled there — you are');
console.log('  playing without information the CPU has.\n');
