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
    const g0 = Object.assign({
        layout: 'compact', mode: 'cpu',
        names: o.mode === 'pvp' ? { 1: 'Ayesha', 2: 'Bilal' } : { 1: 'Ayesha', 2: 'CPU' },
        records: { 1: '478W · 68L', 2: o.mode === 'pvp' ? '112W · 97L' : 'Adaptive · Normal' },
        frames: [0, 0], trophies: 478, frame, world: table(o.down),
        phase: 'aim', camera: '3d', lean: 35, power: 0, dragging: false, spin: 0, called: -1,
        clock: null, toast: null, fouled: 0, handoff: 0, bih: null, result: null,
    }, o, { frame });
    // The controller hands the HUD the shooter's status from the game's rules (pool's prStatus).
    return Object.assign(g0, { status: o.status || P.prStatus(g0.frame, g0.world) });
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
    // An open table: each card shows what that player has potted (the break's balls).
    const open = { frame: { groups: { 1: null, 2: null } }, down: [3, 11, 6], pots: { 1: [3, 11], 2: [6] } };
    const op = vm(open);
    ok('open table: each card lists the balls that player potted', op.cards[0].open && op.cards[0].potted.join() === '3,11' && op.cards[1].potted.join() === '6', op.cards[0].potted.join());
    ok('…only while they are down (a ball back on the table leaves the list)', vm(Object.assign({}, open, { down: [3] })).cards[0].potted.join() === '3');
    ok('once groups are decided the tracker takes over', !m.cards[0].potted.length && !vm({ pots: { 1: [2, 5], 2: [] } }).cards[0].potted.length);
    ok('no pots yet: an empty list', !vm({ frame: { groups: { 1: null, 2: null } } }).cards[0].potted.length);
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
    const rp = { frame: { ballInHand: 'anywhere' }, canReplace: true };
    ok('placed, aiming: "Move cue ball" shows beside the aim controls', vm(rp).replace.show && vm(rp).gauge.show && vm(rp).hint.text === 'Press and drag for power');
    ok('"Move cue ball" hides mid-stroke, in the hand-off, while placing and once balls run',
        !vm(Object.assign({ dragging: true, power: 40 }, rp)).replace.show && !vm(Object.assign({ handoff: 2 }, rp)).replace.show &&
        !vm(Object.assign({ phase: 'bih' }, rp)).replace.show && !vm(Object.assign({ phase: 'moving' }, rp)).replace.show);
    ok('no "Move cue ball" without ball in hand', !vm({}).replace.show);

    const f = vm({ mode: 'pvp', camera: '2d', fouled: 1, handoff: 2, frame: { turn: 2, ballInHand: 'anywhere' }, phase: 'bih',
        toast: { kind: 'foul', title: "Foul · Hit opponent's ball first", sub: 'Ball in hand to Bilal' } });
    ok('foul: the toast replaces the camera toggle and the pill', f.toast.show && f.toast.foul && !f.cam.show && !f.pill.show);
    ok('foul: seat 1 "FOUL" (hot), seat 2 "BALL IN HAND"', f.cards[0].tag === 'FOUL' && f.cards[0].tagHot && f.cards[1].tag === 'BALL IN HAND');
    ok('foul: "Pass to Bilal" / "Ayesha, swap seats" / "BILAL\'S READY" replaces the footer',
        !f.foot.show && f.handoff.show && f.handoff.to === 'Pass to Bilal' && f.handoff.from === 'Ayesha, swap seats' && f.handoff.ready === "BILAL'S READY");
    ok('foul: no spin or hint under the toast', !f.spin.show && !f.hint.show);

    const c3 = vm({ down: SOLIDS.concat([10, 13]) });
    ok('on the 8: the pill says the state, "On the 8", and nothing about calling', c3.pill.text === 'On the 8');
    ok('3D: one call card, bottom right, "Tap a pocket"; the hint steps aside for it', c3.mini.show && c3.mini.caption === 'Tap a pocket' && c3.mini.tone === 'call' && !c3.hint.show && c3.mini.called === -1);
    ok('on the 8, uncalled: the gauge locks, the lean stays', c3.gauge.locked && c3.lean.show);
    const c3c = vm({ down: SOLIDS, called: 2 });
    ok('called: the card says "Drag to shoot" (the lit pocket names the call), gauge unlocked', c3c.mini.caption === 'Drag to shoot' && c3c.mini.tone === '' && !c3c.gauge.locked && c3c.mini.called === 2);
    const c3d = vm({ down: SOLIDS, called: 2, dragging: true, power: 90 });
    ok('dragging: the card carries the power, hot past 85%', c3d.mini.caption === 'Release · 90%' && c3d.mini.tone === 'hot' && !c3d.hint.show);
    ok('the card steps aside for the spin picker, and the hint comes back', !vm({ down: SOLIDS, spinOpen: true }).mini.show && vm({ down: SOLIDS, spinOpen: true }).hint.show);
    ok('on the CPU\'s turn there is no card, only its hint', !vm({ down: SOLIDS.concat([9]), frame: { turn: 2, groups: { 1: 'solids', 2: 'stripes' } }, cpuTurn: true, every: true }).mini.show);
    const c2 = vm({ camera: '2d', every: true, called: 1 });
    ok('2D: no card; every pocket is on screen, so the hint names the call', !c2.mini.show && c2.hint.show && c2.hint.text === 'Top side called · drag to shoot');
    ok('call every shot: the pill keeps the group', c2.pill.text === 'Solids' && vm({ mode: 'pvp', every: true }).pill.text === 'Solids');
    ok('Max: the pill names the shooter on the 8 too', vm({ down: SOLIDS, layout: 'max' }).pill.text === 'Ayesha\'s shot · On the 8');

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
    ok('Max: YOU on your avatar, the CPU gets its chip', mx.cards[0].initials === 'YOU' && mx.cards[1].cpu);
    ok('initials: two words give two letters, one word its first two', P.phInitials('Player 1', 1) === 'P1' && P.phInitials('Ayesha Khan', 1) === 'AK' && P.phInitials('Bilal', 2) === 'BI' && P.phInitials('', 2) === 'P2');
    ok('spin presets cycle through all five', [0, 1, 2, 3, 4, 5].map(i => vm({ spin: i }).spin.label).join() === 'Center,Follow,Draw,Left,Right,Center');
    ok('spin presets sit inside the miscue circle', P.PH_SPINS.every(s => Math.hypot(s.x, s.y) <= P.ppCreateWorld().cfg.maxTip));
    // The Game mode sheet (InMatch.dc.html's ModeSheet).
    ok('the sheet is closed until asked for', !vm({}).sheet.show);
    const sh = vm({ sheet: { open: true, mode: 'cpu' }, difficulty: 'hard', adaptiveTier: 'normal' });
    ok('Vs CPU: the five difficulties in the design\'s order and words', sh.sheet.show && sh.sheet.mode === 'cpu' &&
       sh.sheet.diffs.map(d => d.name).join() === 'Adaptive,Easy,Normal,Hard,Pro' && sh.sheet.diffs[4].desc === 'Hardly misses · call every shot' &&
       sh.sheet.diffs[0].desc === 'Matches your form, frame by frame');
    ok('the picked difficulty is checked, and the Adaptive chip names the tier it plays now',
       sh.sheet.diffs.filter(d => d.checked).map(d => d.key).join() === 'hard' && sh.sheet.chip === 'NOW NORMAL');
    ok('no pick yet means Adaptive', vm({ sheet: { open: true } }).sheet.diffs[0].checked);
    ok('with the sheet up, the lean, spin, picker and hint step aside', !sh.lean.show && !sh.spin.show && !sh.hint.show && !vm({ sheet: { open: true }, spinOpen: true }).spin.open);
    ok('the sheet opens on 2 Players when that is the mode', vm({ mode: 'pvp', sheet: { open: true } }).sheet.mode === 'pvp');
    const nm = vm({ mode: 'pvp', sheet: { open: true, names: [{ value: 'Bilal', placeholder: 'Ayesha' }, { value: '', placeholder: 'Player 2' }] } }).sheet.names;
    ok('2 Players: two names, each with the default an empty one plays as', nm.length === 2 && nm[0].value === 'Bilal' && nm[0].placeholder === 'Ayesha' && nm[1].value === '' && nm[1].placeholder === 'Player 2');
    ok('…and Player 1 / Player 2 when the game passes none', vm({ sheet: { open: true } }).sheet.names.map(n => n.placeholder).join() === 'Player 1,Player 2');
    ok('a note under the list passes through', vm({ sheet: { open: true, note: 'Hard from the next frame; this one stays Normal' } }).sheet.note === 'Hard from the next frame; this one stays Normal');
    ok('frame over vs the CPU: the second button is Change difficulty, as designed',
       vm({ phase: 'over', result: { win: true, title: 'You win' } }).dialog.secondary === 'Change difficulty');

    // Free spin: any tip inside the ring, clamped to it, named by where it is.
    ok('the picker\'s limit is the physics\' miscue radius', P.PH_TIP_MAX === P.ppCreateWorld().cfg.maxTip);
    const far = P.phClampTip(3, 4);
    ok('a tip dragged past the ring stops on it, in the same direction', Math.abs(Math.hypot(far.x, far.y) - 0.6) < 1e-12 && Math.abs(far.y / far.x - 4 / 3) < 1e-12);
    ok('a tip inside the ring is kept exactly', P.phClampTip(0.1, -0.2).x === 0.1 && P.phClampTip(0.1, -0.2).y === -0.2);
    const ft = vm({ tip: { x: 0.12, y: 0.3 } });
    ok('any tip: the button names it, the readout says how much', ft.spin.label === 'Follow · Right' && ft.spin.readout === 'Follow 50% · Right 20%' && ft.spin.x === 0.12, ft.spin.readout);
    ok('near the middle reads Center', vm({ tip: { x: 0.03, y: -0.02 } }).spin.label === 'Center' && vm({ tip: { x: 0, y: 0 } }).spin.readout === 'Center ball');
    ok('a free tip that matches a preset lights that chip', vm({ tip: { x: 0, y: -0.55 } }).spin.preset === 2 && vm({ tip: { x: 0.1, y: 0.1 } }).spin.preset === -1);
    ok('the picker opens only while you aim',
       vm({ spinOpen: true }).spin.open && !vm({ spinOpen: true, cpuTurn: true }).spin.open && !vm({ spinOpen: true, phase: 'moving' }).spin.open &&
       !vm({ spinOpen: true, dragging: true, power: 20 }).spin.open && !vm({ spinOpen: true, handoff: 2 }).spin.open);
}

// ── 1b. Snooker's states (InMatch.dc.html and Max.dc.html, snk*) ────────
head("Snooker's in-match states");
{
    // A snooker table and frame as the controller hands them over: the status from the rules.
    const COL = { 2: [-293.5, -81.8], 3: [-293.5, 81.8], 4: [-293.5, 0], 5: [0, 0], 6: [250, 0], 7: [409.2, 0] };
    const snkGame = o => {
        const w = P.psCreateWorld();
        w.balls = [P.ppMakeBall(0, -60, 10)];
        [2, 3, 4, 5, 6, 7].forEach(id => w.balls.push(Object.assign(P.ppMakeBall(id, COL[id][0], COL[id][1]), (o.down || []).includes(id) ? { state: 'pocketed' } : {})));
        for (let i = 0; i < 15; i++) w.balls.push(Object.assign(P.ppMakeBall(8 + i, 300 + 16 * (i % 5), -40 + 16 * Math.floor(i / 5)), i < (o.reds === undefined ? 9 : o.reds) ? {} : { state: 'pocketed' }));
        const frame = Object.assign(P.psNewFrame({ reds: 15, seed: 1 }), { isBreak: false, ballInHand: null, scores: { 1: 34, 2: 21 }, brk: 34, high: { 1: 34, 2: 12 } }, o.frame);
        const g = Object.assign({
            layout: 'compact', game: 'snooker', title: 'Snooker', mode: 'cpu', names: { 1: 'Ayesha', 2: 'CPU' }, records: { 1: '36W · 21L', 2: 'Adaptive · Normal' },
            frames: [0, 0], trophies: 0, frame, world: w, phase: 'aim', camera: '3d', lean: 35, power: 0, dragging: false, tip: { x: 0, y: 0 }, called: -1,
            clock: null, toast: null, fouled: 0, handoff: 0, bih: null, result: null, nom: -1, confirm: false, choice: null, diffs: P.PH_SNK_DIFFS,
        }, o, { frame });
        g.status = P.psStatus(frame, w, frame.turn, g.nom);
        return P.phModel(g);
    };
    let m = snkGame({});
    ok('snkRed: the scores on the cards, BREAK 34 on the active one, no pool trackers', m.cards[0].score === '34' && m.cards[1].score === '21' && m.cards[0].tag === 'BREAK 34' && m.cards[1].tag === '' &&
       !m.cards[0].group.length && !m.cards[0].open && m.game === 'snooker');
    ok('snkRed: the pill "On a red"; the tracker: REDS × 9, six colours, 99 REMAINING, no snookers', m.pill.text === 'On a red' && m.track.show && m.track.reds === 9 && m.track.dots.length === 6 &&
       m.track.rem === '99 REMAINING' && !m.track.snookers && !m.track.concede && m.track.aria === 'Reds left 9, colours yellow, green, brown, blue, pink, black, 99 points remaining');
    ok('snkRed: no chips, the gauge unlocked, the usual hint', !m.chips.show && !m.gauge.locked && m.hint.text === 'Press and drag for power');
    // The tracker read out (S7): once the shot is over, what is on, the score and the tracker.
    ok('snkRed: the readout says what is on, the score and the tracker',
       m.track.say === 'On a red. Ayesha 34, CPU 21. Reds left 9, colours yellow, green, brown, blue, pink, black, 99 points remaining.', m.track.say);
    ok('…and holds its last reading while balls run (null: nothing new to read)', snkGame({ phase: 'moving' }).track.say === null && snkGame({ phase: 'strike' }).track.say === null);
    m = snkGame({ frame: { phase: 'colour', brk: 35 } });
    ok('snkNom: the chips (Tap a colour), the padlock, no hint; the pill "Nominate a colour"', m.chips.show && m.chips.caption === 'Tap a colour' && m.chips.items.length === 6 && m.chips.items.every(c => c.live) &&
       m.gauge.locked && !m.hint.show && m.pill.text === 'Nominate a colour' && m.chips.label === 'Nominate a colour');
    m = snkGame({ frame: { phase: 'colour' }, nom: 6 });
    ok('snkNomPink: the pink checked, "Drag to shoot", the pill "On the pink", the gauge free, the pink ringed in the tracker',
       m.chips.items.find(c => c.id === 6).checked && m.chips.caption === 'Drag to shoot' && m.pill.text === 'On the pink' && !m.gauge.locked && m.track.dots.find(d => d.id === 6).on);
    m = snkGame({ frame: { phase: 'colour' }, nom: 6, dragging: true, power: 90 });
    ok('…dragging: "Release · 90%", hot', m.chips.caption === 'Release · 90%' && m.chips.tone === 'hot');
    // The call pocket with a colour: the folded chips carry the call, in 3D with the map.
    m = snkGame({ frame: { phase: 'colour', call: 'colours' }, nom: 6 });
    ok('called colours, the pink nominated: the folded chip asks for a pocket (the map in 3D), the power padlocked, no call card beside it',
       m.chips.folded && m.chips.caption === 'Tap a pocket' && m.chips.tone === 'call' && m.chips.pad && m.gauge.locked && !m.mini.show);
    m = snkGame({ frame: { phase: 'colour', call: 'colours' }, nom: 6, called: 5 });
    ok('…called: "Drag to shoot", the pocket lit, the padlock open', m.chips.caption === 'Drag to shoot' && m.chips.called === 5 && !m.gauge.locked);
    ok('…in 2D no map: the pockets are tapped on the table', !snkGame({ frame: { phase: 'colour', call: 'colours' }, nom: 6, camera: '2d' }).chips.pad);
    m = snkGame({ frame: { call: 'all' } });
    ok('called on a red (all): no chips, pool\'s call card in 3D, the padlock', !m.chips.show && m.mini.show && m.mini.caption === 'Tap a pocket' && m.gauge.locked);
    ok('…in 2D, the hint asks for it', snkGame({ frame: { call: 'all' }, camera: '2d' }).hint.text === 'Tap a pocket to call it');
    // The user's test: the lean slider went missing whenever a call was due (Hard, Pro, a
    // tournament calling pockets). It stays, before the call and after.
    ok('with a call due the lean stays: on a red (all), on a colour (colours), and once called',
       m.lean.show && snkGame({ frame: { phase: 'colour', call: 'colours' }, nom: 6 }).lean.show &&
       snkGame({ frame: { call: 'all' }, called: 2 }).lean.show && snkGame({ frame: { call: 'all' }, layout: 'max' }).lean.show);
    m = snkGame({ frame: { phase: 'colour' }, nom: 6, dragging: true, power: 90 });
    ok('⚙️ Max View: bars only in Max, and only when picked', vm({ layout: 'max', maxBars: true }).maxBars && !vm({ layout: 'max' }).maxBars && !vm({ maxBars: true }).maxBars);
    ok('nominated, the chips fold to the pink, and say how to change it', m.chips.folded && m.chips.label === 'Nominated: the pink. Press it to change');
    ok('…open again (chipsOpen), the six; before a colour, never folded', !snkGame({ frame: { phase: 'colour' }, nom: 6, chipsOpen: true }).chips.folded &&
       !snkGame({ frame: { phase: 'colour' } }).chips.folded && snkGame({ frame: { turn: 1, freeBall: true }, nom: 6 }).chips.label === 'Free ball: the pink. Press it to change');
    ok('the chips never show for the CPU, in the hand-off, under a toast or the sheet', !snkGame({ frame: { phase: 'colour', turn: 2 }, cpuTurn: true }).chips.show &&
       !snkGame({ frame: { phase: 'colour' }, handoff: 1 }).chips.show && !snkGame({ frame: { phase: 'colour' }, toast: { kind: 'notice', title: 'x' } }).chips.show &&
       !snkGame({ frame: { phase: 'colour' }, sheet: { open: true } }).chips.show);
    // The choice after a foul.
    const pend = { offender: 1, chooser: 2, options: ['play', 'back'], penalty: 6 };
    const foul = o => snkGame(Object.assign({ mode: 'pvp', names: { 1: 'Ayesha', 2: 'Bilal' }, phase: 'choice', fouled: 1, frame: { turn: 2, pending: pend, brk: 0 },
        toast: { kind: 'foul', title: 'Foul · 6 to Bilal', sub: 'Hit the pink first' },
        choice: { chooser: 2, cpu: false, options: P.psChoiceText(pend, { 1: 'Ayesha', 2: 'Bilal' }) } }, o));
    m = foul({});
    ok('snkFoul: FOUL on the offender, YOUR CHOICE on the chooser, the toast\'s buttons Play (primary) and Make Ayesha play again',
       m.cards[0].tag === 'FOUL' && m.cards[0].tagHot && m.cards[1].tag === 'YOUR CHOICE' && m.toast.foul && m.toast.choices.map(c => c.label).join('|') === 'Play|Make Ayesha play again' &&
       m.toast.choices[0].primary && m.toast.choices[1].short === 'Put back' && m.toast.chooser === 'Bilal, choose how play continues');
    ok('…the lean steps aside, and nothing to aim with', !m.lean.show && !m.gauge.show && !m.chips.show);
    m = foul({ handoff: 2 });
    ok('snkFoulHand: in the hand-off the toast says who chooses, and no buttons yet', !m.toast.choices.length && m.toast.sub === 'Bilal chooses how play continues');
    m = foul({ mode: 'cpu', names: { 1: 'Ayesha', 2: 'CPU' }, cpuTurn: true, choice: { chooser: 2, cpu: true, options: [] } });
    ok('the CPU choosing: its card reads CHOOSING, and no buttons', m.cards[1].tag === 'CHOOSING' && !m.toast.choices.length);
    m = snkGame({ mode: 'pvp', names: { 1: 'Ayesha', 2: 'Bilal' }, frame: { turn: 2, freeBall: true, brk: 0 } });
    ok('snkFreeNom: the free ball to nominate: the chips, "Nominate the free ball", the pill "Free ball"', m.chips.show && m.chips.label === 'Nominate the free ball' && m.pill.text === 'Free ball');
    ok('…nominated: "Free ball · Pink"', snkGame({ frame: { turn: 1, freeBall: true }, nom: 6 }).pill.text === 'Free ball · Pink');
    // Snookers required, concede.
    m = snkGame({ mode: 'pvp', names: { 1: 'Ayesha', 2: 'Bilal' }, reds: 2, frame: { scores: { 1: 22, 2: 68 }, brk: 0 } });
    ok('snkSnookers: SNOOKERS REQ. 1, 43 LEFT, and Concede for the player at the table', m.track.snookers === 1 && m.track.rem === '43 LEFT' && m.track.concede && /Ayesha needs 1 snooker$/.test(m.track.aria));
    ok('…not for the CPU, nor in the hand-off', !snkGame({ reds: 2, frame: { turn: 2, scores: { 1: 68, 2: 22 } }, cpuTurn: true }).track.concede && !snkGame({ reds: 2, frame: { scores: { 1: 22, 2: 68 } }, handoff: 1 }).track.concede);
    m = snkGame({ mode: 'pvp', names: { 1: 'Ayesha', 2: 'Bilal' }, reds: 2, frame: { scores: { 1: 22, 2: 68 } }, confirm: true });
    ok('snkConcede: "Bilal wins 68–22", the chips and Concede out of the way', m.concede.show && m.concede.text === 'Bilal wins 68–22' && !m.track.concede);
    // The colours, the re-spotted black, ball in hand, frame over.
    m = snkGame({ reds: 0, frame: { phase: 'clearance', next: 2, scores: { 1: 56, 2: 41 }, brk: 22 } });
    ok('snkColours: "On the yellow", 27 REMAINING, the yellow ringed', m.pill.text === 'On the yellow' && m.track.rem === '27 REMAINING' && m.track.dots[0].on && m.track.reds === 0);
    m = snkGame({ reds: 0, down: [2, 3, 4, 5, 6], phase: 'bih', frame: { phase: 'clearance', next: 7, respotBlack: true, ballInHand: 'D', scores: { 1: 61, 2: 61 }, brk: 0 }, bih: { valid: true, placed: false } });
    ok('snkRespot: "Re-spotted black", BALL IN HAND, "Place the cue ball in the D", 7 REMAINING, the black ringed', m.pill.text === 'Re-spotted black' && m.cards[0].tag === 'BALL IN HAND' &&
       m.hint.text === 'Place the cue ball in the D' && m.track.rem === '7 REMAINING' && m.track.dots[5].on);
    m = snkGame({ phase: 'bih', reds: 15, frame: { isBreak: true, ballInHand: 'D', scores: { 1: 0, 2: 0 }, brk: 0 }, bih: { valid: true, placed: false } });
    ok('snkBreak: "Break-off · in the D", TO BREAK, 147 REMAINING', m.pill.text === 'Break-off · in the D' && m.cards[0].tag === 'TO BREAK' && m.track.rem === '147 REMAINING');
    ok('ball in hand outside the D: "Inside the D only"', snkGame({ phase: 'bih', frame: { ballInHand: 'D' }, bih: { valid: false, reason: 'D', sx: 100, sy: 100, sr: 3 } }).bihNote.text === 'Inside the D only');
    m = snkGame({ phase: 'over', reds: 0, down: [2, 3, 4, 5, 6, 7], frames: [1, 0], result: { win: true, title: 'Ayesha wins', reason: 'Potted the black.', recordLabel: 'AYESHA · RECORD', record: '37W · 21L', delta: '+1 WIN', note: '',
        stats: [{ label: 'SCORE', value: '72–41' }, { label: 'HIGH BREAK', value: '58 · Ayesha' }] } });
    ok('snkWin: the dialog with SCORE and HIGH BREAK two up, 0 REMAINING, no tags', m.dialog.show && m.dialog.reason === 'Potted the black.' && m.dialog.stats.length === 2 && m.dialog.stats[1].value === '58 · Ayesha' &&
       m.track.rem === '0 REMAINING' && m.cards.every(c => !c.tag));
    ok('snkMaxRed: the Max pill "Bilal\'s shot · On a red"', snkGame({ layout: 'max', mode: 'pvp', names: { 1: 'Ayesha', 2: 'Bilal' }, frame: { turn: 2 } }).pill.text === "Bilal's shot · On a red");
    ok('the century notice carries the trophy', snkGame({ toast: { kind: 'notice', icon: 'trophy', title: 'Century break · 104', sub: 'Ayesha keeps the break going' } }).toast.icon === 'trophy');
    // Out of the way of the shot (phShyHits): the boxes a segment or a circle reaches.
    {
        const boxes = { cam: { x: 10, y: 10, w: 100, h: 36 }, spin: { x: 10, y: 300, w: 120, h: 44 }, chips: { x: 250, y: 300, w: 120, h: 50 } };
        const hits = shot => P.phShyHits(shot, boxes).sort().join();
        ok('a line into the top-left corner fades the camera toggle, and nothing else', hits({ segs: [[200, 200, 20, 20]], dots: [] }) === 'cam');
        ok('a line that passes beside a box leaves it (6 px pad)', hits({ segs: [[0, 60, 200, 60]], dots: [] }) === '' && hits({ segs: [[0, 50, 200, 50]], dots: [] }) === 'cam');
        ok('a circle reaching a box fades it: the cue ball, the pocket', hits({ segs: [], dots: [[180, 320, 60]] }) === 'spin' && hits({ segs: [], dots: [[380, 360, 20]] }) === 'chips');
        ok('a line crossing two boxes fades both; no shot, none', hits({ segs: [[0, 320, 400, 320]], dots: [] }) === 'chips,spin' && hits(null) === '');
        ok('a segment wholly inside a box counts', hits({ segs: [[20, 20, 30, 30]], dots: [] }) === 'cam');
    }
    ok('pool\'s model has the snooker parts, all hidden', !vm({}).track.show && !vm({}).chips.show && !vm({}).concede.show && vm({}).toast.choices.length === 0);
    ok('the snooker sheet\'s words are the design\'s', P.PH_SNK_DIFFS.map(d => d.desc).join('|') === 'Matches your form, frame by frame|Pots the simple ones · leaves chances|Builds small breaks · plays some safe|Position and safety · call the colours|Hardly misses · call every ball');
    ok('chip ink passes: dark on yellow and pink, light on the rest', ['#101214', '#ffffff', '#ffffff', '#ffffff', '#101214', '#ffffff'].every((ink, i) => P.phInkOn(P.pgBallLook('snooker', i + 2).colour) === ink));
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
    // Every selector in the rule must be a button: the HUD's, or the tournament screens'.
    const isButton = sel => /\.ph-btn|\.ph-primary|\.pu-primary|\.pu-btn|\.pu-iconbtn|\.pu-stepper button/.test(sel);
    const bad = clipped.filter(r => /clip-path/.test(r.body) && !r.sel.split(',').every(isButton));
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
