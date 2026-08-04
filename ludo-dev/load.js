// Shared loader: evaluates ludo-core.js and hands back its internals.
// The core is written as an indented block of the userscript's IIFE body, so it
// has no exports of its own — wrapping it in a Function is what makes the same
// source both drop-in-able and testable.
const fs   = require('fs');
const path = require('path');

const DEFAULT_PREFS = {
    ludoBlocks: true, ludoThreeSixes: true, ludoExactHome: true, ludoFreeRelease: false,
};

module.exports = function load(prefs) {
    global.userPreferences = Object.assign({}, DEFAULT_PREFS, prefs || {});
    const src = fs.readFileSync(path.join(__dirname, 'ludo-core.js'), 'utf8');
    return new Function(src + `
        return {
            LUDO_RING, LUDO_COLORS, LUDO_SAFE_RING, LUDO_HOME_STEP, LUDO_START_OWNER,
            ludoStepToCell, ludoStepToRing, ludoRules, ludoRollDice,
            ludoBlockRings, ludoCaptures, ludoLegalMoves, ludoApplyMove,
            ludoTokensHome, ludoGrantsExtraTurn, ludoAdvanceTurn,
            ludoCheckGameOver, ludoStandings, ludoResetTokens,
            ludoRegisterRoll, ludoFinishMove,

            get tokens()     { return ludoTokens; },
            get active()     { return ludoActive; },
            set active(v)    { ludoActive = v; },
            get turn()       { return ludoTurn; },
            set turn(v)      { ludoTurn = v; },
            get roll()       { return ludoRoll; },
            get sixStreak()  { return ludoSixStreak; },
            set sixStreak(v) { ludoSixStreak = v; },
            get placements() { return ludoPlacements; },
            get stats()      { return ludoStats; },
            get gameOver()   { return ludoGameOver; },

            // Test helpers — put a specific token on a specific step.
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
