# snake-dev

The Snake engine, kept outside `AttendanceTimeCheckerPlus.js` so it can be read, diffed
and tested on its own. The userscript carries a **verbatim copy** of `snake-core.js` +
`snake-ui.js`; `snake-verify.js` asserts the two are byte-identical.

**Edit the files here, never the copy in the userscript.** Editing the copy is how they
drift, and the drift is silent until the next reinsert refuses to run.

```
node snake-dev/reinsert.js              # splice snake-dev/ into the userscript
node snake-dev/snake-verify.js          # 308 assertions
node ludo-dev/verify-all.js             # all 10 suites, snake included
node snake-dev/preview.js out.png long  # render the real canvas to a PNG
```

## Files

| file | what it is |
|---|---|
| `snake-core.js` | state, modes, the 12-stage table, collision, food, growth, scoring |
| `snake-ui.js` | skins, board geometry, rendering, animation, the tray, lifecycle |
| `load.js` | evaluates both as one unit against a stub browser and returns the internals |
| `snake-verify.js` | headless engine checks + a static audit of the host wiring |
| `reinsert.js` | mechanical splice into `AttendanceTimeCheckerPlus.js` |
| `preview.js` | renders `drawSnakeGame` to a PNG so the art can be judged |

## preview.js

The verify suite draws against a stub context, which proves nothing throws and
nothing about whether the snake *looks* like a snake. `preview.js` runs the real
`drawSnakeGame` through the software rasterizer in `ludo-dev/preview.js` (shared,
not copied — that file exports its `Raster`/`Ctx` when required as a module) and
writes a PNG.

```
node snake-dev/preview.js out.png <scenario>
```

Scenarios: `idle` `crawling` `turning` `eating` `swallow` `wrap` `levels`
`walled` `dying` `long` `skins`. The last one renders every skin on the same
pose as one sheet.

It is exact on geometry but not on finish: strokes aren't antialiased, text uses
a 3×5 bitmap font (so `·` shows as a hollow box), and gradients flatten to their
middle stop. Judge layout, silhouette and colour from it — not polish.

Both module files are indented blocks of the userscript's IIFE body — they have no exports
of their own. Wrapping them in a `Function` is what makes the same source both
drop-in-able and testable, which is the trick `ludo-dev/` uses too.

## The reinsert contract

`reinsert.js` finds the block between two sentinel comments:

```js
    // ═══ SNAKE ENGINE — generated from snake-dev/, do not edit here ═══
    …
    // ═══ END SNAKE ENGINE ═══
```

It refuses to run if the sentinels are missing, appear more than once, or are out of
order, because a partial match would corrupt 17k lines. This differs from
`ludo-dev/reinsert.js`, which reconstructs the previous block from a git revision — the
sentinel approach gives the same guarantee but still works when the copy in the file came
from an uncommitted edit.

## Things not to break

- **The 12 stages are flood-filled on every run.** A layout with a sealed-off pocket is
  unwinnable the moment food spawns inside it, and the player has no way to see why. Stage
  12's four gaps at x/y 9–10 exist for exactly this reason — the first draft was a closed
  box and the test caught it.
- **`snakeStepCell` is the only place edges and obstacles are resolved.** Bounds are exact.
  v1 allowed the head to sit a full cell outside the board, which was invisible without a
  border but reads as passing straight through the drawn wall.
- **`spawnFood` enumerates free cells rather than rejection-sampling.** The v1 `do…while`
  had no exit and hung the tab on a full board; Levels shrinks the playable area enough to
  reach that. An empty list is a won board, not a crash.
- **The brick frame lives in canvas margin, not in grid cells.** The playfield stays 20×20
  in every mode, so scores set before v2 remain comparable with scores set after it.
- **Skin unlocks are an honour system.** They are not enforced anywhere and are not a
  security boundary — the cost of forging one is a colour gradient.
