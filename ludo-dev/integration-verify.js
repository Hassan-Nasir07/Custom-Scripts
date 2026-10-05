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
// One GAME_PANELS entry drives the canvas, the switcher button, the controls row, the
// scoreboard and the title (initCurrentGame, updateGameSwitcher, updateGameControls, updateGameTitle).
ok('GAME_PANELS has a ludo entry: its canvas, its title, initLudoGame, and its scoreboard refresh',
   /ludo: \{ el: 'ludo-canvas', title: '🎲 Ludo', start: \(\) => initLudoGame\(\), shown: \(\) => \{ updateLudoScoreboard\(\); refreshGameScoreBtn\('ludo'\); \} \}/.test(src));
ok('the four switcher functions read GAME_PANELS',
   ['function initCurrentGame', 'function updateGameSwitcher', 'function updateGameControls', 'function updateGameTitle']
       .every(f => new RegExp(f + '\\([^)]*\\) \\{[\\s\\S]{0,200}?GAME_PANELS').test(src)));

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
// Pool v2 brings its own Max layout (the design's 1280x800 view) instead of a
// scaled canvas; the helper's build branch hands it an empty panel.
ok('Pool brings its own Max layout through cfg.build',
   /canvasId: 'pool-root'[\s\S]{0,220}?build: poolBuildMax[\s\S]{0,90}?unbuild: poolUnbuildMax/.test(src) &&
   has('if (!openState && cfg.build) {'));
ok('Ludo passes its own buffer',
   /canvasId: 'ludo-canvas'[\s\S]{0,220}?bufferW: LUDO_CANVAS_W/.test(src));
ok('old per-Pool modal state fully removed',
   !has('poolOriginalStyles') && !has('poolModalOverlay') && !has('poolModalPlaceholder'));
ok('.pool-modal-* classes reused, not renamed', has("className = 'pool-modal-overlay'"));
ok('switching away closes the Pool modal', has('if (poolMaximized) togglePoolMaximize();'));
ok('switching away closes the Ludo modal', has('if (ludoMaximized) toggleLudoMaximize();'));

head('Preferences and storage');
ok('five flat rule flags in userPreferences',
   all(['ludoBlocks: true', 'ludoBlockPassing: true', 'ludoThreeSixes: true',
        'ludoExactHome: true', 'ludoFreeRelease: false']));
ok('settings modal exposes all five',
   all(['data-pref="ludoBlocks"', 'data-pref="ludoBlockPassing"',
        'data-pref="ludoThreeSixes"', 'data-pref="ludoExactHome"',
        'data-pref="ludoFreeRelease"']));
ok('barring passage is separable from barring the landing',
   /if \(R\.blockPassing\) \{[\s\S]{0,220}?blocked\.has\(ludoStepToRing\(ci, s\)\)/.test(src));
ok('storage helpers live in the engine block',
   has('function ludoLoadWins()') && has('function ludoSaveRecord(rec)'));

head('Board rotation');
ok('ludoRotation default in userPreferences', has('ludoRotation: 0'));
// A ⚙️ dropdown's values, from its sel('pref', label, [[value, text], ...]) row.
const selOpts = pref => { const m = new RegExp("sel\\('" + pref + "', '(?:[^'\\\\]|\\\\.)*', \\[(.*)\\]\\]").exec(src); return m ? [...m[1].matchAll(/\['([^']*)', /g)].map(x => x[1]).join() : null; };
ok('rotation select in the settings modal', has("sel('ludoRotation'"));
ok('all four orientations offered', selOpts('ludoRotation') === '0,1,2,3');
ok('the select is stored as a number, not a string',
   /numericPrefs = \['gameFps', 'ludoRotation'[^\]]*\]/.test(src));
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

head('Difficulty control and dice audit');
ok('ludoDifficulty default in userPreferences', has("ludoDifficulty: 'adaptive'"));
ok('difficulty select in the settings modal', has("sel('ludoDifficulty'"));
ok('all four choices offered', selOpts('ludoDifficulty') === 'adaptive,easy,normal,hard');
ok('Pool CPU: adaptive and the four tiers, and it is a string pref too',
   selOpts('poolDifficulty') === 'adaptive,easy,normal,hard,pro' &&
   src.match(/numericPrefs = \[[^\]]*\]/)[0].indexOf('poolDifficulty') === -1);
// It is a string pref, so it must NOT be in the list that parseInts selects —
// 'hard' through parseInt is NaN, which would silently fall back to adaptive.
ok('difficulty is not parsed as a number',
   /numericPrefs = \[[^\]]*\]/.test(src) &&
   src.match(/numericPrefs = \[[^\]]*\]/)[0].indexOf('ludoDifficulty') === -1);
ok('the tier reads the setting before the record',
   /function ludoDifficultyTier\(rec\) \{[\s\S]{0,320}?LUDO_TIERS\.indexOf\(P\.ludoDifficulty\)[\s\S]{0,80}?return P\.ludoDifficulty;/.test(src));
ok('only real tiers can be pinned', has("const LUDO_TIERS = ['easy', 'normal', 'hard']"));
ok('the dice audit is readable without a console', has('ludoDiceSummary()'));
ok('and it is guarded, so a load-order slip cannot blank the modal',
   /typeof ludoDiceSummary === 'function' \? ludoDiceSummary\(\) : ''/.test(src));
ok('the fair baseline is stated next to it', has('a fair die lands 16.7%'));

head('XP and achievements');
ok('awardGameXP has a ludo case', /case 'ludo': \{[\s\S]{0,700}?performance\.xp/.test(src));
ok('award clamped to AC_MAX_XP_PER_GAME',
   /Math\.min\(AC_MAX_XP_PER_GAME, Math\.round\(performance\.xp/.test(src));
ok('three achievements defined', all(['ludoChamp:', 'ludoFlawless:', 'ludoHunter:']));
ok('achievement XP values set', has('ludoChamp: 150, ludoFlawless: 120, ludoHunter: 80'));
ok('checkGameAchievements gates all three on vsCPU',
   /ludo: p\.vsCPU && \{ ludoChamp:/.test(src));
ok('revalidateAchievements can restore ludoChamp', has("ludoChamp: lsInt('ludoGamesWon') >= 100"));

head('Leaderboard and cloud sync');
// Snake v2 moved per-game scores out of the main table and behind a game+mode
// selector, so the eight emoji columns this used to count are gone. The
// relationship still holds, it is just inverted: the main table carries the
// five fixed cells and no game columns at all, and the colspan must agree.
const th = (src.match(/<th title="[^"]+">/g) || []).length;
const td = (src.match(/<td class="lb-score">/g) || []).length;
const colspan = (src.match(/colspan="(\d+)" class="lb-empty"/) || [])[1];
// Derive the width from the header rather than naming a number here — a
// hardcoded count is how the colspan and the table drifted apart in the first
// place, and an assertion that repeats the bug catches nothing.
const thead = (src.match(/<thead><tr>[\s\S]*?<\/tr><\/thead>/) || [''])[0];
// `<th[ >]` so the enclosing `<thead>` isn't counted as a column.
const mainCols = (thead.match(/<th[ >]/g) || []).length;
ok('no per-game columns left in the main table', th === 0 && td === 0,
   th + ' headers, ' + td + ' cells');
// The roster is player rows now (AchPopover), so the one table left is a game board: its
// empty state spans the cells of one of its rows.
const boardFn = (src.match(/function lbBoardRowsHtml\([\s\S]*?\n    \}/) || [''])[0];
const boardCells = ((boardFn.match(/<tr class=[\s\S]*?<\/tr>/) || [''])[0].match(/<td[ >]/g) || []).length;
ok("the roster has no table, and a board's empty state spans its row",
   mainCols === 0 && boardCells > 0 && Number(colspan) === boardCells,
   'colspan=' + colspan + ', board row has ' + boardCells + ' cells, roster header ' + mainCols);
ok('ludo has a board in the selector',
   /ludo:\s*\{[^}]*label:\s*'Ludo'/.test(src));
// Hot-seat wins are never recorded (ludoSaveWins runs only under `if (vsCPU)`),
// so the split is by CPU difficulty, not by game mode — a `pvp` board would
// advertise a number that can never move.
ok('the ludo board splits by difficulty, not by game mode',
   /ludo:\s*\{[\s\S]{0,240}?modes:\s*\{[^}]*hard:[^}]*normal:[^}]*easy:/.test(src));
ok('hot-seat is not offered as a ludo board',
   !/ludo:\s*\{[\s\S]{0,320}?modes:\s*\{[^}]*pvp:/.test(src));
ok('the pre-split total keeps a board of its own',
   /ludo:\s*\{[\s\S]{0,320}?modes:\s*\{[^}]*cpu:/.test(src));
ok('collectGameBests still reports ludo',
   /ludo:\s+lsInt\('ludoGamesWon'\)/.test(src));
ok('collectGameModeBests reports ludo:cpu',
   /put\('ludo:cpu', localStorage\.getItem\('ludoGamesWon'\)\)/.test(src));
ok('collectGameModeBests reports every tier',
   /putAll\('ludo:', 'ludoWinsByTier', \['easy', 'normal', 'hard'\]\)/.test(src));
// A tier count is meaningless without the tier being recorded at match end, and
// it has to be the tier locked at match start — not whatever the setting says by
// the time the match finishes.
ok('a CPU win is filed under the tier it was played at',
   /if \(won\) \{[\s\S]{0,320}?ludoRecordTierWin\(ludoCpuTier\)/.test(src));
ok('and only a CPU win — hot-seat cannot move a tier bucket',
   /if \(vsCPU\) \{[\s\S]{0,400}?ludoRecordTierWin\(/.test(src));
ok('an unrecognised tier opens no bucket',
   /function ludoRecordTierWin\(tier\) \{\s*if \(LUDO_TIERS\.indexOf\(tier\) === -1\) return;/.test(src));
// The pre-split wins have no recorded difficulty. Seeding them into a tier would
// put fabricated numbers on the board this change exists to make trustworthy.
ok('legacy wins are not backfilled into a tier',
   !/ludoWinsByTier[\s\S]{0,200}?ludoGamesWon/.test(src));
ok('restore merges the tiers upward only',
   /raise\('ludoWinsByTier', 'ludo:', \['easy', 'normal', 'hard'\]\)/.test(src) && /function lsRaise[\s\S]{0,400}?Math\.max\(cur, v\)/.test(src));
ok('snapshot carries the wins per cue, and restore raises each cue (lsRaise)',
   /poolCueRecord: lsJSON\('poolCueRecord'/.test(src) && /\['poolCueRecord', PQ_SET\.map\(q => q\.id\)\]\][\s\S]{0,200}?lsRaise\(/.test(src));
ok('an achievement that earns a cue says so', /unlockAchievement[\s\S]{0,1200}?poolCueUnlocked\(achievementKey\)/.test(src));
ok('snapshot carries ludoRecord',
   /ludoRecord: lsJSON\('ludoRecord'/.test(src));
ok('restore raises ludoGamesWon', has("raise('ludoGamesWon',       gb.ludo)"));
ok('restore merges ludoRecord upward only',
   /\['ludoRecord', \['wins', 'losses'\]\][\s\S]{0,200}?lsRaise\(/.test(src));
ok('the board row reuses collectGameBests (no pasted copy to forget)', /const lbOwnEntry = [\s\S]{0,400}?gameBests: collectGameBests\(\)/.test(src));

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
