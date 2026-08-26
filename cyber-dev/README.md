# `cyber-dev/` — the Cyberpunk HUD theme

Working area for the theme described in
[`CYBERPUNK_HUD_PLAN.md`](../CYBERPUNK_HUD_PLAN.md).

`AttendanceTimeCheckerPlus.js` self-guards to a single portal URL and is 19k lines, so
iterating on 600 lines of CSS inside it is slow — the same reason `ludo-dev/` and
`snake-dev/` exist. The theme is authored here and spliced in as one reviewed diff.

```
node cyber-dev/reinsert.js           # splice cyber-dev/ into the userscript
node cyber-dev/cyber-verify.js       # ~300 assertions
node ludo-dev/verify-all.js          # all 11 suites, this one included
start cyber-dev/cyber-harness.html   # judge the look
```

`cyber-verify.js` needs Node 14+ (the userscript it audits uses `??` and optional
chaining). The default `node` here is 10 — use the Volta image, the way
`ludo-dev/host-smoke.js` does:

```
"$LOCALAPPDATA/Volta/tools/image/node/22.22.2/node.exe" cyber-dev/cyber-verify.js
```

### Source — spliced at two separate sentinel pairs

| File | Purpose |
|---|---|
| `cyber-theme.css` | The whole theme, as real CSS. Lands **inside** the `modernStyles` template literal at its 12-space indent, so it drops in verbatim. |
| `cyber-hud.js` | Tokens, panel shape, contrast guard, title ghosts, boot-in. Written at the userscript's 4-space IIFE indent. |

Split two ways because they land in two different places: the CSS goes in the style
template, and the JS block goes in the IIFE body. The JS file has no exports of its
own — `load.js` wraps it in a `Function` to make the same source both drop-in-able and
testable, the trick `ludo-dev/` uses.

### Tooling

| File | Purpose |
|---|---|
| `reinsert.js` | Splices both blocks. Refuses on missing, duplicated or out-of-order sentinels. Adds two checks `snake-dev/reinsert.js` does not need — see *The reinsert contract*. |
| `load.js` | Evaluates the JS module against a stub DOM and returns its internals. Its stub `style` object records every `setProperty`/`removeProperty`, which is what lets the suite assert the token write list and the teardown list are the same list. |
| `cyber-verify.js` | Static audit of the host wiring + headless module checks. |
| `cyber-harness.html` | The visual authority. See below. |
| `snapshot.js` | Builds a self-contained copy of the harness with the CSS and module inlined, for reading computed styles out of a real browser. See *What a browser can tell you* below. |
| `ref/` | The motif sheets **and** `ref/design/` — the Claude Design canvas that is the authoritative composition. Read both before changing how anything looks; see `ref/README.md`. |

**There is no `preview.js`.** `ludo-dev/preview.js` is a canvas software rasterizer — it
cannot render DOM or CSS, so the trick Snake and Ludo use to judge their art in a PNG does
not transfer to a stylesheet. `cyber-harness.html` in a real browser is the only honest
renderer here.

### What a browser can tell you without a screenshot

"A human has to look at it" is true of whether this theme looks *good*. It is not true of
whether the CSS does what it says. A browser can be driven far enough to read back
**computed styles**, and that answers a class of question no static check can:

- Does the whole stylesheet parse, or did one bad declaration discard everything after it?
- Does `caption.rt-sec` still compute to `display: table-caption`, and does the footer cell
  still report `colSpan: 5`? Flex either and the browser silently wraps it in an anonymous
  cell — the caption narrows to one column, the colspan vanishes, nothing throws.
- Do the caption, the footer and the table all measure the *same width*?
- Do `--rt-clip` and `--rt-clip-alt` resolve to genuinely different polygons under each of
  the four shapes?
- Does the container still compute `filter: none`?

```
node cyber-dev/snapshot.js       # -> cyber-dev/_snapshot.html, then open it and
                                 #    read computed styles; delete when done
```

Two constraints, both learned the hard way and both enforced or documented in
`snapshot.js`:

1. **The file must be self-contained.** A local file gets loaded by inlining it, so a
   relative `<link href="cyber-theme.css">` resolves against the wrong base and loads
   nothing. The harness then renders completely unstyled and every value you read back is
   the host base sheet — which looks like a passing check. `snapshot.js` refuses to run if
   the tags it inlines have moved, rather than producing that silently.
2. **It must sit inside the project folder.** Outside it, the page renders as a
   non-scriptable snapshot and evaluation fails outright.

Script evaluation runs in an **isolated world**, so page globals (`userPreferences`,
`applyCyberpunkTheme`) are not reachable. Anything needing to call into the modules belongs
in `cyber-verify.js` against `load.js`. Shape switching *is* testable here, because the
shape classes are pure CSS — toggle `rt-shape-*` on the container.

This is a supplement, not a replacement. It proved the table-display trap and caught it
before it shipped; it says nothing about whether the result looks right.

### cyber-harness.html

Loads `cyber-theme.css` and `cyber-hud.js` **directly** — not copies. The JS file is a
valid standalone classic script (no top-level `return`), so a `<script src>` evaluates it
exactly as the userscript does. Anything wrong in the harness is wrong in the widget.

It carries a deliberately minimal *host base* stylesheet: the handful of glassmorphic rules
the theme overrides rather than replaces (`.stat-card::before`'s `content`/`position`/
`opacity`, the container's `::before`, layout). Without those the theme's pseudo-elements
have nothing to inherit and the harness would be lying about how it renders.

Controls: all eight swatches, glow intensity, meter position, all four panel shapes, six
one-click palettes, boot-in and a Game Mode toggle. The palette list ends with
**Dark-on-dark ✗**, which exists to prove the contrast guard fires rather than the theme
silently becoming unreadable.

**Every control drives the real thing, and the suite checks it.** Section C7 asserts that
each id in the rig markup is read or written by the rig script, and that each class the rig
toggles is selected by some loaded stylesheet. That second check exists because the Game
Mode button used to toggle `.gm-off` — a class no stylesheet anywhere defines — and fake
the visible part with inline `display: none`, so it looked like it worked while exercising
none of the real collapse path. It uses `.game-mode-hidden` / `.game-mode-off` now, the
widget's own names, and the base sheet carries their rules.

**Meter** exists because the playhead reads `--rt-progress` and never moved on its own —
it writes exactly the property `renderFullContent()` writes.

## The reinsert contract

Sentinels, one pair per block:

```
            /* ═══ CYBERPUNK HUD THEME — generated from cyber-dev/cyber-theme.css, do not edit here ═══ */
            /* ═══ END CYBERPUNK HUD THEME ═══ */
    // ═══ CYBERPUNK HUD — generated from cyber-dev/cyber-hud.js, do not edit here ═══
    // ═══ END CYBERPUNK HUD ═══
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

## The visual language

Authored against `ref/`. The first pass of this theme was rejected as *"sci-fi, not
cyberpunk-ish"*, which was correct, so what separates the two is written down here rather
than left to taste.

Items 1–6 are the **vocabulary**, settled in pass 2 against the motif sheets. Items 7–10
are **composition**, settled in pass 3 against `ref/design/` — the sheets are a catalogue
of parts and say nothing about how the parts go together, which is why it took a finished
canvas to get them. In order of how much each contributes:

1. **Asymmetry.** Not one frame in the reference is a rounded rectangle. Step notches cut
   from a *single* corner, opposite-corner diagonals, terraced two-jump corners. Symmetry
   is most of what makes a HUD read as clean sci-fi. This is why `notched` — a right-angle
   step cut out of one corner — is the shipped default and `rounded` is just the escape
   hatch.
2. **45° hazard hatching** on container edges, meter tracks and tabs. `--rt-hazard`,
   `--rt-hazard-dim`. The single most cyberpunk motif, and the one a generic sci-fi HUD
   never has.
3. **Solid plates with knocked-out glyphs** — `.rt-code.is-block`, `.stat-label`, the
   hexagonal level badge, every active control. Outline-and-glow alone has no mass, and
   mass is what stops it looking like a wireframe. **But mass goes on the small things.**
   Pass 2 also plated the title and the table header; pass 3 took both back off, because a
   heading that looks identical to a button is a hierarchy bug wearing a style. See item 9.
4. **Flat.** No `backdrop-filter`, no glass, near-zero mid-tones. `--rt-glow` is a 7px halo,
   not 18px: a small hard halo reads as a lit filament, a wide soft one reads as fog.
5. **Greeble** — `.rt-hud-rail`, mono codes, tick rows. It shows *real* values (shift length,
   progress, build label) in HUD dress. A timesheet widget covered in invented serial
   numbers is clutter; the same data in mono is characterful.
6. **Schematic terminal dots** at two of the bracket ends. Two, not four — four reads as a
   border.
7. **One composition, repeated.** Every panel in the canvas opens the same way: glyph bar,
   display name, hazard filler, right-aligned mono readout. That is `.rt-sec`, one rule
   with `--rt-sec-c` per panel. The rhythm is what makes a stack of unrelated boxes read
   as one instrument, and it is the single thing pass 2 was most obviously missing.
8. **A hero, not a row of equals.** The canvas picks the number you actually came to read
   and spends everything on it — tinted fill, solid accent border, wide bloom, biggest
   type — and draws the others as reference values. `.remaining-time-card` is the hero.
   Three equally weighted cards read as a spec sheet.
9. **Chromatic aberration on the one display word.** `--rt-aberr`: a warm ghost 2px one
   way, a cool one 2px the other, on the title only. Cheapest item on this list, most
   recognisably cyberpunk. Asserted to be used exactly once — a second aberrated element
   reads as a rendering fault rather than a style. Offsets stay at 2px; past ~3px it stops
   reading as a mis-converged tube and becomes a drop shadow.
10. **Colour by meaning, and measure what you colour.** `--rt-accent` is "targeted"
    (remaining, live); `--rt-data` is "measured" (worked, elapsed). Reading one against the
    other is the widget's whole job. **Any swatch that colours type must be in
    `CYBER_TEXT_SWATCHES`** — see *Things not to break*.

Asymmetry, in pass 3, is mostly by **arrangement** rather than by silhouette:
`--rt-clip-alt` mirrors each shape so neighbouring panels cut opposite corners. The canvas
is not made of weird shapes — it is made of plain shapes whose cuts never line up.

`clip-path` removes the border along a cut edge, which leaves the silhouette unfinished.
`--rt-outline` draws it back with four 1px `drop-shadow`s that follow the clip exactly, so
one token outlines every shape without needing a wrapper element.

## Things not to break

- **The colour defaults must not change.** `cyberText`/`cyberGlow`/`cyberBorder` all
  default to `#fff200`, so an existing user keeps their yellow HUD — now changeable. The
  suite asserts each default.

  **`cyberPanelShape` is a deliberate exception, and it is `notched`, not `rounded`.**
  Pass 2 moved it, because reshaping the panels *was* the request; pass 3 left it there.
  Noted because the rule above used to be absolute and the old wording outlived the change.
- **The emoji tint filter id is spelled in two files.** `CYBER_EMOJI_FILTER_ID` in
  `cyber-hud.js` builds it; `url(#…)` in `cyber-theme.css` reaches it. Nothing links them but
  a matching string, and a mismatch is silent — Chrome ignores an unresolvable filter
  reference and paints the emoji untinted. Section H3 asserts they agree, for the same reason
  H2 exists.
- **If you colour type with a swatch, add it to `CYBER_TEXT_SWATCHES`** in `cyber-hud.js`.
  `cyber-verify.js` section C2 resolves every `color: var(--rt-*)` back to its swatch
  (following one hop of aliasing) and fails if the contrast guard is not measuring it. An
  unmeasured swatch on type is the original "dark pick hides a number" bug in a new hat.
- **Never change the `display` of a table-structural element.** The punch-log header and
  footer are a `<caption>` and a `<tfoot>` cell so they land inside the clipped plate; both
  keep their table display and hold an inner `.rt-sec-row` / `.rt-foot-row` that does the
  flexing. Flexing the caption itself narrows it to one column, and flexing the `colspan`
  cell drops the span — silently, both times, and only in a browser.
- **Every `rt-*` element the host renders needs a hide rule under
  `.attendance-summary:not(.retro-theme)`.** One markup tree serves both themes, so an
  unhidden element lays out as unstyled text in the middle of the Glassmorphic widget. The
  suite checks the list in both directions, including for stale entries.
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
- **A glow needs a big base radius AND radius scaling.** `--rt-glow-k` is the 0-1 intensity
  and every glow multiplies *both* its radius and its alpha by it, from zero. Two separate
  mistakes here, both of which looked fixed at the time:
  scaling alpha alone (opacity saturates long before a slider does), and then scaling a 7px
  base (there is no halo there to scale — widening the slider's range to compensate just
  moved the dead zone). `--rt-glow` is **layered** now — a 6px core, a 22px bloom, a 48px
  spill — because one blur wide enough to spread does turn to fog, but a small bright layer
  under a large dim one does not. Section C6 fails any shadow that scales one channel and
  not the other, fails `--rt-glow` if it stops being layered or drops under 30px of reach,
  and forbids reading the raw `--rt-glow-mul` from CSS.
- **No `filter` on the container or the side panels.** A filter on an ancestor becomes the
  containing block for `position: fixed` descendants, and the widget has two:
  `#aim-results` and `.lb-ach-popover`. Both would start positioning against the widget
  instead of the viewport. `--rt-outline` goes only on panels with no fixed descendants;
  the suite asserts this.
- **Knocked-out type runs one direction only.** A `--rt-text` plate carrying `--rt-bg-1`
  glyphs is safe by the same guarantee the contrast chip measures — that exact pair with the
  roles swapped. An **accent** plate carrying text is never allowed: a dark Highlight would
  hide the label with no warning and nothing that could undo it.
- **Edit here, never the copy in the userscript.** Drift is silent until the next reinsert
  refuses to run.
