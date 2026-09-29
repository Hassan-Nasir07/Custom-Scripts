// Re-inserts the pool-dev sources into AttendanceTimeCheckerPlus.js.
//
// The userscript carries verbatim copies of two blocks, and pool-verify.js
// asserts both are byte-identical to pool-dev/:
//   engine  the v2 modules, in load.js's FILES order, at the IIFE's 4-space indent
//   theme   pool-theme.css, inside the modernStyles template literal, right after
//           the Cyberpunk theme so it reads the same cascade as pool-table.html
// Editing a copy by hand is how they drift, so this does the swap mechanically.
//
//   node pool-dev/reinsert.js           # splice
//   node pool-dev/reinsert.js --check   # exit 1 if either copy differs
//
// Same contract as snake-dev/ and cyber-dev/: matches on sentinel comments and
// refuses to guess. Missing, duplicated or out-of-order sentinels exit non-zero
// and change nothing, because a partial match here would corrupt 20k lines. The
// CSS lands inside a template literal, so a backtick, "${" or an unbalanced
// brace in pool-theme.css is refused before anything is written.
const fs   = require('fs');
const path = require('path');
const { FILES } = require('./load');

const ROOT   = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'AttendanceTimeCheckerPlus.js');

const BLOCKS = [
    {
        name: 'engine',
        files: FILES,
        open:  '    // ═══ POOL ENGINE — generated from pool-dev/, do not edit here ═══',
        close: '    // ═══ END POOL ENGINE ═══',
    },
    {
        name: 'theme CSS',
        files: ['pool-theme.css'],
        open:  '            /* ═══ POOL THEME — generated from pool-dev/pool-theme.css, do not edit here ═══ */',
        close: '            /* ═══ END POOL THEME ═══ */',
        inTemplateLiteral: true,
    },
];
// Back-compat names for the engine block.
const OPEN = BLOCKS[0].open, CLOSE = BLOCKS[0].close;

const trim = s => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
// A block is written in whatever line ending the userscript already uses, so a
// splice never leaves the file with mixed endings.
const eolOf = s => (s.indexOf('\r\n') !== -1 ? '\r\n' : '\n');

function devBlock(spec, eol) {
    if (typeof spec === 'string' || spec === undefined) { eol = spec; spec = BLOCKS[0]; }
    return spec.files
        .map(f => trim(fs.readFileSync(path.join(__dirname, f), 'utf8')))
        .join('\n\n')
        .replace(/\n/g, eol || '\n');
}

// Throws with a reason, or returns where the body sits.
function locate(src, spec) {
    spec = spec || BLOCKS[0];
    const openAt = src.indexOf(spec.open), closeAt = src.indexOf(spec.close);
    if (openAt === -1 || closeAt === -1) throw new Error(spec.name + ': sentinels not found in AttendanceTimeCheckerPlus.js');
    if (src.indexOf(spec.open, openAt + 1) !== -1 || src.indexOf(spec.close, closeAt + 1) !== -1) {
        throw new Error(spec.name + ': the sentinels appear more than once, refusing to guess');
    }
    if (closeAt < openAt) throw new Error(spec.name + ': the closing sentinel precedes the opening one');
    return { bodyStart: src.indexOf('\n', openAt) + 1, closeAt };
}

// The block currently in the userscript, strictly between the sentinel lines.
function hostBlock(src, spec) {
    const { bodyStart, closeAt } = locate(src, spec);
    return src.slice(bodyStart, closeAt);
}

// Why a CSS block cannot go inside the template literal, or null.
function templateProblem(block) {
    if (block.indexOf('`') !== -1) return 'contains a backtick, which would close the modernStyles template literal';
    if (block.indexOf('${') !== -1) return 'contains "${", which would start a template interpolation';
    const opens = (block.match(/\{/g) || []).length, closes = (block.match(/\}/g) || []).length;
    if (opens !== closes) return 'unbalanced braces (' + opens + ' open, ' + closes + ' close); a stray brace silently kills every rule after it';
    return null;
}

if (require.main === module) {
    let src = fs.readFileSync(TARGET, 'utf8');
    const eol = eolOf(src), check = process.argv.includes('--check');
    let changed = 0, stale = 0;
    for (const spec of BLOCKS) {
        let where;
        try { where = locate(src, spec); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
        const block = devBlock(spec, eol);
        if (spec.inTemplateLiteral) {
            const why = templateProblem(block);
            if (why) { console.error('✗ ' + spec.name + ': ' + why); process.exit(1); }
        }
        const oldBlock = src.slice(where.bodyStart, where.closeAt);
        if (trim(oldBlock) === trim(block)) { console.log('· ' + spec.name + ': already up to date'); continue; }
        if (check) { console.error('✗ ' + spec.name + ': the userscript copy differs from pool-dev/'); stale++; continue; }
        src = src.slice(0, where.bodyStart) + block + eol + src.slice(where.closeAt);
        const delta = trim(block).split('\n').length - trim(oldBlock).split('\n').length;
        console.log('✓ ' + spec.name + ': replaced (' + (delta >= 0 ? '+' : '') + delta + ' lines)');
        changed++;
    }
    if (check) process.exit(stale ? 1 : 0);
    if (changed) {
        fs.writeFileSync(TARGET, src, 'utf8');
        console.log('\n  ' + changed + ' block(s) written. Now run: node pool-dev/pool-verify.js');
    } else console.log('\n  nothing to write');
} else {
    module.exports = { BLOCKS, OPEN, CLOSE, FILES, TARGET, devBlock, hostBlock, locate, templateProblem, trim, eolOf };
}
