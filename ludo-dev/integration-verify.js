// Static audit of the Ludo integration inside AttendanceTimeCheckerPlus.js.
//
// The engine itself is covered by the headless suites; this checks the wiring
// the plan says must exist — every switch case, every DOM id, every cloud-sync
// field — so a missed case or a leaderboard column/colspan mismatch is caught
// here rather than in the portal.
//
//   node ludo-dev/integration-verify.js
const fs = require('fs');
const path = require('path');

const TARGET = path.join(__dirname, '..', 'AttendanceTimeCheckerPlus.js');
const src = fs.readFileSync(TARGET, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
};
const has = s => src.indexOf(s) !== -1;
const all = arr => arr.every(has);
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 44 - t.length)));

head('Engine block');
ok('inserted before GAME SWITCHING SYSTEM',
   src.indexOf('const LUDO_RING') !== -1 &&
   src.indexOf('const LUDO_RING') < src.indexOf('// GAME SWITCHING SYSTEM'));
ok('lifecycle functions present',
   ['initLudoGame', 'resetLudoGame', 'startLudoGame', 'cleanupLudoGame',
    'endLudoGame', 'cycleLudoModeAndReset', 'toggleLudoMaximize',
    'updateLudoScoreboard'].every(f => new RegExp('function\\s+' + f + '\\b').test(src)));
ok('canvas constants are 344 x 416',
   /LUDO_CANVAS_W\s*=\s*344/.test(src) && /LUDO_STRIP_H\s*=\s*58/.test(src));
ok('safe squares excluded from blocks (the stuck-token fix)',
   /if \(ri < 0 \|\| LUDO_SAFE_RING\.has\(ri\)\) return;/.test(src));
ok('render scales off canvas.width so the Max modal stays crisp',
   /canvas\.width \|\| LUDO_CANVAS_W\) \/ LUDO_CANVAS_W/.test(src));

head('Game switcher plumbing');
ok('cleanupCurrentGame has a ludo case',
   /case 'ludo':[\s\S]{0,400}?cleanupLudoGame\(\)/.test(src));
ok('initCurrentGame has a ludo case',
   /case 'ludo':[\s\S]{0,300}?initLudoGame\(\)/.test(src));
ok('ludo-canvas hidden alongside the others',
   has('[snakeCv, flappyCv, tetrisCv, breakoutCv, poolCv, ludoCv]'));
ok('updateGameSwitcher ids include ludo', has("'pool', 'ludo', 'prayer'"));
ok('ctrlIds include ludo-controls',   has("'pool-controls', 'ludo-controls'"));
ok('statIds include ludo-scoreboard', has("'pool-scoreboard', 'ludo-scoreboard'"));
ok('updateGameControls reveals both ludo panels',
   /case 'ludo':[\s\S]{0,320}?ludo-controls[\s\S]{0,220}?ludo-scoreboard/.test(src));
ok('updateGameTitle has a ludo case', /case 'ludo':[\s\S]{0,140}?Ludo';/.test(src));

head('Panel HTML');
ok('switcher button', has('id="game-switch-ludo"') && has("window.switchGame('ludo')"));
ok('canvas element 344x416', has('<canvas id="ludo-canvas" width="344" height="416"'));
ok('scoreboard with all three spans',
   all(['id="ludo-scoreboard"', 'id="ludo-mode-label"',
        'id="ludo-home-label"', 'id="ludo-turn-label"']));
ok('controls with all four buttons',
   all(['id="ludo-controls"', 'window.cycleLudoModeBtn()', 'window.startLudoGameBtn()',
        'window.resetLudoGameBtn()', 'window.toggleLudoMaximizeBtn()']));

head('CSS / keyboard / bridges');
ok('#ludo-canvas rule with the right aspect ratio',
   /#ludo-canvas\s*\{[\s\S]*?aspect-ratio:\s*344\s*\/\s*416/.test(src));
ok('.ludo-rule-toggles styled', has('.ludo-rule-toggles'));
ok("keyboard '9' switches to ludo", has("case '9': window.switchGame('ludo'); break;"));
ok("keyboard '8' is still leaderboard", has("case '8': window.switchGame('leaderboard'); break;"));
ok('Escape resets ludo', has("case 'ludo': resetLudoGame(); break;"));
ok('all four window bridges defined',
   ['startLudoGameBtn', 'resetLudoGameBtn', 'cycleLudoModeBtn', 'toggleLudoMaximizeBtn']
   .every(b => has('window.' + b + ' =')));

head('Shared Max modal (Pool migration)');
ok('toggleGameMaxModal exists', has('function toggleGameMaxModal(cfg)'));
ok('Pool now calls it',
   /function togglePoolMaximize\(\)\s*\{[\s\S]{0,320}?toggleGameMaxModal\(\{/.test(src));
ok('Pool keeps its original 2x buffer',
   /canvasId: 'pool-canvas'[\s\S]{0,220}?bufferW: POOL_W[\s\S]{0,90}?bufferH: POOL_CANVAS_H/.test(src));
ok('Ludo passes its own buffer',
   /canvasId: 'ludo-canvas'[\s\S]{0,220}?bufferW: LUDO_CANVAS_W/.test(src));
ok('old per-Pool modal state fully removed',
   !has('poolOriginalStyles') && !has('poolModalOverlay') && !has('poolModalPlaceholder'));
ok('.pool-modal-* classes reused, not renamed', has("className = 'pool-modal-overlay'"));
ok('switching away closes the Pool modal', has('if (poolMaximized) togglePoolMaximize();'));
ok('switching away closes the Ludo modal', has('if (ludoMaximized) toggleLudoMaximize();'));

head('Preferences and storage');
ok('four flat rule flags in userPreferences',
   all(['ludoBlocks: true', 'ludoThreeSixes: true',
        'ludoExactHome: true', 'ludoFreeRelease: false']));
ok('settings modal exposes all four',
   all(['data-pref="ludoBlocks"', 'data-pref="ludoThreeSixes"',
        'data-pref="ludoExactHome"', 'data-pref="ludoFreeRelease"']));
ok('storage helpers live in the engine block',
   has('function ludoLoadWins()') && has('function ludoSaveRecord(rec)'));

head('Board rotation');
ok('ludoRotation default in userPreferences', has('ludoRotation: 0'));
ok('rotation select in the settings modal', has('data-pref="ludoRotation"'));
ok('all four orientations offered',
   (src.match(/<option value="[0-3]"[^>]*>Blue /g) || []).length === 4);
ok('the select is stored as a number, not a string',
   /numericPrefs = \['gameFps', 'ludoRotation'\]/.test(src));
ok('coordinates rotate, not the model',
   has('function ludoRotateGrid(gr, gc)') && has('function ludoPointXY(r, c)') &&
   /ludoPointXY[\s\S]{0,120}?ludoRotateGrid\(r, c\)/.test(src));
ok('rects derive from both rotated corners', has('function ludoRectXY(r0, c0, r1, c1)'));
ok('HUD seats derived, not tabled',
   has('function ludoSeat(ci)') && !has('const LUDO_SEATS'));
// Board rotation must never reach the canvas transform — ctx.rotate would carry
// dice pips, chip labels and stack badges over and leave them upside down. The
// ctx.rotate calls that do exist (Pool's rolling stripe, Ludo's start arrow, the
// dice tumble wobble) each spin one small shape and know nothing about the
// board's orientation, so assert that rather than counting call sites.
const rotateDrivenByBoard = src.split('\n')
    .filter(l => l.indexOf('ctx.rotate(') !== -1 && /ludoRotat/.test(l));
ok('no ctx.rotate is driven by the board rotation',
   rotateDrivenByBoard.length === 0, rotateDrivenByBoard.join(' | '));
ok('ludoRender sets an unrotated scale transform',
   /setTransform\(s, 0, 0, s, 0, 0\)/.test(src));

head('XP and achievements');
ok('awardGameXP has a ludo case', /case 'ludo': \{[\s\S]{0,700}?performance\.xp/.test(src));
ok('award clamped to AC_MAX_XP_PER_GAME',
   /Math\.min\(AC_MAX_XP_PER_GAME, Math\.round\(performance\.xp/.test(src));
ok('three achievements defined', all(['ludoChamp:', 'ludoFlawless:', 'ludoHunter:']));
ok('achievement XP values set', has('ludoChamp: 150, ludoFlawless: 120, ludoHunter: 80'));
ok('checkGameAchievements gates all three on vsCPU',
   /case 'ludo':[\s\S]{0,240}?if \(!p\.vsCPU\) break;/.test(src));
ok('revalidateAchievements can restore ludoChamp', has("!has('ludoChamp')    && ludoWon >= 100"));

head('Leaderboard and cloud sync');
// Assert the relationship, not a magic number: a header cell, a row cell and a
// slot in the colspan must appear or disappear together. Adding Ludo took the
// game columns from 7 to 8, so colspan goes 11 -> 12.
const FIXED_COLS = 4;                                   // rank, name, level, XP
const th = (src.match(/<th title="[^"]+">/g) || []).length;
const td = (src.match(/<td class="lb-score">/g) || []).length;
const colspan = (src.match(/colspan="(\d+)" class="lb-empty"/) || [])[1];
ok('8 game columns now that Ludo is in', th === 8, 'got ' + th);
ok('header and row cell counts agree', th === td, th + ' headers vs ' + td + ' cells');
ok('colspan equals fixed + game columns',
   Number(colspan) === FIXED_COLS + th,
   'colspan=' + colspan + ' but expected ' + (FIXED_COLS + th));
ok('ludo column header present', has('<th title="Ludo">🎲</th>'));
ok('ludo cell present', has('${fmt(gb.ludo)}'));
ok('collectGameBests reports ludo',
   /ludo:\s+parseInt\(localStorage\.getItem\('ludoGamesWon'/.test(src));
ok('snapshot carries ludoRecord',
   /ludoRecord: JSON\.parse\(localStorage\.getItem\('ludoRecord'/.test(src));
ok('restore raises ludoGamesWon', has("raise('ludoGamesWon',       gb.ludo)"));
ok('restore merges ludoRecord upward only',
   /rec\.ludoRecord[\s\S]{0,320}?Math\.max\(localLudo\.wins/.test(src));
const literals = (src.match(/ludo: parseInt\(localStorage\.getItem\('ludoGamesWon'/g) || []).length;
ok('both inline gameBests literals updated', literals === 2, 'found ' + literals);

head('Engine parity with ludo-dev/');
const want = ['ludo-core.js', 'ludo-ui.js']
    .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')
                .replace(/\r\n/g, '\n').replace(/\n+$/, ''))
    .join('\n\n');
ok('integrated engine is byte-identical to the tested source',
   src.replace(/\r\n/g, '\n').indexOf(want) !== -1);

console.log('\n' + '='.repeat(52));
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('='.repeat(52) + '\n');
process.exit(fail ? 1 : 0);
