// Re-inserts the pool-dev engine into AttendanceTimeCheckerPlus.js.
//
// The userscript carries a verbatim copy of pool-core.js + pool-ui.js, and
// pool-verify.js asserts the two are byte-identical. Editing the copy by hand
// is how they drift, so this does the swap mechanically.
//
//   node pool-dev/reinsert.js           # splice
//   node pool-dev/reinsert.js --check   # exit 1 if the userscript copy differs
//
// Same contract as snake-dev/reinsert.js: matches on sentinel comments, and
// refuses to guess. Missing, duplicated or out-of-order sentinels exit non-zero
// and change nothing, because a partial match here would corrupt 20k lines.
const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'AttendanceTimeCheckerPlus.js');
const FILES  = ['pool-core.js', 'pool-ui.js'];

const OPEN  = '    // ═══ POOL ENGINE — generated from pool-dev/, do not edit here ═══';
const CLOSE = '    // ═══ END POOL ENGINE ═══';

const trim = s => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
// The block is written in whatever line ending the userscript already uses, so a
// splice never leaves the file with mixed endings.
const eolOf = s => (s.indexOf('\r\n') !== -1 ? '\r\n' : '\n');

function devBlock(eol) {
    return FILES
        .map(f => trim(fs.readFileSync(path.join(__dirname, f), 'utf8')))
        .join('\n\n')
        .replace(/\n/g, eol || '\n');
}

// Returns { src, bodyStart, closeAt } or throws with a reason.
function locate(src) {
    const openAt  = src.indexOf(OPEN);
    const closeAt = src.indexOf(CLOSE);
    if (openAt === -1 || closeAt === -1) throw new Error('sentinels not found in AttendanceTimeCheckerPlus.js');
    if (src.indexOf(OPEN, openAt + 1) !== -1 || src.indexOf(CLOSE, closeAt + 1) !== -1) {
        throw new Error('the sentinels appear more than once, refusing to guess');
    }
    if (closeAt < openAt) throw new Error('the closing sentinel precedes the opening one');
    return { bodyStart: src.indexOf('\n', openAt) + 1, closeAt };
}

// The block currently in the userscript, strictly between the sentinel lines.
function hostBlock(src) {
    const { bodyStart, closeAt } = locate(src);
    return src.slice(bodyStart, closeAt);
}

if (require.main === module) {
    const src = fs.readFileSync(TARGET, 'utf8');
    let where;
    try { where = locate(src); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
    const eol = eolOf(src);
    const block = devBlock(eol);
    const oldBlock = src.slice(where.bodyStart, where.closeAt);

    if (trim(oldBlock) === trim(block)) {
        console.log('· pool engine block already up to date, nothing to do');
        process.exit(0);
    }
    if (process.argv.includes('--check')) {
        console.error('✗ the userscript copy differs from pool-dev/ (run node pool-dev/reinsert.js)');
        process.exit(1);
    }
    fs.writeFileSync(TARGET, src.slice(0, where.bodyStart) + block + eol + src.slice(where.closeAt), 'utf8');
    const delta = trim(block).split('\n').length - trim(oldBlock).split('\n').length;
    console.log('✓ pool engine block replaced (' + (delta >= 0 ? '+' : '') + delta + ' lines)');
    console.log('  now run: node pool-dev/pool-verify.js');
} else {
    module.exports = { OPEN, CLOSE, FILES, TARGET, devBlock, hostBlock, trim, eolOf };
}
