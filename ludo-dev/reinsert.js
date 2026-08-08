// Re-inserts the ludo-dev engine into AttendanceTimeCheckerPlus.js.
//
// The userscript carries a verbatim copy of ludo-core.js + ludo-ui.js, and
// integration-verify.js asserts the two are byte-identical. Editing the copy by
// hand is how they drift, so this does the swap mechanically: it reconstructs
// the block currently in the file from git HEAD, requires an exact single
// match, and replaces it with the working-tree sources.
//
//   node ludo-dev/reinsert.js            # replace HEAD's block with the current one
//   node ludo-dev/reinsert.js <rev>      # if the file's copy came from another rev
//
// Refuses to guess. If the block is missing or ambiguous it exits non-zero and
// changes nothing, because a partial match here would corrupt 16k lines.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT   = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'AttendanceTimeCheckerPlus.js');
const FILES  = ['ludo-core.js', 'ludo-ui.js'];
const REV    = process.argv[2] || 'HEAD';

const trim = s => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
const crlf = s => s.replace(/\n/g, '\r\n');

function atRev(rev, file) {
    return execFileSync('git', ['show', `${rev}:ludo-dev/${file}`],
                        { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const oldBlock = crlf(FILES.map(f => trim(atRev(REV, f))).join('\n\n'));
const newBlock = crlf(FILES.map(f => trim(fs.readFileSync(path.join(__dirname, f), 'utf8'))).join('\n\n'));

const src = fs.readFileSync(TARGET, 'utf8');
const at  = src.indexOf(oldBlock);

if (at === -1) {
    console.error(`✗ the ${REV} engine block is not in AttendanceTimeCheckerPlus.js.`);
    console.error('  Either the copy came from a different revision (pass it as an');
    console.error('  argument) or it was hand-edited and has already drifted.');
    process.exit(1);
}
if (src.indexOf(oldBlock, at + 1) !== -1) {
    console.error('✗ the engine block appears more than once — refusing to guess.');
    process.exit(1);
}
if (oldBlock === newBlock) {
    console.log('· engine block already up to date, nothing to do');
    process.exit(0);
}

fs.writeFileSync(TARGET, src.slice(0, at) + newBlock + src.slice(at + oldBlock.length), 'utf8');

const delta = newBlock.split('\r\n').length - oldBlock.split('\r\n').length;
console.log(`✓ engine block replaced (${delta >= 0 ? '+' : ''}${delta} lines)`);
console.log('  now run: node ludo-dev/verify-all.js');
