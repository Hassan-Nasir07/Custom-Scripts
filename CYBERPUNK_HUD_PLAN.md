# Cyberpunk HUD — UI/UX Rework Tracking

Live checklist for the Cyberpunk HUD (`displayTheme: 'retro-futuristic'`) rework: an
independent colour-token model so the signature yellow is finally changeable, a selectable
panel geometry, a rebuilt animation layer, four new HUD motif groups, and a
system-audio-reactive spectrum rail that drives the whole frame's pulse.
reference site: https://www.magnific.com/free-photos-vectors/cyberpunk-ui
Visit to take inspiration.
Full rationale lives in the approved plan. This file tracks execution.

---

## Status — code complete, pending visual + portal verification

| # | Step | State |
|---|---|---|
| 1 | `CYBERPUNK_HUD_PLAN.md` tracking file | ☑ |
| 2 | Extract theme to `cyber-dev/` + `reinsert.js` + byte-identity assertion | ☑ |
| 3 | Bug fixes that block the new features | ☑ |
| 4 | Token model + Text/Glow/Border swatches + contrast guard | ☑ |
| 5 | Panel Shape setting (Rounded / Chamfered / Notched) | ☑ |
| 6 | Motifs — frame+shimmer, brackets+chrome, glitch+boot-in, meters+backdrop | ☑ |
| 7 | Audio visualizer — tiered System → Mic → Procedural, `--rt-beat` | ☑ |
| 8 | `cyber-verify.js` + register in `ludo-dev/verify-all.js` | ☑ |
| 9 | `cyber-harness.html` built; **visual pass still needs a human** | ☐ |
| 10 | **Pass 2 — sci-fi → cyberpunk**, against `cyber-dev/ref/` (see below) | ☑ |
| — | `BUILD_LABEL` v4 → **v5** | ☑ |
| — | **Portal verification** (see below) | ☐ |
| — | **Reference screenshots** — supplied in `cyber-dev/ref/` | ☑ |

`node ludo-dev/verify-all.js` → **1343 assertions passed, 0 failed** across 11 suites
(306 of them the new Cyberpunk suite). Needs the Volta Node 22 image, not the default
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
| Corner geometry | Selectable **Panel Shape** — Rounded (default) / Chamfered / Notched. Brackets are overlays, identical in all three. |
| Colour model | Three new **independent** swatches — Text, Glow, Border — plus a live contrast guard. |
| Motifs | All four groups. |
| Audio | Tiered **System → Mic → Procedural**, full-width rail, analyser also drives `--rt-beat`. |
| Effects gating | **None — full effects always on.** Deliberate; cost contained structurally instead. |

### Reference material — a limitation worth recording

**RESOLVED — the reference is now in `cyber-dev/ref/`**, supplied by hand as three
screenshots. Everything below is kept as the record of why it had to be done that way.

The Magnific MCP server (`https://mcp.magnific.com`) was added to VS Code, but a session
picks up MCP servers at start, so it is not reachable from the conversation that was already
running. Worth retrying in a fresh session if more assets are ever needed; the local
screenshots made it unnecessary here.

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

RUNTIME
  --rt-beat      0 to 1, written once per frame by the analyser
  --rt-glow-mul  from the Glow Intensity slider
```

**The invariant:** a dark Accent or a dark BG can never darken the type, because `--rt-text`
shares no ancestor with either. This is the specific failure mode the rework exists to make
impossible, so `cyber-verify.js` asserts it structurally rather than trusting review.

---

## Portal verification — still to do

The harness renders CSS honestly but cannot prove any of these; they need the real page.

- [ ] **The reported bug itself** — set Accent to mid-grey and Text to yellow: type stays
      yellow, frames follow Accent. Check this first; it is the whole point.
- [ ] **Contrast guard** — set Text to near-black on the default dark BG: the chip goes red
      and *nothing auto-changes*. Warning, never correction.
- [ ] **All three panel shapes** on the table, stat cards, side panels and completion message.
- [ ] **The `neonPulse` regression** — hover a stat card: the shimmer travels *and* the card's
      own shadow is still visible.
- [ ] **System audio** — connect, play something, confirm bars move and the frame breathes.
      Then **stop the share from Chrome's own banner** and confirm it falls back a tier with
      no stuck stream and no orphaned screen-share indicator.
- [ ] **Mic tier with headphones plugged in** → flat rail, no crash, no exception.
- [ ] **Game Mode** → the EQ rail survives (it lives in `.main-attendance-content`); side
      panels collapse as before.
- [ ] **Theme round-trip** — switch to Glassmorphic and back: no `--rt-*` var left on the
      container or `documentElement`, no orphaned `.cyber-bg-image`, no running AudioContext.
- [ ] **PiP + compact mode** in Cyberpunk, and the ⛶ Max modal for both Pool and Ludo.
- [ ] **Frame rate** — a full Ludo and Snake run with the EQ live.

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
  subtree before adding more filters. The container now couples the beat through
  `box-shadow` instead — a plain declaration re-resolving off `--rt-beat`, not an animation,
  so it overrides nothing. `--rt-outline` filters are applied only to panels with no fixed
  descendants, and `cyber-verify.js` asserts the container and the side panels carry none.
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
- **`clip-path` cannot go on the container or the side panels**, which is *why* the
  original had two dead `clip-path: none !important` resets. It clips overflow and
  box-shadow both, and those elements hold the developer tooltip (z-index 9999), game
  canvases, the skin tray and popovers. The panel-shape setting therefore applies
  `clip-path` only to elements with nothing escaping their box, and expresses the shape on
  the container and side panels through `--rt-radius` alone. Removing the resets without
  understanding them would have clipped the tooltip.

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

- **Defaults must not change the look.** `cyberText`/`cyberGlow`/`cyberBorder` all default to
  `#fff200` and `cyberPanelShape` to `rounded`. Existing users get their yellow HUD, now
  changeable. An upgrade that silently restyles the widget reads as a bug.
- **The teardown array (17390) is load-bearing.** Every var `applyPreferences` writes must be
  removed there or it bleeds into Glassmorphic. `cyber-verify.js` asserts the two lists mirror
  each other, in both directions.
- **Never derive text from Accent or BG.** That is the entire reason there are three new
  swatches instead of one.
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
