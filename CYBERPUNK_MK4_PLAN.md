# Cyberpunk HUD — Pass 4 / "MK-IV" hierarchy rework

**Status: PLAN ONLY. Nothing in `cyber-dev/` or `AttendanceTimeCheckerPlus.js` has been
touched yet.** Sequence agreed with the requester: plan → harness → *approval* → reinsert.

Source of truth for this pass:
`Cyberpunk Attendance Widgets/Attendance Widgets HUD.dc.html` (local copy, synced
2026-08-26 15:34) — canvas
`https://claude.ai/design/p/8bc61946-b3c1-44e0-9ca6-717a56a2ac12`.

The previous pass was authored against `cyber-dev/ref/design/Attendance Widgets HUD.dc.html`
("Console MK-III"). **Keep both.** MK-III is still the vocabulary reference; MK-IV only
overrules it on *hierarchy*, and four of its rules are reversed outright (§3).

> On the MCP: `claude_design` / `DesignSync` reaches design-**system** projects (component
> libraries) only — it has no method that pulls a canvas project. The canvas is already on
> disk in full (`.dc.html` + `image-slot.js` + `support.js` + 11 upload PNGs), so it was read
> from there. No fetch was needed and none would have worked: web fetching is blocked on this
> machine.

---

## 1. What MK-IV actually is

Two turns, four artboards:

| Artboard | What it is | Feeds |
|---|---|---|
| `1a` Expanded — *one hero, one accent, one striped element* | 780px single-column widget | the main widget |
| `1b` Float — *collapsed state, same rules* | 330px stack: mini-widget + rewards | the PiP / compact display |
| `2a` Three-column desk | 1420px, `296px / 1fr / 300px` | the full `.attendance-body` |
| `2b` Settings — *HUD drawer, not a grey sheet* | 392px drawer | the settings modal |

The canvas states its own thesis twice, and both lines are the brief:

> **1:** "Fix list applied: single accent, hero counter, real primary action, one striped
> element, quiet labels, 3-tier type."
>
> **2:** "Extras are deliberately demoted: no accent on the game board chrome, quotes get
> violet only, viewer is a framed slot, settings reads as rows not cards."

Everything below is in service of those two sentences. MK-IV is **not** a new set of motifs —
it is the same motifs, spent in a different ratio. Pass 3 distributed emphasis evenly; MK-IV
concentrates it on one number and quiets literally everything else.

---

## 2. The measured spec

Transcribed off the canvas so the harness pass does not have to re-read it. Every value here
is lifted verbatim, not eyeballed.

### 2.1 Colour — one user accent, four fixed semantics

```
accent       {{ accent }}   #f2ea00 default; picker offers #f2ea00 #35e6f0 #ff8a6b (+#a78bfa in 2b)
accentGlow   rgba(accent,.35)     hero text-shadow, primary button box-shadow
accentSoft   rgba(accent,.22)     meter fill, slider fill, dashed board inset
accentLine   rgba(accent,.50)     chip borders, ACTIVE pill border
accentFaint  rgba(accent,.10)     game-board lattice, icon-button fill
```

The four semantics are **fixed hues, not derived from the accent** — this is what "single
accent" means. One knob moves the targeted colour; meaning-colours never move:

| Hue | Means | Where |
|---|---|---|
| `#35e6f0` cyan | *measured / secondary* | DAY LOAD, TOTAL XP, `HISTORY →`, `VIEW ALL →`, START BREAK |
| `#ff8a6b` orange | *over* | OVERTIME value, OVERTIME pill, STREAK, snake food |
| `#7dff9b` green | *live and OK* | ON SHIFT pill, Scanlines ON, `CONTRAST 7.2:1 · AA` |
| `#a78bfa` violet | *the quotes module, and nothing else* | MOTIVATION panel only |
| `#ffffff` | *primary measured* | WORKED, CLEAR AT, WEEK, meter playhead |

Surfaces: canvas `#05060a`, panel `#07080c`, game board `#04050a`.
Borders `rgba(255,255,255,.10 → .16)`. Labels `rgba(255,255,255,.34 → .45)`.

### 2.2 Type — three tiers, three families, no overlap

| Tier | Family | Used for |
|---|---|---|
| Display | Orbitron 800, 13–17px, `.2em` | `ATTENDANCE`, `SETTINGS`, `CHECK OUT` — and nothing else |
| Panel name | Orbitron 600, 11–13px, `.14–.18em` | ARCADE · REWARDS · PUNCH LOG · SNAKE · MOTIVATION · VIEWPORT |
| Number | Share Tech Mono 400 | **every** numeral: 82 hero · 42 float hero · 27–28 worked · 16–17 secondary · 13 table · 9–11 meta |
| Label | Rajdhani 600, 9–12px, `.10–.26em` | every label; Rajdhani **700** for buttons and pills |

**The hero is a 3-tier jump, not a nudge: 82px → 27px → 15px.** Pass 3's hero is ~2.0rem
against 1.35rem siblings. That gap is most of what "hero counter" is asking for.

### 2.3 Geometry

```
panel silhouette   polygon(0 0, calc(100% - N) 0, 100% N, 100% 100%, N 100%, 0 calc(100% - N))
                   opposite-corner chamfer — top-right + bottom-left
                   N = 26px widget · 22px centre panel & settings · 18px float · 16px side panels
                       8/7/6px glyph boxes and small chips
badge tile         polygon(0 4px, 4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)
                   the OTHER diagonal, 4px — badges cut opposite to their own panel
primary button     polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)   ← a PARALLELOGRAM
                   8px on the float and settings variants, 6px on PLAY
```

That parallelogram is **new** — the current shape set has no skewed silhouette, and it is
where MK-IV's asymmetry actually lives. Panels themselves are symmetric under 180° rotation;
the composition reads asymmetric because **buttons skew, badges cut the opposite diagonal,
and the left edge bar is unbalanced.** MK-III's `--rt-clip-alt` mirroring machinery is exactly
the right mechanism for the badge rule and stays.

### 2.4 The repeated motifs, in MK-IV's own ratio

1. **Left edge bar** — `left:0; width:3px; background:accent; box-shadow:0 0 14px accent`,
   short and near the top: `top:52px h:96px` (1a) · `top:20px h:40px` (1b) ·
   `top:48px h:84px` (2a centre) · `top:44px h:70px` (2b) · `top:16px h:34px` **violet**
   (quotes). One per panel, hue = ownership. This is the single most repeated MK-IV motif and
   the theme currently has no equivalent.
2. **Ambient lattice** — 52px square, `rgba(255,255,255,.02)` container / `.022` widget.
   (Shipped value is 44px.)
3. **Scanlines** — `repeating-linear-gradient(180deg, rgba(255,255,255,.02) 0 1px, transparent 1px 3px)`,
   `z-index:4`, and **toggleable** (`scanlines` prop, default on).
4. **The one striped element** — `repeating-linear-gradient(115deg, rgba(255,255,255,.5) 0 4px, transparent 4px 9px)`,
   sliding `background-position: 0 → 24px` over 2.4s linear. Note: **white at .5, 115°, 4/5px.**
   Shipped `--rt-hazard` is `45deg` and `--rt-border-color`-tinted. Both change.
5. **Panel header glyph** — `width:5px; height:12px; background:accent`, flush left of the
   panel name. The small sibling of the edge bar; `.rt-sec-glyph` already does this.
6. **Status pill** — `1px solid rgba(125,255,155,.4)` on `rgba(125,255,155,.08)`, 6px pulsing
   dot, `hudPulse 1.8s`.
7. **Glow** — hero `text-shadow: 0 0 40px accentGlow` · primary button `0 0 34px accentGlow` ·
   edge bar `0 0 14px accent` · playhead `0 0 12px #fff`. Wide, soft, and **only on the hero
   and the primary action.**

### 2.5 Layout skeleton of `1a`, top to bottom

```
header      glyph-box[A]  ATTENDANCE / OP-4471 · SHIFT 08:00—16:00   →   [● ON SHIFT]  12:12:22
hero        grid 1fr / 232px
            ├ left   REMAINING TODAY ● LIVE          right │ WORKED    27px
            │        82px accent, 40px bloom               │ ────────
            │        CLEAR AT 4:00 PM │ DAY LOAD 52%       │ BREAK 00:32   OVERTIME 01:14
            │                                              │ ────────
            │                                              │ WEEK 36:42 / 40:00
meter       08 09 10 11 12 13 14 15 16
            [────fill accentSoft────│▨ striped break▨│              ]  ▏playhead 2px white
            ▮ WORKED   ▨ BREAK 00:32   ▯ SCHEDULED                     ← legend
punch log   PUNCH LOG      3 SESSIONS · TODAY   HISTORY →
            #  IN  OUT  WORKED  STATUS
            1  07:59:59  CURRENT(accent)  04:11:46  [ACTIVE]     ← pills, per-status hue
actions     [ CHECK OUT ]────────────────  [ START BREAK ]  [⌄]
footer      SYS  ◀ ticker ▶                              BUILD V8
```

The right-hand stat column is a **bordered list, not cards** — `border-left: 1px solid
rgba(255,255,255,.1)`, 1px `rgba(255,255,255,.09)` dividers between groups. No fills, no
frames, no glow. That is what "a hero, not a row of equals" looks like when it is finished.

---

## 3. The four reversals

MK-IV overrules four rules that `cyber-dev/README.md` currently states as invariants and that
`cyber-verify.js` partly enforces. Each needs the README rewritten *and* the assertion
retargeted — not deleted, retargeted, or the next pass re-breaks it.

| # | Shipped rule | MK-IV | Why MK-IV is right |
|---|---|---|---|
| R1 | Hazard hatching on container edge, rail filler, log footer, section fillers, tabs — **5 places** | **exactly one** striped element, and it is the break block on the meter | At 5 places the stripe is a texture. At 1 it is information. "Measure what you colour" was already the rule; the hazard was the one motif not obeying it. |
| R2 | `--rt-glow` layered 6/22/48px, "small hard halo reads as a filament, wide soft reads as fog" | one soft `0 0 40px` bloom, hero + primary button only | Not actually a contradiction: the halo was wide-spread *everywhere*, which is fog. Wide bloom on **one** element is a lit filament in a dark room. The layered stack stays (see §7/2.4) — only the ratio and the number of lit elements change. |
| R3 | Solid knocked-out plates on `.stat-label` and small tags — "mass goes on the small things" | **quiet labels**: 9.5px Rajdhani 600, `.22em`, `rgba(255,255,255,.38)`, no plate | Pass 3 already took the plate off the title and the table header for this exact reason ("a heading that looks identical to a button is a hierarchy bug wearing a style"). MK-IV finishes the thought: a *label* that looks like a button is the same bug. Plates survive only on `SYS` and the mono chips. |
| R4 | `cyberPanelShape` default `notched` (single-corner right-angle step) | `chamfered` at 26px, uniformly | MK-IV gets asymmetry from arrangement — skewed buttons, counter-cut badges, the unbalanced edge bar — not from silhouette. This is the one reversal that changes what an **existing** user sees on next load. See D1. |

---

## 4. Two defects found while reading — both of which MK-IV makes load-bearing

### D-1 · Rajdhani has never once rendered

`cyber-theme.css` sets `font-family: 'Rajdhani'` in 4 rules. **Nothing loads Rajdhani.**

- `AttendanceTimeCheckerPlus.js:11698-11700` `@import`s Inter, Orbitron, Share Tech Mono. No Rajdhani.
- `cyber-harness.html:6` links Orbitron, Share Tech Mono, Inter. No Rajdhani.
- `cyber-verify.js` has zero occurrences of the string, so nothing caught it.

Every "Rajdhani" label has silently been the generic sans fallback in both the widget and the
harness — and because the harness omits it too, the harness has been agreeing with the bug
rather than exposing it. MK-IV puts Rajdhani on *every label, button and pill*, so this stops
being cosmetic. **Fix in three places** (host `@import`, harness `<link>`, and a new verify
assertion that every family named in the CSS is loaded by both).

### D-2 · The harness fakes the one region MK-IV turns into the primary action row

The host builds `.bottom-control-bar` (`AttendanceTimeCheckerPlus.js:21125-21136`, populated
by `addSettingsButton` / `createPipButton` / `addDeveloperInfo`).

- `cyber-theme.css` styles it **zero** times.
- `cyber-harness.html:87,259` invents `.bottom-bar` — a class the host never emits.

So the harness renders a bar the widget does not have, and the widget renders a bar the theme
does not style. C7 did not catch this: it audits *rig* ids and classes, not the widget markup.
This is the same class of bug as the `.gm-off` incident the README already records, and it
lands precisely on the element MK-IV wants to become the action row.

---

## 5. Classification — what is CSS, what is host, what has no equivalent

### 5.1 Pure CSS over existing DOM — `cyber-theme.css` / `cyber-hud.js` only

| MK-IV item | Mechanism |
|---|---|
| 26px chamfer default | `cyberPanelShape()` fallback + `--rt-clip` |
| parallelogram primary button | new `--rt-clip-btn` token |
| badges cut the opposite diagonal | `--rt-clip-alt` (already exists) on the achievement badges |
| left edge bar, per panel | `::after` on each panel + `--rt-edge-c` for the violet quotes case |
| 52px lattice | `--rt-grid-sq` |
| scanlines + toggle | existing CRT layer + a `cyberScanlines` pref |
| hero at 82px, 3-tier scale | `.remaining-time` / `.worked-time` / `.stat-value` |
| quiet labels (R3) | strip the plate from `.stat-label` |
| hero grid `1fr / 232px` | `.time-stats { grid-template-columns: 1fr 232px }` + explicit placement: `.remaining-time-card` col 1 / row-span 2, `.worked-time-card` + `.completion-time-card` stacked col 2 |
| right column as a bordered list | `border-left` + divider `::before`s; no card fill |
| ON SHIFT pill styling | restyle whatever host element carries it (§5.2) |
| glyph box around the header emoji | box `.emoji-display` |
| quiet punch-log header, mono rows, accent CURRENT cell | already present; retune |
| quotes = violet only | `--rt-quote-c: #a78bfa`, drop accent from `.quotes-container` |
| no accent on game-board chrome | retint `.snake-canvas` surround to `accentFaint` |
| viewer = framed slot + 2 corner brackets | `.image-box-container` + `::before/::after` |
| settings as rows not cards | the settings-modal rules |
| action row styling | **`.bottom-control-bar`** — new, see D-2 |

### 5.2 Needs a host markup or data change in `AttendanceTimeCheckerPlus.js`

| MK-IV item | Host change | Data exists? |
|---|---|---|
| STATUS pill column in the punch log | 6th `<th>/<td>`, or repurpose `Break Duration` | ✅ `item.checkOut === 'Current'` already distinguishes ACTIVE; OVERTIME derivable from `getShiftSeconds()` |
| ON SHIFT pill + live clock in the header | 2 spans in `headerHTML` | ✅ open session + `new Date()` |
| header subline `OP-4471 · SHIFT 08:00—16:00` | extend `.rt-subcode` | ⚠️ shift **window** needs first check-in + `getShiftSeconds()`; there is no operator id — drop it rather than invent one |
| striped **break block** on the meter (R1's one stripe) | one `<span class="rt-brk">` per gap inside `.progress-bar`, inline `left`/`width` % | ✅ `durationDifference` per row already computes each gap |
| meter legend `▮ WORKED ▨ BREAK ▯ SCHEDULED` | one div under `.progress-bar` | ✅ |
| `HISTORY →` in the log header | one anchor in `.rt-sec` | ⚠️ no history view exists — **omit** |
| `WEEK 36:42 / 40:00` in the stat column | new stat row | ❌ no weekly total is tracked. Omit, or fill with the existing `Day Total` |

Every new `rt-*` element also needs its hide rule under
`.attendance-summary:not(.retro-theme)` — the suite checks that list in both directions.

### 5.3 No host equivalent — the honest gaps

- **`CHECK OUT` / `START BREAK`.** The widget is **read-only**: it scrapes the portal's
  attendance table and cannot punch. MK-IV's "real primary action" has no referent here.
  → D3.
- **`OP-4471`, `A. RAHMAN`, geofence/biometric ticker copy.** Invented mock content. The
  README's own rule settles it: *"anything shown here has to be something the user could act
  on, or it is noise wearing a HUD costume."* The ticker already carries real values and stays
  as it is.
- **`BREAK 00:32` / `OVERTIME 01:14` as headline stats.** Break-per-gap is known; a *break
  total* is a trivial sum and worth adding. Overtime is `max(0, worked - shift)` — also cheap.
  Both in scope.

---

## 6. Decisions I need from you

Recommendations are marked. If you take all four, the TODO in §7 stands exactly as written.

- **D1 — Move the shipped `cyberPanelShape` default from `notched` to `chamfered`?**
  MK-IV is uniformly chamfered. Changing it reshapes the widget for existing users on next
  load; not changing it means the shipped default disagrees with the canvas and every
  screenshot. *Recommend: change it.* Pass 2 already moved this default once for the same
  reason, and `notched` stays available in the picker.

- **D2 — How far into host markup do we go?**
  *Recommend: everything in §5.2 that has real data* — status pills, ON SHIFT + clock, break
  block, legend, break total, overtime — and drop `HISTORY →`, `OP-4471` and `WEEK`. That is
  ~6 small edits inside `renderFullContent()`, all additive.
  The alternative is CSS-only, which gets maybe 70% of the look and cannot deliver R1's one
  striped element at all (no break geometry) or the status pills.

- **D3 — What becomes the primary action row?**
  *Recommend: style `.bottom-control-bar` as it* — `▣ Float` (PiP) as the accent parallelogram
  primary, Settings as the cyan secondary, dev-info as the 46px icon button. It fixes D-2, it
  gives the composition the closing weight MK-IV needs, and it labels nothing that does not
  work. The alternative is to end the widget on the ticker and leave the row quiet.

- **D4 — Where does R1's single stripe go?**
  *Recommend: the meter break block* (needs D2). Fallback if D2 comes back CSS-only:
  `.rt-sec-fill`, which is cheap but decorative — it measures nothing, which is the thing R1
  was trying to fix.

---

## 7. TODO

Ordered so nothing is built on something unverified. Each step has an acceptance criterion;
`⛔` marks a gate.

### Phase 0 — groundwork (independent of D1–D4, safe to start)

- [ ] **0.1** Copy the MK-IV canvas into `cyber-dev/ref/design/mk4/` beside the MK-III one and
      write `cyber-dev/ref/design/README.md` saying which canvas governs *which* question
      (MK-III = vocabulary, MK-IV = hierarchy). Two canvases with no note on precedence is how
      the next pass regresses.
      **Accept:** both canvases present, precedence written down.
- [ ] **0.2** Fix **D-1**: add `Rajdhani:wght@500;600;700` to the host `@import` block
      (`AttendanceTimeCheckerPlus.js:11700`) and to the harness `<link>`.
      **Accept:** a rendered label measures as Rajdhani, not the sans fallback.
- [ ] **0.3** Fix **D-2**: rename the harness's `.bottom-bar` to `.bottom-control-bar` and give
      it the host's real three children in the host's real order.
      **Accept:** harness markup and `renderFullContent()` output agree on this subtree.
- [ ] **0.4** New verify group **C8 — "the harness does not invent markup"**: every class
      inside `.attendance-summary` in `cyber-harness.html` is one the host actually emits, and
      every font family named in `cyber-theme.css` is loaded by *both* host and harness.
      This is the check that would have caught D-1 and D-2, and it is the reason to write it
      before anything else changes.
      **Accept:** C8 fails on the pre-0.2/0.3 tree and passes after.

### ⛔ Gate: D1–D4 answered

### Phase 1 — tokens and geometry (`cyber-hud.js`, `cyber-theme.css`)

- [ ] **1.1** Retune `--rt-hazard` to MK-IV's `115deg`, `rgba(255,255,255,.5) 0 4px,
      transparent 4px 9px`, sliding to `24px` over 2.4s.
- [ ] **1.2** Add `--rt-clip-btn` (the 12px parallelogram) and `--rt-edge-c` (edge-bar hue,
      accent by default, violet on the quotes panel).
- [ ] **1.3** `--rt-grid-sq` 44px → 52px. Add the `cyberScanlines` pref + its CRT-layer gate.
- [ ] **1.4** Fix the semantic hues to MK-IV's four (`#35e6f0` / `#ff8a6b` / `#7dff9b` /
      `#a78bfa`) as **non-derived** tokens, and extend the token-independence assertions in
      group C to cover them. Any of them that ends up carrying type goes into
      `CYBER_TEXT_SWATCHES` — the C2 rule, unchanged.
- [ ] **1.5** (if **D1** = yes) `cyberPanelShape()` fallback → `chamfered`; update the
      shipped-defaults assertion and the README line that calls `notched` deliberate.
      **Accept (1.1–1.5):** `cyber-verify.js` green; `snapshot.js` confirms `--rt-clip`,
      `--rt-clip-alt` and `--rt-clip-btn` resolve to three distinct polygons under all four
      shapes.

### Phase 2 — the hierarchy pass (`cyber-theme.css`)

- [ ] **2.1** The 3-tier type scale: hero 82px / worked 27px / secondary 15–17px / table 13px /
      meta 9–11px, with the family split of §2.2 held exactly.
- [ ] **2.2** **R3** — strip the plate off `.stat-label`; quiet labels everywhere. Plates
      survive on `SYS` and the mono chips only.
- [ ] **2.3** Re-grid `.time-stats` to `1fr 232px` with explicit placement; rebuild the right
      column as a bordered list (no card fills, no per-card glow, no bracket).
      **Accept:** `snapshot.js` reports the hero spanning both rows of column 1 and neither
      sibling carrying a background.
- [ ] **2.4** **R2** — glow: keep the layered stack and the both-channels scaling C6 asserts,
      retune so `k = 1` reads as MK-IV's soft 40px bloom, and reduce the lit set to the hero
      and the primary action.
      **Accept:** C6 still green — this is a retune, not a removal.
- [ ] **2.5** **R1** — remove the hazard from the rail filler, the log footer, the section
      fillers and the tabs. One striped element only.
      **Accept:** new assertion — `var(--rt-hazard)` appears **exactly once**, enforced the way
      C3 already enforces `--rt-aberr`.
- [ ] **2.6** The left edge bar on every panel, hue by ownership.
- [ ] **2.7** Header: glyph box around `.emoji-display`, ON SHIFT pill, clock.
- [ ] **2.8** Punch log: quiet column header, status pills, accent CURRENT cell. Retire the
      hazard footer (2.5) — keep the `<caption>`/`<tfoot>` **table display**; the README's
      table-display trap is unchanged and still the easiest thing here to break.
- [ ] **2.9** Meter: 20px track, `accentSoft` fill, the striped break block, 2px white playhead
      with a 12px bloom, legend row.
- [ ] **2.10** **D3** — `.bottom-control-bar` as the action row.

### Phase 3 — the demoted extras (`2a`) and the two other states

- [ ] **3.1** Arcade: no accent on board chrome — `accentFaint` lattice, dashed `accentSoft`
      inset, PLAY accent, everything else neutral.
- [ ] **3.2** Quotes: violet only.
- [ ] **3.3** Rewards: XP segments accent, STREAK orange, TOTAL XP cyan, badge grid on
      `--rt-clip-alt`.
- [ ] **3.4** Viewer: framed slot, two accent corner brackets, neutral aspect-ratio buttons.
- [ ] **3.5** Settings drawer (`2b`): rows not cards, group rules, right-aligned value chips,
      accent swatch row, glow slider, and the `CONTRAST · AA` chip wired to the **existing**
      contrast guard — it must keep reading the real measurement, and `Dark-on-dark ✗` must
      still make it fail visibly.
- [ ] **3.6** Float / PiP (`1b`): 18px chamfer, 42px hero, 8px meter, the two-button row.
      **Note** the README's standing warning that the compact-PiP display lives outside the
      theme block.
- [ ] **3.7** Confirm Game Mode still collapses correctly — `.game-mode-hidden` /
      `.game-mode-off`, the real class names, with the centre column surviving.

### Phase 4 — harness, verification, gate

- [ ] **4.1** Extend `cyber-harness.html`: scanlines toggle, the MK-IV palette set, the status
      pill, the legend, the break block, the action row, and a `1b` float artboard beside the
      expanded one. Every control drives the real thing — C7's rule, unchanged.
- [ ] **4.2** New assertions: single-stripe (2.5), the MK-IV type scale, edge-bar presence per
      panel, semantic-hue independence, plus C8 from 0.4.
- [ ] **4.3** `node cyber-dev/cyber-verify.js` and `node ludo-dev/verify-all.js` green
      (Node 22 via Volta — the default `node` here is 10 and cannot parse the userscript).
- [ ] **4.4** `node cyber-dev/snapshot.js`, then read back computed styles for: the whole sheet
      parsing, `caption.rt-sec` still `display: table-caption`, the footer cell still
      `colSpan: 5`, caption/footer/table all the same width, three distinct clip polygons,
      container still `filter: none`.
- [ ] **4.5** Rewrite `cyber-dev/README.md` — "The visual language" becomes MK-IV's ratio, and
      each of R1–R4 records what it reversed and why. The old wording outliving a change is a
      failure mode this README has already had once and explicitly notes.
- [ ] **⛔ 4.6 — YOUR REVIEW.** `start cyber-dev/cyber-harness.html`. Nothing touches
      `AttendanceTimeCheckerPlus.js` beyond 0.2 until you have looked at it.

### Phase 5 — merge (only after 4.6)

- [ ] **5.1** The `renderFullContent()` edits from §5.2 (per D2).
- [ ] **5.2** Hide rules for every new `rt-*` element under
      `.attendance-summary:not(.retro-theme)`, checked in both directions including stale
      entries.
- [ ] **5.3** `node cyber-dev/reinsert.js` — it refuses on backticks, `${`, unbalanced braces
      and bad sentinels; let it.
- [ ] **5.4** Full suite green again post-splice, then portal verification.

---

## 8. Risk register

| Risk | Why it bites | Mitigation |
|---|---|---|
| R4 changes the silhouette every existing user sees | Shape is the loudest single change in the pass | D1 is an explicit decision, not a side effect |
| The 82px hero overflows at narrow widths | The canvas is drawn at a fixed 780px | `clamp()` the hero; check the PiP and 360px cases in 4.4 |
| Re-gridding `.time-stats` while `completion-time-card` is **conditional** | It is only emitted when `remainingTime > 0` (`AttendanceTimeCheckerPlus.js:20707`) — so the grid has 3 children *or 2* | Placement must be valid at both counts. Explicitly in 2.3's acceptance. |
| Retiring the hazard footer while touching `<caption>`/`<tfoot>` | The table-display trap fails silently and only in a browser | 2.8 keeps table display; 4.4 measures it |
| R2 read as "delete the layered glow" | C6 exists because scaling one channel looked fixed twice already | 2.4 is a retune with C6 still green as its acceptance |
| Two canvases on disk, no stated precedence | Next pass authors against the wrong one | 0.1 |

---

## 9. Open items not in scope for this pass

- `WEEK / 40:00` — needs weekly aggregation the widget does not do.
- `HISTORY →` — needs a history view that does not exist.
- Operator id / geofence / biometric ticker copy — invented content; excluded by the widget's
  own "real values only" rule.
- MK-IV's `next` prompts, deliberately left for a future canvas: *"collapse the left rail into
  tabs"*, *"add a game-mode fullscreen state"*, *"mobile 360px version"*,
  *"add the badge grid back as HUD tiles"*.
