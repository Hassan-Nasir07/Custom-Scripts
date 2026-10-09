    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — HUD (v2)
    // ═══════════════════════════════════════════════════════════════════
    // The panel around the table: player cards (group trackers, shot clock), the frame count,
    // the viewport's overlays, the frame-over dialog, and the footer or the seat hand-off.
    // Snooker adds a score and third line per card, the tracker row, the colour chips, the
    // choice after a foul and the concede question (phSnookerModel).
    //
    // Three layers, so the logic can be tested without a browser:
    //   phModel(game)      pure: game snapshot → view model (everything the HUD shows)
    //   phBuild(root, …)   DOM: builds the HUD once, compact or Max
    //   phRender(hud, vm)  DOM: applies a view model, touching only what changed
    // Colours come only from pool-theme.css (--pool-*); the canvas cannot read CSS, so
    // phThemeTokens() is the renderer's bridge.

    const PH_POCKETS = ['Top left', 'Top side', 'Top right', 'Bottom left', 'Bottom side', 'Bottom right'];
    const PH_SPINS = [
        { label: 'Center', x: 0, y: 0 },
        { label: 'Follow', x: 0, y: 0.45 },
        { label: 'Draw', x: 0, y: -0.55 },
        { label: 'Left', x: -0.45, y: 0 },
        { label: 'Right', x: 0.45, y: 0 },
    ];
    // The tip strikes anywhere inside the miscue ring, 0.6 R from centre (PP_DEFAULTS.maxTip).
    const PH_TIP_MAX = 0.6;
    const PH_TIP_DEAD = 0.05;        // closer to the centre than this reads as Center
    function phClampTip(x, y) {
        x = Number(x) || 0; y = Number(y) || 0;
        const m = Math.hypot(x, y);
        return m > PH_TIP_MAX ? { x: x * PH_TIP_MAX / m, y: y * PH_TIP_MAX / m } : { x, y };
    }
    // "Follow · Right" for the button; the popover's readout adds how much.
    function phSpinLabel(t) {
        const v = t.y > PH_TIP_DEAD ? 'Follow' : t.y < -PH_TIP_DEAD ? 'Draw' : '';
        const h = t.x > PH_TIP_DEAD ? 'Right' : t.x < -PH_TIP_DEAD ? 'Left' : '';
        return [v, h].filter(Boolean).join(' · ') || 'Center';
    }
    function phSpinReadout(t) {
        const pct = a => Math.round(Math.abs(a) / PH_TIP_MAX * 100) + '%';
        const parts = [];
        if (Math.abs(t.y) > PH_TIP_DEAD) parts.push((t.y > 0 ? 'Follow ' : 'Draw ') + pct(t.y));
        if (Math.abs(t.x) > PH_TIP_DEAD) parts.push((t.x > 0 ? 'Right ' : 'Left ') + pct(t.x));
        return parts.join(' · ') || 'Center ball';
    }
    // The Game mode sheet's difficulty list, in order.
    const PH_DIFFS = [
        { key: 'adaptive', name: 'Adaptive', desc: 'Matches your form, frame by frame' },
        { key: 'easy', name: 'Easy', desc: 'Takes simple pots · misses often' },
        { key: 'normal', name: 'Normal', desc: 'Solid potting · little position play' },
        { key: 'hard', name: 'Hard', desc: 'Plays position · rarely leaves a shot' },
        { key: 'pro', name: 'Pro', desc: 'Hardly misses · call every shot' },
    ];
    // Snooker's: the same tiers, snooker's words.
    const PH_SNK_DIFFS = [
        { key: 'adaptive', name: 'Adaptive', desc: 'Matches your form, frame by frame' },
        { key: 'easy', name: 'Easy', desc: 'Pots the simple ones · leaves chances' },
        { key: 'normal', name: 'Normal', desc: 'Builds small breaks · plays some safe' },
        { key: 'hard', name: 'Hard', desc: 'Position and safety · call the colours' },
        { key: 'pro', name: 'Pro', desc: 'Hardly misses · call every ball' },
    ];
    // Snooker's colours, by id (= value), for the tracker and the chips.
    const PH_SNK = [[2, 'yellow'], [3, 'green'], [4, 'brown'], [5, 'blue'], [6, 'pink'], [7, 'black']].map(([id, name]) => ({ id, name }));
    const phSnkName = id => { const c = PH_SNK.find(b => b.id === id); return c ? c.name : 'red'; };
    const phCap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const PH_SNK_SHORT = { 'YOUR CHOICE': 'CHOICE', 'BALL IN HAND': 'IN HAND', CHOOSING: 'CHOOSING' };
    const PH_CLOCK_HOT = 5;          // seconds left when the clock goes hot
    const PH_POWER_HOT = 85;         // % at which the gauge goes hot
    const PH_BIH_NOTE = { overlap: 'Overlaps a ball', kitchen: 'Behind the head string only', outside: 'Keep it on the felt', D: 'Inside the D only' };

    const phWins = (name) => (name === 'You' ? 'You win' : name + ' wins');

    // The Max avatar: YOU for you, the first letter of two words (Player 1 → P1,
    // Ayesha Khan → AK), or the first two letters of one (Bilal → BI).
    function phInitials(name, seat) {
        const n = String(name || '').trim();
        if (n === 'You') return 'YOU';
        const words = n.split(/\s+/).map(w => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
        const s = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '').slice(0, 2);
        return s.toUpperCase() || 'P' + seat;
    }

    // ── View model ────────────────────────────────────────────────────
    // game = {
    //   layout: 'compact' | 'max', mode: 'cpu' | 'pvp' | 'tour', game: 'pool' | 'snooker',
    //   names: { 1, 2 }, records: { 1, 2 }, frames: [a, b], trophies, title (Max header),
    //   frame (rules state), status (the shooter's position, poolRules().status), world,
    //   phase: 'aim' | 'strike' | 'moving' | 'bih' | 'over',
    //   camera: '3d' | '2d', lean, power, dragging, called,
    //   tip: { x, y },               the cue tip in R (follow +y, right +x); else
    //   spin,                        a PH_SPINS index
    //   spinOpen,                    the big spin picker is open
    //   clock: { left, total } | null, toast: prText(…) | null, fouled: seat | 0,
    //   handoff: seat | 0,           "Pass to …" while seats swap
    //   bih: { valid, reason, placed, sx, sy, sr } | null,
    //   canReplace,                  the placed cue ball may be picked up again
    //   cpuTurn,                     the CPU is at the table: its own hint, no human controls
    //   sheet: { open, mode, note, names: [{ value, placeholder }] },   the Game mode sheet
    //   difficulty, diffs,           the picked difficulty; this game's list (PH_DIFFS)
    //   pots: { 1: [ids], 2: [ids] } each seat's potted balls, shown while the table is open
    //   tour: { kicker, title, frame } | null   header strip; the footer becomes Bracket / Pause / Max
    //   tourSheet: { saved, name }   the sheet's Tournament tab
    //   net: poolNetModel() | null   online: the sheet's tab (server, players, invites) and an
    //                                invite over the table; cpuTurn is also the other tab's turn
    //   primaryLabel,                overrides the frame-over dialog's first button
    //   reactOpen,                   online: the React tray is open (net.said: { 1, 2 } each seat's bubble)
    //   start: { label, sub } | null  Vs CPU: PLAY (or RESUME) over the table until pressed
    //   adaptiveTier,                the tier adaptive would play now (the NOW chip)
    //   secondaryLabel,              overrides the frame-over dialog's second button
    //   result: { win, title, reason, recordLabel, record, delta, note, stats? } | null,
    //   cueName, the equipped cue; cues: poolCueModel() | null, the collection open;
    //   cueNew: a just-unlocked cue's id | null,
    //   snooker: nom (nominated colour or -1), confirm (concede question open),
    //            choice: { chooser, cpu, options: [{ id, label, short }] } | null
    // }
    function phModel(g) {
        const st = g.status;
        const over = g.phase === 'over';
        const bih = g.phase === 'bih';
        const moving = g.phase === 'moving';
        const toast = g.toast || null;
        const aiming = g.phase === 'aim' || g.phase === 'strike';
        const callNeeded = aiming && st.callRequired && !(g.called >= 0);
        const max = g.layout === 'max';
        const sheetOpen = !!(g.sheet && g.sheet.open);
        const sheetMode = (g.sheet && g.sheet.mode) || (g.mode === 'pvp' || g.mode === 'net' ? g.mode : 'cpu');
        const onTable = new Set(g.world.balls.filter(b => b.state !== 'pocketed').map(b => b.id));
        // The big spin picker: only while you are the one aiming.
        const pickerOpen = !!g.spinOpen && aiming && !g.cpuTurn && !g.handoff && !toast && !g.dragging && !sheetOpen;

        const cards = [1, 2].map(seat => {
            const active = !over && g.frame.turn === seat;
            const clockLeft = g.clock && active ? g.clock.left : null;
            const hot = clockLeft !== null && clockLeft <= PH_CLOCK_HOT;
            let tag = '';
            if (!over) {
                if (g.fouled === seat) tag = 'FOUL';
                else if (active && bih) tag = g.frame.ballInHand === 'kitchen' ? 'TO BREAK' : 'BALL IN HAND';
                else if (active && clockLeft !== null) tag = Math.ceil(clockLeft) + 's';
                else if (active) tag = 'TO SHOOT';
            }
            const group = g.frame.groups ? g.frame.groups[seat] : null;
            const ids = group === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : group === 'stripes' ? [9, 10, 11, 12, 13, 14, 15] : [];
            return {
                seat, name: g.names[seat], rec: g.records[seat] || '',
                active, hot, tag, tagHot: g.fouled === seat || hot, tagPulse: hot,
                // The short form, for when the name would not fit beside the long one.
                tagShort: { 'BALL IN HAND': 'IN HAND', 'TO BREAK': 'BREAK', 'TO SHOOT': 'SHOOT' }[tag] || '',
                clock: clockLeft !== null && g.clock.total > 0 ? Math.max(0, Math.min(100, clockLeft / g.clock.total * 100)) : 0,
                open: !group, group: ids.map(id => ({ id, down: !onTable.has(id) })),
                // On an open table the card shows what this player has potted, so the break's
                // balls are known before the groups are. Beyond three the balls carry it alone.
                potted: !group && g.pots ? (g.pots[seat] || []).filter(id => !onTable.has(id)) : [],
                initials: phInitials(g.names[seat], seat),
                cpu: g.mode === 'cpu' && seat === 2,
            };
        });

        // The pill names what the shooter is on: state only. What to do about it (call a
        // pocket) is the hint's, or in 3D the call card's, so it is never said twice.
        const shooterGroup = g.frame.groups ? g.frame.groups[g.frame.turn] : null;
        let pill;
        if (bih) pill = g.frame.ballInHand === 'kitchen' ? 'Break · kitchen only' : 'Ball in hand';
        else if (g.frame.isBreak) pill = 'Break';
        else if (st.onThe8) pill = 'On the 8';
        else pill = shooterGroup ? shooterGroup[0].toUpperCase() + shooterGroup.slice(1) : 'Open table';
        if (max && !bih && !g.frame.isBreak) {
            const who = g.names[g.frame.turn];
            pill = (who === 'You' ? 'Your shot' : who + "'s shot") + ' · ' + pill;
        }

        let hint = null;
        // The CPU's (or online, the other player's) ball in hand: theirs to place, not yours.
        if (bih && g.cpuTurn) hint = { text: (g.names[g.frame.turn] || 'CPU') + ' has ball in hand', tone: '' };
        else if (bih) {
            if (g.bih && g.bih.placed) hint = { text: 'Placed · aim', tone: '' };
            else if (g.bih && g.bih.valid === false) hint = { text: 'Drop on open felt', tone: 'hot' };
            else hint = { text: g.frame.ballInHand === 'kitchen' ? 'Place in kitchen' : 'Drag to place', tone: '' };
        } else if (aiming && g.cpuTurn) {
            hint = { text: (g.names[g.frame.turn] || 'CPU') + ' is aiming', tone: '' };
        } else if (aiming) {
            const pw = Math.round(g.power || 0);
            if (g.dragging) hint = { text: 'Release · ' + pw + '%', tone: pw >= PH_POWER_HOT ? 'hot' : 'power' };
            else if (callNeeded) hint = { text: 'Tap a pocket', tone: 'call' };
            else if (st.callRequired && g.called >= 0) hint = { text: PH_POCKETS[g.called] + ' called', tone: '' };
            else hint = { text: 'Drag for power', tone: '' };
        }

        // The call card (3D): pocket map and hint in one, bottom right; the lit pocket names the
        // call, so the caption says what comes next. It steps aside for the spin picker.
        const card = aiming && st.callRequired && g.camera === '3d' && !g.cpuTurn && !g.handoff && !toast && !pickerOpen && !sheetOpen;
        const pwr = Math.round(g.power || 0);
        const cardCap = g.dragging ? { text: 'Release · ' + pwr + '%', tone: pwr >= PH_POWER_HOT ? 'hot' : 'power' }
            : callNeeded ? { text: 'Tap a pocket', tone: 'call' } : { text: 'Drag to shoot', tone: '' };

        const spin = g.tip ? phClampTip(g.tip.x, g.tip.y)
            : PH_SPINS[((g.spin || 0) % PH_SPINS.length + PH_SPINS.length) % PH_SPINS.length];
        const lean = Math.max(0, Math.min(100, Math.round(g.lean || 0)));
        const is3d = g.camera === '3d' && !bih;
        const note = bih && !g.cpuTurn && g.bih && g.bih.valid === false && g.bih.sx !== undefined
            ? { text: PH_BIH_NOTE[g.bih.reason] || PH_BIH_NOTE.overlap, x: g.bih.sx, y: g.bih.sy + (g.bih.sr || 5) + 26 } : null;

        const vm = {
            layout: max ? 'max' : 'compact',
            game: g.game || 'pool', title: g.title || '8-Ball Pool',
            cards,
            frames: (g.frames ? g.frames[0] : 0) + '–' + (g.frames ? g.frames[1] : 0),
            trophies: g.trophies || 0,
            cam: {
                show: !toast, is3d,
                label2d: max ? '2D TOP-DOWN' : bih ? '2D · AUTO' : '2D',
                label3d: max ? '3D AIM' : '3D',
            },
            pill: { show: !toast && !over, text: pill },
            toast: toast ? { show: true, foul: toast.kind === 'foul', title: toast.title, sub: toast.sub, icon: toast.icon || '', choices: [], chooser: '' } : { show: false, choices: [] },
            lean: {
                // It stays for a call: the call card sits bottom right, clear of the slider.
                show: is3d && !over && !moving && !sheetOpen,
                value: lean,
                // The pitch the camera actually looks down at, as the design labels it.
                label: Math.round(19.5 + 28.5 * lean / 100 - Math.atan(0.34 / 1.1) * 180 / Math.PI) + '°',
            },
            gauge: {
                show: aiming,
                power: Math.max(0, Math.min(100, g.power || 0)),
                live: !!g.dragging || (!!g.cpuTurn && (g.power || 0) > 0), hot: (g.power || 0) >= PH_POWER_HOT, locked: callNeeded,
            },
            spin: {
                show: !bih && !over && !toast && !moving && !sheetOpen, label: phSpinLabel(spin), readout: phSpinReadout(spin), x: spin.x, y: spin.y,
                open: pickerOpen,
                preset: PH_SPINS.findIndex(p => Math.abs(p.x - spin.x) < 1e-6 && Math.abs(p.y - spin.y) < 1e-6),
            },
            hint: { show: !!hint && !over && !toast && !sheetOpen && !card, text: hint ? hint.text : '', tone: hint ? hint.tone : '' },
            bihNote: note ? { show: true, text: note.text, x: note.x, y: note.y } : { show: false },
            // Back to placing: only before the shot, and never mid-stroke.
            replace: { show: !!g.canReplace && g.phase === 'aim' && !g.dragging && !g.handoff && !over },
            mini: { show: card, called: g.called >= 0 ? g.called : -1, caption: cardCap.text, tone: cardCap.tone },
            dialog: over && g.result ? Object.assign({ show: true, kicker: 'FRAME OVER · ' + (g.frames ? g.frames[0] + '–' + g.frames[1] : ''),
                primary: g.primaryLabel || (g.mode === 'tour' ? 'NEXT FRAME' : 'NEW FRAME'),
                secondary: g.secondaryLabel || (g.mode === 'cpu' ? 'Change difficulty' : g.mode === 'tour' ? 'Bracket' : 'Change mode') }, g.result) : { show: false },
            foot: { show: !g.handoff, tour: g.mode === 'tour', net: g.mode === 'net', modeLabel: g.mode === 'cpu' ? 'Vs CPU' : g.mode === 'tour' ? 'Tournament' : g.mode === 'net' ? 'Online' : '2 Players' },
            tour: g.tour ? { show: true, kicker: g.tour.kicker, title: g.tour.title, frame: g.tour.frame } : { show: false },
            handoff: g.handoff ? {
                show: true, to: 'Pass to ' + g.names[g.handoff],
                from: g.names[3 - g.handoff] + ', swap seats',
                ready: (g.names[g.handoff] || '').toUpperCase() + "'S READY",
            } : { show: false },
            cursor: bih && !g.cpuTurn ? 'placing' : g.dragging ? 'dragging' : '',
            // The shot in view pixels (segments and circles), for phShy.
            shot: g.shot || null,
            maxBars: max && !!g.maxBars,
            sheet: sheetOpen ? {
                show: true, mode: sheetMode,
                diffs: (g.diffs || PH_DIFFS).map(d => ({ key: d.key, name: d.name, desc: d.desc, checked: (g.difficulty || 'adaptive') === d.key })),
                chip: 'NOW ' + String(g.adaptiveTier || 'normal').toUpperCase(),
                note: (g.sheet && g.sheet.note) || '',
                // 2 Players' names: what was typed, and the default an empty one plays as.
                names: [0, 1].map(i => {
                    const n = (g.sheet && g.sheet.names && g.sheet.names[i]) || {};
                    return { value: String(n.value || ''), placeholder: n.placeholder || 'Player ' + (i + 1) };
                }),
                tour: g.tourSheet && g.tourSheet.saved ? { saved: true, cta: 'RESUME ' + String(g.tourSheet.name || 'TOURNAMENT').toUpperCase(), sub: g.tourSheet.where || '' }
                    : { saved: false, cta: 'SET UP TOURNAMENT', sub: '' },
                net: g.net || null,
            } : { show: false },
            invite: phInvite(g.net, sheetOpen),
            // Online: the React button and tray, and what each seat just said (a bubble under its card).
            react: { show: !!(g.net && g.net.inRoom) && !over, open: !!(g.net && g.net.inRoom && g.reactOpen) && !over },
            start: g.start && !over ? { show: true, label: g.start.label, sub: g.start.sub } : { show: false },
            said: [1, 2].map(seat => (g.net && g.net.inRoom && g.net.said && g.net.said[seat]) || ''),
            cueName: g.cueName || 'Standard', cues: g.cues || null,
            cueNew: g.cueNew && !sheetOpen && !toast && !phInvite(g.net, sheetOpen).show ? g.cueNew : null,
            // Snooker's parts; hidden for pool.
            track: { show: false }, chips: { show: false }, concede: { show: false },
        };
        return vm.game === 'snooker' ? phSnookerModel(g, vm) : vm;
    }

    // Online: the oldest invite, over the table, while the sheet (which lists them all) is shut.
    function phInvite(net, sheetOpen) {
        const i = net && !net.inRoom && !sheetOpen && net.invites && net.invites[0];
        if (!i) return { show: false };
        return { show: true, id: i.id, title: i.name + ' challenges you', text: (i.game === 'snooker' ? 'Snooker' : '8-Ball') + (i.bestOf > 1 ? ' · best of ' + i.bestOf : ' · one frame') };
    }
    const phEsc = v => String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    // The Online tab's status line: the connection, else why not, and the last challenge's news.
    function phNetStatus(n) {
        if (!n) return { text: '', tone: '' };
        const k = (n.players || []).length;
        const base = n.state === 'open' ? 'Connected · ' + (k ? k + (k === 1 ? ' player' : ' players') + ' online' : 'no one else online')
            : n.state === 'connecting' ? 'Connecting…' : n.err || (n.state === 'down' ? 'Reconnecting…' : 'Not connected');
        return { text: base + (n.note && n.state === 'open' ? ' · ' + n.note : ''), tone: n.state === 'open' ? 'ok' : n.err ? 'hot' : '' };
    }
    // The Online tab's body: in a match, a way out; else invites, your challenge, the players and
    // (only once there is someone to challenge) the match length.
    function phNetBodyHTML(n) {
        if (!n) return '';
        const btn = (act, id, label, cls, off) => '<button type="button" class="ph-btn' + (cls ? ' ' + cls : '') + '" data-ph-net="' + act + '"' +
            (id !== undefined ? ' data-id="' + phEsc(id) + '"' : '') + (off ? ' disabled' : '') + '>' + label + '</button>';
        const game = g => (g === 'snooker' ? 'Snooker' : '8-Ball');
        const len = b => (b > 1 ? 'best of ' + b : '1 frame');
        if (n.inRoom) return '<span class="ph-net-sub">In a match. Leaving concedes the frame.</span><div class="ph-sheet-links">' + btn('leave', undefined, 'Leave match', 'is-hot') + '</div>';
        if (n.state !== 'open') return '<span class="ph-net-sub">Enter the server address, then Connect.</span>';
        let h = '';
        if (n.invites.length) h += '<div class="ph-net-list">' + n.invites.map(i => '<div class="ph-net-row is-invite"><span class="ph-net-name">' + phEsc(i.name) +
            '<span class="ph-net-sub">' + game(i.game) + ' · ' + len(i.bestOf) + '</span></span>' +
            btn('accept', i.id, 'Accept', 'is-go') + btn('decline', i.id, 'Decline') + '</div>').join('') + '</div>';
        if (n.outgoing) h += '<div class="ph-net-row"><span class="ph-net-name">Challenge sent<span class="ph-net-sub">Waiting for ' + phEsc(n.outgoing) + '…</span></span>' + btn('cancel', undefined, 'Cancel') + '</div>';
        if (!n.players.length) return h + '<span class="ph-net-sub">Waiting for players. Others join from Game mode › Online with the same address.</span>';
        h += '<div class="ph-net-bo" role="radiogroup" aria-label="Match length"><span class="ph-sheet-l ph-label">MATCH · ' + game(n.game).toUpperCase() + '</span>' +
            [1, 3, 5].map(b => '<button type="button" role="radio" class="ph-btn" data-ph-net="bo" data-id="' + b + '" aria-checked="' + (n.bestOf === b ? 'true' : 'false') + '">' + (b > 1 ? 'Best of ' + b : '1 frame') + '</button>').join('') + '</div>';
        h += '<div class="ph-net-list">' + n.players.map(p => '<div class="ph-net-row"><span class="ph-net-name">' + phEsc(p.name) + (p.busy ? '<span class="ph-net-sub">In a match</span>' : '') + '</span>' +
            (p.busy ? '' : btn('challenge', p.id, 'Challenge', 'is-go', !!n.outgoing)) + '</div>').join('') + '</div>';
        return h;
    }

    // Snooker's parts over the shared model (see the file header).
    function phSnookerModel(g, vm) {
        const st = g.status, on = st.on || {}, f = g.frame;
        const over = g.phase === 'over', bih = g.phase === 'bih', aiming = g.phase === 'aim' || g.phase === 'strike';
        const max = g.layout === 'max', sheetOpen = !!(g.sheet && g.sheet.open), toast = g.toast || null, ch = g.choice || null;
        const nom = g.nom >= 0 ? g.nom : -1, seat = f.turn;
        vm.cards.forEach((c, i) => {
            const s = i + 1;
            let tag = '', hot = false;
            if (!over) {
                if (g.fouled === s) { tag = 'FOUL'; hot = true; }
                else if (ch && ch.chooser === s) tag = ch.cpu ? 'CHOOSING' : 'YOUR CHOICE';
                else if (c.active && bih) tag = f.isBreak ? 'TO BREAK' : 'BALL IN HAND';
                else if (c.active && c.hot) { tag = Math.ceil(g.clock.left) + 's'; hot = true; }
                else if (c.active && st.brk > 0) tag = 'BREAK ' + st.brk;
            }
            Object.assign(c, { tag, tagShort: '', tagHot: hot, score: String(st.scores ? st.scores[s] : 0), open: false, group: [], potted: [] });
        });
        // The tracker: reds, the six colours (the ball on ringed), and what is left to score.
        const need = !over && seat ? (st.snookersRequired || {})[seat] || 0 : 0;
        const ringId = over ? -1 : st.phase === 'clearance' || st.respotBlack ? st.next : nom;
        const left = (st.colours || []).filter(c => !c.down).map(c => phSnkName(c.id));
        vm.track = {
            show: true, reds: st.redsLeft || 0,
            dots: (st.colours || []).map(c => ({ id: c.id, down: c.down, on: c.id === ringId && !c.down })),
            snookers: need,
            concede: need > 0 && !g.cpuTurn && !g.handoff && (g.phase === 'aim' || g.phase === 'bih') && !g.confirm,
            rem: need ? st.remaining + ' LEFT' : (over ? 0 : st.remaining) + ' REMAINING',
            aria: 'Reds left ' + (st.redsLeft || 0) + ', colours ' + (left.length ? left.join(', ') : 'none') + ', ' + (over ? 0 : st.remaining) + ' points remaining' +
                (need ? '; ' + g.names[seat] + ' needs ' + need + (need > 1 ? ' snookers' : ' snooker') : ''),
        };
        let pill;
        if (bih) pill = f.isBreak ? 'Break-off · in the D' : st.respotBlack ? 'Re-spotted black' : 'Ball in hand · the D';
        else if (st.freeBall) pill = nom >= 0 ? 'Free ball · ' + phCap(phSnkName(nom)) : 'Free ball';
        else if (st.phase === 'colour') pill = nom >= 0 ? 'On the ' + phSnkName(nom) : 'Nominate a colour';
        else if (st.phase === 'reds') pill = 'On a red';
        else pill = 'On the ' + phSnkName(st.next);
        if (max && !bih) { const who = g.names[seat]; pill = (who === 'You' ? 'Your shot' : who + "'s shot") + ' · ' + pill; }
        vm.pill = { show: !toast && !over, text: pill };
        // Read out once a shot is over: what the shooter is on, the score, the tracker. Null
        // while balls run (the last reading stays), so a pot mid-shot does not interrupt.
        const settled = g.phase !== 'moving' && g.phase !== 'strike', sc = st.scores || { 1: 0, 2: 0 };
        vm.track.say = !settled ? null : (over ? 'Frame over' : pill) + '. ' + g.names[1] + ' ' + sc[1] + ', ' + g.names[2] + ' ' + sc[2] + '. ' + vm.track.aria + '.';
        // The chips: while a colour is to be nominated (the gauge padlocks until one is).
        const chips = aiming && !!on.needsNomination && !g.cpuTurn && !g.handoff && !toast && !sheetOpen && !vm.spin.open && !g.confirm;
        const pw = Math.round(g.power || 0);
        // Once a colour is nominated they fold to that chip and the caption; the chip reopens them.
        const folded = nom >= 0 && !g.chipsOpen, callNeeded = aiming && !!st.callRequired && !(g.called >= 0);
        vm.chips = chips ? {
            show: true, folded,
            label: folded ? (st.freeBall ? 'Free ball: the ' : 'Nominated: the ') + phSnkName(nom) + '. Press it to change' : st.freeBall ? 'Nominate the free ball' : 'Nominate a colour',
            items: PH_SNK.map(b => ({ id: b.id, name: b.name, live: (on.nominable || []).indexOf(b.id) >= 0, checked: nom === b.id })),
            caption: nom < 0 ? 'Tap a colour' : g.dragging ? 'Release · ' + pw + '%' : callNeeded ? 'Tap a pocket' : 'Drag to shoot',
            tone: nom < 0 ? '' : g.dragging ? (pw >= PH_POWER_HOT ? 'hot' : 'power') : callNeeded ? 'call' : 'set',
            // With a call to make, the folded chips carry the pocket map in 3D (2D taps the table).
            pad: folded && !!st.callRequired && g.camera === '3d', called: g.called >= 0 ? g.called : -1,
        } : { show: false };
        // The padlock: until a colour is nominated, and (pool's) until a pocket is called.
        vm.gauge = Object.assign({}, vm.gauge, { locked: vm.gauge.locked || (aiming && !!on.needsNomination && nom < 0) });
        // The chips hold the corner, and the call with them: no call card beside them.
        if (chips) vm.mini = Object.assign({}, vm.mini, { show: false });
        // The hint: the D, and none while the chips carry the caption.
        if (bih && !(g.bih && (g.bih.placed || g.bih.valid === false))) vm.hint = Object.assign({}, vm.hint, { text: 'Place in the D', tone: '' });
        if (chips) vm.hint = Object.assign({}, vm.hint, { show: false });
        // The choice after a foul: its buttons for a human chooser, once the seat is taken.
        if (vm.toast.show && ch) {
            const who = g.names[ch.chooser];
            vm.toast.chooser = who + ', choose how play continues';
            vm.toast.choices = !ch.cpu && !g.handoff ? ch.options.map((o, i) => ({ id: o.id, label: o.label, short: o.short, primary: i === 0 })) : [];
            if (g.handoff) vm.toast.sub = who + ' chooses how play continues';
        }
        // While the choice is open the lean slider steps aside for the toast's buttons.
        if (g.phase === 'choice') vm.lean = Object.assign({}, vm.lean, { show: false });
        const other = 3 - seat;
        vm.concede = g.confirm && seat ? { show: true, text: phWins(g.names[other]) + ' ' + st.scores[other] + '–' + st.scores[seat] } : { show: false };
        return vm;
    }

    // ── DOM ───────────────────────────────────────────────────────────
    const PH_ICON = {
        d2: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 12h16M12 4v16"></path></svg>',
        d3: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"></path><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"></path></svg>',
        warn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 16.5h-19L12 3z"></path><path d="M12 10v4M12 17.2v.1"></path></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8v.1"></path></svg>',
        up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"></path></svg>',
        down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>',
        lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>',
        trophy: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"></path></svg>',
        cross: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9 9l6 6M15 9l-6 6"></path></svg>',
        chip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"></path></svg>',
        people: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"></path><circle cx="17" cy="9" r="2.6"></circle><path d="M16 14.3c2.4.1 4 1.6 4.5 4.2"></path></svg>',
        reset: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path></svg>',
        max: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path></svg>',
        exit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"></path></svg>',
        swap: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"></path></svg>',
        hand: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L3.6 15a1.6 1.6 0 0 1 2.4-2l2 2"></path></svg>',
        bracket: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h5v5H3M3 14h5v5H3M8 7.5h4v9H8M12 12h4M16 9h5v6h-5z"></path></svg>',
        pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5v14M15 5v14"></path></svg>',
        close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
        cup: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"></path></svg>',
        flag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"></path><path d="M5 4h12l-2.5 4L17 12H5"></path></svg>',
        chat: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"></path><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"></path></svg>',
        net: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 9a14 14 0 0 1 19 0M5.8 12.6a9.2 9.2 0 0 1 12.4 0M9.1 16.2a4.4 4.4 0 0 1 5.8 0M12 19.6v.1"></path></svg>',
        cue: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20L16.5 7.5M15 6l3 3M17.6 4.4a1.4 1.4 0 0 1 2 2"></path></svg>',
    };

    // Online: the quick reactions in the React tray (a message is free text, up to 30 characters).
    const PH_REACTIONS = ['👍', '👏', '😂', '😮', '🔥', '😅', '😤', 'GG'];

    // ── The cue collection ────────────────────────────────────────────
    // Each cue's stroke icon: its achievement's (the design's), Standard's check, Collector's star.
    const PH_CUE_ICON = {
        standard: 'M5 12.5l4.5 4.5L19 7.5',
        tulipwood: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.5a3.2 3.2 0 0 1 0 6.2M18 14.8c2 .6 3.2 2.4 3.5 5.2',
        birdseye: 'M7 8h10a4 4 0 0 1 4 4v2.5a2.5 2.5 0 0 1-4.6 1.4L15 14H9l-1.4 1.9A2.5 2.5 0 0 1 3 14.5V12a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3M15.5 11.5h.01M17.5 13h.01',
        ember: 'M12 3c.8 3.2 5 5.2 5 10a5 5 0 0 1-10 0c0-2 .8-3.4 2-4.5.2 1.6 1 2.6 2.2 3C10.6 8.6 11.4 5.6 12 3z',
        rosewood6: 'M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6l7-3zM8.5 12.5L12 9l3.5 3.5M8.5 16L12 12.5l3.5 3.5',
        carbonfin: 'M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2-1.5 4.5-1.5S19 17 21 17M7 15.5C9 11 11.5 6.5 16 5c-1.2 3.3-1.5 7-.8 10.5',
        malachite: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9a4.5 4.5 0 0 0 0 9zM12 12.8a.8.8 0 1 0 0-1.6a.8.8 0 0 0 0 1.6z',
        centuryash: 'M8 3l2.5 5M16 3l-2.5 5M12 21a6 6 0 1 0 0-12a6 6 0 0 0 0 12zM10.5 13.5L12 12.5v5',
        crown: 'M4 18h16M5 18L3.5 8l5 4L12 6l3.5 6 5-4L19 18',
        collector: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7L12 3z',
        lock: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6.5 11h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-7A1.5 1.5 0 0 1 6.5 11z',
    };
    const phSvg = (d, n, w) => '<svg width="' + n + '" height="' + n + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"></path></svg>';
    const PH_BARS = ['Power', 'Aim', 'Spin', 'Time'];
    // m: poolCueModel(). The equipped cue up top (a close-up of its forearm, then all of it), then
    // every cue: its look, how it is earned, its four bars (filled to its level, outlined: what
    // the next level adds).
    function phCuesHTML(m) {
        const eq = m.list.find(c => c.eq) || m.list[0];
        const tick = phSvg(PH_CUE_ICON.standard, 13, 2.4);
        const bars = c => '<div class="ph-cue-bars">' + PH_BARS.map((b, i) => '<span class="ph-cue-bar" role="img" aria-label="' + b + ' ' + c.bars[i] + ' of 10' +
            (c.top[i] !== c.bars[i] ? ', ' + c.top[i] + ' at level ' + (c.level + 1) : '') + '"><span class="ph-label">' + b + '</span><span class="ph-cue-segs">' +
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => '<i' + (k < c.bars[i] ? ' class="on"' : k < c.top[i] ? ' class="up"' : '') + '></i>').join('') +
            '</span><span class="ph-num">' + c.bars[i] + '</span></span>').join('') + '</div>';
        const level = c => '<span class="ph-cue-lv">' + (c.level >= 5 ? 'Level 5 · mastered · ' + c.wins + ' wins' : 'Level ' + c.level + ' · ' + c.have + ' of ' + c.need + ' ' + c.counts + ' to level ' + (c.level + 1)) + '</span>';
        const card = c => '<div class="ph-cue-card' + (c.eq ? ' is-eq' : '') + (c.open ? '' : ' is-locked') + '" role="listitem" aria-label="' + c.name + ', ' +
            (c.eq ? 'equipped' : c.open ? 'unlocked' : 'locked. ' + c.cond) + '">' +
            '<canvas class="ph-cue-cv" data-cue="' + c.id + '" aria-hidden="true"></canvas>' +
            '<div class="ph-cue-row"><span class="ph-cue-icon">' + phSvg(PH_CUE_ICON[c.id], 17) + '</span>' +
            '<span class="ph-cue-t"><span class="ph-cue-n">' + c.name + (c.isNew ? '<span class="ph-cue-new ph-label">NEW</span>' : '') + '</span>' +
            '<span class="ph-cue-d">' + (c.open ? c.blurb : c.cond) + '</span></span>' +
            (c.eq ? '<span class="ph-cue-tag ph-label">' + tick + 'EQUIPPED</span>'
                : c.open ? '<button type="button" class="ph-btn ph-cue-eq" data-ph-equip="' + c.id + '" aria-label="Equip ' + c.name + '">Equip</button>'
                    : '<span class="ph-cue-tag is-lock ph-label">' + phSvg(PH_CUE_ICON.lock, 14, 2) + 'LOCKED</span>') + '</div>' +
            bars(c) + (c.open && c.id !== eq.id ? level(c) : '') + '</div>';
        return '<div class="ph-cues-head"><span class="ph-cues-t"><span class="ph-cues-title">Cue collection</span>' +
            '<span class="ph-cues-sub">' + (m.who ? m.who + '’s cue for this match · from your ' + m.open + ' unlocked' : m.open + ' of ' + m.list.length + ' unlocked · every shot you play, pool and snooker') + '</span></span>' +
            '<button type="button" class="ph-btn" data-ph-cuesx aria-label="Close the cue collection">' + PH_ICON.close + '</button></div>' +
            '<div class="ph-cues-list" role="list" aria-label="All cues">' +
            '<div class="ph-cue-card is-hero' + (m.just === eq.id ? ' is-just' : '') + '"><div class="ph-cue-row is-head"><span class="ph-cue-t"><span class="ph-cue-n">' + eq.name + '</span>' +
            '<span class="ph-cue-d">' + eq.blurb + '</span></span><span class="ph-cue-tag ph-label">' + tick + 'EQUIPPED</span></div>' +
            '<div class="ph-cue-show"><canvas class="ph-cue-cv is-detail" data-cue="' + eq.id + '" data-span="0.48,0.77" aria-hidden="true"></canvas>' +
            '<canvas class="ph-cue-cv is-full" data-cue="' + eq.id + '" aria-hidden="true"></canvas></div>' + bars(eq) + level(eq) +
            (m.just === eq.id ? '<span class="ph-cue-just" role="status">' + tick + eq.name + ' equipped · ' + (m.who ? m.who + '’s' : 'your') + ' next shot uses it</span>' : '') + '</div>' +
            m.list.map(card).join('') +
            '<div class="ph-cues-foot">The CPU plays a cue for its level: Easy Standard, Normal Tulipwood, Hard Malachite (Century Ash at snooker), Pro Black Crown.</div></div>';
    }
    // Draws every cue in the open collection at its canvas's size.
    function phCuesDraw(root, game) {
        const dpr = window.devicePixelRatio || 1, mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
        root.querySelectorAll('canvas[data-cue]').forEach(cv => {
            const w = cv.clientWidth, h = cv.clientHeight, span = (cv.getAttribute('data-span') || '0,1').split(',').map(Number);
            if (!w || !h) return;
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
            const c = cv.getContext('2d');
            c.setTransform(dpr, 0, 0, dpr, 0, 0);
            pqDrawFlat(c, pqById(cv.getAttribute('data-cue')), game, 10, h / 2, w - 20, span[0], span[1], null, mk);
        });
    }

    function phCardHTML(seat, max) {
        const top = '<div class="ph-card-top"><span class="ph-name" data-ph="name"></span>' +
            (max ? '<span class="ph-rec" data-ph="rec"></span>' : '<span class="ph-tag ph-label" data-ph="tag"></span>') + '</div>';
        const group = '<div class="ph-group" data-ph="group" role="img"></div><div class="ph-open" data-ph="open" role="img" aria-label="Open table"><span class="ph-open-l" data-ph="openl">Open table</span><span class="ph-open-balls" data-ph="openb"></span></div>';
        // Snooker's third line (its tag, or BREAK 34) and its score; hidden for pool.
        const l3 = '<span class="ph-l3 ph-label" data-ph="l3"></span>', score = '<span class="ph-score ph-num" data-ph="score"></span>';
        const body = max
            ? '<div class="ph-avatar" data-ph="avatar"></div><div class="ph-card-body">' + top + l3 + group + '</div>' + score
            : top + '<div class="ph-rec" data-ph="rec"></div>' + l3 + group + score;
        return '<div class="ph-card" data-seat="' + seat + '">' + body + '<div class="ph-clock" data-ph="clock"></div></div>';
    }
    // Snooker's tracker row: REDS × n, the colours, what is left, SNOOKERS REQ. n and Concede.
    function phTrackHTML() {
        return '<div class="ph-track" data-ph="track" hidden><span class="ph-track-reds ph-label"><i class="ph-track-red" data-ph="trred"></i><span data-ph="trreds"></span></span>' +
            '<span class="ph-track-dots" role="img" data-ph="trdots"></span><span class="ph-track-gap"></span>' +
            '<span class="ph-track-snk ph-label" data-ph="trsnk" hidden></span>' +
            '<button type="button" class="ph-track-concede" data-ph="trconcede" hidden>Concede</button>' +
            '<span class="ph-track-rem ph-label" data-ph="trrem"></span>' +
            '<span class="ph-sr" data-ph="trlive" aria-live="polite" aria-atomic="true"></span></div>';
    }

    const PH_CUES_ROOT = '<div class="ph-cues" role="dialog" aria-label="Cue collection" data-ph="cues" hidden></div>';
    function phViewHTML(max) {
        // The six pocket targets on a 52 × 26 table: the call card's, and the folded chips'.
        const pad = attr => [[0, 0], [26, 0], [52, 0], [0, 26], [26, 26], [52, 26]]
            .map((p, i) => '<button type="button" ' + attr + '="' + i + '" style="left:' + p[0] + 'px;top:' + p[1] + 'px" aria-label="Call ' + PH_POCKETS[i].toLowerCase() + ' pocket" aria-pressed="false"><span></span></button>')
            .join('');
        const mini = pad('data-ph-call');
        return '<div class="ph-view" data-ph="view"><canvas class="ph-canvas" data-ph="canvas"></canvas><div class="ph-layer">' +
            '<div class="ph-cam ph-glass" data-ph="cam"><button type="button" class="ph-label" data-ph="cam2d" aria-pressed="false">' + PH_ICON.d2 + '<span data-ph="cam2dl">2D</span></button>' +
            '<button type="button" class="ph-label" data-ph="cam3d" aria-pressed="true">' + PH_ICON.d3 + '<span data-ph="cam3dl">3D</span></button></div>' +
            '<div class="ph-pill ph-glass" data-ph="pill"><span class="ph-pill-dot"></span><span data-ph="pillt"></span></div>' +
            '<div class="ph-toast ph-glass" role="status" data-ph="toast" hidden><div class="ph-toast-row"><span class="ph-toast-icon" data-ph="toasti"></span>' +
            '<span class="ph-toast-text"><span class="ph-toast-title" data-ph="toastt"></span><span class="ph-toast-sub" data-ph="toasts"></span></span></div>' +
            '<div class="ph-toast-acts" role="group" data-ph="toastacts" hidden></div></div>' +
            '<div class="ph-lean ph-glass" data-ph="lean"><label class="ph-lean-l ph-label" for="ph-lean-' + (max ? 'm' : 'c') + '">LEAN</label>' +
            '<span class="ph-lean-v ph-num" data-ph="leanv"></span><span class="ph-lean-chev">' + PH_ICON.up + '</span>' +
            '<div class="ph-rng"><div class="ph-rng-track"></div><div class="ph-rng-fill" data-ph="leanf"></div><div class="ph-rng-thumb" data-ph="leant"></div>' +
            '<input id="ph-lean-' + (max ? 'm' : 'c') + '" type="range" min="0" max="100" step="1" data-ph="leani"></div>' +
            '<span class="ph-lean-chev">' + PH_ICON.down + '</span></div>' +
            '<div class="ph-gauge" data-ph="gauge" aria-hidden="true"><div class="ph-gauge-fill" data-ph="gaugef"></div></div>' +
            '<div class="ph-lock" data-ph="lock" hidden>' + PH_ICON.lock + '</div>' +
            '<button type="button" class="ph-spin ph-glass" data-ph="spin" aria-haspopup="dialog" aria-expanded="false"><span class="ph-spin-ball" data-ph="spinball"><span class="ph-spin-dot" data-ph="spind"></span></span>' +
            '<span class="ph-spin-text"><span class="ph-spin-l ph-label">SPIN</span><span class="ph-spin-v" data-ph="spinv"></span></span></button>' +
            // The big picker: drag the dot anywhere inside the miscue ring, or take a preset.
            '<div class="ph-spinpop ph-glass" data-ph="spinpop" role="dialog" aria-label="Cue ball spin" hidden>' +
            '<div class="ph-spinpop-read ph-num" data-ph="spinr"></div>' +
            '<div class="ph-spinpop-body"><div class="ph-spinpop-ball" data-ph="spinbig" tabindex="0" role="group" aria-label="Where the cue strikes the ball. Press or drag to set it; arrow keys move it, Enter confirms">' +
            '<span class="ph-spinpop-ring"></span><span class="ph-spin-dot" data-ph="spinbigd"></span></div>' +
            '<div class="ph-spinpop-chips">' + PH_SPINS.map((p, i) => '<button type="button" class="ph-btn" data-ph-tip="' + i + '" aria-pressed="false">' + p.label + '</button>').join('') + '</div></div>' +
            '</div>' +
            '<div class="ph-hint ph-glass" data-ph="hint"><span data-ph="hintt"></span></div>' +
            '<div class="ph-cuenew ph-glass" role="status" data-ph="cuenew" hidden><span class="ph-cuenew-i">' + PH_ICON.cue + '</span>' +
            '<span class="ph-cuenew-t"><span class="ph-label">NEW CUE</span><span data-ph="cuenewn"></span></span>' +
            '<button type="button" class="ph-btn" data-ph="cuenewgo">Equip</button><button type="button" class="ph-btn is-icon" data-ph="cuenewx" aria-label="Dismiss">' + PH_ICON.close + '</button></div>' +
            '<div class="ph-cuenew ph-invite ph-glass" role="alertdialog" aria-label="Online challenge" data-ph="invite" hidden><span class="ph-cuenew-i">' + PH_ICON.net + '</span>' +
            '<span class="ph-cuenew-t"><span class="ph-label" data-ph="invitek"></span><span data-ph="invitet"></span></span>' +
            '<button type="button" class="ph-btn" data-ph="invitego">Accept</button><button type="button" class="ph-btn is-icon" data-ph="invitex" aria-label="Decline">' + PH_ICON.close + '</button></div>' +
            '<div class="ph-bihnote ph-label" data-ph="bihnote" hidden></div>' +
            // Vs CPU: the table waits behind PLAY until it is pressed.
            '<div class="ph-scrim ph-start-scrim" data-ph="start" hidden><div class="ph-start"><button type="button" class="ph-primary ph-label ph-start-go" data-ph="startgo">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"></path></svg><span data-ph="startl">PLAY</span></button>' +
            '<span class="ph-start-sub" data-ph="startsub"></span></div></div>' +
            // Online: what each player just sent, under their card; the React tray.
            '<span class="ph-bubble" data-seat="1" data-ph="bubble1" role="status" aria-live="polite" hidden></span>' +
            '<span class="ph-bubble" data-seat="2" data-ph="bubble2" role="status" aria-live="polite" hidden></span>' +
            '<div class="ph-react ph-glass" role="dialog" aria-label="Send a reaction" data-ph="react" hidden>' +
            '<div class="ph-react-quick" role="group" aria-label="Quick reactions">' + PH_REACTIONS.map(r => '<button type="button" class="ph-react-q" data-ph-react="' + r + '">' + r + '</button>').join('') + '</div>' +
            '<form class="ph-react-form" data-ph="reactform"><input type="text" class="ph-react-in" maxlength="30" autocomplete="off" spellcheck="false" placeholder="Say something (30 max)" aria-label="Message, up to 30 characters" data-ph="reacti">' +
            '<button type="submit" class="ph-btn ph-react-send">Send</button></form></div>' +
            '<button type="button" class="ph-replace ph-glass" data-ph="replace" hidden>' + PH_ICON.hand + '<span>Move cue ball</span></button>' +
            '<div class="ph-mini ph-glass" data-ph="mini" hidden><span class="ph-mini-cap" data-ph="minicap"></span>' +
            '<div class="ph-mini-pad"><div class="ph-mini-table"></div>' + mini + '</div></div>' +
            // Snooker's colour chips: a 3 × 2 grid, each ball carrying its value.
            '<div class="ph-chips ph-glass" role="group" data-ph="chips" hidden><div class="ph-chips-grid" role="radiogroup" data-ph="chipgrid">' +
            PH_SNK.map(b => '<button type="button" role="radio" class="ph-chip" data-ph-nom="' + b.id + '" aria-checked="false" aria-label="' + phCap(b.name) + ', ' + b.id + ' points"><span>' + b.id + '</span></button>').join('') +
            '</div><span class="ph-chips-cap" data-ph="chipcap"></span>' +
            '<div class="ph-mini-pad ph-chips-pad" data-ph="chippad" hidden><div class="ph-mini-table"></div>' + pad('data-ph-ccall') + '</div></div>' +
            '<div class="ph-scrim" data-ph="scrim" hidden><div class="ph-dialog" role="dialog" aria-label="Frame over" data-ph="dialog">' +
            '<div class="ph-dialog-head"><span class="ph-dialog-icon" data-ph="dlgi"></span><span style="display:flex;flex-direction:column;gap:2px">' +
            '<span class="ph-dialog-kicker ph-label" data-ph="dlgk"></span><span class="ph-dialog-title" data-ph="dlgt"></span></span></div>' +
            '<div class="ph-dialog-reason" data-ph="dlgr"></div>' +
            '<div class="ph-dialog-stats" data-ph="dlgstats" hidden></div>' +
            '<div class="ph-dialog-rec" data-ph="dlgrec"><span style="display:flex;flex-direction:column;gap:2px"><span class="ph-dialog-rec-l ph-label" data-ph="dlgrl"></span>' +
            '<span class="ph-dialog-rec-v ph-num" data-ph="dlgrv"></span></span><span class="ph-dialog-delta ph-label" data-ph="dlgd"></span></div>' +
            '<div class="ph-dialog-note" data-ph="dlgn">' + PH_ICON.chip + '<span data-ph="dlgnt"></span></div>' +
            '<div class="ph-dialog-actions"><button type="button" class="ph-primary ph-label" data-ph="dlgp"></button><button type="button" class="ph-btn" data-ph="dlgs"></button></div>' +
            '</div></div>' +
            // Snooker: the concede question.
            '<div class="ph-scrim" data-ph="cscrim" hidden><div class="ph-dialog is-alert" role="alertdialog" aria-label="Concede the frame" data-ph="cdlg">' +
            '<span class="ph-dialog-icon">' + PH_ICON.flag + '</span>' +
            '<span class="ph-cdlg-t"><span class="ph-dialog-title">Concede the frame?</span><span class="ph-dialog-reason" data-ph="cdlgt"></span></span>' +
            '<div class="ph-dialog-actions"><button type="button" class="ph-primary ph-label is-hot" data-ph="cdlgy">CONCEDE</button><button type="button" class="ph-btn" data-ph="cdlgn">Keep playing</button></div>' +
            '</div></div>' +
            '</div></div>';
    }

    // The Game mode sheet: Vs CPU with the difficulty list, 2 Players with its names, or Tournament.
    function phSheetHTML() {
        const diffs = PH_DIFFS.map(d => '<button type="button" role="radio" class="ph-sheet-diff" data-ph-diff="' + d.key + '" aria-checked="false">' +
            '<span class="ph-sheet-radio"><span></span></span><span class="ph-sheet-dt"><span class="ph-sheet-dn"><span>' + d.name + '</span>' +
            // The NOW chip rides on the name line, so the description keeps the full width.
            (d.key === 'adaptive' ? '<span class="ph-sheet-chip ph-label" data-ph="sheetchip"></span>' : '') +
            '</span><span class="ph-sheet-dd">' + d.desc + '</span></span></button>').join('');
        return '<div class="ph-sheet-scrim" data-ph="sheetscrim" hidden></div>' +
            '<div class="ph-sheet" role="dialog" aria-label="Game mode" data-ph="sheet" hidden>' +
            '<div class="ph-sheet-head"><span class="ph-sheet-title">Game mode</span><button type="button" class="ph-btn is-icon" data-ph="sheetx" aria-label="Close">' + PH_ICON.close + '</button></div>' +
            '<div class="ph-sheet-modes" role="radiogroup" aria-label="Mode">' +
            '<button type="button" role="radio" class="ph-sheet-mode" data-ph-mode="cpu" aria-checked="false">' + PH_ICON.chip + '<span>Vs CPU</span></button>' +
            '<button type="button" role="radio" class="ph-sheet-mode" data-ph-mode="pvp" aria-checked="false">' + PH_ICON.people + '<span>2 Players</span></button>' +
            '<button type="button" role="radio" class="ph-sheet-mode" data-ph-mode="tour" aria-checked="false">' + PH_ICON.bracket + '<span>Tournament</span></button>' +
            '<button type="button" role="radio" class="ph-sheet-mode" data-ph-mode="net" aria-checked="false">' + PH_ICON.net + '<span>Online</span></button></div>' +
            '<div class="ph-sheet-cpu" data-ph="sheetcpu"><div class="ph-sheet-l ph-label">CPU DIFFICULTY</div>' +
            '<div class="ph-sheet-diffs" role="radiogroup" aria-label="CPU difficulty">' + diffs + '</div>' +
            '<div class="ph-sheet-note" data-ph="sheetnote" hidden></div></div>' +
            '<div class="ph-sheet-pvp" data-ph="sheettour" hidden><span>Knockout bracket for 3 to 16 people taking turns on this computer. Humans only, no CPU players.</span>' +
            '<button type="button" class="ph-primary ph-label is-two" data-ph="sheettourgo"><span data-ph="sheettourcta">SET UP TOURNAMENT</span><span class="ph-primary-sub" data-ph="sheettoursub"></span></button>' +
            '<div class="ph-sheet-links"><button type="button" class="ph-btn" data-ph="sheetcab">' + PH_ICON.cup + '<span>Trophy cabinet</span></button>' +
            '<button type="button" class="ph-btn is-hot" data-ph="sheetabandon" hidden><span>Abandon</span></button></div></div>' +
            '<div class="ph-sheet-pvp" data-ph="sheetpvp" hidden><span>Hot-seat on this computer. Hand the panel over after each turn; the game tells you whose shot it is.</span>' +
            '<div class="ph-sheet-names">' + [1, 2].map(seat => '<label class="ph-sheet-name"><span class="ph-sheet-l ph-label">PLAYER ' + seat + '</span>' +
                '<input type="text" class="ph-sheet-input" maxlength="16" autocomplete="off" spellcheck="false" data-ph="sheetp' + seat + '" aria-label="Player ' + seat + ' name"></label>').join('') + '</div>' +
            '<button type="button" class="ph-primary ph-label" data-ph="sheetstart">START 2-PLAYER FRAME</button></div>' +
            // Online: the server, its status, then what phNetBodyHTML lists.
            '<div class="ph-sheet-pvp ph-sheet-net" data-ph="sheetnet" hidden><div class="ph-net-srv"><label class="ph-sheet-name"><span class="ph-sheet-l ph-label">SERVER</span>' +
            '<input type="text" class="ph-sheet-input" maxlength="120" autocomplete="off" spellcheck="false" placeholder="e.g. 172.16.3.132" data-ph="sheetnetsrv" aria-label="Pool server address"></label>' +
            '<button type="button" class="ph-btn ph-net-go" data-ph="sheetnetgo">Connect</button></div>' +
            '<div class="ph-net-st" role="status" data-ph="sheetnetst"></div><div class="ph-net-body" data-ph="sheetnetbody"></div></div>' +
            '</div>';
    }

    // A tournament match: "CITY OPEN" over "Semi-final · race to 2", and a FRAME n pill.
    function phTourHeadHTML() {
        return '<div class="ph-tourhead" data-ph="tourhead" hidden><span class="ph-tourhead-t"><span class="ph-tourhead-k ph-label" data-ph="tourk"></span>' +
            '<span class="ph-tourhead-n" data-ph="tourn"></span></span><span class="ph-tourhead-f ph-label" data-ph="tourf"></span></div>';
    }

    function phHandoffHTML() {
        return '<div class="ph-handoff" data-ph="handoff" hidden><span class="ph-handoff-icon">' + PH_ICON.swap + '</span>' +
            '<span class="ph-handoff-text"><span class="ph-handoff-to" data-ph="hot"></span><span class="ph-handoff-from" data-ph="hof"></span></span>' +
            '<button type="button" class="ph-primary ph-label" data-ph="ready"></button></div>';
    }

    // on: the controller's handlers by name (poolOn in pool-game.js); a missing one is a no-op.
    function phBuild(root, opts) {
        const o = opts || {}, max = o.layout === 'max', on = o.on || {};
        const cards = phCardHTML(1, max) + '<div class="ph-frames"><span class="ph-frames-n" data-ph="frames">0–0</span><span class="ph-frames-l ph-label">FRAMES</span></div>' + phCardHTML(2, max);
        let html;
        if (max) {
            // The cue button rides beside the title (or a tournament's head), where there is room.
            html = '<div class="ph-top"><div class="ph-lead"><div class="ph-title" data-ph="title">' + (o.title || '8-Ball Pool') + '</div>' + phTourHeadHTML() +
                '<button type="button" class="ph-btn is-icon" data-ph="cue" aria-haspopup="dialog">' + PH_ICON.cue + '</button></div><div class="ph-cards">' + cards + '</div>' +
                '<div class="ph-actions"><span class="ph-trophy" data-ph="trophy">' + PH_ICON.cup + '<span class="ph-num" data-ph="trophies">0</span></span>' +
                '<button type="button" class="ph-btn" data-ph="mode" aria-haspopup="dialog">' + PH_ICON.people + '<span data-ph="model"></span></button>' +
                '<button type="button" class="ph-btn is-icon" data-ph="reset" aria-label="Reset rack" title="Reset rack">' + PH_ICON.reset + '</button>' +
                '<button type="button" class="ph-btn is-icon" data-ph="reactbtn" aria-haspopup="dialog" aria-label="React" title="React" hidden>' + PH_ICON.chat + '</button>' +
                '<button type="button" class="ph-btn" data-ph="bracket" hidden>' + PH_ICON.bracket + '<span>Bracket</span></button>' +
                '<button type="button" class="ph-btn is-icon" data-ph="pause" aria-label="Pause" title="Pause" hidden>' + PH_ICON.pause + '</button>' +
                '<button type="button" class="ph-btn is-icon" data-ph="max" aria-label="Exit full view" title="Exit full view">' + PH_ICON.exit + '</button></div></div>' +
                phTrackHTML() + phViewHTML(true) + phHandoffHTML() + phSheetHTML() + PH_CUES_ROOT;
        } else {
            html = phTourHeadHTML() + '<div class="ph-cards">' + cards + '</div>' + phTrackHTML() + phViewHTML(false) +
                '<div class="ph-foot" data-ph="foot">' +
                '<button type="button" class="ph-btn" data-ph="mode" aria-haspopup="dialog">' + PH_ICON.people + '<span data-ph="model"></span></button>' +
                '<button type="button" class="ph-btn" data-ph="reset">' + PH_ICON.reset + '<span>Reset</span></button>' +
                '<button type="button" class="ph-btn" data-ph="reactbtn" aria-haspopup="dialog" hidden>' + PH_ICON.chat + '<span>React</span></button>' +
                '<button type="button" class="ph-btn" data-ph="bracket" hidden>' + PH_ICON.bracket + '<span>Bracket</span></button>' +
                '<button type="button" class="ph-btn" data-ph="pause" hidden>' + PH_ICON.pause + '<span>Pause</span></button>' +
                '<button type="button" class="ph-btn" data-ph="max">' + PH_ICON.max + '<span>Max</span></button></div>' +
                phHandoffHTML() + phSheetHTML() + PH_CUES_ROOT;
        }
        const el = document.createElement('div');
        el.className = 'pool-hud';
        el.setAttribute('data-layout', max ? 'max' : 'compact');
        el.innerHTML = html;
        root.appendChild(el);

        const q = (sel, scope) => (scope || el).querySelector(sel);
        const ref = n => q('[data-ph="' + n + '"]');
        const hud = { el, layout: max ? 'max' : 'compact', last: {}, theme: null };
        ['view', 'canvas', 'frames', 'trophies', 'cam', 'cam2d', 'cam3d', 'cam2dl', 'cam3dl', 'pill', 'pillt', 'toast', 'toasti', 'toastt', 'toasts',
            'lean', 'leanv', 'leanf', 'leant', 'leani', 'gauge', 'gaugef', 'lock', 'spin', 'spind', 'spinv', 'spinball', 'spinpop', 'spinr', 'spinbig', 'spinbigd',
            'hint', 'hintt', 'bihnote', 'replace',
            'mini', 'minicap', 'scrim', 'dialog', 'dlgi', 'dlgk', 'dlgt', 'dlgr', 'dlgrec', 'dlgrl', 'dlgrv', 'dlgd', 'dlgn', 'dlgnt', 'dlgp', 'dlgs',
            'foot', 'mode', 'model', 'reset', 'max', 'handoff', 'hot', 'hof', 'ready',
            'sheet', 'sheetscrim', 'sheetx', 'sheetchip', 'sheetcpu', 'sheetpvp', 'sheetnote', 'sheetstart', 'sheetp1', 'sheetp2',
            'sheettour', 'sheettourgo', 'sheettourcta', 'sheettoursub', 'sheetcab', 'sheetabandon', 'bracket', 'pause', 'tourhead', 'tourk', 'tourn', 'tourf', 'title', 'trophy',
            'toastacts', 'track', 'trred', 'trreds', 'trdots', 'trsnk', 'trconcede', 'trrem', 'trlive', 'chips', 'chipgrid', 'chipcap', 'chippad', 'dlgstats', 'cscrim', 'cdlg', 'cdlgt', 'cdlgy', 'cdlgn',
            'cue', 'cues', 'cuenew', 'cuenewn', 'cuenewgo', 'cuenewx',
            'sheetnet', 'sheetnetsrv', 'sheetnetgo', 'sheetnetst', 'sheetnetbody', 'invite', 'invitek', 'invitet', 'invitego', 'invitex',
            'bubble1', 'bubble2', 'react', 'reactform', 'reacti', 'reactbtn', 'start', 'startgo', 'startl', 'startsub'].forEach(n => { hud[n] = ref(n); });
        if (o.canvas) { hud.canvas.replaceWith(o.canvas); o.canvas.classList.add('ph-canvas'); hud.canvas = o.canvas; }
        hud.cards = [1, 2].map(seat => {
            const c = q('.ph-card[data-seat="' + seat + '"]');
            const r = n => q('[data-ph="' + n + '"]', c);
            return { el: c, name: r('name'), tag: r('tag'), rec: r('rec'), group: r('group'), open: r('open'), openl: r('openl'), openb: r('openb'), clock: r('clock'), avatar: r('avatar'), l3: r('l3'), score: r('score'), dots: [] };
        });
        hud.miniButtons = Array.prototype.slice.call(el.querySelectorAll('[data-ph-call]'));

        const fire = (name, arg) => { if (typeof on[name] === 'function') on[name](arg); };
        hud.cam2d.addEventListener('click', () => fire('camera', '2d'));
        hud.cam3d.addEventListener('click', () => fire('camera', '3d'));
        hud.leani.addEventListener('input', e => fire('lean', +e.target.value));
        // Spin: dragging the small ball's dot moves the tip; a click (no drag) opens the big
        // picker, where a press puts the dot under the pointer at once. Both map the pointer
        // onto the ball face (radius R), clamped to the miscue ring.
        const tipAt = (el, e) => {
            const b = el.getBoundingClientRect(), r = b.width / 2 || 1;
            return phClampTip((e.clientX - b.left - r) / r, -(e.clientY - b.top - r) / r);
        };
        let spinDrag = null, spinDragged = false;
        const spinDown = (el, immediate) => e => {
            if (e.button) return;
            spinDrag = { el, x: e.clientX, y: e.clientY, moved: immediate };
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
            if (immediate) fire('tip', tipAt(el, e));
            e.preventDefault();
        };
        const spinMove = e => {
            if (!spinDrag || e.currentTarget !== spinDrag.el) return;
            if (!spinDrag.moved && Math.hypot(e.clientX - spinDrag.x, e.clientY - spinDrag.y) < 3) return;
            spinDrag.moved = true;
            fire('tip', tipAt(spinDrag.el, e));
        };
        const spinUp = e => {
            if (!spinDrag || e.currentTarget !== spinDrag.el) return;
            // A drag on the small ball is not also a click that opens the picker.
            spinDragged = spinDrag.moved && spinDrag.el === hud.spinball;
            // Letting go on the big ball is the choice: it confirms and closes.
            const big = spinDrag.el === hud.spinbig && e.type === 'pointerup';
            spinDrag = null;
            if (big) fire('spinClose');
        };
        [[hud.spinball, false], [hud.spinbig, true]].forEach(([el, now]) => {
            el.addEventListener('pointerdown', spinDown(el, now));
            el.addEventListener('pointermove', spinMove);
            el.addEventListener('pointerup', spinUp);
            el.addEventListener('pointercancel', spinUp);
        });
        hud.spin.addEventListener('click', () => { if (spinDragged) { spinDragged = false; return; } fire('spinToggle'); });
        hud.spinbig.addEventListener('keydown', e => {
            // Arrows nudge the tip; Enter (or Space) confirms, Esc closes: both keep the tip.
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { fire('spinClose'); hud.spin.focus(); e.preventDefault(); e.stopPropagation(); return; }
            const d = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
            if (!d) return;
            e.preventDefault(); e.stopPropagation();
            fire('tipStep', { x: d[0] * 0.05, y: d[1] * 0.05 });
        });
        hud.tipButtons = Array.prototype.slice.call(el.querySelectorAll('[data-ph-tip]'));
        hud.tipButtons.forEach(b => b.addEventListener('click', () => {
            const p = PH_SPINS[+b.getAttribute('data-ph-tip')];
            fire('tip', { x: p.x, y: p.y });
            fire('spinClose');
        }));
        hud.mode.addEventListener('click', () => fire('mode'));
        hud.reset.addEventListener('click', () => fire('reset'));
        hud.max.addEventListener('click', () => fire('max'));
        hud.ready.addEventListener('click', () => fire('ready'));
        hud.replace.addEventListener('click', () => fire('replace'));
        hud.dlgp.addEventListener('click', () => fire('primary'));
        hud.dlgs.addEventListener('click', () => fire('secondary'));
        hud.miniButtons.forEach(b => b.addEventListener('click', () => fire('call', +b.getAttribute('data-ph-call'))));
        // Snooker: the chips, the choice after a foul, Concede and its question.
        hud.chipButtons = Array.prototype.slice.call(el.querySelectorAll('[data-ph-nom]'));
        hud.chipButtons.forEach(b => {
            // The balls' colours are materials, the same in every theme.
            const id = +b.getAttribute('data-ph-nom'), s = b.firstChild;
            s.style.background = phDotStyle(id, 'snooker');
            s.style.color = phInkOn(pgBallLook('snooker', id).colour);
            b.addEventListener('click', () => fire('nominate', id));
        });
        hud.chipCallButtons = Array.prototype.slice.call(el.querySelectorAll('[data-ph-ccall]'));
        hud.chipCallButtons.forEach(b => b.addEventListener('click', () => fire('call', +b.getAttribute('data-ph-ccall'))));
        hud.toastacts.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ph-choose]'); if (b) fire('choose', b.getAttribute('data-ph-choose')); });
        hud.trconcede.addEventListener('click', () => fire('concede'));
        hud.cdlgy.addEventListener('click', () => fire('concedeYes'));
        hud.cdlgn.addEventListener('click', () => fire('concedeNo'));
        hud.cdlg.addEventListener('keydown', e => { if (e.key === 'Escape') { fire('concedeNo'); e.preventDefault(); e.stopPropagation(); } });
        // The Game mode sheet.
        hud.modeButtons = Array.prototype.slice.call(el.querySelectorAll('[data-ph-mode]'));
        hud.diffButtons = Array.prototype.slice.call(el.querySelectorAll('[data-ph-diff]'));
        hud.modeButtons.forEach(b => b.addEventListener('click', () => fire('sheetTab', b.getAttribute('data-ph-mode'))));
        hud.diffButtons.forEach(b => b.addEventListener('click', () => fire('difficulty', b.getAttribute('data-ph-diff'))));
        hud.sheetx.addEventListener('click', () => fire('sheetClose'));
        hud.sheetscrim.addEventListener('click', () => fire('sheetClose'));
        hud.sheetstart.addEventListener('click', () => fire('startPvp'));
        [1, 2].forEach(seat => {
            const inp = hud['sheetp' + seat];
            inp.addEventListener('input', () => fire('pvpName', { seat, value: inp.value }));
            // Enter in a name starts the frame, as the button does.
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') { fire('startPvp'); e.preventDefault(); } });
        });
        hud.sheettourgo.addEventListener('click', () => fire('tourGo'));
        hud.sheetcab.addEventListener('click', () => fire('tourCabinet'));
        hud.sheetabandon.addEventListener('click', () => fire('tourAbandon'));
        hud.bracket.addEventListener('click', () => fire('tourBracket'));
        hud.pause.addEventListener('click', () => fire('tourPause'));
        hud.sheet.addEventListener('keydown', e => { if (e.key === 'Escape') { fire('sheetClose'); hud.mode.focus(); e.preventDefault(); e.stopPropagation(); } });
        // The cue collection and the "New cue" notice.
        if (hud.cue) hud.cue.addEventListener('click', () => fire('cues'));
        hud.cues.addEventListener('click', e => {
            const t = e.target.closest && e.target.closest('[data-ph-equip], [data-ph-cuesx]');
            if (!t) return;
            if (t.hasAttribute('data-ph-cuesx')) fire('cuesClose'); else fire('cueEquip', t.getAttribute('data-ph-equip'));
        });
        hud.cues.addEventListener('keydown', e => { if (e.key === 'Escape') { fire('cuesClose'); e.preventDefault(); e.stopPropagation(); } });
        hud.cuenewgo.addEventListener('click', () => fire('cueEquip', hud.cueNewId));
        hud.cuenewx.addEventListener('click', () => fire('cueNewX'));
        // Online: the server field (Enter connects), Connect / Disconnect, the list's buttons, the invite.
        hud.sheetnetsrv.addEventListener('input', () => fire('netServer', hud.sheetnetsrv.value));
        hud.sheetnetsrv.addEventListener('keydown', e => { if (e.key === 'Enter') { fire('netServer', hud.sheetnetsrv.value); fire('netConnect'); e.preventDefault(); } });
        hud.sheetnetgo.addEventListener('click', () => fire(hud.netOn ? 'netDisconnect' : 'netConnect'));
        hud.sheetnetbody.addEventListener('click', e => {
            const b = e.target.closest && e.target.closest('[data-ph-net]');
            if (!b || b.disabled) return;
            const act = b.getAttribute('data-ph-net'), id = b.getAttribute('data-id');
            const map = { challenge: 'netChallenge', accept: 'netAccept', decline: 'netDecline', cancel: 'netCancel', leave: 'netLeave', bo: 'netBestOf' };
            if (map[act]) fire(map[act], act === 'bo' ? +id : id);
        });
        // Online reactions: the button, a quick one, or a message (Enter sends, Esc closes).
        hud.startgo.addEventListener('click', () => fire('start'));
        hud.reactbtn.addEventListener('click', () => fire('react'));
        hud.react.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ph-react]'); if (b) fire('reactSend', b.getAttribute('data-ph-react')); });
        hud.reactform.addEventListener('submit', e => { e.preventDefault(); const v = hud.reacti.value; hud.reacti.value = ''; fire('reactSend', v); });
        hud.reacti.addEventListener('keydown', e => { if (e.key === 'Escape') { fire('reactClose'); hud.reactbtn.focus(); e.preventDefault(); e.stopPropagation(); } });
        hud.invitego.addEventListener('click', () => fire('netAccept', hud.inviteId));
        hud.invitex.addEventListener('click', () => fire('netDecline', hud.inviteId));
        return hud;
    }

    // Writes only on change, so a 60 Hz render costs nothing when nothing moved.
    function phSet(hud, key, value, apply) {
        if (hud.last[key] === value) return;
        hud.last[key] = value;
        apply(value);
    }
    const phShow = (el, on) => { if (el) el.hidden = !on; };

    // Dark or light ink on a ball's colour: whichever reads better (WCAG relative luminance).
    function phInkOn(hex) {
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
        if (!m) return '#ffffff';
        const lin = v => { const c = parseInt(v, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        const L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
        return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#101214' : '#ffffff';
    }
    function phDotStyle(id, game) {
        const look = pgBallLook(game, id), c = look.colour;
        const hi = 'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0) 48%)';
        return look.stripe
            ? hi + ', linear-gradient(180deg, ' + PG_IVORY + ' 0%, ' + PG_IVORY + ' 28%, ' + c + ' 28%, ' + c + ' 72%, ' + PG_IVORY + ' 72%, ' + PG_IVORY + ' 100%)'
            : hi + ', ' + c;
    }

    function phRender(hud, vm) {
        const s = (k, v, f) => phSet(hud, k, v, f);
        s('game', vm.game, v => hud.el.setAttribute('data-game', v));
        if (hud.cue) s('cuel', vm.cueName, v => { hud.cue.title = 'Cue: ' + v; hud.cue.setAttribute('aria-label', 'Cue: ' + v + '. Open the cue collection'); });
        const iv = vm.invite || { show: false };
        s('invite', iv.show ? iv.id + '|' + iv.title + '|' + iv.text : '', () => {
            phShow(hud.invite, iv.show); hud.invitek.textContent = iv.show ? iv.title : ''; hud.invitet.textContent = iv.show ? iv.text : ''; hud.inviteId = iv.show ? iv.id : null;
        });
        s('cuenew', vm.cueNew, v => { phShow(hud.cuenew, !!v); hud.cuenewn.textContent = v ? pqById(v).name : ''; hud.cueNewId = v; });
        // The collection is rebuilt when its model changes (poolCueModel is cached until then).
        s('cues', vm.cues, m => {
            const was = !hud.cues.hidden;
            phShow(hud.cues, !!m);
            if (!m) { hud.cues.innerHTML = ''; return; }
            const top = hud.cues.querySelector('.ph-cues-list'), y = top ? top.scrollTop : 0;
            hud.cues.innerHTML = phCuesHTML(m);
            phCuesDraw(hud.cues, m.game);
            if (was) hud.cues.querySelector('.ph-cues-list').scrollTop = y; else hud.cues.querySelector('[data-ph-cuesx]').focus();
        });
        vm.cards.forEach((c, i) => {
            const r = hud.cards[i], k = 'c' + i + '.';
            s(k + 'name', c.name, v => { r.name.textContent = v; });
            s(k + 'rec', c.rec, v => { r.rec.textContent = v; });
            if (r.score) s(k + 'score', c.score || '', v => { r.score.textContent = v; });
            if (r.l3) {
                // The widget's column shows the short form (YOUR CHOICE → CHOICE) where there is one.
                s(k + 'l3', vm.game === 'snooker' ? c.tag : '', v => {
                    const sh = PH_SNK_SHORT[v];
                    r.l3.textContent = '';
                    if (!sh) { r.l3.textContent = v; return; }
                    const long = document.createElement('span'), short = document.createElement('span');
                    long.className = 'ph-l3-long'; long.textContent = v; short.className = 'ph-l3-short'; short.textContent = sh;
                    r.l3.append(long, short);
                });
                s(k + 'l3hot', !!c.tagHot, v => r.l3.classList.toggle('is-hot', v));
            }
            if (r.tag) {
                s(k + 'tag', c.tag + '|' + c.tagShort, () => {
                    r.tag.textContent = '';
                    if (!c.tagShort) { r.tag.textContent = c.tag; return; }
                    const long = document.createElement('span'), short = document.createElement('span');
                    long.className = 'ph-tag-long'; long.textContent = c.tag;
                    short.className = 'ph-tag-short'; short.textContent = c.tagShort;
                    r.tag.append(long, short);
                });
                s(k + 'tagHot', c.tagHot, v => r.tag.classList.toggle('is-hot', v));
                s(k + 'tagPulse', c.tagPulse, v => r.tag.classList.toggle('is-pulse', v));
                // A name cut off beside the tag gets the short tag (TO SHOOT → SHOOT); measured on change.
                s(k + 'fit', c.name + '|' + c.tag + '|' + hud.el.clientWidth, () => {
                    r.el.classList.remove('is-tight');
                    if (c.tagShort && r.name.scrollWidth > r.name.clientWidth + 1) r.el.classList.add('is-tight');
                });
            }
            if (r.avatar) s(k + 'avatar', c.cpu ? '' : c.initials, v => { r.avatar.innerHTML = c.cpu ? PH_ICON.chip : ''; if (!c.cpu) r.avatar.textContent = v; });
            s(k + 'active', c.active, v => r.el.classList.toggle('is-active', v));
            s(k + 'hot', c.hot, v => r.el.classList.toggle('is-hot', v));
            s(k + 'clock', c.clock, v => { r.clock.style.width = v + '%'; });
            s(k + 'open', c.open, v => { phShow(r.open, v); phShow(r.group, !v); });
            const ids = c.group.map(d => d.id).join();
            // A new group rebuilds the dots, each drawn potted or not, and resets the per-dot cache:
            // the old frame's values would match and skip the update, leaving a potted ball lit.
            s(k + 'ids', ids, () => {
                r.group.innerHTML = c.group.map(d => '<i class="ph-dot' + (d.down ? ' is-down' : '') + '" style="background:' + phDotStyle(d.id, vm.game) + '"></i>').join('');
                r.dots = Array.prototype.slice.call(r.group.children);
                for (let j = 0; j < 7; j++) delete hud.last[k + 'down' + j];
                c.group.forEach((d, j) => { hud.last[k + 'down' + j] = d.down; });
            });
            // For screen readers, and anyone who can't tell the colours apart: left and down, by number.
            const left = c.group.filter(d => !d.down).map(d => d.id), gone = c.group.filter(d => d.down).map(d => d.id);
            s(k + 'grpLabel', c.group.length ? (c.group[0].id < 8 ? 'Solids' : 'Stripes') + ': ' + (left.length ? left.join(', ') + ' on the table' : 'all down') + (gone.length ? '; ' + gone.join(', ') + ' potted' : '') : '',
                v => r.group.setAttribute('aria-label', v));
            s(k + 'openLabel', c.potted.length ? 'Open table; potted ' + c.potted.join(', ') : 'Open table', v => r.open.setAttribute('aria-label', v));
            s(k + 'openl', c.potted.length ? (c.potted.length > 3 ? '' : 'Potted') : 'Open table', v => { r.openl.textContent = v; phShow(r.openl, !!v); });
            s(k + 'openb', c.potted.join(), () => { r.openb.innerHTML = c.potted.map(id => '<i class="ph-dot" style="background:' + phDotStyle(id, vm.game) + '"></i>').join(''); });
            c.group.forEach((d, j) => s(k + 'down' + j, d.down, v => r.dots[j] && r.dots[j].classList.toggle('is-down', v)));
        });
        s('frames', vm.frames, v => { hud.frames.textContent = v; });
        if (hud.trophies) s('trophies', vm.trophies, v => { hud.trophies.textContent = v; });

        s('cam.show', vm.cam.show, v => phShow(hud.cam, v));
        s('cam.is3d', vm.cam.is3d, v => {
            hud.cam3d.setAttribute('aria-pressed', v ? 'true' : 'false');
            hud.cam2d.setAttribute('aria-pressed', v ? 'false' : 'true');
            hud.view.classList.toggle('is-2d', !v);
        });
        // "2D · AUTO": the suffix is its own span, so a narrow panel can drop it.
        s('cam.l2', vm.cam.label2d, v => {
            const i = v.indexOf(' · ');
            hud.cam2dl.textContent = i === -1 ? v : v.slice(0, i);
            if (i !== -1) { const more = document.createElement('span'); more.className = 'ph-cam-more'; more.textContent = v.slice(i); hud.cam2dl.appendChild(more); }
        });
        s('cam.l3', vm.cam.label3d, v => { hud.cam3dl.textContent = v; });
        s('pill.show', vm.pill.show, v => phShow(hud.pill, v));
        s('pill.text', vm.pill.text, v => { hud.pillt.textContent = v; });

        s('toast.show', vm.toast.show, v => phShow(hud.toast, v));
        if (vm.toast.show) {
            s('toast.foul', vm.toast.foul + '|' + (vm.toast.icon || ''), () => {
                hud.toast.classList.toggle('is-foul', vm.toast.foul);
                hud.toasti.innerHTML = vm.toast.foul ? PH_ICON.warn : vm.toast.icon === 'trophy' ? PH_ICON.cup : PH_ICON.info;
            });
            s('toast.title', vm.toast.title, v => { hud.toastt.textContent = v; });
            s('toast.sub', vm.toast.sub || '', v => { hud.toasts.textContent = v; });
        }
        // The choice after a foul (snooker): 44 px buttons, the first primary. A long label
        // ("Make Ayesha play again") falls back to its short form when the row would overflow.
        const acts = vm.toast.show ? vm.toast.choices || [] : [];
        s('toast.acts', acts.map(a => a.id + ':' + a.label).join('|') + '|' + (vm.toast.chooser || ''), () => {
            hud.toastacts.innerHTML = acts.map(a => '<button type="button" data-ph-choose="' + a.id + '" class="' + (a.primary ? 'ph-primary' : 'ph-btn') + (a.label.length > 12 ? ' is-grow' : '') + '">' +
                '<span class="ph-act-l">' + a.label + '</span><span class="ph-act-s">' + (a.short || a.label) + '</span></button>').join('');
            hud.toastacts.setAttribute('aria-label', vm.toast.chooser || 'Choose how play continues');
            phShow(hud.toastacts, acts.length > 0);
            delete hud.last['toast.fit'];
        });
        if (acts.length) s('toast.fit', hud.el.clientWidth, () => {
            hud.toastacts.classList.remove('is-tight');
            if (hud.toastacts.scrollWidth > hud.toastacts.clientWidth + 1) hud.toastacts.classList.add('is-tight');
        });

        // Snooker's tracker row.
        const tr = vm.track;
        s('track.show', !!tr.show, v => phShow(hud.track, v));
        if (tr.show) {
            s('track.reds', tr.reds, v => { hud.trreds.innerHTML = '<span class="ph-track-word">REDS </span>× ' + v; hud.trreds.setAttribute('aria-hidden', 'true'); hud.trred.classList.toggle('is-down', !v); });
            s('track.redc', 1, () => { hud.trred.style.background = phDotStyle(8, 'snooker'); });
            s('track.dots', tr.dots.map(d => d.id + (d.down ? 'd' : '') + (d.on ? 'o' : '')).join(), () => {
                hud.trdots.innerHTML = tr.dots.map(d => '<i class="ph-track-dot' + (d.down ? ' is-down' : '') + (d.on ? ' is-on' : '') + '" style="background:' + phDotStyle(d.id, 'snooker') + '"></i>').join('');
            });
            s('track.aria', tr.aria, v => hud.trdots.setAttribute('aria-label', v));
            s('track.snk', tr.snookers, v => { phShow(hud.trsnk, v > 0); hud.trsnk.textContent = 'SNOOKERS REQ. ' + v; hud.track.classList.toggle('is-snk', v > 0); });
            s('track.concede', !!tr.concede, v => phShow(hud.trconcede, v));
            s('track.rem', tr.rem, v => { hud.trrem.textContent = v; });
            if (tr.say !== null && tr.say !== undefined) s('track.say', tr.say, v => { hud.trlive.textContent = v; });
        }
        // Snooker's colour chips.
        const ch = vm.chips;
        s('chips.show', !!ch.show, v => { phShow(hud.chips, v); hud.view.classList.toggle('is-nominating', v); });
        s('chips.fold', !!(ch.show && ch.folded), v => { hud.chips.toggleAttribute('data-fold', v); hud.view.classList.toggle('is-nomfold', v); });
        s('chips.pad', !!(ch.show && ch.pad), v => { phShow(hud.chippad, v); hud.chips.toggleAttribute('data-pad', v); hud.view.classList.toggle('is-nompad', v); });
        s('maxbars', !!vm.maxBars, v => hud.el.toggleAttribute('data-bars', v));
        if (ch.show) {
            s('chips.label', ch.label, v => { hud.chips.setAttribute('aria-label', v); hud.chipgrid.setAttribute('aria-label', v); });
            s('chips.state', ch.items.map(it => (it.live ? 1 : 0) + '' + (it.checked ? 1 : 0)).join(''), () => hud.chipButtons.forEach((b, i) => {
                const it = ch.items[i];
                b.disabled = !it.live;
                b.setAttribute('aria-checked', it.checked ? 'true' : 'false');
            }));
            s('chips.cap', ch.caption, v => { hud.chipcap.textContent = v; });
            s('chips.called', ch.called === undefined ? -1 : ch.called, v => hud.chipCallButtons.forEach((b, i) => b.setAttribute('aria-pressed', i === v ? 'true' : 'false')));
            s('chips.tone', ch.tone || '', v => { hud.chips.className = 'ph-chips ph-glass' + (v ? ' is-' + v : ''); });
        }
        const cq = vm.concede;
        s('concede.show', !!cq.show, v => phShow(hud.cscrim, v));
        if (cq.show) s('concede.text', cq.text, v => { hud.cdlgt.textContent = v; });

        s('lean.show', vm.lean.show, v => phShow(hud.lean, v));
        s('lean.value', vm.lean.value, v => {
            if (+hud.leani.value !== v) hud.leani.value = v;
            hud.leanf.style.height = v + '%';
            hud.leant.style.bottom = v + '%';
        });
        s('lean.label', vm.lean.label, v => { hud.leanv.textContent = v; hud.leani.setAttribute('aria-valuetext', v + ' camera pitch'); });

        s('gauge.show', vm.gauge.show, v => phShow(hud.gauge, v));
        s('gauge.power', vm.gauge.power, v => { hud.gaugef.style.height = v + '%'; });
        s('gauge.live', vm.gauge.live, v => hud.gauge.classList.toggle('is-live', v));
        s('gauge.hot', vm.gauge.hot, v => hud.gauge.classList.toggle('is-hot', v));
        s('gauge.locked', vm.gauge.locked, v => { hud.gauge.classList.toggle('is-locked', v); phShow(hud.lock, v); });

        s('spin.show', vm.spin.show, v => phShow(hud.spin, v));
        s('spin.label', vm.spin.label, v => {
            // "Follow · Right"; the narrow column shows "Follow R" (the dot shows the rest).
            const i = v.indexOf(' · ');
            hud.spinv.textContent = i === -1 ? v : v.slice(0, i);
            if (i !== -1) {
                const side = v.slice(i + 3), long = document.createElement('span'), short = document.createElement('span');
                long.className = 'ph-spin-side'; long.textContent = ' · ' + side;
                short.className = 'ph-spin-side-s'; short.textContent = ' ' + side[0];
                hud.spinv.append(long, short);
            }
            hud.spin.setAttribute('aria-label', 'Cue ball spin: ' + vm.spin.readout + '. Drag the dot, or open the spin picker');
        });
        // The dot sits where the tip strikes, on a face whose radius is R: follow is above centre.
        s('spin.pos', vm.spin.x.toFixed(4) + ',' + vm.spin.y.toFixed(4), () => {
            [hud.spind, hud.spinbigd].forEach(d => { d.style.left = (50 + vm.spin.x * 50) + '%'; d.style.top = (50 - vm.spin.y * 50) + '%'; });
        });
        s('spin.open', vm.spin.open, v => { phShow(hud.spinpop, v); hud.spin.setAttribute('aria-expanded', v ? 'true' : 'false'); hud.spin.classList.toggle('is-open', v); });
        s('spin.read', vm.spin.readout, v => { hud.spinr.textContent = v; });
        s('spin.preset', vm.spin.preset, v => hud.tipButtons.forEach((b, i) => b.setAttribute('aria-pressed', i === v ? 'true' : 'false')));

        s('hint.show', vm.hint.show, v => phShow(hud.hint, v));
        s('hint.text', vm.hint.text, v => { hud.hintt.textContent = v; });
        s('hint.tone', vm.hint.tone, v => { hud.hint.className = 'ph-hint ph-glass' + (v ? ' is-' + v : ''); });

        s('bih.show', vm.bihNote.show, v => phShow(hud.bihnote, v));
        if (vm.bihNote.show) {
            s('bih.text', vm.bihNote.text, v => { hud.bihnote.textContent = v; });
            s('bih.pos', vm.bihNote.x.toFixed(1) + ',' + vm.bihNote.y.toFixed(1), () => { hud.bihnote.style.left = vm.bihNote.x + 'px'; hud.bihnote.style.top = vm.bihNote.y + 'px'; });
        }

        s('replace.show', vm.replace.show, v => phShow(hud.replace, v));

        // While the call card holds the corner, the gauge steps up and Move cue ball goes left.
        s('mini.show', vm.mini.show, v => { phShow(hud.mini, v); hud.view.classList.toggle('is-calling', v); });
        s('mini.cap', vm.mini.caption || '', v => { hud.minicap.textContent = v; });
        s('mini.tone', vm.mini.tone || '', v => { hud.mini.className = 'ph-mini ph-glass' + (v ? ' is-' + v : ''); });
        s('mini.called', vm.mini.called, v => hud.miniButtons.forEach((b, i) => b.setAttribute('aria-pressed', i === v ? 'true' : 'false')));

        s('dlg.show', vm.dialog.show, v => phShow(hud.scrim, v));
        if (vm.dialog.show) {
            const d = vm.dialog;
            s('dlg.win', d.win, v => { hud.dialog.classList.toggle('is-loss', v === false); hud.dlgi.innerHTML = v === false ? PH_ICON.cross : PH_ICON.trophy; });
            s('dlg.kicker', d.kicker, v => { hud.dlgk.textContent = v; });
            s('dlg.title', d.title, v => { hud.dlgt.textContent = v; });
            s('dlg.reason', d.reason || '', v => { hud.dlgr.textContent = v; });
            // Snooker: SCORE 72–41 and HIGH BREAK 58 · You, two up.
            s('dlg.stats', JSON.stringify(d.stats || null), () => {
                const st = d.stats || [];
                hud.dlgstats.innerHTML = st.map(x => '<div class="ph-dialog-stat"><span class="ph-dialog-stat-l ph-label">' + x.label + '</span><span class="ph-dialog-stat-v ph-num">' + x.value + '</span></div>').join('');
                phShow(hud.dlgstats, st.length > 0);
            });
            s('dlg.rec', !!d.record, v => phShow(hud.dlgrec, v));
            s('dlg.recl', d.recordLabel || '', v => { hud.dlgrl.textContent = v; });
            s('dlg.recv', d.record || '', v => { hud.dlgrv.textContent = v; });
            s('dlg.delta', d.delta || '', v => { hud.dlgd.textContent = v; });
            s('dlg.note', d.note || '', v => { hud.dlgnt.textContent = v; phShow(hud.dlgn, !!v); });
            s('dlg.p', d.primary, v => { hud.dlgp.textContent = v; });
            s('dlg.s', d.secondary, v => { hud.dlgs.textContent = v; });
        }

        if (hud.foot) s('foot.show', vm.foot.show, v => phShow(hud.foot, v));
        // In a tournament match: Bracket / Pause in place of the mode and Reset.
        // Online: no Reset (a rack is the room's), the mode button leads to the Online tab.
        s('foot.tour', vm.foot.tour + '|' + !!vm.foot.net, () => { const v = vm.foot.tour; phShow(hud.mode, !v); phShow(hud.reset, !v && !vm.foot.net); phShow(hud.bracket, v); phShow(hud.pause, v); if (hud.trophy) phShow(hud.trophy, !v); });
        const st = vm.start || { show: false };
        s('start.show', !!st.show, v => phShow(hud.start, v));
        if (st.show) {
            s('start.label', st.label, v => { hud.startl.textContent = v; });
            s('start.sub', st.sub, v => { hud.startsub.textContent = v; hud.startgo.setAttribute('aria-label', st.label.charAt(0) + st.label.slice(1).toLowerCase() + ': ' + v); });
        }
        const rx = vm.react || { show: false, open: false };
        s('react.show', !!rx.show, v => phShow(hud.reactbtn, v));
        s('react.open', !!rx.open, v => {
            phShow(hud.react, v); hud.reactbtn.setAttribute('aria-expanded', v ? 'true' : 'false'); hud.reactbtn.classList.toggle('is-open', v);
            if (v) hud.reacti.focus();
        });
        (vm.said || []).forEach((t, i) => s('said' + i, t, v => { const b = hud['bubble' + (i + 1)]; b.textContent = v; phShow(b, !!v); }));
        s('title', vm.title, v => { if (hud.title) hud.title.textContent = v; });
        s('tour.show', vm.tour.show, v => { phShow(hud.tourhead, v); if (hud.title) phShow(hud.title, !v); });
        if (vm.tour.show) {
            s('tour.k', vm.tour.kicker, v => { hud.tourk.textContent = v; });
            s('tour.n', vm.tour.title, v => { hud.tourn.textContent = v; });
            s('tour.f', vm.tour.frame, v => { hud.tourf.textContent = v; });
        }
        s('foot.mode', vm.foot.modeLabel, v => { hud.model.textContent = v; });
        const sh = vm.sheet;
        s('sheet.show', sh.show, v => { phShow(hud.sheet, v); phShow(hud.sheetscrim, v); hud.mode.setAttribute('aria-expanded', v ? 'true' : 'false'); });
        if (sh.show) {
            s('sheet.mode', sh.mode, v => {
                hud.modeButtons.forEach(b => b.setAttribute('aria-checked', b.getAttribute('data-ph-mode') === v ? 'true' : 'false'));
                phShow(hud.sheetcpu, v === 'cpu'); phShow(hud.sheetpvp, v === 'pvp'); phShow(hud.sheettour, v === 'tour'); phShow(hud.sheetnet, v === 'net');
            });
            const nt = sh.net;
            if (nt && sh.mode === 'net') {
                // The field is never written back under the caret.
                s('sheet.netsrv', nt.server, v => { if (hud.sheetnetsrv.ownerDocument.activeElement !== hud.sheetnetsrv) hud.sheetnetsrv.value = v; });
                s('sheet.netgo', nt.state === 'off' ? 'Connect' : 'Disconnect', v => { hud.sheetnetgo.textContent = v; hud.netOn = v === 'Disconnect'; });
                const st = phNetStatus(nt);
                s('sheet.netst', st.text + '|' + st.tone, () => { hud.sheetnetst.textContent = st.text; hud.sheetnetst.className = 'ph-net-st' + (st.tone ? ' is-' + st.tone : ''); });
                s('sheet.netbody', JSON.stringify([nt.state, nt.inRoom, nt.invites, nt.outgoing, nt.players, nt.bestOf, nt.game]), () => { hud.sheetnetbody.innerHTML = phNetBodyHTML(nt); });
            }
            // The list is built once; its words follow the game being played.
            s('sheet.words', sh.diffs.map(d => d.name + '|' + d.desc).join(';'), () => hud.diffButtons.forEach((b, i) => {
                const d = sh.diffs[i];
                if (!d) return;
                const n = b.querySelector('.ph-sheet-dn > span'), dd = b.querySelector('.ph-sheet-dd');
                if (n) n.textContent = d.name;
                if (dd) dd.textContent = d.desc;
            }));
            s('sheet.diff', sh.diffs.map(d => d.checked ? 1 : 0).join(''), () => hud.diffButtons.forEach((b, i) => b.setAttribute('aria-checked', sh.diffs[i].checked ? 'true' : 'false')));
            s('sheet.chip', sh.chip, v => { hud.sheetchip.textContent = v; });
            s('sheet.note', sh.note, v => { hud.sheetnote.textContent = v; phShow(hud.sheetnote, !!v); });
            // A name being typed is never written back under the caret.
            sh.names.forEach((n, i) => {
                const inp = hud['sheetp' + (i + 1)];
                if (!inp) return;
                s('sheet.p' + i, n.value, v => { if (inp.ownerDocument.activeElement !== inp) inp.value = v; });
                s('sheet.ph' + i, n.placeholder, v => { inp.placeholder = v; });
            });
            s('sheet.tour', sh.tour.cta + '|' + sh.tour.sub + '|' + sh.tour.saved, () => {
                hud.sheettourcta.textContent = sh.tour.cta; hud.sheettoursub.textContent = sh.tour.sub; phShow(hud.sheettoursub, !!sh.tour.sub); phShow(hud.sheetabandon, sh.tour.saved);
            });
        }
        s('ho.show', vm.handoff.show, v => phShow(hud.handoff, v));
        if (vm.handoff.show) {
            s('ho.to', vm.handoff.to, v => { hud.hot.textContent = v; });
            s('ho.from', vm.handoff.from, v => { hud.hof.textContent = v; });
            s('ho.ready', vm.handoff.ready, v => {
                hud.ready.textContent = '';
                const long = document.createElement('span'), short = document.createElement('span');
                long.className = 'ph-ready-long'; long.textContent = v;
                short.className = 'ph-ready-short'; short.textContent = 'READY';
                hud.ready.append(long, short);
            });
            // When a name would be cut off, the button says READY alone (the line beside names them).
            s('ho.fit', vm.handoff.to + '|' + vm.handoff.ready + '|' + hud.el.clientWidth, () => {
                hud.handoff.classList.remove('is-tight');
                if (hud.hot.scrollWidth > hud.hot.clientWidth + 1 || hud.hof.scrollWidth > hud.hof.clientWidth + 1) hud.handoff.classList.add('is-tight');
            });
        }
        s('cursor', vm.cursor, v => {
            hud.canvas.classList.toggle('is-dragging', v === 'dragging');
            hud.canvas.classList.toggle('is-placing', v === 'placing');
        });
        // A prompt waiting on the player (the chips before a colour, the call card before a
        // pocket) stays up; everything else gets out of the way of the shot.
        phShy(hud, vm.shot, { chips: !!(vm.chips.show && !vm.chips.folded), mini: !!(vm.mini.show && vm.mini.called < 0) });
    }

    // ── Out of the way of the shot ────────────────────────────────────
    // At snooker's true scale the corner overlays cover pockets and balls. While the shot (aim
    // line, object ball's path, contact, target pocket) passes under one, it gets data-shy and
    // pool-theme.css fades it (in 3D, back under the pointer). Max keeps its corner overlays in
    // bars above and below the table, so there it only ever touches the lean slider.
    const PH_SHY = ['cam', 'pill', 'lean', 'spin', 'hint', 'mini', 'chips', 'replace'];
    const PH_SHY_PAD = 6;
    // Does the segment (x0, y0)–(x1, y1) cross the box { l, t, r, b }? (Liang–Barsky)
    function phSegInBox(x0, y0, x1, y1, q) {
        const dx = x1 - x0, dy = y1 - y0, p = [-dx, dx, -dy, dy], d = [x0 - q.l, q.r - x0, y0 - q.t, q.b - y0];
        let t0 = 0, t1 = 1;
        for (let i = 0; i < 4; i++) {
            if (p[i] === 0) { if (d[i] < 0) return false; continue; }
            const t = d[i] / p[i];
            if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
            else { if (t < t0) return false; if (t < t1) t1 = t; }
        }
        return true;
    }
    // Pure: the names of the boxes ({ name: { x, y, w, h } }) the shot passes under.
    function phShyHits(shot, rects, pad) {
        if (!shot) return [];
        pad = pad === undefined ? PH_SHY_PAD : pad;
        return Object.keys(rects).filter(n => {
            const r = rects[n], q = { l: r.x - pad, t: r.y - pad, r: r.x + r.w + pad, b: r.y + r.h + pad };
            return shot.segs.some(s => phSegInBox(s[0], s[1], s[2], s[3], q)) ||
                shot.dots.some(c => Math.hypot(c[0] - Math.max(q.l, Math.min(q.r, c[0])), c[1] - Math.max(q.t, Math.min(q.b, c[1]))) < c[2]);
        });
    }
    function phShy(hud, shot, keep) {
        const on = {};
        if (shot && hud.view) {
            // In canvas pixels, as the shot is (Max's canvas sits under its top bar; Max may be scaled).
            const vr = hud.canvas.getBoundingClientRect(), k = vr.width / (hud.canvas.clientWidth || vr.width || 1) || 1, rects = {};
            PH_SHY.forEach(n => {
                const el = hud[n];
                if (!el || el.hidden || (keep && keep[n])) return;
                const r = el.getBoundingClientRect();
                if (r.width && r.height) rects[n] = { x: (r.left - vr.left) / k, y: (r.top - vr.top) / k, w: r.width / k, h: r.height / k };
            });
            phShyHits(shot, rects).forEach(n => { on[n] = true; });
        }
        PH_SHY.forEach(n => { const el = hud[n]; if (el && el.hasAttribute('data-shy') !== !!on[n]) el.toggleAttribute('data-shy', !!on[n]); });
    }

    // ── Canvas bridge ─────────────────────────────────────────────────
    // The renderer's theme colours, from the HUD's computed --pool-* values as #rrggbb.
    // Cached until phThemeChanged(), which the host calls on every theme or colour change.
    function phColour(css, fallback) {
        const v = String(css || '').trim();
        let m = /^#([0-9a-f]{3})$/i.exec(v);
        if (m) return '#' + m[1].split('').map(c => c + c).join('').toLowerCase();
        m = /^#([0-9a-f]{6})/i.exec(v);
        if (m) return '#' + m[1].toLowerCase();
        m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
        if (m) return '#' + [m[1], m[2], m[3]].map(x => Math.max(0, Math.min(255, Math.round(+x))).toString(16).padStart(2, '0')).join('');
        return fallback;
    }

    function phThemeTokens(hud) {
        if (hud.theme) return hud.theme;
        const cs = getComputedStyle(hud.el);
        const read = n => cs.getPropertyValue(n).trim();
        hud.theme = {
            accent: phColour(read('--pool-felt-accent'), PG_THEME.accent),
            hot: phColour(read('--pool-hot'), PG_THEME.hot),
            font: read('--pool-canvas-font') || PG_THEME.font,
        };
        return hud.theme;
    }

    function phThemeChanged(hud) { if (hud) hud.theme = null; }
