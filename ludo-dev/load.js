// Shared loader: evaluates ludo-core.js + ludo-ui.js as one unit and hands back
// their internals. Both files are indented blocks of the userscript's IIFE body,
// so they have no exports of their own — wrapping them in a Function is what
// makes the same source both drop-in-able and testable.
//
// Concatenation order matters and mirrors how the block will be inserted:
//   ludo-core.js  tables, state, rules, turn flow, modes, CPU
//   ludo-ui.js    pixel geometry, rendering, interaction, lifecycle
const fs   = require('fs');
const path = require('path');

const DEFAULT_PREFS = {
    ludoBlocks: true, ludoBlockPassing: true, ludoThreeSixes: true,
    ludoExactHome: true, ludoFreeRelease: false,
};

function source() {
    return ['ludo-core.js', 'ludo-ui.js']
        .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8'))
        .join('\n');
}

module.exports = function load(prefs) {
    global.userPreferences = Object.assign({}, DEFAULT_PREFS, prefs || {});

    // Minimal browser surface so the lifecycle functions can run headlessly.
    // Tests that need real frames drive ludoUpdate directly instead.
    if (typeof global.requestAnimationFrame !== 'function') {
        global.requestAnimationFrame = () => 1;
        global.cancelAnimationFrame  = () => {};
    }

    return new Function(source() + `
        return {
            LUDO_RING, LUDO_COLORS, LUDO_SAFE_RING, LUDO_HOME_STEP, LUDO_START_OWNER,
            LUDO_MODES, LUDO_MODE_COLORS, LUDO_MODE_LABEL, LUDO_HUMAN_CI,
            LUDO_CANVAS_W, LUDO_CANVAS_H, LUDO_STRIP_H, LUDO_BOARD, LUDO_BOARD_X,
            LUDO_BOARD_Y, LUDO_CELL, LUDO_TURN_CLOCK, LUDO_DICE_MS, LUDO_HOP_MS,
            LUDO_AUTOPLAY_MS, LUDO_PASS_MS, LUDO_CPU_THINK_MS,

            ludoStepToCell, ludoStepToRing, ludoRules, ludoRollDice,
            ludoBlockRings, ludoCaptures, ludoLegalMoves, ludoApplyMove,
            ludoTokensHome, ludoAdvanceTurn,
            ludoCheckGameOver, ludoStandings, ludoResetTokens, LUDO_MAX_DICE,
            ludoPoolMoves, ludoValuesForToken, ludoConsumeValue, ludoEarnsAnotherRoll,
            ludoRegisterRoll, ludoFinishMove,
            ludoDifficultyTier, ludoUnderThreat, ludoScoreMove, ludoAIChooseMove,
            ludoSetMode, cycleLudoMode, ludoIsCPUSeat,

            ludoPointXY, ludoCellCenter, ludoPosForStep, ludoTokenXY, ludoComputeLayout,
            ludoRotation, ludoRotateGrid, ludoSeat, ludoRectXY,
            ludoRender, ludoDrawBoard, ludoDrawTokens, ludoDrawHud, ludoUpdate,
            ludoBeginTurn, ludoDoRoll, ludoSettleRoll, ludoPlayMove, ludoTimeout,
            ludoAwaitMove, ludoPopoverLayout, ludoDrawPopover,
            updateLudoScoreboard, toggleLudoMaximize,
            handleLudoPointerDown, ludoEventXY, ludoDiceHit,
            initLudoGame, resetLudoGame, startLudoGame, cleanupLudoGame,
            cycleLudoModeAndReset, endLudoGame,
            ludoLoadWins, ludoLoadRecord, ludoSaveRecord,
            ludoDiceStats, ludoDiceReset, ludoLogRoll,

            get mode()       { return ludoMode; },
            get phase()      { return ludoPhase; },
            set phase(v)     { ludoPhase = v; },
            get started()    { return ludoStarted; },
            get diceFace()   { return ludoDiceFace; },
            get diceSpin()   { return ludoDiceSpin; },
            get turnLeft()   { return ludoTurnLeft; },
            set turnLeft(v)  { ludoTurnLeft = v; },
            get legal()      { return ludoLegal; },
            get hop()        { return ludoHop; },
            get banner()     { return ludoBanner; },
            get pending()    { return ludoPending; },
            get awarded()    { return ludoAwarded; },
            get renderPos()  { return ludoRenderPos; },
            get animFrame()  { return ludoAnimFrame; },

            get tokens()     { return ludoTokens; },
            get active()     { return ludoActive; },
            set active(v)    { ludoActive = v; },
            get turn()       { return ludoTurn; },
            set turn(v)      { ludoTurn = v; },
            get roll()       { return ludoRoll; },
            get sixStreak()  { return ludoSixStreak; },
            set sixStreak(v) { ludoSixStreak = v; },
            get pool()       { return ludoPool; },
            get popover()    { return ludoPopover; },
            set popover(v)   { ludoPopover = v; },
            get turnEarned() { return ludoTurnEarned; },
            get recap()      { return ludoRecap; },
            set recap(v)     { ludoRecap = v; },
            get turnRolls()  { return ludoTurnRolls; },
            get placements() { return ludoPlacements; },
            get stats()      { return ludoStats; },
            get gameOver()   { return ludoGameOver; },
            get cpuTier()    { return ludoCpuTier; },
            set cpuTier(v)   { ludoCpuTier = v; },
            set debugRing(v) { ludoDebugRing = v; },
            set message(v)   { ludoMessage = v; },

            // Test helpers
            place(ci, i, step) {
                const t = ludoTokens.find(x => x.ci === ci && x.i === i);
                t.inBase = step < 0;
                t.step   = step;
                t.home   = step === LUDO_HOME_STEP;
                return t;
            },
            tok(ci, i) { return ludoTokens.find(x => x.ci === ci && x.i === i); },
        };
    `)();
};

// step on which colour `ci` stands on ring index `ri` (or -1 if unreachable).
module.exports.stepOnRing = function (colors, ci, ri) {
    for (let s = 0; s <= 50; s++) if ((colors[ci].startIndex + s) % 52 === ri) return s;
    return -1;
};

// Force ludoRollDice to a given face. It reads Math.random, so pinning that is
// enough — the tumble flicker consumes the same value and is overwritten anyway.
module.exports.forceDice = function (face) {
    Math.random = () => (face - 1 + 0.5) / 6;
};
module.exports.restoreDice = (function () {
    const real = Math.random;
    return function () { Math.random = real; };
})();
