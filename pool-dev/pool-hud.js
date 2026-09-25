    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — HUD (v2)
    // ═══════════════════════════════════════════════════════════════════
    // The panel around the table, from the design's Main, InMatch and Max
    // artboards: player cards with group trackers and the shot clock, the
    // frame count, the viewport's overlays (camera toggle, group pill,
    // toast, lean, power gauge, spin, hint, ball-in-hand chip, pocket
    // mini-map, frame-over dialog) and the footer or the seat hand-off.
    //
    // Three layers, so the logic can be tested without a browser:
    //   phModel(game)      pure: game snapshot → view model (every string,
    //                      flag and number the HUD shows)
    //   phBuild(root, …)   DOM: builds the HUD once, compact or Max
    //   phRender(hud, vm)  DOM: applies a view model, touching only what
    //                      changed
    // Colours come only from pool-theme.css (--pool-*). The canvas cannot
    // read CSS, so phThemeTokens() is the bridge the renderer takes its
    // theme colours from.

    const PH_POCKETS = ['Top left', 'Top side', 'Top right', 'Bottom left', 'Bottom side', 'Bottom right'];
    const PH_SPINS = [
        { label: 'Center', x: 0, y: 0 },
        { label: 'Follow', x: 0, y: 0.45 },
        { label: 'Draw', x: 0, y: -0.55 },
        { label: 'Left', x: -0.45, y: 0 },
        { label: 'Right', x: 0.45, y: 0 },
    ];
    const PH_CLOCK_HOT = 5;          // seconds left when the clock goes hot
    const PH_POWER_HOT = 85;         // % at which the gauge goes hot
    const PH_BIH_NOTE = { overlap: 'Overlaps a ball', kitchen: 'Behind the head string only', outside: 'Keep it on the felt' };

    const phWins = (name) => (name === 'You' ? 'You win' : name + ' wins');

    // ── View model ────────────────────────────────────────────────────
    // game = {
    //   layout: 'compact' | 'max', mode: 'cpu' | 'pvp' | 'tour',
    //   names: { 1, 2 }, records: { 1, 2 }, frames: [a, b], trophies,
    //   frame,                       the rules state (pool-rules.js)
    //   world,                       the physics world, for the trackers
    //   phase: 'aim' | 'strike' | 'moving' | 'bih' | 'over',
    //   camera: '3d' | '2d', lean, power, dragging, spin (index), called,
    //   clock: { left, total } | null,
    //   toast: prText(…) | null, fouled: seat | 0,
    //   handoff: seat | 0,           "Pass to …" while seats swap
    //   bih: { valid, reason, placed, sx, sy, sr } | null,
    //   result: { win, title, reason, recordLabel, record, delta, note } | null,
    // }
    function phModel(g) {
        const st = prStatusFrom(g.frame, g.frame.turn, g.world.balls.filter(b => b.id !== 0 && b.state !== 'pocketed').map(b => b.id));
        const over = g.phase === 'over';
        const bih = g.phase === 'bih';
        const moving = g.phase === 'moving';
        const toast = g.toast || null;
        const aiming = g.phase === 'aim' || g.phase === 'strike';
        const callNeeded = aiming && st.callRequired && !(g.called >= 0);
        const max = g.layout === 'max';
        const onTable = new Set(g.world.balls.filter(b => b.state !== 'pocketed').map(b => b.id));

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
            const group = g.frame.groups[seat];
            const ids = group === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : group === 'stripes' ? [9, 10, 11, 12, 13, 14, 15] : [];
            return {
                seat, name: g.names[seat], rec: g.records[seat] || '',
                active, hot, tag, tagHot: g.fouled === seat || hot, tagPulse: hot,
                clock: clockLeft !== null && g.clock.total > 0 ? Math.max(0, Math.min(100, clockLeft / g.clock.total * 100)) : 0,
                open: !group, group: ids.map(id => ({ id, down: !onTable.has(id) })),
                initials: (g.names[seat] || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'P' + seat,
                cpu: g.mode === 'cpu' && seat === 2,
            };
        });

        // The pill names what the shooter is on, or what the table needs.
        const shooterGroup = g.frame.groups[g.frame.turn];
        let pill;
        if (bih) pill = g.frame.ballInHand === 'kitchen' ? 'Break · kitchen only' : 'Ball in hand';
        else if (aiming && st.callRequired) pill = st.onThe8 ? 'On the 8 · call it' : g.mode === 'cpu' && g.frame.callEvery ? 'Pro · call every shot' : 'Call every shot';
        else if (g.frame.isBreak) pill = 'Break';
        else pill = shooterGroup ? shooterGroup[0].toUpperCase() + shooterGroup.slice(1) : 'Open table';
        if (max && !bih && !(aiming && st.callRequired) && !g.frame.isBreak) {
            const who = g.names[g.frame.turn];
            pill = (who === 'You' ? 'Your shot' : who + "'s shot") + ' · ' + pill;
        }

        let hint = null;
        if (bih) {
            if (g.bih && g.bih.placed) hint = { text: 'Placed · aim when ready', tone: '' };
            else if (g.bih && g.bih.valid === false) hint = { text: 'Release on open felt', tone: 'hot' };
            else hint = { text: g.frame.ballInHand === 'kitchen' ? 'Place behind the head string' : 'Drag the cue ball to place it', tone: '' };
        } else if (aiming) {
            const pw = Math.round(g.power || 0);
            if (g.dragging) hint = { text: 'Release to shoot · ' + pw + '%', tone: pw >= PH_POWER_HOT ? 'hot' : 'power' };
            else if (callNeeded) hint = { text: 'Tap a pocket to call it', tone: 'call' };
            else if (st.callRequired && g.called >= 0) hint = { text: PH_POCKETS[g.called] + ' called · drag to shoot', tone: '' };
            else hint = { text: 'Press and drag for power', tone: '' };
        }

        const spin = PH_SPINS[((g.spin || 0) % PH_SPINS.length + PH_SPINS.length) % PH_SPINS.length];
        const lean = Math.max(0, Math.min(100, Math.round(g.lean || 0)));
        const is3d = g.camera === '3d' && !bih;
        const note = bih && g.bih && g.bih.valid === false && g.bih.sx !== undefined
            ? { text: PH_BIH_NOTE[g.bih.reason] || PH_BIH_NOTE.overlap, x: g.bih.sx, y: g.bih.sy + (g.bih.sr || 5) + 26 } : null;

        return {
            layout: max ? 'max' : 'compact',
            cards,
            frames: (g.frames ? g.frames[0] : 0) + '–' + (g.frames ? g.frames[1] : 0),
            trophies: g.trophies || 0,
            cam: {
                show: !toast, is3d,
                label2d: max ? '2D TOP-DOWN' : bih ? '2D · AUTO' : '2D',
                label3d: max ? '3D AIM' : '3D',
            },
            pill: { show: !toast && !over, text: pill },
            toast: toast ? { show: true, foul: toast.kind === 'foul', title: toast.title, sub: toast.sub } : { show: false },
            lean: {
                show: is3d && !over && !(aiming && st.callRequired) && !moving,
                value: lean,
                // The pitch the camera actually looks down at, as the design labels it.
                label: Math.round(19.5 + 28.5 * lean / 100 - Math.atan(0.34 / 1.1) * 180 / Math.PI) + '°',
            },
            gauge: {
                show: aiming,
                power: Math.max(0, Math.min(100, g.power || 0)),
                live: !!g.dragging, hot: (g.power || 0) >= PH_POWER_HOT, locked: callNeeded,
            },
            spin: { show: !bih && !over && !toast && !moving, label: spin.label, x: spin.x, y: spin.y },
            hint: { show: !!hint && !over && !toast, text: hint ? hint.text : '', tone: hint ? hint.tone : '' },
            bihNote: note ? { show: true, text: note.text, x: note.x, y: note.y } : { show: false },
            mini: { show: aiming && st.callRequired && is3d, called: g.called >= 0 ? g.called : -1 },
            dialog: over && g.result ? Object.assign({ show: true, kicker: 'FRAME OVER · ' + (g.frames ? g.frames[0] + '–' + g.frames[1] : ''),
                primary: 'NEW FRAME', secondary: g.mode === 'cpu' ? 'Change difficulty' : 'Change mode' }, g.result) : { show: false },
            foot: { show: !g.handoff, modeLabel: g.mode === 'cpu' ? 'Vs CPU' : g.mode === 'tour' ? 'Tournament' : '2 Players' },
            handoff: g.handoff ? {
                show: true, to: 'Pass to ' + g.names[g.handoff],
                from: g.names[3 - g.handoff] + ', swap seats',
                ready: (g.names[g.handoff] || '').toUpperCase() + "'S READY",
            } : { show: false },
            cursor: bih ? 'placing' : g.dragging ? 'dragging' : '',
        };
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
        cup: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"></path></svg>',
    };

    function phCardHTML(seat, max) {
        const top = '<div class="ph-card-top"><span class="ph-name" data-ph="name"></span>' +
            (max ? '<span class="ph-rec" data-ph="rec"></span>' : '<span class="ph-tag ph-label" data-ph="tag"></span>') + '</div>';
        const group = '<div class="ph-group" data-ph="group"></div><div class="ph-open" data-ph="open">Open table</div>';
        const body = max
            ? '<div class="ph-avatar" data-ph="avatar"></div><div class="ph-card-body">' + top + group + '</div>'
            : top + '<div class="ph-rec" data-ph="rec"></div>' + group;
        return '<div class="ph-card" data-seat="' + seat + '">' + body + '<div class="ph-clock" data-ph="clock"></div></div>';
    }

    function phViewHTML(max) {
        const mini = [[0, 0], [56, 0], [112, 0], [0, 56], [56, 56], [112, 56]]
            .map((p, i) => '<button type="button" data-ph-call="' + i + '" style="left:' + p[0] + 'px;top:' + p[1] + 'px" aria-label="Call ' + PH_POCKETS[i].toLowerCase() + ' pocket" aria-pressed="false"><span></span></button>')
            .join('');
        return '<div class="ph-view" data-ph="view"><canvas class="ph-canvas" data-ph="canvas"></canvas><div class="ph-layer">' +
            '<div class="ph-cam ph-glass" data-ph="cam"><button type="button" class="ph-label" data-ph="cam2d" aria-pressed="false">' + PH_ICON.d2 + '<span data-ph="cam2dl">2D</span></button>' +
            '<button type="button" class="ph-label" data-ph="cam3d" aria-pressed="true">' + PH_ICON.d3 + '<span data-ph="cam3dl">3D</span></button></div>' +
            '<div class="ph-pill ph-glass" data-ph="pill"><span class="ph-pill-dot"></span><span data-ph="pillt"></span></div>' +
            '<div class="ph-toast ph-glass" role="status" data-ph="toast" hidden><span class="ph-toast-icon" data-ph="toasti"></span>' +
            '<span class="ph-toast-text"><span class="ph-toast-title" data-ph="toastt"></span><span class="ph-toast-sub" data-ph="toasts"></span></span></div>' +
            '<div class="ph-lean ph-glass" data-ph="lean"><label class="ph-lean-l ph-label" for="ph-lean-' + (max ? 'm' : 'c') + '">LEAN</label>' +
            '<span class="ph-lean-v ph-num" data-ph="leanv"></span><span class="ph-lean-chev">' + PH_ICON.up + '</span>' +
            '<div class="ph-rng"><div class="ph-rng-track"></div><div class="ph-rng-fill" data-ph="leanf"></div><div class="ph-rng-thumb" data-ph="leant"></div>' +
            '<input id="ph-lean-' + (max ? 'm' : 'c') + '" type="range" min="0" max="100" step="1" data-ph="leani"></div>' +
            '<span class="ph-lean-chev">' + PH_ICON.down + '</span></div>' +
            '<div class="ph-gauge" data-ph="gauge" aria-hidden="true"><div class="ph-gauge-fill" data-ph="gaugef"></div></div>' +
            '<div class="ph-lock" data-ph="lock" hidden>' + PH_ICON.lock + '</div>' +
            '<button type="button" class="ph-spin ph-glass" data-ph="spin"><span class="ph-spin-ball"><span class="ph-spin-dot" data-ph="spind"></span></span>' +
            '<span class="ph-spin-text"><span class="ph-spin-l ph-label">SPIN</span><span class="ph-spin-v" data-ph="spinv"></span></span></button>' +
            '<div class="ph-hint ph-glass" data-ph="hint"><span data-ph="hintt"></span></div>' +
            '<div class="ph-bihnote ph-label" data-ph="bihnote" hidden></div>' +
            '<div class="ph-mini ph-glass" data-ph="mini" hidden><div class="ph-mini-table"></div><div style="position:relative;width:156px;height:100px">' + mini + '</div></div>' +
            '<div class="ph-scrim" data-ph="scrim" hidden><div class="ph-dialog" role="dialog" aria-label="Frame over" data-ph="dialog">' +
            '<div class="ph-dialog-head"><span class="ph-dialog-icon" data-ph="dlgi"></span><span style="display:flex;flex-direction:column;gap:2px">' +
            '<span class="ph-dialog-kicker ph-label" data-ph="dlgk"></span><span class="ph-dialog-title" data-ph="dlgt"></span></span></div>' +
            '<div class="ph-dialog-reason" data-ph="dlgr"></div>' +
            '<div class="ph-dialog-rec" data-ph="dlgrec"><span style="display:flex;flex-direction:column;gap:2px"><span class="ph-dialog-rec-l ph-label" data-ph="dlgrl"></span>' +
            '<span class="ph-dialog-rec-v ph-num" data-ph="dlgrv"></span></span><span class="ph-dialog-delta ph-label" data-ph="dlgd"></span></div>' +
            '<div class="ph-dialog-note" data-ph="dlgn">' + PH_ICON.chip + '<span data-ph="dlgnt"></span></div>' +
            '<div class="ph-dialog-actions"><button type="button" class="ph-primary ph-label" data-ph="dlgp"></button><button type="button" class="ph-btn" data-ph="dlgs"></button></div>' +
            '</div></div>' +
            '</div></div>';
    }

    function phHandoffHTML() {
        return '<div class="ph-handoff" data-ph="handoff" hidden><span class="ph-handoff-icon">' + PH_ICON.swap + '</span>' +
            '<span class="ph-handoff-text"><span class="ph-handoff-to" data-ph="hot"></span><span class="ph-handoff-from" data-ph="hof"></span></span>' +
            '<button type="button" class="ph-primary ph-label" data-ph="ready"></button></div>';
    }

    // on = { camera(mode), lean(value), spin(), mode(), reset(), max(), call(i), ready(), primary(), secondary() }
    function phBuild(root, opts) {
        const o = opts || {}, max = o.layout === 'max', on = o.on || {};
        const cards = phCardHTML(1, max) + '<div class="ph-frames"><span class="ph-frames-n" data-ph="frames">0–0</span><span class="ph-frames-l ph-label">FRAMES</span></div>' + phCardHTML(2, max);
        let html;
        if (max) {
            html = '<div class="ph-top"><div class="ph-title">' + (o.title || '8-Ball Pool') + '</div><div class="ph-cards">' + cards + '</div>' +
                '<div class="ph-actions"><span class="ph-trophy">' + PH_ICON.cup + '<span class="ph-num" data-ph="trophies">0</span></span>' +
                '<button type="button" class="ph-btn" data-ph="mode">' + PH_ICON.people + '<span data-ph="model"></span></button>' +
                '<button type="button" class="ph-btn is-icon" data-ph="reset" aria-label="Reset rack" title="Reset rack">' + PH_ICON.reset + '</button>' +
                '<button type="button" class="ph-btn is-icon" data-ph="max" aria-label="Exit full view" title="Exit full view">' + PH_ICON.exit + '</button></div></div>' +
                phViewHTML(true) + phHandoffHTML();
        } else {
            html = '<div class="ph-cards">' + cards + '</div>' + phViewHTML(false) +
                '<div class="ph-foot" data-ph="foot">' +
                '<button type="button" class="ph-btn" data-ph="mode" aria-haspopup="dialog">' + PH_ICON.people + '<span data-ph="model"></span></button>' +
                '<button type="button" class="ph-btn" data-ph="reset">' + PH_ICON.reset + '<span>Reset</span></button>' +
                '<button type="button" class="ph-btn" data-ph="max">' + PH_ICON.max + '<span>Max</span></button></div>' +
                phHandoffHTML();
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
            'lean', 'leanv', 'leanf', 'leant', 'leani', 'gauge', 'gaugef', 'lock', 'spin', 'spind', 'spinv', 'hint', 'hintt', 'bihnote',
            'mini', 'scrim', 'dialog', 'dlgi', 'dlgk', 'dlgt', 'dlgr', 'dlgrec', 'dlgrl', 'dlgrv', 'dlgd', 'dlgn', 'dlgnt', 'dlgp', 'dlgs',
            'foot', 'mode', 'model', 'reset', 'max', 'handoff', 'hot', 'hof', 'ready'].forEach(n => { hud[n] = ref(n); });
        if (o.canvas) { hud.canvas.replaceWith(o.canvas); o.canvas.classList.add('ph-canvas'); hud.canvas = o.canvas; }
        hud.cards = [1, 2].map(seat => {
            const c = q('.ph-card[data-seat="' + seat + '"]');
            const r = n => q('[data-ph="' + n + '"]', c);
            return { el: c, name: r('name'), tag: r('tag'), rec: r('rec'), group: r('group'), open: r('open'), clock: r('clock'), avatar: r('avatar'), dots: [] };
        });
        hud.miniButtons = Array.prototype.slice.call(el.querySelectorAll('[data-ph-call]'));

        const fire = (name, arg) => { if (typeof on[name] === 'function') on[name](arg); };
        hud.cam2d.addEventListener('click', () => fire('camera', '2d'));
        hud.cam3d.addEventListener('click', () => fire('camera', '3d'));
        hud.leani.addEventListener('input', e => fire('lean', +e.target.value));
        hud.spin.addEventListener('click', () => fire('spin'));
        hud.mode.addEventListener('click', () => fire('mode'));
        hud.reset.addEventListener('click', () => fire('reset'));
        hud.max.addEventListener('click', () => fire('max'));
        hud.ready.addEventListener('click', () => fire('ready'));
        hud.dlgp.addEventListener('click', () => fire('primary'));
        hud.dlgs.addEventListener('click', () => fire('secondary'));
        hud.miniButtons.forEach(b => b.addEventListener('click', () => fire('call', +b.getAttribute('data-ph-call'))));
        return hud;
    }

    // Writes a value only when it changed, so a 60 Hz render costs nothing
    // when nothing moved.
    function phSet(hud, key, value, apply) {
        if (hud.last[key] === value) return;
        hud.last[key] = value;
        apply(value);
    }
    const phShow = (el, on) => { if (el) el.hidden = !on; };

    function phDotStyle(id) {
        const c = PG_BALL_COLOURS[id > 8 ? id - 8 : id];
        const hi = 'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0) 48%)';
        return id > 8
            ? hi + ', linear-gradient(180deg, ' + PG_IVORY + ' 0%, ' + PG_IVORY + ' 28%, ' + c + ' 28%, ' + c + ' 72%, ' + PG_IVORY + ' 72%, ' + PG_IVORY + ' 100%)'
            : hi + ', ' + c;
    }

    function phRender(hud, vm) {
        const s = (k, v, f) => phSet(hud, k, v, f);
        vm.cards.forEach((c, i) => {
            const r = hud.cards[i], k = 'c' + i + '.';
            s(k + 'name', c.name, v => { r.name.textContent = v; });
            s(k + 'rec', c.rec, v => { r.rec.textContent = v; });
            if (r.tag) {
                s(k + 'tag', c.tag, v => { r.tag.textContent = v; });
                s(k + 'tagHot', c.tagHot, v => r.tag.classList.toggle('is-hot', v));
                s(k + 'tagPulse', c.tagPulse, v => r.tag.classList.toggle('is-pulse', v));
            }
            if (r.avatar) s(k + 'avatar', c.cpu ? '' : c.initials, v => { r.avatar.innerHTML = c.cpu ? PH_ICON.chip : ''; if (!c.cpu) r.avatar.textContent = v; });
            s(k + 'active', c.active, v => r.el.classList.toggle('is-active', v));
            s(k + 'hot', c.hot, v => r.el.classList.toggle('is-hot', v));
            s(k + 'clock', c.clock, v => { r.clock.style.width = v + '%'; });
            s(k + 'open', c.open, v => { phShow(r.open, v); phShow(r.group, !v); });
            const ids = c.group.map(d => d.id).join();
            s(k + 'ids', ids, () => {
                r.group.innerHTML = c.group.map(d => '<i class="ph-dot" style="background:' + phDotStyle(d.id) + '"></i>').join('');
                r.dots = Array.prototype.slice.call(r.group.children);
            });
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
        s('cam.l2', vm.cam.label2d, v => { hud.cam2dl.textContent = v; });
        s('cam.l3', vm.cam.label3d, v => { hud.cam3dl.textContent = v; });
        s('pill.show', vm.pill.show, v => phShow(hud.pill, v));
        s('pill.text', vm.pill.text, v => { hud.pillt.textContent = v; });

        s('toast.show', vm.toast.show, v => phShow(hud.toast, v));
        if (vm.toast.show) {
            s('toast.foul', vm.toast.foul, v => { hud.toast.classList.toggle('is-foul', v); hud.toasti.innerHTML = v ? PH_ICON.warn : PH_ICON.info; });
            s('toast.title', vm.toast.title, v => { hud.toastt.textContent = v; });
            s('toast.sub', vm.toast.sub || '', v => { hud.toasts.textContent = v; });
        }

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
            hud.spinv.textContent = v;
            hud.spin.setAttribute('aria-label', 'Cue ball spin: ' + v + '. Change spin');
            // The dot sits where the tip strikes: follow is above centre.
            hud.spind.style.left = (50 + vm.spin.x * 55) + '%';
            hud.spind.style.top = (50 - vm.spin.y * 55) + '%';
        });

        s('hint.show', vm.hint.show, v => phShow(hud.hint, v));
        s('hint.text', vm.hint.text, v => { hud.hintt.textContent = v; });
        s('hint.tone', vm.hint.tone, v => { hud.hint.className = 'ph-hint ph-glass' + (v ? ' is-' + v : ''); });

        s('bih.show', vm.bihNote.show, v => phShow(hud.bihnote, v));
        if (vm.bihNote.show) {
            s('bih.text', vm.bihNote.text, v => { hud.bihnote.textContent = v; });
            s('bih.pos', vm.bihNote.x.toFixed(1) + ',' + vm.bihNote.y.toFixed(1), () => { hud.bihnote.style.left = vm.bihNote.x + 'px'; hud.bihnote.style.top = vm.bihNote.y + 'px'; });
        }

        s('mini.show', vm.mini.show, v => phShow(hud.mini, v));
        s('mini.called', vm.mini.called, v => hud.miniButtons.forEach((b, i) => b.setAttribute('aria-pressed', i === v ? 'true' : 'false')));

        s('dlg.show', vm.dialog.show, v => phShow(hud.scrim, v));
        if (vm.dialog.show) {
            const d = vm.dialog;
            s('dlg.win', d.win, v => { hud.dialog.classList.toggle('is-loss', v === false); hud.dlgi.innerHTML = v === false ? PH_ICON.cross : PH_ICON.trophy; });
            s('dlg.kicker', d.kicker, v => { hud.dlgk.textContent = v; });
            s('dlg.title', d.title, v => { hud.dlgt.textContent = v; });
            s('dlg.reason', d.reason || '', v => { hud.dlgr.textContent = v; });
            s('dlg.rec', !!d.record, v => phShow(hud.dlgrec, v));
            s('dlg.recl', d.recordLabel || '', v => { hud.dlgrl.textContent = v; });
            s('dlg.recv', d.record || '', v => { hud.dlgrv.textContent = v; });
            s('dlg.delta', d.delta || '', v => { hud.dlgd.textContent = v; });
            s('dlg.note', d.note || '', v => { hud.dlgnt.textContent = v; phShow(hud.dlgn, !!v); });
            s('dlg.p', d.primary, v => { hud.dlgp.textContent = v; });
            s('dlg.s', d.secondary, v => { hud.dlgs.textContent = v; });
        }

        if (hud.foot) s('foot.show', vm.foot.show, v => phShow(hud.foot, v));
        s('foot.mode', vm.foot.modeLabel, v => { hud.model.textContent = v; });
        s('ho.show', vm.handoff.show, v => phShow(hud.handoff, v));
        if (vm.handoff.show) {
            s('ho.to', vm.handoff.to, v => { hud.hot.textContent = v; });
            s('ho.from', vm.handoff.from, v => { hud.hof.textContent = v; });
            s('ho.ready', vm.handoff.ready, v => { hud.ready.textContent = v; });
        }
        s('cursor', vm.cursor, v => {
            hud.canvas.classList.toggle('is-dragging', v === 'dragging');
            hud.canvas.classList.toggle('is-placing', v === 'placing');
        });
    }

    // ── Canvas bridge ─────────────────────────────────────────────────
    // The renderer's theme colours, read off the HUD's computed --pool-*
    // values and normalised to #rrggbb. Cached until phThemeChanged(),
    // which the host calls on every theme or colour change.
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
