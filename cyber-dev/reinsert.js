// Re-inserts the cyber-dev sources into AttendanceTimeCheckerPlus.js.
//
// The userscript carries a verbatim copy of the Cyberpunk HUD theme; cyber-verify.js
// asserts the two are byte-identical. Editing the copy by hand is how they drift, so
// this does the swap mechanically.
//
//   node cyber-dev/reinsert.js
//
// Matches on sentinel comments, like snake-dev/reinsert.js rather than ludo-dev's
// git-reconstruction: same guarantee, but it still works when the copy in the file came
// from an uncommitted edit, and it cannot silently match the wrong region.
//
// Refuses to guess: if a sentinel pair is missing, duplicated or out of order it exits
// non-zero and changes nothing, because a partial match here would corrupt 19k lines.
//
// One assertion this has that snake-dev's does not: the CSS block lands INSIDE a template
// literal, so a backtick or a dollar-brace in cyber-theme.css would break out of it and
// take the rest of modernStyles with it. That is checked before anything is written.
const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'AttendanceTimeCheckerPlus.js');

// Sentinel indentation is not decoration — the CSS pair sits at the 12-space indent of
// the modernStyles template literal and must be a CSS comment; the JS pairs sit at the
// IIFE's 4-space indent and must be line comments.
const BLOCKS = [
    {
        name:  'theme CSS',
        files: ['cyber-theme.css'],
        open:  '            /* ═══ CYBERPUNK HUD THEME — generated from cyber-dev/cyber-theme.css, do not edit here ═══ */',
        close: '            /* ═══ END CYBERPUNK HUD THEME ═══ */',
        inTemplateLiteral: true
    },
    {
        name:  'HUD module',
        files: ['cyber-hud.js'],
        open:  '    // ═══ CYBERPUNK HUD — generated from cyber-dev/cyber-hud.js, do not edit here ═══',
        close: '    // ═══ END CYBERPUNK HUD ═══'
    }
];

const trim = s => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
const crlf = s => s.replace(/\r?\n/g, '\r\n');

let src     = fs.readFileSync(TARGET, 'utf8');
let changed = 0;
let skipped = 0;

for (const spec of BLOCKS) {
    const paths  = spec.files.map(f => path.join(__dirname, f));
    const missing = paths.filter(p => !fs.existsSync(p));

    // A source that does not exist yet is a step not reached, not an error. A sentinel
    // pair with no source, or a source with no sentinel pair, is an error.
    if (missing.length === spec.files.length) {
        if (src.indexOf(spec.open) !== -1) {
            console.error('✗ ' + spec.name + ': sentinels are in the userscript but ' +
                          spec.files.join(' + ') + ' does not exist in cyber-dev/.');
            process.exit(1);
        }
        console.log('· ' + spec.name + ': no source yet, skipped');
        skipped++;
        continue;
    }
    if (missing.length) {
        console.error('✗ ' + spec.name + ': missing ' + missing.map(p => path.basename(p)).join(', '));
        process.exit(1);
    }

    const block = crlf(paths.map(p => trim(fs.readFileSync(p, 'utf8'))).join('\n\n'));

    if (spec.inTemplateLiteral) {
        // These would terminate the template literal or start an interpolation.
        if (block.indexOf('`') !== -1) {
            console.error('✗ ' + spec.name + ': contains a backtick, which would close the ' +
                          'modernStyles template literal.');
            process.exit(1);
        }
        if (block.indexOf('${') !== -1) {
            console.error('✗ ' + spec.name + ': contains "${", which would start a template ' +
                          'interpolation inside modernStyles.');
            process.exit(1);
        }
        // A stray brace does not throw — it silently discards every rule after it, which
        // is far harder to notice than a syntax error.
        const opens  = (block.match(/\{/g) || []).length;
        const closes = (block.match(/\}/g) || []).length;
        if (opens !== closes) {
            console.error('✗ ' + spec.name + ': unbalanced braces (' + opens + ' open, ' +
                          closes + ' close). A stray brace silently kills the rest of modernStyles.');
            process.exit(1);
        }
    }

    const openAt  = src.indexOf(spec.open);
    const closeAt = src.indexOf(spec.close);

    if (openAt === -1 || closeAt === -1) {
        console.error('✗ ' + spec.name + ': sentinels not found in AttendanceTimeCheckerPlus.js.');
        console.error('  Expected:');
        console.error('    ' + spec.open.trim());
        console.error('    ' + spec.close.trim());
        process.exit(1);
    }
    if (src.indexOf(spec.open, openAt + 1) !== -1 || src.indexOf(spec.close, closeAt + 1) !== -1) {
        console.error('✗ ' + spec.name + ': the sentinels appear more than once — refusing to guess.');
        process.exit(1);
    }
    if (closeAt < openAt) {
        console.error('✗ ' + spec.name + ': the closing sentinel precedes the opening one.');
        process.exit(1);
    }

    // Everything strictly between the two sentinel lines.
    const bodyStart = src.indexOf('\n', openAt) + 1;
    const oldBlock  = src.slice(bodyStart, closeAt);

    if (trim(oldBlock) === trim(block)) {
        console.log('· ' + spec.name + ': already up to date');
        continue;
    }

    src = src.slice(0, bodyStart) + block + '\r\n' + src.slice(closeAt);

    const delta = trim(block).split('\n').length - trim(oldBlock).split('\n').length;
    console.log('✓ ' + spec.name + ': replaced (' + (delta >= 0 ? '+' : '') + delta + ' lines)');
    changed++;
}

if (changed) {
    fs.writeFileSync(TARGET, src, 'utf8');
    console.log('\n  ' + changed + ' block(s) written. Now run: node cyber-dev/cyber-verify.js');
} else {
    console.log('\n  nothing to write' + (skipped ? ' (' + skipped + ' source(s) not created yet)' : ''));
}
