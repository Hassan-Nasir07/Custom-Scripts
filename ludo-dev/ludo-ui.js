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

    // ── Capture warnings ───────────────────────────────────────────────
    // The 'hard' scorer subtracts 60 for finishing within an opponent's reach,
    // so the CPU quietly refuses to park in front of you. Measured, that shows
    // up as the CPU landing on a reachable square 6.8% of the time against a
    // player's 17% — the single largest edge it has, and it is information, not
    // dice. This surfaces the same calculation on the player's side so the two
    // are deciding with the same facts.
    function ludoWarnsCapture() {
        const P = (typeof userPreferences === 'object' && userPreferences) ? userPreferences : {};
        return P.ludoWarnCapture !== false;
    }

    // Would this move leave the token somewhere an opponent could reach on
    // their next roll? Safe squares and the home column are never at risk.
    function ludoMoveIsExposed(move) {
        if (!move || move.to > 50) return false;
        const ring = ludoStepToRing(move.token.ci, move.to);
        if (ring < 0 || LUDO_SAFE_RING.has(ring)) return false;
        return ludoUnderThreat(move.token.ci, ring);
    }

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
            ctx.fillStyle = o.danger ? 'rgba(255,120,110,0.42)' : 'rgba(255,255,255,0.62)';
            ctx.fill();
            ctx.setLineDash([3.5, 2.5]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = o.danger ? '#e02b2b' : deep;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(x, y, R * 0.30, 0, Math.PI * 2);
            ctx.fillStyle = o.danger ? '#e02b2b' : body;
            ctx.fill();
            // Crossed out, so the warning survives a colour-blind viewer and a
            // small canvas — red alone would not.
            if (o.danger) {
                const d = R * 0.55;
                ctx.beginPath();
                ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
                ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
                ctx.strokeStyle = 'rgba(224,43,43,0.85)';
                ctx.lineWidth = 1.6;
                ctx.stroke();
            }
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

        // Flag the values that would drop this token inside an opponent's
        // range — the exact decision the CPU makes silently on 'hard'.
        const warn = ludoWarnsCapture();
        L.cells.forEach(c => {
            const mv = ludoLegal.filter(m =>
                m.token === ludoPopover.token && m.value === c.value)[0];
            ludoDrawMiniDie(ctx, c.x, c.y, LUDO_POP_D, c.value, true,
                            warn && ludoMoveIsExposed(mv));
        });
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
            const warn = ludoWarnsCapture();
            ghosts.forEach(m => {
                const p = ludoPosForStep(m.token.ci, m.token.i, m.to);
                ludoDrawToken(ctx, p.x, p.y, m.token.ci, {
                    ghost: true, scale: 0.9,
                    danger: warn && ludoMoveIsExposed(m),
                });
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
    function ludoDrawMiniDie(ctx, cx, cy, size, face, bright, danger) {
        const half = size / 2;
        ctx.save();
        ctx.globalAlpha = bright ? 1 : 0.78;
        if (bright) {
            ctx.shadowColor = danger ? 'rgba(224,43,43,0.75)' : 'rgba(255,206,64,0.55)';
            ctx.shadowBlur = 5;
        }
        ludoRoundRect(ctx, cx - half, cy - half, size, size, size * 0.24);
        ctx.fillStyle = bright ? (danger ? '#ffe3e1' : '#ffffff') : '#c6cde4';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = danger ? '#e02b2b' : (bright ? '#ffce40' : 'rgba(255,255,255,0.34)');
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
        ludoLogRoll(ci, ludoDiceFace);          // audit trail; see ludoDiceStats
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

    // ── Dice audit log ─────────────────────────────────────────────────
    // Tallies every settled roll per colour and persists it, so the die can be
    // audited from real play instead of taken on trust. Simulations can always
    // be dismissed as "not the real game" — this is the real game. One small
    // localStorage write per roll; it reads nothing back into the engine and
    // cannot influence a roll.
    function ludoLogRoll(ci, face) {
        try {
            const log = JSON.parse(localStorage.getItem('ludoDiceLog') || '{}');
            if (!log[ci]) log[ci] = [0, 0, 0, 0, 0, 0, 0];
            log[ci][face]++;
            localStorage.setItem('ludoDiceLog', JSON.stringify(log));
        } catch (err) { /* quota or private mode — auditing is strictly optional */ }
    }

    // Returns one row per colour: how many times it rolled, and each face as a
    // percentage. A fair die converges on 16.67% everywhere.
    function ludoDiceStats() {
        let log = {};
        try { log = JSON.parse(localStorage.getItem('ludoDiceLog') || '{}'); } catch (err) { /* ignore */ }
        const out = {};
        Object.keys(log).forEach(ci => {
            const row = log[ci];
            const n = row.reduce((a, b) => a + b, 0);
            if (!n) return;
            const col = LUDO_COLORS[ci];
            const p = f => (100 * row[f] / n).toFixed(1) + '%';
            out[(col ? col.label : 'seat ' + ci) + (ludoIsCPUSeat(Number(ci)) ? ' (CPU)' : '')] = {
                rolls: n,
                '1': p(1), '2': p(2), '3': p(3), '4': p(4), '5': p(5), '6': p(6),
            };
        });
        return out;
    }

    function ludoDiceReset() {
        try { localStorage.removeItem('ludoDiceLog'); } catch (err) { /* ignore */ }
        return 'dice log cleared';
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
