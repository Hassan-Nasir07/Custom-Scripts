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

    // The four panel geometries, most-cyberpunk first. Anything not in this
    // list falls back to 'notched' rather than leaving the container with no
    // shape class at all, which would drop --rt-radius and --rt-clip.
    //
    // 'notched' is the default because it is the asymmetric one: a right-angle
    // step cut out of a single corner. Symmetry is most of what makes a HUD
    // read as clean sci-fi instead of cyberpunk, so the soft option is kept
    // but is no longer what ships.
    const CYBER_PANEL_SHAPES = ['notched', 'chamfered', 'stepped', 'rounded'];

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
    // 'rgb' emits a second property holding "r, g, b" for use inside
    // rgba(var(--x-rgb), a).
    //
    // 'rgbName' STATES that property's name instead of deriving it, and the
    // two swatches that need it are why this field exists. The name used to
    // be built as varName + '-rgb', which is right for six of the eight
    // swatches and wrong for the two whose varName already ends in '-color':
    // it wrote --rt-glow-color-rgb and --rt-border-color-rgb, while the
    // stylesheet consumes --rt-glow-rgb (21 sites) and --rt-border-rgb (17).
    // Nothing read what was written, so Glow and Border kept their yellow
    // defaults for every frame, grid line and bloom in the theme no matter
    // what the pickers said — the exact defect this rework exists to remove,
    // one layer below where it was fixed.
    //
    // It survived 1523 assertions because teardown derived the name the same
    // wrong way, so the write list and the teardown list agreed with each
    // other perfectly. Neither agreed with the CSS. Section H2 of
    // cyber-verify.js now checks that boundary.
    // ------------------------------------------------------------------
    const CYBER_TOKENS = [
        // -- STRUCTURE --
        { pref: 'cyberBgPrimary',   varName: '--rt-bg-1',        fallback: '#07091a' },
        { pref: 'cyberBgSecondary', varName: '--rt-bg-2',        fallback: '#11142b' },
        // -- ACCENTS --
        { pref: 'cyberAccent',      varName: '--rt-accent',      fallback: '#fff200', rgb: true },
        { pref: 'cyberHighlight',   varName: '--rt-cyber-hl',    fallback: '#00e5ff', rgb: true },
        // No 'rgb' — nothing consumes var(--rt-cyber-panel-rgb). See the note
        // beside the Panel default in cyber-theme.css.
        { pref: 'cyberPanelTint',   varName: '--rt-cyber-panel', fallback: '#00e5ff' },
        // -- LEGIBILITY: independent of everything above, by design. Linking
        //    any of these to an accent or a background is what put dark text
        //    on a dark panel with no control that could undo it.
        { pref: 'cyberText',        varName: '--rt-text',         fallback: '#fff200', rgb: true },
        { pref: 'cyberGlow',        varName: '--rt-glow-color',   fallback: '#fff200', rgb: true,
          rgbName: '--rt-glow-rgb' },
        { pref: 'cyberBorder',      varName: '--rt-border-color', fallback: '#fff200', rgb: true,
          rgbName: '--rt-border-rgb' }
    ];

    // The companion property's name. Single source for both the write path
    // and the teardown path — if these two ever disagree, teardown leaves a
    // token behind and it bleeds into Glassmorphic.
    function cyberRgbVarName(t) {
        return t.rgbName || t.varName + '-rgb';
    }

    // Every property name this subsystem may have written, for teardown.
    // Derived, never typed out by hand.
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

    // Writes the whole token set onto one element. Used for the widget, for
    // documentElement (so body-level modal rules resolve) and for the PiP
    // clone, which is why it takes the element rather than assuming one.
    function applyCyberTokens(el) {
        if (!el || !el.style) return;
        CYBER_TOKENS.forEach(function (t) {
            const hex = userPreferences[t.pref] || t.fallback;
            el.style.setProperty(t.varName, hex);
            if (t.rgb) el.style.setProperty(cyberRgbVarName(t), hexToRgbStr(hex));
        });
        // GLOW.
        //
        // Two properties for one value. --rt-glow-mul is the raw preference,
        // kept because it is what gets stored and torn down; --rt-glow-k is
        // the same number guarded and clamped, and is what the stylesheet
        // actually multiplies by.
        //
        // Written here rather than derived in CSS because the settings modal
        // is body-level: a property declared inside .retro-theme is invisible
        // to it, but everything applyCyberTokens() writes is mirrored onto
        // documentElement and so reachable from there.
        const mul = userPreferences.cyberGlowIntensity;
        const safeMul = mul === undefined ? CYBER_GLOW_DEFAULT : Number(mul);
        el.style.setProperty('--rt-glow-mul', String(safeMul));
        el.style.setProperty('--rt-glow-k', String(cyberGlowScale(safeMul)));
    }

    // Removes every property applyCyberTokens could have set. Anything left
    // behind here bleeds into the Glassmorphic theme, where these tokens have
    // no meaning but still win over the stylesheet.
    function clearCyberTokens(el) {
        if (!el || !el.style) return;
        cyberTokenVarNames().forEach(function (p) { el.style.removeProperty(p); });
    }

    // ------------------------------------------------------------------
    // Glow scale — a plain 0–100% that means what it says.
    //
    // The slider IS the scale: 0 is off, 1 is everything the theme has. No
    // conversion, no normalisation, no "percent of some other number".
    //
    // It took two wrong turns to get here and both are worth remembering,
    // because both looked like the fix at the time.
    //
    //   1. The multiplier scaled ALPHA against fixed blur radii. Opacity
    //      saturates long before a slider does, so the top half did nothing.
    //   2. Radius scaled too, but off a 7px base, and the range was widened
    //      to 300% to compensate. That was treating the symptom: at 7px there
    //      is barely a halo to scale, so most of a longer slider still did
    //      nothing — and a slider whose useful range is its last third is a
    //      worse control than a short one.
    //
    // The base radii were the problem. They are 3–5x larger now and layered,
    // so the full 0–100% does visible work and the ceiling is genuinely the
    // ceiling. See --rt-glow in cyber-theme.css.
    // ------------------------------------------------------------------
    const CYBER_GLOW_DEFAULT = 0.6;
    const CYBER_GLOW_MAX_PCT = 100;

    // Guarded rather than trusted: a NaN here would invalidate every glow
    // declaration in the theme at once, which reads as "the glow broke"
    // rather than "a preference is malformed".
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
        // Must match the shape the bare .retro-theme token block declares, or
        // an unknown value would render with tokens from one shape and a class
        // from none.
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

    // EVERY SWATCH THAT CARRIES TYPE IS MEASURED.
    //
    // This used to check the Text swatch alone, because Text was the only
    // colour any glyph in the theme resolved to. The rework changed that:
    // the reference console reads its punch log by MEANING, so arrival
    // times took Accent and banked time took Highlight, and suddenly two
    // more swatches could hide a number.
    //
    // That is the precise defect this whole theme exists to make
    // impossible, so the fix is not to trust the palette — it is to widen
    // the guard. Any swatch allowed to colour text has to appear in
    // CYBER_TEXT_SWATCHES, and cyber-verify.js asserts the CSS never
    // colours type with a swatch that is missing from this list. Adding a
    // coloured readout without adding its swatch here fails the suite.
    //
    // Each is checked against the DARKER background stop, which is the
    // worst case anywhere along the gradient.
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

    // Kept as the Text-only reading. The chip reports the worst swatch, but
    // Text is the one a caller may want on its own.
    function cyberTextContrast() {
        return cyberSwatchContrast('cyberText', '#fff200');
    }

    // The worst offender, by name. Reporting "Highlight 2.4:1" instead of a
    // bare number is the difference between a warning the user can act on
    // and one they have to go hunting for.
    function cyberWorstContrast() {
        let worst = null;
        CYBER_TEXT_SWATCHES.forEach(function (s) {
            const ratio = cyberSwatchContrast(s.pref, s.fallback);
            if (!worst || ratio < worst.ratio) worst = { ratio: ratio, label: s.label };
        });
        return worst;
    }

    // Repaints the chip in the Cyberpunk Colors row. No-op when the settings
    // modal is closed.
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
    // ------------------------------------------------------------------
    // PALETTES — six built-in swatch sets, defined ONCE so the shipped
    // settings modal and the dev harness cannot drift the way the glow
    // converter once did (cyberGlowFromPct/ToPct exists for the same
    // reason: two places computing the same thing by hand is how they stop
    // agreeing).
    //
    // Each is a complete, independently-authored set of all eight swatches
    // — never a formula derived from one seed hue. A formula is exactly
    // what the ORIGINAL bug was: every token but Accent hardcoded to the
    // same yellow, because nobody had to independently decide what Border
    // or Glow should be. Six full sets, each checked against the contrast
    // guard (section H4), is the opposite of that shortcut.
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
        // The 6th slot. Not a "dark" palette pretending to be a mistake —
        // that role belongs to the dev harness alone, never to something
        // shipped as a real user choice. Every swatch here is independently
        // checked against the contrast guard, same as the other five.
        violetHaze:  { label: 'Violet Haze', cyberBgPrimary: '#0b0616', cyberBgSecondary: '#180d2c',
                       cyberAccent: '#c88bf5', cyberHighlight: '#e3b8ff', cyberPanelTint: '#7c3aed',
                       cyberText: '#ecdcff', cyberGlow: '#c77dff', cyberBorder: '#9d4edd' }
    };

    // ------------------------------------------------------------------
    // EMOJI TINT
    //
    // The widget's emoji are colour glyphs supplied by the system emoji font.
    // No CSS colour property reaches them - `color` styles text, and these
    // carry their own palette (COLR layers or a bitmap strike). An SVG filter
    // does reach them: desaturate to luminance, then map that luminance
    // through a ramp built from the theme hue. Silhouette and shading
    // survive; the palette becomes the theme's.
    //
    // WHY AN SVG FILTER AND NOT A CSS FILTER CHAIN. The swatches are
    // arbitrary user hex. The well-known sepia()/saturate()/hue-rotate()
    // recipe only *approaches* a target hue by iterative solving, never lands
    // on a given hex, and drifts badly for dark or desaturated picks.
    // feComponentTransfer takes the channel values directly.
    //
    // WHY THREE RAMP STOPS AND NOT TWO. A plain black->hue duotone collapses
    // every specular highlight into the hue and the glyphs go muddy - a gear
    // stops reading as a gear. A third bright stop keeps the highlights. Both
    // were rendered before choosing; two stops is visibly worse.
    //
    // WHERE THIS MAY NOT GO. A filter applies to everything its element
    // paints, background and border included - so it never goes on a button,
    // only on the glyph itself or on a bare .rt-emo wrapper around it.
    // Filtering .game-switch-btn would duotone its border and its knocked-out
    // --rt-text fill along with the emoji. A filter also becomes the
    // containing block for position:fixed descendants, which is why it stays
    // off the container and the side panels; see the --rt-outline note.
    // ------------------------------------------------------------------

    // Must match the url(#...) spelled in cyber-theme.css. Section H3 of
    // cyber-verify.js asserts the two agree: the last time a name was coupled
    // across the JS/CSS boundary by hand, it silently stopped matching and
    // two swatches were dead for three passes.
    const CYBER_EMOJI_FILTER_ID = 'rt-emoji-tint';
    const CYBER_EMOJI_DEFS_ID   = 'rt-emoji-defs';

    // How far the top stop is pushed toward white. 0 is a flat duotone, 1
    // blows highlights to pure white and loses the hue in them. 0.75 keeps a
    // highlight that still reads as the theme colour.
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
    // ramp. Takes a document because a filter reference resolves per-document
    // and the PiP clone is a separate one. A missing id there degrades to
    // untinted rather than to a blank element (checked in a real engine), but
    // untinted is still the wrong answer, so PiP gets its own copy.
    function ensureCyberEmojiFilter(doc) {
        if (!doc || !doc.body) return;
        // Feature-detected rather than assumed, same reason as cyberSweepEmoji:
        // a hand-rolled test stub with no real SVG DOM should no-op here, not
        // throw and take the rest of applyCyberpunkTheme() down with it.
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
            // Tagged with a data attribute rather than found by tag name:
            // feFuncR is camelCase, and tag lookups are case-folded in an
            // HTML document, so getElementsByTagName('feFuncR') finds nothing.
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
    // EMOJI SWEEP — universal coverage
    //
    // The wrap-every-known-template-literal approach this shipped with
    // first covered 32 sites and still missed the achievement badges, the
    // leaderboard join card and the settings-modal close button — because
    // those inject their icon from a DATA STRUCTURE at render time
    // (`badge.innerHTML = achievement.icon`), not a literal sitting in an
    // HTML template string. A regex over the SOURCE can only ever find the
    // second kind.
    //
    // So this is no longer "wrap every place an emoji was found by hand" —
    // it is "sweep the RENDERED DOM for anything the platform paints
    // through its colour emoji font, and keep watching." That is a
    // property of the page, not of the source text, and it is the only
    // formulation that also covers whatever the next feature injects.
    // ------------------------------------------------------------------

    // Emoji_Presentation: codepoints the platform renders through its
    // colour emoji font BY DEFAULT (faces, food, tools with no trailing
    // FE0F). Extended_Pictographic + U+FE0F: codepoints that default to a
    // plain TEXT glyph — already correctly following `color` — but are
    // explicitly forced into emoji presentation by a trailing variation
    // selector-16: the gear/hourglass/warning family (\u2699\uFE0F etc).
    //
    // Extended_Pictographic ALONE, with no FE0F, is deliberately EXCLUDED.
    // It also matches things like a bare check mark, star or arrow, which
    // render as plain monochrome glyphs already correctly following
    // --rt-text. Tinting those would re-derive a colour CSS already had
    // right, through a lossier path.
    const CYBER_EMOJI_RUN_RE =
        /(?:(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F))*)+/gu;

    // Never split text inside these. SCRIPT/STYLE hold source text, not
    // content — splitting it would corrupt the page, not decorate it.
    // TITLE/OPTION/SELECT render through native chrome the SVG filter
    // cannot reach anyway, so wrapping their text only adds dead spans.
    const CYBER_EMOJI_SKIP_TAGS = {
        SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1, OPTION: 1, SELECT: 1
    };

    function cyberEmojiSkipAncestor(el) {
        while (el) {
            if (CYBER_EMOJI_SKIP_TAGS[el.tagName]) return true;
            if (el.classList) {
                // Already wrapped. The guard that stops the observer
                // re-wrapping its own output and recursing forever: inserting
                // <span class="rt-emo"> is itself a mutation the observer
                // sees, and without this it would walk straight back in.
                if (el.classList.contains('rt-emo')) return true;
                // The progress glyph carries its own bespoke filter chain —
                // chained ahead of its drop-shadows, with a per-emoji-set
                // opt-out (see --rt-emo-progress). Wrapping its text too
                // would nest one filter inside another for no benefit.
                if (el.classList.contains('emoji-display')) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    // Splits one text node in place, wrapping every emoji run in a bare
    // <span class="rt-emo">. Returns whether it changed anything. Creates
    // through node.ownerDocument rather than the global `document`, because
    // the PiP clone is a second document and a node built in one document
    // cannot always be trusted to insert cleanly into another.
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

    // Full sweep of one subtree. Safe on a root with no emoji in it (the
    // TreeWalker filter rejects almost everything before the regex ever
    // runs) and safe to call twice (already-wrapped runs are skipped by the
    // ancestor check, not re-split). Feature-detected rather than assumed:
    // cyber-verify.js exercises applyCyberpunkTheme() against a hand-rolled
    // Node stub with no TreeWalker or NodeFilter, and a silent no-op there
    // is correct — the stub is for token/shape assertions, not DOM behaviour,
    // which is proven separately in a real engine (see the plan).
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
        // Collected before wrapping rather than wrapped during the walk:
        // replaceChild() during traversal detaches the node the walker is
        // sitting on, which is exactly the kind of thing a live TreeWalker
        // does not guarantee survives.
        hits.forEach(cyberWrapEmojiTextNode);
    }

    // True only while Cyberpunk is the active theme. Every observer
    // callback below gates on this first: the widget-container observer has
    // to stay attached across a theme switch (see cyberWatchEmoji), but must
    // do nothing while Glassmorphic is showing, or every achievement toast
    // and modal open pays for a DOM walk that has no reason to run.
    let cyberEmojiTintActive = false;

    // One observer per root, ever. Re-attaching on every call would stack a
    // new MutationObserver on the same element each time it runs — and the
    // widget's container observer is wired from applyCyberpunkTheme(),
    // which runs on every colour-slider tick, not just on theme entry.
    const cyberEmojiObservedRoots = typeof WeakSet === 'function' ? new WeakSet() : null;

    // Attaches a persistent MutationObserver to `root`, watching for any
    // future content change (childList + subtree + characterData) and
    // sweeping whatever changed. Idempotent — a second call on the same
    // root is a WeakSet lookup and nothing else. Does NOT sweep existing
    // content itself; callers that need an immediate pass call
    // cyberSweepEmoji() explicitly (see applyPreferences()'s enteringRetro
    // branch), because a sweep on every one of the many calls this makes
    // during a colour drag would walk the whole widget on every tick.
    //
    // This is what makes the achievement badges the report was about
    // actually stay covered: updateXPDisplay() sets
    // `badge.innerHTML = achievement.icon` — a plain data-driven write with
    // no idea the Cyberpunk theme exists — and the observer catches it
    // exactly the same way it would catch a change nobody wrote yet.
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

    function applyCyberpunkTheme(container) {
        if (!container) return;
        cyberEmojiTintActive = true;
        cyberWatchEmoji(container);
        applyCyberTokens(container);
        applyCyberShape(container);
        updateCyberTitleGhosts(container);
        ensureCyberEmojiFilter(document);
        // Published so the stylesheet can opt the progress glyph out of the
        // tint for the one set whose meaning is its hue. See the note beside
        // --rt-emo-progress in cyber-theme.css.
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
