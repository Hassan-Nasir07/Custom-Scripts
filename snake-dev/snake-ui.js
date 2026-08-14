    // ═══════════════════════════════════════════════════════════════════
    // SNAKE GAME — RENDER, SKINS, ANIMATION
    // ═══════════════════════════════════════════════════════════════════
    // Everything here is procedural Canvas 2D; there are no image assets. The
    // loop keeps v1's shape — fixed logic tick, accumulator, interpolation from
    // snakePrevSnap, render capped by userPreferences.gameFps — because that
    // part was already right. What is new is that it also drives the death
    // animation, the golden-bite timer and the legendary hue flow, all off the
    // same delta, so none of them need a timer of their own.

    const SNAKE_WALL_PX = 7;   // brick frame thickness, in canvas margin — NOT a grid cell

    let snakeSkinDelegationInit = false;

    // ── Skins ──────────────────────────────────────────────────────────
    // Each skin is a three-colour preset: [primary, secondary, pattern/shade].
    // The first two make the body gradient, the third darkens toward the tail
    // and draws the polka dots or tiger stripes.
    //
    // NOTE: unlocks are a client-side honour system and deliberately NOT
    // enforced anywhere. Anyone willing to edit localStorage can wear any of
    // these; the blast radius is a colour gradient. This is not a security
    // boundary — do not build one on top of it.
    const SNAKE_SKINS = {
        emerald: {
            name: 'Emerald Green', colors: ['#55efc4', '#00b894', '#0a6b52'],
            pattern: 'none',    glow: '#00e676', unlock: null
        },
        ruby: {
            name: 'Ruby Red',     colors: ['#ff9f9f', '#d63031', '#6b0f0f'],
            pattern: 'dots',    glow: '#ff4757', unlock: 'snakeEndless'
        },
        sapphire: {
            name: 'Sapphire Blue', colors: ['#74b9ff', '#0984e3', '#0a3d6b'],
            pattern: 'stripes', glow: '#3498db', unlock: 'snakeWalled'
        },
        gold: {
            name: 'Gold',         colors: ['#ffeaa7', '#fdcb6e', '#8a6410'],
            pattern: 'dots',    glow: '#ffd700', unlock: 'snakeGourmand'
        },
        prism: {
            name: 'Prism',        colors: null,
            pattern: 'stripes', glow: 'dynamic', unlock: 'snakeConqueror', legendary: true
        }
    };

    function snakeSkinUnlocked(id) {
        const skin = SNAKE_SKINS[id];
        if (!skin) return false;
        if (!skin.unlock) return true;
        try { return (userXP.achievements || []).indexOf(skin.unlock) !== -1; }
        catch (_) { return false; }
    }

    // Falls back to emerald when the saved skin is locked, which is what a
    // cloud restore into a fresh profile looks like: prefs come back before the
    // achievements that justify them.
    function snakeActiveSkinId() {
        let id = 'emerald';
        try { id = userPreferences.snakeSkin || 'emerald'; } catch (_) {}
        if (!SNAKE_SKINS[id] || !snakeSkinUnlocked(id)) return 'emerald';
        return id;
    }

    function snakeActiveSkin() { return SNAKE_SKINS[snakeActiveSkinId()]; }

    function snakeSetSkin(id) {
        if (!SNAKE_SKINS[id] || !snakeSkinUnlocked(id)) return;
        try { userPreferences.snakeSkin = id; savePreferences(); } catch (_) {}
        renderSnakeSkinTray();
        drawSnakeGame(1);
    }

    function snakeMixHex(a, b, t) {
        const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
        const ch = sh => {
            const va = (pa >> sh) & 255, vb = (pb >> sh) & 255;
            return Math.round(va + (vb - va) * t);
        };
        return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
    }

    // The legendary's hue wave is the canvas equivalent of the widget's
    // gradientFlow / rgbFlowBacklight keyframes: those scroll background-position
    // across an over-sized gradient, this offsets hue by time and segment index
    // so the same band travels head to tail.
    function snakeSegmentColors(skin, idx, total) {
        if (skin.legendary) {
            const h = ((snakeSkinTime * 60 - idx * 9) % 360 + 360) % 360;
            return [
                'hsl(' + h + ',90%,70%)',
                'hsl(' + ((h + 330) % 360) + ',85%,50%)',
                'hsl(' + ((h + 300) % 360) + ',75%,30%)'
            ];
        }
        const span = Math.max(14, total - 1);
        const t = Math.min(1, idx / span);
        return [
            snakeMixHex(skin.colors[0], skin.colors[2], t * 0.65),
            snakeMixHex(skin.colors[1], skin.colors[2], t * 0.75),
            skin.colors[2]
        ];
    }

    function snakeSkinGlow(skin) {
        if (!skin.legendary) return skin.glow;
        return 'hsl(' + (((snakeSkinTime * 60) % 360 + 360) % 360) + ',95%,60%)';
    }

    // Body thickness before taper and bulges. Slightly under a cell so the
    // grid still reads underneath.
    const snakeBodyRadius = m => m.cs * 0.42;
    // Slightly wider than the body so the head reads as a head, not as the
    // segment that happens to be at the front.
    const snakeHeadRadius = m => m.cs * 0.52;

    // Only the last few segments taper. A body that thins along its whole
    // length reads as a worm; a real snake is even until the tail tip. Ramped
    // rather than stepped — four discrete widths made a visible staircase on a
    // short body.
    const SNAKE_TAIL_SEGMENTS = 3;
    function snakeTaper(idx, total) {
        if (total <= 2) return 1;
        const fromTail = total - 1 - idx;
        if (fromTail >= SNAKE_TAIL_SEGMENTS) return 1;
        return 0.45 + 0.55 * (fromTail / SNAKE_TAIL_SEGMENTS);
    }

    // ── Board geometry ─────────────────────────────────────────────────
    // The brick frame lives in canvas MARGIN, not in grid cells, so the
    // playfield stays 20×20 in every mode and scores set before v2 remain
    // comparable with scores set after it.
    function snakeBoardMetrics() {
        const W = snakeCanvas.width, H = snakeCanvas.height;
        const anySolid = !snakeWrap.left || !snakeWrap.right || !snakeWrap.top || !snakeWrap.bottom;
        const pad = anySolid ? SNAKE_WALL_PX : 0;
        const cs = (Math.min(W, H) - pad * 2) / snakeGridSize;
        return { W, H, pad, cs };
    }

    const snakeCellX = (gx, m) => m.pad + gx * m.cs;
    const snakeCellY = (gy, m) => m.pad + gy * m.cs;

    // ── Frame: bricks on lethal edges, a portal glow on wrapping ones ──
    function snakeDrawFrame(m) {
        const ctx = snakeCtx;
        if (!m.pad) { snakeDrawPortalEdges(m, ['left', 'right', 'top', 'bottom']); return; }

        const open = [];
        const edges = [
            { id: 'left',   x: 0,             y: 0,             w: m.pad,        h: m.H },
            { id: 'right',  x: m.W - m.pad,   y: 0,             w: m.pad,        h: m.H },
            { id: 'top',    x: 0,             y: 0,             w: m.W,          h: m.pad },
            { id: 'bottom', x: 0,             y: m.H - m.pad,   w: m.W,          h: m.pad }
        ];

        edges.forEach(e => {
            if (snakeWrap[e.id]) { open.push(e.id); return; }
            // Mortar bed, then staggered bricks.
            ctx.fillStyle = '#2b1a17';
            ctx.fillRect(e.x, e.y, e.w, e.h);
            const horizontal = e.w > e.h;
            const brick = m.cs * 0.72;
            ctx.fillStyle = '#7a3b2e';
            if (horizontal) {
                for (let i = 0; i * brick < e.w; i++) {
                    const off = (Math.floor(e.y) === 0 ? 0 : brick * 0.5);
                    ctx.fillRect(e.x + i * brick + off + 1, e.y + 1, brick - 2, e.h - 2);
                }
            } else {
                for (let i = 0; i * brick < e.h; i++) {
                    const off = (Math.floor(e.x) === 0 ? 0 : brick * 0.5);
                    ctx.fillRect(e.x + 1, e.y + i * brick + off + 1, e.w - 2, brick - 2);
                }
            }
            // Inner highlight so the frame reads as raised, not painted on.
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            if (horizontal) ctx.fillRect(e.x, Math.floor(e.y) === 0 ? e.h - 1 : e.y, e.w, 1);
            else            ctx.fillRect(Math.floor(e.x) === 0 ? e.w - 1 : e.x, e.y, 1, e.h);
        });

        if (open.length) snakeDrawPortalEdges(m, open);
    }

    // A wrapping edge gets a soft glow instead of bricks, so the rule is
    // readable from the board rather than only from the mode chip.
    function snakeDrawPortalEdges(m, ids) {
        const ctx = snakeCtx;
        const depth = Math.max(4, m.pad || 6);
        ids.forEach(id => {
            const vertical = id === 'left' || id === 'right';
            const x0 = id === 'right'  ? m.W - depth : 0;
            const y0 = id === 'bottom' ? m.H - depth : 0;
            const w = vertical ? depth : m.W;
            const h = vertical ? m.H : depth;
            const g = vertical
                ? ctx.createLinearGradient(x0, 0, x0 + w, 0)
                : ctx.createLinearGradient(0, y0, 0, y0 + h);
            const inward = (id === 'right' || id === 'bottom');
            g.addColorStop(inward ? 1 : 0, 'rgba(108,92,231,0.55)');
            g.addColorStop(inward ? 0 : 1, 'rgba(108,92,231,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x0, y0, w, h);
        });
    }

    function snakeDrawWalls(m) {
        if (!snakeWalls.size) return;
        const ctx = snakeCtx;
        snakeWalls.forEach(key => {
            const parts = key.split(',');
            const px = snakeCellX(+parts[0], m), py = snakeCellY(+parts[1], m);
            ctx.fillStyle = '#3d2723';
            ctx.beginPath(); ctx.roundRect(px, py, m.cs, m.cs, 2); ctx.fill();
            ctx.fillStyle = '#7a3b2e';
            ctx.beginPath(); ctx.roundRect(px + 1.5, py + 1.5, m.cs - 3, m.cs - 3, 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fillRect(px + 1.5, py + 1.5, m.cs - 3, 1.5);
        });
    }

    // ── Food ───────────────────────────────────────────────────────────
    function snakeDrawApple(cx, cy, r, glow) {
        const ctx = snakeCtx;
        ctx.shadowColor = glow; ctx.shadowBlur = 14;
        const fg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
        fg.addColorStop(0, '#ff9f9f'); fg.addColorStop(0.5, '#e17055'); fg.addColorStop(1, '#c0392b');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#55efc4'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + 3, cy - r - 4); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(cx - r * 0.28, cy - r * 0.3, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2);
        ctx.fill();
    }

    // The depleting ring IS the timer — putting it on the bite means the player
    // reads the remaining window where they are already looking, instead of
    // glancing at a HUD counter mid-run.
    function snakeDrawBigFood(m, nowMs) {
        if (!snakeBigFood) return;
        const ctx = snakeCtx;
        const left = snakeBigFoodRemaining(nowMs);
        const cx = snakeCellX(snakeBigFood.x, m) + m.cs / 2;
        const cy = snakeCellY(snakeBigFood.y, m) + m.cs / 2;
        const pulse = 1 + Math.sin(snakeSkinTime * 7) * 0.07;
        const r = (m.cs / 2 - 1.5) * pulse;

        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18;
        const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 1, cx, cy, r);
        g.addColorStop(0, '#fff6c8'); g.addColorStop(0.45, '#ffd700'); g.addColorStop(1, '#b8860b');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(cx - r * 0.3, cy - r * 0.32, r * 0.3, r * 0.19, -0.6, 0, Math.PI * 2);
        ctx.fill();

        // Ring runs down clockwise from 12 o'clock and reddens as it empties.
        ctx.strokeStyle = left > 0.35 ? 'rgba(255,255,255,0.85)' : 'rgba(255,90,90,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        ctx.stroke();

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.font = 'bold ' + Math.round(m.cs * 0.42) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('3×', cx, cy + 0.5);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }

    // ── Snake ──────────────────────────────────────────────────────────
    // How swollen segment `idx` is right now. Lumps advance one index per tick
    // and are interpolated by `t` so they glide rather than hop.
    function snakeBulgeScale(idx, t) {
        let extra = 0;
        for (let i = 0; i < snakeBulges.length; i++) {
            const b = snakeBulges[i];
            const d = Math.abs((b.pos + t) - idx);
            if (d < 1.6) extra = Math.max(extra, (1 - d / 1.6) * (b.size ? 0.45 : 0.28));
        }
        return 1 + extra;
    }

    // A wrapped segment must not be lerped across the whole board — that would
    // drag it visibly back over the playfield in a single frame. Snap it to the
    // destination rather than holding it at the source: the portal jump then
    // happens as the segment enters the edge and the rest of the body follows
    // it through, instead of the segment waiting a whole tick and teleporting.
    function snakeLerpSeg(prev, seg, t, m) {
        const dx = seg.x - prev.x, dy = seg.y - prev.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            return { px: snakeCellX(seg.x, m), py: snakeCellY(seg.y, m) };
        }
        return {
            px: snakeCellX(prev.x + dx * t, m),
            py: snakeCellY(prev.y + dy * t, m)
        };
    }

    // Interpolated centre of every segment, plus the runs they form. A run
    // breaks wherever two consecutive segments aren't grid-adjacent, i.e. across
    // a portal edge — drawing one continuous stroke through that gap would put a
    // bar straight across the board.
    function snakeCenters(m, t) {
        const eff = snakeDying ? 1 : t;
        return snakeBody.map((seg, idx) => {
            const prev = snakePrevSnap[idx] || seg;
            const p = snakeLerpSeg(prev, seg, eff, m);
            return { x: p.px + m.cs / 2, y: p.py + m.cs / 2, idx };
        });
    }

    function snakeRuns(centers) {
        if (!centers.length) return [];
        const runs = [];
        let cur = [centers[0]];
        for (let i = 1; i < centers.length; i++) {
            const a = snakeBody[i - 1], b = snakeBody[i];
            const adjacent = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
            if (adjacent) cur.push(centers[i]);
            else { runs.push(cur); cur = [centers[i]]; }
        }
        runs.push(cur);
        return runs;
    }

    // Banding rather than a tile pattern: a per-cell motif looked like a row of
    // stamped squares once the body became continuous. Real snakes band across
    // the body, so dots sit on the spine and stripes run perpendicular to it.
    function snakeDrawBanding(runs, skin, radiusFor, total) {
        if (skin.pattern === 'none') return;
        const ctx = snakeCtx;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.lineCap = 'butt';
        runs.forEach(run => {
            run.forEach((pt, k) => {
                if (pt.idx === 0 || pt.idx % 2) return;   // skip the head, band alternately
                const r = radiusFor(pt.idx);
                if (r < 1.5) return;
                ctx.fillStyle = ctx.strokeStyle = snakeSegmentColors(skin, pt.idx, total)[2];
                if (skin.pattern === 'dots') {
                    ctx.beginPath(); ctx.arc(pt.x, pt.y, r * 0.44, 0, Math.PI * 2); ctx.fill();
                } else {
                    // Perpendicular to the local direction of travel, kept just
                    // inside the radius so it can't overhang on a corner.
                    const a = run[k - 1] || run[k + 1] || pt;
                    const b = run[k + 1] || run[k - 1] || pt;
                    let dx = b.x - a.x, dy = b.y - a.y;
                    const len = Math.hypot(dx, dy) || 1;
                    dx /= len; dy /= len;
                    ctx.lineWidth = r * 0.55;
                    ctx.beginPath();
                    ctx.moveTo(pt.x + dy * r * 0.82, pt.y - dx * r * 0.82);
                    ctx.lineTo(pt.x - dy * r * 0.82, pt.y + dx * r * 0.82);
                    ctx.stroke();
                }
            });
        });
        ctx.restore();
    }

    // Is the head about to bite something? Drives how far the jaws open, so the
    // mouth shuts exactly as the head arrives on the food.
    function snakeBiteOpen(t) {
        if (snakeDying || !snakeMoving) return 0;
        const step = snakeStepCell(snakeBody[0], snakeDir);
        if (!step.ok) return 0;
        const onFood = step.x === snakeFood.x && step.y === snakeFood.y;
        const onBig  = !!snakeBigFood && step.x === snakeBigFood.x && step.y === snakeBigFood.y;
        if (!onFood && !onBig) return 0;
        return Math.min(1, 0.35 + t * 0.65);
    }

    function snakeDrawHead(cx, cy, m, colors, skin, open, alpha) {
        const ctx = snakeCtx;
        const r = snakeHeadRadius(m);
        const gap = open * r * 0.42;   // beyond this the jaws read as two thin slabs

        ctx.save();
        ctx.translate(cx, cy);
        if (snakeDir.x || snakeDir.y) ctx.rotate(Math.atan2(snakeDir.y, snakeDir.x));

        // Tongue first so the head overlaps its root. It retracts as the jaws
        // open — a snake about to bite isn't tasting the air.
        if (open < 0.45) {
            const flick = 0.5 + 0.5 * Math.sin(snakeSkinTime * 8);
            const len = r * (0.5 + 0.6 * flick) * (1 - open / 0.45);
            if (len > 1) {
                ctx.strokeStyle = '#ff2e5b';
                ctx.lineWidth = Math.max(1.4, r * 0.19);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(r * 0.55, 0);
                ctx.lineTo(r + len, 0);
                ctx.stroke();
                // Fork, drawn as its own pair so the join stays sharp.
                const fx = r + len, fl = Math.max(2.5, r * 0.42);
                ctx.beginPath();
                ctx.moveTo(fx, 0); ctx.lineTo(fx + fl, -fl * 0.85);
                ctx.moveTo(fx, 0); ctx.lineTo(fx + fl,  fl * 0.85);
                ctx.stroke();
            }
        }

        const hg = ctx.createLinearGradient(-r, -r, r, r);
        hg.addColorStop(0, colors[0]);
        hg.addColorStop(1, colors[1]);

        ctx.shadowColor = snakeSkinGlow(skin);
        ctx.shadowBlur = 9 * alpha;

        if (gap < 0.5) {
            // Closed: one rounded head. The large corner radius is what stops
            // it reading as the stamped square v1 drew.
            ctx.fillStyle = hg;
            ctx.beginPath();
            ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.78);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.shadowBlur = 0;
            // Mouth interior, drawn before the jaws so they frame it.
            ctx.fillStyle = '#5c1a2a';
            ctx.beginPath();
            ctx.moveTo(-r * 0.1, 0);
            ctx.lineTo(r * 1.05, -gap * 1.7);
            ctx.lineTo(r * 1.05,  gap * 1.7);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = hg;
            ctx.beginPath(); ctx.roundRect(-r, -r,  r * 2, r - gap, r * 0.62); ctx.fill();
            ctx.beginPath(); ctx.roundRect(-r, gap, r * 2, r - gap, r * 0.62); ctx.fill();
        }

        // One eye per jaw, mirrored about the travel axis, so they part with the
        // mouth instead of sliding across it.
        const ex = r * 0.28;
        const eyeY = r * 0.45 + gap * 0.55;
        const eyeR = Math.max(1.6, r * 0.24);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex, -eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex,  eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + eyeR * 0.34, -eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + eyeR * 0.34,  eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }

    // The body is stroked as a continuous rounded path rather than one rounded
    // square per cell. v1's per-cell squares left visible gaps on every turn and
    // made a one-segment snake look like a stray glyph; round joins and caps
    // give a single unbroken creature at any length.
    function snakeDrawBody(m, t) {
        const ctx = snakeCtx;
        const skin = snakeActiveSkin();
        const total = snakeBody.length;
        if (!total) return;

        // Death: blink for 900ms, then fade. Both phases run off snakeDeathT,
        // which the render loop advances — no extra timer.
        let alpha = 1, visible = true;
        if (snakeDying) {
            if (snakeDeathT < SNAKE_BLINK_MS) {
                visible = Math.floor(snakeDeathT / 90) % 2 === 0;
            } else {
                alpha = Math.max(0, 1 - (snakeDeathT - SNAKE_BLINK_MS) / (SNAKE_DEATH_MS - SNAKE_BLINK_MS));
            }
        }
        if (!visible) return;

        const eff = snakeDying ? 1 : t;
        const centers = snakeCenters(m, t);
        const runs = snakeRuns(centers);
        const base = snakeBodyRadius(m);
        // The swallowed lump now swells the body itself, which is the whole
        // point of tracking bulges — v1 could only nudge a square's inset.
        const radiusFor = idx => base * snakeTaper(idx, total) * snakeBulgeScale(idx, eff);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Tail first so each headward segment paints over the last — that
        // overlap is what makes per-segment colour look like one gradient body.
        runs.forEach(run => {
            for (let k = run.length - 1; k >= 0; k--) {
                const pt = run[k];
                if (pt.idx === 0) continue;               // head drawn separately
                const colors = snakeSegmentColors(skin, pt.idx, total);
                const r = radiusFor(pt.idx);
                const next = run[k - 1];                  // toward the head
                // Link and joint share one colour. Using the two gradient stops
                // made every joint a visibly darker bead, so the body read as a
                // chain of circles rather than one tube.
                ctx.fillStyle = ctx.strokeStyle = colors[0];
                if (next) {
                    // Average the two ends' radii. Stroking at one end's width
                    // stepped the outline wherever the radius changed, which
                    // turned every swallowed lump and the tail taper into a
                    // staircase instead of a curve.
                    ctx.lineWidth = r + radiusFor(next.idx);
                    ctx.beginPath();
                    ctx.moveTo(pt.x, pt.y);
                    ctx.lineTo(next.x, next.y);
                    ctx.stroke();
                }
                // The joint circle is what rounds the corner on a turn.
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        snakeDrawBanding(runs, skin, radiusFor, total);

        const head = centers[0];
        snakeDrawHead(head.x, head.y, m,
                      snakeSegmentColors(skin, 0, total), skin, snakeBiteOpen(t), alpha);

        ctx.restore();

        // Where it went wrong, flashing under the blink.
        if (snakeDying && snakeDeathCell && snakeDeathT < SNAKE_BLINK_MS) {
            const gx = Math.max(0, Math.min(snakeGridSize - 1, snakeDeathCell.x));
            const gy = Math.max(0, Math.min(snakeGridSize - 1, snakeDeathCell.y));
            ctx.save();
            ctx.globalAlpha = 0.55 * (1 - snakeDeathT / SNAKE_BLINK_MS);
            ctx.fillStyle = '#ff3b3b';
            ctx.beginPath();
            ctx.roundRect(snakeCellX(gx, m), snakeCellY(gy, m), m.cs, m.cs, 3);
            ctx.fill();
            ctx.restore();
        }
    }

    // ── Overlays ───────────────────────────────────────────────────────
    function snakeDrawBanner(m) {
        if (snakeBannerT <= 0 || !snakeBannerText) return;
        const ctx = snakeCtx;
        const p = snakeBannerT / SNAKE_BANNER_MS;
        const ease = p > 0.8 ? (1 - p) / 0.2 : Math.min(1, p / 0.25);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, ease));
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.beginPath(); ctx.roundRect(m.W * 0.08, m.H * 0.42, m.W * 0.84, m.H * 0.16, 10); ctx.fill();
        ctx.fillStyle = '#ffeaa7';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(snakeBannerText, m.W / 2, m.H * 0.5);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    function snakeDrawPaused(m) {
        if (!snakeGamePaused || snakeDying) return;
        const ctx = snakeCtx;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, m.W, m.H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⏸ Paused', m.W / 2, m.H / 2 - 8);
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('press P or ▶ to resume', m.W / 2, m.H / 2 + 16);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    function snakeDrawProgressBar(m) {
        const ctx = snakeCtx;
        const y = m.H - 3;
        let frac, hue;
        if (snakeMode === 'levels') {
            const stage = SNAKE_STAGES[snakeStageIdx];
            frac = stage ? Math.min(1, snakeStageEaten / stage.goal) : 0;
            hue = 45;
        } else {
            frac = Math.min(1, snakeScore / 30);
            hue = 140 - frac * 80;
        }
        ctx.fillStyle = 'rgba(0,230,118,0.10)';
        ctx.fillRect(0, y, m.W, 3);
        ctx.fillStyle = 'hsl(' + hue + ',100%,55%)';
        ctx.fillRect(0, y, m.W * frac, 3);
    }

    // ── Frame ──────────────────────────────────────────────────────────
    function drawSnakeGame(t = 1) {
        if (!snakeCtx) return;
        const ctx = snakeCtx;
        const m = snakeBoardMetrics();
        const now = performance.now();

        ctx.fillStyle = '#0b1a12';
        ctx.fillRect(0, 0, m.W, m.H);

        ctx.strokeStyle = 'rgba(0,255,120,0.04)';
        ctx.lineWidth = 0.5;
        for (let i = 1; i < snakeGridSize; i++) {
            const gx = snakeCellX(i, m), gy = snakeCellY(i, m);
            ctx.beginPath(); ctx.moveTo(gx, m.pad); ctx.lineTo(gx, m.H - m.pad); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(m.pad, gy); ctx.lineTo(m.W - m.pad, gy); ctx.stroke();
        }

        snakeDrawFrame(m);
        snakeDrawWalls(m);

        snakeDrawApple(
            snakeCellX(snakeFood.x, m) + m.cs / 2,
            snakeCellY(snakeFood.y, m) + m.cs / 2,
            m.cs / 2 - 2,
            '#ff6b6b'
        );
        snakeDrawBigFood(m, now);
        snakeDrawBody(m, t);
        snakeDrawProgressBar(m);
        snakeDrawBanner(m);
        snakeDrawPaused(m);
    }

    // ── Loop ───────────────────────────────────────────────────────────
    function snakeRenderLoop(timestamp) {
        if (!snakeGameRunning) return;
        snakeAnimFrame = requestAnimationFrame(snakeRenderLoop);

        if (!snakeLastTickMs) snakeLastTickMs = timestamp;
        // Clamped: coming back from a background tab hands us a delta of many
        // seconds, and an unclamped accumulator would then run hundreds of ticks
        // in one frame — the snake dies instantly through no fault of the player.
        const delta = Math.min(250, timestamp - snakeLastTickMs);
        snakeLastTickMs = timestamp;

        snakeSkinTime += delta / 1000;
        if (snakeBannerT > 0) snakeBannerT = Math.max(0, snakeBannerT - delta);

        if (snakeDying) {
            snakeDeathT += delta;
            if (snakeDeathT >= SNAKE_DEATH_MS) {
                drawSnakeGame(1);
                snakeFinalizeDeath();
                return;
            }
        } else if (!snakeGamePaused) {
            snakeAccumulatorMs += delta;
            while (snakeAccumulatorMs >= snakeTickInterval && snakeGameRunning && !snakeDying) {
                snakeTick();
                snakeAccumulatorMs -= snakeTickInterval;
            }
        }

        const renderElapsed = timestamp - snakeLastRenderMs;
        if (renderElapsed < getFrameInterval()) return;
        snakeLastRenderMs = timestamp - (renderElapsed % getFrameInterval());

        const t = snakeDying ? 1 : Math.min(1, snakeAccumulatorMs / snakeTickInterval);
        drawSnakeGame(t);
    }

    // ── Panel chrome ───────────────────────────────────────────────────
    function showSnakeGameOver() {
        const el = document.getElementById('snake-game-over');
        if (!el) return;
        el.classList.add('active');
        const score = el.querySelector('.final-score');
        if (score) score.textContent = snakeScore;
        const sub = el.querySelector('.snake-go-sub');
        if (sub) {
            sub.textContent = snakeMode === 'levels'
                ? 'Stage ' + (snakeStageIdx + 1) + '/' + SNAKE_STAGES.length +
                  ' · ' + snakeStagesCleared + ' cleared'
                : SNAKE_MODE_META[snakeMode].icon + ' ' + SNAKE_MODE_META[snakeMode].label +
                  ' · best ' + snakeModeBest(snakeMode);
        }
    }

    function hideSnakeGameOver() {
        const el = document.getElementById('snake-game-over');
        if (el) el.classList.remove('active');
    }

    // "Best:" and "Score:" were two of four chips fighting over one header row.
    // The pair now lives inside the button that opens this mode's leaderboard —
    // the number you just scored and the number to beat belong next to the list
    // of numbers to beat.
    // The stage readout rides the mode chip rather than the canvas. On the board
    // it was drawn top-left, which is inside the playfield — the snake spawns
    // and travels through exactly that corner, so the label sat on top of the
    // gameplay. The chip has room because the mode name is already on the button
    // below it, so the chip can spend its width on the stage instead.
    function updateSnakeScoreDisplay() {
        const mode = document.getElementById('snake-mode-chip');
        const best = snakeModeBest(snakeMode);
        if (mode) {
            const meta = SNAKE_MODE_META[snakeMode];
            if (snakeMode === 'levels') {
                const stage = SNAKE_STAGES[snakeStageIdx];
                mode.textContent = meta.icon + ' Stage ' + (snakeStageIdx + 1) + '/' + SNAKE_STAGES.length;
                mode.title = stage
                    ? 'Stage ' + (snakeStageIdx + 1) + ' — ' + stage.name +
                      ' · ' + snakeStageEaten + '/' + stage.goal + ' eaten'
                    : meta.desc;
            } else {
                mode.textContent = meta.icon + ' ' + meta.label;
                mode.title = meta.desc;
            }
        }

        if (typeof updateGameScoreBtn === 'function') {
            updateGameScoreBtn('snake', snakeScore, best);
        } else {
            // Standalone (headless / preview): no host helper to lean on.
            const score = document.getElementById('snake-current-score');
            const high  = document.getElementById('snake-high-score');
            if (score) score.textContent = snakeScore;
            if (high)  high.textContent  = best;
        }
    }

    // The in-game leaderboard overlay is generic and lives in the host — every
    // game panel opens the same element. Snake only has to say which mode it is
    // currently showing, which gameLbMode() reads straight off snakeMode.

    function updateSnakePlayButton() {
        const btn = document.getElementById('snake-play-btn');
        if (!btn) return;
        btn.textContent = (!snakeGameRunning || snakeGamePaused) ? '▶ Play' : '⏸ Pause';
    }

    function updateSnakeModeButton() {
        const btn = document.getElementById('snake-mode-btn');
        if (btn) {
            btn.textContent = SNAKE_MODE_META[snakeMode].icon + ' ' + SNAKE_MODE_META[snakeMode].label;
            btn.title = SNAKE_MODE_META[snakeMode].desc;
        }
        updateSnakeScoreDisplay();
    }

    // ── Skin tray ──────────────────────────────────────────────────────
    // Swatches are pure CSS so the tray costs no canvas work: repeating
    // gradients for the two patterns, and the widget's own gradientFlow
    // keyframe for the legendary.
    function snakeSwatchStyle(id) {
        const skin = SNAKE_SKINS[id];
        if (skin.legendary) {
            return 'background:linear-gradient(90deg,#ff5f6d,#ffc371,#47e5bc,#5b7cfa,#c56cf0,#ff5f6d);' +
                   'background-size:300% 100%;animation:gradientFlow 3s linear infinite;';
        }
        const base = 'background-image:' + (
            skin.pattern === 'dots'
                ? 'radial-gradient(' + skin.colors[2] + ' 22%, transparent 23%),' +
                  'radial-gradient(' + skin.colors[2] + ' 22%, transparent 23%),'
                : skin.pattern === 'stripes'
                    ? 'repeating-linear-gradient(115deg,' + skin.colors[2] + ' 0 4px, transparent 4px 11px),'
                    : ''
        ) + 'linear-gradient(135deg,' + skin.colors[0] + ',' + skin.colors[1] + ');';
        const extra = skin.pattern === 'dots'
            ? 'background-size:12px 12px,12px 12px,100% 100%;background-position:0 0,6px 6px,0 0;'
            : '';
        return base + extra;
    }

    function renderSnakeSkinTray() {
        const tray = document.getElementById('snake-skin-tray');
        if (!tray) return;
        const activeId = snakeActiveSkinId();
        tray.innerHTML =
            '<div class="snake-skin-title">🎨 Snake Skins</div>' +
            '<div class="snake-skin-grid">' +
            Object.keys(SNAKE_SKINS).map(id => {
                const skin = SNAKE_SKINS[id];
                const unlocked = snakeSkinUnlocked(id);
                const ach = skin.unlock && typeof ACHIEVEMENTS === 'object' ? ACHIEVEMENTS[skin.unlock] : null;
                const hint = unlocked
                    ? (skin.legendary ? 'Legendary' : 'Unlocked')
                    : (ach ? ach.icon + ' ' + ach.name : 'Locked');
                return '<button class="snake-skin-card' +
                    (unlocked ? '' : ' locked') + (id === activeId ? ' active' : '') +
                    '" data-snake-skin="' + id + '"' + (unlocked ? '' : ' disabled') +
                    ' title="' + escapeHtml(skin.name + ' — ' + hint) + '">' +
                    '<span class="snake-skin-swatch" style="' + snakeSwatchStyle(id) + '">' +
                    (unlocked ? '' : '🔒') + '</span>' +
                    '<span class="snake-skin-name">' + escapeHtml(skin.name) + '</span>' +
                    '<span class="snake-skin-hint">' + escapeHtml(hint) + '</span>' +
                    '</button>';
            }).join('') +
            '</div>';
    }

    function toggleSnakeSkinTray(force) {
        const tray = document.getElementById('snake-skin-tray');
        if (!tray) return;
        const show = (typeof force === 'boolean') ? force : tray.style.display === 'none' || !tray.style.display;
        // The tray and the leaderboard overlay share this corner of the panel.
        if (show) {
            renderSnakeSkinTray();
            if (typeof toggleGameLeaderboard === 'function') toggleGameLeaderboard('snake', false);
        }
        tray.style.display = show ? 'block' : 'none';
    }

    // ── Init ───────────────────────────────────────────────────────────
    function initSnakeGame() {
        snakeCanvas = document.getElementById('snake-canvas');
        if (!snakeCanvas) return;
        snakeCtx = snakeCanvas.getContext('2d');

        snakeMigrateStorage();
        try {
            if (SNAKE_MODES.indexOf(userPreferences.snakeMode) !== -1) snakeMode = userPreferences.snakeMode;
        } catch (_) {}

        snakeHighScore = snakeModeBest(snakeMode);

        // Delegated once — the tray is re-rendered on every open, so a listener
        // per card would leak one set per toggle.
        if (!snakeSkinDelegationInit) {
            snakeSkinDelegationInit = true;
            document.addEventListener('click', (e) => {
                const card = e.target.closest && e.target.closest('[data-snake-skin]');
                if (card && !card.disabled) snakeSetSkin(card.getAttribute('data-snake-skin'));
            });
        }

        document.addEventListener('keydown', handleSnakeKeyPress);
        document.addEventListener('visibilitychange', handleSnakeVisibility);

        updateSnakeModeButton();
        renderSnakeSkinTray();
        resetSnakeGame();
    }
