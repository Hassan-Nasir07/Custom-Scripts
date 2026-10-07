    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — CUES
    // ═══════════════════════════════════════════════════════════════════
    // The cue collection (POOL_V2_PLAN.md, Cues): the design's materials and cues as data,
    // their stats and mastery levels, and pqDraw, the one renderer for the table and the picker.

    // Materials: [base, shadow edge, highlight line], then the average colour and the rod width
    // (px) under which the texture is drawn as that average, then the texture (sizes in mm).
    const PQ_MATS = {
        tipBlue: ['#3E73B8', '#22447A', '#7FA5DA'], tipBrown: ['#7A5233', '#42291A', '#A67E5A'], ferrule: ['#F1ECE0', '#BDB4A1', '#FFFFFF'],
        brassFerr: ['#C9A55A', '#7D6128', '#F3DE9E'], lacquer: ['#1A1B1D', '#060607', '#5A5D62'], rubber: ['#1C1D1F', '#0B0B0C', '#3A3C40'],
        brass: ['#C8A050', '#7A5C22', '#F5E2A6'], silver: ['#C9CDD2', '#7C838C', '#FFFFFF'], gold: ['#D4AF37', '#8A6A12', '#FFF0B0'],
        turquoise: ['#3FB5A9', '#1E6E66', '#8BE0D5'],
        maple: ['#E8D3A6', '#B08C5C', '#FAF0D8', '#E2CB9C', 28, { t: 'grain', c: '#CDAE78', w: 0.25, s: 1.6, wave: 0.6 }],
        birdseye: ['#E4C998', '#A9824F', '#F7E8C8', '#DCC08D', 36, { t: 'grain', c: '#C9A56E', w: 0.25, s: 1.8, wave: 0.5, eye: '#8E6A3A', eyeS: 3.4, eyeR: 0.55 }],
        flame: ['#E2B979', '#9E7440', '#F6DDB0', '#D8AE6E', 32, { t: 'grain', c: '#C89A5A', w: 0.3, s: 1.8, wave: 0.6, fig: '#B07E40', figS: 2.8 }],
        cocobolo: ['#9C4A22', '#5A2610', '#C9774A', '#8A4020', 24, { t: 'stripe', c: '#4A1E0C', w: 0.6, s: 2.4, wave: 1.4 }],
        ebony: ['#1E1A18', '#0A0908', '#4A423D', '#201C1A', 44, { t: 'grain', c: '#332C27', w: 0.3, s: 2.2, wave: 0.3 }],
        rosewood: ['#5E2A1C', '#30120A', '#8E4C36', '#52241A', 22, { t: 'stripe', c: '#2A0F08', w: 0.8, s: 3.0, wave: 1.8 }],
        zebrano: ['#D9BF8C', '#8F7448', '#F1E0BC', '#B39A6C', 16, { t: 'stripe', c: '#4B3520', w: 1.4, s: 4.2, wave: 1.0 }],
        tulipwood: ['#D98A6A', '#9A5034', '#F2B79C', '#D07F60', 22, { t: 'stripe', c: '#B9654A', w: 0.7, s: 2.8, wave: 1.2 }],
        ash: ['#E7D7B4', '#AE9568', '#F8EFD9', '#DFCDA6', 30, { t: 'ash', c: '#C3A675', w: 0.35, s: 3.0, ang: 26 }],
        walnut: ['#3B2318', '#1C0F09', '#6A4634', '#36201A', 36, { t: 'grain', c: '#2A170E', w: 0.4, s: 2.0, wave: 0.6 }],
        linenBlack: ['#1F2023', '#0B0B0C', '#44464B', '#26282B', 40, { t: 'linen', c: '#3A3C41', p: 0.9 }],
        linenNavy: ['#2F4060', '#152035', '#6A7FA3', '#56647E', 40, { t: 'linen', c: '#C8CED8', p: 0.9 }],
        pebble: ['#6B4529', '#33200F', '#9C7150', '#603D24', 40, { t: 'pebble', c: '#4E301A', size: 0.9 }],
        lizardRed: ['#6A1E18', '#320C08', '#A2483C', '#5C1A15', 40, { t: 'lizard', c: '#3E0F0B', size: 1.8 }],
        lizardBlk: ['#2A2C2F', '#0D0E0F', '#5C6066', '#232528', 40, { t: 'lizard', c: '#121315', size: 1.8 }],
        stitchBlk: ['#1D1C1B', '#0A0A09', '#4A4744', '#2A2826', 28, { t: 'stitched', c: '#E9DFC8', s: 3.2 }],
        stitchGold: ['#1D1C1B', '#0A0A09', '#4A4744', '#2C2822', 28, { t: 'stitched', c: '#D9B45A', s: 3.2 }],
        stack: ['#7A4A2A', '#3A200E', '#AE7A52', '#6A3F23', 16, { t: 'stack', c: '#4F2C16', ring: 2.0 }],
        carbon: ['#1E2023', '#08090A', '#5E646B', '#1F2125', 40, { t: 'carbon', c: '#2B2E33', c2: '#131416', cell: 1.2 }],
        flake: ['#2A2E34', '#0E1012', '#7A828C', '#3A3F46', 40, { t: 'flake', c: '#B8C0CA', size: 0.35 }],
        pearl: ['#EDE7DE', '#B7AFA4', '#FFFFFF', '#ECE9E2', 0, { t: 'pearl', c: '#E4EEF0', c2: '#F2E4EC', c3: '#E7ECD6' }],
        abalone: ['#4F8A86', '#234240', '#BFE3D6', '#5A8580', 0, { t: 'pearl', c: '#3E8E8A', c2: '#7A5BA8', c3: '#6FA65A' }],
        malachite: ['#1F7A52', '#0C3E28', '#58B88A', '#1A6A47', 20, { t: 'bands', c: '#0F4F33', s: 1.2 }],
        jasper: ['#2F5A3E', '#16301F', '#6E9A78', '#3F543B', 20, { t: 'spots', c: '#A82A22', size: 0.9 }],
    };
    // Sections: [from %, to %, material, sheen], measured from the tip.
    const pqStd = (sh, joint, fore, wrap, butt) => [[0, 0.9, 'tipBlue'], [0.9, 2.5, 'ferrule'], [2.5, 50, sh], [50, 51.5, joint, 1],
        [51.5, 72, fore], [72, 90, wrap], [90, 99, butt], [99, 100, 'rubber']];
    // Points and splices point at the tip, edged by veneers (outside in, [colour, mm]).
    const pqPts = (n, apex, core, veneers, o) => Object.assign({ n, apex, base: 71.5, rot: 0, w: n > 4 ? 0.82 : 0.85, core, veneers }, o);
    // bars: [power, aim, spin, time] at level 1 and at level 5. No cue is best at everything:
    // each has a bar of 6 or less, and none totals more than 32 of 40 (the user, 2026-10-05).
    // need: [game, tier, wins for levels 2, 3, 4 and 5]: the better the cue, the harder its wins
    // and the longer its climb (the user, 2026-10-05). See pqCounts.
    const PQ_SET = [
        { id: 'standard', name: 'Standard', cond: 'Always yours · the house cue', blurb: 'Maple shaft · black linen wrap', bars: [[4, 4, 4, 4], [5, 5, 5, 5]], need: ['pool', 'easy', [5, 7, 10, 15]],
            sections: pqStd('maple', 'brass', 'lacquer', 'linenBlack', 'walnut') },
        { id: 'tulipwood', name: 'Tulipwood', cond: 'Team Player · join the leaderboard', ach: 'teamPlayer', blurb: 'Tulipwood forearm · navy linen', bars: [[5, 5, 4, 4], [6, 6, 5, 5]], need: ['pool', 'easy', [5, 7, 11, 16]],
            sections: pqStd('maple', 'silver', 'tulipwood', 'linenNavy', 'tulipwood'), rings: [[72, 0.8, 'silver'], [90, 0.8, 'silver']] },
        { id: 'birdseye', name: 'Birdseye', cond: 'Office Gamer · earn XP in 50 game sessions', ach: 'gamer', blurb: 'Birdseye maple · pebble leather', bars: [[4, 5, 5, 5], [4, 7, 6, 6]], need: ['pool', 'normal', [5, 8, 11, 16]],
            sections: pqStd('maple', 'ebony', 'birdseye', 'pebble', 'birdseye'), rings: [[51.5, 0.8, 'brass'], [72, 0.8, 'brass'], [90, 0.8, 'brass']] },
        { id: 'ember', name: 'Ember', cond: 'On Fire · keep a 7-day work streak', ach: 'streak7', blurb: 'Flame maple · 4 points · lizard', bars: [[7, 4, 2, 4], [10, 6, 2, 6]], need: ['pool', 'normal', [5, 8, 12, 17]],
            sections: pqStd('maple', 'brass', 'flame', 'lizardRed', 'cocobolo'), rings: [[72, 1, 'brass'], [90, 1, 'brass']],
            points: [pqPts(4, 54, 'cocobolo', [['#121212', 0.5], ['#F2EEE4', 0.5], ['#A3262A', 0.6]])] },
        { id: 'rosewood6', name: 'Rosewood Six', cond: 'Level 25 · reach level 25', ach: 'level25', blurb: 'Maple · 6 rosewood points', bars: [[3, 7, 4, 6], [3, 9, 5, 8]], need: ['pool', 'hard', [5, 8, 12, 17]],
            sections: pqStd('maple', 'silver', 'maple', 'stitchBlk', 'rosewood'), rings: [[72, 0.8, 'silver'], [90, 0.8, 'silver']],
            points: [pqPts(6, 53, 'rosewood', [['#121212', 0.5], ['#2C6E49', 0.5], ['#F2EEE4', 0.5]])] },
        { id: 'carbonfin', name: 'Carbon Fin', cond: 'Pool Shark · win 100 pool games against the CPU', ach: 'poolShark', blurb: 'Carbon shaft · stacked leather', bars: [[6, 4, 7, 3], [8, 5, 10, 3]], need: ['pool', 'hard', [5, 9, 13, 18]],
            sections: pqStd('carbon', 'silver', 'ebony', 'stack', 'flake'), rings: [[72, 0.8, 'silver'], [90, 0.8, 'silver']],
            points: [pqPts(4, 55, 'zebrano', [['#F2EEE4', 0.6], ['#121212', 0.5]])] },
        { id: 'malachite', name: 'Malachite', cond: 'Called It · beat the Pro pool CPU', ach: 'calledIt', blurb: 'Malachite points · black lizard', bars: [[4, 7, 7, 4], [4, 9, 9, 5]], need: ['pool', 'pro', [5, 9, 13, 18]],
            sections: pqStd('maple', 'silver', 'ebony', 'lizardBlk', 'ebony'), rings: [[72, 0.8, 'silver'], [89.05, 0.8, 'silver'], [89.45, 3, 'malachite'], [89.85, 0.8, 'silver']],
            points: [pqPts(4, 53, 'malachite', [['#C9CDD2', 0.5], ['#121212', 0.5], ['#F2EEE4', 0.5]], { inlay: { shape: 'window', mat: 'turquoise', size: 7, at: 0.45 } })],
            inlays: [{ at: 94.5, n: 4, shape: 'diamond', size: 7, mat: 'malachite', rot: 45 }] },
        { id: 'centuryash', name: 'Century Ash', cond: 'Century · make a century break against the snooker CPU', ach: 'snookerCentury', blurb: 'Ash shaft · 4 ebony splices', bars: [[5, 8, 4, 7], [5, 10, 5, 8]], need: ['snooker', 'hard', [5, 9, 14, 19]],
            sections: [[0, 0.9, 'tipBrown'], [0.9, 2.5, 'brassFerr'], [2.5, 70, 'ash'], [70, 99, 'ebony'], [99, 100, 'rubber']],
            rings: [[70, 2, 'pearl'], [76, 1, 'brass'], [98.5, 1, 'brass']],
            points: [pqPts(4, 40, 'ebony', [['#EFE3C6', 0.6], ['#121212', 0.4]], { base: 70, w: 0.92 }), pqPts(4, 62, 'ebony', [['#EFE3C6', 0.6]], { base: 70, rot: 45, w: 0.6 })],
            inlays: [{ at: 95, n: 4, shape: 'dot', size: 4, mat: 'abalone', rot: 0 }] },
        { id: 'crown', name: 'Black Crown', cond: 'Maximum · make a 147 against the snooker CPU', ach: 'snookerMaximum', blurb: 'Ebony · 6 abalone points', bars: [[7, 7, 5, 6], [9, 9, 6, 6]], need: ['snooker', 'pro', [5, 10, 14, 19]], sheen: 1,
            sections: pqStd('maple', 'gold', 'ebony', 'stitchGold', 'ebony'), rings: [[51.5, 1, 'pearl'], [72, 1, 'gold'], [90, 1, 'gold'], [98.5, 1, 'gold']],
            points: [pqPts(6, 53, 'abalone', [['#D4AF37', 0.5], ['#121212', 0.5], ['#F2EEE4', 0.5]], { inlay: { shape: 'window', mat: 'jasper', size: 6, at: 0.42 } })],
            inlays: [{ at: 94.5, n: 6, shape: 'diamond', size: 6, mat: 'pearl', rot: 0 }] },
        // Not in the design: the design's own vocabulary, for mastering five cues.
        { id: 'collector', name: 'Collector', cond: 'Master 5 cues', blurb: 'Ebony · pearl and abalone points · lizard', bars: [[8, 7, 7, 5], [9, 9, 8, 6]], need: ['snooker', 'pro', [5, 10, 15, 20]], sheen: 1,
            sections: pqStd('maple', 'gold', 'ebony', 'lizardRed', 'ebony'), rings: [[51.5, 1, 'abalone'], [71.4, 0.8, 'gold'], [72.4, 1.2, 'pearl'], [89.6, 1.2, 'pearl'], [90.6, 0.8, 'gold'], [98.5, 1, 'gold']],
            points: [pqPts(4, 52, 'pearl', [['#D4AF37', 0.5], ['#121212', 0.5], ['#3FB5A9', 0.4]], { inlay: { shape: 'diamond', mat: 'gold', size: 5, at: 0.4 } }),
                pqPts(4, 63, 'abalone', [['#D4AF37', 0.4], ['#121212', 0.4]], { rot: 45, w: 0.55 })],
            inlays: [{ at: 94.5, n: 4, shape: 'dot', size: 4, mat: 'pearl', rot: 0 }, { at: 94.5, n: 4, shape: 'diamond', size: 5, mat: 'abalone', rot: 45 }] },
    ];
    const pqById = id => PQ_SET.find(q => q.id === id) || PQ_SET[0];
    // [length, tip, butt] in ball diameters, and the ball in mm.
    const PQ_GAME = { pool: [25.7, 0.23, 0.52, 57], snooker: [27.6, 0.19, 0.55, 52.5] };
    // Diameter (D) at s = 0..1 from the tip: level through tip and ferrule, a 1.25-power taper,
    // and the bumper at 92 % of the butt.
    function pqDia(G, s) {
        if (s <= 0.025) return G[1];
        if (s >= 0.99) return G[2] * 0.92;
        return G[1] + (G[2] - G[1]) * Math.pow((s - 0.025) / 0.965, 1.25);
    }

    // ── Stats and mastery ─────────────────────────────────────────────
    // Wins against the CPU with a cue raise it a level, but only wins at its tier or above, and
    // for a snooker cue only snooker's (pool cues take snooker wins too: the harder game).
    const PQ_TIERS = ['easy', 'normal', 'hard', 'pro'];
    const pqSteps = q => q.need[2].reduce((out, n) => out.concat(out[out.length - 1] + n), [0]);
    const pqLevel = (wins, q) => pqSteps(q).filter(n => (wins || 0) >= n).length;
    const pqCounts = (q, game, tier) => PQ_TIERS.indexOf(tier) >= PQ_TIERS.indexOf(q.need[1]) && (q.need[0] === 'pool' || game === 'snooker');
    // "Hard+ wins", "Pro snooker wins", or "CPU wins" when any counts.
    function pqNeedText(q) {
        const t = q.need[1], T = t.charAt(0).toUpperCase() + t.slice(1) + (t === 'pro' ? '' : '+');
        return q.need[0] === 'snooker' ? T + ' snooker wins' : t === 'easy' ? 'CPU wins' : T + ' wins';
    }
    // Each bar above or below 4 moves its stat a step: Standard (4/4/4/4) is the game as it was.
    const PQ_STEP = [0.025, 0.125, 0.05, 0.05];
    // Every level-up adds at least one bar point. (Rounding the straight line from level 1 to 5
    // lost some: a bar gaining 1 moved only at level 3.) The cue's gains are dealt out one at a
    // time, round-robin, its biggest first; level n has round(total × (n − 1) / 4) of them.
    function pqStats(id, wins, level) {
        const q = pqById(id), lv = level || pqLevel(wins, q), bars = q.bars[0].slice();
        const left = q.bars[1].map((v, i) => Math.max(0, v - bars[i])), total = left.reduce((a, b) => a + b, 0);
        const order = [0, 1, 2, 3].sort((a, b) => left[b] - left[a] || a - b), steps = [];
        while (steps.length < total) order.forEach(i => { if (left[i] > 0) { left[i]--; steps.push(i); } });
        steps.slice(0, Math.round(total * (lv - 1) / 4)).forEach(i => { bars[i]++; });
        const m = bars.map((b, i) => 1 + PQ_STEP[i] * (b - 4));
        return { id: q.id, level: lv, bars, power: m[0], aim: m[1], spin: m[2], time: m[3] };
    }
    // The CPU's cue for its tier (the user, 2026-10-05): only power and spin change its play.
    const PQ_CPU = { easy: ['standard', 1], normal: ['tulipwood', 3], hard: ['malachite', 3], pro: ['crown', 5] };
    const pqCpuStats = (tier, game) => {
        const c = tier === 'hard' && game === 'snooker' ? ['centuryash', 3] : PQ_CPU[tier] || PQ_CPU.easy;
        return pqStats(c[0], 0, c[1]);
    };
    const pqMastered = rec => PQ_SET.filter(q => q.id !== 'collector' && pqLevel(rec && rec[q.id], q) >= 5).length;
    // Achievements unlock the designed cues; mastering five unlocks Collector.
    const pqUnlocked = (q, achievements, rec) => (q.ach ? (achievements || []).indexOf(q.ach) >= 0 : q.id !== 'collector' || pqMastered(rec) >= 5);

    // ── The renderer ──────────────────────────────────────────────────
    // A 10-sided rod lit from above: five facets face the viewer. Their edges across the rod's
    // width, and their normals from the viewer toward +w.
    const PQ_EDGES = [0, 0.095, 0.345, 0.655, 0.905, 1];
    const PQ_FACETS = [72, 36, 0, -36, -72].map(d => d * Math.PI / 180);
    const PQ_TILES = new Map();
    const pqMix = (a, b, t) => {
        const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
        return '#' + [16, 8, 0].map(s => { const x = (p >> s) & 255; return Math.round(x + (((q >> s) & 255) - x) * t).toString(16).padStart(2, '0'); }).join('');
    };

    // A texture's repeating tile, once per material and scale: x along the rod, y across it.
    function pqTile(key, m, q, mk) {
        const id = key + '@' + q;
        if (PQ_TILES.has(id)) return PQ_TILES.get(id);
        const T = m[5], rows = Math.max(1, Math.ceil(6 / (T.s || 6)));
        const size = {
            grain: [T.fig ? T.figS * 8 : 24, T.s * rows], ash: [T.s, 8], linen: [T.p, T.p], pebble: [T.size, T.size], lizard: [T.size * 1.2, T.size],
            stitched: [T.s, 11], stack: [T.ring, 1], carbon: [T.cell * 2.83, T.cell * 2.83], flake: [T.size * 9, T.size * 7], bands: [T.s * 8, T.s * 4],
            spots: [T.size * 3, T.size * 2.4], pearl: [12, 1],
        }[T.t === 'stripe' ? 'grain' : T.t];
        const W = Math.max(2, Math.round(size[0] * q)), H = Math.max(2, Math.round(size[1] * q));
        const cv = mk(W, H), c = cv.getContext('2d'), tw = size[0], th = size[1];
        c.scale(W / tw, H / th);
        c.fillStyle = m[0]; c.fillRect(0, 0, tw, th);
        const rgba = (a, hex) => pgRgba(hex || T.c, a);
        const dot = (x, y, r, style) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = style; c.fill(); };
        // Bands where (x ∓ y) mod L lies in [L/2, L), for twills and weaves.
        const diag = (L, flip, style) => {
            c.fillStyle = style; c.beginPath();
            for (let k = -2; k <= 2; k++) {
                const d1 = k * L + L / 2, d2 = d1 + L / 2, Y = y => (flip ? th - y : y);
                c.moveTo(d1 - L * 3, Y(-L * 3)); c.lineTo(d1 + L * 3, Y(L * 3)); c.lineTo(d2 + L * 3, Y(L * 3)); c.lineTo(d2 - L * 3, Y(-L * 3)); c.closePath();
            }
            c.fill();
        };
        const wave = (y, amp, ph, lw, style) => {
            c.beginPath();
            for (let x = 0; x <= tw + 0.01; x += tw / 24) { const yy = y + amp * Math.sin(2 * Math.PI * x / tw + ph); x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
            c.lineWidth = lw; c.strokeStyle = style; c.stroke();
        };
        const t = T.t;
        if (t === 'grain' || t === 'stripe') {
            const a = t === 'stripe' ? 0.8 : 0.5;
            if (T.fig) for (let x = 0; x < tw; x += T.figS) { c.fillStyle = rgba(0.4, T.fig); c.fillRect(x + T.figS * 0.15, 0, T.figS * 0.4, th); }
            for (let i = 0; i < rows; i++) {
                [-th, 0, th].forEach(o => {
                    wave(o + (i + 0.3) * T.s, T.wave * 0.35, i * 1.7, T.w, rgba(a));
                    wave(o + (i + 0.8) * T.s, T.wave * 0.25, i * 2.3 + 1, T.w * 0.7, rgba(a * 0.6));
                });
            }
            if (T.eye) for (let i = 0; i < 4; i++) dot((i * 0.27 + (i % 2) * 0.5) % 1 * tw, (i + 0.5) / 4 * th, T.eyeR, rgba(0.85, T.eye));
        } else if (t === 'ash') {
            const d = th / 2 * Math.tan(T.ang * Math.PI / 180);
            [-tw, 0, tw].forEach(o => { c.beginPath(); c.moveTo(o, 0); c.lineTo(o + d, th / 2); c.lineTo(o, th); c.lineWidth = T.w; c.strokeStyle = rgba(0.55); c.stroke(); });
        } else if (t === 'linen') {
            diag(tw, false, rgba(0.5)); diag(tw, true, rgba(0.35));
        } else if (t === 'pebble') {
            dot(tw / 2, th / 2, tw * 0.3, rgba(0.65)); dot(tw * 0.35, th * 0.35, tw * 0.18, 'rgba(255, 255, 255, 0.16)');
        } else if (t === 'lizard') {
            [[tw / 2, 0], [0, th / 2], [tw, th / 2], [tw / 2, th]].forEach(([x, y]) => {
                c.beginPath(); c.ellipse(x, y, tw * 0.42, th * 0.4, 0, 0, Math.PI); c.lineWidth = th * 0.12; c.strokeStyle = rgba(0.75); c.stroke();
            });
        } else if (t === 'stitched') {
            c.fillStyle = rgba(0.9); c.fillRect(tw * 0.45, 3, tw * 0.55, 0.5); c.fillRect(tw * 0.45, 8, tw * 0.55, 0.5);
        } else if (t === 'stack') {
            c.fillStyle = rgba(0.85); c.fillRect(tw - 0.3, 0, 0.3, th);
        } else if (t === 'carbon') {
            c.fillStyle = T.c; c.fillRect(0, 0, tw, th); diag(tw, false, T.c2); diag(tw, true, 'rgba(0, 0, 0, 0.28)');
        } else if (t === 'flake') {
            dot(tw * 0.2, th * 0.25, T.size, rgba(0.9)); dot(tw * 0.65, th * 0.7, T.size * 0.8, rgba(0.6)); dot(tw * 0.85, th * 0.15, T.size * 0.6, rgba(0.5));
        } else if (t === 'bands') {
            for (let i = 0; i < 4; i++) [-th, 0, th].forEach(o => wave(o + (i + 0.5) * T.s, T.s * 0.4, i, T.s * 0.5, rgba(0.7)));
        } else if (t === 'spots') {
            dot(tw / 2, th / 2, T.size / 2, rgba(0.85));
        } else if (t === 'pearl') {
            const g = c.createLinearGradient(0, 0, tw, 0);
            [[0, T.c], [0.35, T.c2], [0.65, T.c3], [1, T.c]].forEach(s => g.addColorStop(s[0], s[1]));
            c.fillStyle = g; c.fillRect(0, 0, tw, th);
        }
        const tile = { cv, sx: tw / W, sy: th / H };
        PQ_TILES.set(id, tile);
        return tile;
    }

    // Draws a cue. V maps it to the screen:
    //   pt(s, w)    the rod's point at s (0 tip … 1 butt), w ball diameters to the side
    //   scr(p)      that point on screen as [x, y], or null; poly(pts) a polygon to screen points
    //   light       [toward the viewer, toward +w]: where the light sits in the cross-section
    //   t           ms, for the sheen (null: none); mk(w, h) a canvas, for textures (else flat)
    function pqDraw(ctx, cue, game, V) {
        const G = PQ_GAME[game] || PQ_GAME.pool, Lmm = G[0] * G[3];
        const r = s => pqDia(G, s) / 2;
        const lam = Math.atan2(V.light[1], V.light[0]);
        const M = k => PQ_MATS[k] || [k, k, k];
        const trace = pts => {
            const p = V.poly(pts);
            if (p.length < 3) return false;
            ctx.beginPath(); pgTrace(ctx, p);
            return true;
        };
        // The rod's frame at s on screen: the side (+w) edge, the far edge, and px per mm.
        const frame = s => {
            const a = V.scr(V.pt(s, r(s))), b = V.scr(V.pt(s, -r(s)));
            return a && b ? { a, b, px: Math.hypot(b[0] - a[0], b[1] - a[1]) } : null;
        };
        const pattern = (key, m, f, s) => {
            if (!f || !m[5] || f.px < m[4] || !V.mk || !ctx.createPattern) return null;
            const k = f.px / (2 * r(s) * G[3]), q = Math.min(16, Math.max(2, Math.pow(2, Math.ceil(Math.log2(k)))));
            const tile = pqTile(key, m, q, V.mk), pat = ctx.createPattern(tile.cv, 'repeat');
            const o = V.scr(V.pt(s, 0)), o2 = V.scr(V.pt(Math.min(1, s + 0.01), 0));
            if (!pat || !o || !o2 || typeof DOMMatrix !== 'function') return pat;
            const ax = o2[0] - o[0], ay = o2[1] - o[1], al = Math.hypot(ax, ay) || 1;
            const ex = [ax / al, ay / al], ey = [(f.b[0] - f.a[0]) / f.px, (f.b[1] - f.a[1]) / f.px];
            pat.setTransform(new DOMMatrix([ex[0] * k * tile.sx, ex[1] * k * tile.sx, ey[0] * k * tile.sy, ey[1] * k * tile.sy, f.a[0], f.a[1]]));
            return pat;
        };
        // Material at s, turned c (cos) toward the viewer: its texture, else its flat colour.
        const paint = (key, f, s, c) => {
            const m = M(key);
            return pattern(key, m, f, s) || pqMix(m[3] || m[0], m[1], Math.max(0, 1 - c) * 0.55);
        };
        const shade = (m, f, textured) => {
            const g = ctx.createLinearGradient(f.a[0], f.a[1], f.b[0], f.b[1]);
            PQ_FACETS.forEach((n, i) => {
                const c = Math.cos(n - lam), hi = c >= 0.6, a = Math.min(1, hi ? (c - 0.6) / 0.4 : (0.6 - c) / 1.1) * (textured ? 0.6 : 1);
                const col = pgRgba(hi ? m[2] : m[1], Math.round(a * 1000) / 1000);
                g.addColorStop(PQ_EDGES[i] + (i ? 0.01 : 0), col);
                g.addColorStop(PQ_EDGES[i + 1] - (i < 4 ? 0.01 : 0), col);
            });
            return g;
        };
        // One slow band along the inlays and rings: 7 s a cycle, moving for 72 % of it.
        let band = null;
        if (cue.sheen && V.t != null) {
            const p = (V.t % 7000) / 7000;
            if (p < 0.72) { const e = p / 0.72, x = -0.08 + 1.08 * e * e * (3 - 2 * e); band = [x, x + 0.06]; }
        }
        const sheen = (a, b) => {
            if (!band || b < band[0] || a > band[1]) return;
            const p = V.scr(V.pt(band[0], 0)), q = V.scr(V.pt(band[1], 0));
            if (!p || !q) return;
            const g = ctx.createLinearGradient(p[0], p[1], q[0], q[1]);
            [[0, 'rgba(233, 196, 106, 0)'], [0.3, 'rgba(233, 196, 106, 0.35)'], [0.5, 'rgba(255, 246, 222, 0.92)'], [0.7, 'rgba(233, 196, 106, 0.35)'], [1, 'rgba(233, 196, 106, 0)']]
                .forEach(st => g.addColorStop(st[0], st[1]));
            ctx.fillStyle = g; ctx.fill();
        };
        // A stretch of rod, a dome on the tip and a bumper on the butt, its taper in short steps.
        const part = (a, b, key, glint) => {
            a = Math.max(0, a); b = Math.min(1, b);
            if (b <= a) return;
            const top = [], bot = [], n = Math.ceil((b - a) / 0.15);
            for (let i = 0; i <= n; i++) { const s = a + (b - a) * i / n; top.push(V.pt(s, r(s))); bot.unshift(V.pt(s, -r(s))); }
            const cap = (s, len, dir) => { const out = []; for (let i = 1; i < 6; i++) { const th = Math.PI * i / 6; out.push(V.pt(s + dir * len * Math.sin(th), r(s) * Math.cos(th))); } return out; };
            const pts = top.concat(b >= 1 ? cap(1, 0.45 * r(1) / G[0], 1) : [], bot, a <= 0 ? cap(0, 0.03 / G[0], -1).reverse() : []);
            if (!trace(pts)) return;
            const m = M(key), s = (a + b) / 2, f = frame(s), pat = pattern(key, m, f, s);
            ctx.fillStyle = pat || m[3] || m[0]; ctx.fill();
            if (f) { ctx.fillStyle = shade(m, f, !!pat); ctx.fill(); }
            if (glint) sheen(a, b);
        };
        // A small shape on the rod's surface: centre (s, w), half sizes along (mm) and across (D).
        const inlay = (shape, s, w, hl, hw, key, c) => {
            const d = hl / Lmm, k = shape === 'diamond' ? [[-1, 0], [0, 1], [1, 0], [0, -1]]
                : shape === 'dot' ? [0, 1, 2, 3, 4, 5, 6, 7].map(i => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]) : [[-1, -1], [-1, 1], [1, 1], [1, -1]];
            if (!trace(k.map(p => V.pt(s + p[0] * d, w + p[1] * hw)))) return;
            ctx.fillStyle = paint(key, frame(s), s, c); ctx.fill();
            sheen(s - d, s + d);
        };
        (cue.sections || []).forEach(x => part(x[0] / 100, x[1] / 100, x[2], cue.sheen && x[3]));
        (cue.rings || []).forEach(x => { const h = x[1] / 2 / Lmm; part(x[0] / 100 - h, x[0] / 100 + h, x[2], cue.sheen); });
        (cue.points || []).forEach(P => {
            const aS = P.apex / 100, bS = P.base / 100, rB = r(bS);
            let e = P.veneers.reduce((t, v) => t + v[1], 0);
            const layers = P.veneers.map(v => { const l = { col: v[0], e }; e -= v[1]; return l; }).concat([{ col: P.core, e: 0 }]);
            for (let i = 0; i < P.n; i++) {
                const th = (P.rot + i * 360 / P.n) * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th);
                if (c < 0.08) continue;
                layers.forEach(ly => {
                    const hw = ((Math.PI * rB * G[3] / P.n) * P.w + ly.e) / G[3] * c, ap = aS - ly.e * 4 / Lmm, wc = sn * rB;
                    if (!trace([V.pt(ap, sn * r(ap)), V.pt(bS, Math.min(rB, wc + hw)), V.pt(bS, Math.max(-rB, wc - hw))])) return;
                    ctx.fillStyle = ly.col.charAt(0) === '#' ? ly.col : paint(ly.col, frame((ap + bS) / 2), (ap + bS) / 2, c); ctx.fill();
                });
                if (P.inlay) {
                    const N = P.inlay, s = bS - (bS - aS) * N.at;
                    inlay(N.shape, s, sn * r(s), N.size / 2, N.size * (N.shape === 'window' ? 0.2 : 0.3) * c / G[3], N.mat, c);
                }
            }
        });
        (cue.inlays || []).forEach(N => {
            const s = N.at / 100;
            for (let i = 0; i < N.n; i++) {
                const th = (N.rot + i * 360 / N.n) * Math.PI / 180, c = Math.cos(th);
                if (c >= 0.1) inlay(N.shape, s, Math.sin(th) * r(s), N.size / 2, N.size * (N.shape === 'diamond' ? 0.35 : 0.5) * c / G[3], N.mat, c);
            }
        });
    }

    // A cue drawn flat and side on, as the picker shows it: x0..x0 + len px across, centred on cy,
    // or only the stretch from..to (0..1) blown up to fill len.
    function pqDrawFlat(ctx, cue, game, x0, cy, len, from, to, t, mk) {
        const G = PQ_GAME[game] || PQ_GAME.pool, f = from || 0, span = (to == null ? 1 : to) - f, k = len / span, D = k / G[0];
        ctx.save();
        ctx.beginPath(); ctx.rect(x0 - 2, cy - D, len + 4, 2 * D); ctx.clip();
        pqDraw(ctx, cue, game, {
            pt: (s, w) => [x0 + (s - f) * k, cy - w * D], scr: p => p, poly: p => p, light: [0.62, 0.78], t, mk,
        });
        ctx.restore();
    }
