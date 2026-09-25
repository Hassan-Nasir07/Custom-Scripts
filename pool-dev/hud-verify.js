// Pool v2 HUD verification. `node pool-dev/hud-verify.js`
//
//   1. phModel against the design's in-match states: every string, tag,
//      visibility rule and tone that InMatch.dc.html and Max.dc.html show,
//      from a game snapshot that puts the table in that state.
//   2. The theme contract, statically:
//        - no design hex (the amber palette and its greys) in pool code
//        - no clip-path or filter on the viewport or anything around it
//        - every --pool-* the components read is defined, and the
//          Cyberpunk block redefines everything the light block sets
//        - no --rt-* anywhere but the Cyberpunk block
//   3. The canvas bridge's colour parsing.
// The DOM itself (phBuild/phRender) is exercised in real Chrome by
// snapshot.js --check.
const fs = require('fs');
const path = require('path');
const P = require('./load').hud();

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ✓ ' + name + (detail !== undefined ? '  (' + detail + ')' : '')); }
    else { fail++; console.log('  ✗ ' + name + (detail !== undefined ? ' — ' + detail : '')); }
};
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length)));

// ── 1. The design's states ────────────────────────────────────────────
head("The design's in-match states");
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
// The design's mid-frame layout: groups set, seat 1 on solids.
function table(downIds) {
    const w = P.ppCreateWorld();
    w.balls = [P.ppMakeBall(0, -160, -70)];
    for (let id = 1; id <= 15; id++) {
        const b = P.ppMakeBall(id, -400 + id * 50, 0);
        if ((downIds || [2, 5, 10, 13, 14]).includes(id)) b.state = 'pocketed';
        w.balls.push(b);
    }
    return w;
}
function game(o) {
    const frame = Object.assign(P.prNewFrame({ breaker: 1, callEvery: !!o.every }), { isBreak: false, ballInHand: null, groups: { 1: 'solids', 2: 'stripes' } }, o.frame);
    return Object.assign({
        layout: 'compact', mode: 'cpu',
        names: o.mode === 'pvp' ? { 1: 'Ayesha', 2: 'Bilal' } : { 1: 'Ayesha', 2: 'CPU' },
        records: { 1: '478W · 68L', 2: o.mode === 'pvp' ? '112W · 97L' : 'Adaptive · Normal' },
        frames: [0, 0], trophies: 478, frame, world: table(o.down),
        phase: 'aim', camera: '3d', lean: 35, power: 0, dragging: false, spin: 0, called: -1,
        clock: null, toast: null, fouled: 0, handoff: 0, bih: null, result: null,
    }, o, { frame });
}
const vm = o => P.phModel(game(o));
{
    const m = vm({});
    ok('main: seat 1 "TO SHOOT", seat 2 shows the CPU tier, frames "0–0"',
        m.cards[0].tag === 'TO SHOOT' && m.cards[0].active && !m.cards[1].active && m.cards[1].rec === 'Adaptive · Normal' && m.frames === '0–0');
    ok('main: pill "Solids", hint "Press and drag for power", spin "Center"', m.pill.text === 'Solids' && m.hint.text === 'Press and drag for power' && m.spin.label === 'Center');
    ok('main: lean shows in 3D, labelled with the camera pitch (12° at 35)', m.lean.show && m.lean.label === '12°', m.lean.label);
    ok('main: the gauge shows, dim, unlocked; footer reads "Vs CPU"', m.gauge.show && !m.gauge.live && !m.gauge.locked && m.foot.show && m.foot.modeLabel === 'Vs CPU');
    const trk = m.cards[0].group;
    ok('main: the tracker lists the seven solids, potted ones dimmed', trk.length === 7 && trk.filter(d => d.down).map(d => d.id).join() === '2,5', trk.filter(d => d.down).map(d => d.id).join());
    ok('main: seat 2 tracks the stripes', m.cards[1].group.map(d => d.id).join() === '9,10,11,12,13,14,15');
    ok('2D: no lean slider', !vm({ camera: '2d' }).lean.show);
    const lean0 = vm({ lean: 0 }).lean.label, lean100 = vm({ lean: 100 }).lean.label;
    ok('lean labels run 2°–31° across the slider', lean0 === '2°' && lean100 === '31°', lean0 + ' … ' + lean100);

    const d = vm({ dragging: true, power: 62 });
    ok('dragging: "Release to shoot · 62%", the gauge lit', d.hint.text === 'Release to shoot · 62%' && d.hint.tone === 'power' && d.gauge.live && d.gauge.power === 62);
    const h = vm({ dragging: true, power: 90 });
    ok('power ≥ 85% goes hot', h.hint.tone === 'hot' && h.gauge.hot);

    const b = vm({ phase: 'bih', frame: { ballInHand: 'anywhere' }, bih: { valid: true } });
    ok('ball in hand: "BALL IN HAND", camera forced to "2D · AUTO"', b.cards[0].tag === 'BALL IN HAND' && !b.cam.is3d && b.cam.label2d === '2D · AUTO');
    ok('ball in hand: pill "Ball in hand", hint "Drag the cue ball to place it"', b.pill.text === 'Ball in hand' && b.hint.text === 'Drag the cue ball to place it');
    ok('ball in hand: no spin, gauge or lean', !b.spin.show && !b.gauge.show && !b.lean.show);
    const bb = vm({ phase: 'bih', frame: { ballInHand: 'anywhere' }, bih: { valid: false, reason: 'overlap', sx: 100, sy: 200, sr: 5 } });
    ok('invalid spot: hot "Release on open felt" and the "Overlaps a ball" chip under the ghost',
        bb.hint.text === 'Release on open felt' && bb.hint.tone === 'hot' && bb.bihNote.show && bb.bihNote.text === 'Overlaps a ball' && bb.bihNote.y === 231);
    const bk = vm({ phase: 'bih', frame: { ballInHand: 'kitchen', isBreak: true, groups: { 1: null, 2: null } }, down: [], bih: { valid: false, reason: 'kitchen', sx: 0, sy: 0 } });
    ok('break: "TO BREAK", "Break · kitchen only", both cards "Open table"',
        bk.cards[0].tag === 'TO BREAK' && bk.pill.text === 'Break · kitchen only' && bk.cards[0].open && bk.cards[1].open);
    ok('break, bad spot: "Behind the head string only"', bk.bihNote.text === 'Behind the head string only');
    const bp = vm({ phase: 'bih', frame: { ballInHand: 'anywhere' }, bih: { valid: true, placed: true } });
    ok('placed: "Placed · aim when ready"', bp.hint.text === 'Placed · aim when ready');

    const f = vm({ mode: 'pvp', camera: '2d', fouled: 1, handoff: 2, frame: { turn: 2, ballInHand: 'anywhere' }, phase: 'bih',
        toast: { kind: 'foul', title: "Foul · Hit opponent's ball first", sub: 'Ball in hand to Bilal' } });
    ok('foul: the toast replaces the camera toggle and the pill', f.toast.show && f.toast.foul && !f.cam.show && !f.pill.show);
    ok('foul: seat 1 "FOUL" (hot), seat 2 "BALL IN HAND"', f.cards[0].tag === 'FOUL' && f.cards[0].tagHot && f.cards[1].tag === 'BALL IN HAND');
    ok('foul: "Pass to Bilal" / "Ayesha, swap seats" / "BILAL\'S READY" replaces the footer',
        !f.foot.show && f.handoff.show && f.handoff.to === 'Pass to Bilal' && f.handoff.from === 'Ayesha, swap seats' && f.handoff.ready === "BILAL'S READY");
    ok('foul: no spin or hint under the toast', !f.spin.show && !f.hint.show);

    const c3 = vm({ down: SOLIDS.concat([10, 13]) });
    ok('on the 8: pill "On the 8 · call it", hint "Tap a pocket to call it"', c3.pill.text === 'On the 8 · call it' && c3.hint.text === 'Tap a pocket to call it' && c3.hint.tone === 'call');
    ok('on the 8, uncalled: the gauge locks, lean hides, 3D shows the mini-map', c3.gauge.locked && !c3.lean.show && c3.mini.show && c3.mini.called === -1);
    const c3c = vm({ down: SOLIDS, called: 2 });
    ok('called: "Top right called · drag to shoot", gauge unlocked', c3c.hint.text === 'Top right called · drag to shoot' && !c3c.gauge.locked && c3c.mini.called === 2);
    const c2 = vm({ camera: '2d', every: true, called: 1 });
    ok('pro, 2D: "Pro · call every shot", "Top side called · drag to shoot", no mini-map', c2.pill.text === 'Pro · call every shot' && c2.hint.text === 'Top side called · drag to shoot' && !c2.mini.show);
    ok('call every shot in 2 Players reads "Call every shot"', vm({ mode: 'pvp', every: true }).pill.text === 'Call every shot');

    const k = vm({ mode: 'pvp', clock: { left: 18, total: 30 } });
    ok('clock: the tag shows "18s", the bar 60%, not hot', k.cards[0].tag === '18s' && Math.abs(k.cards[0].clock - 60) < 1e-9 && !k.cards[0].hot);
    const kh = vm({ mode: 'pvp', clock: { left: 3.2, total: 30 } });
    ok('last 5 s: "4s", hot border and bar, the tag pulses', kh.cards[0].tag === '4s' && kh.cards[0].hot && kh.cards[0].tagPulse && kh.cards[0].tagHot);
    ok('the clock only runs on the shooter\'s card', kh.cards[1].clock === 0 && kh.cards[1].tag === '');

    const res = { win: false, title: 'CPU wins', reason: 'Ayesha scratched on the 8.', recordLabel: 'AYESHA · RECORD', record: '478W · 69L', delta: '+1 LOSS', note: 'Adaptive stays at Normal' };
    const lo = vm({ phase: 'over', frames: [0, 1], result: res, frame: { over: true, winner: 2 } });
    ok('frame over: the dialog, "FRAME OVER · 0–1", "NEW FRAME" / "Change difficulty"',
        lo.dialog.show && lo.dialog.kicker === 'FRAME OVER · 0–1' && lo.dialog.title === 'CPU wins' && lo.dialog.primary === 'NEW FRAME' && lo.dialog.secondary === 'Change difficulty');
    ok('frame over: no tags, no gauge, no spin, no hint', lo.cards.every(c => !c.tag && !c.active) && !lo.gauge.show && !lo.spin.show && !lo.hint.show);
    ok('2 Players: the secondary action is "Change mode"', vm({ mode: 'pvp', phase: 'over', result: res, frame: { over: true } }).dialog.secondary === 'Change mode');

    const mv = vm({ phase: 'moving' });
    ok('balls running: no hint, spin, gauge or lean', !mv.hint.show && !mv.spin.show && !mv.gauge.show && !mv.lean.show);

    const mx = vm({ layout: 'max', names: { 1: 'You', 2: 'CPU' } });
    ok('Max: "2D TOP-DOWN" / "3D AIM", pill "Your shot · Solids"', mx.cam.label2d === '2D TOP-DOWN' && mx.cam.label3d === '3D AIM' && mx.pill.text === 'Your shot · Solids', mx.pill.text);
    ok('Max: someone else\'s shot reads "Bilal\'s shot · Stripes"', vm({ layout: 'max', mode: 'pvp', frame: { turn: 2 } }).pill.text === "Bilal's shot · Stripes");
    ok('Max: initials for the avatar, the CPU gets its chip', mx.cards[0].initials === 'YO' && mx.cards[1].cpu);
    ok('spin presets cycle through all five', [0, 1, 2, 3, 4, 5].map(i => vm({ spin: i }).spin.label).join() === 'Center,Follow,Draw,Left,Right,Center');
    ok('spin presets sit inside the miscue circle', P.PH_SPINS.every(s => Math.hypot(s.x, s.y) <= P.ppCreateWorld().cfg.maxTip));
}

// ── 2. The theme contract ─────────────────────────────────────────────
head('Theme contract');
{
    const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
    const css = read('pool-theme.css'), hudJs = read('pool-hud.js'), render = read('pool-render.js');
    // The design's amber palette and its UI greys. Ball colours, table
    // materials and the ivory guides are physical, so they are allowed.
    const DESIGN_HEX = ['#F0B44C', '#EC6A3D', '#0E1113', '#161C1F', '#1C2327', '#9CA5A8', '#ECE8DF', '#C9CFCF', '#F6A585',
        '#1B1406', '#F4E3BF', '#8E979A', '#242C31', '#283034', '#F4F0E6', '#1A2024', '#F6C978', '#5A6468', '#B9CCDA', '#2A3438'];
    const hits = [];
    [['pool-theme.css', css], ['pool-hud.js', hudJs], ['pool-render.js', render]].forEach(([f, src]) =>
        DESIGN_HEX.forEach(h => { if (src.toUpperCase().includes(h)) hits.push(f + ' ' + h); }));
    ok('no design hex anywhere in pool code', hits.length === 0, hits.join(', ') || DESIGN_HEX.length + ' colours checked');
    ok('no Chakra Petch or Sora', !/Chakra|Sora/.test(css + hudJs + render));

    // Rules: selector → body, comments stripped.
    const rules = [];
    css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, body) => { rules.push({ sel: sel.trim(), body }); return ''; });
    const clipped = rules.filter(r => /clip-path|(^|[^-])filter\s*:/.test(r.body) && !/backdrop-filter/.test(r.body.replace(/clip-path[^;]*;?/g, '')) || /clip-path/.test(r.body));
    const bad = clipped.filter(r => /clip-path/.test(r.body) && !/\.ph-btn|\.ph-primary/.test(r.sel));
    const filt = rules.filter(r => /(^|[\s;])filter\s*:/.test(r.body) && !/:hover/.test(r.sel));
    ok('clip-path only on buttons, never on the viewport or around it', bad.length === 0, bad.map(r => r.sel).join(' | ') || 'buttons only');
    ok('no filter except the hover brightness on a primary button', filt.length === 0, filt.map(r => r.sel).join(' | ') || 'none');

    const dark = rules.find(r => r.sel === '.pool-hud' && /--pool-card:/.test(r.body));
    const cyber = rules.find(r => r.sel === '.retro-theme .pool-hud');
    const light = /@media \(prefers-color-scheme: light\)\s*\{\s*\.pool-hud\s*\{([^}]*)\}/.exec(css);
    const names = body => new Set([...body.matchAll(/(--pool-[\w-]+)\s*:/g)].map(m => m[1]));
    const D = names(dark.body), C = names(cyber.body), L = names(light[1]);
    const used = new Set([...css.matchAll(/var\((--pool-[\w-]+)/g)].map(m => m[1]));
    const undef = [...used].filter(n => !D.has(n));
    ok('every --pool-* the components read is defined in the default block', undef.length === 0, undef.join(', ') || used.size + ' tokens');
    const leak = [...L].filter(n => !C.has(n));
    ok('Cyberpunk redefines everything light mode sets, so light never leaks into it', leak.length === 0, leak.join(', ') || L.size + ' tokens');
    const colourish = [...D].filter(n => !/radius|display-weight|label-case|blur/.test(n));
    const cyberMissing = colourish.filter(n => !C.has(n) && !/hover-text/.test(n));
    ok('Cyberpunk maps every colour and type token', cyberMissing.length === 0, cyberMissing.join(', ') || colourish.length + ' tokens');
    const rtOutside = rules.filter(r => /var\(--rt-/.test(r.body) && !/\.retro-theme/.test(r.sel));
    ok('--rt-* is read only under .retro-theme', rtOutside.length === 0, rtOutside.map(r => r.sel).join(' | ') || 'yes');
    ok('the hot state carries the hazard stripe in Cyberpunk, not hue alone', /--pool-hot-edge:\s*var\(--rt-hazard\)/.test(cyber.body) && (css.match(/var\(--pool-hot-edge\)/g) || []).length >= 3);
    ok('pool-theme.css drops into the style template: no backticks, ${ or backslashes', !/[`\\]|\$\{/.test(css));
    ok('pool-theme.css keeps the template\'s 12-space indent', css.split('\n').filter(l => l.trim()).every(l => /^ {12}/.test(l)));
    ok('pool-hud.js keeps the IIFE body\'s 4-space indent', hudJs.split('\n').filter(l => l.trim()).every(l => /^ {4}/.test(l)));
}

// ── 3. The canvas bridge ──────────────────────────────────────────────
head('Canvas bridge');
{
    ok('hex passes through', P.phColour('#F093FB', '#000') === '#f093fb');
    ok('short hex expands', P.phColour('#fa0', '#000') === '#ffaa00');
    ok('rgb() and rgba() become hex', P.phColour('rgb(255, 242, 0)', '#000') === '#fff200' && P.phColour('rgba(0, 229, 255, 0.5)', '#000') === '#00e5ff');
    ok('anything else falls back', P.phColour('var(--nope)', '#123456') === '#123456' && P.phColour('', '#123456') === '#123456');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
