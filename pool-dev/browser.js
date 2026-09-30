// The headless browser the in-browser tools drive (snapshot.js, theme-verify.js,
// perf-check.js, host-run.js). Any Chromium speaks the DevTools protocol they use, so
// Chrome is preferred and Edge (always on Windows) is the fallback. POOL_BROWSER
// overrides both.
const fs = require('fs');
const path = require('path');

const CANDIDATES = [
    process.env.POOL_BROWSER,
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function browserPath() {
    const exe = CANDIDATES.find(p => fs.existsSync(p));
    if (!exe) throw new Error('No Chrome or Edge found; set POOL_BROWSER to a Chromium executable. Looked in:\n  ' + CANDIDATES.join('\n  '));
    return exe;
}

module.exports = { browserPath };
