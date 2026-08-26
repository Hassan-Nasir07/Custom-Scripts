// Cyberpunk HUD verification.
//
//   node cyber-dev/cyber-verify.js
//
// Two halves:
//   1. A static audit of AttendanceTimeCheckerPlus.js — sentinel integrity,
//      byte-parity with cyber-dev/, and the structural invariants that cannot
//      be expressed in CSS.
//   2. Headless checks of cyber-hud.js through load.js.
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
     '    // ═══ END CYBERPUNK HUD ═══', hudJs]
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
const undeclared = [...consumed].filter(v => !declared.has(v));
ok(undeclared.length === 0, 'every var() consumed in the theme block is declared in it',
   undeclared.join(', '));

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
ok((decls['--rt-bk-c'] || []).some(v => /--rt-border-(color|rgb)/.test(v)),
   '--rt-bk-c defaults to the Border swatch');
const bkOverrides = (decls['--rt-bk-c'] || []).filter(v => !/--rt-border-(color|rgb)/.test(v));
eq(bkOverrides.length, 3,
   'exactly three per-card bracket retints (decorative, never load-bearing for text)');

// ── KNOCKED-OUT TYPE ────────────────────────────────────────────────
// Solid plates with inverted glyphs are what give the theme real mass rather
// than only outline and glow. They are also the one place type sits on a fill,
// so the direction is restricted: a --rt-text plate carrying --rt-bg-1 glyphs
// is legibility-safe by the same guarantee the contrast chip measures, because
// it is that exact pair with the roles swapped. An ACCENT plate carrying text
// is never allowed — a dark Highlight would hide the label with no warning and
// no control that could undo it.
// Only one plate colour is allowed to carry knocked-out glyphs. --rt-lime used
// to be permitted too, back when the EQ button filled itself with a hardcoded
// green; that hue is gone, and with it the exception.
const KNOCKOUT_OK = ['--rt-text'];

// Elements whose plate is declared on an ancestor rule rather than their own.
// The check FOLLOWS the mapping and asserts the ancestor's fill, so an entry
// here is a redirection, not an exemption.
//
// Empty since the redesign: the one entry was th -> thead, from when the
// column header was a solid --rt-text plate. The reference puts its mass in
// the panel name instead and leaves the column row a thin caption, so the th
// no longer knocks out of anything. Kept as a facility rather than deleted,
// because the next knocked-out element whose plate sits on a parent will need
// it and the reasoning is easy to lose.
const PLATE_FROM_PARENT = {};
function plateFor(sel, ownBg) {
    const parent = PLATE_FROM_PARENT[sel];
    if (!parent) return ownBg;
    const i = cssCode.indexOf(parent);
    if (i === -1) return ownBg;
    const body = cssCode.slice(i, cssCode.indexOf('}', i));
    return (body.match(/background(?:-color)?:[^;]+;/g) || []).join(' ');
}

const knockoutRules = (cssCode.match(/([^{}]+)\{([^{}]*)\}/g) || [])
    .filter(r => /color:\s*var\(--rt-bg-1\)/.test(r.slice(r.indexOf('{'))));
ok(knockoutRules.length > 0, 'the theme uses knocked-out type at all',
   'got ' + knockoutRules.length);
knockoutRules.forEach(function (rule) {
    const sel = rule.slice(0, rule.indexOf('{')).trim().replace(/\s+/g, ' ');
    const body = rule.slice(rule.indexOf('{'));
    const own = (body.match(/background(?:-color)?:[^;]+;/g) || []).join(' ');
    const bg = plateFor(sel, own);
    const short = sel.slice(0, 56);
    ok(KNOCKOUT_OK.some(t => bg.indexOf(t) !== -1),
       'knocked-out rule "' + short + '" sits on a --rt-text plate');
    ok(!FORBIDDEN.some(x => bg.indexOf(x) !== -1),
       'knocked-out rule "' + short + '" does not sit on an accent or background plate');
});

// ── the hazard hatching, which is what a generic sci-fi HUD never has ──
ok((decls['--rt-hazard'] || []).length > 0, '--rt-hazard is declared');
ok((decls['--rt-hazard'] || []).every(v => /repeating-linear-gradient\(\s*45deg/.test(v)),
   'the hazard hatching runs at 45 degrees');
ok((decls['--rt-hazard'] || []).every(v => v.indexOf('--rt-border-color') !== -1),
   '--rt-hazard follows the Border swatch');
ok(/var\(--rt-hazard/.test(cssCode.replace(/--rt-hazard(-dim)?:/g, '')),
   'the hazard hatching is actually consumed, not just declared');
ok((decls['--rt-outline'] || []).length > 0,
   '--rt-outline is declared (clip-path removes the border along a cut edge)');
ok((decls['--rt-outline'] || []).every(v => (v.match(/drop-shadow/g) || []).length === 4),
   '--rt-outline is four drop-shadows, one per direction');
ok(/filter:[^;]*var\(--rt-outline\)/.test(cssCode),
   'clipped panels draw their silhouette back with --rt-outline');

// ══════════════════════════════════════════════════════════════════
group('C2. EVERY TEXT-CARRYING SWATCH IS MEASURED');
// ══════════════════════════════════════════════════════════════════
// Section C proves the LEGIBILITY TOKENS never derive from an accent. This
// section covers the other direction, which the rework opened up: a rule
// that colours type with an accent swatch DIRECTLY.
//
// Before the redesign there were none — every glyph resolved to --rt-text,
// so the contrast chip measuring Text alone covered the whole theme. The
// reference console reads its punch log by meaning, so arrival times took
// Accent and banked time took Highlight, and two more swatches became able
// to hide a number.
//
// The rule now is not "never" but "only if measured": any swatch that
// colours text must appear in CYBER_TEXT_SWATCHES, which is what the chip
// warns on. This assertion is the enforcement — add a coloured readout
// without adding its swatch to the guard and the suite fails here, which is
// the only place the mistake is visible. In the browser it looks fine right
// up until someone picks a dark Highlight.

// var -> pref, following one level of aliasing so a role like --rt-data
// resolves back to the swatch it actually reads.
const VAR_TO_PREF = {
    '--rt-text':        'cyberText',
    '--rt-accent':      'cyberAccent',
    '--rt-cyber-hl':    'cyberHighlight',
    '--rt-cyber-panel': 'cyberPanelTint'
};

function resolveSwatchVar(name) {
    if (VAR_TO_PREF[name]) return VAR_TO_PREF[name];
    // One hop through an alias declaration, e.g. --rt-data: var(--rt-cyber-hl).
    const vals = decls[name] || [];
    for (const v of vals) {
        const m = /var\((--rt-[a-z0-9-]+)/.exec(v);
        if (m && VAR_TO_PREF[m[1]]) return VAR_TO_PREF[m[1]];
    }
    return null;
}

// The guard's own list, read out of cyber-hud.js rather than retyped.
const guardBlock = /const CYBER_TEXT_SWATCHES = \[([\s\S]*?)\];/.exec(hudJs);
ok(!!guardBlock, 'cyber-hud.js declares CYBER_TEXT_SWATCHES');
const guardedPrefs = guardBlock
    ? (guardBlock[1].match(/pref:\s*'([a-zA-Z]+)'/g) || [])
          .map(s => /'([a-zA-Z]+)'/.exec(s)[1])
    : [];
ok(guardedPrefs.indexOf('cyberText') !== -1,
   'the guard still measures Text');
ok(guardedPrefs.length >= 1, 'the guard measures at least one swatch');

// Every `color: var(--rt-*)` in the theme, resolved to a swatch.
const colouredBy = {};
(cssCode.match(/color:\s*var\((--rt-[a-z0-9-]+)\)/g) || []).forEach(function (m) {
    const name = /var\((--rt-[a-z0-9-]+)\)/.exec(m)[1];
    const pref = resolveSwatchVar(name);
    if (pref) (colouredBy[pref] = colouredBy[pref] || []).push(name);
});

Object.keys(colouredBy).forEach(function (pref) {
    ok(guardedPrefs.indexOf(pref) !== -1,
       'the swatch "' + pref + '" colours text, so the contrast guard measures it',
       'via ' + colouredBy[pref].filter((v, i, a) => a.indexOf(v) === i).join(', ') +
       '; add it to CYBER_TEXT_SWATCHES in cyber-hud.js');
});

// ── NO COLOUR MAY BE UNREACHABLE ───────────────────────────────────
//
// Reported: with every swatch set to black, the HUD rail's LIVE tag was still
// bright green. It was --rt-lime, one of three 'fixed signal hues' the theme
// declared as "status only, never load-bearing for text" — and then used to
// colour text in four places.
//
// That is strictly worse than the defect this rework exists to fix. A dark
// Accent at least has a control the user could move; a literal in the
// stylesheet has none at all, and no contrast guard can measure it.
//
// So: every colour the theme paints has to trace back to a swatch. Status is
// carried by form instead — the LIVE tag blinks, the EQ button knocks out.
const PAINTS_TEXT = /(?:^|[^-])color:\s*([^;]+);/g;
const UNREACHABLE = ['--rt-magenta', '--rt-lime', '--rt-warn'];
UNREACHABLE.forEach(function (tok) {
    ok((decls[tok] || []).length === 0,
       tok + ' is gone — a hue no swatch reaches cannot be themed or measured',
       'if it is needed again, derive it from a swatch');
    ok(cssCode.indexOf('var(' + tok) === -1, tok + ' is not consumed anywhere');
});

// --rt-cyan survives only as the pre-JS fallback for the two accent swatches.
// It must never be painted with directly.
ok((decls['--rt-cyan'] || []).length > 0,
   '--rt-cyan is kept as the Highlight/Panel fallback');
const cyanUses = (cssCode.match(/var\(--rt-cyan/g) || []).length;
const cyanFallbackUses = (cssCode.match(/var\(--rt-cyan[^)]*\)\s*;/g) || []).length;
ok(cyanUses <= 4,
   '--rt-cyan is only referenced as a fallback, never painted with directly',
   'found ' + cyanUses + ' references');

// And the general form: nothing may paint text with a raw literal either.
let literalTextColours = [];
let mText;
while ((mText = PAINTS_TEXT.exec(cssCode)) !== null) {
    const v = mText[1].trim();
    if (/#[0-9a-fA-F]{3,8}\b/.test(v) && v.indexOf('var(') === -1) {
        literalTextColours.push(v.slice(0, 40));
    }
}
// The contrast chip's three states are the deliberate exception: a WARNING
// that changed colour with the palette would be useless, and it is settings
// chrome rather than part of the HUD.
const CHIP_LITERALS = ['#05ffa1', '#ffb300', '#ff2a6d'];
literalTextColours = literalTextColours.filter(function (v) {
    return !CHIP_LITERALS.some(function (c) { return v.indexOf(c) !== -1; });
});
eq(literalTextColours.length, 0,
   'no rule colours text with a raw literal',
   literalTextColours.join(' | '));

// --rt-data has to stay an ALIAS. If someone gives it a literal hex it
// escapes both the contrast guard and the teardown list, and the Highlight
// picker silently stops moving half the console.
ok((decls['--rt-data'] || []).length > 0, '--rt-data is declared');
ok((decls['--rt-data'] || []).every(v => v.indexOf('var(--rt-cyber-hl') !== -1),
   '--rt-data aliases the Highlight swatch rather than hardcoding a hue');
ok((decls['--rt-data-rgb'] || []).every(v => v.indexOf('var(--rt-cyber-hl-rgb') !== -1),
   '--rt-data-rgb aliases --rt-cyber-hl-rgb');
ok(/var\(--rt-data\)/.test(cssCode.replace(/--rt-data(-rgb)?:[^;]+;/g, '')),
   '--rt-data is actually consumed');

// ══════════════════════════════════════════════════════════════════
group('C3. the redesign\'s motifs are declared AND consumed');
// ══════════════════════════════════════════════════════════════════
// A token nobody reads is the failure mode this theme already had once:
// --rt-magenta and --rt-lime shipped declared-and-unused, and the glitchText
// keyframe existed with no referent. Each of these is checked for both ends.
const MOTIFS = [
    ['--rt-aberr',        'chromatic aberration'],
    ['--rt-comb',         'the fine tick comb'],
    ['--rt-dashrule',     'the segmented underline'],
    ['--rt-chevron-fill', 'the positive chevron meter fill'],
    ['--rt-studs',        'the frame edge studs'],
    ['--rt-grid-sq',      'the square console grid']
];
MOTIFS.forEach(function (pair) {
    const name = pair[0], label = pair[1];
    ok((decls[name] || []).length > 0, name + ' is declared (' + label + ')');
    const withoutDecl = cssCode.replace(new RegExp(name + ':[^;]+;', 'g'), '');
    ok(withoutDecl.indexOf('var(' + name + ')') !== -1,
       name + ' is consumed, not just declared');
});

// The aberration belongs on the title and nowhere else — it is the one
// display word in the composition, and a second aberrated element reads as a
// rendering fault rather than a style.
const aberrUses = (cssCode.match(/var\(--rt-aberr\)/g) || []).length;
eq(aberrUses, 1, 'the aberration is used exactly once');
ok(/\.summary-title\s*\{[^}]*var\(--rt-aberr\)/.test(cssCode.replace(/\n/g, ' ')),
   'the aberration is on the title');

// The title must NOT be a knocked-out plate any more. Pass 2 made it one,
// which made the heading and the primary button indistinguishable; the
// reference spends its plates on small tags instead. Asserted so a later
// edit cannot quietly restore it.
const titleRule = /\.summary-title\s*\{([^}]*)\}/.exec(cssCode.replace(/\n/g, ' '));
ok(!!titleRule, 'the title rule is present');
ok(titleRule && !/background:\s*var\(--rt-text\)/.test(titleRule[1]),
   'the title is open type, not a --rt-text plate');

// Every shape carries the mirrored clip, or alternating panels would fall
// back to an invalid value and render unclipped for that shape only.
const SHAPES = ['notched', 'chamfered', 'stepped', 'rounded'];
SHAPES.forEach(function (s) {
    const re = new RegExp('rt-shape-' + s + '\\s*\\{([\\s\\S]*?)\\}');
    const m = s === 'notched'
        ? /\.retro-theme,\s*\.retro-theme\.rt-shape-notched\s*\{([\s\S]*?)\}/.exec(cssCode)
        : re.exec(cssCode);
    ok(!!m && /--rt-clip-alt\s*:/.test(m[1]),
       'shape "' + s + '" declares --rt-clip-alt');
});
ok(/clip-path:\s*var\(--rt-clip-alt\)/.test(cssCode),
   '--rt-clip-alt is actually used to alternate a panel');

// ══════════════════════════════════════════════════════════════════
group('C4. Cyberpunk-only markup is hidden in Glassmorphic');
// ══════════════════════════════════════════════════════════════════
// renderFullContent() emits ONE tree for both themes. An rt-* element that is
// styled only under .retro-theme still lays out under Glassmorphic — as
// unstyled text dropped into the middle of the widget. The failure is
// invisible from the Cyberpunk side, which is why it is checked here.
//
// Both directions: nothing rendered is unhidden, and nothing hidden is
// unrendered (a stale entry in the hide list means a motif was removed and
// its CSS was left behind).
// Two kinds of rt-* class do NOT need their own hide rule, and both are
// listed rather than pattern-guessed so that adding a third is a decision
// somebody makes on purpose:
//
//   INNER  — laid out inside an element that is already hidden, so hiding
//            the wrapper hides these too.
//   STATE  — a class on the container that toggles behaviour rather than
//            adding an element. There is nothing to hide.
//   PASSTHROUGH - a wrapper around content that must stay visible in BOTH
//            themes. Hiding it would hide the thing it wraps. .rt-emo wraps
//            an emoji so the Cyberpunk tint filter lands on the glyph alone
//            instead of on the button around it; in Glassmorphic it is an
//            unstyled inline span and the emoji renders exactly as before.
const RT_INNER = /^rt-(sec-|ticker-|foot-row)/;
const RT_STATE = /^rt-(shape|booting|active)/;
const RT_PASSTHROUGH = /^rt-emo$/;
// rt-code is shared: it appears in the HUD rail and in the ticker, both of
// which are hidden as wholes.
const RT_SHARED = /^rt-code$/;

const renderedRt = new Set(
    (host.match(/class="(rt-[a-z-]+)[^"]*"/g) || [])
        .map(s => /class="(rt-[a-z-]+)/.exec(s)[1])
        .filter(c => !RT_INNER.test(c) && !RT_STATE.test(c) && !RT_SHARED.test(c) &&
                     !RT_PASSTHROUGH.test(c))
);
const hideBlock = /((?:\s*\.attendance-summary:not\(\.retro-theme\)[^,{]+,)+\s*\.attendance-summary:not\(\.retro-theme\)[^,{]+\{[^}]*\})/.exec(cssCode);
ok(!!hideBlock, 'the :not(.retro-theme) hide block is present');
const hidden = new Set(
    hideBlock ? (hideBlock[1].match(/\.(rt-[a-z-]+)/g) || [])
        .map(s => s.slice(1)) : []
);
renderedRt.forEach(function (c) {
    ok(hidden.has(c),
       'the rendered element ".' + c + '" is hidden in Glassmorphic',
       'add .attendance-summary:not(.retro-theme) .' + c + ' to the hide block');
});
// The other direction for passthrough: being in the hide block would be the
// bug. .rt-emo wraps an emoji the Glassmorphic theme still renders.
ok(!hidden.has('rt-emo'),
   '.rt-emo is NOT hidden in Glassmorphic',
   'hiding the wrapper hides the emoji it wraps');

hidden.forEach(function (c) {
    ok(renderedRt.has(c),
       'the hidden element ".' + c + '" is still rendered by the host',
       'stale entry — the motif is gone but its hide rule remains');
});

// The ticker text has to be duplicated, or translateX(-50%) lands mid-string
// and the loop visibly snaps back every cycle.
ok(/\$\{tickerRun\}\$\{tickerRun\}/.test(host),
   'the ticker run is emitted twice, so the -50% loop is seamless');
ok(/transform:\s*translateX\(-50%\)/.test(cssCode),
   'rtTicker travels exactly -50%');

// The punch-log footer total is patched in place by updateDynamicContent(),
// because that function does not re-render the table. Without this the number
// freezes at page load.
ok(/id="rt-day-total"/.test(host), 'the footer total has an id');
ok(/cachedElements\.dayTotal/.test(host),
   'updateDynamicContent() keeps the footer total live');

// ══════════════════════════════════════════════════════════════════
group('C5. animation containment');
// ══════════════════════════════════════════════════════════════════
// Three animation bugs were reported against pass 3, and all three were the
// same shape of mistake: one element being asked to do two things that pull
// in opposite directions. They are cheap to reintroduce and invisible in a
// diff, so each is pinned here.

// ── 1. the meter highlight must be clipped ─────────────────────────
// .progress-fill::after travels from -100% to 200% of its own width. With
// the fill overflow:visible that sweep ran clear across the whole widget —
// entering left of the track and leaving off the right edge.
const fillRule = /\.progress-fill\s*\{([^}]*)\}/.exec(cssCode.replace(/\n/g, ' '));
ok(!!fillRule, 'the .progress-fill rule is present');
ok(fillRule && /overflow:\s*hidden/.test(fillRule[1]),
   '.progress-fill clips its own highlight sweep',
   'without overflow:hidden the sweep escapes the track in both directions');

// ── 2. the playhead belongs to the track, not the fill ─────────────
// It has to overhang the track vertically, which the fill can no longer
// allow now that the fill clips. Putting it back on the fill re-creates the
// exact conflict: one element cannot be both clipped and not clipped.
ok(/\.progress-bar::after\s*\{/.test(cssCode),
   'the playhead is drawn on the track (.progress-bar::after)');
ok(!/\.progress-fill::before\s*\{/.test(cssCode),
   'the playhead is NOT on the fill',
   'the fill clips now, so a pseudo-element there cannot overhang');
const headRule = /\.progress-bar::after\s*\{([^}]*)\}/.exec(cssCode.replace(/\n/g, ' '));
ok(headRule && /var\(--rt-progress/.test(headRule[1]),
   'the playhead reads its position from --rt-progress');

// The host owns that value, and nothing re-renders the meter markup, so a
// missed update leaves the playhead parked where the page loaded while the
// fill keeps moving.
ok(/--rt-progress:\s*\$\{progress\}%/.test(host),
   'renderFullContent() writes --rt-progress on the track');
ok(/property:\s*'--rt-progress'/.test(host),
   'updateDynamicContent() keeps --rt-progress in step with the fill width');
// A custom property is neither a style key nor an element property, so
// assigning it either way is a silent no-op — the applier needs the branch.
ok(/startsWith\('--'\)/.test(host) && /setProperty\(update\.property/.test(host),
   'the update applier writes custom properties with setProperty()');

// ── 3. no transform on the container CRT layer ─────────────────────
// That pseudo-element paints THREE layers whose motions differ: the bottom
// hazard strip crawls sideways, the scanlines jitter downward, the vignette
// holds still. A transform moves all three together, which is why the frame
// edge was seen bobbing vertically in lockstep with the CRT jitter. The
// motions are per-layer background-position lists instead.
const afterRule =
    /\.attendance-summary\.retro-theme::after\s*\{([\s\S]*?)\n            \}/.exec(cssCode);
ok(!!afterRule, 'the container CRT layer rule is present');
if (afterRule) {
    const body = afterRule[1];
    const anim = /animation:([^;]*);/.exec(body);
    ok(!!anim, 'the CRT layer runs animations');
    const names = anim
        ? (anim[1].match(/rt[A-Za-z]+/g) || [])
        : [];
    ok(names.length >= 2,
       'the CRT layer runs the crawl and the jitter as separate animations',
       'got: ' + names.join(', ') + ' — one animation cannot give two layers ' +
       'different directions and different timing');
    names.forEach(function (n) {
        const kf = new RegExp('@keyframes\\s+' + n + '\\s*\\{([\\s\\S]*?)\\n            \\}')
            .exec(cssCode);
        ok(!!kf, '@keyframes ' + n + ' is declared');
        if (kf) {
            ok(!/transform\s*:/.test(kf[1]),
               '@keyframes ' + n + ' does not transform the CRT layer',
               'a transform there drags the bottom hazard strip and the ' +
               'vignette along with the scanlines');
        }
    });
    // A single no-repeat band stretched to 100% cannot crawl, however it is
    // animated — the strip has to be a repeating tile.
    ok(/--rt-hazard-dim\)\s*left bottom\s*\/\s*22px 7px repeat-x/.test(body),
       'the bottom edge strip is a repeating 22px tile, so it can crawl');
}

// The per-layer lists have to stay the same length as the background stack.
// background-position-x: "0, 0, 0" against four layers leaves the fourth
// taking the initial value, and against two layers the extra is dropped —
// either way the motion silently attaches to the wrong layer, and adding a
// background layer here is exactly the edit that would do it.
function topLevelCount(value) {
    let depth = 0, n = 1;
    for (const ch of value) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) n++;
    }
    return n;
}
if (afterRule) {
    const bg = /background:([\s\S]*?);/.exec(afterRule[1]);
    ok(!!bg, 'the CRT layer declares a background stack');
    if (bg) {
        const layers = topLevelCount(bg[1].trim());
        eq(layers, 3, 'the CRT layer paints three background layers');
        [['rtEdgeCrawl', 'background-position-x'],
         ['rtScanDrift', 'background-position-y']].forEach(function (pair) {
            const kf = new RegExp('@keyframes\\s+' + pair[0] +
                                  '\\s*\\{([\\s\\S]*?)\\n            \\}').exec(cssCode);
            if (!kf) return;
            const re = new RegExp(pair[1] + ':([^;}]*)', 'g');
            let m, seen = 0;
            while ((m = re.exec(kf[1])) !== null) {
                seen++;
                eq(topLevelCount(m[1].trim()), layers,
                   pair[0] + ' lists one ' + pair[1] + ' value per background layer');
            }
            ok(seen >= 2, pair[0] + ' sets ' + pair[1] + ' at both ends');
        });
    }
}

// The crawl period must equal the tile width or the loop point shows.
const edgeKf = /@keyframes\s+rtEdgeCrawl\s*\{([\s\S]*?)\n            \}/.exec(cssCode);
ok(edgeKf && /background-position-x/.test(edgeKf[1]),
   'rtEdgeCrawl moves the strip horizontally');
ok(edgeKf && /22px/.test(edgeKf[1]),
   'rtEdgeCrawl travels exactly one 22px tile');
const scanKf = /@keyframes\s+rtScanDrift\s*\{([\s\S]*?)\n            \}/.exec(cssCode);
ok(scanKf && /background-position-y/.test(scanKf[1]),
   'rtScanDrift moves the scanlines vertically');

// ══════════════════════════════════════════════════════════════════
group('C6. the glow slider has to be worth dragging');
// ══════════════════════════════════════════════════════════════════
// Reported: "the glow increase is not noticeable on max slider input".
//
// The cause was structural, not a tuning miss. --rt-glow-mul multiplied ALPHA
// and nothing else — every blur radius in the theme was a fixed literal. At
// the default the main glow already sat at 0.51 alpha, so the whole top half
// of the travel moved it to 0.85 across an unchanged 7px blur. Size is the
// channel that reads as "more glow"; opacity alone saturates and stops
// saying anything.
//
// So the rule is now: if a shadow scales with the glow control at all, it
// scales its RADIUS too. That is mechanically checkable, and it is the only
// assertion here that would have caught the original defect.

ok((decls['--rt-glow-k'] || []).length > 0, '--rt-glow-k is declared');
// The CSS fallback and the JS constant are the same fact written twice, in two
// files. They are only both right by accident unless something checks.
const cssGlowDefault = (decls['--rt-glow-k'] || [])[0];
const jsGlowDefault = /const CYBER_GLOW_DEFAULT\s*=\s*([0-9.]+)/.exec(hudJs);
ok(!!jsGlowDefault, 'cyber-hud.js declares CYBER_GLOW_DEFAULT');
ok(jsGlowDefault && parseFloat(cssGlowDefault) === parseFloat(jsGlowDefault[1]),
   'the CSS fallback for --rt-glow-k matches CYBER_GLOW_DEFAULT',
   'css has ' + cssGlowDefault + ', js has ' + (jsGlowDefault && jsGlowDefault[1]));

// A RADIUS FLOOR.
//
// The second wrong turn on this control was scaling a radius too small to
// matter. Pass 2 had tightened the base from 18px to 7px, on the reasoning
// that a small hard halo reads as a lit filament and a wide soft one reads as
// fog. At 7px there is barely a halo to scale, so widening the slider's range
// did almost nothing — the base is what has to stay generous.
const glowTokenDecl = (decls['--rt-glow'] || [])[0] || '';
const glowRadii = (glowTokenDecl.match(/([0-9.]+)px/g) || []).map(parseFloat);
ok(glowRadii.length >= 2,
   '--rt-glow is layered: a hot core plus at least one wider bloom',
   'one blur wide enough to spread really does turn to fog; a small bright ' +
   'layer under a large dim one does not');
ok(Math.max.apply(null, glowRadii.concat([0])) >= 30,
   '--rt-glow spreads at least 30px at full intensity',
   'got ' + Math.max.apply(null, glowRadii.concat([0])) + 'px, which is too ' +
   'tight to see scaling - that is what made the slider feel dead');

// The CSS must read the normalised scale, never the raw preference: the two
// differ by a factor of the default, so mixing them silently mis-scales
// whichever rule was missed.
const rawInCss = (cssCode.match(/var\(--rt-glow-mul\)/g) || []).length;
eq(rawInCss, 0,
   'no rule reads --rt-glow-mul directly; they all read --rt-glow-k',
   'the raw preference and the normalised scale differ by ' +
   'CYBER_GLOW_DEFAULT, so a rule reading the wrong one is off by that factor');

// Every shadow that scales with the glow control scales its radius as well.
// Matches box-shadow / text-shadow / drop-shadow() values that mention
// --rt-glow-k, and checks the LENGTH part mentions it too, not only the
// rgba() alpha.
// A balanced-paren scan, not a regex. These values nest three deep —
// drop-shadow( calc( ( ... ) * var() ) rgba( ..., calc( ... ) ) ) — and a
// regex written for one level of nesting silently MISSES the deepest ones,
// which are exactly the compound radii this section exists to check. The
// first version of this assertion found 7 of 11 and looked like it was
// working.
function extractCalls(src, fname) {
    const out = [];
    let i = 0;
    while ((i = src.indexOf(fname + '(', i)) !== -1) {
        let depth = 0, j = i + fname.length;
        for (; j < src.length; j++) {
            if (src[j] === '(') depth++;
            else if (src[j] === ')') { depth--; if (depth === 0) { j++; break; } }
        }
        out.push(src.slice(i, j));
        i = j;
    }
    return out;
}

// The two glow TOKENS are shadow values too, just declared as custom
// properties rather than on a shadow longhand — and they are the pair every
// other rule inherits from, so they matter most.
const glowTokenDecls = (cssCode.match(/--rt-glow(?:-soft)?:[^;]+;/g) || []);
const shadowDecls = cssCode.match(/(?:box-shadow|text-shadow)\s*:[^;]+;/g) || [];
const dropShadows = extractCalls(cssCode, 'drop-shadow');
const glowShadows = glowTokenDecls.concat(shadowDecls).concat(dropShadows)
    .filter(s => s.indexOf('--rt-glow-k') !== -1);
ok(glowShadows.length >= 11,
   'the glow control reaches a meaningful number of shadows',
   'found ' + glowShadows.length);

// Remove every rgb()/rgba() call, parens balanced. The colour argument nests
// two deep — rgba(var(--x), calc(n * var(--y))) — and a one-level regex fails
// to strip it, leaving --rt-glow-k visible in what is supposed to be the
// geometry. That made this whole section pass on an alpha-only glow, which is
// the exact defect it exists to catch. Found by reintroducing the bug and
// watching the suite stay green.
function stripCalls(src, fname) {
    let out = src, i;
    while ((i = out.indexOf(fname + '(')) !== -1) {
        let depth = 0, j = i + fname.length;
        for (; j < out.length; j++) {
            if (out[j] === '(') depth++;
            else if (out[j] === ')') { depth--; if (depth === 0) { j++; break; } }
        }
        if (depth !== 0) break;
        out = out.slice(0, i) + out.slice(j);
    }
    return out;
}

glowShadows.forEach(function (s) {
    // Strip the colour so only the geometry is left. If --rt-glow-k survives
    // that, the radius (or an offset) scales with it.
    const geometry = stripCalls(stripCalls(s, 'rgba'), 'rgb');
    const label = s.replace(/\s+/g, ' ').slice(0, 62);
    ok(geometry.indexOf('--rt-glow-k') !== -1,
       '"' + label + '" scales its radius, not only its alpha',
       'alpha-only scaling is what made the slider feel dead past halfway');
});

// ══════════════════════════════════════════════════════════════════
group('C7. no control is there for show');
// ══════════════════════════════════════════════════════════════════
// The harness rig is the only way anyone judges this theme, so a control that
// looks wired and is not costs more than no control at all — it produces a
// confident "I checked that" about something never exercised.
//
// Two ways that happens, and both had actually happened:
//   * an input with no listener;
//   * a listener that toggles a class nothing styles. The Game Mode button
//     toggled ".gm-off", which appears in no stylesheet anywhere, and faked
//     the visible part with inline display:none — so it exercised none of the
//     real collapse path while looking like it worked.

const harness = fs.readFileSync(path.join(__dirname, 'cyber-harness.html'), 'utf8');
const rigBlock = /<div class="rig">([\s\S]*?)<\/div>\s*\n\s*<script>/.exec(harness);
ok(!!rigBlock, 'the harness rig block is found');

// Everything after the first inline <script> that follows the rig markup.
const scriptStart = harness.indexOf('<script>', rigBlock ? rigBlock.index : 0);
const harnessJs = scriptStart === -1 ? '' : harness.slice(scriptStart);

// Wired elsewhere, by class, inside the modules the harness loads.
const WIRED_IN_MODULES = {
    'cyber-contrast-chip': 'updateCyberContrastChip() finds it by class'
};

if (rigBlock) {
    const rigIds = (rigBlock[1].match(/id="([a-zA-Z0-9_-]+)"/g) || [])
        .map(s => /id="([a-zA-Z0-9_-]+)"/.exec(s)[1]);
    ok(rigIds.length >= 8, 'the rig exposes a meaningful number of controls',
       'found ' + rigIds.length);
    rigIds.forEach(function (id) {
        if (WIRED_IN_MODULES[id]) { pass++; return; }
        ok(harnessJs.indexOf("'" + id + "'") !== -1,
           'rig control "#' + id + '" is read or written by the rig script',
           'an unwired control is worse than a missing one');
    });
}

// Every class the rig toggles must exist as a selector somewhere that is
// actually loaded — the theme, or the harness's own base/chrome sheet.
const harnessStyles = (harness.match(/<style>([\s\S]*?)<\/style>/g) || []).join('\n');
const toggled = new Set();
(harnessJs.match(/classList\.(?:toggle|add|remove)\(\s*'([a-zA-Z0-9_-]+)'/g) || [])
    .forEach(function (m) {
        toggled.add(/\(\s*'([a-zA-Z0-9_-]+)'/.exec(m)[1]);
    });
ok(toggled.size > 0, 'the rig toggles classes at all');
toggled.forEach(function (c) {
    const styled = cssCode.indexOf('.' + c) !== -1 ||
                   harnessStyles.indexOf('.' + c) !== -1;
    ok(styled, 'the class "' + c + '" the rig toggles is styled somewhere',
       'nothing selects .' + c + ' — the control changes no rendering');
});

// Game Mode specifically has to drive the widget's real class names, or the
// rig proves nothing about the thing that actually ships.
ok(/game-mode-hidden/.test(harnessJs),
   'the rig collapses panels with the widget\'s own .game-mode-hidden');
ok(/game-mode-off/.test(harnessJs),
   'the rig shrinks the widget with the widget\'s own .game-mode-off');
ok(/game-mode-hidden/.test(harnessStyles),
   'the harness base sheet carries the Game Mode collapse rules');

// The rig and the real settings panel must convert glow the same way, or the
// rig is calibrated to something the user never sees.
ok(/cyberGlowFromPct\(/.test(harnessJs) && /cyberGlowToPct\(/.test(harnessJs),
   'the rig glow slider uses the module converters, not its own arithmetic');
ok(/cyberGlowFromPct\(/.test(host) && /cyberGlowToPct\(/.test(host),
   'the settings panel uses the same converters');

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
// A filter on an ancestor becomes the containing block for position:fixed
// descendants, and the widget has two — #aim-results and .lb-ach-popover —
// which would both start positioning against the widget instead of the
// viewport.
const containerRule = (cssCode.match(
    /\.attendance-summary\.retro-theme\s*\{[^}]*\}/) || [''])[0];
ok(containerRule.length > 0, 'the container rule was found');
ok(!/(^|[^-])filter:/.test(containerRule),
   'the container declares no filter (it would reparent #aim-results and .lb-ach-popover)');
// Same hazard for the side panels, which hold #aim-results directly.
const sidePanelRule = (cssCode.match(
    /\.attendance-summary\.retro-theme \.snake-game-container,[\s\S]*?\}/) || [''])[0];
ok(sidePanelRule.length > 0, 'the side-panel rule was found');
ok(!/(^|[^-])filter:\s*var\(--rt-outline\)/.test(sidePanelRule),
   'the side panels declare no outline filter (they contain the fixed-position game results)');
ok(!/clip-path/.test(sidePanelRule),
   'the side panels are never clipped (game canvases, trays and popovers escape their box)');
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
ok(applyFn.indexOf("setProperty('--rt-") === -1,
   'applyPreferences writes no --rt-* property directly (all of them go through CYBER_TOKENS)');
ok(applyFn.indexOf("removeProperty('--rt-") === -1,
   'applyPreferences removes no --rt-* property directly');
ok(applyFn.indexOf('triggerCyberBoot(container)') !== -1,
   'applyPreferences fires the boot-in reveal');
ok(/const enteringRetro = !container\.classList\.contains\('retro-theme'\)/.test(applyFn),
   'the boot-in only fires on entering the theme, not on every colour-slider move');

// File-wide, not just inside the managed block: the compact-PiP Cyberpunk rules
// live outside cyber-dev/ but belong to this theme, and they carried the same
// box-shadow-animation defect. Any keyframe a .retro-theme rule runs must not
// animate box-shadow, wherever that keyframe is declared.
const hostCss = host.replace(/\/\*[\s\S]*?\*\//g, '');
const retroAnims = new Set();
(hostCss.match(/([^{}]+)\{([^{}]*)\}/g) || []).forEach(function (rule) {
    const brace = rule.indexOf('{');
    // :not(.retro-theme) is how nearly every Glassmorphic rule is written, so a
    // naive search for ".retro-theme" in the selector matches the exact rules
    // this check must ignore. Strip the negations first.
    const selector = rule.slice(0, brace).replace(/:not\([^)]*\)/g, '');
    if (selector.indexOf('.retro-theme') === -1) return;
    (rule.slice(brace).match(/animation:\s*([a-zA-Z0-9_-]+)/g) || []).forEach(function (a) {
        const name = a.replace(/animation:\s*/, '');
        // "animation: none" is a reset, not a keyframe reference.
        if (name !== 'none') retroAnims.add(name);
    });
});
ok(retroAnims.size > 0, 'found the animations the Cyberpunk rules run',
   [...retroAnims].join(', '));
retroAnims.forEach(function (name) {
    const kfRe = new RegExp('@keyframes\\s+' + name + '\\s*\\{(?:[^{}]|\\{[^{}]*\\})*\\}');
    const body = (hostCss.match(kfRe) || [''])[0];
    ok(body.length > 0, 'keyframe ' + name + ' is declared somewhere in the file');
    ok(body.indexOf('box-shadow') === -1,
       'keyframe ' + name + ', run by a .retro-theme rule, does not animate box-shadow');
});
ok(!retroAnims.has('neonGlowPulse'),
   'the compact-PiP display no longer runs neonGlowPulse (hardcoded colours, animated box-shadow)');

// Greeble carries real values in HUD dress, not invented serial numbers: a
// timesheet widget covered in fake codes is clutter, the same data in mono is
// characterful. Assert it is wired to something real.
ok(host.indexOf('rt-hud-rail') !== -1, 'the HUD greeble rail is rendered');
const railHtml = (host.match(/<div class="rt-hud-rail"[\s\S]*?<\/div>/) || [''])[0];
ok(railHtml.indexOf('BUILD') !== -1 && railHtml.indexOf('BUILD_LABEL') !== -1,
   'the rail shows the real build label');
ok(/LOAD \$\{Math\.round\(progress\)\}%/.test(railHtml),
   'the rail shows the real shift progress');
ok(railHtml.indexOf('shiftCode') !== -1, 'the rail shows the real shift length');
ok(railHtml.indexOf('aria-hidden="true"') !== -1,
   'the greeble is hidden from assistive tech (it is decoration)');
ok(/\.rt-hud-rail[^{]*\{[^}]*pointer-events:\s*none/.test(cssCode),
   'the greeble is pointer-transparent');

// And that block really is inside the centre column. Game Mode collapses
// .left-panel and .right-panel only, so anything in main-attendance-content
// survives it — which is why the progress bar lives there.
const centre = (host.match(/<div class="main-attendance-content">[\s\S]*?\n            <\/div>/) || [''])[0];
ok(centre.indexOf('${progressBarHTML}') !== -1,
   'the progress bar block is interpolated inside .main-attendance-content, so Game Mode keeps it');
const leftPanel  = (host.match(/const leftPanelHTML = `[\s\S]*?\n        `;/) || [''])[0];
const rightPanel = (host.match(/const rightPanelHTML = `[\s\S]*?\n        `;/) || [''])[0];
ok(leftPanel.length > 0 && rightPanel.length > 0, 'both side-panel templates were found');
eq(host.indexOf("const BUILD_LABEL = 'v8'") !== -1, true, 'BUILD_LABEL bumped to v8');
ok((host.match(/\.attendance-summary\.retro-theme \.stat-card::before\s*\{/g) || []).length === 1,
   'only one .retro-theme .stat-card::before rule in the file (the orphan outside the block is gone)');

// ══════════════════════════════════════════════════════════════════
group('F. modules load and behave');
// ══════════════════════════════════════════════════════════════════
const { load } = require('./load.js');
let m = null;
try {
    m = load();
    ok(true, 'cyber-hud.js evaluates cleanly');
} catch (e) {
    ok(false, 'modules evaluate', e && e.message);
}

if (m) {
    // -- panel shape --
    group('G. panel shape');
    eq(JSON.stringify(m.CYBER_PANEL_SHAPES),
       JSON.stringify(['notched', 'chamfered', 'stepped', 'rounded']),
       'CYBER_PANEL_SHAPES is the documented roster, asymmetric shapes first');
    eq(m.CYBER_PANEL_SHAPES[0], 'notched',
       'the shipped shape is the asymmetric one — symmetry is most of what reads as sci-fi');
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
    eq(m.cyberPanelShape(), 'notched',
       'an unknown shape falls back to notched, never to no shape at all');
    m.applyCyberShape(m.container);
    ok(m.container.classList.contains('rt-shape-notched'), 'the fallback shape is actually applied');
    // The fallback must match what the bare .retro-theme block declares, or an
    // unknown value renders with one shape's tokens and no shape's class.
    const bareShape = (cssCode.match(
        /\.retro-theme,\s*\.retro-theme\.rt-shape-([a-z]+)\s*\{/) || [])[1];
    eq(bareShape, m.cyberPanelShape(),
       'the bare .retro-theme token block declares the same shape as the JS fallback');
    // Each silhouette must be genuinely different, or the setting is cosmetic.
    const clipShapes = m.CYBER_PANEL_SHAPES.map(function (sh) {
        const i = cssCode.indexOf('.rt-shape-' + sh);
        const body = cssCode.slice(i, cssCode.indexOf('}', i));
        return (body.match(/--rt-clip:\s*([^;]+);/) || [])[1];
    });
    eq(new Set(clipShapes).size, m.CYBER_PANEL_SHAPES.length,
       'every shape has a distinct --rt-clip silhouette');
    m.clearCyberShape(m.container);
    eq(m.CYBER_PANEL_SHAPES.filter(s => m.container.classList.contains('rt-shape-' + s)).length, 0,
       'clearCyberShape removes every shape class');
    global.userPreferences.cyberPanelShape = 'notched';

    // -- tokens: write / teardown mirror --
    group('H. token write and teardown mirror');
    const names = m.cyberTokenVarNames();
    ok(names.indexOf('--rt-text') !== -1, 'the teardown list covers --rt-text');
    ok(names.indexOf('--rt-glow-color') !== -1, 'the teardown list covers --rt-glow-color');
    ok(names.indexOf('--rt-border-color') !== -1, 'the teardown list covers --rt-border-color');
    ok(names.indexOf('--rt-glow-mul') !== -1, 'the teardown list covers --rt-glow-mul');

    const el = require('./load.js').makeEl('div');
    m.applyCyberTokens(el);
    const written = Object.keys(el.style.props);
    written.forEach(function (p) {
        ok(names.indexOf(p) !== -1, 'written property ' + p + ' is in the teardown list');
    });
    // Ask the module for the companion name rather than rebuilding it here.
    // This assertion used to derive it as varName + '-rgb' — the same wrong
    // way applyCyberTokens() derived it — so it passed on a theme whose Glow
    // and Border swatches moved nothing at all. A check that reconstructs the
    // logic it is checking can only ever confirm the code agrees with itself.
    const rgbNameOf = t => t.rgbName || t.varName + '-rgb';
    m.CYBER_TOKENS.forEach(function (t) {
        ok(written.indexOf(t.varName) !== -1, t.pref + ' writes ' + t.varName);
        if (t.rgb) ok(written.indexOf(rgbNameOf(t)) !== -1,
                      t.pref + ' writes ' + rgbNameOf(t));
    });

    // ══════════════════════════════════════════════════════════════════
    group('H2. the property names JS writes are the ones the CSS reads');
    // ══════════════════════════════════════════════════════════════════
    // THE ONE CHECK THAT CROSSES THE JS/CSS BOUNDARY, and the only kind that
    // could have caught the defect it was written for.
    //
    // applyCyberTokens() built each companion's name as varName + '-rgb'.
    // For the two swatches whose varName ends in '-color' that produced
    // --rt-glow-color-rgb and --rt-border-color-rgb, which appear nowhere in
    // the stylesheet; the CSS reads --rt-glow-rgb (21 sites) and
    // --rt-border-rgb (17). So Glow and Border wrote to properties with no
    // readers and every frame, grid line and bloom in the theme stayed at the
    // yellow default whatever the pickers said.
    //
    // Everything else was green throughout, and necessarily so: teardown
    // derived the name the same wrong way, section H rebuilt it the same wrong
    // way, and section C confirmed --rt-border derives from --rt-border-rgb
    // *within the CSS*, which was true. Every list agreed with every other
    // list on its own side of the boundary. Nothing looked across it.
    const writtenRgb = written.filter(p => /-rgb$/.test(p));
    ok(writtenRgb.length > 0, 'applyCyberTokens writes rgb companions at all');
    writtenRgb.forEach(function (p) {
        ok(consumed.has(p),
           'the written property ' + p + ' is read by the stylesheet',
           'nothing consumes var(' + p + ') — this swatch moves nothing');
        ok(declared.has(p),
           'the written property ' + p + ' has a declared default in the theme',
           'without one it is unset until JS runs and every rule using it is invalid');
    });

    // ---- H3 is appended after this group; see below. ----
    // The reverse direction. A companion the CSS reads but JS never writes is
    // a hue no swatch reaches — unless it is an alias of one that IS written
    // (--rt-data-rgb -> --rt-cyber-hl-rgb) or the pre-JS cyan fallback.
    const RGB_FALLBACKS = ['--rt-cyan-rgb'];
    [...consumed].filter(v => /-rgb$/.test(v)).forEach(function (v) {
        if (writtenRgb.indexOf(v) !== -1) { pass++; return; }
        if (RGB_FALLBACKS.indexOf(v) !== -1) { pass++; return; }
        const aliasesWritten = (decls[v] || []).length > 0 &&
            (decls[v] || []).every(d => writtenRgb.some(w => d.indexOf(w) !== -1));
        ok(aliasesWritten,
           v + ' is written by JS or aliases a property that is',
           'no swatch can reach it, so the contrast guard cannot measure it either');
    });
    // ══════════════════════════════════════════════════════════════════
    group('H3. the emoji tint id agrees across JS and CSS');
    // ══════════════════════════════════════════════════════════════════
    // Same failure shape as H2, different pair. The filter element is built
    // in JS with an id, and the stylesheet reaches it by url(#that-id).
    // Nothing links the two but a matching string, and a mismatch is silent:
    // Chrome ignores a filter reference it cannot resolve and simply paints
    // the emoji untinted (verified in a real engine), so the feature just
    // quietly does nothing.
    const filterId = (hudJs.match(/CYBER_EMOJI_FILTER_ID\s*=\s*'([^']+)'/) || [])[1];
    ok(!!filterId, 'cyber-hud.js declares CYBER_EMOJI_FILTER_ID');
    const cssFilterRefs = [...new Set(
        (cssCode.match(/url\(#([a-z0-9-]+)\)/g) || []).map(x => /url\(#([a-z0-9-]+)\)/.exec(x)[1]))];
    ok(cssFilterRefs.length > 0, 'the stylesheet references a filter by url(#...)');
    cssFilterRefs.forEach(function (ref) {
        ok(ref === filterId,
           'url(#' + ref + ') matches the id JS actually creates',
           'JS builds #' + filterId + ' — a mismatch paints the emoji untinted, silently');
    });

    // The tint must never land on an element that paints a background or a
    // border: a filter applies to everything the element paints, so tinting
    // a button would duotone its border and its knocked-out fill too.
    const tintedSelectors = (cssCode.match(/([^{}]+)\{([^{}]*)\}/g) || [])
        .filter(r => /filter:[^;}]*(--rt-emo|url\(#)/.test(r))
        .map(r => r.slice(0, r.indexOf('{')).trim());
    ok(tintedSelectors.length > 0, 'some rule applies the tint');
    const FORBIDDEN_TINT = [",", ".game-switch-btn", ".settings-button", ".stat-card",
                            ".attendance-summary.retro-theme {"];
    tintedSelectors.forEach(function (sel) {
        const bad = /\.game-switch-btn|\.settings-button|\.stat-card|\.left-panel|\.right-panel/.test(sel);
        ok(!bad, 'the tint is not applied to a background-painting element: ' + sel.slice(0, 60),
           'a filter duotones the border and fill as well as the glyph');
        const isContainer = /\.attendance-summary\.retro-theme\s*(,|\{|$)/.test(sel);
        ok(!isContainer, 'the tint is not applied to the container itself',
           'a filter there becomes the containing block for #aim-results and .lb-ach-popover');
    });

    // The ramp has to have three stops. Two makes a flat duotone that loses
    // every specular highlight, which is what made the glyphs unreadable.
    ok(/CYBER_TINT_HILITE/.test(hudJs), 'the highlight stop is a named constant');
    const tintFn = (hudJs.match(/function cyberTintTable[\s\S]*?\n    \}/) || [''])[0];
    ok(/'0 ' \+ v\.toFixed\(4\) \+ ' ' \+ hi\.toFixed\(4\)/.test(tintFn),
       'the ramp emits three stops (0, hue, highlight)',
       'a two-stop duotone collapses highlights and the glyphs go muddy');

    // sRGB or the transfer runs in linearRGB and the result is hue-shifted
    // away from the swatch the user picked.
    ok(/color-interpolation-filters['"\s,)]*,\s*'sRGB'/.test(hudJs) ||
       /color-interpolation-filters[^\n]*sRGB/.test(hudJs),
       'the filter is declared sRGB, not the linearRGB default');

    // Teardown: the defs node is appended to <body>, outside the widget, so
    // nothing else removes it on a theme switch.
    ok(/clearCyberEmojiFilter\(document\)/.test(hudJs),
       'clearCyberpunkTheme removes the injected filter defs',
       'left behind, it is an orphaned <svg> in the Glassmorphic DOM');
    ok(/ensureCyberEmojiFilter\(pipWindow\.document\)/.test(hudJs),
       'the PiP document gets its own defs',
       'a filter reference resolves per-document; the clone cannot see the parent\'s');

    group('H. token write and teardown mirror');
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

    // ══════════════════════════════════════════════════════════════════
    group('H4. every built-in palette passes the contrast guard it ships with');
    // ══════════════════════════════════════════════════════════════════
    // The whole point of the six-palette picker is "pick one, get something
    // that already works" — a preset that fails the guard it ships beside is
    // worse than no preset, because it teaches the user the warning is noise.
    // This is checked with the SAME pure contrast math the runtime chip uses
    // (cyberWorstContrast(), driven by CYBER_TEXT_SWATCHES), not a hand-rolled
    // second implementation that could disagree with it.
    ok(!!m.CYBER_PALETTES, 'CYBER_PALETTES is exported');
    const paletteKeys = Object.keys(m.CYBER_PALETTES || {});
    eq(paletteKeys.length, 6, 'there are six built-in palettes', 'got ' + paletteKeys.length);
    const PALETTE_SWATCH_PREFS = ['cyberBgPrimary', 'cyberBgSecondary', 'cyberAccent',
        'cyberHighlight', 'cyberPanelTint', 'cyberText', 'cyberGlow', 'cyberBorder'];
    // Mirrors cyberWorstContrast()'s own logic but takes an explicit palette
    // object instead of reading the global userPreferences — calling load()
    // again per palette would do that (stubEnvironment() reassigns
    // global.document/userPreferences on every call), leaving whichever
    // palette ran last as the ambient stub state for every section below
    // this one. contrastRatio() is pure hex-in, ratio-out; using it directly
    // sidesteps the whole class of cross-test pollution.
    function paletteWorstContrast(p) {
        let worst = null;
        m.CYBER_TEXT_SWATCHES.forEach(function (s) {
            const hex = p[s.pref] || s.fallback;
            const ratio = Math.min(
                m.contrastRatio(hex, p.cyberBgPrimary || '#07091a'),
                m.contrastRatio(hex, p.cyberBgSecondary || '#11142b')
            );
            if (!worst || ratio < worst.ratio) worst = { ratio: ratio, label: s.label };
        });
        return worst;
    }
    paletteKeys.forEach(function (key) {
        const p = m.CYBER_PALETTES[key];
        ok(typeof p.label === 'string' && p.label.length > 0, key + ' has a display label');
        PALETTE_SWATCH_PREFS.forEach(function (pref) {
            ok(/^#[0-9a-f]{6}$/i.test(p[pref] || ''),
               key + '.' + pref + ' is a real hex colour', String(p[pref]));
        });
        const worst = paletteWorstContrast(p);
        ok(worst.ratio >= 4.5,
           key + ' (' + p.label + ') worst text contrast is AA-passing: ' +
               worst.ratio.toFixed(2) + ':1 (' + worst.label + ')',
           'a shipped preset failing its own guard teaches the warning is noise');
    });
    // Never a literal — see the note beside --rt-data in the token contract.
    // A palette author picking a random hex for Highlight would silently
    // desync the punch log's worked-time column from whatever the CSS
    // actually renders.
    ok(themeCss.indexOf('--rt-data: var(--rt-cyber-hl)') !== -1 ||
       /--rt-data\s*:\s*var\(--rt-cyber-hl/.test(themeCss),
       '--rt-data still aliases --rt-cyber-hl rather than a literal');

    // ══════════════════════════════════════════════════════════════════
    group('H5. the emoji sweep — universal coverage, not a hand-typed list');
    // ══════════════════════════════════════════════════════════════════
    // The wrap-every-known-template-literal approach (32 sites, by hand)
    // still missed the achievement badges, the leaderboard join card and the
    // settings-modal close button — every one of those injects its icon from
    // ACHIEVEMENTS[key].icon or similar at RENDER time, which no regex over
    // the source can find. This section checks the mechanism that replaced
    // it: a DOM sweep plus a live MutationObserver, and the handful of host
    // call sites that feed it.
    ok(/const CYBER_EMOJI_RUN_RE\s*=/.test(hudJs), 'the emoji-run regex is a named constant');
    ok(/\\p\{Emoji_Presentation\}/.test(hudJs) && /\\p\{Extended_Pictographic\}\\uFE0F/.test(hudJs),
       'the regex matches Emoji_Presentation, and Extended_Pictographic only when forced by FE0F',
       'Extended_Pictographic alone also matches plain monochrome glyphs (checkmarks, arrows, stars) that already correctly follow --rt-text');
    ['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'SELECT'].forEach(function (tag) {
        ok(new RegExp(tag + ':\\s*1').test(hudJs), 'the sweep never enters a <' + tag + '>');
    });
    ok(/classList\.contains\('rt-emo'\)/.test(hudJs) &&
       /function cyberEmojiSkipAncestor/.test(hudJs),
       'an already-wrapped .rt-emo is skipped',
       'without this the observer would see its own inserted span as new content and recurse');
    ok(/classList\.contains\('emoji-display'\)/.test(hudJs),
       'the progress glyph is excluded from the generic sweep',
       'it already carries its own bespoke filter chain (--rt-emo-progress); double-wrapping would nest one filter inside another');
    ok(/function cyberWrapEmojiTextNode/.test(hudJs) && /node\.ownerDocument/.test(hudJs),
       'the wrapper creates through node.ownerDocument, not the global document',
       'the PiP clone is a second document; nodes built in the wrong one do not reliably insert');
    ok(/function cyberSweepEmoji/.test(hudJs) &&
       /typeof doc\.createTreeWalker !== 'function'/.test(hudJs),
       'cyberSweepEmoji feature-detects TreeWalker rather than assuming it',
       'the Node test stub has no TreeWalker; applyCyberpunkTheme() must not throw when this suite calls it');
    ok(/typeof doc\.createElementNS !== 'function'/.test(hudJs),
       'ensureCyberEmojiFilter is feature-detected the same way',
       'the pre-existing filter-defs injector had no such guard until this section started calling applyCyberpunkTheme() against the stub');
    ok(/function cyberWatchEmoji/.test(hudJs) &&
       /cyberEmojiObservedRoots\.has\(root\)/.test(hudJs) &&
       /typeof MutationObserver !== 'function'/.test(hudJs),
       'cyberWatchEmoji dedups per root and feature-detects MutationObserver');
    ok(/let cyberEmojiTintActive = false;/.test(hudJs),
       'the tint-active flag defaults OFF',
       'an observer that wraps emoji before Cyberpunk is ever entered would leave stray spans in Glassmorphic');

    // The two places the flag actually flips, and the one call that must NOT
    // run on every colour-slider tick (a full sweep on every 'input' event
    // during a drag is the kind of thing that reads as "the picker feels
    // laggy" with nothing in the console to explain it).
    const applyThemeFn = (hudJs.match(/function applyCyberpunkTheme\(container\)[\s\S]*?\n    \}/) || [''])[0];
    ok(/cyberEmojiTintActive = true;/.test(applyThemeFn), 'applyCyberpunkTheme() turns tinting on');
    ok(/cyberWatchEmoji\(container\)/.test(applyThemeFn),
       'applyCyberpunkTheme() attaches the container observer');
    ok(!/cyberSweepEmoji\(container\)/.test(applyThemeFn),
       'applyCyberpunkTheme() does NOT sweep on every call',
       'it runs on every colour-slider tick; the full walk belongs at theme-entry only (see applyPreferences() below)');
    const clearThemeFn = (hudJs.match(/function clearCyberpunkTheme\(container\)[\s\S]*?\n    \}/) || [''])[0];
    ok(/cyberEmojiTintActive = false;/.test(clearThemeFn), 'clearCyberpunkTheme() turns tinting off');

    // Host wiring: the handful of places that inject an emoji from data
    // rather than from a literal in a template string, each with the sweep
    // called explicitly because their content only changes when THEY decide
    // to change it, not as a side effect of anything the container observer
    // would see.
    ok(/if \(enteringRetro\) cyberSweepEmoji\(container\);/.test(host),
       'entering Cyberpunk runs one full correcting sweep of the widget',
       'content rendered while Glassmorphic was active (an achievement earned before the user ever tried Cyberpunk) has fired no mutation since, so the observer alone would leave it unwrapped forever');
    const achFn = (host.match(/function openAchievementsModal\(\)[\s\S]*?\n    \}/) || [''])[0];
    ok(/cyberSweepEmoji\(modal\)/.test(achFn),
       'openAchievementsModal() sweeps after building its cards',
       'each card icon is ACHIEVEMENTS[key].icon, interpolated at render time');
    const popFn = (host.match(/function showLbAchPopover\(badge\)[\s\S]*?\n    \}/) || [''])[0];
    ok(/cyberSweepEmoji\(pop\)/.test(popFn),
       'showLbAchPopover() sweeps after setting its content',
       'content is rebuilt fresh on every hover, from the same a.icon pattern');
    const notifFn = (host.match(/function showXPNotification\([\s\S]*?\n    \}/) || [''])[0];
    ok(/cyberSweepEmoji\(notification\)/.test(notifFn),
       'showXPNotification() sweeps its toast before it is shown');
    const toggleSettingsFn = (host.match(/function toggleSettingsModal\(\)[\s\S]*?\n    \}/) || [''])[0];
    ok(/cyberSweepEmoji\(modal\)/.test(toggleSettingsFn),
       'toggleSettingsModal() re-sweeps on every open, not just at first creation',
       'the modal is built once and reused — content can predate the theme it is now viewed under');

    // The settings modal's Palette row has to render from CYBER_PALETTES
    // itself, not a hand-typed second copy — the exact drift the harness's
    // PALETTES object was rewritten to avoid.
    ok(/Object\.keys\(CYBER_PALETTES\)\.map/.test(host),
       'the settings modal renders its palette buttons from CYBER_PALETTES',
       'a hand-typed duplicate list is how the harness and the shipped UI would silently disagree');
    const harnessHtml = fs.readFileSync(path.join(__dirname, 'cyber-harness.html'), 'utf8');
    ok(/Object\.keys\(CYBER_PALETTES\)\.forEach/.test(harnessHtml),
       'the harness quick-select row is ALSO built from CYBER_PALETTES, not its own copy');

    // -- prefs exist on the host, and defaults preserve the look --
    group('I. preferences');
    const prefsLiteral = (host.match(/let userPreferences = \{[\s\S]*?\n    \};/) || [''])[0];
    ok(prefsLiteral.length > 0, 'the userPreferences literal was found');
    m.CYBER_TOKENS.forEach(function (t) {
        ok(new RegExp('\\b' + t.pref + ':').test(prefsLiteral),
           t.pref + ' has a default in userPreferences');
    });
    ['cyberGlowIntensity', 'cyberPanelShape'].forEach(function (p) {
        ok(new RegExp('\\b' + p + ':').test(prefsLiteral), p + ' has a default in userPreferences');
    });
    // An upgrade that silently restyles the widget reads as a bug.
    ok(/cyberText:\s*'#fff200'/.test(prefsLiteral), 'cyberText defaults to the existing yellow');
    ok(/cyberGlow:\s*'#fff200'/.test(prefsLiteral), 'cyberGlow defaults to the existing yellow');
    ok(/cyberBorder:\s*'#fff200'/.test(prefsLiteral), 'cyberBorder defaults to the existing yellow');
    ok(/cyberPanelShape:\s*'notched'/.test(prefsLiteral),
       'cyberPanelShape defaults to notched (the asymmetric shape)');

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

    // ── the widened guard ──────────────────────────────────────────
    // Section C2 proves the CSS only colours type with swatches the guard
    // knows about. These prove the guard actually FIRES on each of them, and
    // names the right one — a chip that says "Text" while Highlight is the
    // broken swatch sends the user to the wrong picker.
    const GUARDED = m.CYBER_TEXT_SWATCHES.map(s => s.pref);
    eq(GUARDED.length, 3, 'three swatches are allowed to colour type');
    ['cyberText', 'cyberAccent', 'cyberHighlight'].forEach(function (p) {
        ok(GUARDED.indexOf(p) !== -1, p + ' is in the guard');
    });

    // Shipped palette: nothing should be flagged.
    ok(m.cyberWorstContrast().ratio > 4.5,
       'the shipped palette passes on every text-carrying swatch');

    // Each swatch darkened ALONE must be found, and named.
    [
        ['cyberHighlight', 'Highlight'],
        ['cyberAccent',    'Accent'],
        ['cyberText',      'Text']
    ].forEach(function (pair) {
        const pref = pair[0], label = pair[1];
        const before = global.userPreferences[pref];
        global.userPreferences[pref] = '#101024';
        const worst = m.cyberWorstContrast();
        ok(worst.ratio < 3,
           'a near-black ' + label + ' is detected as failing');
        eq(worst.label, label,
           'the chip names ' + label + ' as the offender, not something else');
        // Warn, never correct — for every swatch, not just Text.
        eq(global.userPreferences[pref], '#101024',
           'evaluating contrast never rewrites ' + pref);
        global.userPreferences[pref] = before;
    });

    ok(m.cyberWorstContrast().ratio > 4.5,
       'the palette is back to passing once each swatch is restored');

    // ── glow scale ─────────────────────────────────────────────────
    group('J2. glow scale');
    // A plain 0-100% slider onto a 0-1 scale. Nothing to convert, which is
    // the point: the previous design normalised against the default so the
    // slider read "percent of shipped", and that bought nothing except a way
    // for the settings panel and the harness to end up in different units.
    eq(m.CYBER_GLOW_MAX_PCT, 100, 'the slider is a plain 0-100%');
    eq(m.cyberGlowScale(0), 0, '0% is genuinely off');
    eq(m.cyberGlowScale(1), 1, '100% is the full scale');
    eq(m.cyberGlowScale(m.CYBER_GLOW_DEFAULT), m.CYBER_GLOW_DEFAULT,
       'the scale IS the preference, not a normalisation of it');
    eq(m.cyberGlowScale(4), 1, 'a preference above 1 is clamped, not amplified');

    eq(m.cyberGlowToPct(m.CYBER_GLOW_DEFAULT), 60, 'the default reads 60%');
    eq(m.cyberGlowToPct(undefined), 60,
       'an unset preference reads as the default, not 0%');
    eq(m.cyberGlowToPct(1), 100, 'full intensity reads 100%');
    eq(m.cyberGlowToPct(0), 0, 'off reads 0%');

    // Round-trip: opening the settings panel reads the value and writes it
    // back, so drift here compounds every time the user looks at it.
    [0, 10, 25, 50, 60, 75, 100].forEach(function (pct) {
        eq(m.cyberGlowToPct(m.cyberGlowFromPct(pct)), pct,
           pct + '% round-trips unchanged');
    });

    // Garbage must not become a NaN. A NaN in --rt-glow-k invalidates every
    // glow declaration in the theme at once, which reads as "the glow broke"
    // rather than "a preference is malformed".
    eq(m.cyberGlowScale('nonsense'), m.CYBER_GLOW_DEFAULT,
       'a non-numeric preference falls back to the default');
    eq(m.cyberGlowScale(-5), m.CYBER_GLOW_DEFAULT,
       'a negative preference falls back to the default');
    eq(m.cyberGlowFromPct('x'), m.CYBER_GLOW_DEFAULT,
       'a non-numeric slider value falls back to the default');
    eq(m.cyberGlowFromPct(9999), 1, 'the slider value is clamped to full');
    eq(m.cyberGlowFromPct(-40), 0, 'the slider value is clamped at zero');

    // The property the stylesheet reads has to be written, and cleared again:
    // a leftover --rt-glow-k would follow the user into Glassmorphic.
    global.userPreferences.cyberGlowIntensity = 1;
    const glowEl = { style: { store: {}, setProperty(k, v) { this.store[k] = v; },
                              removeProperty(k) { delete this.store[k]; } } };
    m.applyCyberTokens(glowEl);
    eq(glowEl.style.store['--rt-glow-mul'], '1', 'the raw preference is written');
    eq(glowEl.style.store['--rt-glow-k'], '1', 'the guarded scale is written too');
    m.clearCyberTokens(glowEl);
    eq(glowEl.style.store['--rt-glow-k'], undefined,
       '--rt-glow-k is cleared on teardown');
    global.userPreferences.cyberGlowIntensity = 0.6;

    group('J. contrast guard');

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
