// Shared loader: evaluates snake-core.js + snake-ui.js as one unit and hands
// back their internals. Both files are indented blocks of the userscript's IIFE
// body, so they have no exports of their own — wrapping them in a Function is
// what makes the same source both drop-in-able and testable.
//
// Concatenation order mirrors how the block is inserted:
//   snake-core.js  state, modes, stages, rules, food, growth, scoring
//   snake-ui.js    skins, geometry, rendering, animation, lifecycle
const fs   = require('fs');
const path = require('path');

const DEFAULT_PREFS = { gameFps: 60, snakeMode: 'walled', snakeSkin: 'emerald' };

function source() {
    return ['snake-core.js', 'snake-ui.js']
        .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8'))
        .join('\n\n');
}

// Minimal browser surface. Nothing here tries to be faithful — the tests drive
// snakeTick and drawSnakeGame directly rather than through real frames.
function stubEnvironment(store) {
    const noop = () => {};
    const canvas = {
        width: 368, height: 368,
        getContext: () => new Proxy({}, {
            get: (t, k) => {
                if (k === 'canvas') return canvas;
                if (k === 'createLinearGradient' || k === 'createRadialGradient') {
                    return () => ({ addColorStop: noop });
                }
                if (k === 'measureText') return () => ({ width: 10 });
                return noop;
            },
            set: () => true
        })
    };

    global.localStorage = {
        _s: store || {},
        getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
        setItem(k, v) { this._s[k] = String(v); },
        removeItem(k) { delete this._s[k]; },
        clear() { this._s = {}; }
    };

    global.document = {
        hidden: false,
        getElementById: id => (id === 'snake-canvas' ? canvas : null),
        addEventListener: noop,
        removeEventListener: noop,
        createElement: () => ({ set textContent(v) { this._t = v; }, get innerHTML() { return this._t || ''; } })
    };

    if (typeof global.performance !== 'object') global.performance = { now: () => 0 };
    if (typeof global.requestAnimationFrame !== 'function') {
        global.requestAnimationFrame = () => 1;
        global.cancelAnimationFrame  = noop;
    }

    global.userPreferences = Object.assign({}, DEFAULT_PREFS);
    global.savePreferences = noop;
    global.userXP = { achievements: [] };
    global.ACHIEVEMENTS = {
        snakeEndless:   { icon: '♾️', name: 'Round Trip',    desc: 'Score 40+ in Endless mode' },
        snakeWalled:    { icon: '🧱', name: 'Wallflower',    desc: 'Score 40+ in Walled mode' },
        snakeGourmand:  { icon: '🍯', name: 'Gourmand',      desc: 'Eat 10 golden bites in one run' },
        snakeCampaign:  { icon: '🗺️', name: 'Pathfinder',    desc: 'Clear stage 6 in Levels mode' },
        snakeConqueror: { icon: '👑', name: 'Grand Serpent', desc: 'Clear all 12 stages in one run' },
        snakeLong:      { icon: '📏', name: 'Long Boy',      desc: 'Reach a length of 60 segments' }
    };
    global.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    global.getFrameInterval = () => 16.67;
    global.awardGameXP = (type, perf) => { global.__lastXP = { type, perf }; };
    global.__lastXP = null;
}

module.exports = function load(opts) {
    opts = opts || {};
    stubEnvironment(opts.store);
    if (opts.prefs) Object.assign(global.userPreferences, opts.prefs);
    if (opts.achievements) global.userXP.achievements = opts.achievements.slice();

    return new Function(source() + `
        return {
            SNAKE_MODES, SNAKE_MODE_META, SNAKE_STAGES, SNAKE_SKINS,
            SNAKE_BIG_FOOD_TICKS, SNAKE_BIG_FOOD_VALUE, SNAKE_BIG_MIN_GAP,
            SNAKE_DEATH_MS, SNAKE_BLINK_MS, SNAKE_RESTART_MS,
            SNAKE_RULESET_VERSION, SNAKE_WALL_PX, snakeGridSize,

            snakeKey, snakeExpandWalls, snakeWrapFlags, snakeFreeRegionConnected,
            snakeStepCell, snakeApplyRules, snakeSpawnCell, snakeFreeCells,
            snakeQueueDir, snakeGetInterval, snakeTick, spawnFood,
            snakeMaybeSpawnBigFood, snakeBigFoodRemaining, snakeAdvanceStage,
            snakeGameOver, snakeFinalizeDeath, snakeBoardCleared,
            snakeSetMode, cycleSnakeMode, snakeLoadHighScores, snakeSaveHighScores,
            snakeModeBest, snakeMigrateStorage, snakeLoadLevelsBest,
            resetSnakeGame, startSnakeGame, pauseSnakeGame, initSnakeGame,
            handleSnakeKeyPress, handleSnakeVisibility,

            snakeSkinUnlocked, snakeActiveSkinId, snakeSetSkin, snakeSegmentColors,
            snakeBoardMetrics, snakeBulgeScale, snakeBiteOpen, snakeLerpSeg,
            snakeCenters, snakeRuns, snakeTaper, snakeBodyRadius, snakeHeadRadius,
            drawSnakeGame, snakeRenderLoop, snakeSwatchStyle,
            renderSnakeSkinTray, toggleSnakeSkinTray, updateSnakeScoreDisplay,

            get mode()        { return snakeMode; },
            set mode(v)       { snakeMode = v; },
            get body()        { return snakeBody; },
            set body(v)       { snakeBody = v; },
            get food()        { return snakeFood; },
            set food(v)       { snakeFood = v; },
            get bigFood()     { return snakeBigFood; },
            set bigFood(v)    { snakeBigFood = v; },
            get dir()         { return snakeDir; },
            set dir(v)        { snakeDir = v; },
            get dirQueue()    { return snakeDirQueue; },
            get score()       { return snakeScore; },
            set score(v)      { snakeScore = v; },
            get pendingGrowth() { return snakePendingGrowth; },
            set pendingGrowth(v) { snakePendingGrowth = v; },
            get bulges()      { return snakeBulges; },
            get walls()       { return snakeWalls; },
            set walls(v)      { snakeWalls = v; },
            get wrap()        { return snakeWrap; },
            set wrap(v)       { snakeWrap = v; },
            get stageIdx()    { return snakeStageIdx; },
            set stageIdx(v)   { snakeStageIdx = v; },
            get stageEaten()  { return snakeStageEaten; },
            set stageEaten(v) { snakeStageEaten = v; },
            get stagesCleared() { return snakeStagesCleared; },
            get bigEaten()    { return snakeBigEaten; },
            get maxLength()   { return snakeMaxLength; },
            get dying()       { return snakeDying; },
            set dying(v)      { snakeDying = v; },
            get deathT()      { return snakeDeathT; },
            set deathT(v)     { snakeDeathT = v; },
            get running()     { return snakeGameRunning; },
            set running(v)    { snakeGameRunning = v; },
            get paused()      { return snakeGamePaused; },
            set paused(v)     { snakeGamePaused = v; },
            get moving()      { return snakeMoving; },
            set moving(v)     { snakeMoving = v; },
            get startLen()    { return SNAKE_START_LEN; },
            get tickInterval() { return snakeTickInterval; },
            set tickInterval(v) { snakeTickInterval = v; },
            set foodsSinceBig(v) { snakeFoodsSinceBig = v; },
            set prevSnap(v)   { snakePrevSnap = v; },
            set skinTime(v)   { snakeSkinTime = v; }
        };
    `)();
};

module.exports.source = source;
