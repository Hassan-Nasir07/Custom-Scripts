// Re-inserts the snake-dev engine into AttendanceTimeCheckerPlus.js.
//
// The userscript carries a verbatim copy of snake-core.js + snake-ui.js, and
// snake-verify.js asserts the two are byte-identical. Editing the copy by hand
// is how they drift, so this does the swap mechanically.
//
//   node snake-dev/reinsert.js
//
// Unlike ludo-dev/reinsert.js this matches on sentinel comments rather than
// reconstructing the previous block from a git revision. Same guarantee, but it
// still works when the copy in the file came from an uncommitted edit, and it
// cannot silently match the wrong region.
//
// Refuses to guess: if the sentinels are missing or appear more than once it
// exits non-zero and changes nothing, because a partial match here would
// corrupt 17k lines.
const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'AttendanceTimeCheckerPlus.js');
const FILES  = ['snake-core.js', 'snake-ui.js'];

const OPEN  = '    // ═══ SNAKE ENGINE — generated from snake-dev/, do not edit here ═══';
const CLOSE = '    // ═══ END SNAKE ENGINE ═══';

const trim = s => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
const crlf = s => s.replace(/\r?\n/g, '\r\n');

const block = crlf(FILES
    .map(f => trim(fs.readFileSync(path.join(__dirname, f), 'utf8')))
    .join('\n\n'));

const src = fs.readFileSync(TARGET, 'utf8');

const openAt  = src.indexOf(OPEN);
const closeAt = src.indexOf(CLOSE);

if (openAt === -1 || closeAt === -1) {
    console.error('✗ sentinels not found in AttendanceTimeCheckerPlus.js.');
    console.error('  Expected:');
    console.error('    ' + OPEN.trim());
    console.error('    ' + CLOSE.trim());
    process.exit(1);
}
if (src.indexOf(OPEN, openAt + 1) !== -1 || src.indexOf(CLOSE, closeAt + 1) !== -1) {
    console.error('✗ the sentinels appear more than once — refusing to guess.');
    process.exit(1);
}
if (closeAt < openAt) {
    console.error('✗ the closing sentinel precedes the opening one.');
    process.exit(1);
}

// Everything strictly between the two sentinel lines.
const bodyStart = src.indexOf('\n', openAt) + 1;
const oldBlock  = src.slice(bodyStart, closeAt);

if (trim(oldBlock) === trim(block)) {
    console.log('· engine block already up to date, nothing to do');
    process.exit(0);
}

fs.writeFileSync(TARGET, src.slice(0, bodyStart) + block + '\r\n' + src.slice(closeAt), 'utf8');

const delta = trim(block).split('\n').length - trim(oldBlock).split('\n').length;
console.log('✓ engine block replaced (' + (delta >= 0 ? '+' : '') + delta + ' lines)');
console.log('  now run: node snake-dev/snake-verify.js');
