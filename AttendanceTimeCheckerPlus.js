(function() {
    'use strict';
    
    // ENHANCED ATTENDANCE TIME CHECKER 2026
    // ─── Build Identity ───────────────────────────────────────────
    // BUILD_SEED is a per-release nonce. The actual sync-acceptance token is
    // derived at runtime by combining the seed with the dispatcher PAT and a
    // salt; the GitHub Actions workflow holds the matching token as a repo
    // secret. Editing the seed locally will produce a bad token and the server
    // will silently reject the dispatch.
    //
    // To cut a new release:
    //   1. Replace BUILD_SEED below with a fresh random hex string.
    //   2. Bump BUILD_LABEL (cosmetic only — shown in the update banner).
    //   3. Compute the new token (see comment in sync.yml) and rotate the
    //      BUILD_TOKEN_CURRENT / BUILD_TOKEN_PREVIOUS repo secrets.
    const BUILD_SEED  = 'd7c94e21b8a05f36e1c8d94a70b25f3c';
    const BUILD_LABEL = 'v2';
    // ──────────────────────────────────────────────────────────────

    // Ordinal parse of a 'v<N>' label. Returns null for anything that doesn't fit
    // the convention, which callers below treat conservatively (assume behind).
    function _buildOrdinal(label) {
        const m = /^v(\d+)$/i.exec(String(label || '').trim());
        return m ? parseInt(m[1], 10) : null;
    }

    // True only when `local` is POSITIVELY a lower build number than `remote`.
    // The two call sites below used to treat ANY label mismatch as "this client is
    // outdated" — but a mismatch also happens right after every version bump,
    // before this client's own sync has had a chance to advance the gist's stamp.
    // Since a build-labelled sync is what writes registry.latestBuild in the first
    // place, blocking on mere inequality created a deadlock: a brand-new client
    // refuses to sync because the gist still shows the previous label, and the
    // gist can never advance to the new label because the client that would write
    // it keeps refusing to sync. Only a client confirmed OLDER should be blocked.
    function _clientIsBehindBuild(local, remote) {
        const l = _buildOrdinal(local), r = _buildOrdinal(remote);
        if (l === null || r === null) return true; // unrecognised format — fail safe
        return l < r;
    }

    const currentUrl = window.location.href;
    const targetUrl = "https://globalportal.mtbc.com/#/time-absence/attendence-record";

    if (currentUrl !== targetUrl) {
        return; 
    }

    // Emoji progression for GenZ vibes 😎
    const emojiSets = {
        fun: ['😭', '😖', '😟', '😓', '😌', '🙂', '☺️', '😄'],
        professional: ['🔴', '🟠', '🟡', '🟡', '🟢', '🟢', '🔵', '🔵']
    };
    
    const runningEmoji = '🏃💨'; // shift end to shift + 30 min
    const clownEmoji = '🫵🤡'; // After shift + 30 min (go home!)
    
    // Global variables for performance optimization
    let lastTotalWorkedTime = -1; // Track if we need to re-render
    let isFirstRender = true; // Track first render
    let animationFrameId = null; // For requestAnimationFrame
    let pipWindow = null; // Picture-in-Picture window reference
    let isPipActive = false; // Track PiP status
    
    // Feature initialization flags to prevent re-initialization
    let featuresInitialized = false;
    
    // XP system ready flag — prevents awardXP from running before loadUserXP() has been called,
    // which would overwrite saved data with default values and reset progress to Level 1.
    let xpSystemReady = false;
    
    // SNAKE GAME VARIABLES
    let snakeCanvas, snakeCtx;
    let snake = [{x: 10, y: 10}];
    let food = {x: 15, y: 15};
    let direction = {x: 0, y: 0};
    let nextDirection = {x: 0, y: 0};
    let snakeScore = 0;
    let snakeHighScore = 0;
    let snakeAnimFrame = null;     // rAF handle for smooth render
    let snakeLastTickMs = 0;        // timestamp of last render frame
    let snakeAccumulatorMs = 0;
    let snakePrevSnap = [];         // segment grid positions before last tick
    let snakeTickInterval = 300;    // ms — matches setInterval, updated on score
    let snakeGameRunning = false;
    let snakeGamePaused = false;
    const snakeGridSize = 20;
    const snakeCellSize = 2; // 2px per cell for smooth growth
    
    // MULTI-GAME SYSTEM VARIABLES
    let currentGame = 'snake'; // 'snake' | 'reflex' | 'aim'
    let gameAreaElement = null;
    
    // REFLEX GAME VARIABLES
    let reflexGameStarted = false;
    let reflexGameFinished = false;
    let reflexIsWaiting = false;
    let reflexCanClick = false;
    let reflexStartTime = 0;
    let reflexReactionTimes = [];
    let reflexCurrentRound = 0;
    let reflexFalseStarts = 0;
    let reflexMode = 'screen'; // 'screen' | 'target'
    let reflexLastClickMs = 0;     // anti-rapid-click debounce
    let reflexGoReadyMs = 0;       // timestamp when GO state became live; used to floor reaction time

    // Anti-cheat tunables for RefleX
    const REFLEX_CLICK_DEBOUNCE_MS = 80; // ignore back-to-back clicks within this window (spam clicker)
    const REFLEX_FALSE_START_LIMIT = 3;  // hard fail the game after this many false starts
    
    // RefleX target state
    let reflexShowTarget = false;
    let reflexTargetPosition = { x: 0, y: 0 };
    let reflexTargetColor = '#ef4444';
    
    // RefleX timeout reference
    let reflexTimeoutRef = null;
    
    // RefleX game modes configuration
    const reflexGameModes = {
        screen: {
            name: 'Screen Mode',
            icon: '⚡',
            description: 'Full screen reaction',
            rounds: 5,
            minDelay: 1000,
            maxDelay: 4000,
            targets: false
        } ,
        target: {
            name: 'Target Mode',
            icon: '🎯',
            description: 'Click specific targets',
            rounds: 8,
            minDelay: 800,
            maxDelay: 3000,
            targets: true
        }
    };
    
    // AIM TRAINER GAME VARIABLES
    let aimGameStarted = false;
    let aimGameFinished = false;
    let aimTimer = 30;
    let aimScore = 0;
    let aimAccuracy = 100;
    let aimTargets = [];
    let aimShots = 0;
    let aimHits = 0;
    let aimBulletHoles = [];
    
    // AimTrainer timer reference
    let aimTimerRef = null;
    let aimRenderFrameId = null;
    
    // AimTrainer chaos mode configuration
    const aimChaosMode = {
        name: 'Chaos Mode',
        icon: '💥',
        description: 'Multiple fast targets',
        targetSize: 35,
        targetCount: 3,
        targetSpeed: 800,
        timeLimit: 30
    };
    
    // FLAPPY BIRD GAME VARIABLES
    let flappyCanvas, flappyCtx;
    let flappyGameRunning = false;
    let flappyGameOver = false;
    let flappyScore = 0;
    let flappyHighScore = 0;
    let flappyAnimFrame = null;
    let flappyBird = { x: 60, y: 150, vy: 0, width: 28, height: 24 };
    let flappyPipes = [];
    let flappyGround = 0;
    let flappyFrame = 0;
    const FLAPPY_GRAVITY = 0.20;
    const FLAPPY_JUMP = -4.6;
    const FLAPPY_PIPE_GAP_BASE = 140; // starting gap, narrows with score
    const FLAPPY_PIPE_WIDTH = 52;
    const FLAPPY_PIPE_SPEED_BASE = 2.0; // increases with score
    const FLAPPY_PIPE_INTERVAL = 90; // frames
    let flappyStarted = false; // waiting for first tap

    // TETRIS GAME VARIABLES
    let tetrisCanvas, tetrisCtx;
    let tetrisBoard = [];
    let tetrisCurrentPiece = null;
    let tetrisNextPiece = null;
    let tetrisBag = []; // 7-bag randomizer queue (Fisher-Yates shuffled indices)
    let tetrisScore = 0;
    let tetrisHighScore = 0;
    let tetrisLines = 0;
    let tetrisLevel = 1;
    let tetrisGameRunning = false;
    let tetrisGameOver = false;
    let tetrisDropInterval = null;
    let tetrisLastDrop = 0;
    let tetrisAnimFrame = null;
    const TETRIS_COLS = 10;
    const TETRIS_ROWS = 20;
    const TETRIS_CELL = 18;
    const TETRIS_PIECES = [
        { shape: [[1,1,1,1]], color: '#00f0ff' },           // I
        { shape: [[1,1],[1,1]], color: '#f0f000' },          // O
        { shape: [[0,1,0],[1,1,1]], color: '#a000f0' },      // T
        { shape: [[0,1,1],[1,1,0]], color: '#00f000' },      // S
        { shape: [[1,1,0],[0,1,1]], color: '#f00000' },      // Z
        { shape: [[1,0,0],[1,1,1]], color: '#f0a000' },      // J
        { shape: [[0,0,1],[1,1,1]], color: '#0000f0' },      // L
    ];

    // QUOTES SYSTEM VARIABLES
    let quotesArray = [];
    let currentQuoteIndex = 0;
    let quoteInterval = null;
    let quotesInitialized = false; // Track if quotes system is already set up
    
    // XP SYSTEM VARIABLES
    let userXP = { 
        level: 1, 
        currentXP: 0, 
        totalXP: 0, 
        lastHourTracked: -1, 
        todayHours: 0,
        consecutiveDays: 0,
        totalWorkDays: 0,
        gameSessions: 0,
        lastAttendanceDate: null,
        lastStreakBonusDate: null,
        longestStreak: 0,
        achievements: [],
        milestonesReached: []
    };

    // XP System Constants (Research-proven values)
    const XP_PER_HOUR = 15;           // Base hourly reward (increased from 10)
    const STREAK_BONUS = 20;          // Daily streak bonus (per streak day, capped below)
    // Streak economics. The bonus is STREAK_BONUS * min(streak, STREAK_BONUS_MAX_DAYS),
    // paid once per work day. Uncapped it grew linearly forever: at a 23-day streak a
    // single day paid 460 XP, more than three full 8h shifts of hourly XP, which made
    // streak length the dominant term on the leaderboard and dwarfed every other
    // activity. Capping at 7 keeps the habit incentive without letting it snowball.
    const STREAK_BONUS_MAX_DAYS = 7;
    // A day only counts toward the streak once this many hours are logged. Previously
    // any new calendar day with the portal open counted, including zero-hour days.
    const STREAK_MIN_HOURS = 1;
    // Iteration ceiling for the level-curve loops — a runaway backstop, not a limit
    // anyone can reach in practice (level 10000 needs ~1.2e11 XP).
    const LEVEL_LOOP_GUARD = 10000;
    const MILESTONE_BONUSES = {
        2: { xp: 10, label: '2-Hour Checkpoint' },
        4: { xp: 25, label: '4-Hour Halfway' },
        6: { xp: 40, label: '6-Hour Almost There' },
        8: { xp: 50, label: '8-Hour Full Day' }
    };
    
    // Achievement Definitions (work-life-balance friendly — weekends are sacred 🙅)
    // Each achievement requires actual user action — no freebies.
    const ACHIEVEMENTS = {
        // ── Shift completion ──────────────────────────────
        firstDay:     { icon: '🎯', name: 'Day One',          desc: 'Complete a full shift for the first time' },
        week1:        { icon: '📅', name: 'Full Week',         desc: 'Complete 5 full shifts' },
        workdays20:   { icon: '🗓️', name: 'Month Done',        desc: 'Complete 20 full shifts' },
        centurion:    { icon: '🌟', name: 'Centurion',         desc: 'Complete 100 full shifts' },
        onTime:       { icon: '🕐', name: 'Badge of Balance',  desc: 'Clock exactly your shift (within 5 min, no overtime)' },
        marathon:     { icon: '🏃', name: 'Marathon',          desc: 'Work 10+ hours in a single day' },
        overtimeHero: { icon: '💪', name: 'Overtime Hero',     desc: 'Work shift + 2 hours in a single day' },

        // ── Streaks ───────────────────────────────────────
        streak7:      { icon: '🔥', name: 'On Fire',           desc: 'Maintain a 7-day work streak' },
        streak30:     { icon: '🏔️', name: 'Unstoppable',       desc: 'Maintain a 30-day work streak' },
        comeback:     { icon: '🔄', name: 'Comeback Kid',      desc: 'Rebuild a 3-day streak after missing days' },

        // ── Leveling ──────────────────────────────────────
        level10:      { icon: '⭐', name: 'Level 10',          desc: 'Reach level 10' },
        level25:      { icon: '💎', name: 'Level 25',          desc: 'Reach level 25' },
        level50:      { icon: '👑', name: 'Veteran',           desc: 'Reach level 50' },
        level100:     { icon: '🏆', name: 'Legend',            desc: 'Reach level 100' },

        // ── Gaming ────────────────────────────────────────
        gamer:        { icon: '🎮', name: 'Office Gamer',      desc: 'Earn XP in 50 game sessions' },
        gamer50:      { icon: '🕹️', name: 'Game Addict',       desc: 'Earn XP in 100 game sessions' },
        snakeCharmer: { icon: '🐍', name: 'Snake Charmer',     desc: 'Score 40+ in Snake' },
        flapMaster:   { icon: '🐦', name: 'Sky Captain',       desc: 'Clear 50+ pipes in Flappy' },
        tetrisMaster: { icon: '🧱', name: 'Block Master',      desc: 'Clear 50+ lines in one Tetris run' },
        sharpshooter: { icon: '🎯', name: 'Sharpshooter',      desc: 'Hit 95%+ accuracy with 600+ score in Aim' },
        lightning:    { icon: '⚡', name: 'Lightning Reflexes', desc: 'Average under 220ms in RefleX' },
        brickBuster:  { icon: '🧨', name: 'Brick Buster',      desc: 'Reach level 30 in Breakout' },
        poolShark:    { icon: '🎱', name: 'Pool Shark',        desc: 'Win 100 pool games against the CPU' },
        ludoChamp:    { icon: '🎲', name: 'Ludo Champion',     desc: 'Win 100 Ludo games against the CPU' },
        ludoFlawless: { icon: '🛡️', name: 'Flawless',          desc: 'Win a Ludo game without losing a single token' },
        ludoHunter:   { icon: '🔥', name: 'Token Hunter',      desc: 'Capture 5 opponent tokens in one Ludo match' },

        // ── Engagement / Customization ────────────────────
        curator:      { icon: '💬', name: 'Curator',           desc: 'Add a custom motivational quote' },
        picturePerfect:{ icon: '🖼️', name: 'Picture Perfect',  desc: 'Set a custom widget image' },
        meditative:   { icon: '🤲', name: 'Devoted',           desc: 'Reach 1000 on the prayer counter' },
        teamPlayer:   { icon: '🤝', name: 'Team Player',       desc: 'Join the leaderboard' }
    };
    
    // IMAGE BOX VARIABLES
    let currentImageURL = '';
    let currentAspectRatio = '16:9'; // Default: Widescreen ratio
    
    // Aspect ratio configurations
    const aspectRatios = {
        '1:1': { name: 'Square', icon: '◻', paddingBottom: '100%', use: 'Profile pics, badges' },
        '16:9': { name: 'Widescreen', icon: '▬', paddingBottom: '56.25%', use: 'Videos, monitors' },
        '4:3': { name: 'Classic', icon: '▭', paddingBottom: '75%', use: 'Old monitors, photos' },
        '9:16': { name: 'Portrait', icon: '▯', paddingBottom: '177.78%', use: 'Phone screens, stories' }
    };
    
    // User preferences for hyper-personalization
    let userPreferences = {
        theme: 'vibrant', // 'vibrant' or 'subdued'
        neumorphicDepth: true,
        fluidGradients: true,
        emojiSet: 'fun', // 'fun', 'professional'
        displayTheme: 'glassmorphic', // 'glassmorphic' or 'retro-futuristic'
        gameModeHidden: true, // true = Game Mode ON (panels visible); false = Game Mode OFF (panels hidden, widget shrinks)
        shiftDuration: '8h', // '4h' = short leave, '8h' = standard, '9h' = overtime
        poolTableColor: 'green', // 'green', 'red', 'blue', 'lightgrey'
        gameFps: 60, // 30 or 60 — half or full vsync
        // Ludo rule toggles. Stored flat, not nested, because the generic
        // .toggle-switch handler writes userPreferences[data-pref] directly.
        // ludoRules() reads these live, so changes apply mid-match.
        ludoBlocks: true,       // 2+ own tokens bar opponents (never on a safe square)
        // Whether a block also seals the track. On (the Ludo Star rule) a pair
        // directly in front of a token leaves it with no legal roll at all;
        // off, you may hop over a block but still may not land on it.
        ludoBlockPassing: true,
        ludoThreeSixes: true,   // three 6s forfeit the whole banked sequence
        ludoExactHome: true,    // exact roll needed to finish
        ludoFreeRelease: false, // leave base on any roll, not just a 6
        // 0-3 counter-clockwise quarter-turns of the board, so a player can put
        // their own colour nearest them. Purely presentational — see the board
        // rotation notes in the LUDO block.
        ludoRotation: 0,
        // Cyberpunk HUD customizable colors (only applied when displayTheme === 'retro-futuristic')
        cyberBgPrimary: '#07091a',
        cyberBgSecondary: '#11142b',
        cyberAccent: '#fff200',
        cyberHighlight: '#00e5ff',
        cyberPanelTint: '#00e5ff',  // tint for inner glass panels (table, side containers)
        cyberBgImage: '',       // URL for custom background image
        cyberBgOpacity: 0.15    // 0–1 opacity for background image overlay
    };

    // Convert "#rrggbb" → "r, g, b" (for use inside rgba(var(--x-rgb), a))
    function hexToRgbStr(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        if (!m) return '0, 0, 0';
        return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
    }

    // Returns the selected shift duration in seconds
    function getShiftSeconds() {
        const map = { '4h': 14400, '8h': 28800, '9h': 32400 };
        return map[userPreferences.shiftDuration] || 28800;
    }

    // Fixed game-logic timestep: 60 updates/sec regardless of monitor refresh rate
    const FIXED_DT = 1000 / 60; // 16.667ms

    // Frame interval in ms for the selected render FPS cap
    function getFrameInterval() {
        return Number(userPreferences.gameFps) === 30 ? 33.33 : 16.67;
    }

    // Per-game render timestamps (FPS cap) and logic accumulators (fixed timestep)
    let breakoutLastFrameMs = 0;
    let breakoutLastLogicMs = 0;
    let breakoutAccumulator = 0;
    let flappyLastFrameMs = 0;
    let flappyLastLogicMs = 0;
    let flappyAccumulator = 0;
    let poolLastFrameMs = 0;
    let poolLastLogicMs = 0;
    let poolAccumulator = 0;
    let tetrisLastFrameMs = 0;
    let snakeLastRenderMs = 0;
    
    // Load saved preferences
    function loadPreferences() {
        const saved = localStorage.getItem('attendancePrefs');
        if (saved) {
            userPreferences = { ...userPreferences, ...JSON.parse(saved) };
        }
    }
    
    // Save preferences
    function savePreferences() {
        localStorage.setItem('attendancePrefs', JSON.stringify(userPreferences));
    }
    
    // ====================================
    // LOCALSTORAGE MANAGEMENT
    // ====================================
    
    // Snake Game Storage
    function loadSnakeHighScore() {
        const saved = localStorage.getItem('snakeHighScore');
        return saved ? parseInt(saved) : 0;
    }
    
    function saveSnakeHighScore(score) {
        localStorage.setItem('snakeHighScore', score.toString());
    }
    
    // Quotes Storage  
    function loadQuotes() {
        const saved = localStorage.getItem('customQuotes');
        const defaultQuotes = [
            { text: "Do not pray for easy lives. Pray to be stronger men.", author: "John F. Kennedy" }
        ];
        return saved ? JSON.parse(saved) : defaultQuotes;
    }
    
    function saveQuotes(quotes) {
        localStorage.setItem('customQuotes', JSON.stringify(quotes));
    }
    
    // XP System Storage
    function loadUserXP() {
        const saved = localStorage.getItem('userXP');
        if (saved) {
            const data = JSON.parse(saved);
            // Migrate old data structure
            return {
                level: data.level || 1,
                currentXP: data.currentXP || 0,
                totalXP: data.totalXP || 0,
                lastHourTracked: data.lastHourTracked || -1,
                todayHours: data.todayHours || 0,
                consecutiveDays: data.consecutiveDays || 0,
                totalWorkDays: data.totalWorkDays || 0,
                gameSessions: data.gameSessions || 0,
                lastAttendanceDate: data.lastAttendanceDate || null,
                lastShiftCompletedDate: data.lastShiftCompletedDate || null,
                // Absent on records written before the streak-bonus fix. Leaving it
                // null just means today's bonus is still claimable, which is correct.
                lastStreakBonusDate: data.lastStreakBonusDate || null,
                hadStreakReset: !!data.hadStreakReset,
                longestStreak: data.longestStreak || 0,
                achievements: data.achievements || [],
                milestonesReached: data.milestonesReached || []
            };
        }
        return {
            level: 1,
            currentXP: 0,
            totalXP: 0,
            lastHourTracked: -1,
            todayHours: 0,
            consecutiveDays: 0,
            totalWorkDays: 0,
            gameSessions: 0,
            lastAttendanceDate: null,
            lastShiftCompletedDate: null,
            lastStreakBonusDate: null,
            hadStreakReset: false,
            longestStreak: 0,
            achievements: [],
            milestonesReached: []
        };
    }
    
    function saveUserXP(xpData) {
        localStorage.setItem('userXP', JSON.stringify(xpData));
        // Update integrity hash so the next sync can verify this was a legitimate save
        try { _saveXPIntegrity(); } catch(_) {}
    }
    
    // Image URL Storage
    function loadImageURL() {
        return localStorage.getItem('customImageURL') || '';
    }
    
    function saveImageURL(url) {
        localStorage.setItem('customImageURL', url);
    }
    
    // Aspect Ratio Storage
    function loadAspectRatio() {
        return localStorage.getItem('customImageAspectRatio') || '16:9';
    }
    
    function saveAspectRatio(ratio) {
        localStorage.setItem('customImageAspectRatio', ratio);
    }
    
    // RefleX Game Storage
    // One-time migration: wipe RefleX high scores invalidated by the anti-cheat
    // hardening patch (v2026-05-25, re-run 05-26 to clear gist→localStorage re-infection).
    // While this flag is set, applyPlayerRecordToLocal() will refuse to restore reflex
    // scores from the gist, breaking the contamination loop.
    const REFLEX_RESET_FLAG = 'reflexScoresReset_20260526';
    (function _reflexScoreReset() {
        if (!localStorage.getItem(REFLEX_RESET_FLAG)) {
            localStorage.removeItem('reflexHighScores');
            // Also strip 'lightning' achievement earned via the exploit
            try {
                const xp = JSON.parse(localStorage.getItem('userXP') || '{}');
                if (Array.isArray(xp.achievements)) {
                    const idx = xp.achievements.indexOf('lightning');
                    if (idx !== -1) {
                        xp.achievements.splice(idx, 1);
                        localStorage.setItem('userXP', JSON.stringify(xp));
                    }
                }
            } catch(_) {}
            localStorage.setItem(REFLEX_RESET_FLAG, '1');
        }
    })();

    function loadReflexHighScores() {
        const saved = localStorage.getItem('reflexHighScores');
        return saved ? JSON.parse(saved) : {
            screen: { best: Infinity, avg: Infinity },
            target: { best: Infinity, avg: Infinity }
        };
    }
    
    function saveReflexHighScores(scores) {
        localStorage.setItem('reflexHighScores', JSON.stringify(scores));
    }
    
    // AimTrainer Game Storage
    function loadAimHighScore() {
        const saved = localStorage.getItem('aimChaosHighScore');
        return saved ? parseInt(saved) : 0;
    }
    
    function saveAimHighScore(score) {
        localStorage.setItem('aimChaosHighScore', score.toString());
    }
    
    // Flappy Bird Storage
    function loadFlappyHighScore() {
        const saved = localStorage.getItem('flappyHighScore');
        return saved ? parseInt(saved) : 0;
    }
    function saveFlappyHighScore(score) {
        localStorage.setItem('flappyHighScore', score.toString());
    }

    // Tetris Storage
    function loadTetrisHighScore() {
        const saved = localStorage.getItem('tetrisHighScore');
        return saved ? parseInt(saved) : 0;
    }
    function saveTetrisHighScore(score) {
        localStorage.setItem('tetrisHighScore', score.toString());
    }
    // Breakout Storage
    function loadBreakoutHighScore() {
        const saved = localStorage.getItem('breakoutHighScore');
        return saved ? parseInt(saved) : 0;
    }
    function saveBreakoutHighScore(score) {
        localStorage.setItem('breakoutHighScore', score.toString());
    }

    // Pool Game Storage
    function loadPoolHighScore() {
        const saved = localStorage.getItem('poolGamesWon');
        return saved ? parseInt(saved) : 0;
    }
    function savePoolHighScore(score) {
        localStorage.setItem('poolGamesWon', score.toString());
    }
    function loadPoolRecord() {
        const saved = localStorage.getItem('poolRecord');
        return saved ? JSON.parse(saved) : { p1Wins: 0, p1Losses: 0, p2Wins: 0, p2Losses: 0 };
    }
    function savePoolRecord(rec) {
        localStorage.setItem('poolRecord', JSON.stringify(rec));
    }
    // Ludo's equivalents (ludoGamesWon / ludoRecord) live inside the LUDO GAME
    // block below as ludoLoadWins/ludoSaveWins/ludoLoadRecord/ludoSaveRecord.
    // They stay there so the code running here is byte-identical to the copy in
    // ludo-dev/ that the headless XP tests exercise.
    // Prayer Counter Storage
    function loadPrayerCount() { return parseInt(localStorage.getItem('prayerCount') || '0', 10); }
    function savePrayerCount(n) { localStorage.setItem('prayerCount', String(n)); }

    // ═══════════════════════════════════════════════════════════════
    // LEADERBOARD SYSTEM (GitHub Actions Bot Proxy)
    // ═══════════════════════════════════════════════════════════════
    // Reads go directly to api.github.com/gists/<id> (allowed by corp firewall).
    // Writes are dispatched to a GitHub Actions workflow via repository_dispatch
    // (also api.github.com — allowed). The Action runs server-side anti-cheat
    // (blocklist, sticky flag, XP rate limits) before patching the gist.
    //
    // The "dispatcher" PAT below has Contents: write on ONE empty bot repo only.
    // Even if extracted from this script, it cannot write to the gist directly —
    // only trigger the validated workflow. The real gist-write PAT lives as a
    // repo secret accessible only to the workflow at runtime.
    //
    // See ./github-actions-bot/.github/workflows/sync.yml for the proxy source.
    const REGISTRY_GIST_ID = 'b97357da4f32cfea822c9db36cd48088';
    const REGISTRY_GIST_FILE = 'attendance_widget_registry.json';
    const GH_BOT_REPO = 'Hassan-Nasir07/github-actions-bot';
    const GH_DISPATCHER_PAT = String.fromCharCode(103,105,116,104,117,98,95,112,97,116,95,49,49,65,55,74,53,73,72,65,48,109,52,73,68,109,106,82,113,104,72,75,122,95,88,119,51,112,83,106,120,71,110,49,106,48,70,115,122,56,49,118,104,82,81,83,111,103,75,104,68,118,55,68,113,100,76,52,69,68,98,76,109,120,116,68,103,69,89,90,88,73,79,68,84,89,114,120,74,49,71,54,119);
    const SYNC_PROPAGATION_MS = 25000; // Action takes ~15-30s; we surface this in the UI.

    // ─── Anti-Cheat: XP Integrity System ──────────────────────────
    // Keyed hash prevents raw localStorage edits from being accepted by sync.
    // The signing key is derived at runtime so it's not a plain string in source.
    const _ACS = [97,116,99,95,105,110,116,101,103,114,105,116,121,95,50,48,50,54].map(c => String.fromCharCode(c)).join('');
    const _ACK = GH_DISPATCHER_PAT + 'atc_xp_2026'; // signing key derived from dispatcher PAT

    // Simple keyed hash (FNV-1a variant with key mixing) — not cryptographic but
    // prevents casual localStorage tampering. An attacker must read + understand the
    // source to forge a valid hash.
    function _xpHash(totalXP, level, gameSessions, totalWorkDays) {
        const msg = `${_ACK}:${totalXP}:${level}:${gameSessions}:${totalWorkDays}:${_ACS}`;
        let h = 0x811c9dc5;
        for (let i = 0; i < msg.length; i++) {
            h ^= msg.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(36);
    }

    // Compute and store the integrity hash for current userXP state
    function _saveXPIntegrity() {
        const hash = _xpHash(userXP.totalXP || 0, userXP.level || 1, userXP.gameSessions || 0, userXP.totalWorkDays || 0);
        localStorage.setItem('_xpSig', hash);
    }

    // Verify that localStorage XP values haven't been tampered with
    function _verifyXPIntegrity() {
        const stored = localStorage.getItem('_xpSig');
        if (!stored) return true; // First run — no hash yet, allow
        const expected = _xpHash(userXP.totalXP || 0, userXP.level || 1, userXP.gameSessions || 0, userXP.totalWorkDays || 0);
        return stored === expected;
    }

    // ─── Build Token Derivation ───────────────────────────────────
    // Derives the per-build sync-acceptance token from BUILD_SEED + dispatcher
    // PAT + a fixed salt. The matching token is stored as a repo secret
    // (BUILD_TOKEN_CURRENT) in the bot repo; the workflow rejects any dispatch
    // whose token doesn't match. The salt and derivation steps below MUST be
    // mirrored by the helper used to produce the secret (see sync.yml).
    const _BLD_SALT = [98,108,100,95,116,107,110,95,50,48,50,54,95,118,49].map(c => String.fromCharCode(c)).join('');
    function _buildToken() {
        const msg = `${BUILD_SEED}|${GH_DISPATCHER_PAT}|${_BLD_SALT}`;
        // Double FNV-1a with bit-rotation between rounds — small variation on the
        // same primitive used for XP integrity, just enough that an attacker can't
        // reuse the XP hash to forge a build token.
        let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
        for (let i = 0; i < msg.length; i++) {
            const c = msg.charCodeAt(i);
            h1 ^= c;                h1 = Math.imul(h1, 0x01000193);
            h2 ^= (c ^ (h1 & 0xff)); h2 = Math.imul(h2, 0x100000001b3 & 0xffffffff);
        }
        h1 = ((h1 >>> 13) | (h1 << 19)) >>> 0;
        h2 = ((h2 >>> 17) | (h2 << 15)) >>> 0;
        return h1.toString(36) + '-' + h2.toString(36);
    }
    const BUILD_TOKEN = _buildToken();
    // ──────────────────────────────────────────────────────────────

    // Anti-cheat constants (client-side gates only — server is the source of truth)
    // The client NEVER writes flags to the gist; it only refuses to sync. This
    // prevents false positives from permanently locking out legit users, since
    // the workflow has a sticky-flag rule the client can't clear.
    const AC_SYNC_COOLDOWN_MS = 120000; // 2 minutes minimum between syncs
    // XP budget mirror of the server's model (see sync.yml). Every XP source is tied
    // to a counter that ships in the snapshot, so a legitimate gain is always bounded
    // by elapsed days + games played + achievements unlocked. Set ~20% looser than the
    // server so the server, not the client, is the thing that actually flags — a
    // client-side false positive only pauses syncing, which is recoverable.
    const AC_MAX_XP_PER_DAY = 720;
    const AC_MAX_XP_PER_GAME = 300;
    const AC_MAX_XP_PER_ACHIEVEMENT = 600;
    const AC_XP_BURST_ALLOWANCE = 500;

    // Client-side blocklist — defense in depth. Even if the Action somehow
    // fails to strip a banned player, the local UI will never show them.
    const AC_BLOCKLIST = new Set([
        'a74c2f27-8824-42e3-8c59-4427ea5c8ad1' // abbassii
    ]);
    function isBlocked(clientId) { return AC_BLOCKLIST.has(clientId); }
    // ──────────────────────────────────────────────────────────────

    let lbClientId = null;
    let lbDisplayName = '';
    let lbRegistered = false;
    let leaderboardData = [];
    let lbFetching = false;
    let lbLastLocalSyncMs = 0; // Local cooldown — prevents rapid-fire syncs regardless of gist propagation delay

    // Leaderboard localStorage helpers
    function loadLeaderboardProfile() {
        const saved = localStorage.getItem('atc_lb_profile');
        if (saved) {
            const profile = JSON.parse(saved);
            lbClientId = profile.clientId;
            lbDisplayName = profile.displayName || '';
            lbRegistered = profile.registered || false;
        } else {
            lbClientId = crypto.randomUUID ? crypto.randomUUID() : ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            }));
            saveLeaderboardProfile();
        }
    }

    function saveLeaderboardProfile() {
        localStorage.setItem('atc_lb_profile', JSON.stringify({
            clientId: lbClientId,
            displayName: lbDisplayName,
            registered: lbRegistered
        }));
    }

    // Core API functions — reads hit the gist directly; writes go via Action dispatch.
    async function fetchRegistry() {
        try {
            const res = await fetch(`https://api.github.com/gists/${REGISTRY_GIST_ID}`, {
                cache: 'no-store',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${GH_DISPATCHER_PAT}` // auth only to dodge 60/hr unauth rate limit
                }
            });
            if (!res.ok) throw new Error(`gist fetch ${res.status}`);
            const gist = await res.json();
            const raw = gist?.files?.[REGISTRY_GIST_FILE]?.content || '';
            const start = raw.indexOf('{');
            if (start < 0) return { lastUpdated: null, players: [] };
            try { return JSON.parse(raw.slice(start)); }
            catch { return { lastUpdated: null, players: [] }; }
        } catch (e) {
            console.warn('[Leaderboard] fetchRegistry error:', e);
            return null;
        }
    }

    // Auto-purge blocklisted players from the gist on every fetch.
    // The Action already strips blocked players on write, so this is a no-op
    // kept for backwards compatibility with any code still calling it.
    async function purgeBlockedPlayers() {
        return; // Action handles blocklist enforcement server-side.
    }

    // Fire-and-forget: dispatch returns 204 immediately, then the workflow
    // takes ~15-30s to run validation and patch the gist. Resolves on accept.
    // Push a single player record. The dispatch used to carry the ENTIRE registry,
    // which meant any player could rewrite or delete every other player's entry —
    // the workflow merged whatever array it was handed. Sending only our own record
    // makes that impossible from the client side; the server merges it into the
    // stored registry itself.
    async function patchPlayer(player) {
        const res = await fetch(`https://api.github.com/repos/${GH_BOT_REPO}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${GH_DISPATCHER_PAT}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: 'registry-update',
                client_payload: { player, build_token: BUILD_TOKEN, build_label: BUILD_LABEL }
            })
        });
        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            throw new Error(`dispatch failed: ${res.status} ${errBody}`);
        }
        return player;
    }

    // Collect local game-best high scores from localStorage into one object
    function collectGameBests() {
        const reflexData = JSON.parse(localStorage.getItem('reflexHighScores') || '{}');
        const reflexBest = reflexData?.screen?.best;
        return {
            snake:    parseInt(localStorage.getItem('snakeHighScore') || '0', 10),
            flappy:   parseInt(localStorage.getItem('flappyHighScore') || '0', 10),
            tetris:   parseInt(localStorage.getItem('tetrisHighScore') || '0', 10),
            breakout: parseInt(localStorage.getItem('breakoutHighScore') || '0', 10),
            pool:     parseInt(localStorage.getItem('poolGamesWon') || '0', 10),
            ludo:     parseInt(localStorage.getItem('ludoGamesWon') || '0', 10),
            aim:      parseInt(localStorage.getItem('aimChaosHighScore') || '0', 10),
            reflex:   (reflexBest && reflexBest !== Infinity && reflexBest > 0) ? reflexBest : 0
        };
    }

    // Build a complete restorable snapshot. A wiped client can fully rehydrate from this single record.
    function buildPlayerSnapshot() {
        return {
            clientId: lbClientId,
            displayName: lbDisplayName,
            level: userXP.level || 1,
            currentXP: userXP.currentXP || 0,
            totalXP: userXP.totalXP || 0,
            totalWorkDays: userXP.totalWorkDays || 0,
            consecutiveDays: userXP.consecutiveDays || 0,
            longestStreak: userXP.longestStreak || 0,
            todayHours: userXP.todayHours || 0,
            lastHourTracked: (typeof userXP.lastHourTracked === 'number') ? userXP.lastHourTracked : -1,
            lastAttendanceDate: userXP.lastAttendanceDate || null,
            lastShiftCompletedDate: userXP.lastShiftCompletedDate || null,
            lastStreakBonusDate: userXP.lastStreakBonusDate || null,
            hadStreakReset: !!userXP.hadStreakReset,
            gameSessions: userXP.gameSessions || 0,
            achievements: Array.isArray(userXP.achievements) ? userXP.achievements.slice() : [],
            milestonesReached: Array.isArray(userXP.milestonesReached) ? userXP.milestonesReached.slice() : [],
            gameBests: collectGameBests(),
            // Pool extended record (W/L/win-rate)
            poolRecord: JSON.parse(localStorage.getItem('poolRecord') || 'null') || { p1Wins: 0, p1Losses: 0, p2Wins: 0, p2Losses: 0 },
            // Ludo W/L vs CPU — also what drives the adaptive difficulty tier,
            // so restoring it on a fresh browser restores the right difficulty.
            ludoRecord: JSON.parse(localStorage.getItem('ludoRecord') || 'null') || { wins: 0, losses: 0 },
            // Reflex full blob (screen + target modes)
            reflexHighScores: JSON.parse(localStorage.getItem('reflexHighScores') || 'null') || null,
            // Personalisation
            prayerCount: parseInt(localStorage.getItem('prayerCount') || '0', 10),
            customImageURL: localStorage.getItem('customImageURL') || '',
            customImageAspectRatio: localStorage.getItem('customImageAspectRatio') || '16:9',
            customQuotes: (() => { try { return JSON.parse(localStorage.getItem('customQuotes') || 'null'); } catch(_){return null;} })(),
            userPreferences: (() => { try { return JSON.parse(localStorage.getItem('attendancePrefs') || 'null'); } catch(_){return null;} })(),
            buildLabel: BUILD_LABEL,
            lastSync: new Date().toISOString()
        };
    }

    async function registerPlayer(displayName) {
        // Block banned clientIds from registering or re-registering
        if (isBlocked(lbClientId)) {
            console.warn('[Leaderboard] Registration denied — clientId is on the blocklist.');
            showXPNotification('🚫 Access denied', 'hourly');
            return false;
        }

        const registry = await fetchRegistry();
        if (!registry) { showXPNotification('❌ Could not reach leaderboard server', 'hourly'); return false; }

        const existing = registry.players.find(p => p.clientId === lbClientId);
        if (existing) {
            lbDisplayName = existing.displayName;
            lbRegistered = true;
            saveLeaderboardProfile();
            return true;
        }

        lbDisplayName = displayName;
        const snapshot = buildPlayerSnapshot();
        snapshot.joinedAt = new Date().toISOString().split('T')[0];
        snapshot.xpSig = _xpHash(snapshot.totalXP, snapshot.level, snapshot.gameSessions, snapshot.totalWorkDays);

        try {
            await patchPlayer(snapshot);
            lbDisplayName = displayName;
            lbRegistered = true;
            saveLeaderboardProfile();
            showXPNotification('🤝 Joined the leaderboard!', 'achievement');
            if (!userXP.achievements.includes('teamPlayer')) unlockAchievement('teamPlayer');
            return true;
        } catch (e) {
            console.error('[Leaderboard] register error:', e);
            showXPNotification('❌ Registration failed — try again', 'hourly');
            return false;
        }
    }

    async function syncMyScore() {
        if (!lbRegistered || lbFetching) return;
        // Blocklisted clientIds cannot sync
        if (isBlocked(lbClientId)) {
            console.warn('[Leaderboard] Sync denied — clientId is on the blocklist.');
            return;
        }
        // Local cooldown — prevents multiple dispatches before gist propagates
        const msSinceLocalSync = Date.now() - lbLastLocalSyncMs;
        if (msSinceLocalSync < AC_SYNC_COOLDOWN_MS) {
            console.warn(`[Sync] Local cooldown: ${Math.ceil((AC_SYNC_COOLDOWN_MS - msSinceLocalSync) / 1000)}s remaining`);
            return;
        }
        lbFetching = true;
        lbLastLocalSyncMs = Date.now();
        try {
            const registry = await fetchRegistry();
            if (!registry) return;

            // ─── Build Version Gate (informational only) ──────────────
            // The authoritative gate lives in sync.yml: dispatches carrying a
            // stale BUILD_TOKEN are rejected server-side. This client check just
            // surfaces a refresh banner before the user wastes a dispatch.
            if (registry.latestBuild && registry.latestBuild !== BUILD_LABEL && _clientIsBehindBuild(BUILD_LABEL, registry.latestBuild)) {
                console.warn(`[Sync] Outdated build (local: ${BUILD_LABEL}, latest: ${registry.latestBuild}). Sync will be rejected by server.`);
                showXPNotification(`🔄 Script outdated (${BUILD_LABEL} → ${registry.latestBuild}). Refresh your tab!`, 'hourly');
                showBuildUpdateBanner(registry.latestBuild);
                return;
            }
            // Mismatch with local ahead-or-equal falls through here deliberately:
            // this sync is what will advance the gist's stamp to BUILD_LABEL.
            // ──────────────────────────────────────────────────────────
            const idx = registry.players.findIndex(p => p.clientId === lbClientId);
            if (idx === -1) return;

            const prev = registry.players[idx];

            // ─── Anti-Cheat Checks ────────────────────────────────────
            // 1. If player is already flagged, block all syncs
            if (prev.flagged) {
                console.warn('[AntiCheat] Account frozen — sync blocked.');
                showXPNotification('🚫 Sync disabled — account flagged', 'hourly');
                return;
            }

            // 2. Integrity hash check — detects raw localStorage edits.
            // Refuse-to-sync only. We do NOT flag the gist from the client because
            // a stale/missing local hash (e.g. after restore or first run on a new
            // browser) is a false positive that would otherwise brick the account.
            if (!_verifyXPIntegrity()) {
                console.warn('[AntiCheat] XP integrity check FAILED — sync blocked locally (not flagging gist).');
                showXPNotification('⚠️ Local integrity check failed — sync blocked', 'hourly');
                return;
            }

            // 3. Sync cooldown — prevent rapid-fire syncing.
            // Anchored on serverSync (workflow-stamped) rather than lastSync (client-
            // supplied), so backdating a snapshot can't shorten the cooldown.
            const prevSyncAt = prev.serverSync || prev.lastSync;
            if (prevSyncAt) {
                const msSinceLast = Date.now() - new Date(prevSyncAt).getTime();
                if (msSinceLast < AC_SYNC_COOLDOWN_MS) {
                    console.warn(`[AntiCheat] Sync cooldown: ${Math.ceil((AC_SYNC_COOLDOWN_MS - msSinceLast) / 1000)}s remaining`);
                    showXPNotification(`⏳ Sync cooldown — wait ${Math.ceil((AC_SYNC_COOLDOWN_MS - msSinceLast) / 1000)}s`, 'hourly');
                    return;
                }
            }

            // 4. XP budget sanity gate — refuse-to-sync only, never self-flags.
            // Mirrors the server's activity budget: elapsed days bound the per-day
            // sources (hourly, milestones, capped streak bonus) while the game-session
            // and achievement counters bound the rest. The previous version scaled
            // purely with elapsed time, so a long gap authorised an effectively
            // unlimited gain.
            const snapshot = buildPlayerSnapshot();
            const xpDelta = (snapshot.totalXP || 0) - (prev.totalXP || 0);
            if (xpDelta > 0 && prevSyncAt) {
                const elapsedMs = Math.max(0, Date.now() - new Date(prevSyncAt).getTime());
                const elapsedDays = Math.max(1, Math.ceil(elapsedMs / 86400000));
                const newGames = Math.max(0, (snapshot.gameSessions || 0) - (prev.gameSessions || 0));
                const prevAch = Array.isArray(prev.achievements) ? prev.achievements.length : 0;
                const newAch = Math.max(0, (snapshot.achievements || []).length - prevAch);
                const maxAllowed = AC_XP_BURST_ALLOWANCE
                    + elapsedDays * AC_MAX_XP_PER_DAY
                    + newGames * AC_MAX_XP_PER_GAME
                    + newAch * AC_MAX_XP_PER_ACHIEVEMENT;
                if (xpDelta > maxAllowed) {
                    console.warn(`[AntiCheat] XP gain exceeds activity budget: +${xpDelta} XP vs max ${maxAllowed} (${elapsedDays}d, ${newGames} games, ${newAch} achievements). Sync blocked.`);
                    showXPNotification(`⚠️ Sync paused — XP gain (${xpDelta}) exceeds what ${elapsedDays}d of activity allows`, 'hourly');
                    return;
                }
            }
            // ─── End Anti-Cheat ───────────────────────────────────────

            // Preserve the original joinedAt so re-syncs don't change the join date
            snapshot.joinedAt = prev.joinedAt || new Date().toISOString().split('T')[0];
            // Carry forward the integrity hash
            snapshot.xpSig = _xpHash(snapshot.totalXP, snapshot.level, snapshot.gameSessions, snapshot.totalWorkDays);

            // latestBuild is set server-side by the workflow on successful writes;
            // never written from the client. Only our own record goes over the wire —
            // the server merges it into the stored registry.
            await patchPlayer(snapshot);
        } catch (e) {
            console.warn('[Leaderboard] sync error:', e);
        } finally {
            lbFetching = false;
        }
    }

    // Overlay a registry player record onto local storage (XP + game bests).
    // Returns true on success. Designed to be safe: only writes when source values look valid.
    function applyPlayerRecordToLocal(rec) {
        if (!rec || typeof rec !== 'object') return false;

        // Rehydrate XP
        userXP.level             = (typeof rec.level === 'number' && rec.level > 0) ? rec.level : (userXP.level || 1);
        userXP.totalXP           = (typeof rec.totalXP === 'number') ? rec.totalXP : (userXP.totalXP || 0);
        userXP.currentXP         = (typeof rec.currentXP === 'number') ? rec.currentXP : 0;
        userXP.totalWorkDays     = (typeof rec.totalWorkDays === 'number') ? rec.totalWorkDays : (userXP.totalWorkDays || 0);
        userXP.consecutiveDays   = (typeof rec.consecutiveDays === 'number') ? rec.consecutiveDays : (userXP.consecutiveDays || 0);
        userXP.longestStreak     = (typeof rec.longestStreak === 'number') ? rec.longestStreak : (userXP.longestStreak || 0);
        userXP.gameSessions      = (typeof rec.gameSessions === 'number') ? rec.gameSessions : (userXP.gameSessions || 0);
        if (typeof rec.todayHours === 'number')           userXP.todayHours = rec.todayHours;
        if (typeof rec.lastHourTracked === 'number')      userXP.lastHourTracked = rec.lastHourTracked;
        if (rec.lastAttendanceDate)                        userXP.lastAttendanceDate = rec.lastAttendanceDate;
        if (rec.lastShiftCompletedDate)                    userXP.lastShiftCompletedDate = rec.lastShiftCompletedDate;
        if (rec.lastStreakBonusDate)                       userXP.lastStreakBonusDate = rec.lastStreakBonusDate;
        if (typeof rec.hadStreakReset === 'boolean')      userXP.hadStreakReset = rec.hadStreakReset;
        if (Array.isArray(rec.achievements))               userXP.achievements = rec.achievements.slice();
        if (Array.isArray(rec.milestonesReached))          userXP.milestonesReached = rec.milestonesReached.slice();

        // The three XP fields above were copied independently, so a record whose
        // level was already inconsistent with its totalXP (from an earlier restore,
        // an admin rollback, or the old multi-level bug in checkLevelUp) would carry
        // that inconsistency straight into localStorage and stay wrong forever.
        // Re-derive level/currentXP from totalXP so every restore self-heals.
        reconcileLevelState('cloud restore');

        saveUserXP(userXP);

        // Rehydrate game bests (only raise, never lower — keeps any new local PRs)
        const gb = rec.gameBests || {};
        const raise = (key, val) => {
            const cur = parseInt(localStorage.getItem(key) || '0', 10);
            const v = parseInt(val || 0, 10);
            if (v > cur) localStorage.setItem(key, String(v));
        };
        raise('snakeHighScore',     gb.snake);
        raise('flappyHighScore',    gb.flappy);
        raise('tetrisHighScore',    gb.tetris);
        raise('breakoutHighScore',  gb.breakout);
        raise('poolGamesWon',       gb.pool);
        raise('ludoGamesWon',       gb.ludo);
        raise('aimChaosHighScore',  gb.aim);

        // Reflex — merge from gameBests.reflex (legacy) AND rec.reflexHighScores (new full blob)
        // GUARD: If the reset flag is set, skip reflex restoration entirely to prevent
        // the gist from re-infecting localStorage with pre-patch exploited scores.
        const _reflexResetActive = !!localStorage.getItem(REFLEX_RESET_FLAG);
        if (!_reflexResetActive) {
          if (typeof gb.reflex === 'number' && gb.reflex > 0 && isFinite(gb.reflex)) {
            const reflexData = JSON.parse(localStorage.getItem('reflexHighScores') || '{}');
            if (!reflexData.screen || typeof reflexData.screen.best !== 'number' || gb.reflex < reflexData.screen.best) {
                reflexData.screen = reflexData.screen || { best: Infinity, avg: Infinity };
                reflexData.screen.best = gb.reflex;
                localStorage.setItem('reflexHighScores', JSON.stringify(reflexData));
            }
          }
          // Full reflex blob (screen + target) — overwrites if source is better
          if (rec.reflexHighScores && typeof rec.reflexHighScores === 'object') {
            const localReflex = JSON.parse(localStorage.getItem('reflexHighScores') || '{}');
            ['screen', 'target'].forEach(mode => {
                const src = rec.reflexHighScores[mode];
                if (!src) return;
                if (!localReflex[mode]) localReflex[mode] = { best: Infinity, avg: Infinity };
                if (typeof src.best === 'number' && src.best > 0 && src.best < (localReflex[mode].best || Infinity)) {
                    localReflex[mode].best = src.best;
                }
                if (typeof src.avg === 'number' && src.avg > 0 && src.avg < (localReflex[mode].avg || Infinity)) {
                    localReflex[mode].avg = src.avg;
                }
            });
            localStorage.setItem('reflexHighScores', JSON.stringify(localReflex));
          }
        }

        // Prayer counter (only raise)
        if (typeof rec.prayerCount === 'number' && rec.prayerCount > 0) {
            const cur = parseInt(localStorage.getItem('prayerCount') || '0', 10);
            if (rec.prayerCount > cur) localStorage.setItem('prayerCount', String(rec.prayerCount));
        }

        // Pool extended record (W/L) — merge each field, only raise
        if (rec.poolRecord && typeof rec.poolRecord === 'object') {
            const localRec = JSON.parse(localStorage.getItem('poolRecord') || '{}');
            const merged = {
                p1Wins:   Math.max(localRec.p1Wins   || 0, rec.poolRecord.p1Wins   || 0),
                p1Losses: Math.max(localRec.p1Losses || 0, rec.poolRecord.p1Losses || 0),
                p2Wins:   Math.max(localRec.p2Wins   || 0, rec.poolRecord.p2Wins   || 0),
                p2Losses: Math.max(localRec.p2Losses || 0, rec.poolRecord.p2Losses || 0)
            };
            localStorage.setItem('poolRecord', JSON.stringify(merged));
        }

        // Ludo record (W/L vs CPU) — same only-raise merge as Pool
        if (rec.ludoRecord && typeof rec.ludoRecord === 'object') {
            const localLudo = JSON.parse(localStorage.getItem('ludoRecord') || '{}');
            localStorage.setItem('ludoRecord', JSON.stringify({
                wins:   Math.max(localLudo.wins   || 0, rec.ludoRecord.wins   || 0),
                losses: Math.max(localLudo.losses || 0, rec.ludoRecord.losses || 0)
            }));
        }

        // Personalisation — restore only if local is empty/default
        if (rec.customImageURL && !localStorage.getItem('customImageURL')) {
            localStorage.setItem('customImageURL', rec.customImageURL);
        }
        if (rec.customImageAspectRatio && !localStorage.getItem('customImageAspectRatio')) {
            localStorage.setItem('customImageAspectRatio', rec.customImageAspectRatio);
        }
        // Custom quotes — restore if local has no custom quotes (only default)
        if (Array.isArray(rec.customQuotes) && rec.customQuotes.length > 0) {
            const localQuotes = localStorage.getItem('customQuotes');
            if (!localQuotes || localQuotes === 'null') {
                localStorage.setItem('customQuotes', JSON.stringify(rec.customQuotes));
            } else {
                // Merge: add any cloud quotes not already present locally (by text match)
                try {
                    const local = JSON.parse(localQuotes) || [];
                    const localTexts = new Set(local.map(q => q.text));
                    const merged = [...local];
                    for (const q of rec.customQuotes) {
                        if (q.text && !localTexts.has(q.text)) merged.push(q);
                    }
                    if (merged.length > local.length) {
                        localStorage.setItem('customQuotes', JSON.stringify(merged));
                    }
                } catch (_) {}
            }
        }
        if (rec.userPreferences && typeof rec.userPreferences === 'object') {
            // Merge cloud prefs into local (cloud values fill in missing keys; local takes precedence if already set)
            let localPrefs = {};
            try { localPrefs = JSON.parse(localStorage.getItem('attendancePrefs') || '{}') || {}; } catch (_) {}
            const merged = { ...rec.userPreferences, ...localPrefs };
            localStorage.setItem('attendancePrefs', JSON.stringify(merged));
            try { userPreferences = { ...userPreferences, ...merged }; } catch (_) {}
        }

        return true;
    }

    // Restore the current client's progress from the gist.
    // Returns true if a matching record was found and applied.
    async function restoreFromGist() {
        if (!lbClientId) return false;
        const registry = await fetchRegistry();
        if (!registry || !Array.isArray(registry.players)) return false;
        const rec = registry.players.find(p => p.clientId === lbClientId);
        if (!rec) return false;
        const ok = applyPlayerRecordToLocal(rec);
        if (ok) {
            try { if (typeof updateXPDisplay === 'function') updateXPDisplay(); } catch (_) {}
            try { if (typeof updatePrayerDisplay === 'function') updatePrayerDisplay(); } catch (_) {}
        }
        return ok;
    }

    // Manual recovery: paste in console with the original clientId from the gist to re-claim a wiped account.
    //   await window.atcRestoreByClientId('fc847975-8ca3-49fc-a5d2-6ccaea28fd6b');
    // Optionally pass a displayName as the second arg to overwrite locally.
    async function atcRestoreByClientId(clientId, displayName) {
        if (!clientId || typeof clientId !== 'string') {
            console.error('[Restore] usage: atcRestoreByClientId("<your-gist-clientId>")');
            return false;
        }
        const registry = await fetchRegistry();
        if (!registry) { console.error('[Restore] Could not reach gist'); return false; }
        const rec = (registry.players || []).find(p => p.clientId === clientId);
        if (!rec) { console.error('[Restore] No record with that clientId on the gist'); return false; }

        lbClientId = clientId;
        lbDisplayName = displayName || rec.displayName || lbDisplayName || '';
        lbRegistered = true;
        saveLeaderboardProfile();
        const ok = applyPlayerRecordToLocal(rec);
        if (ok) {
            console.log(`[Restore] ✓ Restored ${lbDisplayName || 'account'} — Level ${userXP.level}, ${userXP.totalXP} XP`);
            try { showXPNotification(`🛟 Progress restored — Level ${userXP.level}`, 'achievement'); } catch (_) {}
            try { if (typeof updateXPDisplay === 'function') updateXPDisplay(); } catch (_) {}
        }
        return ok;
    }
    window.atcRestoreByClientId = atcRestoreByClientId;
    window.atcRestoreFromGist = restoreFromGist;
    window.syncMyScore = syncMyScore;

    // ─── Admin Tools (via GitHub Actions dispatch) ────────────────────
    // The admin key is NEVER stored in the script. You paste it once per session:
    //   window.atcAdminLogin('your-admin-key')
    // After that, the rollback / unflag / blocklist commands work for that
    // tab only. Closing the tab clears the key.
    //
    // Admin actions dispatch to the bot repo workflow; the workflow validates
    // the admin_key against the ADMIN_KEY repo secret before applying.
    let _adminKey = null;
    function atcAdminLogin(key) {
        if (typeof key !== 'string' || !key) {
            console.error('[Admin] usage: atcAdminLogin("your-admin-key")');
            return false;
        }
        _adminKey = key;
        console.log('[Admin] Admin key set for this session.');
        return true;
    }
    function atcAdminLogout() { _adminKey = null; console.log('[Admin] Admin key cleared.'); }

    async function _adminDispatch(eventType, payload) {
        if (!_adminKey) { console.error('[Admin] Not logged in. Call atcAdminLogin("key") first.'); return null; }
        const res = await fetch(`https://api.github.com/repos/${GH_BOT_REPO}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${GH_DISPATCHER_PAT}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: eventType,
                client_payload: { ...payload, admin_key: _adminKey, build_token: BUILD_TOKEN, build_label: BUILD_LABEL }
            })
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            console.error(`[Admin] dispatch ${eventType} → ${res.status}`, txt);
            return null;
        }
        return { ok: true, queued: true };
    }

    // Rollback a player's stats. Usage:
    //   await window.atcAdminRollback('clientId', { totalXP: 19818, level: 11, flagged: false })
    // NOTE: dispatch is async — actual gist update lands ~15-30s later.
    async function atcAdminRollback(clientId, overrides) {
        if (!clientId || !overrides || typeof overrides !== 'object') {
            console.error('[Admin] usage: atcAdminRollback("clientId", { totalXP: N, level: N, ... })');
            return false;
        }
        // Recompute xpSig if XP fields are being overridden, so the client doesn't see a tampered record.
        if ('totalXP' in overrides || 'level' in overrides || 'gameSessions' in overrides || 'totalWorkDays' in overrides) {
            const reg = await fetchRegistry();
            const prev = reg?.players?.find(p => p.clientId === clientId) || {};
            const merged = { ...prev, ...overrides };

            // Never let a rollback write a level that disagrees with totalXP —
            // hand-setting { totalXP, level } as a pair is precisely how records end
            // up permanently inconsistent. totalXP is the input; level and currentXP
            // are derived from it.
            if ('totalXP' in overrides) {
                const derived = deriveLevelFromTotalXP(merged.totalXP);
                if ('level' in overrides && overrides.level !== derived.level) {
                    console.warn(`[Admin] level ${overrides.level} does not match totalXP ${merged.totalXP}; using derived level ${derived.level}.`);
                }
                overrides.level = derived.level;
                overrides.currentXP = derived.currentXP;
                merged.level = derived.level;
            }

            overrides.xpSig = _xpHash(merged.totalXP || 0, merged.level || 1, merged.gameSessions || 0, merged.totalWorkDays || 0);
        }
        const result = await _adminDispatch('admin-rollback', { client_id: clientId, overrides });
        if (result?.ok) {
            console.log(`[Admin] ✓ Rollback queued for ${clientId} (gist updates in ~30s):`, overrides);
            return true;
        }
        return false;
    }

    // Unflag a player (remove freeze)
    async function atcAdminUnflag(clientId) {
        if (!clientId) { console.error('[Admin] usage: atcAdminUnflag("clientId")'); return false; }
        const result = await _adminDispatch('admin-unflag', { client_id: clientId });
        if (result?.ok) {
            console.log(`[Admin] ✓ Unflag queued for ${clientId} (gist updates in ~30s)`);
            return true;
        }
        return false;
    }

    // Strip a clientId from the gist. Action removes them server-side.
    // For permanent ban, also add the clientId to the BLOCKLIST set in sync.yml.
    async function atcAdminBlocklist(clientId, reason) {
        if (!clientId) { console.error('[Admin] usage: atcAdminBlocklist("clientId", "reason")'); return false; }
        const result = await _adminDispatch('admin-blocklist', { client_id: clientId, reason: reason || null });
        if (result?.ok) {
            console.log(`[Admin] ✓ Blocklist queued for ${clientId}. For permanent ban, also add to BLOCKLIST in sync.yml.`);
            return true;
        }
        return false;
    }

    window.atcAdminLogin = atcAdminLogin;
    window.atcAdminLogout = atcAdminLogout;
    window.atcAdminRollback = atcAdminRollback;
    window.atcAdminUnflag = atcAdminUnflag;
    window.atcAdminBlocklist = atcAdminBlocklist;
    window.atcPurgeBlocked = purgeBlockedPlayers;
    window.atcIsBlocked = isBlocked;
    // ──────────────────────────────────────────────────────────────

    async function fetchLeaderboard() {
        if (lbFetching) return leaderboardData;
        lbFetching = true;
        try {
            const registry = await fetchRegistry();
            if (!registry) return leaderboardData;
            // Detect any blocked players still present and trigger a background purge
            const hasBlocked = registry.players.some(p => isBlocked(p.clientId));
            if (hasBlocked) { lbFetching = false; purgeBlockedPlayers().catch(() => {}); lbFetching = true; }
            leaderboardData = registry.players
                .filter(p => !isBlocked(p.clientId) && !p.flagged)
                .sort((a, b) => b.level - a.level || b.totalXP - a.totalXP);
            return leaderboardData;
        } catch (e) {
            console.warn('[Leaderboard] fetch error:', e);
            return leaderboardData;
        } finally {
            lbFetching = false;
        }
    }

    // Leaderboard UI
    function renderLeaderboardPanel() {
        const panel = document.getElementById('leaderboard-panel');
        if (!panel) return;

        if (!lbRegistered) {
            panel.innerHTML = `
                <div class="lb-register-card">
                    <div class="lb-register-icon">🏆</div>
                    <h3 class="lb-register-title">Join the Leaderboard</h3>
                    <p class="lb-register-desc">Compete with your team! Your level, XP, and game scores will be shared.</p>
                    <input id="lb-name-input" class="lb-name-input" type="text" placeholder="Display name (e.g. Hassan N.)" maxlength="20" />
                    <button class="lb-register-btn" onclick="window.lbRegister()">🚀 Join Now</button>
                </div>`;
            return;
        }

        // Build leaderboard table
        let rows = '';
        leaderboardData.forEach((p, i) => {
            const rank = i + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
            const isMe = p.clientId === lbClientId;
            const gb = p.gameBests || {};
            const fmt = v => (v && v > 0) ? v.toLocaleString() : '—';
            const fmtMs = v => (v && v > 0) ? v + 'ms' : '—';
            rows += `<tr class="${isMe ? 'lb-row-me' : ''}">
                <td class="lb-rank">${medal}</td>
                <td class="lb-name">${escapeHtml(p.displayName)}${isMe ? ' <span class="lb-you">(you)</span>' : ''}</td>
                <td class="lb-level">Lv.${p.level}</td>
                <td class="lb-xp">${(p.totalXP || 0).toLocaleString()}</td>
                <td class="lb-score">${fmt(gb.breakout)}</td>
                <td class="lb-score">${fmt(gb.pool)}</td>
                <td class="lb-score">${fmt(gb.ludo)}</td>
                <td class="lb-score">${fmt(gb.tetris)}</td>
                <td class="lb-score">${fmt(gb.snake)}</td>
                <td class="lb-score">${fmt(gb.flappy)}</td>
                <td class="lb-score">${fmt(gb.aim)}</td>
                <td class="lb-score">${fmtMs(gb.reflex)}</td>
            </tr>`;
        });

        const lastSync = leaderboardData.length > 0 ? new Date(leaderboardData[0].lastSync || Date.now()).toLocaleTimeString() : '—';
        panel.innerHTML = `
            <div class="lb-table-wrap">
                <table class="lb-table">
                    <thead><tr>
                        <th></th>
                        <th>Player</th>
                        <th>Lv.</th>
                        <th>XP</th>
                        <th title="Breakout">🏓</th>
                        <th title="Pool">🎱</th>
                        <th title="Ludo">🎲</th>
                        <th title="Tetris">🧱</th>
                        <th title="Snake">🐍</th>
                        <th title="Flappy">🐦</th>
                        <th title="Aim Trainer">💥</th>
                        <th title="Reflex">⚡</th>
                    </tr></thead>
                    <tbody>${rows || '<tr><td colspan="12" class="lb-empty">No players yet</td></tr>'}</tbody>
                </table>
            </div>
            <div class="lb-footer">Last updated: ${lastSync}</div>`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function initLeaderboard() {
        loadLeaderboardProfile();
        if (lbRegistered) {
            fetchLeaderboard().then(() => {
                renderLeaderboardPanel();
                checkBuildVersion();
            });
        } else {
            renderLeaderboardPanel();
        }
    }

    // ─── Build Version Checker (UX only) ──────────────────────────
    // Compares local BUILD_LABEL against the gist's latestBuild label (set by
    // the workflow on every successful write). Server-side BUILD_TOKEN check
    // is the real enforcement; this just shows the refresh banner.
    async function checkBuildVersion() {
        try {
            const registry = await fetchRegistry();
            if (!registry || !registry.latestBuild) return;
            // Only warn when genuinely behind — see _clientIsBehindBuild for why an
            // equal-or-newer client hitting a stale gist stamp isn't "outdated".
            if (registry.latestBuild !== BUILD_LABEL && _clientIsBehindBuild(BUILD_LABEL, registry.latestBuild)) {
                showBuildUpdateBanner(registry.latestBuild);
            }
        } catch (_) {}
    }

    function showBuildUpdateBanner(latestBuild) {
        if (document.getElementById('atc-update-banner')) return; // already shown
        const banner = document.createElement('div');
        banner.id = 'atc-update-banner';
        banner.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
            background: linear-gradient(135deg, #ff6b35, #f72585);
            color: #fff; padding: 10px 20px; text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px; font-weight: 600;
            box-shadow: 0 2px 12px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center; gap: 12px;
        `;
        banner.innerHTML = `
            <span>⚠️ Script outdated (${BUILD_LABEL} → ${latestBuild}). Sync is disabled.</span>
            <button id="atc-update-refresh-btn" style="
                background: #fff; color: #f72585; border: none; border-radius: 6px;
                padding: 6px 14px; font-weight: 700; cursor: pointer; font-size: 13px;
            ">🔄 Refresh Now</button>
            <button id="atc-update-dismiss-btn" style="
                background: transparent; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.4);
                border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 12px;
            ">✕</button>
        `;
        document.body.appendChild(banner);
        document.getElementById('atc-update-refresh-btn').addEventListener('click', () => location.reload());
        document.getElementById('atc-update-dismiss-btn').addEventListener('click', () => banner.remove());
    }
    // ──────────────────────────────────────────────────────────────

    // 8-BALL POOL GAME VARIABLES
    let poolCanvas, poolCtx;
    let poolAnimFrame = null;
    let poolGameRunning = false;
    let poolGameOver = false;
    let poolMaximized = false;
    let poolMode = 'cpu'; // 'cpu' | 'pvp'
    let poolTurn = 1; // 1 or 2
    let poolBalls = [];
    let poolPockets = [];
    let poolGamesWon = 0;
    let poolRecord = { p1Wins: 0, p1Losses: 0, p2Wins: 0, p2Losses: 0 };
    let poolBgTime = 0; // animated background time counter

    // PRAYER COUNTER VARIABLES
    let prayerCount = 0;

    // Cue stick aiming state
    let poolAiming = false;
    let poolDragging = false;
    let poolCueAngle = 0;
    let poolCuePower = 0;
    let poolCueSpinX = 0; // -1 to 1
    let poolCueSpinY = 0; // -1 to 1
    let poolMouseX = 0;
    let poolMouseY = 0;

    // Aim-lock state: angle locks on mouse-down; power controlled by pull-back
    let poolAimLocked = false;  // true while mouse button held
    let poolLockedAngle = 0;    // the aim angle frozen at mouse-down

    // Ball-in-hand state
    let poolBallInHand = false;
    let poolPlacingBall = false;

    // Turn result tracking
    let poolFirstPocket = false; // has a group been assigned?
    let poolPlayer1Group = null; // 'solids' | 'stripes' | null
    let poolPlayer2Group = null;
    let poolPlayer1Pocketed = [];
    let poolPlayer2Pocketed = [];
    let poolFoulMessage = '';
    let poolWinner = 0;
    let poolShotFired = false;
    let poolFirstBallHit = -1; // id of first ball struck by cue ball
    let poolCushionAfterHit = false;
    let poolPocketedThisShot = [];
    let poolAIDelay = 0; // frames to wait before AI shoots
    let poolAIPendingShot = null; // { angle, power, spinX, spinY } — pre-computed CPU shot shown during delay
    let poolIsBreakShot = false; // true from game-start until first shot — restricts cue placement to kitchen

    // Shot clock
    const POOL_SHOT_CLOCK = 30; // seconds per turn
    let poolShotTimer = POOL_SHOT_CLOCK;
    let poolShotTimerFrame = 0; // frame counter for 1-second ticks

    // Physics constants
    const POOL_W = 368;
    const POOL_H = 184; // 2:1 table ratio
    const POOL_CANVAS_H = 368; // Match other games for consistent canvas height
    const POOL_TABLE_OFFSET_Y = (POOL_CANVAS_H - POOL_H) / 2; // 92 — centers table vertically
    const POOL_BALL_R = 6;
    const POOL_POCKET_R = 11;
    const POOL_FRICTION = 0.985;
    const POOL_RESTITUTION = 0.92;
    const POOL_MIN_VEL = 0.08;
    const POOL_CUE_MAX_POWER = 24;
    const POOL_SUB_STEPS = 8; // 24/8 = 3px per step — well under ball radius, prevents collision normal errors at high power
    const POOL_CUSHION_X1 = 16;
    const POOL_CUSHION_Y1 = 16;
    const POOL_CUSHION_X2 = POOL_W - 16;
    const POOL_CUSHION_Y2 = POOL_H - 16;
    const POOL_BAULK_X = Math.round(POOL_W * 0.25); // head string — kitchen boundary for break shot

    // Table color definitions
    const POOL_TABLE_COLORS = {
        green:     { felt: '#2d8a4e', cushion: '#1a5c32', border: '#5c3a1e', pocket: '#111' },
        red:       { felt: '#8b3a3a', cushion: '#5c1a1a', border: '#5c3a1e', pocket: '#111' },
        blue:      { felt: '#2a5a8a', cushion: '#1a3a5c', border: '#5c3a1e', pocket: '#111' },
        lightgrey: { felt: '#9aa5b0', cushion: '#6e7a85', border: '#5c3a1e', pocket: '#222' }
    };

    // Ball definitions: id, color, stripe, number
    const POOL_BALL_DEFS = [
        { id: 0,  color: '#f5f5f5', stripe: false, num: 0  }, // cue ball
        { id: 1,  color: '#f0c830', stripe: false, num: 1  }, // solid yellow
        { id: 2,  color: '#1a5ab8', stripe: false, num: 2  }, // solid blue
        { id: 3,  color: '#d42a2a', stripe: false, num: 3  }, // solid red
        { id: 4,  color: '#4a2080', stripe: false, num: 4  }, // solid purple
        { id: 5,  color: '#e86820', stripe: false, num: 5  }, // solid orange
        { id: 6,  color: '#1a7a3a', stripe: false, num: 6  }, // solid green
        { id: 7,  color: '#8b1a1a', stripe: false, num: 7  }, // solid maroon
        { id: 8,  color: '#111111', stripe: false, num: 8  }, // 8-ball
        { id: 9,  color: '#f0c830', stripe: true,  num: 9  }, // stripe yellow
        { id: 10, color: '#1a5ab8', stripe: true,  num: 10 }, // stripe blue
        { id: 11, color: '#d42a2a', stripe: true,  num: 11 }, // stripe red
        { id: 12, color: '#4a2080', stripe: true,  num: 12 }, // stripe purple
        { id: 13, color: '#e86820', stripe: true,  num: 13 }, // stripe orange
        { id: 14, color: '#1a7a3a', stripe: true,  num: 14 }, // stripe green
        { id: 15, color: '#8b1a1a', stripe: true,  num: 15 }  // stripe maroon
    ];
    let breakoutCanvas, breakoutCtx;
    let breakoutAnimFrame = null;
    let breakoutGameRunning = false;
    let breakoutGameOver = false;
    let breakoutScore = 0;
    let breakoutHighScore = 0;
    let breakoutLives = 3;
    let breakoutLevel = 1;
    let breakoutBricks = [];
    let breakoutBalls = [];        // multi-ball array
    let breakoutPaddle = {};
    let breakoutParticles = [];
    let breakoutPowerupDrops = []; // falling powerup capsules
    let breakoutLasers = [];       // laser shots from paddle
    let breakoutMouseX = null;
    let breakoutCombo = 0;
    let breakoutLastBrickHit = 0;

    // Active powerup timers (seconds at 60fps — stored as frame counts)
    let brkPU = {
        expandTimer: 0, shrinkTimer: 0, slowTimer: 0, fastTimer: 0,
        stickyTimer: 0, laserTimer: 0, fireballTimer: 0, throughTimer: 0,
        explodeTimer: 0,
        laserCooldown: 0,
        stuckBallIdx: -1  // which ball index is stuck to paddle
    };
    let brkPendingLevelClear = false;

    const BRK_W = 368, BRK_H = 368;
    const BRK_ROWS = 6, BRK_COLS = 10;
    const BRK_BRICK_W = 32, BRK_BRICK_H = 14, BRK_BRICK_GAP = 2;
    const BRK_BRICK_OFFSET_X = 8, BRK_BRICK_OFFSET_Y = 40;
    const BRK_PAD_W = 60, BRK_PAD_H = 10, BRK_PAD_Y = 342;
    const BRK_BALL_R = 6;
    const BRK_BASE_SPEED = 2.2;

    const BRK_BRICK_COLORS = [
        ['#ff4757','#ff6b81'],
        ['#ff6348','#ff7f50'],
        ['#ffa502','#ffbe33'],
        ['#2ed573','#7bed9f'],
        ['#1e90ff','#54a0ff'],
        ['#a29bfe','#c8b6ff'],
    ];
    const BRK_BRICK_HP  = [3, 2, 2, 1, 1, 1];
    const BRK_BRICK_PTS = [30, 20, 20, 10, 10, 10];

    // Powerup definitions: id, emoji, label, color, duration(frames), drop-weight
    const BRK_POWERUPS = [
        { id:'expand',   icon:'↔',  label:'Big Paddle',   color:'#2ed573', dur:420, w:10, good:true  },
        { id:'shrink',   icon:'↕',  label:'Tiny Paddle',  color:'#ff4757', dur:300, w:5,  good:false },
        { id:'multiball',icon:'⊕',  label:'Multi-Ball',   color:'#ffd700', dur:0,   w:8,  good:true  },
        { id:'slow',     icon:'❄',  label:'Slow Ball',    color:'#74b9ff', dur:360, w:8,  good:true  },
        { id:'fast',     icon:'⚡', label:'Fast Ball',    color:'#fd79a8', dur:240, w:5,  good:false },
        { id:'life',     icon:'♥',  label:'+1 Life',      color:'#00b894', dur:0,   w:6,  good:true  },
        { id:'sticky',   icon:'●',  label:'Sticky',       color:'#a29bfe', dur:480, w:7,  good:true  },
        { id:'laser',    icon:'|',  label:'Laser',        color:'#fd79a8', dur:600, w:7,  good:true  },
        { id:'fireball', icon:'🔥', label:'Fireball',     color:'#e17055', dur:360, w:5,  good:true  },
        { id:'through',  icon:'◉',  label:'Through',      color:'#00cec9', dur:300, w:5,  good:true  },
        { id:'explode',  icon:'💥', label:'Explosive',    color:'#fdcb6e', dur:360, w:5,  good:true  },
    ];
    const BRK_PU_TOTAL_W = BRK_POWERUPS.reduce((s,p) => s+p.w, 0);

    function brkPickPowerup() {
        const r = Math.random() * BRK_PU_TOTAL_W;
        let sum = 0;
        for (const pu of BRK_POWERUPS) { sum += pu.w; if (r < sum) return pu; }
        return BRK_POWERUPS[0];
    }

    function initBreakoutGame() {
        breakoutCanvas = document.getElementById('breakout-canvas');
        if (!breakoutCanvas) return;
        breakoutCtx = breakoutCanvas.getContext('2d');
        breakoutHighScore = loadBreakoutHighScore();
        resetBreakoutGame();
        drawBreakoutFrame();
    }

    function resetBreakoutGame() {
        breakoutGameRunning = false;
        breakoutGameOver   = false;
        breakoutScore  = 0;
        breakoutLives  = 3;
        breakoutLevel  = 1;
        breakoutCombo  = 0;
        breakoutParticles  = [];
        breakoutPowerupDrops = [];
        breakoutLasers = [];
        brkPU = { expandTimer:0, shrinkTimer:0, slowTimer:0, fastTimer:0,
                  stickyTimer:0, laserTimer:0, fireballTimer:0, throughTimer:0,
                  explodeTimer:0, laserCooldown:0, stuckBallIdx:-1 };
        if (breakoutAnimFrame) { cancelAnimationFrame(breakoutAnimFrame); breakoutAnimFrame = null; }
        brkResetBall();
        buildBreakoutBricks();
        updateBreakoutScoreboard();
        drawBreakoutFrame();
    }

    function brkResetBall() {
        const padW = brkPaddleWidth();
        breakoutPaddle = { x: BRK_W/2 - padW/2, y: BRK_PAD_Y, w: padW, h: BRK_PAD_H };
        const angle = -Math.PI/2 + (Math.random()-0.5)*0.8;
        const spd   = BRK_BASE_SPEED + breakoutLevel*0.06;
        breakoutBalls = [{ x:BRK_W/2, y:BRK_PAD_Y - BRK_BALL_R - 2,
                            vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd,
                            r:BRK_BALL_R, trail:[], stuck:false }];
        brkPU.stuckBallIdx = -1;
        // Kill powerup timers that shouldn't survive respawn
        brkPU.stickyTimer = 0; brkPU.laserTimer = 0;
        brkPU.fireballTimer = 0; brkPU.throughTimer = 0; brkPU.explodeTimer = 0;
    }

    function brkPaddleWidth() {
        if (brkPU.expandTimer > 0) return BRK_PAD_W * 1.65;
        if (brkPU.shrinkTimer > 0) return BRK_PAD_W * 0.55;
        return BRK_PAD_W;
    }

    function brkBallSpeed(ball) {
        return Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
    }

    function brkSetSpeed(ball, spd) {
        const cur = brkBallSpeed(ball);
        if (cur === 0) return;
        ball.vx = ball.vx/cur * spd;
        ball.vy = ball.vy/cur * spd;
    }

    function buildBreakoutBricks() {
        breakoutBricks = [];
        for (let r = 0; r < BRK_ROWS; r++) {
            for (let c = 0; c < BRK_COLS; c++) {
                if (breakoutLevel >= 2 && ((r+c)%5===0)) continue;
                if (breakoutLevel >= 3 && ((r*c)%7===0)) continue;
                breakoutBricks.push({
                    x: BRK_BRICK_OFFSET_X + c*(BRK_BRICK_W+BRK_BRICK_GAP),
                    y: BRK_BRICK_OFFSET_Y + r*(BRK_BRICK_H+BRK_BRICK_GAP),
                    w: BRK_BRICK_W, h: BRK_BRICK_H,
                    row:r, col:c,
                    hp: BRK_BRICK_HP[r], maxHp: BRK_BRICK_HP[r],
                    pts: BRK_BRICK_PTS[r], alive:true, flashTimer:0
                });
            }
        }
    }

    function startBreakoutGame() {
        if (breakoutGameRunning) return;
        resetBreakoutGame();
        breakoutGameRunning = true;
        breakoutLastLogicMs = 0;
        breakoutAccumulator = 0;
        breakoutLastFrameMs = 0;
        breakoutAnimFrame = requestAnimationFrame(breakoutLoop);
        // click to release sticky ball
        breakoutCanvas.addEventListener('click', brkHandleClick);
    }

    function breakoutLoop(now) {
        if (!breakoutGameRunning) return;
        breakoutAnimFrame = requestAnimationFrame(breakoutLoop);

        // Fixed timestep: game logic always runs at 60 updates/sec
        if (!breakoutLastLogicMs) breakoutLastLogicMs = now;
        let delta = now - breakoutLastLogicMs;
        breakoutLastLogicMs = now;
        if (delta > 100) delta = 100; // cap to prevent spiral of death
        breakoutAccumulator += delta;
        while (breakoutAccumulator >= FIXED_DT) {
            updateBreakout();
            breakoutAccumulator -= FIXED_DT;
        }

        // Render: capped by FPS setting
        const renderElapsed = now - breakoutLastFrameMs;
        if (renderElapsed < getFrameInterval()) return;
        breakoutLastFrameMs = now - (renderElapsed % getFrameInterval());
        drawBreakoutFrame();
    }

    function brkHandleClick() {
        // Release sticky ball on click
        if (brkPU.stuckBallIdx >= 0 && brkPU.stuckBallIdx < breakoutBalls.length && breakoutBalls[brkPU.stuckBallIdx]) {
            const b = breakoutBalls[brkPU.stuckBallIdx];
            if (b.stuck) {
                b.stuck = false;
                const spd = BRK_BASE_SPEED + breakoutLevel*0.12;
                b.vy = -spd * 0.85;
                b.vx = (Math.random()-0.5) * spd * 0.8;
                brkPU.stuckBallIdx = -1;
            }
        }
        // Fire laser if active
        if (brkPU.laserTimer > 0 && brkPU.laserCooldown <= 0) {
            const pad = breakoutPaddle;
            breakoutLasers.push({ x: pad.x + 8,      y: pad.y - 6, vy:-12 });
            breakoutLasers.push({ x: pad.x + pad.w - 8, y: pad.y - 6, vy:-12 });
            brkPU.laserCooldown = 22;
        }
    }

    function brkApplyPowerup(pu) {
        switch(pu.id) {
            case 'expand':    brkPU.expandTimer = pu.dur; brkPU.shrinkTimer = 0; break;
            case 'shrink':    brkPU.shrinkTimer = pu.dur; brkPU.expandTimer = 0; break;
            case 'slow':
                brkPU.slowTimer = pu.dur; brkPU.fastTimer = 0;
                breakoutBalls.forEach(b => brkSetSpeed(b, (BRK_BASE_SPEED + breakoutLevel*0.12)*0.58));
                break;
            case 'fast':
                brkPU.fastTimer = pu.dur; brkPU.slowTimer = 0;
                breakoutBalls.forEach(b => brkSetSpeed(b, (BRK_BASE_SPEED + breakoutLevel*0.12)*1.55));
                break;
            case 'multiball': {
                const count = 2 + Math.floor(Math.random()*2); // 2-3 extra balls
                const src = breakoutBalls[0] || { x:BRK_W/2, y:BRK_H/2, vx:2, vy:-3 };
                for (let i=0; i<count; i++) {
                    const a = Math.random()*Math.PI*2;
                    const spd = brkBallSpeed(src)||4;
                    breakoutBalls.push({ x:src.x, y:src.y,
                        vx:Math.cos(a)*spd, vy:-Math.abs(Math.sin(a)*spd),
                        r:BRK_BALL_R, trail:[], stuck:false });
                }
                break;
            }
            case 'life':
                breakoutLives = Math.min(breakoutLives+1, 6);
                spawnBreakoutParticles(BRK_W/2, BRK_H/2, '#00b894', 15);
                updateBreakoutScoreboard();
                break;
            case 'sticky':  brkPU.stickyTimer = pu.dur; break;
            case 'laser':   brkPU.laserTimer  = pu.dur; break;
            case 'fireball':brkPU.fireballTimer= pu.dur; break;
            case 'through': brkPU.throughTimer = pu.dur; break;
            case 'explode': brkPU.explodeTimer = pu.dur; break;
        }
    }

    function updateBreakout() {
        const pad = breakoutPaddle;

        // Tick powerup timers and handle expiration
        const prevSlowTimer = brkPU.slowTimer;
        const prevFastTimer = brkPU.fastTimer;
        
        const timerKeys = ['expandTimer','shrinkTimer','slowTimer','fastTimer',
                           'stickyTimer','laserTimer','fireballTimer','throughTimer','explodeTimer'];
        timerKeys.forEach(k => { if (brkPU[k] > 0) brkPU[k]--; });
        if (brkPU.laserCooldown > 0) brkPU.laserCooldown--;

        // Reset ball speed to normal when slow/fast powerup expires
        if ((prevSlowTimer > 0 && brkPU.slowTimer === 0) || (prevFastTimer > 0 && brkPU.fastTimer === 0)) {
            const normalSpeed = BRK_BASE_SPEED + breakoutLevel * 0.06;
            breakoutBalls.forEach(b => brkSetSpeed(b, normalSpeed));
        }

        // Sync paddle width to current powerup state
        pad.w = brkPaddleWidth();
        pad.x = Math.max(0, Math.min(BRK_W - pad.w, pad.x));

        // Paddle follow mouse / touch
        if (breakoutMouseX !== null) {
            const targetX = breakoutMouseX - pad.w/2;
            pad.x += (targetX - pad.x) * 0.35;
            pad.x = Math.max(0, Math.min(BRK_W - pad.w, pad.x));
        }

        // Update falling powerup capsules
        for (let i = breakoutPowerupDrops.length-1; i >= 0; i--) {
            const d = breakoutPowerupDrops[i];
            d.y += d.vy;
            // Caught by paddle
            if (d.y + 10 > pad.y && d.y < pad.y + pad.h &&
                d.x > pad.x - 16 && d.x < pad.x + pad.w + 16) {
                brkApplyPowerup(d.pu);
                spawnBreakoutParticles(d.x, d.y, d.pu.color, 10);
                breakoutPowerupDrops.splice(i,1);
                continue;
            }
            if (d.y > BRK_H + 10) breakoutPowerupDrops.splice(i,1);
        }

        // Update lasers
        for (let i = breakoutLasers.length-1; i >= 0; i--) {
            const l = breakoutLasers[i];
            l.y += l.vy;
            if (l.y < -10) { breakoutLasers.splice(i,1); continue; }
            // Laser-brick collision
            let hit = false;
            for (const b of breakoutBricks) {
                if (!b.alive) continue;
                if (l.x > b.x && l.x < b.x+b.w && l.y > b.y && l.y < b.y+b.h) {
                    brkDamageBrick(b, true);
                    hit = true; break;
                }
            }
            if (hit) breakoutLasers.splice(i,1);
        }

        // Update each ball
        const now = performance.now();
        const isFireball = brkPU.fireballTimer > 0;
        const isThrough  = brkPU.throughTimer  > 0;
        const isExplode  = brkPU.explodeTimer  > 0;

        for (let bi = breakoutBalls.length-1; bi >= 0; bi--) {
            const ball = breakoutBalls[bi];
            if (!ball) continue; // guard: array may have been mutated mid-loop

            // Stuck to paddle — ride with it
            if (ball.stuck) {
                ball.x = pad.x + pad.w/2;
                ball.trail = [];
                continue;
            }

            // Trail
            ball.trail.push({ x:ball.x, y:ball.y });
            if (ball.trail.length > 9) ball.trail.shift();

            // Move
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Wall bounces
            if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
            if (ball.x + ball.r > BRK_W) { ball.x = BRK_W-ball.r; ball.vx = -Math.abs(ball.vx); }
            if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

            // Lost bottom
            if (ball.y + ball.r > BRK_H) {
                // Clear stuck index if removing the stuck ball
                if (brkPU.stuckBallIdx === bi) {
                    brkPU.stuckBallIdx = -1;
                } else if (brkPU.stuckBallIdx > bi) {
                    // Adjust index if removing a ball before the stuck one
                    brkPU.stuckBallIdx--;
                }
                breakoutBalls.splice(bi,1);
                if (breakoutBalls.length === 0) {
                    breakoutCombo = 0;
                    breakoutLives--;
                    updateBreakoutScoreboard();
                    if (breakoutLives <= 0) {
                        breakoutGameOver = true;
                        breakoutGameRunning = false;
                        const isHS = breakoutScore > breakoutHighScore;
                        if (isHS) { breakoutHighScore = breakoutScore; saveBreakoutHighScore(breakoutHighScore); }
                        awardGameXP('breakout', { score:breakoutScore, level:breakoutLevel, isHighScore:isHS });
                        updateBreakoutScoreboard();
                        return;
                    }
                    brkResetBall();
                }
                continue;
            }

            // Paddle collision
            if (ball.vy > 0 &&
                ball.x + ball.r > pad.x && ball.x - ball.r < pad.x + pad.w &&
                ball.y + ball.r > pad.y && ball.y - ball.r < pad.y + pad.h) {
                ball.y = pad.y - ball.r - 1;
                if (brkPU.stickyTimer > 0 && brkPU.stuckBallIdx < 0) {
                    ball.stuck = true;
                    brkPU.stuckBallIdx = bi;
                    ball.vx = 0; ball.vy = 0;
                } else {
                    const hitRatio = (ball.x - (pad.x + pad.w/2)) / (pad.w/2);
                    const ang = hitRatio * 1.1;
                    const spd = brkBallSpeed(ball);
                    ball.vx = Math.sin(ang)*spd;
                    ball.vy = -Math.abs(Math.cos(ang)*spd);
                    if (Math.abs(ball.vx) < 0.8) ball.vx = 0.8 * Math.sign(ball.vx||1);
                }
            }

            // Brick collisions
            let bricksHitThisFrame = 0;
            for (let i = breakoutBricks.length-1; i >= 0; i--) {
                const b = breakoutBricks[i];
                if (!b.alive) continue;
                if (ball.x+ball.r < b.x || ball.x-ball.r > b.x+b.w ||
                    ball.y+ball.r < b.y || ball.y-ball.r > b.y+b.h) continue;

                const wasAlive = b.alive;
                brkDamageBrick(b, false, isExplode, now);

                // Deflect unless fireball or through-ball (through only skips deflect, doesn't ignore damage)
                if (!isFireball && !isThrough && bricksHitThisFrame === 0) {
                    const overlapL = (ball.x+ball.r)-b.x, overlapR = (b.x+b.w)-(ball.x-ball.r);
                    const overlapT = (ball.y+ball.r)-b.y, overlapB = (b.y+b.h)-(ball.y-ball.r);
                    const minH = Math.min(overlapL, overlapR), minV = Math.min(overlapT, overlapB);
                    if (minH < minV) { ball.vx = overlapL<overlapR ? -Math.abs(ball.vx) : Math.abs(ball.vx); }
                    else             { ball.vy = overlapT<overlapB ? -Math.abs(ball.vy) : Math.abs(ball.vy); }
                    bricksHitThisFrame++;
                } else if (isFireball || isThrough) {
                    bricksHitThisFrame++; // count but don't deflect
                }
            }
        }

        // Handle deferred level clear (set by brkDamageBrick during ball loop)
        if (brkPendingLevelClear) {
            brkPendingLevelClear = false;
            breakoutLevel++;
            breakoutCombo = 0;
            buildBreakoutBricks();
            brkResetBall();
            spawnBreakoutParticles(BRK_W/2, BRK_H/2, '#ffd700', 35);
            updateBreakoutScoreboard();
        }

        // Decrement flash timers & particles
        breakoutBricks.forEach(b => { if (b.flashTimer>0) b.flashTimer--; });
        for (let i = breakoutParticles.length-1; i >= 0; i--) {
            const p = breakoutParticles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.18;
            p.life--;
            if (p.life <= 0) breakoutParticles.splice(i,1);
        }
    }

    function brkDamageBrick(b, fromLaser=false, explode=false, now=0) {
        if (!b.alive) return;
        b.hp--;
        b.flashTimer = 8;
        if (b.hp <= 0) {
            b.alive = false;
            if (!now) now = performance.now();
            if (now - breakoutLastBrickHit < 1200) breakoutCombo++;
            else breakoutCombo = 1;
            breakoutLastBrickHit = now;
            const comboMult = Math.min(breakoutCombo, 8);
            breakoutScore += b.pts * comboMult * breakoutLevel;
            spawnBreakoutParticles(b.x+b.w/2, b.y+b.h/2, BRK_BRICK_COLORS[b.row][0], fromLaser?5:8);

            // Explosive radius — damage nearby bricks
            if (explode) {
                const EXP_R = 55;
                breakoutBricks.forEach(nb => {
                    if (!nb.alive || nb === b) return;
                    const dx = (nb.x+nb.w/2)-(b.x+b.w/2);
                    const dy = (nb.y+nb.h/2)-(b.y+b.h/2);
                    if (Math.sqrt(dx*dx+dy*dy) < EXP_R) {
                        nb.hp = Math.max(0, nb.hp-1);
                        nb.flashTimer = 12;
                        if (nb.hp <= 0) {
                            nb.alive = false;
                            breakoutScore += nb.pts * breakoutLevel;
                            spawnBreakoutParticles(nb.x+nb.w/2, nb.y+nb.h/2, '#fdcb6e', 5);
                        }
                    }
                });
                spawnBreakoutParticles(b.x+b.w/2, b.y+b.h/2, '#fdcb6e', 18);
            }

            // Random powerup drop (25% base, slightly more for harder bricks)
            const dropChance = 0.25 + (b.maxHp-1)*0.08;
            if (Math.random() < dropChance) {
                const pu = brkPickPowerup();
                breakoutPowerupDrops.push({ x:b.x+b.w/2, y:b.y+b.h/2, vy:2.2, pu });
            }

            updateBreakoutScoreboard();
            // Level clear — flag it; reset runs AFTER the ball loop to avoid iterator crash
            if (breakoutBricks.every(bk => !bk.alive)) {
                brkPendingLevelClear = true;
            }
        }
    }

    function spawnBreakoutParticles(cx, cy, color, count) {
        for (let i=0; i<count; i++) {
            const a = Math.random()*Math.PI*2, spd = 1+Math.random()*3;
            breakoutParticles.push({
                x:cx, y:cy, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd-1,
                life: 25+Math.floor(Math.random()*20), maxLife:45,
                size: 2+Math.random()*3, color
            });
        }
    }

    function drawBreakoutFrame() {
        if (!breakoutCtx) return;
        const ctx = breakoutCtx;
        const W = BRK_W, H = BRK_H;
        const pad = breakoutPaddle;

        // Background
        const bg = ctx.createLinearGradient(0,0,0,H);
        bg.addColorStop(0,'#0d0d1a'); bg.addColorStop(1,'#0a0a14');
        ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
        ctx.fillStyle='rgba(0,0,0,0.06)';
        for (let y=0; y<H; y+=4) ctx.fillRect(0,y,W,2);

        // Bricks
        breakoutBricks.forEach(b => {
            if (!b.alive) return;
            const [c1,c2] = BRK_BRICK_COLORS[b.row];
            const dmg = 1-b.hp/b.maxHp, flash = b.flashTimer>0;
            if (flash) { ctx.shadowColor=c1; ctx.shadowBlur=14; }
            const grad = ctx.createLinearGradient(b.x,b.y,b.x,b.y+b.h);
            if (flash) { grad.addColorStop(0,'#fff'); grad.addColorStop(0.5,c1); grad.addColorStop(1,c2); }
            else       { grad.addColorStop(0,c2);    grad.addColorStop(1,c1); }
            ctx.fillStyle=grad;
            ctx.beginPath(); ctx.roundRect(b.x+1,b.y+1,b.w-2,b.h-2,3); ctx.fill();
            ctx.shadowBlur=0;
            if (dmg>0) {
                ctx.fillStyle=`rgba(0,0,0,${dmg*0.45})`;
                ctx.beginPath(); ctx.roundRect(b.x+1,b.y+1,b.w-2,b.h-2,3); ctx.fill();
            }
            if (b.maxHp>1) {
                for (let d=0; d<b.hp; d++) {
                    ctx.fillStyle='rgba(255,255,255,0.7)';
                    ctx.beginPath();
                    ctx.arc(b.x+b.w/2-(b.maxHp-1)*4+d*8, b.y+b.h-4, 2, 0, Math.PI*2);
                    ctx.fill();
                }
            }
            ctx.fillStyle='rgba(255,255,255,0.18)';
            ctx.fillRect(b.x+3,b.y+2,b.w-6,3);
        });

        // Falling powerup capsules
        breakoutPowerupDrops.forEach(d => {
            ctx.shadowColor = d.pu.color; ctx.shadowBlur = 10;
            ctx.fillStyle = d.pu.color + 'cc';
            ctx.beginPath(); ctx.roundRect(d.x-14, d.y-9, 28, 18, 9); ctx.fill();
            ctx.shadowBlur=0;
            ctx.fillStyle='#fff';
            ctx.font = d.pu.icon.length===1 ? 'bold 11px sans-serif' : '12px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(d.pu.icon, d.x, d.y);
            ctx.textBaseline='alphabetic';
        });

        // Lasers
        breakoutLasers.forEach(l => {
            ctx.shadowColor='#ff79a8'; ctx.shadowBlur=12;
            ctx.fillStyle='#ff79a8';
            ctx.fillRect(l.x-2, l.y, 4, 16);
            ctx.shadowBlur=0;
        });

        // Particles
        breakoutParticles.forEach(p => {
            ctx.globalAlpha = p.life/p.maxLife;
            ctx.fillStyle=p.color;
            ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(p.life/p.maxLife),0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1;

        // Ball trails + balls
        const isFireball = brkPU.fireballTimer>0;
        const isThrough  = brkPU.throughTimer>0;
        const isExplode  = brkPU.explodeTimer>0;
        breakoutBalls.forEach(ball => {
            if (!ball || ball.x===undefined) return;
            // Trail color
            const trailColor = isFireball?'#e17055': isThrough?'#00cec9': isExplode?'#fdcb6e':'#a8edff';
            ball.trail.forEach((pt,i) => {
                ctx.globalAlpha = (i/ball.trail.length)*0.35;
                ctx.fillStyle=trailColor;
                ctx.beginPath(); ctx.arc(pt.x,pt.y,BRK_BALL_R*0.7,0,Math.PI*2); ctx.fill();
            });
            ctx.globalAlpha=1;
            // Ball color based on active mode
            const ballColor = isFireball?['#fff','#e17055','#c0392b']:
                              isThrough ?['#fff','#00cec9','#006266']:
                              isExplode ?['#fff','#fdcb6e','#e17055']:
                                         ['#fff','#a8edff','#0099cc'];
            ctx.shadowColor=ballColor[1]; ctx.shadowBlur=18;
            const bg2 = ctx.createRadialGradient(ball.x-1.5,ball.y-1.5,1,ball.x,ball.y,BRK_BALL_R);
            bg2.addColorStop(0,ballColor[0]); bg2.addColorStop(0.5,ballColor[1]); bg2.addColorStop(1,ballColor[2]);
            ctx.fillStyle=bg2;
            ctx.beginPath(); ctx.arc(ball.x,ball.y,BRK_BALL_R,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0;
        });

        // Paddle
        if (!breakoutGameOver && pad && pad.x!==undefined) {
            const isLaser  = brkPU.laserTimer>0;
            const isSticky = brkPU.stickyTimer>0;
            const padC1 = isLaser?'#fd79a8': isSticky?'#a29bfe':'#c77dff';
            const padC2 = isLaser?'#d63031': isSticky?'#6c5ce7':'#7c5cfc';
            const padC3 = isLaser?'#6d1a2e': isSticky?'#341f97':'#480ca8';
            ctx.shadowColor=padC2; ctx.shadowBlur=14;
            const padGrad = ctx.createLinearGradient(pad.x,pad.y,pad.x+pad.w,pad.y+pad.h);
            padGrad.addColorStop(0,padC1); padGrad.addColorStop(0.5,padC2); padGrad.addColorStop(1,padC3);
            ctx.fillStyle=padGrad;
            ctx.beginPath(); ctx.roundRect(pad.x,pad.y,pad.w,pad.h,5); ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.25)';
            ctx.fillRect(pad.x+4,pad.y+2,pad.w-8,3);
            // Laser emitters
            if (isLaser) {
                ctx.fillStyle='#ff79a8';
                ctx.beginPath(); ctx.arc(pad.x+8,pad.y,4,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(pad.x+pad.w-8,pad.y,4,0,Math.PI*2); ctx.fill();
            }
            ctx.shadowBlur=0;
        }

        // Active powerup HUD (bottom-left row of icons with timers)
        const activePUs = [];
        if (brkPU.expandTimer>0)    activePUs.push({icon:'↔', color:'#2ed573', t:brkPU.expandTimer,    max:420});
        if (brkPU.shrinkTimer>0)    activePUs.push({icon:'↕', color:'#ff4757', t:brkPU.shrinkTimer,    max:300});
        if (brkPU.slowTimer>0)      activePUs.push({icon:'❄', color:'#74b9ff', t:brkPU.slowTimer,      max:360});
        if (brkPU.fastTimer>0)      activePUs.push({icon:'⚡',color:'#fd79a8', t:brkPU.fastTimer,      max:240});
        if (brkPU.stickyTimer>0)    activePUs.push({icon:'●', color:'#a29bfe', t:brkPU.stickyTimer,    max:480});
        if (brkPU.laserTimer>0)     activePUs.push({icon:'|', color:'#fd79a8', t:brkPU.laserTimer,     max:600});
        if (brkPU.fireballTimer>0)  activePUs.push({icon:'🔥',color:'#e17055', t:brkPU.fireballTimer,  max:360});
        if (brkPU.throughTimer>0)   activePUs.push({icon:'◉', color:'#00cec9', t:brkPU.throughTimer,   max:300});
        if (brkPU.explodeTimer>0)   activePUs.push({icon:'💥',color:'#fdcb6e', t:brkPU.explodeTimer,   max:360});
        activePUs.forEach((ap,i) => {
            const bx = 6 + i*28, by = H - 30;
            ctx.fillStyle='rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.roundRect(bx,by,22,22,5); ctx.fill();
            // timer arc
            ctx.strokeStyle=ap.color; ctx.lineWidth=2.5;
            ctx.beginPath();
            ctx.arc(bx+11,by+11,9,-Math.PI/2,-Math.PI/2+Math.PI*2*(ap.t/ap.max));
            ctx.stroke();
            ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillStyle='#fff'; ctx.fillText(ap.icon,bx+11,by+11);
            ctx.textBaseline='alphabetic';
        });

        // Combo display
        if (breakoutCombo>1 && breakoutGameRunning) {
            ctx.font=`bold ${12+Math.min(breakoutCombo,8)}px sans-serif`;
            ctx.fillStyle=`hsl(${50+breakoutCombo*10},100%,65%)`;
            ctx.textAlign='right';
            ctx.fillText(`${breakoutCombo}x COMBO!`,W-8,28);
        }

        // Idle overlay
        if (!breakoutGameRunning && !breakoutGameOver) {
            ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
            ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='bold 16px sans-serif';
            ctx.textAlign='center';
            ctx.fillText('Click PLAY to start',W/2,H/2-12);
            ctx.font='11px sans-serif'; ctx.fillStyle='rgba(255,255,255,0.45)';
            ctx.fillText('Move mouse  •  Click to launch / fire laser',W/2,H/2+10);
        }

        // Game-over overlay
        if (breakoutGameOver) {
            ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(0,0,W,H);
            ctx.fillStyle='#ff4757'; ctx.font='bold 22px sans-serif';
            ctx.textAlign='center';
            ctx.fillText('GAME OVER',W/2,H/2-32);
            ctx.fillStyle='#fff'; ctx.font='14px sans-serif';
            ctx.fillText(`Score: ${breakoutScore}`,W/2,H/2-4);
            ctx.fillText(`Level: ${breakoutLevel}  Lives: 0`,W/2,H/2+18);
            ctx.fillStyle='rgba(255,255,255,0.55)';
            ctx.fillText(`Best: ${breakoutHighScore}`,W/2,H/2+40);
        }
    }

    function updateBreakoutScoreboard() {
        const sc = document.getElementById('breakout-score');
        const hs = document.getElementById('breakout-hiscore');
        const lv = document.getElementById('breakout-level');
        const li = document.getElementById('breakout-lives');
        if (sc) sc.textContent = breakoutScore;
        if (hs) hs.textContent = breakoutHighScore;
        if (lv) lv.textContent = breakoutLevel;
        if (li) li.textContent = '❤️'.repeat(Math.max(0, breakoutLives));
    }

    function handleBreakoutMouseMove(e) {
        const rect = breakoutCanvas.getBoundingClientRect();
        breakoutMouseX = e.clientX - rect.left;
    }
    function handleBreakoutTouchMove(e) {
        e.preventDefault();
        const rect = breakoutCanvas.getBoundingClientRect();
        breakoutMouseX = e.touches[0].clientX - rect.left;
    }


    // ====================================
    // 8-BALL POOL GAME LOGIC
    // ====================================

    function poolGetPockets() {
        const x1 = POOL_CUSHION_X1, y1 = POOL_CUSHION_Y1;
        const x2 = POOL_CUSHION_X2, y2 = POOL_CUSHION_Y2;
        const mx = (x1 + x2) / 2;
        const cornerInset = 1; // Move corner pockets inward by set pixels
        const centerInset = 1;  // Move center pockets outwards by set pixels
        return [
            { x: x1 + cornerInset, y: y1 + cornerInset },       // top-left
            { x: mx, y: y1 - 2 - centerInset },                 // top-mid
            { x: x2 - cornerInset, y: y1 + cornerInset },       // top-right
            { x: x1 + cornerInset, y: y2 - cornerInset },       // bottom-left
            { x: mx, y: y2 + 2 + centerInset },                 // bottom-mid
            { x: x2 - cornerInset, y: y2 - cornerInset }        // bottom-right
        ];
    }

    function poolRackBalls() {
        const balls = [];
        const r = POOL_BALL_R;
        const cx = POOL_W * 0.72;
        const cy = POOL_H / 2;
        const spacing = r * 2.1;

        // Official 8-ball rack layout:
        // Row 0: 1 ball (apex — random solid or stripe)
        // Row 1: 2 balls (one solid, one stripe)
        // Row 2: 3 balls (center = 8-ball, corners = mixed)
        // Row 3: 4 balls (corners: one solid one stripe, rest random)
        // Row 4: 5 balls (corners: one solid one stripe, rest random)

        // Separate balls into groups
        let solids = [1, 2, 3, 4, 5, 6, 7];
        let stripes = [9, 10, 11, 12, 13, 14, 15];

        // Shuffle each group
        for (let i = solids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [solids[i], solids[j]] = [solids[j], solids[i]];
        }
        for (let i = stripes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [stripes[i], stripes[j]] = [stripes[j], stripes[i]];
        }

        // Build rack positions (triangle pointing left toward cue ball)
        const rackPositions = [];
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col <= row; col++) {
                const bx = cx + row * spacing * Math.cos(Math.PI / 6);
                const by = cy + (col - row / 2) * spacing;
                rackPositions.push({ row, col, x: bx, y: by });
            }
        }

        // Assign ball IDs to rack positions with official rules:
        const rackIds = new Array(15).fill(0);
        // Position 0 (apex): random
        // Position 4 (row 2, center): 8-ball
        // Corners of row 4 (positions 10 and 14): one solid, one stripe
        rackIds[4] = 8; // 8-ball in center of row 2

        // Corners of last row
        if (Math.random() < 0.5) {
            rackIds[10] = solids.pop();
            rackIds[14] = stripes.pop();
        } else {
            rackIds[10] = stripes.pop();
            rackIds[14] = solids.pop();
        }

        // Fill remaining positions
        let remaining = [...solids, ...stripes];
        for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }

        let ri = 0;
        for (let i = 0; i < 15; i++) {
            if (rackIds[i] === 0) {
                rackIds[i] = remaining[ri++];
            }
        }

        // Create cue ball
        const cueDef = POOL_BALL_DEFS[0];
        balls.push({
            id: 0, x: POOL_W * 0.25, y: POOL_H / 2,
            vx: 0, vy: 0, r: POOL_BALL_R,
            color: cueDef.color, stripe: false, num: 0, pocketed: false,
            rotation: 0, spinX: 0, spinY: 0
        });

        // Create racked balls
        for (let i = 0; i < 15; i++) {
            const def = POOL_BALL_DEFS[rackIds[i]];
            balls.push({
                id: def.id, x: rackPositions[i].x, y: rackPositions[i].y,
                vx: 0, vy: 0, r: POOL_BALL_R,
                color: def.color, stripe: def.stripe, num: def.num, pocketed: false,
                rotation: 0, spinX: 0, spinY: 0
            });
        }

        return balls;
    }

    function poolAllStopped() {
        for (const b of poolBalls) {
            if (b.pocketed) continue;
            if (Math.abs(b.vx) > POOL_MIN_VEL || Math.abs(b.vy) > POOL_MIN_VEL) return false;
        }
        return true;
    }

    function poolPhysicsUpdate() {
        // Sub-stepping prevents tunneling at high speeds.
        // At max power 18, each sub-step moves max 6px (= 1 ball radius).
        for (let step = 0; step < POOL_SUB_STEPS; step++) {
            const activeBalls = poolBalls.filter(b => !b.pocketed);

            // Move balls (fractional step)
            for (const b of activeBalls) {
                b.x += b.vx / POOL_SUB_STEPS;
                b.y += b.vy / POOL_SUB_STEPS;
            }

            // Ball-cushion collisions
            for (const b of activeBalls) {
                if (b.x - b.r < POOL_CUSHION_X1) {
                    b.x = POOL_CUSHION_X1 + b.r;
                    b.vx = Math.abs(b.vx) * POOL_RESTITUTION;
                    if (poolShotFired) poolCushionAfterHit = true;
                    // Cushion English: side spin alters rebound angle (LEFT wall)
                    if (b.id === 0 && b.spinSide) {
                        const sf = Math.min(Math.sqrt(b.vx*b.vx + b.vy*b.vy) * 0.12, 3);
                        b.vy += b.spinSide * sf;
                        b.vy += (-b.spinVert) * Math.sign(b.vy) * sf * 0.4;
                        b.spinSide *= 0.6; b.spinVert *= 0.5;
                    }
                }
                if (b.x + b.r > POOL_CUSHION_X2) {
                    b.x = POOL_CUSHION_X2 - b.r;
                    b.vx = -Math.abs(b.vx) * POOL_RESTITUTION;
                    if (poolShotFired) poolCushionAfterHit = true;
                    // Cushion English: RIGHT wall
                    if (b.id === 0 && b.spinSide) {
                        const sf = Math.min(Math.sqrt(b.vx*b.vx + b.vy*b.vy) * 0.12, 3);
                        b.vy -= b.spinSide * sf;
                        b.vy += (-b.spinVert) * Math.sign(b.vy) * sf * 0.4;
                        b.spinSide *= 0.6; b.spinVert *= 0.5;
                    }
                }
                if (b.y - b.r < POOL_CUSHION_Y1) {
                    b.y = POOL_CUSHION_Y1 + b.r;
                    b.vy = Math.abs(b.vy) * POOL_RESTITUTION;
                    if (poolShotFired) poolCushionAfterHit = true;
                    // Cushion English: TOP wall
                    if (b.id === 0 && b.spinSide) {
                        const sf = Math.min(Math.sqrt(b.vx*b.vx + b.vy*b.vy) * 0.12, 3);
                        b.vx += b.spinSide * sf;
                        b.vx += (-b.spinVert) * Math.sign(b.vx) * sf * 0.4;
                        b.spinSide *= 0.6; b.spinVert *= 0.5;
                    }
                }
                if (b.y + b.r > POOL_CUSHION_Y2) {
                    b.y = POOL_CUSHION_Y2 - b.r;
                    b.vy = -Math.abs(b.vy) * POOL_RESTITUTION;
                    if (poolShotFired) poolCushionAfterHit = true;
                    // Cushion English: BOTTOM wall
                    if (b.id === 0 && b.spinSide) {
                        const sf = Math.min(Math.sqrt(b.vx*b.vx + b.vy*b.vy) * 0.12, 3);
                        b.vx -= b.spinSide * sf;
                        b.vx += (-b.spinVert) * Math.sign(b.vx) * sf * 0.4;
                        b.spinSide *= 0.6; b.spinVert *= 0.5;
                    }
                }
            }

            // Ball-ball collisions
            for (let i = 0; i < activeBalls.length; i++) {
                for (let j = i + 1; j < activeBalls.length; j++) {
                    const a = activeBalls[i];
                    const bj = activeBalls[j];
                    const dx = bj.x - a.x;
                    const dy = bj.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = a.r + bj.r;

                    if (dist < minDist && dist > 0.001) {
                        // Track first ball hit by cue ball
                        if (poolShotFired && poolFirstBallHit === -1) {
                            if (a.id === 0) poolFirstBallHit = bj.id;
                            else if (bj.id === 0) poolFirstBallHit = a.id;
                        }

                        // Unit normal from a toward bj
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // Relative velocity along normal
                        const dvx = a.vx - bj.vx;
                        const dvy = a.vy - bj.vy;
                        const dvn = dvx * nx + dvy * ny;

                        // Don't resolve if separating
                        if (dvn <= 0) continue;

                        // Capture cue ball speed BEFORE elastic collision for spin calculation.
                        // On head-on shots the collision transfers ALL velocity to the object ball,
                        // leaving postSpeed ≈ 0 — which would kill follow/draw entirely.
                        // Pre-collision speed correctly scales spin with shot power.
                        let cueBallPreSpeed = 0;
                        if (a.id === 0) {
                            cueBallPreSpeed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
                        } else if (bj.id === 0) {
                            cueBallPreSpeed = Math.sqrt(bj.vx * bj.vx + bj.vy * bj.vy);
                        }

                        // Elastic impulse for equal mass: balls swap normal velocity components
                        a.vx -= dvn * nx;
                        a.vy -= dvn * ny;
                        bj.vx += dvn * nx;
                        bj.vy += dvn * ny;

                        // Separate overlapping balls (push apart along normal)
                        const overlap = minDist - dist;
                        a.x -= (overlap * 0.5) * nx;
                        a.y -= (overlap * 0.5) * ny;
                        bj.x += (overlap * 0.5) * nx;
                        bj.y += (overlap * 0.5) * ny;

                        // Apply cue ball spin (English) using PRE-collision speed.
                        // Real pool physics: spin is angular momentum stored on the ball.
                        // Follow (spinY=-1, top): cue ball continues forward after contact.
                        // Draw   (spinY=+1, bottom): cue ball reverses backward.
                        // Side   (spinX): cue ball deflects perpendicular to contact line.
                        // 60% applied instantly at collision, 40% stored as residual drift
                        // that gets applied gradually via cloth friction each frame.
                        if (a.id === 0 && a.spinX !== undefined && (a.spinX !== 0 || a.spinY !== 0)) {
                            const spinMag = Math.min(cueBallPreSpeed * 0.4, 10);
                            // Side spin: perpendicular to contact normal (0.5× follow strength)
                            a.vx += (-ny) * a.spinX * spinMag * 0.5;
                            a.vy += nx * a.spinX * spinMag * 0.5;
                            // Follow/draw: along contact normal (full strength)
                            a.vx -= nx * a.spinY * spinMag;
                            a.vy -= ny * a.spinY * spinMag;
                            // Store residual spin for gradual cloth-friction drift
                            a.spinDriftVx = ((-ny) * a.spinX * 0.2 - nx * a.spinY * 0.35) * cueBallPreSpeed;
                            a.spinDriftVy = (nx * a.spinX * 0.2 - ny * a.spinY * 0.35) * cueBallPreSpeed;
                            a.spinX = 0;
                            a.spinY = 0;
                        } else if (bj.id === 0 && bj.spinX !== undefined && (bj.spinX !== 0 || bj.spinY !== 0)) {
                            const spinMag = Math.min(cueBallPreSpeed * 0.4, 10);
                            bj.vx += ny * bj.spinX * spinMag * 0.5;
                            bj.vy += (-nx) * bj.spinX * spinMag * 0.5;
                            bj.vx += nx * bj.spinY * spinMag;
                            bj.vy += ny * bj.spinY * spinMag;
                            bj.spinDriftVx = (ny * bj.spinX * 0.2 + nx * bj.spinY * 0.35) * cueBallPreSpeed;
                            bj.spinDriftVy = ((-nx) * bj.spinX * 0.2 + ny * bj.spinY * 0.35) * cueBallPreSpeed;
                            bj.spinX = 0;
                            bj.spinY = 0;
                        }

                        // Throw: side spin deflects object ball perpendicular to contact line
                        if (a.id === 0 && a.spinSide) {
                            const tF = Math.min(cueBallPreSpeed * 0.015, 1.5);
                            bj.vx += (-ny) * (-a.spinSide) * tF;
                            bj.vy += nx * (-a.spinSide) * tF;
                            a.spinSide *= 0.5; a.spinVert *= 0.4;
                        } else if (bj.id === 0 && bj.spinSide) {
                            const tF = Math.min(cueBallPreSpeed * 0.015, 1.5);
                            a.vx += ny * (-bj.spinSide) * tF;
                            a.vy += (-nx) * (-bj.spinSide) * tF;
                            bj.spinSide *= 0.5; bj.spinVert *= 0.4;
                        }
                    }
                }
            }

            // Ball-pocket collisions
            for (const b of activeBalls) {
                if (b.pocketed) continue;
                for (const p of poolPockets) {
                    const dx = b.x - p.x;
                    const dy = b.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < POOL_POCKET_R) {
                        b.pocketed = true;
                        b.vx = 0;
                        b.vy = 0;
                        if (poolShotFired) {
                            poolPocketedThisShot.push(b.id);
                        }
                        break;
                    }
                }
            }
        }

        // Apply friction and rotation once per frame (after all sub-steps)
        const postBalls = poolBalls.filter(b => !b.pocketed);
        for (const b of postBalls) {
            // Apply residual spin drift from cloth friction (gradual follow/draw/english curve)
            // This makes the cue ball arc realistically after collision rather than
            // snapping instantly to its final trajectory.
            if (b.id === 0 && b.spinDriftVx !== undefined &&
                (b.spinDriftVx !== 0 || b.spinDriftVy !== 0)) {
                b.vx += b.spinDriftVx * 0.12;
                b.vy += b.spinDriftVy * 0.12;
                b.spinDriftVx *= 0.90;
                b.spinDriftVy *= 0.90;
                if (Math.abs(b.spinDriftVx) < 0.01 && Math.abs(b.spinDriftVy) < 0.01) {
                    b.spinDriftVx = 0;
                    b.spinDriftVy = 0;
                }
            }

            // Per-frame spin decay via cloth friction
            if (b.id === 0) {
                if (b.spinSide) { b.spinSide *= 0.998; if (Math.abs(b.spinSide) < 0.01) b.spinSide = 0; }
                if (b.spinVert) { b.spinVert *= 0.993; if (Math.abs(b.spinVert) < 0.01) b.spinVert = 0; }
            }

            b.vx *= POOL_FRICTION;
            b.vy *= POOL_FRICTION;

            const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            if (speed > POOL_MIN_VEL) {
                b.rotation += speed / b.r;
            }

            if (Math.abs(b.vx) < POOL_MIN_VEL) b.vx = 0;
            if (Math.abs(b.vy) < POOL_MIN_VEL) b.vy = 0;
        }
    }

    function poolProcessTurnResult() {
        // ── BCA Official 8-Ball Rules ─────────────────────────────────────────
        // Ref: BCA Rule 7 (Legal Shot), Rule 8 (Combination), Rule 9 (8-ball)
        //
        // TABLE OPEN: until first legal pocket after break — any ball may be
        //   struck first; potting the 8-ball on open table is a foul (loss).
        // AFTER GROUPS ASSIGNED, not on-the-8:
        //   Must strike own group ball first.
        //   Hitting 8-ball first = foul (ball in hand).
        //   Hitting opponent's ball first = foul (ball in hand).
        // ON THE 8 (all 7 group balls cleared):
        //   Must strike 8-ball first; scratch on the 8 = loss.
        //   Legally pocket 8-ball = win.
        //   Pocket 8-ball on a foul (including scratch) = loss.
        // ─────────────────────────────────────────────────────────────────────

        const cueBall  = poolBalls[0];
        const pocketed = poolPocketedThisShot;
        let foul = false;
        poolFoulMessage = '';

        const myPocketed = poolTurn === 1 ? poolPlayer1Pocketed : poolPlayer2Pocketed;
        const myGroup    = poolTurn === 1 ? poolPlayer1Group    : poolPlayer2Group;
        const tableOpen  = !poolFirstPocket;
        const onThe8     = !tableOpen && myPocketed.length >= 7;
        const opponent   = poolTurn === 1 ? 2 : 1;

        // Detect scratch via BOTH the ball flag AND the pocketed-this-shot array,
        // so a stale/reset flag can't bypass the loss path.
        const cueScratched   = cueBall.pocketed || pocketed.includes(0);
        const eightPocketed  = pocketed.includes(8);

        // ── 0. 8-BALL POCKETED → IMMEDIATE GAME END ──────────────────────────
        // Every scenario where the 8 leaves the table ends the game on this
        // shot. Decide win vs loss up front so nothing in the regular pocket
        // loop can override it.
        if (eightPocketed) {
            // Clean the flag so the post-game render doesn't show a missing cue ball
            if (cueBall.pocketed) cueBall.pocketed = false;

            // LOSS: scratched cue ball on the same shot — overrides everything else
            if (cueScratched) {
                poolFoulMessage = 'Scratch on 8-ball! You lose';
                poolWinner = opponent;
                endPoolGame();
                return;
            }
            // LOSS: 8 pocketed on the open table (no groups assigned yet)
            if (tableOpen) {
                poolFoulMessage = 'Pocketed 8-ball on open table! You lose';
                poolWinner = opponent;
                endPoolGame();
                return;
            }
            // LOSS: 8 pocketed before clearing your own group
            if (!onThe8) {
                poolFoulMessage = 'Pocketed 8-ball too early! You lose';
                poolWinner = opponent;
                endPoolGame();
                return;
            }
            // LOSS: didn't strike the 8 first on the 8-ball shot
            if (poolFirstBallHit !== 8) {
                poolFoulMessage = (poolFirstBallHit === -1)
                    ? 'No ball contacted on 8-ball shot! You lose'
                    : 'Foul on 8-ball shot! You lose';
                poolWinner = opponent;
                endPoolGame();
                return;
            }
            // WIN: all conditions met — legal 8-ball pot
            poolFoulMessage = '';
            poolWinner = poolTurn;
            endPoolGame();
            return;
        }

        // ── 1. SCRATCH (no 8-ball involved) ──────────────────────────────────
        if (cueScratched) {
            cueBall.pocketed = false;
            foul = true;
            poolFoulMessage = 'Scratch! Ball in hand';
        }

        // ── 2. NO BALL CONTACTED ─────────────────────────────────────────────
        if (!foul && poolFirstBallHit === -1) {
            foul = true;
            poolFoulMessage = 'Foul! No ball contacted';
        }

        // ── 3. WRONG FIRST BALL (BCA Rule 7 — groups must be assigned) ───────
        // NOTE: when table is open, any ball may be struck first (even 8-ball
        // used as a carom is legal per BCA; only pocketing it is illegal).
        if (!foul && !tableOpen && poolFirstBallHit !== -1) {
            const hitId     = poolFirstBallHit;
            const hitSolid  = hitId >= 1 && hitId <= 7;
            const hitStripe = hitId >= 9 && hitId <= 15;
            const hit8      = hitId === 8;

            if (onThe8) {
                // Must hit 8-ball first
                if (!hit8) {
                    foul = true;
                    poolFoulMessage = 'Foul! Must hit 8-ball first';
                }
            } else {
                // Must hit own group first — hitting 8-ball early = foul
                if (hit8) {
                    foul = true;
                    poolFoulMessage = 'Foul! Hit 8-ball before clearing your group';
                } else if (myGroup === 'solids' && hitStripe) {
                    foul = true;
                    poolFoulMessage = "Foul! Hit opponent's ball first";
                } else if (myGroup === 'stripes' && hitSolid) {
                    foul = true;
                    poolFoulMessage = "Foul! Hit opponent's ball first";
                }
            }
        }

        // ── 4. NO RAIL AFTER CONTACT ─────────────────────────────────────────
        // BCA Rule 7: must pocket a ball OR cause any ball to contact a rail.
        if (!foul && pocketed.length === 0 && poolFirstBallHit !== -1 && !poolCushionAfterHit) {
            foul = true;
            poolFoulMessage = 'Foul! No rail after contact';
        }

        // ── 5. PROCESS POCKETED BALLS ─────────────────────────────────────────
        // NOTE: The 8-ball case is handled in section 0 (early game-end). The
        // cue ball case is handled in section 1 (scratch). This loop only
        // credits group balls (1–7, 9–15) to their owners.
        let legalPocket  = false;
        let legalPotCount = 0;

        for (const bid of pocketed) {
            if (bid === 0 || bid === 8) continue; // cue & 8-ball handled above

            // ── Assign groups on first pocket (stays, even on foul) ───────────
            // Balls pocketed on a foul stay down; groups are assigned so the
            // off-table balls are always correctly attributed.
            if (!poolFirstPocket) {
                const isSolid = bid >= 1 && bid <= 7;
                poolFirstPocket = true;
                if (poolTurn === 1) {
                    poolPlayer1Group = isSolid ? 'solids' : 'stripes';
                    poolPlayer2Group = isSolid ? 'stripes' : 'solids';
                } else {
                    poolPlayer2Group = isSolid ? 'solids' : 'stripes';
                    poolPlayer1Group = isSolid ? 'stripes' : 'solids';
                }
            }

            // Credit the ball to the correct player using the definitive group map
            const p1IsSolids = poolPlayer1Group === 'solids';
            const ballIsSolid = bid >= 1 && bid <= 7;
            // isP1Ball: true if this ball belongs to player 1's group
            const isP1Ball = (p1IsSolids && ballIsSolid) || (!p1IsSolids && !ballIsSolid);

            if (isP1Ball) {
                if (!poolPlayer1Pocketed.includes(bid)) poolPlayer1Pocketed.push(bid);
                if (poolTurn === 1 && !foul) { legalPocket = true; legalPotCount++; }
            } else {
                if (!poolPlayer2Pocketed.includes(bid)) poolPlayer2Pocketed.push(bid);
                if (poolTurn === 2 && !foul) { legalPocket = true; legalPotCount++; }
            }
        }

        // ── 6. XP FOR LEGAL POTS ─────────────────────────────────────────────
        const isHumanTurn = poolTurn === 1 || poolMode === 'pvp';
        if (isHumanTurn && legalPotCount > 0 && xpSystemReady) {
            const xpGained = legalPotCount * 5;
            userXP.currentXP += xpGained;
            userXP.totalXP   += xpGained;
            checkLevelUp();
            saveUserXP(userXP);
            const label = legalPotCount === 1 ? '1 pot' : legalPotCount + ' pots';
            showXPNotification('🎱 +' + xpGained + ' XP (' + label + ')', 'game');
            updateXPDisplay();
        }

        // ── 7. TURN MANAGEMENT ────────────────────────────────────────────────
        if (foul) {
            // Opponent gets ball in hand
            poolTurn = poolTurn === 1 ? 2 : 1;
            poolBallInHand = true;
            poolPlacingBall = true;
            cueBall.x  = POOL_W * 0.25;
            cueBall.y  = POOL_H / 2;
            cueBall.vx = 0;
            cueBall.vy = 0;
        } else if (!legalPocket) {
            // No legal pot — change turns
            poolTurn = poolTurn === 1 ? 2 : 1;
        }
        // If legal pocket — same player continues

        // ── 8. RESET SHOT STATE ───────────────────────────────────────────────
        poolShotFired       = false;
        poolFirstBallHit    = -1;
        poolCushionAfterHit = false;
        poolPocketedThisShot = [];
        poolCueSpinX = 0;
        poolCueSpinY = 0;

        if (poolMode === 'cpu' && poolTurn === 2 && !poolGameOver) {
            poolAIDelay = 90 + Math.floor(Math.random() * 60); // 1.5–2.5 s
        }

        updatePoolScoreboard();
    }

    // ====================================
    // POOL AI
    // ====================================

    function poolAIPlaceBall() {
        const cueBall = poolBalls.find(b => b.id === 0);
        if (!cueBall) return;

        // Smart placement: place BEHIND/INLINE with target ball toward a pocket
        let targetGroup = poolPlayer2Group;
        let targets = poolBalls.filter(b => !b.pocketed && b.id !== 0 && b.id !== 8);
        if (targetGroup === 'solids') targets = targets.filter(b => b.id >= 1 && b.id <= 7);
        else if (targetGroup === 'stripes') targets = targets.filter(b => b.id >= 9 && b.id <= 15);
        if (targets.length === 0 && poolFirstPocket) {
            const eight = poolBalls.find(b => b.id === 8 && !b.pocketed);
            if (eight) targets = [eight];
        }
        if (targets.length === 0) targets = poolBalls.filter(b => !b.pocketed && b.id !== 0);

        let bestPos = { x: POOL_W * 0.25, y: POOL_H / 2 };
        let bestScore = -Infinity;

        // For each target-pocket combo, calculate ideal cue ball position
        // (inline behind the target, opposite side from pocket)
        for (const target of targets) {
            for (const pocket of poolPockets) {
                const tpx = pocket.x - target.x;
                const tpy = pocket.y - target.y;
                const tpDist = Math.sqrt(tpx * tpx + tpy * tpy);
                if (tpDist < 1) continue;

                // Ideal position: behind target, away from pocket, at various distances
                const dirX = -tpx / tpDist; // direction away from pocket
                const dirY = -tpy / tpDist;

                const distances = [POOL_BALL_R * 4, POOL_BALL_R * 6, POOL_BALL_R * 8, POOL_BALL_R * 10];
                for (const dist of distances) {
                    const posX = target.x + dirX * dist;
                    const posY = target.y + dirY * dist;

                    // Check bounds
                    if (posX < POOL_CUSHION_X1 + POOL_BALL_R + 2 || posX > POOL_CUSHION_X2 - POOL_BALL_R - 2 ||
                        posY < POOL_CUSHION_Y1 + POOL_BALL_R + 2 || posY > POOL_CUSHION_Y2 - POOL_BALL_R - 2) continue;

                    // Check overlap with other balls
                    let valid = true;
                    for (const b of poolBalls) {
                        if (b.pocketed || b.id === 0) continue;
                        if (Math.sqrt((posX - b.x) ** 2 + (posY - b.y) ** 2) < POOL_BALL_R * 2.5) {
                            valid = false; break;
                        }
                    }
                    if (!valid) continue;

                    // Check clear path from pos to target
                    const ctx2t_x = target.x - posX;
                    const ctx2t_y = target.y - posY;
                    const ctx2t_d = Math.sqrt(ctx2t_x * ctx2t_x + ctx2t_y * ctx2t_y);
                    let pathClear = true;
                    for (const other of poolBalls) {
                        if (other.pocketed || other.id === 0 || other.id === target.id) continue;
                        const proj = Math.max(0, Math.min(1,
                            ((other.x - posX) * ctx2t_x + (other.y - posY) * ctx2t_y) / (ctx2t_d * ctx2t_d)
                        ));
                        const cx = posX + proj * ctx2t_x;
                        const cy = posY + proj * ctx2t_y;
                        if (Math.sqrt((other.x - cx) ** 2 + (other.y - cy) ** 2) < POOL_BALL_R * 2.5) {
                            pathClear = false; break;
                        }
                    }

                    // Score this position
                    let score = 0;
                    if (pathClear) score += 100;
                    score -= tpDist * 0.1; // prefer targets close to pocket
                    score -= dist * 0.3;   // prefer closer placement to target
                    // Bonus for being directly inline (straight shot)
                    score += 20;

                    if (score > bestScore) {
                        bestScore = score;
                        bestPos = { x: posX, y: posY };
                    }
                }
            }
        }

        cueBall.x = bestPos.x;
        cueBall.y = bestPos.y;
        cueBall.vx = 0;
        cueBall.vy = 0;
        cueBall.pocketed = false;
        poolBallInHand = false;
        poolPlacingBall = false;
    }

    // ====================================================================
    // POOL AI — Trial Simulation
    // Runs a lightweight physics sim to verify if a shot will pot the
    // target ball. Returns { potted, finalDist } where finalDist is
    // how close the target got to the pocket center (lower = better).
    // ====================================================================
    function poolTrialSim(cueX, cueY, targetX, targetY, pocketX, pocketY, angle, power) {
        // Simulate just cue ball + target ball, check if target enters pocket
        let cx = cueX, cy = cueY;
        let cvx = Math.cos(angle) * power, cvy = Math.sin(angle) * power;
        let tx = targetX, ty = targetY;
        let tvx = 0, tvy = 0;
        let hit = false;
        const R2 = POOL_BALL_R * 2;
        const steps = 180; // enough frames for ball to reach pocket

        for (let i = 0; i < steps; i++) {
            // Sub-steps (same as real physics)
            for (let s = 0; s < POOL_SUB_STEPS; s++) {
                cx += cvx / POOL_SUB_STEPS;
                cy += cvy / POOL_SUB_STEPS;
                tx += tvx / POOL_SUB_STEPS;
                ty += tvy / POOL_SUB_STEPS;

                // Cushion bounce for target ball
                if (tx - POOL_BALL_R < POOL_CUSHION_X1) { tx = POOL_CUSHION_X1 + POOL_BALL_R; tvx = Math.abs(tvx) * POOL_RESTITUTION; }
                if (tx + POOL_BALL_R > POOL_CUSHION_X2) { tx = POOL_CUSHION_X2 - POOL_BALL_R; tvx = -Math.abs(tvx) * POOL_RESTITUTION; }
                if (ty - POOL_BALL_R < POOL_CUSHION_Y1) { ty = POOL_CUSHION_Y1 + POOL_BALL_R; tvy = Math.abs(tvy) * POOL_RESTITUTION; }
                if (ty + POOL_BALL_R > POOL_CUSHION_Y2) { ty = POOL_CUSHION_Y2 - POOL_BALL_R; tvy = -Math.abs(tvy) * POOL_RESTITUTION; }

                // Cushion bounce for cue ball
                if (cx - POOL_BALL_R < POOL_CUSHION_X1) { cx = POOL_CUSHION_X1 + POOL_BALL_R; cvx = Math.abs(cvx) * POOL_RESTITUTION; }
                if (cx + POOL_BALL_R > POOL_CUSHION_X2) { cx = POOL_CUSHION_X2 - POOL_BALL_R; cvx = -Math.abs(cvx) * POOL_RESTITUTION; }
                if (cy - POOL_BALL_R < POOL_CUSHION_Y1) { cy = POOL_CUSHION_Y1 + POOL_BALL_R; cvy = Math.abs(cvy) * POOL_RESTITUTION; }
                if (cy + POOL_BALL_R > POOL_CUSHION_Y2) { cy = POOL_CUSHION_Y2 - POOL_BALL_R; cvy = -Math.abs(cvy) * POOL_RESTITUTION; }

                // Ball-ball collision (elastic, equal mass)
                if (!hit) {
                    const dx = tx - cx, dy = ty - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < R2 && dist > 0.001) {
                        hit = true;
                        const nx = dx / dist, ny = dy / dist;
                        const dvx = cvx - tvx, dvy = cvy - tvy;
                        const dvn = dvx * nx + dvy * ny;
                        if (dvn > 0) {
                            cvx -= dvn * nx;
                            cvy -= dvn * ny;
                            tvx += dvn * nx;
                            tvy += dvn * ny;
                        }
                        // Separate overlap
                        const overlap = R2 - dist;
                        cx -= (overlap * 0.5) * nx;
                        cy -= (overlap * 0.5) * ny;
                        tx += (overlap * 0.5) * nx;
                        ty += (overlap * 0.5) * ny;
                    }
                }

                // Check if target entered pocket
                const pdx = tx - pocketX, pdy = ty - pocketY;
                if (Math.sqrt(pdx * pdx + pdy * pdy) < POOL_POCKET_R) {
                    return { potted: true, finalDist: 0 };
                }
            }

            // Friction
            cvx *= POOL_FRICTION; cvy *= POOL_FRICTION;
            tvx *= POOL_FRICTION; tvy *= POOL_FRICTION;
            if (Math.abs(cvx) < POOL_MIN_VEL) cvx = 0;
            if (Math.abs(cvy) < POOL_MIN_VEL) cvy = 0;
            if (Math.abs(tvx) < POOL_MIN_VEL) tvx = 0;
            if (Math.abs(tvy) < POOL_MIN_VEL) tvy = 0;

            // Early exit if both stopped
            if (cvx === 0 && cvy === 0 && tvx === 0 && tvy === 0) break;
        }

        // Not potted — return closest approach distance to pocket
        const fd = Math.sqrt((tx - pocketX) ** 2 + (ty - pocketY) ** 2);
        return { potted: false, finalDist: fd };
    }

    // Given a base angle, try micro-adjustments to find one that pots.
    // Returns the corrected angle or the original if none work.
    function poolAIRefineAngle(cueX, cueY, targetX, targetY, pocketX, pocketY, baseAngle, power) {
        // Try the base angle first
        const base = poolTrialSim(cueX, cueY, targetX, targetY, pocketX, pocketY, baseAngle, power);
        if (base.potted) return baseAngle;

        // Try progressively larger micro-adjustments
        const adjustments = [0.004, -0.004, 0.008, -0.008, 0.013, -0.013, 0.018, -0.018, 0.025, -0.025];
        let bestAngle = baseAngle;
        let bestDist = base.finalDist;

        for (const adj of adjustments) {
            const testAngle = baseAngle + adj;
            const result = poolTrialSim(cueX, cueY, targetX, targetY, pocketX, pocketY, testAngle, power);
            if (result.potted) return testAngle; // Found a working angle
            if (result.finalDist < bestDist) {
                bestDist = result.finalDist;
                bestAngle = testAngle;
            }
        }

        return bestAngle; // Return closest even if none pot
    }

    function poolAITakeShot(precomputeOnly = false) {
        const cueBall = poolBalls.find(b => b.id === 0 && !b.pocketed);
        if (!cueBall) return;

        // Find legal target balls
        let targetGroup = poolPlayer2Group;
        let targets = poolBalls.filter(b => !b.pocketed && b.id !== 0 && b.id !== 8);

        if (targetGroup === 'solids') {
            targets = targets.filter(b => b.id >= 1 && b.id <= 7);
        } else if (targetGroup === 'stripes') {
            targets = targets.filter(b => b.id >= 9 && b.id <= 15);
        }

        if (targets.length === 0 && poolFirstPocket) {
            const eightBall = poolBalls.find(b => b.id === 8 && !b.pocketed);
            if (eightBall) targets = [eightBall];
        }
        if (targets.length === 0) {
            targets = poolBalls.filter(b => !b.pocketed && b.id !== 0);
        }

        // ---- Helper: check if a straight line is clear of all balls except excludeIds ----
        function pathClear(x1, y1, x2, y2, excludeIds) {
            const dx = x2 - x1, dy = y2 - y1;
            const len2 = dx * dx + dy * dy;
            if (len2 < 1) return true;
            for (const b of poolBalls) {
                if (b.pocketed || excludeIds.includes(b.id)) continue;
                const proj = Math.max(0, Math.min(1,
                    ((b.x - x1) * dx + (b.y - y1) * dy) / len2
                ));
                const cx = x1 + proj * dx, cy = y1 + proj * dy;
                if (Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2) < POOL_BALL_R * 2.0) return false;
            }
            return true;
        }

        let bestShot = null;
        let bestScore = -Infinity;

        // ============================================================
        // PASS 1 — Direct shots (cue ball → ghost ball → pocket)
        // ============================================================
        let anyDirectClear = false;

        for (const target of targets) {
            for (const pocket of poolPockets) {
                const tpx = pocket.x - target.x, tpy = pocket.y - target.y;
                const tpDist = Math.sqrt(tpx * tpx + tpy * tpy);
                if (tpDist < 1) continue;

                const ghostX = target.x - (tpx / tpDist) * (POOL_BALL_R * 2);
                const ghostY = target.y - (tpy / tpDist) * (POOL_BALL_R * 2);

                const cax = ghostX - cueBall.x, cay = ghostY - cueBall.y;
                const caDist = Math.sqrt(cax * cax + cay * cay);
                if (caDist < 1) continue;

                const blocked   = !pathClear(cueBall.x, cueBall.y, ghostX, ghostY, [0, target.id]);
                const tpBlocked = !pathClear(target.x, target.y, pocket.x, pocket.y, [0, target.id]);

                if (!blocked) anyDirectClear = true;

                let score = 0;
                if (!blocked && !tpBlocked) score += 120;
                else if (!blocked)           score +=  35;
                else                         score -=  60;

                score -= caDist * 0.06;
                score -= tpDist * 0.15;

                const shotAngle   = Math.atan2(cay, cax);
                const pocketAngle = Math.atan2(tpy, tpx);
                let cutAngle = Math.abs(shotAngle - pocketAngle) % (2 * Math.PI);
                if (cutAngle > Math.PI) cutAngle = 2 * Math.PI - cutAngle;
                score -= cutAngle * 12;
                if (tpDist < 55) score += 30;
                if (tpDist < 30) score += 20;

                const deflectAngle = shotAngle + Math.PI / 2;
                const cueFinalX = ghostX + Math.cos(deflectAngle) * 40;
                const cueFinalY = ghostY + Math.sin(deflectAngle) * 40;
                const centerDist = Math.sqrt((cueFinalX - POOL_W / 2) ** 2 + (cueFinalY - POOL_H / 2) ** 2);
                score -= centerDist * 0.03;

                let spinX = 0, spinY = 0;
                if (!blocked && !tpBlocked) {
                    if (caDist > 80) {
                        spinX =  Math.cos(shotAngle) * 0.6;
                        spinY =  Math.sin(shotAngle) * 0.6;
                    } else {
                        spinX = -Math.cos(shotAngle) * 0.5;
                        spinY = -Math.sin(shotAngle) * 0.5;
                    }
                }

                // Power: account for friction loss over both legs (cue→ghost and target→pocket)
                // Slightly over-power to ensure ball reaches pocket center
                const rawPower = Math.min(POOL_CUE_MAX_POWER * 0.92,
                    Math.max(4.5, caDist * 0.065 + tpDist * 0.055 + 3.5));

                if (score > bestScore && !blocked && !tpBlocked) {
                    // Use trial simulation to refine the angle for verified potting
                    const refinedAngle = poolAIRefineAngle(
                        cueBall.x, cueBall.y, target.x, target.y,
                        pocket.x, pocket.y, shotAngle, rawPower
                    );
                    bestScore = score;
                    bestShot = { angle: refinedAngle, power: rawPower, spinX, spinY, type: 'direct' };
                } else if (score > bestScore) {
                    bestScore = score;
                    bestShot = { angle: shotAngle, power: rawPower, spinX, spinY, type: 'direct' };
                }
            }
        }

        // ============================================================
        // PASS 2 — Cushion (rail) shots to break snookers
        //   Uses the reflection principle: mirror cue ball across the
        //   cushion wall, then the straight line mirror→target gives
        //   the exact bounce point on the rail.
        // ============================================================
        const snookered = !anyDirectClear || bestScore < 20;

        if (snookered) {
            // 4 cushion walls  { axis, val, min, max }
            const walls = [
                { axis: 'y', val: POOL_CUSHION_Y1, min: POOL_CUSHION_X1 + POOL_BALL_R, max: POOL_CUSHION_X2 - POOL_BALL_R },
                { axis: 'y', val: POOL_CUSHION_Y2, min: POOL_CUSHION_X1 + POOL_BALL_R, max: POOL_CUSHION_X2 - POOL_BALL_R },
                { axis: 'x', val: POOL_CUSHION_X1, min: POOL_CUSHION_Y1 + POOL_BALL_R, max: POOL_CUSHION_Y2 - POOL_BALL_R },
                { axis: 'x', val: POOL_CUSHION_X2, min: POOL_CUSHION_Y1 + POOL_BALL_R, max: POOL_CUSHION_Y2 - POOL_BALL_R },
            ];

            for (const target of targets) {
                for (const wall of walls) {
                    // Mirror the cue ball position across the wall
                    let mirrorX = cueBall.x, mirrorY = cueBall.y;
                    if (wall.axis === 'y') mirrorY = 2 * wall.val - cueBall.y;
                    else                   mirrorX = 2 * wall.val - cueBall.x;

                    // Intersection of line (mirror → target) with the wall
                    let bounceX, bounceY, t;
                    if (wall.axis === 'y') {
                        const dy = target.y - mirrorY;
                        if (Math.abs(dy) < 0.1) continue;
                        t = (wall.val - mirrorY) / dy;
                        bounceX = mirrorX + t * (target.x - mirrorX);
                        bounceY = wall.val;
                        if (bounceX < wall.min || bounceX > wall.max) continue;
                    } else {
                        const dx = target.x - mirrorX;
                        if (Math.abs(dx) < 0.1) continue;
                        t = (wall.val - mirrorX) / dx;
                        bounceX = wall.val;
                        bounceY = mirrorY + t * (target.y - mirrorY);
                        if (bounceY < wall.min || bounceY > wall.max) continue;
                    }
                    // Bounce point must lie between cue and the wall
                    if (t <= 0 || t >= 1) continue;

                    // Cue ball must actually be on the right side of the wall
                    if (wall.axis === 'y') {
                        if (wall.val === POOL_CUSHION_Y1 && cueBall.y <= wall.val + POOL_BALL_R) continue;
                        if (wall.val === POOL_CUSHION_Y2 && cueBall.y >= wall.val - POOL_BALL_R) continue;
                    } else {
                        if (wall.val === POOL_CUSHION_X1 && cueBall.x <= wall.val + POOL_BALL_R) continue;
                        if (wall.val === POOL_CUSHION_X2 && cueBall.x >= wall.val - POOL_BALL_R) continue;
                    }

                    // Both legs must be clear
                    if (!pathClear(cueBall.x, cueBall.y, bounceX, bounceY, [0])) continue;
                    if (!pathClear(bounceX, bounceY, target.x, target.y, [0, target.id])) continue;

                    const dx1 = bounceX - cueBall.x, dy1 = bounceY - cueBall.y;
                    const leg1Dist = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                    const dx2 = target.x - bounceX, dy2 = target.y - bounceY;
                    const leg2Dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                    const totalDist = leg1Dist + leg2Dist;

                    const shotAngle = Math.atan2(dy1, dx1);

                    // Score: valid cushion break is better than a bad direct shot
                    let score = 65;
                    score -= totalDist * 0.07;
                    if (totalDist < 130) score += 15;
                    if (leg2Dist < 50)   score += 10; // close approach to target after bounce

                    // Side-spin to stabilise the bounce
                    const spinX = Math.cos(shotAngle) * 0.35;
                    const spinY = Math.sin(shotAngle) * 0.35;

                    const rawPower = Math.min(POOL_CUE_MAX_POWER * 0.92,
                        Math.max(4.0, totalDist * 0.065 + 3.5));

                    if (score > bestScore) {
                        bestScore = score;
                        bestShot = { angle: shotAngle, power: rawPower, spinX, spinY, type: 'cushion' };
                    }
                }
            }
        }

        // ============================================================
        // PASS 3 — Safety shot: graze target + send cue to a rail
        //   Used only when no direct or cushion shot scored well.
        //   Avoids hitting wrong ball — aims at legal target with a
        //   thin cut so cue ball rolls to a cushion afterwards.
        // ============================================================
        if (!bestShot || bestScore < -20) {
            for (const target of targets) {
                const dx = target.x - cueBall.x, dy = target.y - cueBall.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const direct = pathClear(cueBall.x, cueBall.y, target.x, target.y, [0, target.id]);
                // Try a thin graze (offset ±0.12 rad) so cue continues to a cushion
                for (const offset of [-0.12, 0, 0.12]) {
                    const angle = Math.atan2(dy, dx) + offset;
                    const score = (direct ? 5 : -30) - dist * 0.05;
                    if (score > bestScore) {
                        bestScore = score;
                        bestShot = {
                            angle,
                            power: Math.max(4.0, Math.min(POOL_CUE_MAX_POWER * 0.7, dist * 0.06 + 3.5)),
                            spinX: 0, spinY: 0, type: 'safety'
                        };
                    }
                }
            }
        }

        // Absolute fallback
        if (!bestShot) {
            const nearest = targets[0];
            if (nearest) {
                const dx = nearest.x - cueBall.x, dy = nearest.y - cueBall.y;
                bestShot = { angle: Math.atan2(dy, dx), power: POOL_CUE_MAX_POWER * 0.6, spinX: 0, spinY: 0, type: 'fallback' };
            } else {
                bestShot = { angle: Math.random() * Math.PI * 2, power: POOL_CUE_MAX_POWER * 0.5, spinX: 0, spinY: 0, type: 'fallback' };
            }
        }

        // Hard difficulty AI — simulation-verified shots get ZERO noise.
        // Only cushion/safety/fallback shots get slight imprecision.
        let angleNoise;
        if (bestShot.type === 'direct') {
            // Direct shots are already refined by trial simulation — no noise needed.
            angleNoise = 0;
        } else if (bestShot.type === 'cushion') {
            angleNoise = 0.012; // inherent bounce imprecision
        } else {
            angleNoise = 0.006; // safety/fallback
        }
        if (angleNoise > 0) bestShot.angle += (Math.random() - 0.5) * angleNoise;
        // Minimal power variation — hard CPU controls power precisely
        bestShot.power *= 0.995 + Math.random() * 0.01;
        bestShot.power  = Math.max(3.5, Math.min(POOL_CUE_MAX_POWER, bestShot.power));

        // Apply computed spin
        poolCueSpinX = bestShot.spinX || 0;
        poolCueSpinY = bestShot.spinY || 0;

        if (precomputeOnly) {
            // Store shot for visual display — fire later when poolAIDelay hits 0
            poolAIPendingShot = { angle: bestShot.angle, power: bestShot.power, spinX: poolCueSpinX, spinY: poolCueSpinY };
            poolCueAngle = bestShot.angle; // point cue at chosen angle for rendering
        } else {
            poolFireShot(cueBall, bestShot.angle, bestShot.power);
        }
    }

    function poolFireShot(cueBall, angle, power) {
        cueBall.vx = Math.cos(angle) * power;
        cueBall.vy = Math.sin(angle) * power;

        // Store spin on cue ball — applied AFTER hitting a target ball
        cueBall.spinX = poolCueSpinX;
        cueBall.spinY = poolCueSpinY;
        cueBall.spinSide = poolCueSpinX;   // persistent for cushion English
        cueBall.spinVert = poolCueSpinY;   // persistent for cushion angle
        cueBall.spinDriftVx = 0;
        cueBall.spinDriftVy = 0;

        poolShotFired = true;
        poolIsBreakShot = false;  // kitchen restriction lifts after first shot
        poolFirstBallHit = -1;
        poolCushionAfterHit = false;
        poolPocketedThisShot = [];
        poolAiming = false;
        poolDragging = false;
        poolAimLocked = false;
        poolLockedAngle = 0;
        poolShotTimer = POOL_SHOT_CLOCK;
        poolShotTimerFrame = 0;
    }

    // ====================================
    // POOL RENDERING
    // ====================================

    function poolGetTableColors() {
        const key = userPreferences.poolTableColor || 'green';
        return POOL_TABLE_COLORS[key] || POOL_TABLE_COLORS.green;
    }

    function drawPoolFrame() {
        if (!poolCtx) return;
        const ctx = poolCtx;
        const W = poolCanvas.width;
        const H = poolCanvas.height;
        const scaleX = W / POOL_W;
        const scaleY = H / POOL_CANVAS_H;

        ctx.save();
        ctx.scale(scaleX, scaleY);

        // Animated ambient background — palette shifts with table color
        poolBgTime += 0.008;
        const _tk = userPreferences.poolTableColor || 'green';
        // c0 = dark base, c1 = lighter accent (visibly different), g1/g2 = glow RGBA prefix
        const _bgPals = {
            green:     { c0:'#0a1a0e', c1:'#1c3d24', g1:'rgba(56,168,90,',  g2:'rgba(34,110,58,' },
            red:       { c0:'#1a080a', c1:'#3a1214', g1:'rgba(180,60,60,',   g2:'rgba(130,30,30,' },
            blue:      { c0:'#08101e', c1:'#122038', g1:'rgba(50,110,180,',  g2:'rgba(30,70,140,' },
            lightgrey: { c0:'#111820', c1:'#1e2e3e', g1:'rgba(160,180,200,', g2:'rgba(110,140,165,'},
        };
        const _bp = _bgPals[_tk] || _bgPals.green;
        const _s1 = (Math.sin(poolBgTime) + 1) * 0.5;           // 0→1 slow oscillator
        const _s2 = (Math.sin(poolBgTime * 0.71 + 1.4) + 1) * 0.5; // offset oscillator

        // --- Sweeping diagonal base gradient (oscillates left↔right) ---
        const _gx0 = POOL_W * (0.1 + _s1 * 0.35);
        const _gx1 = POOL_W * (0.55 + _s2 * 0.35);
        const _bgGrad = ctx.createLinearGradient(_gx0, 0, _gx1, POOL_CANVAS_H);
        _bgGrad.addColorStop(0,   _bp.c0);
        _bgGrad.addColorStop(0.5, _bp.c1);
        _bgGrad.addColorStop(1,   _bp.c0);
        ctx.fillStyle = _bgGrad;
        ctx.fillRect(0, 0, POOL_W, POOL_CANVAS_H);

        // --- Top margin: pulsing radial glow (centre, breathing in/out) ---
        const _tgA  = 0.55 + 0.25 * Math.sin(poolBgTime * 1.1);   // 0.30→0.80
        const _tgR  = POOL_TABLE_OFFSET_Y * (1.6 + 0.55 * _s1);   // radius breathes
        const _tcx  = POOL_W * (0.35 + 0.30 * _s2);               // centre drifts
        const _tcy  = POOL_TABLE_OFFSET_Y * 0.50;
        const _tGrad = ctx.createRadialGradient(_tcx, _tcy, 0, _tcx, _tcy, _tgR);
        _tGrad.addColorStop(0,   _bp.g1 + _tgA + ')');
        _tGrad.addColorStop(0.6, _bp.g1 + ((_tgA * 0.25).toFixed(3)) + ')');
        _tGrad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = _tGrad;
        ctx.fillRect(0, 0, POOL_W, POOL_TABLE_OFFSET_Y + 18);

        // --- Bottom margin: second pulsing radial glow (opposite phase) ---
        const _botCY = POOL_TABLE_OFFSET_Y + POOL_H + POOL_TABLE_OFFSET_Y * 0.50;
        const _bgA2  = 0.50 + 0.22 * Math.sin(poolBgTime * 0.85 + Math.PI); // opposite phase
        const _bgR2  = POOL_TABLE_OFFSET_Y * (1.5 + 0.50 * _s1);
        const _bcx   = POOL_W * (0.65 - 0.30 * _s2);              // drifts opposite to top
        const _bGrad = ctx.createRadialGradient(_bcx, _botCY, 0, _bcx, _botCY, _bgR2);
        _bGrad.addColorStop(0,   _bp.g2 + _bgA2 + ')');
        _bGrad.addColorStop(0.6, _bp.g2 + ((_bgA2 * 0.25).toFixed(3)) + ')');
        _bGrad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = _bGrad;
        ctx.fillRect(0, POOL_TABLE_OFFSET_Y + POOL_H - 14, POOL_W, POOL_TABLE_OFFSET_Y + 14);

        // --- Sweeping shimmer band (diagonal streak across margins) ---
        const _swOff = (poolBgTime * 72) % (POOL_W * 1.8) - 120;
        const _swGrad = ctx.createLinearGradient(_swOff, 0, _swOff + 120, POOL_CANVAS_H * 0.55);
        _swGrad.addColorStop(0,   'rgba(255,255,255,0)');
        _swGrad.addColorStop(0.45, _bp.g1 + '0.18)');
        _swGrad.addColorStop(0.55, _bp.g1 + '0.22)');
        _swGrad.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = _swGrad;
        // Paint shimmer only in top + bottom margins (not over the table area)
        ctx.fillRect(0, 0, POOL_W, POOL_TABLE_OFFSET_Y);
        ctx.fillRect(0, POOL_TABLE_OFFSET_Y + POOL_H, POOL_W, POOL_TABLE_OFFSET_Y);

        // ---- TABLE (translated to center vertically) ----
        ctx.save();
        ctx.translate(0, POOL_TABLE_OFFSET_Y);

        const colors = poolGetTableColors();

        // Draw outer wood border
        ctx.fillStyle = colors.border;
        ctx.fillRect(0, 0, POOL_W, POOL_H);

        // Draw felt
        const cx1 = POOL_CUSHION_X1 - 2;
        const cy1 = POOL_CUSHION_Y1 - 2;
        const cx2 = POOL_CUSHION_X2 + 2;
        const cy2 = POOL_CUSHION_Y2 + 2;
        ctx.fillStyle = colors.felt;
        ctx.fillRect(cx1, cy1, cx2 - cx1, cy2 - cy1);

        // Draw cushion rails
        ctx.fillStyle = colors.cushion;
        ctx.fillRect(cx1, 0, cx2 - cx1, POOL_CUSHION_Y1);
        ctx.fillRect(cx1, POOL_CUSHION_Y2, cx2 - cx1, POOL_H - POOL_CUSHION_Y2);
        ctx.fillRect(0, cy1, POOL_CUSHION_X1, cy2 - cy1);
        ctx.fillRect(POOL_CUSHION_X2, cy1, POOL_W - POOL_CUSHION_X2, cy2 - cy1);

        // Draw diamond markers on rails
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        const diamondSize = 2;
        for (let i = 1; i <= 6; i++) {
            const dx = POOL_CUSHION_X1 + (POOL_CUSHION_X2 - POOL_CUSHION_X1) * i / 7;
            ctx.beginPath();
            ctx.arc(dx, POOL_CUSHION_Y1 / 2, diamondSize, 0, Math.PI * 2);
            ctx.fill();
        }
        for (let i = 1; i <= 6; i++) {
            const dx = POOL_CUSHION_X1 + (POOL_CUSHION_X2 - POOL_CUSHION_X1) * i / 7;
            ctx.beginPath();
            ctx.arc(dx, POOL_CUSHION_Y2 + (POOL_H - POOL_CUSHION_Y2) / 2, diamondSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw pockets
        for (const p of poolPockets) {
            ctx.fillStyle = colors.pocket;
            ctx.beginPath();
            ctx.arc(p.x, p.y, POOL_POCKET_R, 0, Math.PI * 2);
            ctx.fill();
            const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, POOL_POCKET_R);
            pg.addColorStop(0, 'rgba(0,0,0,0.9)');
            pg.addColorStop(1, 'rgba(0,0,0,0.3)');
            ctx.fillStyle = pg;
            ctx.fill();
        }

        // Head string / baulk line
        if (poolIsBreakShot && poolPlacingBall) {
            ctx.fillStyle = 'rgba(255,255,160,0.10)';
            ctx.fillRect(POOL_CUSHION_X1, POOL_CUSHION_Y1,
                POOL_BAULK_X - POOL_CUSHION_X1, POOL_CUSHION_Y2 - POOL_CUSHION_Y1);
            ctx.strokeStyle = 'rgba(255,255,160,0.80)';
            ctx.lineWidth = 0.9;
            ctx.setLineDash([3, 2]);
            ctx.beginPath();
            ctx.moveTo(POOL_BAULK_X, POOL_CUSHION_Y1);
            ctx.lineTo(POOL_BAULK_X, POOL_CUSHION_Y2);
            ctx.stroke();
            ctx.setLineDash([]);
            const dCY = POOL_H / 2;
            const dR  = (POOL_CUSHION_Y2 - POOL_CUSHION_Y1) * 0.20;
            ctx.strokeStyle = 'rgba(255,255,160,0.45)';
            ctx.lineWidth = 0.7;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(POOL_BAULK_X, dCY, dR, Math.PI * 0.5, Math.PI * 1.5);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(POOL_BAULK_X, POOL_CUSHION_Y1);
            ctx.lineTo(POOL_BAULK_X, POOL_CUSHION_Y2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw balls
        for (const b of poolBalls) {
            if (b.pocketed) continue;
            poolDrawBall(ctx, b);
        }

        // Draw cue ball ghost when placing
        if (poolPlacingBall) {
            const gx = poolMouseX / scaleX;
            const gy = poolMouseY / scaleY - POOL_TABLE_OFFSET_Y;
            const inKitchen = !poolIsBreakShot || (gx <= POOL_BAULK_X - POOL_BALL_R);
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = inKitchen ? '#ffffff' : '#ff5555';
            ctx.beginPath();
            ctx.arc(gx, gy, POOL_BALL_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = inKitchen ? 'rgba(255,255,255,0.9)' : 'rgba(255,80,80,0.9)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(gx, gy, POOL_BALL_R, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Aiming line and cue stick (drawn in table-space)
        const cueBall = poolBalls.find(b => b.id === 0 && !b.pocketed);
        const isHumanTurn = poolTurn === 1 || poolMode === 'pvp';
        const isCPUAiming = poolMode === 'cpu' && poolTurn === 2 && poolAIPendingShot !== null && !poolPlacingBall;
        if (cueBall && poolAllStopped() && !poolGameOver && !poolPlacingBall) {
            if (isHumanTurn) {
                poolDrawCue(ctx, cueBall, scaleX, scaleY);
            } else if (isCPUAiming) {
                const savedLocked = poolAimLocked;
                const savedLockedAngle = poolLockedAngle;
                poolAimLocked = true;
                poolLockedAngle = poolAIPendingShot.angle;
                poolDrawCue(ctx, cueBall, scaleX, scaleY);
                poolAimLocked = savedLocked;
                poolLockedAngle = savedLockedAngle;
            }
        }

        // Foul message (over table)
        if (poolFoulMessage) {
            ctx.fillStyle = 'rgba(220, 50, 50, 0.85)';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(poolFoulMessage, POOL_W / 2, POOL_H / 2 - 4);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '8px Inter, sans-serif';
            ctx.fillText('Ball in hand for opponent', POOL_W / 2, POOL_H / 2 + 10);
        }

        ctx.restore(); // end table translate

        // ---- HUD in top & bottom margins ----
        poolDrawHUD(ctx);

        // Spin indicator in bottom margin
        if (cueBall && !cueBall.pocketed && poolAllStopped() && !poolGameOver && isHumanTurn && !poolPlacingBall) {
            poolDrawSpinIndicator(ctx);
        }

        // Game over overlay (full canvas)
        if (poolGameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, POOL_W, POOL_CANVAS_H);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'center';
            const winnerName = poolWinner === 1 ? 'Player 1' : (poolMode === 'cpu' ? 'CPU' : 'Player 2');
            ctx.fillText(`${winnerName} Wins!`, POOL_W / 2, POOL_CANVAS_H / 2 - 10);
            ctx.font = '10px Inter, sans-serif';
            ctx.fillText('Click Reset to play again', POOL_W / 2, POOL_CANVAS_H / 2 + 14);
        }

        ctx.restore();
    }

    function poolDrawBall(ctx, ball) {
        const x = ball.x, y = ball.y, r = ball.r;
        // Calculate rolling offset — the label/stripe orbits around the ball center
        // This simulates the label appearing to roll toward movement direction
        const rollAngle = ball.rotation || 0;
        // Offset for the number circle "orbiting" the surface
        const orbitR = r * 0.25; // how far the label can shift from center
        const labelOffX = Math.sin(rollAngle) * orbitR;
        const labelOffY = -Math.cos(rollAngle) * orbitR;
        // Visibility factor — label fades as it "rotates" to the back
        const labelVis = Math.max(0, Math.cos(rollAngle));

        // Ball body
        if (ball.stripe) {
            // Stripe ball: white base with colored band
            ctx.fillStyle = '#f5f5f5';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();

            // Colored stripe band — rolls with the ball
            ctx.save();
            ctx.translate(x, y);
            // Rotate the stripe clipping area to simulate rolling
            ctx.rotate(rollAngle * 0.3); // slower visual rotation for stripe
            ctx.beginPath();
            ctx.rect(-r, -r * 0.45, r * 2, r * 0.9);
            ctx.clip();
            ctx.fillStyle = ball.color;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            // Solid ball or cue ball
            ctx.fillStyle = ball.color;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Number circle (not for cue ball) — orbits to simulate 3D rolling
        if (ball.num > 0 && labelVis > 0.1) {
            const lx = x + labelOffX;
            const ly = y + labelOffY;
            // Scale shrinks as label "rotates" away
            const scale = 0.7 + labelVis * 0.3;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.scale(scale, scale);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.font = `bold ${Math.round(r * 0.65)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ball.num.toString(), 0, 0.5);
            ctx.restore();
        }

        // 3D highlight
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.4)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Ball outline
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    function poolDrawCue(ctx, cueBall, scaleX, scaleY) {
        // When aim is locked (mouse held), use the frozen angle.
        // During free aim, compute from current mouse position with smoothing.
        let angle;
        if (poolAimLocked) {
            angle = poolLockedAngle;
        } else {
            const mx = poolMouseX / scaleX;
            const my = poolMouseY / scaleY - POOL_TABLE_OFFSET_Y;
            const targetAngle = Math.atan2(my - cueBall.y, mx - cueBall.x);
            // Smooth angular interpolation to prevent pixel-skipping jitter.
            // Lerp factor 0.35 = responsive but silky smooth.
            let delta = targetAngle - poolCueAngle;
            // Normalize delta to [-PI, PI] to avoid wrapping jumps
            while (delta > Math.PI) delta -= 2 * Math.PI;
            while (delta < -Math.PI) delta += 2 * Math.PI;
            poolCueAngle += delta * 0.35;
            angle = poolCueAngle;
        }

        // Aiming line (dotted)
        // --- Determine if the aimed ball is illegal for the current player ---
        // (mirrors poolProcessTurnResult foul checks)
        // Cast ahead to find hitBall first, then choose guide colours.

        // Cast line from cue ball in shot direction until hitting something
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        let lineLen = 200;
        let hitBall = null;
        let hitDist = Infinity;

        // Find first collision along the line using proper ray-circle intersection
        // The ghost ball (cue ball) touches the target when center-to-center = 2*R
        for (const b of poolBalls) {
            if (b.pocketed || b.id === 0) continue;
            const dx = b.x - cueBall.x;
            const dy = b.y - cueBall.y;
            const proj = dx * dirX + dy * dirY;
            if (proj <= 0) continue;
            // Perpendicular distance from ball center to the aim line
            const perpDist = Math.abs(-dx * dirY + dy * dirX);
            const combinedR = POOL_BALL_R * 2; // sum of radii
            if (perpDist < combinedR) {
                // Ray-circle intersection: find exact contact distance
                // d = proj - sqrt(combinedR^2 - perpDist^2)
                const halfChord = Math.sqrt(combinedR * combinedR - perpDist * perpDist);
                const contactDist = proj - halfChord;
                if (contactDist > 0 && contactDist < hitDist) {
                    hitDist = contactDist;
                    hitBall = b;
                }
                lineLen = Math.min(lineLen, contactDist > 0 ? contactDist : 0);
            }
        }

        // Check cushion intersections
        if (dirX > 0) lineLen = Math.min(lineLen, (POOL_CUSHION_X2 - cueBall.x) / dirX);
        else if (dirX < 0) lineLen = Math.min(lineLen, (POOL_CUSHION_X1 - cueBall.x) / dirX);
        if (dirY > 0) lineLen = Math.min(lineLen, (POOL_CUSHION_Y2 - cueBall.y) / dirY);
        else if (dirY < 0) lineLen = Math.min(lineLen, (POOL_CUSHION_Y1 - cueBall.y) / dirY);

        lineLen = Math.max(0, lineLen);

        // --- Illegal ball check ---
        let aimIllegal = false;
        if (hitBall) {
            const curGroup = poolTurn === 1 ? poolPlayer1Group : poolPlayer2Group;
            const tableOpen = !poolFirstPocket;
            const myPocketed = poolTurn === 1 ? poolPlayer1Pocketed : poolPlayer2Pocketed;
            const onThe8 = !tableOpen && myPocketed.length >= 7;

            if (!tableOpen) {
                const hid = hitBall.id;
                const isSolid  = hid >= 1 && hid <= 7;
                const isStripe = hid >= 9 && hid <= 15;
                const is8      = hid === 8;

                if (onThe8) {
                    if (!is8) aimIllegal = true; // must hit 8-ball
                } else {
                    if (is8) aimIllegal = true; // can't hit 8 early
                    else if (curGroup === 'solids' && isStripe) aimIllegal = true;
                    else if (curGroup === 'stripes' && isSolid) aimIllegal = true;
                }
            }
        }

        // --- Draw the aim line (white = legal, red = illegal) ---
        ctx.strokeStyle = aimIllegal ? 'rgba(255,60,60,0.85)' : 'rgba(255,255,255,0.82)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();

        ctx.moveTo(cueBall.x, cueBall.y);
        ctx.lineTo(cueBall.x + dirX * lineLen, cueBall.y + dirY * lineLen);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw ghost ball contact guide at point of impact
        if (hitBall) {
            const ghostX = cueBall.x + dirX * hitDist;
            const ghostY = cueBall.y + dirY * hitDist;

            if (aimIllegal) {
                // ===== PROHIBITION SIGN (NOT ALLOWED) =====
                const prohibR = POOL_BALL_R;

                // Red circle
                ctx.strokeStyle = 'rgba(255,50,50,0.92)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(ghostX, ghostY, prohibR, 0, Math.PI * 2);
                ctx.stroke();

                // Translucent red fill
                ctx.fillStyle = 'rgba(255,40,40,0.18)';
                ctx.beginPath();
                ctx.arc(ghostX, ghostY, prohibR, 0, Math.PI * 2);
                ctx.fill();

                // Diagonal slash (top-left to bottom-right, rotated 45 degrees)
                ctx.strokeStyle = 'rgba(255,50,50,0.92)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const slashAngle = Math.PI / 4; // 45 degrees
                ctx.moveTo(ghostX - Math.cos(slashAngle) * prohibR, ghostY - Math.sin(slashAngle) * prohibR);
                ctx.lineTo(ghostX + Math.cos(slashAngle) * prohibR, ghostY + Math.sin(slashAngle) * prohibR);
                ctx.stroke();

            } else {
                // ===== NORMAL GHOST BALL & TRAJECTORY GUIDES =====

                // Ghost ball outline (where cue ball will be at contact)
                ctx.strokeStyle = 'rgba(255,255,255,0.92)';
                ctx.lineWidth = 1.8;
                ctx.setLineDash([3, 2]);
                ctx.beginPath();
                ctx.arc(ghostX, ghostY, POOL_BALL_R, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Fill ghost ball with subtle transparency
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.beginPath();
                ctx.arc(ghostX, ghostY, POOL_BALL_R, 0, Math.PI * 2);
                ctx.fill();

                // Compute accurate target ball direction using contact physics
                // The impulse is along the line connecting ghost center to target center
                const contactNX = (hitBall.x - ghostX);
                const contactNY = (hitBall.y - ghostY);
                const contactLen = Math.sqrt(contactNX * contactNX + contactNY * contactNY);
                if (contactLen > 0) {
                    const nx = contactNX / contactLen;
                    const ny = contactNY / contactLen;
                    // Target ball receives velocity along contact normal
                    // v_target = (v_cue . n) * n (for equal mass elastic collision)
                    const cueDotN = dirX * nx + dirY * ny;

                    // Only draw if a meaningful hit
                    if (cueDotN > 0.1) {
                        const targetDirX = nx;
                        const targetDirY = ny;
                        const projLen = 30 * cueDotN; // length proportional to how direct the hit is

                        ctx.strokeStyle = 'rgba(255,220,0,0.95)';
                        ctx.lineWidth = 1.8;
                        ctx.setLineDash([4, 3]);
                        ctx.beginPath();
                        ctx.moveTo(hitBall.x, hitBall.y);
                        ctx.lineTo(hitBall.x + targetDirX * projLen, hitBall.y + targetDirY * projLen);
                        ctx.stroke();
                        ctx.setLineDash([]);

                        // Arrow head dot
                        const arrowX = hitBall.x + targetDirX * projLen;
                        const arrowY = hitBall.y + targetDirY * projLen;
                        ctx.fillStyle = 'rgba(255,220,0,0.95)';
                        ctx.beginPath();
                        ctx.arc(arrowX, arrowY, 2.5, 0, Math.PI * 2);
                        ctx.fill();

                        // Also show cue ball deflection path
                        // v_cue_after = v_cue - (v_cue . n) * n
                        const cueAfterX = dirX - cueDotN * nx;
                        const cueAfterY = dirY - cueDotN * ny;
                        const cueAfterLen = Math.sqrt(cueAfterX * cueAfterX + cueAfterY * cueAfterY);
                        if (cueAfterLen > 0.15) {
                            const cueDeflX = cueAfterX / cueAfterLen;
                            const cueDeflY = cueAfterY / cueAfterLen;
                            ctx.strokeStyle = 'rgba(180,220,255,0.75)';
                            ctx.lineWidth = 1.4;
                            ctx.setLineDash([3, 3]);
                            ctx.beginPath();
                            ctx.moveTo(ghostX, ghostY);
                            ctx.lineTo(ghostX + cueDeflX * 28, ghostY + cueDeflY * 28);
                            ctx.stroke();
                            ctx.setLineDash([]);
                        }
                    }
                }
            }
        }

        // Draw cue stick
        const pullBack = poolDragging ? poolCuePower * 2 : 0;
        const cueStart = POOL_BALL_R + 2 + pullBack;
        const cueLen = 100;

        // Cue stick colors
        const cueEndX = cueBall.x - Math.cos(angle) * (cueStart + cueLen);
        const cueEndY = cueBall.y - Math.sin(angle) * (cueStart + cueLen);
        const cueStartX = cueBall.x - Math.cos(angle) * cueStart;
        const cueStartY = cueBall.y - Math.sin(angle) * cueStart;

        // Cue tip (white ferrule)
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cueStartX, cueStartY);
        const ferruleX = cueBall.x - Math.cos(angle) * (cueStart + 4);
        const ferruleY = cueBall.y - Math.sin(angle) * (cueStart + 4);
        ctx.lineTo(ferruleX, ferruleY);
        ctx.stroke();

        // Cue shaft (wood)
        ctx.strokeStyle = '#d4a76a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ferruleX, ferruleY);
        const midX = cueBall.x - Math.cos(angle) * (cueStart + cueLen * 0.5);
        const midY = cueBall.y - Math.sin(angle) * (cueStart + cueLen * 0.5);
        ctx.lineTo(midX, midY);
        ctx.stroke();

        // Cue butt (darker)
        ctx.strokeStyle = '#8b5e3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(cueEndX, cueEndY);
        ctx.stroke();

        // Power indicator
        if (poolDragging) {
            const powerPct = poolCuePower / POOL_CUE_MAX_POWER;
            ctx.fillStyle = `rgba(${Math.round(255 * powerPct)}, ${Math.round(255 * (1 - powerPct))}, 0, 0.7)`;
            ctx.fillRect(POOL_W - 14, POOL_CUSHION_Y1 + 2, 6, (POOL_CUSHION_Y2 - POOL_CUSHION_Y1 - 4));
            ctx.fillStyle = `rgb(${Math.round(255 * powerPct)}, ${Math.round(255 * (1 - powerPct))}, 0)`;
            const barH = (POOL_CUSHION_Y2 - POOL_CUSHION_Y1 - 4) * powerPct;
            ctx.fillRect(POOL_W - 14, POOL_CUSHION_Y2 - 2 - barH, 6, barH);
        }
    }

    function poolDrawSpinIndicator(ctx) {
        // Spin indicator centered in bottom margin
        const indicatorR = 14;
        const ix = POOL_W / 2;
        const iy = POOL_TABLE_OFFSET_Y + POOL_H + 46;

        // Background circle
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(ix, iy, indicatorR + 3, 0, Math.PI * 2);
        ctx.fill();

        // White ball
        ctx.fillStyle = '#ddd';
        ctx.beginPath();
        ctx.arc(ix, iy, indicatorR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Crosshairs
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(ix - indicatorR, iy);
        ctx.lineTo(ix + indicatorR, iy);
        ctx.moveTo(ix, iy - indicatorR);
        ctx.lineTo(ix, iy + indicatorR);
        ctx.stroke();

        // Spin dot (red)
        const dotX = ix + poolCueSpinX * indicatorR * 0.7;
        const dotY = iy + poolCueSpinY * indicatorR * 0.7;
        ctx.fillStyle = '#e33';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '7px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SPIN', ix, iy + indicatorR + 11);
    }

    function poolDrawHUD(ctx) {
        const p1Name = 'Player 1';
        const p2Name = poolMode === 'cpu' ? 'CPU' : 'Player 2';
        const p1Group = poolPlayer1Group;
        const p2Group = poolPlayer2Group;

        const p1Active = poolTurn === 1;
        const p2Active = poolTurn === 2;

        // Shot clock
        const showTimer = poolGameRunning && !poolGameOver && poolAllStopped() && !poolShotFired && !poolPlacingBall;
        const timerPct = poolShotTimer / POOL_SHOT_CLOCK;
        let timerBarColor;
        if (timerPct > 0.5) timerBarColor = 'rgba(80,220,100,0.85)';
        else if (timerPct > 0.25) timerBarColor = 'rgba(255,180,40,0.85)';
        else timerBarColor = 'rgba(255,70,50,0.85)';

        // ---- TOP HUD AREA (y: 0 .. POOL_TABLE_OFFSET_Y) ----
        const badgeW = 140;
        const badgeH = 26;
        const badgeY = 20;

        // Player 1 badge
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(14, badgeY, badgeW, badgeH, 5);
        ctx.fill();
        if (p1Active && showTimer) {
            ctx.fillStyle = timerBarColor;
            ctx.beginPath();
            ctx.roundRect(14, badgeY, badgeW * timerPct, badgeH, 5);
            ctx.fill();
            if (timerPct < 0.25) {
                ctx.shadowColor = '#ff3333';
                ctx.shadowBlur = 6;
                ctx.fillStyle = timerBarColor;
                ctx.beginPath();
                ctx.roundRect(14, badgeY, badgeW * timerPct, badgeH, 5);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        } else if (p1Active) {
            ctx.fillStyle = 'rgba(80,200,120,0.30)';
            ctx.beginPath();
            ctx.roundRect(14, badgeY, badgeW, badgeH, 5);
            ctx.fill();
        }

        // Player 2 badge
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(POOL_W - 14 - badgeW, badgeY, badgeW, badgeH, 5);
        ctx.fill();
        if (p2Active && showTimer) {
            const barW = badgeW * timerPct;
            ctx.fillStyle = timerBarColor;
            ctx.beginPath();
            ctx.roundRect(POOL_W - 14 - badgeW + (badgeW - barW), badgeY, barW, badgeH, 5);
            ctx.fill();
            if (timerPct < 0.25) {
                ctx.shadowColor = '#ff3333';
                ctx.shadowBlur = 6;
                ctx.fillStyle = timerBarColor;
                ctx.beginPath();
                ctx.roundRect(POOL_W - 14 - badgeW + (badgeW - barW), badgeY, barW, badgeH, 5);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        } else if (p2Active) {
            ctx.fillStyle = 'rgba(80,200,120,0.30)';
            ctx.beginPath();
            ctx.roundRect(POOL_W - 14 - badgeW, badgeY, badgeW, badgeH, 5);
            ctx.fill();
        }

        // Active badge border
        if (p1Active) {
            ctx.strokeStyle = 'rgba(120,255,150,0.5)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.roundRect(14, badgeY, badgeW, badgeH, 5);
            ctx.stroke();
        }
        if (p2Active) {
            ctx.strokeStyle = 'rgba(120,255,150,0.5)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.roundRect(POOL_W - 14 - badgeW, badgeY, badgeW, badgeH, 5);
            ctx.stroke();
        }

        // Player names
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(p1Name, 22, badgeY + 17);
        ctx.textAlign = 'right';
        ctx.fillText(p2Name, POOL_W - 22, badgeY + 17);

        // W/L record labels inside badges
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.60)';
        const p1WL = `${poolRecord.p1Wins}W ${poolRecord.p1Losses}L`;
        const p2WL = `${poolRecord.p2Wins}W ${poolRecord.p2Losses}L`;
        ctx.textAlign = 'right';
        ctx.fillText(p1WL, 14 + badgeW - 6, badgeY + 10);
        ctx.textAlign = 'left';
        ctx.fillText(p2WL, POOL_W - 14 - badgeW + 6, badgeY + 10);

        // Group indicators below badges
        if (p1Group) {
            const groupY = badgeY + badgeH + 14;
            ctx.font = 'bold 8px Inter, sans-serif';

            ctx.textAlign = 'left';
            const p1IsSolids = p1Group === 'solids';
            ctx.fillStyle = p1IsSolids ? '#f0c830' : '#74b9ff';
            ctx.beginPath();
            ctx.arc(22, groupY - 3, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillText(p1IsSolids ? 'Solids' : 'Stripes', 30, groupY);

            ctx.textAlign = 'right';
            const p2IsSolids = p2Group === 'solids';
            ctx.fillStyle = p2IsSolids ? '#f0c830' : '#74b9ff';
            ctx.beginPath();
            ctx.arc(POOL_W - 22, groupY - 3, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillText(p2IsSolids ? 'Solids' : 'Stripes', POOL_W - 30, groupY);
        }

        // ---- BOTTOM HUD AREA (y: POOL_TABLE_OFFSET_Y + POOL_H .. POOL_CANVAS_H) ----
        const bottomStart = POOL_TABLE_OFFSET_Y + POOL_H;
        const trayLabelY = bottomStart + 20;
        const trayBallY = bottomStart + 38;
        const ballR = 5.5;

        // Player 1 pocketed
        if (poolPlayer1Pocketed.length > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.40)';
            ctx.font = 'bold 7px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('P1 Pocketed', 14, trayLabelY);
        }
        for (let i = 0; i < poolPlayer1Pocketed.length; i++) {
            const def = POOL_BALL_DEFS[poolPlayer1Pocketed[i]];
            const bx = 14 + i * (ballR * 2 + 3);
            if (def.stripe) {
                ctx.fillStyle = '#f5f5f5';
                ctx.beginPath();
                ctx.arc(bx, trayBallY, ballR, 0, Math.PI * 2);
                ctx.fill();
                ctx.save();
                ctx.beginPath();
                ctx.rect(bx - ballR, trayBallY - 2, ballR * 2, 4);
                ctx.clip();
                ctx.fillStyle = def.color;
                ctx.beginPath();
                ctx.arc(bx, trayBallY, ballR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.fillStyle = def.color;
                ctx.beginPath();
                ctx.arc(bx, trayBallY, ballR, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 5px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.num.toString(), bx, trayBallY + 0.3);
        }

        // Player 2 pocketed
        if (poolPlayer2Pocketed.length > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.40)';
            ctx.font = 'bold 7px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('P2 Pocketed', POOL_W - 14, trayLabelY);
        }
        for (let i = 0; i < poolPlayer2Pocketed.length; i++) {
            const def = POOL_BALL_DEFS[poolPlayer2Pocketed[i]];
            const bx = POOL_W - 14 - i * (ballR * 2 + 3);
            if (def.stripe) {
                ctx.fillStyle = '#f5f5f5';
                ctx.beginPath();
                ctx.arc(bx, trayBallY, ballR, 0, Math.PI * 2);
                ctx.fill();
                ctx.save();
                ctx.beginPath();
                ctx.rect(bx - ballR, trayBallY - 2, ballR * 2, 4);
                ctx.clip();
                ctx.fillStyle = def.color;
                ctx.beginPath();
                ctx.arc(bx, trayBallY, ballR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.fillStyle = def.color;
                ctx.beginPath();
                ctx.arc(bx, trayBallY, ballR, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 5px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.num.toString(), bx, trayBallY + 0.3);
        }
        ctx.textBaseline = 'alphabetic';
    }

    // POOL INPUT HANDLERS

    function handlePoolMouseDown(e) {
        if (!poolGameRunning || poolGameOver) return;
        if (currentGame !== 'pool') return;
        const rect = poolCanvas.getBoundingClientRect();

        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        poolMouseX = canvasX;
        poolMouseY = canvasY;

        const canvasGameX = canvasX / (rect.width / POOL_W);
        const canvasGameY = canvasY / (rect.height / POOL_CANVAS_H);
        const gameX = canvasGameX;
        const gameY = canvasGameY - POOL_TABLE_OFFSET_Y;

        // Check spin indicator click (bottom-center margin)
        const spinIX = POOL_W / 2, spinIY = POOL_TABLE_OFFSET_Y + POOL_H + 46, spinIR = 17;
        if (Math.sqrt((canvasGameX - spinIX) ** 2 + (canvasGameY - spinIY) ** 2) < spinIR) {
            poolCueSpinX = Math.max(-1, Math.min(1, (canvasGameX - spinIX) / 14));
            poolCueSpinY = Math.max(-1, Math.min(1, (canvasGameY - spinIY) / 14));
            return;
        }

        // Ball in hand placement
        if (poolPlacingBall) {
            const cueBall = poolBalls[0];
            // Check valid placement (not overlapping other balls)
            let valid = true;
            const placeX = gameX;
            const placeY = gameY;

            // Must be within table bounds
            if (placeX < POOL_CUSHION_X1 + POOL_BALL_R || placeX > POOL_CUSHION_X2 - POOL_BALL_R ||
                placeY < POOL_CUSHION_Y1 + POOL_BALL_R || placeY > POOL_CUSHION_Y2 - POOL_BALL_R) {
                valid = false;
            }

            // Break shot: cue ball must stay inside the kitchen (behind the head string)
            if (poolIsBreakShot && placeX > POOL_BAULK_X - POOL_BALL_R) {
                valid = false;
            }

            // Check overlap with other balls
            for (const b of poolBalls) {
                if (b.pocketed || b.id === 0) continue;
                const d = Math.sqrt((placeX - b.x) ** 2 + (placeY - b.y) ** 2);
                if (d < POOL_BALL_R * 2.5) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                cueBall.x = placeX;
                cueBall.y = placeY;
                cueBall.pocketed = false;
                poolPlacingBall = false;
                poolBallInHand = false;
                poolFoulMessage = '';
            }
            return;
        }

        if (!poolAllStopped()) return;
        const isHumanTurn = poolTurn === 1 || poolMode === 'pvp';
        if (!isHumanTurn) return;

        // Lock current aim angle at the moment of mouse-down
        poolLockedAngle = poolCueAngle;
        poolAimLocked = true;
        poolAiming = true;
        poolDragging = true;
        poolCuePower = 0;
    }

    function handlePoolMouseMove(e) {
        if (currentGame !== 'pool') return;
        const rect = poolCanvas.getBoundingClientRect();
        poolMouseX = e.clientX - rect.left;
        poolMouseY = e.clientY - rect.top;

        if (poolDragging && poolAimLocked) {
            // Aim is locked — compute power from how far the mouse is pulled
            // back along the locked shot axis (projection onto shot direction).
            const cueBall = poolBalls.find(b => b.id === 0 && !b.pocketed);
            if (!cueBall) return;
            const scaleRatioX = rect.width / POOL_W;
            const scaleRatioY = rect.height / POOL_CANVAS_H;
            const mx = poolMouseX / scaleRatioX;
            const my = poolMouseY / scaleRatioY - POOL_TABLE_OFFSET_Y;
            // Shot direction unit vector
            const shotDirX = Math.cos(poolLockedAngle);
            const shotDirY = Math.sin(poolLockedAngle);
            // Pull vector: from mouse toward cue ball along shot axis
            const pullX = cueBall.x - mx;
            const pullY = cueBall.y - my;
            const projection = pullX * shotDirX + pullY * shotDirY;
            // Use absolute value — power builds whether the mouse is pulled
            // behind the cue ball OR dragged forward toward the target.
            // This removes the canvas-bounds restriction for corner shots.
            poolCuePower = Math.min(POOL_CUE_MAX_POWER, Math.max(0, (Math.abs(projection) - 5) * 0.20));
            // Angle stays locked — do NOT update poolCueAngle here
        }
    }

    function handlePoolMouseUp(e) {
        if (currentGame !== 'pool') return;
        if (!poolDragging) return;

        const cueBall = poolBalls.find(b => b.id === 0 && !b.pocketed);
        if (cueBall && poolCuePower > 0.5 && poolAllStopped()) {
            // Fire at the locked angle
            poolFireShot(cueBall, poolLockedAngle, poolCuePower);
        }
        // Whether shot or not — always release the drag/lock
        poolDragging = false;
        poolAimLocked = false;
        poolAiming = false;
        poolCuePower = 0;
    }

    function handlePoolTouchStart(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            handlePoolMouseDown({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
        }
    }

    function handlePoolTouchMove(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            handlePoolMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }

    function handlePoolTouchEnd(e) {
        e.preventDefault();
        handlePoolMouseUp({});
    }

    // POOL GAME LIFECYCLE

    function initPoolGame() {
        poolCanvas = document.getElementById('pool-canvas');
        if (!poolCanvas) return;
        poolCtx = poolCanvas.getContext('2d');
        poolGamesWon = loadPoolHighScore();
        poolRecord = loadPoolRecord();
        poolPockets = poolGetPockets();
        resetPoolGame();
        updatePoolScoreboard();
    }

    function resetPoolGame() {
        poolBalls = poolRackBalls();
        poolPockets = poolGetPockets();
        poolTurn = 1;
        poolGameOver = false;
        poolGameRunning = false;
        poolWinner = 0;
        poolFirstPocket = false;
        poolPlayer1Group = null;
        poolPlayer2Group = null;
        poolPlayer1Pocketed = [];
        poolPlayer2Pocketed = [];
        poolFoulMessage = '';
        poolShotFired = false;
        poolFirstBallHit = -1;
        poolCushionAfterHit = false;
        poolPocketedThisShot = [];
        poolBallInHand = true;      // break shot: player must place cue ball in kitchen
        poolPlacingBall = true;
        poolIsBreakShot = true;      // kitchen restriction active until first shot
        poolAiming = false;
        poolDragging = false;
        poolAimLocked = false;
        poolLockedAngle = 0;
        poolCuePower = 0;
        poolCueSpinX = 0;
        poolCueSpinY = 0;
        poolAIDelay = 0;
        poolAIPendingShot = null;
        poolShotTimer = POOL_SHOT_CLOCK;
        poolShotTimerFrame = 0;
        if (poolAnimFrame) { cancelAnimationFrame(poolAnimFrame); poolAnimFrame = null; }
        drawPoolFrame();
        updatePoolScoreboard();
    }

    function startPoolGame() {
        if (poolGameRunning) return;
        // If the previous game ended, force a full reset before starting a new one.
        // This prevents the XP farm exploit where clicking Play without Reset
        // would immediately re-trigger endPoolGame with the same winner.
        if (poolGameOver) {
            resetPoolGame();
        }
        poolGameRunning = true;
        poolGameOver = false;
        poolLastLogicMs = 0;
        poolAccumulator = 0;
        poolLastFrameMs = 0;
        if (!poolBalls.length) poolBalls = poolRackBalls();
        poolLoop();
    }

    function poolLoop(now) {
        if (!poolGameRunning) return;
        poolAnimFrame = requestAnimationFrame(poolLoop);
        if (!now) return; // first manual call has no timestamp

        // Fixed timestep: game logic always runs at 60 updates/sec
        if (!poolLastLogicMs) poolLastLogicMs = now;
        let delta = now - poolLastLogicMs;
        poolLastLogicMs = now;
        if (delta > 100) delta = 100;
        poolAccumulator += delta;
        while (poolAccumulator >= FIXED_DT) {
            if (!poolAllStopped()) {
                poolPhysicsUpdate();
                poolFoulMessage = '';
                poolShotTimer = POOL_SHOT_CLOCK;
                poolShotTimerFrame = 0;
            } else if (poolShotFired) {
                poolProcessTurnResult();
                poolShotTimer = POOL_SHOT_CLOCK;
                poolShotTimerFrame = 0;
            } else if (poolMode === 'cpu' && poolTurn === 2 && !poolGameOver) {
                if (poolPlacingBall || poolBallInHand) {
                    poolAIPlaceBall();
                    poolAIPendingShot = null;
                } else {
                    if (poolAIPendingShot === null) {
                        poolAITakeShot(true);
                    }
                    if (poolAIDelay > 0) {
                        poolAIDelay--;
                    } else {
                        const aiCueBall = poolBalls.find(b => b.id === 0 && !b.pocketed);
                        if (aiCueBall && poolAIPendingShot) {
                            poolCueSpinX = poolAIPendingShot.spinX || 0;
                            poolCueSpinY = poolAIPendingShot.spinY || 0;
                            poolFireShot(aiCueBall, poolAIPendingShot.angle, poolAIPendingShot.power);
                            poolAIPendingShot = null;
                        }
                    }
                }
            } else if (!poolGameOver && !poolPlacingBall) {
                poolShotTimerFrame++;
                if (poolShotTimerFrame >= 60) {
                    poolShotTimerFrame = 0;
                    poolShotTimer--;
                    if (poolShotTimer <= 0) {
                        poolFoulMessage = 'Shot clock expired!';
                        poolTurn = poolTurn === 1 ? 2 : 1;
                        poolBallInHand = true;
                        poolPlacingBall = true;
                        poolShotTimer = POOL_SHOT_CLOCK;
                        poolShotTimerFrame = 0;
                        if (poolMode === 'cpu' && poolTurn === 2) {
                            poolAIDelay = 60;
                        }
                        updatePoolScoreboard();
                    }
                }
            }
            poolAccumulator -= FIXED_DT;
        }

        // Render: capped by FPS setting
        const renderElapsed = now - poolLastFrameMs;
        if (renderElapsed < getFrameInterval()) return;
        poolLastFrameMs = now - (renderElapsed % getFrameInterval());
        drawPoolFrame();
    }

    function endPoolGame() {
        poolGameOver = true;
        poolGameRunning = false;
        if (poolAnimFrame) { cancelAnimationFrame(poolAnimFrame); poolAnimFrame = null; }

        if (poolWinner === 1) {
            poolGamesWon++;
            savePoolHighScore(poolGamesWon);
            poolRecord.p1Wins++;
            poolRecord.p2Losses++;
            savePoolRecord(poolRecord);
            awardGameXP('pool', { won: true });
        } else if (poolWinner === 2) {
            poolRecord.p2Wins++;
            poolRecord.p1Losses++;
            savePoolRecord(poolRecord);
            awardGameXP('pool', { won: false });
        }

        updatePoolScoreboard();
        drawPoolFrame();
    }

    function updatePoolScoreboard() {
        const p1 = document.getElementById('pool-p1-score');
        const p2 = document.getElementById('pool-p2-score');
        const turn = document.getElementById('pool-turn-label');
        if (p1) p1.textContent = poolPlayer1Pocketed.length;
        if (p2) p2.textContent = poolPlayer2Pocketed.length;
        if (turn) {
            if (poolGameOver) {
                const w = poolWinner === 1 ? 'P1 Wins!' : (poolMode === 'cpu' ? 'CPU Wins!' : 'P2 Wins!');
                turn.textContent = w;
            } else {
                turn.textContent = poolTurn === 1 ? 'Turn: P1' : (poolMode === 'cpu' ? 'Turn: CPU' : 'Turn: P2');
            }
        }
    }

    function togglePoolMode() {
        poolMode = poolMode === 'cpu' ? 'pvp' : 'cpu';
        const btns = document.querySelectorAll('#pool-controls .snake-btn');
        if (btns.length > 0) btns[0].textContent = poolMode === 'cpu' ? '🔄 PvCPU' : '🔄 PvP';
        resetPoolGame();
    }

    // ═══════════════════════════════════════════════════════════════
    // SHARED "MAXIMIZE TO MODAL" HELPER
    // ═══════════════════════════════════════════════════════════════
    // Pool and Ludo both blow their canvas up into a 2× modal, and the mechanics
    // are identical: drop an invisible placeholder so the panel doesn't collapse,
    // build overlay + panel, move the real canvas across, scale its backing
    // store, then put everything back on close. Each game supplies only its own
    // ids and buffer size.
    //
    // Both renderers derive their internal scale from canvas.width, so doubling
    // the buffer is all it takes to redraw crisp — drawPoolFrame divides by
    // POOL_W, ludoRender by LUDO_CANVAS_W.
    //
    // State is keyed by canvasId so two games can never cross wires. Returns the
    // new maximized state, which callers store in their own flag.
    const _gameMaxModals = {};

    function toggleGameMaxModal(cfg) {
        const canvas = document.getElementById(cfg.canvasId);
        if (!canvas) return false;
        const openState = _gameMaxModals[cfg.canvasId];

        if (!openState) {
            // --- Open modal ---
            const gameContainer = canvas.closest('.snake-game-container') || canvas.parentElement;

            const placeholder = document.createElement('div');
            placeholder.style.cssText =
                'width:' + canvas.offsetWidth + 'px;height:' + canvas.offsetHeight + 'px;visibility:hidden;';
            gameContainer.insertBefore(placeholder, canvas);

            const overlay = document.createElement('div');
            overlay.id = cfg.canvasId + '-max-overlay';
            overlay.className = 'pool-modal-overlay';

            const panel = document.createElement('div');
            panel.className = 'pool-modal-panel';

            const header = document.createElement('div');
            header.className = 'pool-modal-header';
            const titleEl = document.createElement('span');
            titleEl.className = 'pool-modal-title';
            titleEl.textContent = cfg.title;
            header.appendChild(titleEl);
            const closeBtn = document.createElement('button');
            closeBtn.className = 'pool-modal-close';
            closeBtn.textContent = '✕';
            closeBtn.onclick = () => { if (cfg.onToggle) cfg.onToggle(); else toggleGameMaxModal(cfg); };
            header.appendChild(closeBtn);

            const canvasWrap = document.createElement('div');
            canvasWrap.className = 'pool-modal-canvas-wrap';

            const original = {
                bufferWidth: canvas.width,
                bufferHeight: canvas.height,
                width: canvas.style.width,
                height: canvas.style.height,
                maxWidth: canvas.style.maxWidth,
                transform: canvas.style.transform,
                transformOrigin: canvas.style.transformOrigin,
                parent: gameContainer,
            };
            const k = cfg.scale || 2;
            canvas.width = cfg.bufferW * k;
            canvas.height = cfg.bufferH * k;
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.maxWidth = '100%';
            canvas.style.transform = '';
            canvas.style.transformOrigin = '';
            canvasWrap.appendChild(canvas);

            panel.appendChild(header);
            panel.appendChild(canvasWrap);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.classList.add('active');
                panel.classList.add('active');
            });

            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) { if (cfg.onToggle) cfg.onToggle(); else toggleGameMaxModal(cfg); }
            });

            overlay._escHandler = function(e) {
                if (e.key === 'Escape') { if (cfg.onToggle) cfg.onToggle(); else toggleGameMaxModal(cfg); }
            };
            document.addEventListener('keydown', overlay._escHandler);

            _gameMaxModals[cfg.canvasId] = { overlay, placeholder, original };
            return true;
        }

        // --- Close modal ---
        const overlay = openState.overlay;
        const placeholder = openState.placeholder;
        const original = openState.original;

        if (original) {
            // Restore buffer size first, then CSS styles
            canvas.width = original.bufferWidth;
            canvas.height = original.bufferHeight;
            canvas.style.width = original.width;
            canvas.style.height = original.height;
            canvas.style.maxWidth = original.maxWidth;
            canvas.style.transform = original.transform;
            canvas.style.transformOrigin = original.transformOrigin;
            if (placeholder && original.parent) {
                original.parent.insertBefore(canvas, placeholder);
            }
        }
        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
        }
        if (overlay._escHandler) {
            document.removeEventListener('keydown', overlay._escHandler);
        }
        overlay.classList.remove('active');
        const panelEl = overlay.querySelector('.pool-modal-panel');
        if (panelEl) panelEl.classList.remove('active');
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);

        delete _gameMaxModals[cfg.canvasId];
        return false;
    }

    // POOL MAXIMIZE
    function togglePoolMaximize() {
        poolMaximized = toggleGameMaxModal({
            canvasId: 'pool-canvas',
            title: '🎱 8-Ball Pool',
            bufferW: POOL_W,
            bufferH: POOL_CANVAS_H,
            onToggle: togglePoolMaximize,
        });
        drawPoolFrame();
    }

    // SNAKE GAME LOGIC
    
    function initSnakeGame() {
        snakeCanvas = document.getElementById('snake-canvas');
        if (!snakeCanvas) return;
        
        snakeCtx = snakeCanvas.getContext('2d');
        snakeHighScore = loadSnakeHighScore();
        updateSnakeScoreDisplay();
        
        // Keyboard controls
        document.addEventListener('keydown', handleSnakeKeyPress);
        
        // Reset game
        resetSnakeGame();
    }
    
    function handleSnakeKeyPress(e) {
        if (!snakeGameRunning || snakeGamePaused) return;
        
        const key = e.key;
        
        // Prevent default arrow key scrolling
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            e.preventDefault();
        }
        
        if (key === 'ArrowUp' && direction.y === 0) {
            nextDirection = {x: 0, y: -1};
        } else if (key === 'ArrowDown' && direction.y === 0) {
            nextDirection = {x: 0, y: 1};
        } else if (key === 'ArrowLeft' && direction.x === 0) {
            nextDirection = {x: -1, y: 0};
        } else if (key === 'ArrowRight' && direction.x === 0) {
            nextDirection = {x: 1, y: 0};
        }
    }
    
    function snakeGetInterval() {
        // 300ms base, -8ms per food, floor 60ms
        return Math.max(60, 300 - snakeScore * 8);
    }

    function startSnakeGame() {
        if (snakeGameRunning) return;

        snakeGameRunning = true;
        snakeGamePaused = false;
        hideSnakeGameOver();

        snakeTickInterval = snakeGetInterval();
        snakeLastTickMs = performance.now();
        snakeAccumulatorMs = 0;
        snakePrevSnap = snake.map(s => ({...s}));

        // Smooth render loop — separate from logic tick
        if (snakeAnimFrame) cancelAnimationFrame(snakeAnimFrame);
        snakeAnimFrame = requestAnimationFrame(snakeRenderLoop);

        updateSnakePlayButton();
    }
    
    function pauseSnakeGame() {
        snakeGamePaused = !snakeGamePaused;
        updateSnakePlayButton();
    }
    
    function resetSnakeGame() {
        snake = [{x: 10, y: 10}];
        direction = {x: 0, y: 0};
        nextDirection = {x: 0, y: 0};
        snakeScore = 0;
        snakeGameRunning = false;
        snakeGamePaused = false;
        
        if (snakeAnimFrame) { cancelAnimationFrame(snakeAnimFrame); snakeAnimFrame = null; }
        snakePrevSnap = [];
        snakeLastTickMs = 0;
        snakeAccumulatorMs = 0;
        
        // Clear canvas completely on reset
        if (snakeCtx) {
            snakeCtx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
        }
        
        spawnFood();
        updateSnakeScoreDisplay();
        drawSnakeGame();
        hideSnakeGameOver();
        updateSnakePlayButton();
    }
    
    function snakeTick() {
        if (snakeGamePaused) return;

        // Snapshot grid positions BEFORE moving — rAF loop lerps from these
        snakePrevSnap = snake.map(s => ({...s}));

        direction = {...nextDirection};
        if (direction.x === 0 && direction.y === 0) return; // waiting for first input

        const head = {
            x: snake[0].x + direction.x,
            y: snake[0].y + direction.y
        };

        // Wall collision (1-cell grace buffer)
        if (head.x < -1 || head.x > snakeGridSize || head.y < -1 || head.y > snakeGridSize) {
            gameOver(); return;
        }
        // Self collision
        if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
            gameOver(); return;
        }

        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            snakeScore++;
            updateSnakeScoreDisplay();
            spawnFood();
            // Increase speed by reducing per-tick interval
            snakeTickInterval = snakeGetInterval();
        } else {
            snake.pop();
        }
        // Drawing is handled exclusively by snakeRenderLoop
    }

    // Keep alias so any other callers still work
    function updateSnakeGame() { snakeTick(); }

    // rAF render loop — logic always runs via accumulator, render is FPS-capped
    function snakeRenderLoop(timestamp) {
        if (!snakeGameRunning) return;
        snakeAnimFrame = requestAnimationFrame(snakeRenderLoop);

        // Logic: always runs, frame-rate independent via accumulator
        if (!snakeLastTickMs) snakeLastTickMs = timestamp;
        const delta = timestamp - snakeLastTickMs;
        snakeLastTickMs = timestamp;

        if (!snakeGamePaused) {
            snakeAccumulatorMs += delta;
            while (snakeAccumulatorMs >= snakeTickInterval && snakeGameRunning) {
                snakeTick();
                snakeAccumulatorMs -= snakeTickInterval;
            }
        }

        // Render: capped by FPS setting
        const renderElapsed = timestamp - snakeLastRenderMs;
        if (renderElapsed < getFrameInterval()) return;
        snakeLastRenderMs = timestamp - (renderElapsed % getFrameInterval());

        const t = Math.min(1, snakeAccumulatorMs / snakeTickInterval);
        drawSnakeGame(t);
    }
    
    function spawnFood() {
        do {
            food = {
                x: Math.floor(Math.random() * snakeGridSize),
                y: Math.floor(Math.random() * snakeGridSize)
            };
        } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
    }
    
    function drawSnakeGame(t = 1) {
        if (!snakeCtx) return;
        const W = snakeCanvas.width, H = snakeCanvas.height;
        const cs = W / snakeGridSize;

        // Background
        snakeCtx.fillStyle = '#0b1a12';
        snakeCtx.fillRect(0, 0, W, H);

        // Subtle grid
        snakeCtx.strokeStyle = 'rgba(0,255,120,0.04)';
        snakeCtx.lineWidth = 0.5;
        for (let i = 1; i < snakeGridSize; i++) {
            snakeCtx.beginPath(); snakeCtx.moveTo(i*cs,0); snakeCtx.lineTo(i*cs,H); snakeCtx.stroke();
            snakeCtx.beginPath(); snakeCtx.moveTo(0,i*cs); snakeCtx.lineTo(W,i*cs); snakeCtx.stroke();
        }

        // Snake — lerp each segment from prev grid pos toward current
        snake.forEach((seg, idx) => {
            const prev = snakePrevSnap[idx] || seg;
            // Smooth linear interpolation between ticks
            const px = (prev.x + (seg.x - prev.x) * t) * cs;
            const py = (prev.y + (seg.y - prev.y) * t) * cs;
            const isHead = idx === 0;
            const fade = Math.max(0.45, 1 - idx * 0.018);

            if (isHead) {
                snakeCtx.shadowColor = '#00e676';
                snakeCtx.shadowBlur = 10;
                const hg = snakeCtx.createLinearGradient(px, py, px+cs, py+cs);
                hg.addColorStop(0, '#55efc4');
                hg.addColorStop(1, '#00b894');
                snakeCtx.fillStyle = hg;
            } else {
                snakeCtx.shadowBlur = 0;
                const g = Math.floor(184 * fade);
                snakeCtx.fillStyle = `rgb(0,${g},${Math.floor(g*0.65)})`;
            }
            snakeCtx.beginPath();
            snakeCtx.roundRect(px+2, py+2, cs-4, cs-4, isHead ? 5 : 3);
            snakeCtx.fill();
            snakeCtx.shadowBlur = 0;

            // Eyes on head
            if (isHead && (direction.x !== 0 || direction.y !== 0)) {
                const cx = px + cs/2, cy = py + cs/2;
                const ex = direction.x * cs*0.22, ey = direction.y * cs*0.22;
                const px2 = direction.y * cs*0.18, py2 = -direction.x * cs*0.18;
                snakeCtx.fillStyle = '#fff';
                snakeCtx.beginPath(); snakeCtx.arc(cx+ex+px2, cy+ey+py2, 2.2, 0, Math.PI*2); snakeCtx.fill();
                snakeCtx.beginPath(); snakeCtx.arc(cx+ex-px2, cy+ey-py2, 2.2, 0, Math.PI*2); snakeCtx.fill();
                snakeCtx.fillStyle = '#111';
                snakeCtx.beginPath(); snakeCtx.arc(cx+ex+px2+direction.x*0.6, cy+ey+py2+direction.y*0.6, 1.1, 0, Math.PI*2); snakeCtx.fill();
                snakeCtx.beginPath(); snakeCtx.arc(cx+ex-px2+direction.x*0.6, cy+ey-py2+direction.y*0.6, 1.1, 0, Math.PI*2); snakeCtx.fill();
            }
        });

        // Food — glowing apple
        const fx = food.x*cs + cs/2, fy = food.y*cs + cs/2, fr = cs/2 - 2;
        snakeCtx.shadowColor = '#ff6b6b'; snakeCtx.shadowBlur = 14;
        const fg = snakeCtx.createRadialGradient(fx-fr*0.3, fy-fr*0.3, 1, fx, fy, fr);
        fg.addColorStop(0, '#ff9f9f'); fg.addColorStop(0.5, '#e17055'); fg.addColorStop(1, '#c0392b');
        snakeCtx.fillStyle = fg;
        snakeCtx.beginPath(); snakeCtx.arc(fx, fy, fr, 0, Math.PI*2); snakeCtx.fill();
        snakeCtx.shadowBlur = 0;
        // Stem + shine
        snakeCtx.strokeStyle = '#55efc4'; snakeCtx.lineWidth = 1.5;
        snakeCtx.beginPath(); snakeCtx.moveTo(fx, fy-fr); snakeCtx.lineTo(fx+3, fy-fr-4); snakeCtx.stroke();
        snakeCtx.fillStyle = 'rgba(255,255,255,0.35)';
        snakeCtx.beginPath(); snakeCtx.ellipse(fx-fr*0.28, fy-fr*0.3, fr*0.28, fr*0.18, -0.6, 0, Math.PI*2); snakeCtx.fill();

        // Speed bar
        const spd = Math.min(1, snakeScore / 30);
        snakeCtx.fillStyle = 'rgba(0,230,118,0.1)';
        snakeCtx.fillRect(0, H-3, W, 3);
        snakeCtx.fillStyle = `hsl(${140-spd*80},100%,55%)`;
        snakeCtx.fillRect(0, H-3, W*spd, 3);
    }
    
    function gameOver() {
        snakeGameRunning = false;
        snakeGamePaused = false;
        if (snakeAnimFrame) { cancelAnimationFrame(snakeAnimFrame); snakeAnimFrame = null; }
        snakeAccumulatorMs = 0;
        
        // Clear canvas on game over
        if (snakeCtx) {
            snakeCtx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
        }
        
        // Update high score
        if (snakeScore > snakeHighScore) {
            snakeHighScore = snakeScore;
            saveSnakeHighScore(snakeHighScore);
            updateSnakeScoreDisplay();
        }
        
        // Award XP based on snake score
        awardGameXP('snake', { score: snakeScore, isHighScore: snakeScore >= snakeHighScore });
        
        showSnakeGameOver();
        updateSnakePlayButton();
        
        // Auto restart and begin playing after 3 seconds
        setTimeout(() => {
            resetSnakeGame();
            startSnakeGame();
        }, 3000);
    }
    
    function showSnakeGameOver() {
        const gameOverDiv = document.getElementById('snake-game-over');
        if (gameOverDiv) {
            gameOverDiv.classList.add('active');
            const finalScore = gameOverDiv.querySelector('.final-score');
            if (finalScore) {
                finalScore.textContent = snakeScore;
            }
        }
    }
    
    function hideSnakeGameOver() {
        const gameOverDiv = document.getElementById('snake-game-over');
        if (gameOverDiv) {
            gameOverDiv.classList.remove('active');
        }
    }
    
    function updateSnakeScoreDisplay() {
        const scoreElement = document.getElementById('snake-current-score');
        const highScoreElement = document.getElementById('snake-high-score');
        
        if (scoreElement) scoreElement.textContent = snakeScore;
        if (highScoreElement) highScoreElement.textContent = `High: ${snakeHighScore}`;
    }
    
    function updateSnakePlayButton() {
        const playBtn = document.getElementById('snake-play-btn');
        if (!playBtn) return;
        
        if (!snakeGameRunning) {
            playBtn.textContent = '▶ Play';
        } else if (snakeGamePaused) {
            playBtn.textContent = '⏸ Pause';
        } else {
            playBtn.textContent = '⏸ Pause';
        }
    }
    
    // REFLEX GAME LOGIC
    
    function initReflexGame() {
        gameAreaElement = document.getElementById('multi-game-area');
        if (!gameAreaElement) return;
        
        // Load high scores
        const highScores = loadReflexHighScores();
        updateReflexScoreDisplay();
        updateReflexDisplay();
    }
    
    function generateReflexTargetPosition() {
        if (!gameAreaElement) return { x: 200, y: 200 };
        
        const rect = gameAreaElement.getBoundingClientRect();
        const targetSize = 60;
        const margin = Math.max(targetSize / 2 + 20, 50);
        
        const availableWidth = Math.max(rect.width - margin * 2, 100);
        const availableHeight = Math.max(rect.height - margin * 2, 100);
        
        const minX = margin;
        const maxX = rect.width - margin;
        const minY = margin;
        const maxY = rect.height - margin;
        
        let position = {
            x: Math.random() * availableWidth + margin,
            y: Math.random() * availableHeight + margin
        };
        
        // Bounds validation
        position.x = Math.max(minX, Math.min(maxX, position.x));
        position.y = Math.max(minY, Math.min(maxY, position.y));
        
        return position;
    }
    
    function generateReflexTargetColor() {
        const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    function startReflexRound(roundNum) {
        const config = reflexGameModes[reflexMode];
        const nextRound = roundNum || reflexCurrentRound + 1;
        
        if (nextRound > config.rounds) {
            finishReflexGame();
            return;
        }
        
        reflexCurrentRound = nextRound;
        reflexIsWaiting = true;
        reflexCanClick = false;
        reflexShowTarget = false;
        
        updateReflexDisplay();
        
        const delay = Math.random() * (config.maxDelay - config.minDelay) + config.minDelay;
        
        reflexTimeoutRef = setTimeout(() => {
            reflexStartTime = Date.now();
            reflexGoReadyMs = reflexStartTime;
            reflexCanClick = true;
            reflexIsWaiting = false;
            
            if (config.targets) {
                reflexTargetPosition = generateReflexTargetPosition();
                reflexTargetColor = generateReflexTargetColor();
                reflexShowTarget = true;
            }
            
            updateReflexDisplay();
        }, delay);
    }

    // Centralised false-start handler. Cancels any pending GO timer, increments
    // the counter, and either ends the game (if over the limit) or re-arms the
    // wait phase with a longer cool-off so a click-spam burst can't carry over.
    function reflexHandleFalseStart() {
        reflexFalseStarts++;
        reflexCanClick = false;
        reflexShowTarget = false;
        if (reflexTimeoutRef) {
            clearTimeout(reflexTimeoutRef);
            reflexTimeoutRef = null;
        }
        if (reflexFalseStarts >= REFLEX_FALSE_START_LIMIT) {
            // Hard fail — record a penalty time for any remaining rounds so the
            // average can't be gamed by ending early on a single fast click.
            const config = reflexGameModes[reflexMode];
            const penalty = config.maxDelay; // worst-case reaction
            while (reflexReactionTimes.length < config.rounds) {
                reflexReactionTimes.push(penalty);
            }
            finishReflexGame();
            return;
        }
        updateReflexDisplay();
        // Longer cool-off than the original 500ms so a rapid-click stream
        // doesn't immediately re-arm and exploit the next GO.
        setTimeout(() => startReflexRound(reflexCurrentRound), 1200);
    }

    function handleReflexClick(event) {
        if (!reflexGameStarted || reflexGameFinished) return;

        // 1. Click-spam debounce — ignore back-to-back clicks. Returning before
        //    any state mutation means a spam stream can't false-start, can't
        //    score, and can't traverse states.
        const now = Date.now();
        if (now - reflexLastClickMs < REFLEX_CLICK_DEBOUNCE_MS) {
            return;
        }
        reflexLastClickMs = now;

        // 2. FALSE START — clicked during the wait phase.
        if (reflexIsWaiting) {
            reflexHandleFalseStart();
            return;
        }

        if (!reflexCanClick) return;

        // Reaction time. Lucky prefires that land just after GO (even sub-100ms)
        // are legitimate — the wait-phase false-start gate + click debounce
        // already block the spam-click exploit, so no floor is needed here.
        const reactionTime = now - reflexStartTime;

        // 4. TARGET MODE — require the click to land on the target.
        if (reflexGameModes[reflexMode].targets && reflexShowTarget) {
            const rect = gameAreaElement.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;
            const distance = Math.sqrt(
                Math.pow(clickX - reflexTargetPosition.x, 2) +
                Math.pow(clickY - reflexTargetPosition.y, 2)
            );
            if (distance > 30) {
                // Missed — treat as a false start so spam-clicking the canvas
                // can't farm rounds by waiting for the GO + auto-restart loop.
                reflexHandleFalseStart();
                return;
            }
        }

        // 5. SUCCESSFUL REACTION
        reflexReactionTimes.push(reactionTime);
        reflexCanClick = false;
        reflexShowTarget = false;
        updateReflexDisplay();
        setTimeout(() => { startReflexRound(); }, 300);
    }
    
    function finishReflexGame() {
        reflexGameStarted = false;
        reflexGameFinished = true;
        reflexCanClick = false;
        reflexShowTarget = false;
        
        if (reflexTimeoutRef) {
            clearTimeout(reflexTimeoutRef);
            reflexTimeoutRef = null;
        }
        
        // Calculate statistics
        const avgTime = reflexReactionTimes.length > 0
            ? Math.round(reflexReactionTimes.reduce((a, b) => a + b, 0) / reflexReactionTimes.length)
            : 0;
        const bestTime = reflexReactionTimes.length > 0 ? Math.min(...reflexReactionTimes) : 0;
        
        // Check and update high scores
        const highScores = loadReflexHighScores();
        let newHighScore = false;
        
        if (avgTime < highScores[reflexMode].avg) {
            highScores[reflexMode].avg = avgTime;
            newHighScore = true;
        }
        if (bestTime < highScores[reflexMode].best) {
            highScores[reflexMode].best = bestTime;
            newHighScore = true;
        }
        
        if (newHighScore) {
            saveReflexHighScores(highScores);
            updateReflexScoreDisplay();
        }
        
        // Award XP based on performance
        awardGameXP('reflex', { avgTime, bestTime, falseStarts: reflexFalseStarts, isHighScore: newHighScore });
        
        updateReflexDisplay();
        showReflexResults(avgTime, bestTime, newHighScore);
    }
    
    function resetReflexGame() {
        reflexGameStarted = false;
        reflexGameFinished = false;
        reflexIsWaiting = false;
        reflexCanClick = false;
        reflexStartTime = 0;
        reflexReactionTimes = [];
        reflexCurrentRound = 0;
        reflexFalseStarts = 0;
        reflexShowTarget = false;
        reflexLastClickMs = 0;
        reflexGoReadyMs = 0;
        
        if (reflexTimeoutRef) {
            clearTimeout(reflexTimeoutRef);
            reflexTimeoutRef = null;
        }
        
        updateReflexDisplay();
        hideReflexResults();
    }
    
    function startReflexGame() {
        resetReflexGame();
        reflexGameStarted = true;
        reflexGameFinished = false;
        reflexReactionTimes = [];
        reflexCurrentRound = 0;
        reflexFalseStarts = 0;
        
        // Ensure click listener is attached
        if (gameAreaElement) {
            gameAreaElement.removeEventListener('click', handleReflexClick);
            gameAreaElement.addEventListener('click', handleReflexClick);
        }
        
        updateReflexDisplay();
        startReflexRound(1);
    }
    
    function toggleReflexMode() {
        if (reflexGameStarted) return; // Can't change mode during game
        
        reflexMode = reflexMode === 'screen' ? 'target' : 'screen';
        updateReflexDisplay();
    }
    
    function updateReflexDisplay() {
        if (!gameAreaElement) return;
        
        const config = reflexGameModes[reflexMode];
        
        // Update game area appearance based on state
        gameAreaElement.className = 'multi-game-area reflex-game-area';
        gameAreaElement.style.pointerEvents = 'auto'; // Ensure clicks work
        
        // Set crosshair cursor for Target mode
        if (config.targets) {
            gameAreaElement.style.cursor = 'crosshair';
        } else {
            gameAreaElement.style.cursor = 'pointer';
        }
        
        if (reflexIsWaiting) {
            gameAreaElement.classList.add('reflex-waiting-state');
            gameAreaElement.style.background = 'linear-gradient(135deg, #dc2626, #991b1b)';
        } else if (reflexCanClick) {
            gameAreaElement.classList.add('reflex-ready-state');
            gameAreaElement.style.background = 'linear-gradient(135deg, #16a34a, #15803d)';
        } else {
            gameAreaElement.style.background = 'rgba(0, 0, 0, 0.3)';
        }
        
        // Clear previous content
        gameAreaElement.innerHTML = '';
        
        // Show instructions or state text
        const stateText = document.createElement('div');
        stateText.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 2rem;
            font-weight: 700;
            color: white;
            text-align: center;
            text-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
            pointer-events: none;
            z-index: 10;
        `;
        
        if (!reflexGameStarted) {
            stateText.textContent = `Click "Play" to start ${config.name}`;
            stateText.style.fontSize = '1.5rem';
        } else if (reflexIsWaiting) {
            stateText.textContent = 'Wait for it...';
        } else if (reflexCanClick) {
            stateText.textContent = config.targets ? '' : 'CLICK NOW!';
        } else if (reflexGameFinished) {
            stateText.textContent = 'Game Complete!';
        } else {
            stateText.textContent = `Round ${reflexCurrentRound}/${config.rounds}`;
            stateText.style.fontSize = '1.2rem';
            stateText.style.top = '20px';
            stateText.style.transform = 'translateX(-50%)';
        }
        
        gameAreaElement.appendChild(stateText);
        
        // Show target if in target mode and can click
        if (reflexShowTarget && config.targets && reflexCanClick) {
            const target = document.createElement('div');
            target.className = 'reflex-target';
            target.style.cssText = `
                position: absolute;
                left: ${reflexTargetPosition.x - 30}px;
                top: ${reflexTargetPosition.y - 30}px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: radial-gradient(circle, ${reflexTargetColor}, ${reflexTargetColor}aa);
                box-shadow: 0 0 30px ${reflexTargetColor}66;
                animation: targetPulse 1s ease-in-out infinite;
                cursor: crosshair;
                z-index: 15;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            gameAreaElement.appendChild(target);
        }
        
        // Update stats display
        updateReflexStatsDisplay();
    }
    
    function updateReflexStatsDisplay() {
        const statsElement = document.getElementById('reflex-stats');
        if (!statsElement) return;
        
        const config = reflexGameModes[reflexMode];
        const avgTime = reflexReactionTimes.length > 0
            ? Math.round(reflexReactionTimes.reduce((a, b) => a + b, 0) / reflexReactionTimes.length)
            : 0;
        
        statsElement.innerHTML = `
            <div style="display: flex; justify-content: space-around; padding: 8px; font-size: 0.875rem;">
                <div><strong>Round:</strong> ${reflexCurrentRound}/${config.rounds}</div>
                <div><strong>Avg:</strong> ${avgTime}ms</div>
                <div><strong>False Starts:</strong> ${reflexFalseStarts}</div>
            </div>
        `;
    }
    
    function updateReflexScoreDisplay() {
        const highScoreElement = document.getElementById('reflex-high-score');
        if (!highScoreElement) return;
        
        const highScores = loadReflexHighScores();
        const screenBest = highScores.screen?.best;
        const targetBest = highScores.target?.best;
        const validScreen = screenBest && screenBest !== Infinity && screenBest > 0;
        const validTarget = targetBest && targetBest !== Infinity && targetBest > 0;
        
        highScoreElement.textContent = `⚡ ${validScreen ? screenBest + 'ms' : '—'}  🎯 ${validTarget ? targetBest + 'ms' : '—'}`;
    }
    
    function showReflexResults(avgTime, bestTime, isNewHighScore) {
        const resultsElement = document.getElementById('reflex-results');
        if (!resultsElement) return;
        
        resultsElement.innerHTML = `
            <div style="text-align: center;">
                <h3 style="margin-bottom: 16px; color: #10b981;">${isNewHighScore ? '🎉 New High Score!' : 'Game Complete!'}</h3>
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 1.2rem; font-weight: 700;">Average: ${avgTime}ms</div>
                    <div style="font-size: 1.2rem; font-weight: 700;">Best: ${bestTime}ms</div>
                    <div style="font-size: 0.9rem; margin-top: 8px;">False Starts: ${reflexFalseStarts}</div>
                </div>
                <button id="reflex-play-again-btn" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea, #764ba2); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                    Play Again
                </button>
            </div>
        `;
        resultsElement.classList.add('active');
        
        // Add click handler for Play Again button
        const playAgainBtn = document.getElementById('reflex-play-again-btn');
        if (playAgainBtn) {
            playAgainBtn.onclick = () => {
                hideReflexResults();
                resetReflexGame();
                startReflexGame();
            };
        }
    }
    
    function hideReflexResults() {
        const resultsElement = document.getElementById('reflex-results');
        if (resultsElement) {
            resultsElement.classList.remove('active');
        }
    }
    
    // AIM TRAINER CHAOS MODE LOGIC
    
    function initAimTrainerGame() {
        gameAreaElement = document.getElementById('multi-game-area');
        if (!gameAreaElement) return;
        
        // Reset game state
        aimGameStarted = false;
        aimGameFinished = false;
        aimTimer = aimChaosMode.timeLimit;
        aimScore = 0;
        aimAccuracy = 100;
        aimTargets = [];
        aimShots = 0;
        aimHits = 0;
        aimBulletHoles = [];
        
        // Load high score
        const highScore = loadAimHighScore();
        updateAimScoreDisplay();
        renderAimGame();
    }
    
    function generateAimTargetPosition() {
        if (!gameAreaElement) return { x: 200, y: 200 };
        
        const rect = gameAreaElement.getBoundingClientRect();
        const targetSize = aimChaosMode.targetSize;
        const margin = targetSize / 2 + 20;
        
        const minX = margin;
        const maxX = rect.width - margin;
        const minY = margin;
        const maxY = rect.height - margin;
        
        let position = {
            x: Math.random() * (maxX - minX) + minX,
            y: Math.random() * (maxY - minY) + minY
        };
        
        return position;
    }
    
    function createAimTarget() {
        const position = generateAimTargetPosition();
        return {
            id: Date.now() + Math.random(),
            x: position.x,
            y: position.y,
            size: aimChaosMode.targetSize,
            createdAt: Date.now()
        };
    }
    
    function spawnMultipleTargets(count) {
        const newTargets = [];
        for (let i = 0; i < count; i++) {
            newTargets.push(createAimTarget());
            // Small delay to ensure unique IDs
            const tempId = Date.now();
            while (Date.now() === tempId) { /* wait */ }
        }
        aimTargets = newTargets;
        // Render will be called by the function that spawns targets
    }
    
    function handleAimTargetHit(targetId, clickX, clickY) {
        aimScore += 10;
        aimHits++;
        aimShots++;
        
        // Add green bullet hole
        aimBulletHoles.push({
            id: Date.now() + Math.random(),
            x: clickX,
            y: clickY,
            type: 'hit',
            createdAt: Date.now()
        });
        
        // Remove hit target and spawn new one
        aimTargets = aimTargets.filter(target => target.id !== targetId);
        aimTargets.push(createAimTarget());
        
        // Update accuracy
        aimAccuracy = aimShots > 0 ? Math.round((aimHits / aimShots) * 100) : 0;
        
        // Clean up old bullet holes (keep last 20)
        if (aimBulletHoles.length > 20) {
            aimBulletHoles = aimBulletHoles.slice(-20);
        }
        
        updateAimStatsDisplay();
        renderAimGame(); // Render on state change
    }
    
    function handleAimMissedShot(clickX, clickY) {
        aimShots++;
        
        // Add gray bullet hole
        aimBulletHoles.push({
            id: Date.now() + Math.random(),
            x: clickX,
            y: clickY,
            type: 'miss',
            createdAt: Date.now()
        });
        
        // Update accuracy
        aimAccuracy = aimShots > 0 ? Math.round((aimHits / aimShots) * 100) : 0;
        
        // Clean up old bullet holes
        if (aimBulletHoles.length > 20) {
            aimBulletHoles = aimBulletHoles.slice(-20);
        }
        
        updateAimStatsDisplay();
        renderAimGame(); // Render on state change
    }
    
    function handleAimClick(event) {
        if (!aimGameStarted || aimGameFinished) return;
        
        const rect = gameAreaElement.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        let targetHit = false;
        
        // Check all targets for hit
        for (const target of aimTargets) {
            const distance = Math.sqrt(
                Math.pow(clickX - target.x, 2) + Math.pow(clickY - target.y, 2)
            );
            
            // Hit detection with 5px tolerance
            if (distance <= (target.size / 2) + 5) {
                handleAimTargetHit(target.id, clickX, clickY);
                targetHit = true;
                break;
            }
        }
        
        // Record miss if no target hit
        if (!targetHit) {
            handleAimMissedShot(clickX, clickY);
        }
    }
    
    function updateAimTimer() {
        if (!aimGameStarted || aimGameFinished) return;
        
        aimTimer--;
        
        if (aimTimer <= 0) {
            finishAimGame();
        }
        
        updateAimStatsDisplay();
    }
    
    function finishAimGame() {
        aimGameStarted = false;
        aimGameFinished = true;
        
        if (aimTimerRef) {
            clearInterval(aimTimerRef);
            aimTimerRef = null;
        }
        
        if (aimRenderFrameId) {
            cancelAnimationFrame(aimRenderFrameId);
            aimRenderFrameId = null;
        }
        
        // Check high score
        const highScore = loadAimHighScore();
        const isNewHighScore = aimScore > highScore;
        
        if (isNewHighScore) {
            saveAimHighScore(aimScore);
            updateAimScoreDisplay();
        }
        
        // Award XP based on score
        awardGameXP('aim', { score: aimScore, accuracy: aimAccuracy, hits: aimHits, isHighScore: isNewHighScore });
        
        showAimResults(isNewHighScore);
    }
    
    function resetAimGame() {
        aimGameStarted = false;
        aimGameFinished = false;
        aimTimer = aimChaosMode.timeLimit;
        aimScore = 0;
        aimAccuracy = 100;
        aimTargets = [];
        aimShots = 0;
        aimHits = 0;
        aimBulletHoles = [];
        
        if (aimTimerRef) {
            clearInterval(aimTimerRef);
            aimTimerRef = null;
        }
        
        hideAimResults();
        renderAimGame(); // Update DOM to show instructions screen
    }
    
    function startAimGame() {
        // Clear previous state
        aimGameStarted = true;
        aimGameFinished = false;
        aimTimer = aimChaosMode.timeLimit;
        aimScore = 0;
        aimAccuracy = 100;
        aimTargets = [];
        aimShots = 0;
        aimHits = 0;
        aimBulletHoles = [];
        
        // Clear any existing timers
        if (aimTimerRef) {
            clearInterval(aimTimerRef);
            aimTimerRef = null;
        }
        
        // Ensure click listener is attached
        if (gameAreaElement) {
            gameAreaElement.removeEventListener('click', handleAimClick);
            gameAreaElement.addEventListener('click', handleAimClick);
        }
        
        // Spawn initial targets
        spawnMultipleTargets(aimChaosMode.targetCount);
        
        // Start timer
        aimTimerRef = setInterval(updateAimTimer, 1000);
        
        // Initial render
        renderAimGame();
        
        updateAimStatsDisplay();
    }
    
    function renderAimGame() {
        if (!gameAreaElement) return;
        
        gameAreaElement.className = 'multi-game-area aim-game-area';
        gameAreaElement.style.background = 'rgba(0, 0, 0, 0.3)';
        gameAreaElement.style.cursor = 'crosshair';
        
        if (!aimGameStarted) {
            // Clear everything when not started
            gameAreaElement.innerHTML = '';
            const instructionText = document.createElement('div');
            instructionText.className = 'aim-instruction-text';
            instructionText.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 1.5rem;
                font-weight: 700;
                color: white;
                text-align: center;
                text-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
            `;
            instructionText.textContent = 'Click "Play" to start Chaos Mode';
            gameAreaElement.appendChild(instructionText);
            return;
        }
        
        // Game is started - remove instruction text if it exists
        const instructionText = gameAreaElement.querySelector('.aim-instruction-text');
        if (instructionText) {
            instructionText.remove();
        }
        
        // During gameplay: only update elements that changed
        // Remove bullet holes that don't exist anymore (keep only elements with matching IDs)
        const existingHoles = gameAreaElement.querySelectorAll('.bullet-hole');
        existingHoles.forEach(holeEl => {
            const holeId = holeEl.dataset.holeId;
            const stillExists = aimBulletHoles.some(h => h.id == holeId);
            if (!stillExists) {
                holeEl.remove();
            }
        });
        
        // Add new bullet holes
        aimBulletHoles.forEach(hole => {
            const existingHole = gameAreaElement.querySelector(`[data-hole-id="${hole.id}"]`);
            if (!existingHole) {
                const holeElement = document.createElement('div');
                holeElement.className = 'bullet-hole';
                holeElement.dataset.holeId = hole.id;
                holeElement.style.cssText = `
                    position: absolute;
                    left: ${hole.x - 6}px;
                    top: ${hole.y - 6}px;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: ${hole.type === 'hit' 
                        ? 'radial-gradient(circle, #10b981, transparent)' 
                        : 'radial-gradient(circle, #6b7280, transparent)'};
                    pointer-events: none;
                    opacity: 0.7;
                    z-index: 5;
                    animation: bulletHoleFade 2s ease-out;
                `;
                gameAreaElement.appendChild(holeElement);
            }
        });
        
        // Remove targets that no longer exist
        const existingTargets = gameAreaElement.querySelectorAll('.aim-target');
        existingTargets.forEach(targetEl => {
            const targetId = targetEl.dataset.targetId;
            const stillExists = aimTargets.some(t => t.id == targetId);
            if (!stillExists) {
                targetEl.remove();
            }
        });
        
        // Add new targets (only create DOM element once per target)
        aimTargets.forEach(target => {
            const existingTarget = gameAreaElement.querySelector(`[data-target-id="${target.id}"]`);
            if (!existingTarget) {
                const targetElement = document.createElement('div');
                targetElement.className = 'aim-target';
                targetElement.dataset.targetId = target.id;
                targetElement.style.cssText = `
                    position: absolute;
                    left: ${target.x - target.size / 2}px;
                    top: ${target.y - target.size / 2}px;
                    width: ${target.size}px;
                    height: ${target.size}px;
                    border-radius: 50%;
                    background: radial-gradient(circle, #ef4444, #f59e0b);
                    box-shadow: 0 0 20px rgba(239, 68, 68, 0.6);
                    pointer-events: none;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: targetAppear 0.2s ease-out, targetPulse 1s ease-in-out infinite;
                `;
                gameAreaElement.appendChild(targetElement);
            }
        });
    }
    
    function updateAimStatsDisplay() {
        // Use direct DOM updates like quotes banner to prevent blinking
        const timerElement = document.getElementById('aim-timer-display');
        const scoreElement = document.getElementById('aim-score-display');
        const accuracyElement = document.getElementById('aim-accuracy-display');
        const hitsElement = document.getElementById('aim-hits-display');
        const shotsElement = document.getElementById('aim-shots-display');
        
        if (timerElement) timerElement.textContent = aimTimer;
        if (scoreElement) scoreElement.textContent = aimScore;
        if (accuracyElement) accuracyElement.textContent = aimAccuracy;
        if (hitsElement) hitsElement.textContent = aimHits;
        if (shotsElement) shotsElement.textContent = aimShots;
    }
    
    function updateAimScoreDisplay() {
        const highScoreElement = document.getElementById('aim-high-score');
        if (!highScoreElement) return;
        
        const highScore = loadAimHighScore();
        highScoreElement.textContent = `Best: ${highScore > 0 ? highScore : '—'}`;
    }
    
    function showAimResults(isNewHighScore) {
        const resultsElement = document.getElementById('aim-results');
        if (!resultsElement) return;
        
        resultsElement.innerHTML = `
            <div style="text-align: center;">
                <h3 style="margin-bottom: 16px; color: #ef4444;">${isNewHighScore ? '🎉 New High Score!' : 'Game Complete!'}</h3>
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">Score: ${aimScore}</div>
                    <div style="font-size: 1.2rem; margin-top: 8px;">Accuracy: ${aimAccuracy}%</div>
                    <div style="font-size: 0.9rem; margin-top: 4px;">Hits: ${aimHits}/${aimShots}</div>
                </div>
                <button id="aim-play-again-btn" style="padding: 10px 20px; background: linear-gradient(135deg, #ef4444, #f59e0b); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                    Play Again
                </button>
            </div>        `;
        resultsElement.classList.add('active');
        
        // Add click handler for Play Again button
        const playAgainBtn = document.getElementById('aim-play-again-btn');
        if (playAgainBtn) {
            playAgainBtn.onclick = () => {
                hideAimResults();
                resetAimGame();
                startAimGame();
            };
        }
    }
    
    function hideAimResults() {
        const resultsElement = document.getElementById('aim-results');
        if (resultsElement) {
            resultsElement.classList.remove('active');
        }
    }
    
    // FLAPPY BIRD GAME LOGIC
    function initFlappyGame() {
        flappyCanvas = document.getElementById('flappy-canvas');
        if (!flappyCanvas) return;
        flappyCtx = flappyCanvas.getContext('2d');
        flappyHighScore = loadFlappyHighScore();
        resetFlappyGame();
        flappyCanvas.addEventListener('click', handleFlappyInput);
        flappyCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleFlappyInput(); }, { passive: false });
        document.addEventListener('keydown', handleFlappyKey);
    }

    function handleFlappyKey(e) {
        if (currentGame !== 'flappy') return;
        if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); handleFlappyInput(); }
    }

    function handleFlappyInput() {
        if (flappyGameOver) { resetFlappyGame(); startFlappyGame(); return; }
        if (!flappyStarted) { flappyStarted = true; }
        flappyBird.vy = FLAPPY_JUMP;
    }

    function resetFlappyGame() {
        flappyGameRunning = false;
        flappyGameOver = false;
        flappyStarted = false;
        flappyScore = 0;
        flappyFrame = 0;
        flappyBird = { x: 60, y: 150, vy: 0, width: 28, height: 24 };
        flappyPipes = [];
        if (flappyAnimFrame) { cancelAnimationFrame(flappyAnimFrame); flappyAnimFrame = null; }
        updateFlappyScoreDisplay();
        if (flappyCanvas && flappyCtx) drawFlappyFrame();
    }

    function startFlappyGame() {
        resetFlappyGame();
        flappyGameRunning = true;
        flappyLastLogicMs = 0;
        flappyAccumulator = 0;
        flappyLastFrameMs = 0;
        flappyLoop();
    }

    function flappyLoop(now) {
        if (!flappyGameRunning) return;
        flappyAnimFrame = requestAnimationFrame(flappyLoop);
        if (!now) return; // first manual call has no timestamp

        // Fixed timestep: game logic always runs at 60 updates/sec
        if (!flappyLastLogicMs) flappyLastLogicMs = now;
        let delta = now - flappyLastLogicMs;
        flappyLastLogicMs = now;
        if (delta > 100) delta = 100;
        flappyAccumulator += delta;
        while (flappyAccumulator >= FIXED_DT) {
            updateFlappy();
            flappyAccumulator -= FIXED_DT;
        }

        // Render: capped by FPS setting
        const renderElapsed = now - flappyLastFrameMs;
        if (renderElapsed < getFrameInterval()) return;
        flappyLastFrameMs = now - (renderElapsed % getFrameInterval());
        drawFlappyFrame();
    }

    function flappyCurrentSpeed() {
        // +0.05 per pipe, cap 3.2 — gentler scaling for relaxed play
        return Math.min(3.2, FLAPPY_PIPE_SPEED_BASE + flappyScore * 0.05);
    }
    function flappyCurrentGap() {
        // Narrows 2px per pipe cleared, floor 100px — less aggressive after pipe 13
        return Math.max(100, FLAPPY_PIPE_GAP_BASE - flappyScore * 2);
    }

    function updateFlappy() {
        if (!flappyStarted) return;
        flappyFrame++;
        // Gravity
        flappyBird.vy += FLAPPY_GRAVITY;
        flappyBird.y += flappyBird.vy;

        const ch = flappyCanvas.height;
        const groundY = ch - 40;

        // Spawn pipes — each pipe bakes in the gap size at spawn time
        if (flappyFrame % FLAPPY_PIPE_INTERVAL === 0) {
            const gap = flappyCurrentGap();
            const gapY = 60 + Math.random() * (groundY - gap - 80);
            flappyPipes.push({ x: flappyCanvas.width, gapY, gap, scored: false });
        }

        // Move pipes at current dynamic speed
        const spd = flappyCurrentSpeed();
        for (let i = flappyPipes.length - 1; i >= 0; i--) {
            flappyPipes[i].x -= spd;
            if (!flappyPipes[i].scored && flappyPipes[i].x + FLAPPY_PIPE_WIDTH < flappyBird.x) {
                flappyScore++;
                flappyPipes[i].scored = true;
                updateFlappyScoreDisplay();
            }
            if (flappyPipes[i].x + FLAPPY_PIPE_WIDTH < 0) flappyPipes.splice(i, 1);
        }

        // Collision — use each pipe's own baked gap
        for (const pipe of flappyPipes) {
            const inXRange = flappyBird.x + flappyBird.width - 6 > pipe.x &&
                             flappyBird.x + 6 < pipe.x + FLAPPY_PIPE_WIDTH;
            if (inXRange) {
                const g = pipe.gap ?? FLAPPY_PIPE_GAP_BASE;
                if (flappyBird.y < pipe.gapY || flappyBird.y + flappyBird.height > pipe.gapY + g) {
                    endFlappyGame(); return;
                }
            }
        }

        // Ground/ceiling
        if (flappyBird.y + flappyBird.height >= groundY || flappyBird.y < 0) {
            endFlappyGame(); return;
        }
    }

    function drawFlappyFrame() {
        if (!flappyCtx || !flappyCanvas) return;
        const cw = flappyCanvas.width, ch = flappyCanvas.height;
        const groundY = ch - 40;

        // Sky gradient
        const sky = flappyCtx.createLinearGradient(0, 0, 0, groundY);
        sky.addColorStop(0, '#1a1a3e');
        sky.addColorStop(1, '#2d1b69');
        flappyCtx.fillStyle = sky;
        flappyCtx.fillRect(0, 0, cw, ch);

        // Stars (static for perf)
        flappyCtx.fillStyle = 'rgba(255,255,255,0.6)';
        for (let i = 0; i < 30; i++) {
            const sx = (i * 47 + 11) % cw;
            const sy = (i * 31 + 7) % (groundY - 20);
            flappyCtx.fillRect(sx, sy, 1, 1);
        }

        // Draw pipes
        for (const pipe of flappyPipes) {
            // Top pipe
            const topH = pipe.gapY;
            const grad1 = flappyCtx.createLinearGradient(pipe.x, 0, pipe.x + FLAPPY_PIPE_WIDTH, 0);
            grad1.addColorStop(0, '#1aaa1a');
            grad1.addColorStop(0.4, '#22cc22');
            grad1.addColorStop(1, '#0d7a0d');
            flappyCtx.fillStyle = grad1;
            flappyCtx.fillRect(pipe.x, 0, FLAPPY_PIPE_WIDTH, topH);
            // Top cap
            flappyCtx.fillStyle = '#1acc1a';
            flappyCtx.fillRect(pipe.x - 4, topH - 22, FLAPPY_PIPE_WIDTH + 8, 22);
            // Border highlights
            flappyCtx.fillStyle = 'rgba(255,255,255,0.2)';
            flappyCtx.fillRect(pipe.x + 2, 0, 4, topH);

            // Bottom pipe
            const botY = pipe.gapY + (pipe.gap ?? FLAPPY_PIPE_GAP_BASE);
            const botH = groundY - botY;
            const grad2 = flappyCtx.createLinearGradient(pipe.x, 0, pipe.x + FLAPPY_PIPE_WIDTH, 0);
            grad2.addColorStop(0, '#1aaa1a');
            grad2.addColorStop(0.4, '#22cc22');
            grad2.addColorStop(1, '#0d7a0d');
            flappyCtx.fillStyle = grad2;
            flappyCtx.fillRect(pipe.x, botY, FLAPPY_PIPE_WIDTH, botH);
            // Bottom cap
            flappyCtx.fillStyle = '#1acc1a';
            flappyCtx.fillRect(pipe.x - 4, botY, FLAPPY_PIPE_WIDTH + 8, 22);
            flappyCtx.fillStyle = 'rgba(255,255,255,0.2)';
            flappyCtx.fillRect(pipe.x + 2, botY, 4, botH);
        }

        // Ground
        flappyCtx.fillStyle = '#3d8b2a';
        flappyCtx.fillRect(0, groundY, cw, 40);
        flappyCtx.fillStyle = '#4da832';
        flappyCtx.fillRect(0, groundY, cw, 6);

        // Bird
        const bx = flappyBird.x, by = flappyBird.y;
        const bw = flappyBird.width, bh = flappyBird.height;
        const angle = Math.min(Math.max(flappyBird.vy * 0.06, -0.5), 1.0);
        flappyCtx.save();
        flappyCtx.translate(bx + bw / 2, by + bh / 2);
        flappyCtx.rotate(angle);
        // Body
        flappyCtx.fillStyle = '#f0c030';
        flappyCtx.beginPath();
        flappyCtx.ellipse(0, 0, bw / 2, bh / 2, 0, 0, Math.PI * 2);
        flappyCtx.fill();
        // Wing
        flappyCtx.fillStyle = '#e0a820';
        flappyCtx.beginPath();
        flappyCtx.ellipse(-2, 4, 8, 5, -0.3, 0, Math.PI * 2);
        flappyCtx.fill();
        // Eye
        flappyCtx.fillStyle = 'white';
        flappyCtx.beginPath();
        flappyCtx.arc(6, -3, 5, 0, Math.PI * 2);
        flappyCtx.fill();
        flappyCtx.fillStyle = '#111';
        flappyCtx.beginPath();
        flappyCtx.arc(7, -3, 3, 0, Math.PI * 2);
        flappyCtx.fill();
        flappyCtx.fillStyle = 'white';
        flappyCtx.beginPath();
        flappyCtx.arc(8, -4, 1, 0, Math.PI * 2);
        flappyCtx.fill();
        // Beak
        flappyCtx.fillStyle = '#ff8800';
        flappyCtx.beginPath();
        flappyCtx.moveTo(12, 0); flappyCtx.lineTo(18, -2); flappyCtx.lineTo(18, 3); flappyCtx.closePath();
        flappyCtx.fill();
        flappyCtx.restore();

        // Score overlay
        if (flappyGameRunning || flappyGameOver) {
            flappyCtx.fillStyle = 'rgba(255,255,255,0.95)';
            flappyCtx.font = 'bold 28px monospace';
            flappyCtx.textAlign = 'center';
            flappyCtx.fillText(flappyScore, cw / 2, 40);
        }

        // Start prompt
        if (!flappyStarted && !flappyGameOver && flappyGameRunning) {
            flappyCtx.fillStyle = 'rgba(255,255,255,0.85)';
            flappyCtx.font = 'bold 16px sans-serif';
            flappyCtx.textAlign = 'center';
            flappyCtx.fillText('TAP / SPACE to fly!', cw / 2, ch / 2 - 20);
        }

        // Instructions when not started at all
        if (!flappyGameRunning && !flappyGameOver) {
            flappyCtx.fillStyle = 'rgba(255,255,255,0.75)';
            flappyCtx.font = 'bold 14px sans-serif';
            flappyCtx.textAlign = 'center';
            flappyCtx.fillText('Click PLAY to start', cw / 2, ch / 2);
        }

        // Game over overlay
        if (flappyGameOver) {
            flappyCtx.fillStyle = 'rgba(0,0,0,0.55)';
            flappyCtx.fillRect(0, 0, cw, ch);
            flappyCtx.fillStyle = '#fff';
            flappyCtx.font = 'bold 26px sans-serif';
            flappyCtx.textAlign = 'center';
            flappyCtx.fillText('GAME OVER', cw / 2, ch / 2 - 30);
            flappyCtx.font = '16px sans-serif';
            flappyCtx.fillText('Score: ' + flappyScore, cw / 2, ch / 2 + 2);
            flappyCtx.fillText('Best: ' + flappyHighScore, cw / 2, ch / 2 + 24);
            flappyCtx.font = '13px sans-serif';
            flappyCtx.fillStyle = 'rgba(255,255,255,0.7)';
            flappyCtx.fillText('Tap / click to retry', cw / 2, ch / 2 + 52);
        }
    }

    function endFlappyGame() {
        flappyGameRunning = false;
        flappyGameOver = true;
        if (flappyAnimFrame) { cancelAnimationFrame(flappyAnimFrame); flappyAnimFrame = null; }
        const isHighScore = flappyScore > flappyHighScore;
        if (isHighScore) { flappyHighScore = flappyScore; saveFlappyHighScore(flappyHighScore); }
        awardGameXP('flappy', { score: flappyScore, isHighScore });
        updateFlappyScoreDisplay();
        drawFlappyFrame();
    }

    function updateFlappyScoreDisplay() {
        const el = document.getElementById('flappy-current-score');
        const hs = document.getElementById('flappy-high-score');
        if (el) el.textContent = flappyScore;
        if (hs) hs.textContent = 'Best: ' + flappyHighScore;
    }

    // TETRIS GAME LOGIC
    function initTetrisGame() {
        tetrisCanvas = document.getElementById('tetris-canvas');
        if (!tetrisCanvas) return;
        tetrisCtx = tetrisCanvas.getContext('2d');
        tetrisHighScore = loadTetrisHighScore();
        resetTetrisGame();
        document.addEventListener('keydown', handleTetrisKey);
    }

    function handleTetrisKey(e) {
        if (currentGame !== 'tetris' || !tetrisGameRunning || tetrisGameOver) return;
        switch (e.key) {
            case 'ArrowLeft':  e.preventDefault(); moveTetris(-1, 0); break;
            case 'ArrowRight': e.preventDefault(); moveTetris(1, 0); break;
            case 'ArrowDown':  e.preventDefault(); moveTetris(0, 1); break;
            case 'ArrowUp':    e.preventDefault(); rotateTetris(); break;
            case ' ':          e.preventDefault(); hardDropTetris(); break;
        }
    }

    function resetTetrisGame() {
        tetrisBoard = Array.from({ length: TETRIS_ROWS }, () => Array(TETRIS_COLS).fill(0));
        tetrisScore = 0;
        tetrisLines = 0;
        tetrisLevel = 1;
        tetrisGameRunning = false;
        tetrisGameOver = false;
        tetrisCurrentPiece = null;
        tetrisNextPiece = null;
        tetrisBag = []; // reset the 7-bag so each new game starts fresh
        if (tetrisAnimFrame) { cancelAnimationFrame(tetrisAnimFrame); tetrisAnimFrame = null; }
        updateTetrisScoreDisplay();
        if (tetrisCtx) drawTetrisFrame();
    }

    function startTetrisGame() {
        resetTetrisGame();
        tetrisNextPiece = spawnTetrisPiece();
        tetrisCurrentPiece = spawnTetrisPiece();
        tetrisGameRunning = true;
        tetrisLastDrop = performance.now();
        tetrisLastFrameMs = 0;
        tetrisLoop();
    }

    // 7-bag randomizer (modern Tetris standard): every 7 pieces contains exactly
    // one of each shape, eliminating long S/Z or I-piece droughts. This makes the
    // game fair — the previous Math.random() approach could (and did) deal 8+ S/Z
    // pieces in a row with no possible opening, which is purely a luck loss.
    function spawnTetrisPiece() {
        if (tetrisBag.length === 0) {
            tetrisBag = [0, 1, 2, 3, 4, 5, 6];
            for (let i = tetrisBag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tetrisBag[i], tetrisBag[j]] = [tetrisBag[j], tetrisBag[i]];
            }
        }
        const p = TETRIS_PIECES[tetrisBag.pop()];
        return {
            shape: p.shape.map(r => [...r]),
            color: p.color,
            x: Math.floor((TETRIS_COLS - p.shape[0].length) / 2),
            y: 0
        };
    }

    function tetrisLoop(now) {
        if (!tetrisGameRunning) return;
        tetrisAnimFrame = requestAnimationFrame(tetrisLoop);
        if (!now) return; // first manual call has no timestamp

        // Logic: timestamp-based drop interval — already frame-rate independent
        // Softer curve: 30ms per level (was 35), floor 300ms (was 350). Level 21+ caps.
        const dropInterval = Math.max(300, 900 - (tetrisLevel - 1) * 20);
        if (now - tetrisLastDrop >= dropInterval) {
            if (!moveTetris(0, 1)) lockTetrisPiece();
            tetrisLastDrop = now;
        }

        // Render: capped by FPS setting
        const renderElapsed = now - tetrisLastFrameMs;
        if (renderElapsed < getFrameInterval()) return;
        tetrisLastFrameMs = now - (renderElapsed % getFrameInterval());
        drawTetrisFrame();
    }

    function moveTetris(dx, dy) {
        tetrisCurrentPiece.x += dx;
        tetrisCurrentPiece.y += dy;
        if (tetrisCollides()) {
            tetrisCurrentPiece.x -= dx;
            tetrisCurrentPiece.y -= dy;
            return false;
        }
        return true;
    }

    function rotateTetris() {
        const orig = tetrisCurrentPiece.shape;
        const rows = orig.length, cols = orig[0].length;
        const rotated = Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => orig[rows - 1 - r][c]));
        const origShape = tetrisCurrentPiece.shape;
        tetrisCurrentPiece.shape = rotated;
        // Wall kick: try offsets
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
            tetrisCurrentPiece.x += kick;
            if (!tetrisCollides()) return;
            tetrisCurrentPiece.x -= kick;
        }
        tetrisCurrentPiece.shape = origShape; // revert if all kicks fail
    }

    function hardDropTetris() {
        while (moveTetris(0, 1)) {}
        lockTetrisPiece();
    }

    function tetrisCollides() {
        const { shape, x, y } = tetrisCurrentPiece;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const nx = x + c, ny = y + r;
                if (nx < 0 || nx >= TETRIS_COLS || ny >= TETRIS_ROWS) return true;
                if (ny >= 0 && tetrisBoard[ny][nx]) return true;
            }
        }
        return false;
    }

    function lockTetrisPiece() {
        const { shape, x, y, color } = tetrisCurrentPiece;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const ny = y + r;
                if (ny < 0) { endTetrisGame(); return; }
                tetrisBoard[ny][x + c] = color;
            }
        }
        clearTetrisLines();
        tetrisCurrentPiece = tetrisNextPiece;
        tetrisNextPiece = spawnTetrisPiece();
        if (tetrisCollides()) { endTetrisGame(); return; }
        updateTetrisScoreDisplay();
    }

    function clearTetrisLines() {
        let cleared = 0;
        for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
            if (tetrisBoard[r].every(c => c)) {
                tetrisBoard.splice(r, 1);
                tetrisBoard.unshift(Array(TETRIS_COLS).fill(0));
                cleared++;
                r++; // recheck same row index
            }
        }
        if (cleared > 0) {
            const pts = [0, 100, 300, 500, 800];
            tetrisScore += (pts[cleared] || 800) * tetrisLevel;
            tetrisLines += cleared;
            tetrisLevel = Math.floor(tetrisLines / 10) + 1;
        }
    }

    function endTetrisGame() {
        tetrisGameRunning = false;
        tetrisGameOver = true;
        if (tetrisAnimFrame) { cancelAnimationFrame(tetrisAnimFrame); tetrisAnimFrame = null; }
        const isHighScore = tetrisScore > tetrisHighScore;
        if (isHighScore) { tetrisHighScore = tetrisScore; saveTetrisHighScore(tetrisHighScore); }
        awardGameXP('tetris', { score: tetrisScore, lines: tetrisLines, level: tetrisLevel, isHighScore });
        updateTetrisScoreDisplay();
        drawTetrisFrame();
    }

    function drawTetrisFrame() {
        if (!tetrisCtx || !tetrisCanvas) return;
        const ctx = tetrisCtx;
        const cw = tetrisCanvas.width, ch = tetrisCanvas.height;
        const boardW = TETRIS_COLS * TETRIS_CELL; // 180px
        const boardH = TETRIS_ROWS * TETRIS_CELL; // 360px
        const offX = Math.floor((cw - boardW) / 2); // 94px — centers horizontally
        const offY = Math.floor((ch - boardH) / 2); // 4px — centers vertically

        // --- Background ---
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, cw, ch);

        // --- Side gutter purple neon gradient glow ---
        const leftGrad = ctx.createLinearGradient(0, 0, offX, 0);
        leftGrad.addColorStop(0, 'rgba(124,58,237,0)');
        leftGrad.addColorStop(1, 'rgba(124,58,237,0.22)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, offX, ch);

        const rightGrad = ctx.createLinearGradient(offX + boardW, 0, cw, 0);
        rightGrad.addColorStop(0, 'rgba(124,58,237,0.22)');
        rightGrad.addColorStop(1, 'rgba(124,58,237,0)');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(offX + boardW, 0, cw - (offX + boardW), ch);

        // --- Board border glow ---
        ctx.save();
        ctx.shadowColor = '#7c3aed';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(167,139,250,0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(offX - 1, offY - 1, boardW + 2, boardH + 2);
        ctx.restore();

        // --- Grid lines (board area only) ---
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        for (let c = 0; c <= TETRIS_COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(offX + c * TETRIS_CELL, offY);
            ctx.lineTo(offX + c * TETRIS_CELL, offY + boardH);
            ctx.stroke();
        }
        for (let r = 0; r <= TETRIS_ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(offX, offY + r * TETRIS_CELL);
            ctx.lineTo(offX + boardW, offY + r * TETRIS_CELL);
            ctx.stroke();
        }

        // --- Locked board cells ---
        for (let r = 0; r < TETRIS_ROWS; r++) {
            for (let c = 0; c < TETRIS_COLS; c++) {
                if (tetrisBoard[r][c]) drawTetrisCell(ctx, offX, offY, c, r, tetrisBoard[r][c]);
            }
        }

        // --- Ghost piece: tinted fill + inner glow ring + 2px border stroke ---
        if (tetrisCurrentPiece && tetrisGameRunning) {
            const ghost = { ...tetrisCurrentPiece, shape: tetrisCurrentPiece.shape.map(row => [...row]) };
            while (true) {
                ghost.y++;
                const saved = tetrisCurrentPiece;
                tetrisCurrentPiece = ghost;
                const collided = tetrisCollides();
                tetrisCurrentPiece = saved;
                if (collided) { ghost.y--; break; }
            }
            const { shape, x, y, color } = ghost;
            for (let r = 0; r < shape.length; r++) {
                for (let c2 = 0; c2 < shape[r].length; c2++) {
                    if (!shape[r][c2]) continue;
                    const px = offX + (x + c2) * TETRIS_CELL + 1;
                    const py = offY + (y + r)  * TETRIS_CELL + 1;
                    const cs = TETRIS_CELL - 2;
                    // Layer 1 — piece-color tinted fill at ~16% opacity
                    ctx.fillStyle = color + '29';
                    ctx.fillRect(px, py, cs, cs);
                    // Layer 2 — inner glow ring at ~33% opacity (2px edges)
                    ctx.fillStyle = color + '54';
                    ctx.fillRect(px,          py,          cs, 2);
                    ctx.fillRect(px,          py + cs - 2, cs, 2);
                    ctx.fillRect(px,          py,          2,  cs);
                    ctx.fillRect(px + cs - 2, py,          2,  cs);
                    // Layer 3 — full-brightness colored border stroke
                    ctx.save();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(px + 0.75, py + 0.75, cs - 1.5, cs - 1.5);
                    ctx.restore();
                }
            }
        }

        // --- Current piece ---
        if (tetrisCurrentPiece) {
            const { shape, x, y, color } = tetrisCurrentPiece;
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (!shape[r][c]) continue;
                    drawTetrisCell(ctx, offX, offY, x + c, y + r, color);
                }
            }
        }

        // --- Next-piece preview (right gutter) ---
        if (tetrisNextPiece && tetrisGameRunning) {
            const gutterX = offX + boardW;        // 274
            const gutterW = cw - gutterX;          // 94
            const previewCell = 14;                // smaller than board cell (18)
            const previewW = 4 * previewCell;      // 56 (fits 4-wide I piece)
            const previewH = 4 * previewCell;      // 56
            const boxPad = 8;
            const boxX = gutterX + Math.floor((gutterW - previewW - boxPad * 2) / 2);
            const boxY = offY + 20;

            // Label
            ctx.fillStyle = 'rgba(167,139,250,0.85)';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('NEXT', boxX + (previewW + boxPad * 2) / 2, boxY - 6);

            // Box background + border
            ctx.fillStyle = 'rgba(20,15,40,0.7)';
            ctx.fillRect(boxX, boxY, previewW + boxPad * 2, previewH + boxPad * 2);
            ctx.save();
            ctx.shadowColor = '#7c3aed';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = 'rgba(167,139,250,0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, boxY, previewW + boxPad * 2, previewH + boxPad * 2);
            ctx.restore();

            // Center the piece inside the preview box
            const { shape, color } = tetrisNextPiece;
            const pieceW = shape[0].length * previewCell;
            const pieceH = shape.length * previewCell;
            const pieceOffX = boxX + boxPad + Math.floor((previewW - pieceW) / 2);
            const pieceOffY = boxY + boxPad + Math.floor((previewH - pieceH) / 2);
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (!shape[r][c]) continue;
                    const px = pieceOffX + c * previewCell;
                    const py = pieceOffY + r * previewCell;
                    const grad = ctx.createLinearGradient(px, py, px + previewCell, py + previewCell);
                    grad.addColorStop(0, color);
                    grad.addColorStop(1, shadeColor(color, -40));
                    ctx.fillStyle = grad;
                    ctx.fillRect(px + 1, py + 1, previewCell - 2, previewCell - 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(px + 2, py + 2, previewCell - 8, 2);
                }
            }
        }

        // --- Idle overlay ---
        if (!tetrisGameRunning && !tetrisGameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(offX, offY, boardW, boardH);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = 'bold 15px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click PLAY to start', cw / 2, ch / 2 - 10);
            ctx.font = '11px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillText('← → Move  ↑ Rotate  ↓ Drop', cw / 2, ch / 2 + 12);
            ctx.fillText('Space = Hard Drop', cw / 2, ch / 2 + 28);
        }

        // --- Game over overlay ---
        if (tetrisGameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(offX, offY, boardW, boardH);
            ctx.fillStyle = '#f55';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', cw / 2, ch / 2 - 30);
            ctx.fillStyle = '#fff';
            ctx.font = '14px sans-serif';
            ctx.fillText('Score: ' + tetrisScore, cw / 2, ch / 2);
            ctx.fillText('Lines: ' + tetrisLines + '  Lvl: ' + tetrisLevel, cw / 2, ch / 2 + 20);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText('Best: ' + tetrisHighScore, cw / 2, ch / 2 + 42);
        }
    }

    function drawTetrisCell(ctx, offX, offY, c, r, color) {
        const x = offX + c * TETRIS_CELL;
        const y = offY + r * TETRIS_CELL;
        const grad = ctx.createLinearGradient(x, y, x + TETRIS_CELL, y + TETRIS_CELL);
        grad.addColorStop(0, color);
        grad.addColorStop(1, shadeColor(color, -40));
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, TETRIS_CELL - 2, TETRIS_CELL - 2);
        // Highlight shimmer
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x + 2, y + 2, TETRIS_CELL - 8, 3);
    }

    function shadeColor(hex, amt) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amt));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
        const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    function updateTetrisScoreDisplay() {
        const el = document.getElementById('tetris-score');
        const ls = document.getElementById('tetris-lines');
        const lv = document.getElementById('tetris-level');
        const hs = document.getElementById('tetris-high-score');
        if (el) el.textContent = tetrisScore;
        if (ls) ls.textContent = tetrisLines;
        if (lv) lv.textContent = tetrisLevel;
        if (hs) hs.textContent = 'Best: ' + tetrisHighScore;
    }

    // PRAYER COUNTER LOGIC

    function initPrayerCounter() {
        prayerCount = loadPrayerCount();
        updatePrayerDisplay();
    }

    function prayerIncrement() {
        if (prayerCount >= 999999) return;
        prayerCount++;
        savePrayerCount(prayerCount);
        updatePrayerDisplay();
        const btn = document.querySelector('.prayer-plus-btn');
        if (btn) {
            btn.classList.add('prayer-tap-flash');
            setTimeout(() => btn.classList.remove('prayer-tap-flash'), 150);
        }

        // Devoted achievement
        if (xpSystemReady && prayerCount >= 1000 && !userXP.achievements.includes('meditative')) {
            unlockAchievement('meditative');
        }
    }

    function prayerReset() {
        if (!confirm('Reset prayer counter to 0?')) return;
        prayerCount = 0;
        savePrayerCount(0);
        updatePrayerDisplay();
    }

    function updatePrayerDisplay() {
        const el = document.getElementById('prayer-count-display');
        if (el) el.textContent = String(prayerCount).padStart(6, '0');
        const hdr = document.getElementById('prayer-hdr-count');
        if (hdr) hdr.textContent = prayerCount;
    }

    // ═══════════════════════════════════════════════════════════════════
    // LUDO GAME
    // ═══════════════════════════════════════════════════════════════════
    // 15×15 grid, 20px cells → a 300×300 board inside a 344×416 canvas,
    // leaving 58px HUD strips top and bottom. Everything is canvas-drawn so the
    // ⛶ Max modal (which relocates only the <canvas>) keeps the whole UI.

    const LUDO_GRID       = 15;
    const LUDO_CELL       = 20;
    const LUDO_BOARD      = LUDO_GRID * LUDO_CELL;            // 300
    // 58 keeps the dice's turn-ring (r=19) clear of the board frame, which is
    // inset 8px above LUDO_BOARD_Y. At 52 the ring clipped the frame.
    const LUDO_STRIP_H    = 58;                               // HUD strip, top and bottom
    // 344 rather than Pool's 368: the board then fills 87% of the width instead
    // of 81%, which matters in a ~300px panel column. Still leaves room for two
    // 122px player chips either side of the dice.
    const LUDO_CANVAS_W   = 344;
    const LUDO_CANVAS_H   = LUDO_BOARD + LUDO_STRIP_H * 2;    // 404
    const LUDO_BOARD_X    = (LUDO_CANVAS_W - LUDO_BOARD) / 2; // 34
    const LUDO_BOARD_Y    = LUDO_STRIP_H;

    const LUDO_TURN_CLOCK   = 20;    // seconds per turn
    const LUDO_DICE_MS      = 620;   // dice tumble
    const LUDO_HOP_MS       = 95;    // per square hopped
    const LUDO_AUTOPLAY_MS  = 420;   // pause before auto-playing a forced move
    const LUDO_PASS_MS      = 850;   // "no moves" banner dwell
    const LUDO_CPU_THINK_MS = 520;   // CPU hesitation, so it reads as deliberate

    // The 52-square shared ring, walked clockwise from Blue's start square.
    // Built from segments rather than a 52-entry literal so the walk is legible
    // and each turn of the cross is checkable by eye.
    //
    // NOTE: four consecutive pairs are DIAGONAL neighbours, not orthogonal —
    // 4→5, 17→18, 30→31 and 43→44. That is correct: the track wraps around the
    // outer corner of each 6×6 base (e.g. (6,5)→(5,6) rounds Blue's corner at
    // (5,5)), which is how a physical Ludo board is laid out. Anything that
    // walks the ring cell-by-cell — the hop animation especially — must tolerate
    // a diagonal step and must not assume |Δr|+|Δc| === 1.
    const LUDO_RING = (() => {
        const seg = (r0, c0, r1, c1) => {
            const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
            const n  = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
            const out = [];
            for (let i = 0; i <= n; i++) out.push({ r: r0 + dr * i, c: c0 + dc * i });
            return out;
        };
        return [
            ...seg( 6,  1,  6,  5),   //  0–4   Blue start, right along the left arm
            ...seg( 5,  6,  0,  6),   //  5–10  up the top arm's left column
            ...seg( 0,  7,  0,  7),   //  11    Red's gate
            ...seg( 0,  8,  5,  8),   //  12–17 down the top arm's right column
            ...seg( 6,  9,  6, 14),   //  18–23 right along the right arm's top row
            ...seg( 7, 14,  7, 14),   //  24    Green's gate
            ...seg( 8, 14,  8,  9),   //  25–30 left along the right arm's bottom row
            ...seg( 9,  8, 14,  8),   //  31–36 down the bottom arm's right column
            ...seg(14,  7, 14,  7),   //  37    Yellow's gate
            ...seg(14,  6,  9,  6),   //  38–43 up the bottom arm's left column
            ...seg( 8,  5,  8,  0),   //  44–49 left along the left arm's bottom row
            ...seg( 7,  0,  7,  0),   //  50    Blue's gate
            ...seg( 6,  0,  6,  0),   //  51    last square before Blue's start
        ];
    })();

    // Turn order is clockwise: Blue(TL) → Red(TR) → Green(BR) → Yellow(BL).
    // startIndex values are 13 apart, so every colour walks 51 shared squares
    // (steps 0–50) and arrives at its own gate exactly one step before its home
    // column — verified: (start + 50) % 52 is the gate cell for all four.
    const LUDO_COLORS = [
        {
            key: 'blue',  label: 'Blue',  hex: '#2196f3', deep: '#1565c0',
            startIndex: 0,
            quad:      { r0:  0, c0:  0, r1:  6, c1:  6 },
            basePanel: { r0:  1, c0:  1, r1:  5, c1:  5 },
            baseSlots: [{ r: 2, c: 2 }, { r: 2, c: 4 }, { r: 4, c: 2 }, { r: 4, c: 4 }],
            homeCol:   [{ r: 7, c: 1 }, { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 }],
            apex:      [{ r: 6, c: 6 }, { r: 9, c: 6 }],   // left triangle
        },
        {
            key: 'red',   label: 'Red',   hex: '#f44336', deep: '#c62828',
            startIndex: 13,
            quad:      { r0:  0, c0:  9, r1:  6, c1: 15 },
            basePanel: { r0:  1, c0: 10, r1:  5, c1: 14 },
            baseSlots: [{ r: 2, c: 11 }, { r: 2, c: 13 }, { r: 4, c: 11 }, { r: 4, c: 13 }],
            homeCol:   [{ r: 1, c: 7 }, { r: 2, c: 7 }, { r: 3, c: 7 }, { r: 4, c: 7 }, { r: 5, c: 7 }],
            apex:      [{ r: 6, c: 6 }, { r: 6, c: 9 }],   // top triangle
        },
        {
            key: 'green', label: 'Green', hex: '#4caf50', deep: '#2e7d32',
            startIndex: 26,
            quad:      { r0:  9, c0:  9, r1: 15, c1: 15 },
            basePanel: { r0: 10, c0: 10, r1: 14, c1: 14 },
            baseSlots: [{ r: 11, c: 11 }, { r: 11, c: 13 }, { r: 13, c: 11 }, { r: 13, c: 13 }],
            homeCol:   [{ r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 }, { r: 7, c: 9 }],
            apex:      [{ r: 6, c: 9 }, { r: 9, c: 9 }],   // right triangle
        },
        {
            key: 'yellow', label: 'Yellow', hex: '#fdd835', deep: '#f9a825',
            startIndex: 39,
            quad:      { r0:  9, c0:  0, r1: 15, c1:  6 },
            basePanel: { r0: 10, c0:  1, r1: 14, c1:  5 },
            baseSlots: [{ r: 11, c: 2 }, { r: 11, c: 4 }, { r: 13, c: 2 }, { r: 13, c: 4 }],
            homeCol:   [{ r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 }, { r: 9, c: 7 }],
            apex:      [{ r: 9, c: 6 }, { r: 9, c: 9 }],   // bottom triangle
        },
    ];

    // 4 start squares + 4 ★ squares, each 8 past a start. No capture here.
    const LUDO_SAFE_RING = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

    // ringIndex → colour index, for the four coloured start squares.
    const LUDO_START_OWNER = (() => {
        const m = {};
        LUDO_COLORS.forEach((col, ci) => { m[col.startIndex] = ci; });
        return m;
    })();

    const LUDO_HOME_STEP = 56;   // 51 ring squares (0–50) + 5 home column (51–55) + centre

    // Dice ACCUMULATE before anything moves: a 6 buys another roll, not another
    // turn. A sequence therefore hands the player up to three values to spend
    // however they choose — 6,6,5 can release two tokens and advance a third.
    // Capped at 3: with threeSixes on the third 6 forfeits anyway, and with it
    // off this cap is the only thing stopping the sequence running forever.
    const LUDO_MAX_DICE = 3;

    // ── State ──────────────────────────────────────────────────────────
    let ludoActive    = [0, 2];   // colour indices in play; default 2P diagonal
    let ludoTokens    = [];       // [{ ci, i, step, inBase, home }]
    let ludoTurn      = 0;        // index into ludoActive
    let ludoMessage   = '';
    let ludoCpuTier   = 'normal';
    let ludoMode      = 'cpu2';   // cpu2 | pvp2 | pvp3 | pvp4
    let ludoDebugRing = false;    // harness-only: overlay ring indices

    let ludoRoll       = 0;       // 0 = not rolled yet this turn
    let ludoSixStreak  = 0;       // consecutive 6s by the player to move
    let ludoGameOver   = false;
    let ludoPlacements = [];      // colour indices, in finishing order
    let ludoStats      = {};      // ci -> { captures, lost }

    // Every face rolled by the player currently to move, and a snapshot of the
    // turn that just ended. Without this a roll that produces no legal move —
    // the common "needed a 6, got a 4" case — passes the turn with nothing on
    // screen to say what was rolled. The HUD shows the snapshot as dimmed dice.
    let ludoTurnRolls  = [];      // faces rolled so far this turn
    let ludoRecap      = null;    // { ci, faces } from the last completed turn

    // Values rolled this sequence and not yet spent, and whether anything this
    // turn (a capture or a token reaching home) has earned a fresh sequence.
    let ludoPool       = [];
    let ludoTurnEarned = false;

    function ludoResetTokens() {
        ludoTokens = [];
        ludoStats  = {};
        ludoActive.forEach(ci => {
            ludoStats[ci] = { captures: 0, lost: 0 };
            for (let i = 0; i < 4; i++) {
                ludoTokens.push({ ci, i, step: -1, inBase: true, home: false });
            }
        });
        ludoRoll       = 0;
        ludoSixStreak  = 0;
        ludoGameOver   = false;
        ludoPlacements = [];
        ludoTurnRolls  = [];
        ludoRecap      = null;
        ludoPool       = [];
        ludoTurnEarned = false;
    }

    // ── Rules ──────────────────────────────────────────────────────────
    // Read straight off userPreferences so the ⚙️ toggles take effect mid-match.
    // Defaults match Ludo Star: blocks / three-sixes / exact-home on, free
    // release off. `typeof` guard keeps the headless tests independent of the host.
    function ludoRules() {
        const P = (typeof userPreferences === 'object' && userPreferences) ? userPreferences : {};
        return {
            blocks:      P.ludoBlocks      !== false,
            // Whether a block also seals the track. On (the Ludo Star rule) a
            // pair sitting directly in front of a token leaves it with no legal
            // roll at all until the pair moves; off, you may hop over a block
            // but still may not land on it.
            blockPassing: P.ludoBlockPassing !== false,
            threeSixes:  P.ludoThreeSixes  !== false,
            exactHome:   P.ludoExactHome   !== false,
            freeRelease: P.ludoFreeRelease === true,
        };
    }

    function ludoRollDice() {
        return 1 + Math.floor(Math.random() * 6);
    }

    // Ring squares carrying 2+ tokens of one colour other than `forCi`.
    // Counted per (colour, square) because two different colours may legitimately
    // share a safe square — that pair is not a block.
    //
    // Safe squares can NEVER block. A ★/start square is shared ground: nothing
    // can be captured there, so several colours are expected to stand on it. If
    // a pair there also sealed the track, a colour's own start square — which it
    // refills every time it releases a token — would become a permanent wall
    // across the one route every opponent must take. In PvCPU that stranded
    // Blue's tokens on Green's doorstep until they were picked off: from ring 24,
    // only a roll of 1 was ever legal.
    function ludoBlockRings(forCi) {
        const per = {};
        ludoTokens.forEach(t => {
            if (t.inBase || t.home || t.ci === forCi) return;
            const ri = ludoStepToRing(t.ci, t.step);
            if (ri < 0 || LUDO_SAFE_RING.has(ri)) return;
            const k = t.ci + ':' + ri;
            per[k] = (per[k] || 0) + 1;
        });
        const blocked = new Set();
        Object.keys(per).forEach(k => {
            if (per[k] >= 2) blocked.add(parseInt(k.split(':')[1], 10));
        });
        return blocked;
    }

    // Opponent tokens sitting on the square `ci` is about to land on. Empty on a
    // ★/start square and anywhere off the shared ring — home columns are private.
    function ludoCaptures(ci, to) {
        if (to > 50) return [];
        const ri = ludoStepToRing(ci, to);
        if (LUDO_SAFE_RING.has(ri)) return [];
        return ludoTokens.filter(t =>
            t.ci !== ci && !t.inBase && !t.home && ludoStepToRing(t.ci, t.step) === ri);
    }

    // Every move `ci` may legally make with `roll`.
    // { token, from, to, release, captures, finishes }
    function ludoLegalMoves(ci, roll) {
        if (!roll) return [];
        const R = ludoRules();
        const blocked = R.blocks ? ludoBlockRings(ci) : new Set();
        const moves = [];

        ludoTokens.forEach(t => {
            if (t.ci !== ci || t.home) return;

            let to;
            if (t.inBase) {
                if (roll !== 6 && !R.freeRelease) return;
                to = 0;
            } else {
                to = t.step + roll;
                if (to > LUDO_HOME_STEP) {
                    if (R.exactHome) return;    // must land exactly on 56
                    to = LUDO_HOME_STEP;        // otherwise an overshoot still finishes
                }
                // A block bars passage too, unless jumping is allowed. Only ring
                // squares strictly after the current one and up to the
                // destination count; home-column squares (>50) are never blocked.
                // Landing is barred either way, by the check just below.
                if (R.blockPassing) {
                    for (let s = t.step + 1; s <= Math.min(to, 50); s++) {
                        if (blocked.has(ludoStepToRing(ci, s))) return;
                    }
                }
            }
            if (to <= 50 && blocked.has(ludoStepToRing(ci, to))) return;

            moves.push({
                token: t, from: t.inBase ? -1 : t.step, to,
                release:  !!t.inBase,
                captures: to === LUDO_HOME_STEP ? [] : ludoCaptures(ci, to),
                finishes: to === LUDO_HOME_STEP,
            });
        });
        return moves;
    }

    // Commits a move and returns what it earned. Does not advance the turn.
    function ludoApplyMove(move) {
        const t  = move.token;
        const ci = t.ci;

        t.inBase = false;
        t.step   = move.to;
        t.home   = move.to === LUDO_HOME_STEP;

        const caps = move.captures || [];
        caps.forEach(o => {
            o.inBase = true; o.step = -1; o.home = false;
            if (ludoStats[o.ci]) ludoStats[o.ci].lost++;
        });
        if (ludoStats[ci]) ludoStats[ci].captures += caps.length;

        // Record finishing order the first time a colour gets all four home.
        if (t.home && ludoTokensHome(ci) === 4 && ludoPlacements.indexOf(ci) === -1) {
            ludoPlacements.push(ci);
        }
        // Spend the die this move used. Moves built by ludoLegalMoves alone
        // carry no value, so direct callers (tests) are unaffected.
        if (move.value) ludoConsumeValue(move.value);
        return { captured: caps.length, finished: t.home };
    }

    const ludoTokensHome = ci => ludoTokens.filter(t => t.ci === ci && t.home).length;

    // ── Dice pool ──────────────────────────────────────────────────────
    // Every legal (token, value) pair across the distinct values still unspent.
    // Each move carries the value it would consume.
    function ludoPoolMoves(ci) {
        const seen = {}, out = [];
        ludoPool.forEach(v => {
            if (seen[v]) return;
            seen[v] = true;
            ludoLegalMoves(ci, v).forEach(m => { m.value = v; out.push(m); });
        });
        return out;
    }

    // Which unspent values this particular token could legally use. Drives the
    // tap-a-token popover.
    function ludoValuesForToken(ci, token) {
        const out = [];
        ludoPoolMoves(ci).forEach(m => {
            if (m.token === token && out.indexOf(m.value) === -1) out.push(m.value);
        });
        return out.sort((a, b) => a - b);
    }

    function ludoConsumeValue(v) {
        const i = ludoPool.indexOf(v);
        if (i !== -1) ludoPool.splice(i, 1);
    }

    // A 6 no longer grants an extra turn — it granted an extra die back in the
    // roll phase. Only a capture or a token reaching home buys a fresh sequence.
    function ludoEarnsAnotherRoll(result) {
        return !!(result && (result.captured > 0 || result.finished));
    }

    function ludoAdvanceTurn() {
        // The turn is handing over, so freeze what this player rolled. Extra
        // sequences never reach here, which is why a 6,6,5 turn recaps as all three.
        if (ludoActive.length && ludoTurnRolls.length) {
            ludoRecap = { ci: ludoActive[ludoTurn], faces: ludoTurnRolls.slice() };
        }
        ludoTurnRolls  = [];
        ludoPool       = [];
        ludoTurnEarned = false;

        ludoSixStreak = 0;
        ludoRoll = 0;
        if (ludoActive.length === 0) return;
        let guard = 0;
        do {
            ludoTurn = (ludoTurn + 1) % ludoActive.length;
        } while (ludoTokensHome(ludoActive[ludoTurn]) === 4 && ++guard < ludoActive.length);
    }

    // The match is over as soon as only one player still has tokens to bring home
    // (or, in 2P, as soon as the first player finishes).
    function ludoCheckGameOver() {
        const unfinished = ludoActive.filter(ci => ludoTokensHome(ci) < 4);
        if (ludoPlacements.length === 0) return false;
        return unfinished.length <= 1;
    }

    // ── Turn flow ──────────────────────────────────────────────────────
    // Split out from the animation layer so it can be exercised headlessly.
    // Call ludoRegisterRoll when the dice settles, then ludoFinishMove once the
    // hop animation for the chosen move has completed.

    // Banks the settled face. Returns one of:
    //   { rollAgain } — it was a 6, so roll once more before moving anything
    //   { voided }    — three sixes; the whole sequence is forfeited
    //   { passed }    — nothing in the pool can be played, turn handed over
    //   { moves }     — the pool is final, here is everything playable
    function ludoRegisterRoll(ci, roll) {
        const R = ludoRules();
        const done = (extra) => Object.assign(
            { voided: false, rollAgain: false, passed: false, moves: [] }, extra);

        ludoRoll = roll;
        // Recorded before the three-sixes check so the voided third 6 still
        // shows up in the recap — it was rolled, it just did not count.
        ludoTurnRolls.push(roll);
        ludoSixStreak = roll === 6 ? ludoSixStreak + 1 : 0;

        // Three consecutive 6s forfeit the whole sequence, including any values
        // already banked. That is the risk that balances accumulating.
        if (R.threeSixes && ludoSixStreak >= 3) {
            ludoPool = [];
            ludoRoll = 0;
            ludoAdvanceTurn();
            return done({ voided: true });
        }

        ludoPool.push(roll);

        // A 6 buys another die rather than forcing an immediate move.
        if (roll === 6 && ludoPool.length < LUDO_MAX_DICE) {
            return done({ rollAgain: true });
        }

        const moves = ludoPoolMoves(ci);
        if (moves.length === 0) {
            ludoPool = [];
            ludoRoll = 0;
            ludoAdvanceTurn();
            return done({ passed: true });
        }
        return done({ moves });
    }

    // Called once a move has been committed. Decides whether the player keeps
    // spending the pool, earns a fresh sequence, or hands over.
    function ludoFinishMove(result) {
        if (ludoEarnsAnotherRoll(result)) ludoTurnEarned = true;

        if (ludoCheckGameOver()) {
            ludoGameOver = true;
            ludoPool = [];
            ludoRoll = 0;
            return { gameOver: true, continueTurn: false, extraRoll: false, moves: [] };
        }

        const moves = ludoPool.length ? ludoPoolMoves(ludoActive[ludoTurn]) : [];
        if (moves.length) {
            return { gameOver: false, continueTurn: true, extraRoll: false, moves };
        }

        // Pool spent, or whatever is left of it is unplayable.
        ludoPool = [];
        ludoRoll = 0;
        if (ludoTurnEarned) {
            ludoTurnEarned = false;
            ludoSixStreak  = 0;      // a captured-into sequence starts clean
            return { gameOver: false, continueTurn: false, extraRoll: true, moves: [] };
        }
        ludoAdvanceTurn();
        return { gameOver: false, continueTurn: false, extraRoll: false, moves: [] };
    }

    // ── Modes ──────────────────────────────────────────────────────────
    // PvCPU is 2P only — the scorer is written against a single opponent.
    // 2P uses the diagonal pair so neither side starts closer to the other.
    const LUDO_MODES = ['cpu2', 'pvp2', 'pvp3', 'pvp4'];
    const LUDO_MODE_COLORS = {
        cpu2: [0, 2],
        pvp2: [0, 2],
        pvp3: [0, 1, 2],
        pvp4: [0, 1, 2, 3],
    };
    const LUDO_MODE_LABEL = {
        cpu2: 'PvCPU', pvp2: 'PvP 2P', pvp3: 'PvP 3P', pvp4: 'PvP 4P',
    };

    // In PvCPU the human is Blue and the CPU is Green.
    const LUDO_HUMAN_CI = 0;
    const ludoIsCPUSeat = ci => ludoMode === 'cpu2' && ci !== LUDO_HUMAN_CI;

    function ludoSetMode(m) {
        if (LUDO_MODE_COLORS[m] === undefined) return;
        ludoMode   = m;
        ludoActive = LUDO_MODE_COLORS[m].slice();
        ludoTurn   = 0;
        ludoResetTokens();
    }

    function cycleLudoMode() {
        ludoSetMode(LUDO_MODES[(LUDO_MODES.indexOf(ludoMode) + 1) % LUDO_MODES.length]);
        return ludoMode;
    }

    // ── CPU ────────────────────────────────────────────────────────────
    // Difficulty adapts to the player's recorded win rate against the CPU, so a
    // struggling player is eased off and a dominant one is pushed. Locked in at
    // match start (ludoCpuTier) so it cannot shift mid-game.
    function ludoDifficultyTier(rec) {
        const wins = (rec && rec.wins) || 0, losses = (rec && rec.losses) || 0;
        const games = wins + losses;
        if (games < 5) return 'normal';        // too small a sample to judge
        const rate = wins / games;
        if (rate < 0.40) return 'easy';
        if (rate <= 0.65) return 'normal';
        return 'hard';
    }

    // Would landing on ring square `ri` put us within a single roll of an
    // opponent sitting behind us? Only counts opponents that could actually
    // reach it — one already past its gate turns inward instead.
    function ludoUnderThreat(ci, ri) {
        return ludoTokens.some(t => {
            if (t.ci === ci || t.inBase || t.home) return false;
            const ori = ludoStepToRing(t.ci, t.step);
            if (ori < 0) return false;
            const gap = (ri - ori + 52) % 52;
            if (gap < 1 || gap > 6) return false;
            return t.step + gap <= 50;
        });
    }

    function ludoScoreMove(ci, move, tier) {
        let s = 0;
        if (move.captures.length) s += 120 * move.captures.length;
        if (move.finishes)        s += 100;
        if (move.release)         s += 30;
        s += 0.4 * move.to;                       // general forward progress

        if (move.to <= 50) {
            const ri = ludoStepToRing(ci, move.to);
            if (LUDO_SAFE_RING.has(ri)) s += 45;
            const pairsUp = ludoTokens.some(t =>
                t.ci === ci && t !== move.token && !t.inBase && !t.home &&
                ludoStepToRing(t.ci, t.step) === ri);
            if (pairsUp) s += 35;                 // forms a block

            // Only 'hard' looks at what the move exposes; 'normal' plays the
            // same priorities but blind to danger.
            if (tier === 'hard' && !LUDO_SAFE_RING.has(ri) && ludoUnderThreat(ci, ri)) {
                s -= 60;
            }
        }
        return s;
    }

    function ludoAIChooseMove(ci, moves, tier) {
        if (!moves || moves.length === 0) return null;
        if (moves.length === 1) return moves[0];
        if (tier === 'easy' && Math.random() < 0.70) {
            return moves[Math.floor(Math.random() * moves.length)];
        }
        let best = moves[0], bestScore = -Infinity;
        moves.forEach(m => {
            const s = ludoScoreMove(ci, m, tier);
            if (s > bestScore) { bestScore = s; best = m; }
        });
        return best;
    }

    // Final standings: finishers in the order they finished, then everyone else
    // ranked by tokens home, then by total distance travelled.
    function ludoStandings() {
        const rest = ludoActive
            .filter(ci => ludoPlacements.indexOf(ci) === -1)
            .map(ci => ({
                ci,
                home:  ludoTokensHome(ci),
                steps: ludoTokens.filter(t => t.ci === ci)
                                 .reduce((n, t) => n + Math.max(0, t.step), 0),
            }))
            .sort((a, b) => b.home - a.home || b.steps - a.steps)
            .map(x => x.ci);
        return ludoPlacements.concat(rest);
    }

    // -- Step ? board cell ----------------------------------------------
    // Pure position logic, kept here because the rules engine depends on it.
    // Everything pixel-based lives in ludo-ui.js.

    // Returns null at step 56 (the centre), which occupies no single cell.
    function ludoStepToCell(ci, step) {
        const col = LUDO_COLORS[ci];
        if (step < 0)   return null;                                   // still in base
        if (step <= 50) return LUDO_RING[(col.startIndex + step) % 52];
        if (step <= 55) return col.homeCol[step - 51];
        return null;                                                   // home
    }

    // step ? ring index, or -1 when off the shared ring (base/home column/home).
    function ludoStepToRing(ci, step) {
        if (step < 0 || step > 50) return -1;
        return (LUDO_COLORS[ci].startIndex + step) % 52;
    }

    // ═══════════════════════════════════════════════════════════════════
    // LUDO — presentation and interaction
    // ═══════════════════════════════════════════════════════════════════
    // Concatenated after ludo-core.js. Everything here is canvas-drawn: the ⛶ Max
    // modal relocates only the <canvas>, so a DOM-based HUD would vanish inside it.
    //
    // Layout — 344 × 416:
    //   0–58     top strip     two player chips, dice between them
    //   58–358   board         300 × 300, inset 22px each side, wooden frame
    //   358–416  bottom strip  the other two chips
    // Each chip sits in the strip on its own quadrant's side, and the dice
    // renders in whichever strip belongs to the player to move, so the eye is
    // drawn to the right half of the board — same idea as Ludo Star. Which
    // quadrant is where depends on the board rotation; see ludoSeat below.

    // ── Board rotation ─────────────────────────────────────────────────
    // Players want their own colour nearest them, so the board can be turned in
    // quarter-turns. Two rules keep this from breaking anything:
    //
    //   1. Rotate COORDINATES, never the model. ludoStepToCell, the ring indices
    //      and every rule still speak unrotated grid space, so a turn cannot
    //      change what is legal — only where it is painted. Everything funnels
    //      through ludoPointXY, so board, tokens, ghosts, the hop animation and
    //      hit-testing all follow from that one function.
    //   2. Never rotate the canvas context. ctx.rotate would carry the dice
    //      pips, chip labels and stack badges over with it and leave them
    //      upside down; only positions should move, not glyphs.
    //
    // 0..3 counter-clockwise quarter-turns, so Blue's quadrant walks
    // top-left → bottom-left → bottom-right → top-right.
    function ludoRotation() {
        const P = (typeof userPreferences === 'object' && userPreferences) ? userPreferences : {};
        const raw = P.ludoRotation;
        const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
        return Number.isFinite(n) ? ((n % 4) + 4) % 4 : 0;
    }

    // (gr, gc) are grid-LINE coordinates in [0, LUDO_GRID] rather than cell
    // indices, so this serves cell corners, cell centres (x.5), base slots and
    // the board centre alike. The centre (7.5, 7.5) is a fixed point.
    function ludoRotateGrid(gr, gc) {
        const G = LUDO_GRID;
        switch (ludoRotation()) {
            case 1:  return { r: G - gc, c: gr };        // 90° CCW
            case 2:  return { r: G - gr, c: G - gc };    // 180°
            case 3:  return { r: gc,     c: G - gr };    // 90° CW
            default: return { r: gr,     c: gc };
        }
    }

    // Which HUD strip a colour's chip belongs in, derived from where its
    // quadrant actually ended up rather than a fixed table — so the chips, the
    // dice and the roll recap all follow the board round. A quarter-turn is a
    // bijection on quadrants, so the four seats always land in four distinct
    // (strip, side) slots and can never collide.
    function ludoSeat(ci) {
        const q = LUDO_COLORS[ci].quad;
        const p = ludoRotateGrid((q.r0 + q.r1) / 2, (q.c0 + q.c1) / 2);
        return {
            strip: p.r < LUDO_GRID / 2 ? 'top'  : 'bottom',
            side:  p.c < LUDO_GRID / 2 ? 'left' : 'right',
        };
    }

    // ── Interaction state ──────────────────────────────────────────────
    let ludoPhase      = 'idle';   // idle | awaitRoll | rolling | awaitMove | moving | over
    let ludoAnimFrame  = null;
    let ludoLastFrame  = 0;
    let ludoDiceFace   = 1;
    let ludoDiceSpin   = 0;        // ms left of the tumble
    let ludoTurnLeft   = LUDO_TURN_CLOCK;
    let ludoLegal      = [];       // legal moves for the current roll
    let ludoHop        = null;     // { move, path, idx, t }
    let ludoPulse      = 0;        // drives markers, glows and the dice bob
    let ludoBanner     = null;     // { text, ttl, tone }
    let ludoPending    = null;     // { ms, fn } — loop-driven timer, see ludoAfter
    let ludoRenderPos  = new Map();// token -> drawn position, for hit-testing
    let ludoPopover    = null;     // { token } — which die to spend on that token
    let ludoAwarded    = false;    // endLudoGame idempotency guard
    let ludoStarted    = false;
    let ludoCanvasEl   = null;

    // Timers run off the animation loop rather than setTimeout, so cancelling
    // ludoAnimFrame in cleanupCurrentGame stops absolutely everything. A stray
    // setTimeout would keep firing after the player switched tabs.
    function ludoAfter(ms, fn) { ludoPending = { ms, fn }; }
    function ludoClearPending() { ludoPending = null; }

    // ── Pixel geometry ─────────────────────────────────────────────────
    // ludoPointXY takes grid-line coords (base slots, triangle vertices);
    // ludoCellCenter takes a cell index and returns the middle of that cell.
    function ludoPointXY(r, c) {
        const p = ludoRotateGrid(r, c);
        return { x: LUDO_BOARD_X + p.c * LUDO_CELL, y: LUDO_BOARD_Y + p.r * LUDO_CELL };
    }
    function ludoCellCenter(r, c) {
        return ludoPointXY(r + 0.5, c + 0.5);
    }

    // Axis-aligned rect spanning grid lines [r0,r1] × [c0,c1]. A quarter-turn
    // keeps a rect axis-aligned but moves which corner is which, so derive it
    // from both rotated corners instead of assuming (r0,c0) is still top-left.
    function ludoRectXY(r0, c0, r1, c1) {
        const a = ludoPointXY(r0, c0), b = ludoPointXY(r1, c1);
        return {
            x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
            w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
        };
    }

    // Where token `i` of colour `ci` sits at an arbitrary step, including the
    // base (-1) and the centre (56). Used for both drawing and hop interpolation.
    function ludoPosForStep(ci, i, step) {
        const col = LUDO_COLORS[ci];
        if (step >= LUDO_HOME_STEP) {
            // Fanned along the colour's own triangle so four tokens stay distinct.
            const mid = ludoPointXY(7.5, 7.5);
            const a   = ludoPointXY((col.apex[0].r + col.apex[1].r) / 2,
                                    (col.apex[0].c + col.apex[1].c) / 2);
            const k   = 0.30 + i * 0.16;
            return { x: mid.x + (a.x - mid.x) * k, y: mid.y + (a.y - mid.y) * k };
        }
        if (step < 0) {
            const s = col.baseSlots[i];
            return ludoPointXY(s.r, s.c);
        }
        const cell = ludoStepToCell(ci, step);
        return cell ? ludoCellCenter(cell.r, cell.c) : ludoPointXY(7.5, 7.5);
    }

    function ludoTokenXY(t) {
        return ludoPosForStep(t.ci, t.i, t.home ? LUDO_HOME_STEP : (t.inBase ? -1 : t.step));
    }

    // Inactive quadrants: wash the hue out toward the colour's own luminance,
    // then lift toward paper. Blending straight to grey turned red into mud and
    // yellow into olive, which read as "dirty" rather than "not in play".
    function ludoDim(hex) {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const soft = v => {
            const desat = v * 0.25 + lum * 0.75;
            return Math.round(desat + (235 - desat) * 0.45);
        };
        return `rgb(${soft(r)},${soft(g)},${soft(b)})`;
    }

    const ludoIsActive = ci => ludoActive.indexOf(ci) !== -1;
    const ludoCurrentCi = () => ludoActive[ludoTurn];

    function ludoRoundRect(ctx, x, y, w, h, r) {
        const k = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + k, y);
        ctx.arcTo(x + w, y,     x + w, y + h, k);
        ctx.arcTo(x + w, y + h, x,     y + h, k);
        ctx.arcTo(x,     y + h, x,     y,     k);
        ctx.arcTo(x,     y,     x + w, y,     k);
        ctx.closePath();
    }

    // Tokens sharing a square are spread apart and badged with a count, so a
    // block never looks like a single piece.
    function ludoComputeLayout() {
        const groups = new Map();
        ludoTokens.forEach(t => {
            const p = ludoTokenXY(t);
            const k = Math.round(p.x) + ':' + Math.round(p.y);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push({ t, p });
        });
        const pos = new Map();
        groups.forEach(list => {
            const n = list.length;
            list.forEach((entry, idx) => {
                if (n === 1) {
                    pos.set(entry.t, { x: entry.p.x, y: entry.p.y, scale: 1, stack: 1, idx: 0 });
                    return;
                }
                const spread = Math.min(4.5, 11 / n);
                const off = (idx - (n - 1) / 2) * spread;
                pos.set(entry.t, {
                    x: entry.p.x + off, y: entry.p.y - Math.abs(off) * 0.35,
                    scale: 0.82, stack: n, idx,
                });
            });
        });
        return pos;
    }

    // ── Board ──────────────────────────────────────────────────────────
    function ludoDrawFrame(ctx) {
        const pad = 9;
        const x = LUDO_BOARD_X - pad, y = LUDO_BOARD_Y - pad;
        const s = LUDO_BOARD + pad * 2;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        const g = ctx.createLinearGradient(x, y, x + s, y + s);
        g.addColorStop(0,    '#4a3324');
        g.addColorStop(0.5,  '#33221a');
        g.addColorStop(1,    '#241610');
        ctx.fillStyle = g;
        ludoRoundRect(ctx, x, y, s, s, 14);
        ctx.fill();
        ctx.restore();

        // Inner bevel — a light top edge and a dark bottom edge reads as depth.
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ludoRoundRect(ctx, x + 1.5, y + 1.5, s - 3, s - 3, 12);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ludoRoundRect(ctx, LUDO_BOARD_X - 1.5, LUDO_BOARD_Y - 1.5,
                      LUDO_BOARD + 3, LUDO_BOARD + 3, 4);
        ctx.stroke();
    }

    function ludoDrawCell(ctx, r, c, fill, stroke) {
        const q = ludoRectXY(r, c, r + 1, c + 1);
        ctx.fillStyle = fill;
        ctx.fillRect(q.x, q.y, q.w, q.h);
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1;
            ctx.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 1, q.h - 1);
        }
    }

    function ludoDrawStar(ctx, r, c, colour) {
        const p = ludoCellCenter(r, c);
        const R = LUDO_CELL * 0.33, r2 = R * 0.45;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const rad = i % 2 ? r2 : R;
            const a = -Math.PI / 2 + i * Math.PI / 5;
            const x = p.x + Math.cos(a) * rad, y = p.y + Math.sin(a) * rad;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();
    }

    // Arrow on each start square showing which way that colour travels.
    function ludoDrawStartArrow(ctx, ci) {
        const col  = LUDO_COLORS[ci];
        const cur  = LUDO_RING[col.startIndex];
        const next = LUDO_RING[(col.startIndex + 1) % 52];
        // Take the heading from the two squares' *drawn* positions, so the arrow
        // turns with the board instead of always pointing the unrotated way.
        // No start square sits on one of the four diagonal corner turns, so this
        // is always exactly horizontal or vertical.
        const p  = ludoCellCenter(cur.r, cur.c);
        const n  = ludoCellCenter(next.r, next.c);
        const L  = LUDO_CELL * 0.30;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(n.y - p.y, n.x - p.x));
        ctx.beginPath();
        ctx.moveTo(L, 0);
        ctx.lineTo(-L * 0.65, -L * 0.8);
        ctx.lineTo(-L * 0.2, 0);
        ctx.lineTo(-L * 0.65, L * 0.8);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fill();
        ctx.restore();
    }

    function ludoDrawBoard(ctx) {
        const S = LUDO_CELL;
        ludoDrawFrame(ctx);

        ctx.fillStyle = '#fbfcfe';
        ctx.fillRect(LUDO_BOARD_X, LUDO_BOARD_Y, LUDO_BOARD, LUDO_BOARD);

        // Quadrants and their base panels
        LUDO_COLORS.forEach((col, ci) => {
            const on   = ludoIsActive(ci);
            const tint = on ? col.hex : ludoDim(col.hex);
            const deep = on ? col.deep : ludoDim(col.deep);
            const q = col.quad, b = col.basePanel;
            const qr = ludoRectXY(q.r0, q.c0, q.r1, q.c1);

            ctx.fillStyle = tint;
            ctx.fillRect(qr.x, qr.y, qr.w, qr.h);

            const br = ludoRectXY(b.r0, b.c0, b.r1, b.c1);
            ctx.fillStyle = '#fbfcfe';
            ludoRoundRect(ctx, br.x, br.y, br.w, br.h, 8);
            ctx.fill();
            ctx.strokeStyle = deep;
            ctx.lineWidth = 2;
            ludoRoundRect(ctx, br.x + 1, br.y + 1, br.w - 2, br.h - 2, 7);
            ctx.stroke();

            col.baseSlots.forEach(s => {
                const p = ludoPointXY(s.r, s.c);
                ctx.beginPath();
                ctx.arc(p.x, p.y, S * 0.42, 0, Math.PI * 2);
                ctx.fillStyle = on ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.04)';
                ctx.fill();
                ctx.strokeStyle = tint;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });
        });

        // Ring squares — start squares wear their owner's colour
        LUDO_RING.forEach((cell, idx) => {
            const owner = LUDO_START_OWNER[idx];
            let fill = '#ffffff';
            if (owner !== undefined) {
                fill = ludoIsActive(owner) ? LUDO_COLORS[owner].hex : ludoDim(LUDO_COLORS[owner].hex);
            }
            ludoDrawCell(ctx, cell.r, cell.c, fill, 'rgba(40,50,70,0.28)');
        });

        LUDO_SAFE_RING.forEach(idx => {
            if (LUDO_START_OWNER[idx] !== undefined) return;
            const cell = LUDO_RING[idx];
            ludoDrawStar(ctx, cell.r, cell.c, 'rgba(60,72,96,0.40)');
        });
        LUDO_COLORS.forEach((col, ci) => ludoDrawStartArrow(ctx, ci));

        // Home columns
        LUDO_COLORS.forEach((col, ci) => {
            const tint = ludoIsActive(ci) ? col.hex : ludoDim(col.hex);
            col.homeCol.forEach(cell => ludoDrawCell(ctx, cell.r, cell.c, tint, 'rgba(40,50,70,0.28)'));
        });

        // Centre pinwheel
        const mid = ludoPointXY(7.5, 7.5);
        LUDO_COLORS.forEach((col, ci) => {
            const a = ludoPointXY(col.apex[0].r, col.apex[0].c);
            const b = ludoPointXY(col.apex[1].r, col.apex[1].c);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(mid.x, mid.y);
            ctx.closePath();
            ctx.fillStyle = ludoIsActive(ci) ? col.hex : ludoDim(col.hex);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        ctx.strokeStyle = 'rgba(40,50,70,0.35)';
        ctx.lineWidth = 1.5;
        const cr = ludoRectXY(6, 6, 9, 9);
        ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);

        if (ludoDebugRing) {
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#c2185b';
            LUDO_RING.forEach((cell, idx) => {
                const p = ludoCellCenter(cell.r, cell.c);
                ctx.fillText(String(idx), p.x, p.y);
            });
        }
    }

    // ── Tokens ─────────────────────────────────────────────────────────
    // Concentric-ring piece: coloured body, white band, coloured pip. Reads
    // clearly at 20px and matches the look players expect from Ludo Star.
    function ludoDrawToken(ctx, x, y, ci, opt) {
        const o    = opt || {};
        const col  = LUDO_COLORS[ci];
        const on   = ludoIsActive(ci);
        const body = on ? col.hex : ludoDim(col.hex);
        const deep = on ? col.deep : ludoDim(col.deep);
        const R    = LUDO_CELL * 0.40 * (o.scale || 1);

        // Destination marker. Drawn as a dashed ring in the mover's own colour
        // rather than a translucent white disc — most of the track is white, and
        // a white ghost was simply invisible on it.
        if (o.ghost) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, R * 0.86, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.62)';
            ctx.fill();
            ctx.setLineDash([3.5, 2.5]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = deep;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(x, y, R * 0.30, 0, Math.PI * 2);
            ctx.fillStyle = body;
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();

        {
            ctx.beginPath();
            ctx.ellipse(x, y + R * 0.62, R * 0.82, R * 0.30, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.fill();
        }
        if (o.glow) {
            ctx.beginPath();
            ctx.arc(x, y, R + 3.5 + Math.sin(ludoPulse * 5) * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,214,64,0.45)';
            ctx.fill();
        }

        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fillStyle = body; ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = deep;
        ctx.stroke();

        ctx.beginPath(); ctx.arc(x, y, R * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.beginPath(); ctx.arc(x, y, R * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = body; ctx.fill();

        {
            ctx.beginPath();
            ctx.arc(x - R * 0.30, y - R * 0.34, R * 0.24, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fill();
        }

        if (o.stack > 1) {
            ctx.beginPath();
            ctx.arc(x + R * 0.75, y - R * 0.75, R * 0.46, 0, Math.PI * 2);
            ctx.fillStyle = '#1d2740'; ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `bold ${Math.round(R * 0.66)}px system-ui, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(String(o.stack), x + R * 0.75, y - R * 0.72);
        }
        ctx.restore();
    }

    // ── Die-choice popover ─────────────────────────────────────────────
    // With more than one value unspent, tapping a token asks which die to
    // spend on it. One layout function serves both the draw and the hit-test,
    // so they cannot drift apart.
    const LUDO_POP_D   = 22;
    const LUDO_POP_GAP = 5;
    const LUDO_POP_PAD = 5;

    function ludoPopoverLayout() {
        if (!ludoPopover) return null;
        const values = ludoValuesForToken(ludoPopover.token.ci, ludoPopover.token);
        if (values.length < 2) return null;

        const n = values.length;
        const w = n * LUDO_POP_D + (n - 1) * LUDO_POP_GAP + LUDO_POP_PAD * 2;
        const h = LUDO_POP_D + LUDO_POP_PAD * 2;
        const p = ludoRenderPos.get(ludoPopover.token) || ludoTokenXY(ludoPopover.token);

        let y = p.y - LUDO_CELL * 0.7 - h;
        if (y < LUDO_BOARD_Y + 2) y = p.y + LUDO_CELL * 0.7;   // flip below near the top edge
        const x = Math.max(LUDO_BOARD_X + 2,
                  Math.min(p.x - w / 2, LUDO_BOARD_X + LUDO_BOARD - w - 2));

        return {
            x, y, w, h, values,
            cells: values.map((v, i) => ({
                value: v,
                x: x + LUDO_POP_PAD + i * (LUDO_POP_D + LUDO_POP_GAP) + LUDO_POP_D / 2,
                y: y + LUDO_POP_PAD + LUDO_POP_D / 2,
            })),
        };
    }

    function ludoDrawPopover(ctx) {
        const L = ludoPopoverLayout();
        if (!L) return;
        const anchor = ludoRenderPos.get(ludoPopover.token) || ludoTokenXY(ludoPopover.token);

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(14,19,38,0.96)';
        ludoRoundRect(ctx, L.x, L.y, L.w, L.h, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = LUDO_COLORS[ludoPopover.token.ci].hex;
        ctx.lineWidth = 1.5;
        ludoRoundRect(ctx, L.x, L.y, L.w, L.h, 8);
        ctx.stroke();

        // Little tail pointing at the token it belongs to.
        const below = L.y > anchor.y;
        const ty = below ? L.y : L.y + L.h;
        const tx = Math.max(L.x + 8, Math.min(anchor.x, L.x + L.w - 8));
        ctx.beginPath();
        ctx.moveTo(tx - 5, ty);
        ctx.lineTo(tx + 5, ty);
        ctx.lineTo(tx, ty + (below ? -5 : 5));
        ctx.closePath();
        ctx.fillStyle = 'rgba(14,19,38,0.96)';
        ctx.fill();

        L.cells.forEach(c => ludoDrawMiniDie(ctx, c.x, c.y, LUDO_POP_D, c.value, true));
        ctx.restore();
    }

    // Bouncing chevron over a token that can legally move.
    function ludoDrawMarker(ctx, x, y) {
        const bob = Math.sin(ludoPulse * 6) * 2.2;
        const yy  = y - LUDO_CELL * 0.78 + bob;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x - 5, yy - 4);
        ctx.lineTo(x + 5, yy - 4);
        ctx.lineTo(x, yy + 3.5);
        ctx.closePath();
        ctx.fillStyle = '#3ddc6b';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.fill();
        ctx.restore();
    }

    function ludoDrawTokens(ctx) {
        ludoRenderPos = ludoComputeLayout();

        // Ghost previews. With three unspent dice and four tokens there can be
        // a dozen destinations, so only show them when the choice is narrow:
        // one die left, or a token already picked. Otherwise the glow and the
        // chevron are enough to say which tokens can move at all.
        if (ludoPhase === 'awaitMove') {
            const distinct = ludoPool.filter((v, i) => ludoPool.indexOf(v) === i).length;
            const ghosts = ludoPopover
                ? ludoLegal.filter(m => m.token === ludoPopover.token)
                : (distinct <= 1 ? ludoLegal : []);
            ghosts.forEach(m => {
                const p = ludoPosForStep(m.token.ci, m.token.i, m.to);
                ludoDrawToken(ctx, p.x, p.y, m.token.ci, { ghost: true, scale: 0.9 });
            });
        }

        const hopTok = ludoHop && ludoHop.move.token;
        ludoTokens.forEach(t => {
            if (t === hopTok) return;                    // drawn separately, on top
            const p = ludoRenderPos.get(t);
            const movable = ludoPhase === 'awaitMove' && ludoLegal.some(m => m.token === t);
            ludoDrawToken(ctx, p.x, p.y, t.ci, {
                scale: p.scale, stack: p.idx === p.stack - 1 ? p.stack : 1, glow: movable,
            });
        });

        if (hopTok) {
            const p = ludoHopXY();
            ludoDrawToken(ctx, p.x, p.y, hopTok.ci, { scale: 1.08 });
        }
        if (ludoPhase === 'awaitMove') {
            ludoLegal.forEach(m => {
                const p = ludoRenderPos.get(m.token);
                if (p) ludoDrawMarker(ctx, p.x, p.y);
            });
        }
    }

    // Interpolated position mid-hop, with a small parabolic lift per square.
    function ludoHopXY() {
        const h  = ludoHop;
        const t  = h.move.token;
        const fromStep = h.idx === 0 ? (h.move.release ? -1 : h.move.from) : h.path[h.idx - 1];
        const toStep   = h.path[h.idx];
        const a = ludoPosForStep(t.ci, t.i, fromStep);
        const b = ludoPosForStep(t.ci, t.i, toStep);
        const k = Math.min(1, h.t / LUDO_HOP_MS);
        return {
            x: a.x + (b.x - a.x) * k,
            y: a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 6,
        };
    }

    // ── Dice ───────────────────────────────────────────────────────────
    const LUDO_PIPS = {
        1: [[0, 0]],
        2: [[-1, -1], [1, 1]],
        3: [[-1, -1], [0, 0], [1, 1]],
        4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
        6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    };

    function ludoDrawDice(ctx, cx, cy, size, face, opts) {
        const o = opts || {};
        // Breathing scale while it waits for a tap — a clearer affordance than a
        // text label, and it costs no vertical room inside the 58px strip.
        const grow = o.glow ? 1 + Math.sin(ludoPulse * 4) * 0.055 : 1;
        const half = (size * grow) / 2;
        ctx.save();
        ctx.translate(cx, cy);
        if (o.spin) ctx.rotate(Math.sin(ludoPulse * 22) * 0.28);

        if (o.glow) {
            ctx.shadowColor = 'rgba(255,206,64,0.95)';
            ctx.shadowBlur = 10 + Math.sin(ludoPulse * 4) * 4;
        }
        const g = ctx.createLinearGradient(-half, -half, half, half);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#dfe4ec');
        ctx.fillStyle = g;
        ludoRoundRect(ctx, -half, -half, size, size, size * 0.22);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = o.glow ? '#ffce40' : 'rgba(0,0,0,0.32)';
        ctx.lineWidth = o.glow ? 2 : 1;
        ludoRoundRect(ctx, -half, -half, size, size, size * 0.22);
        ctx.stroke();

        const pr = half * 0.20, sp = half * 0.52;
        ctx.fillStyle = '#26304a';
        (LUDO_PIPS[face] || LUDO_PIPS[1]).forEach(([px, py]) => {
            ctx.beginPath();
            ctx.arc(px * sp, py * sp, pr, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    // Depleting ring around the dice — the turn clock.
    function ludoDrawTurnRing(ctx, cx, cy, radius) {
        const frac = Math.max(0, ludoTurnLeft / LUDO_TURN_CLOCK);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.strokeStyle = frac > 0.5 ? '#3ddc6b' : frac > 0.22 ? '#ffce40' : '#ff5d5d';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    }

    // ── HUD ────────────────────────────────────────────────────────────
    // Strip layout. The chip is 88 wide rather than 122 so the roll recap fits
    // between it and the live dice (ring spans centre ± 19) even in 3P/4P,
    // where two players share a strip.
    const LUDO_CHIP_W    = 88;
    const LUDO_CHIP_H    = 38;
    const LUDO_CHIP_PAD  = 6;
    const LUDO_RECAP_GAP = 6;    // chip → recap; keeps the recap clear of the dice ring
    const ludoChipX = side =>
        side === 'left' ? LUDO_CHIP_PAD : LUDO_CANVAS_W - LUDO_CHIP_W - LUDO_CHIP_PAD;

    function ludoDrawChip(ctx, ci, x, y, isCurrent) {
        const col  = LUDO_COLORS[ci];
        const home = ludoTokensHome(ci);
        const isCPU = ludoIsCPUSeat(ci);
        const w = LUDO_CHIP_W, h = LUDO_CHIP_H;

        if (isCurrent) {
            ctx.fillStyle = 'rgba(255,255,255,0.11)';
            ludoRoundRect(ctx, x, y, w, h, 9);
            ctx.fill();
            ctx.strokeStyle = col.hex;
            ctx.lineWidth = 1.5;
            ludoRoundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 9);
            ctx.stroke();
        }

        const cy = y + h / 2;
        ctx.beginPath();
        ctx.arc(x + 14, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = col.hex;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = col.deep;
        ctx.stroke();
        if (isCurrent) {
            ctx.beginPath();
            ctx.arc(x + 14, cy, 11 + Math.sin(ludoPulse * 4) * 0.9, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Name at 11px, CPU tier trailing it at 8px. Right-aligning the tier
        // would collide with the recap, and "CPU · normal" as one 11px string
        // overflowed the 88px chip.
        const name = isCPU ? 'CPU' : col.label;
        ctx.font = isCurrent ? 'bold 11px system-ui, sans-serif' : '11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = isCurrent ? '#ffffff' : 'rgba(255,255,255,0.66)';
        ctx.fillText(name, x + 26, cy - 1);
        if (isCPU) {
            const nameW = ctx.measureText(name).width;
            ctx.font = '8px system-ui, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.42)';
            ctx.fillText(ludoCpuTier, x + 26 + nameW + 5, cy - 1);
        }

        for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(x + 29 + k * 8.5, cy + 9, 3, 0, Math.PI * 2);
            ctx.fillStyle = k < home ? col.hex : 'rgba(255,255,255,0.20)';
            ctx.fill();
        }
    }

    // Small die used for the unspent pool (bright) and the recap (dimmed).
    // Pips need real contrast at this size — a pale face with near-black pips
    // stays countable where a low global alpha turned them to mush.
    function ludoDrawMiniDie(ctx, cx, cy, size, face, bright) {
        const half = size / 2;
        ctx.save();
        ctx.globalAlpha = bright ? 1 : 0.78;
        if (bright) {
            ctx.shadowColor = 'rgba(255,206,64,0.55)';
            ctx.shadowBlur = 5;
        }
        ludoRoundRect(ctx, cx - half, cy - half, size, size, size * 0.24);
        ctx.fillStyle = bright ? '#ffffff' : '#c6cde4';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = bright ? '#ffce40' : 'rgba(255,255,255,0.34)';
        ctx.lineWidth = bright ? 1.5 : 1;
        ludoRoundRect(ctx, cx - half, cy - half, size, size, size * 0.24);
        ctx.stroke();
        const pr = Math.max(1.05, half * 0.235), sp = half * 0.50;
        ctx.fillStyle = '#141a2e';
        (LUDO_PIPS[face] || []).forEach(p => {
            ctx.beginPath();
            ctx.arc(cx + p[0] * sp, cy + p[1] * sp, pr, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    // Unspent dice for the player to move, parked between their chip and the
    // live dice. Sits on the current player's own side, and the recap sits on
    // its owner's side — those are always different seats, so they never clash.
    function ludoDrawPool(ctx, strip) {
        if (!ludoStarted || ludoPhase === 'over' || !ludoPool.length) return;
        const cur  = ludoCurrentCi();
        const seat = ludoSeat(cur);
        if (seat.strip !== strip) return;

        const D = 15, GAP = 2;
        const w  = ludoPool.length * D + (ludoPool.length - 1) * GAP;
        const y0 = strip === 'top' ? 0 : LUDO_CANVAS_H - LUDO_STRIP_H;
        const cy = y0 + LUDO_STRIP_H / 2;
        const x0 = seat.side === 'left'
            ? ludoChipX('left') + LUDO_CHIP_W + LUDO_RECAP_GAP
            : ludoChipX('right') - LUDO_RECAP_GAP - w;

        ludoPool.forEach((v, k) =>
            ludoDrawMiniDie(ctx, x0 + k * (D + GAP) + D / 2, cy, D, v, true));
    }

    // What the previous player rolled, parked beside their own chip. Cleared
    // the moment the next roll starts (see ludoDoRoll).
    function ludoDrawRecap(ctx, strip) {
        if (!ludoRecap || !ludoRecap.faces.length) return;
        const seat = ludoSeat(ludoRecap.ci);
        if (seat.strip !== strip || !ludoIsActive(ludoRecap.ci)) return;

        // At most 4, most recent first-to-last. Three sixes is the natural
        // maximum; longer runs only come from capture chains.
        const faces = ludoRecap.faces.slice(-4);
        const D = faces.length <= 3 ? 15 : 11;
        const GAP = 2;
        const w = faces.length * D + (faces.length - 1) * GAP;   // <= 50
        const y0 = strip === 'top' ? 0 : LUDO_CANVAS_H - LUDO_STRIP_H;
        const cy = y0 + LUDO_STRIP_H / 2;
        const x0 = seat.side === 'left'
            ? ludoChipX('left') + LUDO_CHIP_W + LUDO_RECAP_GAP
            : ludoChipX('right') - LUDO_RECAP_GAP - w;

        faces.forEach((f, k) => ludoDrawMiniDie(ctx, x0 + k * (D + GAP) + D / 2, cy, D, f));
    }

    function ludoDrawHud(ctx) {
        const cur = ludoCurrentCi();
        const curStrip = ludoPhase === 'over' ? null : ludoSeat(cur).strip;

        ['top', 'bottom'].forEach(strip => {
            const y0 = strip === 'top' ? 0 : LUDO_CANVAS_H - LUDO_STRIP_H;
            ludoActive.forEach(ci => {
                const seat = ludoSeat(ci);
                if (seat.strip !== strip) return;
                ludoDrawChip(ctx, ci, ludoChipX(seat.side),
                             y0 + (LUDO_STRIP_H - LUDO_CHIP_H) / 2,
                             ci === cur && ludoPhase !== 'over');
            });

            ludoDrawRecap(ctx, strip);
            ludoDrawPool(ctx, strip);

            if (strip === curStrip) {
                const cx = LUDO_CANVAS_W / 2, cy = y0 + LUDO_STRIP_H / 2;
                ludoDrawTurnRing(ctx, cx, cy, 19);
                ludoDrawDice(ctx, cx, cy, 28, ludoDiceFace, {
                    glow: ludoPhase === 'awaitRoll' && !ludoIsCPUSeat(cur),
                    spin: ludoPhase === 'rolling',
                });
            }
        });
    }

    function ludoDrawBanner(ctx) {
        if (!ludoBanner) return;
        const fade = Math.min(1, ludoBanner.ttl / 260);
        const text = ludoBanner.text;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.font = 'bold 13px system-ui, sans-serif';
        const w = ctx.measureText(text).width + 26;
        const x = (LUDO_CANVAS_W - w) / 2, y = LUDO_CANVAS_H / 2 - 17;
        ctx.fillStyle = ludoBanner.tone === 'bad' ? 'rgba(150,32,42,0.94)'
                      : ludoBanner.tone === 'good' ? 'rgba(24,120,62,0.94)'
                      : 'rgba(24,32,54,0.94)';
        ludoRoundRect(ctx, x, y, w, 34, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, LUDO_CANVAS_W / 2, y + 17);
        ctx.restore();
    }

    function ludoDrawIdle(ctx) {
        if (ludoStarted) return;
        ctx.save();
        ctx.fillStyle = 'rgba(8,12,24,0.62)';
        ctx.fillRect(LUDO_BOARD_X, LUDO_BOARD_Y, LUDO_BOARD, LUDO_BOARD);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎲  ' + LUDO_MODE_LABEL[ludoMode],
                     LUDO_CANVAS_W / 2, LUDO_BOARD_Y + LUDO_BOARD / 2 - 10);
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        ctx.fillText('Press ▶ Play to start',
                     LUDO_CANVAS_W / 2, LUDO_BOARD_Y + LUDO_BOARD / 2 + 12);
        ctx.restore();
    }

    function ludoDrawGameOver(ctx) {
        if (ludoPhase !== 'over') return;
        const order = ludoStandings();
        const h = 34 + order.length * 20 + 30;
        const w = 190;
        const x = (LUDO_CANVAS_W - w) / 2, y = LUDO_BOARD_Y + (LUDO_BOARD - h) / 2;

        ctx.save();
        ctx.fillStyle = 'rgba(8,12,24,0.78)';
        ctx.fillRect(LUDO_BOARD_X, LUDO_BOARD_Y, LUDO_BOARD, LUDO_BOARD);
        ctx.fillStyle = 'rgba(20,27,48,0.98)';
        ludoRoundRect(ctx, x, y, w, h, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#ffd166';
        ctx.fillText('🏆  ' + LUDO_COLORS[order[0]].label + ' wins', x + w / 2, y + 20);

        order.forEach((ci, k) => {
            const ry = y + 44 + k * 20;
            ctx.beginPath();
            ctx.arc(x + 22, ry, 6, 0, Math.PI * 2);
            ctx.fillStyle = LUDO_COLORS[ci].hex;
            ctx.fill();
            ctx.font = '11px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,0.86)';
            ctx.fillText(`${k + 1}. ${ludoIsCPUSeat(ci) ? 'CPU' : LUDO_COLORS[ci].label}`, x + 34, ry);
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255,255,255,0.52)';
            ctx.fillText(`${ludoTokensHome(ci)}/4`, x + w - 16, ry);
        });

        ctx.textAlign = 'center';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('▶ Play for a new match', x + w / 2, y + h - 14);
        ctx.restore();
    }

    function ludoRender() {
        const canvas = ludoCanvasEl || document.getElementById('ludo-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Everything below draws in fixed 344×416 space. The ⛶ Max modal doubles
        // the backing store, so derive the scale from it — same trick
        // drawPoolFrame uses via canvas.width / POOL_W — and the board redraws
        // crisp at 2× instead of in a quarter of the canvas.
        const s = (canvas.width || LUDO_CANVAS_W) / LUDO_CANVAS_W;
        ctx.setTransform(s, 0, 0, s, 0, 0);

        ctx.clearRect(0, 0, LUDO_CANVAS_W, LUDO_CANVAS_H);
        ludoDrawBoard(ctx);
        ludoDrawTokens(ctx);
        ludoDrawPopover(ctx);
        ludoDrawHud(ctx);
        ludoDrawIdle(ctx);
        ludoDrawGameOver(ctx);
        ludoDrawBanner(ctx);
    }

    // ── Turn orchestration ─────────────────────────────────────────────
    function ludoSay(text, tone, ms) {
        ludoBanner = { text, tone: tone || 'info', ttl: ms || 900 };
    }

    // Also used to start a follow-up sequence (after a 6, or after a capture),
    // neither of which advances the turn — that is core's job.
    function ludoBeginTurn() {
        if (ludoPhase === 'over') return;
        ludoPhase    = 'awaitRoll';
        ludoTurnLeft = LUDO_TURN_CLOCK;
        ludoLegal    = [];
        ludoHop      = null;
        ludoPopover  = null;
        updateLudoScoreboard();
        if (ludoIsCPUSeat(ludoCurrentCi())) ludoAfter(LUDO_CPU_THINK_MS, ludoDoRoll);
    }

    // CPU spends the pool greedily; a human with exactly one option gets it
    // played for them. Otherwise we wait for a tap.
    function ludoAwaitMove(moves) {
        ludoLegal   = moves;
        ludoPhase   = 'awaitMove';
        ludoPopover = null;

        const ci = ludoCurrentCi();
        if (ludoIsCPUSeat(ci)) {
            ludoAfter(LUDO_CPU_THINK_MS, () => {
                const m = ludoAIChooseMove(ci, ludoLegal, ludoCpuTier);
                if (m) ludoPlayMove(m);
            });
        } else if (ludoLegal.length === 1) {
            ludoAfter(LUDO_AUTOPLAY_MS, () => {
                if (ludoPhase === 'awaitMove' && ludoLegal.length === 1) ludoPlayMove(ludoLegal[0]);
            });
        }
    }

    function ludoDoRoll() {
        if (ludoPhase !== 'awaitRoll') return;
        ludoRecap = null;                 // last turn's dice clear as the new roll starts
        ludoPhase = 'rolling';
        ludoDiceSpin = LUDO_DICE_MS;
    }

    function ludoSettleRoll() {
        const ci = ludoCurrentCi();
        ludoDiceFace = ludoRollDice();
        const res = ludoRegisterRoll(ci, ludoDiceFace);

        if (res.voided) {
            ludoSay('Three sixes — turn lost', 'bad', LUDO_PASS_MS);
            ludoAfter(LUDO_PASS_MS, ludoBeginTurn);
            return;
        }
        // A 6 banks a die and hands the dice straight back.
        if (res.rollAgain) {
            ludoSay('Six — roll again', 'good', 700);
            ludoBeginTurn();
            return;
        }
        if (res.passed) {
            // Name the numbers. "No moves" alone left the player guessing what
            // they had rolled, which is the complaint the recap fixes.
            const stuck = ludoTokens.filter(t => t.ci === ci).every(t => t.inBase || t.home);
            // Read the faces off the recap: the pass path already advanced the
            // turn, which clears ludoTurnRolls into exactly that snapshot.
            const faces = (ludoRecap && ludoRecap.ci === ci && ludoRecap.faces.length)
                ? ludoRecap.faces : [ludoDiceFace];
            const rolled = faces.slice(-LUDO_MAX_DICE).join(', ');
            ludoSay(stuck && ludoDiceFace !== 6
                ? `Rolled ${rolled} — need a 6`
                : `Rolled ${rolled} — no moves`, 'info', LUDO_PASS_MS);
            ludoAfter(LUDO_PASS_MS, ludoBeginTurn);
            return;
        }
        ludoAwaitMove(res.moves);
    }

    function ludoPlayMove(move) {
        if (ludoPhase !== 'awaitMove') return;
        ludoClearPending();
        const path = [];
        if (move.release) path.push(0);
        else for (let s = move.from + 1; s <= move.to; s++) path.push(s);

        ludoPhase   = 'moving';
        ludoLegal   = [];
        ludoPopover = null;
        ludoHop     = { move, path, idx: 0, t: 0 };
    }

    function ludoCompleteMove() {
        const move = ludoHop.move;
        ludoHop = null;

        const result = ludoApplyMove(move);        // also spends move.value
        const after  = ludoFinishMove(result);

        if (after.gameOver) {
            ludoPhase = 'over';
            endLudoGame();
            updateLudoScoreboard();
            return;
        }
        if (result.captured)      ludoSay(after.extraRoll ? 'Captured — roll again' : 'Captured!', 'good', 850);
        else if (result.finished) ludoSay(after.extraRoll ? 'Home — roll again' : 'Home!', 'good', 850);

        // Still holding dice: keep spending without re-rolling.
        if (after.continueTurn) { ludoAwaitMove(after.moves); updateLudoScoreboard(); return; }
        ludoBeginTurn();
    }

    // Clock expiry: roll for them, or play the scorer's pick.
    function ludoTimeout() {
        if (ludoPhase === 'awaitRoll') { ludoSay('Time — rolling', 'info', 700); ludoDoRoll(); return; }
        if (ludoPhase === 'awaitMove') {
            const m = ludoAIChooseMove(ludoCurrentCi(), ludoLegal, 'normal');
            ludoSay('Time — auto-move', 'info', 700);
            if (m) ludoPlayMove(m);
        }
    }

    // ── Loop ───────────────────────────────────────────────────────────
    function ludoUpdate(dt) {
        ludoPulse += dt / 1000;

        if (ludoBanner) {
            ludoBanner.ttl -= dt;
            if (ludoBanner.ttl <= 0) ludoBanner = null;
        }
        if (ludoPending) {
            ludoPending.ms -= dt;
            if (ludoPending.ms <= 0) {
                const fn = ludoPending.fn;
                ludoPending = null;
                fn();
            }
        }
        if (ludoDiceSpin > 0) {
            ludoDiceSpin -= dt;
            ludoDiceFace = 1 + Math.floor(Math.random() * 6);   // tumble flicker
            if (ludoDiceSpin <= 0) { ludoDiceSpin = 0; ludoSettleRoll(); }
        }
        if (ludoHop) {
            ludoHop.t += dt;
            while (ludoHop && ludoHop.t >= LUDO_HOP_MS) {
                ludoHop.t -= LUDO_HOP_MS;
                ludoHop.idx++;
                if (ludoHop.idx >= ludoHop.path.length) { ludoCompleteMove(); break; }
            }
        }
        if ((ludoPhase === 'awaitRoll' || ludoPhase === 'awaitMove') && ludoStarted) {
            ludoTurnLeft -= dt / 1000;
            if (ludoTurnLeft <= 0) { ludoTurnLeft = LUDO_TURN_CLOCK; ludoTimeout(); }
        }
    }

    function ludoLoop(now) {
        ludoAnimFrame = requestAnimationFrame(ludoLoop);
        const interval = (typeof getFrameInterval === 'function') ? getFrameInterval() : 1000 / 60;
        const elapsed = now - ludoLastFrame;
        if (elapsed < interval) return;
        ludoLastFrame = now;
        ludoUpdate(Math.min(elapsed, 100));
        ludoRender();
    }

    // ── Input ──────────────────────────────────────────────────────────
    // Scale-aware, exactly as handlePoolMouseDown does: the canvas is laid out
    // with width:100% so rect.width rarely equals LUDO_CANVAS_W.
    function ludoEventXY(e) {
        const canvas = ludoCanvasEl || document.getElementById('ludo-canvas');
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
        return {
            x: (src.clientX - rect.left) * (LUDO_CANVAS_W / rect.width),
            y: (src.clientY - rect.top)  * (LUDO_CANVAS_H / rect.height),
        };
    }

    function ludoDiceHit(p) {
        if (ludoPhase === 'over') return false;
        const seat = ludoSeat(ludoCurrentCi());
        const cy = seat.strip === 'top'
            ? LUDO_STRIP_H / 2
            : LUDO_CANVAS_H - LUDO_STRIP_H / 2;
        return Math.abs(p.x - LUDO_CANVAS_W / 2) <= 22 && Math.abs(p.y - cy) <= 22;
    }

    function handleLudoPointerDown(e) {
        if (!ludoStarted || ludoPhase === 'over') return;
        const p = ludoEventXY(e);
        if (!p) return;
        const ci = ludoCurrentCi();
        if (ludoIsCPUSeat(ci)) return;               // hands off during the CPU's turn

        if (ludoPhase === 'awaitRoll' && ludoDiceHit(p)) {
            if (e.preventDefault) e.preventDefault();
            ludoClearPending();
            ludoDoRoll();
            return;
        }
        if (ludoPhase !== 'awaitMove') return;

        // An open popover owns the next tap: either it picks a die, or it closes.
        if (ludoPopover) {
            const L = ludoPopoverLayout();
            const r = LUDO_POP_D / 2 + 3;
            const hit = L && L.cells.filter(c =>
                Math.abs(p.x - c.x) <= r && Math.abs(p.y - c.y) <= r)[0];
            const token = ludoPopover.token;
            ludoPopover = null;
            if (hit) {
                const m = ludoLegal.filter(x => x.token === token && x.value === hit.value)[0];
                if (m) { if (e.preventDefault) e.preventDefault(); ludoPlayMove(m); }
                return;
            }
            // fall through — a tap outside dismisses, and may select another token
        }

        // Nearest movable token within a cell's reach wins, so near-misses still register.
        let best = null, bestD = 15 * 15;
        ludoLegal.forEach(m => {
            const rp = ludoRenderPos.get(m.token);
            if (!rp) return;
            const d = (rp.x - p.x) * (rp.x - p.x) + (rp.y - p.y) * (rp.y - p.y);
            if (d < bestD) { bestD = d; best = m.token; }
        });
        if (!best) return;
        if (e.preventDefault) e.preventDefault();

        // One playable die for this token → just move. More than one → ask.
        const values = ludoValuesForToken(best.ci, best);
        if (values.length <= 1) {
            const m = ludoLegal.filter(x => x.token === best)[0];
            if (m) ludoPlayMove(m);
        } else {
            ludoPopover = { token: best };
        }
    }

    // ── Host panel glue ────────────────────────────────────────────────
    // The board is entirely canvas-drawn, but the widget's game header expects a
    // scoreboard strip like every other game. Called only at state transitions,
    // never per frame — this writes to the DOM.
    function updateLudoScoreboard() {
        const modeEl = document.getElementById('ludo-mode-label');
        const homeEl = document.getElementById('ludo-home-label');
        const turnEl = document.getElementById('ludo-turn-label');
        if (modeEl) modeEl.textContent = LUDO_MODE_LABEL[ludoMode] || 'Ludo';
        if (homeEl) homeEl.textContent = '🏠 ' + ludoTokensHome(LUDO_HUMAN_CI) + '/4';
        if (!turnEl) return;
        if (ludoPhase === 'over') {
            const winner = ludoStandings()[0];
            turnEl.textContent = ludoIsCPUSeat(winner)
                ? 'CPU wins!' : LUDO_COLORS[winner].label + ' wins!';
        } else if (!ludoStarted) {
            turnEl.textContent = 'Press Play';
        } else {
            const ci = ludoCurrentCi();
            turnEl.textContent = 'Turn: ' + (ludoIsCPUSeat(ci) ? 'CPU' : LUDO_COLORS[ci].label);
        }
    }

    // ⛶ Max. Delegates to the host's shared modal helper; the standalone harness
    // has no such helper, so this is a no-op there and the harness uses its own
    // fullscreen button instead.
    let ludoMaximized = false;
    function toggleLudoMaximize() {
        if (typeof toggleGameMaxModal !== 'function') return;
        ludoMaximized = toggleGameMaxModal({
            canvasId: 'ludo-canvas',
            title: '🎲 Ludo',
            bufferW: LUDO_CANVAS_W,
            bufferH: LUDO_CANVAS_H,
        });
        ludoRender();
    }

    // ── Lifecycle ──────────────────────────────────────────────────────
    function ludoLoadWins() {
        try { return parseInt(localStorage.getItem('ludoGamesWon') || '0', 10) || 0; }
        catch (err) { return 0; }
    }
    function ludoSaveWins(n) {
        try { localStorage.setItem('ludoGamesWon', String(n)); } catch (err) { /* quota */ }
    }
    function ludoLoadRecord() {
        try {
            return JSON.parse(localStorage.getItem('ludoRecord') || 'null') || { wins: 0, losses: 0 };
        } catch (err) { return { wins: 0, losses: 0 }; }
    }
    function ludoSaveRecord(rec) {
        try { localStorage.setItem('ludoRecord', JSON.stringify(rec)); } catch (err) { /* quota */ }
    }

    // Idempotent: guarded on ludoAwarded so replaying the end state, or pressing
    // ▶ Play on a finished board, cannot pay out twice.
    function endLudoGame() {
        if (ludoAwarded) return;
        ludoAwarded = true;
        ludoGameOver = true;

        const order   = ludoStandings();
        const me      = LUDO_HUMAN_CI;
        const place   = order.indexOf(me);
        const vsCPU   = ludoMode === 'cpu2';
        const home    = ludoTokensHome(me);
        const caps    = (ludoStats[me] && ludoStats[me].captures) || 0;
        const lost    = (ludoStats[me] && ludoStats[me].lost) || 0;
        const won     = place === 0;
        const bigBoard = ludoActive.length >= 3;

        if (vsCPU) {
            const rec = ludoLoadRecord();
            if (won) { rec.wins++; ludoSaveWins(ludoLoadWins() + 1); }
            else rec.losses++;
            ludoSaveRecord(rec);
        }

        let xp;
        if (!vsCPU) {
            xp = 20;                                    // hot-seat: nothing to beat
        } else {
            const mult = { easy: 0.6, normal: 1.0, hard: 1.35 }[ludoCpuTier] || 1;
            xp = (won ? 90 : place === 1 && bigBoard ? 40 : 15)
               + Math.min(32, home * 8)
               + Math.min(18, caps * 3);
            xp = Math.round(xp * mult * (bigBoard ? 1.15 : 1));
        }
        xp = Math.max(0, Math.min(300, xp));

        if (typeof awardGameXP === 'function') {
            awardGameXP('ludo', {
                won, placement: place + 1, players: ludoActive.length,
                tokensHome: home, captures: caps, tokensLost: lost,
                tier: ludoCpuTier, vsCPU, xp,
                gamesWon: ludoLoadWins(),
            });
        }
        return xp;
    }

    function initLudoGame() {
        ludoCanvasEl = document.getElementById('ludo-canvas');
        if (!ludoCanvasEl) return;
        ludoCanvasEl.width  = LUDO_CANVAS_W;
        ludoCanvasEl.height = LUDO_CANVAS_H;
        ludoCanvasEl.addEventListener('mousedown', handleLudoPointerDown);
        ludoCanvasEl.addEventListener('touchstart', handleLudoPointerDown, { passive: false });
        ludoSetMode(ludoMode);
        ludoCpuTier = ludoDifficultyTier(ludoLoadRecord());
        ludoStarted = false;
        ludoPhase   = 'idle';
        updateLudoScoreboard();
        if (!ludoAnimFrame) { ludoLastFrame = 0; ludoAnimFrame = requestAnimationFrame(ludoLoop); }
    }

    function resetLudoGame() {
        ludoClearPending();
        ludoResetTokens();
        ludoStarted  = false;
        ludoAwarded  = false;
        ludoPhase    = 'idle';
        ludoHop      = null;
        ludoLegal    = [];
        ludoBanner   = null;
        ludoDiceSpin = 0;
        ludoDiceFace = 1;
        ludoTurnLeft = LUDO_TURN_CLOCK;
        ludoPopover  = null;
        updateLudoScoreboard();
        ludoRender();
    }

    function startLudoGame() {
        // Force a clean slate if the previous match finished — this is what stops
        // ▶ Play from re-awarding XP on a completed board.
        if (ludoGameOver || ludoPhase === 'over' || ludoAwarded) resetLudoGame();
        if (ludoStarted && ludoPhase !== 'idle') return;
        ludoResetTokens();
        ludoAwarded = false;
        ludoCpuTier = ludoDifficultyTier(ludoLoadRecord());
        ludoStarted = true;
        ludoTurn    = 0;
        ludoBeginTurn();
    }

    function cleanupLudoGame() {
        // Close the Max modal first: it has moved the canvas out of the panel,
        // and switching game while it is open would strand it on the overlay.
        if (ludoMaximized) toggleLudoMaximize();
        if (ludoAnimFrame) { cancelAnimationFrame(ludoAnimFrame); ludoAnimFrame = null; }
        ludoClearPending();
        if (ludoCanvasEl) {
            ludoCanvasEl.removeEventListener('mousedown', handleLudoPointerDown);
            ludoCanvasEl.removeEventListener('touchstart', handleLudoPointerDown);
        }
        ludoCanvasEl = null;
        ludoPopover  = null;
    }

    function cycleLudoModeAndReset() {
        cycleLudoMode();
        resetLudoGame();
        ludoCpuTier = ludoDifficultyTier(ludoLoadRecord());
        updateLudoScoreboard();
        return LUDO_MODE_LABEL[ludoMode];
    }

    // GAME SWITCHING SYSTEM
    
    function switchToGame(gameKey) {
        if (currentGame === gameKey) return;
        
        // Cleanup current game
        cleanupCurrentGame();
        
        // Update current game
        currentGame = gameKey;
        
        // Initialize new game
        initCurrentGame();
        
        // Update UI
        updateGameSwitcher();
        updateGameControls();
    }
    
    function cleanupCurrentGame() {
        switch (currentGame) {
            case 'snake':
                if (snakeGameRunning) {
                    snakeGameRunning = false;
                    snakeGamePaused = false;
                    if (snakeAnimFrame) { cancelAnimationFrame(snakeAnimFrame); snakeAnimFrame = null; }
                    snakeAccumulatorMs = 0;
                }
                document.removeEventListener('keydown', handleSnakeKeyPress);
                break;
                
            case 'reflex':
                if (reflexTimeoutRef) { clearTimeout(reflexTimeoutRef); reflexTimeoutRef = null; }
                if (gameAreaElement) gameAreaElement.removeEventListener('click', handleReflexClick);
                resetReflexGame();
                break;
                
            case 'aim':
                if (aimTimerRef) { clearInterval(aimTimerRef); aimTimerRef = null; }
                if (aimRenderFrameId) { cancelAnimationFrame(aimRenderFrameId); aimRenderFrameId = null; }
                if (gameAreaElement) gameAreaElement.removeEventListener('click', handleAimClick);
                resetAimGame();
                break;

            case 'flappy':
                if (flappyAnimFrame) { cancelAnimationFrame(flappyAnimFrame); flappyAnimFrame = null; }
                flappyGameRunning = false;
                document.removeEventListener('keydown', handleFlappyKey);
                if (flappyCanvas) flappyCanvas.removeEventListener('click', handleFlappyInput);
                break;

            case 'tetris':
                if (tetrisAnimFrame) { cancelAnimationFrame(tetrisAnimFrame); tetrisAnimFrame = null; }
                tetrisGameRunning = false;
                document.removeEventListener('keydown', handleTetrisKey);
                break;
            case 'breakout':
                if (breakoutAnimFrame) { cancelAnimationFrame(breakoutAnimFrame); breakoutAnimFrame = null; }
                breakoutGameRunning = false;
                if (breakoutCanvas) {
                    breakoutCanvas.removeEventListener('mousemove', handleBreakoutMouseMove);
                    breakoutCanvas.removeEventListener('touchmove', handleBreakoutTouchMove);
                    breakoutCanvas.removeEventListener('click', brkHandleClick);
                }
                break;
            case 'pool':
                if (poolAnimFrame) { cancelAnimationFrame(poolAnimFrame); poolAnimFrame = null; }
                poolGameRunning = false;
                if (poolCanvas) {
                    poolCanvas.removeEventListener('mousedown', handlePoolMouseDown);
                    poolCanvas.removeEventListener('mousemove', handlePoolMouseMove);
                    poolCanvas.removeEventListener('mouseup', handlePoolMouseUp);
                    poolCanvas.removeEventListener('touchstart', handlePoolTouchStart);
                    poolCanvas.removeEventListener('touchmove', handlePoolTouchMove);
                    poolCanvas.removeEventListener('touchend', handlePoolTouchEnd);
                }
                if (poolMaximized) togglePoolMaximize();
                break;
            case 'ludo':
                // cleanupLudoGame cancels ludoAnimFrame, drains the pending
                // loop-timer, detaches both pointer listeners and closes the
                // Max modal. Ludo schedules everything off the animation loop
                // rather than setTimeout precisely so this one call stops it all.
                cleanupLudoGame();
                break;
            case 'prayer':
                break;
            case 'leaderboard':
                break;
        }
    }
    
    function initCurrentGame() {
        const snakeCv = document.getElementById('snake-canvas');
        const flappyCv = document.getElementById('flappy-canvas');
        const tetrisCv = document.getElementById('tetris-canvas');
        const gameArea = document.getElementById('multi-game-area');
        // Hide all first
        const breakoutCv = document.getElementById('breakout-canvas');
        const poolCv = document.getElementById('pool-canvas');
        const ludoCv = document.getElementById('ludo-canvas');
        const prayerPanel = document.getElementById('prayer-panel');
        const lbPanelEl = document.getElementById('leaderboard-panel');
        [snakeCv, flappyCv, tetrisCv, breakoutCv, poolCv, ludoCv].forEach(c => { if (c) c.style.display = 'none'; });
        if (gameArea) gameArea.style.display = 'none';
        if (prayerPanel) prayerPanel.style.display = 'none';
        if (lbPanelEl) lbPanelEl.style.display = 'none';

        switch (currentGame) {
            case 'snake':
                if (snakeCv) snakeCv.style.display = 'block';
                initSnakeGame();
                break;
                
            case 'reflex':
                if (gameArea) gameArea.style.display = 'block';
                initReflexGame();
                updateReflexDisplay();
                break;
                
            case 'aim':
                if (gameArea) gameArea.style.display = 'block';
                initAimTrainerGame();
                renderAimGame();
                break;

            case 'flappy':
                if (flappyCv) flappyCv.style.display = 'block';
                initFlappyGame();
                break;

            case 'tetris':
                if (tetrisCv) tetrisCv.style.display = 'block';
                initTetrisGame();
                break;
            case 'breakout':
                if (breakoutCv) breakoutCv.style.display = 'block';
                initBreakoutGame();
                if (breakoutCanvas) {
                    breakoutCanvas.addEventListener('mousemove', handleBreakoutMouseMove);
                    breakoutCanvas.addEventListener('touchmove', handleBreakoutTouchMove, { passive: false });
                }
                break;
            case 'pool':
                if (poolCv) poolCv.style.display = 'block';
                initPoolGame();
                if (poolCanvas) {
                    poolCanvas.addEventListener('mousedown', handlePoolMouseDown);
                    poolCanvas.addEventListener('mousemove', handlePoolMouseMove);
                    poolCanvas.addEventListener('mouseup', handlePoolMouseUp);
                    poolCanvas.addEventListener('touchstart', handlePoolTouchStart, { passive: false });
                    poolCanvas.addEventListener('touchmove', handlePoolTouchMove, { passive: false });
                    poolCanvas.addEventListener('touchend', handlePoolTouchEnd);
                }
                break;
            case 'ludo':
                if (ludoCv) ludoCv.style.display = 'block';
                // initLudoGame binds its own pointer listeners and starts the
                // loop — unlike Pool, whose listeners are attached out here.
                initLudoGame();
                break;
            case 'prayer':
                if (prayerPanel) prayerPanel.style.display = 'flex';
                initPrayerCounter();
                break;
            case 'leaderboard': {
                const lbPanel = document.getElementById('leaderboard-panel');
                if (lbPanel) lbPanel.style.display = 'flex';
                initLeaderboard();
                break;
            }
        }
    }
    
    function updateGameSwitcher() {
        const ids = ['snake', 'reflex', 'aim', 'flappy', 'tetris', 'breakout', 'pool', 'ludo', 'prayer', 'leaderboard'];
        ids.forEach(id => {
            const btn = document.getElementById('game-switch-' + id);
            if (btn) btn.classList.toggle('active', currentGame === id);
        });
    }
    
    function updateGameControls() {
        const ctrlIds = ['snake-controls', 'reflex-controls', 'aim-controls', 'flappy-controls', 'tetris-controls', 'breakout-controls', 'pool-controls', 'ludo-controls', 'prayer-controls', 'leaderboard-controls'];
        const statIds = ['snake-scoreboard', 'reflex-scoreboard', 'reflex-stats', 'aim-scoreboard', 'aim-stats', 'flappy-scoreboard', 'tetris-scoreboard', 'breakout-scoreboard', 'pool-scoreboard', 'ludo-scoreboard', 'prayer-scoreboard', 'leaderboard-scoreboard'];
        ctrlIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        statIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        
        switch (currentGame) {
            case 'snake':
                { const c = document.getElementById('snake-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('snake-scoreboard'); if (s) s.style.display = 'flex'; }
                break;
            case 'reflex':
                { const c = document.getElementById('reflex-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('reflex-stats'); if (s) s.style.display = 'block'; }
                { const sb = document.getElementById('reflex-scoreboard'); if (sb) sb.style.display = 'flex'; }
                break;
            case 'aim':
                { const c = document.getElementById('aim-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('aim-stats'); if (s) s.style.display = 'block'; }
                { const sb = document.getElementById('aim-scoreboard'); if (sb) sb.style.display = 'flex'; }
                break;
            case 'flappy':
                { const c = document.getElementById('flappy-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('flappy-scoreboard'); if (s) s.style.display = 'flex'; }
                break;
            case 'tetris':
                { const c = document.getElementById('tetris-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('tetris-scoreboard'); if (s) s.style.display = 'flex'; }
                break;
            case 'breakout':
                { const c = document.getElementById('breakout-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('breakout-scoreboard'); if (s) s.style.display = 'flex'; }
                break;
            case 'pool':
                { const c = document.getElementById('pool-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('pool-scoreboard'); if (s) s.style.display = 'flex'; }
                break;
            case 'ludo':
                { const c = document.getElementById('ludo-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('ludo-scoreboard'); if (s) s.style.display = 'flex'; }
                updateLudoScoreboard();
                break;
            case 'prayer':
                { const c = document.getElementById('prayer-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('prayer-scoreboard'); if (s) s.style.display = 'flex'; }
                break;
            case 'leaderboard':
                { const c = document.getElementById('leaderboard-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('leaderboard-scoreboard'); if (s) s.style.display = 'flex'; }
                break;
        }
    }
    
    // QUOTES SYSTEM LOGIC
    
    function initQuotesSystem() {
        // Prevent re-initialization to avoid resetting animations
        if (quotesInitialized) return;
        
        quotesArray = loadQuotes();
        displayCurrentQuote(true); // Skip animation on first load
        startQuoteCycling();
        
        quotesInitialized = true;
    }
    
    function displayCurrentQuote(skipAnimation = false) {
        const quoteTextElement = document.getElementById('quote-text');
        const quoteAuthorElement = document.getElementById('quote-author');
        
        if (!quoteTextElement || quotesArray.length === 0) return;
        
        const quote = quotesArray[currentQuoteIndex];
        
        if (!skipAnimation) {
            // Use CSS class for smooth transition without resetting animations
            quoteTextElement.classList.add('fade-out');
            
            setTimeout(() => {
                // Update content
                quoteTextElement.textContent = `"${quote.text}"`;
                if (quoteAuthorElement) {
                    quoteAuthorElement.textContent = `— ${quote.author}`;
                }
                
                // Remove fade-out class to trigger fade-in via CSS
                quoteTextElement.classList.remove('fade-out');
            }, 300); // Reduced from 600ms for snappier transitions
        } else {
            // Direct update without animation (for initial load)
            quoteTextElement.textContent = `"${quote.text}"`;
            if (quoteAuthorElement) {
                quoteAuthorElement.textContent = `— ${quote.author}`;
            }
            // Ensure element is visible immediately 
            quoteTextElement.style.opacity = '1';
        }
    }
    
    function startQuoteCycling() {
        if (quoteInterval) clearInterval(quoteInterval);
        
        quoteInterval = setInterval(() => {
            currentQuoteIndex = (currentQuoteIndex + 1) % quotesArray.length;
            displayCurrentQuote();
        }, 6000);
    }
    
    function addCustomQuote() {
        const quoteText = prompt('Enter your motivational quote:');
        if (!quoteText || quoteText.trim() === '') return;
        
        const quoteAuthor = prompt('Enter the author name (or leave blank):');
        
        const newQuote = {
            text: quoteText.trim(),
            author: quoteAuthor && quoteAuthor.trim() !== '' ? quoteAuthor.trim() : 'Anonymous'
        };
        
        quotesArray.push(newQuote);
        saveQuotes(quotesArray);
        
        // Show the new quote
        currentQuoteIndex = quotesArray.length - 1;
        displayCurrentQuote();
        
        // Restart cycling
        startQuoteCycling();

        // Curator achievement
        if (xpSystemReady && !userXP.achievements.includes('curator')) {
            unlockAchievement('curator');
        }
    }
    
    // XP SYSTEM LOGIC
    
    function initXPSystem() {
        userXP = loadUserXP();
        xpSystemReady = true; // Must be set AFTER loadUserXP() so awardXP never runs on default values

        // Repair any pre-existing level/totalXP mismatch before the first render, so
        // accounts already damaged by a restore or by the old checkLevelUp bug are
        // corrected on next page load without the user having to do anything.
        if (reconcileLevelState('startup check')) saveUserXP(userXP);

        updateXPDisplay();

        // Auto-recovery: if a registered client comes back with a fully wiped local state
        // (Level 1 with 0 XP), pull the authoritative copy from the gist. This only fires
        // on true wipes — not on legitimate Level 1 accounts that simply haven't earned XP.
        // If the clientId itself was lost, the user must run
        // window.atcRestoreByClientId('<their-original-id>') once to re-bind.
        try { loadLeaderboardProfile(); } catch (_) {}
        if (lbRegistered && lbClientId && (userXP.level || 1) <= 1 && (userXP.totalXP || 0) === 0) {
            restoreFromGist().then(ok => {
                if (ok) {
                    showXPNotification(`🛟 Restored Level ${userXP.level} from cloud`, 'achievement');
                }
                // Revalidate after restore completes (or if restore skipped)
                try { revalidateAchievements(); } catch (_) {}
            }).catch(err => {
                console.warn('[Restore] auto-restore failed:', err);
                try { revalidateAchievements(); } catch (_) {}
            });
        } else {
            // No restore needed — still revalidate to catch any missing achievements
            try { revalidateAchievements(); } catch (_) {}
        }
    }
    
    function calculateXPForNextLevel(level) {
        // Exponential growth (Lee Sheldon method): XP needed = level^1.5 * 120
        return Math.floor(Math.pow(level, 1.5) * 120);
    }

    // ─── Level state is DERIVED, never independently stored ───────
    // totalXP is the only authoritative number. level and currentXP are a
    // projection of it onto the level curve, so they can always be recomputed:
    //
    //     totalXP === sum(calculateXPForNextLevel(l) for l in 1..level-1) + currentXP
    //
    // Several paths write all three fields independently — cloud restore
    // (applyPlayerRecordToLocal), admin-rollback overrides, and restoring under a
    // different clientId. Any of them can land a record where the stored level
    // disagrees with totalXP, which is why a restored account shows the wrong
    // level and a progress bar that never fills. Recomputing on load and after
    // every restore makes those paths self-healing.
    function deriveLevelFromTotalXP(totalXP) {
        let level = 1;
        let remaining = Math.max(0, Math.floor(Number(totalXP) || 0));
        let need = calculateXPForNextLevel(level);
        let guard = 0;

        while (remaining >= need && guard++ < LEVEL_LOOP_GUARD) {
            remaining -= need;
            level++;
            need = calculateXPForNextLevel(level);
        }
        return { level, currentXP: remaining };
    }

    // Repair userXP.level / userXP.currentXP if they disagree with totalXP.
    // Returns true when a repair was applied. Never touches totalXP, so no XP is
    // ever created or destroyed — this only re-slices what the user already has.
    function reconcileLevelState(reason) {
        const derived = deriveLevelFromTotalXP(userXP.totalXP);
        const storedLevel = userXP.level || 1;
        const storedCurrent = (typeof userXP.currentXP === 'number') ? userXP.currentXP : 0;

        if (derived.level === storedLevel && derived.currentXP === storedCurrent) return false;

        console.info(`[XP] Level state repaired: L${storedLevel}/${storedCurrent} → L${derived.level}/${derived.currentXP} (totalXP ${userXP.totalXP}${reason ? `, ${reason}` : ''})`);
        userXP.level = derived.level;
        userXP.currentXP = derived.currentXP;

        // Only surface a toast when the visible level actually moved — a
        // currentXP-only correction isn't worth interrupting anyone for.
        if (derived.level !== storedLevel) {
            showXPNotification(`🔧 Level corrected to ${derived.level} (${userXP.totalXP.toLocaleString()} total XP)`, 'achievement');
        }
        return true;
    }

    function awardXP(hoursWorked) {
        // Guard: do NOT run before initXPSystem() has loaded data from localStorage.
        // Without this, the default userXP values get saved to localStorage on every
        // page load (during the ~100ms before the setTimeout fires), wiping all progress.
        if (!xpSystemReady) return;
        
        const currentHour = Math.floor(hoursWorked);

        // Calculate and update streak. hoursWorked is passed through so a day with
        // no real hours logged can't advance the streak.
        calculateStreak(hoursWorked);
        
        // Reset daily tracking if it's a new day
        const today = new Date().toDateString();
        const lastDay = localStorage.getItem('xpLastDay');
        
        if (lastDay !== today) {
            userXP.lastHourTracked = -1;
            userXP.todayHours = 0;
            userXP.milestonesReached = [];
            localStorage.setItem('xpLastDay', today);
        }
        
        // Award XP for each completed hour (15 XP per hour)
        if (currentHour > userXP.lastHourTracked) {
            const hoursToAward = currentHour - Math.max(0, userXP.lastHourTracked);
            const xpGained = hoursToAward * XP_PER_HOUR;
            
            userXP.currentXP += xpGained;
            userXP.totalXP += xpGained;
            userXP.lastHourTracked = currentHour;
            // todayHours mirrors the floor of actual hours worked — do NOT accumulate,
            // otherwise the very first call of the day (lastHourTracked === -1) inflates it.
            userXP.todayHours = currentHour;
            
            // Show hourly XP notification
            if (hoursToAward > 0) {
                showXPNotification(`+${xpGained} XP for ${hoursToAward} hour(s)!`, 'hourly');
            }
            
            // Check for milestone bonuses
            checkMilestones(currentHour);
            
            // Award streak bonus (once per day, and only for a day with real hours).
            //
            // Two problems used to live here. The multiplier was uncapped, and the
            // payout was gated on `lastDay !== today` while sitting inside the
            // `currentHour > lastHourTracked` block — on a new day lastHourTracked is
            // reset to -1, so `0 > -1` passed and the bonus paid out at zero hours
            // worked. Opening the portal on a weekend was worth 20 x streak for
            // nothing, and each freebie raised the next day's payout.
            //
            // Tracking the award date explicitly (rather than piggybacking on
            // xpLastDay, which line ~6644 has already advanced by this point) means
            // the bonus can wait for the first real hour of the day and still fire
            // exactly once.
            if (userXP.consecutiveDays > 1 && hoursToAward > 0 && userXP.lastStreakBonusDate !== today) {
                userXP.lastStreakBonusDate = today;
                const streakMultiplier = Math.min(userXP.consecutiveDays, STREAK_BONUS_MAX_DAYS);
                const streakBonus = STREAK_BONUS * streakMultiplier;
                userXP.currentXP += streakBonus;
                userXP.totalXP += streakBonus;
                const capNote = userXP.consecutiveDays > STREAK_BONUS_MAX_DAYS ? ` (max ${STREAK_BONUS_MAX_DAYS}-day rate)` : '';
                showXPNotification(`🔥 ${userXP.consecutiveDays}-Day Streak! +${streakBonus} Bonus XP!${capNote}`, 'streak');
            }
            
            // Check for level up
            checkLevelUp();
        }

        // Achievements/shift-completion are evaluated on every call (not only on hour
        // boundaries) so the exact-shift "Badge of Balance" window can be detected
        // even if it falls between integer-hour ticks.
        checkAchievements(hoursWorked);

        saveUserXP(userXP);
        updateXPDisplay();
    }
    
    function calculateStreak(hoursWorked) {
        const now = new Date();
        const today = now.toDateString();
        const dayOfWeek = now.getDay();

        // Weekends are inert: they neither advance nor reset a streak.
        // Previously ANY new calendar day advanced it, because the skipped-work-day
        // scan below looks *strictly between* the two dates and so returns 0 for
        // Fri→Sat, Sat→Sun and Sun→Mon alike. A tab left open over a weekend banked
        // three free streak days and three streak bonuses.
        if (dayOfWeek === 0 || dayOfWeek === 6) return;

        // A day only counts once real hours are on the clock. Without this, merely
        // loading the portal was enough to claim the day.
        const hours = (typeof hoursWorked === 'number' && isFinite(hoursWorked)) ? hoursWorked : (userXP.todayHours || 0);
        if (hours < STREAK_MIN_HOURS) return;

        if (!userXP.lastAttendanceDate) {
            // First time the widget sees this user — start a streak of 1.
            // Note: totalWorkDays is NOT incremented here. It only ticks up once the
            // user actually completes a full shift (see checkAchievements).
            userXP.consecutiveDays = 1;
            userXP.lastAttendanceDate = today;
            return;
        }
        
        const lastDate = new Date(userXP.lastAttendanceDate);
        const currentDate = new Date(today);
        const diffTime = currentDate - lastDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Same day, no change
            return;
        }

        // Count how many actual work days (Mon–Fri) are strictly between lastDate and currentDate.
        // If zero, the two days are consecutive work days (possibly bridging a weekend).
        let skippedWorkDays = 0;
        const cursor = new Date(lastDate);
        cursor.setDate(cursor.getDate() + 1);
        while (cursor < currentDate) {
            const dow = cursor.getDay();
            if (dow !== 0 && dow !== 6) skippedWorkDays++;
            cursor.setDate(cursor.getDate() + 1);
        }

        if (skippedWorkDays === 0) {
            // Consecutive work day (weekend gap is forgiven)
            userXP.consecutiveDays++;
            if (userXP.consecutiveDays > userXP.longestStreak) {
                userXP.longestStreak = userXP.consecutiveDays;
            }
        } else {
            // Missed at least one real work day — streak resets.
            // Flag the reset so 'comeback' achievement can fire once a new streak rebuilds.
            userXP.consecutiveDays = 1;
            userXP.hadStreakReset = true;
        }

        userXP.lastAttendanceDate = today;
    }
    
    function checkMilestones(currentHour) {
        // Check if this milestone hasn't been reached today
        if (MILESTONE_BONUSES[currentHour] && !userXP.milestonesReached.includes(currentHour)) {
            const milestone = MILESTONE_BONUSES[currentHour];
            userXP.currentXP += milestone.xp;
            userXP.totalXP += milestone.xp;
            userXP.milestonesReached.push(currentHour);
            showXPNotification(`🎯 ${milestone.label}! +${milestone.xp} Bonus XP!`, 'milestone');
        }
    }
    
    function checkAchievements(hoursWorked) {
        // hoursWorked is a float (e.g. 7.42). All shift-completion checks use this
        // precise value rather than the truncated userXP.todayHours, so achievements
        // never fire early on partial work.
        if (typeof hoursWorked !== 'number') hoursWorked = (userXP.todayHours || 0);

        const shiftHours = getShiftSeconds() / 3600;
        const today = new Date().toDateString();
        const shiftCompletedToday = hoursWorked >= shiftHours;

        // Once per day: if the user has completed a full shift today and we haven't
        // already counted today, bump totalWorkDays. This is the SINGLE source of
        // truth for "shift completed", used by Day One / Full Week / Month Done.
        if (shiftCompletedToday && userXP.lastShiftCompletedDate !== today) {
            userXP.lastShiftCompletedDate = today;
            userXP.totalWorkDays = (userXP.totalWorkDays || 0) + 1;
        }

        // ── Shift-completion achievements ──────────────────────
        if (!userXP.achievements.includes('firstDay') && shiftCompletedToday) {
            unlockAchievement('firstDay');
        }
        if (!userXP.achievements.includes('week1') && (userXP.totalWorkDays || 0) >= 5) {
            unlockAchievement('week1');
        }
        if (!userXP.achievements.includes('workdays20') && (userXP.totalWorkDays || 0) >= 20) {
            unlockAchievement('workdays20');
        }
        if (!userXP.achievements.includes('centurion') && (userXP.totalWorkDays || 0) >= 100) {
            unlockAchievement('centurion');
        }

        // Badge of Balance: precisely within shift…shift+5min, evaluated on actual
        // float hours so it can't fire at hour-tick boundaries before the shift ends.
        if (!userXP.achievements.includes('onTime') &&
            hoursWorked >= shiftHours && hoursWorked <= shiftHours + (5 / 60)) {
            unlockAchievement('onTime');
        }

        // Single-day endurance achievements
        if (!userXP.achievements.includes('overtimeHero') && hoursWorked >= shiftHours + 2) {
            unlockAchievement('overtimeHero');
        }
        if (!userXP.achievements.includes('marathon') && hoursWorked >= 10) {
            unlockAchievement('marathon');
        }

        // ── Streak achievements ────────────────────────────────
        if (!userXP.achievements.includes('streak7') && (userXP.consecutiveDays || 0) >= 7) {
            unlockAchievement('streak7');
        }
        if (!userXP.achievements.includes('streak30') && (userXP.consecutiveDays || 0) >= 30) {
            unlockAchievement('streak30');
        }
        if (!userXP.achievements.includes('comeback') &&
            userXP.hadStreakReset && (userXP.consecutiveDays || 0) >= 3) {
            unlockAchievement('comeback');
        }

        // ── Level achievements ─────────────────────────────────
        if (!userXP.achievements.includes('level10') && userXP.level >= 10) {
            unlockAchievement('level10');
        }
        if (!userXP.achievements.includes('level25') && userXP.level >= 25) {
            unlockAchievement('level25');
        }
        if (!userXP.achievements.includes('level50') && userXP.level >= 50) {
            unlockAchievement('level50');
        }
        if (!userXP.achievements.includes('level100') && userXP.level >= 100) {
            unlockAchievement('level100');
        }

        // ── Gaming volume achievements ─────────────────────────
        if (!userXP.achievements.includes('gamer') && (userXP.gameSessions || 0) >= 50) {
            unlockAchievement('gamer');
        }
        if (!userXP.achievements.includes('gamer50') && (userXP.gameSessions || 0) >= 100) {
            unlockAchievement('gamer50');
        }
    }

    // Re-check ALL data-verifiable achievements against current stats.
    // Called on load and after restore so that achievements lost during a wipe
    // are automatically re-awarded when the underlying data supports them.
    function revalidateAchievements() {
        const a = userXP.achievements || [];
        const has = id => a.includes(id);
        // Silent=true: revalidation only restores badges, does NOT award XP.
        // XP was already earned when the achievement was first unlocked during gameplay.
        const S = true;

        // Shift / work-day based
        if (!has('firstDay')    && (userXP.totalWorkDays || 0) >= 1)   unlockAchievement('firstDay', S);
        if (!has('week1')       && (userXP.totalWorkDays || 0) >= 5)   unlockAchievement('week1', S);
        if (!has('workdays20')  && (userXP.totalWorkDays || 0) >= 20)  unlockAchievement('workdays20', S);
        if (!has('centurion')   && (userXP.totalWorkDays || 0) >= 100) unlockAchievement('centurion', S);

        // Streak based
        const bestStreak = Math.max(userXP.consecutiveDays || 0, userXP.longestStreak || 0);
        if (!has('streak7')     && bestStreak >= 7)  unlockAchievement('streak7', S);
        if (!has('streak30')    && bestStreak >= 30) unlockAchievement('streak30', S);

        // Level based
        if (!has('level10')     && (userXP.level || 1) >= 10)  unlockAchievement('level10', S);
        if (!has('level25')     && (userXP.level || 1) >= 25)  unlockAchievement('level25', S);
        if (!has('level50')     && (userXP.level || 1) >= 50)  unlockAchievement('level50', S);
        if (!has('level100')    && (userXP.level || 1) >= 100) unlockAchievement('level100', S);

        // Gaming volume
        if (!has('gamer')       && (userXP.gameSessions || 0) >= 50)  unlockAchievement('gamer', S);
        if (!has('gamer50')     && (userXP.gameSessions || 0) >= 100) unlockAchievement('gamer50', S);

        // Game high-score achievements (check localStorage bests)
        const snakeHS    = parseInt(localStorage.getItem('snakeHighScore')    || '0', 10);
        const flappyHS   = parseInt(localStorage.getItem('flappyHighScore')   || '0', 10);
        const tetrisHS   = parseInt(localStorage.getItem('tetrisHighScore')   || '0', 10);
        const breakoutHS = parseInt(localStorage.getItem('breakoutHighScore') || '0', 10);
        const poolWon    = parseInt(localStorage.getItem('poolGamesWon')      || '0', 10);
        const ludoWon    = parseInt(localStorage.getItem('ludoGamesWon')      || '0', 10);
        const aimHS      = parseInt(localStorage.getItem('aimChaosHighScore') || '0', 10);
        const reflexData = JSON.parse(localStorage.getItem('reflexHighScores') || '{}');
        const reflexBest = (reflexData.screen && typeof reflexData.screen.best === 'number') ? reflexData.screen.best : Infinity;

        if (!has('snakeCharmer') && snakeHS >= 40)     unlockAchievement('snakeCharmer', S);
        if (!has('flapMaster')   && flappyHS >= 50)    unlockAchievement('flapMaster', S);
        if (!has('poolShark')    && poolWon >= 100)    unlockAchievement('poolShark', S);
        if (!has('ludoChamp')    && ludoWon >= 100)    unlockAchievement('ludoChamp', S);
        // tetrisMaster, sharpshooter, brickBuster, lightning require session-specific
        // metrics (lines, accuracy, level, avgTime) that aren't in localStorage high-scores,
        // so they can only be granted during live gameplay via checkGameAchievements().
        // ludoFlawless and ludoHunter are the same: "lost no token" and "5 captures
        // in one match" are per-match facts, not running totals, so nothing in
        // localStorage can reconstruct them after the fact.
        if (!has('sharpshooter') && aimHS >= 600)      unlockAchievement('sharpshooter', S);
        if (!has('lightning')    && reflexBest <= 200 && reflexBest > 0) unlockAchievement('lightning', S);

        // Team/social
        if (!has('teamPlayer') && lbRegistered) unlockAchievement('teamPlayer', S);

        // Custom image
        if (!has('picturePerfect') && localStorage.getItem('customImageURL')) unlockAchievement('picturePerfect', S);

        // Prayer / meditation
        const prayerCount = parseInt(localStorage.getItem('prayerCount') || '0', 10);
        if (!has('meditative') && prayerCount >= 1000) unlockAchievement('meditative', S);

        saveUserXP(userXP);
    }

    // Per-game performance achievements — called from awardGameXP after a session ends.
    function checkGameAchievements(gameType, performance) {
        const p = performance || {};
        switch (gameType) {
            case 'snake':
                if (!userXP.achievements.includes('snakeCharmer') && (p.score || 0) >= 40) {
                    unlockAchievement('snakeCharmer');
                }
                break;
            case 'flappy':
                if (!userXP.achievements.includes('flapMaster') && (p.score || 0) >= 50) {
                    unlockAchievement('flapMaster');
                }
                break;
            case 'tetris':
                if (!userXP.achievements.includes('tetrisMaster') && (p.lines || 0) >= 50) {
                    unlockAchievement('tetrisMaster');
                }
                break;
            case 'aim':
                if (!userXP.achievements.includes('sharpshooter') &&
                    (p.accuracy || 0) >= 95 && (p.score || 0) >= 600) {
                    unlockAchievement('sharpshooter');
                }
                break;
            case 'reflex':
                if (!userXP.achievements.includes('lightning') &&
                    (p.avgTime || 9999) > 0 && (p.avgTime || 9999) < 220 &&
                    (p.falseStarts || 0) === 0) {
                    unlockAchievement('lightning');
                }
                break;
            case 'breakout':
                if (!userXP.achievements.includes('brickBuster') && (p.level || 0) >= 30) {
                    unlockAchievement('brickBuster');
                }
                break;
            case 'pool':
                if (!userXP.achievements.includes('poolShark') &&
                    typeof poolGamesWon === 'number' && poolGamesWon >= 100) {
                    unlockAchievement('poolShark');
                }
                break;
            case 'ludo':
                // All three are CPU-only: hot-seat wins cost nothing to farm,
                // so endLudoGame reports vsCPU and they are gated on it.
                if (!p.vsCPU) break;
                if (!userXP.achievements.includes('ludoChamp') && (p.gamesWon || 0) >= 100) {
                    unlockAchievement('ludoChamp');
                }
                if (!userXP.achievements.includes('ludoFlawless') && p.won && (p.tokensLost || 0) === 0) {
                    unlockAchievement('ludoFlawless');
                }
                if (!userXP.achievements.includes('ludoHunter') && (p.captures || 0) >= 5) {
                    unlockAchievement('ludoHunter');
                }
                break;
        }
    }
    
    // XP rewards per achievement tier
    const ACHIEVEMENT_XP = {
        // Shift completion
        firstDay: 50, week1: 100, workdays20: 200, centurion: 500,
        onTime: 75, marathon: 150, overtimeHero: 120,
        // Streaks
        streak7: 100, streak30: 300, comeback: 80,
        // Leveling (smaller — you already gained XP to reach the level)
        level10: 50, level25: 100, level50: 200, level100: 500,
        // Gaming
        gamer: 100, gamer50: 200,
        snakeCharmer: 80, flapMaster: 100, tetrisMaster: 120,
        sharpshooter: 100, lightning: 120, brickBuster: 100, poolShark: 150,
        ludoChamp: 150, ludoFlawless: 120, ludoHunter: 80,
        // Engagement
        curator: 40, picturePerfect: 40, meditative: 200, teamPlayer: 60
    };

    function unlockAchievement(achievementKey, silent) {
        if (userXP.achievements.includes(achievementKey)) return; // already unlocked
        userXP.achievements.push(achievementKey);
        const achievement = ACHIEVEMENTS[achievementKey];

        // Award XP for the achievement (skip if silent — e.g. during revalidation of old data)
        const xpReward = ACHIEVEMENT_XP[achievementKey] || 50;
        if (!silent) {
            userXP.currentXP += xpReward;
            userXP.totalXP += xpReward;
            checkLevelUp();
            showXPNotification(`${achievement.icon} Achievement Unlocked: ${achievement.name}! +${xpReward} XP`, 'achievement');
        } else {
            // Silent mode: still show notification but no XP (already-earned achievements restored)
            showXPNotification(`${achievement.icon} Achievement Restored: ${achievement.name}`, 'achievement');
        }

        saveUserXP(userXP);
        updateXPDisplay();
    }

    // ── Achievements "View All" Modal ─────────────────────────────
    function openAchievementsModal() {
        let overlay = document.getElementById('achievements-modal-overlay');
        let modal = document.getElementById('achievements-modal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'achievements-modal-overlay';
            overlay.className = 'achievements-modal-overlay';
            overlay.onclick = closeAchievementsModal;
            document.body.appendChild(overlay);
        }
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'achievements-modal';
            modal.className = 'achievements-modal';
            document.body.appendChild(modal);
        }

        const total = Object.keys(ACHIEVEMENTS).length;
        const earned = Object.keys(ACHIEVEMENTS).filter(k => userXP.achievements.includes(k)).length;

        const cards = Object.entries(ACHIEVEMENTS).map(([key, a]) => {
            const isEarned = userXP.achievements.includes(key);
            return `
                <div class="ach-card ${isEarned ? 'earned' : 'locked'}">
                    <div class="ach-card-icon">${isEarned ? a.icon : '🔒'}</div>
                    <div class="ach-card-body">
                        <div class="ach-card-name">${a.name}</div>
                        <div class="ach-card-desc">${a.desc}</div>
                    </div>
                    <div class="ach-card-status">${isEarned ? '✓' : ''}</div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="achievements-modal-header">
                <div>
                    <div class="achievements-modal-title">🏆 Achievements</div>
                    <div class="achievements-modal-subtitle">${earned} of ${total} unlocked</div>
                </div>
                <button type="button" class="achievements-modal-close" aria-label="Close">×</button>
            </div>
            <div class="achievements-modal-grid">${cards}</div>
        `;
        modal.querySelector('.achievements-modal-close').onclick = closeAchievementsModal;

        requestAnimationFrame(() => {
            overlay.classList.add('active');
            modal.classList.add('active');
        });
    }

    function closeAchievementsModal() {
        const overlay = document.getElementById('achievements-modal-overlay');
        const modal = document.getElementById('achievements-modal');
        if (overlay) overlay.classList.remove('active');
        if (modal) modal.classList.remove('active');
    }

    window.openAchievementsModal = openAchievementsModal;
    window.closeAchievementsModal = closeAchievementsModal;
    
    function checkLevelUp() {
        // xpNeeded MUST be recomputed on every iteration — the requirement grows
        // with level. It used to be a const captured before the loop (the
        // recomputed value was assigned to an unused local), so one large award
        // could grant several levels at the cheapest level's price, desyncing
        // level/currentXP from totalXP.
        let xpNeeded = calculateXPForNextLevel(userXP.level);
        let guard = 0;

        while (userXP.currentXP >= xpNeeded && guard++ < LEVEL_LOOP_GUARD) {
            userXP.currentXP -= xpNeeded;
            userXP.level++;

            showXPNotification(`🎊 Level Up! You're now Level ${userXP.level}!`, 'levelup');

            xpNeeded = calculateXPForNextLevel(userXP.level);
        }
    }
    
    function updateXPDisplay() {
        const levelElement = document.getElementById('xp-level');
        const currentXPElement = document.getElementById('xp-current');
        const neededXPElement = document.getElementById('xp-needed');
        const progressBar = document.getElementById('xp-progress-fill');
        const totalXPElement = document.getElementById('xp-total');
        const todayHoursElement = document.getElementById('xp-today-hours');
        const streakElement = document.getElementById('xp-streak');
        const longestStreakElement = document.getElementById('xp-longest-streak');
        const achievementsContainer = document.getElementById('xp-achievements');
        const nextMilestoneElement = document.getElementById('xp-next-milestone');
        
        const xpNeeded = calculateXPForNextLevel(userXP.level);
        const progress = (userXP.currentXP / xpNeeded) * 100;
        
        if (levelElement) levelElement.textContent = userXP.level;
        if (currentXPElement) currentXPElement.textContent = userXP.currentXP;
        if (neededXPElement) neededXPElement.textContent = xpNeeded;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (totalXPElement) totalXPElement.textContent = userXP.totalXP;
        if (todayHoursElement) todayHoursElement.textContent = userXP.todayHours;
        if (streakElement) streakElement.textContent = userXP.consecutiveDays;
        if (longestStreakElement) longestStreakElement.textContent = userXP.longestStreak;
        
        // Update achievements display - show only EARNED in row, plus a "View All" button
        if (achievementsContainer) {
            achievementsContainer.innerHTML = '';
            const earnedKeys = Object.keys(ACHIEVEMENTS).filter(k => userXP.achievements.includes(k));
            const totalCount = Object.keys(ACHIEVEMENTS).length;

            if (earnedKeys.length === 0) {
                const empty = document.createElement('span');
                empty.className = 'xp-achievements-empty';
                empty.textContent = 'No achievements yet — keep grinding! 💪';
                achievementsContainer.appendChild(empty);
            } else {
                earnedKeys.forEach(key => {
                    const achievement = ACHIEVEMENTS[key];
                    const badge = document.createElement('span');
                    badge.className = 'achievement-badge earned';
                    badge.innerHTML = achievement.icon;
                    badge.title = `${achievement.name}: ${achievement.desc} ✓`;
                    achievementsContainer.appendChild(badge);
                });
            }

            const viewAll = document.createElement('button');
            viewAll.type = 'button';
            viewAll.className = 'xp-achievements-view-all';
            viewAll.textContent = `View All (${earnedKeys.length}/${totalCount})`;
            viewAll.onclick = () => window.openAchievementsModal && window.openAchievementsModal();
            achievementsContainer.appendChild(viewAll);
        }
        
        // Show next milestone
        if (nextMilestoneElement) {
            const nextHour = Math.ceil((userXP.lastHourTracked + 1));
            const milestoneHours = [2, 4, 6, 8];
            const nextMilestone = milestoneHours.find(h => h > userXP.todayHours);
            
            if (nextMilestone) {
                const hoursRemaining = nextMilestone - userXP.todayHours;
                nextMilestoneElement.textContent = `${hoursRemaining}h to ${MILESTONE_BONUSES[nextMilestone].label}`;
                nextMilestoneElement.style.display = 'block';
            } else {
                nextMilestoneElement.style.display = 'none';
            }
        }
    }
    
    function showXPNotification(message, type = 'hourly') {
        const notification = document.createElement('div');
        notification.className = `xp-milestone-notification xp-notif-${type}`;
        notification.textContent = message;
        
        // Position stacked notifications
        const existingNotifications = document.querySelectorAll('.xp-milestone-notification');
        const offset = existingNotifications.length * 70;
        notification.style.top = `${20 + offset}px`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Game XP Reward System
    function awardGameXP(gameType, performance) {
        let xpGained = 0;
        let message = '';
        
        switch (gameType) {
            case 'snake': {
                // Award XP based on snake score (each food = points)
                const snakeScoreVal = performance.score || 0;
                if (snakeScoreVal >= 20) {
                    xpGained = 60;
                } else if (snakeScoreVal >= 15) {
                    xpGained = 45;
                } else if (snakeScoreVal >= 10) {
                    xpGained = 30;
                } else if (snakeScoreVal >= 5) {
                    xpGained = 18;
                } else if (snakeScoreVal >= 1) {
                    xpGained = 8;
                } else {
                    xpGained = 2;
                }
                if (performance.isHighScore) xpGained += 15;
                message = `🐍 +${xpGained} XP (Snake: ${snakeScoreVal} pts${performance.isHighScore ? ' 🏆 New Record!' : ''})`;
                break;
            }
                
            case 'flappy': {
                // Award XP based on pipes cleared
                const flappyScoreVal = performance.score || 0;
                if (flappyScoreVal >= 20) {
                    xpGained = 70;
                } else if (flappyScoreVal >= 10) {
                    xpGained = 45;
                } else if (flappyScoreVal >= 5) {
                    xpGained = 25;
                } else if (flappyScoreVal >= 1) {
                    xpGained = 10;
                } else {
                    xpGained = 3;
                }
                if (performance.isHighScore) xpGained += 20;
                message = `🐦 +${xpGained} XP (Flappy: ${flappyScoreVal} pipes${performance.isHighScore ? ' 🏆 New Record!' : ''})`;
                break;
            }
                
            case 'tetris': {
                // Award XP based on lines cleared and level reached
                const tetrisLinesVal = performance.lines || 0;
                const tetrisLevelVal = performance.level || 1;
                if (tetrisLinesVal >= 40) {
                    xpGained = 100;
                } else if (tetrisLinesVal >= 20) {
                    xpGained = 65;
                } else if (tetrisLinesVal >= 10) {
                    xpGained = 40;
                } else if (tetrisLinesVal >= 4) {
                    xpGained = 20;
                } else if (tetrisLinesVal >= 1) {
                    xpGained = 10;
                } else {
                    xpGained = 3;
                }
                xpGained += Math.min(tetrisLevelVal * 5, 25); // Level bonus
                if (performance.isHighScore) xpGained += 25;
                message = `🧱 +${xpGained} XP (Tetris: ${tetrisLinesVal} lines, Lvl ${tetrisLevelVal}${performance.isHighScore ? ' 🏆!' : ''})`;
                break;
            }
                
            case 'reflex': {
                // Award XP based on reaction time (faster = more XP)
                const avgTime = performance.avgTime || 999;
                if (avgTime < 180) {
                    xpGained = 85;
                } else if (avgTime < 220) {
                    xpGained = 65;
                } else if (avgTime < 260) {
                    xpGained = 50;
                } else if (avgTime < 300) {
                    xpGained = 40;
                } else if (avgTime < 400) {
                    xpGained = 28;
                } else {
                    xpGained = 15;
                }
                // Bonus for zero false starts
                if (performance.falseStarts === 0) xpGained += 15;
                else xpGained = Math.max(8, xpGained - (performance.falseStarts * 5));
                if (performance.isHighScore) xpGained += 20;
                message = `⚡ +${xpGained} XP (ReflexX: ${avgTime}ms avg${performance.falseStarts === 0 ? ' 🎯 Perfect!' : ''}${performance.isHighScore ? ' 🏆!' : ''})`;
                break;
            }
                
            case 'aim': {
                // Award XP based on score and accuracy
                const aimScoreVal = performance.score || 0;
                const aimAcc = performance.accuracy || 0;
                if (aimScoreVal >= 400) {
                    xpGained = 100;
                } else if (aimScoreVal >= 300) {
                    xpGained = 80;
                } else if (aimScoreVal >= 250) {
                    xpGained = 65;
                } else if (aimScoreVal >= 200) {
                    xpGained = 50;
                } else if (aimScoreVal >= 150) {
                    xpGained = 38;
                } else if (aimScoreVal >= 100) {
                    xpGained = 25;
                } else {
                    xpGained = 12;
                }
                // Accuracy bonuses
                if (aimAcc >= 90) {
                    xpGained += 25;
                    message = `🎯 +${xpGained} XP (Aim: ${aimScoreVal} pts + ${Math.round(aimAcc)}% accuracy 🔥)!`;
                } else if (aimAcc >= 75) {
                    xpGained += 15;
                    message = `🎯 +${xpGained} XP (Aim: ${aimScoreVal} pts + accuracy bonus)!`;
                } else {
                    message = `🎯 +${xpGained} XP (Aim: ${aimScoreVal} pts, ${Math.round(aimAcc)}% accuracy)`;
                }
                if (performance.isHighScore) xpGained += 20;
                break;
            }

            case 'breakout': {
                const brkScore = performance.score || 0;
                const brkLevel = performance.level || 1;
                if (brkScore >= 1500) {
                    xpGained = 120;
                } else if (brkScore >= 800) {
                    xpGained = 85;
                } else if (brkScore >= 400) {
                    xpGained = 55;
                } else if (brkScore >= 200) {
                    xpGained = 35;
                } else if (brkScore >= 100) {
                    xpGained = 25;
                } else {
                    xpGained = 12;
                }
                xpGained += Math.min(brkLevel * 8, 50); // level bonus
                if (performance.isHighScore) xpGained += 30;
                message = `🧱 +${xpGained} XP (Breakout: ${brkScore} pts, Lvl ${brkLevel}${performance.isHighScore ? ' 🏆 New Record!' : ''})`;
                break;
            }

            case 'pool': {
                // Decent reward for winning against CPU
                if (performance.won) {
                    xpGained = 80;
                    message = `🎱 +${xpGained} XP (Pool: Victory against CPU! 🏆)`;
                } else {
                    xpGained = 15;
                    message = `🎱 +${xpGained} XP (Pool: Good game)`;
                }
                break;
            }

            case 'ludo': {
                // The award itself is computed in endLudoGame — placement, tokens
                // home, captures, difficulty tier and board size — because that is
                // where the headless XP tests pin it. Re-clamped here because
                // AC_MAX_XP_PER_GAME is the host's contract with the sync
                // anti-cheat budget, and this is the last point before it lands.
                xpGained = Math.max(0, Math.min(AC_MAX_XP_PER_GAME, Math.round(performance.xp || 0)));
                const ludoSeats = performance.players || 2;
                if (!performance.vsCPU) {
                    message = `🎲 +${xpGained} XP (Ludo: ${ludoSeats}P hot-seat)`;
                } else if (performance.won) {
                    message = `🎲 +${xpGained} XP (Ludo: beat the ${performance.tier} CPU! 🏆)`;
                } else {
                    message = `🎲 +${xpGained} XP (Ludo: ${performance.tokensHome}/4 home vs ${performance.tier} CPU)`;
                }
                break;
            }
        }
        
        // Apply XP gain
        if (xpGained > 0) {
            userXP.currentXP += xpGained;
            userXP.totalXP += xpGained;
            userXP.gameSessions = (userXP.gameSessions || 0) + 1;
            
            // Check for level up
            checkLevelUp();

            // Check gamer achievement
            checkAchievements();
            // Per-game performance achievements (Snake Charmer, Sharpshooter, etc.)
            checkGameAchievements(gameType, performance);
            
            saveUserXP(userXP);
            updateXPDisplay();
            showXPNotification(message, 'game');
        }
    }
    
    // IMAGE BOX LOGIC
    
    function initImageBox() {
        currentImageURL = loadImageURL();
        currentAspectRatio = loadAspectRatio();
        updateImageDisplay();
        updateAspectRatioButtons();
    }
    
    function changeImage() {
        const newURL = prompt('Enter image URL from Google Images:', currentImageURL);
        
        if (newURL !== null && newURL.trim() !== '') {
            currentImageURL = newURL.trim();
            saveImageURL(currentImageURL);
            updateImageDisplay();

            // Picture Perfect achievement
            if (xpSystemReady && !userXP.achievements.includes('picturePerfect')) {
                unlockAchievement('picturePerfect');
            }
        }
    }
    
    function updateImageDisplay() {
        const imageDisplay = document.getElementById('image-display');
        if (!imageDisplay) return;
        
        // Apply aspect ratio
        const ratio = aspectRatios[currentAspectRatio];
        if (ratio) {
            imageDisplay.style.paddingBottom = ratio.paddingBottom;
        }
        
        if (currentImageURL && currentImageURL !== '') {
            imageDisplay.innerHTML = `<img src="${currentImageURL}" alt="Custom Image" class="image-box-img" onerror="this.parentElement.innerHTML='<div class=\\'image-placeholder\\'>❌ Failed to load image</div>'">`;
        } else {
            imageDisplay.innerHTML = '<div class="image-placeholder">📷 Click "Change Image" to add your favorite image</div>';
        }
    }
    
    function changeAspectRatio(ratio) {
        if (!aspectRatios[ratio]) return;
        
        // Only apply aspect ratio change if an image is loaded
        if (!currentImageURL || currentImageURL === '') {
            return;
        }
        
        currentAspectRatio = ratio;
        saveAspectRatio(ratio);
        updateImageDisplay();
        updateAspectRatioButtons();
    }
    
    function updateAspectRatioButtons() {
        Object.keys(aspectRatios).forEach(ratio => {
            const btn = document.getElementById(`aspect-ratio-${ratio.replace(':', '-')}`);
            if (btn) {
                if (ratio === currentAspectRatio) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }
    
    // Cache for preventing unnecessary updates
    let cachedValues = {
        totalWorked: '',
        remaining: '',
        completion: '',
        emoji: '',
        progress: -1
    };
    
    // Cache DOM elements to avoid repeated queries (prevents animation resets)
    let cachedElements = {
        totalWorkedTime: null,
        remainingTime: null,
        completionTime: null,
        emojiDisplay: null,
        progressFill: null,
        currentWorkedTime: null
    };
    
    // Mouse position for parallax effects
    let mouseX = 0;
    let mouseY = 0;
    
    // Modern CSS styles following 2025 trends
    const modernStyles = `
        <style id="attendance-modern-styles">
            @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
            
            :root {
                --mouse-x: 0;
                --mouse-y: 0;
                --aurora-1: #667eea;
                --aurora-2: #764ba2;
                --aurora-3: #f093fb;
                --aurora-4: #4facfe;
                --neon-cyan: #00f0ff;
                --neon-magenta: #ff00ff;
                --neon-green: #00ff41;
                --retro-dark: #0a0e27;
                --retro-dark-alt: #1a1d3a;
            }
            
            .attendance-summary {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
                backdrop-filter: blur(28px) saturate(160%);
                -webkit-backdrop-filter: blur(28px) saturate(160%);
                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 24px;
                box-shadow: 
                    0 8px 32px rgba(0, 0, 0, 0.1),
                    0 1px 2px rgba(0, 0, 0, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.12),
                    5px 5px 15px rgba(0, 0, 0, 0.08),
                    -5px -5px 15px rgba(255, 255, 255, 0.05);
                margin: 32px auto;
                padding: 32px;
                max-width: 1600px;
                position: relative;
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease, color 0.5s ease, border-color 0.5s ease;
                transform-style: preserve-3d;
                display: flex;
                gap: 24px;
                align-items: flex-start;
                /* Performance optimizations to prevent animation resets */
                will-change: transform;
                isolation: isolate;
            }
            
            /* Left Panel - Snake Game & Quotes */
            .left-panel {
                width: 400px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                flex-shrink: 0;
                /* CSS isolation to prevent reflows in other panels from affecting games */
                contain: layout style paint;
                will-change: contents;
                transform: translateZ(0);
                backface-visibility: hidden;
                transition: width 0.35s ease, opacity 0.3s ease, margin 0.35s ease;
            }

            /* Game Mode OFF — collapse side panels */
            .left-panel.game-mode-hidden,
            .right-panel.game-mode-hidden {
                width: 0 !important;
                min-width: 0 !important;
                opacity: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: none !important;
                flex-shrink: 1 !important;
                gap: 0 !important;
                max-height: 0 !important;
                height: 0 !important;
                transform: none !important;
            }

            /* Game Mode OFF — shrink the entire summary widget by 25% */
            #total-time-summary.game-mode-off {
                width: fit-content;
                transform: scale(0.9);
                transform-origin: top center;
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #total-time-summary:not(.game-mode-off) {
                transform: scale(1);
                transform-origin: top center;
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            /* Center Panel - Main Attendance Content */
            .main-attendance-content {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
            }
            
            /* Right Panel - XP System & Image Box */
            .right-panel {
                width: 400px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                flex-shrink: 0;
                transition: width 0.35s ease, opacity 0.3s ease, margin 0.35s ease;
            }
            
            .attendance-summary::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(
                    90deg, 
                    transparent, 
                    var(--aurora-1), 
                    var(--aurora-2), 
                    var(--aurora-3), 
                    var(--aurora-4), 
                    transparent
                );
                animation: shimmer 3s ease-in-out infinite;
                background-size: 200% 100%;
            }
            
            .attendance-summary:hover {
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.2),
                    0 6px 16px rgba(0, 0, 0, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2),
                    8px 8px 20px rgba(0, 0, 0, 0.12),
                    -8px -8px 20px rgba(255, 255, 255, 0.08);
            }
            
            .summary-header {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
                margin-bottom: 32px;
                text-align: center;
            }
            
            .emoji-display {
                font-size: 4rem;
                line-height: 1;
                animation: emojiPulse 3s ease-in-out infinite, emojiFloat 6s ease-in-out infinite;
                filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25));
                transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                cursor: pointer;
                filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25));
                /* Force GPU layer for smooth animation */
                will-change: transform, filter;
                transform: translateZ(0);
                backface-visibility: hidden;
            }
            
            .emoji-display:hover {
                transform: scale(1.15) rotate(5deg);
                filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));
            }
            
            .summary-title {
                font-size: 1.2rem;
                font-weight: 700;
                font-variation-settings: 'wght' 700;
                background: linear-gradient(
                    135deg, 
                    var(--aurora-1) 0%, 
                    var(--aurora-2) 25%,
                    var(--aurora-3) 50%,
                    var(--aurora-4) 75%,
                    var(--aurora-1) 100%
                );
                background-size: 200% 200%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin: 0;
                letter-spacing: -0.02em;
                animation: gradientFlow 8s ease infinite, titlePulse 4s ease-in-out infinite;
            }
            
            .modern-table {
                width: 100%;
                border-collapse: collapse;
                margin: 24px 0;
                background: rgba(255, 255, 255, 0.06);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: background 0.5s ease, box-shadow 0.5s ease;
            }
            
            .modern-table thead {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .modern-table th {
                padding: 16px 20px;
                font-weight: 600;
                font-size: 0.875rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border: none;
            }
            
            .modern-table td {
                padding: 16px 20px;
                border: none;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                font-weight: 500;
                color: rgba(255, 255, 255, 0.7);
                transition: background-color 0.2s ease, color 0.5s ease, border-color 0.5s ease;
            }
            
            .modern-table tbody tr {
                transition: all 0.1s ease;
            }
            
            .modern-table tbody tr:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.01);
            }
            
            .modern-table tbody tr:nth-child(even) {
                background: rgba(255, 255, 255, 0.03);
            }
            
            .gap-warning {
                background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;
                color: #2d3436 !important;
                font-weight: 600;
                text-align: center;
                padding: 12px !important;
                border-radius: 8px;
                margin: 8px 0;
                animation: warningPulse 1s ease-in-out infinite;
            }
            
            .time-stats {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                grid-template-rows: auto;
                gap: 20px;
                margin: 32px 0;
            }
            
            .stat-card {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 20px;
                padding: 24px;
                text-align: center;
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
                overflow: hidden;
                cursor: pointer;
                box-shadow: 
                    inset 5px 5px 10px rgba(0, 0, 0, 0.05),
                    inset -5px -5px 10px rgba(255, 255, 255, 0.05),
                    5px 5px 15px rgba(0, 0, 0, 0.1),
                    -2px -2px 10px rgba(255, 255, 255, 0.05);
                /* Isolate content updates from affecting this element's animations */
                contain: layout style;
                will-change: transform;
            }
            
            .stat-card.worked-time-card {
                background: linear-gradient(135deg, rgba(0, 184, 148, 0.25), rgba(0, 184, 148, 0.1));
                border-color: rgba(0, 184, 148, 0.35);
            }
            
            .stat-card.remaining-time-card {
                background: linear-gradient(135deg, rgba(225, 112, 85, 0.25), rgba(225, 112, 85, 0.1));
                border-color: rgba(225, 112, 85, 0.35);
            }
            
            .stat-card.completion-time-card {
                background: linear-gradient(135deg, rgba(108, 92, 231, 0.25), rgba(108, 92, 231, 0.1));
                border-color: rgba(108, 92, 231, 0.35);
            }
            
            .stat-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 3px;
                background: linear-gradient(
                    90deg, 
                    transparent, 
                    var(--aurora-1), 
                    var(--aurora-2), 
                    var(--aurora-3), 
                    transparent
                );
                animation: cardShimmer 2s ease-in-out infinite;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .attendance-summary.retro-theme .stat-card::before {
                background: linear-gradient(
                    90deg,
                    transparent,
                    var(--rt-cyber-hl),
                    var(--rt-accent),
                    var(--rt-cyber-panel),
                    transparent
                ) !important;
            }
            
            .stat-card:hover::before {
                opacity: 1;
            }
            
            .stat-card:hover {
                transform: translateY(-6px) scale(1.03) translateZ(20px);
                box-shadow: 
                    inset 8px 8px 15px rgba(0, 0, 0, 0.08),
                    inset -8px -8px 15px rgba(255, 255, 255, 0.08),
                    0 12px 32px rgba(0, 0, 0, 0.2),
                    0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .stat-card:active {
                transform: translateY(-2px) scale(0.98);
            }
            
            .stat-label {
                font-size: 0.875rem;
                font-weight: 500;
                font-variation-settings: 'wght' 500;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                transition: color 0.5s ease;
            }
            
            .stat-value {
                font-size: 1.75rem;
                font-weight: 700;
                font-variation-settings: 'wght' 700;
                margin-bottom: 4px;
                transition: font-variation-settings 0.3s ease;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                /* Isolate text updates to prevent animation resets */
                contain: layout style paint;
                display: block;
            }
            
            .stat-card:hover .stat-value {
                font-variation-settings: 'wght' 800;
            }
            
            .worked-time { 
                color: #00b894;
                text-shadow: 0 2px 12px rgba(0, 184, 148, 0.4);
            }
            .remaining-time { 
                color: #e17055;
                text-shadow: 0 2px 12px rgba(225, 112, 85, 0.4);
            }
            .completion-time { 
                color: #6c5ce7;
                text-shadow: 0 2px 12px rgba(108, 92, 231, 0.4);
            }
            
            .remaining-desc {
                font-size: 0.75rem;
                opacity: 0.8;
                margin-top: 4px;
                font-style: italic;
            }
            
            .completion-message {
                background: linear-gradient(135deg, #00b894, #00cec9);
                color: white;
                padding: 20px;
                border-radius: 16px;
                font-size: 1.25rem;
                font-weight: 600;
                text-align: center;
                margin-top: 24px;
                animation: celebrationPulse 1.5s ease-in-out infinite;
                box-shadow: 0 8px 24px rgba(0, 184, 148, 0.3);
            }
            
            /* Developer Info & Settings - Bottom Control Bar */
            /* Bottom Control Bar — sits as normal flex child inside main-attendance-content */
            .bottom-control-bar {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                margin-top: auto;
                padding-top: 18px;
                width: 100%;
            }

            .developer-info {
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-size: 1.1rem;
                color: #667eea;
                text-decoration: none;
                position: relative;
            }
            
            .developer-info:hover {
                transform: scale(1.08) translateY(-4px);
                background: rgba(255, 255, 255, 0.12);
                border-color: rgba(255, 255, 255, 0.25);
                box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
                z-index: 1000;
            }
            
            /* Settings Button */
            .settings-button {
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-size: 1.1rem;
                color: #764ba2;
            }
            
            .settings-button:hover {
                transform: scale(1.08) translateY(-4px);
                background: rgba(255, 255, 255, 0.12);
                border-color: rgba(255, 255, 255, 0.25);
                box-shadow: 0 8px 16px rgba(118, 75, 162, 0.3);
            }
            
            .developer-tooltip {
                position: absolute;
                bottom: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%) translateY(10px);
                background: linear-gradient(145deg, rgba(15, 15, 30, 0.96), rgba(25, 20, 50, 0.96));
                color: white;
                padding: 14px 16px;
                border-radius: 14px;
                font-size: 0.72rem;
                font-weight: 500;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(102, 126, 234, 0.15);
                min-width: 340px;
                text-align: center;
                z-index: 1001;
                backdrop-filter: blur(50px);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            
            .developer-info:hover .developer-tooltip {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) translateY(0);
            }
            
            .developer-tooltip::before {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 5px solid transparent;
                border-top-color: rgba(25, 20, 50, 0.96);
            }
            
            /* Picture-in-Picture Button Styles - Material Design 3 FAB */
            .pip-button {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                border-radius: 16px;
                padding: 14px 24px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1000;
                font-size: 0.875rem;
                font-weight: 600;
                display: none; /* Hidden by default, shown when PiP is supported */
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24), 0 4px 8px rgba(0, 0, 0, 0.12);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                letter-spacing: 0.5px;
            }
            
            .pip-button:hover {
                transform: scale(1.05) translateY(-4px);
                box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4), 0 6px 12px rgba(0, 0, 0, 0.2);
                background: linear-gradient(135deg, #764ba2, #667eea);
            }
            
            .pip-button:active {
                transform: scale(0.98);
            }
            
            .pip-button.active {
                background: linear-gradient(135deg, #e17055, #fab1a0);
                box-shadow: 0 12px 24px rgba(225, 112, 85, 0.4), 0 6px 12px rgba(0, 0, 0, 0.2);
            }
            
            .pip-button.active:hover {
                transform: scale(1.05) translateY(-4px);
                background: linear-gradient(135deg, #fab1a0, #e17055);
            }
            
            .pip-icon {
                display: inline-block;
                margin-right: 6px;
                font-size: 1rem;
                transition: transform 0.3s ease;
            }
            
            .pip-button:hover .pip-icon {
                transform: scale(1.1);
            }
            
            /* Focus state for accessibility */
            .pip-button:focus {
                outline: 2px solid rgba(102, 126, 234, 0.6);
                outline-offset: 2px;
            }
            
            .settings-button:focus,
            .developer-info:focus {
                outline: 2px solid rgba(118, 75, 162, 0.6);
                outline-offset: 2px;
            }
            
            /* PiP Active State Styles */
            .attendance-summary.pip-active {
                background: linear-gradient(135deg, rgba(225, 112, 85, 0.1), rgba(225, 112, 85, 0.05));
                border-color: rgba(225, 112, 85, 0.3);
            }
            
            .pip-placeholder {
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 200px;
                text-align: center;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .pip-placeholder.active {
                display: flex;
            }
            
            .pip-placeholder-icon {
                font-size: 3rem;
                margin-bottom: 12px;
                opacity: 0.6;
            }
            
            .pip-placeholder-text {
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 6px;
            }
            
            .pip-placeholder-desc {
                font-size: 0.8rem;
                opacity: 0.7;
            }
            
            /* PiP Window Specific Styles */
            .pip-window-content {
                padding: 16px !important;
                margin: 0 !important;
                max-width: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05)) !important;
                backdrop-filter: blur(20px) !important;
                -webkit-backdrop-filter: blur(20px) !important;
                min-height: auto !important;
                height: auto !important;
                overflow: visible !important;
                transition: all 0.3s ease !important;
            }
            
            /* PiP Window Dark Mode - Theme Aware */
            @media (prefers-color-scheme: dark) {
                /* Glassmorphic Theme for PiP */
                .pip-window-content:not(.retro-theme) {
                    background: linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.9)) !important;
                    color: rgba(255, 255, 255, 0.95) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }
                
                .pip-window-content:not(.retro-theme) .modern-table {
                    background: rgba(0, 0, 0, 0.3) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }
                
                .pip-window-content:not(.retro-theme) .modern-table td {
                    color: rgba(255, 255, 255, 0.85) !important;
                    font-family: 'Inter', sans-serif !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
                }
                
                .pip-window-content:not(.retro-theme) .stat-card {
                    background: rgba(0, 0, 0, 0.4) !important;
                    border: 1px solid rgba(255, 255, 255, 0.15) !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }
                
                .pip-window-content:not(.retro-theme) .stat-label {
                    color: rgba(255, 255, 255, 0.7) !important;
                    font-family: 'Inter', sans-serif !important;
                }
                
                .pip-window-content:not(.retro-theme) .stat-value {
                    font-family: 'Inter', sans-serif !important;
                }
                
                .pip-window-content:not(.retro-theme) .progress-bar {
                    background: rgba(255, 255, 255, 0.15) !important;
                    border: none !important;
                }
                
                .pip-window-content:not(.retro-theme) .pip-compact-button {
                    background: rgba(255, 255, 255, 0.2) !important;
                    color: rgba(255, 255, 255, 0.9) !important;
                    border: 1px solid rgba(255, 255, 255, 0.2) !important;
                    font-family: 'Inter', sans-serif !important;
                }
                
                .pip-window-content:not(.retro-theme) .pip-compact-button:hover {
                    background: rgba(108, 92, 231, 0.8) !important;
                    color: white !important;
                }
                
                .pip-window-content:not(.retro-theme) .summary-title {
                    font-family: 'Inter', sans-serif !important;
                    background: linear-gradient(135deg, #667eea, #764ba2) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                }
                
                /* Retro-Futuristic Theme for PiP — inherits tokens from main .retro-theme rules.
                   Only PiP-specific overrides (compact button, sizing) needed here. */
                .pip-window-content.retro-theme {
                    background: linear-gradient(135deg, var(--rt-bg-1) 0%, var(--rt-bg-2) 100%) !important;
                    color: var(--rt-text) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }

                .pip-window-content.retro-theme .pip-compact-button {
                    background: var(--rt-panel-strong) !important;
                    color: var(--rt-accent) !important;
                    border: 1px solid var(--rt-border-strong) !important;
                    box-shadow: inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.2) !important;
                    font-family: 'Orbitron', sans-serif !important;
                    font-weight: 700 !important;
                }

                .pip-window-content.retro-theme .pip-compact-button:hover {
                    background: rgba(var(--rt-accent-rgb), 0.2) !important;
                    color: var(--rt-text) !important;
                    box-shadow:
                        inset 0 0 0 1px var(--rt-accent),
                        0 0 12px rgba(var(--rt-accent-rgb), 0.45) !important;
                }
            }
            
            /* PiP Window Light Mode - Theme Aware */
            @media (prefers-color-scheme: light) {
                /* Glassmorphic Theme for PiP */
                .pip-window-content:not(.retro-theme) {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 248, 248, 0.95)) !important;
                    color: rgba(0, 0, 0, 0.9) !important;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }
                
                .pip-window-content:not(.retro-theme) .modern-table {
                    background: rgba(255, 255, 255, 0.9) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
                    border: 1px solid rgba(0, 0, 0, 0.1) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }
                
                .pip-window-content:not(.retro-theme) .modern-table td {
                    color: rgba(0, 0, 0, 0.8) !important;
                    font-family: 'Inter', sans-serif !important;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
                }
                
                .pip-window-content:not(.retro-theme) .stat-card {
                    background: rgba(255, 255, 255, 0.8) !important;
                    border: 1px solid rgba(0, 0, 0, 0.1) !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.worked-time-card {\n                    background: linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(0, 184, 148, 0.08)) !important;\n                    border-color: rgba(0, 184, 148, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.remaining-time-card {\n                    background: linear-gradient(135deg, rgba(225, 112, 85, 0.15), rgba(225, 112, 85, 0.08)) !important;\n                    border-color: rgba(225, 112, 85, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.completion-time-card {\n                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(108, 92, 231, 0.08)) !important;\n                    border-color: rgba(108, 92, 231, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-label {\n                    color: rgba(0, 0, 0, 0.6) !important;\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-value {\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .progress-bar {\n                    background: rgba(0, 0, 0, 0.1) !important;\n                    border: none !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .pip-compact-button {\n                    background: rgba(0, 0, 0, 0.1) !important;\n                    color: rgba(0, 0, 0, 0.7) !important;\n                    border: 1px solid rgba(0, 0, 0, 0.1) !important;\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .pip-compact-button:hover {\n                    background: rgba(108, 92, 231, 0.8) !important;\n                    color: white !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .summary-title {\n                    font-family: 'Inter', sans-serif !important;\n                    background: linear-gradient(135deg, #667eea, #764ba2) !important;\n                    -webkit-background-clip: text !important;\n                    -webkit-text-fill-color: transparent !important;\n                }\n                \n                /* Retro-Futuristic Theme for PiP (light mode) — inherits tokens from main .retro-theme */\n                .pip-window-content.retro-theme {\n                    background: linear-gradient(135deg, var(--rt-bg-1) 0%, var(--rt-bg-2) 100%) !important;\n                    color: var(--rt-text) !important;\n                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;\n                    position: relative !important;\n                    overflow: hidden !important;\n                }\n                \n                .pip-window-content.retro-theme .pip-compact-button {\n                    background: var(--rt-panel-strong) !important;\n                    color: var(--rt-accent) !important;\n                    border: 1px solid var(--rt-border-strong) !important;\n                    box-shadow: inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.2) !important;\n                    font-family: 'Orbitron', sans-serif !important;\n                    font-weight: 700 !important;\n                }\n                \n                .pip-window-content.retro-theme .pip-compact-button:hover {\n                    background: rgba(var(--rt-accent-rgb), 0.18) !important;\n                    color: var(--rt-text) !important;\n                    box-shadow:\n                        inset 0 0 0 1px var(--rt-accent),\n                        0 0 12px rgba(var(--rt-accent-rgb), 0.4) !important;\n                }\n                \n                .pip-window-content .gap-warning {\n                    background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;\n                    color: #2d3436 !important;\n                }\n            }
            
            .pip-window-content .summary-header {
                margin-bottom: 20px;
                gap: 12px;
            }
            
            .pip-window-content .emoji-display {
                font-size: 2.5rem;
            }
            
            .pip-window-content .summary-title {
                font-size: 1.5rem;
            }
            
            .pip-window-content .modern-table {
                margin: 16px 0;
                font-size: 0.8rem;
            }
            
            .pip-window-content .modern-table th,
            .pip-window-content .modern-table td {
                padding: 10px 12px;
                font-size: 0.75rem;
            }
            
            .pip-window-content .time-stats {
                grid-template-columns: 1fr;
                gap: 12px;
                margin: 20px 0;
            }
            
            .pip-window-content .stat-card {
                padding: 16px;
                border-radius: 12px;
            }
            
            .pip-window-content .stat-label {
                font-size: 0.75rem;
                margin-bottom: 6px;
            }
            
            .pip-window-content .stat-value {
                font-size: 1.2rem;
                margin-bottom: 2px;
            }
            
            .pip-window-content .remaining-desc {
                font-size: 0.7rem;
                opacity: 0.8;
            }
            
            .pip-window-content .progress-bar {
                height: 6px;
                margin: 16px 0;
            }
            
            .pip-window-content .completion-message {
                padding: 16px;
                font-size: 1rem;
                margin-top: 16px;
            }
            
            .pip-compact-button {
                position: absolute !important;
                top: 8px !important;
                right: 8px !important;
                background: rgba(255, 255, 255, 0.2) !important;
                border: none !important;
                border-radius: 6px !important;
                width: 32px !important;
                height: 24px !important;
                cursor: pointer !important;
                font-size: 12px !important;
                z-index: 1000 !important;
                transition: all 0.3s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: white !important;
            }
            
            .pip-compact-button:hover {
                background: rgba(108, 92, 231, 0.8) !important;
                transform: scale(1.05) !important;
            }
            
            /* Compact Mode Styles */
            .pip-window-content.compact-mode {
                padding: 0px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: auto !important;
                height: auto !important;
                max-height: 70px !important;
                overflow: hidden !important;
            }
            
            /* Compact mode - Glassmorphic Aurora theme */
            .compact-mode:not(.retro-theme) .pip-compact-display {
                text-align: center !important;
                background: rgba(255, 255, 255, 0.15) !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                border-radius: 0px 0px 5px 5px !important;
                padding: 8px 16px !important;
                backdrop-filter: blur(5px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(5px) saturate(180%) !important;
                box-shadow: 
                    0 0 20px rgba(102, 126, 234, 0.3),
                    0 0 40px rgba(118, 75, 162, 0.25),
                    0 0 60px rgba(240, 147, 251, 0.3),
                    0 8px 32px rgba(102, 126, 234, 0.2),
                    inset 0 0 30px rgba(102, 126, 234, 0.15),
                    inset 0 1px 1px rgba(255, 255, 255, 0.3) !important;
                transition: all 0.3s ease !important;
                cursor: pointer !important;
                position: relative !important;
                overflow: hidden !important;
                animation: auroraGlow 4s ease-in-out infinite !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-display::before {
                content: '' !important;
                position: absolute !important;
                top: -50% !important;
                left: -50% !important;
                width: 200% !important;
                height: 200% !important;
                background: linear-gradient(
                    135deg,
                    rgba(102, 126, 234, 0.4),
                    rgba(118, 75, 162, 0.35),
                    rgba(240, 147, 251, 0.4)
                ) !important;
                animation: gradientFlow 8s ease infinite !important;
                pointer-events: none !important;
                z-index: 0 !important;
                opacity: 1 !important;
                mix-blend-mode: screen !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-display:hover {
                transform: translateY(-2px) !important;
                box-shadow: 
                    0 12px 40px rgba(102, 126, 234, 0.3),
                    0 4px 12px rgba(118, 75, 162, 0.25),
                    inset 0 1px 1px rgba(255, 255, 255, 0.4) !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-time {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                font-size: 1.2rem !important;
                font-weight: 700 !important;
                color: #667eea !important;
                margin: 0 !important;
                letter-spacing: -0.02em !important;
                position: relative !important;
                z-index: 1 !important;
                text-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-label {
                font-family: 'Inter', sans-serif !important;
                font-size: 0.6rem !important;
                font-weight: 500 !important;
                color: rgba(102, 126, 234, 0.8) !important;
                text-transform: uppercase !important;
                letter-spacing: 0.1em !important;
                position: relative !important;
                z-index: 1 !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-emoji {
                font-size: 1.1rem !important;
                margin-left: 8px !important;
                display: inline-block !important;
                filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3)) !important;
                animation: emojiPulse 2s ease-in-out infinite !important;
                position: relative !important;
                z-index: 1 !important;
            }
            
            /* Compact mode — Cyberpunk HUD (light/dark adaptive via .retro-theme tokens) */
            .compact-mode.retro-theme .pip-compact-display {
                text-align: center !important;
                background: linear-gradient(135deg, var(--rt-bg-1) 0%, var(--rt-bg-2) 100%) !important;
                border: 1px solid var(--rt-border-strong) !important;
                border-radius: 2px !important;
                clip-path: var(--rt-clip);
                padding: 8px 16px !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                box-shadow:
                    inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.18),
                    0 6px 20px rgba(0, 0, 0, 0.18),
                    var(--rt-glow) !important;
                transition: all 0.3s ease !important;
                cursor: pointer !important;
                position: relative !important;
                overflow: hidden !important;
                animation: neonGlowPulse 4s ease-in-out infinite !important;
            }

            .compact-mode.retro-theme .pip-compact-display::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: 2px !important;
                background: linear-gradient(
                    90deg,
                    transparent,
                    var(--rt-cyber-hl),
                    var(--rt-accent),
                    var(--rt-cyber-panel),
                    transparent
                ) !important;
                background-size: 300% 100% !important;
                animation: rgbFlowBacklight 4s linear infinite !important;
                pointer-events: none !important;
                z-index: 2 !important;
                opacity: 0.95 !important;
            }

            .compact-mode.retro-theme .pip-compact-display:hover {
                transform: translateY(-1px) !important;
                box-shadow:
                    inset 0 0 0 1px var(--rt-accent),
                    0 8px 24px rgba(0, 0, 0, 0.22),
                    0 0 18px rgba(var(--rt-accent-rgb), 0.4) !important;
            }

            .compact-mode.retro-theme .pip-compact-time {
                font-family: 'Share Tech Mono', 'Orbitron', monospace !important;
                font-size: 1.2rem !important;
                font-weight: 700 !important;
                color: var(--rt-accent) !important;
                margin: 2px 0 0 0 !important;
                line-height: 1.1 !important;
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.15),
                    0 0 12px rgba(var(--rt-accent-rgb), 0.45) !important;
                letter-spacing: 0.08em !important;
                position: relative !important;
                z-index: 1 !important;
            }

            .compact-mode.retro-theme .pip-compact-label {
                font-family: 'Orbitron', sans-serif !important;
                font-size: 0.65rem !important;
                font-weight: 700 !important;
                color: var(--rt-text-dim) !important;
                margin: 0 0 0 0 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.22em !important;
                text-shadow: none !important;
                position: relative !important;
                z-index: 1 !important;
            }

            .compact-mode.retro-theme .pip-compact-emoji {
                font-size: 1rem !important;
                margin-left: 10px !important;
                display: inline-block !important;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)) drop-shadow(0 0 6px rgba(var(--rt-accent-rgb), 0.45)) !important;
                animation: emojiPulse 2s ease-in-out infinite !important;
                position: relative !important;
                z-index: 1 !important;
            }
            
            /* Performance optimization for dynamic elements */
            .stat-value, .emoji-display, .progress-fill {
                will-change: transform;
            }
            
            .progress-bar {
                width: 100%;
                height: 12px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                overflow: hidden;
                margin: 24px 0;
                position: relative;
                box-shadow: 
                    inset 3px 3px 6px rgba(0, 0, 0, 0.1),
                    inset -3px -3px 6px rgba(255, 255, 255, 0.05);
                transform-style: preserve-3d;
                transition: transform 0.3s ease;
                /* Isolate progress updates from parent style recalculation */
                contain: layout style;
            }
            
            .progress-bar:hover {
                transform: perspective(500px) rotateX(calc(var(--mouse-y) * -0.5deg)) rotateY(calc(var(--mouse-x) * 0.5deg));
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(
                    90deg, 
                    var(--aurora-1), 
                    var(--aurora-2), 
                    var(--aurora-3), 
                    var(--aurora-4)
                );
                background-size: 200% 100%;
                border-radius: 12px;
                transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
                animation: gradientFlow 3s ease infinite;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
                /* Force GPU compositing for smooth width transitions */
                will-change: width;
                transform: translateZ(0);
                backface-visibility: hidden;
            }
            
            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
                animation: progressShimmer 2s ease-in-out infinite;
            }
            
            /* Animations */
            @keyframes emojiPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            @keyframes emojiFloat {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            
            @keyframes shimmer {
                0% { 
                    background-position: -200% center;
                }
                100% { 
                    background-position: 200% center;
                }
            }
            
            @keyframes cardShimmer {
                0% { left: -100%; }
                50% { left: 50%; }
                100% { left: 100%; }
            }
            
            @keyframes progressShimmer {
                0% { left: -100%; }
                50% { left: 50%; }
                100% { left: 100%; }
            }
            
            @keyframes gradientFlow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            @keyframes titlePulse {
                0%, 100% { 
                    font-variation-settings: 'wght' 700;
                }
                50% { 
                    font-variation-settings: 'wght' 800;
                }
            }
            
            @keyframes warningPulse {
                0%, 100% { 
                    opacity: 1; 
                    transform: scale(1);
                }
                50% { 
                    opacity: 0.85;
                    transform: scale(0.98);
                }
            }
            
            @keyframes celebrationPulse {
                0%, 100% { 
                    transform: scale(1); 
                }
                25% { 
                    transform: scale(1.03) rotate(1deg); 
                }
                75% { 
                    transform: scale(1.03) rotate(-1deg); 
                }
            }
            
            @keyframes scanlines {
                0% { 
                    transform: translateY(0); 
                }
                100% { 
                    transform: translateY(4px); 
                }
            }
            
            @keyframes glitchText {
                0%, 90%, 100% {
                    transform: translate(0);
                    text-shadow: 
                        0 0 10px var(--neon-cyan),
                        0 0 20px var(--neon-cyan),
                        0 0 30px rgba(0, 240, 255, 0.5);
                }
                92% {
                    transform: translate(-2px, 1px);
                    text-shadow: 
                        2px 0 var(--neon-magenta),
                        -2px 0 var(--neon-cyan),
                        0 0 20px var(--neon-cyan);
                }
                94% {
                    transform: translate(2px, -1px);
                    text-shadow: 
                        -2px 0 var(--neon-magenta),
                        2px 0 var(--neon-cyan),
                        0 0 20px var(--neon-cyan);
                }
            }
            
            @keyframes neonPulse {
                0%, 100% {
                    box-shadow: 
                        0 0 5px var(--neon-cyan),
                        0 0 10px var(--neon-cyan),
                        inset 0 0 5px rgba(0, 240, 255, 0.2);
                }
                50% {
                    box-shadow: 
                        0 0 10px var(--neon-cyan),
                        0 0 20px var(--neon-cyan),
                        0 0 30px var(--neon-magenta),
                        inset 0 0 10px rgba(0, 240, 255, 0.3);
                }
            }
            
            @keyframes rgbFlowBacklight {
                0% {
                    background-position: 0% 50%;
                }
                50% {
                    background-position: 100% 50%;
                }
                100% {
                    background-position: 0% 50%;
                }
            }
            
            @keyframes auroraGlow {
                0%, 100% {
                    box-shadow: 
                        0 0 20px rgba(102, 126, 234, 0.5),
                        0 0 40px rgba(118, 75, 162, 0.4),
                        0 0 60px rgba(240, 147, 251, 0.3),
                        inset 0 0 30px rgba(102, 126, 234, 0.15) !important;
                }
                33% {
                    box-shadow: 
                        0 0 25px rgba(118, 75, 162, 0.6),
                        0 0 50px rgba(240, 147, 251, 0.5),
                        0 0 75px rgba(79, 172, 254, 0.4),
                        inset 0 0 35px rgba(118, 75, 162, 0.2) !important;
                }
                66% {
                    box-shadow: 
                        0 0 30px rgba(240, 147, 251, 0.6),
                        0 0 60px rgba(79, 172, 254, 0.5),
                        0 0 90px rgba(102, 126, 234, 0.4),
                        inset 0 0 40px rgba(240, 147, 251, 0.2) !important;
                }
            }
            
            @keyframes neonGlowPulse {
                0%, 100% {
                    box-shadow: 
                        0 0 20px rgba(0, 240, 255, 0.6),
                        0 0 40px rgba(255, 0, 255, 0.5),
                        0 0 60px rgba(0, 255, 65, 0.4),
                        inset 0 0 30px rgba(0, 240, 255, 0.2);
                    border-color: rgba(0, 240, 255, 0.4);
                }
                33% {
                    box-shadow: 
                        0 0 25px rgba(255, 0, 255, 0.7),
                        0 0 50px rgba(0, 255, 65, 0.6),
                        0 0 75px rgba(0, 240, 255, 0.5),
                        inset 0 0 35px rgba(255, 0, 255, 0.25);
                    border-color: rgba(255, 0, 255, 0.5);
                }
                66% {
                    box-shadow: 
                        0 0 30px rgba(0, 255, 65, 0.7),
                        0 0 60px rgba(0, 240, 255, 0.6),
                        0 0 90px rgba(255, 0, 255, 0.5),
                        inset 0 0 40px rgba(0, 255, 65, 0.25);
                    border-color: rgba(0, 255, 65, 0.5);
                }
            }
            
            /* Settings Modal */
            .settings-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1));
                backdrop-filter: blur(30px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 24px;
                padding: 32px;
                min-width: 400px;
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
            }
            
            .settings-modal.active {
                opacity: 1;
                visibility: visible;
                transform: translate(-50%, -50%) scale(1);
                max-height: 90vh;
                overflow-y: auto;
            
                /* Firefox */
                scrollbar-width: none;
            
                /* IE/Edge Legacy */
                -ms-overflow-style: none;
            }
            
            /* Chrome, Edge, Safari */
            .settings-modal.active::-webkit-scrollbar {
                display: none;
            }

            .settings-modal.active {
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,.25) transparent;
            }
            
            .settings-modal.active::-webkit-scrollbar {
                width: 6px;
            }
            
            .settings-modal.active::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .settings-modal.active::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,.25);
                border-radius: 999px;
            }
            
            .settings-modal.active::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,.45);
            }
            
            .settings-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(5px);
                z-index: 999;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .settings-modal-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            /* Pool Maximize Modal */
            .pool-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
            }

            .pool-modal-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            .pool-modal-panel {
                background: linear-gradient(135deg, rgba(255,255,255,0.13), rgba(255,255,255,0.07));
                backdrop-filter: blur(30px);
                -webkit-backdrop-filter: blur(30px);
                border: 1px solid rgba(255,255,255,0.18);
                border-radius: 20px;
                padding: 18px;
                box-shadow: 0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18);
                width: min(780px, 94vw);
                transform: scale(0.88);
                opacity: 0;
                transition: transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s ease;
            }

            .pool-modal-panel.active {
                transform: scale(1);
                opacity: 1;
            }

            .pool-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 14px;
            }

            .pool-modal-title {
                font-size: 1.1rem;
                font-weight: 700;
                color: rgba(255,255,255,0.9);
                letter-spacing: 0.02em;
            }

            .pool-modal-close {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 8px;
                color: rgba(255,255,255,0.8);
                font-size: 1rem;
                width: 32px;
                height: 32px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s ease;
            }

            .pool-modal-close:hover {
                background: rgba(255,80,80,0.4);
                color: #fff;
            }

            .pool-modal-canvas-wrap {
                width: 100%;
                border-radius: 10px;
                overflow: hidden;
                line-height: 0;
            }

            .pool-modal-canvas-wrap canvas {
                display: block;
                width: 100% !important;
                height: auto !important;
                border-radius: 10px;
            }
            
            .settings-title {
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 24px;
                background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .settings-option {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                margin-bottom: 12px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: all 0.3s ease;
            }
            
            .settings-option:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: translateX(4px);
            }
            
            .settings-option.disabled {
                opacity: 0.4;
                pointer-events: none;
                cursor: not-allowed;
            }
            
            .settings-option.disabled:hover {
                transform: none;
                background: rgba(255, 255, 255, 0.05);
            }
            
            .settings-option-label {
                font-weight: 500;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .toggle-switch {
                width: 50px;
                height: 26px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 13px;
                position: relative;
                cursor: pointer;
                transition: background 0.3s ease;
            }
            
            .toggle-switch.active {
                background: var(--aurora-1);
            }
            
            .toggle-switch.disabled {
                opacity: 0.5;
                cursor: not-allowed;
                background: rgba(255, 255, 255, 0.1) !important;
            }
            
            .toggle-switch::after {
                content: '';
                position: absolute;
                top: 3px;
                left: 3px;
                width: 20px;
                height: 20px;
                background: white;
                border-radius: 50%;
                transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .toggle-switch.active::after {
                transform: translateX(24px);
            }

            .settings-select {
                padding: 10px 16px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: white;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                outline: none;
                transition: all 0.3s ease;
                min-width: 140px;
            }
            
            .settings-select:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .settings-select:focus {
                border-color: var(--aurora-1);
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
            }
            
            .settings-select option {
                background: #2d3436;
                color: white;
                padding: 8px;
            }
            
            .close-modal-button {
                margin-top: 24px;
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                border: none;
                border-radius: 12px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .close-modal-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .attendance-summary {
                    margin: 16px;
                    padding: 24px 20px;
                }
                
                .summary-title {
                    font-size: 1.5rem;
                }
                
                .emoji-display {
                    font-size: 3rem;
                }
                
                .modern-table th,
                .modern-table td {
                    padding: 12px 16px;
                    font-size: 0.875rem;
                }
                
                .time-stats {
                    grid-template-columns: 1fr;
                    grid-template-rows: auto;
                    gap: 16px;
                }
                
                .stat-card.worked-time-card {
                    grid-column: 1;
                    grid-row: auto;
                }
                
                .pip-button {
                    bottom: 16px;
                    padding: 12px 20px;
                    font-size: 0.8rem;
                    border-radius: 14px;
                }
                
                .pip-icon {
                    margin-right: 4px;
                    font-size: 0.9rem;
                }
                
                /* Adjust button positions for mobile */
                .settings-button {
                    transform: translateX(-100px);
                    padding: 10px 14px;
                    font-size: 1rem;
                }
                
                .settings-button:hover {
                    transform: translateX(-100px) scale(1.08) translateY(-4px) rotate(90deg);
                }
                
                .developer-info {
                    transform: translateX(50px);
                    padding: 10px 14px;
                    font-size: 1rem;
                }
                
                .developer-info:hover {
                    transform: translateX(50px) scale(1.08) translateY(-4px);
                    z-index: 1000;
                }
            }
            
            /* Extra small screens (mobile) */
            @media (max-width: 480px) {
                .pip-window-content {
                    padding: 12px !important;
                }
                
                .pip-window-content .summary-header {
                    margin-bottom: 16px;
                    gap: 8px;
                }
                
                .pip-window-content .emoji-display {
                    font-size: 2rem;   
                }
                
                .pip-window-content .summary-title {
                    font-size: 1rem;
                }
                
                .pip-window-content .modern-table {
                    font-size: 0.7rem;
                    margin: 12px 0;
                }
                
                .pip-window-content .modern-table th,
                .pip-window-content .modern-table td {
                    padding: 8px 6px;
                    font-size: 0.65rem;
                }
                
                .pip-window-content .time-stats {
                    gap: 8px;
                    margin: 16px 0;
                }
                
                .pip-window-content .stat-card {
                    padding: 12px;
                }
                
                .pip-window-content .stat-label {
                    font-size: 0.7rem;
                    margin-bottom: 4px;
                }
                
                .pip-window-content .stat-value {
                    font-size: 1rem;
                }
                
                .pip-window-content .remaining-desc {
                    font-size: 0.65rem;
                }
                
                .pip-window-content .progress-bar {
                    height: 5px;
                    margin: 12px 0;
                }
                
                /* Make buttons more compact on small screens */
                .settings-button {
                    transform: translateX(-70px);
                    padding: 8px 12px;
                    font-size: 0.95rem;
                }
                
                .settings-button:hover {
                    transform: translateX(-70px) scale(1.08) translateY(-4px) rotate(90deg);
                }
                
                .developer-info {
                    transform: translateX(30px);
                    padding: 8px 12px;
                    font-size: 0.95rem;
                }
                
                .developer-info:hover {
                    transform: translateX(30px) scale(1.08) translateY(-4px);
                    z-index: 1000;
                }
                
                .pip-button {
                    padding: 10px 16px;
                    font-size: 0.75rem;
                }
            }
            
            /* Dark mode enhancements */
            @media (prefers-color-scheme: dark) {
                .attendance-summary {
                    background: linear-gradient(135deg, rgba(22, 20, 35, 0.92), rgba(12, 10, 25, 0.88));
                    backdrop-filter: blur(28px) saturate(150%);
                    -webkit-backdrop-filter: blur(28px) saturate(150%);
                    border-color: rgba(255, 255, 255, 0.12);
                    color: rgba(255, 255, 255, 0.92);
                }
                
                .modern-table {
                    background: rgba(0, 0, 0, 0.25);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                
                .stat-card {
                    background: rgba(255, 255, 255, 0.04);
                    border-color: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                }
                
                .modern-table td {
                    color: rgba(255, 255, 255, 0.75);
                }
                
                .stat-label {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .stat-card:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.2);
                }
                
                .attendance-summary:hover {
                    box-shadow: 
                        0 16px 48px rgba(0, 0, 0, 0.25),
                        0 4px 12px rgba(0, 0, 0, 0.18),
                        inset 0 1px 0 rgba(255, 255, 255, 0.15);
                }
                
                .pip-placeholder {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .pip-button {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-color: rgba(255, 255, 255, 0.2);
                    color: white;
                }
                
                .pip-button:hover {
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                }
                
                .pip-button.active {
                    background: linear-gradient(135deg, #e17055, #fab1a0);
                    box-shadow: 0 6px 20px rgba(225, 112, 85, 0.4);
                    color: white;
                }
            }
            
                /* Light mode enhancements */
            @media (prefers-color-scheme: light) {
                .attendance-summary:not(.retro-theme) {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(245, 243, 255, 0.88));
                    backdrop-filter: blur(28px) saturate(150%);
                    -webkit-backdrop-filter: blur(28px) saturate(150%);
                    border-color: rgba(102, 126, 234, 0.12);
                    color: rgba(0, 0, 0, 0.9);
                    box-shadow: 
                        0 8px 32px rgba(0, 0, 0, 0.08),
                        0 1px 2px rgba(0, 0, 0, 0.06),
                        inset 0 1px 0 rgba(255, 255, 255, 0.9);
                }
                
                .attendance-summary:not(.retro-theme)::before {
                    background: linear-gradient(
                        90deg, 
                        transparent, 
                        rgba(102, 126, 234, 0.5), 
                        rgba(118, 75, 162, 0.5), 
                        rgba(240, 147, 251, 0.5), 
                        rgba(79, 172, 254, 0.5), 
                        transparent
                    );
                    background-size: 200% 100%;
                    opacity: 0.7;
                }
                
                .attendance-summary:not(.retro-theme) .modern-table {
                    background: rgba(255, 255, 255, 0.75);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
                    border: 1px solid rgba(0, 0, 0, 0.06);
                }
                
                .attendance-summary:not(.retro-theme) .modern-table td {
                    color: rgba(0, 0, 0, 0.8);
                    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                }
                
                .attendance-summary:not(.retro-theme) .stat-card {
                    background: rgba(255, 255, 255, 0.65);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    border-color: rgba(0, 0, 0, 0.06);
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
                }
                
                .attendance-summary:not(.retro-theme) .stat-card.worked-time-card {
                    background: linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(0, 184, 148, 0.05));
                    border-color: rgba(0, 184, 148, 0.3);
                }
                
                .attendance-summary:not(.retro-theme) .stat-card.remaining-time-card {
                    background: linear-gradient(135deg, rgba(225, 112, 85, 0.15), rgba(225, 112, 85, 0.05));
                    border-color: rgba(225, 112, 85, 0.3);
                }
                
                .attendance-summary:not(.retro-theme) .stat-card.completion-time-card {
                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(108, 92, 231, 0.05));
                    border-color: rgba(108, 92, 231, 0.3);
                }
                
                .attendance-summary:not(.retro-theme) .stat-label {
                    color: rgba(0, 0, 0, 0.6);
                }
                
                .attendance-summary:not(.retro-theme) .developer-info {
                    background: rgba(255, 255, 255, 0.8);
                    border-color: rgba(0, 0, 0, 0.1);
                    color: #667eea;
                }
                
                .attendance-summary:not(.retro-theme) .developer-info:hover {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(0, 0, 0, 0.2);
                    z-index: 1000;
                }
                
                .attendance-summary:not(.retro-theme) .progress-bar {
                    background: rgba(0, 0, 0, 0.1);
                }
                
                .attendance-summary:not(.retro-theme) .gap-warning {
                    background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;
                    color: #2d3436 !important;
                }
                
                .attendance-summary:not(.retro-theme) .stat-card:hover {
                    background: rgba(255, 255, 255, 0.85);
                    border-color: rgba(102, 126, 234, 0.2);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
                }
                
                .attendance-summary:not(.retro-theme):hover {
                    box-shadow: 
                        0 12px 40px rgba(0, 0, 0, 0.1),
                        0 4px 12px rgba(0, 0, 0, 0.06),
                        inset 0 1px 0 rgba(255, 255, 255, 0.9);
                }
                
                .attendance-summary:not(.retro-theme) .pip-placeholder {
                    color: rgba(0, 0, 0, 0.7);
                }
                
                .attendance-summary:not(.retro-theme) .pip-button {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-color: rgba(255, 255, 255, 0.2);
                    color: white;
                }
                
                .attendance-summary:not(.retro-theme) .pip-button:hover {
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                }
                
                .attendance-summary:not(.retro-theme) .pip-button.active {
                    background: linear-gradient(135deg, #e17055, #fab1a0);
                    box-shadow: 0 6px 20px rgba(225, 112, 85, 0.4);
                    color: white;
                }
                
                /* Fix glassmorphic containers for light mode */
                .attendance-summary:not(.retro-theme) .snake-game-container,
                .attendance-summary:not(.retro-theme) .quotes-container,
                .attendance-summary:not(.retro-theme) .image-box-container {
                    background: rgba(255, 255, 255, 0.8);
                    border-color: rgba(0, 0, 0, 0.1);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                }
                
                .attendance-summary:not(.retro-theme) .xp-container {
                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.12), rgba(102, 126, 234, 0.08));
                    border-color: rgba(108, 92, 231, 0.25);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 4px 16px rgba(108, 92, 231, 0.15);
                }
                
                .attendance-summary:not(.retro-theme) .snake-game-title,
                .attendance-summary:not(.retro-theme) .quotes-title,
                .attendance-summary:not(.retro-theme) .xp-title {
                    color: rgba(0, 0, 0, 0.85);
                }
                
                .attendance-summary:not(.retro-theme) .snake-score,
                .attendance-summary:not(.retro-theme) .quote-text,
                .attendance-summary:not(.retro-theme) .xp-stat-label {
                    color: rgba(0, 0, 0, 0.65);
                }
                
                .attendance-summary:not(.retro-theme) .snake-canvas {
                    background: rgba(0, 0, 0, 0.05);
                }
                
                .attendance-summary:not(.retro-theme) .quote-add-btn,
                .attendance-summary:not(.retro-theme) .image-change-btn {
                    background: rgba(0, 0, 0, 0.08);
                    border-color: rgba(0, 0, 0, 0.15);
                    color: rgba(0, 0, 0, 0.8);
                }
                
                .attendance-summary:not(.retro-theme) .quote-add-btn:hover,
                .attendance-summary:not(.retro-theme) .image-change-btn:hover {
                    background: rgba(0, 0, 0, 0.12);
                }
                
                .attendance-summary:not(.retro-theme) .aspect-ratio-btn {
                    background: rgba(0, 0, 0, 0.08);
                    border-color: rgba(0, 0, 0, 0.15);
                    color: rgba(0, 0, 0, 0.8);
                }
                
                .attendance-summary:not(.retro-theme) .aspect-ratio-btn:hover {
                    background: rgba(0, 0, 0, 0.12);
                }
                
                .attendance-summary:not(.retro-theme) .aspect-ratio-btn.active {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-color: #667eea;
                    color: white;
                }
                
                .attendance-summary:not(.retro-theme) .xp-stat-item {
                    background: rgba(0, 0, 0, 0.05);
                }
                
                .attendance-summary:not(.retro-theme) .xp-progress-bar {
                    background: rgba(0, 0, 0, 0.1);
                }
                
                .attendance-summary:not(.retro-theme) .settings-button {
                    background: rgba(255, 255, 255, 0.8);
                    border-color: rgba(0, 0, 0, 0.1);
                    color: #764ba2;
                }
                
                .attendance-summary:not(.retro-theme) .settings-button:hover {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(0, 0, 0, 0.2);
                }
                
                .attendance-summary:not(.retro-theme) .image-placeholder {
                    color: rgba(0, 0, 0, 0.4);
                }

                /* ---- Game Switcher ---- */
                .attendance-summary:not(.retro-theme) .game-switcher {
                    background: rgba(0, 0, 0, 0.06);
                    scrollbar-color: rgba(0,0,0,0.15) transparent;
                }
                .attendance-summary:not(.retro-theme) .game-switch-btn {
                    background: rgba(0, 0, 0, 0.06);
                    border-color: rgba(0, 0, 0, 0.12);
                    color: rgba(0, 0, 0, 0.65);
                }
                .attendance-summary:not(.retro-theme) .game-switch-btn:hover {
                    background: rgba(0, 0, 0, 0.1);
                    border-color: rgba(0, 0, 0, 0.2);
                }
                .attendance-summary:not(.retro-theme) .game-switch-btn.active {
                    background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                    border-color: var(--aurora-1);
                    color: white;
                }

                /* ---- Multi-Game Area ---- */
                .attendance-summary:not(.retro-theme) .multi-game-area {
                    background: rgba(0, 0, 0, 0.06);
                }

                /* ---- Snake Game Overlay ---- */
                .attendance-summary:not(.retro-theme) .snake-game-over {
                    background: rgba(255, 255, 255, 0.92);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
                }
                .attendance-summary:not(.retro-theme) .snake-game-over h3 {
                    color: #d63031;
                }
                .attendance-summary:not(.retro-theme) .snake-game-over p {
                    color: rgba(0, 0, 0, 0.7);
                }
                .attendance-summary:not(.retro-theme) .snake-game-header {
                    color: rgba(0, 0, 0, 0.85);
                }

                /* ---- Prayer Counter ---- */
                .attendance-summary:not(.retro-theme) .prayer-panel {
                    background: linear-gradient(160deg, #f0f2f5 0%, #e8edf4 50%, #f0f2f5 100%);
                }
                .attendance-summary:not(.retro-theme) .prayer-panel::before {
                    background: radial-gradient(ellipse at 50% 30%, rgba(102,126,234,0.10) 0%, transparent 65%);
                }
                .attendance-summary:not(.retro-theme) .prayer-screen {
                    background: rgba(255, 255, 255, 0.75);
                    border-color: rgba(102,126,234,0.22);
                    box-shadow: 0 0 18px rgba(102,126,234,0.10), inset 0 0 8px rgba(0,0,0,0.04);
                }
                .attendance-summary:not(.retro-theme) .prayer-label {
                    color: rgba(102,126,234,0.8);
                }
                .attendance-summary:not(.retro-theme) .prayer-digital {
                    color: #059669;
                    text-shadow: 0 0 8px rgba(5,150,105,0.25);
                }
                .attendance-summary:not(.retro-theme) .prayer-sublabel {
                    color: rgba(0,0,0,0.38);
                }
                .attendance-summary:not(.retro-theme) .prayer-plus-btn {
                    box-shadow: 0 4px 14px rgba(102,126,234,0.3), 0 2px 6px rgba(0,0,0,0.12);
                }
                .attendance-summary:not(.retro-theme) .prayer-reset-btn {
                    border-color: rgba(0,0,0,0.12);
                    background: rgba(0,0,0,0.05);
                    color: rgba(0,0,0,0.5);
                }
                .attendance-summary:not(.retro-theme) .prayer-reset-btn:hover {
                    background: rgba(239,68,68,0.12);
                    color: #dc2626;
                    border-color: rgba(239,68,68,0.3);
                }

                /* ---- Settings Modal ---- */
                .attendance-summary:not(.retro-theme) .settings-modal {
                    background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(245,245,250,0.95));
                    border-color: rgba(0,0,0,0.12);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9);
                }
                .attendance-summary:not(.retro-theme) .settings-option {
                    background: rgba(0,0,0,0.03);
                    border-color: rgba(0,0,0,0.08);
                }
                .attendance-summary:not(.retro-theme) .settings-option:hover {
                    background: rgba(0,0,0,0.06);
                }
                .attendance-summary:not(.retro-theme) .settings-option-label {
                    color: rgba(0,0,0,0.85);
                }
                .attendance-summary:not(.retro-theme) .toggle-switch {
                    background: rgba(0,0,0,0.15);
                }
                .attendance-summary:not(.retro-theme) .settings-select {
                    background: rgba(255,255,255,0.85);
                    border-color: rgba(0,0,0,0.15);
                    color: rgba(0,0,0,0.85);
                }
                .attendance-summary:not(.retro-theme) .settings-select:hover {
                    background: rgba(255,255,255,0.95);
                    border-color: rgba(0,0,0,0.25);
                }
                .attendance-summary:not(.retro-theme) .settings-select option {
                    background: #fff;
                    color: #222;
                }
                .attendance-summary:not(.retro-theme) .settings-modal-overlay {
                    background: rgba(0,0,0,0.35);
                }

                /* ---- Pool Maximize Modal ---- */
                .attendance-summary:not(.retro-theme) .pool-modal-panel {
                    background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(245,245,250,0.95));
                    border-color: rgba(0,0,0,0.12);
                    box-shadow: 0 24px 80px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.9);
                }
                .attendance-summary:not(.retro-theme) .pool-modal-title {
                    color: rgba(0,0,0,0.85);
                }
                .attendance-summary:not(.retro-theme) .pool-modal-close {
                    background: rgba(0,0,0,0.06);
                    border-color: rgba(0,0,0,0.12);
                    color: rgba(0,0,0,0.7);
                }
                .attendance-summary:not(.retro-theme) .pool-modal-close:hover {
                    background: rgba(255,80,80,0.15);
                    color: #dc2626;
                }

                /* ---- XP Details ---- */
                .attendance-summary:not(.retro-theme) .xp-info {
                    color: rgba(0,0,0,0.55);
                }
                .attendance-summary:not(.retro-theme) .xp-stat-value {
                    color: #6c5ce7;
                }
                .attendance-summary:not(.retro-theme) .xp-streak {
                    background: rgba(255,107,53,0.08);
                    border-color: rgba(255,107,53,0.22);
                    color: rgba(0,0,0,0.8);
                }
                .attendance-summary:not(.retro-theme) .xp-achievements {
                    background: rgba(0,0,0,0.04);
                }
                .attendance-summary:not(.retro-theme) .xp-achievements:empty::before {
                    color: rgba(0,0,0,0.35);
                }
                .attendance-summary:not(.retro-theme) .xp-next-milestone {
                    background: rgba(255,193,7,0.1);
                    border-color: rgba(255,193,7,0.25);
                    color: #b8860b;
                }
                .attendance-summary:not(.retro-theme) .level-badge {
                    color: white;
                }

                /* ---- Quote Author ---- */
                .attendance-summary:not(.retro-theme) .quote-author {
                    color: rgba(0,0,0,0.5);
                }

                /* ---- Progress Bar Text ---- */
                .attendance-summary:not(.retro-theme) .progress-text {
                    color: rgba(0,0,0,0.6);
                }
                .attendance-summary:not(.retro-theme) .progress-fill {
                    box-shadow: none;
                }

                /* ---- Image Box Header ---- */
                .attendance-summary:not(.retro-theme) .image-box-title {
                    color: rgba(0,0,0,0.85);
                }
            }
            
            /* ============================================================
               NEUMORPHIC DEPTH — class-toggled via .neumorphic-active
               Adds pronounced 3-D inset / outset shadows to every surface
               ============================================================ */

            /* --- Dark mode neumorphic --- */
            .attendance-summary.neumorphic-active {
                box-shadow:
                    14px 14px 28px rgba(0, 0, 0, 0.22),
                    -10px -10px 22px rgba(255, 255, 255, 0.04),
                    inset 0 1px 0 rgba(255, 255, 255, 0.12),
                    0 8px 32px rgba(0, 0, 0, 0.12) !important;
                border-color: rgba(255, 255, 255, 0.22);
            }

            .attendance-summary.neumorphic-active .stat-card {
                box-shadow:
                    inset 5px 5px 10px rgba(0, 0, 0, 0.15),
                    inset -5px -5px 10px rgba(255, 255, 255, 0.04),
                    8px 8px 18px rgba(0, 0, 0, 0.18),
                    -4px -4px 12px rgba(255, 255, 255, 0.03) !important;
            }

            .attendance-summary.neumorphic-active .stat-card:hover {
                box-shadow:
                    inset 7px 7px 14px rgba(0, 0, 0, 0.18),
                    inset -7px -7px 14px rgba(255, 255, 255, 0.05),
                    12px 12px 24px rgba(0, 0, 0, 0.22),
                    -6px -6px 16px rgba(255, 255, 255, 0.04) !important;
            }

            .attendance-summary.neumorphic-active .modern-table {
                box-shadow:
                    inset 0 2px 6px rgba(0, 0, 0, 0.12),
                    6px 6px 14px rgba(0, 0, 0, 0.14),
                    -4px -4px 10px rgba(255, 255, 255, 0.03) !important;
                border-radius: 18px;
            }

            .attendance-summary.neumorphic-active .progress-bar {
                box-shadow:
                    inset 4px 4px 10px rgba(0, 0, 0, 0.18),
                    inset -4px -4px 10px rgba(255, 255, 255, 0.04) !important;
            }

            .attendance-summary.neumorphic-active .completion-message {
                box-shadow:
                    inset 4px 4px 10px rgba(0, 0, 0, 0.12),
                    inset -3px -3px 8px rgba(255, 255, 255, 0.04),
                    8px 8px 20px rgba(0, 184, 148, 0.25),
                    -4px -4px 12px rgba(255, 255, 255, 0.03) !important;
            }

            .attendance-summary.neumorphic-active .developer-info,
            .attendance-summary.neumorphic-active .settings-button,
            .attendance-summary.neumorphic-active .pip-button {
                box-shadow:
                    4px 4px 10px rgba(0, 0, 0, 0.15),
                    -3px -3px 8px rgba(255, 255, 255, 0.03),
                    inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
            }

            /* --- Light mode neumorphic overrides --- */
            @media (prefers-color-scheme: light) {
                .attendance-summary.neumorphic-active {
                    box-shadow:
                        14px 14px 28px rgba(0, 0, 0, 0.06),
                        -10px -10px 22px rgba(255, 255, 255, 0.85),
                        inset 0 1px 0 rgba(255, 255, 255, 0.9),
                        0 8px 32px rgba(0, 0, 0, 0.06) !important;
                    border-color: rgba(0, 0, 0, 0.08);
                }

                .attendance-summary.neumorphic-active .stat-card {
                    box-shadow:
                        inset 4px 4px 8px rgba(0, 0, 0, 0.05),
                        inset -4px -4px 8px rgba(255, 255, 255, 0.8),
                        6px 6px 14px rgba(0, 0, 0, 0.06),
                        -4px -4px 10px rgba(255, 255, 255, 0.8) !important;
                }

                .attendance-summary.neumorphic-active .stat-card:hover {
                    box-shadow:
                        inset 6px 6px 12px rgba(0, 0, 0, 0.07),
                        inset -6px -6px 12px rgba(255, 255, 255, 0.85),
                        10px 10px 20px rgba(0, 0, 0, 0.08),
                        -6px -6px 14px rgba(255, 255, 255, 0.85) !important;
                }

                .attendance-summary.neumorphic-active .modern-table {
                    box-shadow:
                        inset 0 2px 6px rgba(0, 0, 0, 0.04),
                        6px 6px 14px rgba(0, 0, 0, 0.05),
                        -4px -4px 10px rgba(255, 255, 255, 0.75) !important;
                }

                .attendance-summary.neumorphic-active .progress-bar {
                    box-shadow:
                        inset 4px 4px 10px rgba(0, 0, 0, 0.06),
                        inset -4px -4px 10px rgba(255, 255, 255, 0.7) !important;
                }

                .attendance-summary.neumorphic-active .completion-message {
                    box-shadow:
                        inset 3px 3px 8px rgba(0, 0, 0, 0.08),
                        inset -3px -3px 8px rgba(255, 255, 255, 0.7),
                        8px 8px 20px rgba(0, 184, 148, 0.15),
                        -4px -4px 12px rgba(255, 255, 255, 0.75) !important;
                }

                .attendance-summary.neumorphic-active .developer-info,
                .attendance-summary.neumorphic-active .settings-button,
                .attendance-summary.neumorphic-active .pip-button {
                    box-shadow:
                        4px 4px 10px rgba(0, 0, 0, 0.06),
                        -3px -3px 8px rgba(255, 255, 255, 0.7),
                        inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
                }
            }

            /* Neumorphic OFF = flat clean look (reset from defaults) */
            .attendance-summary:not(.neumorphic-active):not(.retro-theme) {
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
            }
            .attendance-summary:not(.neumorphic-active):not(.retro-theme) .stat-card {
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
            }
            .attendance-summary:not(.neumorphic-active):not(.retro-theme) .stat-card:hover {
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12) !important;
            }

            /* ============================================================
               FLUID GRADIENTS — class-toggled OFF via .no-fluid
               Removes all animated color-flow; makes everything static
               ============================================================ */

            /* Title: static single color instead of animated gradient text */
            .attendance-summary.no-fluid .summary-title {
                animation: none !important;
                background: var(--aurora-1) !important;
                background-size: 100% 100% !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
            }

            /* Top accent bar: static line instead of flowing shimmer */
            .attendance-summary.no-fluid::before {
                animation: none !important;
                background: var(--aurora-1) !important;
                opacity: 0.5 !important;
            }

            /* Stat card hover shimmer: disabled */
            .attendance-summary.no-fluid .stat-card::before {
                display: none !important;
            }

            /* Stat cards: solid tints instead of gradient */
            .attendance-summary.no-fluid .stat-card.worked-time-card {
                background: rgba(0, 184, 148, 0.12) !important;
            }
            .attendance-summary.no-fluid .stat-card.remaining-time-card {
                background: rgba(225, 112, 85, 0.12) !important;
            }
            .attendance-summary.no-fluid .stat-card.completion-time-card {
                background: rgba(108, 92, 231, 0.12) !important;
            }

            /* Progress bar fill: solid color, no rainbow animation */
            .attendance-summary.no-fluid .progress-fill {
                animation: none !important;
                background: var(--aurora-1) !important;
                background-size: 100% 100% !important;
            }
            .attendance-summary.no-fluid .progress-fill::after {
                display: none !important;
            }

            /* Completion message: solid instead of gradient */
            .attendance-summary.no-fluid .completion-message {
                animation: none !important;
                background: #00b894 !important;
            }

            /* Stat value text glow removed for clean look */
            .attendance-summary.no-fluid .worked-time {
                text-shadow: none !important;
            }
            .attendance-summary.no-fluid .remaining-time {
                text-shadow: none !important;
            }
            .attendance-summary.no-fluid .completion-time {
                text-shadow: none !important;
            }

            /* Table header: solid color */
            .attendance-summary.no-fluid .modern-table thead {
                background: #667eea !important;
            }

            /* PiP compact glassmorphic aurora glow: static */
            .no-fluid.compact-mode:not(.retro-theme) .pip-compact-display {
                animation: none !important;
            }
            .no-fluid.compact-mode:not(.retro-theme) .pip-compact-display::before {
                animation: none !important;
                opacity: 0.3 !important;
            }

            /* Light mode overrides for no-fluid */
            @media (prefers-color-scheme: light) {
                .attendance-summary.no-fluid .stat-card.worked-time-card {
                    background: rgba(0, 184, 148, 0.08) !important;
                }
                .attendance-summary.no-fluid .stat-card.remaining-time-card {
                    background: rgba(225, 112, 85, 0.08) !important;
                }
                .attendance-summary.no-fluid .stat-card.completion-time-card {
                    background: rgba(108, 92, 231, 0.08) !important;
                }
            }

            /* ============================================================
               CYBERPUNK HUD THEME (rebrand of "Sci-Fi Retro Futuristic")
               — Always uses neon-on-dark tokens since BG is user-controlled
                 and defaults to dark (#07091a). OS light/dark irrelevant.
               — Inspired by Cyberpunk 2077 menu / HUD bracket interfaces
               ============================================================ */

            /* Neon-on-dark tokens (always active — cyberpunk BG is always dark) */
            .retro-theme {
                --rt-bg-1: #07091a;
                --rt-bg-2: #11142b;
                --rt-panel: rgba(8, 10, 26, 0.78);
                --rt-panel-strong: rgba(8, 10, 26, 0.92);
                --rt-text: #fff200;            /* signature cyberpunk yellow */
                --rt-text-dim: rgba(255, 242, 0, 0.72);
                --rt-accent: #fff200;
                --rt-accent-rgb: 255, 242, 0;
                --rt-cyan: #00e5ff;
                --rt-cyan-rgb: 0, 229, 255;
                --rt-magenta: #ff2a6d;
                --rt-magenta-rgb: 255, 42, 109;
                --rt-lime: #05ffa1;
                --rt-lime-rgb: 5, 255, 161;
                --rt-border: rgba(255, 242, 0, 0.32);
                --rt-border-strong: rgba(255, 242, 0, 0.7);
                --rt-grid: rgba(255, 242, 0, 0.06);
                --rt-glow: 0 0 18px rgba(255, 242, 0, 0.35);
                --rt-scanline: rgba(0, 229, 255, 0.04);
            }

            /* Shared HUD clip-path with notched corners (top-left + bottom-right) */
            .retro-theme {
                --rt-clip: polygon(
                    14px 0,
                    100% 0,
                    100% calc(100% - 14px),
                    calc(100% - 14px) 100%,
                    0 100%,
                    0 14px
                );
            }

            /* ---- Main container ---- */
            .attendance-summary.retro-theme {
                background:
                    linear-gradient(135deg, var(--rt-bg-1) 0%, var(--rt-bg-2) 100%) !important;
                color: var(--rt-text) !important;
                border: 1px solid var(--rt-border-strong) !important;
                border-radius: 4px !important;
                box-shadow:
                    0 8px 32px rgba(0, 0, 0, 0.12),
                    inset 0 0 0 1px var(--rt-border),
                    var(--rt-glow) !important;
                position: relative;
                overflow: hidden;
            }

            /* Top accent bar — animated RGB flow */
            .attendance-summary.retro-theme::before {
                background: linear-gradient(
                    90deg,
                    transparent 0%,
                    var(--rt-cyber-hl) 15%,
                    var(--rt-accent) 40%,
                    var(--rt-cyber-panel) 65%,
                    var(--rt-cyber-hl) 85%,
                    transparent 100%
                ) !important;
                background-size: 300% 100% !important;
                height: 3px !important;
                animation: rgbFlowBacklight 4s linear infinite !important;
                z-index: 2;
                opacity: 1;
            }

            /* Background scanlines overlay (subtle CRT feel — no grid tiles) */
            .attendance-summary.retro-theme::after {
                content: '';
                position: absolute;
                inset: 0;
                background:
                    repeating-linear-gradient(
                        0deg,
                        var(--rt-scanline) 0px,
                        transparent 1px,
                        transparent 3px,
                        var(--rt-scanline) 4px
                    );
                animation: scanlines 10s linear infinite;
                pointer-events: none;
                z-index: 0;
                opacity: 0.55;
            }

            /* User background image overlay (set via JS inline style on a pseudo-like div) */
            .attendance-summary.retro-theme .cyber-bg-image {
                position: absolute;
                inset: 0;
                z-index: 0;
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                pointer-events: none;
                border-radius: inherit;
            }

            .attendance-summary.retro-theme .summary-header,
            .attendance-summary.retro-theme .modern-table,
            .attendance-summary.retro-theme .time-stats,
            .attendance-summary.retro-theme .progress-bar,
            .attendance-summary.retro-theme .completion-message,
            .attendance-summary.retro-theme .left-panel,
            .attendance-summary.retro-theme .right-panel {
                position: relative;
                z-index: 1;
            }

            /* Center panel sits above side panels so the tooltip is never clipped */
            .attendance-summary.retro-theme .main-attendance-content {
                position: relative;
                z-index: 2;
            }

            /* Developer-info & tooltip must stack above all panels */
            .attendance-summary.retro-theme .developer-info {
                position: relative;
                z-index: 10;
            }

            .attendance-summary.retro-theme .developer-info:hover {
                z-index: 10;
            }

            .attendance-summary.retro-theme .developer-tooltip {
                z-index: 9999 !important;
            }

            /* ---- Title ---- */
            .attendance-summary.retro-theme .summary-title {
                font-family: 'Orbitron', sans-serif !important;
                font-weight: 800 !important;
                letter-spacing: 0.18em !important;
                text-transform: uppercase !important;
                color: var(--rt-accent) !important;
                background: none !important;
                -webkit-background-clip: unset !important;
                -webkit-text-fill-color: var(--rt-accent) !important;
                text-shadow:
                    0 0 1px var(--rt-accent),
                    var(--rt-glow) !important;
            }

            .attendance-summary.retro-theme .emoji-display {
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)) drop-shadow(0 0 8px rgba(var(--rt-accent-rgb), 0.45)) !important;
            }

            /* ---- Table ---- */
            .attendance-summary.retro-theme .modern-table {
                background: var(--rt-panel) !important;
                border: 1px solid var(--rt-border) !important;
                border-radius: 2px !important;
                clip-path: var(--rt-clip);
                box-shadow:
                    inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.08),
                    0 4px 16px rgba(0, 0, 0, 0.08) !important;
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }

            .attendance-summary.retro-theme .modern-table thead {
                background: linear-gradient(
                    90deg,
                    rgba(var(--rt-accent-rgb), 0.18),
                    rgba(var(--rt-cyber-hl-rgb), 0.14)
                ) !important;
                border-bottom: 1px solid var(--rt-border-strong) !important;
            }

            .attendance-summary.retro-theme .modern-table th {
                font-family: 'Orbitron', sans-serif !important;
                font-weight: 700 !important;
                letter-spacing: 0.14em !important;
                text-transform: uppercase !important;
                color: var(--rt-accent) !important;
                text-shadow: var(--rt-glow) !important;
                font-size: 0.72rem !important;
            }

            .attendance-summary.retro-theme .modern-table td {
                color: var(--rt-text) !important;
                font-family: 'Share Tech Mono', monospace !important;
                border-bottom: 1px solid var(--rt-border) !important;
            }

            /* ---- Stat cards — Glassmorphic 3D HUD panels ---- */
            .attendance-summary.retro-theme .stat-card {
                background: rgba(var(--rt-accent-rgb), 0.04) !important;
                border: 1px solid rgba(var(--rt-accent-rgb), 0.22) !important;
                border-radius: 8px !important;
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.06),
                    inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.08),
                    0 8px 32px rgba(0, 0, 0, 0.18),
                    0 2px 6px rgba(0, 0, 0, 0.12) !important;
                backdrop-filter: blur(14px) saturate(130%);
                -webkit-backdrop-filter: blur(14px) saturate(130%);
                animation: neonPulse 5s ease-in-out infinite !important;
                position: relative !important;
                transform: perspective(600px) rotateX(1deg);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .attendance-summary.retro-theme .stat-card:hover {
                transform: perspective(600px) rotateX(0deg) translateY(-2px);
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.09),
                    inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.14),
                    0 12px 40px rgba(0, 0, 0, 0.25),
                    0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }

            /* Corner HUD bracket marker */
            .attendance-summary.retro-theme .stat-card::after {
                content: '';
                position: absolute;
                top: 6px;
                right: 10px;
                width: 10px;
                height: 10px;
                background: var(--card-accent, var(--rt-accent));
                clip-path: polygon(0 0, 100% 0, 100% 30%, 30% 30%, 30% 100%, 0 100%);
                opacity: 0.85;
                pointer-events: none;
            }

            .attendance-summary.retro-theme .stat-card.worked-time-card {
                --card-accent: var(--rt-cyber-hl);
                --card-accent-rgb: var(--rt-cyber-hl-rgb);
                background: rgba(var(--rt-cyber-hl-rgb), 0.06) !important;
                border-color: rgba(var(--rt-cyber-hl-rgb), 0.35) !important;
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.06),
                    inset 0 0 0 1px rgba(var(--rt-cyber-hl-rgb), 0.12),
                    0 8px 32px rgba(var(--rt-cyber-hl-rgb), 0.10),
                    0 2px 6px rgba(0, 0, 0, 0.12) !important;
            }

            .attendance-summary.retro-theme .stat-card.remaining-time-card {
                --card-accent: var(--rt-accent);
                --card-accent-rgb: var(--rt-accent-rgb);
                background: rgba(var(--rt-accent-rgb), 0.06) !important;
                border-color: rgba(var(--rt-accent-rgb), 0.35) !important;
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.06),
                    inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.12),
                    0 8px 32px rgba(var(--rt-accent-rgb), 0.10),
                    0 2px 6px rgba(0, 0, 0, 0.12) !important;
            }

            .attendance-summary.retro-theme .stat-card.completion-time-card {
                --card-accent: var(--rt-cyber-panel);
                --card-accent-rgb: var(--rt-cyber-panel-rgb);
                background: rgba(var(--rt-cyber-panel-rgb), 0.06) !important;
                border-color: rgba(var(--rt-cyber-panel-rgb), 0.35) !important;
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.06),
                    inset 0 0 0 1px rgba(var(--rt-cyber-panel-rgb), 0.12),
                    0 8px 32px rgba(var(--rt-cyber-panel-rgb), 0.10),
                    0 2px 6px rgba(0, 0, 0, 0.12) !important;
            }

            .attendance-summary.retro-theme .stat-label {
                color: var(--card-accent, var(--rt-cyber-hl)) !important;
                opacity: 0.85;
                font-family: 'Orbitron', sans-serif !important;
                font-weight: 700 !important;
                letter-spacing: 0.18em !important;
                text-transform: uppercase !important;
                text-shadow: none !important;
            }

            .attendance-summary.retro-theme .stat-value {
                color: var(--card-accent, var(--rt-accent)) !important;
                font-family: 'Share Tech Mono', monospace !important;
                font-weight: 700 !important;
                letter-spacing: 0.04em !important;
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.15),
                    0 0 12px rgba(var(--rt-accent-rgb), 0.35) !important;
            }

            .attendance-summary.retro-theme .worked-time {
                color: var(--rt-cyber-hl) !important;
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.15),
                    0 0 14px rgba(var(--rt-cyber-hl-rgb), 0.45) !important;
            }

            .attendance-summary.retro-theme .remaining-time {
                color: var(--rt-accent) !important;
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.15),
                    0 0 14px rgba(var(--rt-accent-rgb), 0.45) !important;
            }

            .attendance-summary.retro-theme .completion-time {
                color: var(--rt-cyber-panel) !important;
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.15),
                    0 0 14px rgba(var(--rt-cyber-panel-rgb), 0.45) !important;
            }

            /* ---- Progress bar ---- */
            .attendance-summary.retro-theme .progress-bar {
                background: linear-gradient(135deg,
                    rgba(var(--rt-cyber-panel-rgb), 0.10),
                    rgba(var(--rt-cyber-panel-rgb), 0.04)) !important;
                border: 1px solid rgba(var(--rt-cyber-panel-rgb), 0.28) !important;
                border-radius: 6px !important;
                backdrop-filter: blur(8px) saturate(130%) !important;
                -webkit-backdrop-filter: blur(8px) saturate(130%) !important;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.12) !important;
            }

            .attendance-summary.retro-theme .progress-fill {
                background: linear-gradient(
                    90deg,
                    var(--rt-cyber-hl),
                    var(--rt-accent),
                    var(--rt-cyber-panel),
                    var(--rt-cyber-hl)
                ) !important;
                background-size: 300% 100% !important;
                animation: rgbFlowBacklight 3s linear infinite !important;
                box-shadow:
                    0 0 10px rgba(var(--rt-accent-rgb), 0.5),
                    inset 0 0 6px rgba(255, 255, 255, 0.25) !important;
                position: relative;
                overflow: hidden;
            }

            .attendance-summary.retro-theme .progress-fill::after {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: -100% !important;
                width: 60% !important;
                height: 100% !important;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.4),
                    transparent
                ) !important;
                animation: progressShimmer 2s ease-in-out infinite !important;
            }

            /* ---- Buttons / chips ---- */
            .attendance-summary.retro-theme .developer-info,
            .attendance-summary.retro-theme .settings-button {
                background: linear-gradient(135deg,
                    rgba(var(--rt-cyber-panel-rgb), 0.14),
                    rgba(var(--rt-cyber-panel-rgb), 0.06)) !important;
                border: 1px solid rgba(var(--rt-cyber-panel-rgb), 0.32) !important;
                color: var(--rt-accent) !important;
                backdrop-filter: blur(10px) saturate(130%) !important;
                -webkit-backdrop-filter: blur(10px) saturate(130%) !important;
                box-shadow:
                    inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.15),
                    0 2px 6px rgba(0, 0, 0, 0.1) !important;
            }

            .attendance-summary.retro-theme .developer-info:hover,
            .attendance-summary.retro-theme .settings-button:hover {
                background: rgba(var(--rt-accent-rgb), 0.15) !important;
                color: var(--rt-text) !important;
                box-shadow:
                    inset 0 0 0 1px var(--rt-accent),
                    0 4px 12px rgba(var(--rt-accent-rgb), 0.35) !important;
                z-index: 1000;
            }

            .attendance-summary.retro-theme .pip-button {
                background: linear-gradient(
                    135deg,
                    rgba(var(--rt-cyber-hl-rgb), 0.18),
                    rgba(var(--rt-accent-rgb), 0.18)
                ) !important;
                border: 1px solid rgba(var(--rt-cyber-panel-rgb), 0.32) !important;
                color: var(--rt-text) !important;
                font-family: 'Orbitron', sans-serif !important;
                font-weight: 700 !important;
                letter-spacing: 0.1em !important;
                text-transform: uppercase !important;
                backdrop-filter: blur(10px) saturate(130%) !important;
                -webkit-backdrop-filter: blur(10px) saturate(130%) !important;
                box-shadow:
                    inset 0 0 0 1px rgba(var(--rt-accent-rgb), 0.2),
                    0 2px 8px rgba(0, 0, 0, 0.12) !important;
            }

            .attendance-summary.retro-theme .pip-button:hover {
                background: linear-gradient(
                    135deg,
                    rgba(var(--rt-cyber-hl-rgb), 0.35),
                    rgba(var(--rt-accent-rgb), 0.35)
                ) !important;
                box-shadow:
                    inset 0 0 0 1px var(--rt-accent),
                    0 6px 18px rgba(var(--rt-accent-rgb), 0.35) !important;
            }

            /* ---- Completion message ---- */
            .attendance-summary.retro-theme .completion-message {
                background: linear-gradient(
                    135deg,
                    rgba(var(--rt-cyber-panel-rgb), 0.18),
                    rgba(var(--rt-cyber-hl-rgb), 0.18)
                ) !important;
                border: 1px solid var(--rt-cyber-panel) !important;
                border-radius: 2px !important;
                clip-path: var(--rt-clip);
                color: var(--rt-cyber-panel) !important;
                font-family: 'Orbitron', sans-serif !important;
                font-weight: 700 !important;
                letter-spacing: 0.06em !important;
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.15),
                    0 0 12px rgba(var(--rt-cyber-panel-rgb), 0.5) !important;
                box-shadow:
                    inset 0 0 0 1px rgba(var(--rt-cyber-panel-rgb), 0.2),
                    0 4px 14px rgba(var(--rt-cyber-panel-rgb), 0.18) !important;
            }

            /* ---- Side panels (snake/quotes/xp/image) inherit HUD tokens ---- */
            .attendance-summary.retro-theme .snake-game-container,
            .attendance-summary.retro-theme .quotes-container,
            .attendance-summary.retro-theme .xp-container,
            .attendance-summary.retro-theme .image-box-container {
                color: var(--rt-text);
                position: relative;
                z-index: 1;
            }

            .attendance-summary.retro-theme .snake-game-title,
            .attendance-summary.retro-theme .quotes-title,
            .attendance-summary.retro-theme .xp-title,
            .attendance-summary.retro-theme .image-box-title {
                color: var(--rt-accent) !important;
                font-family: 'Orbitron', sans-serif !important;
                letter-spacing: 0.12em !important;
                text-transform: uppercase !important;
            }

            /* Ensure all secondary text inside retro-theme panels stays visible */
            .attendance-summary.retro-theme .snake-score {
                color: var(--rt-text-dim) !important;
            }
            .attendance-summary.retro-theme .snake-canvas {
                background: rgba(var(--rt-cyber-panel-rgb), 0.05) !important;
            }

            /* ---- User-customizable HUD color overrides ----
               Fallback chain ensures legacy styling if --rt-cyber-hl isn't set yet. */
            .attendance-summary.retro-theme {
                --rt-cyber-hl: var(--rt-cyan, #00e5ff);
                --rt-cyber-hl-rgb: var(--rt-cyan-rgb, 0, 229, 255);
                --rt-cyber-panel: var(--rt-cyan, #00e5ff);
                --rt-cyber-panel-rgb: var(--rt-cyan-rgb, 0, 229, 255);
            }

            /* Modern table — glassmorphic with user panel tint */
            .attendance-summary.retro-theme .modern-table {
                background: linear-gradient(135deg,
                    rgba(var(--rt-cyber-panel-rgb), 0.10),
                    rgba(var(--rt-cyber-panel-rgb), 0.04)) !important;
                border: 1px solid rgba(var(--rt-cyber-panel-rgb), 0.28) !important;
                border-radius: 10px !important;
                clip-path: none !important;
                backdrop-filter: blur(14px) saturate(140%) !important;
                -webkit-backdrop-filter: blur(14px) saturate(140%) !important;
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.06),
                    inset 0 0 0 1px rgba(var(--rt-cyber-panel-rgb), 0.12),
                    0 8px 32px rgba(0, 0, 0, 0.18),
                    0 2px 6px rgba(0, 0, 0, 0.10) !important;
            }

            /* Side panels — glassmorphic with user panel tint */
            .attendance-summary.retro-theme .snake-game-container,
            .attendance-summary.retro-theme .quotes-container,
            .attendance-summary.retro-theme .xp-container,
            .attendance-summary.retro-theme .image-box-container {
                background: linear-gradient(135deg,
                    rgba(var(--rt-cyber-panel-rgb), 0.10),
                    rgba(var(--rt-cyber-panel-rgb), 0.04)) !important;
                border: 1px solid rgba(var(--rt-cyber-panel-rgb), 0.28) !important;
                border-radius: 10px !important;
                clip-path: none !important;
                backdrop-filter: blur(14px) saturate(140%);
                -webkit-backdrop-filter: blur(14px) saturate(140%);
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.06),
                    inset 0 0 0 1px rgba(var(--rt-cyber-panel-rgb), 0.12),
                    0 8px 32px rgba(0, 0, 0, 0.18),
                    0 2px 6px rgba(0, 0, 0, 0.10) !important;
            }

            /* XP progress fill (was hardcoded purple) */
            .attendance-summary.retro-theme .xp-progress-fill {
                background: linear-gradient(90deg,
                    var(--rt-cyber-hl) 0%,
                    var(--rt-accent) 50%,
                    var(--rt-cyber-hl) 100%) !important;
                box-shadow: 0 0 12px rgba(var(--rt-cyber-hl-rgb), 0.45) !important;
            }

            /* XP stat values (was hardcoded #6c5ce7 / #a29bfe purple) */
            .attendance-summary.retro-theme .xp-stat-value {
                color: var(--rt-cyber-hl) !important;
            }
            .attendance-summary.retro-theme .xp-stat-label {
                color: var(--rt-accent) !important;
                opacity: 0.9;
            }
            .attendance-summary.retro-theme .xp-info {
                color: var(--rt-text-dim) !important;
            }

            /* Quotes text — dynamic cyber colors */
            .attendance-summary.retro-theme .quote-text {
                color: var(--rt-text) !important;
            }
            .attendance-summary.retro-theme .quote-author {
                color: var(--rt-cyber-hl) !important;
                opacity: 0.8;
            }
            .attendance-summary.retro-theme .quote-add-btn {
                background: rgba(var(--rt-cyber-panel-rgb), 0.12) !important;
                border-color: rgba(var(--rt-cyber-panel-rgb), 0.3) !important;
                color: var(--rt-accent) !important;
            }

            /* Level badge (was hardcoded purple) */
            .attendance-summary.retro-theme .level-badge {
                background: linear-gradient(135deg, var(--rt-cyber-hl), var(--rt-accent)) !important;
                color: var(--rt-bg-1) !important;
                box-shadow: 0 0 14px rgba(var(--rt-cyber-hl-rgb), 0.45) !important;
            }

            /* View-all achievements button (was glassmorphic purple rgba) */
            .attendance-summary.retro-theme .xp-achievements-view-all {
                background: linear-gradient(135deg,
                    rgba(var(--rt-cyber-hl-rgb), 0.22),
                    rgba(var(--rt-accent-rgb), 0.22)) !important;
                border: 1px solid var(--rt-cyber-hl) !important;
                color: var(--rt-text) !important;
            }
            .attendance-summary.retro-theme .xp-achievements-view-all:hover {
                background: linear-gradient(135deg,
                    rgba(var(--rt-cyber-hl-rgb), 0.45),
                    rgba(var(--rt-accent-rgb), 0.45)) !important;
                box-shadow: 0 4px 14px rgba(var(--rt-cyber-hl-rgb), 0.4) !important;
            }

            /* Aspect-ratio buttons (used aurora gradient) */
            .attendance-summary.retro-theme .aspect-ratio-btn {
                background: var(--rt-panel) !important;
                border: 1px solid var(--rt-border) !important;
                color: var(--rt-text) !important;
            }
            .attendance-summary.retro-theme .aspect-ratio-btn.active {
                background: linear-gradient(135deg, var(--rt-cyber-hl), var(--rt-accent)) !important;
                border-color: var(--rt-cyber-hl) !important;
                color: var(--rt-bg-1) !important;
                box-shadow: 0 4px 12px rgba(var(--rt-cyber-hl-rgb), 0.4) !important;
            }

            /* Game switch tabs (aurora gradient on active) */
            .attendance-summary.retro-theme .game-switch-btn {
                background: rgba(var(--rt-cyber-panel-rgb), 0.10) !important;
                border-color: rgba(var(--rt-cyber-panel-rgb), 0.28) !important;
                color: var(--rt-text-dim) !important;
            }
            .attendance-summary.retro-theme .game-switch-btn:hover {
                background: rgba(var(--rt-cyber-hl-rgb), 0.18) !important;
                border-color: var(--rt-cyber-hl) !important;
                color: var(--rt-text) !important;
            }
            .attendance-summary.retro-theme .game-switch-btn.active {
                background: linear-gradient(135deg, var(--rt-cyber-hl), var(--rt-accent)) !important;
                border-color: var(--rt-cyber-hl) !important;
                color: var(--rt-bg-1) !important;
            }

            /* Snake / generic game-control buttons (Play / Reset / PvCPU / Max) */
            .attendance-summary.retro-theme .snake-btn {
                background: linear-gradient(135deg, var(--rt-cyber-hl), var(--rt-accent)) !important;
                color: var(--rt-bg-1) !important;
                border: 1px solid var(--rt-cyber-hl) !important;
            }
            .attendance-summary.retro-theme .snake-btn:hover {
                box-shadow: 0 4px 14px rgba(var(--rt-cyber-hl-rgb), 0.45) !important;
                filter: brightness(1.1);
            }

            /* Settings modal elements follow cyberpunk colors */
            body:has(.retro-theme) .close-modal-button {
                background: linear-gradient(135deg, var(--rt-cyber-hl, #00e5ff), var(--rt-accent, #fff200)) !important;
                color: var(--rt-bg-1, #07091a) !important;
            }
            body:has(.retro-theme) .settings-title {
                background: linear-gradient(135deg, var(--rt-cyber-hl, #00e5ff), var(--rt-accent, #fff200)) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
            }
            
            /* Borderless PiP Window - Hide Browser Chrome */
            @media (display-mode: picture-in-picture) {
                /* Target the PiP window itself */
                :root {
                    /* Maximize content area */
                    overflow: hidden !important;
                }
                
                body {
                    /* Remove all default margins and padding */
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    border-radius: 0 !important;
                    overflow: hidden !important;
                    /* Extend content to cover potential title bar area */
                    min-height: 100vh !important;
                    height: 100vh !important;
                }
                
                html {
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    overflow: hidden !important;
                }
                
                /* Ensure content fills entire window including title bar area */
                .pip-window-content,
                .attendance-summary {
                    margin: 0 !important;
                    border-radius: 0 !important;
                    min-height: 100vh !important;
                    height: 100vh !important;
                    max-width: 100vw !important;
                    width: 100vw !important;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                    box-sizing: border-box !important;
                }
                
                /* Compact mode should also be borderless */
                .pip-compact-display {
                    border: none !important;
                    border-radius: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                    box-shadow: none !important;
                }
            }
            
            /* ==================== SNAKE GAME STYLES ==================== */
            .snake-game-container {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                padding: 16px;
                position: relative;
                overflow: hidden;
            }
            
            .snake-game-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .snake-game-title {
                font-size: 1rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
            }
            .snake-scoreboard {
                display: flex;
                gap: 12px;
            }
            .snake-score {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .snake-canvas {
                width: 100%;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
                display: block;
                image-rendering: pixelated;
                box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            
            .snake-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 12px;
                gap: 8px;
            }
            
            .snake-btn {
                padding: 8px 16px;
                background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                border: none;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.875rem;
            }
            
            .snake-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            .snake-game-over {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                padding: 24px;
                border-radius: 12px;
                text-align: center;
                display: none;
                z-index: 10;
            }
            
            .snake-game-over.active {
                display: block;
            }
            
            .snake-game-over h3 {
                color: #e17055;
                margin: 0 0 12px 0;
                font-size: 1.5rem;
            }
            
            .snake-game-over p {
                color: rgba(255, 255, 255, 0.8);
                margin: 8px 0;
            }
            
            /* ==================== MULTI-GAME SWITCHER STYLES ==================== */
            .game-switcher {
                display: flex;
                gap: 6px;
                margin-bottom: 12px;
                padding: 8px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 12px;
                overflow-x: auto;
                overflow-y: hidden;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.2) transparent;
            }

            .game-switcher::-webkit-scrollbar {
                height: 4px;
            }

            .game-switcher::-webkit-scrollbar-track {
                background: transparent;
            }

            .game-switcher::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 4px;
            }
            
            .game-switch-btn {
                padding: 8px 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                color: rgba(255, 255, 255, 0.7);
                font-size: 1.2rem;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .game-switch-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .game-switch-btn.active {
                background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                border-color: var(--aurora-1);
                color: white;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            
            .multi-game-area {
                width: 100%;
                height: 368px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
                position: relative;
                overflow: hidden;
                cursor: pointer;
                transition: background 0.3s ease;
                /* Force own compositing layer to isolate from parent reflows */
                transform: translateZ(0);
                will-change: transform;
                contain: layout style paint;
            }

            /* ==================== PRAYER COUNTER STYLES ==================== */
            .prayer-panel {
                width: 100%;
                height: 368px;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 20px;
                background: linear-gradient(160deg, #0d1b2a 0%, #1a2744 50%, #0d1b2a 100%);
                border-radius: 12px;
                position: relative;
                overflow: hidden;
            }
            .prayer-panel::before {
                content: '';
                position: absolute;
                inset: 0;
                background: radial-gradient(ellipse at 50% 30%, rgba(102,126,234,0.15) 0%, transparent 65%);
                pointer-events: none;
            }
            .prayer-screen {
                background: rgba(0, 0, 0, 0.55);
                border: 1.5px solid rgba(102,126,234,0.35);
                border-radius: 14px;
                padding: 18px 28px 14px;
                text-align: center;
                box-shadow: 0 0 24px rgba(102,126,234,0.20), inset 0 0 12px rgba(0,0,0,0.4);
                min-width: 220px;
            }
            .prayer-label {
                font-size: 0.65rem;
                letter-spacing: 0.18em;
                color: rgba(102,126,234,0.75);
                text-transform: uppercase;
                margin-bottom: 8px;
                font-family: 'Courier New', monospace;
            }
            .prayer-digital {
                font-family: 'Courier New', 'Lucida Console', monospace;
                font-size: 3.2rem;
                font-weight: 700;
                letter-spacing: 0.08em;
                color: #4ade80;
                text-shadow: 0 0 14px rgba(74,222,128,0.65), 0 0 28px rgba(74,222,128,0.25);
                line-height: 1.2;
                user-select: none;
                -webkit-font-smoothing: antialiased;
                font-variant-numeric: tabular-nums;
                word-spacing: -0.2em;
            }
            .prayer-sublabel {
                font-size: 0.6rem;
                color: rgba(255,255,255,0.35);
                margin-top: 6px;
                font-family: 'Courier New', monospace;
                letter-spacing: 0.08em;
            }
            .prayer-plus-btn {
                width: 88px;
                height: 88px;
                border-radius: 50%;
                border: 2.5px solid rgba(102,126,234,0.5);
                background: linear-gradient(145deg, #667eea, #764ba2);
                color: #fff;
                font-size: 1.6rem;
                font-weight: 700;
                font-family: 'Courier New', monospace;
                cursor: pointer;
                box-shadow: 0 4px 18px rgba(102,126,234,0.45), 0 2px 6px rgba(0,0,0,0.4);
                transition: transform 0.08s ease, box-shadow 0.08s ease;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
            }
            .prayer-plus-btn:hover {
                transform: scale(1.06);
                box-shadow: 0 6px 24px rgba(102,126,234,0.6);
            }
            .prayer-plus-btn:active,
            .prayer-plus-btn.prayer-tap-flash {
                transform: scale(0.94);
                background: linear-gradient(145deg, #4ade80, #22d3ee);
                box-shadow: 0 2px 10px rgba(74,222,128,0.55);
            }
            .prayer-reset-btn {
                position: absolute;
                top: 10px;
                right: 12px;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                border: 1.5px solid rgba(255,255,255,0.18);
                background: rgba(255,255,255,0.07);
                color: rgba(255,255,255,0.55);
                font-size: 0.85rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s, color 0.2s;
            }
            .prayer-reset-btn:hover {
                background: rgba(239,68,68,0.25);
                color: #f87171;
                border-color: rgba(239,68,68,0.4);
            }
            
            /* ==================== REFLEX GAME STYLES ==================== */
            .reflex-game-area {
                cursor: pointer;
            }
            
            .reflex-waiting-state {
                background: linear-gradient(135deg, #dc2626, #991b1b) !important;
                animation: pulseRed 1s ease-in-out infinite;
            }
            
            .reflex-ready-state {
                background: linear-gradient(135deg, #16a34a, #15803d) !important;
                animation: pulseGreen 0.5s ease-in-out infinite;
            }
            
            @keyframes pulseRed {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.85; }
            }
            
            @keyframes pulseGreen {
                0%, 100% { box-shadow: 0 0 20px rgba(22, 163, 74, 0.5); }
                50% { box-shadow: 0 0 40px rgba(22, 163, 74, 0.8); }
            }
            
            .reflex-target {
                cursor: crosshair;
                animation: targetPulse 1s ease-in-out infinite;
            }
            
            @keyframes targetPulse {
                0%, 100% { 
                    transform: scale(1);
                    box-shadow: 0 0 30px currentColor;
                }
                50% { 
                    transform: scale(1.1);
                    box-shadow: 0 0 50px currentColor;
                }
            }
            
            .reflex-mode-toggle {
                position: absolute;
                top: 10px;
                right: 10px;
                padding: 6px 12px;
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: white;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                z-index: 20;
            }
            
            .reflex-mode-toggle:hover {
                background: rgba(255, 255, 255, 0.25);
                transform: scale(1.05);
            }
            
            #reflex-stats,
            #aim-stats {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                margin-top: 8px;
                color: rgba(255, 255, 255, 0.9);
            }
            
            #reflex-results,
            #aim-results {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1));
                backdrop-filter: blur(30px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 24px;
                padding: 32px;
                min-width: 300px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
            }
            
            #reflex-results.active,
            #aim-results.active {
                opacity: 1;
                visibility: visible;
                transform: translate(-50%, -50%) scale(1);
            }
            
            /* ==================== AIM TRAINER STYLES ==================== */
            .aim-game-area {
                cursor: crosshair;
                background: 
                    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                    rgba(0, 0, 0, 0.3);
                background-size: 20px 20px;
            }
            
            .aim-target {
                animation: targetPulse 1s ease-in-out infinite;
                user-select: none;
                /* Force own compositing layer to prevent parent reflow interruptions */
                will-change: transform, opacity;
                backface-visibility: hidden;
            }
            
            .bullet-hole {
                animation: bulletHoleFade 2s ease-out forwards;
                user-select: none;
                pointer-events: none;
            }
            
            @keyframes targetAppear {
                0% {
                    opacity: 0;
                    transform: scale(0);
                }
                100% {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            @keyframes bulletHoleFade {
                0% { 
                    opacity: 0;
                    transform: scale(0);
                }
                10% {
                    opacity: 0.9;
                    transform: scale(1.2);
                }
                20%, 80% {
                    opacity: 0.8;
                    transform: scale(1);
                }
                100% { 
                    opacity: 0;
                    transform: scale(0.8);
                }
            }
            
            /* ==================== QUOTES BOX STYLES ==================== */
            .quotes-container {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                padding: 20px;
                min-height: 180px;
                position: relative;
                overflow: hidden;
                /* Isolate quote animations from parent updates */
                contain: layout style;
            }
            
            .quotes-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .quotes-title {
                font-size: 1rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .quote-add-btn {
                padding: 6px 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                color: white;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .quote-add-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .quote-display {
                text-align: center;
                padding: 20px 10px;
                min-height: 100px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .quote-text {
                font-size: 1rem;
                font-style: italic;
                color: rgba(255, 255, 255, 0.9);
                line-height: 1.6;
                opacity: 1;
                transition: opacity 0.3s ease, transform 0.3s ease;
                transform: translateY(0);
                /* Prevent animation resets from parent updates */
                contain: layout style paint;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-10px); }
            }
            
            .quote-text.fade-out {
                opacity: 0;
                transform: translateY(-10px);
            }
            
            .quote-author {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.6);
                margin-top: 12px;
                text-align: right;
                transition: opacity 0.3s ease;
                /* Prevent animation resets from parent updates */
                contain: layout style paint;
            }
            
            /* ==================== XP SYSTEM STYLES ==================== */
            .xp-container {
                background: linear-gradient(135deg, rgba(108, 92, 231, 0.2), rgba(102, 126, 234, 0.15));
                border: 1px solid rgba(108, 92, 231, 0.3);
                border-radius: 16px;
                padding: 20px;
                position: relative;
                overflow: hidden;
            }
            
            .xp-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .xp-title {
                font-size: 1rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .xp-level {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .level-badge {
                background: linear-gradient(135deg, #6c5ce7, #a29bfe);
                padding: 6px 12px;
                border-radius: 20px;
                font-weight: 700;
                font-size: 0.875rem;
                box-shadow: 0 2px 8px rgba(108, 92, 231, 0.4);
            }
            
            .xp-progress-container {
                margin-bottom: 12px;
            }
            
            .xp-progress-bar {
                width: 100%;
                height: 20px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 10px;
                overflow: hidden;
                position: relative;
            }
            
            .xp-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #6c5ce7, #a29bfe, #6c5ce7);
                background-size: 200% 100%;
                animation: gradientFlow 3s ease infinite;
                transition: width 0.5s ease;
                box-shadow: 0 0 10px rgba(108, 92, 231, 0.5);
            }
            
            .xp-info {
                display: flex;
                justify-content: space-between;
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 8px;
            }
            
            .xp-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-top: 12px;
            }
            
            .xp-stat-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 12px;
                border-radius: 8px;
                text-align: center;
            }
            
            .xp-stat-label {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 4px;
            }
            
            .xp-stat-value {
                font-size: 1.25rem;
                font-weight: 700;
                color: #a29bfe;
            }
            
            .xp-streak {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                margin-top: 12px;
                padding: 8px;
                background: rgba(255, 107, 53, 0.15);
                border: 1px solid rgba(255, 107, 53, 0.3);
                border-radius: 8px;
                font-weight: 600;
                font-size: 0.875rem;
            }
            
            .xp-streak-icon {
                font-size: 1.2rem;
                animation: fireFlicker 1.5s ease-in-out infinite;
            }
            
            @keyframes fireFlicker {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.9; }
            }
            
            .xp-achievements {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
                padding: 12px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                min-height: 50px;
                align-items: center;
                justify-content: center;
            }
            
            .xp-achievements:empty::before {
                content: 'Loading achievements... 🏆';
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.75rem;
                font-style: italic;
            }
            
            .achievement-badge {
                font-size: 1.8rem;
                cursor: pointer;
                transition: transform 0.3s ease, filter 0.3s ease, opacity 0.3s ease;
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
            }
            
            .achievement-badge.earned {
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
                opacity: 1;
            }
            
            .achievement-badge.unearned {
                filter: grayscale(1) brightness(0.5);
                opacity: 0.35;
                transform: scale(0.85);
            }
            
            .achievement-badge.unearned:hover {
                filter: grayscale(0.5) brightness(0.7);
                opacity: 0.6;
                transform: scale(1);
            }
            
            .achievement-badge:hover {
                transform: scale(1.2);
            }

            /* Earned-only row layout + View All button */
            .xp-achievements-empty {
                font-size: 0.78rem;
                font-style: italic;
                opacity: 0.6;
                padding: 4px 6px;
            }

            .xp-achievements-view-all {
                margin-left: auto;
                padding: 6px 12px;
                font-size: 0.75rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.35), rgba(118, 75, 162, 0.35));
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 999px;
                cursor: pointer;
                transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
                white-space: nowrap;
            }

            .xp-achievements-view-all:hover {
                transform: translateY(-1px);
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.55), rgba(118, 75, 162, 0.55));
                box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
            }

            /* Achievements Modal */
            .achievements-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                z-index: 9998;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.25s ease, visibility 0.25s ease;
            }

            .achievements-modal-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            .achievements-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.92);
                width: min(560px, 92vw);
                max-height: 80vh;
                background: linear-gradient(135deg, rgba(30, 30, 45, 0.92), rgba(20, 18, 35, 0.92));
                backdrop-filter: blur(30px);
                -webkit-backdrop-filter: blur(30px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 20px;
                padding: 22px 22px 18px;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                color: rgba(255, 255, 255, 0.92);
                display: flex;
                flex-direction: column;
                transition: opacity 0.25s ease, visibility 0.25s ease, transform 0.3s cubic-bezier(0.68, -0.4, 0.27, 1.4);
            }

            .achievements-modal.active {
                opacity: 1;
                visibility: visible;
                transform: translate(-50%, -50%) scale(1);
            }

            .achievements-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 14px;
            }

            .achievements-modal-title {
                font-size: 1.15rem;
                font-weight: 700;
                background: linear-gradient(135deg, #ffd86b, #ff8a3c);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .achievements-modal-subtitle {
                font-size: 0.78rem;
                opacity: 0.65;
                margin-top: 2px;
            }

            .achievements-modal-close {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 1px solid rgba(255, 255, 255, 0.18);
                background: rgba(255, 255, 255, 0.08);
                color: rgba(255, 255, 255, 0.9);
                font-size: 1.2rem;
                line-height: 1;
                cursor: pointer;
                transition: background 0.2s ease, transform 0.2s ease;
            }

            .achievements-modal-close:hover {
                background: rgba(255, 255, 255, 0.18);
                transform: rotate(90deg);
            }

            .achievements-modal-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 8px;
                overflow-y: auto;
                padding-right: 4px;
            }

            @media (min-width: 480px) {
                .achievements-modal-grid {
                    grid-template-columns: 1fr 1fr;
                }
            }

            .ach-card {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 14px;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                background: rgba(255, 255, 255, 0.04);
                transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
            }

            .ach-card.earned {
                border-color: rgba(255, 216, 107, 0.45);
                background: linear-gradient(135deg, rgba(255, 216, 107, 0.12), rgba(255, 138, 60, 0.08));
                box-shadow: 0 2px 12px rgba(255, 138, 60, 0.15);
            }

            .ach-card.earned:hover {
                transform: translateY(-1px);
                border-color: rgba(255, 216, 107, 0.7);
            }

            .ach-card.locked {
                opacity: 0.55;
            }

            .ach-card-icon {
                font-size: 1.8rem;
                width: 40px;
                text-align: center;
                flex-shrink: 0;
            }

            .ach-card.locked .ach-card-icon {
                filter: grayscale(1);
            }

            .ach-card-body {
                flex: 1;
                min-width: 0;
            }

            .ach-card-name {
                font-size: 0.88rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.95);
            }

            .ach-card-desc {
                font-size: 0.72rem;
                opacity: 0.7;
                margin-top: 2px;
            }

            .ach-card-status {
                font-size: 1.1rem;
                color: #6ee7b7;
                font-weight: 700;
                flex-shrink: 0;
            }

            /* Light-mode tuning for the modal */
            @media (prefers-color-scheme: light) {
                .achievements-modal {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(245, 243, 255, 0.94));
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    color: rgba(0, 0, 0, 0.85);
                }
                .achievements-modal-close {
                    background: rgba(0, 0, 0, 0.06);
                    border-color: rgba(0, 0, 0, 0.1);
                    color: rgba(0, 0, 0, 0.75);
                }
                .achievements-modal-close:hover {
                    background: rgba(0, 0, 0, 0.12);
                }
                .ach-card {
                    background: rgba(0, 0, 0, 0.03);
                    border-color: rgba(0, 0, 0, 0.08);
                }
                .ach-card-name {
                    color: rgba(0, 0, 0, 0.9);
                }
                .ach-card-status {
                    color: #10b981;
                }
            }
            
            .xp-next-milestone {
                margin-top: 8px;
                padding: 6px 12px;
                background: rgba(255, 193, 7, 0.15);
                border: 1px solid rgba(255, 193, 7, 0.3);
                border-radius: 6px;
                text-align: center;
                font-size: 0.75rem;
                color: rgba(255, 193, 7, 0.9);
                font-weight: 600;
            }
            
            .xp-milestone-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                border-radius: 12px;
                color: white;
                font-weight: 600;
                box-shadow: 0 8px 24px rgba(108, 92, 231, 0.5);
                z-index: 10000;
                animation: slideInRight 0.5s ease, fadeOut 0.5s ease 2.5s forwards;
                pointer-events: none;
                border: 1px solid rgba(255, 255, 255, 0.25);
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                opacity: 1 !important;
            }
            
            .xp-notif-hourly {
                background: linear-gradient(135deg, #4a5bd4, #5a3a8a);
                box-shadow: 0 8px 24px rgba(102, 126, 234, 0.7), 0 0 0 1px rgba(255,255,255,0.15);
            }
            
            .xp-notif-milestone {
                background: linear-gradient(135deg, #c94bce, #c03d5a);
                box-shadow: 0 8px 24px rgba(245, 87, 108, 0.7), 0 0 0 1px rgba(255,255,255,0.15);
            }
            
            .xp-notif-streak {
                background: linear-gradient(135deg, #c84e1e, #c46910);
                box-shadow: 0 8px 24px rgba(255, 107, 53, 0.7), 0 0 0 1px rgba(255,255,255,0.15);
            }
            
            .xp-notif-levelup {
                background: linear-gradient(135deg, #008a6e, #009a9a);
                box-shadow: 0 8px 24px rgba(0, 184, 148, 0.7), 0 0 0 1px rgba(255,255,255,0.15);
                font-size: 1.1rem;
            }
            
            .xp-notif-achievement {
                background: linear-gradient(135deg, #d4971a, #b84e1e);
                box-shadow: 0 8px 24px rgba(253, 203, 110, 0.7), 0 0 0 1px rgba(255,255,255,0.15);
                font-size: 1.05rem;
            }
            
            .xp-notif-game {
                background: linear-gradient(135deg, #1a7fc4, #6b2ab8);
                box-shadow: 0 8px 24px rgba(79, 172, 254, 0.7), 0 0 0 1px rgba(255,255,255,0.15);
                font-size: 1rem;
            }
            
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            /* ==================== IMAGE BOX STYLES ==================== */
            .image-box-container {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                padding: 16px;
                position: relative;
                overflow: hidden;
            }
            
            .image-box-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .image-change-btn {
                padding: 6px 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                color: white;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .image-change-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .aspect-ratio-controls {
                display: flex;
                gap: 4px;
                justify-content: center;
            }
            
            .aspect-ratio-btn {
                padding: 4px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                color: white;
                font-size: 1.1rem;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .aspect-ratio-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
            }
            
            .aspect-ratio-btn.active {
                background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                border-color: var(--aurora-1);
                box-shadow: 0 4px 12px rgba(255, 105, 180, 0.3);
            }
            
            .image-display {
                width: 100%;
                position: relative;
                padding-bottom: 56.25%; /* Default 16:9 widescreen ratio */
                border-radius: 12px;
                overflow: hidden;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .image-display .image-box-img {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover; /* Fill container without empty spaces */
                transition: transform 0.3s ease;
            }
            
            .image-display .image-box-img:hover {
                transform: scale(1.02);
            }
            
            .image-placeholder {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.875rem;
                text-align: center;
                width: 80%;
            }
            
            /* ==================== FLAPPY BIRD STYLES ==================== */
            #flappy-canvas {
                cursor: pointer;
                border-radius: 12px;
                box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);
            }

            /* ==================== TETRIS STYLES ==================== */
            #tetris-canvas {
                border-radius: 12px;
                box-shadow: 0 0 20px rgba(108, 92, 231, 0.3), inset 0 2px 8px rgba(0, 0, 0, 0.5);
                display: block;
                image-rendering: pixelated;
            }
            
            #breakout-canvas {
                border-radius: 12px;
                box-shadow: 0 0 24px rgba(0, 210, 255, 0.25), 0 0 8px rgba(124, 92, 252, 0.2);
                display: block;
                cursor: none;
            }

            #pool-canvas {
                border-radius: 12px;
                box-shadow: 0 0 20px rgba(45, 138, 78, 0.3), inset 0 2px 8px rgba(0, 0, 0, 0.4);
                display: block;
                cursor: crosshair;
                aspect-ratio: 1 / 1;
                width: 100%;
                height: auto;
            }

            /* ==================== LUDO STYLES ==================== */
            /* 344/416, not 1/1 — the board is square but sits between two 58px
               HUD strips. The backing store stays 344×416 while CSS scales the
               element, so ludoRender divides canvas.width by LUDO_CANVAS_W and
               hit-testing rescales pointer coords the same way. */
            #ludo-canvas {
                border-radius: 12px;
                box-shadow: 0 0 20px rgba(124, 92, 252, 0.28), inset 0 2px 8px rgba(0, 0, 0, 0.4);
                display: block;
                cursor: pointer;
                aspect-ratio: 344 / 416;
                width: 100%;
                height: auto;
                touch-action: manipulation;
                background: rgba(0, 0, 0, 0.3);
            }

            .ludo-rule-toggles {
                display: flex;
                flex-direction: column;
                gap: 6px;
                width: 100%;
            }

            .ludo-rule-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }

            .ludo-rule-row span {
                font-size: 0.82rem;
                opacity: 0.85;
            }

            .pool-color-swatches {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .pool-color-swatch {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,0.2);
                cursor: pointer;
                transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
            }

            .pool-color-swatch:hover {
                transform: scale(1.15);
                border-color: rgba(255,255,255,0.5);
            }

            .pool-color-swatch.active {
                border-color: #fff;
                box-shadow: 0 0 8px rgba(255,255,255,0.4);
                transform: scale(1.1);
            }

            /* Cyberpunk HUD color pickers */
            .cyber-color-pickers {
                display: flex;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
            }
            .cyber-color-pickers label {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                font-size: 0.65rem;
                color: rgba(255, 255, 255, 0.85);
                cursor: pointer;
                user-select: none;
            }
            .cyber-color-pickers input[type="color"] {
                width: 34px;
                height: 34px;
                padding: 0;
                border: 2px solid rgba(255, 255, 255, 0.25);
                border-radius: 8px;
                background: transparent;
                cursor: pointer;
                transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
            }
            .cyber-color-pickers input[type="color"]:hover {
                transform: scale(1.1);
                border-color: rgba(255, 255, 255, 0.6);
                box-shadow: 0 0 8px rgba(255, 255, 255, 0.25);
            }
            .cyber-color-pickers input[type="color"]::-webkit-color-swatch-wrapper { padding: 2px; }
            .cyber-color-pickers input[type="color"]::-webkit-color-swatch { border: none; border-radius: 5px; }

            /* Cyberpunk background image controls */
            .cyber-bg-controls {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            .cyber-bg-btn {
                padding: 6px 14px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 8px;
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.72rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .cyber-bg-btn:hover {
                background: rgba(255, 255, 255, 0.16);
                border-color: rgba(255, 255, 255, 0.4);
            }
            .cyber-bg-btn.cyber-bg-clear {
                padding: 6px 10px;
                color: #ff6b6b;
                border-color: rgba(255, 107, 107, 0.3);
            }
            .cyber-bg-btn.cyber-bg-clear:hover {
                background: rgba(255, 107, 107, 0.15);
            }
            .cyber-bg-opacity-label {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.65rem;
                color: rgba(255, 255, 255, 0.7);
            }
            .cyber-bg-opacity-label input[type="range"] {
                width: 70px;
                height: 4px;
                accent-color: var(--aurora-1, #00e5ff);
                cursor: pointer;
            }

            .tetris-wrapper {
                display: flex;
                justify-content: center;
                align-items: flex-start;
                width: 100%;
            }

            /* Responsive adjustments */
            @media (max-width: 1400px) {
                .attendance-summary {
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                .left-panel,
                .right-panel {
                    width: 350px;
                }
            }
            
            @media (max-width: 1200px) {
                .attendance-summary {
                    flex-direction: column;
                    max-width: 800px;
                    align-items: stretch;
                }
                
                .left-panel,
                .right-panel {
                    width: 100%;
                }
                
                .main-attendance-content {
                    order: -1; /* Show main content first on mobile */
                }
            }
            
            @media (max-width: 768px) {
                .attendance-summary {
                    padding: 20px;
                    margin: 16px auto;
                }
                
                .left-panel,
                .right-panel {
                    gap: 16px;
                }
            }

            /* ================================================================
               LIGHT MODE — FINAL OVERRIDES
               Must be AFTER all component styles so cascade order wins.
               ================================================================ */
            @media (prefers-color-scheme: light) {

                /* --- Glassmorphic containers --- */
                .snake-game-container,
                .quotes-container,
                .image-box-container {
                    background: rgba(255, 255, 255, 0.82);
                    border-color: rgba(0, 0, 0, 0.10);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
                }

                .xp-container {
                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.10), rgba(102, 126, 234, 0.06));
                    border-color: rgba(108, 92, 231, 0.20);
                    box-shadow: 0 4px 16px rgba(108, 92, 231, 0.10);
                }

                /* --- Snake Game Header & Scores --- */
                .snake-game-header {
                    color: rgba(0, 0, 0, 0.85);
                }
                .snake-game-title {
                    color: rgba(0, 0, 0, 0.88);
                }
                .snake-score {
                    color: rgba(0, 0, 0, 0.60);
                }
                .snake-canvas {
                    background: rgba(0, 0, 0, 0.05);
                }
                .snake-game-over {
                    background: rgba(255, 255, 255, 0.94);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
                }
                .snake-game-over h3 {
                    color: #d63031;
                }
                .snake-game-over p {
                    color: rgba(0, 0, 0, 0.7);
                }
                .snake-btn {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
                }

                /* --- Game Switcher --- */
                .game-switcher {
                    background: rgba(0, 0, 0, 0.04);
                    scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
                }
                .game-switch-btn {
                    background: rgba(0, 0, 0, 0.05);
                    border-color: rgba(0, 0, 0, 0.10);
                    color: rgba(0, 0, 0, 0.65);
                }
                .game-switch-btn:hover {
                    background: rgba(0, 0, 0, 0.09);
                    border-color: rgba(0, 0, 0, 0.18);
                }
                .game-switch-btn.active {
                    background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                    border-color: var(--aurora-1);
                    color: #fff;
                }

                /* --- Multi-Game Area --- */
                .multi-game-area {
                    background: rgba(0, 0, 0, 0.04);
                }

                /* --- Prayer Counter --- */
                .prayer-panel {
                    background: linear-gradient(160deg, #f0f2f5 0%, #e8edf4 50%, #f0f2f5 100%);
                }
                .prayer-panel::before {
                    background: radial-gradient(ellipse at 50% 30%, rgba(102,126,234,0.08) 0%, transparent 65%);
                }
                .prayer-screen {
                    background: rgba(255, 255, 255, 0.80);
                    border-color: rgba(102, 126, 234, 0.20);
                    box-shadow: 0 0 14px rgba(102,126,234,0.08), inset 0 0 6px rgba(0,0,0,0.03);
                }
                .prayer-label {
                    color: rgba(102, 126, 234, 0.75);
                }
                .prayer-digital {
                    color: #059669;
                    text-shadow: 0 0 6px rgba(5,150,105,0.20);
                }
                .prayer-sublabel {
                    color: rgba(0, 0, 0, 0.36);
                }
                .prayer-plus-btn {
                    box-shadow: 0 4px 14px rgba(102,126,234,0.25), 0 2px 6px rgba(0,0,0,0.10);
                }
                .prayer-reset-btn {
                    border-color: rgba(0, 0, 0, 0.10);
                    background: rgba(0, 0, 0, 0.04);
                    color: rgba(0, 0, 0, 0.45);
                }
                .prayer-reset-btn:hover {
                    background: rgba(239,68,68,0.10);
                    color: #dc2626;
                    border-color: rgba(239,68,68,0.25);
                }

                /* --- Reflex & Aim Game --- */
                #reflex-stats,
                #aim-stats {
                    background: rgba(0, 0, 0, 0.06);
                    color: rgba(0, 0, 0, 0.80);
                }
                .reflex-mode-toggle {
                    background: rgba(0, 0, 0, 0.08);
                    border-color: rgba(0, 0, 0, 0.12);
                    color: rgba(0, 0, 0, 0.75);
                }
                .reflex-mode-toggle:hover {
                    background: rgba(0, 0, 0, 0.14);
                }
                #reflex-results,
                #aim-results {
                    background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(245,245,250,0.95));
                    border-color: rgba(0, 0, 0, 0.12);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
                }

                /* --- Quotes --- */
                .attendance-summary:not(.retro-theme) .quotes-title {
                    color: rgba(0, 0, 0, 0.88);
                }
                .attendance-summary:not(.retro-theme) .quote-add-btn {
                    background: rgba(0, 0, 0, 0.06);
                    border-color: rgba(0, 0, 0, 0.12);
                    color: rgba(0, 0, 0, 0.75);
                }
                .attendance-summary:not(.retro-theme) .quote-add-btn:hover {
                    background: rgba(0, 0, 0, 0.10);
                }
                .attendance-summary:not(.retro-theme) .quote-text {
                    color: rgba(0, 0, 0, 0.80);
                }
                .attendance-summary:not(.retro-theme) .quote-author {
                    color: rgba(0, 0, 0, 0.50);
                }

                /* --- XP System --- */
                .attendance-summary:not(.retro-theme) .xp-title {
                    color: rgba(0, 0, 0, 0.88);
                }
                .attendance-summary:not(.retro-theme) .xp-info {
                    color: rgba(0, 0, 0, 0.55);
                }
                .attendance-summary:not(.retro-theme) .xp-stat-item {
                    background: rgba(0, 0, 0, 0.04);
                }
                .attendance-summary:not(.retro-theme) .xp-stat-label {
                    color: rgba(0, 0, 0, 0.60);
                }
                .attendance-summary:not(.retro-theme) .xp-stat-value {
                    color: #6c5ce7;
                }
                .attendance-summary:not(.retro-theme) .xp-progress-bar {
                    background: rgba(0, 0, 0, 0.08);
                }
                .attendance-summary:not(.retro-theme) .xp-streak {
                    background: rgba(255, 107, 53, 0.07);
                    border-color: rgba(255, 107, 53, 0.18);
                    color: rgba(0, 0, 0, 0.78);
                }
                .attendance-summary:not(.retro-theme) .xp-achievements {
                    background: rgba(0, 0, 0, 0.03);
                }
                .attendance-summary:not(.retro-theme) .xp-achievements:empty::before {
                    color: rgba(0, 0, 0, 0.35);
                }
                .attendance-summary:not(.retro-theme) .xp-next-milestone {
                    background: rgba(255, 193, 7, 0.10);
                    border-color: rgba(255, 193, 7, 0.22);
                    color: #b8860b;
                }
                .attendance-summary:not(.retro-theme) .level-badge {
                    color: #fff;
                }

                /* --- Image Box --- */
                .attendance-summary:not(.retro-theme) .image-box-title {
                    color: rgba(0, 0, 0, 0.85);
                }
                .attendance-summary:not(.retro-theme) .image-change-btn {
                    background: rgba(0, 0, 0, 0.06);
                    border-color: rgba(0, 0, 0, 0.12);
                    color: rgba(0, 0, 0, 0.75);
                }
                .attendance-summary:not(.retro-theme) .image-change-btn:hover {
                    background: rgba(0, 0, 0, 0.10);
                }
                .attendance-summary:not(.retro-theme) .aspect-ratio-btn {
                    background: rgba(0, 0, 0, 0.06);
                    border-color: rgba(0, 0, 0, 0.12);
                    color: rgba(0, 0, 0, 0.72);
                }
                .attendance-summary:not(.retro-theme) .aspect-ratio-btn:hover {
                    background: rgba(0, 0, 0, 0.10);
                }
                .attendance-summary:not(.retro-theme) .aspect-ratio-btn.active {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-color: #667eea;
                    color: #fff;
                }
                .attendance-summary:not(.retro-theme) .image-placeholder {
                    color: rgba(0, 0, 0, 0.38);
                }

                /* --- Pool Color Swatches --- */
                .attendance-summary:not(.retro-theme) .pool-color-swatch {
                    border-color: rgba(0, 0, 0, 0.15);
                }
                .attendance-summary:not(.retro-theme) .pool-color-swatch:hover {
                    border-color: rgba(0, 0, 0, 0.35);
                }
                .attendance-summary:not(.retro-theme) .pool-color-swatch.active {
                    border-color: #333;
                    box-shadow: 0 0 8px rgba(0, 0, 0, 0.25);
                }

                /* --- Settings Modal --- */
                .attendance-summary:not(.retro-theme) .settings-modal {
                    background: linear-gradient(135deg, rgba(255,255,255,0.94), rgba(248,248,252,0.96));
                    border-color: rgba(0, 0, 0, 0.10);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.95);
                }
                .attendance-summary:not(.retro-theme) .settings-title {
                    -webkit-text-fill-color: transparent;
                }
                .attendance-summary:not(.retro-theme) .settings-option {
                    background: rgba(0, 0, 0, 0.03);
                    border-color: rgba(0, 0, 0, 0.06);
                }
                .attendance-summary:not(.retro-theme) .settings-option:hover {
                    background: rgba(0, 0, 0, 0.06);
                }
                .attendance-summary:not(.retro-theme) .settings-option-label {
                    color: rgba(0, 0, 0, 0.85);
                }
                .attendance-summary:not(.retro-theme) .toggle-switch {
                    background: rgba(0, 0, 0, 0.14);
                }
                .attendance-summary:not(.retro-theme) .settings-select {
                    background: rgba(255, 255, 255, 0.88);
                    border-color: rgba(0, 0, 0, 0.14);
                    color: rgba(0, 0, 0, 0.85);
                }
                .attendance-summary:not(.retro-theme) .settings-select:hover {
                    background: rgba(255, 255, 255, 0.96);
                    border-color: rgba(0, 0, 0, 0.22);
                }
                .attendance-summary:not(.retro-theme) .settings-select option {
                    background: #fff;
                    color: #222;
                }
                .attendance-summary:not(.retro-theme) .settings-modal-overlay {
                    background: rgba(0, 0, 0, 0.30);
                }

                /* --- Pool Maximize Modal --- */
                .attendance-summary:not(.retro-theme) .pool-modal-panel {
                    background: linear-gradient(135deg, rgba(255,255,255,0.94), rgba(248,248,252,0.96));
                    border-color: rgba(0, 0, 0, 0.10);
                    box-shadow: 0 24px 80px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.95);
                }
                .attendance-summary:not(.retro-theme) .pool-modal-title {
                    color: rgba(0, 0, 0, 0.85);
                }
                .attendance-summary:not(.retro-theme) .pool-modal-close {
                    background: rgba(0, 0, 0, 0.05);
                    border-color: rgba(0, 0, 0, 0.10);
                    color: rgba(0, 0, 0, 0.65);
                }
                .attendance-summary:not(.retro-theme) .pool-modal-close:hover {
                    background: rgba(255, 80, 80, 0.12);
                    color: #dc2626;
                }

                /* --- Attendance core (re-assert after retro theme) --- */
                .attendance-summary:not(.retro-theme) {
                    background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(240,240,240,0.90));
                    border-color: rgba(0, 0, 0, 0.10);
                    color: rgba(0, 0, 0, 0.88);
                }
                .attendance-summary:not(.retro-theme) .modern-table td {
                    color: rgba(0, 0, 0, 0.78);
                    border-bottom-color: rgba(0, 0, 0, 0.08);
                }
                .attendance-summary:not(.retro-theme) .stat-label {
                    color: rgba(0, 0, 0, 0.58);
                }
                .attendance-summary:not(.retro-theme) .remaining-desc {
                    color: rgba(0, 0, 0, 0.55);
                }
                .attendance-summary:not(.retro-theme) .progress-bar {
                    background: rgba(0, 0, 0, 0.08);
                }
                .attendance-summary:not(.retro-theme) .progress-fill {
                    box-shadow: none;
                }
                .attendance-summary:not(.retro-theme) .developer-info {
                    background: rgba(255, 255, 255, 0.82);
                    border-color: rgba(0, 0, 0, 0.08);
                }
                .attendance-summary:not(.retro-theme) .developer-info:hover {
                    background: rgba(255, 255, 255, 0.92);
                    border-color: rgba(0, 0, 0, 0.16);
                    z-index: 1000;
                }
                .attendance-summary:not(.retro-theme) .developer-tooltip {
                    background: linear-gradient(145deg, rgba(15, 15, 30, 0.96), rgba(25, 20, 50, 0.96));
                    backdrop-filter: blur(50px);
                    min-width: 340px;
                }
                .attendance-summary:not(.retro-theme) .settings-button {
                    background: rgba(255, 255, 255, 0.82);
                    border-color: rgba(0, 0, 0, 0.08);
                }
                .attendance-summary:not(.retro-theme) .settings-button:hover {
                    background: rgba(255, 255, 255, 0.92);
                    border-color: rgba(0, 0, 0, 0.16);
                }
                .attendance-summary:not(.retro-theme) .stat-card {
                    background: rgba(255, 255, 255, 0.72);
                    border-color: rgba(0, 0, 0, 0.08);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                }
                .attendance-summary:not(.retro-theme) .stat-card:hover {
                    background: rgba(255, 255, 255, 0.90);
                    border-color: rgba(0, 0, 0, 0.14);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.10);
                }
                .attendance-summary:not(.retro-theme) .stat-card.worked-time-card {
                    background: linear-gradient(135deg, rgba(0,184,148,0.12), rgba(0,184,148,0.04));
                    border-color: rgba(0,184,148,0.25);
                }
                .attendance-summary:not(.retro-theme) .stat-card.remaining-time-card {
                    background: linear-gradient(135deg, rgba(225,112,85,0.12), rgba(225,112,85,0.04));
                    border-color: rgba(225,112,85,0.25);
                }
                .attendance-summary:not(.retro-theme) .stat-card.completion-time-card {
                    background: linear-gradient(135deg, rgba(108,92,231,0.12), rgba(108,92,231,0.04));
                    border-color: rgba(108,92,231,0.25);
                }
                .attendance-summary:not(.retro-theme) .gap-warning {
                    background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;
                    color: #2d3436 !important;
                }
            }

            /* ═══ LEADERBOARD STYLES ═══ */
            .leaderboard-panel {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 16px;
                min-height: 200px;
                max-height: 340px;
                overflow-y: auto;
                background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
                border-radius: 16px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .lb-register-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                padding: 24px 16px;
                text-align: center;
            }
            .lb-register-icon { font-size: 2.5rem; }
            .lb-register-title {
                margin: 0;
                font-size: 1.1rem;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .lb-register-desc {
                margin: 0;
                font-size: 0.8rem;
                opacity: 0.7;
                max-width: 260px;
            }
            .lb-name-input {
                width: 80%;
                max-width: 200px;
                padding: 8px 12px;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.08);
                color: inherit;
                font-size: 0.85rem;
                outline: none;
                transition: border-color 0.2s;
            }
            .lb-name-input:focus {
                border-color: #667eea;
                box-shadow: 0 0 8px rgba(102,126,234,0.3);
            }
            .lb-register-btn {
                padding: 8px 20px;
                border: none;
                border-radius: 10px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: #fff;
                font-weight: 600;
                font-size: 0.85rem;
                cursor: pointer;
                transition: transform 0.15s, box-shadow 0.2s;
            }
            .lb-register-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 16px rgba(102,126,234,0.4);
            }
            .lb-register-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            .lb-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .lb-title {
                font-size: 1rem;
                font-weight: 700;
            }
            .lb-sync-btn {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 8px;
                padding: 4px 10px;
                cursor: pointer;
                font-size: 0.8rem;
                color: inherit;
                transition: background 0.2s;
            }
            .lb-sync-btn:hover { background: rgba(255,255,255,0.2); }
            .lb-table-wrap {
                overflow-x: auto;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.08);
                -webkit-overflow-scrolling: touch;
            }
            .lb-table {
                width: max-content;
                min-width: 100%;
                border-collapse: collapse;
                font-size: 0.72rem;
            }
            .lb-table thead th {
                padding: 6px 8px;
                text-align: left;
                font-weight: 600;
                opacity: 0.7;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                white-space: nowrap;
            }
            .lb-table thead th[title] {
                text-align: center;
                font-size: 1rem;
                padding: 4px 6px;
                cursor: help;
            }
            .lb-table tbody td {
                padding: 6px 8px;
                border-bottom: 1px solid rgba(255,255,255,0.04);
            }
            .lb-row-me {
                background: rgba(102,126,234,0.15);
                font-weight: 600;
            }
            .lb-row-me td { border-color: rgba(102,126,234,0.2); }
            .lb-rank { text-align: center; min-width: 28px; }
            .lb-level { white-space: nowrap; min-width: 40px; }
            .lb-xp { white-space: nowrap; min-width: 58px; font-variant-numeric: tabular-nums; }
            .lb-score { text-align: right; min-width: 52px; font-variant-numeric: tabular-nums; opacity: 0.9; white-space: nowrap; }
            .lb-you {
                font-size: 0.65rem;
                opacity: 0.7;
                font-weight: 400;
            }
            .lb-footer {
                font-size: 0.7rem;
                opacity: 0.5;
                text-align: right;
            }
            .lb-empty {
                text-align: center;
                opacity: 0.5;
                padding: 20px !important;
            }
        </style>
    `;

    // Inject modern styles
    function injectModernStyles() {
        if (!document.getElementById('attendance-modern-styles')) {
            document.head.insertAdjacentHTML('beforeend', modernStyles);
        }
    }

    // Calculate emoji based on work progress
    function getEmojiForProgress(workedSeconds, totalSeconds = getShiftSeconds()) {
        const progress = Math.min(workedSeconds / totalSeconds, 1);

        // If exceeded shift + 30 minutes, show clown emoji (go home!)
        if (workedSeconds > (totalSeconds + 1800)) {
            return clownEmoji;
        }

        // If between shift end and shift + 30 min, show running emoji (wrap it up!)
        if (workedSeconds >= totalSeconds && workedSeconds <= (totalSeconds + 1800)) {
            return runningEmoji;
        }

        // Calculate which emoji to show based on progress for under 8 hours
        const currentSet = emojiSets[userPreferences.emojiSet] || emojiSets.fun;
        const emojiIndex = Math.floor(progress * currentSet.length);
        return currentSet[Math.min(emojiIndex, currentSet.length - 1)];
    }

    // Add developer info to the card
    function addDeveloperInfo(container) {
        // Remove existing developer info if any
        const existingInfo = container.querySelector('.developer-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        
        const developerDiv = document.createElement('div');
        developerDiv.className = 'developer-info';
        developerDiv.innerHTML = `
            ℹ️
            <div class="developer-tooltip">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:1.4rem;">📅</span>
                    <div style="text-align:left;">
                        <div style="font-size:0.85rem;font-weight:700;letter-spacing:0.3px;">Attendance Tracker Plus</div>
                        <div style="font-size:0.65rem;opacity:0.7;">by Hassan Nasir &middot; Core: Websoft Team</div>
                    </div>
                    <span style="margin-left:auto;background:linear-gradient(135deg,#667eea,#764ba2);padding:2px 8px;border-radius:10px;font-size:0.6rem;font-weight:700;letter-spacing:0.5px;">v5.0</span>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.1);margin:6px 0;"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;text-align:left;">
                    <small>🎱 <strong>Pool</strong> — Spin physics, cushion, Competitive AI</small>
                    <small>🐍 <strong>Snake</strong> — 60fps rendering, progressive speed</small>
                    <small>🐦 <strong>Flappy</strong> — Dynamic gap & speed scaling per score</small>
                    <small>🧱 <strong>Tetris</strong> — Ghost piece, wall kicks, level progression</small>
                    <small>🏓 <strong>Breakout</strong> — 11 powerups, multi-ball, combo system</small>
                    <small>⚡ <strong>Reflex</strong> — Screen & target modes, reaction benchmarks</small>
                    <small>🎯 <strong>Aim</strong> — Chaos mode, accuracy tracking, bullet holes</small>
                    <small>📿 <strong>Tasbih</strong> — Digital prayer counter with memory</small>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.1);margin:6px 0;"></div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
                    <span style="background:rgba(102,126,234,0.2);padding:2px 7px;border-radius:6px;font-size:0.6rem;">⭐ XP & Levels</span>
                    <span style="background:rgba(118,75,162,0.2);padding:2px 7px;border-radius:6px;font-size:0.6rem;">🖼️ PiP Mode</span>
                    <span style="background:rgba(46,213,115,0.2);padding:2px 7px;border-radius:6px;font-size:0.6rem;">🌗 Light/Dark</span>
                    <span style="background:rgba(255,165,2,0.2);padding:2px 7px;border-radius:6px;font-size:0.6rem;">💬 Quotes</span>
                    <span style="background:rgba(255,71,87,0.2);padding:2px 7px;border-radius:6px;font-size:0.6rem;">🏆 Achievements</span>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.1);margin:6px 0;"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;opacity:0.6;font-size:0.58rem;">
                    <span>13 May 2026</span>
                    <span>💡 Click emoji → Game Mode</span>
                    <span>⚙️ → Settings</span>
                </div>
            </div>
        `;
        
        container.appendChild(developerDiv);
    }
    
    // Add settings button
    function addSettingsButton(container) {
        const existingButton = container.querySelector('.settings-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        const settingsButton = document.createElement('div');
        settingsButton.className = 'settings-button';
        settingsButton.innerHTML = '⚙️';
        settingsButton.title = 'Settings';
        settingsButton.addEventListener('click', toggleSettingsModal);
        
        container.appendChild(settingsButton);
    }
    
    // Toggle settings modal
    function toggleSettingsModal() {
        let modal = document.getElementById('attendance-settings-modal');
        let overlay = document.getElementById('settings-modal-overlay');
        
        if (!modal) {
            createSettingsModal();
            modal = document.getElementById('attendance-settings-modal');
            overlay = document.getElementById('settings-modal-overlay');
        }
        
        const wasOpen = modal.classList.contains('active');
        modal.classList.toggle('active');
        overlay.classList.toggle('active');
        
        // Sync once on close (not on every individual setting change)
        if (wasOpen && lbRegistered) {
            try { syncMyScore(); } catch (_) {}
        }
    }
    
    // Create settings modal
    function createSettingsModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'settings-modal-overlay';
        overlay.className = 'settings-modal-overlay';
        overlay.addEventListener('click', toggleSettingsModal);
        document.body.appendChild(overlay);
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'attendance-settings-modal';
        modal.className = 'settings-modal';
        
        const isGlassmorphic = userPreferences.displayTheme === 'glassmorphic';
        
        modal.innerHTML = `
            <div class="settings-title">⚙️ Customize Your Experience</div>
            <div class="settings-option ${!isGlassmorphic ? 'disabled' : ''}" data-theme-dependent="glassmorphic">
                <span class="settings-option-label">🎨 Neumorphic Depth <small style="opacity: 0.6; font-size: 0.75rem;">(Glassmorphic only)</small></span>
                <div class="toggle-switch ${userPreferences.neumorphicDepth ? 'active' : ''} ${!isGlassmorphic ? 'disabled' : ''}" data-pref="neumorphicDepth"></div>
            </div>
            <div class="settings-option ${!isGlassmorphic ? 'disabled' : ''}" data-theme-dependent="glassmorphic">
                <span class="settings-option-label">🌊 Fluid Gradients <small style="opacity: 0.6; font-size: 0.75rem;">(Glassmorphic only)</small></span>
                <div class="toggle-switch ${userPreferences.fluidGradients ? 'active' : ''} ${!isGlassmorphic ? 'disabled' : ''}" data-pref="fluidGradients"></div>
            </div>
            <div class="settings-option">
                <span class="settings-option-label">� Shift Duration</span>
                <select class="settings-select" data-pref="shiftDuration">
                    <option value="4h" ${userPreferences.shiftDuration === '4h' ? 'selected' : ''}>4h — Short Leave</option>
                    <option value="8h" ${userPreferences.shiftDuration === '8h' ? 'selected' : ''}>8h — Standard</option>
                    <option value="9h" ${userPreferences.shiftDuration === '9h' ? 'selected' : ''}>9h — Overtime</option>
                </select>
            </div>
            <div class="settings-option">
                <span class="settings-option-label">�😎 Emoji Style</span>
                <select class="settings-select" data-pref="emojiSet">
                    <option value="fun" ${userPreferences.emojiSet === 'fun' ? 'selected' : ''}>Fun (GenZ)</option>
                    <option value="professional" ${userPreferences.emojiSet === 'professional' ? 'selected' : ''}>Professional (Dots)</option>
                </select>
            </div>
            <div class="settings-option">
                <span class="settings-option-label">🎨 Display Theme</span>
                <select class="settings-select" data-pref="displayTheme" id="theme-selector">
                    <option value="glassmorphic" ${userPreferences.displayTheme === 'glassmorphic' ? 'selected' : ''}>Glassmorphic Aurora</option>
                    <option value="retro-futuristic" ${userPreferences.displayTheme === 'retro-futuristic' ? 'selected' : ''}>Cyberpunk HUD</option>
                </select>
            </div>
            <div class="settings-option cyber-color-row" data-theme-dependent="retro-futuristic" style="${userPreferences.displayTheme === 'retro-futuristic' ? '' : 'display:none;'}">
                <span class="settings-option-label">🌈 Cyberpunk Colors</span>
                <div class="cyber-color-pickers">
                    <label title="Background primary">
                        <input type="color" data-pref="cyberBgPrimary" value="${userPreferences.cyberBgPrimary || '#07091a'}">
                        <span>BG 1</span>
                    </label>
                    <label title="Background secondary">
                        <input type="color" data-pref="cyberBgSecondary" value="${userPreferences.cyberBgSecondary || '#11142b'}">
                        <span>BG 2</span>
                    </label>
                    <label title="Accent (text glow, titles)">
                        <input type="color" data-pref="cyberAccent" value="${userPreferences.cyberAccent || '#fff200'}">
                        <span>Accent</span>
                    </label>
                    <label title="Highlight (buttons, progress)">
                        <input type="color" data-pref="cyberHighlight" value="${userPreferences.cyberHighlight || '#00e5ff'}">
                        <span>Highlight</span>
                    </label>
                    <label title="Inner panel glass tint (table, side containers)">
                        <input type="color" data-pref="cyberPanelTint" value="${userPreferences.cyberPanelTint || '#00e5ff'}">
                        <span>Panel</span>
                    </label>
                </div>
            </div>
            <div class="settings-option cyber-color-row" data-theme-dependent="retro-futuristic" style="${userPreferences.displayTheme === 'retro-futuristic' ? '' : 'display:none;'}">
                <span class="settings-option-label">🖼️ Background Image</span>
                <div class="cyber-bg-controls">
                    <button class="cyber-bg-btn" id="cyber-bg-change-btn" title="Set background image URL">Change BG</button>
                    <button class="cyber-bg-btn cyber-bg-clear" id="cyber-bg-clear-btn" title="Remove background image" ${userPreferences.cyberBgImage ? '' : 'style="display:none;"'}>✕</button>
                    <label class="cyber-bg-opacity-label" ${userPreferences.cyberBgImage ? '' : 'style="display:none;"'}>
                        <input type="range" min="0" max="100" value="${Math.round((userPreferences.cyberBgOpacity ?? 0.15) * 100)}" id="cyber-bg-opacity-slider">
                        <span>${Math.round((userPreferences.cyberBgOpacity ?? 0.15) * 100)}%</span>
                    </label>
                </div>
            </div>
            <div class="settings-option">
                <span class="settings-option-label"> Game Mode <small style="opacity:0.6;font-size:0.75rem;">Hides side panels</small></span>
                <div class="toggle-switch ${userPreferences.gameModeHidden ? 'active' : ''}" data-pref="gameModeHidden"></div>
            </div>
            <div class="settings-option">
                <span class="settings-option-label">🖥️ VSync</span>
                <select class="settings-select" data-pref="gameFps" id="fps-selector">
                    <option value="60" ${userPreferences.gameFps === 60 || userPreferences.gameFps === '60' ? 'selected' : ''}>Full (60 FPS)</option>
                    <option value="30" ${userPreferences.gameFps === 30 || userPreferences.gameFps === '30' ? 'selected' : ''}>Half (30 FPS)</option>
                </select>
            </div>
            <div class="settings-option">
                <span class="settings-option-label">🎱 Pool Table Color</span>
                <div class="pool-color-swatches" id="pool-color-swatches">
                    <div class="pool-color-swatch ${userPreferences.poolTableColor === 'green' ? 'active' : ''}" data-pool-color="green" style="background: linear-gradient(135deg, #2d8a4e, #1a5c32);" title="Green"></div>
                    <div class="pool-color-swatch ${userPreferences.poolTableColor === 'red' ? 'active' : ''}" data-pool-color="red" style="background: linear-gradient(135deg, #8b3a3a, #5c1a1a);" title="Red"></div>
                    <div class="pool-color-swatch ${userPreferences.poolTableColor === 'blue' ? 'active' : ''}" data-pool-color="blue" style="background: linear-gradient(135deg, #2a5a8a, #1a3a5c);" title="Blue"></div>
                    <div class="pool-color-swatch ${userPreferences.poolTableColor === 'lightgrey' ? 'active' : ''}" data-pool-color="lightgrey" style="background: linear-gradient(135deg, #a8b0b8, #c8cfd6);" title="Light Grey"></div>
                </div>
            </div>
            <div class="settings-option">
                <span class="settings-option-label">🎲 Ludo Board</span>
                <select class="settings-select" data-pref="ludoRotation">
                    <option value="0" ${Number(userPreferences.ludoRotation) === 0 ? 'selected' : ''}>Blue top-left (default)</option>
                    <option value="1" ${Number(userPreferences.ludoRotation) === 1 ? 'selected' : ''}>Blue bottom-left</option>
                    <option value="2" ${Number(userPreferences.ludoRotation) === 2 ? 'selected' : ''}>Blue bottom-right</option>
                    <option value="3" ${Number(userPreferences.ludoRotation) === 3 ? 'selected' : ''}>Blue top-right</option>
                </select>
            </div>
            <div class="settings-option" style="align-items: flex-start; flex-direction: column; gap: 10px;">
                <span class="settings-option-label">🎲 Ludo Rules</span>
                <div class="ludo-rule-toggles">
                    <div class="ludo-rule-row">
                        <span>Blocks bar opponents <small style="opacity:0.6;">(never on ★ squares)</small></span>
                        <div class="toggle-switch ${userPreferences.ludoBlocks !== false ? 'active' : ''}" data-pref="ludoBlocks"></div>
                    </div>
                    <div class="ludo-rule-row">
                        <span>…and can't be jumped over <small style="opacity:0.6;">(off: hop past, still can't land)</small></span>
                        <div class="toggle-switch ${userPreferences.ludoBlockPassing !== false ? 'active' : ''}" data-pref="ludoBlockPassing"></div>
                    </div>
                    <div class="ludo-rule-row">
                        <span>Three 6s forfeit the turn</span>
                        <div class="toggle-switch ${userPreferences.ludoThreeSixes !== false ? 'active' : ''}" data-pref="ludoThreeSixes"></div>
                    </div>
                    <div class="ludo-rule-row">
                        <span>Exact roll to finish</span>
                        <div class="toggle-switch ${userPreferences.ludoExactHome !== false ? 'active' : ''}" data-pref="ludoExactHome"></div>
                    </div>
                    <div class="ludo-rule-row">
                        <span>Release on any roll <small style="opacity:0.6;">(no 6 needed)</small></span>
                        <div class="toggle-switch ${userPreferences.ludoFreeRelease === true ? 'active' : ''}" data-pref="ludoFreeRelease"></div>
                    </div>
                </div>
            </div>
            <button class="close-modal-button">✨ Save & Close</button>
        `;
        
        document.body.appendChild(modal);
        
        // Add toggle listeners
        modal.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.addEventListener('click', function() {
                // Don't toggle if disabled
                if (this.classList.contains('disabled')) {
                    return;
                }
                
                const pref = this.getAttribute('data-pref');
                this.classList.toggle('active');
                userPreferences[pref] = this.classList.contains('active');
                savePreferences();
                applyPreferences();
            });
        });

        // Add select listeners
        modal.querySelectorAll('.settings-select').forEach(select => {
            select.addEventListener('change', function() {
                const pref = this.getAttribute('data-pref');
                // Selects hand back strings; these two are numbers everywhere else.
                const numericPrefs = ['gameFps', 'ludoRotation'];
                userPreferences[pref] = numericPrefs.indexOf(pref) !== -1
                    ? parseInt(this.value, 10) : this.value;
                savePreferences();
                applyPreferences();
                
                // If theme changed, update dependent options visibility
                if (pref === 'displayTheme') {
                    updateThemeDependentOptions(modal, this.value);
                }
            });
        });
        
        // Function to update theme-dependent options
        function updateThemeDependentOptions(modal, theme) {
            const isGlassmorphic = theme === 'glassmorphic';
            const dependentOptions = modal.querySelectorAll('[data-theme-dependent="glassmorphic"]');
            
            dependentOptions.forEach(option => {
                const toggle = option.querySelector('.toggle-switch');
                if (isGlassmorphic) {
                    option.classList.remove('disabled');
                    if (toggle) toggle.classList.remove('disabled');
                } else {
                    option.classList.add('disabled');
                    if (toggle) toggle.classList.add('disabled');
                }
            });

            // Show/hide retro-futuristic-only options (e.g. Cyberpunk color pickers)
            modal.querySelectorAll('[data-theme-dependent="retro-futuristic"]').forEach(option => {
                option.style.display = (theme === 'retro-futuristic') ? '' : 'none';
            });
        }

        // Color picker listeners (Cyberpunk HUD customizable colors)
        modal.querySelectorAll('input[type="color"][data-pref]').forEach(picker => {
            picker.addEventListener('input', function() {
                const pref = this.getAttribute('data-pref');
                userPreferences[pref] = this.value;
                applyPreferences(); // live preview while sliding
            });
            picker.addEventListener('change', function() {
                const pref = this.getAttribute('data-pref');
                userPreferences[pref] = this.value;
                savePreferences();
                applyPreferences();
            });
        });

        // Background image controls
        const bgChangeBtn = modal.querySelector('#cyber-bg-change-btn');
        const bgClearBtn = modal.querySelector('#cyber-bg-clear-btn');
        const bgOpacitySlider = modal.querySelector('#cyber-bg-opacity-slider');
        const bgOpacityLabel = bgOpacitySlider ? bgOpacitySlider.parentElement : null;

        if (bgChangeBtn) {
            bgChangeBtn.addEventListener('click', () => {
                const url = prompt('Enter background image URL:', userPreferences.cyberBgImage || '');
                if (url !== null) {
                    userPreferences.cyberBgImage = url.trim();
                    savePreferences();
                    applyPreferences();
                    if (bgClearBtn) bgClearBtn.style.display = url.trim() ? '' : 'none';
                    if (bgOpacityLabel) bgOpacityLabel.style.display = url.trim() ? '' : 'none';
                }
            });
        }
        if (bgClearBtn) {
            bgClearBtn.addEventListener('click', () => {
                userPreferences.cyberBgImage = '';
                savePreferences();
                applyPreferences();
                bgClearBtn.style.display = 'none';
                if (bgOpacityLabel) bgOpacityLabel.style.display = 'none';
            });
        }
        if (bgOpacitySlider) {
            bgOpacitySlider.addEventListener('input', function() {
                const val = parseInt(this.value) / 100;
                userPreferences.cyberBgOpacity = val;
                applyPreferences();
                const spanEl = this.parentElement.querySelector('span');
                if (spanEl) spanEl.textContent = this.value + '%';
            });
            bgOpacitySlider.addEventListener('change', function() {
                savePreferences();
            });
        }
        
        // Add close button listener
        modal.querySelector('.close-modal-button').addEventListener('click', toggleSettingsModal);

        // Add pool color swatch listeners
        modal.querySelectorAll('.pool-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', function() {
                const color = this.dataset.poolColor;
                userPreferences.poolTableColor = color;
                savePreferences();
                modal.querySelectorAll('.pool-color-swatch').forEach(s => s.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }
    
    // Apply user preferences
    function applyPreferences() {
        const container = document.getElementById('total-time-summary');
        if (!container) return;
        
        // Apply display theme
        if (userPreferences.displayTheme === 'retro-futuristic') {
            container.classList.add('retro-theme');
            // Apply user-customizable Cyberpunk HUD colors via CSS custom properties
            const bg1 = userPreferences.cyberBgPrimary   || '#07091a';
            const bg2 = userPreferences.cyberBgSecondary || '#11142b';
            const acc = userPreferences.cyberAccent      || '#fff200';
            const hl  = userPreferences.cyberHighlight   || '#00e5ff';
            const pnl = userPreferences.cyberPanelTint   || '#00e5ff';
            container.style.setProperty('--rt-bg-1', bg1);
            container.style.setProperty('--rt-bg-2', bg2);
            container.style.setProperty('--rt-accent', acc);
            container.style.setProperty('--rt-accent-rgb', hexToRgbStr(acc));
            container.style.setProperty('--rt-cyber-hl', hl);
            container.style.setProperty('--rt-cyber-hl-rgb', hexToRgbStr(hl));
            container.style.setProperty('--rt-cyber-panel', pnl);
            container.style.setProperty('--rt-cyber-panel-rgb', hexToRgbStr(pnl));
            // Also expose vars at document root so body-level modals can use them
            document.documentElement.style.setProperty('--rt-cyber-hl', hl);
            document.documentElement.style.setProperty('--rt-accent', acc);
            document.documentElement.style.setProperty('--rt-bg-1', bg1);

            // Mirror custom CSS vars onto PiP window so color pickers apply live
            if (isPipActive && pipWindow && !pipWindow.closed) {
                const pipEl = pipWindow.document.querySelector('.pip-window-content.retro-theme');
                if (pipEl) {
                    pipEl.style.setProperty('--rt-bg-1', bg1);
                    pipEl.style.setProperty('--rt-bg-2', bg2);
                    pipEl.style.setProperty('--rt-accent', acc);
                    pipEl.style.setProperty('--rt-accent-rgb', hexToRgbStr(acc));
                    pipEl.style.setProperty('--rt-cyber-hl', hl);
                    pipEl.style.setProperty('--rt-cyber-hl-rgb', hexToRgbStr(hl));
                    pipEl.style.setProperty('--rt-cyber-panel', pnl);
                    pipEl.style.setProperty('--rt-cyber-panel-rgb', hexToRgbStr(pnl));
                }
                // Also update PiP body gradient
                pipWindow.document.body.style.background = `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`;
            }

            // Background image overlay
            let bgEl = container.querySelector('.cyber-bg-image');
            if (userPreferences.cyberBgImage) {
                if (!bgEl) {
                    bgEl = document.createElement('div');
                    bgEl.className = 'cyber-bg-image';
                    container.insertBefore(bgEl, container.firstChild);
                }
                bgEl.style.backgroundImage = `url("${userPreferences.cyberBgImage.replace(/"/g, '')}")`;
                bgEl.style.opacity = userPreferences.cyberBgOpacity ?? 0.15;
            } else if (bgEl) {
                bgEl.remove();
            }
        } else {
            container.classList.remove('retro-theme');
            // Clear inline overrides so glassmorphic theme isn't affected
            ['--rt-bg-1','--rt-bg-2','--rt-accent','--rt-accent-rgb','--rt-cyber-hl','--rt-cyber-hl-rgb','--rt-cyber-panel','--rt-cyber-panel-rgb']
                .forEach(p => { container.style.removeProperty(p); document.documentElement.style.removeProperty(p); });
            // Remove background image overlay if switching away
            const bgEl = container.querySelector('.cyber-bg-image');
            if (bgEl) bgEl.remove();
        }
        
        // Apply neumorphic depth (only for glassmorphic theme)
        if (userPreferences.displayTheme === 'glassmorphic') {
            container.style.boxShadow = ''; // clear any old inline override
            if (userPreferences.neumorphicDepth) {
                container.classList.add('neumorphic-active');
            } else {
                container.classList.remove('neumorphic-active');
            }
        } else {
            container.classList.remove('neumorphic-active');
        }

        // Apply fluid gradients (only for glassmorphic theme)
        if (userPreferences.displayTheme === 'glassmorphic') {
            if (userPreferences.fluidGradients) {
                container.classList.remove('no-fluid');
            } else {
                container.classList.add('no-fluid');
            }
        } else {
            container.classList.remove('no-fluid');
        }

        // Force update emoji
        const emojiDisplay = container.querySelector('.emoji-display');
        if (emojiDisplay) {
            // We need to recalculate based on current time, but for now just trigger a refresh
            // The next update loop will catch the correct emoji, but let's try to update immediately if possible
            const totalWorkedElement = document.getElementById('total-worked-time');
            if (totalWorkedElement) {
                const timeStr = totalWorkedElement.textContent;
                const seconds = timeToSeconds(timeStr);
                emojiDisplay.textContent = getEmojiForProgress(seconds);
            }
        }

        // Apply game mode panel visibility
        applyGameMode();
    }
    
    // ── Game Mode: show/hide left and right panels ──────────────
    // gameModeHidden: true  = Game Mode ON  → panels visible, widget full size
    // gameModeHidden: false = Game Mode OFF → panels hidden, widget shrinks 10%
    function applyGameMode() {
        const container = document.getElementById('total-time-summary');
        if (!container) return;
        const gameModeOn = userPreferences.gameModeHidden; // true = ON
        const leftPanel  = container.querySelector('.left-panel');
        const rightPanel = container.querySelector('.right-panel');

        // Show or hide side panels
        [leftPanel, rightPanel].forEach(panel => {
            if (!panel) return;
            if (gameModeOn) {
                panel.classList.remove('game-mode-hidden'); // ON → show panels
            } else {
                panel.classList.add('game-mode-hidden');    // OFF → hide panels
            }
        });

        // Shrink widget when Game Mode is OFF
        if (gameModeOn) {
            container.classList.remove('game-mode-off');
        } else {
            container.classList.add('game-mode-off');
        }

        // Update emoji tooltip
        const emojiEl = container.querySelector('.emoji-display');
        if (emojiEl) {
            emojiEl.title = gameModeOn
                ? '🎮 Game Mode ON — click to turn off'
                : '🎮 Game Mode OFF — click to turn on';
        }

        // Sync settings modal toggle if open
        const toggle = document.querySelector('.toggle-switch[data-pref="gameModeHidden"]');
        if (toggle) {
            toggle.classList.toggle('active', gameModeOn);
        }
    }

    // Add parallax effect on mouse move
    function addParallaxEffect(container) {
        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            mouseX = (x - 0.5) * 20; // Range: -10 to 10
            mouseY = (y - 0.5) * 20;
            
            container.style.setProperty('--mouse-x', mouseX);
            container.style.setProperty('--mouse-y', mouseY);
        });
        
        container.addEventListener('mouseleave', () => {
            container.style.setProperty('--mouse-x', 0);
            container.style.setProperty('--mouse-y', 0);
        });
    }

    function insertAndCalculate() {
        injectModernStyles();
        
        const tableDiv = document.querySelector('.main-attendance-table');
        if (!tableDiv) {
            return;
        }
        
        let totalTimeDiv = document.getElementById('total-time-summary');
        let isNewElement = false;
        if (!totalTimeDiv) {
            totalTimeDiv = document.createElement('div');
            totalTimeDiv.id = 'total-time-summary';
            totalTimeDiv.className = 'attendance-summary';
            // Apply retro theme class if user preference is set
            if (userPreferences.displayTheme === 'retro-futuristic') {
                totalTimeDiv.classList.add('retro-theme');
            }
            isFirstRender = true;
            isNewElement = true;
        }

        calculateTotalTime(totalTimeDiv);
        
        // Apply preferences after element is in DOM
        if (isNewElement) {
            // Use setTimeout to ensure DOM is fully updated
            setTimeout(() => { applyPreferences(); applyGameMode(); }, 0);
        }
    }

    function calculateTotalTime(totalTimeDiv) {
        let date = new Date();
        let today = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
        let todayFormatted = formatDate(today);

        if (today.getHours() < 5) {
            const prevDay = new Date(today);
            prevDay.setDate(today.getDate() - 1); 
            todayFormatted = formatDate(prevDay);
        }

        let totalWorkedTime = 0;
        let checkInTime = null;
        let lastCheckOutTime = null;
        let checkInOutList = [];
        let totalBreakTime = 0;

        const rows = document.querySelectorAll('.main-attendance-table tbody tr');

        if (rows.length > 0) {
            rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 5) {
                    return;
                }

                const rowData = Array.from(cells).map(cell => cell.innerText.trim());

                const date = rowData[1]; 
                const time = rowData[3]; 
                const checkInOut = rowData[4]; 
                const checkInHour = parseInt(time.split(":")[0], 10);
                
                if (date === todayFormatted) {
                    if (checkInOut === 'In' && checkInHour > 5) {
                        if (lastCheckOutTime) {
                            const gap = calculateTimeDifference(lastCheckOutTime, time);
                            if (gap <= 21600) {
                                checkInTime = time;
                            } else {
                                checkInTime = time;
                                totalWorkedTime = 0;
                            }
                        } else {
                            checkInTime = time;
                        }
                    } else if (checkInOut === 'Out' && checkInTime) {
                        const workedTime = calculateTimeDifference(checkInTime, time);
                        totalWorkedTime += workedTime;
                        checkInOutList.push({
                            checkIn: checkInTime,
                            checkOut: time,
                            workedTime: secondsToHHMMSS(workedTime),
                        });
                        lastCheckOutTime = time;
                        checkInTime = null; 
                    }
                } else if (date === formatDate(today) && today.getHours() < 5 && checkInHour < 5) {
                    if (checkInOut === 'In') {
                        if (lastCheckOutTime) {
                            const gap = calculateTimeDifference(lastCheckOutTime, time);
                            if (gap <= 21600) { 
                                checkInTime = time;
                            } else {
                                checkInTime = time;
                                totalWorkedTime = 0;
                            }
                        } else {
                            checkInTime = time;
                        }
                    } else if (checkInOut === 'Out' && checkInTime) {
                        const workedTime = calculateTimeDifference(checkInTime, time);
                        totalWorkedTime += workedTime;
                        checkInOutList.push({
                            checkIn: checkInTime,
                            checkOut: time,
                            workedTime: secondsToHHMMSS(workedTime),
                        });
                        lastCheckOutTime = time;
                        checkInTime = null; 
                    }
                }
            });

            if (checkInTime) {
                const currentTimeFormatted = formatTime(today);
                const workedTime = calculateTimeDifference(checkInTime, currentTimeFormatted);
                totalWorkedTime += workedTime;
                checkInOutList.push({
                    checkIn: checkInTime,
                    checkOut: 'Current',
                    workedTime: secondsToHHMMSS(workedTime),
                });
                checkInTime = null;
            }

            // Only re-render when structure actually changes (initial load or new check-in/out entries)
            // CRITICAL: Never re-render if games are initialized to prevent blinking!
            const currentRowCount = totalTimeDiv.querySelectorAll('.modern-table tbody tr:not(.gap-warning)').length;
            const isInitialRender = totalTimeDiv.innerHTML === '';
            const tableStructureChanged = checkInOutList.length !== currentRowCount;
            
            // Block all re-renders when games are active, even if table changes
            const shouldRerender = isInitialRender || (tableStructureChanged && !featuresInitialized);
            
            if (shouldRerender) {
                renderFullContent(totalTimeDiv, totalWorkedTime, checkInOutList, today);
                
                // Clear cached DOM elements after re-render so they get re-queried
                cachedElements = {
                    totalWorkedTime: null,
                    remainingTime: null,
                    completionTime: null,
                    emojiDisplay: null,
                    progressFill: null,
                    currentWorkedTime: null
                };
            } else {
                // Just update dynamic content without re-rendering to preserve animations
                updateDynamicContent(totalWorkedTime, today, checkInOutList);
            }
            
            // Always update lastTotalWorkedTime to track state
            lastTotalWorkedTime = totalWorkedTime;
        }
        
        // Only insert into DOM on first render - don't repeat this operation!
        if (!totalTimeDiv.parentNode) {
            $('.main-attendance-table').before(totalTimeDiv);
        }
    }

    function formatDate(date) {
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    
    function formatTime12Hour(date) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes}:${seconds} ${period}`;
    }

    function formatTime(date) {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }

    function calculateTimeDifference(startTime, endTime) {
        const start = new Date(`1970-01-01T${startTime}Z`);
        const end = new Date(`1970-01-01T${endTime}Z`);
        let diffInSeconds = (end - start) / 1000;

        if (diffInSeconds < 0) {
            diffInSeconds += 24 * 3600;
        }

        return diffInSeconds;
    }

    function secondsToHHMMSS(seconds) {
        const hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        const minutes = Math.floor(seconds / 60);
        seconds %= 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Additional utility function from original script
    function timeToSeconds(timeString) {
        const parts = timeString.split(':');
        return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }

    function interpolateColor(color1, color2, factor) {
        if (arguments.length < 3) { 
            return color1; 
        }
        let result = color1.slice();
        for (let i = 0; i < 3; i++) {
            result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
        }
        return `rgba(${result[0]}, ${result[1]}, ${result[2]}, 0.2)`;
    }
    
    // PICTURE-IN-PICTURE FUNCTIONALITY
    
    // Check if Picture-in-Picture is supported
    function isPipSupported() {
        return 'documentPictureInPicture' in window;
    }
    
    // Create PiP button
    function createPipButton(container) {
        if (!isPipSupported()) {
            return null;
        }
        
        // Remove existing PiP button if any
        const existingButton = container.querySelector('.pip-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        const pipButton = document.createElement('button');
        pipButton.className = 'pip-button';
        pipButton.innerHTML = `
            <span class="pip-icon">📱</span>
            <span class="pip-text">Float</span>
        `;
        
        pipButton.addEventListener('click', togglePictureInPicture);
        container.appendChild(pipButton);
        pipButton.style.display = 'flex';
        pipButton.style.alignItems = 'center';
        return pipButton;
    }
    
    // Toggle Picture-in-Picture mode
    async function togglePictureInPicture() {
        try {
            if (isPipActive && pipWindow && !pipWindow.closed) {
                // Close existing PiP window
                pipWindow.close();
                return;
            }
            
            // Calculate optimal window size based on screen size
            const screenWidth = window.screen.width;
            const screenHeight = window.screen.height;
            
            // Responsive window sizing
            let windowWidth, windowHeight;
            if (screenWidth <= 480) {
                // Extra small screens
                windowWidth = Math.min(screenWidth * 0.9, 280);
                windowHeight = Math.min(screenHeight * 0.7, 400);
            } else if (screenWidth <= 768) {
                // Mobile screens
                windowWidth = Math.min(screenWidth * 0.8, 320);
                windowHeight = Math.min(screenHeight * 0.75, 450);
            } else {
                // Desktop screens
                windowWidth = 320;
                windowHeight = 480;
            }
            
            // Create compact PiP window with dynamic sizing
            pipWindow = await documentPictureInPicture.requestWindow({
                width: windowWidth,
                height: windowHeight,
                disallowReturnToOpener: false
            });
            
            isPipActive = true;
            
            // Copy styles to PiP window
            copyStylesToPip(pipWindow);
            
            // Move content to PiP window
            const attendanceSummary = document.getElementById('total-time-summary');
            if (attendanceSummary) {
                // Clone only the main attendance content (center panel), not the side panels
                const mainContent = attendanceSummary.querySelector('.main-attendance-content');
                if (!mainContent) {
                    console.error('Main attendance content not found');
                    isPipActive = false;
                    return;
                }
                
                // Create a wrapper for PiP
                const summaryClone = document.createElement('div');
                summaryClone.className = 'attendance-summary pip-window-content';
                
                // Clone only the main attendance content
                const mainContentClone = mainContent.cloneNode(true);
                summaryClone.appendChild(mainContentClone);
                
                // Apply user's selected theme to PiP window
                if (userPreferences.displayTheme === 'retro-futuristic') {
                    summaryClone.classList.add('retro-theme');
                }
                
                // Remove PiP button from cloned content
                const pipButtonClone = summaryClone.querySelector('.pip-button');
                if (pipButtonClone) {
                    pipButtonClone.remove();
                }
                
                // Remove developer info from cloned content for more space
                const developerInfoClone = summaryClone.querySelector('.developer-info');
                if (developerInfoClone) {
                    developerInfoClone.remove();
                }
                
                // Remove settings button from cloned content
                const settingsButtonClone = summaryClone.querySelector('.settings-button');
                if (settingsButtonClone) {
                    settingsButtonClone.remove();
                }
                
                // Add compact mode button to PiP window
                const compactButton = document.createElement('button');
                compactButton.className = 'pip-compact-button';
                compactButton.innerHTML = '[≡]';
                compactButton.title = 'Toggle Compact Mode';
                compactButton.onclick = () => toggleCompactMode(pipWindow, summaryClone);
                
                summaryClone.appendChild(compactButton);
                
                // Append to PiP window
                pipWindow.document.body.appendChild(summaryClone);
                
                // Adjust window size to content after a brief delay
                setTimeout(() => {
                    adjustPipWindowSize(pipWindow, summaryClone);
                }, 100);
                
                // Show placeholder in main window
                showPipPlaceholder(attendanceSummary);
                
                // Update PiP button state
                updatePipButtonState(true);
                
                // Set up PiP window event listeners
                setupPipEventListeners(pipWindow, attendanceSummary);
                
                // Start PiP update loop
                startPipUpdateLoop(summaryClone);
            }
            
        } catch (error) {
            console.error('Failed to open Picture-in-Picture window:', error);
            isPipActive = false;
            updatePipButtonState(false);
        }
    }
    
    // Copy styles to PiP window
    function copyStylesToPip(pipWindow) {
        // Add color-scheme meta tag for proper theme inheritance
        const metaColorScheme = pipWindow.document.createElement('meta');
        metaColorScheme.name = 'color-scheme';
        metaColorScheme.content = 'light dark';
        pipWindow.document.head.appendChild(metaColorScheme);
        
        // Copy the custom styles
        const styleElement = document.getElementById('attendance-modern-styles');
        if (styleElement) {
            const pipStyleElement = pipWindow.document.createElement('style');
            pipStyleElement.innerHTML = styleElement.innerHTML;
            pipWindow.document.head.appendChild(pipStyleElement);
        }
        
        // Detect current color scheme from browser/OS
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Determine background based on user's theme preference
        let backgroundStyle;
        if (userPreferences.displayTheme === 'retro-futuristic') {
            // Cyberpunk HUD theme — uses user-customizable colors
            const bg1 = userPreferences.cyberBgPrimary   || '#07091a';
            const bg2 = userPreferences.cyberBgSecondary || '#11142b';
            backgroundStyle = isDarkMode ? `
                background: linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%);
            ` : `
                background: linear-gradient(135deg, #f4f6fb 0%, #e6ebf3 100%);
            `;
        } else {
            // Use glassmorphic theme-aware background
            backgroundStyle = isDarkMode ? `
                background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
            ` : `
                background: linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%);
            `;
        }
        
        // Set body styles for PiP window - borderless and theme-aware
        pipWindow.document.body.style.cssText = `
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ${backgroundStyle}
            min-height: 100vh;
            overflow: hidden;
            border: none;
            border-radius: 0;
            color-scheme: ${isDarkMode ? 'dark' : 'light'};
            transition: background 0.3s ease, color 0.3s ease;
        `;
        
        // Set html styles to remove any default margins/padding
        pipWindow.document.documentElement.style.cssText = `
            margin: 0;
            padding: 0;
            border: none;
            overflow: hidden;
            color-scheme: ${isDarkMode ? 'dark' : 'light'};
        `;
        
        // Listen for browser/OS color scheme changes and update PiP window accordingly
        const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        colorSchemeQuery.addEventListener('change', (e) => {
            updatePipColorScheme(pipWindow, e.matches);
        });
    }
    
    // Update PiP window color scheme dynamically
    function updatePipColorScheme(pipWindow, isDark) {
        if (!pipWindow || pipWindow.closed) return;
        
        let newBg;
        if (userPreferences.displayTheme === 'retro-futuristic') {
            const bg1 = userPreferences.cyberBgPrimary   || '#07091a';
            const bg2 = userPreferences.cyberBgSecondary || '#11142b';
            newBg = isDark
                ? `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`
                : 'linear-gradient(135deg, #f4f6fb 0%, #e6ebf3 100%)';
        } else {
            newBg = isDark
                ? 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)'
                : 'linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%)';
        }

        // Apply the new background with smooth transition
        Object.assign(pipWindow.document.body.style, {
            background: newBg,
            colorScheme: isDark ? 'dark' : 'light'
        });
        
        pipWindow.document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    }
    
    // Toggle compact mode in PiP window
    function toggleCompactMode(pipWindow, summaryElement) {
        if (!pipWindow || pipWindow.closed || !summaryElement) return;
        
        const isCompact = summaryElement.classList.contains('compact-mode');
        
        if (isCompact) {
            // Switch back to full mode - regenerate content instead of cloning from placeholder
            const hadRetroTheme = summaryElement.classList.contains('retro-theme');
            summaryElement.classList.remove('compact-mode');
            summaryElement.className = 'attendance-summary pip-window-content';
            // Restore retro theme if it was set
            if (hadRetroTheme || userPreferences.displayTheme === 'retro-futuristic') {
                summaryElement.classList.add('retro-theme');
            }
            
            // Trigger a fresh calculation and render
            const tableDiv = document.querySelector('.main-attendance-table');
            if (tableDiv) {
                // Create a temporary container to generate fresh content
                const tempContainer = document.createElement('div');
                tempContainer.id = 'temp-pip-content';
                tempContainer.className = 'attendance-summary';
                
                // Calculate and render fresh content to temp container
                calculateTotalTime(tempContainer);
                
                // Copy the fresh content to PiP window
                if (tempContainer.innerHTML) {
                    summaryElement.innerHTML = tempContainer.innerHTML;
                    
                    // Remove PiP button, developer info, and settings button from PiP content
                    const pipButtonClone = summaryElement.querySelector('.pip-button');
                    if (pipButtonClone) pipButtonClone.remove();
                    
                    const developerInfoClone = summaryElement.querySelector('.developer-info');
                    if (developerInfoClone) developerInfoClone.remove();
                    
                    const settingsButtonClone = summaryElement.querySelector('.settings-button');
                    if (settingsButtonClone) settingsButtonClone.remove();
                    
                    // Add compact button back
                    const compactButton = document.createElement('button');
                    compactButton.className = 'pip-compact-button';
                    compactButton.innerHTML = '[≡]';
                    compactButton.title = 'Toggle Compact Mode';
                    compactButton.onclick = () => toggleCompactMode(pipWindow, summaryElement);
                    
                    summaryElement.appendChild(compactButton);
                }
                
                // Clean up temp container
                tempContainer.remove();
            }
        } else {
            // Switch to compact mode
            summaryElement.classList.add('compact-mode');
            
            // Apply retro theme to compact mode if user preference is set
            if (userPreferences.displayTheme === 'retro-futuristic') {
                summaryElement.classList.add('retro-theme');
            }
            
            // Get current remaining time and emoji from the actual content
            const remainingTimeElement = summaryElement.querySelector('#remaining-time');
            const emojiElement = summaryElement.querySelector('.emoji-display');
            const remainingTime = remainingTimeElement ? remainingTimeElement.textContent : '00:00:00';
            const currentEmoji = emojiElement ? emojiElement.textContent : '⏰';
            
            // Create compact display
            const compactHTML = `
                <div class="pip-compact-display" title="Click to expand">
                    <div class="pip-compact-time">${remainingTime}<span class="pip-compact-emoji">${currentEmoji}</span></div>
                    <div class="pip-compact-label">Time until freedom</div>
                </div>
            `;
            
            summaryElement.innerHTML = compactHTML;
            
            // Minimize body space for compact mode
            if (pipWindow && !pipWindow.closed) {
                pipWindow.document.body.style.overflow = 'hidden';
                pipWindow.document.body.style.minHeight = 'auto';
                pipWindow.document.body.style.height = 'auto';
                pipWindow.document.documentElement.style.overflow = 'hidden';
            }
            
            // Add expand functionality to the compact display
            const compactDisplay = summaryElement.querySelector('.pip-compact-display');
            if (compactDisplay) {
                compactDisplay.onclick = () => toggleCompactMode(pipWindow, summaryElement);
            }
            
            // Resize window for compact mode
            try {
                console.log('Compact mode activated - content optimized for minimal space');
            } catch (error) {
                console.log('Could not resize PiP window:', error);
            }
        }
    }
    
    // Adjust PiP window size to fit content
    function adjustPipWindowSize(pipWindow, content) {
        try {
            // Get content dimensions
            const contentHeight = content.scrollHeight;
            const contentWidth = content.scrollWidth;
            
            // Calculate optimal window size with some padding
            const optimalWidth = Math.min(Math.max(contentWidth + 32, 280), 380);
            const optimalHeight = Math.min(contentHeight + 32, window.screen.height * 0.8);
            
            // Note: The Document Picture-in-Picture API doesn't support dynamic resizing
            // But we can optimize the initial size based on screen size
            console.log(`Optimal PiP size would be: ${optimalWidth}x${optimalHeight}`);
            
        } catch (error) {
            console.log('Could not adjust PiP window size:', error);
        }
    }
    
    // Show placeholder in main window when content is in PiP
    function showPipPlaceholder(container) {
        container.classList.add('pip-active');
        
        // Hide all content except PiP button
        const allChildren = container.children;
        for (let child of allChildren) {
            if (!child.classList.contains('pip-button')) {
                child.style.display = 'none';
            }
        }
        
        // Create placeholder content
        const placeholder = document.createElement('div');
        placeholder.className = 'pip-placeholder active';
        placeholder.innerHTML = `
            <div class="pip-placeholder-icon">📱</div>
            <div class="pip-placeholder-text">Floating Window Active</div>
            <div class="pip-placeholder-desc">Your attendance summary is now floating above other windows</div>
        `;
        
        container.appendChild(placeholder);
    }
    
    // Hide placeholder and restore content
    function hidePipPlaceholder(container) {
        container.classList.remove('pip-active');
        
        // Remove placeholder
        const placeholder = container.querySelector('.pip-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        
        // Show all content
        const allChildren = container.children;
        for (let child of allChildren) {
            if (!child.classList.contains('pip-button')) {
                child.style.display = '';
            }
        }
    }
    
    // Update PiP button state
    function updatePipButtonState(isActive) {
        const pipButton = document.querySelector('.pip-button');
        if (pipButton) {
            if (isActive) {
                pipButton.classList.add('active');
                pipButton.innerHTML = `
                    <span class="pip-icon">🔲</span>
                    <span class="pip-text">Close Float</span>
                `;
            } else {
                pipButton.classList.remove('active');
                pipButton.innerHTML = `
                    <span class="pip-icon">📱</span>
                    <span class="pip-text">Float</span>
                `;
            }
        }
    }
    
    // Set up PiP window event listeners
    function setupPipEventListeners(pipWindow, originalContainer) {
        // Handle window close
        pipWindow.addEventListener('pagehide', () => {
            isPipActive = false;
            pipWindow = null;
            hidePipPlaceholder(originalContainer);
            updatePipButtonState(false);
        });
        
        // Handle window unload
        pipWindow.addEventListener('unload', () => {
            isPipActive = false;
            pipWindow = null;
            hidePipPlaceholder(originalContainer);
            updatePipButtonState(false);
        });
        
        // Handle color scheme changes from the main window
        const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleColorSchemeChange = (e) => {
            if (pipWindow && !pipWindow.closed) {
                updatePipColorScheme(pipWindow, e.matches);
            }
        };
        
        colorSchemeQuery.addEventListener('change', handleColorSchemeChange);
        
        // Clean up color scheme listener when PiP window closes
        pipWindow.addEventListener('pagehide', () => {
            colorSchemeQuery.removeEventListener('change', handleColorSchemeChange);
        });
    }
    
    // Start update loop for PiP content
    function startPipUpdateLoop(pipContent) {
        const updatePipContent = () => {
            if (!isPipActive || !pipWindow || pipWindow.closed) {
                return;
            }
            
            // Get current data from the original container
            const originalContainer = document.getElementById('total-time-summary');
            if (originalContainer) {
                
                // Check if we're in compact mode
                if (pipContent.classList.contains('compact-mode')) {
                    // Update compact mode display
                    const compactTimeElement = pipContent.querySelector('.pip-compact-time');
                    const compactDisplay = pipContent.querySelector('.pip-compact-display');
                    
                    const originalRemainingTime = originalContainer.querySelector('#remaining-time');
                    const originalEmojiDisplay = originalContainer.querySelector('.emoji-display');
                    const originalTotalWorked = originalContainer.querySelector('#total-worked-time');
                    
                    if (compactTimeElement && originalRemainingTime) {
                        const remainingTime = originalRemainingTime.textContent;
                        const emoji = originalEmojiDisplay ? originalEmojiDisplay.textContent : '⏰';
                        compactTimeElement.innerHTML = `${remainingTime}<span class="pip-compact-emoji">${emoji}</span>`;
                        
                        // Dynamic background gradient based on progress
                        if (originalTotalWorked && compactDisplay) {
                            const totalSeconds = timeToSeconds(originalTotalWorked.textContent);
                            const progress = Math.min(totalSeconds / getShiftSeconds(), 1);
                            
                            const startColor = [225, 112, 85]; // Red-ish
                            const endColor = [0, 184, 148];   // Green-ish
                            
                            const bgColor = interpolateColor(startColor, endColor, progress);
                            const borderColor = bgColor.replace('0.2)', '0.4)');
                            
                            compactDisplay.style.background = bgColor;
                            compactDisplay.style.borderColor = borderColor;
                        }
                    }
                } else {
                    // Update full mode display - simple sync approach
                    const pipTotalWorked = pipContent.querySelector('#total-worked-time');
                    const pipRemainingTime = pipContent.querySelector('#remaining-time');
                    const pipCompletionTime = pipContent.querySelector('#completion-time');
                    const pipEmojiDisplay = pipContent.querySelector('.emoji-display');
                    const pipProgressFill = pipContent.querySelector('.progress-fill');
                    
                    const originalTotalWorked = originalContainer.querySelector('#total-worked-time');
                    const originalRemainingTime = originalContainer.querySelector('#remaining-time');
                    const originalCompletionTime = originalContainer.querySelector('#completion-time');
                    const originalEmojiDisplay = originalContainer.querySelector('.emoji-display');
                    const originalProgressFill = originalContainer.querySelector('.progress-fill');
                    
                    // Sync content if original elements exist (not in placeholder mode)
                    if (originalTotalWorked && pipTotalWorked) {
                        pipTotalWorked.textContent = originalTotalWorked.textContent;
                    }
                    if (originalRemainingTime && pipRemainingTime) {
                        pipRemainingTime.textContent = originalRemainingTime.textContent;
                    }
                    if (originalCompletionTime && pipCompletionTime) {
                        pipCompletionTime.textContent = originalCompletionTime.textContent;
                    }
                    if (originalEmojiDisplay && pipEmojiDisplay) {
                        pipEmojiDisplay.textContent = originalEmojiDisplay.textContent;
                    }
                    if (originalProgressFill && pipProgressFill) {
                        pipProgressFill.style.width = originalProgressFill.style.width;
                    }
                }
            }
            
            // Continue updating every second
            setTimeout(updatePipContent, 1000);
        };
        
        // Start the update loop
        setTimeout(updatePipContent, 1000);
    }
    
    // Check if game panel should be preserved (games are initialized and active)
    function shouldPreserveGamePanel() {
        return featuresInitialized;
    }
    
    function renderFullContent(totalTimeDiv, totalWorkedTime, checkInOutList, today) {
        // Get emoji for current progress
        const currentEmoji = getEmojiForProgress(totalWorkedTime);
        const progress = Math.min((totalWorkedTime / getShiftSeconds()) * 100, 100);

        // Create header with emoji and title
        const headerHTML = `
            <div class="summary-header">
                <div class="emoji-display" id="game-mode-emoji-toggle" title="🎮 Game Mode ON — click to turn off">${currentEmoji}</div>
                <h2 class="summary-title">Attendance Summary</h2>
            </div>
        `;

        // Create modern table
        let tableHTML = `
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Check-In</th>
                        <th>Check-Out</th>
                        <th>Worked Time</th>
                        <th>Break Duration</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        checkInOutList.forEach((item, index) => {
            let durationDifference = '';
            let isSixHourGap = false;
            
            if (index > 0) {
                const prevItem = checkInOutList[index - 1];
                // Debug logging like original script
                console.log(prevItem.checkOut + '    ' + item.checkIn);
                durationDifference = calculateTimeDifference(prevItem.checkOut, item.checkIn);
                if (durationDifference >= 21600) { 
                    isSixHourGap = true;
                }
                durationDifference = secondsToHHMMSS(durationDifference);
            }
            
            if (isSixHourGap) {
                tableHTML += `
                    <tr>
                        <td colspan="5" class="gap-warning">
                            ⚠️ 6+ Hour Gap Detected (not added in total time)
                        </td>
                    </tr>
                `;
            }
            
            // Add ID to the last row's worked time cell if it's the current active session
            const isLastRow = index === checkInOutList.length - 1;
            const isCurrentSession = item.checkOut === 'Current';
            const workedTimeCellId = (isLastRow && isCurrentSession) ? ' id="current-worked-time"' : '';
            
            tableHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.checkIn}</td>
                    <td>${item.checkOut}</td>
                    <td${workedTimeCellId}>${item.workedTime}</td>
                    <td>${durationDifference}</td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';

        // Create progress bar
        const progressBarHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
        `;

        // Create time statistics
        const totalTimeFormatted = secondsToHHMMSS(totalWorkedTime);
        const remainingTime = getShiftSeconds() - totalWorkedTime;
        const remainingTimeFormatted = remainingTime > 0 ? secondsToHHMMSS(remainingTime) : "00:00:00";

        let timeStatsHTML = `
            <div class="time-stats">
            <div class="stat-card worked-time-card">
                <div class="stat-label">Total Worked</div>
                <div id="total-worked-time" class="stat-value worked-time">${totalTimeFormatted}</div>
            </div>
            <div class="stat-card remaining-time-card">
                <div class="stat-label">Remaining</div>
                <div id="remaining-time" class="stat-value remaining-time">${remainingTimeFormatted}</div>
                <div class="remaining-desc">⏰ Time until freedom</div>
            </div>
        `;

        let futureTimeFormatted = '';
        if (remainingTime > 0) {
            const futureTime = new Date(today.getTime() + remainingTime * 1000);
            futureTimeFormatted = formatTime12Hour(futureTime);
            timeStatsHTML += `
                <div class="stat-card completion-time-card">
                    <div class="stat-label">Complete at</div>
                    <div id="completion-time" class="stat-value completion-time">${futureTimeFormatted}</div>
                </div>
            `;
        }

        timeStatsHTML += '</div>';

        // Completion message
        let completionHTML = '';
        if (remainingTime <= 0) {
            completionHTML = `
                <div class="completion-message">
                    🎉 Congratulations! You've completed your 8-hour shift! 🎉
                </div>
            `;
        }

        // Left panel - Multi-Game System & Quotes
        const leftPanelHTML = `
            <div class="left-panel">
                <!-- Multi-Game Container -->
                <div class="snake-game-container">
                    <!-- Game Switcher -->
                    <div class="game-switcher">
                        <button id="game-switch-snake" class="game-switch-btn active" onclick="window.switchGame('snake')" title="Snake Game">🐍</button>
                        <button id="game-switch-flappy" class="game-switch-btn" onclick="window.switchGame('flappy')" title="Flappy Bird">🐦</button>
                        <button id="game-switch-tetris" class="game-switch-btn" onclick="window.switchGame('tetris')" title="Tetris">🧱</button>
                        <button id="game-switch-reflex" class="game-switch-btn" onclick="window.switchGame('reflex')" title="RefleX Game">⚡</button>
                        <button id="game-switch-aim" class="game-switch-btn" onclick="window.switchGame('aim')" title="Chaos Aim">💥</button>
                        <button id="game-switch-breakout" class="game-switch-btn" onclick="window.switchGame('breakout')" title="Breakout">🏓</button>
                        <button id="game-switch-pool" class="game-switch-btn" onclick="window.switchGame('pool')" title="8-Ball Pool">🎱</button>
                        <button id="game-switch-ludo" class="game-switch-btn" onclick="window.switchGame('ludo')" title="Ludo">🎲</button>
                        <button id="game-switch-prayer" class="game-switch-btn" onclick="window.switchGame('prayer')" title="Prayer Counter">📿</button>
                        <button id="game-switch-leaderboard" class="game-switch-btn" onclick="window.switchGame('leaderboard')" title="Leaderboard">🏆</button>
                    </div>
                    
                    <!-- Game Header (Dynamic) -->
                    <div class="snake-game-header">
                        <span id="game-title" class="snake-game-title">🐍 Snake Game</span>
                        <div id="snake-scoreboard" class="snake-scoreboard">
                            <span id="snake-high-score" class="snake-score">High: 0</span>
                            <span class="snake-score">Score: <span id="snake-current-score">0</span></span>
                        </div>
                        <div id="flappy-scoreboard" class="snake-scoreboard" style="display: none;">
                            <span id="flappy-high-score" class="snake-score">Best: 0</span>
                            <span class="snake-score">Score: <span id="flappy-current-score">0</span></span>
                        </div>
                        <div id="tetris-scoreboard" class="snake-scoreboard" style="display: none;">
                            <span id="tetris-high-score" class="snake-score">Best: 0</span>
                            <span class="snake-score">Sc: <span id="tetris-score">0</span> | Ln: <span id="tetris-lines">0</span> | Lv: <span id="tetris-level">1</span></span>
                        </div>
                        <div id="reflex-scoreboard" style="display: none;">
                            <span id="reflex-high-score" class="snake-score">Best: 0ms</span>
                        </div>
                        <div id="aim-scoreboard" style="display: none;">
                            <span id="aim-high-score" class="snake-score">High Score: 0</span>
                        </div>
                        <div id="breakout-scoreboard" class="snake-scoreboard" style="display: none;">
                            <span class="snake-score">Best: <span id="breakout-hiscore">0</span></span>
                            <span class="snake-score">Sc: <span id="breakout-score">0</span></span>
                            <span class="snake-score">Lv: <span id="breakout-level">1</span></span>
                            <span id="breakout-lives" class="snake-score">❤️❤️❤️</span>
                        </div>
                        <div id="pool-scoreboard" class="snake-scoreboard" style="display: none;">
                            <span class="snake-score">P1: <span id="pool-p1-score">0</span></span>
                            <span class="snake-score">P2: <span id="pool-p2-score">0</span></span>
                            <span class="snake-score" id="pool-turn-label">Turn: P1</span>
                        </div>
                        <div id="ludo-scoreboard" class="snake-scoreboard" style="display: none;">
                            <span class="snake-score" id="ludo-mode-label">PvCPU</span>
                            <span class="snake-score" id="ludo-home-label">🏠 0/4</span>
                            <span class="snake-score" id="ludo-turn-label">Press Play</span>
                        </div>
                        <div id="prayer-scoreboard" class="snake-scoreboard" style="display: none;">
                            <span class="snake-score">📿 Count: <span id="prayer-hdr-count">0</span></span>
                        </div>
                    </div>
                    
                    <!-- Snake Canvas -->
                    <canvas id="snake-canvas" class="snake-canvas" width="368" height="368"></canvas>
                    
                    <!-- Flappy Bird Canvas -->
                    <canvas id="flappy-canvas" class="snake-canvas" width="368" height="368" style="display:none;"></canvas>
                    
                    <!-- Tetris Canvas -->
                    <canvas id="tetris-canvas" class="snake-canvas" width="368" height="368" style="display:none;"></canvas>
                    <canvas id="breakout-canvas" class="snake-canvas" width="368" height="368" style="display:none; cursor:none;"></canvas>
                    <canvas id="pool-canvas" width="368" height="368" style="display:none; cursor:crosshair;"></canvas>
                    <!-- Ludo is 344×416, not 368² — a square board plus HUD strips. -->
                    <canvas id="ludo-canvas" width="344" height="416" style="display:none; cursor:pointer;"></canvas>
                    
                    <!-- Multi-Game Area (for RefleX and AimTrainer) -->
                    <div id="multi-game-area" class="multi-game-area" style="display: none;"></div>

                    <!-- Prayer Counter Panel -->
                    <div id="prayer-panel" class="prayer-panel" style="display: none;">
                        <div class="prayer-screen">
                            <div class="prayer-label">TASBIH COUNTER</div>
                            <div id="prayer-count-display" class="prayer-digital">000000</div>
                            <div class="prayer-sublabel">tap +1 to count dhikr</div>
                        </div>
                        <button class="prayer-plus-btn" onclick="window.prayerIncrementBtn()">+1</button>
                        <button class="prayer-reset-btn" onclick="window.prayerResetBtn()" title="Reset counter">🔄</button>
                    </div>
                    
                    <!-- Game Stats -->
                    <div id="reflex-stats" style="display: none;"></div>
                    <div id="aim-stats" style="display: none;">
                        <div style="display: flex; justify-content: space-around; padding: 8px; font-size: 0.875rem;">
                            <div><strong>Time:</strong> <span id="aim-timer-display">30</span>s</div>
                            <div><strong>Score:</strong> <span id="aim-score-display">0</span></div>
                            <div><strong>Accuracy:</strong> <span id="aim-accuracy-display">100</span>%</div>
                            <div><strong>Hits:</strong> <span id="aim-hits-display">0</span>/<span id="aim-shots-display">0</span></div>
                        </div>
                    </div>
                    
                    <!-- Snake Controls -->
                    <div id="snake-controls" class="snake-controls">
                        <button id="snake-play-btn" class="snake-btn" onclick="window.snakePlayPause()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetSnake()">🔄 Reset</button>
                    </div>
                    
                    <!-- RefleX Controls -->
                    <div id="reflex-controls" class="snake-controls" style="display: none;">
                        <button class="snake-btn" onclick="window.toggleReflexModeBtn()">🔄 Switch Mode</button>
                        <button id="reflex-play-btn" class="snake-btn" onclick="window.startReflexGameBtn()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetReflexGameBtn()">🔄 Reset</button>
                    </div>
                    
                    <!-- AimTrainer Controls -->
                    <div id="aim-controls" class="snake-controls" style="display: none;">
                        <button id="aim-play-btn" class="snake-btn" onclick="window.startAimGameBtn()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetAimGameBtn()">🔄 Reset</button>
                    </div>
                    
                    <!-- Flappy Bird Controls -->
                    <div id="flappy-controls" class="snake-controls" style="display: none;">
                        <button class="snake-btn" onclick="window.startFlappyGameBtn()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetFlappyGameBtn()">🔄 Reset</button>
                    </div>
                    
                    <!-- Tetris Controls -->
                    <div id="tetris-controls" class="snake-controls" style="display: none;">
                        <button class="snake-btn" onclick="window.startTetrisGameBtn()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetTetrisGameBtn()">🔄 Reset</button>
                    </div>
                    
                    <!-- Breakout Controls -->
                    <div id="breakout-controls" class="snake-controls" style="display: none;">
                        <button class="snake-btn" onclick="window.startBreakoutGameBtn()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetBreakoutGameBtn()">🔄 Reset</button>
                    </div>

                    <!-- Pool Controls -->
                    <div id="pool-controls" class="snake-controls" style="display: none;">
                        <button class="snake-btn" onclick="window.togglePoolModeBtn()">🔄 PvCPU</button>
                        <button class="snake-btn" onclick="window.startPoolGameBtn()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetPoolGameBtn()">🔄 Reset</button>
                        <button class="snake-btn" onclick="window.togglePoolMaximizeBtn()">⛶ Max</button>
                    </div>

                    <!-- Ludo Controls -->
                    <div id="ludo-controls" class="snake-controls" style="display: none;">
                        <button class="snake-btn" id="ludo-mode-btn" onclick="window.cycleLudoModeBtn()">🔄 PvCPU</button>
                        <button class="snake-btn" onclick="window.startLudoGameBtn()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetLudoGameBtn()">🔄 Reset</button>
                        <button class="snake-btn" onclick="window.toggleLudoMaximizeBtn()">⛶ Max</button>
                    </div>

                    <!-- Prayer Counter Controls (empty — interaction is on the panel itself) -->
                    <div id="prayer-controls" class="snake-controls" style="display: none;"></div>

                    <!-- Leaderboard Panel -->
                    <div id="leaderboard-panel" class="leaderboard-panel" style="display: none;"></div>
                    <div id="leaderboard-controls" class="snake-controls" style="display: none;"></div>
                    <div id="leaderboard-scoreboard" class="snake-scoreboard" style="display: none;">
                        <button class="lb-sync-btn" onclick="window.lbSync()" title="Sync & Refresh">🔄</button>
                    </div>
                    
                    <!-- Game Over Overlays -->
                    <div id="snake-game-over" class="snake-game-over">
                        <h3>Game Over!</h3>
                        <p>Final Score: <span class="final-score">0</span></p>
                        <p>Auto restarting...</p>
                    </div>
                </div>
                
                <!-- Results Modals -->
                <div id="reflex-results"></div>
                <div id="aim-results"></div>
                
                <!-- Quotes Box -->
                <div class="quotes-container">
                    <div class="quotes-header">
                        <span class="quotes-title">💭 Daily Motivation</span>
                        <button class="quote-add-btn" onclick="window.addQuote()">+ Add Quote</button>
                    </div>
                    <div class="quote-display">
                        <div>
                            <div id="quote-text" class="quote-text"></div>
                            <div id="quote-author" class="quote-author"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Center panel - Main attendance content
        const mainContentHTML = `
            <div class="main-attendance-content">
                ${headerHTML}
                ${progressBarHTML}
                ${tableHTML}
                ${timeStatsHTML}
                ${completionHTML}
            </div>
        `;
        
        // Right panel - XP System & Image Box
        const rightPanelHTML = `
            <div class="right-panel">
                <!-- XP System -->
                <div class="xp-container">
                    <div class="xp-header">
                        <span class="xp-title">⭐ Work Rewards</span>
                        <div class="xp-level">
                            <span class="level-badge">Level <span id="xp-level">1</span></span>
                        </div>
                    </div>
                    <div class="xp-progress-container">
                        <div class="xp-progress-bar">
                            <div id="xp-progress-fill" class="xp-progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="xp-info">
                            <span><span id="xp-current">0</span> XP</span>
                            <span><span id="xp-needed">120</span> XP to next level</span>
                        </div>
                        <div id="xp-next-milestone" class="xp-next-milestone" style="display: none;">
                            Next milestone in Xh
                        </div>
                    </div>
                    <div class="xp-streak">
                        <span class="xp-streak-icon">🔥</span>
                        <span><span id="xp-streak">0</span>-Day Streak</span>
                        <span style="opacity: 0.6; font-size: 0.75rem;">(Best: <span id="xp-longest-streak">0</span>)</span>
                    </div>
                    <div class="xp-stats">
                        <div class="xp-stat-item">
                            <div class="xp-stat-label">Total XP</div>
                            <div id="xp-total" class="xp-stat-value">0</div>
                        </div>
                        <div class="xp-stat-item">
                            <div class="xp-stat-label">Today's Hours</div>
                            <div id="xp-today-hours" class="xp-stat-value">0</div>
                        </div>
                    </div>
                    <div id="xp-achievements" class="xp-achievements">
                        <!-- Achievement badges will be dynamically inserted here -->
                    </div>
                </div>
                
                <!-- Image Box -->
                <div class="image-box-container">
                    <div class="image-box-header">
                        <div class="aspect-ratio-controls">
                            <button id="aspect-ratio-1-1" class="aspect-ratio-btn" onclick="window.changeImageAspectRatio('1:1')" title="Square (1:1) - Profile pics, badges">◻</button>
                            <button id="aspect-ratio-16-9" class="aspect-ratio-btn active" onclick="window.changeImageAspectRatio('16:9')" title="Widescreen (16:9) - Videos, monitors">▬</button>
                            <button id="aspect-ratio-4-3" class="aspect-ratio-btn" onclick="window.changeImageAspectRatio('4:3')" title="Classic (4:3) - Old monitors, photos">▭</button>
                            <button id="aspect-ratio-9-16" class="aspect-ratio-btn" onclick="window.changeImageAspectRatio('9:16')" title="Portrait (9:16) - Phone screens, stories">▯</button>
                        </div>
                        <button class="image-change-btn" onclick="window.changeImageBox()">Change Image</button>
                    </div>
                    <div id="image-display" class="image-display">
                        <div class="image-placeholder">📷 Click "Change Image" to add your favorite image</div>
                    </div>
                </div>
            </div>
        `;

        // Check if we should preserve the game panel to prevent blinking
        const preserveGames = shouldPreserveGamePanel();
        const existingLeftPanel = totalTimeDiv.querySelector('.left-panel');
        
        if (preserveGames && existingLeftPanel) {
            // Games are running - only update center and right panels, leave games untouched
            let centerPanel = totalTimeDiv.querySelector('.main-attendance-content');
            let rightPanel = totalTimeDiv.querySelector('.right-panel');
            
            if (centerPanel) {
                centerPanel.innerHTML = mainContentHTML.replace(/<div class="main-attendance-content">/, '').replace(/<\/div>$/, '');
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = mainContentHTML;
                centerPanel = tempDiv.firstElementChild;
                totalTimeDiv.appendChild(centerPanel);
            }
            
            if (rightPanel) {
                rightPanel.innerHTML = rightPanelHTML.replace(/<div class="right-panel">/, '').replace(/<\/div>$/, '');
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = rightPanelHTML;
                rightPanel = tempDiv.firstElementChild;
                totalTimeDiv.appendChild(rightPanel);
            }
        } else {
            // First render or games not initialized - build everything
            totalTimeDiv.innerHTML = leftPanelHTML + mainContentHTML + rightPanelHTML;
        }
        
        // Wire emoji click → Game Mode toggle
        const _emojiToggle = totalTimeDiv.querySelector('#game-mode-emoji-toggle');
        if (_emojiToggle) {
            _emojiToggle.addEventListener('click', () => {
                userPreferences.gameModeHidden = !userPreferences.gameModeHidden;
                savePreferences();
                applyGameMode();
                _emojiToggle.style.transition = 'transform 0.22s cubic-bezier(0.68,-0.55,0.27,1.55)';
                _emojiToggle.style.transform = 'scale(1.45) rotate(-12deg)';
                setTimeout(() => { _emojiToggle.style.transform = ''; }, 230);
            });
        }

        // Bottom control bar — lives inside main-attendance-content as a normal flex child
        const _mainContent = totalTimeDiv.querySelector('.main-attendance-content');
        const _target = _mainContent || totalTimeDiv;
        let _controlBar = _target.querySelector('.bottom-control-bar');
        if (!_controlBar) {
            _controlBar = document.createElement('div');
            _controlBar.className = 'bottom-control-bar';
            _target.appendChild(_controlBar);
        }
        _controlBar.innerHTML = ''; // repopulate fresh each render
        addSettingsButton(_controlBar);
        createPipButton(_controlBar);
        addDeveloperInfo(_controlBar);
        
        // Add parallax effect
        addParallaxEffect(totalTimeDiv);
        
        // Initialize all new features after DOM is ready (only once)
        if (!featuresInitialized) {
            setTimeout(() => {
                initSnakeGame();
                initQuotesSystem();
                initXPSystem();
                initImageBox();
                // Pre-load high scores for new games
                flappyHighScore = loadFlappyHighScore();
                tetrisHighScore = loadTetrisHighScore();
                
                // Award XP based on hours worked
                const hoursWorked = totalWorkedTime / 3600;
                awardXP(hoursWorked);
                
                // Add global keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    // Only handle shortcuts if not in an input field
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    
                    switch(e.key) {
                        case '1': window.switchGame('snake'); break;
                        case '2': window.switchGame('flappy'); break;
                        case '3': window.switchGame('tetris'); break;
                        case '4': window.switchGame('reflex'); break;
                        case '5': window.switchGame('aim'); break;
                        case '6': window.switchGame('breakout'); break;
                        case '7': window.switchGame('pool'); break;
                        case '8': window.switchGame('leaderboard'); break;
                        case '9': window.switchGame('ludo'); break;
                        case 'p': case 'P':
                            if (currentGame === 'snake' && snakeGameRunning) pauseSnakeGame();
                            break;
                        case 'Escape':
                            switch(currentGame) {
                                case 'snake': resetSnakeGame(); break;
                                case 'reflex': resetReflexGame(); break;
                                case 'aim': resetAimGame(); break;
                                case 'flappy': resetFlappyGame(); break;
                                case 'tetris': resetTetrisGame(); break;
                                case 'breakout': resetBreakoutGame(); break;
                                case 'pool': resetPoolGame(); break;
                                case 'ludo': resetLudoGame(); break;
                            }
                            break;
                    }
                });
                
                featuresInitialized = true;
            }, 100);
        } else {
            // Features already initialized, just update XP
            const hoursWorked = totalWorkedTime / 3600;
            awardXP(hoursWorked);
        }
        
        // Expose functions to window for onclick handlers
        window.snakePlayPause = () => {
            if (!snakeGameRunning) {
                startSnakeGame();
            } else {
                pauseSnakeGame();
            }
        };
        window.resetSnake = resetSnakeGame;
        window.addQuote = addCustomQuote;
        window.changeImageBox = changeImage;
        window.changeImageAspectRatio = changeAspectRatio;
        
        // Multi-game system window functions
        window.switchGame = (gameKey) => {
            switchToGame(gameKey);
            updateGameTitle(gameKey);
        };
        
        window.startReflexGameBtn = () => {
            startReflexGame();
        };
        
        window.resetReflexGameBtn = () => {
            resetReflexGame();
        };
        
        window.toggleReflexModeBtn = () => {
            toggleReflexMode();
            updateGameTitle('reflex');
        };
        
        window.startAimGameBtn = () => { startAimGame(); };
        window.resetAimGameBtn = () => { resetAimGame(); };
        
        window.startFlappyGameBtn = () => { startFlappyGame(); };
        window.resetFlappyGameBtn = () => { resetFlappyGame(); };
        window.startTetrisGameBtn = () => { startTetrisGame(); };
        window.resetTetrisGameBtn = () => { resetTetrisGame(); };
        window.startBreakoutGameBtn = () => { startBreakoutGame(); };
        window.resetBreakoutGameBtn = () => { resetBreakoutGame(); };
        window.startPoolGameBtn = () => { startPoolGame(); };
        window.resetPoolGameBtn = () => { resetPoolGame(); };
        window.togglePoolModeBtn = () => { togglePoolMode(); };
        window.togglePoolMaximizeBtn = () => { togglePoolMaximize(); };
        window.startLudoGameBtn = () => { startLudoGame(); };
        window.resetLudoGameBtn = () => { resetLudoGame(); };
        window.cycleLudoModeBtn = () => {
            // cycleLudoModeAndReset returns the new mode's label so the button
            // text stays in step with the mode it actually switched to.
            const label = cycleLudoModeAndReset();
            const btn = document.getElementById('ludo-mode-btn');
            if (btn) btn.textContent = '🔄 ' + label;
        };
        window.toggleLudoMaximizeBtn = () => { toggleLudoMaximize(); };
        window.prayerIncrementBtn = prayerIncrement;
        window.prayerResetBtn = prayerReset;

        // Leaderboard window functions
        window.lbRegister = async () => {
            const input = document.getElementById('lb-name-input');
            const name = (input ? input.value : '').trim();
            if (!name || name.length < 2) {
                showXPNotification('⚠️ Enter a display name (2+ chars)', 'hourly');
                return;
            }
            const btn = document.querySelector('.lb-register-btn');
            if (btn) { btn.disabled = true; btn.textContent = '⏳ Joining...'; }
            const ok = await registerPlayer(name);
            if (ok) {
                await fetchLeaderboard();
                // Ensure own entry is visible immediately even if sync hasn't run
                if (leaderboardData.length === 0) {
                    leaderboardData = [{
                        clientId: lbClientId,
                        displayName: lbDisplayName,
                        level: userXP.level || 1,
                        totalXP: userXP.totalXP || 0,
                        totalWorkDays: userXP.totalWorkDays || 0,
                        consecutiveDays: userXP.consecutiveDays || 0,
                        longestStreak: userXP.longestStreak || 0,
                        gameBests: {
                            snake: parseInt(localStorage.getItem('snakeHighScore') || '0', 10),
                            flappy: parseInt(localStorage.getItem('flappyHighScore') || '0', 10),
                            tetris: parseInt(localStorage.getItem('tetrisHighScore') || '0', 10),
                            breakout: parseInt(localStorage.getItem('breakoutHighScore') || '0', 10),
                            pool: parseInt(localStorage.getItem('poolGamesWon') || '0', 10),
                            ludo: parseInt(localStorage.getItem('ludoGamesWon') || '0', 10),
                            aim: parseInt(localStorage.getItem('aimChaosHighScore') || '0', 10),
                            reflex: (() => { const d = JSON.parse(localStorage.getItem('reflexHighScores') || '{}'); return (d?.screen?.best && d.screen.best !== Infinity && d.screen.best > 0) ? d.screen.best : 0; })()
                        },
                        joinedAt: new Date().toISOString().split('T')[0],
                        lastSync: new Date().toISOString()
                    }];
                }
                renderLeaderboardPanel();
            } else if (btn) { btn.disabled = false; btn.textContent = '🚀 Join Now'; }
        };
        window.lbSync = async () => {
            showXPNotification('🔄 Syncing scores...', 'hourly');
            await syncMyScore();
            await fetchLeaderboard();
            // Ensure local entry reflects latest localStorage scores (avoids stale API cache)
            const myEntry = leaderboardData.find(p => p.clientId === lbClientId);
            if (myEntry) {
                myEntry.level = userXP.level || 1;
                myEntry.totalXP = userXP.totalXP || 0;
                myEntry.totalWorkDays = userXP.totalWorkDays || 0;
                myEntry.consecutiveDays = userXP.consecutiveDays || 0;
                myEntry.longestStreak = userXP.longestStreak || 0;
                const syncReflexData = JSON.parse(localStorage.getItem('reflexHighScores') || '{}');
                const syncReflexBest = syncReflexData?.screen?.best;
                myEntry.gameBests = {
                    snake: parseInt(localStorage.getItem('snakeHighScore') || '0', 10),
                    flappy: parseInt(localStorage.getItem('flappyHighScore') || '0', 10),
                    tetris: parseInt(localStorage.getItem('tetrisHighScore') || '0', 10),
                    breakout: parseInt(localStorage.getItem('breakoutHighScore') || '0', 10),
                    pool: parseInt(localStorage.getItem('poolGamesWon') || '0', 10),
                    ludo: parseInt(localStorage.getItem('ludoGamesWon') || '0', 10),
                    aim: parseInt(localStorage.getItem('aimChaosHighScore') || '0', 10),
                    reflex: (syncReflexBest && syncReflexBest !== Infinity && syncReflexBest > 0) ? syncReflexBest : 0
                };
            }
            renderLeaderboardPanel();
            showXPNotification('✅ Leaderboard updated!', 'hourly');
        };
        
        // Helper function to update game title
        function updateGameTitle(gameKey) {
            const titleElement = document.getElementById('game-title');
            if (!titleElement) return;
            
            switch (gameKey) {
                case 'snake':
                    titleElement.textContent = '🐍 Snake Game';
                    break;
                case 'flappy':
                    titleElement.textContent = '🐦 Flappy Bird';
                    break;
                case 'tetris':
                    titleElement.textContent = '🧱 Tetris';
                    break;
                case 'reflex':
                    const modeName = reflexGameModes[reflexMode].name;
                    titleElement.textContent = `⚡ RefleX - ${modeName}`;
                    break;
                case 'aim':
                    titleElement.textContent = '💥 Chaos Aim Trainer';
                    break;
                case 'breakout':
                    titleElement.textContent = '🏓 Breakout';
                    break;
                case 'pool':
                    titleElement.textContent = '🎱 8-Ball Pool';
                    break;
                case 'ludo':
                    titleElement.textContent = '🎲 Ludo';
                    break;
                case 'prayer':
                    titleElement.textContent = '📿 Prayer Counter';
                    break;
                case 'leaderboard':
                    titleElement.textContent = '🏆 Leaderboard';
                    break;
            }
        }
        
        // Reset cached values for new render
        cachedValues = {
            totalWorked: totalTimeFormatted,
            remaining: remainingTimeFormatted,
            completion: futureTimeFormatted,
            emoji: currentEmoji,
            progress: progress
        };
    }
    
    function updateDynamicContent(totalWorkedTime, today, checkInOutList = []) {
        // Batch all DOM reads first, then all writes to prevent layout thrashing
        const totalTimeFormatted = secondsToHHMMSS(totalWorkedTime);
        const remainingTime = getShiftSeconds() - totalWorkedTime;
        const remainingTimeFormatted = remainingTime > 0 ? secondsToHHMMSS(remainingTime) : "00:00:00";
        const currentEmoji = getEmojiForProgress(totalWorkedTime);
        const progress = Math.min((totalWorkedTime / getShiftSeconds()) * 100, 100);
        
        let futureTimeFormatted = '';
        if (remainingTime > 0) {
            const futureTime = new Date(today.getTime() + remainingTime * 1000);
            futureTimeFormatted = formatTime12Hour(futureTime);
        }
        
        // Update XP based on hours worked
        const hoursWorked = totalWorkedTime / 3600;
        awardXP(hoursWorked);
        
        // Get or cache DOM elements (do this ONCE to avoid repeated queries)
        if (!cachedElements.totalWorkedTime) {
            cachedElements.totalWorkedTime = document.getElementById('total-worked-time');
            cachedElements.remainingTime = document.getElementById('remaining-time');
            cachedElements.completionTime = document.getElementById('completion-time');
            cachedElements.emojiDisplay = document.querySelector('.emoji-display');
            cachedElements.progressFill = document.querySelector('.progress-fill');
        }
        
        // Update "Current" row in the table if it exists (for active check-in)
        if (checkInOutList.length > 0) {
            const lastEntry = checkInOutList[checkInOutList.length - 1];
            if (lastEntry.checkOut === 'Current') {
                if (!cachedElements.currentWorkedTime) {
                    cachedElements.currentWorkedTime = document.getElementById('current-worked-time');
                }
                const workedTimeCell = cachedElements.currentWorkedTime;
                if (workedTimeCell && workedTimeCell.textContent !== lastEntry.workedTime) {
                    requestAnimationFrame(() => {
                        workedTimeCell.textContent = lastEntry.workedTime;
                    });
                }
            }
        }
        
        // Only update if values have actually changed
        const updates = [];
        
        if (cachedValues.totalWorked !== totalTimeFormatted) {
            const element = cachedElements.totalWorkedTime;
            if (element) {
                updates.push({
                    element: element,
                    property: 'textContent',
                    value: totalTimeFormatted
                });
            }
            cachedValues.totalWorked = totalTimeFormatted;
        }
        
        if (cachedValues.remaining !== remainingTimeFormatted) {
            const element = cachedElements.remainingTime;
            if (element) {
                updates.push({
                    element: element,
                    property: 'textContent',
                    value: remainingTimeFormatted
                });
            }
            cachedValues.remaining = remainingTimeFormatted;
        }
        
        if (cachedValues.completion !== futureTimeFormatted && futureTimeFormatted) {
            const element = cachedElements.completionTime;
            if (element) {
                updates.push({
                    element: element,
                    property: 'textContent',
                    value: futureTimeFormatted
                });
            }
            cachedValues.completion = futureTimeFormatted;
        }
        
        if (cachedValues.emoji !== currentEmoji) {
            const element = cachedElements.emojiDisplay;
            if (element) {
                updates.push({
                    element: element,
                    property: 'textContent',
                    value: currentEmoji
                });
            }
            cachedValues.emoji = currentEmoji;
        }
        
        // Only update progress if it changed by at least 0.1% to avoid constant updates
        const roundedProgress = Math.round(progress * 10) / 10;
        if (Math.abs(cachedValues.progress - roundedProgress) >= 0.1) {
            const element = cachedElements.progressFill;
            if (element) {
                updates.push({
                    element: element,
                    property: 'width',
                    value: `${roundedProgress}%`
                });
            }
            cachedValues.progress = roundedProgress;
        }
        
        // Batch all DOM writes together using RAF for smooth, non-blocking updates
        // RAF ensures updates happen during browser's repaint cycle, not during animations
        if (updates.length > 0) {
            requestAnimationFrame(() => {
                // Group all updates in single batch to minimize reflows
                updates.forEach(update => {
                    if (update.element) {
                        if (update.property === 'width') {
                            update.element.style.width = update.value;
                        } else {
                            update.element[update.property] = update.value;
                        }
                    }
                });
            });
        }
    }

    // Optimized update loop using requestAnimationFrame
    function startUpdateLoop() {
        let lastUpdateTime = 0;
        
        function updateLoop(currentTime) {
            // Throttle updates to once per second
            if (currentTime - lastUpdateTime >= 1000) {
                const currentUrl = window.location.href;
                if (currentUrl === targetUrl) {
                    insertAndCalculate();
                }
                lastUpdateTime = currentTime;
            }
            
            animationFrameId = requestAnimationFrame(updateLoop);
        }
        
        animationFrameId = requestAnimationFrame(updateLoop);
    }
    
    function stopUpdateLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // Initialize the enhanced attendance checker
    window.addEventListener('load', () => {
        // Load user preferences
        loadPreferences();
        
        const checkUrlAndRun = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== targetUrl) {
                return; 
            }

            insertAndCalculate();
            const submitButton = document.querySelector('.gp-btn.gp-btn-primary');
            if (submitButton) {
                submitButton.addEventListener('click', (event) => {
                    setTimeout(insertAndCalculate, 500);
                });
            }
        };

        checkUrlAndRun();

        // Start optimized update loop
        startUpdateLoop();
    });
    
    // Cleanup animation frames when page unloads
    window.addEventListener('beforeunload', () => {
        stopUpdateLoop();
    });
})();
