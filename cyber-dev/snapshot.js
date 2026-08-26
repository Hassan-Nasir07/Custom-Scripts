// Builds a SELF-CONTAINED copy of cyber-harness.html with cyber-theme.css and
// cyber-hud.js inlined.
//
//   node cyber-dev/snapshot.js            -> cyber-dev/_snapshot.html
//   node cyber-dev/snapshot.js out.html   -> a path of your choosing
//
// WHY THIS EXISTS
//
// `ludo-dev/preview.js` is a canvas rasterizer and cannot render DOM or CSS, so
// this theme has no PNG preview and the harness in a real browser is the only
// honest renderer. That has always meant "a human has to look at it".
//
// It turns out there is a middle step. A browser can be driven far enough to
// read back COMPUTED STYLES even when no screenshot is available — which
// answers a whole class of question that no static check can, and that reading
// the CSS cannot answer either:
//
//   * does the whole stylesheet actually parse, or did one bad declaration
//     discard everything after it?
//   * does `caption.rt-sec` still compute to `display: table-caption`, and does
//     the footer cell still report `colSpan: 5`? (Flex either one and the
//     browser silently re-wraps it in an anonymous cell — the caption narrows
//     to one column and the colspan is dropped. Nothing throws.)
//   * do the caption, the footer and the table all measure the SAME width?
//   * do `--rt-clip` and `--rt-clip-alt` resolve to genuinely different
//     polygons under each of the four shapes?
//   * does the container still compute `filter: none`? (A filter there becomes
//     the containing block for the widget's two `position: fixed` descendants.)
//
// Every one of those was checked this way, and the table-display trap was
// caught by it.
//
// TWO CONSTRAINTS, both learned the hard way:
//
//  1. The file must be SELF-CONTAINED. The preview surface loads a local file
//     by inlining it, so a relative `<link href="cyber-theme.css">` resolves
//     against the wrong base and silently loads nothing. The harness then
//     renders completely unstyled and every computed value you read back is the
//     host base sheet, not the theme. That looks like a passing check.
//
//  2. The file must live INSIDE the project folder. A file outside it renders
//     as a non-scriptable static snapshot, and script evaluation fails with
//     "No site is open in this tab".
//
// Script evaluation also runs in an ISOLATED world, so page globals
// (`userPreferences`, `applyCyberpunkTheme`) are NOT reachable. Anything that
// needs to call into the modules belongs in `cyber-verify.js` against
// `load.js`, not here. Shape switching is testable because the shape classes
// are pure CSS — toggle `rt-shape-*` on the container with `classList`.
//
// This is a supplement, not a replacement: it proves the CSS resolves to the
// values intended. It says nothing about whether the result looks good, and
// that judgement still needs a person in front of `cyber-harness.html`.
//
// Delete the generated file when done — it is a build artifact, not a source.

const fs   = require('fs');
const path = require('path');

const HERE = __dirname;
const out  = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(HERE, '_snapshot.html');

const read = f => fs.readFileSync(path.join(HERE, f), 'utf8');

// [ tag to replace, file to inline, wrapper ]
const INLINE = [
    ['<link rel="stylesheet" href="cyber-theme.css">', 'cyber-theme.css', 'style'],
    ['<script src="cyber-hud.js"></script>',           'cyber-hud.js',    'script']
];

let html = read('cyber-harness.html');

for (const [tag, file, wrapper] of INLINE) {
    if (html.indexOf(tag) === -1) {
        console.error('✗ cyber-harness.html no longer contains:\n    ' + tag +
                      '\n  The harness was edited without updating this script. ' +
                      'A snapshot that silently fails to inline the theme renders ' +
                      'unstyled and every check against it passes for the wrong reason.');
        process.exit(1);
    }
    const body = read(file);
    // A literal </script> or </style> inside the inlined body would close the
    // wrapper early. Neither file has one today; refuse rather than corrupt.
    if (new RegExp('</\\s*' + wrapper, 'i').test(body)) {
        console.error('✗ ' + file + ' contains a literal closing </' + wrapper +
                      '> and cannot be inlined verbatim.');
        process.exit(1);
    }
    html = html.replace(tag, '<' + wrapper + '>\n' + body + '\n</' + wrapper + '>');
}

fs.writeFileSync(out, html);

const inside = out.toLowerCase().startsWith(path.join(HERE, '..').toLowerCase());
console.log('✓ wrote ' + out + '  (' + Math.round(html.length / 1024) + ' KB)');
if (!inside) {
    console.log('! outside the project folder — it will render as a ' +
                'non-scriptable snapshot. Write it under the repo instead.');
}
