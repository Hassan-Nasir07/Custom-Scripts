    // ============================================================
    // CYBERPUNK HUD — tokens, panel shape, contrast guard, boot-in
    //
    // Generated from cyber-dev/cyber-hud.js. Do not edit the copy in the
    // userscript; edit here and run node cyber-dev/reinsert.js.
    //
    // A block of the userscript's IIFE body with no exports; cyber-dev/load.js
    // wraps it in a Function for testing. Function declarations hoist, so
    // applyPreferences() can call in wherever this block lands.
    // ============================================================

    // Panel geometries, most-cyberpunk first. Unknown values fall back to
    // 'notched' (the asymmetric default) so the container always has a shape
    // class; without one, --rt-radius and --rt-clip are never set.
    const CYBER_PANEL_SHAPES = ['notched', 'chamfered', 'stepped', 'rounded'];

    // ------------------------------------------------------------------
    // The token map: pref name -> the CSS custom properties it drives.
    //
    // ONE list drives both writing and teardown, so the two cannot drift.
    // 'rgb' also emits "r, g, b" for use inside rgba(var(--x-rgb), a).
    // 'rgbName' states that property's name where varName + '-rgb' would be
    // wrong: the CSS reads --rt-glow-rgb / --rt-border-rgb, not
    // --rt-*-color-rgb. Section H2 of cyber-verify.js checks JS against CSS.
    // ------------------------------------------------------------------
    const CYBER_TOKENS = [
        // -- STRUCTURE --
        { pref: 'cyberBgPrimary',   varName: '--rt-bg-1',        fallback: '#07091a' },
        { pref: 'cyberBgSecondary', varName: '--rt-bg-2',        fallback: '#11142b' },
        // -- ACCENTS --
        { pref: 'cyberAccent',      varName: '--rt-accent',      fallback: '#fff200', rgb: true },
        { pref: 'cyberHighlight',   varName: '--rt-cyber-hl',    fallback: '#00e5ff', rgb: true },
        // No 'rgb': nothing consumes var(--rt-cyber-panel-rgb).
        { pref: 'cyberPanelTint',   varName: '--rt-cyber-panel', fallback: '#00e5ff' },
        // -- LEGIBILITY: never linked to an accent or background, or a dark
        //    pick puts dark text on a dark panel with no way to undo it.
        { pref: 'cyberText',        varName: '--rt-text',         fallback: '#fff200', rgb: true },
        { pref: 'cyberGlow',        varName: '--rt-glow-color',   fallback: '#fff200', rgb: true,
          rgbName: '--rt-glow-rgb' },
        { pref: 'cyberBorder',      varName: '--rt-border-color', fallback: '#fff200', rgb: true,
          rgbName: '--rt-border-rgb' }
    ];

    // Single source of the -rgb name for write and teardown; if they disagree,
    // teardown leaves a token behind that bleeds into Glassmorphic.
    function cyberRgbVarName(t) {
        return t.rgbName || t.varName + '-rgb';
    }

    // Every property name this subsystem may have written, for teardown.
    function cyberTokenVarNames() {
        const names = [];
        CYBER_TOKENS.forEach(function (t) {
            names.push(t.varName);
            if (t.rgb) names.push(cyberRgbVarName(t));
        });
        names.push('--rt-glow-mul');
        names.push('--rt-glow-k');
        return names;
    }

    // Writes the token set onto the widget, documentElement (so body-level
    // modal rules resolve) or the PiP clone.
    function applyCyberTokens(el) {
        if (!el || !el.style) return;
        CYBER_TOKENS.forEach(function (t) {
            const hex = userPreferences[t.pref] || t.fallback;
            el.style.setProperty(t.varName, hex);
            if (t.rgb) el.style.setProperty(cyberRgbVarName(t), hexToRgbStr(hex));
        });
        // GLOW. --rt-glow-mul is the raw stored preference; --rt-glow-k is the
        // clamped value the stylesheet multiplies by. Written here, not derived
        // in CSS, because the body-level settings modal cannot see properties
        // declared inside .retro-theme, only what is mirrored onto
        // documentElement.
        const mul = userPreferences.cyberGlowIntensity;
        const safeMul = mul === undefined ? CYBER_GLOW_DEFAULT : Number(mul);
        el.style.setProperty('--rt-glow-mul', String(safeMul));
        el.style.setProperty('--rt-glow-k', String(cyberGlowScale(safeMul)));
    }

    // Removes every property applyCyberTokens could have set. Leftovers bleed
    // into Glassmorphic, where inline tokens still win over the stylesheet.
    function clearCyberTokens(el) {
        if (!el || !el.style) return;
        cyberTokenVarNames().forEach(function (p) { el.style.removeProperty(p); });
    }

    // ------------------------------------------------------------------
    // Glow scale: the slider value IS the scale, 0 (off) to 1 (full). The
    // CSS scales radius as well as alpha, from large layered base radii, so
    // the whole range does visible work. See --rt-glow in cyber-theme.css.
    // ------------------------------------------------------------------
    const CYBER_GLOW_DEFAULT = 0.6;
    const CYBER_GLOW_MAX_PCT = 100;

    // Guarded: a NaN would invalidate every glow declaration at once.
    function cyberGlowScale(mul) {
        const m = Number(mul);
        if (!isFinite(m) || m < 0) return CYBER_GLOW_DEFAULT;
        return Math.min(1, m);
    }

    function cyberGlowToPct(mul) {
        return Math.round(cyberGlowScale(mul === undefined ? CYBER_GLOW_DEFAULT : mul) * 100);
    }

    function cyberGlowFromPct(pct) {
        const p = parseInt(pct, 10);
        if (isNaN(p)) return CYBER_GLOW_DEFAULT;
        return Math.max(0, Math.min(CYBER_GLOW_MAX_PCT, p)) / 100;
    }

    // ------------------------------------------------------------------
    // Panel shape
    // ------------------------------------------------------------------
    function cyberPanelShape() {
        const s = userPreferences.cyberPanelShape;
        // Fallback must match the shape the bare .retro-theme block declares.
        return CYBER_PANEL_SHAPES.indexOf(s) === -1 ? 'notched' : s;
    }

    function applyCyberShape(el) {
        if (!el || !el.classList) return;
        CYBER_PANEL_SHAPES.forEach(function (s) { el.classList.remove('rt-shape-' + s); });
        el.classList.add('rt-shape-' + cyberPanelShape());
    }

    function clearCyberShape(el) {
        if (!el || !el.classList) return;
        CYBER_PANEL_SHAPES.forEach(function (s) { el.classList.remove('rt-shape-' + s); });
    }

    // ------------------------------------------------------------------
    // Contrast guard. Warns, never corrects: overriding a colour the user
    // chose would fight them while they are still picking a palette.
    // ------------------------------------------------------------------

    // WCAG relative luminance; hexToRgbStr stays the only hex parser.
    function relativeLuminance(hex) {
        const parts = hexToRgbStr(hex).split(',').map(function (n) {
            const c = parseInt(n, 10) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
    }

    function contrastRatio(hexA, hexB) {
        const a = relativeLuminance(hexA);
        const b = relativeLuminance(hexB);
        const hi = Math.max(a, b);
        const lo = Math.min(a, b);
        return (hi + 0.05) / (lo + 0.05);
    }

    // EVERY SWATCH THAT CARRIES TYPE IS MEASURED. cyber-verify.js (C2) fails
    // if the CSS colours type with a swatch missing from this list, so a new
    // coloured readout must add its swatch here. Each is checked against the
    // darker background stop, the worst case along the gradient.
    const CYBER_TEXT_SWATCHES = [
        { pref: 'cyberText',      label: 'Text',      fallback: '#fff200' },
        { pref: 'cyberAccent',    label: 'Accent',    fallback: '#fff200' },
        { pref: 'cyberHighlight', label: 'Highlight', fallback: '#00e5ff' }
    ];

    function cyberSwatchContrast(pref, fallback) {
        const hex = userPreferences[pref] || fallback;
        const bg1 = userPreferences.cyberBgPrimary || '#07091a';
        const bg2 = userPreferences.cyberBgSecondary || '#11142b';
        return Math.min(contrastRatio(hex, bg1), contrastRatio(hex, bg2));
    }

    // Text alone; the chip reports the worst swatch.
    function cyberTextContrast() {
        return cyberSwatchContrast('cyberText', '#fff200');
    }

    // The worst offender, by name, so the warning is actionable.
    function cyberWorstContrast() {
        let worst = null;
        CYBER_TEXT_SWATCHES.forEach(function (s) {
            const ratio = cyberSwatchContrast(s.pref, s.fallback);
            if (!worst || ratio < worst.ratio) worst = { ratio: ratio, label: s.label };
        });
        return worst;
    }

    // Repaints the Cyberpunk Colors chip; no-op while the modal is closed.
    function updateCyberContrastChip(root) {
        const scope = root || document;
        const chip = scope.querySelector('.cyber-contrast-chip');
        if (!chip) return;
        const worst = cyberWorstContrast();
        const ratio = worst.ratio;
        const shown = (Math.round(ratio * 10) / 10).toFixed(1);
        let cls = 'is-pass';
        let note = 'AA';
        if (ratio < 3) { cls = 'is-fail'; note = 'too low'; }
        else if (ratio < 4.5) { cls = 'is-warn'; note = 'large text only'; }
        chip.className = 'cyber-contrast-chip ' + cls;
        chip.textContent = worst.label + ' vs BG ' + shown + ':1 · ' + note;
        chip.title = 'WCAG contrast against the darker background stop, for the ' +
                     'worst of the swatches that colour text (Text, Accent, ' +
                     'Highlight). This is a warning only — nothing is changed for you.';
    }

    // ------------------------------------------------------------------
    // Title glitch ghosts: pseudo-elements using content: attr(data-rt-text),
    // so the title text is mirrored onto the attribute. Without it they
    // render empty, which degrades to a plain title.
    // ------------------------------------------------------------------
    function updateCyberTitleGhosts(container) {
        const root = container || document.getElementById('total-time-summary');
        if (!root) return;
        const title = root.querySelector('.summary-title');
        if (!title) return;
        // textContent: the decorative ghosts must never reproduce markup.
        const text = (title.textContent || '').trim();
        if (text) title.setAttribute('data-rt-text', text);
        else title.removeAttribute('data-rt-text');
    }

    // ------------------------------------------------------------------
    // Boot-in scan reveal. The class comes off on a timer: re-adding a class
    // that is already present does not restart a CSS animation.
    // ------------------------------------------------------------------
    let cyberBootTimer = null;

    function triggerCyberBoot(container) {
        const root = container || document.getElementById('total-time-summary');
        if (!root || !root.classList.contains('retro-theme')) return;
        root.classList.remove('rt-booting');
        // Forced reflow so remove + re-add in one frame still restarts it.
        void root.offsetWidth;
        root.classList.add('rt-booting');
        if (cyberBootTimer) clearTimeout(cyberBootTimer);
        // Longest stagger (140ms) + duration (520ms), plus a small margin.
        cyberBootTimer = setTimeout(function () {
            root.classList.remove('rt-booting');
            cyberBootTimer = null;
        }, 760);
    }

    // ------------------------------------------------------------------
    // PALETTES: six built-in swatch sets, defined once and shared by the
    // settings modal and the dev harness. Each is a complete hand-picked set
    // of all eight swatches, never derived from one seed hue, and each must
    // pass the contrast guard (section H4).
    // ------------------------------------------------------------------
    const CYBER_PALETTES = {
        yellowCyan:  { label: 'Yellow / Cyan', cyberBgPrimary: '#07091a', cyberBgSecondary: '#11142b',
                       cyberAccent: '#fff200', cyberHighlight: '#00e5ff', cyberPanelTint: '#00e5ff',
                       cyberText: '#fff200', cyberGlow: '#fff200', cyberBorder: '#fff200' },
        bladeAmber:  { label: 'Blade Amber', cyberBgPrimary: '#0b0705', cyberBgSecondary: '#1c1209',
                       cyberAccent: '#ffa227', cyberHighlight: '#ffd08a', cyberPanelTint: '#c9741f',
                       cyberText: '#ffcf9b', cyberGlow: '#ff8c1a', cyberBorder: '#e2872b' },
        magentaNoir: { label: 'Magenta Noir', cyberBgPrimary: '#0a0512', cyberBgSecondary: '#170a26',
                       cyberAccent: '#ff2a6d', cyberHighlight: '#d16bff', cyberPanelTint: '#8a2be2',
                       cyberText: '#ffd6e8', cyberGlow: '#ff2a6d', cyberBorder: '#ff5c94' },
        acidGreen:   { label: 'Acid Green', cyberBgPrimary: '#04100a', cyberBgSecondary: '#082114',
                       cyberAccent: '#05ffa1', cyberHighlight: '#b4ff3a', cyberPanelTint: '#00c98a',
                       cyberText: '#c8ffe6', cyberGlow: '#05ffa1', cyberBorder: '#3affb0' },
        ghostMono:   { label: 'Ghost Mono', cyberBgPrimary: '#0c0c0f', cyberBgSecondary: '#16161c',
                       cyberAccent: '#9aa4b8', cyberHighlight: '#e6ebf5', cyberPanelTint: '#6b7488',
                       cyberText: '#eef2fa', cyberGlow: '#c3ccdd', cyberBorder: '#7d879c' },
        // A real choice; the deliberately failing palette lives only in the
        // dev harness.
        violetHaze:  { label: 'Violet Haze', cyberBgPrimary: '#0b0616', cyberBgSecondary: '#180d2c',
                       cyberAccent: '#c88bf5', cyberHighlight: '#e3b8ff', cyberPanelTint: '#7c3aed',
                       cyberText: '#ecdcff', cyberGlow: '#c77dff', cyberBorder: '#9d4edd' }
    };

    // ------------------------------------------------------------------
    // EMOJI TINT
    //
    // Colour emoji ignore CSS `color`, but an SVG filter reaches them:
    // desaturate to luminance, then map it through a ramp built from the
    // theme hue, keeping silhouette and shading.
    //
    // SVG rather than a CSS filter chain: sepia()/hue-rotate() recipes only
    // approximate an arbitrary hex and drift on dark picks, while
    // feComponentTransfer takes the channel values directly. Three ramp
    // stops, not two: a plain duotone crushes the highlights to mud.
    //
    // Never filter a button, only the glyph or a bare .rt-emo wrapper: a
    // filter also paints over background and border, and it becomes the
    // containing block for position:fixed descendants, so it stays off the
    // container and the side panels.
    // ------------------------------------------------------------------

    // Must match the url(#...) in cyber-theme.css; section H3 of
    // cyber-verify.js asserts they agree.
    const CYBER_EMOJI_FILTER_ID = 'rt-emoji-tint';
    const CYBER_EMOJI_DEFS_ID   = 'rt-emoji-defs';

    // How far the top stop is pushed toward white: 0 is a flat duotone, 1
    // loses the hue in the highlights.
    const CYBER_TINT_HILITE = 0.75;

    // One "0 mid hi" table per channel. Luminance 0 stays black so the glyph
    // keeps its own shading rather than becoming a flat silhouette.
    function cyberTintTable(hex) {
        const parts = hexToRgbStr(hex || '').split(',').map(function (n) {
            return Number(n.trim()) / 255;
        });
        if (parts.length !== 3 || parts.some(function (n) { return isNaN(n); })) return null;
        return parts.map(function (c) {
            const v  = Math.min(1, Math.max(0, c));
            const hi = v + (1 - v) * CYBER_TINT_HILITE;
            return '0 ' + v.toFixed(4) + ' ' + hi.toFixed(4);
        });
    }

    // Idempotent: builds the <defs> once per document, then only rewrites the
    // ramp. Per document because filter references do not cross documents,
    // so the PiP clone gets its own copy.
    function ensureCyberEmojiFilter(doc) {
        if (!doc || !doc.body) return;
        // Feature-detected so a test stub without an SVG DOM no-ops instead
        // of throwing out of applyCyberpunkTheme().
        if (typeof doc.createElementNS !== 'function') return;
        const table = cyberTintTable(userPreferences.cyberAccent || '#fff200');
        if (!table) return;
        const NS = 'http://www.w3.org/2000/svg';
        let svg = doc.getElementById(CYBER_EMOJI_DEFS_ID);
        if (!svg) {
            svg = doc.createElementNS(NS, 'svg');
            svg.setAttribute('id', CYBER_EMOJI_DEFS_ID);
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            svg.setAttribute('width', '0');
            svg.setAttribute('height', '0');
            svg.style.cssText =
                'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
            const defs   = doc.createElementNS(NS, 'defs');
            const filter = doc.createElementNS(NS, 'filter');
            filter.setAttribute('id', CYBER_EMOJI_FILTER_ID);
            // Without sRGB the transfer runs in linearRGB and the result is
            // washed out and hue-shifted away from what the swatch says.
            filter.setAttribute('color-interpolation-filters', 'sRGB');
            const sat = doc.createElementNS(NS, 'feColorMatrix');
            sat.setAttribute('type', 'saturate');
            sat.setAttribute('values', '0');
            filter.appendChild(sat);
            const xfer = doc.createElementNS(NS, 'feComponentTransfer');
            // Tagged with data-rt-ch: tag lookups are case-folded in HTML, so
            // getElementsByTagName('feFuncR') finds nothing.
            ['r', 'g', 'b'].forEach(function (ch) {
                const f = doc.createElementNS(NS, 'feFunc' + ch.toUpperCase());
                f.setAttribute('type', 'table');
                f.setAttribute('data-rt-ch', ch);
                xfer.appendChild(f);
            });
            filter.appendChild(xfer);
            defs.appendChild(filter);
            svg.appendChild(defs);
            doc.body.appendChild(svg);
        }
        const funcs = svg.querySelectorAll('[data-rt-ch]');
        for (let i = 0; i < funcs.length && i < 3; i++) {
            funcs[i].setAttribute('tableValues', table[i]);
        }
    }

    function clearCyberEmojiFilter(doc) {
        if (!doc) return;
        const svg = doc.getElementById(CYBER_EMOJI_DEFS_ID);
        if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
    }

    // ------------------------------------------------------------------
    // EMOJI SWEEP: wraps emoji in the RENDERED DOM and keeps watching, so
    // icons injected from data at render time (chip.textContent =
    // meta.icon + …) are covered as well as literals in templates.
    // ------------------------------------------------------------------

    // Emoji_Presentation: colour emoji by default. Extended_Pictographic +
    // U+FE0F: text glyphs forced into emoji presentation (the gear/hourglass
    // family). Bare Extended_Pictographic is excluded: check marks, stars and
    // arrows already follow --rt-text, and tinting them would be lossier.
    const CYBER_EMOJI_RUN_RE =
        /(?:(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F))*)+/gu;

    // Never split text inside these: SCRIPT/STYLE hold source, and
    // TITLE/OPTION/SELECT render in native chrome the filter cannot reach.
    const CYBER_EMOJI_SKIP_TAGS = {
        SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1, OPTION: 1, SELECT: 1
    };

    function cyberEmojiSkipAncestor(el) {
        while (el) {
            if (CYBER_EMOJI_SKIP_TAGS[el.tagName]) return true;
            if (el.classList) {
                // Already wrapped. Stops the observer recursing on its own
                // output, since inserting the span is itself a mutation.
                if (el.classList.contains('rt-emo')) return true;
                // The progress glyph has its own filter chain (see
                // --rt-emo-progress); wrapping it would nest filters.
                if (el.classList.contains('emoji-display')) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    // Wraps every emoji run in one text node in a bare <span class="rt-emo">;
    // returns whether it changed anything. Builds through node.ownerDocument,
    // not `document`, because the PiP clone is a separate document.
    function cyberWrapEmojiTextNode(node) {
        const text = node.nodeValue;
        if (!text) return false;
        CYBER_EMOJI_RUN_RE.lastIndex = 0;
        if (!CYBER_EMOJI_RUN_RE.test(text)) return false;
        const doc = node.ownerDocument;
        if (!doc || !node.parentNode) return false;
        const frag = doc.createDocumentFragment();
        let last = 0, m;
        CYBER_EMOJI_RUN_RE.lastIndex = 0;
        while ((m = CYBER_EMOJI_RUN_RE.exec(text))) {
            if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
            const span = doc.createElement('span');
            span.className = 'rt-emo';
            span.textContent = m[0];
            frag.appendChild(span);
            last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
        return true;
    }

    // Full sweep of one subtree; cheap on emoji-free roots and safe to repeat
    // (wrapped runs are skipped). Feature-detected: cyber-verify.js runs it
    // against a Node stub with no TreeWalker, where a no-op is correct.
    function cyberSweepEmoji(root) {
        if (!root || !root.ownerDocument) return;
        const doc = root.ownerDocument;
        if (typeof doc.createTreeWalker !== 'function' || typeof NodeFilter === 'undefined') return;
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                return cyberEmojiSkipAncestor(node.parentElement)
                    ? NodeFilter.FILTER_REJECT
                    : NodeFilter.FILTER_ACCEPT;
            }
        });
        const hits = [];
        let n;
        while ((n = walker.nextNode())) hits.push(n);
        // Collect first, then wrap: replaceChild() mid-walk would detach the
        // node the TreeWalker is sitting on.
        hits.forEach(cyberWrapEmojiTextNode);
    }

    // True only while Cyberpunk is active. Observers stay attached across
    // theme switches, so every callback gates on this to skip DOM walks while
    // Glassmorphic is showing.
    let cyberEmojiTintActive = false;

    // One observer per root: applyCyberpunkTheme() runs on every
    // colour-slider tick, and re-attaching would stack observers.
    const cyberEmojiObservedRoots = typeof WeakSet === 'function' ? new WeakSet() : null;

    // Persistent observer that sweeps whatever changes under `root`, which is
    // what keeps data-driven writes such as game-mode chips tinted.
    // Idempotent. Does NOT sweep existing content: callers needing an
    // immediate pass call cyberSweepEmoji() (see applyPreferences()'s
    // enteringRetro branch), so a colour drag does not walk the widget per tick.
    function cyberWatchEmoji(root) {
        if (!root || !cyberEmojiObservedRoots || cyberEmojiObservedRoots.has(root)) return;
        if (typeof MutationObserver !== 'function') return;
        cyberEmojiObservedRoots.add(root);
        const observer = new MutationObserver(function (records) {
            if (!cyberEmojiTintActive) return;
            records.forEach(function (rec) {
                if (rec.type === 'characterData') {
                    if (rec.target.nodeType === 3) cyberWrapEmojiTextNode(rec.target);
                    return;
                }
                rec.addedNodes.forEach(function (node) {
                    if (node.nodeType === 3) cyberWrapEmojiTextNode(node);
                    else if (node.nodeType === 1) cyberSweepEmoji(node);
                });
            });
        });
        observer.observe(root, { childList: true, subtree: true, characterData: true });
    }

    // The whole Cyberpunk presentation pass; applyPreferences() delegates here.
    function applyCyberpunkTheme(container) {
        if (!container) return;
        cyberEmojiTintActive = true;
        cyberWatchEmoji(container);
        applyCyberTokens(container);
        applyCyberShape(container);
        updateCyberTitleGhosts(container);
        ensureCyberEmojiFilter(document);
        // Lets the stylesheet opt the progress glyph out of the tint for the
        // one set whose meaning is its hue (see --rt-emo-progress).
        container.setAttribute('data-emoji-set', userPreferences.emojiSet || 'fun');

        // Mirror onto the document root so body-level modal rules
        // (body:has(.retro-theme) ...) can resolve the same tokens.
        applyCyberTokens(document.documentElement);

        // Mirror onto the PiP clone so the pickers apply live there too.
        if (typeof isPipActive !== 'undefined' && isPipActive && pipWindow && !pipWindow.closed) {
            const pipEl = pipWindow.document.querySelector('.pip-window-content.retro-theme');
            if (pipEl) {
                applyCyberTokens(pipEl);
                applyCyberShape(pipEl);
            }
            ensureCyberEmojiFilter(pipWindow.document);
            const bg1 = userPreferences.cyberBgPrimary || '#07091a';
            const bg2 = userPreferences.cyberBgSecondary || '#11142b';
            pipWindow.document.body.style.background =
                'linear-gradient(135deg, ' + bg1 + ' 0%, ' + bg2 + ' 100%)';
        }
    }

    function clearCyberpunkTheme(container) {
        if (container) {
            clearCyberTokens(container);
            clearCyberShape(container);
            container.classList.remove('rt-booting');
            const title = container.querySelector('.summary-title');
            if (title) title.removeAttribute('data-rt-text');
            container.removeAttribute('data-emoji-set');
        }
        cyberEmojiTintActive = false;
        // The defs node lives on <body>, so it outlives a theme switch
        // unless it is removed here.
        clearCyberEmojiFilter(document);
        if (typeof isPipActive !== 'undefined' && isPipActive && pipWindow && !pipWindow.closed) {
            clearCyberEmojiFilter(pipWindow.document);
        }
        clearCyberTokens(document.documentElement);
        if (cyberBootTimer) { clearTimeout(cyberBootTimer); cyberBootTimer = null; }
    }
