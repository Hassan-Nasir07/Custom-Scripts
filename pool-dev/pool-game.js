    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — GAME (v2)
    // ═══════════════════════════════════════════════════════════════════
    // The controller: runs the match and ties physics, rules, camera, renderer, HUD and CPU
    // into the host's panel. Pool and snooker share it; what differs is one profile in
    // POOL_GAMES, and poolRules() is the one being played.
    //
    // Host API:
    //   initPoolGame()        switchGame opened the panel: build once, keep the frame, attach
    //   poolDetach()          switchGame left: stop the loop, drop window listeners, close Max
    //   resetPoolGame()       a fresh rack
    //   togglePoolMode()      Vs CPU ⇄ 2 Players (from a tournament: the mode before it)
    //   togglePoolMaximize()  the Max view, through the shared toggleGameMaxModal
    //   poolOnThemeChange()   applyPreferences ran: re-read the theme tokens
    //   poolWinsByTier()      CPU wins by each frame's locked tier (leaderboard, achievements)
    //   poolSetVariant(game)  'pool' | 'snooker': parks this frame, brings the other's back
    //   poolToggleVariant()   the header's switch, remembered (poolVariant)
    //   poolOnPrefChange(p)   a ⚙️ setting changed (CPU difficulty, shot clock, snooker's reds)
    //   poolRenderTitle(el)   the panel header: the game's name behind the 🎱 | 🔴 switch
    //   poolCueUnlocked(id)   unlockAchievement ran: the cue it earns (or null), noticed on the table
    //   poolMode, poolGamesWon, poolMaximized, poolRecord, poolCpuTier
    //
    // Input:
    //   3D     sideways mouse turns the aim (0.3°/px, Shift finer), even off the table
    //   2D     point at the target
    //   power  press, then pull back or push along the shot line; under 3% or Esc cancels
    //   ←/→    fine aim while the table has the mouse or Max is open
    //   ball in hand: drag the cue ball; it stops at the cushions (and the head string on the break)
    // Tournaments (pool-tour.js, pool-tour-ui.js): poolMode 'tour' while a match is on the
    // table; the bracket is saved after every frame, with a table snapshot after every shot.
    // Escape never resets the frame: it cancels a power drag, else Max's own handler closes Max.

    const POOL_CLOCK_S = 30;                 // shot clock for human turns, in seconds
    const POOL_AIM_REACH = 240;              // px past the table's edge the aim keeps following
    const POOL_DEAD_PX = 4;                  // power drag dead zone
    const POOL_STRIKE_MS = 90;               // the cue's forward stroke before the ball launches
    const POOL_TOAST_MS = 2200;
    const POOL_POT_XP = 5;
    // Frame XP: a CPU win by its tier, 2 Players pays Player 1, a tournament match the YOU seat only.
    const POOL_WIN_XP = { easy: 60, normal: 80, hard: 100, pro: 120 };
    const POOL_LOSS_XP = 15, POOL_PVP_WIN_XP = 80, POOL_TOUR_WIN_XP = 80;
    // Snooker: a CPU win by tier and reds, a loss 20, plus a bonus for your best break, won or
    // lost. At most 180 + 50 = 230 a frame, inside the bot's 250 a game. No pot pays.
    const POOL_SNK_WIN_XP = {
        15: { easy: 90, normal: 120, hard: 150, pro: 180 },
        10: { easy: 75, normal: 100, hard: 125, pro: 150 },
        6: { easy: 60, normal: 80, hard: 100, pro: 120 },
    };
    const POOL_SNK_LOSS_XP = 20;
    const poolSnkBreakBonus = h => (h >= 147 ? 50 : h >= 100 ? 25 : h >= 50 ? 10 : 0);
    // A break can be no bigger than a 15-red frame with a free ball (8 + 15 × 8 + 27).
    const POOL_SNK_BREAK_CAP = 155;
    const POOL_MAX_W = 1280, POOL_MAX_H = 800;
    const POOL_DEG = Math.PI / 180;
    const POOL_RESULT_MS = 1100;             // the last pot drops before the match result covers the table

    // ── Games ─────────────────────────────────────────────────────────
    // Everything the controller asks of a game. Nothing below this block names a game's
    // rules, CPU or storage directly (pool-verify.js checks it).
    const POOL_GAMES = {
        pool: {
            id: 'pool', title: '8-Ball Pool', icon: 'g-pool', lb: 'pool', xpType: 'pool', diffPref: 'poolDifficulty', diffs: PH_DIFFS,
            keys: { cpuRec: 'poolCpuRecord', byTier: 'poolWinsByTier', tour: 'poolTournament', cab: 'poolTrophyCabinet' },
            clock: POOL_CLOCK_S,
            // ⚙️ Shot Clock choices for a quick frame (0 is off).
            clockPref: 'poolClock', clocks: [30, 45, 0],
            // Aim steps: ←/→ and the Shift fine aim, in degrees.
            aimKey: 0.1, aimFine: 0.05,
            record: () => poolRecord,
            world: () => ppCreateWorld(),
            rack: (w, rng) => ppRack(w, rng),
            // Inside the kitchen, not on its line, so a press on the ball never rounds past it.
            cueHome: w => [w.table.headX - 80, 0],
            newFrame: o => prNewFrame({ breaker: o.breaker, callEvery: o.callEvery }),
            status: (f, w, seat) => prStatus(f, w, seat),
            judge: (f, w, pick) => prJudge(f, w, pick.call),
            // The frame's call rule: every shot at pro, or as the tournament sets it.
            lockCall: (f, tier) => { f.callEvery = poolS.callEvery || (poolMode === 'cpu' && !!tier.callEvery); },
            // After the verdict, before the next turn: the 8 potted on the break comes back.
            apply: (w, v) => { if (v.respot8) prSpotBall(w, 8); },
            timeout: f => prTimeout(f),
            text: (v, names) => prText(v, names),
            // May this ball be hit first? (the aim-at-nearest pick and the illegal-target sign)
            legal: (f, w, id) => {
                const st = prStatus(f, w);
                if (f.isBreak) return true;
                if (st.onThe8) return id === 8;
                if (id === 8) return false;
                return !st.group || prGroupOf(id) === st.group;
            },
            canPlace: (w, x, y, zone) => prCanPlace(w, x, y, zone),
            clampPlace: (w, x, y, zone) => prClampPlace(w, x, y, zone),
            placeCue: (w, x, y) => prPlaceCue(w, x, y),
            // Balls a card lists as potted on an open table (the 8 comes back on the break).
            tracksPot: id => id > 0 && id < 16 && id !== 8,
            ballCount: () => 16,
            validFrame: f => !!f && f.v === 1 && (f.turn === 1 || f.turn === 2) && !f.over,
            tourDefaults: { game: 'pool', call: '8', calls: [['8', '8 only'], ['every', 'Every shot']] },
            cpu: { tiers: PA_TIERS, names: PA_TIER_NAMES, plan: paPlan, place: paPlace, tierFor: paTierFor, adaptive: paAdaptiveTier },
            potXP: POOL_POT_XP,
            frameXP: c => (!c.won ? POOL_LOSS_XP : c.vsCPU ? POOL_WIN_XP[c.tier] || POOL_WIN_XP.normal : POOL_PVP_WIN_XP),
            xpPerf: () => ({}),
            // Quick-frame records, through the host's storage helpers. Seat 1 is you.
            fileResult: (w, vsCPU, tier) => {
                if (!poolRecord) poolRecord = loadPoolRecord();
                // Seed the per-mode split before the all-time count moves; seeded after,
                // it would copy this win in and then count it again.
                loadPoolWinsByMode();
                if (w === 1) {
                    poolGamesWon++;
                    savePoolHighScore(poolGamesWon);
                    savePoolWinByMode(poolMode);
                    // Filed before the award: the award's achievement check and the wins button read it.
                    if (vsCPU) poolRecordTierWin(tier);
                    poolRecord.p1Wins++; poolRecord.p2Losses++;
                    savePoolRecord(poolRecord);
                } else if (w === 2) {
                    poolRecord.p2Wins++; poolRecord.p1Losses++;
                    savePoolRecord(poolRecord);
                }
            },
            // Online (pool-net.js): your frames won and lost, and a win counts all-time too.
            netRecord: () => poolStoreRead('poolNetRecord', { wins: 0, losses: 0 }),
            fileNet: won => {
                loadPoolWinsByMode();
                const rec = poolStoreRead('poolNetRecord', { wins: 0, losses: 0 });
                if (won) { poolGamesWon++; savePoolHighScore(poolGamesWon); savePoolWinByMode('net'); rec.wins++; } else rec.losses++;
                poolStoreWrite('poolNetRecord', rec);
            },
            // The wins button: the tier being played, 2 Players, or (a tournament has no board) all CPU wins.
            wins: () => {
                const byMode = loadPoolWinsByMode();
                if (poolMode === 'net') return byMode.online;
                if (poolMode === 'pvp') return byMode.pvp;
                if (poolMode === 'cpu') return poolWinsByTier()[poolCpuTier] || 0;
                return byMode.cpu;
            },
        },
        // Snooker (pool-snooker.js; CPU pool-snooker-ai.js): 147 rules, a nominated colour, the
        // choice after a foul, and a quick frame that survives a reload.
        snooker: {
            id: 'snooker', title: 'Snooker', icon: 'snooker', lb: 'snooker', xpType: 'snooker', diffPref: 'snookerDifficulty', diffs: PH_SNK_DIFFS,
            keys: { cpuRec: 'snookerCpuRecord', byTier: 'snookerWinsByTier', tour: 'snookerTournament', cab: 'snookerTrophyCabinet', frame: 'snookerFrame' },
            // True scale: aiming is slower, so a longer clock and finer aim steps.
            clock: 45, aimKey: 0.025, aimFine: 0.0125,
            clockPref: 'snookerClock', clocks: [30, 45, 60, 0],
            rackPref: 'snookerReds',
            aimClear: true,
            world: () => psCreateWorld(),
            rack: (w, rng) => psRack(w, rng, POOL_GAMES.snooker.framesReds()),
            cueHome: w => psCueHome(w),
            newFrame: o => psNewFrame({ breaker: o.breaker, reds: POOL_GAMES.snooker.framesReds(), seed: o.seed }),
            status: (f, w, seat) => psStatus(f, w, seat || f.turn, poolS.nom),
            judge: (f, w, pick) => psJudge(f, w, pick.nominate, pick.call),
            // Call pocket: a picked tier's (Adaptive changes no rule), the tournament's, none in 2 Players.
            lockCall: (f, tier) => { f.call = poolMode === 'tour' ? poolS.callMode : poolMode === 'cpu' && poolDifficulty() !== 'adaptive' ? (tier.call || 'off') : 'off'; },
            apply: (w, v) => psApplySpots(w, v.spots),
            timeout: (f, w) => psTimeout(f, w, poolS.nom),
            text: (v, names) => psText(v, names),
            // Just before the strike: the balls touching the cue ball at rest (touching ball).
            prime: (f, w) => Object.assign({}, f, { touching: psTouching(w.balls, w.cfg.ballR) }),
            // May be hit first: the ball on; before a nomination, any nominable one (for aim-at-nearest).
            legal: (f, w, id) => {
                const on = psStatus(f, w, f.turn, poolS.nom).on;
                return on.needsNomination && on.nominated < 0 ? on.nominable.indexOf(id) >= 0 : on.ids.indexOf(id) >= 0;
            },
            canPlace: (w, x, y, zone) => prCanPlace(w, x, y, zone),
            clampPlace: (w, x, y, zone) => prClampPlace(w, x, y, zone),
            placeCue: (w, x, y) => prPlaceCue(w, x, y),
            tracksPot: () => false,
            ballCount: f => 7 + psRedsOf(f && f.reds),
            validFrame: f => !!f && f.v === 1 && f.game === 'snooker' && (f.turn === 1 || f.turn === 2) && !f.over && PS_REDS.indexOf(f.reds) >= 0 && (f.call === undefined || PS_CALLS.indexOf(f.call) >= 0),
            tourDefaults: { game: 'snooker', reds: 15, call: 'off', calls: [['off', 'Off'], ['colours', 'Colours'], ['all', 'All balls']] },
            // A tournament frame's score and best breaks, for the bracket's result screen.
            tourFrame: v => ({ points: [v.next.scores[1], v.next.scores[2]], high: [v.next.high[1], v.next.high[2]] }),
            // The reds a frame racks: the tournament's own, else ⚙️'s.
            framesReds: () => psRedsOf(poolMode === 'tour' && poolS.tour.t && poolS.tour.t.settings.reds ? poolS.tour.t.settings.reds
                : poolMode === 'net' && poolS.netRoom ? poolS.netRoom.reds : +userPreferences.snookerReds),
            // After a foul, and giving the frame away.
            choose: (f, id) => psChoose(f, id),
            choices: (p, names) => psChoiceText(p, names),
            choiceNotice: (p, id, names) => psChoiceNotice(p, id, names),
            choiceSub: (f, id) => (id === 'free' ? psFreeNote(f) : ''),
            concede: (f, seat) => psConcede(f, seat),
            resultText: (v, names) => psResultText(v, names),
            // A CPU trial is 5–8 ms at 22 balls, so it thinks in 12 ms slices (the still table
            // costs next to nothing to draw); it concedes by tier.
            cpu: { tiers: PA_SN_TIERS, names: PA_SN_NAMES, plan: paSnPlan, place: paSnPlace, choose: (f, w) => paSnChoose(f, w), concede: paSnConcede, slice: 12,
                tierFor: (pref, rec) => (PA_SN_TIERS[pref] ? pref : paAdaptiveTier(rec)), adaptive: rec => paAdaptiveTier(rec) },
            potXP: 0,
            frameXP: c => {
                if (!c.vsCPU) return c.won ? POOL_PVP_WIN_XP : POOL_LOSS_XP;
                const byTier = POOL_SNK_WIN_XP[c.frame && c.frame.reds] || POOL_SNK_WIN_XP[15];
                const high = c.frame && c.frame.high ? c.frame.high[1] || 0 : 0;
                return (c.won ? byTier[c.tier] || byTier.normal : POOL_SNK_LOSS_XP) + poolSnkBreakBonus(high);
            },
            // The reds and your best break go with the award: Century and Maximum read them.
            xpPerf: f => ({ reds: f ? f.reds : 15, highBreak: f && f.high ? Math.min(POOL_SNK_BREAK_CAP, f.high[1] || 0) : 0 }),
            record: () => poolStoreRead('snookerRecord', { p1Wins: 0, p1Losses: 0, p2Wins: 0, p2Losses: 0 }),
            fileResult: (w, vsCPU, tier, f) => {
                // Your best break vs the CPU at every frame end, lost or conceded too. 2 Players'
                // breaks are not kept: either seat is this account.
                if (vsCPU && f && f.high) {
                    const best = poolStoreNum('snookerHighBreak'), mine = Math.min(POOL_SNK_BREAK_CAP, f.high[1] || 0);
                    if (mine > best) poolStoreWrite('snookerHighBreak', mine);
                }
                const rec = poolStoreRead('snookerRecord', { p1Wins: 0, p1Losses: 0, p2Wins: 0, p2Losses: 0 });
                const byMode = poolStoreRead('snookerWinsByMode', { cpu: 0, pvp: 0, online: 0 });
                if (w === 1) {
                    byMode[poolMode === 'pvp' ? 'pvp' : 'cpu']++;
                    if (vsCPU) poolRecordTierWin(tier);
                    rec.p1Wins++; rec.p2Losses++;
                } else if (w === 2) { rec.p2Wins++; rec.p1Losses++; }
                poolStoreWrite('snookerRecord', rec);
                poolStoreWrite('snookerWinsByMode', byMode);
            },
            netRecord: () => poolStoreRead('snookerNetRecord', { wins: 0, losses: 0 }),
            fileNet: won => {
                const rec = poolStoreRead('snookerNetRecord', { wins: 0, losses: 0 });
                const byMode = poolStoreRead('snookerWinsByMode', { cpu: 0, pvp: 0, online: 0 });
                if (won) { byMode.online++; rec.wins++; } else rec.losses++;
                poolStoreWrite('snookerNetRecord', rec);
                poolStoreWrite('snookerWinsByMode', byMode);
            },
            wins: () => {
                const byMode = poolStoreRead('snookerWinsByMode', { cpu: 0, pvp: 0, online: 0 });
                if (poolMode === 'net') return byMode.online;
                if (poolMode === 'pvp') return byMode.pvp;
                if (poolMode === 'cpu') return poolWinsByTier()[poolCpuTier] || 0;
                return byMode.cpu;
            },
        },
    };
    // A small localStorage record, every field a whole number (corrupt or missing: the defaults).
    function poolStoreRead(key, defaults) {
        const out = Object.assign({}, defaults);
        try {
            const raw = JSON.parse(localStorage.getItem(key) || 'null');
            if (raw && typeof raw === 'object') Object.keys(defaults).forEach(k => { out[k] = parseInt(raw[k], 10) || 0; });
        } catch (_) {}
        return out;
    }
    function poolStoreNum(key) { try { return Math.max(0, parseInt(localStorage.getItem(key) || '0', 10) || 0); } catch (_) { return 0; } }
    function poolStoreWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
    const poolRules = () => POOL_GAMES[poolS.game] || POOL_GAMES.pool;
    // This game's table config, with a fresh camera and cache; the frame is the caller's business.
    function poolUseGame(game) {
        const S = poolS;
        // Each game has its own tournament (bracket, screens, saved key).
        S.tours[S.game] = S.tour;
        S.game = POOL_GAMES[game] ? game : 'pool';
        S.tour = S.tours[S.game] || (S.tours[S.game] = poolTourFresh());
        S.cfg = poolRules().world().cfg;
        if (poolMode !== 'tour') S.clockTotal = poolQuickClock();
        S.director = null; S.cache = {}; S.W = S.H = 0; S.drawKey = ''; S.guide = null; S.guideKey = '';
    }
    const poolTourFresh = () => ({ t: null, screen: null, dialog: null, dlgBack: null, tab: 0, matchId: null, setup: null, cab: null, cabBack: null,
        prevMode: 'cpu', pending: 0, rev: 0, checked: false });
    // A quick frame's shot clock: ⚙️'s pick for this game (0 is off), else the game's own.
    function poolQuickClock() { const R = poolRules(), v = userPreferences[R.clockPref]; return R.clocks.indexOf(v) >= 0 ? v : R.clock; }

    let poolMode = 'cpu';                    // 'cpu' | 'pvp' | 'tour' | 'net' (online, pool-net.js)
    let poolGamesWon = 0;                    // all-time wins, as stored by savePoolHighScore
    let poolRecord = null;                   // { p1Wins, p1Losses, p2Wins, p2Losses }
    let poolMaximized = false;
    // The CPU's tier, locked when the frame starts so it cannot shift mid-frame.
    let poolCpuTier = 'normal';

    // The panel and match live in one object, so a reset is a reassignment, not thirty lets.
    const poolS = {
        game: 'pool',                        // the game on the table: a key of POOL_GAMES
        root: null, hudC: null, hudM: null, hud: null, canvas: null, ctx: null, maxFrame: null, maxPanel: null,
        W: 0, H: 0, dpr: 1, cfg: null, director: null, cache: {},
        world: null, frame: null, rackId: 0, awardedRack: -1, breaker: 1, frames: [0, 0], seed: 0, rng: null,
        phase: 'aim', aim: 0, power: 0, tip: { x: 0, y: 0 }, spinOpen: false, called: -1, guide: null, guideKey: '',
        // Snooker: the nominated colour (-1: none), the concede question; each game's parked frame.
        nom: -1, confirm: false, parked: {}, tours: {},
        // Snooker: the chips opened again after a colour was nominated (they fold to that one).
        chipsOpen: false,
        // The CPU's safeties in a row this frame (snooker's CPU attacks after three).
        cpuSafeRun: 0,
        drops: [], down: new Set(), drag: null, strikeT: 0, shot: null,
        // The object balls each seat has potted this frame (cards show them on an open table).
        pots: { 1: [], 2: [] },
        toast: null, toastMs: 0, fouled: 0, handoff: 0, result: null, placed: false, clockLeft: POOL_CLOCK_S,
        cpu: null, wins: 0,
        // Cues: the picker open, the wins per cue (cached), a cue just unlocked or equipped, the frame card's line.
        // p2Cue: 2 Players' second seat's pick; pill: the header pill's last label.
        cues: false, cueRec: null, cueNew: null, cueJust: null, cueView: null, cueLine: '', p2Cue: null, pill: '', cueShots: {},
        // Your record against the CPU (adaptive difficulty reads it), and the Game mode sheet.
        cpuRec: null, sheet: { open: false, mode: 'cpu' },
        // Table settings (guide full | short | off, call rules, clock): tournaments and tiers set them.
        guideMode: 'full', callEvery: false, callMode: 'off', clockTotal: POOL_CLOCK_S,
        // The tournament: bracket (t.current: the match in progress), screen, dialog, setup, cabinet.
        tour: { t: null, screen: null, dialog: null, dlgBack: null, tab: 0, matchId: null, setup: null, cab: null, cabBack: null,
            prevMode: 'cpu', pending: 0, rev: 0, checked: false },
        // Online (pool-net.js): the room as this table plays it (seat, names, seed; closed once
        // the server ends it), the frame number in the room, the best-of picked for challenges,
        // and while a move plays: replayed from the log (no animation, no awards) or ours.
        // netStep counts the frame's turns (each verdict and choice), so a settled table is only
        // ever compared with the same step here.
        // Vs CPU: the table waits behind PLAY (or RESUME) until it is pressed, so the CPU never
        // breaks on its own when the panel opens. 'play' | 'resume' | null.
        awaitStart: null,
        reactOpen: false, netRoom: null, netFrameNo: 0, netStep: 0, netBestOf: 1, netReplay: false, netLocal: false, netResyncs: 0,
        // phase 'choice': after a snooker foul the table waits for the incoming player's pick.
        running: false, raf: null, lastMs: 0, acc: 0, sinceDraw: 0, drawKey: '',
        attached: false, armed: false, lastX: null, leanSave: null, nameSave: null, scheme: null,
    };

    // ── Seats, names, records ─────────────────────────────────────────
    const poolMe = () => (typeof lbDisplayName === 'string' && lbDisplayName.trim() ? lbDisplayName.trim().slice(0, 16) : '');
    // 2 Players' names, as the Game mode sheet sets them (16 characters, as a tournament's).
    const POOL_PVP_NAME_PREFS = { 1: 'poolP1Name', 2: 'poolP2Name' };
    const poolPvpName = seat => String(userPreferences[POOL_PVP_NAME_PREFS[seat]] || '').trim().slice(0, 16);
    // An unnamed seat: Player 1 is you, by your leaderboard name.
    const poolPvpDefault = seat => (seat === 1 ? poolMe() || 'Player 1' : 'Player 2');
    function poolNames() {
        const me = poolMe(), m = poolTourMatch();
        if (m) return { 1: poolS.tour.t.slots[m.a].name, 2: poolS.tour.t.slots[m.b].name };
        if (poolMode === 'net') { const r = poolS.netRoom; return { 1: (r && r.names[0]) || 'Player 1', 2: (r && r.names[1]) || 'Player 2' }; }
        return poolMode === 'cpu' ? { 1: me || 'You', 2: 'CPU' } : { 1: poolPvpName(1) || poolPvpDefault(1), 2: poolPvpName(2) || poolPvpDefault(2) };
    }
    // The picked difficulty: 'adaptive' (the default) or a pinned tier.
    const poolDifficulty = () => { const R = poolRules(), d = userPreferences[R.diffPref]; return R.cpu.tiers[d] ? d : 'adaptive'; };
    function poolLoadCpuRecord() {
        let r = null;
        try { r = JSON.parse(localStorage.getItem(poolRules().keys.cpuRec) || 'null'); } catch (_) {}
        return { wins: (r && parseInt(r.wins, 10)) || 0, losses: (r && parseInt(r.losses, 10)) || 0 };
    }
    function poolSaveCpuRecord(r) { try { localStorage.setItem(poolRules().keys.cpuRec, JSON.stringify(r)); } catch (_) {} }
    const poolCpuRec = () => poolS.cpuRec || (poolS.cpuRec = poolLoadCpuRecord());
    // Locks the tier for the frame, and with it the frame's call rule (for both seats).
    function poolLockTier() {
        const S = poolS;
        const cpu = poolRules().cpu;
        poolCpuTier = cpu.tierFor(poolDifficulty(), poolCpuRec());
        poolRules().lockCall(S.frame, cpu.tiers[poolCpuTier]);
        poolRefreshScoreBtn();
    }
    // Nothing has been hit yet in this frame, so a new difficulty can apply to it.
    const poolFrameFresh = () => !!poolS.frame && poolS.frame.isBreak && poolS.phase !== 'moving' && poolS.phase !== 'strike';

    function poolRecordText(seat) {
        const m = poolTourMatch();
        if (m) return 'Seed ' + poolS.tour.t.slots[seat === 1 ? m.a : m.b].seed;
        if (poolMode === 'net') return poolNetRecordText(seat);
        const r = poolRules().record() || { p1Wins: 0, p1Losses: 0, p2Wins: 0, p2Losses: 0 };
        if (poolMode === 'cpu' && seat === 2) {
            const label = poolRules().cpu.tiers[poolCpuTier].label;
            return poolDifficulty() === 'adaptive' ? 'Adaptive · ' + label : label;
        }
        return seat === 1 ? r.p1Wins + 'W · ' + r.p1Losses + 'L' : r.p2Wins + 'W · ' + r.p2Losses + 'L';
    }
    // Your CPU wins by tier, keyed on the tier locked when each frame started, so a pick
    // changed mid-frame cannot re-file a win. Not seeded from the all-time count: those
    // wins' difficulty was never recorded, so they stay on the All-time board.
    function poolWinsByTier() {
        const R = poolRules(), out = {};
        R.cpu.names.forEach(t => { out[t] = 0; });
        try {
            const raw = JSON.parse(localStorage.getItem(R.keys.byTier) || 'null');
            if (raw && typeof raw === 'object') R.cpu.names.forEach(t => { out[t] = parseInt(raw[t], 10) || 0; });
        } catch (_) { /* corrupt storage reads as no wins, never as a throw */ }
        return out;
    }
    function poolRecordTierWin(tier) {
        const R = poolRules();
        if (R.cpu.names.indexOf(tier) === -1) return;
        const byTier = poolWinsByTier();
        byTier[tier]++;
        try { localStorage.setItem(R.keys.byTier, JSON.stringify(byTier)); } catch (_) { /* quota */ }
    }
    const poolWins = () => poolRules().wins();
    // The header button and Max trophy count only change when a frame ends or the mode flips,
    // so it is cached here rather than read every frame.
    function poolRefreshScoreBtn() { poolS.wins = poolWins(); updateGameScoreBtn(poolRules().lb, null, poolS.wins); }
    const poolCpuTurn = () => poolMode === 'cpu' && poolS.frame && poolS.frame.turn === 2 && !poolS.frame.over;
    // Online: the seat that acts now (snooker's chooser after a foul, else the shooter), and
    // whether that is the other tab's. Its moves arrive through poolNetPump.
    const poolActor = () => (poolS.phase === 'choice' && poolS.frame.pending ? poolS.frame.pending.chooser : poolS.frame.turn);
    const poolRemoteTurn = () => poolMode === 'net' && !!poolS.netRoom && !!poolS.frame && !poolS.frame.over && poolS.phase !== 'over' && poolActor() !== poolS.netRoom.seat;
    const poolCueBall = () => poolS.world.balls[0];
    const poolTip = () => poolS.tip;

    // ── Cues (pool-cues.js) ───────────────────────────────────────────
    // Each human seat plays its own cue, and may change it during the match, as 8 Ball Pool
    // allows. Your seat's is ⚙️'s poolCue; another human seat (2 Players' second, a tournament's
    // other names) picks from your collection, starting from yours. The CPU plays its tier's.
    // Frames won against the CPU level the cue that won them (poolCueRecord, synced).
    const POOL_CUE_KEY = 'poolCueRecord';
    const poolCueRec = () => poolS.cueRec || (poolS.cueRec = poolStoreRead(POOL_CUE_KEY, Object.fromEntries(PQ_SET.map(q => [q.id, 0]))));
    const poolCueOpen = q => pqUnlocked(q, userXP && userXP.achievements, poolCueRec());
    const poolCueId = () => { const q = pqById(userPreferences.poolCue); return poolCueOpen(q) ? q.id : 'standard'; };
    // The human at the table (you, while the CPU plays): whose cue the picker sets.
    const poolPickSeat = () => (poolMode === 'net' && poolS.netRoom ? poolS.netRoom.seat : !poolS.frame || poolCpuTurn() ? 1 : poolS.frame.turn);
    // A tournament seat's slot (it keeps its cue in the saved bracket), else null.
    const poolSeatSlot = seat => { const m = poolTourMatch(); return m ? poolS.tour.t.slots[seat === 1 ? m.a : m.b] : null; };
    const poolSeatMine = seat => {
        if (poolMode === 'net' && poolS.netRoom) return seat === poolS.netRoom.seat;
        const sl = poolSeatSlot(seat); return sl ? !!sl.you : !(poolMode === 'pvp' && seat === 2);
    };
    function poolSeatCueId(seat) {
        // Online, the other seat's cue is the one its tab streams with its aim (only drawn).
        if (poolMode === 'net' && !poolSeatMine(seat)) return pqById(poolNet.peerCue).id;
        const sl = poolSeatSlot(seat), own = poolSeatMine(seat) ? null : sl ? sl.cue : poolS.p2Cue;
        const q = pqById(own || userPreferences.poolCue);
        return poolCueOpen(q) ? q.id : 'standard';
    }
    const poolHumanStats = () => { const id = poolSeatCueId(poolPickSeat()); return pqStats(id, poolCueRec()[id]); };
    // The shooter's cue: the CPU's on its turn, else the human's at the table.
    const poolCueStats = () => (poolCpuTurn() ? pqCpuStats(poolCpuTier, poolS.game) : poolHumanStats());
    // A shot with that cue: its power cap and spin reach.
    const poolCueShot = (shot, st) => Object.assign({}, shot, { cap: poolS.cfg.maxSpeed * st.power, tipMax: poolS.cfg.maxTip * st.spin });
    // Your shot at p % power: the spin pad's edge reaches as far as the cue spins.
    function poolHumanShot(p) {
        const st = poolCueStats(), t = poolTip();
        return poolCueShot({ angle: poolS.aim, speed: poolS.cfg.maxSpeed * st.power * p / 100, tipX: t.x * st.spin, tipY: t.y * st.spin }, st);
    }
    // The turn's clock: the table's (0 is off), stretched by the shooter's cue.
    const poolTurnClock = () => (poolS.clockTotal ? Math.round(poolS.clockTotal * poolHumanStats().time) : 0);
    // A win against the CPU at the cue's tier or above levels it; a fifth mastered cue unlocks
    // Collector. The cue is the one that played most of your shots this frame (a cue changed on
    // the last shot doesn't take the win). Returns the frame card's line about it.
    function poolCueWin(tier) {
        const S = poolS, rec = Object.assign({}, poolCueRec()), shots = S.cueShots;
        const id = Object.keys(shots).reduce((a, k) => (shots[k] > (shots[a] || 0) ? k : a), poolCueId()), q = pqById(id), was = pqLevel(rec[id], q);
        if (was >= 5) return '';
        if (!pqCounts(q, S.game, tier)) return q.name + ' levels on ' + pqNeedText(q) + ', not ' + tier + ' ' + (S.game === 'snooker' ? 'snooker' : 'pool');
        const had = pqMastered(rec);
        rec[id] = (rec[id] || 0) + 1;
        poolStoreWrite(POOL_CUE_KEY, rec);
        S.cueRec = rec; S.cueView = null;
        if (had < 5 && pqMastered(rec) >= 5) poolCueUnlocked('collector');
        const lv = pqLevel(rec[id], q), steps = pqSteps(q);
        if (lv > was) return lv >= 5 ? q.name + ' mastered' : q.name + ' reached level ' + lv;
        return q.name + ': ' + (rec[id] - steps[lv - 1]) + ' of ' + q.need[2][lv - 1] + ' ' + pqNeedText(q) + ' to level ' + (lv + 1);
    }
    // From the host's unlockAchievement (an achievement id), or a fifth mastery: the table
    // shows "New cue" until it is equipped or dismissed.
    function poolCueUnlocked(key) {
        const q = PQ_SET.find(c => c.id === key || c.ach === key);
        if (!q) return null;
        poolS.cueNew = q.id;
        poolS.cueView = null;
        return q;
    }
    function poolCueEquip(id) {
        const S = poolS, q = pqById(id), seat = poolPickSeat();
        if (!poolCueOpen(q)) return;
        if (poolSeatMine(seat)) { userPreferences.poolCue = q.id; savePreferences(); }
        else { const sl = poolSeatSlot(seat); if (sl) { sl.cue = q.id; poolTourSave(); } else S.p2Cue = q.id; }
        S.cueJust = q.id; S.cueNew = null; S.cueView = null;
        poolCueClock();
        poolSyncChrome();
    }
    // A new cue's clock, now: the turn under way keeps what it has left, within the new limit.
    function poolCueClock() {
        const S = poolS;
        if (S.clockTotal) S.clockLeft = Math.min(S.clockLeft, poolTurnClock());
    }
    // The header pill: the cue of the human at the table, refreshed as the turn passes.
    function poolCuePill() {
        const S = poolS, b = typeof document !== 'undefined' && document.getElementById('pool-cue-pill');
        if (!b) return;
        const seat = poolPickSeat(), n = pqById(poolSeatCueId(seat)).name, who = poolSeatMine(seat) ? 'Your cue' : poolNames()[seat] + "'s cue";
        if (S.pill === who + n) return;
        S.pill = who + n;
        b.innerHTML = PH_ICON.cue + '<span>' + n + '</span>';
        b.title = who + ': ' + n;
        b.setAttribute('aria-label', who + ': ' + n + '. Open the cue collection');
    }
    // The open collection's model, for the seat it serves (it changes hands with the turn).
    function poolCueView() {
        const S = poolS, k = poolPickSeat() + poolMode;
        if (!S.cueView || S.cueViewKey !== k) { S.cueView = poolCueModel(); S.cueViewKey = k; }
        return S.cueView;
    }
    // The picker's model: rebuilt when a cue, a level or an unlock changes.
    function poolCueModel() {
        const S = poolS, rec = poolCueRec(), seat = poolPickSeat(), eq = poolSeatCueId(seat), who = poolSeatMine(seat) ? null : poolNames()[seat];
        const list = PQ_SET.map(q => {
            const wins = rec[q.id] || 0, st = pqStats(q.id, wins), open = poolCueOpen(q), steps = pqSteps(q);
            const cond = q.id === 'collector' ? q.cond + ' · ' + Math.min(5, pqMastered(rec)) + ' of 5' : q.cond;
            // Progress within the level: "4 of 7 Hard+ wins to level 3".
            return { id: q.id, name: q.name, blurb: q.blurb, cond, open, eq: q.id === eq, isNew: q.id === S.cueNew, level: st.level, wins,
                have: wins - steps[st.level - 1], need: q.need[2][st.level - 1], counts: pqNeedText(q), bars: st.bars, top: pqStats(q.id, 0, Math.min(5, st.level + 1)).bars };
        });
        return { eq, who, just: S.cueJust, game: S.game, open: list.filter(c => c.open).length, list };
    }

    // ── Frames ────────────────────────────────────────────────────────
    // seed: online, the room's for this frame, so both tabs rack the same table.
    function poolNewFrame(breaker, seed) {
        const S = poolS, R = poolRules();
        if (!S.cfg) poolUseGame(S.game);
        S.seed = seed !== undefined ? seed >>> 0 : (Date.now() ^ (S.rackId * 2654435761)) >>> 0;
        S.rng = ppRandom(S.seed);
        S.world = R.rack(R.world(), S.rng);
        S.breaker = breaker === 2 ? 2 : 1;
        S.frame = R.newFrame({ breaker: S.breaker, callEvery: S.callEvery, seed: S.seed });
        poolLockTier();
        S.rackId++;
        const home = R.cueHome(S.world);
        S.world.balls[0].x = home[0]; S.world.balls[0].y = home[1];
        S.down = new Set(); S.drops = []; S.called = -1; S.guide = null; S.guideKey = ''; S.pots = { 1: [], 2: [] }; S.cpuSafeRun = 0; S.cueShots = {};
        S.aim = 0; S.power = 0; S.tip = { x: 0, y: 0 }; S.spinOpen = false; S.phase = 'bih'; S.placed = false; S.drag = null; S.shot = null;
        S.toast = null; S.toastMs = 0; S.fouled = 0; S.result = null; S.cpu = null; S.nom = -1; S.confirm = false;
        // A tournament's later frames start with the breaker taking the seat.
        const tm = poolTourMatch();
        S.handoff = tm && tm.frames.length > 0 ? S.breaker : 0; S.clockLeft = poolTurnClock() || POOL_CLOCK_S;
        // Only with the panel up: headless (the verify suites) there is no button to press.
        S.awaitStart = poolMode === 'cpu' && !!S.hudC && !S.startNow ? 'play' : null;
        S.startNow = false;
        S.drawKey = '';
    }

    function resetPoolGame() {
        if (!poolS.cfg) poolUseGame(poolS.game);
        // A tournament frame is not re-rackable: that would undo a lost frame.
        if (poolMode === 'tour' && poolTourMatch()) return;
        poolNewFrame(poolS.breaker);
    }

    function togglePoolMode() {
        if (poolMode === 'tour') { poolLeaveTour(); return; }
        if (poolMode === 'net') { poolNetQuit(); return; }
        poolMode = poolMode === 'cpu' ? 'pvp' : 'cpu';
        poolS.awaitStart = null;
        poolS.frames = [0, 0]; poolS.p2Cue = null;
        poolNewFrame(1);
        poolRefreshScoreBtn();
    }

    // The frame is over: record it once per rack, however it ended.
    function poolEndFrame(v) {
        const S = poolS, w = v.winner, R = poolRules();
        if (S.awardedRack === S.rackId) return;
        S.awardedRack = S.rackId;
        // A frame that survives a reload is gone once it is decided, before anything is paid.
        poolClearSaved();
        // Tournament frames go to the bracket, not to the quick-match records or XP.
        if (poolMode === 'tour') { poolTourFrameOver(w, v); return; }
        if (poolMode === 'net') { poolNetFrameOver(w, v); return; }
        const vsCPU = poolMode === 'cpu', tier = poolCpuTier, f = v.next || S.frame;
        R.fileResult(w, vsCPU, tier, f);
        S.cueLine = vsCPU && w === 1 ? poolCueWin(tier) : '';
        if (w === 1 || w === 2) {
            const won = w === 1;
            awardGameXP(R.xpType, Object.assign({ won, vsCPU, tier: vsCPU ? tier : null, xp: R.frameXP({ won, vsCPU, tier, frame: f }) }, R.xpPerf(f)));
        }
        if (poolMode === 'cpu') {
            const rec = poolCpuRec();
            if (w === 1) rec.wins++; else rec.losses++;
            poolSaveCpuRecord(rec);
        }
        S.frames[w - 1]++;
        poolRefreshScoreBtn();
    }

    // XP per legal pot, for your pots against the CPU only: in 2 Players it would land on this
    // account whoever potted.
    function poolAwardPots(seat, n) {
        const per = poolRules().potXP;
        if (!n || !per || poolMode !== 'cpu' || seat !== 1 || !xpSystemReady) return;
        const xpGained = n * per;
        userXP.currentXP += xpGained;
        userXP.totalXP += xpGained;
        checkLevelUp();
        saveUserXP(userXP);
        showXPNotification('+' + xpGained + ' XP (' + (n === 1 ? '1 pot' : n + ' pots') + ')', 'game', poolRules().icon);
        updateXPDisplay();
    }

    // What the frame-over dialog says about the next frame's CPU, when adaptive.
    function poolAdaptiveNote() {
        if (poolMode !== 'cpu' || poolDifficulty() !== 'adaptive') return '';
        const cpu = poolRules().cpu, now = poolCpuTier, next = cpu.adaptive(poolCpuRec()), label = cpu.tiers[next].label;
        const d = cpu.names.indexOf(next) - cpu.names.indexOf(now);
        return d > 0 ? 'Adaptive steps up to ' + label + ' next frame' : d < 0 ? 'Adaptive eases to ' + label + ' next frame' : 'Adaptive stays at ' + label;
    }

    function poolShowToast(t) { poolS.toast = t; poolS.toastMs = t && t.kind !== 'foul' ? POOL_TOAST_MS : 0; }

    // Applies a verdict (a judged shot or a timeout) and sets up the next turn.
    function poolAfterTurn(v) {
        const S = poolS, R = poolRules(), shooter = v.shooter;
        S.netStep++;
        S.frame = v.next; S.called = -1; S.nom = -1; S.confirm = false; S.tip = { x: 0, y: 0 }; S.spinOpen = false; S.power = 0; S.cpu = null; S.shot = null;
        if (v.frameOver) {
            const w = v.winner, t = R.text(v, poolNames());
            const you = poolMode === 'cpu' ? w === 1 : null;
            // Snooker's dialog says why in a sentence, with the score and high break beside it.
            const more = R.resultText ? R.resultText(v, poolNames()) : null;
            poolEndFrame(v);
            if (poolMode === 'tour') { poolTourResult(t); return; }
            if (poolMode === 'net') { poolNetResultDialog(w, t, more); return; }
            S.result = {
                win: you === null ? true : you, title: t.title, reason: more ? more.reason : t.sub,
                recordLabel: (poolMode === 'cpu' ? poolNames()[1] : poolNames()[w]).toUpperCase() + ' · RECORD',
                record: poolRecordText(poolMode === 'cpu' ? 1 : w),
                delta: poolMode === 'cpu' ? (you ? '+1 WIN' : '+1 LOSS') : '+1 WIN',
                note: [S.cueLine, poolAdaptiveNote()].filter(Boolean).join('. '),
            };
            if (more) S.result.stats = [{ label: 'SCORE', value: more.score }, { label: 'HIGH BREAK', value: more.high }];
            S.phase = 'over'; S.toast = null;
            return;
        }
        S.fouled = v.foul ? shooter : 0;
        // Hot-seat: when the table changes hands, the next player takes the seat first.
        if ((poolMode === 'pvp' || poolMode === 'tour') && S.frame.turn !== shooter) S.handoff = S.frame.turn;
        if (S.frame.pending) { S.phase = 'choice'; S.clockLeft = poolTurnClock() || POOL_CLOCK_S; }
        else poolStartTurn();
        // A shot boundary: the table is still, so this is the state a reload comes back to.
        poolTourSnapshot();
        poolSaveFrame();
    }

    // The player at the table starts a turn: with the cue ball in hand (placed at home when it
    // went down, or when snooker's D needs it back), or from where it lies.
    function poolStartTurn() {
        const S = poolS, R = poolRules();
        if (S.frame.ballInHand) {
            const c = poolCueBall();
            if (c.state === 'pocketed' || (S.frame.ballInHand === 'D' && R.canPlace(S.world, c.x, c.y, 'D'))) { const home = R.cueHome(S.world); R.placeCue(S.world, home[0], home[1]); }
            S.phase = 'bih'; S.placed = false;
        } else { S.phase = 'aim'; poolAimAtNearest(); }
        S.clockLeft = poolTurnClock() || POOL_CLOCK_S;
    }

    // The incoming player's choice after a snooker foul (psChoose). A CPU's is named in a
    // notice; in hot-seat, a change of seat is handed over first.
    function poolChoose(id, byCpu) {
        const S = poolS, R = poolRules(), p = S.frame && S.frame.pending;
        if (!p || !R.choose || p.options.indexOf(id) < 0) return;
        const before = S.frame.turn;
        S.frame = R.choose(S.frame, id);
        S.netStep++;
        S.fouled = 0; S.nom = -1;
        poolShowToast(byCpu ? { kind: 'notice', title: R.choiceNotice(p, id, poolNames()), sub: R.choiceSub ? R.choiceSub(S.frame, id) : '' } : null);
        // The CPU's free ball stays up until it strikes: its colour is off the order on purpose.
        if (byCpu && id === 'free') S.toastMs = 0;
        if ((poolMode === 'pvp' || poolMode === 'tour') && S.frame.turn !== before) S.handoff = S.frame.turn;
        poolStartTurn();
        poolTourSnapshot();
        poolSaveFrame();
    }

    function poolSettle() {
        const S = poolS, R = poolRules();
        const v = R.judge(S.frame, S.world, { call: S.called, nominate: S.nom });
        poolShowToast(R.text(v, poolNames()));
        R.apply(S.world, v);
        if (!v.foul && v.counted) poolAwardPots(v.shooter, v.counted.length);
        poolAfterTurn(v);
        // Online: the shooter's table at rest goes after its strike; the other tab checks it.
        if (poolMode === 'net' && S.netLocal && !S.netReplay) poolNetMove({ k: 'settled', n: S.netFrameNo, s: S.netStep, h: poolNetHash(), snap: poolTableSnap() });
        S.netLocal = false;
    }

    // ── Aim helpers ───────────────────────────────────────────────────
    const poolLegalTarget = id => poolRules().legal(poolS.frame, poolS.world, id);
    function poolAimAtNearest() {
        const S = poolS, c = poolCueBall();
        const cands = S.world.balls.filter(b => b.id !== 0 && b.state !== 'pocketed' && poolLegalTarget(b.id));
        if (!cands.length) return;
        cands.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
        // Snooker's balls sit in each other's way (the brown between the D and the pack): the
        // nearest one with a clear line, if any.
        let pick = cands[0];
        if (poolRules().aimClear) {
            const R2 = 2 * S.cfg.ballR;
            const clear = t => S.world.balls.every(b => {
                if (b === t || b.id === 0 || b.state === 'pocketed') return true;
                const dx = t.x - c.x, dy = t.y - c.y, L2 = dx * dx + dy * dy || 1, s = Math.max(0, Math.min(1, ((b.x - c.x) * dx + (b.y - c.y) * dy) / L2));
                return (b.x - c.x - s * dx) ** 2 + (b.y - c.y - s * dy) ** 2 >= R2 * R2;
            });
            pick = cands.find(clear) || pick;
        }
        S.aim = Math.atan2(pick.y - c.y, pick.x - c.x);
    }
    function poolRefreshGuide() {
        const S = poolS;
        if (S.phase !== 'aim' && S.phase !== 'strike') { S.guide = null; return; }
        const p = S.drag ? Math.max(S.power, 5) : 50, t = poolTip();
        const key = [S.aim.toFixed(5), Math.round(p), t.x, t.y, S.world.t, poolSeatCueId(poolPickSeat())].join();
        if (key === S.guideKey) return;
        S.guideKey = key;
        S.guide = pgGuide(S.world, poolHumanShot(p));
    }
    // The shot on screen, for the HUD to keep its overlays off (phShy): the aim line to the
    // contact, the object ball's path to its pocket (else the cushion), and those points as
    // circles. The cue ball is not a circle: in 3D it sits bottom centre, clear of the overlays.
    function poolShotPath(v) {
        const S = poolS, g = S.guide, cfg = S.cfg, R = cfg.ballR, c = poolCueBall();
        if (!g || !g.contact || !c || c.state === 'pocketed') return null;
        const segs = [], dots = [], pockets = S.world.table.pockets;
        const line = (a, b) => {
            const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 40));
            let prev = null;
            for (let i = 0; i <= n; i++) {
                const q = pcProject(v, [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, R]);
                if (q && prev) segs.push([prev[0], prev[1], q[0], q[1]]);
                prev = q;
            }
        };
        const dot = (x, y, r) => { const q = pcProject(v, [x, y, R]); if (q) dots.push([q[0], q[1], r * q[2]]); };
        line([c.x, c.y], g.contact);
        dot(g.contact[0], g.contact[1], R);
        // ⚙️ Aim Guide None draws nothing past the contact (a tournament's Short still does).
        if (!poolGuideLen() && S.guideMode === 'full') return { segs, dots };
        if (g.pocketed) {
            const p = pockets.slice().sort((a, b) => Math.hypot(a.x - g.contact[0], a.y - g.contact[1]) - Math.hypot(b.x - g.contact[0], b.y - g.contact[1]))[0];
            if (p) dot(p.x, p.y, p.r);
        }
        if (g.obj) {
            const o = g.obj;
            let hit = null, best = Infinity;
            pockets.forEach(p => {
                const t = (p.x - o.x) * o.dx + (p.y - o.y) * o.dy, d = Math.abs((p.x - o.x) * o.dy - (p.y - o.y) * o.dx);
                if (t > 0 && d < p.r + R && t < best) { best = t; hit = p; }
            });
            let end;
            if (hit) { end = [hit.x, hit.y]; dot(hit.x, hit.y, hit.r); }
            else {
                const lim = (s, d, h) => d > 1e-9 ? (h - s) / d : d < -1e-9 ? (-h - s) / d : Infinity;
                const t = Math.max(0, Math.min(lim(o.x, o.dx, cfg.halfLength - R), lim(o.y, o.dy, cfg.halfWidth - R)));
                end = [o.x + o.dx * t, o.y + o.dy * t];
            }
            dot(o.x, o.y, R);
            line([o.x, o.y], end);
        }
        return { segs, dots };
    }
    const poolCanAct = () => !poolS.awaitStart && !poolS.handoff && !poolCpuTurn() && !poolRemoteTurn() && poolS.phase !== 'over' && poolS.phase !== 'choice' && !poolS.confirm && !poolS.sheet.open && !poolTourBlocked();

    // ── The CPU's turn ────────────────────────────────────────────────
    // Wait, place the ball if in hand, think (time-sliced), turn onto the line, draw back, strike.
    function poolCpuTick(dt) {
        const S = poolS, R = poolRules();
        if (!poolCpuTurn() || S.awaitStart || poolTourBlocked() || S.phase === 'moving' || S.phase === 'strike') return;
        const c = S.cpu || (S.cpu = { stage: 'wait', t: 0 });
        c.t += dt;
        // Fouled against: a beat (its card reads CHOOSING), then its choice.
        if (S.phase === 'choice') {
            if (c.t >= 700) { S.cpu = null; poolChoose(R.cpu.choose(S.frame, S.world), true); }
            return;
        }
        if (S.phase === 'bih') {
            if (c.t < 550) return;
            const p = R.cpu.place(S.world, S.frame, S.rng, poolCpuTier);
            R.placeCue(S.world, p[0], p[1]);
            S.phase = 'aim'; S.placed = true; poolAimAtNearest();
            S.cpu = { stage: 'wait', t: 0 };
            return;
        }
        if (S.phase !== 'aim') return;
        if (c.stage === 'wait') {
            if (c.t < 350) return;
            if (R.cpu.concede && R.concede && R.cpu.concede(S.frame, S.world, poolCpuTier)) { S.cpu = null; poolAfterTurn(R.concede(S.frame, S.frame.turn)); return; }
            S.tip = { x: 0, y: 0 }; S.spinOpen = false;
            // It plans with its cue's reach.
            const st = poolCueStats(), cfg = S.world.cfg;
            const w = Object.assign({}, S.world, { cfg: Object.assign({}, cfg, { maxSpeed: cfg.maxSpeed * st.power, maxTip: cfg.maxTip * st.spin }) });
            c.job = R.cpu.plan(w, S.frame, { rng: S.rng, tier: poolCpuTier, safeRun: S.cpuSafeRun });
            c.stage = 'think'; c.t = 0;
        } else if (c.stage === 'think') {
            if (!c.job.step(R.cpu.slice || 3)) return;
            c.shot = c.job.shot; c.from = S.aim; c.stage = 'turn'; c.t = 0;
            // Safeties in a row: from three, snooker's CPU leans to the pot.
            S.cpuSafeRun = c.job.plan === 'safety' ? S.cpuSafeRun + 1 : 0;
            if (c.shot.call >= 0) S.called = c.shot.call;
            if (c.shot.nominate >= 0) S.nom = c.shot.nominate;
        } else if (c.stage === 'turn') {
            const k = Math.min(1, c.t / 650);
            let d = c.shot.angle - c.from;
            d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
            S.aim = c.from + d * pcEase(k);
            if (k >= 1 && c.t > 900) { c.stage = 'draw'; c.t = 0; }
        } else if (c.stage === 'draw') {
            const target = Math.min(100, c.shot.speed / (S.cfg.maxSpeed * poolCueStats().power) * 100);
            S.power = target * Math.min(1, c.t / 380);
            if (c.t >= 560) { S.shot = c.shot; S.phase = 'strike'; S.strikeT = 0; }
        }
    }

    // ── The loop ──────────────────────────────────────────────────────
    function poolCamInput() {
        const S = poolS, c = poolCueBall();
        return {
            camera: userPreferences.poolCamera === '2d' ? '2d' : '3d',
            shotCam: userPreferences.poolShotCam === '3d' ? '3d' : 'overhead',
            phase: S.phase === 'moving' ? 'moving' : S.phase === 'bih' ? 'bih' : 'aim',
            cue: [c.x, c.y], aim: S.aim, lean: poolLean(),
        };
    }
    const poolLean = () => { const v = Number(userPreferences.poolLean); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 35; };

    // The cue strikes: the shot handed in (the CPU's, or online the other tab's exact strike),
    // else yours at the gauge's power, which online goes to the other tab as it is played.
    function poolStrikeNow() {
        const S = poolS, R = poolRules();
        if (R.prime) S.frame = R.prime(S.frame, S.world);
        S.world.log = [];
        const raw = S.shot && S.shot.raw, shot = raw || (S.shot ? poolCueShot(S.shot, poolCueStats()) : poolHumanShot(S.power));
        S.netLocal = poolMode === 'net' && !raw;
        if (S.netLocal) { const c = poolCueBall(); poolNetMove({ k: 'strike', n: S.netFrameNo, shot, cue: [c.x, c.y], called: S.called, nom: S.nom }); }
        ppStrike(S.world, shot);
        // Your shots against the CPU, by cue: the frame's win goes to the one that played most.
        if (poolMode === 'cpu' && !poolCpuTurn()) { const id = poolSeatCueId(1); S.cueShots[id] = (S.cueShots[id] || 0) + 1; }
        S.shot = null;
        S.phase = 'moving'; S.acc = 0; S.toast = null; S.fouled = 0; S.placed = false;
    }
    // One 60 Hz step of a shot in flight; true once it is judged.
    function poolStepMoving() {
        const S = poolS;
        ppStep(S.world, 1 / 60);
        S.world.balls.forEach(b => {
            if (b.state === 'pocketed' && !S.down.has(b.id)) {
                S.down.add(b.id);
                // The shooter's, whatever the verdict: a ball down on a foul stays down.
                // Pool leaves the 8 out; on the break it comes back.
                if (poolRules().tracksPot(b.id)) S.pots[S.frame.turn].push(b.id);
                if (!S.netReplay) S.drops.push({ ball: Object.assign({}, b, { q: b.q.slice() }), pocket: b.pocket, t: 0 });
            }
        });
        if (!ppSettled(S.world)) return false;
        ppSimulate(S.world, 0.001); poolSettle();
        return true;
    }
    // The shot clock ran out on the player at the table.
    function poolTimeout() {
        const S = poolS, R = poolRules();
        if (poolMode === 'net' && !poolRemoteTurn()) poolNetMove({ k: 'timeout', n: S.netFrameNo, nom: S.nom });
        const v = R.timeout(S.frame, S.world);
        poolShowToast(R.text(v, poolNames()));
        poolAfterTurn(v);
    }

    function poolTick(dt) {
        const S = poolS;
        if (poolMode === 'net') poolNetTick(dt);
        if (S.phase === 'strike') {
            S.strikeT += dt;
            if (S.strikeT >= POOL_STRIKE_MS) poolStrikeNow();
        } else if (S.phase === 'moving') {
            S.acc += dt;
            while (S.acc >= 1000 / 60) {
                S.acc -= 1000 / 60;
                if (poolStepMoving()) break;
            }
        } else if (S.phase === 'aim' && poolCanAct() && !S.drag && S.clockTotal) {
            // The clock waits for the hand-off and ball in hand; a tournament can turn it off.
            S.clockLeft -= dt / 1000;
            if (S.clockLeft <= 0) poolTimeout();
        }
        poolCpuTick(dt);
        // A match just ended: its result covers the table once the last ball has dropped.
        if (S.tour.pending > 0) { S.tour.pending -= dt; if (S.tour.pending <= 0) { S.tour.pending = 0; S.tour.screen = 'result'; poolTourBump(); } }
        if (S.toastMs) { S.toastMs -= dt; if (S.toastMs <= 0) { S.toastMs = 0; if (!S.handoff) S.toast = null; } }
        S.drops.forEach(d => { d.t += dt / 250; });
        S.drops = S.drops.filter(d => d.t < 1);
        if (S.phase !== 'moving') S.down = new Set(S.world.balls.filter(b => b.state === 'pocketed').map(b => b.id));
    }

    function poolFit() {
        const S = poolS, c = S.canvas;
        const w = Math.round(c.clientWidth), h = Math.round(c.clientHeight);
        if (!w || !h) return false;
        if (w === S.W && h === S.H) return true;
        S.W = w; S.H = h;
        c.width = Math.round(w * S.dpr); c.height = Math.round(h * S.dpr);
        if (!S.director) S.director = pcDirector(w, h, S.cfg);
        pcResize(S.director, w, h);
        S.cache = {}; S.drawKey = '';
        return true;
    }

    // ⚙️ Aim Guide: how far the object ball's line runs, in table units. None (0) draws no
    // object-ball or cue-ball path: the aim line to the contact and the ghost ball there.
    const POOL_GUIDE_LEN = { none: 0, short: 60, medium: 100, long: 150 };
    // Your cue's aim stretches it.
    const poolGuideLen = () => Math.round((POOL_GUIDE_LEN.hasOwnProperty(userPreferences.poolGuideLen) ? POOL_GUIDE_LEN[userPreferences.poolGuideLen] : POOL_GUIDE_LEN.long) * poolHumanStats().aim);
    function poolDraw(dt) {
        const S = poolS, R = poolRules();
        if (!poolFit()) return;
        const pose = pcDirect(S.director, poolCamInput(), dt);
        const v = pcView(pose);
        poolRefreshGuide();
        const st = R.status(S.frame, S.world);
        const aiming = (S.phase === 'aim' || S.phase === 'strike') && !S.handoff;
        const pull = 8 + S.power * 1.1;
        const gap = S.phase === 'strike' ? pull + (1 - pull) * Math.min(1, S.strikeT / POOL_STRIKE_MS) : pull;
        const c = poolCueBall();
        const bihBad = S.phase === 'bih' ? R.canPlace(S.world, c.x, c.y, S.frame.ballInHand) : null;
        const felt = userPreferences.poolTableColor || 'green';
        const theme = phThemeTokens(S.hud);
        // The shooter's cue; Black Crown's and Collector's sheen moves unless motion is reduced.
        const cue = pqById(poolRemoteTurn() ? poolSeatCueId(S.frame.turn) : poolCueStats().id);
        poolCuePill();
        if (S.still === undefined) S.still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        const cueT = cue.sheen && aiming && !S.still ? Math.floor(Date.now() / 40) * 40 : null;
        // Nothing on the table moved and the camera is still: keep last frame's pixels.
        const key = JSON.stringify([pose, S.world.t, c.x, c.y, S.aim, S.power, gap, S.phase, S.called, S.handoff, felt, theme, S.drops.length, S.guideKey, S.guideMode, S.W, S.H, S.nom, userPreferences.poolGuideLen, cue.id, cueT]);
        if (key !== S.drawKey || S.drops.length) {
            S.drawKey = key;
            pgRender(S.ctx, {
                view: v, world: S.world, felt, dpr: S.dpr, cache: S.cache, theme,
                makeCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
                aim: aiming ? { angle: S.aim, power: S.power, gap } : null, cue, cueT,
                guide: aiming ? S.guide : null, guideMode: S.guideMode, guideLen: poolGuideLen(),
                illegal: !!(S.guide && S.guide.hit > 0 && !poolLegalTarget(S.guide.hit)),
                bih: S.phase === 'bih' ? { x: c.x, y: c.y, valid: !bihBad } : null,
                zone: S.phase === 'bih' ? S.frame.ballInHand : null,
                call: aiming && st.callRequired ? { called: S.called } : null,
                ring: aiming && S.nom >= 0 ? S.nom : null,
                drops: S.drops,
            });
        }
        const gs = S.phase === 'bih' ? pcProject(v, [c.x, c.y, S.cfg.ballR]) : null;
        // The other tab's turn reads as the CPU's does: its cue moves, yours stays down.
        const cpuTurn = poolCpuTurn() || poolRemoteTurn();
        phRender(S.hud, phModel({
            layout: S.hud.layout, game: S.game, title: R.title, status: st, diffs: R.diffs, mode: poolMode, names: poolNames(), records: { 1: poolRecordText(1), 2: poolRecordText(2) },
            frames: S.frames, trophies: S.wins,
            frame: S.frame, world: S.world, phase: S.phase, camera: userPreferences.poolCamera === '2d' ? '2d' : '3d',
            lean: poolLean(), power: S.power, dragging: !!(S.drag && S.drag.kind === 'power'), tip: S.tip, spinOpen: S.spinOpen, called: S.called,
            clock: !cpuTurn && S.clockTotal ? { left: Math.max(0, S.clockLeft), total: poolTurnClock() } : null,
            toast: S.toast, fouled: S.fouled, handoff: S.handoff,
            bih: S.phase === 'bih' ? { valid: !bihBad, reason: bihBad, placed: S.placed, sx: gs && gs[0], sy: gs && gs[1], sr: gs ? S.cfg.ballR * gs[2] : 0 } : null,
            result: S.result,
            canReplace: !!S.frame.ballInHand && S.placed && poolCanAct(),
            cpuTurn,
            sheet: { open: S.sheet.open, mode: S.sheet.mode, note: poolSheetNote(),
                names: [1, 2].map(seat => ({ value: String(userPreferences[POOL_PVP_NAME_PREFS[seat]] || ''), placeholder: poolPvpDefault(seat) })) },
            difficulty: poolDifficulty(), adaptiveTier: R.cpu.adaptive(poolCpuRec()),
            tour: poolTourHead(), tourSheet: poolTourSheet(),
            pots: S.pots,
            // The cue collection (open, else null), its pill's name, and a "New cue" notice.
            cueName: pqById(poolSeatCueId(poolPickSeat())).name,
            cues: S.cues ? poolCueView() : null,
            cueNew: S.cueNew && !S.cues ? S.cueNew : null,
            nom: S.nom, confirm: S.confirm, chipsOpen: S.chipsOpen,
            shot: aiming ? poolShotPath(v) : null,
            // ⚙️ Max View: the table between bars, or the full table (the default).
            maxBars: userPreferences.poolMaxLayout === 'bars',
            // Snooker's choice after a foul: the buttons (for a human chooser), or CHOOSING.
            choice: S.phase === 'choice' && S.frame.pending && R.choices ? {
                chooser: S.frame.pending.chooser, cpu: cpuTurn,
                options: R.choices(S.frame.pending, poolNames()),
            } : null,
            // Online: the sheet's tab, an invite over the table, and the frame-over buttons.
            net: poolNetModel(),
            primaryLabel: poolMode === 'net' ? poolNetPrimaryLabel() : null,
            reactOpen: poolMode === 'net' && S.reactOpen,
            // Vs CPU's PLAY / RESUME over the table, saying who breaks or is to play.
            start: poolMode === 'cpu' && S.awaitStart && S.phase !== 'over' ? {
                label: S.awaitStart === 'resume' ? 'RESUME' : 'PLAY',
                sub: S.awaitStart === 'resume' ? (S.frame.turn === 2 ? poolNames()[2] + ' to play' : 'Your shot')
                    : S.frame.turn === 2 ? poolNames()[2] + ' breaks' : 'You break',
            } : null,
            secondaryLabel: poolMode === 'net' ? 'Leave match' : null,
        }));
        poolTourSync();
    }

    // Under the difficulty list: when the pick cannot apply to the frame being played.
    function poolSheetNote() {
        if (poolMode !== 'cpu' || poolFrameFresh() || poolS.phase === 'over') return '';
        const cpu = poolRules().cpu, next = cpu.tierFor(poolDifficulty(), poolCpuRec());
        return next !== poolCpuTier ? cpu.tiers[next].label + ' from the next frame; this one stays ' + cpu.tiers[poolCpuTier].label : '';
    }

    function poolLoop(ms) {
        const S = poolS;
        if (!S.running) return;
        S.raf = requestAnimationFrame(poolLoop);
        const dt = S.lastMs ? Math.min(100, Math.max(0, ms - S.lastMs)) : 16;
        S.lastMs = ms;
        poolTick(dt);
        // Logic runs every animation frame; drawing honours the FPS setting.
        S.sinceDraw += dt;
        if (S.sinceDraw + 0.5 < getFrameInterval()) return;
        const elapsed = S.sinceDraw;
        S.sinceDraw = 0;
        poolDraw(elapsed);
    }

    // ── Input ─────────────────────────────────────────────────────────
    function poolView() { return pcView(poolS.director.pose || pcDirect(poolS.director, poolCamInput(), 0)); }
    function poolLocal(e) {
        const S = poolS, r = S.canvas.getBoundingClientRect(), k = r.width / S.W || 1;
        return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
    }
    const poolClamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const poolIsControl = el => !!(el && el.closest && el.closest('button, input, select, label, a, textarea'));
    function poolDisarm() { poolS.armed = false; poolS.lastX = null; }

    // Power: only movement along the shot line counts, back or forward; full power fits the canvas.
    function poolShotAxis() {
        const S = poolS, v = poolView(), c = poolCueBall(), R = S.cfg.ballR;
        const a = pcProject(v, [c.x, c.y, R]), b = pcProject(v, [c.x + Math.cos(S.aim) * 60, c.y + Math.sin(S.aim) * 60, R]);
        if (!a || !b) return [0, -1];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    }
    function poolRoom(px, py, ux, uy) {
        const S = poolS;
        let t = Infinity;
        if (ux > 1e-9) t = Math.min(t, (S.W - px) / ux); else if (ux < -1e-9) t = Math.min(t, -px / ux);
        if (uy > 1e-9) t = Math.min(t, (S.H - py) / uy); else if (uy < -1e-9) t = Math.min(t, -py / uy);
        return Math.max(0, t);
    }
    // The ball stops at the cushions (and the head string on the break), so it can be dragged along them.
    function poolPlace(sx, sy) {
        const S = poolS, R = poolRules();
        const p = pcView(pcOrtho(S.W, S.H, S.cfg)).unproject(sx, sy);
        const q = R.clampPlace(S.world, p[0], p[1], S.frame.ballInHand);
        R.placeCue(S.world, q[0], q[1]);
    }

    function poolOnEnter(e) { poolS.armed = true; poolS.lastX = poolLocal(e)[0]; }
    function poolOnDown(e) {
        const S = poolS;
        S.spinOpen = false;
        // The clock runs while the collection is open; a press on the table (Max) closes it.
        if (S.cues) { S.cues = false; return; }
        if (!poolCanAct() || !S.W) return;
        const [sx, sy] = poolLocal(e);
        try { S.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        S.armed = true; S.lastX = sx;
        if (S.phase === 'bih') { S.drag = { kind: 'place' }; S.placed = false; poolPlace(sx, sy); return; }
        if (S.phase !== 'aim') return;
        const st = poolRules().status(S.frame, S.world);
        // Snooker: a press on a colour that may be nominated nominates it (before any call).
        if (st.needsNomination) {
            const id = poolBallAt(sx, sy, st.nominable);
            if (id >= 0) { S.nom = id; S.chipsOpen = false; return; }
        }
        if (st.callRequired) {
            const hit = pgPocketMarks(poolView(), S.world.table, S.cfg).find(m => m.inView && Math.hypot(m.x - sx, m.y - sy) < Math.max(22, m.r));
            if (hit) { S.called = hit.i; return; }
            if (S.called < 0) return;
        }
        // Snooker: no power until a colour is nominated (the padlock).
        if (st.needsNomination) return;
        const ax = poolShotAxis();
        const reach = poolClamp(Math.max(poolRoom(sx, sy, ax[0], ax[1]), poolRoom(sx, sy, -ax[0], -ax[1])) - 6, 40, S.W > 1000 ? 220 : 140);
        S.drag = { kind: 'power', x: sx, y: sy, ax, reach };
        S.power = 0;
    }
    // The ball under the pointer among `ids`, or -1. The target is at least 12 px across the
    // centre, so the 2D view's small balls can still be pressed.
    function poolBallAt(sx, sy, ids) {
        const S = poolS, v = poolView(), R = S.cfg.ballR;
        let best = -1, bd = Infinity;
        S.world.balls.forEach(b => {
            if (b.state === 'pocketed' || ids.indexOf(b.id) < 0) return;
            const q = pcProject(v, [b.x, b.y, R]);
            if (!q) return;
            const d = Math.hypot(q[0] - sx, q[1] - sy);
            if (d < Math.max(12, R * q[2]) && d < bd) { bd = d; best = b.id; }
        });
        return best;
    }
    function poolOnMove(e) {
        const S = poolS;
        if (!S.W) return;
        const [sx, sy] = poolLocal(e);
        if (S.drag && S.drag.kind === 'place') { poolPlace(sx, sy); return; }
        if (S.drag && S.drag.kind === 'power') {
            const px = poolClamp(sx, 0, S.W), py = poolClamp(sy, 0, S.H);
            const along = Math.abs((px - S.drag.x) * S.drag.ax[0] + (py - S.drag.y) * S.drag.ax[1]);
            S.power = Math.min(100, Math.max(0, along - POOL_DEAD_PX) / (S.drag.reach - POOL_DEAD_PX) * 100);
            return;
        }
        if (!S.armed) return;
        const far = sx < -POOL_AIM_REACH || sx > S.W + POOL_AIM_REACH || sy < -POOL_AIM_REACH || sy > S.H + POOL_AIM_REACH;
        if (far || poolIsControl(e.target)) { poolDisarm(); return; }
        const dx = S.lastX === null ? 0 : sx - S.lastX;
        S.lastX = sx;
        if (S.phase !== 'aim' || !poolCanAct()) return;
        if (userPreferences.poolCamera !== '2d') S.aim -= dx * (e.shiftKey ? poolRules().aimFine : 0.3) * POOL_DEG;
        else {
            const p = poolView().unproject(sx, sy, S.cfg.ballR), c = poolCueBall();
            if (p && Math.hypot(p[0] - c.x, p[1] - c.y) > 2) S.aim = Math.atan2(p[1] - c.y, p[0] - c.x);
        }
    }
    function poolOnUp() {
        const S = poolS;
        if (!S.drag) return;
        const d = S.drag; S.drag = null;
        if (d.kind === 'place') {
            const c = poolCueBall();
            if (!poolRules().canPlace(S.world, c.x, c.y, S.frame.ballInHand)) {
                S.placed = true; S.phase = 'aim'; poolAimAtNearest();
                // The foul toast has no timer; left up, it would hide the spin control, hint and
                // call card for the whole shot (against the CPU no hand-off clears it).
                if (S.toast && S.toast.kind === 'foul') S.toast = null;
            }
            return;
        }
        if (S.power < 3) { S.power = 0; return; }
        S.phase = 'strike'; S.strikeT = 0;
    }
    function poolOnCancel() { if (poolS.drag && poolS.drag.kind === 'power') { poolS.drag = null; poolS.power = 0; } else poolOnUp(); }
    function poolOnWindowDown(e) {
        if (e.target !== poolS.canvas) poolDisarm();
        // A press anywhere but the spin control or its picker closes the picker.
        const t = e.target;
        if (poolS.spinOpen && !(t && t.closest && t.closest('.ph-spinpop, .ph-spin'))) poolS.spinOpen = false;
    }
    function poolOnKey(e) {
        const S = poolS;
        if (!S.attached || typeof currentGame !== 'undefined' && currentGame !== 'pool') return;
        // The spin picker takes its own keys (arrows move the tip, Esc closes it).
        if (e.target && e.target.closest && e.target.closest('.ph-spinpop')) return;
        // Esc closes the React tray (online), and nothing else sees it.
        if (e.key === 'Escape' && S.reactOpen) { S.reactOpen = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
        // Esc closes the Game mode sheet first, and nothing else sees it.
        if (e.key === 'Escape' && S.sheet.open) { S.sheet.open = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (S.cues) { if (e.key === 'Escape') { S.cues = false; e.preventDefault(); e.stopImmediatePropagation(); } return; }
        // Esc resumes from Pause, and backs out of the abandon question.
        if (e.key === 'Escape' && (S.tour.dialog === 'pause' || S.tour.dialog === 'abandon')) {
            poolTourOn[S.tour.dialog === 'pause' ? 'unpause' : 'keep'](); e.preventDefault(); e.stopImmediatePropagation(); return;
        }
        if (e.key === 'Escape' && S.drag && S.drag.kind === 'power') {
            // Cancel the stroke, and nothing else: not the Max modal, not a reset.
            S.drag = null; S.power = 0;
            e.preventDefault(); e.stopImmediatePropagation();
            return;
        }
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && S.phase === 'aim' && poolCanAct() && (S.armed || poolMaximized)) {
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            S.aim += (e.key === 'ArrowLeft' ? 1 : -1) * poolRules().aimKey * POOL_DEG;
            e.preventDefault();
        }
    }

    // ── HUD wiring ────────────────────────────────────────────────────
    const poolOn = {
        camera: m => { userPreferences.poolCamera = m === '2d' ? '2d' : '3d'; savePreferences(); },
        lean: v => {
            userPreferences.poolLean = v;
            // The slider fires on every step; save once it settles.
            clearTimeout(poolS.leanSave);
            poolS.leanSave = setTimeout(savePreferences, 400);
        },
        // Spin: anywhere inside the miscue ring. The tip resets to the centre after every shot.
        tip: t => { if (poolCanAct()) poolS.tip = phClampTip(t.x, t.y); },
        tipStep: d => { if (poolCanAct()) poolS.tip = phClampTip(poolS.tip.x + d.x, poolS.tip.y + d.y); },
        spinToggle: () => { poolS.spinOpen = !poolS.spinOpen && poolCanAct(); },
        spinClose: () => { poolS.spinOpen = false; },
        // The cue collection, from the header's cue pill (Max: its own button) or a "New cue" notice.
        cues: () => { const S = poolS; S.cues = !S.cues; S.cueRec = null; S.cueView = null; S.cueJust = null; S.sheet.open = false; S.spinOpen = false; },
        cuesClose: () => { poolS.cues = false; },
        cueEquip: id => poolCueEquip(id),
        cueNewX: () => { poolS.cueNew = null; poolS.cueView = null; },
        // The footer's mode button and the frame-over dialog's second button open the Game mode sheet.
        mode: () => { const S = poolS; S.sheet = { open: !S.sheet.open, mode: poolMode }; S.spinOpen = false; },
        sheetTab: m => { poolS.sheet.mode = m === 'pvp' || m === 'tour' || m === 'net' ? m : 'cpu'; },
        sheetClose: () => { poolS.sheet.open = false; },
        // A difficulty: remembered (the same setting as ⚙️), in force now if nothing has
        // been hit yet, else from the next frame. From 2 Players it switches to Vs CPU.
        difficulty: d => {
            const S = poolS, R = poolRules();
            userPreferences[R.diffPref] = R.cpu.tiers[d] ? d : 'adaptive';
            savePreferences();
            if (poolMode !== 'cpu') { poolSetMode('cpu'); S.sheet.open = false; return; }
            if (poolFrameFresh()) { poolLockTier(); S.sheet.open = false; }
        },
        startPvp: () => { poolSetMode('pvp'); poolS.sheet.open = false; },
        // A 2 Players name, as it is typed: the cards follow at once; saved once it settles.
        pvpName: d => {
            const key = d && POOL_PVP_NAME_PREFS[d.seat];
            if (!key) return;
            userPreferences[key] = String(d.value === undefined || d.value === null ? '' : d.value).slice(0, 16);
            clearTimeout(poolS.nameSave);
            poolS.nameSave = setTimeout(savePreferences, 400);
        },
        // The sheet's Tournament tab, and the tournament footer.
        tourGo: () => {
            const T = poolS.tour;
            poolS.sheet.open = false;
            if (poolMode === 'net') poolNetQuit();
            if (T.t && T.t.current) { poolTourResume(); return; }
            if (T.t) { T.screen = 'bracket'; T.tab = poolTourTab(); } else { T.setup = poolTourSetupFresh(); T.screen = 'setup'; }
            poolTourBump();
        },
        tourCabinet: () => { const T = poolS.tour; poolS.sheet.open = false; T.cabBack = null; T.screen = 'cabinet'; poolTourBump(); },
        tourAbandon: () => { const T = poolS.tour; poolS.sheet.open = false; if (!T.t) return; T.dlgBack = null; T.dialog = 'abandon'; poolTourBump(); },
        tourBracket: () => { const T = poolS.tour; if (!T.t) return; poolS.spinOpen = false; T.screen = 'bracket'; T.tab = poolTourTab(); poolTourBump(); },
        tourPause: () => { const T = poolS.tour; if (!T.t) return; poolS.spinOpen = false; poolS.drag = null; poolS.power = 0; T.dialog = 'pause'; poolTourBump(); },
        reset: () => { if (poolMode !== 'net') resetPoolGame(); },
        max: () => togglePoolMaximize(),
        call: i => { if (poolCanAct()) poolS.called = i; },
        // While a choice after a foul is pending, its toast and the fouled card's tag stay.
        ready: () => {
            const S = poolS;
            S.handoff = 0;
            if (!(S.frame && S.frame.pending)) { S.toast = null; S.fouled = 0; }
            S.clockLeft = poolTurnClock() || POOL_CLOCK_S;
        },
        // Snooker: a colour chip, before the stroke.
        nominate: id => {
            const S = poolS;
            if (!poolCanAct() || S.phase !== 'aim' || S.drag) return;
            const st = poolRules().status(S.frame, S.world);
            if (!st.on || st.on.nominable.indexOf(id) < 0) return;
            // The folded chip (the nominated colour) reopens the chips; picking it again folds them.
            if (id === S.nom) { S.chipsOpen = !S.chipsOpen; return; }
            S.nom = id; S.chipsOpen = false; poolAimAtNearest();
        },
        choose: id => {
            const S = poolS;
            if (S.phase !== 'choice' || S.handoff || poolCpuTurn() || poolRemoteTurn() || poolTourBlocked()) return;
            if (poolMode === 'net') poolNetMove({ k: 'choice', n: S.netFrameNo, id });
            poolChoose(id, false);
        },
        // Concede: asked, then confirmed, only by the player at the table.
        concede: () => { const S = poolS; if (poolRules().concede && poolCanAct() && (S.phase === 'aim' || S.phase === 'bih')) { S.confirm = true; S.drag = null; S.power = 0; } },
        concedeNo: () => { poolS.confirm = false; },
        concedeYes: () => {
            const S = poolS, R = poolRules();
            if (!S.confirm || !R.concede) return;
            S.confirm = false;
            if (poolMode === 'net') poolNetMove({ k: 'concede', n: S.netFrameNo });
            poolAfterTurn(R.concede(S.frame, S.frame.turn));
        },
        // Pick the cue ball up again. The clock pauses in hand and resumes, so this buys no time.
        replace: () => { const S = poolS; if (S.phase === 'aim' && S.frame.ballInHand && poolCanAct() && !S.drag) { S.phase = 'bih'; S.placed = false; S.power = 0; } },
        // NEW FRAME is itself the start: that rack does not wait behind PLAY.
        primary: () => { if (poolMode === 'tour') poolTourNextFrame(); else if (poolMode === 'net') poolNetNextFrame(); else { poolS.startNow = true; poolNewFrame(3 - poolS.breaker); } },
        start: () => { poolS.awaitStart = null; poolS.clockLeft = poolTurnClock() || POOL_CLOCK_S; },
        secondary: () => { if (poolMode === 'tour') poolOn.tourBracket(); else if (poolMode === 'net') poolNetQuit(true); else poolS.sheet = { open: true, mode: poolMode }; },
        // Online (the sheet's tab and the invite over the table).
        netServer: v => { userPreferences.poolNetServer = String(v || '').trim().slice(0, 120); clearTimeout(poolS.nameSave); poolS.nameSave = setTimeout(savePreferences, 400); },
        netConnect: () => { userPreferences.poolNetAuto = true; savePreferences(); poolNetConnect(userPreferences.poolNetServer); },
        netDisconnect: () => { if (poolMode === 'net') poolNetQuit(); userPreferences.poolNetAuto = false; savePreferences(); poolNetDisconnect(); },
        netBestOf: n => { poolS.netBestOf = [1, 3, 5].indexOf(+n) >= 0 ? +n : 1; poolNetBump(); },
        netChallenge: id => poolNetChallenge(id, { game: poolS.game, bestOf: poolS.netBestOf, reds: poolRules().framesReds ? poolRules().framesReds() : 15 }),
        netCancel: () => poolNetCancel(),
        netAccept: id => { poolS.sheet.open = false; poolNetAnswer(id, true); },
        netDecline: id => poolNetAnswer(id, false),
        netLeave: () => { poolS.sheet.open = false; poolNetQuit(true); },
        // Online reactions: the tray, and one sent (an emoji closes the tray; so does a message).
        react: () => { const S = poolS; if (poolMode !== 'net' || !S.netRoom || S.netRoom.closed) return; S.reactOpen = !S.reactOpen; S.spinOpen = false; S.sheet.open = false; },
        reactClose: () => { poolS.reactOpen = false; },
        reactSend: text => { if (poolNetSay(text)) poolS.reactOpen = false; },
    };

    function poolBuild(root) {
        const S = poolS;
        root.innerHTML = '';
        S.root = root;
        S.canvas = document.createElement('canvas');
        S.ctx = S.canvas.getContext('2d');
        S.hudC = phBuild(root, { layout: 'compact', on: poolOn, canvas: S.canvas });
        S.hud = S.hudC;
        S.W = S.H = 0;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────
    function initPoolGame() {
        const root = document.getElementById('pool-root');
        if (!root) return;
        const S = poolS;
        poolGamesWon = loadPoolHighScore();
        loadPoolWinsByMode();   // seeds the per-mode split on first run
        poolRecord = loadPoolRecord();
        if (!S.cfg) poolUseGame(userPreferences.poolVariant);
        poolS.cpuRec = poolLoadCpuRecord();
        if (!S.hudC || !root.contains(S.hudC.el)) poolBuild(root);
        // A frame in progress survives switching games; a snooker frame survives a reload too.
        if (!S.world && !poolRestoreTable(poolLoadSaved())) poolNewFrame(1);
        // Once per page: a tournament saved last time is offered back.
        if (!S.tour.checked) {
            S.tour.checked = true;
            const t = poolTourLoad();
            if (t) { S.tour.t = t; S.tour.dialog = 'resume'; poolTourBump(); }
        }
        poolAttach();
        poolSyncChrome();
        // Online: the engine's hooks, and the server you used last time.
        poolNet.on = { start: poolNetStart, closed: poolNetClosed };
        if (userPreferences.poolNetAuto && userPreferences.poolNetServer && poolNet.state === 'off' && !poolNet.wanted) poolNetConnect(userPreferences.poolNetServer);
    }

    function poolAttach() {
        const S = poolS;
        if (S.attached) return;
        S.attached = true;
        S.dpr = Math.min(window.devicePixelRatio || 1, 2);
        const c = S.canvas;
        c.addEventListener('pointerenter', poolOnEnter);
        c.addEventListener('pointerdown', poolOnDown);
        c.addEventListener('pointerup', poolOnUp);
        c.addEventListener('pointercancel', poolOnCancel);
        window.addEventListener('pointermove', poolOnMove);
        window.addEventListener('pointerdown', poolOnWindowDown, true);
        window.addEventListener('keydown', poolOnKey, true);
        window.addEventListener('blur', poolDisarm);
        document.documentElement.addEventListener('pointerleave', poolDisarm);
        if (window.matchMedia) {
            S.scheme = window.matchMedia('(prefers-color-scheme: dark)');
            if (S.scheme.addEventListener) S.scheme.addEventListener('change', poolOnThemeChange);
        }
        S.running = true; S.lastMs = 0; S.sinceDraw = Infinity; S.drawKey = '';
        S.raf = requestAnimationFrame(poolLoop);
    }

    function poolDetach() {
        const S = poolS;
        poolTourSnapshot();
        poolSaveFrame();
        if (poolMaximized) togglePoolMaximize();
        S.running = false;
        if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
        if (!S.attached) return;
        S.attached = false;
        const c = S.canvas;
        c.removeEventListener('pointerenter', poolOnEnter);
        c.removeEventListener('pointerdown', poolOnDown);
        c.removeEventListener('pointerup', poolOnUp);
        c.removeEventListener('pointercancel', poolOnCancel);
        window.removeEventListener('pointermove', poolOnMove);
        window.removeEventListener('pointerdown', poolOnWindowDown, true);
        window.removeEventListener('keydown', poolOnKey, true);
        window.removeEventListener('blur', poolDisarm);
        document.documentElement.removeEventListener('pointerleave', poolDisarm);
        if (S.scheme && S.scheme.removeEventListener) S.scheme.removeEventListener('change', poolOnThemeChange);
        S.scheme = null;
        S.drag = null; S.power = S.phase === 'strike' ? S.power : 0;
        poolDisarm();
    }

    // ── The two games ─────────────────────────────────────────────────
    // The header's switch picks the game. Each keeps its own frame: switching parks the one
    // on the table and brings the other back as it was left (or racks a fresh one).

    // The whole table at rest (balls, rules state, mode, tier, frames, clock); null mid-shot or decided.
    function poolSnapshotTable() {
        const S = poolS;
        if (!S.world || !S.frame || S.frame.over || S.phase === 'over' || S.phase === 'moving' || S.phase === 'strike') return null;
        return Object.assign(poolTableSnap(), { v: 1, game: S.game, mode: poolMode === 'pvp' ? 'pvp' : 'cpu', tier: poolCpuTier, frames: S.frames.slice() });
    }
    // What a quick frame and a tournament's match both save, and put back.
    function poolTableSnap() {
        const S = poolS;
        return {
            breaker: S.breaker, frame: JSON.parse(JSON.stringify(S.frame)),
            balls: S.world.balls.map(b => ({ id: b.id, x: b.x, y: b.y, q: b.q.slice(), state: b.state, pocket: b.pocket })),
            clockLeft: S.clockLeft, fouled: S.fouled, pots: { 1: S.pots[1].slice(), 2: S.pots[2].slice() },
        };
    }
    function poolApplySnap(snap, world) {
        const S = poolS, R = poolRules();
        poolNewFrame(snap.breaker === 2 ? 2 : 1);
        S.world = world; S.frame = JSON.parse(JSON.stringify(snap.frame));
        S.fouled = snap.fouled === 1 || snap.fouled === 2 ? snap.fouled : 0;
        const potsOf = a => (Array.isArray(a) ? a.filter(id => Number.isInteger(id) && R.tracksPot(id)) : []);
        S.pots = { 1: potsOf(snap.pots && snap.pots[1]), 2: potsOf(snap.pots && snap.pots[2]) };
    }
    // The clock it was left on, within today's limit: ⚙️ may have lowered it since.
    const poolSnapClock = snap => { const full = poolTurnClock() || POOL_CLOCK_S; return snap.clockLeft > 0 ? Math.min(snap.clockLeft, full) : full; };
    const poolDownSet = () => new Set(poolS.world.balls.filter(b => b.state === 'pocketed').map(b => b.id));
    // A world rebuilt from a snapshot's balls, or null if any of them is not a ball.
    function poolWorldFrom(snap) {
        const R = poolRules();
        try {
            if (!Array.isArray(snap.balls) || snap.balls.length !== R.ballCount(snap.frame)) return null;
            const world = R.world();
            world.balls = snap.balls.map(b => {
                if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) throw new Error('ball');
                const ball = ppMakeBall(b.id | 0, b.x, b.y);
                ball.state = b.state === 'pocketed' ? 'pocketed' : 'stationary';
                ball.pocket = b.pocket | 0;
                if (Array.isArray(b.q) && b.q.length === 4 && b.q.every(Number.isFinite)) ball.q = b.q.slice();
                return ball;
            });
            return world;
        } catch (_) { return null; }
    }
    // Puts a parked or saved quick frame back as it was left; false if not this game's or not a frame.
    function poolRestoreTable(snap) {
        const S = poolS, R = poolRules();
        if (!snap || snap.v !== 1 || snap.game !== S.game || !R.validFrame(snap.frame)) return false;
        const world = poolWorldFrom(snap);
        if (!world) return false;
        if (poolMode !== 'tour') poolMode = snap.mode === 'pvp' ? 'pvp' : 'cpu';
        poolApplySnap(snap, world);
        if (Array.isArray(snap.frames) && snap.frames.length === 2 && snap.frames.every(n => Number.isInteger(n) && n >= 0)) S.frames = snap.frames.slice();
        // The tier stays the one the frame was locked to.
        if (poolMode === 'cpu' && R.cpu.tiers[snap.tier]) { poolCpuTier = snap.tier; poolRefreshScoreBtn(); }
        S.down = poolDownSet();
        if (S.frame.pending) S.phase = 'choice'; else poolStartTurn();
        S.clockLeft = poolSnapClock(snap);
        // In hot-seat, whoever is to act takes the seat.
        S.handoff = poolMode === 'pvp' ? S.frame.turn : 0;
        S.awaitStart = poolMode === 'cpu' && !!S.hudC ? 'resume' : null;
        S.drawKey = '';
        return true;
    }
    // Snooker's quick frame survives a reload: written at every shot boundary, removed once
    // the frame is decided (before the award). Pool keeps no such save.
    function poolSaveFrame() {
        const key = poolRules().keys.frame;
        // An online frame comes back from the server's log instead.
        if (!key || poolMode === 'tour' || poolMode === 'net') return;
        const snap = poolSnapshotTable();
        if (snap) poolStoreWrite(key, snap);
    }
    function poolLoadSaved() {
        const key = poolRules().keys.frame;
        if (!key) return null;
        try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
    }
    function poolClearSaved() {
        const key = poolRules().keys.frame;
        if (key) { try { localStorage.removeItem(key); } catch (_) {} }
    }
    // The header follows the game: the title, the switcher's tooltip, and which wins button shows.
    function poolSyncChrome() {
        const R = poolRules();
        if (typeof currentGame === 'undefined' || currentGame === 'pool') {
            const t = document.getElementById('game-title');
            if (t) poolRenderTitle(t);
        }
        const sw = document.getElementById('game-switch-pool');
        if (sw) sw.title = R.title;
        // The cue pill, before the wins buttons: the equipped cue; it opens the collection.
        const sb = document.getElementById('pool-scoreboard');
        if (sb) {
            let b = document.getElementById('pool-cue-pill');
            if (!b) {
                b = Object.assign(document.createElement('button'), { type: 'button', id: 'pool-cue-pill', className: 'snake-score pool-cue-pill' });
                b.setAttribute('aria-haspopup', 'dialog');
                b.addEventListener('click', () => poolOn.cues());
                sb.insertBefore(b, sb.firstChild);
            }
            poolS.pill = '';
            poolCuePill();
        }
        Object.keys(POOL_GAMES).forEach(g => { const b = document.getElementById(POOL_GAMES[g].lb + '-lb-btn'); if (b) b.style.display = g === poolS.game ? '' : 'none'; });
        poolRefreshScoreBtn();
    }
    // The panel header: a switch between the two games (the one on the table lit), then its
    // name. The host's other games write plain text here, which drops the switch.
    function poolRenderTitle(el) {
        const S = poolS, next = POOL_GAMES[S.game === 'snooker' ? 'pool' : 'snooker'].title;
        el.innerHTML = '<button type="button" class="pool-cue-switch" data-game="' + S.game + '" aria-label="Switch to ' + next + '" title="Switch to ' + next + '">' +
            Object.keys(POOL_GAMES).map(g => '<span class="pool-cue-opt' + (g === S.game ? ' is-on' : '') + '">' + (typeof attIcon === 'function' ? attIcon(POOL_GAMES[g].icon) : '') + '</span>').join('') +
            '</button><span class="pool-cue-name">' + poolRules().title + '</span>';
        el.firstChild.addEventListener('click', poolToggleVariant);
    }
    // The header's switch: the other game, remembered for next time.
    function poolToggleVariant() {
        userPreferences.poolVariant = poolS.game === 'snooker' ? 'pool' : 'snooker';
        savePreferences();
        poolSetVariant(userPreferences.poolVariant);
    }
    // The cue game. Works with the panel closed too. A shot in flight is run to rest and
    // judged first; a tournament match is saved as it stands (it resumes from the sheet).
    function poolSetVariant(game) {
        const S = poolS;
        if (!POOL_GAMES[game]) game = 'pool';
        if (game === S.game && S.cfg) { poolSyncChrome(); return; }
        // An online match keeps its game: the header's switch waits until you leave.
        if (poolMode === 'net' && S.netRoom && !S.netRoom.closed) { poolSyncChrome(); return; }
        if (poolMaximized) togglePoolMaximize();
        if (S.world && S.phase === 'strike') { S.phase = 'aim'; S.power = 0; S.shot = null; }
        if (S.world && S.phase === 'moving') { ppSimulate(S.world, 60); poolSettle(); }
        if (poolMode === 'tour') {
            const T = S.tour;
            poolTourSnapshot();
            poolMode = T.prevMode === 'pvp' ? 'pvp' : 'cpu';
            T.matchId = null; T.pending = 0; T.screen = null; T.dialog = null;
            S.guideMode = 'full'; S.callEvery = false; S.callMode = 'off';
            S.parked[S.game] = null;
        } else if (S.world) {
            S.parked[S.game] = poolSnapshotTable();
            poolSaveFrame();
        }
        poolUseGame(game);
        S.sheet.open = false; S.spinOpen = false; S.drag = null; S.power = 0; S.toast = null; S.handoff = 0;
        const snap = S.parked[game] || poolLoadSaved();
        S.parked[game] = null;
        S.world = null;
        if (S.hudC || S.frame) { S.frames = [0, 0]; if (!poolRestoreTable(snap)) poolNewFrame(1); }
        // This game's saved tournament, once per page, as the panel offers pool's.
        if (S.hudC && !S.tour.checked) {
            S.tour.checked = true;
            const t = poolTourLoad();
            if (t) { S.tour.t = t; S.tour.dialog = 'resume'; poolTourBump(); }
        }
        poolSyncChrome();
    }
    // ⚙️ settings: the CPU difficulty (now if nothing has been hit, else next frame), the shot
    // clock (now), snooker's reds (a fresh rack, if nothing has been hit). Others are ignored.
    function poolOnPrefChange(pref) {
        const S = poolS, R = poolRules();
        if (!S.frame) return;
        if (pref === 'poolCue') { S.cueView = null; poolCueClock(); poolSyncChrome(); return; }
        if (pref === R.diffPref) { if (poolMode === 'cpu' && poolFrameFresh()) poolLockTier(); return; }
        // ⚙️ Shot Clock, now: the turn under way keeps what it has left, within the new limit
        // (from Off, it starts full). A tournament keeps its own.
        if (pref === R.clockPref) {
            if (poolMode === 'tour') return;
            const was = S.clockTotal;
            S.clockTotal = poolQuickClock();
            S.clockLeft = was && S.clockTotal ? Math.min(S.clockLeft, poolTurnClock()) : poolTurnClock() || POOL_CLOCK_S;
            return;
        }
        if (R.rackPref && pref === R.rackPref && poolMode !== 'tour' && poolFrameFresh()) poolNewFrame(S.breaker);
    }

    // ── Tournament ────────────────────────────────────────────────────
    // The bracket lives in poolS.tour.t; poolMode is 'tour' only while one of its matches is
    // on the table (tour.matchId). Screens and dialogs stop the clock and all input under them.
    const poolTourMatch = () => { const T = poolS.tour; return poolMode === 'tour' && T.t && T.matchId ? ptById(T.t, T.matchId) || null : null; };
    const poolTourBlocked = () => !!(poolS.tour.screen || poolS.tour.dialog || poolS.tour.pending);
    function poolTourBump() { poolS.tour.rev++; }
    // Seat 1 is the match's upper line (a), seat 2 the lower (b).
    const poolTourBreakerSeat = m => (ptBreaker(poolS.tour.t, m, m.frames.length) === m.a ? 1 : 2);
    // The round the bracket opens on: the match in progress, else the next one, else the final.
    function poolTourTab() {
        const t = poolS.tour.t, m = (t.current && ptById(t, t.current)) || ptNext(t);
        return m ? m.round : t.rounds - 1;
    }

    // A finished tournament is not kept: it is in the cabinet, and there is nothing to resume.
    function poolTourSave() {
        const t = poolS.tour.t;
        try {
            const key = poolRules().keys.tour;
            if (t && ptChampion(t) === null) localStorage.setItem(key, JSON.stringify(t));
            else localStorage.removeItem(key);
        } catch (_) {}
    }
    // The saved tournament, or null. A corrupt or outdated one is dropped behind a toast, never half-loaded.
    function poolTourLoad() {
        let raw = null;
        const key = poolRules().keys.tour;
        try { raw = localStorage.getItem(key); } catch (_) { return null; }
        if (!raw) return null;
        let t = null;
        try { t = ptValidate(JSON.parse(raw), poolS.game); } catch (_) { t = null; }
        if (t && t.current) {
            const m = ptById(t, t.current);
            if (!m || m.status === 'done' || m.status === 'bye' || m.a === null || m.b === null) t.current = null;
        }
        if (t && ptChampion(t) === null) return t;
        try { localStorage.removeItem(key); } catch (_) {}
        if (!t) poolShowToast({ kind: 'notice', title: "Couldn't resume the tournament", sub: 'The saved bracket was damaged or out of date' });
        return null;
    }
    function poolCabinet() {
        const T = poolS.tour;
        if (!T.cab) {
            let c = null;
            try { c = JSON.parse(localStorage.getItem(poolRules().keys.cab) || 'null'); } catch (_) {}
            T.cab = c && c.v === 1 && c.titles && typeof c.titles === 'object' && Array.isArray(c.recent) ? c : ptCabinetEmpty();
        }
        return T.cab;
    }

    // The table after a shot: the balls, the rules state and the clock. Written only when
    // nothing is moving; restored only into the same frame of the same match.
    function poolTourSnapshot() {
        const S = poolS, T = S.tour, m = poolTourMatch();
        if (!m || !T.t.current || !S.world || S.phase === 'moving' || S.phase === 'strike' || S.phase === 'over' || S.frame.over) return;
        T.t.snapshot = Object.assign(poolTableSnap(), { match: m.id, frames: m.frames.length });
        poolTourSave();
    }
    function poolTourRestore(snap, m) {
        const S = poolS, R = poolRules();
        if (!snap || snap.match !== m.id || snap.frames !== m.frames.length || !Array.isArray(snap.balls) || !R.validFrame(snap.frame)) return false;
        const world = poolWorldFrom(snap);
        if (!world) return false;
        poolApplySnap(snap, world);
        S.clockLeft = poolSnapClock(snap);
        if (poolCueBall().state === 'pocketed') { const home = R.cueHome(S.world); R.placeCue(S.world, home[0], home[1]); }
        S.down = poolDownSet();
        if (S.frame.pending) S.phase = 'choice';
        else if (S.frame.ballInHand) { S.phase = 'bih'; S.placed = false; } else { S.phase = 'aim'; poolAimAtNearest(); }
        S.drawKey = '';
        return true;
    }

    // The table follows the tournament's settings while one of its matches is on.
    function poolTourApply() {
        const S = poolS, set = S.tour.t.settings;
        S.guideMode = set.guide === 'short' || set.guide === 'off' ? set.guide : 'full';
        S.callEvery = set.call === 'every';
        S.callMode = set.call === 'colours' || set.call === 'all' ? set.call : 'off';
        S.clockTotal = poolTourClock();
    }
    const poolTourClock = () => { const c = poolS.tour.t.settings.clock; return c === 45 || c === 60 ? c : c === 0 ? 0 : POOL_CLOCK_S; };
    // Puts a match on the table: from the start, or from its snapshot.
    function poolTourSeat(m, fromSnapshot) {
        const S = poolS, T = S.tour;
        if (poolMode !== 'tour') T.prevMode = poolMode;
        poolMode = 'tour';
        T.matchId = m.id; T.t.current = m.id;
        poolTourApply();
        S.frames = ptScore(m); S.sheet.open = false; S.spinOpen = false;
        if (!(fromSnapshot && poolTourRestore(T.t.snapshot, m))) poolNewFrame(poolTourBreakerSeat(m));
        poolTourSave();
    }
    // Back to quick matches (the mode before, or the one asked for). The tournament stays saved.
    function poolLeaveTour(mode) {
        const S = poolS, T = S.tour;
        poolTourSnapshot();
        poolMode = mode === 'pvp' || mode === 'cpu' ? mode : T.prevMode === 'pvp' ? 'pvp' : 'cpu';
        T.matchId = null; T.pending = 0;
        S.guideMode = 'full'; S.callEvery = false; S.callMode = 'off'; S.clockTotal = poolQuickClock();
        S.frames = [0, 0];
        poolNewFrame(1);
        poolRefreshScoreBtn();
    }
    function poolSetMode(mode) {
        if (poolMode === 'tour') poolLeaveTour(mode);
        else if (poolMode === 'net') { poolNetQuit(); if (mode === 'pvp') togglePoolMode(); }
        else if (poolMode !== mode) togglePoolMode();
    }
    // Resume: the match in progress as of its last shot, the shooter seated; with none, the bracket.
    function poolTourResume() {
        const S = poolS, T = S.tour, t = T.t;
        T.dialog = null; T.screen = null; poolTourBump();
        const m = t && t.current && ptById(t, t.current);
        if (!m) { if (t) { T.screen = 'bracket'; T.tab = poolTourTab(); } return; }
        if (poolTourMatch() === m) return;
        poolTourSeat(m, true);
        S.handoff = S.frame.turn;
    }

    // From poolEndFrame: the frame (with snooker's points and breaks) goes into the bracket.
    function poolTourFrameOver(seat, v) {
        const S = poolS, T = S.tour, m = poolTourMatch(), R = poolRules();
        if (!m || (seat !== 1 && seat !== 2)) return;
        const r = ptRecordFrame(T.t, m.id, seat === 1 ? m.a : m.b, R.tourFrame && v && v.next ? R.tourFrame(v) : null);
        T.t = r.t;
        S.frames = ptScore(ptById(T.t, m.id));
        if (r.matchOver) {
            T.t.current = null;
            // Match XP for the YOU seat only, once per match. Other names' matches, byes and
            // titles pay nothing (the bracket is farmable).
            const mm = ptById(T.t, m.id), mine = [mm.a, mm.b].find(s => T.t.slots[s] && T.t.slots[s].you);
            if (mine !== undefined) {
                const won = mm.winner === mine;
                awardGameXP(poolRules().xpType, { won, vsCPU: false, tour: true, round: ptRoundName(T.t.rounds, mm.round), xp: won ? POOL_TOUR_WIN_XP : POOL_LOSS_XP });
            }
            if (ptChampion(T.t) !== null) {
                T.cab = ptCabinetAdd(poolCabinet(), T.t);
                try { localStorage.setItem(poolRules().keys.cab, JSON.stringify(T.cab)); } catch (_) {}
            }
        }
        poolTourSave();
        poolTourBump();
    }
    // The frame-over dialog mid-match; a won match goes to its result screen once the last ball drops.
    function poolTourResult(text) {
        const S = poolS, m = poolTourMatch();
        S.phase = 'over'; S.toast = null;
        if (!m) return;
        if (m.status === 'done') { S.result = null; S.tour.pending = POOL_RESULT_MS; return; }
        S.result = {
            win: true, title: text.title, reason: text.sub,
            recordLabel: 'MATCH · ' + ptRaceText(S.tour.t, m.raceTo).toUpperCase(), record: S.frames[0] + '–' + S.frames[1],
            delta: '+1 FRAME', note: '',
        };
    }
    function poolTourNextFrame() {
        const m = poolTourMatch();
        if (m && m.status !== 'done') poolNewFrame(poolTourBreakerSeat(m));
    }

    // Setup's draft: four players (the smallest full bracket), you in slot 1.
    function poolTourSetupFresh() {
        const names = Array.from({ length: PT_MAX }, () => '');
        names[0] = poolMe();
        return poolTourSetupRace(Object.assign({ n: 4, names, name: '', clock: 30, guide: 'full', shuffle: false, size: 0, race: [] }, poolRules().tourDefaults));
    }
    // The race-to columns follow the bracket size; a new size starts from its defaults.
    function poolTourSetupRace(d) {
        const size = ptSizeFor(d.n);
        if (d.size !== size) { d.size = size; d.race = ptRaceColumns(size).map(c => PT_RACE_DEFAULT[size][c.rounds[0]]); }
        return d;
    }
    function poolTourStart() {
        const T = poolS.tour, d = T.setup, cols = ptRaceColumns(d.size);
        const race = Array.from({ length: ptRoundsFor(d.size) }, (_, r) => d.race[cols.findIndex(c => c.rounds.indexOf(r) !== -1)]);
        T.t = ptCreate({ game: d.game, names: d.names.slice(0, d.n), you: 0, name: d.name, settings: { race, clock: d.clock, guide: d.guide, call: d.call, reds: d.reds, shuffle: d.shuffle } });
        T.t.current = null;
        T.setup = null;
        poolTourSave();
        T.screen = 'bracket'; T.tab = 0;
        poolTourBump();
    }

    // The screens' and dialogs' buttons (pool-tour-ui.js data-pu-act, and edits).
    const poolTourOn = {
        edit: (field, value) => {
            const d = poolS.tour.setup;
            if (!d) return;
            const v = String(value === undefined || value === null ? '' : value);
            if (field === 'tname') d.name = v.slice(0, 24);
            else if (field.indexOf('name:') === 0) d.names[+field.slice(5)] = v.slice(0, 16);
            else if (field.indexOf('race:') === 0) d.race[+field.slice(5)] = Math.max(1, Math.min(5, parseInt(v, 10) || 1));
            // No re-render: the field keeps its caret, and nothing else depends on it.
        },
        count: arg => { const d = poolS.tour.setup; if (!d) return; d.n = Math.max(PT_MIN, Math.min(PT_MAX, d.n + (+arg || 0))); poolTourSetupRace(d); poolTourBump(); },
        set: arg => {
            const d = poolS.tour.setup, i = String(arg).indexOf(':');
            if (!d || i < 0) return;
            const k = String(arg).slice(0, i), v = String(arg).slice(i + 1);
            if (k === 'clock') d.clock = v === '45' ? 45 : v === '60' && d.game === 'snooker' ? 60 : v === '0' ? 0 : 30;
            else if (k === 'reds') d.reds = [15, 10, 6].indexOf(+v) >= 0 ? +v : 15;
            else if (k === 'guide') d.guide = v === 'short' || v === 'off' ? v : 'full';
            else if (k === 'call') { const opts = (d.calls || [['8'], ['every']]).map(c => c[0]); d.call = opts.indexOf(v) >= 0 ? v : opts[0]; }
            poolTourBump();
        },
        shuffle: () => { const d = poolS.tour.setup; if (d) { d.shuffle = !d.shuffle; poolTourBump(); } },
        start: () => { if (poolS.tour.setup) poolTourStart(); },
        tab: arg => { poolS.tour.tab = Math.max(0, +arg || 0); poolTourBump(); },
        play: () => { const T = poolS.tour, n = T.t && ptNext(T.t); if (!n) return; T.introId = n.id; T.screen = 'intro'; poolTourBump(); },
        ready: () => {
            const T = poolS.tour, m = T.t && T.introId && ptById(T.t, T.introId);
            if (!m || m.status === 'done') return;
            T.screen = null; poolTourBump();
            poolTourSeat(m, false);
        },
        resume: () => poolTourResume(),
        resumeTour: () => poolTourResume(),
        bracket: () => { const T = poolS.tour; if (!T.t) return; T.screen = 'bracket'; T.tab = poolTourTab(); poolTourBump(); },
        champion: () => { const T = poolS.tour; if (T.t && ptChampion(T.t) !== null) { T.screen = 'champion'; poolTourBump(); } },
        // Leaving a screen: from the champion the tournament is let go; with no match in
        // progress, a tournament table goes back to quick matches.
        close: () => {
            const T = poolS.tour;
            if (T.screen === 'champion' || (T.t && ptChampion(T.t) !== null)) T.t = null;
            T.screen = null; T.setup = null; poolTourBump();
            if (poolMode === 'tour' && !(T.t && T.t.current)) poolLeaveTour();
        },
        new: () => {
            const T = poolS.tour;
            T.t = null; poolTourSave();
            if (poolMode === 'tour') poolLeaveTour();
            T.setup = poolTourSetupFresh(); T.screen = 'setup'; poolTourBump();
        },
        cabinet: () => { const T = poolS.tour; T.cabBack = T.screen; T.screen = 'cabinet'; poolTourBump(); },
        cabinetBack: () => { const T = poolS.tour; T.screen = T.cabBack || null; T.cabBack = null; poolTourBump(); },
        unpause: () => { poolS.tour.dialog = null; poolTourBump(); },
        // Pause → Leave for now: the match is saved as it stands, to be resumed later.
        leave: () => { const T = poolS.tour; T.dialog = null; poolTourBump(); poolLeaveTour(); },
        abandon: () => { const T = poolS.tour; T.dlgBack = T.dialog; T.dialog = 'abandon'; poolTourBump(); },
        keep: () => { const T = poolS.tour; T.dialog = T.dlgBack || null; T.dlgBack = null; poolTourBump(); },
        abandonYes: () => {
            const T = poolS.tour;
            T.t = null; T.dialog = null; T.dlgBack = null; T.screen = null; poolTourSave(); poolTourBump();
            if (poolMode === 'tour') poolLeaveTour();
        },
    };

    // The HUD's tournament header: "CITY OPEN" over "Semi-final · race to 2", FRAME n.
    function poolTourHead() {
        const S = poolS, m = poolTourMatch();
        if (!m) return null;
        const n = S.phase === 'over' ? m.frames.length : m.frames.length + 1;
        return { kicker: S.tour.t.name.toUpperCase(), title: ptRoundName(S.tour.t.rounds, m.round) + ' · ' + ptRaceText(S.tour.t, m.raceTo).toLowerCase(), frame: 'FRAME ' + Math.max(1, n) };
    }
    // The Game mode sheet's Tournament tab: resume the saved one, or set one up.
    function poolTourSheet() {
        const t = poolS.tour.t;
        if (!t) return { saved: false };
        const m = (t.current && ptById(t, t.current)) || ptNext(t);
        return { saved: true, name: t.name, where: m ? t.slots[m.a].name + ' vs ' + t.slots[m.b].name + ' · ' + ptRoundName(t.rounds, m.round) : '' };
    }
    // Renders the screen and dialog over whichever HUD is showing, only when either changed.
    function poolTourSync() {
        const S = poolS, T = S.tour, hud = S.hud, max = hud.layout === 'max';
        const pu = puMount(hud, poolTourOn);
        const miniW = (hud.miniW && hud.miniW.w === hud.el.clientWidth && hud.miniW.v) || (max ? 440 : Math.max(240, Math.min(388, (hud.el.clientWidth || 368) - 34)));
        const liveId = T.t && T.t.current;
        const needsT = T.screen && T.screen !== 'setup' && T.screen !== 'cabinet';
        const screen = T.screen && !(needsT && !T.t) && !(T.screen === 'setup' && !T.setup) ? T.screen : null;
        const dialog = T.dialog && T.t ? T.dialog : null;
        // Max: the full tree takes the HUD's width and what the 64 px header leaves of its height.
        const maxW = max ? hud.el.clientWidth || 1232 : 0, maxH = max ? Math.max(300, (hud.el.clientHeight || 752) - 80) : 0;
        const key = { screen: screen ? screen + '|' + T.rev + '|' + miniW + '|' + maxW + 'x' + maxH : '', dialog: dialog ? dialog + '|' + T.rev : '' };
        if (pu.key.screen === key.screen && pu.key.dialog === key.dialog) return;
        let html = '';
        if (screen === 'setup') html = puSetupHTML(T.setup);
        else if (screen === 'bracket') html = puBracketHTML({ t: T.t, tab: Math.min(T.tab, T.t.rounds - 1), liveId, layout: hud.layout, miniW, maxW, maxH });
        else if (screen === 'intro') html = puIntroHTML({ t: T.t, matchId: T.introId });
        else if (screen === 'result') html = puResultHTML({ t: T.t, matchId: T.matchId, miniW });
        else if (screen === 'champion') html = puChampionHTML({ t: T.t, layout: hud.layout, miniW });
        else if (screen === 'cabinet') html = puCabinetHTML({ cab: poolCabinet(), game: S.game });
        puSync(hud, poolTourOn, { screen: html, dialog: dialog ? puDialogHTML(dialog, { t: T.t, liveId }) : '', key });
        hud.el.classList.toggle('is-pu', !!screen);
        // The mini tree needs its box's real width (minus the scrollbar): measured after the
        // render, and drawn again once if it was off.
        const box = screen && pu.screen.querySelector('.pu-mini:not(.is-big)');
        if (box && box.clientWidth && Math.abs(box.clientWidth - miniW) > 0.5) { hud.miniW = { w: hud.el.clientWidth, v: box.clientWidth }; pu.key.screen = null; }
    }

    // ── Online (pool-net.js) ──────────────────────────────────────────
    // poolMode 'net' while a room is on the table. Both tabs rack frame n from the room's seed
    // and play every move through the same physics and rules, so they stay in step on inputs
    // alone; the shooter's table at rest follows each strike, and a tab that disagrees takes
    // it. Moves wait in poolNet.inbox until the table is still. Each tab files its own result.
    const poolNetSeedFor = n => (poolS.netRoom.seed + Math.imul(n, 2654435761)) >>> 0;
    // Seat 1 (the challenger) breaks the first frame, then the break alternates.
    function poolNetBeginFrame(n) {
        const S = poolS;
        S.netFrameNo = n; S.netStep = 0;
        poolNewFrame(n % 2 === 0 ? 1 : 2, poolNetSeedFor(n));
        S.handoff = 0;
        S.clockTotal = poolQuickClock();
        S.clockLeft = poolTurnClock() || POOL_CLOCK_S;
    }
    // The server put us in a room (a new one, or ours again after a reload: its log follows).
    function poolNetStart(room, again) {
        const S = poolS;
        if (again && S.netRoom && S.netRoom.id === room.id && !S.netRoom.closed) return;
        if (poolMode === 'tour') poolLeaveTour('cpu');
        // The quick frame on the table waits for us, as switching games parks it.
        if (poolMode !== 'net' && S.world) S.parked[S.game] = poolSnapshotTable();
        if (S.game !== room.game) { S.netRoom = null; poolMode = 'cpu'; poolSetVariant(room.game); }
        poolMode = 'net';
        S.netRoom = { id: room.id, seed: room.seed, game: room.game, bestOf: room.bestOf, seat: room.seat, names: room.names.slice(), reds: room.reds, closed: false };
        S.frames = [0, 0]; S.result = null; S.sheet.open = false; S.cues = false; S.spinOpen = false; S.drag = null; S.power = 0; S.netResyncs = 0;
        poolNetBeginFrame(0);
        poolRefreshScoreBtn();
        poolSyncChrome();
    }
    // The room is over at the server: the other player left or never came back (a win by
    // forfeit if the frame was live), or ours ran out while we were away.
    function poolNetClosed(info) {
        const S = poolS, room = S.netRoom;
        if (poolMode !== 'net' || !room || room.closed) return;
        room.closed = true;
        const them = 3 - room.seat, name = poolNames()[them];
        const theyWent = info.by === them && (info.reason === 'left' || info.reason === 'timeout');
        const why = info.reason === 'left' ? name + ' left the match' : info.reason === 'timeout' && theyWent ? name + " didn't come back in time" : 'The match ended';
        if (theyWent && S.phase !== 'over' && S.frame && !S.frame.over) {
            // In flight: the shot is played out first, as switching games does.
            if (S.phase === 'strike') { S.phase = 'aim'; S.shot = null; }
            if (S.phase === 'moving') { ppSimulate(S.world, 60); S.phase = 'aim'; }
            S.frames[room.seat - 1]++;
            if (poolNetMarkAwarded(room.id, S.netFrameNo)) {
                const R = poolRules();
                R.fileNet(true);
                awardGameXP(R.xpType, { won: true, vsCPU: false, online: true, forfeit: true, opponent: name, tier: null, xp: R.frameXP({ won: true, vsCPU: false, frame: S.frame }) });
                poolRefreshScoreBtn();
            }
            const rec = poolRules().netRecord();
            S.result = { win: true, title: 'You win', reason: why, recordLabel: 'ONLINE · RECORD', record: rec.wins + 'W · ' + rec.losses + 'L', delta: '+1 WIN', note: 'Won by forfeit' };
            S.phase = 'over'; S.toast = null;
            return;
        }
        if (S.phase === 'over' && S.result) { S.result = Object.assign({}, S.result, { note: why }); return; }
        poolNetQuit();
        poolShowToast({ kind: 'notice', title: why, sub: 'Back to Vs CPU' });
    }
    // Out of the room, back to the quick frame we left (or a fresh one). A frame still live
    // is lost: leaving is conceding it.
    function poolNetQuit() {
        const S = poolS, room = S.netRoom;
        if (room && !room.closed && S.phase !== 'over' && S.frame && !S.frame.over && poolNetMarkAwarded(room.id, S.netFrameNo)) poolRules().fileNet(false);
        if (poolNet.room) poolNetLeave();
        S.netRoom = null; S.netFrameNo = 0; S.result = null; S.frames = [0, 0]; S.reactOpen = false;
        poolMode = 'cpu';
        const snap = S.parked[S.game];
        S.parked[S.game] = null;
        if (!poolRestoreTable(snap)) poolNewFrame(1);
        poolRefreshScoreBtn();
        poolSyncChrome();
    }

    // Every frame: the other tab's moves (once the table is still), and the live cue both ways.
    function poolNetTick(dt) {
        const S = poolS, N = poolNet;
        if (!S.netRoom || S.netRoom.closed) return;
        while (N.inbox.length && S.phase !== 'strike' && S.phase !== 'moving') poolNetPlay(N.inbox.shift());
        if (S.phase !== 'aim' && S.phase !== 'bih' && S.phase !== 'strike') return;
        if (!poolRemoteTurn()) {
            const c = poolCueBall(), bih = S.phase === 'bih';
            poolNetAim({ a: S.aim, p: S.power, tx: S.tip.x, ty: S.tip.y, cx: bih ? Math.round(c.x * 100) / 100 : null, cy: bih ? Math.round(c.y * 100) / 100 : null, q: poolSeatCueId(S.netRoom.seat), ph: S.phase });
            return;
        }
        const A = N.aim;
        if (!A || S.phase === 'strike') return;
        // Eased, so 10 updates a second still turn smoothly.
        let d = A.a - S.aim;
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
        S.aim += d * Math.min(1, dt / 80);
        S.power = Math.max(0, Math.min(100, A.p));
        const t = A.tip || {};
        if (Number.isFinite(t.x) && Number.isFinite(t.y)) S.tip = phClampTip(t.x, t.y);
        if (t.ph === 'bih' && S.frame.ballInHand && Number.isFinite(t.cx) && Number.isFinite(t.cy)) {
            // Only drawn: the strike carries where it was really placed.
            const c = poolCueBall();
            c.x = t.cx; c.y = t.cy; c.state = 'stationary';
            if (S.phase !== 'bih') { S.phase = 'bih'; S.placed = false; }
        } else if (t.ph === 'aim' && S.phase === 'bih') { S.phase = 'aim'; S.placed = true; }
    }
    const poolNetShotOk = s => !!s && ['angle', 'speed', 'tipX', 'tipY', 'cap', 'tipMax'].every(k => Number.isFinite(s[k]));
    // One move from the room's log. Replayed ones (after a reload) play to rest at once.
    function poolNetPlay(e) {
        const S = poolS, R = poolRules(), m = (e && e.m) || {};
        if (!S.netRoom) return;
        S.netReplay = !!e.replay;
        try {
            if (m.k === 'frame') {
                if (m.n > S.netFrameNo) { if (m.rematch) S.frames = [0, 0]; S.result = null; poolNetBeginFrame(m.n); }
                return;
            }
            // A move of a frame this table has already left behind.
            if (m.n !== S.netFrameNo) return;
            if (m.k === 'strike') {
                if ((S.phase !== 'aim' && S.phase !== 'bih') || !poolNetShotOk(m.shot)) return;
                if (Array.isArray(m.cue) && Number.isFinite(m.cue[0]) && Number.isFinite(m.cue[1])) R.placeCue(S.world, m.cue[0], m.cue[1]);
                S.called = Number.isInteger(m.called) ? m.called : -1;
                S.nom = Number.isInteger(m.nom) ? m.nom : -1;
                S.shot = { raw: m.shot }; S.aim = m.shot.angle;
                if (e.replay) {
                    poolStrikeNow();
                    for (let i = 0; i < 36000 && S.phase === 'moving'; i++) if (poolStepMoving()) break;
                } else { S.phase = 'strike'; S.strikeT = 0; }
            } else if (m.k === 'timeout') {
                if (S.phase !== 'aim' && S.phase !== 'bih') return;
                S.nom = Number.isInteger(m.nom) ? m.nom : -1;
                const v = R.timeout(S.frame, S.world);
                poolShowToast(R.text(v, poolNames()));
                poolAfterTurn(v);
            } else if (m.k === 'concede') {
                if (R.concede && !S.frame.over && S.phase !== 'over') poolAfterTurn(R.concede(S.frame, S.frame.turn));
            } else if (m.k === 'choice') {
                if (S.phase === 'choice') poolChoose(m.id, true);
            } else if (m.k === 'settled') {
                // Only against the table after that same step: once a later one has been played
                // here (the next player was quicker than the message), it is out of date.
                if (m.s === S.netStep && m.h !== poolNetHash()) poolNetResync(m.snap);
            }
        } finally { S.netReplay = false; }
    }
    // The table at rest, as a short digest both tabs can compare.
    function poolNetHash() {
        const S = poolS, f = S.frame || {};
        const s = S.world.balls.map(b => b.id + (b.state === 'pocketed' ? 'p' : '') + Math.round(b.x * 1e3) + ',' + Math.round(b.y * 1e3)).join('|') +
            '#' + f.turn + (f.scores ? ':' + f.scores[1] + ',' + f.scores[2] : '') + (f.groups ? ':' + f.groups[1] : '') + ':' + !!f.over;
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(36);
    }
    // The shooter's table, where ours drifted from it.
    function poolNetResync(snap) {
        const S = poolS, R = poolRules();
        if (!snap || !snap.frame || snap.frame.over || !R.validFrame(snap.frame)) return;
        const world = poolWorldFrom(snap);
        if (!world) return;
        S.world = world; S.frame = JSON.parse(JSON.stringify(snap.frame));
        S.fouled = snap.fouled === 1 || snap.fouled === 2 ? snap.fouled : 0;
        if (snap.pots) S.pots = { 1: (snap.pots[1] || []).slice(), 2: (snap.pots[2] || []).slice() };
        S.down = poolDownSet();
        if (S.frame.pending) S.phase = 'choice'; else poolStartTurn();
        S.netResyncs++; S.drawKey = '';
    }
    // Each frame of a room is filed once on this browser, a reload's replay included.
    function poolNetMarkAwarded(roomId, n) {
        let rec = null;
        try { rec = JSON.parse(localStorage.getItem('poolNetAwarded') || 'null'); } catch (_) {}
        if (!rec || rec.room !== roomId || !Array.isArray(rec.frames)) rec = { room: roomId, frames: [] };
        if (rec.frames.indexOf(n) >= 0) return false;
        rec.frames.push(n);
        try { localStorage.setItem('poolNetAwarded', JSON.stringify(rec)); } catch (_) {}
        return true;
    }
    // A frame is over: the count, our own record and XP (your break, from either seat).
    function poolNetFrameOver(w, v) {
        const S = poolS, R = poolRules(), room = S.netRoom;
        if (!room || (w !== 1 && w !== 2)) return;
        S.frames[w - 1]++;
        poolNetResult(S.netFrameNo, w);
        // Filed already: before a reload (its replay), or by a forfeit.
        if (!poolNetMarkAwarded(room.id, S.netFrameNo)) return;
        const won = w === room.seat, f = v.next || S.frame;
        const mine = room.seat === 2 && f && f.high ? Object.assign({}, f, { high: { 1: f.high[2], 2: f.high[1] } }) : f;
        R.fileNet(won);
        awardGameXP(R.xpType, Object.assign({ won, vsCPU: false, online: true, opponent: poolNames()[3 - room.seat], tier: null, xp: R.frameXP({ won, vsCPU: false, frame: mine }) }, R.xpPerf(mine)));
        poolRefreshScoreBtn();
    }
    const poolNetNeed = () => Math.ceil((poolS.netRoom ? poolS.netRoom.bestOf : 1) / 2);
    const poolNetMatchOver = () => Math.max(poolS.frames[0], poolS.frames[1]) >= poolNetNeed();
    function poolNetResultDialog(w, t, more) {
        const S = poolS, room = S.netRoom, won = !!room && w === room.seat, rec = poolRules().netRecord();
        const names = poolNames(), b = room ? room.bestOf : 1;
        let note = '';
        if (b > 1) note = poolNetMatchOver() ? (S.frames[(room.seat) - 1] >= poolNetNeed() ? 'You win the match ' : names[3 - room.seat] + ' wins the match ') + S.frames[0] + '–' + S.frames[1]
            : 'Best of ' + b + ' · ' + S.frames[0] + '–' + S.frames[1];
        S.result = { win: won, title: t.title, reason: more ? more.reason : t.sub, recordLabel: 'ONLINE · RECORD', record: rec.wins + 'W · ' + rec.losses + 'L', delta: won ? '+1 WIN' : '+1 LOSS', note };
        if (more) S.result.stats = [{ label: 'SCORE', value: more.score }, { label: 'HIGH BREAK', value: more.high }];
        S.phase = 'over'; S.toast = null;
    }
    const poolNetPrimaryLabel = () => (!poolS.netRoom || poolS.netRoom.closed ? 'BACK TO CPU' : poolNetMatchOver() ? 'REMATCH' : 'NEXT FRAME');
    // The frame-over dialog's button: the next frame (or a rematch) for both tabs; either may press it.
    function poolNetNextFrame() {
        const S = poolS;
        if (!S.netRoom || S.netRoom.closed) { poolNetQuit(); return; }
        const n = S.netFrameNo + 1, rematch = poolNetMatchOver();
        poolNetMove({ k: 'frame', n, rematch });
        if (rematch) S.frames = [0, 0];
        S.result = null;
        poolNetBeginFrame(n);
    }
    // The cards' second line: your online record, and the other player's state.
    function poolNetRecordText(seat) {
        const S = poolS, room = S.netRoom;
        if (!room) return '';
        if (seat === room.seat) { const r = poolRules().netRecord(); return 'You · ' + r.wins + 'W ' + r.losses + 'L'; }
        if (room.closed) return 'Left';
        if (poolNet.peer === 'away') { const s = Math.max(0, Math.ceil((poolNet.peerUntil - Date.now()) / 1000)); return 'Reconnecting ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
        return poolNet.state === 'open' ? 'Online' : 'Offline';
    }
    // The HUD's online parts: the sheet's tab and an invite over the table.
    function poolNetModel() {
        const N = poolNet, S = poolS;
        return {
            state: N.state, err: N.err, note: N.note, server: String(userPreferences.poolNetServer || ''),
            players: N.lobby.map(p => ({ id: p.id, name: p.name, busy: p.status === 'playing' })),
            invites: N.invites.map(i => ({ id: i.id, name: i.name, game: i.game, bestOf: i.bestOf })),
            outgoing: N.outgoing ? N.outgoing.name || 'them' : '',
            bestOf: S.netBestOf, game: S.game,
            inRoom: poolMode === 'net' && !!S.netRoom && !S.netRoom.closed,
            said: poolNetSaying(),
            rev: N.rev,
        };
    }

    // ── Theme ─────────────────────────────────────────────────────────
    // The Max view is body-level: give it the widget's theme classes and tokens (as the host
    // does for its PiP clone) so Cyberpunk resolves there.
    function poolSyncMaxTheme() {
        const f = poolS.maxFrame;
        if (!f) return;
        const widget = document.getElementById('total-time-summary');
        const cyber = !!(widget && widget.classList.contains('retro-theme'));
        f.classList.toggle('retro-theme', cyber);
        if (cyber) { applyCyberTokens(f); applyCyberShape(f); }
        else { clearCyberTokens(f); clearCyberShape(f); }
    }

    function poolOnThemeChange() {
        const S = poolS;
        if (!S.hudC) return;
        poolSyncMaxTheme();
        phThemeChanged(S.hudC); phThemeChanged(S.hudM);
        S.cache = {}; S.drawKey = '';
    }

    // ── Max ───────────────────────────────────────────────────────────
    // 1280 × 800 design pixels, scaled to fit the window; poolLocal() maps the pointer back.
    function poolFitMax() {
        const S = poolS;
        if (!S.maxFrame || !S.maxPanel) return;
        const k = Math.min(1, (window.innerWidth - 32) / POOL_MAX_W, (window.innerHeight - 32) / POOL_MAX_H);
        S.maxPanel.style.width = Math.round(POOL_MAX_W * k) + 'px';
        S.maxPanel.style.height = Math.round(POOL_MAX_H * k) + 'px';
        S.maxFrame.style.transform = 'scale(' + k + ')';
    }
    function poolBuildMax(panel) {
        const S = poolS;
        S.maxPanel = panel;
        S.maxFrame = document.createElement('div');
        // Snooker's full view is a little tighter at the top, for the tracker row.
        S.maxFrame.className = 'pool-max-frame' + (S.game === 'snooker' ? ' is-snooker' : '');
        panel.appendChild(S.maxFrame);
        S.hudM = phBuild(S.maxFrame, { layout: 'max', on: poolOn, canvas: S.canvas, title: poolRules().title });
        S.hud = S.hudM;
        poolSyncMaxTheme();
        poolFitMax();
        window.addEventListener('resize', poolFitMax);
        S.W = S.H = 0; S.drawKey = '';
    }
    function poolUnbuildMax() {
        const S = poolS;
        window.removeEventListener('resize', poolFitMax);
        S.hudC.view.insertBefore(S.canvas, S.hudC.view.firstChild);
        S.hudM = null; S.hud = S.hudC; S.maxFrame = null; S.maxPanel = null;
        S.W = S.H = 0; S.drawKey = '';
    }
    function togglePoolMaximize() {
        if (!poolS.hudC) return;
        poolMaximized = toggleGameMaxModal({
            canvasId: 'pool-root',
            title: poolRules().title,
            panelClass: 'pool-max-panel',
            build: poolBuildMax,
            unbuild: poolUnbuildMax,
            onToggle: togglePoolMaximize,
        });
    }
