(function() {
    'use strict';
    
    // ====================================
    // ENHANCED ATTENDANCE TIME CHECKER 2025
    // Modern UI with Glassmorphism & Emoji Progression
    // ====================================
    
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
    
    const runningEmoji = '🏃💨'; // 8:00 to 8:30 hours
    const clownEmoji = '🫵🤡'; // After 8:30 hours
    
    // Global variables for performance optimization
    let lastTotalWorkedTime = -1; // Track if we need to re-render
    let isFirstRender = true; // Track first render
    let animationFrameId = null; // For requestAnimationFrame
    let pipWindow = null; // Picture-in-Picture window reference
    let isPipActive = false; // Track PiP status
    
    // Feature initialization flags to prevent re-initialization
    let featuresInitialized = false;
    
    // ====================================
    // SNAKE GAME VARIABLES
    // ====================================
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
    
    // ====================================
    // MULTI-GAME SYSTEM VARIABLES
    // ====================================
    let currentGame = 'snake'; // 'snake' | 'reflex' | 'aim'
    let gameAreaElement = null;
    
    // ====================================
    // REFLEX GAME VARIABLES
    // ====================================
    let reflexGameStarted = false;
    let reflexGameFinished = false;
    let reflexIsWaiting = false;
    let reflexCanClick = false;
    let reflexStartTime = 0;
    let reflexReactionTimes = [];
    let reflexCurrentRound = 0;
    let reflexFalseStarts = 0;
    let reflexMode = 'screen'; // 'screen' | 'target'
    
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
    
    // ====================================
    // AIM TRAINER GAME VARIABLES
    // ====================================
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
    
    // ====================================
    // FLAPPY BIRD GAME VARIABLES
    // ====================================
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
    const FLAPPY_GRAVITY = 0.45;
    const FLAPPY_JUMP = -7.5;
    const FLAPPY_PIPE_GAP_BASE = 140; // starting gap, narrows with score
    const FLAPPY_PIPE_WIDTH = 52;
    const FLAPPY_PIPE_SPEED_BASE = 2.0; // increases with score
    const FLAPPY_PIPE_INTERVAL = 90; // frames
    let flappyStarted = false; // waiting for first tap

    // ====================================
    // TETRIS GAME VARIABLES
    // ====================================
    let tetrisCanvas, tetrisCtx;
    let tetrisBoard = [];
    let tetrisCurrentPiece = null;
    let tetrisNextPiece = null;
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

    // ====================================
    // QUOTES SYSTEM VARIABLES
    // ====================================
    let quotesArray = [];
    let currentQuoteIndex = 0;
    let quoteInterval = null;
    let quotesInitialized = false; // Track if quotes system is already set up
    
    // ====================================
    // XP SYSTEM VARIABLES
    // ====================================
    let userXP = { 
        level: 1, 
        currentXP: 0, 
        totalXP: 0, 
        lastHourTracked: -1, 
        todayHours: 0,
        consecutiveDays: 0,
        lastAttendanceDate: null,
        longestStreak: 0,
        achievements: [],
        milestonesReached: []
    };
    
    // XP System Constants (Research-proven values)
    const XP_PER_HOUR = 15;           // Base hourly reward (increased from 10)
    const STREAK_BONUS = 20;          // Daily streak bonus
    const MILESTONE_BONUSES = {
        2: { xp: 10, label: '2-Hour Checkpoint' },
        4: { xp: 25, label: '4-Hour Halfway' },
        6: { xp: 40, label: '6-Hour Almost There' },
        8: { xp: 50, label: '8-Hour Full Day' }
    };
    
    // Achievement Definitions
    const ACHIEVEMENTS = {
        firstDay: { icon: '🎯', name: 'First Day', desc: 'Complete your first work day' },
        week1: { icon: '📅', name: 'Week Warrior', desc: 'Work 5 consecutive days' },
        streak7: { icon: '🔥', name: '7-Day Streak', desc: 'Maintain a 7-day streak' },
        streak30: { icon: '🏆', name: 'Monthly Master', desc: 'Achieve a 30-day streak' },
        level10: { icon: '⭐', name: 'Level 10', desc: 'Reach level 10' },
        level25: { icon: '💎', name: 'Level 25', desc: 'Reach level 25' },
        workaholic: { icon: '💪', name: 'Workaholic', desc: 'Complete 100 total hours' }
    };
    
    // ====================================
    // IMAGE BOX VARIABLES
    // ====================================
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
        gameModeHidden: true // true = Game Mode ON (panels visible); false = Game Mode OFF (panels hidden, widget shrinks)
    };
    
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
                lastAttendanceDate: data.lastAttendanceDate || null,
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
            lastAttendanceDate: null,
            longestStreak: 0,
            achievements: [],
            milestonesReached: []
        };
    }
    
    function saveUserXP(xpData) {
        localStorage.setItem('userXP', JSON.stringify(xpData));
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


    // ====================================
    // ====================================
    // BREAKOUT GAME LOGIC  (with powerups)
    // ====================================
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
    const BRK_BASE_SPEED = 3.8;

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
        const spd   = BRK_BASE_SPEED + breakoutLevel*0.3;
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
        breakoutAnimFrame = requestAnimationFrame(breakoutLoop);
        // click to release sticky ball
        breakoutCanvas.addEventListener('click', brkHandleClick);
    }

    function breakoutLoop() {
        if (!breakoutGameRunning) return;
        updateBreakout();
        drawBreakoutFrame();
        breakoutAnimFrame = requestAnimationFrame(breakoutLoop);
    }

    function brkHandleClick() {
        // Release sticky ball on click
        if (brkPU.stuckBallIdx >= 0 && brkPU.stuckBallIdx < breakoutBalls.length && breakoutBalls[brkPU.stuckBallIdx]) {
            const b = breakoutBalls[brkPU.stuckBallIdx];
            if (b.stuck) {
                b.stuck = false;
                const spd = BRK_BASE_SPEED + breakoutLevel*0.3;
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
                breakoutBalls.forEach(b => brkSetSpeed(b, (BRK_BASE_SPEED + breakoutLevel*0.3)*0.58));
                break;
            case 'fast':
                brkPU.fastTimer = pu.dur; brkPU.slowTimer = 0;
                breakoutBalls.forEach(b => brkSetSpeed(b, (BRK_BASE_SPEED + breakoutLevel*0.3)*1.55));
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
            const normalSpeed = BRK_BASE_SPEED + breakoutLevel * 0.3;
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
    // SNAKE GAME LOGIC
    // ====================================
    
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

    // rAF render loop — runs at ~60fps, interpolates between logic ticks
    function snakeRenderLoop(timestamp) {
        if (!snakeGameRunning) return;

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

        // t: 0 = just ticked, 1 = about to tick. Clamp so we never overshoot.
        const t = Math.min(1, snakeAccumulatorMs / snakeTickInterval);
        drawSnakeGame(t);
        snakeAnimFrame = requestAnimationFrame(snakeRenderLoop);
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
    
    // ====================================
    // REFLEX GAME LOGIC
    // ====================================
    
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
    
    function handleReflexClick(event) {
        if (!reflexGameStarted || reflexGameFinished) return;
        
        // FALSE START detection
        if (reflexIsWaiting) {
            reflexFalseStarts++;
            if (reflexTimeoutRef) clearTimeout(reflexTimeoutRef);
            updateReflexDisplay();
            setTimeout(() => startReflexRound(reflexCurrentRound), 500);
            return;
        }
        
        if (!reflexCanClick) return;
        
        // Calculate reaction time
        const reactionTime = Date.now() - reflexStartTime;
        
        // TARGET MODE: Check if clicked on target
        if (reflexGameModes[reflexMode].targets && reflexShowTarget) {
            const rect = gameAreaElement.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;
            
            // Distance formula
            const distance = Math.sqrt(
                Math.pow(clickX - reflexTargetPosition.x, 2) +
                Math.pow(clickY - reflexTargetPosition.y, 2)
            );
            
            // Target radius is 30px
            if (distance > 30) {
                // Missed target, restart round
                reflexCanClick = false;
                reflexShowTarget = false;
                updateReflexDisplay();
                setTimeout(() => startReflexRound(reflexCurrentRound), 500);
                return;
            }
        }
        
        // SUCCESSFUL REACTION
        reflexReactionTimes.push(reactionTime);
        reflexCanClick = false;
        reflexShowTarget = false;
        
        updateReflexDisplay();
        
        // Start next round after brief delay
        setTimeout(() => {
            startReflexRound();
        }, 300);
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
        }
        
        // Award XP based on performance
        awardGameXP('reflex', { avgTime, bestTime, falseStarts: reflexFalseStarts });
        
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
        const currentModeBest = highScores[reflexMode]?.best || 0;
        const screenBest = highScores.screen?.best || 0;
        const targetBest = highScores.target?.best || 0;
        
        highScoreElement.innerHTML = `
            <div style="font-size: 0.875rem; color: #a78bfa;">
                <div><strong>🏆 High Scores</strong></div>
                <div style="margin-top: 4px;">⚡ Screen: ${screenBest}ms</div>
                <div>🎯 Target: ${targetBest}ms</div>
                <div style="margin-top: 4px; color: #10b981;">Current: ${currentModeBest}ms</div>
            </div>
        `;
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
    
    // ====================================
    // AIM TRAINER CHAOS MODE LOGIC
    // ====================================
    
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
        }
        
        // Award XP based on score
        awardGameXP('aim', { score: aimScore, accuracy: aimAccuracy, hits: aimHits });
        
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
        highScoreElement.innerHTML = `
            <div style="font-size: 0.875rem; color: #f59e0b;">
                <div><strong>🏆 High Score</strong></div>
                <div style="margin-top: 4px; font-size: 1.2rem; color: #ef4444;">${highScore}</div>
            </div>
        `;
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
    
    // ====================================
    // FLAPPY BIRD GAME LOGIC
    // ====================================
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
        flappyLoop();
    }

    function flappyLoop() {
        if (!flappyGameRunning) return;
        updateFlappy();
        drawFlappyFrame();
        flappyAnimFrame = requestAnimationFrame(flappyLoop);
    }

    function flappyCurrentSpeed() {
        // +0.18 per pipe, cap 5.5
        return Math.min(5.5, FLAPPY_PIPE_SPEED_BASE + flappyScore * 0.18);
    }
    function flappyCurrentGap() {
        // Narrows 4px per pipe cleared, floor 78px
        return Math.max(78, FLAPPY_PIPE_GAP_BASE - flappyScore * 4);
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

    // ====================================
    // TETRIS GAME LOGIC
    // ====================================
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
        tetrisLoop();
    }

    function spawnTetrisPiece() {
        const p = TETRIS_PIECES[Math.floor(Math.random() * TETRIS_PIECES.length)];
        return {
            shape: p.shape.map(r => [...r]),
            color: p.color,
            x: Math.floor((TETRIS_COLS - p.shape[0].length) / 2),
            y: 0
        };
    }

    function tetrisLoop(now) {
        if (!tetrisGameRunning) return;
        const dropInterval = Math.max(80, 600 - (tetrisLevel - 1) * 55);
        if (now - tetrisLastDrop >= dropInterval) {
            if (!moveTetris(0, 1)) lockTetrisPiece();
            tetrisLastDrop = now;
        }
        drawTetrisFrame();
        tetrisAnimFrame = requestAnimationFrame(tetrisLoop);
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

    // ====================================
    // GAME SWITCHING SYSTEM
    // ====================================
    
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
                initSnakeGame();
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
        }
    }
    
    function initCurrentGame() {
        const snakeCv = document.getElementById('snake-canvas');
        const flappyCv = document.getElementById('flappy-canvas');
        const tetrisCv = document.getElementById('tetris-canvas');
        const gameArea = document.getElementById('multi-game-area');
        // Hide all first
        const breakoutCv = document.getElementById('breakout-canvas');
        [snakeCv, flappyCv, tetrisCv, breakoutCv].forEach(c => { if (c) c.style.display = 'none'; });
        if (gameArea) gameArea.style.display = 'none';

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
        }
    }
    
    function updateGameSwitcher() {
        const ids = ['snake', 'reflex', 'aim', 'flappy', 'tetris', 'breakout'];
        ids.forEach(id => {
            const btn = document.getElementById('game-switch-' + id);
            if (btn) btn.classList.toggle('active', currentGame === id);
        });
    }
    
    function updateGameControls() {
        const ctrlIds = ['snake-controls', 'reflex-controls', 'aim-controls', 'flappy-controls', 'tetris-controls', 'breakout-controls'];
        const statIds = ['snake-scoreboard', 'reflex-stats', 'aim-stats', 'flappy-scoreboard', 'tetris-scoreboard', 'breakout-scoreboard'];
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
                break;
            case 'aim':
                { const c = document.getElementById('aim-controls'); if (c) c.style.display = 'flex'; }
                { const s = document.getElementById('aim-stats'); if (s) s.style.display = 'block'; }
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
        }
    }
    
    // ====================================
    // QUOTES SYSTEM LOGIC
    // ====================================
    
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
    }
    
    // ====================================
    // XP SYSTEM LOGIC
    // ====================================
    
    function initXPSystem() {
        userXP = loadUserXP();
        updateXPDisplay();
    }
    
    function calculateXPForNextLevel(level) {
        // Exponential growth (Lee Sheldon method): XP needed = level^1.5 * 120
        return Math.floor(Math.pow(level, 1.5) * 120);
    }
    
    function awardXP(hoursWorked) {
        const currentHour = Math.floor(hoursWorked);
        
        // Calculate and update streak
        calculateStreak();
        
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
            const hoursToAward = currentHour - userXP.lastHourTracked;
            const xpGained = hoursToAward * XP_PER_HOUR;
            
            userXP.currentXP += xpGained;
            userXP.totalXP += xpGained;
            userXP.lastHourTracked = currentHour;
            userXP.todayHours += hoursToAward;
            
            // Show hourly XP notification
            if (hoursToAward > 0) {
                showXPNotification(`+${xpGained} XP for ${hoursToAward} hour(s)!`, 'hourly');
            }
            
            // Check for milestone bonuses
            checkMilestones(currentHour);
            
            // Award streak bonus (daily)
            if (userXP.consecutiveDays > 1 && lastDay !== today) {
                const streakBonus = STREAK_BONUS * userXP.consecutiveDays;
                userXP.currentXP += streakBonus;
                userXP.totalXP += streakBonus;
                showXPNotification(`🔥 ${userXP.consecutiveDays}-Day Streak! +${streakBonus} Bonus XP!`, 'streak');
            }
            
            // Check for level up
            checkLevelUp();
            
            // Check for achievements
            checkAchievements();
            
            saveUserXP(userXP);
            updateXPDisplay();
        }
    }
    
    function calculateStreak() {
        const today = new Date().toDateString();
        
        if (!userXP.lastAttendanceDate) {
            // First time
            userXP.consecutiveDays = 1;
            userXP.lastAttendanceDate = today;
            return;
        }
        
        const lastDate = new Date(userXP.lastAttendanceDate);
        const currentDate = new Date(today);
        const diffTime = currentDate - lastDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // Consecutive day
            userXP.consecutiveDays++;
            if (userXP.consecutiveDays > userXP.longestStreak) {
                userXP.longestStreak = userXP.consecutiveDays;
            }
        } else if (diffDays > 1) {
            // Streak broken
            userXP.consecutiveDays = 1;
        }
        // diffDays === 0 means same day, no change needed
        
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
    
    function checkAchievements() {
        const totalHours = Math.floor(userXP.totalXP / XP_PER_HOUR);
        
        // First Day achievement
        if (!userXP.achievements.includes('firstDay') && userXP.todayHours >= 8) {
            unlockAchievement('firstDay');
        }
        
        // Week Warrior (5 consecutive days)
        if (!userXP.achievements.includes('week1') && userXP.consecutiveDays >= 5) {
            unlockAchievement('week1');
        }
        
        // 7-Day Streak
        if (!userXP.achievements.includes('streak7') && userXP.consecutiveDays >= 7) {
            unlockAchievement('streak7');
        }
        
        // 30-Day Streak
        if (!userXP.achievements.includes('streak30') && userXP.consecutiveDays >= 30) {
            unlockAchievement('streak30');
        }
        
        // Level 10
        if (!userXP.achievements.includes('level10') && userXP.level >= 10) {
            unlockAchievement('level10');
        }
        
        // Level 25
        if (!userXP.achievements.includes('level25') && userXP.level >= 25) {
            unlockAchievement('level25');
        }
        
        // Workaholic (100 hours)
        if (!userXP.achievements.includes('workaholic') && totalHours >= 100) {
            unlockAchievement('workaholic');
        }
    }
    
    function unlockAchievement(achievementKey) {
        userXP.achievements.push(achievementKey);
        const achievement = ACHIEVEMENTS[achievementKey];
        showXPNotification(`${achievement.icon} Achievement Unlocked: ${achievement.name}!`, 'achievement');
        saveUserXP(userXP);
    }
    
    function checkLevelUp() {
        const xpNeeded = calculateXPForNextLevel(userXP.level);
        
        while (userXP.currentXP >= xpNeeded) {
            userXP.currentXP -= xpNeeded;
            userXP.level++;
            
            showXPNotification(`🎊 Level Up! You're now Level ${userXP.level}!`, 'levelup');
            
            // Recalculate for next level
            const nextXPNeeded = calculateXPForNextLevel(userXP.level);
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
        
        // Update achievements display
        if (achievementsContainer) {
            achievementsContainer.innerHTML = '';
            userXP.achievements.forEach(key => {
                const achievement = ACHIEVEMENTS[key];
                const badge = document.createElement('span');
                badge.className = 'achievement-badge';
                badge.innerHTML = achievement.icon;
                badge.title = `${achievement.name}: ${achievement.desc}`;
                achievementsContainer.appendChild(badge);
            });
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
            case 'snake':
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
                
            case 'flappy':
                // Award XP based on pipes cleared
                const flappyScore = performance.score || 0;
                if (flappyScore >= 20) {
                    xpGained = 70;
                } else if (flappyScore >= 10) {
                    xpGained = 45;
                } else if (flappyScore >= 5) {
                    xpGained = 25;
                } else if (flappyScore >= 1) {
                    xpGained = 10;
                } else {
                    xpGained = 3;
                }
                if (performance.isHighScore) xpGained += 20;
                message = `🐦 +${xpGained} XP (Flappy: ${flappyScore} pipes${performance.isHighScore ? ' 🏆 New Record!' : ''})`;
                break;
                
            case 'tetris':
                // Award XP based on lines cleared and level reached
                const tetrisLines = performance.lines || 0;
                const tetrisLevel = performance.level || 1;
                if (tetrisLines >= 40) {
                    xpGained = 100;
                } else if (tetrisLines >= 20) {
                    xpGained = 65;
                } else if (tetrisLines >= 10) {
                    xpGained = 40;
                } else if (tetrisLines >= 4) {
                    xpGained = 20;
                } else if (tetrisLines >= 1) {
                    xpGained = 10;
                } else {
                    xpGained = 3;
                }
                xpGained += Math.min(tetrisLevel * 5, 25); // Level bonus
                if (performance.isHighScore) xpGained += 25;
                message = `🧱 +${xpGained} XP (Tetris: ${tetrisLines} lines, Lvl ${tetrisLevel}${performance.isHighScore ? ' 🏆!' : ''})`;
                break;
                
            case 'reflex':
                // Award XP based on reaction time (faster = more XP)
                // Max 50 XP for avg time under 200ms
                const avgTime = performance.avgTime;
                if (avgTime < 200) {
                    xpGained = 50;
                } else if (avgTime < 250) {
                    xpGained = 40;
                } else if (avgTime < 300) {
                    xpGained = 30;
                } else if (avgTime < 400) {
                    xpGained = 20;
                } else {
                    xpGained = 10;
                }
                
                // Deduct for false starts
                xpGained = Math.max(5, xpGained - (performance.falseStarts * 5));
                
                message = `⚡ ${xpGained} XP for ${avgTime}ms avg reaction!`;
                break;
                
            case 'aim':
                // Award XP based on score (higher score = more XP)
                // Max 75 XP for score > 300
                const score = performance.score;
                if (score >= 300) {
                    xpGained = 75;
                } else if (score >= 250) {
                    xpGained = 60;
                } else if (score >= 200) {
                    xpGained = 45;
                } else if (score >= 150) {
                    xpGained = 30;
                } else if (score >= 100) {
                    xpGained = 20;
                } else {
                    xpGained = 10;
                }
                
                // Bonus for accuracy
                if (performance.accuracy >= 80) {
                    xpGained += 10;
                    message = `💥 ${xpGained} XP (${score} pts + accuracy bonus)!`;
                } else {
                    message = `💥 ${xpGained} XP for ${score} points!`;
                }
                break;
        }
        
        // Apply XP gain
        if (xpGained > 0) {
            userXP.currentXP += xpGained;
            userXP.totalXP += xpGained;
            
            // Check for level up
            checkLevelUp();
            
            saveUserXP(userXP);
            updateXPDisplay();
            showXPNotification(message, 'game');
        }
    }
    
    // ====================================
    // IMAGE BOX LOGIC
    // ====================================
    
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
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 24px;
                box-shadow: 
                    0 8px 32px rgba(0, 0, 0, 0.1),
                    0 1px 2px rgba(0, 0, 0, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1),
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
                transform: scale(0.75);
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
                background: rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
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
                background: rgba(0, 0, 0, 0.92);
                color: white;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 0.75rem;
                font-weight: 500;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                min-width: 180px;
                text-align: center;
                z-index: 1001;
                backdrop-filter: blur(8px);
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
                border-top-color: rgba(0, 0, 0, 0.92);
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
                
                /* Retro-Futuristic Theme for PiP */
                .pip-window-content.retro-theme {
                    background: linear-gradient(135deg, var(--retro-dark) 0%, var(--retro-dark-alt) 100%) !important;
                    color: var(--neon-cyan) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }
                
                .pip-window-content.retro-theme::before {
                    content: '' !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    background: repeating-linear-gradient(
                        0deg,
                        rgba(0, 240, 255, 0.02) 0px,
                        transparent 1px,
                        transparent 2px,
                        rgba(0, 240, 255, 0.02) 3px
                    ) !important;
                    animation: scanlines 8s linear infinite !important;
                    pointer-events: none !important;
                    z-index: 0 !important;
                }
                
                .pip-window-content.retro-theme .modern-table {
                    background: rgba(0, 0, 0, 0.5) !important;
                    box-shadow: 
                        0 0 10px rgba(0, 240, 255, 0.3),
                        inset 0 0 20px rgba(0, 240, 255, 0.05) !important;
                    border: 1px solid rgba(0, 240, 255, 0.2) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }
                
                .pip-window-content.retro-theme .modern-table td {
                    color: rgba(0, 240, 255, 0.9) !important;
                    font-family: 'Share Tech Mono', monospace !important;
                    border-bottom: 1px solid rgba(0, 240, 255, 0.15) !important;
                }
                
                .pip-window-content.retro-theme .stat-card {
                    background: rgba(0, 0, 0, 0.6) !important;
                    border: 1px solid var(--neon-cyan) !important;
                    box-shadow: 
                        0 0 10px var(--neon-cyan),
                        inset 0 0 10px rgba(0, 240, 255, 0.1) !important;
                    position: relative !important;
                    z-index: 1 !important;
                    animation: neonPulse 4s ease-in-out infinite !important;
                }
                
                .pip-window-content.retro-theme .stat-card.worked-time-card {
                    border-color: var(--neon-cyan) !important;
                    box-shadow: 
                        0 0 15px var(--neon-cyan),
                        inset 0 0 15px rgba(0, 240, 255, 0.15) !important;
                }
                
                .pip-window-content.retro-theme .stat-card.remaining-time-card {
                    border-color: var(--neon-magenta) !important;
                    box-shadow: 
                        0 0 15px var(--neon-magenta),
                        inset 0 0 15px rgba(255, 0, 255, 0.15) !important;
                }
                
                .pip-window-content.retro-theme .stat-card.completion-time-card {
                    border-color: var(--neon-green) !important;
                    box-shadow: 
                        0 0 15px var(--neon-green),
                        inset 0 0 15px rgba(0, 255, 65, 0.15) !important;
                }
                
                .pip-window-content.retro-theme .stat-label {
                    color: rgba(0, 240, 255, 0.7) !important;
                    font-family: 'Orbitron', sans-serif !important;
                    text-shadow: 0 0 5px var(--neon-cyan) !important;
                }
                
                .pip-window-content.retro-theme .stat-value {
                    font-family: 'Share Tech Mono', monospace !important;
                    text-shadow: 0 0 10px currentColor !important;
                }
                
                .pip-window-content.retro-theme .worked-time {
                    color: var(--neon-cyan) !important;
                    text-shadow: 0 0 15px var(--neon-cyan) !important;
                }
                
                .pip-window-content.retro-theme .remaining-time {
                    color: var(--neon-magenta) !important;
                    text-shadow: 0 0 15px var(--neon-magenta) !important;
                }
                
                .pip-window-content.retro-theme .completion-time {
                    color: var(--neon-green) !important;
                    text-shadow: 0 0 15px var(--neon-green) !important;
                }
                
                .pip-window-content.retro-theme .progress-bar {
                    background: rgba(0, 0, 0, 0.5) !important;
                    border: 1px solid rgba(0, 240, 255, 0.3) !important;
                    box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.2) !important;
                }
                
                .pip-window-content.retro-theme .progress-fill {
                    background: linear-gradient(
                        90deg,
                        var(--neon-cyan),
                        var(--neon-magenta),
                        var(--neon-green),
                        var(--neon-cyan)
                    ) !important;
                    box-shadow: 
                        0 0 10px var(--neon-cyan),
                        0 0 20px rgba(0, 240, 255, 0.5) !important;
                }
                
                .pip-window-content.retro-theme .pip-compact-button {
                    background: rgba(0, 0, 0, 0.8) !important;
                    color: var(--neon-cyan) !important;
                    border: 1px solid var(--neon-cyan) !important;
                    box-shadow: 0 0 5px var(--neon-cyan) !important;
                    font-family: 'Orbitron', sans-serif !important;
                }
                
                .pip-window-content.retro-theme .pip-compact-button:hover {
                    background: rgba(0, 240, 255, 0.2) !important;
                    color: white !important;
                    box-shadow: 0 0 15px var(--neon-cyan) !important;
                }
                
                .pip-window-content.retro-theme .summary-title {
                    font-family: 'Orbitron', sans-serif !important;
                    color: var(--neon-cyan) !important;
                    text-shadow: 
                        0 0 10px var(--neon-cyan),
                        0 0 20px var(--neon-cyan),
                        0 0 30px rgba(0, 240, 255, 0.5) !important;
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
                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.worked-time-card {\n                    background: linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(0, 184, 148, 0.08)) !important;\n                    border-color: rgba(0, 184, 148, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.remaining-time-card {\n                    background: linear-gradient(135deg, rgba(225, 112, 85, 0.15), rgba(225, 112, 85, 0.08)) !important;\n                    border-color: rgba(225, 112, 85, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.completion-time-card {\n                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(108, 92, 231, 0.08)) !important;\n                    border-color: rgba(108, 92, 231, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-label {\n                    color: rgba(0, 0, 0, 0.6) !important;\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-value {\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .progress-bar {\n                    background: rgba(0, 0, 0, 0.1) !important;\n                    border: none !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .pip-compact-button {\n                    background: rgba(0, 0, 0, 0.1) !important;\n                    color: rgba(0, 0, 0, 0.7) !important;\n                    border: 1px solid rgba(0, 0, 0, 0.1) !important;\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .pip-compact-button:hover {\n                    background: rgba(108, 92, 231, 0.8) !important;\n                    color: white !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .summary-title {\n                    font-family: 'Inter', sans-serif !important;\n                    background: linear-gradient(135deg, #667eea, #764ba2) !important;\n                    -webkit-background-clip: text !important;\n                    -webkit-text-fill-color: transparent !important;\n                }\n                \n                /* Retro-Futuristic Theme for PiP */\n                .pip-window-content.retro-theme {\n                    background: linear-gradient(135deg, #1a1d3a 0%, #2a2d4a 100%) !important;\n                    color: var(--neon-cyan) !important;\n                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;\n                    position: relative !important;\n                    overflow: hidden !important;\n                }\n                \n                .pip-window-content.retro-theme::before {\n                    content: '' !important;\n                    position: absolute !important;\n                    top: 0 !important;\n                    left: 0 !important;\n                    right: 0 !important;\n                    bottom: 0 !important;\n                    background: repeating-linear-gradient(\n                        0deg,\n                        rgba(0, 240, 255, 0.02) 0px,\n                        transparent 1px,\n                        transparent 2px,\n                        rgba(0, 240, 255, 0.02) 3px\n                    ) !important;\n                    animation: scanlines 8s linear infinite !important;\n                    pointer-events: none !important;\n                    z-index: 0 !important;\n                }\n                \n                .pip-window-content.retro-theme .modern-table {\n                    background: rgba(0, 0, 0, 0.6) !important;\n                    box-shadow: \n                        0 0 10px rgba(0, 240, 255, 0.3),\n                        inset 0 0 20px rgba(0, 240, 255, 0.05) !important;\n                    border: 1px solid rgba(0, 240, 255, 0.3) !important;\n                    position: relative !important;\n                    z-index: 1 !important;\n                }\n                \n                .pip-window-content.retro-theme .modern-table td {\n                    color: rgba(0, 240, 255, 0.95) !important;\n                    font-family: 'Share Tech Mono', monospace !important;\n                    border-bottom: 1px solid rgba(0, 240, 255, 0.2) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-card {\n                    background: rgba(0, 0, 0, 0.7) !important;\n                    border: 1px solid var(--neon-cyan) !important;\n                    box-shadow: \n                        0 0 10px var(--neon-cyan),\n                        inset 0 0 10px rgba(0, 240, 255, 0.1) !important;\n                    position: relative !important;\n                    z-index: 1 !important;\n                    animation: neonPulse 4s ease-in-out infinite !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-card.worked-time-card {\n                    border-color: var(--neon-cyan) !important;\n                    box-shadow: \n                        0 0 15px var(--neon-cyan),\n                        inset 0 0 15px rgba(0, 240, 255, 0.15) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-card.remaining-time-card {\n                    border-color: var(--neon-magenta) !important;\n                    box-shadow: \n                        0 0 15px var(--neon-magenta),\n                        inset 0 0 15px rgba(255, 0, 255, 0.15) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-card.completion-time-card {\n                    border-color: var(--neon-green) !important;\n                    box-shadow: \n                        0 0 15px var(--neon-green),\n                        inset 0 0 15px rgba(0, 255, 65, 0.15) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-label {\n                    color: rgba(0, 240, 255, 0.8) !important;\n                    font-family: 'Orbitron', sans-serif !important;\n                    text-shadow: 0 0 5px var(--neon-cyan) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-value {\n                    font-family: 'Share Tech Mono', monospace !important;\n                    text-shadow: 0 0 10px currentColor !important;\n                }\n                \n                .pip-window-content.retro-theme .worked-time {\n                    color: var(--neon-cyan) !important;\n                    text-shadow: 0 0 15px var(--neon-cyan) !important;\n                }\n                \n                .pip-window-content.retro-theme .remaining-time {\n                    color: var(--neon-magenta) !important;\n                    text-shadow: 0 0 15px var(--neon-magenta) !important;\n                }\n                \n                .pip-window-content.retro-theme .completion-time {\n                    color: var(--neon-green) !important;\n                    text-shadow: 0 0 15px var(--neon-green) !important;\n                }\n                \n                .pip-window-content.retro-theme .progress-bar {\n                    background: rgba(0, 0, 0, 0.5) !important;\n                    border: 1px solid rgba(0, 240, 255, 0.3) !important;\n                    box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.2) !important;\n                }\n                \n                .pip-window-content.retro-theme .progress-fill {\n                    background: linear-gradient(\n                        90deg,\n                        var(--neon-cyan),\n                        var(--neon-magenta),\n                        var(--neon-green),\n                        var(--neon-cyan)\n                    ) !important;\n                    box-shadow: \n                        0 0 10px var(--neon-cyan),\n                        0 0 20px rgba(0, 240, 255, 0.5) !important;\n                }\n                \n                .pip-window-content.retro-theme .pip-compact-button {\n                    background: rgba(0, 0, 0, 0.9) !important;\n                    color: var(--neon-cyan) !important;\n                    border: 1px solid var(--neon-cyan) !important;\n                    box-shadow: 0 0 5px var(--neon-cyan) !important;\n                    font-family: 'Orbitron', sans-serif !important;\n                }\n                \n                .pip-window-content.retro-theme .pip-compact-button:hover {\n                    background: rgba(0, 240, 255, 0.3) !important;\n                    color: white !important;\n                    box-shadow: 0 0 15px var(--neon-cyan) !important;\n                }\n                \n                .pip-window-content.retro-theme .summary-title {\n                    font-family: 'Orbitron', sans-serif !important;\n                    color: var(--neon-cyan) !important;\n                    text-shadow: \n                        0 0 10px var(--neon-cyan),\n                        0 0 20px var(--neon-cyan),\n                        0 0 30px rgba(0, 240, 255, 0.5) !important;\n                }\n                \n                .pip-window-content .gap-warning {\n                    background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;\n                    color: #2d3436 !important;\n                }\n            }
            
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
            }
            
            /* Compact mode - Glassmorphic Aurora theme */
            .compact-mode:not(.retro-theme) .pip-compact-display {
                text-align: center !important;
                background: rgba(255, 255, 255, 0.15) !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                border-radius: 0px 0px 5px 5px !important;
                padding: 20px 24px !important;
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
                font-size: 1.6rem !important;
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
                font-size: 0.75rem !important;
                font-weight: 500 !important;
                color: rgba(102, 126, 234, 0.8) !important;
                text-transform: uppercase !important;
                letter-spacing: 0.1em !important;
                position: relative !important;
                z-index: 1 !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-emoji {
                font-size: 1.5rem !important;
                margin-left: 12px !important;
                display: inline-block !important;
                filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3)) !important;
                animation: emojiPulse 2s ease-in-out infinite !important;
                position: relative !important;
                z-index: 1 !important;
            }
            
            /* Compact mode - Retro-Futuristic theme */
            .compact-mode.retro-theme .pip-compact-display {
                text-align: center !important;
                background: linear-gradient(135deg, var(--retro-dark) 0%, var(--retro-dark-alt) 100%) !important;
                border: 2px solid rgba(0, 240, 255, 0.4) !important;
                border-radius: 0 !important;
                padding: 16px 20px !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                box-shadow: 
                    0 0 20px rgba(0, 240, 255, 0.6),
                    0 0 40px rgba(255, 0, 255, 0.5),
                    0 0 60px rgba(0, 255, 65, 0.4),
                    inset 0 0 30px rgba(0, 240, 255, 0.2),
                    inset 0 0 20px rgba(255, 0, 255, 0.15) !important;
                transition: all 0.3s ease !important;
                cursor: pointer !important;
                position: relative !important;
                overflow: hidden !important;
                animation: neonGlowPulse 3s ease-in-out infinite !important;
            }
            
            .compact-mode.retro-theme .pip-compact-display::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: linear-gradient(
                    90deg,
                    rgba(0, 240, 255, 0.3),
                    rgba(255, 0, 255, 0.3),
                    rgba(0, 255, 65, 0.3),
                    rgba(0, 240, 255, 0.3)
                ) !important;
                background-size: 300% 100% !important;
                animation: rgbFlowBacklight 6s ease-in-out infinite !important;
                pointer-events: none !important;
                z-index: 0 !important;
                opacity: 1 !important;
                mix-blend-mode: screen !important;
            }
            
            .compact-mode.retro-theme .pip-compact-display:hover {
                transform: scale(1.02) !important;
                box-shadow: 
                    inset 0 0 30px rgba(0, 240, 255, 0.2),
                    0 0 40px rgba(0, 240, 255, 0.5),
                    0 0 15px rgba(255, 0, 255, 0.3) !important;
            }
            
            .compact-mode.retro-theme .pip-compact-time {
                font-family: 'Share Tech Mono', 'Orbitron', monospace !important;
                font-size: 1.5rem !important;
                font-weight: 700 !important;
                color: var(--neon-cyan) !important;
                margin: 10px 0px 0px 0px !important;
                line-height: 0.2 !important;
                text-shadow: 
                    0 0 10px var(--neon-cyan),
                    0 0 20px var(--neon-cyan),
                    0 0 30px rgba(0, 240, 255, 0.5) !important;
                letter-spacing: 0.1em !important;
                position: relative !important;
                z-index: 2 !important;
                animation: glitchText 3s ease-in-out infinite !important;
            }
            
            .compact-mode.retro-theme .pip-compact-label {
                font-family: 'Orbitron', sans-serif !important;
                font-size: 0.65rem !important;
                font-weight: 600 !important;
                color: var(--neon-magenta) !important;
                margin: 8px 0 0 0 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.2em !important;
                text-shadow: 
                    0 0 5px var(--neon-magenta),
                    0 0 10px rgba(255, 0, 255, 0.5) !important;
                position: relative !important;
                z-index: 2 !important;
            }
            
            .compact-mode.retro-theme .pip-compact-emoji {
                font-size: 1rem !important;
                margin-left: 12px !important;
                display: inline-block !important;
                filter: drop-shadow(0 0 8px var(--neon-cyan)) !important;
                animation: emojiPulse 2s ease-in-out infinite !important;
                position: relative !important;
                z-index: 2 !important;
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
                }
                
                .pip-button {
                    padding: 10px 16px;
                    font-size: 0.75rem;
                }
            }
            
            /* Dark mode enhancements */
            @media (prefers-color-scheme: dark) {
                .attendance-summary {
                    background: linear-gradient(135deg, rgba(30, 30, 30, 0.9), rgba(20, 20, 20, 0.8));
                    border-color: rgba(255, 255, 255, 0.15);
                    color: rgba(255, 255, 255, 0.9);
                }
                
                .modern-table {
                    background: rgba(0, 0, 0, 0.2);
                }
                
                .stat-card {
                    background: rgba(0, 0, 0, 0.3);
                    border-color: rgba(255, 255, 255, 0.1);
                }
                
                .modern-table td {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .stat-label {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .stat-card:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border-color: rgba(255, 255, 255, 0.25);
                }
                
                .attendance-summary:hover {
                    box-shadow: 
                        0 16px 48px rgba(0, 0, 0, 0.2),
                        0 4px 12px rgba(0, 0, 0, 0.15),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
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
                .attendance-summary {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 240, 240, 0.9));
                    border-color: rgba(0, 0, 0, 0.1);
                    color: rgba(0, 0, 0, 0.9);
                    box-shadow: 
                        0 8px 32px rgba(0, 0, 0, 0.15),
                        0 1px 2px rgba(0, 0, 0, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.8);
                }
                
                .attendance-summary::before {
                    background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent);
                }
                
                .modern-table {
                    background: rgba(255, 255, 255, 0.8);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                }
                
                .modern-table td {
                    color: rgba(0, 0, 0, 0.8);
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                }
                
                .stat-card {
                    background: rgba(255, 255, 255, 0.7);
                    border-color: rgba(0, 0, 0, 0.1);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                
                .stat-card.worked-time-card {
                    background: linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(0, 184, 148, 0.05));
                    border-color: rgba(0, 184, 148, 0.3);
                }
                
                .stat-card.remaining-time-card {
                    background: linear-gradient(135deg, rgba(225, 112, 85, 0.15), rgba(225, 112, 85, 0.05));
                    border-color: rgba(225, 112, 85, 0.3);
                }
                
                .stat-card.completion-time-card {
                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(108, 92, 231, 0.05));
                    border-color: rgba(108, 92, 231, 0.3);
                }
                
                .stat-label {
                    color: rgba(0, 0, 0, 0.6);
                }
                
                .developer-info {
                    background: rgba(255, 255, 255, 0.8);
                    border-color: rgba(0, 0, 0, 0.1);
                    color: #667eea;
                }
                
                .developer-info:hover {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(0, 0, 0, 0.2);
                }
                
                .progress-bar {
                    background: rgba(0, 0, 0, 0.1);
                }
                
                .gap-warning {
                    background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;
                    color: #2d3436 !important;
                }
                
                .stat-card:hover {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(0, 0, 0, 0.2);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                }
                
                .attendance-summary:hover {
                    box-shadow: 
                        0 16px 48px rgba(0, 0, 0, 0.2),
                        0 4px 12px rgba(0, 0, 0, 0.15),
                        inset 0 1px 0 rgba(255, 255, 255, 0.9);
                }
                
                .pip-placeholder {
                    color: rgba(0, 0, 0, 0.7);
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
                
                /* Fix glassmorphic containers for light mode */
                .snake-game-container,
                .quotes-container,
                .image-box-container {
                    background: rgba(255, 255, 255, 0.8);
                    border-color: rgba(0, 0, 0, 0.1);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                }
                
                .xp-container {
                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.12), rgba(102, 126, 234, 0.08));
                    border-color: rgba(108, 92, 231, 0.25);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 4px 16px rgba(108, 92, 231, 0.15);
                }
                
                .snake-game-title,
                .quotes-title,
                .xp-title {
                    color: rgba(0, 0, 0, 0.85);
                }
                
                .snake-score,
                .quote-text,
                .xp-stat-label {
                    color: rgba(0, 0, 0, 0.65);
                }
                
                .snake-canvas {
                    background: rgba(0, 0, 0, 0.05);
                }
                
                .quote-add-btn,
                .image-change-btn {
                    background: rgba(0, 0, 0, 0.08);
                    border-color: rgba(0, 0, 0, 0.15);
                    color: rgba(0, 0, 0, 0.8);
                }
                
                .quote-add-btn:hover,
                .image-change-btn:hover {
                    background: rgba(0, 0, 0, 0.12);
                }
                
                .aspect-ratio-btn {
                    background: rgba(0, 0, 0, 0.08);
                    border-color: rgba(0, 0, 0, 0.15);
                    color: rgba(0, 0, 0, 0.8);
                }
                
                .aspect-ratio-btn:hover {
                    background: rgba(0, 0, 0, 0.12);
                }
                
                .aspect-ratio-btn.active {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-color: #667eea;
                    color: white;
                }
                
                .xp-stat-item {
                    background: rgba(0, 0, 0, 0.05);
                }
                
                .xp-progress-bar {
                    background: rgba(0, 0, 0, 0.1);
                }
                
                .settings-button {
                    background: rgba(255, 255, 255, 0.8);
                    border-color: rgba(0, 0, 0, 0.1);
                    color: #764ba2;
                }
                
                .settings-button:hover {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(0, 0, 0, 0.2);
                }
                
                .image-placeholder {
                    color: rgba(0, 0, 0, 0.4);
                }
            }
            /* Retro theme specific styles for main display */
            .attendance-summary.retro-theme {
                background: linear-gradient(135deg, var(--retro-dark) 0%, var(--retro-dark-alt) 100%) !important;
                color: var(--neon-cyan) !important;
                border: 1px solid var(--neon-cyan) !important;
                border-radius: 0px 0px 8px 8px !important;            
                box-shadow: 
                    0 0 20px rgba(0, 240, 255, 0.3),
                    inset 0 0 30px rgba(0, 240, 255, 0.05) !important;
                position: relative;
                overflow: hidden;
            }
            
            .attendance-summary.retro-theme::before {
                background: linear-gradient(
                    90deg,
                    transparent,
                    var(--neon-cyan),
                    var(--neon-magenta),
                    var(--neon-green),
                    transparent
                ) !important;
                background-size: 200% 100% !important;
                animation: rgbFlowBacklight 4s ease-in-out infinite !important;
                z-index: 2;
            }
            
            .attendance-summary.retro-theme::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: repeating-linear-gradient(
                    0deg,
                    rgba(0, 240, 255, 0.03) 0px,
                    transparent 1px,
                    transparent 2px,
                    rgba(0, 240, 255, 0.03) 3px
                );
                animation: scanlines 8s linear infinite;
                pointer-events: none;
                z-index: 0;
            }
            
            .attendance-summary.retro-theme .summary-header,
            .attendance-summary.retro-theme .modern-table,
            .attendance-summary.retro-theme .time-stats,
            .attendance-summary.retro-theme .progress-bar,
            .attendance-summary.retro-theme .completion-message {
                position: relative;
                z-index: 1;
            }
            
            .attendance-summary.retro-theme .summary-title {
                font-family: 'Orbitron', sans-serif !important;
                color: var(--neon-cyan) !important;
                background: none !important;
                -webkit-background-clip: unset !important;
                -webkit-text-fill-color: var(--neon-cyan) !important;
                text-shadow: 
                    0 0 10px var(--neon-cyan),
                    0 0 20px var(--neon-cyan),
                    0 0 30px rgba(0, 240, 255, 0.5) !important;
            }
            
            .attendance-summary.retro-theme .emoji-display {
                filter: drop-shadow(0 0 10px var(--neon-cyan)) !important;
            }
            
            .attendance-summary.retro-theme .modern-table {
                background: rgba(0, 0, 0, 0.5) !important;
                border: 1px solid rgba(0, 240, 255, 0.3) !important;
                box-shadow: 
                    0 0 10px rgba(0, 240, 255, 0.3),
                    inset 0 0 20px rgba(0, 240, 255, 0.05) !important;
            }
            
            .attendance-summary.retro-theme .modern-table thead {
                background: linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(255, 0, 255, 0.3)) !important;
            }
            
            .attendance-summary.retro-theme .modern-table th {
                font-family: 'Orbitron', sans-serif !important;
                color: var(--neon-cyan) !important;
                text-shadow: 0 0 5px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .modern-table td {
                color: rgba(0, 240, 255, 0.9) !important;
                font-family: 'Share Tech Mono', monospace !important;
                border-bottom: 1px solid rgba(0, 240, 255, 0.15) !important;
            }
            
            .attendance-summary.retro-theme .stat-card {
                background: rgba(0, 0, 0, 0.6) !important;
                border: 1px solid var(--neon-cyan) !important;
                box-shadow: 
                    0 0 10px var(--neon-cyan),
                    inset 0 0 10px rgba(0, 240, 255, 0.1) !important;
                animation: neonPulse 4s ease-in-out infinite !important;
            }
            
            .attendance-summary.retro-theme .stat-card.worked-time-card {
                border-color: var(--neon-cyan) !important;
                box-shadow: 
                    0 0 15px var(--neon-cyan),
                    inset 0 0 15px rgba(0, 240, 255, 0.15) !important;
            }
            
            .attendance-summary.retro-theme .stat-card.remaining-time-card {
                border-color: var(--neon-magenta) !important;
                box-shadow: 
                    0 0 15px var(--neon-magenta),
                    inset 0 0 15px rgba(255, 0, 255, 0.15) !important;
            }
            
            .attendance-summary.retro-theme .stat-card.completion-time-card {
                border-color: var(--neon-green) !important;
                box-shadow: 
                    0 0 15px var(--neon-green),
                    inset 0 0 15px rgba(0, 255, 65, 0.15) !important;
            }
            
            .attendance-summary.retro-theme .stat-label {
                color: rgba(0, 240, 255, 0.7) !important;
                font-family: 'Orbitron', sans-serif !important;
                text-shadow: 0 0 5px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .stat-value {
                font-family: 'Share Tech Mono', monospace !important;
                text-shadow: 0 0 10px currentColor !important;
            }
            
            .attendance-summary.retro-theme .worked-time {
                color: var(--neon-cyan) !important;
                text-shadow: 0 0 15px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .remaining-time {
                color: var(--neon-magenta) !important;
                text-shadow: 0 0 15px var(--neon-magenta) !important;
            }
            
            .attendance-summary.retro-theme .completion-time {
                color: var(--neon-green) !important;
                text-shadow: 0 0 15px var(--neon-green) !important;
            }
            
            .attendance-summary.retro-theme .progress-bar {
                background: rgba(0, 0, 0, 0.5) !important;
                border: 1px solid rgba(0, 240, 255, 0.3) !important;
                box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.2) !important;
            }
            
            .attendance-summary.retro-theme .progress-fill {
                background: linear-gradient(
                    90deg,
                    var(--neon-cyan),
                    var(--neon-magenta),
                    var(--neon-green),
                    var(--neon-cyan)
                ) !important;
                box-shadow: 
                    0 0 10px var(--neon-cyan),
                    0 0 20px rgba(0, 240, 255, 0.5) !important;
            }
            
            .attendance-summary.retro-theme .developer-info,
            .attendance-summary.retro-theme .settings-button {
                background: rgba(0, 0, 0, 0.8) !important;
                border-color: var(--neon-cyan) !important;
                color: var(--neon-cyan) !important;
                box-shadow: 0 0 5px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .developer-info:hover,
            .attendance-summary.retro-theme .settings-button:hover {
                background: rgba(0, 240, 255, 0.2) !important;
                box-shadow: 0 0 15px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .pip-button {
                background: linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(255, 0, 255, 0.3)) !important;
                border-color: var(--neon-cyan) !important;
                color: white !important;
                box-shadow: 0 0 10px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .pip-button:hover {
                background: linear-gradient(135deg, rgba(0, 240, 255, 0.5), rgba(255, 0, 255, 0.5)) !important;
                box-shadow: 0 0 20px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .completion-message {
                background: linear-gradient(135deg, rgba(0, 255, 65, 0.3), rgba(0, 240, 255, 0.3)) !important;
                border: 1px solid var(--neon-green) !important;
                color: var(--neon-green) !important;
                text-shadow: 0 0 10px var(--neon-green) !important;
                box-shadow: 0 0 20px rgba(0, 255, 65, 0.4) !important;
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
                justify-content: center;
                gap: 8px;
                margin-bottom: 12px;
                padding: 8px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 12px;
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
                content: 'Complete tasks to unlock achievements! 🏆';
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.75rem;
                font-style: italic;
            }
            
            .achievement-badge {
                font-size: 1.8rem;
                cursor: pointer;
                transition: transform 0.3s ease;
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
            }
            
            .achievement-badge:hover {
                transform: scale(1.2);
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
        </style>
    `;

    // Inject modern styles
    function injectModernStyles() {
        if (!document.getElementById('attendance-modern-styles')) {
            document.head.insertAdjacentHTML('beforeend', modernStyles);
        }
    }

    // Calculate emoji based on work progress
    function getEmojiForProgress(workedSeconds, totalSeconds = 28800) {
        const progress = Math.min(workedSeconds / totalSeconds, 1);

        // If exceeded 8 hours 30 minutes (30600 seconds), show clown emoji
        if (workedSeconds > (totalSeconds + 1800)) { // 28800 + 1800 = 30600
            return clownEmoji;
        }

        // If between 8 hours and 8:30 hours (28800 to 30600 seconds), show running emoji
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
                <strong>Core Logic:</strong> Websoft Team<br>
                <strong>Enhanced by:</strong> Hassan Nasir<br>
                <small>Build: v4.0.2026 (Game Edition)</small><br>
                <small>Last Modified: 28 Feb 2026</small><br>
                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.15);margin:6px 0;">
                <small>🎮 <strong>Games:</strong> Snake · Flappy Bird · Tetris · Reflex · Aim · Breakout</small><br>
                <small>⭐ <strong>XP System:</strong> Levels, streaks & rewards per game</small><br>
                <small>🏓 <strong>Breakout:</strong> 11 powerups, multi-ball, combos</small><br>
                <small>🐍 <strong>Snake:</strong> Smooth 60fps interpolation, dynamic speed</small><br>
                <small>🐦 <strong>Flappy:</strong> Progressive speed + narrowing gaps</small><br>
                <small>🧱 <strong>Tetris:</strong> Centered board, neon gutters, ghost piece</small><br>
                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.15);margin:6px 0;">
                <small>💡 <strong>Tip:</strong> Click the emoji 😮</small><br>
                <small>⚙️ Game Mode also available in Settings panel</small>
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
        
        modal.classList.toggle('active');
        overlay.classList.toggle('active');
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
                <span class="settings-option-label">😎 Emoji Style</span>
                <select class="settings-select" data-pref="emojiSet">
                    <option value="fun" ${userPreferences.emojiSet === 'fun' ? 'selected' : ''}>Fun (GenZ)</option>
                    <option value="professional" ${userPreferences.emojiSet === 'professional' ? 'selected' : ''}>Professional (Dots)</option>
                </select>
            </div>
            <div class="settings-option">
                <span class="settings-option-label">🎨 Display Theme</span>
                <select class="settings-select" data-pref="displayTheme" id="theme-selector">
                    <option value="glassmorphic" ${userPreferences.displayTheme === 'glassmorphic' ? 'selected' : ''}>Glassmorphic Aurora</option>
                    <option value="retro-futuristic" ${userPreferences.displayTheme === 'retro-futuristic' ? 'selected' : ''}>Sci-Fi Retro Futuristic</option>
                </select>
            </div>
            <div class="settings-option">
                <span class="settings-option-label">🎮 Game Mode <small style="opacity:0.6;font-size:0.75rem;">Hides side panels</small></span>
                <div class="toggle-switch ${userPreferences.gameModeHidden ? 'active' : ''}" data-pref="gameModeHidden"></div>
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
                userPreferences[pref] = this.value;
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
        }
        
        // Add close button listener
        modal.querySelector('.close-modal-button').addEventListener('click', toggleSettingsModal);
    }
    
    // Apply user preferences
    function applyPreferences() {
        const container = document.getElementById('total-time-summary');
        if (!container) return;
        
        // Apply display theme
        if (userPreferences.displayTheme === 'retro-futuristic') {
            container.classList.add('retro-theme');
        } else {
            container.classList.remove('retro-theme');
        }
        
        // Apply neumorphic depth (only for glassmorphic theme)
        if (userPreferences.displayTheme === 'glassmorphic') {
            if (userPreferences.neumorphicDepth) {
                container.style.boxShadow = `
                    0 8px 32px rgba(0, 0, 0, 0.1),
                    0 1px 2px rgba(0, 0, 0, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1),
                    5px 5px 15px rgba(0, 0, 0, 0.08),
                    -5px -5px 15px rgba(255, 255, 255, 0.05)
                `;
            } else {
                container.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            }
        }

        // Apply fluid gradients (only for glassmorphic theme)
        if (userPreferences.displayTheme === 'glassmorphic') {
            if (userPreferences.fluidGradients) {
                container.classList.remove('no-fluid');
            } else {
                container.classList.add('no-fluid');
            }
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
    // gameModeHidden: false = Game Mode OFF → panels hidden, widget shrinks 25%
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
    
    // ====================================
    // PICTURE-IN-PICTURE FUNCTIONALITY
    // ====================================
    
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
        
        // Detect current color scheme
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Determine background based on user's theme preference
        let backgroundStyle;
        if (userPreferences.displayTheme === 'retro-futuristic') {
            // Use retro-futuristic dark background for both light and dark modes
            backgroundStyle = `
                background: linear-gradient(135deg, var(--retro-dark) 0%, var(--retro-dark-alt) 100%);
                background: linear-gradient(135deg, #0a0e27 0%, #1a1d3a 100%);
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
        
        // Listen for color scheme changes and update PiP window accordingly
        const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        colorSchemeQuery.addEventListener('change', (e) => {
            updatePipColorScheme(pipWindow, e.matches);
        });
    }
    
    // Update PiP window color scheme dynamically
    function updatePipColorScheme(pipWindow, isDark) {
        if (!pipWindow || pipWindow.closed) return;
        
        let bodyStyle;
        if (userPreferences.displayTheme === 'retro-futuristic') {
            // Always use retro dark theme
            bodyStyle = `
                background: linear-gradient(135deg, #0a0e27 0%, #1a1d3a 100%);
                color-scheme: dark;
            `;
        } else {
            // Use glassmorphic theme colors
            bodyStyle = isDark ? `
                background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
                color-scheme: dark;
            ` : `
                background: linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%);
                color-scheme: light;
            `;
        }
        
        // Apply the new background with smooth transition
        Object.assign(pipWindow.document.body.style, {
            background: isDark ? 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)' : 'linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%)',
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
            
            // Add expand functionality to the compact display
            const compactDisplay = summaryElement.querySelector('.pip-compact-display');
            if (compactDisplay) {
                compactDisplay.onclick = () => toggleCompactMode(pipWindow, summaryElement);
            }
            
            // Resize window for compact mode
            try {
                // Note: PiP API doesn't support dynamic resizing, but we optimize the content
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
                            const progress = Math.min(totalSeconds / 28800, 1);
                            
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
        const progress = Math.min((totalWorkedTime / 28800) * 100, 100);

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
        const remainingTime = 28800 - totalWorkedTime;
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
                    </div>
                    
                    <!-- Snake Canvas -->
                    <canvas id="snake-canvas" class="snake-canvas" width="368" height="368"></canvas>
                    
                    <!-- Flappy Bird Canvas -->
                    <canvas id="flappy-canvas" class="snake-canvas" width="368" height="368" style="display:none;"></canvas>
                    
                    <!-- Tetris Canvas -->
                    <canvas id="tetris-canvas" class="snake-canvas" width="368" height="368" style="display:none;"></canvas>
                    <canvas id="breakout-canvas" class="snake-canvas" width="368" height="368" style="display:none; cursor:none;"></canvas>
                    
                    <!-- Multi-Game Area (for RefleX and AimTrainer) -->
                    <div id="multi-game-area" class="multi-game-area" style="display: none;"></div>
                    
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
        const remainingTime = 28800 - totalWorkedTime;
        const remainingTimeFormatted = remainingTime > 0 ? secondsToHHMMSS(remainingTime) : "00:00:00";
        const currentEmoji = getEmojiForProgress(totalWorkedTime);
        const progress = Math.min((totalWorkedTime / 28800) * 100, 100);
        
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
