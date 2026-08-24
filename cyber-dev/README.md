# `cyber-dev/` — the Cyberpunk HUD theme

Working area for the theme described in
[`CYBERPUNK_HUD_PLAN.md`](../CYBERPUNK_HUD_PLAN.md).

`AttendanceTimeCheckerPlus.js` self-guards to a single portal URL and is 19k lines, so
iterating on 600 lines of CSS inside it is slow — the same reason `ludo-dev/` and
`snake-dev/` exist. The theme is authored here and spliced in as one reviewed diff.

```
node cyber-dev/reinsert.js           # splice cyber-dev/ into the userscript
node cyber-dev/cyber-verify.js       # 220 assertions
node ludo-dev/verify-all.js          # all 11 suites, this one included
start cyber-dev/cyber-harness.html   # judge the look
```

`cyber-verify.js` needs Node 14+ (the userscript it audits uses `??` and optional
chaining). The default `node` here is 10 — use the Volta image, the way
`ludo-dev/host-smoke.js` does:

```
"$LOCALAPPDATA/Volta/tools/image/node/22.22.2/node.exe" cyber-dev/cyber-verify.js
```

### Source — spliced at three separate sentinel pairs

| File | Purpose |
|---|---|
| `cyber-theme.css` | The whole theme, as real CSS. Lands **inside** the `modernStyles` template literal at its 12-space indent, so it drops in verbatim. |
| `cyber-hud.js` | Tokens, panel shape, contrast guard, title ghosts, boot-in. Written at the userscript's 4-space IIFE indent. |
| `cyber-audio.js` | Analyser, spectrum rail, `--rt-beat`. Same indent. |

Split three ways because they land in three different places: the CSS goes in the style
template, and the two JS blocks go in the IIFE body. Neither JS file has exports of its
own — `load.js` wraps them in a `Function` to make the same source both drop-in-able and
testable, the trick `ludo-dev/` uses.

### Tooling

| File | Purpose |
|---|---|
| `reinsert.js` | Splices all three blocks. Refuses on missing, duplicated or out-of-order sentinels. Adds two checks `snake-dev/reinsert.js` does not need — see *The reinsert contract*. |
| `load.js` | Evaluates both JS modules against a stub DOM and returns their internals. Its stub `style` object records every `setProperty`/`removeProperty`, which is what lets the suite assert the token write list and the teardown list are the same list. |
| `cyber-verify.js` | Static audit of the host wiring + headless module checks. |
| `cyber-harness.html` | The visual authority. See below. |
| `ref/` | Drop reference PNGs here; the visual pass gets redone against them. |

**There is no `preview.js`.** `ludo-dev/preview.js` is a canvas software rasterizer — it
cannot render DOM or CSS, so the trick Snake and Ludo use to judge their art in a PNG does
not transfer to a stylesheet. `cyber-harness.html` in a real browser is the only honest
renderer here.

### cyber-harness.html

Loads `cyber-theme.css`, `cyber-hud.js` and `cyber-audio.js` **directly** — not copies.
The two JS files are valid standalone classic scripts (no top-level `return`), so a
`<script src>` evaluates them exactly as the userscript does. Anything wrong in the harness
is wrong in the widget.

It carries a deliberately minimal *host base* stylesheet: the handful of glassmorphic rules
the theme overrides rather than replaces (`.stat-card::before`'s `content`/`position`/
`opacity`, the container's `::before`, layout). Without those the theme's pseudo-elements
have nothing to inherit and the harness would be lying about how it renders.

Controls: all eight swatches, glow intensity, the three panel shapes, all four audio
sources, six one-click palettes, boot-in and a Game Mode toggle. The palette list ends with
**Dark-on-dark ✗**, which exists to prove the contrast guard fires rather than the theme
silently becoming unreadable.

## The reinsert contract

Sentinels, one pair per block:

```
            /* ═══ CYBERPUNK HUD THEME — generated from cyber-dev/cyber-theme.css, do not edit here ═══ */
            /* ═══ END CYBERPUNK HUD THEME ═══ */
    // ═══ CYBERPUNK HUD — generated from cyber-dev/cyber-hud.js, do not edit here ═══
    // ═══ END CYBERPUNK HUD ═══
    // ═══ CYBERPUNK AUDIO — generated from cyber-dev/cyber-audio.js, do not edit here ═══
    // ═══ END CYBERPUNK AUDIO ═══
```

The CSS pair must stay CSS comments at the 12-space indent — it is inside a template
literal. The JS pairs must stay line comments at the 4-space IIFE indent.

Beyond `snake-dev`'s guarantees, `reinsert.js` refuses to write CSS that contains a
**backtick** or **`${`** (either would break out of `modernStyles` and take every rule after
it), or that has **unbalanced braces** — a stray `}` does not throw, it silently discards
the remainder of the stylesheet, which is far harder to notice than a syntax error.

## The token contract

Three groups of user-set tokens, and no token in one group is ever derived from a token in
another:

```
STRUCTURE   --rt-bg-1  --rt-bg-2
ACCENTS     --rt-accent  --rt-cyber-hl  --rt-cyber-panel
LEGIBILITY  --rt-text  --rt-glow-color  --rt-border-color
```

Dim variants derive from their **own** parent by opacity alone, never by mixing in another
hue. `CYBER_TOKENS` in `cyber-hud.js` is the single array both the write path and the
teardown path are derived from.

**Why this is the point of the whole rework.** The original hardcoded `#fff200` into
`--rt-text`, `--rt-text-dim`, `--rt-border`, `--rt-border-strong`, `--rt-grid` and
`--rt-glow`, and `applyPreferences()` wrote only three of the tokens it needed to. So the
Accent picker could never move type, frames or bloom: setting Accent to grey left a grey
title wearing a hardcoded yellow glow, which is why it read as olive. The obvious fix —
deriving text from Accent — is worse, because a dark Accent then puts dark text on a dark
panel with no control that can undo it. Hence three independent swatches, and
`cyber-verify.js` section C asserting the independence structurally.

The one exception, asserted rather than assumed: `--rt-bk-c`, the corner-bracket colour, is
retinted per stat card so each panel keeps its identity. Brackets are decoration and never
carry text, so an accent-derived bracket cannot hide information.

## Things not to break

- **Defaults must not change the look.** `cyberText`/`cyberGlow`/`cyberBorder` default to
  `#fff200` and `cyberPanelShape` to `rounded`. An upgrade that silently restyles the
  widget reads as a bug. The suite asserts each default.
- **Never animate `box-shadow`.** An animated property beats the static declaration
  outright. The original `animation: neonPulse 5s … !important` on `.retro-theme
  .stat-card` is why all four declared shadow layers, and every per-card shadow below them,
  never rendered — and why the pulse ignored the user's colours. Breathing glows use
  `filter: drop-shadow()`, which composites instead of replacing. `cyber-verify.js` checks
  every keyframe in the block.
- **`clip-path` clips overflow *and* box-shadow.** It is applied only to elements with
  nothing escaping their box — stat cards, the table, the completion chip, the rail. The
  outer container and the side panels keep `border-radius` only: they hold tooltips at
  z-index 9999, game canvases, trays and popovers. Clipping those is how the original ended
  up with two dead `clip-path: none !important` resets cancelling its own chamfer.
- **The EQ rail must stay in `.main-attendance-content`.** Game Mode collapses
  `.left-panel` and `.right-panel`; anything in the centre column survives it.
- **Nothing may request a permission without a click.** There is no gesture at page load,
  so `cyberEqAutoResume()` never opens the share picker and only reconnects the mic when
  the permission is *already* granted. A declined tier does not auto-escalate — firing a
  microphone prompt straight after someone cancelled a screen-share prompt is a second
  surprise, so the tier is marked failed and the next click moves on.
- **`cleanupCyberAudio()` must run on every exit path.** A capture stream that outlives a
  theme switch leaves the user a permanent screen-share banner for a rail that is no longer
  on screen.
- **Edit here, never the copy in the userscript.** Drift is silent until the next reinsert
  refuses to run.

## What a browser can actually do with system audio

Worth recording, because it constrains the feature rather than the implementation.

There is **no system-loopback tap** in the Web Audio API. The only route to "whatever is
playing on this machine" is `getDisplayMedia({ audio: true })`, which needs a gesture every
session, shows the share picker, requires a video constraint (audio-only is rejected, so the
video track is stopped and dropped immediately), leaves a screen-share banner up while it
runs, and on Windows only carries system output if the user ticks *"Also share system
audio"*. Sharing a surface without that tick yields a stream with no audio track at all,
which is detected and reported rather than silently drawn as a flat rail.

The mic tier is the pragmatic fallback: one prompt, it persists across reloads, and it
hears whatever the speakers play — but it also hears the room, and with headphones on it
reads flat. `echoCancellation`, `noiseSuppression` and `autoGainControl` are all forced
**off**; left on, the browser gates and levels the signal for speech and the analyser sees a
flattened version of the music rather than the music.
