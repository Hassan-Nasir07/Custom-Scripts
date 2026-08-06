// Bug hunt: measure the dice through the LIVE path, not the shortcut.
//
// fairness-check.js calls ludoRollDice/ludoRegisterRoll directly. Real play goes
// tap -> ludoDoRoll -> tumble frames -> ludoSettleRoll -> ludoRegisterRoll, and
// the tumble burns a Math.random every frame for the flicker. If anything in
// that pipeline treats the two seats differently, the direct-call test could
// never have seen it. This drives the actual animation loop instead.
//
// Rolls are harvested from ludoRecap, which ludoAdvanceTurn snapshots with the
// colour that rolled them — so this counts what the engine really produced, not
// what this script asked for.
const canvasStub = require('./canvas-stub');
const stub = {
    width: 0, height: 0,
    getContext: () => canvasStub(344, 416).ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 344, height: 416 }),
    addEventListener() {}, removeEventListener() {},
};
global.document = { getElementById: id => (id === 'ludo-canvas' ? stub : null) };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
};
global.awardGameXP = () => {};
global.getFrameInterval = () => 0;

const load = require('./load');
const HUMAN = 0, CPU = 2;
const GAMES = parseInt(process.argv[2] || '300', 10);
const HUMAN_TIER = process.argv[3] || 'normal';

const faces = { [HUMAN]: [0, 0, 0, 0, 0, 0, 0], [CPU]: [0, 0, 0, 0, 0, 0, 0] };
let blowouts = 0, humanWins = 0, finished = 0, humanHomeTotal = 0;

for (let g = 0; g < GAMES; g++) {
    const L = load();
    L.ludoSetMode('cpu2');
    L.startLudoGame();

    let guard = 0, lastRecap = null;
    while (L.phase !== 'over' && guard++ < 300000) {
        L.ludoUpdate(16);

        // ludoAdvanceTurn makes a fresh recap object per handover, so identity
        // comparison is enough to spot a new one.
        if (L.recap && L.recap !== lastRecap) {
            lastRecap = L.recap;
            L.recap.faces.forEach(f => { if (faces[L.recap.ci]) faces[L.recap.ci][f]++; });
        }

        // Play the human seat with perfect reflexes; the CPU drives itself off
        // its own pending timers, exactly as in the browser.
        if (L.active[L.turn] === HUMAN) {
            if (L.phase === 'awaitRoll') L.ludoDoRoll();
            else if (L.phase === 'awaitMove' && L.legal.length) {
                const m = L.ludoAIChooseMove(HUMAN, L.legal, HUMAN_TIER);
                if (m) L.ludoPlayMove(m);
            }
        }
    }
    if (L.phase !== 'over') continue;
    finished++;
    const home = L.ludoTokensHome(HUMAN);
    humanHomeTotal += home;
    if (home === 0) blowouts++;
    if (L.ludoStandings()[0] === HUMAN) humanWins++;
}

const sum = a => a.reduce((x, y) => x + y, 0);
const hN = sum(faces[HUMAN]), cN = sum(faces[CPU]);
const pct = (n, d) => (100 * n / d).toFixed(2) + '%';

console.log(`\nLIVE loop: ${finished}/${GAMES} games, human plays at "${HUMAN_TIER}"\n`);
console.log('  rolls harvested     you ' + hN + '   CPU ' + cN);
console.log('\n  face      you        CPU      (fair 16.67%)');
for (let f = 1; f <= 6; f++) {
    console.log('    ' + f + '   ' + pct(faces[HUMAN][f], hN).padStart(8) +
                pct(faces[CPU][f], cN).padStart(11));
}

const p1 = faces[HUMAN][6] / hN, p2 = faces[CPU][6] / cN;
const pool = (faces[HUMAN][6] + faces[CPU][6]) / (hN + cN);
const z = (p1 - p2) / Math.sqrt(pool * (1 - pool) * (1 / hN + 1 / cN));
console.log('\n  six-rate z-score  ' + z.toFixed(3) + '   ' +
    (Math.abs(z) < 1.96 ? 'within noise' : '*** SIGNIFICANT — REAL BUG ***'));

console.log('\n  your results');
console.log('    win rate            ' + pct(humanWins, finished));
console.log('    0/4 wipeouts        ' + pct(blowouts, finished) +
            '   (' + blowouts + ' of ' + finished + ')');
console.log('    avg tokens home     ' + (humanHomeTotal / finished).toFixed(2) + ' / 4');
const p = blowouts / finished;
console.log('    two 0/4 in a row    ' + (100 * p * p).toFixed(2) + '% likely at this rate\n');

process.exit(Math.abs(z) < 1.96 ? 0 : 1);
