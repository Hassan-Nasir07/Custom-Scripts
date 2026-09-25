    // ═══════════════════════════════════════════════════════════════════
    // 8-BALL POOL — RENDER, HUD, INPUT, LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════
    // Canvas drawing, the canvas HUD, mouse/touch aiming and the loop.
    // The shared Max modal (toggleGameMaxModal) stays in the host because
    // Ludo uses it too; togglePoolMaximize below is Pool's only caller.

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

        // Sweeping diagonal base gradient (oscillates left↔right)
        const _gx0 = POOL_W * (0.1 + _s1 * 0.35);
        const _gx1 = POOL_W * (0.55 + _s2 * 0.35);
        const _bgGrad = ctx.createLinearGradient(_gx0, 0, _gx1, POOL_CANVAS_H);
        _bgGrad.addColorStop(0,   _bp.c0);
        _bgGrad.addColorStop(0.5, _bp.c1);
        _bgGrad.addColorStop(1,   _bp.c0);
        ctx.fillStyle = _bgGrad;
        ctx.fillRect(0, 0, POOL_W, POOL_CANVAS_H);

        // Top margin: pulsing radial glow (centre, breathing in/out)
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

        // Bottom margin: second pulsing radial glow (opposite phase)
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

        // Sweeping shimmer band (diagonal streak across margins)
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

        // TABLE (translated to center vertically)
        ctx.save();
        ctx.translate(0, POOL_TABLE_OFFSET_Y);

        const colors = poolGetTableColors();

        ctx.fillStyle = colors.border;
        ctx.fillRect(0, 0, POOL_W, POOL_H);

        const cx1 = POOL_CUSHION_X1 - 2;
        const cy1 = POOL_CUSHION_Y1 - 2;
        const cx2 = POOL_CUSHION_X2 + 2;
        const cy2 = POOL_CUSHION_Y2 + 2;
        ctx.fillStyle = colors.felt;
        ctx.fillRect(cx1, cy1, cx2 - cx1, cy2 - cy1);

        ctx.fillStyle = colors.cushion;
        ctx.fillRect(cx1, 0, cx2 - cx1, POOL_CUSHION_Y1);
        ctx.fillRect(cx1, POOL_CUSHION_Y2, cx2 - cx1, POOL_H - POOL_CUSHION_Y2);
        ctx.fillRect(0, cy1, POOL_CUSHION_X1, cy2 - cy1);
        ctx.fillRect(POOL_CUSHION_X2, cy1, POOL_W - POOL_CUSHION_X2, cy2 - cy1);

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

        // HUD in top & bottom margins
        poolDrawHUD(ctx);

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
        // Rolling offset — the label orbits the ball centre so it appears to roll toward movement.
        const rollAngle = ball.rotation || 0;
        // Offset for the number circle "orbiting" the surface
        const orbitR = r * 0.25; // how far the label can shift from center
        const labelOffX = Math.sin(rollAngle) * orbitR;
        const labelOffY = -Math.cos(rollAngle) * orbitR;
        // Visibility factor — label fades as it "rotates" to the back
        const labelVis = Math.max(0, Math.cos(rollAngle));

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

        // Aiming line (dotted). Cast ahead for hitBall, flag an illegal target (mirrors the
        // poolProcessTurnResult foul checks), then pick guide colours.

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

        if (dirX > 0) lineLen = Math.min(lineLen, (POOL_CUSHION_X2 - cueBall.x) / dirX);
        else if (dirX < 0) lineLen = Math.min(lineLen, (POOL_CUSHION_X1 - cueBall.x) / dirX);
        if (dirY > 0) lineLen = Math.min(lineLen, (POOL_CUSHION_Y2 - cueBall.y) / dirY);
        else if (dirY < 0) lineLen = Math.min(lineLen, (POOL_CUSHION_Y1 - cueBall.y) / dirY);

        lineLen = Math.max(0, lineLen);

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

        // Draw the aim line (white = legal, red = illegal)
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
                // PROHIBITION SIGN (NOT ALLOWED)
                const prohibR = POOL_BALL_R;

                ctx.strokeStyle = 'rgba(255,50,50,0.92)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(ghostX, ghostY, prohibR, 0, Math.PI * 2);
                ctx.stroke();

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

        const pullBack = poolDragging ? poolCuePower * 2 : 0;
        const cueStart = POOL_BALL_R + 2 + pullBack;
        const cueLen = 100;

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

        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(ix, iy, indicatorR + 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ddd';
        ctx.beginPath();
        ctx.arc(ix, iy, indicatorR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

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

        const showTimer = poolGameRunning && !poolGameOver && poolAllStopped() && !poolShotFired && !poolPlacingBall;
        const timerPct = poolShotTimer / POOL_SHOT_CLOCK;
        let timerBarColor;
        if (timerPct > 0.5) timerBarColor = 'rgba(80,220,100,0.85)';
        else if (timerPct > 0.25) timerBarColor = 'rgba(255,180,40,0.85)';
        else timerBarColor = 'rgba(255,70,50,0.85)';

        // TOP HUD AREA (y: 0 .. POOL_TABLE_OFFSET_Y)
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

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(p1Name, 22, badgeY + 17);
        ctx.textAlign = 'right';
        ctx.fillText(p2Name, POOL_W - 22, badgeY + 17);

        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.60)';
        const p1WL = `${poolRecord.p1Wins}W ${poolRecord.p1Losses}L`;
        const p2WL = `${poolRecord.p2Wins}W ${poolRecord.p2Losses}L`;
        ctx.textAlign = 'right';
        ctx.fillText(p1WL, 14 + badgeW - 6, badgeY + 10);
        ctx.textAlign = 'left';
        ctx.fillText(p2WL, POOL_W - 14 - badgeW + 6, badgeY + 10);

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

        // BOTTOM HUD AREA (y: POOL_TABLE_OFFSET_Y + POOL_H .. POOL_CANVAS_H)
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
            const shotDirX = Math.cos(poolLockedAngle);
            const shotDirY = Math.sin(poolLockedAngle);
            // Pull vector: from mouse toward cue ball along shot axis
            const pullX = cueBall.x - mx;
            const pullY = cueBall.y - my;
            const projection = pullX * shotDirX + pullY * shotDirY;
            // Absolute value: power builds whether the mouse is pulled back or dragged forward, which
            // lifts the canvas-bounds restriction on corner shots.
            poolCuePower = Math.min(POOL_CUE_MAX_POWER, Math.max(0, (Math.abs(projection) - 5) * 0.20));
            // Angle stays locked — do NOT update poolCueAngle here
        }
    }

    function handlePoolMouseUp(e) {
        if (currentGame !== 'pool') return;
        if (!poolDragging) return;

        const cueBall = poolBalls.find(b => b.id === 0 && !b.pocketed);
        if (cueBall && poolCuePower > 0.5 && poolAllStopped()) {
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


    function initPoolGame() {
        poolCanvas = document.getElementById('pool-canvas');
        if (!poolCanvas) return;
        poolCtx = poolCanvas.getContext('2d');
        poolGamesWon = loadPoolHighScore();
        loadPoolWinsByMode();   // seeds the per-mode split on first run
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
        // Force a full reset if the previous game ended — otherwise Play re-triggers endPoolGame
        // with the same winner (XP farm).
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
            savePoolWinByMode(poolMode);
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
        // The button shows wins in the mode being played, which is what the
        // Pool board ranks — the balls-pocketed figures beside it are per-frame.
        const byMode = loadPoolWinsByMode();
        updateGameScoreBtn('pool', null, poolMode === 'pvp' ? byMode.pvp : byMode.cpu);
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
