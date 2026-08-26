# Cyberpunk HUD — UI/UX Rework Tracking

Live checklist for the Cyberpunk HUD (`displayTheme: 'retro-futuristic'`) rework: an
independent colour-token model so the signature yellow is finally changeable, a selectable
panel geometry, a rebuilt animation layer, and the HUD motif groups.

**The design authority is the Claude Design canvas**, imported through the `claude_design`
MCP (`DesignSync`) and mirrored into `cyber-dev/ref/design/`:

> `8bc61946-b3c1-44e0-9ca6-717a56a2ac12` — *Cyberpunk Attendance Widgets*
> → `Attendance Widgets HUD.dc.html`, turn **3a** "Console MK-III — full HUD chrome"

Turn 3a is the assembled target; turn 1 (`1a`–`1f`) is the component vocabulary it was
built from, and turn 2 (`2a`) is the grouping study in between. Read 3a before changing
how anything looks — it is a complete, concrete composition, which the loose reference
sheets were not.

---

## Status — code complete, pending visual + portal verification

| # | Step | State |
|---|---|---|
| 1 | `CYBERPUNK_HUD_PLAN.md` tracking file | ☑ |
| 2 | Extract theme to `cyber-dev/` + `reinsert.js` + byte-identity assertion | ☑ |
| 3 | Bug fixes that block the new features | ☑ |
| 4 | Token model + Text/Glow/Border swatches + contrast guard | ☑ |
| 5 | Panel Shape setting (Rounded / Chamfered / Notched / Stepped) | ☑ |
| 6 | Motifs — frame+shimmer, brackets+chrome, glitch+boot-in, meters+backdrop | ☑ |
| 7 | ~~Audio visualizer — tiered System → Mic → Procedural, `--rt-beat`~~ | **removed** — see *Why the audio visualizer was removed* |
| 8 | `cyber-verify.js` + register in `ludo-dev/verify-all.js` | ☑ |
| 9 | `cyber-harness.html` built; **visual pass still needs a human** | ☐ |
| 10 | **Pass 2 — sci-fi → cyberpunk**, against the reference sheets | ☑ |
| 11 | **Pass 3 — against the Claude Design canvas** (see below) | ☑ |
| — | `BUILD_LABEL` v5 → v6 → **v7** (token-naming fix + emoji tint) | ☑ |
| — | **Portal verification** (see below) | ☐ |
| — | **Reference** — sheets in `cyber-dev/ref/`, canvas in `cyber-dev/ref/design/` | ☑ |
| 12 | **Palette picker in the real settings modal** + Violet Haze, 6th palette | ☑ |
| 13 | **Universal emoji sweep** — DOM-observed tinting, not a hand-typed site list | ☑ |

`node ludo-dev/verify-all.js` → **1642 assertions passed, 0 failed** across 11 suites
(605 of them the Cyberpunk suite). Needs the Volta Node 22 image, not the default
Node 10 — see `cyber-dev/README.md`.

---

## The four reported problems, and what actually causes each

Recorded because three of the four are defects, not taste — and two were invisible until
the CSS was read closely.

- **The yellow is unchangeable.** `--rt-text`, `--rt-text-dim`, `--rt-border`,
  `--rt-border-strong`, `--rt-grid` and `--rt-glow` hardcode `#fff200` /
  `rgba(255, 242, 0, …)` at `AttendanceTimeCheckerPlus.js:14039-14052`, and
  `applyPreferences()` writes only `--rt-accent`, `--rt-cyber-hl` and `--rt-cyber-panel`
  (17344-17351). So the Accent swatch can never move type, frames or bloom. In the reported
  screenshot the title reads olive because it is a **grey accent wearing a hardcoded yellow
  glow** — two different colours, one of which no control reaches.

- **`neonPulse` silently eats every stat-card shadow.** `animation: neonPulse 5s …
  !important` at 14232 animates `box-shadow` from `--neon-cyan`/`--neon-magenta` in `:root`.
  An active animation on a property beats the static declaration, so all four shadow layers
  at 14225-14229 *and* every per-card shadow at 14265/14277/14289 never render, and the
  pulse ignores the user's colours entirely. Nothing in the UI hints at this; it reads as
  "the cards look flat".

- **Neither sharp nor round.** `--rt-clip` (a 14px notch) is defined at 14058 and then
  cancelled by `clip-path: none !important` at 14503 and 14523. A duplicate `.modern-table`
  rule at 14497-14511, declared *after* 14183-14193, also resets `2px` → `10px`. The theme
  landed at 2-10px radii carrying dead chamfer code — harder than Glassmorphic's 16-24px,
  softer than a real HUD, and the notch survives only on `.completion-message` and compact PiP.

- **Two motifs total** — a 3px flowing top bar and a scanline overlay. `--rt-magenta` and
  `--rt-lime` are declared and never consumed; the `glitchText` keyframe at 12806-12828
  exists and is referenced by nothing.

---

## Decisions taken

| Question | Decision |
|---|---|
| Corner geometry | Selectable **Panel Shape** — Notched (default) / Chamfered / Stepped / Rounded. Brackets are overlays, identical in all four. Pass 2 moved the default from Rounded to Notched. |
| Colour model | Three new **independent** swatches — Text, Glow, Border — plus a live contrast guard. |
| Motifs | All four groups. |
| Audio | ~~Tiered System → Mic → Procedural rail~~ — **removed.** See *Why the audio visualizer was removed*. |
| Effects gating | **None — full effects always on.** Deliberate; cost contained structurally instead. |

### Reference material — how it was actually obtained

**RESOLVED, twice over.** Two independent sources now exist and they are used for
different things:

| Source | Location | Used for |
|---|---|---|
| Five reference sheets (Magnific-style HUD kits) | `cyber-dev/ref/*.png` | The motif *vocabulary* — what a cyberpunk frame, meter, dial or tag looks like in isolation. |
| The Claude Design canvas | `cyber-dev/ref/design/` | The *composition* — how those motifs assemble into this specific widget. Authoritative. |

The sheets were supplied by hand as pasted screenshots, because fetching them does not
work from this machine and that is not a tooling gap that trying harder fixes (see the
table below).

The canvas came through the `claude_design` MCP (`DesignSync`), which **does** work here:
`get_project` → `list_files` → `get_file`. Two things worth knowing next time:

- **A previous session concluded an MCP server "is not reachable because a session picks
  up MCP servers at start."** That was true of the server it was reaching for and false as
  a general rule — `DesignSync` was available as a deferred tool and only needed
  `ToolSearch` to load its schema. Check the deferred-tool list before concluding a server
  is absent.
- **`get_file` caps at 256 KiB of base64, which is 192 KiB of file, and truncates silently** —
  no error, just a short buffer. All six PNGs in the project came back cut at exactly
  196,608 bytes with no `IEND` chunk. Text files under the cap are fine; **binary assets
  over ~190 KB cannot be retrieved intact through this tool.** The `.dc.html` (62 KB) came
  through whole, and it is the part that mattered.

The truncated PNGs are kept in `cyber-dev/ref/design/` alongside `*-fix.png` repairs (valid
chunk stream + `IEND`, so a browser renders the recovered top portion). They are the
*inspiration* the canvas was drawn from, not the design, so the loss cost nothing —
but do not treat them as complete.

**The linked reference could not be retrieved, and that was not a tooling gap that trying
harder fixes.** What was attempted:

| Attempt | Result |
|---|---|
| `magnific.com/free-photos-vectors/cyberpunk-ui` | **403** — `<title>That request didn't go through. Our security filter flagged something.</title>` |
| Same URL with a full Chrome 131 User-Agent + `Sec-Fetch-*` headers via curl | **403**, identical. Not a UA check — a server-side bot filter. |
| `freepik.com` equivalents (same platform), `magnific.com/.../cyberpunk-hud-elements` | **403** |
| `stellae.design`, `designmd.app`, `dev.to`, `trends.daisyui.com`, `vecteezy.com` | TLS failure — `unable to verify the first certificate`, an intercepting proxy on this machine |

Getting past a site's security filter is not something to push on further, so the visual
design is authored from the cyberpunk HUD idiom directly, cross-checked against the motif
vocabulary that web-search snippets corroborate: clipped corners, angular brackets,
segmented bars, CRT scanlines, chromatic aberration, monospace data readouts, and neon held
to 15% surface coverage or less on near-black.

---

## Pass 2 — "it's sci-fi, not cyberpunk-ish"

The first pass was rejected on exactly that, and the reference screenshots make the gap
obvious. Recorded because it is a distinction that is easy to feel and hard to name, and the
next person to touch this will need it.

**What pass 1 was:** soft rounded glass plates, uniform 1px borders, wide gentle bloom,
`backdrop-filter` everywhere, symmetric L-brackets on all four corners. That is clean
futurism — a starship console. It is *not* the reference.

**What actually separates the two,** in order of how much each contributes:

| # | Cyberpunk | What pass 1 did |
|---|---|---|
| 1 | **Asymmetric silhouettes.** Not one frame in the reference is a rounded rectangle — step notches cut from a *single* corner, opposite-corner diagonals, terraced two-jump corners. | Symmetric rounded rectangles. Symmetry is most of the sci-fi read. |
| 2 | **45° hazard hatching** on edges, meter tracks, tabs. | None at all. |
| 3 | **Solid plates with knocked-out glyphs** — real mass on screen. | All outline and glow, no mass. |
| 4 | **Flat.** No glass, no blur, near-zero mid-tones. Hard colour on hard black. | `backdrop-filter: blur(14px) saturate(140%)` on every panel. |
| 5 | **Greeble** — mono codes, tick rows, segment counters. | A `.rt-chip` class that nothing rendered. |
| 6 | **Schematic connector dots** at bracket ends. | Plain L-brackets. |

**What changed:** four asymmetric shapes with `notched` (a right-angle step cut out of one
corner) as the shipped default; `--rt-hazard` / `--rt-hazard-dim` / `--rt-chevron` tokens
consumed on the container edge, table header, meter tracks and stat-card tabs; knocked-out
plates for the title, table header, stat labels, level badge and every active control; all
`backdrop-filter` removed in favour of flat `--rt-panel`; a `.rt-hud-rail` of greeble; two
radial-gradient terminal dots added to `--rt-brackets`; and `--rt-glow` tightened from an
18px halo to 7px, because a small hard halo reads as a lit filament and a wide soft one reads
as fog.

**The one new invariant this created.** Knocked-out type is the only place type sits on a
fill, so the direction is restricted: a `--rt-text` plate carrying `--rt-bg-1` glyphs is safe
by the same guarantee the contrast chip already measures — it is that exact pair with the
roles swapped. An **accent** plate carrying text is never allowed, because a dark Highlight
would hide the label with no warning and no control that could undo it. `cyber-verify.js`
finds every rule that sets `color: var(--rt-bg-1)` and checks what it sits on, following a
named mapping for the one case where the plate is on an ancestor (`th` on `thead`).

---

## Pass 3 — against the Claude Design canvas

Pass 2 was authored against loose motif sheets: a catalogue of frames, dials, meters and
tags with nothing saying how they go together. It fixed the *vocabulary* problem (asymmetry,
hazard hatching, mass, flatness) and left the *composition* problem untouched, because there
was nothing to compose against.

The canvas is a finished composition, so pass 3 is mostly about arrangement and hierarchy —
and it overrules pass 2 on two specific decisions.

### The two reversals

Recorded prominently because both were called out as deliberate wins last pass, and
reversing a stated decision without saying so is how a rationale becomes folklore.

**1. The title is no longer a knocked-out plate.** Pass 2 made `.summary-title` a solid
`--rt-text` block with `--rt-bg-1` glyphs and called it "the single biggest change away
from the sci-fi read: real mass on screen." The mass argument is right. The placement was
wrong. Every sheet and the canvas keep their ONE big display word as **open type with a
split colour fringe**, and spend solid plates on the small things — tags, ident codes, the
primary button. Pass 2 made the heading and the primary button look identical, which is a
hierarchy bug wearing a style. So the mass moved down to `.rt-code.is-block` /
`.stat-label` / the level badge, and the title took the aberration instead.

`--rt-aberr` is one `text-shadow`: a warm ghost 2px one way, a cool one 2px the other. It
is the cheapest item on this whole list and the most recognisably cyberpunk. Offsets stay
at 2px — past about 3px it stops reading as a mis-converged tube and starts reading as a
drop shadow. Asserted to be used **exactly once**: a second aberrated element reads as a
rendering fault rather than a style.

The canvas draws that word in pure white. It stays on `--rt-text` here, because white is a
colour no swatch reaches and no contrast chip measures — the moment someone picks a light
BG a hardcoded white title is unreadable with nothing to warn them. Aberration is
decoration layered *on* the measured colour, never a replacement for it.

**2. The table's column header is now quiet.** Same reasoning, same mistake. Pass 2 made
`thead` a solid plate; the table now carries a `.rt-sec` panel header directly above it,
and two heavy bars stacked read as a mistake rather than a hierarchy. In the canvas the
loud bar is the panel name and the column row beneath it is a thin dim caption. The `th`
also moved Orbitron → Rajdhani: at 0.62rem, letterspaced Orbitron collides with itself.

### What else changed

| # | The canvas does this | Pass 2 did this | Now |
|---|---|---|---|
| 1 | **One composition, repeated** — every panel opens with a glyph bar, a display name, a hazard filler and a right-aligned mono readout. | Nothing; panels just started. | `.rt-sec` — one rule, `--rt-sec-c` per panel. It is the rhythm that makes a stack of boxes read as one instrument. |
| 2 | **A hero, not three equals** — the number you came for gets a tinted fill, a solid accent border, a wide bloom and the biggest type. | Three identically weighted stat cards. | `.remaining-time-card` is the hero; the flanking two are drawn as reference values. |
| 3 | **A measuring instrument, not a progress bar** — hour ruler, tick comb, crawling chevron fill, hazard break bite, hard playhead. | A four-stop rainbow gradient flowing along the fill. | `.rt-ruler` + single-hue `--rt-chevron-fill` + a playhead on the **track**, positioned by `--rt-progress`. |
| 4 | **Colour by meaning** — arrival time and banked time are different hues. | Everything one yellow. | `--rt-data` role (aliases Highlight) on worked-time; Accent on check-in. See the new invariant below. |
| 5 | **Cuts that never line up** — neighbouring panels bevel opposite corners. | One `--rt-clip` everywhere, so a row of cards was three identical silhouettes. | `--rt-clip-alt` mirrors each shape; panels alternate. Asymmetry by *arrangement*, which is what the canvas actually does — not one weird shape. |
| 6 | **Studs on the frame edge** at unrelated offsets. | Symmetric border. | `--rt-studs`, two background layers. The container may never be clipped, so this is the only way left to break its symmetry. |
| 7 | **A ticker closing the frame** along the bottom. | Nothing. | `.rt-ticker`, real readings only (see below). |
| 8 | **XP as discrete slabs**, never a smooth fill. | Continuous gradient fill. | 20 sheared gaps knocked back out in `--rt-bg-1` over the top. Segmented reads as *count*; smooth reads as *proportion*. XP is a count. |
| 9 | **Hexagonal rank chip** — the one shape in the sheets that appears nowhere else. | Another slanted rectangle. | `.level-badge` is a hexagon. |
| 10 | **A square graph-paper grid** under the console. | `--rt-hex` diagonal lattice. | `--rt-grid-sq` at 44px on the container; `--rt-hex` kept for panel interiors, where nothing is hatched. The diagonal lattice fought the 45° hazard hatching. |

### The new invariant: every text-carrying swatch is measured

This is the one thing in pass 3 that is a genuine safety change rather than a visual one,
and it exists because **implementing item 4 above introduced exactly the defect this whole
rework was built to prevent.**

Colouring the punch log by meaning meant `color: var(--rt-accent)` on arrival times and
`color: var(--rt-data)` — i.e. the Highlight swatch — on banked time. Before that change
every glyph in the theme resolved to `--rt-text`, so a contrast chip measuring Text alone
covered the entire theme. After it, **two more swatches could hide a number, and neither
was measured.** Set Highlight to near-black and the worked-time column vanishes, with no
warning and no control that undoes it. The CSS looks completely fine.

Two ways out. Back the design out, or widen the guard. The guard is strictly better, so:

- `CYBER_TEXT_SWATCHES` in `cyber-hud.js` lists every swatch allowed to colour type —
  currently Text, Accent, Highlight. The chip reports the **worst** of them, **by name**
  (`Highlight vs BG 2.4:1 · too low`), because a bare number the user has to go hunting
  through three pickers for is not a warning.
- Still warns, never corrects.
- `cyber-verify.js` **section C2** enforces it mechanically: it collects every
  `color: var(--rt-*)` in the theme, resolves each var back to its swatch (following one
  hop of aliasing, so `--rt-data` → `--rt-cyber-hl` → `cyberHighlight`), and fails if any
  swatch colouring text is missing from the guard. **Add a coloured readout without adding
  its swatch and the suite fails.** That assertion is the only place this mistake is
  visible; in the browser it looks correct right up until someone picks a dark hue.

`--rt-data` is also asserted to stay an **alias** rather than a literal hex. Given a hex it
would escape both the contrast guard and the teardown list, and the Highlight picker would
silently stop moving half the console.

### Deliberately not done

**The canvas's STATUS column.** Turn 3a's punch log has six columns and closes with an
`ACTIVE` / `COMPLETE` / `OVERTIME` pill. Not implemented, because the table markup is
shared with Glassmorphic: adding a column changes a theme this work has no remit over, and
a theme is supposed to restyle, not restructure. The same signal is carried instead by
`tr.rt-active` — a class, not a column, invisible to Glassmorphic, marking the open session
with a hazard bite on its leading edge. If the column is wanted it is a widget change, not
a theme change.

**The canvas's invented telemetry.** 3a fills its ticker and footers with `GEOFENCE HQ-04
OK`, `PAYROLL CYCLE 08 SYNCED`, `CODE 17-WW-08-000`. Refused, and it is the one thing in
the canvas worth refusing: decoration that looks like telemetry teaches the user to stop
reading the parts that *are* telemetry. Every field in `.rt-ticker` and `.rt-tbl-foot` is a
real reading — sessions logged, worked, remaining, target, load, build. Decorative in role,
so `aria-hidden` and pointer-transparent, but the numbers are true.

**A 1440px fixed layout.** The canvas artboard is 1440px with a `1fr 372px` grid. The
widget is fluid and lives inside a portal page, so the composition was adopted and the
measurements were not.
---

## Emoji tint — the widget's emoji follow the theme

The widget renders ~32 emoji and every one of them was a full-colour system glyph sitting
in a monochrome HUD. No CSS colour property reaches them: `color` styles text, and an emoji
carries its own palette (COLR layers or a bitmap strike).

**Icons were considered and rejected** — an inline SVG set is the usual answer, but it adds
weight to a standalone script that ships as one file to every user. Tinting the glyphs that
are already there costs nothing at load.

**How it works.** One SVG filter, injected once per document by `ensureCyberEmojiFilter()`:
`feColorMatrix type="saturate" values="0"` flattens the glyph to luminance, then
`feComponentTransfer` maps that luminance through a ramp built from the Accent swatch.
Silhouette and shading survive; the palette becomes the theme's.

| Decision | Why |
|---|---|
| An **SVG** filter, not a CSS `filter` chain | The swatches are arbitrary user hex. The `sepia()`/`hue-rotate()` recipe only *approaches* a hue by iterative solving and drifts badly on dark or desaturated picks. `feComponentTransfer` takes the channel values directly. |
| **Three** ramp stops, not two | A plain black→hue duotone collapses every specular highlight into the hue and the glyphs go muddy — a gear stops reading as a gear. `CYBER_TINT_HILITE` (0.75) sets the third stop. Both were rendered before choosing. |
| `color-interpolation-filters="sRGB"` | The default is linearRGB, which comes out washed out and hue-shifted from the swatch the user picked. |
| Tint chains **ahead** of the drop-shadows | Reversed, the halo would be tinted too and would stop following Glow. |
| Never on a **button** | A filter applies to everything its element paints. Filtering `.game-switch-btn` would duotone its border and its knocked-out `--rt-text` fill along with the glyph. Hence `.rt-emo`, a bare wrapper that paints nothing. |
| Never on the **container** | Same `position: fixed` containing-block trap as `--rt-outline`. Asserted. |

### The one set that opts out, and why that is not a special case

`emojiSets.professional` is `🔴🟠🟡🟡🟢🟢🔵🔵` — a traffic light. **Its meaning IS the hue.**
Tinted to one colour all eight steps render as the same olive circle and the progress signal
is simply gone. This was found by rendering it, not by reasoning about it.

So `applyCyberpunkTheme()` publishes `data-emoji-set` on the container and the stylesheet
switches `--rt-emo-progress` to `opacity(1)` for that one set. The chrome still tints; only
the progress glyph opts out. `opacity(1)` rather than `none` because `none` cannot be
combined with other filter functions — a rule chaining a tint with drop-shadows needs a real
function there or the whole declaration is invalid and the glow goes with it.

It is the same principle as the contrast guard: **a control may not silently delete
information the user relies on.**

### `.rt-emo` is the first passthrough wrapper

Every other `rt-*` element is hidden in Glassmorphic. This one must not be — hiding the
wrapper would hide the emoji it wraps. `cyber-verify.js` grew a third exemption category,
`RT_PASSTHROUGH`, alongside `RT_INNER` and `RT_STATE`, and asserts in both directions: it is
not required to be hidden, and it must *not* appear in the hide block.

### What was verified in a real engine

| Checked | Result |
|---|---|
| The filter is injected and referenced | `#rt-emoji-defs` present, `.emoji-display` and `.rt-emo` both resolve `url("#rt-emoji-tint")` |
| The ramp follows the swatch | channel tables recompute per palette; rendered at yellow, magenta and acid green |
| The glow still works | `url(#…) drop-shadow(…) drop-shadow(…)` — the tint did not displace the bloom |
| The professional opt-out | `--rt-emo-progress` becomes `opacity(1)`, chrome stays `url(#…)` |
| Teardown | defs node gone, `data-emoji-set` gone, tokens unset, filters `none` |
| The wrapper survives teardown | `.rt-emo` still `visible`, 15px wide, still holding its emoji |
| A **missing** filter id | degrades to untinted, not to a blank element — so the PiP worst case is benign |

---

## Round 2 — a palette picker for the real settings modal, and tinting that actually covers everything

Reported after the first round shipped: the six quick-select palettes existed only in the
dev harness, never reached the real settings modal a user opens, and the achievement icons
— along with a good deal else — were still full-colour, un-themed emoji. Both are fixed
below, and the second one changed what "emoji tint" actually means.

### `CYBER_PALETTES` — one definition, three consumers

The harness's `PALETTES` object and a real settings-modal picker are the same feature in
two places, which is exactly the shape that produced the glow-converter drift
(`cyberGlowFromPct`/`ToPct` exists for the same reason). So the six swatch sets now live
**once**, in `cyber-hud.js`, as `CYBER_PALETTES` — keyed by camelCase id, each a `label`
plus all eight `cyber*` hex values. Both the harness's quick-select row and the settings
modal's new Palette row render `Object.keys(CYBER_PALETTES)` rather than a second hand-typed
list; `cyber-verify.js` **section H4** asserts both do.

**The dev-only broken palette does not leave the harness.** `Dark-on-dark ✗` exists to prove
the contrast guard fires, and a preset that fails its own guard has no business being
something a real user can pick from a shipped menu — it is layered onto the harness's
`PALETTES` object separately, after copying the six real ones out of `CYBER_PALETTES`, and
is not part of the module at all.

**Violet Haze is the sixth, real palette.** Picked and tuned with the actual contrast
functions (`contrastRatio`/`relativeLuminance`, called directly — no browser needed, they
take hex in and a ratio out) rather than eyeballed: Accent came in at 5.45:1 against
Text/Highlight's 14+, tight enough to be worth widening, so it moved from `#b666f2` to
`#c88bf5` for a comfortable 7.47:1. **Section H4 checks all six palettes this way**, not
just the new one — a shipped preset that fails the guard it ships beside teaches the user
the warning is noise, so nothing goes out the door without the check running on it.

The settings-modal Palette row is six round swatch buttons above the existing eight
individual pickers, mirroring the harness rig and the existing `.pool-color-swatch`
pattern. Clicking one sets all eight `cyber*` preferences **and** updates the eight
`<input type="color">` elements' own displayed values (assigning to `userPreferences` alone
does not move an input's swatch — it has to be told directly) — and the individual pickers
stay live afterward, since a preset is a starting point, not a lock.

### The emoji tint was never "wrap every emoji" — it just looked like it

Round 1's approach was a regex over the SOURCE, finding 32 literal emoji sitting in HTML
template strings and wrapping each by hand. It could not, even in principle, find an emoji
that arrives from a **data structure** at render time —
`badge.innerHTML = achievement.icon`, `pop.innerHTML = ...${a.icon}...` — because there is
no emoji character anywhere in the source at those call sites; it is a property read. That
is exactly where the achievement badges, the leaderboard's join card, and the settings
modal's own close button (`✨ Save & Close`) were still full-colour: a regex over text
cannot find a property no reads happen at parse time.

**The fix changes the unit of work from "a place in the source" to "whatever actually landed
in the DOM."** `cyberSweepEmoji(root)` walks a subtree with a `TreeWalker`, and
`cyberWatchEmoji(root)` attaches a `MutationObserver` that keeps sweeping forever. Once
attached to the widget's own container, this needs no further hand-maintained list: a
future feature that injects an emoji from anywhere gets covered automatically, because the
mechanism watches the rendered page, not the file that produced it.

**Which characters actually get wrapped, and why not more.** The regex distinguishes two
Unicode properties on purpose:

- `Emoji_Presentation` — codepoints the platform renders through its colour emoji font **by
  default** (faces, food, tools with no trailing marker).
- `Extended_Pictographic` **+ a trailing U+FE0F** — codepoints that default to a plain TEXT
  glyph (already correctly following `--rt-text`) but are explicitly forced into colour
  presentation by a variation selector: the ⚙️/⏱️/⚠️/❤️ family.

`Extended_Pictographic` **alone**, with no `FE0F`, is deliberately excluded — it also
matches a bare check mark, star or arrow, which render as plain monochrome glyphs the CSS
already colours correctly. Tinting those would re-derive, through a lossier path, a colour
`color: var(--rt-text)` already had right.

**Where the sweep is explicitly told to run, and why those four places specifically.**
Everything inside the widget's own subtree is covered by one `MutationObserver`, attached
once from `applyCyberpunkTheme()`. Four surfaces live *outside* that subtree, in
`document.body`, and each needed an explicit `cyberSweepEmoji()` call at its own point of
content-freshening, because nothing else would ever see them change:

| Surface | Called from | Why explicit, not the container observer |
|---|---|---|
| Achievements modal | `openAchievementsModal()`, after `.innerHTML` | `document.body.appendChild`ed — a sibling of the widget, not a descendant |
| Leaderboard achievement popover | `showLbAchPopover()`, after `.innerHTML` | Same — a shared, viewport-fixed popover |
| XP toast notifications | `showXPNotification()`, before `appendChild` | A fresh, throwaway element every call — an *observer* here would just leak; a one-shot sweep is correct and cheap |
| Settings modal | `toggleSettingsModal()`, on **every** open | Built once, ever (`if (!modal) createSettingsModal()`); if it was first built while Glassmorphic was active, its content has fired no mutation since, and the container observer is not watching it anyway |

**One correcting sweep on the actual switch-in, never on a colour drag.**
`applyCyberpunkTheme()` runs on every 'input' event while a colour picker is being dragged —
attaching the observer there is a one-time, idempotent, near-free WeakSet check, but a full
*sweep* of the whole widget on every one of those ticks would be the kind of thing that
reads as "the picker feels laggy" with nothing in the console to explain it. So the one full
correcting pass — for content that rendered while Glassmorphic was active and has not
mutated since — runs from the host's `enteringRetro` branch instead, exactly once per actual
theme switch.

**What the sweep will never touch.** `SCRIPT`, `STYLE`, `NOSCRIPT`, `TEXTAREA`, `TITLE`,
`OPTION` and `SELECT` are excluded outright — splitting an inline `<script>`'s text node
would corrupt running code, not decorate it. `.emoji-display` (the big mood glyph) is also
excluded: it already carries its own bespoke filter chain with the professional-set
opt-out (`--rt-emo-progress`), and wrapping its text too would nest one filter inside
another for no visual gain. An already-wrapped `.rt-emo` is skipped on sight — this is also
what stops the observer from recursing on its own output, since inserting the wrapper span
is itself a mutation the observer would otherwise see and re-process forever.

**A pre-existing gap this surfaced.** `ensureCyberEmojiFilter()` (from round 1) had no
feature-detection for `doc.createElementNS`, and nothing had ever called
`applyCyberpunkTheme()` against `cyber-verify.js`'s hand-rolled Node stub to notice — the
suite only checked it by static string match. Writing a stub-safe `cyberSweepEmoji()`
alongside it and then actually calling `applyCyberpunkTheme(m.container)` in the same
breath surfaced the older gap immediately; both are feature-detected now, so either
no-ops cleanly instead of throwing when a test environment has no real SVG/DOM.

**A test-pollution bug caught before it shipped.** The first draft of the palette-contrast
check called `load()` once per palette to get an isolated `cyberWorstContrast()` reading —
but `load()` reassigns `global.document`/`global.userPreferences` on every call
(`stubEnvironment()`'s job), so six calls in a loop left the *last* palette's stub state
ambient for every section below it in the file. One unrelated assertion in a later section
started failing. Fixed by using the pure `contrastRatio(hexA, hexB)` function directly
(hex in, ratio out, no global reads) instead of routing through a second `load()` — the
same lesson as `paletteWorstContrast()`'s own comment: a check that mutates shared state to
verify something is a check that can break everything after it.

### What was verified in a real engine

| Checked | Result |
|---|---|
| Violet Haze contrast, numerically | Text 14.34:1, Highlight 11.09:1, Accent 7.47:1 — all AA-passing, computed via the pure `contrastRatio` function, no browser needed |
| Violet Haze, rendered | frames, hazard hatching, glow, hero card and the emoji-tint demo row all resolve to the violet ramp; the runtime chip itself reads `Accent vs BG 7.5:1 · AA` |
| The harness's Palette row | six buttons render from `CYBER_PALETTES`, plus the dev-only `Dark-on-dark ✗`; clicking Violet Haze applies all eight tokens |
| **The exact reported bug, reproduced then fixed** | `badge.innerHTML = '🏆'` injected into the widget with **zero** explicit sweep call — the pre-attached `MutationObserver` wrapped and tinted it automatically |
| Idempotency | an explicit re-sweep after the observer already wrapped something adds no second `.rt-emo`, no duplicated text |
| `SCRIPT`/`STYLE` exclusion | injected `<script>`/`<style>` nodes containing emoji-looking text are swept and come back byte-for-byte unchanged |
| `.emoji-display` exclusion | the progress glyph never gains an `.rt-emo` wrapper; its own filter chain is untouched |

---

## The token contract

The whole of problem #1 is that presentation tokens were literals instead of derivations.

```
USER-SET, MUTUALLY INDEPENDENT — no token here is derived from another
  --rt-bg-1 / --rt-bg-2                     BG 1, BG 2
  --rt-accent       / --rt-accent-rgb       Accent
  --rt-cyber-hl     / --rt-cyber-hl-rgb     Highlight
  --rt-cyber-panel  / --rt-cyber-panel-rgb  Panel
  --rt-text         / --rt-text-rgb         Text     <- NEW
  --rt-glow-color   / --rt-glow-rgb         Glow     <- NEW
  --rt-border-color / --rt-border-rgb       Border   <- NEW

DERIVED — by opacity from their OWN parent only, never cross-hue
  --rt-text-dim       rgba(var(--rt-text-rgb),   .72)
  --rt-border         rgba(var(--rt-border-rgb), .32)
  --rt-border-strong  rgba(var(--rt-border-rgb), .70)
  --rt-grid           rgba(var(--rt-border-rgb), .06)
  --rt-glow           0 0 18px rgba(var(--rt-glow-rgb), calc(.35 * var(--rt-glow-mul)))

SEMANTIC ROLES — names for what a hue MEANS, not new user swatches
  --rt-data / --rt-data-rgb      = var(--rt-cyber-hl) — "measured": worked,
                                   elapsed, logged. Aliases the Highlight
                                   swatch, so it stays user-settable and stays
                                   in the teardown list. Asserted to remain an
                                   alias; a literal hex here escapes both.
  --rt-accent                    = "targeted": remaining, live, the thing you
                                   are waiting for.

RUNTIME
  --rt-progress  the meter percentage, written per render on .progress-bar
  --rt-glow-mul  the raw Glow Intensity preference, 0-1. NOTHING in the CSS
                 reads it — it is what gets stored and torn down.
  --rt-glow-k    the same number, guarded and clamped. Every glow multiplies
                 BOTH its radius and its alpha by it, and scales from zero, so
                 0% is off and 100% is everything the theme has. Written by
                 applyCyberTokens() rather than derived in CSS, because the
                 settings modal is body-level and cannot see a property
                 declared inside .retro-theme.
```

The console is bi-chromatic and the second hue does real work: reading one number against
the other is the whole job of this widget. Giving the two a *role name* rather than
spelling `--rt-cyber-hl` at forty call sites is what makes "which hue means what" reviewable.

**Invariant 1 — nothing that carries type derives from an accent or a background.**
`--rt-text` shares no ancestor with `--rt-accent` or `--rt-bg-*`, so a dark Accent or a dark
BG can never darken the type. This is the specific failure mode the rework exists to make
impossible, so `cyber-verify.js` section C asserts it structurally rather than trusting review.

**Invariant 2 — any swatch that *is* allowed to colour type is measured by the contrast
guard.** Roles are for fills, rules and glyphs by default; where the design genuinely needs a
coloured readout, the swatch must appear in `CYBER_TEXT_SWATCHES`. Section C2 enforces it.
See *Pass 3* above for why this exists — it was added because pass 3 broke invariant 1's
spirit while satisfying its letter.

---

---

## What is actually verified, and what still needs eyes

Previous passes recorded "code complete, cannot see it render" and left it there. Part of
that gap has now closed, and it is worth being precise about which part.

A browser can be driven far enough to read back **computed styles** even with no screenshot
available. `node cyber-dev/snapshot.js` builds a self-contained harness for exactly this.
The following were confirmed **in a real engine**, not by reading the CSS:

| Checked | Result |
|---|---|
| The whole stylesheet parses | 195 rules; no declaration discards the rest |
| `caption.rt-sec` display | `table-caption` — still a real caption |
| `td.rt-tbl-foot` display / span | `table-cell`, `colSpan: 5` — span intact |
| Caption / footer / table widths | 344px / 344px / 344px — all flush |
| `.rt-sec-row`, `.rt-foot-row` | both `flex` — layout landed on the inner rows |
| Title | `background-image: none`, and the shadow resolves to the aberration pair plus the glow |
| Alternating clips | worked card cuts bottom-right, completion card cuts top-left — genuinely different polygons |
| All four shapes | each resolves a clip *and* a clip-alt; `rounded` correctly resolves neither |
| Hero card | `1px solid rgb(255,242,0)`, value at 30.4px against the others |
| Meter | single-hue cyan chevron running `rtHazardCrawl` |
| Column colours | check-in `rgb(255,242,0)`, worked `rgb(0,229,255)` |
| Level badge | the six-point hexagon polygon |
| Container / side panels | `filter: none` — the `position: fixed` trap is still avoided |
| Ticker | running `rtTicker`; the run text is exactly its own first half twice |
| **Every swatch actually reaches its tokens** | all eight set to black → no `255, 242, 0` survives anywhere; Border→magenta / Glow→cyan with Text held at yellow moves frames and bloom and leaves type alone |
| **The default palette is unchanged** | with prefs cleared, every token resolves exactly as before the fix |

**This found a real bug before it shipped** — the table-display trap in the bug list below.
Reading the CSS would not have found it; nothing about it looks wrong.

### What this does NOT cover

Everything that matters about whether it looks *good*. Specifically still unjudged:

- **Density.** The reference is far denser than this. That was a deliberate hold, not an
  oversight — the widget carries real data and greeble competes with it. One dial to turn if
  it reads as too sparse.
- **Whether the hero card is too loud** relative to its two neighbours.
- **The aberration at 2px** — right on small display type, or too much?
- **The subcode's vertical alignment.** `.summary-header` is `align-items: center` with a
  4rem emoji in it, so `// SHIFT.8H` centres against the emoji rather than sitting on the
  title's baseline the way the canvas has it. Deliberately left alone: fixing it means
  changing the shared header's alignment, which moves the emoji for both themes.
- **Flat vs glass.** Every `backdrop-filter` is still gone; reversible in one token.
- **The rebuilt glow — nothing about it has been seen.** Base radii went up 3–5x and
  became layered (6px core / 22px bloom / 48px spill), which *changes the default look*.
  Reach at the default went 7px → 29px. If it is too much, the dial is the three radii in
  `--rt-glow`, not the slider range — widening the range was the previous mistake.
- **Status without a status colour.** `--rt-magenta` / `--rt-lime` / `--rt-warn` are gone,
  so "live" is now carried by a blink and a bullet rather than by green. Check the HUD
  rail's `● LIVE` and the EQ button's three states still read as distinct at a glance.

`start cyber-dev/cyber-harness.html` — that part still needs a person.

**When a question is about page state rather than pure CSS, drive Chrome over CDP.** No
MCP server is required and none needs to have been bound at session start: launch the
installed Chrome with `--headless=new --remote-debugging-port=9222`, read
`http://127.0.0.1:9222/json/list`, connect to the page's `webSocketDebuggerUrl` with Node
22's global `WebSocket`, and call `Runtime.evaluate`. It runs in the **main world**, so
`userPreferences` and `repaint()` are reachable — the thing `snapshot.js` explicitly
cannot do. Point it at `cyber-harness.html` directly; the relative `<script src>` resolves
fine from `file://`, so no snapshot build is needed. This is what finally settled the
all-black report after two sessions of static analysis reached the wrong answer.

---

## RESOLVED — the all-black report, and why the deduction that "should be impossible" was wrong

**Reported:** with all eight swatches set to black in the harness, the title, the
hazard hatching and the frame borders still rendered **yellow**, and the `● LIVE`
tag still rendered bright.

Both halves are now explained and fixed. The LIVE half was `--rt-lime`, one of
three hardcoded hues no swatch reached (bug list below). The yellow half was a
**property-name mismatch across the JS/CSS boundary**, written up in the bug list
as *"Two swatches wrote to property names nothing read."*

### How it was settled, since it matters more than the answer

No browser MCP was bound to the session, which is what stalled this last time.
That is not the only way to reach a browser: Chrome is installed locally and Node
22 ships a global `WebSocket`, so **headless Chrome can be driven directly over
the DevTools Protocol** — launch with `--remote-debugging-port`, read
`/json/list`, connect, and call `Runtime.evaluate`. Roughly 60 lines, no
dependencies. It answered in one run what two sessions of static analysis could
not.

One thing that makes this strictly better than the `snapshot.js` route: CDP
evaluates in the **main world**, so `userPreferences`, `repaint()` and
`applyCyberpunkTheme()` are all reachable. The isolated-world limitation
`snapshot.js` documents is a constraint of *that* surface, not of driving a
browser. `snapshot.js` is still the right tool when all you need is computed
styles; CDP is the one to reach for when the question involves page state.

The diagnostic returned:

```
inline  : #000000
computed: #000000
pref    : #000000
```

### The table above was wrong, which is the part worth keeping

That result — all three black — was the one row the old table mapped to *"the
page was stale."* The page was fresh, `applyCyberTokens()` had run, and the frame
was still yellow. **The table had no row for what was actually happening**, and
neither did the reasoning above it.

The reasoning failed because of one unstated assumption: that a token write is
all-or-nothing. Both "facts" were true simultaneously — `repaint()` ran *and* the
tokens were written — but two of the eight landed under names with no readers.
`--rt-text` was one of the six that worked, so the diagnostic probed the one
token that was never broken.

**The general lesson, since this cost two sessions:** when two established facts
contradict, the error is usually in an assumption neither fact states. Widening
the probe — dumping *every* inline custom property rather than the one under
suspicion — showed it immediately, and would have shown it the first time.

## Portal verification — still to do

The harness renders CSS honestly but cannot prove any of these; they need the real page.

- [ ] **The reported bug itself** — set Accent to mid-grey and Text to yellow: type stays
      yellow, frames follow Border. **Proven in a real engine** (see *RESOLVED* above), so
      what is left here is only that the portal wires the same path — `applyPreferences()`
      rather than the rig's `repaint()`.
- [ ] **Contrast guard, Text** — set Text to near-black on the default dark BG: the chip goes
      red and *nothing auto-changes*. Warning, never correction.
- [ ] **Contrast guard, the other two** — set **Highlight** to near-black: the chip must read
      `Highlight vs BG …` and go red. Then the same for **Accent**. This is the pass-3
      invariant; if the chip still says "Text" the widening did not take.
- [ ] **The punch log reads by meaning** — check-in column in Accent, worked column in
      Highlight, the open session's row carrying a hazard bite on its left edge.
- [ ] **The table header and footer span the full width.** Specifically: the `Punch Log`
      caption is as wide as the table and the `Day Total` footer spans all five columns. If
      either has collapsed to one column, a `display` override has broken the table box —
      see the bug note above.
- [ ] **The footer total ticks.** It is patched by `updateDynamicContent()`, not re-rendered;
      if it is frozen at the page-load value the wiring is missing.
- [ ] **The timeline reads as an instrument** — hour labels aligned to the comb, chevrons
      crawling, playhead sitting on the fill boundary at both 0% and 100%.
- [ ] **The meter highlight stays inside the meter.** The pale sweep must enter
      and leave within the filled portion — never crossing the track edge, and
      never appearing over the table. This was reported broken
      and the fix is a clip, so it is worth re-checking rather than assuming.
- [ ] **The bottom frame edge crawls sideways, not up and down.** The hazard
      strip along the container's bottom must move horizontally like every
      other hazard band. If it bobs vertically, something has put a transform
      back on the container's CRT layer.
- [ ] **The Glow slider is worth dragging end to end.** At 0% there should be
      no bloom anywhere; by 50% it should be clearly lit; at 100% it should be
      close to too much. If the change is only visible in the top third, the
      base radii have been tightened again — see the bug note.
      Watch the **settings modal's own title** while dragging: it is the one
      piece of chrome in view, and it used to be the one that never moved.
- [ ] **The default is brighter than it was, on purpose.** This is the one
      change in this round that alters the shipped look. If it is too much at
      60%, the dial is the three radii in `--rt-glow` — not the slider range.
- [ ] **Alternating cuts** — the three stat cards must not be three identical silhouettes.
      Check under all four Panel Shapes; `rounded` deliberately has no cut at all.
- [ ] **Switch to Glassmorphic and look for stray text.** Every `rt-*` element is emitted for
      both themes and hidden by one selector list. The suite checks that list both ways, but
      only the browser proves it: an unstyled `Punch Log` or a stray `● LIVE` sitting in the
      middle of the Glassmorphic widget is the failure.
- [ ] **All three panel shapes** on the table, stat cards, side panels and completion message.
- [ ] **The `neonPulse` regression** — hover a stat card: the shimmer travels *and* the card's
      own shadow is still visible.
- [ ] **Game Mode** → the ticker and progress bar survive (they live in
      `.main-attendance-content`); side panels collapse as before.
- [ ] **Theme round-trip** — switch to Glassmorphic and back: no `--rt-*` var left on the
      container or `documentElement`, no orphaned `.cyber-bg-image`.
- [ ] **PiP + compact mode** in Cyberpunk, and the ⛶ Max modal for both Pool and Ludo.
- [ ] **Frame rate** — a full Ludo and Snake run.

---

## Why the audio visualizer was removed

Step 7 shipped and was then **deleted in full** — `cyber-audio.js`, the `--rt-beat`
coupling, the `cyber-eq` rail markup, the Audio Visualizer setting, and every assertion
about them. What it actually did in a real browser did not match what it promised, and the
gap was structural rather than a bug worth fixing.

**The reported symptom.** It asked for microphone *and* screen-share permission, then drew
the same procedural wave pattern regardless of what was playing. Permission granted, no
real reactivity.

**The root cause.** The tiered connect flow ran exactly once per page load.
`initCyberEq()` was called from `applyPreferences()` on every render, but guarded the real
work behind a `cyberEqResumed` flag:

```js
if (!cyberEqResumed) { cyberEqResumed = true; cyberEqAutoResume(); }
else if (cyberEqSource() !== 'off') { cyberEqStartLoop(); }
```

After the first call, every later settings change took the `else` branch — which starts the
draw loop and nothing else. `cyberEqConnectSystem()` / `cyberEqConnectMic()` were never
reached again, and `cyberDetachStream()` was never reached either. So choosing "Mic" or
"System audio" from Settings after load changed the label and started a loop with no
analyser attached, which falls through to the procedural path by design. Switching *away*
from a live tier likewise never tore the stream down. The dropdown was decorative in both
directions; only the rail's own button (which went through `cyberEqCycle()`) ever really
connected anything.

**Why not just fix it.** Wiring the dropdown into `cyberEqCycle()`'s path is a small
change, and it would have made the control honest. It would not have made the feature good.
The ceiling is set by the platform, not the code, and it is low:

- There is **no system-loopback tap** in the Web Audio API. The only route to "whatever is
  playing on this machine" is `getDisplayMedia({ audio: true })` — a gesture every session,
  a share picker, a mandatory video track to discard, a persistent screen-share banner, and
  on Windows nothing at all unless the user finds and ticks *"Also share system audio."*
- The mic tier hears the room, not the output. With headphones on it reads flat, which is
  indistinguishable from broken.
- So the honest default is the procedural rail — decoration that asks for no permissions and
  reacts to nothing. Which is what everyone was already getting, minus the prompts.

Asking for a screen-share grant to drive a glow is a bad trade at any implementation
quality. The feature was a gimmick; it is gone rather than repaired.

**What came out with it.** `--rt-beat` was multiplied into eight glow declarations across
the theme. Each is now its **base radius alone** — the value the beat scaled *up* from, so
the resting appearance is unchanged and the coupling is simply absent. The harness lost its
Beat slider (it existed only because the glows could not otherwise be judged with audio
off), and `cyber-verify.js` dropped sections L and M along with the beat-teardown and
`cleanupCyberAudio` assertions: 551 pass, 0 fail.

---

## Bugs found during implementation and review

The three above are the pre-existing defects the rework fixes. These four surfaced while
building it, and each now has an assertion.

- **Folding the token blocks together silently dropped the Highlight/Panel defaults.** The
  original declared `--rt-cyber-hl`/`--rt-cyber-panel` in a *second*, later `.retro-theme`
  block that only existed to provide cyan fallbacks. Consolidating the tokens into one
  place lost it, and because an unset `var()` makes the whole declaration invalid rather
  than throwing, every rule consuming those four properties would have rendered unstyled
  until `applyPreferences()` happened to run. Restored inside the main block, with the
  reason written next to it. `cyber-verify.js` now asserts every `var()` consumed in the
  theme is declared in the theme.
- **The card shimmer was never "not animating" — it was animating invisibly.** The base
  glassmorphic `.stat-card::before` sets `opacity: 0` and reveals it only on `:hover`, and
  the Cyberpunk override changed just the gradient colours. So the reported symptom had
  nothing to do with the keyframe: it ran the whole time, at zero opacity. It is now
  visible at `0.55` and brightens to `1` on hover. Worth recording because the obvious fix
  — adding an animation — would have changed nothing.
- **A directly-bound EQ button would have been orphaned on every re-render.**
  `renderFullContent()` rebuilds the widget's markup, so a listener attached to
  `#cyber-eq-btn` dies the next time the widget redraws and the rail goes dead with no
  visible cause and nothing in the console. Delegated from `document` instead: bound once,
  survives every render.
- **A `filter` on the container would have broken two position:fixed elements.** Pass 1 put
  `filter: drop-shadow(...)` on `.attendance-summary.retro-theme` to couple the beat glow. A
  filter on an ancestor becomes the containing block for `position: fixed` descendants, and
  the widget has two — `#aim-results` (the Aim Trainer results panel) and `.lb-ach-popover`
  (the leaderboard achievement popover). Both would have started positioning against the
  widget instead of the viewport. Nothing in the test suite could have caught it and nothing
  in the CSS looks wrong; it was found by grepping for `position: fixed` inside the widget
  subtree before adding more filters. `--rt-outline` filters are applied only to panels with
  no fixed descendants, and `cyber-verify.js` asserts the container and the side panels
  carry none.
- **The compact-PiP display carried the *same* box-shadow bug.** Found while checking the
  loose ends: `.compact-mode.retro-theme .pip-compact-display` ran
  `animation: neonGlowPulse 4s … !important`, which animates `box-shadow` *and*
  `border-color` from hardcoded `#00f0ff` / `#ff00ff` / `#00ff41`. So its own declared
  shadow — which correctly used `--rt-glow` and `--rt-accent-rgb` — never rendered, and its
  glow ignored every swatch. That block lives outside `cyber-dev/`, so the fix went in
  place: a new `rtGlowBreathe` keyframe that animates `filter` only, plus the compact clock
  repointed from `--rt-accent` to `--rt-text` and its radius onto `--rt-radius-sm`. The
  assertion for this is deliberately **file-wide** rather than scoped to the managed block:
  it collects every animation any `.retro-theme` rule runs, anywhere in the 19k lines, and
  checks none of those keyframes touches `box-shadow`. Writing that check also turned up
  that `:not(.retro-theme)` — how nearly every Glassmorphic rule is written — makes a naive
  selector search match precisely the rules it must ignore; the negations are stripped
  first, or `auroraGlow` reads as a Cyberpunk regression when it is the aurora look working
  as intended.
- **Three animation bugs, all the same shape: one element asked to do two
  opposing things.** Reported against pass 3 and fixed; pinned by
  `cyber-verify.js` **section C5**, and each assertion was checked by
  reintroducing its bug and confirming the suite goes red.

  - **The meter highlight escaped the meter.** `.progress-fill::after` travels
    to 200% of its own width, and the fill was `overflow: visible` — so the
    pale sweep ran clear across the widget, entering left of the track and
    leaving off the right edge. It was visible *because* of the playhead: the
    playhead needed to overhang the track, so the fill was left unclipped, and
    the sweep escaped through the same opening. One element cannot be both
    clipped and not clipped. **The playhead moved to the track** as
    `.progress-bar::after` and the fill now clips. The cost is that the track
    needs the percentage, so `--rt-progress` is written beside the fill's
    inline width and `updateDynamicContent()` keeps the two in step — without
    that the marker parks where the page loaded while the fill keeps moving.
    It is declared `0%` in the token block, not just given a `var()` fallback,
    because an unset var invalidates the whole declaration and would drop the
    playhead rather than zero it.

  - **The sweep read as a hesitation, not a pass.** `-120% → 280%` on
    `ease-in-out` spent most of its cycle parked off both ends. Linear now,
    and only far enough to clear the edges.

  - **The bottom frame edge bobbed vertically.** The container's `::after`
    paints three layers whose motions differ — the hazard strip should crawl
    sideways, the scanlines jitter downward, the vignette hold still — and it
    carried the jitter as a `translateY()` on the whole pseudo-element. A
    transform moves every layer it paints, so the frame edge twitched up and
    down in lockstep with the CRT. The two motions are now separate
    animations on `background-position-x` and `background-position-y`, which
    is the only way to give layers different directions *and* different timing
    on one element. The strip also had to become a repeating 22px tile: it was
    a single `no-repeat` band stretched to `100%`, which cannot crawl however
    it is animated.

  Worth naming the general lesson, because the theme is dense with
  multi-layer backgrounds and shared pseudo-elements: **a transform belongs
  to the whole element, and `overflow` belongs to the whole element.** When
  two things painted by one element need different treatment, the answer is
  per-layer properties (`background-position-x/-y`) or a different owner —
  not a compromise between them.

- **Three hardcoded hues no swatch could reach, and one of them coloured text.**
  Reported as: *set every swatch to black and the LIVE tag is still bright.*
  Exactly right.

  The theme declared `--rt-magenta`, `--rt-lime` and `--rt-warn` as "fixed
  signal hues: status only, never load-bearing for text" — and then coloured
  text with them in four places: both title glitch ghosts, the HUD rail's
  `● LIVE` tag, and the EQ button's procedural state. The comment was the
  whole safeguard, and the comment was wrong.

  **This is strictly worse than the defect the rework exists to fix.** A dark
  Accent at least has a control the user can move. A literal in the stylesheet
  has none at all, and no contrast guard can measure it — so it survives every
  palette, including all-black, which is precisely how it was spotted.

  All three are deleted. Status is carried by **form** now instead of a private
  palette: the LIVE tag blinks and shows a bullet, the EQ button knocks out when
  the analyser is really running and outlines in the data hue when it is
  procedural. The title ghosts took Accent and `--rt-data`, which also makes
  them obviously the same effect as `--rt-aberr` rather than an unrelated pair.
  `--rt-cyan` survives only as the pre-JS fallback the Highlight and Panel
  swatches resolve to, and is asserted never to be painted with directly.

  Section C2 now fails if any of those tokens comes back, if one is consumed, or
  if any rule colours text with a raw hex. The contrast chip's three states are
  the one allowed exception, and are listed by value: a *warning* that changed
  colour with the palette would be useless.

- **The Glow Intensity slider did almost nothing, and it took two attempts to
  find out why.** Worth the space because the first fix was plausible, passed
  its own assertion, and was still wrong.

  **First diagnosis: alpha-only scaling.** `--rt-glow-mul` multiplied alpha and
  nothing else — every blur radius was a fixed literal. At the default the main
  glow already sat at `0.51`, so the top half of the travel moved it to `0.85`
  across an unchanged 7px blur. True, and not the whole story. Three glows
  ignored the control entirely (the section glyph, the playhead, and the
  settings modal title — the one piece of chrome in view *while dragging the
  slider*).

  **The fix that did not work: widen the range.** Radius was made to scale, and
  the slider extended to 300% of the shipped glow. Reported back: *"hardly any
  visible glow from 0-160%"*. Correct — and the reason is the part worth
  keeping.

  **The real cause: the base radius.** Pass 2 tightened `--rt-glow` from 18px
  to 7px, reasoning that *"a small hard halo reads as a lit filament, a wide
  soft one reads as fog"*. At 7px there is barely a halo to scale — tripling
  nothing is still nothing. **The range was never the problem; the base was.**
  Widening the slider was treating a symptom, and it made the control worse:
  a slider whose useful travel is its last third is harder to use than a short
  one.

  **What it is now.** A plain **0-100%** onto a 0-1 scale — no normalisation,
  nothing to convert. Base radii are 3-5x larger and **layered**: a hot 6px
  core, a 22px bloom, a 48px spill. That last part is why the pass-2 instinct
  was half right — a single wide blur really does turn to fog, but stacking a
  small bright layer under a large dim one keeps the glyph crisp while the
  light travels a long way from it. Reach at the default went from 7px to
  29px; at 100%, 48px.

  **This changes the default look**, and that is intended rather than
  overlooked: the request was more glow, not a longer slider.

  Two assertions pin it. Section C6 fails any shadow that scales alpha without
  scaling radius, and — the one that matters for the second mistake —
  **`--rt-glow` must be layered and must reach at least 30px**, so nobody
  quietly tightens the base back and leaves the slider looking broken again.

  Writing the first of those needed a balanced-paren scan rather than a regex.
  These values nest three deep, and the regex version silently matched 7 of 11
  declarations and then **passed on a deliberately reverted alpha-only glow**.
  It was caught only by reintroducing the bug and noticing the suite stayed
  green — which is now the standing habit for anything in this file.

- **Harness controls that looked wired and were not.** The rig is the only way
  anyone judges this theme, so a control that appears to work but exercises
  nothing is worse than a missing one: it produces a confident "I checked
  that" about something never tested. Two were live —

  - **Game Mode toggled `.gm-off`, a class no stylesheet anywhere defines**,
    and faked the visible part with inline `display: none`. The widget really
    uses `.game-mode-hidden` on the panels and `.game-mode-off` on the
    container. The button now toggles those, and the harness base sheet
    carries the real collapse rules, so the rig exercises the path that ships.
  - **The glow slider did its own arithmetic** in the old units, so after the
    change above it would have disagreed with the settings panel. It routes
    through the same converters now.

  The readout also reported `cyberTextContrast()` (Text only) while the chip
  beside it named the worst of three swatches — the rig disagreeing with
  itself. Both read the worst now.

  **Section C7** checks that every id in the rig markup is read or written by
  the rig script, and that every class the rig toggles is selected by *some*
  loaded stylesheet. That second one is what would have caught `.gm-off`.

- **Colouring the punch log by meaning silently un-measured two swatches.** Full write-up
  under *Pass 3* — the short version is that `color: var(--rt-accent)` and
  `color: var(--rt-data)` were the theme's first accent-coloured type, which took two
  swatches outside the contrast guard's reach and reintroduced "a dark pick hides a number
  with no warning". Fixed by widening the guard to every text-carrying swatch and asserting
  the relationship mechanically, rather than by backing the design out.

- **`display: flex` on a `<caption>` or a `colspan` `<td>` breaks the table silently.** The
  punch-log header and footer belong *inside* the plate the theme draws for `.modern-table`,
  so they are a `<caption>` and a `<tfoot>` cell rather than sibling divs — a sibling would
  sit outside the clip, and a wrapper div would re-flow Glassmorphic. The first version gave
  both `display: flex` to lay out their contents. That stops them being *proper table
  children*, so the browser wraps each in an anonymous table-cell: the caption narrows from
  full width to one column, and on the `td` **`colspan` is dropped entirely**. Neither
  throws, neither shows in the CSS, and both only appear in a browser. Both keep their table
  display now and hold an inner `.rt-sec-row` / `.rt-foot-row` that does the flexing.

- **Two swatches wrote to property names nothing read, and every list agreed with
  every other list.** This is the all-black report above, and it is the most
  instructive bug in the file because *nothing was wrong on either side of the
  boundary*.

  `applyCyberTokens()` built each RGB companion's name by concatenation:

  ```js
  if (t.rgb) el.style.setProperty(t.varName + '-rgb', hexToRgbStr(hex));
  ```

  Right for six of the eight swatches. Wrong for the two whose `varName` already
  ends in `-color`: it wrote `--rt-glow-color-rgb` and `--rt-border-color-rgb`,
  which appear nowhere in the stylesheet. The CSS reads `--rt-glow-rgb` (21 sites)
  and `--rt-border-rgb` (17). Those kept their `.retro-theme` defaults of
  `255, 242, 0` forever, so **the Glow and Border pickers moved nothing at all** —
  not one frame, grid line, hazard-dim band or bloom layer in the theme.

  Measured in the engine with every swatch black: `--rt-border-strong` resolved to
  `rgba(255, 242, 0, 0.85)`, `--rt-grid` to `rgba(255, 242, 0, 0.07)`, and all
  three `--rt-glow` layers to yellow, while `--rt-text` correctly resolved to
  `#000000`. That is *precisely* the "grey accent wearing a hardcoded yellow glow"
  shape this rework was built to eliminate, surviving one layer below where it was
  fixed. It also explains the reported hazard split: `--rt-hazard` reads
  `var(--rt-border-color)` and went black correctly; `--rt-hazard-dim` reads
  `rgba(var(--rt-border-rgb), .30)` and stayed yellow.

  **Why 1523 assertions could not see it.** Every check lived on one side of the
  boundary and every one of them passed honestly:

  - `cyberTokenVarNames()` derived teardown names with the *same* `+ '-rgb'`
    rule, so the write list and the teardown list mirrored each other perfectly.
  - Section H rebuilt the name the same way again to assert the write happened —
    **a check that reconstructs the logic it is checking can only confirm the code
    agrees with itself.**
  - Section C asserted `--rt-border` derives from `--rt-border-rgb` *within the
    CSS*, which was true and always had been.

  Three lists, mutually consistent, none of them looking across at the other side.

  **The fix** states the companion name instead of deriving it — `rgbName` on the
  two entries, read through one `cyberRgbVarName()` helper that both the write path
  and the teardown path call. **Section H2** is the assertion that crosses the
  boundary: every rgb property the module actually writes must be *consumed* and
  *declared* in the stylesheet, and every rgb property the stylesheet consumes must
  be written by JS or alias one that is. Reintroducing the bug turns 9 assertions
  red across all three directions, which was checked rather than assumed.

  **Section H2 found a second, smaller thing on its first run:**
  `--rt-cyber-panel-rgb` was declared, written on every repaint and torn down on
  every theme switch, and **read by nothing** — the Panel swatch is only ever used
  whole. Deleted rather than allowlisted, on the precedent of `--rt-magenta` and
  `--rt-lime`. Panel still works; it goes through `--rt-cyber-panel`.

  Defaults are unaffected — `cyberGlow` and `cyberBorder` both default to
  `#fff200`, which is what the CSS defaults already said, so the shipped look is
  byte-for-byte what it was. Confirmed in the engine.

- **A `background-size` longhand silently overrides every size set inside the `background`
  shorthand.** The container stacks studs, grid and gradient, and the studs already carried
  `position / size` per layer the way `--rt-brackets` does. Adding a separate
  `background-size` for the grid killed those and made the layer count something to keep in
  step by hand forever. Every layer carries its own size now; the longhand is gone.

- **`clip-path` cannot go on the container or the side panels**, which is *why* the
  original had two dead `clip-path: none !important` resets. It clips overflow and
  box-shadow both, and those elements hold the developer tooltip (z-index 9999), game
  canvases, the skin tray and popovers. The panel-shape setting therefore applies
  `clip-path` only to elements with nothing escaping their box, and expresses the shape on
  the container and side panels through `--rt-radius` alone. Removing the resets without
  understanding them would have clipped the tooltip.

- **A `white-space: nowrap` marquee blew out `width: fit-content` on the whole widget.**
  Reported as "Game Mode OFF is too wide" — the widget is meant to shrink to a single
  narrow column, and instead it stayed nearly full-width.

  `#total-time-summary.game-mode-off` sizes itself with `width: fit-content` once the side
  panels collapse. `.rt-ticker-track` sits inside that subtree with `white-space: nowrap`
  (it has to — it is a scrolling marquee), holding the whole ticker string **duplicated**
  for the seamless `-50%` loop. A `fit-content` query asks every descendant "how wide would
  you like to be with no constraint at all", and a nowrap span answers with its full,
  un-wrapped text width — confirmed in a real engine: hiding the ticker alone dropped the
  measured width from **1332px to 634px**. `overflow: hidden` on the same element does
  nothing here; it clips *painting*, not the *intrinsic-size query* the browser runs first
  to decide how big the box gets to be.

  **Two plausible fixes were tried and rejected, in a real engine, before the one that
  worked.** `min-width: 0` on the track changed nothing (verified: dropped in live, width
  stayed at 1332px) — `min-width` only clamps an *automatic minimum* during shrinking, and
  a `fit-content` query with generous available space resolves close to *max-content*, which
  `min-width` cannot touch. An explicit `flex-basis: 0` was considered and rejected without
  even testing it: CSS Flexbox §9.9 explicitly substitutes `content` for a flex item's basis
  when the *container* is computing its own intrinsic size, specifically so this exact trick
  cannot be used to hide a child from that computation.

  **The fix:** `contain: inline-size` on `.rt-ticker-track`. It is the property built for
  exactly this — it stops an element's content from feeding its width back into an
  ancestor's intrinsic-size query, while leaving the element's own *already-resolved-width*
  layout completely alone. Verified both directions: Game Mode OFF now measures 634px
  (matching the ticker-hidden baseline exactly), and with Game Mode back ON the track still
  stretches to fill its row at the same width as before the fix (837px, unchanged).

  Cyberpunk-CSS-specific: `.rt-ticker` is hidden entirely under Glassmorphic, so this defect
  never reached that theme.

  **A second bug, harness-only, found while diagnosing this.** The harness's own
  `.left-panel, .right-panel` rule used `flex: 0 0 240px` where the host uses
  `width: 240px; flex-shrink: 0;`. A *definite* `flex-basis` (the `0` in that shorthand)
  governs an item's main-axis size and stops consulting `width` at all — so
  `.game-mode-hidden`'s `width: 0 !important` had **no effect** in the harness: measured,
  the panels only shrank from 240px to ~174px, never to 0. The harness's own Game Mode
  button *looked* like it collapsed the panels and did not — the same "control that looks
  wired and exercises nothing" class of bug section C7 exists to catch, just not one C7's
  static checks can see (both properties are legitimate CSS; only their *interaction*
  breaks). Brought back in line with the host's pattern.

---

## Working on the theme

`AttendanceTimeCheckerPlus.js` is 19,206 lines and self-guards to one portal URL, so
iterating inside it is slow — the same reason `ludo-dev/` and `snake-dev/` exist. The theme
now lives in `cyber-dev/` and is spliced in by `node cyber-dev/reinsert.js`.

**Edit `cyber-dev/`, never the copy in the userscript.** Editing the copy is how they drift,
and the drift is silent until the next reinsert refuses to run.

```
node cyber-dev/reinsert.js          # splice cyber-dev/ into the userscript
node cyber-dev/cyber-verify.js      # static audit + module checks
node ludo-dev/verify-all.js         # every suite — must stay green
start cyber-dev/cyber-harness.html  # judge the look
```

`ludo-dev/preview.js` is a canvas software rasterizer and **cannot render DOM or CSS**, so
unlike Snake and Ludo there is no PNG preview for this work. `cyber-harness.html` in a real
browser is the visual authority.

## Things not to break

- **`CYBER_PALETTES` has exactly one definition.** The harness's quick-select row and the
  settings modal's Palette row both render it directly; adding a palette to one without the
  other is the drift `cyber-verify.js` section H4 exists to catch. The harness's
  `Dark-on-dark ✗` is the one deliberate exception — layered on top of `CYBER_PALETTES` only
  in the harness, never inside the module, because a preset that fails its own contrast
  guard has no business being something a real user can pick.
- **A new palette must pass its own contrast guard before it ships.** Section H4 checks the
  worst text-carrying swatch (via `CYBER_TEXT_SWATCHES`, the same list the runtime chip
  reads) for all six, using the plain `contrastRatio(hexA, hexB)` function — hex in, ratio
  out, no globals touched. Route a new check through that function directly rather than a
  fresh `load()` call per palette: `load()` reassigns the shared Node-stub globals on every
  call, and looping it leaves whichever palette ran last as ambient state for every section
  below it in the file — this cost one real, if quickly caught, false failure in a later
  section while H4 was being written.
- **Do not add an emoji to a template string and stop there.** The sweep — `cyberSweepEmoji`
  + `cyberWatchEmoji` — is what actually reaches it, and it is scoped to the widget's own
  DOM subtree plus four enumerated body-level surfaces (achievements modal, leaderboard
  popover, XP toast, settings modal). A **fifth** body-level surface that renders an emoji —
  a new modal, a new toast type — needs its own explicit `cyberSweepEmoji()` call at its
  content-freshening point; nothing currently watches `document.body` as a whole, on
  purpose, so as not to tax whatever unrelated DOM churn the host portal's own page produces.
- **Never call `cyberSweepEmoji()` on every `applyCyberpunkTheme()` tick.** That function
  runs on every colour-slider `input` event during a drag; a full `TreeWalker` pass of the
  whole widget on each one is the kind of thing that reads as "the picker feels laggy," with
  nothing in the console to explain it. `cyberWatchEmoji()` (attach-once, WeakSet-deduped)
  is what belongs there; the one full corrective sweep belongs at `enteringRetro` only.
- **The colour defaults must not change.** `cyberText`/`cyberGlow`/`cyberBorder` all default
  to `#fff200`, so an existing user keeps their yellow HUD — now changeable. An upgrade that
  silently restyles the widget reads as a bug.

  Two deliberate exceptions, both flagged rather than discovered: **`cyberPanelShape` is
  `notched`**, moved in pass 2 because reshaping the panels *was* the request; and **the
  glow is substantially bigger**, because "add more glow" was the request. Everything else
  renders as it did.
- **A glow that scales alpha without scaling radius is not a glow control**, and a glow whose
  base radius is tiny cannot be scaled into visibility. Alpha saturates; size is what reads.
  Section C6 fails any shadow that scales one and not the other, and fails `--rt-glow` if it
  stops being layered or drops below 30px of reach.
- **The teardown array (17390) is load-bearing.** Every var `applyPreferences` writes must be
  removed there or it bleeds into Glassmorphic. `cyber-verify.js` asserts the two lists mirror
  each other, in both directions.
- **Never derive text from Accent or BG.** That is the entire reason there are three new
  swatches instead of one.
- **A filter belongs to the whole element.** Same lesson as the transform/overflow one
  below: filtering a button duotones its border and its fill, not just its glyph. When only
  part of what an element paints should be affected, the answer is a different owner —
  `.rt-emo` — not a compromise on the parent.
- **Do not tint the `professional` emoji set.** Its meaning is its hue; one colour deletes
  the progress signal outright. `data-emoji-set` + `--rt-emo-progress` carry the opt-out.
- **A token's name is part of its contract, and the contract has two sides.** A
  property name built by string concatenation in JS is a name no CSS author ever
  agreed to. `rgbName` states the two that do not follow the pattern; section H2
  checks the JS write list against the names the stylesheet actually consumes, in
  both directions. Never assert a derived name by re-deriving it the same way — that
  proves only that the code agrees with itself, which is how this survived a
  green suite for three passes.
- **If you colour type with a swatch, add that swatch to `CYBER_TEXT_SWATCHES`.** The suite
  will tell you (section C2), but know why: an unmeasured swatch on type is the original bug
  wearing a new hat.
- **Never change the `display` of a table-structural element** — `caption`, `thead`, `tr`,
  `td`. Put an inner row inside it instead. A flexed caption narrows to one column and a
  flexed `colspan` cell loses its span, both without error.
- **The title is open type and the column header is quiet.** Both were solid plates in pass 2
  and both were changed on purpose; `cyber-verify.js` asserts the title is not a `--rt-text`
  plate so it cannot drift back. Mass belongs on small tags, not on headings.
- **Every `rt-*` element the host renders needs a hide rule for Glassmorphic.** One markup
  tree serves both themes, so anything unhidden lays out as unstyled text in the other one.
- **The CSS lives inside a template literal.** A backtick or a dollar-brace in
  `cyber-theme.css` breaks the script outright; a stray `}` silently discards every rule after
  it and takes the rest of `modernStyles` with it. `reinsert.js` and `cyber-verify.js` both
  check.
- **Effects are ungated by choice**, so the cost is contained structurally: every animation
  runs on `transform`, `opacity`, `filter` or `background-position` only — never a
  layout-triggering property — and the EQ shares the existing `getFrameInterval()` cap rather
  than adding a second uncapped rAF loop. If frame rate ever suffers, the seam for adding
  gating later is the `.no-fluid` pattern at 13934-14024, which `applyPreferences()` currently
  force-strips for Cyberpunk at 17416-17418.
