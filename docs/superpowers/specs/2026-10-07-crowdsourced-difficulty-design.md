# Crowdsourced board difficulty (design)

Date: 2026-10-07
Status: approved for implementation

## Goal

Boards should land in a **consistent, mostly-solvable** difficulty band day to
day, tuned by what players actually found hard rather than a structural guess.
Concretely: aim each board's **hardest cell** at an eventual solve-rate in
**[0.45, 0.75]**, eliminating both trivial and brutal days. Behind-the-scenes
only — no player-facing UI in this project.

## Existing substrate (no new logging needed)

`cell_results` already records one row per (day, player, cell, practice),
written on a player's **first guess** for that cell:

- correct → `product_id` set, `solved_at` set;
- miss/near → `product_id` NULL, `misses` incremented.

So across players who engaged a cell: `attempts` = row count, `solved` = rows
with a product, **solve rate** = solved/attempts, measured only among people who
actually tried. This is the signal.

## Approach A — per-tag empirical difficulty, blended with the structural estimate

### Nightly rollup (`server/difficulty.ts`)

`computeDifficultyStats(db, { today, windowDays })` aggregates `cell_results`
where `practice = 0` and `day` within a trailing **90-day** window, grouped by
`pair_key`. Each pair row is attributed to **both** of its tags (split
`pair_key` on `|`). Produces:

- `tags[tagId] = { attempts, solved, solveRate, avgMisses }`
- `pairs[pairKey] = { attempts, solved, solveRate }` (interaction signal)

The source of truth stays `cell_results`; the snapshot is recomputed each night.
The server writes it to `data/difficulty-stats.json` for the generator.

### Signal math

- Per-tag hardness `h(T) = 1 - solveRate(T)` ∈ [0,1]. `avgMisses` kept for
  debugging, not in the core score.
- Trust blend (cold-start safety): `w(T) = min(1, attempts(T) / 50)`;
  `H(T) = w·h_observed + (1-w)·h_structural`, where `h_structural` is the
  generator's existing category-obscurity weight normalized to [0,1].
- Predicted cell solve-rate for tags (A,B): per-pair observed rate when that
  pair has ≥ 30 attempts; otherwise `(1 - H(A))·(1 - H(B))`, floored.

With no data, `H` collapses to structural and the generator behaves exactly as
today; as data accrues, the observed signal takes over.

### Generator integration (`scripts/generateBoard.ts`)

Keep the whole existing `scoreBoard` (its guardrails already guarantee
structurally beatable boards). Add one objective term: compute
`worstSolve = min over 9 cells of predictedCellSolveRate`; reward boards with
`worstSolve` in [0.45, 0.75], penalize linearly outside, weighted to dominate
tie-breaking among already-beatable candidates without overriding the hard
guardrails. New `--difficulty <file>` flag; absent/empty/malformed ⇒
structural-only (current behavior), logged once.

### Wiring (`Dokubolaget/server.js`)

In the nightly pipeline, after `findTags` and before `generateBoard`: compute
stats, write `data/difficulty-stats.json`, pass `--difficulty`. Wrapped in
try/catch so any stats failure logs and proceeds structural-only — it can never
block board generation.

### Config constants

`WINDOW_DAYS=90`, `N_FULL=50`, `MIN_PAIR=30`, `TARGET_BAND=[0.45, 0.75]`, plus
the band weight. Named constants now; env-overridable later if needed.

### Testing

- `server/difficulty.test.ts`: seeded rows → correct per-tag/per-pair stats;
  practice rows and out-of-window rows excluded; pair split attributes to both
  tags.
- Generator test: injected synthetic stats rank an in-band board above an
  out-of-band one; empty/no stats ⇒ unchanged ranking (cold-start regression).

Bundled fallback boards (`data/generated-boards.json`) are untouched;
regenerating them only matters once real data exists (separate optional step).
