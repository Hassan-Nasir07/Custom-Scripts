# Design reference

`design/` is a frozen copy of the Claude Design canvas *"8-Ball Pool, compact panel,
both cameras"* ([live canvas](https://claude.ai/artifact/F7VD7gEuEFbWNNuqYVCPMs)). It is
version `1790749498-5862`, copied on 2026-09-30: 56 files, the index plus 55 artboards (pool's 28
and snooker's 27).

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
| `1790715495-3a1b` | 2026-09-30 | **Snooker**, from the prompt in `POOL_V2_PLAN.md` Appendix B: 27 `Snk*` artboards in three rows (in match, sheet and tournament, full view), drawn as `snooker` variants of `InMatch`, `Max`, `Table`, `TournamentSetup`, `BracketCompact`, `BracketFull`, `BracketTree` (`format: 'bestof'`), `MatchIntro`, `MatchResult` and `TrophyCabinet`. Pool's artboards are unchanged (their files are byte-identical; the shared components only gained snooker branches). The snooker table geometry is authoritative, as pool's is |
| `1790749498-5862` | 2026-09-30 | **Snooker pockets** (the user's update, from the middle pockets looking unfinished): every cushion end is a rounded nose of radius 6 and then a straight jaw to the rail (square at the middle pockets, leaning 5 u toward the corners), the corner holes move to offset 2 with radius 18, and in 3D the hole's lip runs at rail height where it cuts the rail and drops to the felt across the cushion gap, with the cushions drawn again in front. Only `Table.dc.html` changed; the physics adopts the new jaws and holes |
