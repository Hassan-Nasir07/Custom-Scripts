// Runs every Ludo verification suite. `node ludo-dev/verify-all.js`
const { execFileSync } = require('child_process');
const path = require('path');

const SUITES = [
    ['Board geometry', 'ludo-verify.js'],
    ['Rules engine',   'rules-verify.js'],
    ['CPU',            'ai-verify.js'],
    ['Modes',          'modes-verify.js'],
    ['Render smoke',   'render-smoke.js'],
];

const results = [];
for (const [label, file] of SUITES) {
    let out = '', code = 0;
    try {
        out = execFileSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8' });
    } catch (e) {
        out  = (e.stdout || '') + (e.stderr || '');
        code = e.status == null ? 1 : e.status;
    }
    process.stdout.write(out);
    const m = out.match(/(\d+) passed, (\d+) failed/);
    results.push({
        label, file, code,
        passed: m ? +m[1] : (code === 0 ? 1 : 0),
        failed: m ? +m[2] : (code === 0 ? 0 : 1),
    });
}

console.log('\n' + '█'.repeat(52));
console.log('  SUMMARY');
console.log('█'.repeat(52));
let tp = 0, tf = 0, bad = 0;
results.forEach(r => {
    tp += r.passed; tf += r.failed;
    if (r.code !== 0) bad++;
    console.log(`  ${r.code === 0 ? '✓' : '✗'} ${r.label.padEnd(16)} ${String(r.passed).padStart(3)} passed` +
                (r.failed ? `, ${r.failed} failed` : ''));
});
console.log('─'.repeat(52));
console.log(`  ${tp} assertions passed, ${tf} failed, ${bad} suite(s) failing\n`);
process.exit(bad ? 1 : 0);
