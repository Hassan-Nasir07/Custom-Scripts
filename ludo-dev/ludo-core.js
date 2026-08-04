    // ═══════════════════════════════════════════════════════════════════
    // LUDO GAME
    // ═══════════════════════════════════════════════════════════════════
    // 15×15 grid, 20px cells → a 300×300 board centred in a 368×368 canvas,
    // leaving 34px HUD strips top and bottom. Everything is canvas-drawn so the
    // ⛶ Max modal (which relocates only the <canvas>) keeps the whole UI.

    const LUDO_GRID          = 15;
    const LUDO_CELL          = 20;
    const LUDO_BOARD         = LUDO_GRID * LUDO_CELL;   // 300
    const LUDO_CANVAS_W      = 368;
    const LUDO_CANVAS_H      = 368;
    const LUDO_BOARD_OFFSET  = (LUDO_CANVAS_W - LUDO_BOARD) / 2; // 34
    const LUDO_TURN_CLOCK    = 20;                      // seconds per turn

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
    }

    // ── Rules ──────────────────────────────────────────────────────────
    // Read straight off userPreferences so the ⚙️ toggles take effect mid-match.
    // Defaults match Ludo Star: blocks / three-sixes / exact-home on, free
    // release off. `typeof` guard keeps the headless tests independent of the host.
    function ludoRules() {
        const P = (typeof userPreferences === 'object' && userPreferences) ? userPreferences : {};
        return {
            blocks:      P.ludoBlocks      !== false,
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
    function ludoBlockRings(forCi) {
        const per = {};
        ludoTokens.forEach(t => {
            if (t.inBase || t.home || t.ci === forCi) return;
            const ri = ludoStepToRing(t.ci, t.step);
            if (ri < 0) return;
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
                // A block bars passage as well as landing. Only ring squares
                // strictly after the current one and up to the destination count;
                // home-column squares (>50) can never be blocked.
                for (let s = t.step + 1; s <= Math.min(to, 50); s++) {
                    if (blocked.has(ludoStepToRing(ci, s))) return;
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
        return { captured: caps.length, finished: t.home };
    }

    const ludoTokensHome = ci => ludoTokens.filter(t => t.ci === ci && t.home).length;

    // A 6, a capture and getting a token home each grant another roll.
    function ludoGrantsExtraTurn(roll, result) {
        return roll === 6 || result.captured > 0 || result.finished;
    }

    function ludoAdvanceTurn() {
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

    function ludoRegisterRoll(ci, roll) {
        const R = ludoRules();
        ludoRoll      = roll;
        ludoSixStreak = roll === 6 ? ludoSixStreak + 1 : 0;

        // Third consecutive 6 forfeits the turn AND voids the roll — the player
        // does not get to move on it.
        if (R.threeSixes && ludoSixStreak >= 3) {
            ludoRoll = 0;
            ludoAdvanceTurn();
            return { voided: true, moves: [] };
        }

        const moves = ludoLegalMoves(ci, roll);
        if (moves.length === 0) {
            // No legal move ends the turn even on a 6.
            ludoRoll = 0;
            ludoAdvanceTurn();
            return { voided: false, passed: true, moves: [] };
        }
        return { voided: false, passed: false, moves };
    }

    function ludoFinishMove(roll, result) {
        if (ludoCheckGameOver()) {
            ludoGameOver = true;
            ludoRoll = 0;
            return { gameOver: true, extraTurn: false };
        }
        if (ludoGrantsExtraTurn(roll, result)) {
            ludoRoll = 0;            // roll again; six streak deliberately preserved
            return { gameOver: false, extraTurn: true };
        }
        ludoAdvanceTurn();
        return { gameOver: false, extraTurn: false };
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

    // ── Geometry helpers ───────────────────────────────────────────────
    // ludoPointXY takes grid-line coords (base slots, triangle vertices);
    // ludoCellCenter takes a cell index and returns the middle of that cell.
    function ludoPointXY(r, c) {
        return {
            x: LUDO_BOARD_OFFSET + c * LUDO_CELL,
            y: LUDO_BOARD_OFFSET + r * LUDO_CELL,
        };
    }
    function ludoCellCenter(r, c) {
        return ludoPointXY(r + 0.5, c + 0.5);
    }

    // step → board cell. Returns null at step 56 (the centre), which has no cell.
    function ludoStepToCell(ci, step) {
        const col = LUDO_COLORS[ci];
        if (step < 0)  return null;                                    // still in base
        if (step <= 50) return LUDO_RING[(col.startIndex + step) % 52];
        if (step <= 55) return col.homeCol[step - 51];
        return null;                                                   // home
    }

    // step → ring index, or -1 when off the shared ring (base/home column/home).
    function ludoStepToRing(ci, step) {
        if (step < 0 || step > 50) return -1;
        return (LUDO_COLORS[ci].startIndex + step) % 52;
    }

    function ludoTokenXY(t) {
        if (t.home) {
            // Parked in the centre, fanned out along the colour's own triangle.
            const col = LUDO_COLORS[t.ci];
            const mid = ludoPointXY(7.5, 7.5);
            const a   = ludoPointXY((col.apex[0].r + col.apex[1].r) / 2,
                                    (col.apex[0].c + col.apex[1].c) / 2);
            const k   = 0.34 + t.i * 0.13;
            return { x: mid.x + (a.x - mid.x) * k, y: mid.y + (a.y - mid.y) * k };
        }
        if (t.inBase) {
            const s = LUDO_COLORS[t.ci].baseSlots[t.i];
            return ludoPointXY(s.r, s.c);
        }
        const cell = ludoStepToCell(t.ci, t.step);
        return cell ? ludoCellCenter(cell.r, cell.c) : ludoPointXY(7.5, 7.5);
    }

    function ludoDim(hex) {
        const n = parseInt(hex.slice(1), 16);
        const mix = v => Math.round(v * 0.30 + 196 * 0.70);
        return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
    }

    const ludoIsActive = ci => ludoActive.indexOf(ci) !== -1;

    // ── Rendering ──────────────────────────────────────────────────────
    function ludoDrawCell(ctx, r, c, fill, stroke) {
        const p = ludoPointXY(r, c);
        ctx.fillStyle = fill;
        ctx.fillRect(p.x, p.y, LUDO_CELL, LUDO_CELL);
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x + 0.5, p.y + 0.5, LUDO_CELL - 1, LUDO_CELL - 1);
        }
    }

    function ludoDrawStar(ctx, r, c, colour) {
        const p = ludoCellCenter(r, c);
        const R = LUDO_CELL * 0.34, r2 = R * 0.44;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const rad = i % 2 ? r2 : R;
            const a   = -Math.PI / 2 + i * Math.PI / 5;
            const x   = p.x + Math.cos(a) * rad, y = p.y + Math.sin(a) * rad;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();
    }

    function ludoDrawBoard(ctx) {
        const S = LUDO_CELL, O = LUDO_BOARD_OFFSET;

        // Board face + frame
        ctx.fillStyle = '#f4f7fb';
        ctx.fillRect(O, O, LUDO_BOARD, LUDO_BOARD);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(O - 1, O - 1, LUDO_BOARD + 2, LUDO_BOARD + 2);

        // Quadrants + bases
        LUDO_COLORS.forEach((col, ci) => {
            const on   = ludoIsActive(ci);
            const tint = on ? col.hex : ludoDim(col.hex);
            const q = col.quad, b = col.basePanel;

            ctx.fillStyle = tint;
            ctx.fillRect(O + q.c0 * S, O + q.r0 * S, (q.c1 - q.c0) * S, (q.r1 - q.r0) * S);
            ctx.fillStyle = '#f4f7fb';
            ctx.fillRect(O + b.c0 * S, O + b.r0 * S, (b.c1 - b.c0) * S, (b.r1 - b.r0) * S);
            ctx.strokeStyle = 'rgba(0,0,0,0.20)';
            ctx.lineWidth = 1;
            ctx.strokeRect(O + b.c0 * S + 0.5, O + b.r0 * S + 0.5,
                           (b.c1 - b.c0) * S - 1, (b.r1 - b.r0) * S - 1);

            col.baseSlots.forEach(s => {
                const p = ludoPointXY(s.r, s.c);
                ctx.beginPath(); ctx.arc(p.x, p.y, S * 0.44, 0, Math.PI * 2);
                ctx.fillStyle = tint; ctx.fill();
                ctx.beginPath(); ctx.arc(p.x, p.y, S * 0.33, 0, Math.PI * 2);
                ctx.fillStyle = '#f4f7fb'; ctx.fill();
            });
        });

        // Ring squares — start squares wear their owner's colour
        LUDO_RING.forEach((cell, idx) => {
            const owner = LUDO_START_OWNER[idx];
            let fill = '#ffffff';
            if (owner !== undefined) {
                fill = ludoIsActive(owner) ? LUDO_COLORS[owner].hex : ludoDim(LUDO_COLORS[owner].hex);
            }
            ludoDrawCell(ctx, cell.r, cell.c, fill, 'rgba(0,0,0,0.22)');
        });

        // ★ safe squares (skip the four starts — they read as safe by colour already)
        LUDO_SAFE_RING.forEach(idx => {
            if (LUDO_START_OWNER[idx] !== undefined) return;
            const cell = LUDO_RING[idx];
            ludoDrawStar(ctx, cell.r, cell.c, 'rgba(0,0,0,0.30)');
        });

        // Home columns
        LUDO_COLORS.forEach((col, ci) => {
            const tint = ludoIsActive(ci) ? col.hex : ludoDim(col.hex);
            col.homeCol.forEach(cell => ludoDrawCell(ctx, cell.r, cell.c, tint, 'rgba(0,0,0,0.22)'));
        });

        // Centre triangles
        const mid = ludoPointXY(7.5, 7.5);
        LUDO_COLORS.forEach((col, ci) => {
            const a = ludoPointXY(col.apex[0].r, col.apex[0].c);
            const b = ludoPointXY(col.apex[1].r, col.apex[1].c);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(mid.x, mid.y);
            ctx.closePath();
            ctx.fillStyle = ludoIsActive(ci) ? col.deep : ludoDim(col.hex);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

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

    function ludoDrawTokens(ctx) {
        ludoTokens.forEach(t => {
            const p   = ludoTokenXY(t);
            const col = LUDO_COLORS[t.ci];
            const R   = LUDO_CELL * 0.36;

            ctx.beginPath();
            ctx.ellipse(p.x, p.y + R * 0.55, R * 0.85, R * 0.35, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
            ctx.fillStyle = col.hex;
            ctx.fill();
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = col.deep;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(p.x - R * 0.28, p.y - R * 0.30, R * 0.30, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.62)';
            ctx.fill();
        });
    }

    function ludoDrawHud(ctx) {
        ctx.clearRect(0, 0, LUDO_CANVAS_W, LUDO_BOARD_OFFSET);
        ctx.clearRect(0, LUDO_CANVAS_H - LUDO_BOARD_OFFSET, LUDO_CANVAS_W, LUDO_BOARD_OFFSET);

        // Top strip — one chip per active player, showing tokens home
        const n = ludoActive.length;
        const w = LUDO_CANVAS_W / n;
        ludoActive.forEach((ci, k) => {
            const col   = LUDO_COLORS[ci];
            const cx    = w * k + w / 2;
            const isCur = k === ludoTurn;
            const home  = ludoTokens.filter(t => t.ci === ci && t.home).length;

            if (isCur) {
                ctx.fillStyle = 'rgba(255,255,255,0.10)';
                ctx.fillRect(w * k + 2, 3, w - 4, LUDO_BOARD_OFFSET - 7);
            }
            ctx.beginPath();
            ctx.arc(cx - 26, LUDO_BOARD_OFFSET / 2, 6, 0, Math.PI * 2);
            ctx.fillStyle = col.hex;
            ctx.fill();
            if (isCur) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            }
            ctx.font = isCur ? 'bold 11px system-ui, sans-serif' : '11px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isCur ? '#ffffff' : 'rgba(255,255,255,0.62)';
            ctx.fillText(`${col.label} ${home}/4`, cx - 15, LUDO_BOARD_OFFSET / 2);
        });

        // Bottom strip — turn / message / CPU tier
        const by = LUDO_CANVAS_H - LUDO_BOARD_OFFSET / 2;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillText(ludoMessage || `${LUDO_COLORS[ludoActive[ludoTurn]].label} to play`, 8, by);

        if (ludoMode === 'cpu2') {
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillText(`CPU: ${ludoCpuTier}`, LUDO_CANVAS_W - 8, by);
        }
    }

    function ludoRender() {
        const canvas = document.getElementById('ludo-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, LUDO_CANVAS_W, LUDO_CANVAS_H);
        ludoDrawHud(ctx);
        ludoDrawBoard(ctx);
        ludoDrawTokens(ctx);
    }
