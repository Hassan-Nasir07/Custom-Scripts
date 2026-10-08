// Game Mode access keys, offline: key n is the first 80 bits of HMAC-SHA256(UNLOCK_SECRET,
// 'atc-games:' + n) in Crockford base32, as the sync bot (github-actions-bot sync.yml) checks
// them. Only the gist's current n is valid; atcAdminGamesKey in the console reads n for you.
//
//   UNLOCK_SECRET=<secret> "/c/Program Files/nodejs/node.exe" tools/games-key.js <n> [count]
//
// The secret is read from the environment, so it never lands in your shell history as an argument.
const crypto = require('crypto');

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function keyFor(secret, n) {
    const mac = crypto.createHmac('sha256', secret).update('atc-games:' + n).digest();
    let val = 0, bits = 0, out = '';
    for (const byte of mac) {
        val = ((val << 8) | byte) & 0xffff; bits += 8;
        while (bits >= 5 && out.length < 16) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; }
        if (out.length >= 16) break;
    }
    return out;
}
module.exports = { keyFor };

if (require.main === module) {
    const secret = process.env.UNLOCK_SECRET || '';
    const n = parseInt(process.argv[2], 10), count = Math.max(1, Math.min(50, parseInt(process.argv[3], 10) || 1));
    if (secret.length < 16 || !Number.isInteger(n) || n < 0) {
        console.error('usage: UNLOCK_SECRET=<secret> node tools/games-key.js <n> [count]');
        process.exit(1);
    }
    for (let i = n; i < n + count; i++) console.log('#' + i + '  ' + keyFor(secret, i).match(/.{4}/g).join('-'));
}
