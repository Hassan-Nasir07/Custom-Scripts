    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — CORE
    // ═══════════════════════════════════════════════════════════════════
    // State, table geometry, rack, physics, BCA turn rules and the CPU.
    // Moved out of the userscript verbatim (POOL_V2_PLAN.md, Phase 0);
    // Phase 1 onwards replaces the physics, rules and CPU below.

    let poolLastFrameMs = 0;
    let poolLastLogicMs = 0;
    let poolAccumulator = 0;

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

        let solids = [1, 2, 3, 4, 5, 6, 7];
        let stripes = [9, 10, 11, 12, 13, 14, 15];

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

        if (Math.random() < 0.5) {
            rackIds[10] = solids.pop();
            rackIds[14] = stripes.pop();
        } else {
            rackIds[10] = stripes.pop();
            rackIds[14] = solids.pop();
        }

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

        const cueDef = POOL_BALL_DEFS[0];
        balls.push({
            id: 0, x: POOL_W * 0.25, y: POOL_H / 2,
            vx: 0, vy: 0, r: POOL_BALL_R,
            color: cueDef.color, stripe: false, num: 0, pocketed: false,
            rotation: 0, spinX: 0, spinY: 0
        });

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

                        // Capture cue speed BEFORE the elastic collision: a head-on shot leaves postSpeed ~0, which
                        // would kill follow/draw. Pre-collision speed scales spin with shot power.
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
            // Residual spin drift from cloth friction — the cue ball arcs after collision instead of
            // snapping straight to its final trajectory.
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
        // BCA Official 8-Ball Rules
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

        // 0. 8-BALL POCKETED -> IMMEDIATE GAME END. Win vs loss is decided up front so nothing in
        // the regular pocket loop can override it.
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

        // 1. SCRATCH (no 8-ball involved)
        if (cueScratched) {
            cueBall.pocketed = false;
            foul = true;
            poolFoulMessage = 'Scratch! Ball in hand';
        }

        // 2. NO BALL CONTACTED
        if (!foul && poolFirstBallHit === -1) {
            foul = true;
            poolFoulMessage = 'Foul! No ball contacted';
        }

        // 3. WRONG FIRST BALL (BCA Rule 7 — groups must be assigned)
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

        // 4. NO RAIL AFTER CONTACT
        // BCA Rule 7: must pocket a ball OR cause any ball to contact a rail.
        if (!foul && pocketed.length === 0 && poolFirstBallHit !== -1 && !poolCushionAfterHit) {
            foul = true;
            poolFoulMessage = 'Foul! No rail after contact';
        }

        // 5. PROCESS POCKETED BALLS. The 8-ball case is handled in 0, the cue ball in 1; this loop
        // credits only group balls (1-7, 9-15) to their owners.
        let legalPocket  = false;
        let legalPotCount = 0;

        for (const bid of pocketed) {
            if (bid === 0 || bid === 8) continue; // cue & 8-ball handled above

            // Assign groups on first pocket. Balls pocketed on a foul stay down, so attribution holds.
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

        // 6. XP FOR LEGAL POTS
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

        // 7. TURN MANAGEMENT
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

        // 8. RESET SHOT STATE
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

                    if (posX < POOL_CUSHION_X1 + POOL_BALL_R + 2 || posX > POOL_CUSHION_X2 - POOL_BALL_R - 2 ||
                        posY < POOL_CUSHION_Y1 + POOL_BALL_R + 2 || posY > POOL_CUSHION_Y2 - POOL_BALL_R - 2) continue;

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

    // POOL AI — Trial Simulation
    // Runs a lightweight physics sim to verify if a shot will pot the
    // target ball. Returns { potted, finalDist } where finalDist is
    // how close the target got to the pocket center (lower = better).
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

                if (tx - POOL_BALL_R < POOL_CUSHION_X1) { tx = POOL_CUSHION_X1 + POOL_BALL_R; tvx = Math.abs(tvx) * POOL_RESTITUTION; }
                if (tx + POOL_BALL_R > POOL_CUSHION_X2) { tx = POOL_CUSHION_X2 - POOL_BALL_R; tvx = -Math.abs(tvx) * POOL_RESTITUTION; }
                if (ty - POOL_BALL_R < POOL_CUSHION_Y1) { ty = POOL_CUSHION_Y1 + POOL_BALL_R; tvy = Math.abs(tvy) * POOL_RESTITUTION; }
                if (ty + POOL_BALL_R > POOL_CUSHION_Y2) { ty = POOL_CUSHION_Y2 - POOL_BALL_R; tvy = -Math.abs(tvy) * POOL_RESTITUTION; }

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
                        const overlap = R2 - dist;
                        cx -= (overlap * 0.5) * nx;
                        cy -= (overlap * 0.5) * ny;
                        tx += (overlap * 0.5) * nx;
                        ty += (overlap * 0.5) * ny;
                    }
                }

                const pdx = tx - pocketX, pdy = ty - pocketY;
                if (Math.sqrt(pdx * pdx + pdy * pdy) < POOL_POCKET_R) {
                    return { potted: true, finalDist: 0 };
                }
            }

            cvx *= POOL_FRICTION; cvy *= POOL_FRICTION;
            tvx *= POOL_FRICTION; tvy *= POOL_FRICTION;
            if (Math.abs(cvx) < POOL_MIN_VEL) cvx = 0;
            if (Math.abs(cvy) < POOL_MIN_VEL) cvy = 0;
            if (Math.abs(tvx) < POOL_MIN_VEL) tvx = 0;
            if (Math.abs(tvy) < POOL_MIN_VEL) tvy = 0;

            if (cvx === 0 && cvy === 0 && tvx === 0 && tvy === 0) break;
        }

        // Not potted — return closest approach distance to pocket
        const fd = Math.sqrt((tx - pocketX) ** 2 + (ty - pocketY) ** 2);
        return { potted: false, finalDist: fd };
    }

    // Given a base angle, try micro-adjustments to find one that pots.
    // Returns the corrected angle or the original if none work.
    function poolAIRefineAngle(cueX, cueY, targetX, targetY, pocketX, pocketY, baseAngle, power) {
        const base = poolTrialSim(cueX, cueY, targetX, targetY, pocketX, pocketY, baseAngle, power);
        if (base.potted) return baseAngle;

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

        // Helper: check if a straight line is clear of all balls except excludeIds
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

        // PASS 1 — Direct shots (cue ball → ghost ball → pocket)
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

        // PASS 2 — Cushion (rail) shots to break snookers
        //   Uses the reflection principle: mirror cue ball across the
        //   cushion wall, then the straight line mirror→target gives
        //   the exact bounce point on the rail.
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

        // PASS 3 — Safety shot: graze target + send cue to a rail
        //   Used only when no direct or cushion shot scored well.
        //   Avoids hitting wrong ball — aims at legal target with a
        //   thin cut so cue ball rolls to a cushion afterwards.
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
