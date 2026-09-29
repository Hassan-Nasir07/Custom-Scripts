# Design reference

`design/` is a frozen copy of the Claude Design canvas *"8-Ball Pool, compact panel,
both cameras"* ([live canvas](https://claude.ai/artifact/F7VD7gEuEFbWNNuqYVCPMs)). It is
version `1790325931-f598`, copied on 2026-09-25: 29 files, the index plus 28 artboards.

Build against this copy, not the live canvas. The canvas keeps changing, and a session
that reads it mid-edit can pick up a half-finished screen. When the design moves on,
re-copy the whole folder and note the new version here.

These files are read, not served. They are Design Component pages (`.dc.html`) that
only render inside the Design editor, so open the live canvas to *see* them. Read the
copies here for exact numbers, paths and layer order.

**This revision is final.** One thing in it is deliberately **not** followed; see
*Theme mapping* in [`POOL_V2_PLAN.md`](../../POOL_V2_PLAN.md):

- **Colour and type.** The amber palette and Chakra Petch / Sora are replaced by the
  Glassmorphic Aurora and Cyberpunk HUD presets.

Everything else is followed, **including the table geometry**. `pool-physics.js` builds
its pockets, cushion ends and jaws from the numbers in `Table.dc.html`, so what is drawn
is exactly what plays.

## Revisions

| version | date | what changed |
|---|---|---|
| `1790322095-e526` | 2026-09-25 | 28 artboards: every in-match state and every tournament screen |
| `1790325931-f598` | 2026-09-25 | Table: balls stay under every overlay (`isolation: isolate`); pockets rebuilt as real 3D shafts with shaded walls and the ring texture on the floor; cushion ends get angled rubber faces; the rail's inner face is drawn. Tournament setup: slot 01 is YOU, prefilled with the user's name |
