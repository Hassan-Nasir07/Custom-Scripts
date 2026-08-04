// Phase 1 geometry verification for the Ludo board tables.
// Loads ludo-core.js (pure data + pure functions; no canvas touched) and asserts
// the ring, home columns, safe squares and quadrants are mutually consistent.
const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'ludo-core.js'), 'utf8');
const L = new Function(src + `
    return { LUDO_RING, LUDO_COLORS, LUDO_SAFE_RING, LUDO_START_OWNER, LUDO_HOME_STEP,
             LUDO_GRID, ludoStepToCell, ludoStepToRing };
`)();

let pass = 0, fail = 0;
const ok  = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else      { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const key = c => `${c.r},${c.c}`;
const adj = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
const diag = (a, b) => Math.abs(a.r - b.r) === 1 && Math.abs(a.c - b.c) === 1;

const RING = L.LUDO_RING, COLS = L.LUDO_COLORS;

// The canonical Ludo track turns diagonally at each of the four 6×6 base
// corners: the arm's outer row ends one cell short of the next arm's outer
// column, so the path wraps the quadrant corner. Exactly 4 such steps exist,
// and each must pivot on a real quadrant corner (never through the centre).
const inCentre3x3 = c => c.r >= 6 && c.r <= 8 && c.c >= 6 && c.c <= 8;
const quadCorners = new Set();
COLS.forEach(col => {
    const q = col.quad;                       // half-open: r0..r1, c0..c1
    [[q.r0, q.c0], [q.r0, q.c1 - 1], [q.r1 - 1, q.c0], [q.r1 - 1, q.c1 - 1]]
        .forEach(([r, c]) => quadCorners.add(`${r},${c}`));
});

console.log('\n── Ring ──────────────────────────────────────────');
ok('52 squares', RING.length === 52, `got ${RING.length}`);
ok('all squares distinct', new Set(RING.map(key)).size === RING.length);
ok('in bounds', RING.every(c => c.r >= 0 && c.r < 15 && c.c >= 0 && c.c < 15));

const breaks = [], diagonals = [];
for (let i = 0; i < RING.length; i++) {
    const a = RING[i], b = RING[(i + 1) % RING.length];
    if (adj(a, b)) continue;
    if (diag(a, b)) { diagonals.push({ i, a, b }); continue; }
    breaks.push(`${i}->${(i + 1) % RING.length} (${key(a)})->(${key(b)})`);
}
ok('closed loop, no gaps', breaks.length === 0, breaks.join('; '));
ok('exactly 4 corner turns', diagonals.length === 4, `got ${diagonals.length}`);
const badPivots = diagonals.filter(({ a, b }) => {
    // The two cells sharing an edge with both a and b: one must be a base
    // corner (the cell being wrapped), the other the centre block.
    const p1 = { r: a.r, c: b.c }, p2 = { r: b.r, c: a.c };
    const wraps  = [p1, p2].filter(p => quadCorners.has(key(p)));
    const inside = [p1, p2].filter(inCentre3x3);
    return wraps.length !== 1 || inside.length !== 1;
});
ok('every corner turn wraps a base quadrant, not the centre', badPivots.length === 0,
   badPivots.map(({ a, b }) => `${key(a)}->${key(b)}`).join(' '));

const onArm = c => (c.r >= 6 && c.r <= 8) || (c.c >= 6 && c.c <= 8);
ok('every square sits on a cross arm', RING.every(onArm));
ok('no square inside the centre 3×3', !RING.some(inCentre3x3));

console.log('\n── Starts & gates ────────────────────────────────');
ok('start indices are 0/13/26/39',
   COLS.map(c => c.startIndex).join(',') === '0,13,26,39',
   COLS.map(c => c.startIndex).join(','));

COLS.forEach(col => {
    const gate = RING[(col.startIndex + 50) % 52];
    ok(`${col.label}: step 50 gate ${key(gate)} is adjacent to its home column`,
       adj(gate, col.homeCol[0]), `homeCol[0]=${key(col.homeCol[0])}`);
});

console.log('\n── Home columns ──────────────────────────────────');
const allHome = [];
COLS.forEach(col => {
    ok(`${col.label}: 5 cells`, col.homeCol.length === 5);
    const contiguous = col.homeCol.every((c, i) => i === 0 || adj(col.homeCol[i - 1], c));
    ok(`${col.label}: contiguous run`, contiguous);
    // The 5-cell column ends one step short of the centre block; step 56 moves
    // the token off-grid into the triangle, so "touching the 3×3" is the invariant.
    const last = col.homeCol[4];
    const touchesCentre = [{ r: last.r - 1, c: last.c }, { r: last.r + 1, c: last.c },
                           { r: last.r, c: last.c - 1 }, { r: last.r, c: last.c + 1 }]
                          .some(inCentre3x3);
    ok(`${col.label}: last cell ${key(last)} touches the centre 3×3`, touchesCentre);
    ok(`${col.label}: column runs inward (starts at the rim)`,
       col.homeCol[0].r === 7 || col.homeCol[0].c === 7);
    allHome.push(...col.homeCol.map(key));
});
ok('home columns do not overlap each other', new Set(allHome).size === allHome.length);
const ringSet = new Set(RING.map(key));
ok('home columns never touch the shared ring', !allHome.some(k => ringSet.has(k)));

console.log('\n── Safe squares ──────────────────────────────────');
const expectSafe = new Set();
COLS.forEach(c => { expectSafe.add(c.startIndex); expectSafe.add((c.startIndex + 8) % 52); });
const gotSafe = [...L.LUDO_SAFE_RING].sort((a, b) => a - b).join(',');
ok('safe = 4 starts + 4 stars (start+8)',
   gotSafe === [...expectSafe].sort((a, b) => a - b).join(','), gotSafe);
ok('8 safe squares', L.LUDO_SAFE_RING.size === 8, `got ${L.LUDO_SAFE_RING.size}`);

console.log('\n── Full walk, step 0 → 56 ────────────────────────');
COLS.forEach((col, ci) => {
    const cells = [];
    for (let s = 0; s <= 55; s++) cells.push(L.ludoStepToCell(ci, s));
    const nulls = cells.filter(c => !c).length;
    ok(`${col.label}: steps 0–55 all resolve to a cell`, nulls === 0, `${nulls} null`);
    const jumps = [], turns = [];
    for (let s = 1; s <= 55; s++) {
        if (adj(cells[s - 1], cells[s])) continue;
        (diag(cells[s - 1], cells[s]) ? turns : jumps).push(`${s - 1}→${s}`);
    }
    ok(`${col.label}: the whole walk is continuous`, jumps.length === 0, jumps.join(','));
    ok(`${col.label}: 4 corner turns, all on the ring leg`,
       turns.length === 4, turns.join(','));
    ok(`${col.label}: gate → home column (50→51) is a straight step`,
       adj(cells[50], cells[51]));
    ok(`${col.label}: step 0 is its own start square`,
       key(cells[0]) === key(RING[col.startIndex]));
    ok(`${col.label}: steps 51–55 are its OWN home column`,
       cells.slice(51, 56).map(key).join('|') === col.homeCol.map(key).join('|'));
    ok(`${col.label}: step 56 is the centre (null cell)`, L.ludoStepToCell(ci, 56) === null);
    const distinct = new Set(cells.map(key));
    ok(`${col.label}: never revisits a square`, distinct.size === 56, `${distinct.size}/56`);
});

console.log('\n── Quadrants & bases ─────────────────────────────');
COLS.forEach(col => {
    const q = col.quad;
    ok(`${col.label}: quadrant is 6×6`, (q.r1 - q.r0) === 6 && (q.c1 - q.c0) === 6);
    const inQuad = p => p.r >= q.r0 && p.r <= q.r1 && p.c >= q.c0 && p.c <= q.c1;
    ok(`${col.label}: 4 base slots inside the quadrant`,
       col.baseSlots.length === 4 && col.baseSlots.every(inQuad));
    const hits = RING.filter(c => c.r >= q.r0 && c.r < q.r1 && c.c >= q.c0 && c.c < q.c1);
    ok(`${col.label}: no ring square inside the quadrant`, hits.length === 0,
       hits.map(key).join(' '));
});

console.log('\n── Ring index ↔ step round-trip ──────────────────');
let rt = true;
COLS.forEach((col, ci) => {
    for (let s = 0; s <= 50; s++) {
        if (L.ludoStepToRing(ci, s) !== (col.startIndex + s) % 52) rt = false;
    }
    if (L.ludoStepToRing(ci, 51) !== -1 || L.ludoStepToRing(ci, -1) !== -1) rt = false;
});
ok('ludoStepToRing agrees with ludoStepToCell over 0–50, -1 off-ring', rt);

console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(fail ? 1 : 0);
