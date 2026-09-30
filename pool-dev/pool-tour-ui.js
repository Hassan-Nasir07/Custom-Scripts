    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — TOURNAMENT SCREENS (v2)
    // ═══════════════════════════════════════════════════════════════════
    // The tournament's screens from the design (TournamentSetup, BracketTree,
    // BracketCompact, BracketFull, MatchIntro, MatchResult, Champion,
    // ChampionFull, TrophyCabinet, and InMatch's resume, abandon and pause
    // dialogs), over the pool HUD.
    //
    //   puTree(t, opts)        the bracket as HTML + SVG, the design's geometry:
    //                          column (W − champ − rounds·gap) / rounds, card
    //                          min(64, slot − 12), elbows at the gutter midpoint
    //   pu*HTML(model)         each screen as HTML, from the tournament and the
    //                          screen's own state
    //   puMount / puSync       one overlay per HUD; the controller hands it the
    //                          screen and it re-renders only when that changes.
    //                          Clicks and edits come back through data-pu-act
    //                          and data-pu-in to the controller's handlers
    // Names are typed by people, so everything that goes into HTML is escaped.

    const puEsc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const PU_ICON = {
        back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>',
        minus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"></path></svg>',
        plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
        bracket: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h5v5H3M3 14h5v5H3M8 7.5h4v9H8M12 12h4M16 9h5v6h-5z"></path></svg>',
        cup: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"></path></svg>',
        cupBig: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" fill="currentColor" fill-opacity="0.1"></path><path d="M9.5 7.2v1.6a2.5 2.5 0 0 0 1.4 2.2" stroke-opacity="0.6"></path></svg>',
        you: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c1-4.5 4.2-7 8-7s7 2.5 8 7"></path></svg>',
        check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>',
        play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"></path></svg>',
        pause: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"></path></svg>',
        warn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 16.5h-19L12 3z"></path><path d="M12 10v4M12 17.2v.1"></path></svg>',
        exit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"></path></svg>',
        close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
        ball: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#F3EEE2"></circle><circle cx="8.8" cy="8.6" r="2" fill="#FFFFFF" fill-opacity="0.8"></circle></svg>',
    };

    // "QF", "SF", "F", "R16" for the TBD lines: "Winner QF 2".
    function puShort(rounds, r) {
        const fromEnd = rounds - 1 - r;
        return fromEnd === 0 ? 'F' : fromEnd === 1 ? 'SF' : fromEnd === 2 ? 'QF' : 'R' + Math.pow(2, fromEnd + 1);
    }
    // How a match reads right now: 'bye' | 'done' | 'live' | 'next' | ''.
    function puState(t, m, liveId) {
        if (m.status === 'bye') return 'bye';
        if (m.status === 'done') return 'done';
        if (m.id === liveId || m.status === 'live') return 'live';
        const n = ptNext(t);
        return n && n.id === m.id ? 'next' : '';
    }
    // One line of a match: the player, or the bye, or who it is waiting for.
    function puLine(t, m, side) {
        const slot = side === 'a' ? m.a : m.b;
        if (slot !== null) return { name: t.slots[slot].name, seed: String(t.slots[slot].seed), tbd: false };
        if (m.round === 0) return { name: 'Bye', seed: '', tbd: true };
        const feeder = ptMatch(t, m.round - 1, 2 * m.index + (side === 'a' ? 0 : 1));
        if (feeder && feeder.status === 'bye') return { name: t.slots[feeder.a].name, seed: String(t.slots[feeder.a].seed), tbd: false };
        return { name: 'Winner ' + puShort(t.rounds, m.round - 1) + ' ' + (2 * m.index + (side === 'a' ? 1 : 2)), seed: '', tbd: true };
    }
    // The round's name where a column is narrow: Last 16, Quarters, Semis, Final.
    function puRoundShort(rounds, r) {
        const fromEnd = rounds - 1 - r;
        return fromEnd === 0 ? 'Final' : fromEnd === 1 ? 'Semis' : fromEnd === 2 ? 'Quarters' : 'Last ' + Math.pow(2, fromEnd + 1);
    }
    // The path to highlight: the champion's, else the YOU player's while still in.
    function puPath(t) {
        const champ = ptChampion(t);
        let slot = champ;
        if (slot === null) { const y = t.slots.findIndex(s => s.you); slot = y >= 0 && ptOut(t, y) === null ? y : null; }
        const ids = new Set();
        if (slot === null) return { ids, champ: false, name: '' };
        // Every match they won, and the one they are in now (the design lights the way in).
        t.matches.forEach(m => {
            if (m.a !== slot && m.b !== slot) return;
            if (((m.status === 'done' || m.status === 'bye') && m.winner === slot) || m.status === 'pending' || m.status === 'live') ids.add(m.id);
        });
        return { ids, champ: champ !== null, name: t.slots[slot].name };
    }

    // The mini tree's height: a row of first-round cards needs about 30 px each.
    const puMiniH = t => Math.max(160, t.size / 2 * 30);
    // opts: { w, h, mini, liveId }
    function puTree(t, opts) {
        const o = opts || {}, W = o.w || 900, H = o.h || 520, mini = !!o.mini;
        const fx = v => Math.round(v * 10) / 10;
        const cols = t.rounds, n0 = t.size / 2;
        const hdr = mini ? 0 : 30, champW = mini ? 78 : 188, gap = mini ? 16 : 40;
        const cardW = (W - champW - cols * gap) / cols;
        const slotH = (H - hdr) / n0;
        const cardH = mini ? Math.min(40, slotH - 6) : Math.min(64, slotH - 12);
        const pos = (r, j) => { const cy = hdr + slotH * (j + 0.5) * Math.pow(2, r); return { x: r * (cardW + gap), y: cy - cardH / 2, cy }; };
        const path = puPath(t);
        let lines = '', hi = '', cards = '';
        t.matches.forEach(m => {
            const p = pos(m.round, m.index), st = puState(t, m, o.liveId);
            const a = puLine(t, m, 'a'), b = puLine(t, m, 'b');
            const [sa, sb] = ptScore(m), showScore = st === 'done' || st === 'live';
            const aWin = (st === 'done' && m.winner === m.a) || st === 'bye', bWin = st === 'done' && m.winner === m.b;
            const row = (L, score, win, lose) => '<div class="pu-tr-row' + (win ? ' is-win' : '') + (lose ? ' is-lose' : '') + (L.tbd ? ' is-tbd' : '') + '">' +
                (mini ? '' : '<span class="pu-tr-seed">' + puEsc(L.seed) + '</span>') +
                '<span class="pu-tr-name">' + puEsc(L.name) + '</span><span class="pu-tr-score">' + (showScore ? score : '') + '</span></div>';
            cards += '<div class="pu-tr-card is-' + (st || 'wait') + (path.ids.has(m.id) ? ' is-path' : '') + '" style="left:' + fx(p.x) + 'px;top:' + fx(p.y) + 'px;width:' + fx(cardW) + 'px;height:' + fx(cardH) + 'px">' +
                row(a, sa, aWin, st === 'done' && !aWin) + row(b, sb, bWin, st === 'done' && !bWin) +
                (st && !mini ? '<span class="pu-chip is-' + st + '">' + st.toUpperCase() + '</span>' : '') + '</div>';
            if (m.round > 0) [2 * m.index, 2 * m.index + 1].forEach(fj => {
                const f = pos(m.round - 1, fj), x1 = f.x + cardW, mx = x1 + gap / 2;
                const d = 'M' + fx(x1) + ' ' + fx(f.cy) + 'H' + fx(mx) + 'V' + fx(p.cy) + 'H' + fx(p.x);
                if (path.ids.has(ptMatch(t, m.round - 1, fj).id) && path.ids.has(m.id)) hi += d; else lines += d;
            });
        });
        const fp = pos(cols - 1, 0), chH = mini ? cardH : Math.max(cardH, 104), chX = cols * (cardW + gap);
        const cd = 'M' + fx(fp.x + cardW) + ' ' + fx(fp.cy) + 'H' + fx(chX);
        if (path.champ) hi += cd; else lines += cd;
        const champ = ptChampion(t);
        const heads = mini ? '' : Array.from({ length: cols }, (_, r) => '<div class="pu-tr-head" style="left:' + fx(r * (cardW + gap)) + 'px;width:' + fx(cardW) + 'px">' +
            puEsc((cardW < 190 ? puRoundShort(t.rounds, r) : ptRoundName(t.rounds, r)).toUpperCase() + ' · RACE TO ' + t.settings.race[r]) + '</div>').join('') +
            '<div class="pu-tr-head" style="left:' + fx(chX) + 'px;width:' + fx(champW) + 'px">CHAMPION</div>';
        return '<div class="pu-tree' + (mini ? ' is-mini' : '') + '" role="img" aria-label="Tournament bracket" style="width:' + W + 'px;height:' + H + 'px">' + heads +
            '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path class="pu-tr-line" d="' + lines + '" stroke-width="' + (mini ? 1.25 : 1.5) + '"></path>' +
            '<path class="pu-tr-hi" d="' + hi + '" stroke-width="' + (mini ? 1.25 : 1.5) + '"></path></svg>' + cards +
            '<div class="pu-tr-champ' + (champ !== null ? ' is-won' : '') + '" style="left:' + fx(chX) + 'px;top:' + fx(fp.cy - chH / 2) + 'px;width:' + fx(champW) + 'px;height:' + fx(chH) + 'px">' +
            PU_ICON.cup + (mini ? '' : '<span class="pu-tr-champ-l">CHAMPION</span>') + '<span class="pu-tr-champ-n">' + puEsc(champ !== null ? t.slots[champ].name : 'TBD') + '</span></div></div>';
    }

    // ── Screens ───────────────────────────────────────────────────────
    const puHead = (kicker, title, back, right) => '<div class="pu-head">' +
        (back ? '<button type="button" class="pu-iconbtn" data-pu-act="' + back + '" aria-label="Back">' + PU_ICON.back + '</button>' : '') +
        '<div class="pu-head-t"><span class="pu-kicker">' + puEsc(kicker) + '</span><span class="pu-title">' + puEsc(title) + '</span></div>' + (right || '') + '</div>';
    const puPill = text => '<span class="pu-pill">' + puEsc(text) + '</span>';
    const puSeg = (label, key, opts, cur) => '<div class="pu-seg-row" role="radiogroup" aria-label="' + puEsc(label) + '"><span class="pu-seg-l">' + puEsc(label) + '</span>' +
        '<div class="pu-seg" style="grid-template-columns:repeat(' + opts.length + ',minmax(0,1fr))">' +
        opts.map(o => '<button type="button" role="radio" aria-checked="' + (o[0] === cur ? 'true' : 'false') + '" data-pu-act="set" data-pu-arg="' + key + ':' + o[0] + '">' + puEsc(o[1]) + '</button>').join('') + '</div></div>';

    // s = { n, names, name, race: [per column], clock, guide, call, shuffle }
    function puSetupHTML(s) {
        const size = ptSizeFor(s.n), byes = size - s.n, cols = ptRaceColumns(size);
        const rows = s.names.slice(0, s.n).map((nm, i) => '<div class="pu-player"><label class="pu-seedl" for="pu-p' + i + '">' + String(i + 1).padStart(2, '0') + '</label>' +
            '<div class="pu-player-in"><input id="pu-p' + i + '" class="pu-input' + (i === 0 ? ' is-you' : '') + '" type="text" maxlength="16" placeholder="Player name" value="' + puEsc(nm) + '" data-pu-in="name:' + i + '" aria-label="' + (i === 0 ? 'Player 1 name (you)' : 'Player ' + (i + 1) + ' name') + '">' +
            (i === 0 ? '<span class="pu-you">' + PU_ICON.you + 'YOU</span>' : '') + '</div></div>').join('');
        const races = cols.map((c, ci) => '<label class="pu-race"><span>' + c.label + '</span><select data-pu-in="race:' + ci + '" aria-label="' + c.label + ', race to">' +
            [1, 2, 3, 4, 5].map(v => '<option value="' + v + '"' + (v === s.race[ci] ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>').join('');
        return '<div class="pu-screen-in">' + puHead('TOURNAMENT · HUMANS ONLY', 'New tournament', 'close') +
            '<div class="pu-body">' +
            '<label class="pu-field"><span class="pu-seg-l">Name</span><input class="pu-input" type="text" maxlength="24" placeholder="' + puEsc(PT_NAMES[size]) + '" value="' + puEsc(s.name) + '" data-pu-in="tname" aria-label="Tournament name"></label>' +
            '<div class="pu-count"><span class="pu-count-t"><span class="pu-strong">Contestants</span><span class="pu-note">Bracket of ' + size + (byes ? ' · ' + byes + (byes === 1 ? ' bye' : ' byes') + ' to top seeds' : '') + '</span></span>' +
            '<div class="pu-stepper" role="group" aria-label="Contestants"><button type="button" data-pu-act="count" data-pu-arg="-1" aria-label="Fewer contestants"' + (s.n <= PT_MIN ? ' disabled' : '') + '>' + PU_ICON.minus + '</button>' +
            '<span class="pu-count-n" aria-live="polite">' + s.n + '</span><button type="button" data-pu-act="count" data-pu-arg="1" aria-label="More contestants"' + (s.n >= PT_MAX ? ' disabled' : '') + '>' + PU_ICON.plus + '</button></div></div>' +
            '<div class="pu-players">' + rows + '</div>' +
            '<div class="pu-group"><span class="pu-kicker">FRAMES PER ROUND · RACE TO</span><div class="pu-races" style="grid-template-columns:repeat(' + cols.length + ',minmax(0,1fr))">' + races + '</div></div>' +
            puSeg('Shot clock', 'clock', [[30, '30s'], [45, '45s'], [0, 'Off']], s.clock) +
            puSeg('Guideline', 'guide', [['full', 'Full'], ['short', 'Short'], ['off', 'Off']], s.guide) +
            // Pool: the 8 only or every shot; snooker: off, the colours, or every ball (the game's tourDefaults).
            puSeg('Call pocket', 'call', s.calls || [['8', '8 only'], ['every', 'Every shot']], s.call) +
            '<div class="pu-count"><span class="pu-count-t"><span class="pu-strong" id="pu-shuf">Shuffle seeds</span><span class="pu-note">Off keeps the list order as seeding</span></span>' +
            '<button type="button" class="pu-switch" role="switch" aria-checked="' + (s.shuffle ? 'true' : 'false') + '" aria-labelledby="pu-shuf" data-pu-act="shuffle"><span><span></span></span></button></div>' +
            '</div>' +
            '<button type="button" class="pu-primary" data-pu-act="start">' + PU_ICON.bracket + 'START TOURNAMENT</button></div>';
    }

    // One match card on the compact bracket's round page.
    function puMatchCard(t, m, liveId) {
        const st = puState(t, m, liveId), [sa, sb] = ptScore(m), showScore = st === 'done' || st === 'live';
        const code = puShort(t.rounds, m.round) + (t.rounds - 1 - m.round === 0 ? 'INAL' : ' ' + (m.index + 1));
        const title = code === 'FINAL' ? 'FINAL · RACE TO ' + m.raceTo : st === 'bye' ? code + ' · BYE' : code + ' · RACE TO ' + m.raceTo;
        const a = puLine(t, m, 'a'), b = st === 'bye' ? { name: 'Advances to ' + ptRoundName(t.rounds, m.round + 1).toLowerCase(), seed: '', tbd: true } : puLine(t, m, 'b');
        const row = (L, score, win, lose) => '<div class="pu-mrow' + (win ? ' is-win' : '') + (lose ? ' is-lose' : '') + (L.tbd ? ' is-tbd' : '') + '"><span class="pu-mseed">' + puEsc(L.seed) + '</span>' +
            '<span class="pu-mname">' + puEsc(L.name) + '</span><span class="pu-mscore">' + (showScore ? score : '') + '</span></div>';
        return '<div class="pu-match is-' + (st || 'wait') + '"><div class="pu-match-h"><span class="pu-kicker">' + puEsc(title) + '</span>' +
            (st ? '<span class="pu-chip is-' + st + '">' + st.toUpperCase() + '</span>' : '') + '</div>' +
            row(a, sa, st === 'bye' || (st === 'done' && m.winner === m.a), st === 'done' && m.winner !== m.a) +
            row(b, sb, st === 'done' && m.winner === m.b, st === 'done' && m.winner !== m.b) + '</div>';
    }
    // The CTA line under PLAY NEXT MATCH: "Ayesha vs Bilal · Semi-final".
    function puNextLine(t) {
        const n = ptNext(t);
        return n ? t.slots[n.a].name + ' vs ' + t.slots[n.b].name + ' · ' + ptRoundName(t.rounds, n.round) : '';
    }
    // v = { t, tab, liveId, layout, miniW, maxW, maxH (the full tree's box in Max) }
    function puBracketHTML(v) {
        const t = v.t, next = ptNext(t), live = v.liveId && ptById(t, v.liveId);
        const cta = live ? { act: 'resume', title: 'RESUME MATCH', sub: t.slots[live.a].name + ' vs ' + t.slots[live.b].name + ' · ' + ptRoundName(t.rounds, live.round) }
            : next ? { act: 'play', title: 'PLAY NEXT MATCH', sub: puNextLine(t) } : { act: 'champion', title: 'SEE THE CHAMPION', sub: '' };
        if (v.layout === 'max') {
            const played = ptPlayable(t).filter(m => m.status === 'done').length, cur = next || live;
            const stage = cur ? ptRoundName(t.rounds, cur.round) + ' · ' + played + ' of ' + ptPlayable(t).length + ' played' : 'Complete';
            const path = puPath(t);
            return '<div class="pu-screen-in is-max"><div class="pu-maxhead"><div class="pu-head-t"><span class="pu-kicker">' + puEsc(t.name.toUpperCase() + ' · ' + t.slots.length + ' PLAYERS') + '</span>' +
                '<span class="pu-title is-big">' + puEsc(stage) + '</span></div>' +
                '<div class="pu-legend"><span><span class="pu-chip is-live">LIVE</span>At the table</span><span><span class="pu-chip is-next">NEXT</span>Up next</span>' +
                (path.name ? '<span><span class="pu-legend-line"></span>' + puEsc((path.champ ? 'Champion\'s path · ' : 'Your path · ') + path.name) + '</span>' : '') + '</div>' +
                '<div class="pu-maxacts"><button type="button" class="pu-primary is-inline" data-pu-act="' + cta.act + '">' + PU_ICON.play + puEsc(cta.act === 'champion' ? cta.title : cta.title.replace(' MATCH', '') + (cta.sub ? ' · ' + cta.sub.split(' · ')[0].toUpperCase() : '')) + '</button>' +
                '<button type="button" class="pu-iconbtn" data-pu-act="' + (live ? 'resume' : 'close') + '" aria-label="' + (live ? 'Back to the match' : 'Leave the bracket') + '">' + PU_ICON.back + '</button></div></div>' +
                '<div class="pu-maxtree">' + puTree(t, { w: v.maxW || 1232, h: v.maxH || 672, liveId: v.liveId }) + '</div></div>';
        }
        const tabs = Array.from({ length: t.rounds }, (_, r) => {
            const done = t.matches.filter(m => m.round === r).every(m => m.status === 'done' || m.status === 'bye');
            return '<button type="button" role="tab" aria-selected="' + (r === v.tab ? 'true' : 'false') + '" data-pu-act="tab" data-pu-arg="' + r + '">' + (done ? PU_ICON.check : '') + puEsc(t.rounds > 3 ? puRoundShort(t.rounds, r) : ptRoundName(t.rounds, r)) + '</button>';
        }).join('');
        const page = t.matches.filter(m => m.round === v.tab).map(m => puMatchCard(t, m, v.liveId)).join('');
        return '<div class="pu-screen-in">' + puHead(t.name.toUpperCase(), 'Bracket', live ? 'resume' : 'close', puPill(t.slots.length + ' PLAYERS')) +
            '<div class="pu-tabs" role="tablist" aria-label="Rounds" style="grid-template-columns:repeat(' + t.rounds + ',minmax(0,1fr))">' + tabs + '</div>' +
            '<div class="pu-body" role="tabpanel">' + page +
            (v.tab > 0 ? '<div class="pu-group"><span class="pu-kicker">WHOLE BRACKET</span><div class="pu-mini">' + puTree(t, { w: v.miniW || 336, h: puMiniH(t), mini: true, liveId: v.liveId }) + '</div></div>' : '') + '</div>' +
            '<button type="button" class="pu-primary is-two" data-pu-act="' + cta.act + '"><span>' + cta.title + '</span>' + (cta.sub ? '<span class="pu-primary-sub">' + puEsc(cta.sub) + '</span>' : '') + '</button></div>';
    }

    // Seed and route, for the intro: "Seed 4 · beat Zara 1–0", "Seed 1 · bye in QF".
    function puRoute(t, slot, round) {
        const bits = ['Seed ' + t.slots[slot].seed];
        const prev = t.matches.find(m => m.round === round - 1 && (m.a === slot || m.b === slot));
        if (prev && prev.status === 'bye') bits.push('bye in ' + puShort(t.rounds, prev.round));
        else if (prev && prev.status === 'done') { const r = ptRun(t, slot)[round - 1]; if (r) bits.push(r.text + ' ' + r.score); }
        return bits.join(' · ');
    }
    // v = { t, matchId }
    function puIntroHTML(v) {
        const t = v.t, m = ptById(t, v.matchId), num = ptMatchNumber(t, m);
        const A = t.slots[m.a], B = t.slots[m.b], br = t.slots[ptBreaker(t, m, m.frames.length)];
        const side = (S, slot, cls) => '<div class="pu-vs-side ' + cls + '"><div class="pu-avatar' + (slot === m.a ? ' is-lead' : '') + '">' + puEsc((S.name[0] || '?').toUpperCase()) + '</div>' +
            '<span class="pu-vs-name">' + puEsc(S.name) + '</span><span class="pu-note">' + puEsc(puRoute(t, slot, m.round)) + '</span></div>';
        return '<div class="pu-screen-in is-intro">' + puHead(t.name.toUpperCase() + ' · MATCH ' + num.n + ' OF ' + num.of, '', 'bracket') +
            '<div class="pu-body is-center"><div class="pu-round"><span class="pu-round-n">' + puEsc(ptRoundName(t.rounds, m.round).toUpperCase()) + '</span><span class="pu-round-r">Race to ' + m.raceTo + '</span></div>' +
            '<div class="pu-vs">' + side(A, m.a, 'is-a') + '<span class="pu-vs-x">VS</span>' + side(B, m.b, 'is-b') + '</div>' +
            '<div class="pu-breaks">' + PU_ICON.ball + '<span><strong>' + puEsc(br.name) + ' breaks</strong><span class="pu-note"> · breaks alternate after</span></span></div></div>' +
            '<div class="pu-foot"><span class="pu-note is-center">' + puEsc(A.name + ' and ' + B.name + ', take the seat when it\'s your shot.') + '</span>' +
            '<button type="button" class="pu-primary" data-pu-act="ready">READY</button></div></div>';
    }

    // v = { t, matchId }
    function puResultHTML(v) {
        const t = v.t, m = ptById(t, v.matchId), num = ptMatchNumber(t, m), [sa, sb] = ptScore(m);
        const W = t.slots[m.winner], L = t.slots[m.winner === m.a ? m.b : m.a];
        const final = m.round === t.rounds - 1, next = ptNext(t);
        const frames = m.frames.map((w, i) => '<div class="pu-frame' + (w === m.winner ? ' is-win' : '') + '"><span class="pu-kicker">FRAME ' + (i + 1) + '</span><span>' + puEsc(t.slots[w].name) + '</span></div>').join('');
        return '<div class="pu-screen-in">' + puHead(t.name.toUpperCase(), ptRoundName(t.rounds, m.round) + ' · race to ' + m.raceTo, '', puPill('MATCH ' + num.n + ' OF ' + num.of)) +
            '<div class="pu-body"><div class="pu-won"><div class="pu-won-top"><div class="pu-avatar is-lead">' + puEsc((W.name[0] || '?').toUpperCase()) + '</div>' +
            '<div class="pu-won-t"><span class="pu-kicker is-accent">' + (final ? 'CHAMPION' : 'MATCH WON') + '</span><span class="pu-won-n">' + puEsc(W.name) + '</span></div>' +
            '<span class="pu-won-s">' + Math.max(sa, sb) + '–' + Math.min(sa, sb) + '</span></div><div class="pu-frames" style="grid-template-columns:repeat(' + Math.min(3, m.frames.length) + ',minmax(0,1fr))">' + frames + '</div></div>' +
            '<div class="pu-out"><span class="pu-avatar is-small">' + puEsc((L.name[0] || '?').toUpperCase()) + '</span><span class="pu-out-t">' + puEsc(L.name + ' is out') + '</span><span class="pu-note">' + puEsc(ptRoundName(t.rounds, m.round) + ' finish') + '</span></div>' +
            '<div class="pu-group"><span class="pu-kicker">' + puEsc(final ? W.name.toUpperCase() + ' WINS ' + t.name.toUpperCase() : W.name.toUpperCase() + ' ADVANCES TO THE ' + ptRoundName(t.rounds, m.round + 1).toUpperCase()) + '</span>' +
            '<div class="pu-mini">' + puTree(t, { w: v.miniW || 336, h: puMiniH(t), mini: true }) + '</div></div></div>' +
            '<button type="button" class="pu-primary is-two" data-pu-act="' + (final ? 'champion' : 'bracket') + '"><span>CONTINUE</span><span class="pu-primary-sub">' +
            puEsc(final ? 'The champion' : next ? 'Next: ' + t.slots[next.a].name + ' vs ' + t.slots[next.b].name + ' · ' + ptRoundName(t.rounds, next.round) : '') + '</span></button></div>';
    }

    const puDate = ms => { try { return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (_) { return ''; } };
    // v = { t, layout }
    function puChampionHTML(v) {
        const t = v.t, c = ptChampion(t), C = t.slots[c], fr = ptFrames(t, c);
        const run = ptRun(t, c).map(r => '<div class="pu-run' + (r.round === t.rounds - 1 ? ' is-final' : '') + '"><span class="pu-kicker">' + puEsc(puRoundShort(t.rounds, r.round).toUpperCase()) + '</span>' +
            '<span class="pu-run-t' + (r.kind === 'bye' ? ' is-muted' : '') + '">' + puEsc(r.text) + '</span><span class="pu-run-s">' + puEsc(r.score || '—') + '</span></div>').join('');
        // A no-break space before each dot, so a wrapped line never starts with one.
        const meta = t.slots.length + ' players\u00a0· ' + puDate(t.created) + '\u00a0· ' + fr.won + ' frames won, ' + fr.lost + ' lost';
        const x = '<button type="button" class="pu-iconbtn pu-champ-x" data-pu-act="close" aria-label="Close">' + PU_ICON.close + '</button>';
        const hero = '<div class="pu-hero"><span class="pu-hero-cup">' + PU_ICON.cupBig + '</span><span class="pu-kicker is-accent is-wide">' + puEsc('CHAMPION · ' + t.name.toUpperCase()) + '</span>' +
            '<span class="pu-hero-n">' + puEsc(C.name) + '</span><span class="pu-note">' + puEsc(meta) + '</span></div>';
        const acts = '<div class="pu-champ-acts"><button type="button" class="pu-primary" data-pu-act="new">NEW TOURNAMENT</button>' +
            '<button type="button" class="pu-btn" data-pu-act="cabinet">' + PU_ICON.cup + 'Trophy cabinet</button></div>';
        if (v.layout === 'max') {
            return '<div class="pu-screen-in is-max is-champ">' + x + '<div class="pu-champ-grid"><div class="pu-champ-l">' + hero + '<div class="pu-runs">' + run + '</div>' + acts + '</div>' +
                '<div class="pu-champ-r"><div class="pu-mini is-big">' + puTree(t, { w: 724, h: 520 }) + '</div></div></div></div>';
        }
        return '<div class="pu-screen-in is-champ">' + x + '<div class="pu-body">' + hero + '<div class="pu-runs">' + run + '</div>' +
            '<div class="pu-group"><span class="pu-kicker">FINAL BRACKET</span><div class="pu-mini">' + puTree(t, { w: v.miniW || 336, h: puMiniH(t), mini: true }) + '</div></div></div>' + acts + '</div>';
    }

    // v = { cab }
    function puCabinetHTML(v) {
        const rows = ptCabinetRows(v.cab);
        const cell = n => '<span class="pu-cab-c' + (n ? '' : ' is-zero') + '">' + (n || '–') + '</span>';
        const table = rows.length ? rows.map((r, i) => '<div class="pu-cab-row" role="row"><span role="rowheader" class="pu-cab-name">' + (i === 0 ? '<span class="pu-crown">' + PU_ICON.cup + '</span>' : '<span class="pu-crown"></span>') +
            puEsc(r.name) + '</span>' + cell(r[4]) + cell(r[8]) + cell(r[16]) + '<span class="pu-cab-t">' + r.total + '</span></div>').join('')
            : '<div class="pu-empty">No titles yet. The first tournament you finish lands here.</div>';
        const recent = (v.cab.recent || []).map(r => '<div class="pu-recent" role="listitem"><span class="pu-recent-s">' + r.size + '</span><span class="pu-recent-t"><span class="pu-strong">' + puEsc(r.name) + '</span>' +
            '<span class="pu-note">' + puEsc(puDate(r.date) + ' · ' + r.players + ' players') + '</span></span><span class="pu-recent-c">' + PU_ICON.cup + puEsc(r.champ) + '</span></div>').join('');
        return '<div class="pu-screen-in">' + puHead('SAVED ON THIS COMPUTER', 'Trophy cabinet', 'cabinetBack') +
            '<div class="pu-body"><div class="pu-group"><span class="pu-kicker">TITLES BY BRACKET SIZE</span><div class="pu-cab" role="table" aria-label="Titles by bracket size">' +
            '<div class="pu-cab-row is-head" role="row"><span>PLAYER</span><span>4</span><span>8</span><span>16</span><span class="is-accent">TOTAL</span></div>' + table + '</div></div>' +
            (recent ? '<div class="pu-group"><span class="pu-kicker">RECENT TOURNAMENTS</span><div class="pu-recents" role="list">' + recent + '</div></div>' : '') + '</div></div>';
    }

    // The dialogs over the table: resume, abandon, pause. v = { t, liveId }
    function puDialogHTML(kind, v) {
        const t = v.t;
        if (kind === 'pause') return '<div class="pu-dlg" role="dialog" aria-label="Paused"><span class="pu-dlg-icon">' + PU_ICON.pause + '</span>' +
            '<span class="pu-dlg-t"><span class="pu-kicker">' + puEsc(t.name.toUpperCase()) + '</span><span class="pu-dlg-title">Paused</span><span class="pu-note">The shot clock is stopped.</span></span>' +
            '<div class="pu-dlg-acts"><button type="button" class="pu-primary" data-pu-act="unpause">RESUME</button>' +
            '<button type="button" class="pu-btn" data-pu-act="leave">Leave for now</button></div>' +
            '<span class="pu-note is-center">Leaving keeps the match saved. Resume it from Game mode.</span></div>';
        const live = (v.liveId && ptById(t, v.liveId)) || ptNext(t);
        const where = live ? ptRoundName(t.rounds, live.round) : 'Final';
        if (kind === 'abandon') return '<div class="pu-dlg is-hot" role="alertdialog" aria-label="Abandon tournament"><span class="pu-dlg-icon">' + PU_ICON.warn + '</span>' +
            '<span class="pu-dlg-t"><span class="pu-dlg-title">' + puEsc('Abandon ' + t.name + '?') + '</span><span class="pu-note">' + puEsc('The bracket and every result for all ' + t.slots.length + ' players will be deleted from this computer. This can\'t be undone.') + '</span></span>' +
            '<div class="pu-dlg-acts"><button type="button" class="pu-btn" data-pu-act="keep">Keep tournament</button><button type="button" class="pu-primary is-hot" data-pu-act="abandonYes">ABANDON TOURNAMENT</button></div></div>';
        const score = live ? ptScore(live) : [0, 0];
        return '<div class="pu-dlg" role="dialog" aria-label="Tournament in progress"><span class="pu-dlg-icon">' + PU_ICON.bracket + '</span>' +
            '<span class="pu-dlg-t"><span class="pu-kicker">TOURNAMENT IN PROGRESS</span><span class="pu-dlg-title">' + puEsc(t.name + ' · ' + where) + '</span>' +
            (live ? '<span class="pu-note">' + puEsc(t.slots[live.a].name + ' vs ' + t.slots[live.b].name + ', frame ' + (live.frames.length + 1)) + '</span>' : '') + '</span>' +
            (live ? '<div class="pu-dlg-score"><span>' + puEsc(t.slots[live.a].name) + '</span><span class="pu-dlg-n">' + score[0] + '–' + score[1] + '</span><span>' + puEsc(t.slots[live.b].name) + '</span></div>' : '') +
            '<div class="pu-dlg-acts"><button type="button" class="pu-primary" data-pu-act="resumeTour">RESUME</button><button type="button" class="pu-btn is-hot" data-pu-act="abandon">Abandon</button></div></div>';
    }

    // ── Mounting ──────────────────────────────────────────────────────
    // One screen layer and one dialog layer per HUD, both inside .pool-hud.
    function puMount(hud, on) {
        if (hud.pu) return hud.pu;
        const screen = document.createElement('div'), dialog = document.createElement('div');
        screen.className = 'pu-screen'; screen.hidden = true;
        dialog.className = 'pu-scrim'; dialog.hidden = true;
        hud.el.appendChild(screen); hud.el.appendChild(dialog);
        const act = e => {
            const b = e.target.closest && e.target.closest('[data-pu-act]');
            if (!b || b.disabled || !hud.el.contains(b)) return;
            const f = on[b.getAttribute('data-pu-act')];
            if (typeof f === 'function') f(b.getAttribute('data-pu-arg'));
        };
        const edit = e => {
            const f = e.target.getAttribute && e.target.getAttribute('data-pu-in');
            if (f && typeof on.edit === 'function') on.edit(f, e.target.value);
        };
        screen.addEventListener('click', act); dialog.addEventListener('click', act);
        screen.addEventListener('input', edit); screen.addEventListener('change', edit);
        // Keys typed into a field stay there: the host's number-key game shortcuts skip
        // inputs but not selects, so "3" in a race-to select would switch to Tetris.
        screen.addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input, select, textarea')) e.stopPropagation(); });
        hud.pu = { screen, dialog, key: { screen: null, dialog: null } };
        return hud.pu;
    }
    // view = { screen: html | '', dialog: html | '', key: { screen, dialog } }
    function puSync(hud, on, view) {
        const pu = puMount(hud, on);
        if (pu.key.screen !== view.key.screen) {
            pu.key.screen = view.key.screen;
            // Keep keyboard focus on the same control across a re-render (a stepper
            // press re-renders the list; the focus stays on that button).
            const a = document.activeElement, had = a && pu.screen.contains(a) && a.getAttribute('data-pu-act');
            const sel = had ? '[data-pu-act="' + had + '"]' + (a.getAttribute('data-pu-arg') !== null ? '[data-pu-arg="' + a.getAttribute('data-pu-arg') + '"]' : '') : null;
            pu.screen.innerHTML = view.screen || '';
            pu.screen.hidden = !view.screen;
            const again = sel && pu.screen.querySelector(sel);
            if (again) again.focus({ preventScroll: true });
        }
        if (pu.key.dialog !== view.key.dialog) {
            pu.key.dialog = view.key.dialog;
            pu.dialog.innerHTML = view.dialog || '';
            pu.dialog.hidden = !view.dialog;
        }
    }
