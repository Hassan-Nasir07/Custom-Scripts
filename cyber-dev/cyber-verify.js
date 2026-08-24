// Cyberpunk HUD verification.
//
//   node cyber-dev/cyber-verify.js
//
// Two halves:
//   1. A static audit of AttendanceTimeCheckerPlus.js — sentinel integrity,
//      byte-parity with cyber-dev/, and the structural invariants that cannot
//      be expressed in CSS.
//   2. Headless checks of cyber-hud.js + cyber-audio.js through load.js.
//
// The load-bearing assertion is the LEGIBILITY INVARIANT (section C): no token
// that colours type, bloom or frames may derive from an accent or a background.
// Violating it is what made the theme's yellow unchangeable, and it is the one
// defect a reviewer cannot see by reading a diff — the CSS looks fine either
// way, and the failure only appears once someone picks a dark Accent.
const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'AttendanceTimeCheckerPlus.js');

let pass = 0;
const failures = [];
let section = '';

function group(name) { section = name; }
function ok(cond, label, detail) {
    if (cond) { pass++; return true; }
    failures.push(section + ' :: ' + label + (detail ? '  [' + detail + ']' : ''));
    return false;
}
function eq(actual, expected, label) {
    return ok(actual === expected, label, 'got ' + JSON.stringify(actual) +
                                          ', want ' + JSON.stringify(expected));
}
function near(actual, expected, tol, label) {
    return ok(Math.abs(actual - expected) <= tol, label,
              'got ' + actual + ', want ~' + expected);
}

const host = fs.readFileSync(TARGET, 'utf8');
const themeCss = fs.readFileSync(path.join(__dirname, 'cyber-theme.css'), 'utf8');
const hudJs   = fs.readFileSync(path.join(__dirname, 'cyber-hud.js'), 'utf8');
const audioJs = fs.readFileSync(path.join(__dirname, 'cyber-audio.js'), 'utf8');

const trim = s => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
// CSS with comments removed. Without this, every assertion about what the CSS
// "references" is confounded by the block comments that explain the bugs being
// fixed — the header names neonPulse in order to document why it is gone.
const cssCode = themeCss.replace(/\/\*[\s\S]*?\*\//g, '');

// ══════════════════════════════════════════════════════════════════
group('A. sentinels + parity');
// ══════════════════════════════════════════════════════════════════
const BLOCKS = [
    ['theme CSS',
     '            /* ═══ CYBERPUNK HUD THEME — generated from cyber-dev/cyber-theme.css, do not edit here ═══ */',
     '            /* ═══ END CYBERPUNK HUD THEME ═══ */', themeCss],
    ['HUD module',
     '    // ═══ CYBERPUNK HUD — generated from cyber-dev/cyber-hud.js, do not edit here ═══',
     '    // ═══ END CYBERPUNK HUD ═══', hudJs],
    ['audio module',
     '    // ═══ CYBERPUNK AUDIO — generated from cyber-dev/cyber-audio.js, do not edit here ═══',
     '    // ═══ END CYBERPUNK AUDIO ═══', audioJs]
];

BLOCKS.forEach(function (b) {
    const name = b[0], open = b[1], close = b[2], src = b[3];
    const a = host.indexOf(open);
    const z = host.indexOf(close);
    if (!ok(a !== -1, name + ': opening sentinel present')) return;
    if (!ok(z !== -1, name + ': closing sentinel present')) return;
    ok(host.indexOf(open, a + 1) === -1, name + ': opening sentinel is unique');
    ok(host.indexOf(close, z + 1) === -1, name + ': closing sentinel is unique');
    ok(z > a, name + ': sentinels are in order');
    const body = host.slice(host.indexOf('\n', a) + 1, z);
    ok(trim(body) === trim(src), name + ': spliced copy is byte-identical to cyber-dev/',
       'run node cyber-dev/reinsert.js');
});

// ══════════════════════════════════════════════════════════════════
group('B. theme CSS is safe inside the template literal');
// ══════════════════════════════════════════════════════════════════
const opens  = (themeCss.match(/\{/g) || []).length;
const closes = (themeCss.match(/\}/g) || []).length;
eq(opens, closes, 'braces balance (a stray brace silently kills the rest of modernStyles)');
ok(themeCss.indexOf('`') === -1, 'no backtick (would close the modernStyles template literal)');
ok(themeCss.indexOf('${') === -1, 'no dollar-brace (would start a template interpolation)');
ok(!/\/\*[^*]*\/\*/.test(themeCss), 'no nested CSS comment openers');

const declared = new Set();
(themeCss.match(/^\s*(--[a-z0-9-]+)\s*:/gm) || []).forEach(function (m) {
    declared.add(m.trim().replace(/\s*:$/, ''));
});
const consumed = new Set();
(cssCode.match(/var\(\s*(--[a-z0-9-]+)/g) || []).forEach(function (m) {
    consumed.add(m.replace(/var\(\s*/, ''));
});
// Consumed by cyber-audio.js through getComputedStyle rather than by CSS.
const JS_CONSUMED = ['--rt-glow-color', '--rt-cyber-hl', '--rt-accent',
                     '--rt-cyber-panel', '--rt-grid'];
const undeclared = [...consumed].filter(v => !declared.has(v));
ok(undeclared.length === 0, 'every var() consumed in the theme block is declared in it',
   undeclared.join(', '));
JS_CONSUMED.forEach(function (v) {
    ok(declared.has(v), 'declares ' + v + ' (read by cyber-audio.js via getComputedStyle)');
});

// ══════════════════════════════════════════════════════════════════
group('C. LEGIBILITY INVARIANT');
// ══════════════════════════════════════════════════════════════════
// Pull each custom-property declaration's value out of the CSS and check that
// nothing colouring type / bloom / frames reads an accent or a background.
const decls = {};
(cssCode.match(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g) || []).forEach(function (m) {
    const i = m.indexOf(':');
    const k = m.slice(0, i).trim();
    if (!(k in decls)) decls[k] = [];
    decls[k].push(m.slice(i + 1).replace(/;$/, '').trim());
});

const LEGIBILITY = ['--rt-text', '--rt-text-rgb', '--rt-text-dim', '--rt-text-faint',
                    '--rt-glow-color', '--rt-glow-rgb', '--rt-glow', '--rt-glow-soft',
                    '--rt-border-color', '--rt-border-rgb', '--rt-border',
                    '--rt-border-strong', '--rt-grid', '--rt-scanline'];
const FORBIDDEN = ['--rt-accent', '--rt-cyber-hl', '--rt-cyber-panel', '--rt-bg-1', '--rt-bg-2'];

LEGIBILITY.forEach(function (tok) {
    const vals = decls[tok] || [];
    ok(vals.length > 0, tok + ' is declared');
    vals.forEach(function (v) {
        const bad = FORBIDDEN.filter(f => v.indexOf(f) !== -1);
        ok(bad.length === 0,
           tok + ' does not derive from an accent or a background',
           bad.length ? 'reads ' + bad.join(', ') + ' in "' + v + '"' : '');
    });
});

// And the reverse: the derived legibility tokens must read their OWN parent.
ok((decls['--rt-text-dim'] || []).every(v => v.indexOf('--rt-text-rgb') !== -1),
   '--rt-text-dim derives from --rt-text-rgb');
ok((decls['--rt-border'] || []).every(v => v.indexOf('--rt-border-rgb') !== -1),
   '--rt-border derives from --rt-border-rgb');
ok((decls['--rt-border-strong'] || []).every(v => v.indexOf('--rt-border-rgb') !== -1),
   '--rt-border-strong derives from --rt-border-rgb');
ok((decls['--rt-grid'] || []).every(v => v.indexOf('--rt-border-rgb') !== -1),
   '--rt-grid derives from --rt-border-rgb');
ok((decls['--rt-glow'] || []).every(v => v.indexOf('--rt-glow-rgb') !== -1),
   '--rt-glow derives from --rt-glow-rgb');

// The one deliberate exception, asserted rather than assumed: --rt-bk-c is the
// corner-bracket colour, and the stat cards retint it per card so each panel
// keeps its own identity. Brackets are decoration and never carry text, so an
// accent-derived bracket cannot hide information. The DEFAULT still comes from
// the Border swatch, and the real frame tokens above stay independent.
ok((decls['--rt-bk-c'] || []).some(v => v.indexOf('--rt-border-rgb') !== -1),
   '--rt-bk-c defaults to the Border swatch');
const bkOverrides = (decls['--rt-bk-c'] || []).filter(v => v.indexOf('--rt-border-rgb') === -1);
eq(bkOverrides.length, 3,
   'exactly three per-card bracket retints (decorative, never load-bearing for text)');

// ══════════════════════════════════════════════════════════════════
group('D. regressions that were live before the rework');
// ══════════════════════════════════════════════════════════════════
ok(cssCode.indexOf('neonPulse') === -1,
   'the theme no longer references neonPulse (it animated box-shadow and ate every declared card shadow)');
const kf = cssCode.match(/@keyframes[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g) || [];
ok(kf.length > 0, 'the theme defines its own keyframes');
kf.forEach(function (k) {
    const name = (k.match(/@keyframes\s+([a-zA-Z0-9_-]+)/) || [])[1] || '?';
    ok(k.indexOf('box-shadow') === -1,
       '@keyframes ' + name + ' does not animate box-shadow');
});
ok(!/animation:[^;]*\b(cardShimmer|progressShimmer)\b/.test(cssCode),
   'no rule still uses the layout-triggering glass shimmer keyframes');
ok(cssCode.indexOf('clip-path: none !important') === -1,
   'the two dead "clip-path: none !important" resets are gone');
const tableRules = (cssCode.match(/\.attendance-summary\.retro-theme \.modern-table\s*\{/g) || []).length;
eq(tableRules, 1, 'exactly one .modern-table base rule (the duplicate reset radius and cancelled its own clip)');
ok(/animation:\s*rtCardShimmer/.test(cssCode), 'the card shimmer runs a transform-only keyframe');
const shimmerRule = (cssCode.match(
    /\.attendance-summary\.retro-theme \.stat-card::before\s*\{[^}]*\}/) || [''])[0];
ok(shimmerRule.length > 0, 'the cyberpunk .stat-card::before rule exists');
ok(/opacity:\s*0\.55/.test(shimmerRule),
   'the card shimmer is visible without hover (the base glass rule sets opacity:0, which is why it read as "not animating")');
ok(/\.stat-card:hover::before\s*\{[^}]*opacity:\s*1/.test(cssCode),
   'hover still brightens the shimmer');

// ══════════════════════════════════════════════════════════════════
group('E. host wiring');
// ══════════════════════════════════════════════════════════════════
const applyFn = (host.match(/function applyPreferences\(\)\s*\{[\s\S]*?\n    \}/) || [''])[0];
ok(applyFn.length > 0, 'applyPreferences() found');
ok(applyFn.indexOf('applyCyberpunkTheme(container)') !== -1,
   'applyPreferences delegates the cyberpunk pass to applyCyberpunkTheme');
ok(applyFn.indexOf('clearCyberpunkTheme(container)') !== -1,
   'applyPreferences delegates teardown to clearCyberpunkTheme');
ok(applyFn.indexOf('cleanupCyberAudio()') !== -1,
   'applyPreferences tears down the audio capture when leaving the theme');
ok(applyFn.indexOf("setProperty('--rt-") === -1,
   'applyPreferences writes no --rt-* property directly (all of them go through CYBER_TOKENS)');
ok(applyFn.indexOf("removeProperty('--rt-") === -1,
   'applyPreferences removes no --rt-* property directly');
ok(applyFn.indexOf('triggerCyberBoot(container)') !== -1,
   'applyPreferences fires the boot-in reveal');
ok(/const enteringRetro = !container\.classList\.contains\('retro-theme'\)/.test(applyFn),
   'the boot-in only fires on entering the theme, not on every colour-slider move');

ok(host.indexOf('id="cyber-eq"') !== -1, 'the EQ canvas is rendered');
ok(host.indexOf('id="cyber-eq-btn"') !== -1, 'the EQ source button is rendered');
const pbHtml = (host.match(/const progressBarHTML = `[\s\S]*?`;/) || [''])[0];
ok(pbHtml.indexOf('cyber-eq-wrap') !== -1, 'the EQ rail is rendered with the progress bar');
// And that block really is inside the centre column. Game Mode collapses
// .left-panel and .right-panel only, so anything in main-attendance-content
// survives it — which is the whole reason the rail lives there.
const centre = (host.match(/<div class="main-attendance-content">[\s\S]*?\n            <\/div>/) || [''])[0];
ok(centre.indexOf('${progressBarHTML}') !== -1,
   'the progress bar block is interpolated inside .main-attendance-content, so Game Mode keeps the rail');
// ...and not in either side panel, which are the two things Game Mode collapses.
const leftPanel  = (host.match(/const leftPanelHTML = `[\s\S]*?\n        `;/) || [''])[0];
const rightPanel = (host.match(/const rightPanelHTML = `[\s\S]*?\n        `;/) || [''])[0];
ok(leftPanel.length > 0 && rightPanel.length > 0, 'both side-panel templates were found');
ok(leftPanel.indexOf('cyber-eq') === -1, 'the rail is not in the left panel');
ok(rightPanel.indexOf('cyber-eq') === -1, 'the rail is not in the right panel');
eq(host.indexOf("const BUILD_LABEL = 'v5'") !== -1, true, 'BUILD_LABEL bumped to v5');
ok((host.match(/\.attendance-summary\.retro-theme \.stat-card::before\s*\{/g) || []).length === 1,
   'only one .retro-theme .stat-card::before rule in the file (the orphan outside the block is gone)');

// ══════════════════════════════════════════════════════════════════
group('F. modules load and behave');
// ══════════════════════════════════════════════════════════════════
const { load } = require('./load.js');
let m = null;
try {
    m = load();
    ok(true, 'cyber-hud.js + cyber-audio.js evaluate as one IIFE-body unit');
} catch (e) {
    ok(false, 'modules evaluate', e && e.message);
}

if (m) {
    // -- panel shape --
    group('G. panel shape');
    eq(JSON.stringify(m.CYBER_PANEL_SHAPES), JSON.stringify(['rounded', 'chamfered', 'notched']),
       'CYBER_PANEL_SHAPES is the documented triple');
    m.CYBER_PANEL_SHAPES.forEach(function (s) {
        const re = new RegExp('\\.rt-shape-' + s + '\\s*\\{[^}]*--rt-radius');
        ok(re.test(cssCode), '.rt-shape-' + s + ' declares --rt-radius');
        const re2 = new RegExp('\\.rt-shape-' + s + '\\s*\\{[\\s\\S]*?--rt-clip');
        ok(re2.test(cssCode), '.rt-shape-' + s + ' declares --rt-clip');
        const optRe = new RegExp('<option value="' + s + '"');
        ok(optRe.test(host), 'the Panel Shape select offers "' + s + '"');
    });

    global.userPreferences.cyberPanelShape = 'chamfered';
    m.applyCyberShape(m.container);
    ok(m.container.classList.contains('rt-shape-chamfered'), 'applyCyberShape sets the chosen shape');
    ok(!m.container.classList.contains('rt-shape-rounded'), 'applyCyberShape clears the previous shape');
    global.userPreferences.cyberPanelShape = 'nonsense';
    eq(m.cyberPanelShape(), 'rounded', 'an unknown shape falls back to rounded, never to no shape at all');
    m.applyCyberShape(m.container);
    ok(m.container.classList.contains('rt-shape-rounded'), 'the fallback shape is actually applied');
    m.clearCyberShape(m.container);
    eq(m.CYBER_PANEL_SHAPES.filter(s => m.container.classList.contains('rt-shape-' + s)).length, 0,
       'clearCyberShape removes every shape class');
    global.userPreferences.cyberPanelShape = 'rounded';

    // -- tokens: write / teardown mirror --
    group('H. token write and teardown mirror');
    const names = m.cyberTokenVarNames();
    ok(names.indexOf('--rt-text') !== -1, 'the teardown list covers --rt-text');
    ok(names.indexOf('--rt-glow-color') !== -1, 'the teardown list covers --rt-glow-color');
    ok(names.indexOf('--rt-border-color') !== -1, 'the teardown list covers --rt-border-color');
    ok(names.indexOf('--rt-glow-mul') !== -1, 'the teardown list covers --rt-glow-mul');
    ok(names.indexOf('--rt-beat') !== -1, 'the teardown list covers --rt-beat');

    const el = require('./load.js').makeEl('div');
    m.applyCyberTokens(el);
    const written = Object.keys(el.style.props);
    written.forEach(function (p) {
        ok(names.indexOf(p) !== -1, 'written property ' + p + ' is in the teardown list');
    });
    m.CYBER_TOKENS.forEach(function (t) {
        ok(written.indexOf(t.varName) !== -1, t.pref + ' writes ' + t.varName);
        if (t.rgb) ok(written.indexOf(t.varName + '-rgb') !== -1, t.pref + ' writes ' + t.varName + '-rgb');
    });
    m.clearCyberTokens(el);
    eq(Object.keys(el.style.props).length, 0,
       'clearCyberTokens leaves nothing behind (a leftover token wins over the Glassmorphic stylesheet)');

    // No two prefs may drive the same custom property.
    const seenVars = {};
    let dup = null;
    m.CYBER_TOKENS.forEach(function (t) {
        if (seenVars[t.varName]) dup = t.varName;
        seenVars[t.varName] = t.pref;
    });
    ok(dup === null, 'no two prefs write the same CSS property', dup || '');

    // The three legibility prefs must map to the legibility tokens.
    const byPref = {};
    m.CYBER_TOKENS.forEach(function (t) { byPref[t.pref] = t; });
    eq(byPref.cyberText && byPref.cyberText.varName, '--rt-text', 'cyberText drives --rt-text');
    eq(byPref.cyberGlow && byPref.cyberGlow.varName, '--rt-glow-color', 'cyberGlow drives --rt-glow-color');
    eq(byPref.cyberBorder && byPref.cyberBorder.varName, '--rt-border-color', 'cyberBorder drives --rt-border-color');
    ok(byPref.cyberText.rgb && byPref.cyberGlow.rgb && byPref.cyberBorder.rgb,
       'all three legibility tokens emit an -rgb triple for alpha compositing');

    // -- prefs exist on the host, and defaults preserve the look --
    group('I. preferences');
    const prefsLiteral = (host.match(/let userPreferences = \{[\s\S]*?\n    \};/) || [''])[0];
    ok(prefsLiteral.length > 0, 'the userPreferences literal was found');
    m.CYBER_TOKENS.forEach(function (t) {
        ok(new RegExp('\\b' + t.pref + ':').test(prefsLiteral),
           t.pref + ' has a default in userPreferences');
    });
    ['cyberGlowIntensity', 'cyberPanelShape', 'cyberAudioSource'].forEach(function (p) {
        ok(new RegExp('\\b' + p + ':').test(prefsLiteral), p + ' has a default in userPreferences');
    });
    // An upgrade that silently restyles the widget reads as a bug.
    ok(/cyberText:\s*'#fff200'/.test(prefsLiteral), 'cyberText defaults to the existing yellow');
    ok(/cyberGlow:\s*'#fff200'/.test(prefsLiteral), 'cyberGlow defaults to the existing yellow');
    ok(/cyberBorder:\s*'#fff200'/.test(prefsLiteral), 'cyberBorder defaults to the existing yellow');
    ok(/cyberPanelShape:\s*'rounded'/.test(prefsLiteral), 'cyberPanelShape defaults to rounded');
    ok(/cyberAudioSource:\s*'off'/.test(prefsLiteral), 'the visualizer is off until asked for');

    // Every picker in the settings row must correspond to a real pref.
    const row = (host.match(/<div class="cyber-color-pickers">[\s\S]*?<\/div>/) || [''])[0];
    const pickerPrefs = (row.match(/data-pref="([a-zA-Z]+)"/g) || [])
        .map(s => s.replace(/data-pref="|"/g, ''));
    ok(pickerPrefs.length === 8, 'the colour row renders eight swatches', 'got ' + pickerPrefs.length);
    pickerPrefs.forEach(function (p) {
        ok(new RegExp('\\b' + p + ':').test(prefsLiteral), 'swatch ' + p + ' is a real preference');
    });

    // -- contrast guard --
    group('J. contrast guard');
    near(m.relativeLuminance('#000000'), 0, 1e-9, 'luminance of black is 0');
    near(m.relativeLuminance('#ffffff'), 1, 1e-9, 'luminance of white is 1');
    near(m.contrastRatio('#000000', '#ffffff'), 21, 1e-6, 'black on white is 21:1');
    near(m.contrastRatio('#ffffff', '#000000'), 21, 1e-6, 'the ratio is symmetric');
    near(m.contrastRatio('#777777', '#777777'), 1, 1e-6, 'a colour against itself is 1:1');
    ok(m.contrastRatio('#fff200', '#07091a') > 4.5,
       'the default yellow on the default background passes AA');

    global.userPreferences.cyberText = '#fff200';
    ok(m.cyberTextContrast() > 4.5, 'cyberTextContrast agrees for the shipped palette');
    global.userPreferences.cyberText = '#0a0a12';
    ok(m.cyberTextContrast() < 3,
       'near-black text on the dark background is detected as failing — the exact trap the swatch split exists to prevent');
    // It must warn, not correct.
    eq(global.userPreferences.cyberText, '#0a0a12',
       'evaluating contrast never rewrites the user preference');
    global.userPreferences.cyberText = '#fff200';
    ok(/is-pass|is-warn|is-fail/.test(cssCode), 'the chip states are styled');

    // -- title ghosts --
    group('K. title glitch ghosts');
    ok(/content:\s*attr\(data-rt-text\)/.test(cssCode), 'the ghosts read attr(data-rt-text)');
    m.updateCyberTitleGhosts(m.container);
    eq(m.title.getAttribute('data-rt-text'), 'Attendance Summary',
       'the title text is mirrored onto the attribute');
    m.title.textContent = '   ';
    m.updateCyberTitleGhosts(m.container);
    eq(m.title.getAttribute('data-rt-text'), null,
       'an empty title removes the attribute rather than rendering empty ghosts');
    m.title.textContent = 'Attendance Summary';

    // -- audio --
    group('L. audio rail');
    eq(JSON.stringify(m.CYBER_EQ_SOURCES), JSON.stringify(['off', 'system', 'mic', 'sim']),
       'the source tiers are off / system / mic / sim');
    m.CYBER_EQ_SOURCES.forEach(function (s) {
        ok(new RegExp('<option value="' + s + '"').test(host),
           'the Audio Visualizer select offers "' + s + '"');
    });
    eq(m.CYBER_EQ_BARS, 32, 'the rail has 32 bars');

    global.userPreferences.cyberAudioSource = 'nonsense';
    eq(m.cyberEqSource(), 'off', 'an unknown audio source falls back to off');
    global.userPreferences.cyberAudioSource = 'off';

    // Procedural fallback must stay in range and must never be flat.
    let simMin = 1, simMax = 0;
    for (let t = 0; t < 20000; t += 137) {
        for (let i = 0; i < m.CYBER_EQ_BARS; i++) {
            const v = m.cyberSimBar(i, t);
            if (!(v >= 0 && v <= 1)) { simMin = -1; break; }
            if (v < simMin) simMin = v;
            if (v > simMax) simMax = v;
        }
    }
    ok(simMin >= 0, 'the procedural spectrum never goes negative');
    ok(simMax <= 1, 'the procedural spectrum never exceeds 1');
    ok(simMax - simMin > 0.2, 'the procedural spectrum actually moves (a flat rail reads as broken)');

    // With no analyser attached, readBars falls through to the procedural path
    // rather than throwing or returning an empty array.
    const bars = m.cyberEqReadBars(1234);
    eq(bars.length, m.CYBER_EQ_BARS, 'readBars returns one value per bar with no stream attached');
    ok(bars.every(v => v >= 0 && v <= 1), 'every bar is within range');

    // Beat writes stay in range and land on the container.
    m.cyberEqUpdateBeat(new Array(m.CYBER_EQ_BARS).fill(0.9));
    const beat = parseFloat(m.container.style.getPropertyValue('--rt-beat') || '0');
    ok(beat >= 0 && beat <= 1, '--rt-beat stays within 0..1', 'got ' + beat);
    m.cleanupCyberAudio();
    eq(m.container.style.getPropertyValue('--rt-beat'), '0',
       'cleanupCyberAudio resets --rt-beat (a stuck beat leaves the HUD frozen mid-pulse)');

    // -- the no-surprise-prompt rule --
    group('M. no permission prompt without a gesture');
    const autoResume = (audioJs.match(/async function cyberEqAutoResume\(\)[\s\S]*?\n    \}/) || [''])[0];
    ok(autoResume.length > 0, 'cyberEqAutoResume() found');
    ok(autoResume.indexOf('getDisplayMedia') === -1,
       'auto-resume never opens the share picker — there is no gesture at page load');
    ok(autoResume.indexOf("state === 'granted'") !== -1,
       'auto-resume only reconnects the mic when the permission is already granted');
    const cycle = (audioJs.match(/async function cyberEqCycle\(\)[\s\S]*?\n    \}/) || [''])[0];
    ok(cycle.indexOf('cyberEqConnectSystem') !== -1,
       'the share picker is reachable only from the click handler path');
    ok(/echoCancellation:\s*false/.test(audioJs) &&
       /autoGainControl:\s*false/.test(audioJs) &&
       /noiseSuppression:\s*false/.test(audioJs),
       'capture disables the speech processing that would flatten music');
    ok(/getVideoTracks\(\)[\s\S]{0,200}stop\(\)/.test(audioJs),
       'the mandatory getDisplayMedia video track is stopped immediately');
    ok(audioJs.indexOf('connect(cyberAnalyser)') !== -1 &&
       !/connect\(\s*cyberAudioCtx\.destination\s*\)/.test(audioJs),
       'captured audio is never routed back to the speakers');
    const cleanup = (audioJs.match(/function cleanupCyberAudio\(\)[\s\S]*?\n    \}/) || [''])[0];
    ok(cleanup.indexOf('cyberDetachStream()') !== -1, 'cleanup stops the capture tracks');
    ok(cleanup.indexOf('close()') !== -1, 'cleanup closes the AudioContext');
    ok(cleanup.indexOf('cyberEqStopLoop()') !== -1, 'cleanup cancels the animation frame');
    ok(/addEventListener\('ended'/.test(audioJs),
       'ending the share from the browser banner is detected');
    ok(audioJs.indexOf('getFrameInterval') !== -1,
       'the rail shares the widget FPS cap instead of adding a second uncapped loop');
}

// ══════════════════════════════════════════════════════════════════
const total = pass + failures.length;
// The "N passed, N failed" wording is what ludo-dev/verify-all.js greps for to
// roll this suite into its aggregate total.
console.log('\ncyber-verify: ' + pass + ' passed, ' + failures.length + ' failed  (of ' + total + ')');
if (failures.length) {
    console.log('\n' + failures.length + ' failure(s):');
    failures.forEach(function (f) { console.log('  ✗ ' + f); });
    process.exit(1);
}
console.log('✓ all clear');
