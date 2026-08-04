    // ═══════════════════════════════════════════════════════════════════
    // LUDO — presentation and interaction
    // ═══════════════════════════════════════════════════════════════════
    // Concatenated after ludo-core.js. Everything here is canvas-drawn: the ⛶ Max
    // modal relocates only the <canvas>, so a DOM-based HUD would vanish inside it.
    //
    // Layout — 368 × 404:
    //   0–52     top strip     Blue chip (left) · Red chip (right)
    //   52–352   board         300 × 300, inset 34px each side, wooden frame
    //   352–404  bottom strip  Yellow chip (left) · Green chip (right)
    // The dice renders in whichever strip belongs to the player to move, so the
    // eye is drawn to the right half of the board — same idea as Ludo Star.

    const LUDO_SEATS = {
        0: { strip: 'top',    side: 'left'  },   // blue   — top-left quadrant
        1: { strip: 'top',    side: 'right' },   // red    — top-right
        2: { strip: 'bottom', side: 'right' },   // green  — bottom-right
        3: { strip: 'bottom', side: 'left'  },   // yellow — bottom-left
    };

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
        return { x: LUDO_BOARD_X + c * LUDO_CELL, y: LUDO_BOARD_Y + r * LUDO_CELL };
    }
    function ludoCellCenter(r, c) {
        return ludoPointXY(r + 0.5, c + 0.5);
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
        const dr = Math.sign(next.r - cur.r), dc = Math.sign(next.c - cur.c);
        const p  = ludoCellCenter(cur.r, cur.c);
        const L  = LUDO_CELL * 0.30;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(dr, dc));
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
            const qp = ludoPointXY(q.r0, q.c0);

            ctx.fillStyle = tint;
            ctx.fillRect(qp.x, qp.y, (q.c1 - q.c0) * S, (q.r1 - q.r0) * S);

            const bp = ludoPointXY(b.r0, b.c0);
            const bw = (b.c1 - b.c0) * S, bh = (b.r1 - b.r0) * S;
            ctx.fillStyle = '#fbfcfe';
            ludoRoundRect(ctx, bp.x, bp.y, bw, bh, 8);
            ctx.fill();
            ctx.strokeStyle = deep;
            ctx.lineWidth = 2;
            ludoRoundRect(ctx, bp.x + 1, bp.y + 1, bw - 2, bh - 2, 7);
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
        ctx.strokeRect(ludoPointXY(6, 6).x, ludoPointXY(6, 6).y, S * 3, S * 3);

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
        const body = o.ghost ? 'rgba(255,255,255,0.30)' : (on ? col.hex : ludoDim(col.hex));
        const deep = on ? col.deep : ludoDim(col.deep);
        const R    = LUDO_CELL * 0.40 * (o.scale || 1);

        ctx.save();
        if (o.ghost) ctx.globalAlpha = 0.55;

        if (!o.ghost) {
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
        ctx.lineWidth = 1.4; ctx.strokeStyle = o.ghost ? 'rgba(255,255,255,0.7)' : deep;
        ctx.stroke();

        ctx.beginPath(); ctx.arc(x, y, R * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = o.ghost ? 'rgba(255,255,255,0.35)' : '#ffffff';
        ctx.fill();

        ctx.beginPath(); ctx.arc(x, y, R * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = body; ctx.fill();

        if (!o.ghost) {
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

        // Ghost preview of where each legal move would land.
        if (ludoPhase === 'awaitMove') {
            ludoLegal.forEach(m => {
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

    // Small greyed-out die used only for the recap, so it never reads as live.
    // Pips need real contrast at this size — a grey face with near-black pips
    // stays countable where a low global alpha turned them to mush.
    function ludoDrawMiniDie(ctx, cx, cy, size, face) {
        const half = size / 2;
        ctx.save();
        ctx.globalAlpha = 0.78;
        ludoRoundRect(ctx, cx - half, cy - half, size, size, size * 0.24);
        ctx.fillStyle = '#c6cde4';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.34)';
        ctx.lineWidth = 1;
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

    // What the previous player rolled, parked beside their own chip. Cleared
    // the moment the next roll starts (see ludoDoRoll).
    function ludoDrawRecap(ctx, strip) {
        if (!ludoRecap || !ludoRecap.faces.length) return;
        const seat = LUDO_SEATS[ludoRecap.ci];
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
        const curStrip = ludoPhase === 'over' ? null : LUDO_SEATS[cur].strip;

        ['top', 'bottom'].forEach(strip => {
            const y0 = strip === 'top' ? 0 : LUDO_CANVAS_H - LUDO_STRIP_H;
            ludoActive.forEach(ci => {
                const seat = LUDO_SEATS[ci];
                if (seat.strip !== strip) return;
                ludoDrawChip(ctx, ci, ludoChipX(seat.side),
                             y0 + (LUDO_STRIP_H - LUDO_CHIP_H) / 2,
                             ci === cur && ludoPhase !== 'over');
            });

            ludoDrawRecap(ctx, strip);

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
        ctx.clearRect(0, 0, LUDO_CANVAS_W, LUDO_CANVAS_H);
        ludoDrawBoard(ctx);
        ludoDrawTokens(ctx);
        ludoDrawHud(ctx);
        ludoDrawIdle(ctx);
        ludoDrawGameOver(ctx);
        ludoDrawBanner(ctx);
    }

    // ── Turn orchestration ─────────────────────────────────────────────
    function ludoSay(text, tone, ms) {
        ludoBanner = { text, tone: tone || 'info', ttl: ms || 900 };
    }

    function ludoBeginTurn() {
        if (ludoPhase === 'over') return;
        ludoPhase    = 'awaitRoll';
        ludoTurnLeft = LUDO_TURN_CLOCK;
        ludoLegal    = [];
        ludoHop      = null;
        if (ludoIsCPUSeat(ludoCurrentCi())) ludoAfter(LUDO_CPU_THINK_MS, ludoDoRoll);
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
        if (res.passed) {
            // Name the number. "No moves" alone left the player guessing what
            // they had rolled, which is the whole complaint the recap fixes.
            const stuck = ludoTokens.filter(t => t.ci === ci).every(t => t.inBase || t.home);
            ludoSay(stuck && ludoDiceFace !== 6
                ? `Rolled ${ludoDiceFace} — need a 6`
                : `Rolled ${ludoDiceFace} — no moves`, 'info', LUDO_PASS_MS);
            ludoAfter(LUDO_PASS_MS, ludoBeginTurn);
            return;
        }

        ludoLegal = res.moves;
        ludoPhase = 'awaitMove';

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

    function ludoPlayMove(move) {
        if (ludoPhase !== 'awaitMove') return;
        ludoClearPending();
        const path = [];
        if (move.release) path.push(0);
        else for (let s = move.from + 1; s <= move.to; s++) path.push(s);

        ludoPhase = 'moving';
        ludoLegal = [];
        ludoHop   = { move, path, idx: 0, t: 0 };
    }

    function ludoCompleteMove() {
        const move = ludoHop.move;
        const roll = ludoRoll;
        ludoHop = null;

        const result = ludoApplyMove(move);
        if (result.captured) ludoSay('Captured!', 'good', 800);
        else if (result.finished) ludoSay('Home!', 'good', 800);

        const after = ludoFinishMove(roll, result);
        if (after.gameOver) {
            ludoPhase = 'over';
            endLudoGame();
            return;
        }
        if (after.extraTurn && !result.captured && !result.finished) ludoSay('Roll again', 'info', 700);
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
        const seat = LUDO_SEATS[ludoCurrentCi()];
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

        // Nearest legal token within a cell's reach wins, so near-misses still register.
        let best = null, bestD = 15 * 15;
        ludoLegal.forEach(m => {
            const rp = ludoRenderPos.get(m.token);
            if (!rp) return;
            const d = (rp.x - p.x) ** 2 + (rp.y - p.y) ** 2;
            if (d < bestD) { bestD = d; best = m; }
        });
        if (best) {
            if (e.preventDefault) e.preventDefault();
            ludoPlayMove(best);
        }
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
        if (ludoAnimFrame) { cancelAnimationFrame(ludoAnimFrame); ludoAnimFrame = null; }
        ludoClearPending();
        if (ludoCanvasEl) {
            ludoCanvasEl.removeEventListener('mousedown', handleLudoPointerDown);
            ludoCanvasEl.removeEventListener('touchstart', handleLudoPointerDown);
        }
        ludoCanvasEl = null;
    }

    function cycleLudoModeAndReset() {
        cycleLudoMode();
        resetLudoGame();
        ludoCpuTier = ludoDifficultyTier(ludoLoadRecord());
        return LUDO_MODE_LABEL[ludoMode];
    }
