    // ============================================================
    // CYBERPUNK HUD — tokens, panel shape, contrast guard, boot-in
    //
    // Generated from cyber-dev/cyber-hud.js. Do not edit the copy in the
    // userscript; edit here and run node cyber-dev/reinsert.js.
    //
    // This is an indented block of the userscript's IIFE body and has no
    // exports of its own — cyber-dev/load.js wraps it in a Function to make
    // the same source both drop-in-able and testable, the trick ludo-dev/
    // and snake-dev/ use.
    //
    // Function declarations hoist within the IIFE, so applyPreferences() can
    // call into here regardless of where this block lands in the file.
    // ============================================================

    // The three panel geometries. Anything not in this list falls back to
    // 'rounded' rather than leaving the container with no shape class at all,
    // which would drop --rt-radius and --rt-clip entirely.
    const CYBER_PANEL_SHAPES = ['rounded', 'chamfered', 'notched'];

    // ------------------------------------------------------------------
    // The token map: pref name -> the CSS custom properties it drives.
    //
    // ONE list, used for both writing and teardown. The original theme kept
    // those as two hand-maintained lists, and the write list had grown six
    // entries past the teardown list — which is how --rt-text and friends
    // ended up permanently yellow no matter what the Accent picker said.
    // Deriving both directions from this array makes them impossible to
    // desynchronise.
    //
    // 'rgb' emits a second "<name>-rgb" property holding "r, g, b" for use
    // inside rgba(var(--x-rgb), a).
    // ------------------------------------------------------------------
    const CYBER_TOKENS = [
        // -- STRUCTURE --
        { pref: 'cyberBgPrimary',   varName: '--rt-bg-1',        fallback: '#07091a' },
        { pref: 'cyberBgSecondary', varName: '--rt-bg-2',        fallback: '#11142b' },
        // -- ACCENTS --
        { pref: 'cyberAccent',      varName: '--rt-accent',      fallback: '#fff200', rgb: true },
        { pref: 'cyberHighlight',   varName: '--rt-cyber-hl',    fallback: '#00e5ff', rgb: true },
        { pref: 'cyberPanelTint',   varName: '--rt-cyber-panel', fallback: '#00e5ff', rgb: true },
        // -- LEGIBILITY: independent of everything above, by design. Linking
        //    any of these to an accent or a background is what put dark text
        //    on a dark panel with no control that could undo it.
        { pref: 'cyberText',        varName: '--rt-text',         fallback: '#fff200', rgb: true },
        { pref: 'cyberGlow',        varName: '--rt-glow-color',   fallback: '#fff200', rgb: true },
        { pref: 'cyberBorder',      varName: '--rt-border-color', fallback: '#fff200', rgb: true }
    ];

    // Every property name this subsystem may have written, for teardown.
    // Derived, never typed out by hand.
    function cyberTokenVarNames() {
        const names = [];
        CYBER_TOKENS.forEach(function (t) {
            names.push(t.varName);
            if (t.rgb) names.push(t.varName + '-rgb');
        });
        names.push('--rt-glow-mul');
        names.push('--rt-beat');
        return names;
    }

    // Writes the whole token set onto one element. Used for the widget, for
    // documentElement (so body-level modal rules resolve) and for the PiP
    // clone, which is why it takes the element rather than assuming one.
    function applyCyberTokens(el) {
        if (!el || !el.style) return;
        CYBER_TOKENS.forEach(function (t) {
            const hex = userPreferences[t.pref] || t.fallback;
            el.style.setProperty(t.varName, hex);
            if (t.rgb) el.style.setProperty(t.varName + '-rgb', hexToRgbStr(hex));
        });
        const mul = userPreferences.cyberGlowIntensity;
        el.style.setProperty('--rt-glow-mul', String(mul === undefined ? 0.6 : mul));
    }

    // Removes every property applyCyberTokens could have set. Anything left
    // behind here bleeds into the Glassmorphic theme, where these tokens have
    // no meaning but still win over the stylesheet.
    function clearCyberTokens(el) {
        if (!el || !el.style) return;
        cyberTokenVarNames().forEach(function (p) { el.style.removeProperty(p); });
    }

    // ------------------------------------------------------------------
    // Panel shape
    // ------------------------------------------------------------------
    function cyberPanelShape() {
        const s = userPreferences.cyberPanelShape;
        return CYBER_PANEL_SHAPES.indexOf(s) === -1 ? 'rounded' : s;
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
    // Contrast guard
    //
    // Warns, never corrects. Silently overriding a colour the user chose on
    // purpose is worse than showing them it fails — they may be mid-way
    // through picking a palette, and an auto-correction would fight them.
    // ------------------------------------------------------------------

    // WCAG relative luminance. Reuses hexToRgbStr for the channel parse so
    // there is exactly one hex reader in the file.
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

    // Text is checked against the darker of the two background stops, since
    // that is the worst case anywhere on the gradient.
    function cyberTextContrast() {
        const text = userPreferences.cyberText || '#fff200';
        const bg1 = userPreferences.cyberBgPrimary || '#07091a';
        const bg2 = userPreferences.cyberBgSecondary || '#11142b';
        return Math.min(contrastRatio(text, bg1), contrastRatio(text, bg2));
    }

    // Repaints the chip in the Cyberpunk Colors row. No-op when the settings
    // modal is closed.
    function updateCyberContrastChip(root) {
        const scope = root || document;
        const chip = scope.querySelector('.cyber-contrast-chip');
        if (!chip) return;
        const ratio = cyberTextContrast();
        const shown = (Math.round(ratio * 10) / 10).toFixed(1);
        let cls = 'is-pass';
        let note = 'AA';
        if (ratio < 3) { cls = 'is-fail'; note = 'too low'; }
        else if (ratio < 4.5) { cls = 'is-warn'; note = 'large text only'; }
        chip.className = 'cyber-contrast-chip ' + cls;
        chip.textContent = 'Text vs BG ' + shown + ':1 · ' + note;
        chip.title = 'WCAG contrast of the Text swatch against the darker background stop. ' +
                     'This is a warning only — nothing is changed for you.';
    }

    // ------------------------------------------------------------------
    // Title glitch ghosts
    //
    // The two RGB-split ghosts are pseudo-elements using content:
    // attr(data-rt-text), so the text has to be mirrored onto the attribute.
    // Without it the ghosts render empty and the title simply looks normal,
    // which is the correct degradation.
    // ------------------------------------------------------------------
    function updateCyberTitleGhosts(container) {
        const root = container || document.getElementById('total-time-summary');
        if (!root) return;
        const title = root.querySelector('.summary-title');
        if (!title) return;
        // textContent, not innerHTML: the ghosts are decorative and must never
        // be able to reproduce markup.
        const text = (title.textContent || '').trim();
        if (text) title.setAttribute('data-rt-text', text);
        else title.removeAttribute('data-rt-text');
    }

    // ------------------------------------------------------------------
    // Boot-in scan reveal
    //
    // The class has to come off again or the animation can never replay —
    // re-adding a class that is already present does not restart a CSS
    // animation.
    // ------------------------------------------------------------------
    let cyberBootTimer = null;

    function triggerCyberBoot(container) {
        const root = container || document.getElementById('total-time-summary');
        if (!root || !root.classList.contains('retro-theme')) return;
        root.classList.remove('rt-booting');
        // Force a reflow so removing and re-adding in the same frame still
        // restarts the animation.
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
    // The whole Cyberpunk presentation pass, in one call.
    // applyPreferences() delegates here so there is a single place that knows
    // what "apply the cyberpunk theme" means.
    // ------------------------------------------------------------------
    function applyCyberpunkTheme(container) {
        if (!container) return;
        applyCyberTokens(container);
        applyCyberShape(container);
        updateCyberTitleGhosts(container);

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
        }
        clearCyberTokens(document.documentElement);
        if (cyberBootTimer) { clearTimeout(cyberBootTimer); cyberBootTimer = null; }
    }
