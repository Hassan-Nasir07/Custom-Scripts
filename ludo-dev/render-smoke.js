// Drives ludoRender() against a recording 2D-context stub so typos and
// undefined references in the drawing code surface without a browser.
const fs = require('fs');
const calls = {};
const rec = new Proxy({}, {
  get: (_, k) => {
    if (k === 'canvas') return { width: 368, height: 368 };
    return (...a) => { calls[k] = (calls[k] || 0) + 1; };
  },
  set: (_, k, v) => { calls['set:' + k] = (calls['set:' + k] || 0) + 1; return true; },
});
global.document = { getElementById: id => id === 'ludo-canvas' ? { getContext: () => rec } : null };

const src = fs.readFileSync('ludo-core.js', 'utf8');
const api = new Function(src + `
  return { ludoRender, ludoResetTokens, LUDO_COLORS, LUDO_HOME_STEP,
           set active(v) { ludoActive = v; }, set turn(v) { ludoTurn = v; },
           set debug(v) { ludoDebugRing = v; },
           tokens: () => ludoTokens, place: (k, s, h) => {
             const t = ludoTokens[k]; t.inBase = false; t.step = s; t.home = !!h; } };
`)();

let fails = 0;
const t = (name, fn) => {
  try { fn(); console.log('  \u2713 ' + name); }
  catch (e) { fails++; console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
};

console.log('\n-- render smoke ------------------------------');
[[0,2],[0,1,2],[0,1,2,3]].forEach(a => {
  t(`renders with ${a.length} active players`, () => {
    api.active = a; api.turn = 0; api.ludoResetTokens(); api.ludoRender();
  });
});
t('renders with ring-index overlay on', () => { api.debug = true; api.ludoRender(); api.debug = false; });
t('renders tokens on ring, home column and centre', () => {
  api.active = [0,1,2,3]; api.ludoResetTokens();
  api.place(0, 0); api.place(1, 50); api.place(2, 53); api.place(3, api.LUDO_HOME_STEP, true);
  api.ludoRender();
});
t('renders every step 0..56 for all four colours', () => {
  api.active = [0,1,2,3];
  for (let ci = 0; ci < 4; ci++) {
    api.ludoResetTokens();
    for (let s = 0; s <= 56; s++) { api.place(ci * 4, s, s === 56); api.ludoRender(); }
  }
});
console.log(`\n  fill=${calls.fill} stroke=${calls.stroke} fillRect=${calls.fillRect} fillText=${calls.fillText} arc=${calls.arc}`);
console.log(`  ${fails ? fails + ' FAILED' : 'all render paths clean'}\n`);
process.exit(fails ? 1 : 0);
