    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — GAME (v2)
    // ═══════════════════════════════════════════════════════════════════
    // The controller: it runs the match and ties the physics, rules, camera,
    // renderer, HUD and CPU into the panel the host shows.
    //
    // What the rest of the userscript calls:
    //   initPoolGame()        switchGame opened the panel: build it once, keep a
    //                         frame in progress, attach input, start the loop
    //   poolDetach()          switchGame left: stop the loop, drop the window
    //                         listeners, close Max
    //   resetPoolGame()       a fresh rack
    //   togglePoolMode()      Vs CPU ⇄ 2 Players, then a fresh rack
    //   togglePoolMaximize()  the Max view, through the shared toggleGameMaxModal
    //   poolOnThemeChange()   applyPreferences ran: re-read the theme tokens
    //   poolMode, poolGamesWon, poolMaximized, poolRecord
    //                         read by the leaderboard, achievements and tests
    //
    // Input (POOL_V2_PLAN.md, Input):
    //   3D     sideways mouse movement turns the aim (0.3°/px, Shift 0.05°/px),
    //          and keeps doing so after the mouse leaves the table
    //   2D     point at the target
    //   power  press, then pull back or push forward along the shot line;
    //          back under 3% and release, or Esc, cancels
    //   ←/→    ±0.1° while the table has the mouse or Max is open
    //   ball in hand: drag the cue ball; it stops at the cushions and, on
    //          the break, at the head string. Move cue ball picks it up again
    // Escape never resets the frame here; it cancels a power drag, else the
    // Max modal's own handler closes Max.

    const POOL_CLOCK_S = 30;                 // shot clock for human turns, as today
    const POOL_AIM_REACH = 240;              // px past the table's edge the aim keeps following
    const POOL_DEAD_PX = 4;                  // power drag dead zone
    const POOL_STRIKE_MS = 90;               // the cue's forward stroke before the ball launches
    const POOL_TOAST_MS = 2200;
    const POOL_POT_XP = 5;
    const POOL_MAX_W = 1280, POOL_MAX_H = 800;
    const POOL_DEG = Math.PI / 180;

    let poolMode = 'cpu';                    // 'cpu' | 'pvp'
    let poolGamesWon = 0;                    // all-time wins, as stored by savePoolHighScore
    let poolRecord = null;                   // { p1Wins, p1Losses, p2Wins, p2Losses }
    let poolMaximized = false;
    // The CPU's tier for this frame: locked when the frame starts (adaptive or
    // pinned, userPreferences.poolDifficulty), so it cannot shift mid-frame.
    let poolCpuTier = 'normal';

    // Everything else about the panel and the match lives in one object, so
    // a reset is a reassignment rather than thirty lines of lets.
    const poolS = {
        root: null, hudC: null, hudM: null, hud: null, canvas: null, ctx: null, maxFrame: null, maxPanel: null,
        W: 0, H: 0, dpr: 1, cfg: null, director: null, cache: {},
        world: null, frame: null, rackId: 0, awardedRack: -1, breaker: 1, frames: [0, 0], seed: 0, rng: null,
        phase: 'aim', aim: 0, power: 0, tip: { x: 0, y: 0 }, spinOpen: false, called: -1, guide: null, guideKey: '',
        drops: [], down: new Set(), drag: null, strikeT: 0, shot: null,
        toast: null, toastMs: 0, fouled: 0, handoff: 0, result: null, placed: false, clockLeft: POOL_CLOCK_S,
        cpu: null, wins: 0,
        // Your record against the CPU (adaptive difficulty reads it), and the Game mode sheet.
        cpuRec: null, sheet: { open: false, mode: 'cpu' },
        // Table settings: guide length (full | short | off) and call every shot. Fixed for
        // quick matches today; tournaments (Phase 7) and the pro tier (Phase 6) set them.
        guideMode: 'full', callEvery: false,
        running: false, raf: null, lastMs: 0, acc: 0, sinceDraw: 0, drawKey: '',
        attached: false, armed: false, lastX: null, leanSave: null, scheme: null,
    };

    // ── Seats, names, records ─────────────────────────────────────────
    function poolNames() {
        const me = typeof lbDisplayName === 'string' && lbDisplayName.trim() ? lbDisplayName.trim().slice(0, 16) : '';
        return poolMode === 'cpu' ? { 1: me || 'You', 2: 'CPU' } : { 1: me || 'Player 1', 2: 'Player 2' };
    }
    // The picked difficulty: 'adaptive' (the default) or a pinned tier.
    const poolDifficulty = () => (PA_TIERS[userPreferences.poolDifficulty] ? userPreferences.poolDifficulty : 'adaptive');
    function poolLoadCpuRecord() {
        let r = null;
        try { r = JSON.parse(localStorage.getItem('poolCpuRecord') || 'null'); } catch (_) {}
        return { wins: (r && parseInt(r.wins, 10)) || 0, losses: (r && parseInt(r.losses, 10)) || 0 };
    }
    function poolSaveCpuRecord(r) { try { localStorage.setItem('poolCpuRecord', JSON.stringify(r)); } catch (_) {} }
    const poolCpuRec = () => poolS.cpuRec || (poolS.cpuRec = poolLoadCpuRecord());
    // Locks the tier for the frame; pro calls every shot, for both seats.
    function poolLockTier() {
        const S = poolS;
        poolCpuTier = paTierFor(poolDifficulty(), poolCpuRec());
        S.frame.callEvery = S.callEvery || (poolMode === 'cpu' && !!PA_TIERS[poolCpuTier].callEvery);
    }
    // Nothing has been hit yet in this frame, so a new difficulty can apply to it.
    const poolFrameFresh = () => !!poolS.frame && poolS.frame.isBreak && poolS.phase !== 'moving' && poolS.phase !== 'strike';

    function poolRecordText(seat) {
        const r = poolRecord || { p1Wins: 0, p1Losses: 0, p2Wins: 0, p2Losses: 0 };
        if (poolMode === 'cpu' && seat === 2) {
            const label = PA_TIERS[poolCpuTier].label;
            return poolDifficulty() === 'adaptive' ? 'Adaptive · ' + label : label;
        }
        return seat === 1 ? r.p1Wins + 'W · ' + r.p1Losses + 'L' : r.p2Wins + 'W · ' + r.p2Losses + 'L';
    }
    function poolWins() {
        const byMode = loadPoolWinsByMode();
        return poolMode === 'pvp' ? byMode.pvp : byMode.cpu;
    }
    // The header button and the Max trophy show the same count; it only changes when a
    // frame ends or the mode flips, so it is read here and cached, not every frame.
    function poolRefreshScoreBtn() { poolS.wins = poolWins(); updateGameScoreBtn('pool', null, poolS.wins); }
    const poolCpuTurn = () => poolMode === 'cpu' && poolS.frame && poolS.frame.turn === 2 && !poolS.frame.over;
    const poolCueBall = () => poolS.world.balls[0];
    const poolSpeedOf = p => poolS.cfg.maxSpeed * p / 100;
    const poolTip = () => poolS.tip;

    // ── Frames ────────────────────────────────────────────────────────
    function poolNewFrame(breaker) {
        const S = poolS;
        if (!S.cfg) S.cfg = ppCreateWorld().cfg;
        S.seed = (Date.now() ^ (S.rackId * 2654435761)) >>> 0;
        S.rng = ppRandom(S.seed);
        S.world = ppRack(ppCreateWorld(), S.rng);
        S.breaker = breaker === 2 ? 2 : 1;
        S.frame = prNewFrame({ breaker: S.breaker, callEvery: S.callEvery });
        poolLockTier();
        S.rackId++;
        // Inside the kitchen, not on its line, so a press on the ball never rounds past it.
        S.world.balls[0].x = S.world.table.headX - 80; S.world.balls[0].y = 0;
        S.down = new Set(); S.drops = []; S.called = -1; S.guide = null; S.guideKey = '';
        S.aim = 0; S.power = 0; S.tip = { x: 0, y: 0 }; S.spinOpen = false; S.phase = 'bih'; S.placed = false; S.drag = null; S.shot = null;
        S.toast = null; S.toastMs = 0; S.fouled = 0; S.result = null; S.cpu = null;
        S.handoff = 0; S.clockLeft = POOL_CLOCK_S;
        S.drawKey = '';
    }

    function resetPoolGame() {
        if (!poolS.cfg) poolS.cfg = ppCreateWorld().cfg;
        poolNewFrame(poolS.breaker);
    }

    function togglePoolMode() {
        poolMode = poolMode === 'cpu' ? 'pvp' : 'cpu';
        poolS.frames = [0, 0];
        poolNewFrame(1);
        poolRefreshScoreBtn();
    }

    // The frame is over: record it once per rack, however it ended.
    function poolEndFrame(v) {
        const S = poolS, w = v.winner;
        if (S.awardedRack === S.rackId) return;
        S.awardedRack = S.rackId;
        if (!poolRecord) poolRecord = loadPoolRecord();
        // Seed the per-mode split before the all-time count moves; seeded after,
        // it would copy this win in and then count it again.
        loadPoolWinsByMode();
        if (w === 1) {
            poolGamesWon++;
            savePoolHighScore(poolGamesWon);
            savePoolWinByMode(poolMode);
            poolRecord.p1Wins++; poolRecord.p2Losses++;
            savePoolRecord(poolRecord);
            awardGameXP('pool', { won: true });
        } else if (w === 2) {
            poolRecord.p2Wins++; poolRecord.p1Losses++;
            savePoolRecord(poolRecord);
            awardGameXP('pool', { won: false });
        }
        if (poolMode === 'cpu') {
            const rec = poolCpuRec();
            if (w === 1) rec.wins++; else rec.losses++;
            poolSaveCpuRecord(rec);
        }
        S.frames[w - 1]++;
        poolRefreshScoreBtn();
    }

    // +5 XP per legal pot, for the seats today's game pays: yours against the
    // CPU, and both in 2 Players (problem 8, changed in Phase 8).
    function poolAwardPots(seat, n) {
        if (!n || !(seat === 1 || poolMode === 'pvp') || !xpSystemReady) return;
        const xpGained = n * POOL_POT_XP;
        userXP.currentXP += xpGained;
        userXP.totalXP += xpGained;
        checkLevelUp();
        saveUserXP(userXP);
        showXPNotification('🎱 +' + xpGained + ' XP (' + (n === 1 ? '1 pot' : n + ' pots') + ')', 'game');
        updateXPDisplay();
    }

    // What the frame-over dialog says about the next frame's CPU, when adaptive.
    function poolAdaptiveNote() {
        if (poolMode !== 'cpu' || poolDifficulty() !== 'adaptive') return '';
        const now = poolCpuTier, next = paAdaptiveTier(poolCpuRec()), label = PA_TIERS[next].label;
        const d = PA_TIER_NAMES.indexOf(next) - PA_TIER_NAMES.indexOf(now);
        return d > 0 ? 'Adaptive steps up to ' + label + ' next frame' : d < 0 ? 'Adaptive eases to ' + label + ' next frame' : 'Adaptive stays at ' + label;
    }

    function poolShowToast(t) { poolS.toast = t; poolS.toastMs = t && t.kind !== 'foul' ? POOL_TOAST_MS : 0; }

    // Applies a verdict (a judged shot or a timeout) and sets up the next turn.
    function poolAfterTurn(v) {
        const S = poolS, shooter = v.shooter;
        S.frame = v.next; S.called = -1; S.tip = { x: 0, y: 0 }; S.spinOpen = false; S.power = 0; S.cpu = null; S.shot = null;
        if (v.frameOver) {
            const w = v.winner, t = prText(v, poolNames());
            const you = poolMode === 'cpu' ? w === 1 : null;
            poolEndFrame(v);
            S.result = {
                win: you === null ? true : you, title: t.title, reason: t.sub,
                recordLabel: (poolMode === 'cpu' ? poolNames()[1] : poolNames()[w]).toUpperCase() + ' · RECORD',
                record: poolRecordText(poolMode === 'cpu' ? 1 : w),
                delta: poolMode === 'cpu' ? (you ? '+1 WIN' : '+1 LOSS') : '+1 WIN',
                note: poolAdaptiveNote(),
            };
            S.phase = 'over'; S.toast = null;
            return;
        }
        S.fouled = v.foul ? shooter : 0;
        // Hot-seat: when the table changes hands, the next player takes the seat first.
        if (poolMode === 'pvp' && S.frame.turn !== shooter) S.handoff = S.frame.turn;
        if (S.frame.ballInHand) {
            const c = poolCueBall();
            if (c.state === 'pocketed') prPlaceCue(S.world, S.world.table.headX - 80, 0);
            S.phase = 'bih'; S.placed = false;
        } else { S.phase = 'aim'; poolAimAtNearest(); }
        S.clockLeft = POOL_CLOCK_S;
    }

    function poolSettle() {
        const S = poolS;
        const v = prJudge(S.frame, S.world, S.called);
        poolShowToast(prText(v, poolNames()));
        if (v.respot8) prSpotBall(S.world, 8);
        if (!v.foul) poolAwardPots(v.shooter, v.counted.length);
        poolAfterTurn(v);
    }

    // ── Aim helpers ───────────────────────────────────────────────────
    function poolLegalTarget(id) {
        const S = poolS, st = prStatus(S.frame, S.world);
        if (S.frame.isBreak) return true;
        if (st.onThe8) return id === 8;
        if (id === 8) return false;
        return !st.group || prGroupOf(id) === st.group;
    }
    function poolAimAtNearest() {
        const S = poolS, c = poolCueBall();
        const cands = S.world.balls.filter(b => b.id !== 0 && b.state !== 'pocketed' && poolLegalTarget(b.id));
        if (!cands.length) return;
        cands.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
        S.aim = Math.atan2(cands[0].y - c.y, cands[0].x - c.x);
    }
    function poolRefreshGuide() {
        const S = poolS;
        if (S.phase !== 'aim' && S.phase !== 'strike') { S.guide = null; return; }
        const p = S.drag ? Math.max(S.power, 5) : 50, t = poolTip();
        const key = [S.aim.toFixed(5), Math.round(p), t.x, t.y, S.world.t].join();
        if (key === S.guideKey) return;
        S.guideKey = key;
        S.guide = pgGuide(S.world, { angle: S.aim, speed: poolSpeedOf(p), tipX: t.x, tipY: t.y });
    }
    // A human may act: not in the hand-off, not while the CPU plays.
    const poolCanAct = () => !poolS.handoff && !poolCpuTurn() && poolS.phase !== 'over' && !poolS.sheet.open;

    // ── The CPU's turn ────────────────────────────────────────────────
    // Wait a beat, place the ball if it has it in hand, think (time-sliced),
    // turn the cue onto the line, draw it back, then strike.
    function poolCpuTick(dt) {
        const S = poolS;
        if (!poolCpuTurn() || S.phase === 'moving' || S.phase === 'strike') return;
        const c = S.cpu || (S.cpu = { stage: 'wait', t: 0 });
        c.t += dt;
        if (S.phase === 'bih') {
            if (c.t < 550) return;
            const p = paPlace(S.world, S.frame, S.rng, poolCpuTier);
            prPlaceCue(S.world, p[0], p[1]);
            S.phase = 'aim'; S.placed = true; poolAimAtNearest();
            S.cpu = { stage: 'wait', t: 0 };
            return;
        }
        if (S.phase !== 'aim') return;
        if (c.stage === 'wait') {
            if (c.t < 350) return;
            S.tip = { x: 0, y: 0 }; S.spinOpen = false;
            c.job = paPlan(S.world, S.frame, { rng: S.rng, tier: poolCpuTier });
            c.stage = 'think'; c.t = 0;
        } else if (c.stage === 'think') {
            if (!c.job.step(3)) return;
            c.shot = c.job.shot; c.from = S.aim; c.stage = 'turn'; c.t = 0;
            if (c.shot.call >= 0) S.called = c.shot.call;
        } else if (c.stage === 'turn') {
            const k = Math.min(1, c.t / 650);
            let d = c.shot.angle - c.from;
            d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
            S.aim = c.from + d * pcEase(k);
            if (k >= 1 && c.t > 900) { c.stage = 'draw'; c.t = 0; }
        } else if (c.stage === 'draw') {
            const target = Math.min(100, c.shot.speed / S.cfg.maxSpeed * 100);
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

    function poolTick(dt) {
        const S = poolS;
        if (S.phase === 'strike') {
            S.strikeT += dt;
            if (S.strikeT >= POOL_STRIKE_MS) {
                S.world.log = [];
                const t = poolTip();
                ppStrike(S.world, S.shot || { angle: S.aim, speed: poolSpeedOf(S.power), tipX: t.x, tipY: t.y });
                S.shot = null;
                S.phase = 'moving'; S.acc = 0; S.toast = null; S.fouled = 0; S.placed = false;
            }
        } else if (S.phase === 'moving') {
            S.acc += dt;
            while (S.acc >= 1000 / 60) {
                ppStep(S.world, 1 / 60); S.acc -= 1000 / 60;
                S.world.balls.forEach(b => {
                    if (b.state === 'pocketed' && !S.down.has(b.id)) {
                        S.down.add(b.id);
                        S.drops.push({ ball: Object.assign({}, b, { q: b.q.slice() }), pocket: b.pocket, t: 0 });
                    }
                });
                if (ppSettled(S.world)) { ppSimulate(S.world, 0.001); poolSettle(); break; }
            }
        } else if (S.phase === 'aim' && poolCanAct() && !S.drag) {
            // The clock waits for the hand-off and for ball in hand, as today.
            S.clockLeft -= dt / 1000;
            if (S.clockLeft <= 0) {
                const v = prTimeout(S.frame);
                poolShowToast(prText(v, poolNames()));
                poolAfterTurn(v);
            }
        }
        poolCpuTick(dt);
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

    function poolDraw(dt) {
        const S = poolS;
        if (!poolFit()) return;
        const pose = pcDirect(S.director, poolCamInput(), dt);
        const v = pcView(pose);
        poolRefreshGuide();
        const st = prStatus(S.frame, S.world);
        const aiming = (S.phase === 'aim' || S.phase === 'strike') && !S.handoff;
        const pull = 8 + S.power * 1.1;
        const gap = S.phase === 'strike' ? pull + (1 - pull) * Math.min(1, S.strikeT / POOL_STRIKE_MS) : pull;
        const c = poolCueBall();
        const bihBad = S.phase === 'bih' ? prCanPlace(S.world, c.x, c.y, S.frame.ballInHand) : null;
        const felt = userPreferences.poolTableColor || 'green';
        const theme = phThemeTokens(S.hud);
        // Nothing on the table moved and the camera is still: keep last frame's pixels.
        const key = JSON.stringify([pose, S.world.t, c.x, c.y, S.aim, S.power, gap, S.phase, S.called, S.handoff, felt, theme, S.drops.length, S.guideKey, S.guideMode, S.W, S.H]);
        if (key !== S.drawKey || S.drops.length) {
            S.drawKey = key;
            pgRender(S.ctx, {
                view: v, world: S.world, felt, dpr: S.dpr, cache: S.cache, theme,
                makeCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
                aim: aiming ? { angle: S.aim, power: S.power, gap } : null,
                guide: aiming ? S.guide : null, guideMode: S.guideMode,
                illegal: !!(S.guide && S.guide.hit > 0 && !poolLegalTarget(S.guide.hit)),
                bih: S.phase === 'bih' ? { x: c.x, y: c.y, valid: !bihBad } : null,
                kitchen: S.phase === 'bih' && S.frame.ballInHand === 'kitchen',
                call: aiming && st.callRequired ? { called: S.called } : null,
                drops: S.drops,
            });
        }
        const gs = S.phase === 'bih' ? pcProject(v, [c.x, c.y, S.cfg.ballR]) : null;
        const cpuTurn = poolCpuTurn();
        phRender(S.hud, phModel({
            layout: S.hud.layout, mode: poolMode, names: poolNames(), records: { 1: poolRecordText(1), 2: poolRecordText(2) },
            frames: S.frames, trophies: S.wins,
            frame: S.frame, world: S.world, phase: S.phase, camera: userPreferences.poolCamera === '2d' ? '2d' : '3d',
            lean: poolLean(), power: S.power, dragging: !!(S.drag && S.drag.kind === 'power'), tip: S.tip, spinOpen: S.spinOpen, called: S.called,
            clock: !cpuTurn ? { left: Math.max(0, S.clockLeft), total: POOL_CLOCK_S } : null,
            toast: S.toast, fouled: S.fouled, handoff: S.handoff,
            bih: S.phase === 'bih' ? { valid: !bihBad, reason: bihBad, placed: S.placed, sx: gs && gs[0], sy: gs && gs[1], sr: gs ? S.cfg.ballR * gs[2] : 0 } : null,
            result: S.result,
            canReplace: !!S.frame.ballInHand && S.placed && poolCanAct(),
            cpuTurn,
            sheet: { open: S.sheet.open, mode: S.sheet.mode, note: poolSheetNote() },
            difficulty: poolDifficulty(), adaptiveTier: paAdaptiveTier(poolCpuRec()),
        }));
    }

    // Under the difficulty list: when the pick cannot apply to the frame being played.
    function poolSheetNote() {
        if (poolMode !== 'cpu' || poolFrameFresh() || poolS.phase === 'over') return '';
        const next = paTierFor(poolDifficulty(), poolCpuRec());
        return next !== poolCpuTier ? PA_TIERS[next].label + ' from the next frame; this one stays ' + PA_TIERS[poolCpuTier].label : '';
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

    // Power, as in the old engine: only movement along the shot line counts,
    // pulled back or pushed forward; full power fits inside the canvas.
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
    // The ball follows the pointer but stops at the cushions and, on the
    // break, at the head string, so it can be dragged along them (as v1 did).
    function poolPlace(sx, sy) {
        const S = poolS;
        const p = pcView(pcOrtho(S.W, S.H, S.cfg)).unproject(sx, sy);
        const q = prClampPlace(S.world, p[0], p[1], S.frame.ballInHand);
        prPlaceCue(S.world, q[0], q[1]);
    }

    function poolOnEnter(e) { poolS.armed = true; poolS.lastX = poolLocal(e)[0]; }
    function poolOnDown(e) {
        const S = poolS;
        S.spinOpen = false;
        if (!poolCanAct() || !S.W) return;
        const [sx, sy] = poolLocal(e);
        try { S.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        S.armed = true; S.lastX = sx;
        if (S.phase === 'bih') { S.drag = { kind: 'place' }; S.placed = false; poolPlace(sx, sy); return; }
        if (S.phase !== 'aim') return;
        const st = prStatus(S.frame, S.world);
        if (st.callRequired) {
            const hit = pgPocketMarks(poolView(), S.world.table).find(m => m.inView && Math.hypot(m.x - sx, m.y - sy) < Math.max(22, m.r));
            if (hit) { S.called = hit.i; return; }
            if (S.called < 0) return;
        }
        const ax = poolShotAxis();
        const reach = poolClamp(Math.max(poolRoom(sx, sy, ax[0], ax[1]), poolRoom(sx, sy, -ax[0], -ax[1])) - 6, 40, S.W > 1000 ? 220 : 140);
        S.drag = { kind: 'power', x: sx, y: sy, ax, reach };
        S.power = 0;
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
        if (userPreferences.poolCamera !== '2d') S.aim -= dx * (e.shiftKey ? 0.05 : 0.3) * POOL_DEG;
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
            if (!prCanPlace(S.world, c.x, c.y, S.frame.ballInHand)) { S.placed = true; S.phase = 'aim'; poolAimAtNearest(); }
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
        // Esc closes the Game mode sheet first, and nothing else sees it.
        if (e.key === 'Escape' && S.sheet.open) { S.sheet.open = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (e.key === 'Escape' && S.drag && S.drag.kind === 'power') {
            // Cancel the stroke, and nothing else: not the Max modal, not a reset.
            S.drag = null; S.power = 0;
            e.preventDefault(); e.stopImmediatePropagation();
            return;
        }
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && S.phase === 'aim' && poolCanAct() && (S.armed || poolMaximized)) {
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            S.aim += (e.key === 'ArrowLeft' ? 1 : -1) * 0.1 * POOL_DEG;
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
        // The footer's mode button and the frame-over dialog's second button open the Game mode sheet.
        mode: () => { const S = poolS; S.sheet = { open: !S.sheet.open, mode: poolMode }; S.spinOpen = false; },
        sheetTab: m => { poolS.sheet.mode = m === 'pvp' ? 'pvp' : 'cpu'; },
        sheetClose: () => { poolS.sheet.open = false; },
        // A difficulty: remembered (the same setting as ⚙️), in force now if nothing has
        // been hit yet, else from the next frame. From 2 Players it switches to Vs CPU.
        difficulty: d => {
            const S = poolS;
            userPreferences.poolDifficulty = PA_TIERS[d] ? d : 'adaptive';
            savePreferences();
            if (poolMode !== 'cpu') { togglePoolMode(); S.sheet.open = false; return; }
            if (poolFrameFresh()) { poolLockTier(); S.sheet.open = false; }
        },
        startPvp: () => { if (poolMode !== 'pvp') togglePoolMode(); poolS.sheet.open = false; },
        reset: () => resetPoolGame(),
        max: () => togglePoolMaximize(),
        call: i => { if (poolCanAct()) poolS.called = i; },
        ready: () => { const S = poolS; S.handoff = 0; S.toast = null; S.fouled = 0; S.clockLeft = POOL_CLOCK_S; },
        // Pick the cue ball up again. The clock pauses in ball in hand and
        // carries on from where it was once the ball is down, so this never buys time back.
        replace: () => { const S = poolS; if (S.phase === 'aim' && S.frame.ballInHand && poolCanAct() && !S.drag) { S.phase = 'bih'; S.placed = false; S.power = 0; } },
        primary: () => poolNewFrame(3 - poolS.breaker),
        secondary: () => { poolS.sheet = { open: true, mode: poolMode }; },
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
        poolS.cpuRec = poolLoadCpuRecord();
        if (!S.cfg) S.cfg = ppCreateWorld().cfg;
        if (!S.hudC || !root.contains(S.hudC.el)) poolBuild(root);
        // A frame in progress survives switching to another game and back.
        if (!S.world) poolNewFrame(1);
        poolAttach();
        poolRefreshScoreBtn();
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

    // ── Theme ─────────────────────────────────────────────────────────
    // The Max view is body-level: give it the widget's theme classes and
    // tokens, as the host does for its PiP clone, so Cyberpunk resolves there.
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
    // The design's full view (1280 × 800), scaled down to fit the window.
    // Layout stays in design pixels; poolLocal() maps the pointer through the scale.
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
        S.maxFrame.className = 'pool-max-frame';
        panel.appendChild(S.maxFrame);
        S.hudM = phBuild(S.maxFrame, { layout: 'max', on: poolOn, canvas: S.canvas, title: '8-Ball Pool' });
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
            title: '8-Ball Pool',
            panelClass: 'pool-max-panel',
            build: poolBuildMax,
            unbuild: poolUnbuildMax,
            onToggle: togglePoolMaximize,
        });
    }
