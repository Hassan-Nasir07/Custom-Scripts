// Phase 7 verification: mode cycling, active colour sets, CPU seat assignment.
const load = require('./load');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else      { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);

head('Mode cycling');
{
    const L = load();
    L.ludoSetMode('cpu2');
    ok('starts on PvCPU', L.mode === 'cpu2');
    ok('cycles to PvP 2P', L.cycleLudoMode() === 'pvp2');
    ok('then PvP 3P',      L.cycleLudoMode() === 'pvp3');
    ok('then PvP 4P',      L.cycleLudoMode() === 'pvp4');
    ok('and wraps to PvCPU', L.cycleLudoMode() === 'cpu2');
    ok('an unknown mode is ignored',
       (L.ludoSetMode('nonsense'), L.mode === 'cpu2'));
}

head('Active colours per mode');
{
    const L = load();
    const check = (m, expected, label) => {
        L.ludoSetMode(m);
        ok(`${label}: active = [${expected}]`, L.active.join() === expected.join(),
           `got [${L.active.join()}]`);
        ok(`${label}: ${expected.length * 4} tokens on the board`,
           L.tokens.length === expected.length * 4);
        ok(`${label}: every token starts in base`, L.tokens.every(t => t.inBase));
        ok(`${label}: turn starts at seat 0`, L.turn === 0);
    };
    check('cpu2', [0, 2], 'PvCPU');
    check('pvp2', [0, 2], 'PvP 2P');
    check('pvp3', [0, 1, 2], 'PvP 3P');
    check('pvp4', [0, 1, 2, 3], 'PvP 4P');
}
{
    const L = load();
    L.ludoSetMode('pvp2');
    ok('2P uses the diagonal pair, not adjacent quadrants',
       L.active[0] === 0 && L.active[1] === 2);
    const gap = Math.abs(L.LUDO_COLORS[0].startIndex - L.LUDO_COLORS[2].startIndex);
    ok('so both starts are 26 squares apart', gap === 26, `gap=${gap}`);
}

head('Turn order');
{
    const L = load();
    L.ludoSetMode('pvp4');
    const seen = [];
    for (let i = 0; i < 4; i++) { seen.push(L.active[L.turn]); L.ludoAdvanceTurn(); }
    ok('4P rotates clockwise blue → red → green → yellow',
       seen.join() === '0,1,2,3', seen.join());
    ok('and wraps back to blue', L.active[L.turn] === 0);
}
{
    const L = load();
    L.ludoSetMode('pvp3');
    const seen = [];
    for (let i = 0; i < 3; i++) { seen.push(L.active[L.turn]); L.ludoAdvanceTurn(); }
    ok('3P skips the unused quadrant', seen.join() === '0,1,2', seen.join());
}

head('CPU seats');
{
    const L = load();
    L.ludoSetMode('cpu2');
    ok('the human holds Blue', L.LUDO_HUMAN_CI === 0 && !L.ludoIsCPUSeat(0));
    ok('the CPU holds Green', L.ludoIsCPUSeat(2));

    ['pvp2', 'pvp3', 'pvp4'].forEach(m => {
        L.ludoSetMode(m);
        ok(`${m}: no seat is CPU-controlled`, L.active.every(ci => !L.ludoIsCPUSeat(ci)));
    });
}

head('Switching mode resets cleanly');
{
    const L = load();
    L.ludoSetMode('pvp4');
    L.place(0, 0, 30);
    L.place(1, 0, 56);
    L.ludoRegisterRoll(0, 6);
    L.ludoSetMode('cpu2');
    ok('tokens are back in base', L.tokens.every(t => t.inBase && t.step === -1));
    ok('no placements carried over', L.placements.length === 0);
    ok('roll cleared', L.roll === 0);
    ok('six streak cleared', L.sixStreak === 0);
    ok('gameOver cleared', L.gameOver === false);
    ok('per-player stats reinitialised',
       L.active.every(ci => L.stats[ci].captures === 0 && L.stats[ci].lost === 0));
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(fail ? 1 : 0);
