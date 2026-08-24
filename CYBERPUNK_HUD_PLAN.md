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
| — | `BUILD_LABEL` v4 → **v5** | ☑ |
| — | **Portal verification** (see below) | ☐ |
| — | **Reference screenshots** — see the note below; blocked on assets | ☐ |

`node ludo-dev/verify-all.js` → **1258 assertions passed, 0 failed** across 11 suites
(221 of them the new Cyberpunk suite). Needs the Volta Node 22 image, not the default
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

**The linked reference could not be retrieved, and this is not a tooling gap that trying
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

**To design against those specific screens, the assets have to come in by hand** — paste the
screenshots into the conversation, or drop PNGs into `cyber-dev/ref/`. Either way the visual
pass gets redone against them. Everything else in this rework is independent of that.

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
