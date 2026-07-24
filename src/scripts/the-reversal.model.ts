/**
 * Illusion 02 · The Reversal — THE RULE SET.
 *
 * Simpson's paradox with no interface attached: two hitters, their real
 * season lines, the weighted average the reader re-weights, and the sentence
 * they commit to. `the-reversal.ts` is the controller that draws it; this file
 * is what the tests and the verification gate run against, because the numbers
 * are the credential and a number that only exists inside a DOM handler cannot
 * be pinned.
 *
 * There is no RNG here. Unlike the hero, the data is fixed and public — every
 * batting average below is the real one, verified against Baseball-Reference.
 * The ONLY thing that varies is the slider `t`, and it varies the *weighting*,
 * never a batting average. That invariant is the whole ethical spine of the
 * exhibit: the reader is an explorer of an averaging convention, not a forger
 * of data. Nothing here touches `document`, `location`, or `Math.random`.
 */

// ── the two hitters, real and fixed ─────────────────────────────────────────

export type PlayerName = 'Justice' | 'Jeter';

export interface Season {
  year: number;
  /** At-bats. THE HIDDEN VARIABLE — spread unevenly across the two men. */
  ab: number;
  /** Hits. */
  h: number;
}

export interface Player {
  name: PlayerName;
  /** Year order: 1995, 1996, 1997. */
  seasons: Season[];
}

/**
 * David Justice and Derek Jeter, 1995–97, verified against Baseball-Reference
 * (`justida01`, `jeterde01`). Justice hit for a higher average in every one of
 * the three seasons; Jeter hit for a higher average across the seasons pooled.
 * Nothing below is rounded — the batting averages the reader sees are derived
 * from these, so the twelve integers are the single source of truth.
 */
export const JUSTICE: Player = {
  name: 'Justice',
  seasons: [
    { year: 1995, ab: 411, h: 104 }, // .253
    { year: 1996, ab: 140, h: 45 }, //  .321
    { year: 1997, ab: 495, h: 163 }, // .329
  ],
};

export const JETER: Player = {
  name: 'Jeter',
  seasons: [
    { year: 1995, ab: 48, h: 12 }, //   .250
    { year: 1996, ab: 582, h: 183 }, // .314
    { year: 1997, ab: 654, h: 190 }, // .291
  ],
};

export const PLAYERS: Player[] = [JUSTICE, JETER];

// ── which seasons are on the table ──────────────────────────────────────────

export type ViewKey = 'two' | 'three';

/**
 * The lead is the two-season table (1995–96): the reversal reads cleanest and
 * the pooled margin is decisive. The third season is an "and it still holds"
 * toggle — the three-season reversal is real but lands on a hair (.2983 vs
 * .2998), which is its own quieter point.
 */
export const VIEWS: Record<ViewKey, number[]> = {
  two: [0, 1],
  three: [0, 1, 2],
};

// ── batting averages ────────────────────────────────────────────────────────

/** One season's batting average. The fixed truth; the slider never moves it. */
export const seasonAvg = (s: Season): number => s.h / s.ab;

/** Baseball convention: three decimals, no leading zero. `.287`, not `0.287`. */
export const fmtAvg = (x: number): string => x.toFixed(3).replace(/^0/, '');

/** The real pooled average over the chosen seasons: total hits / total at-bats. */
export function pooledReal(p: Player, idx: number[]): number {
  let h = 0;
  let ab = 0;
  for (const i of idx) {
    h += p.seasons[i]!.h;
    ab += p.seasons[i]!.ab;
  }
  return h / ab;
}

// ── the one knob: re-weighting the at-bats ──────────────────────────────────

/**
 * The share of a player's at-bats assigned to one season at slider position
 * `t`, holding every batting average fixed.
 *
 *   t = 0  →  every season counts equally (1 / number of seasons)
 *   t = 1  →  the real distribution of at-bats — HOME, the way the record reads
 *
 * Linear in `t`, so the pooled average is linear in `t`, so the pooled winner
 * can cross at most once. That the crossing exists at all is the paradox; that
 * it is single and monotonic is what lets one slider drive it honestly.
 */
export function shareAt(p: Player, seasonIndex: number, t: number, idx: number[]): number {
  const totalAb = idx.reduce((a, i) => a + p.seasons[i]!.ab, 0);
  const equal = 1 / idx.length;
  const real = p.seasons[seasonIndex]!.ab / totalAb;
  return (1 - t) * equal + t * real;
}

/**
 * A player's pooled average at slider position `t`. At `t = 1` this equals
 * `pooledReal` exactly, because the real shares are `realAb / totalAb`. That
 * identity is asserted in the tests: home is not "close to" real, it IS real.
 */
export function pooledAt(p: Player, t: number, idx: number[]): number {
  let sum = 0;
  for (const i of idx) sum += shareAt(p, i, t, idx) * seasonAvg(p.seasons[i]!);
  return sum;
}

/** Jeter minus Justice at `t`. Positive → Jeter leads the pooled average. */
export const diffAt = (t: number, idx: number[]): number =>
  pooledAt(JETER, t, idx) - pooledAt(JUSTICE, t, idx);

/**
 * The pooled winner at `t`. On an exact tie (`t === flipT`, a single point)
 * the earlier-named player is returned; the controller never rests there.
 */
export const winnerAt = (t: number, idx: number[]): PlayerName =>
  diffAt(t, idx) > 0 ? 'Jeter' : 'Justice';

/**
 * The single slider position where the pooled winner flips. Because `diffAt`
 * is linear in `t`, this is a closed form, not a search: the root of a line
 * through `diffAt(0)` and `diffAt(1)`.
 *
 * Two-season ≈ 0.114 (real playing time is well past the flip → Jeter);
 * three-season ≈ 0.912 (the reversal only survives right up against home).
 */
export function flipT(idx: number[]): number {
  const d0 = diffAt(0, idx);
  const d1 = diffAt(1, idx);
  return d0 / (d0 - d1);
}

/** The higher average in one season. Justice wins all three; asserted in tests. */
export const seasonWinner = (seasonIndex: number): PlayerName =>
  seasonAvg(JUSTICE.seasons[seasonIndex]!) >= seasonAvg(JETER.seasons[seasonIndex]!)
    ? 'Justice'
    : 'Jeter';

// ── the justification panel ─────────────────────────────────────────────────

/**
 * The hero's knobs carry published citations; here the "defence" is different
 * and, if anything, sharper: BOTH ways of combining seasons are legitimate.
 * The panel names which convention the reader is standing on and what it costs,
 * by zone of the slider. The reason a careful person would give, and the price.
 */
export type Zone = 'equal' | 'between' | 'real';

export const zoneOf = (t: number): Zone => (t < 0.08 ? 'equal' : t > 0.92 ? 'real' : 'between');

export interface Justification {
  reason: string;
  cost: string;
}

export const JUSTIFICATIONS: Record<Zone, Justification> = {
  equal: {
    reason:
      'Count each season once. Two seasons, two numbers, averaged. It is the instinct almost everyone has, and there is nothing wrong with the arithmetic.',
    cost: 'But the two seasons are not the same size. One man’s average here rests on 48 at-bats and the other’s on 582, and this treats them as equals.',
  },
  between: {
    reason:
      'Somewhere in between. You are giving the busier seasons more say than the quiet ones, but not all the way.',
    cost: 'There is no wrong stop along this slider, which is exactly the trouble. The answer to “who was better” is now a thing you are choosing, not finding.',
  },
  real: {
    reason:
      'Weight by at-bats, the way the record actually reads. A batting average across seasons IS total hits over total at-bats; this is the honest pooled number.',
    cost: 'And it hands the title to the man who hit for a lower average in every single one of the seasons, because his good years are the ones he played most.',
  },
};

// ── what the reader commits to ──────────────────────────────────────────────

/**
 * The finding, in the register of a claim someone would actually publish,
 * generated from the reader's chosen weighting and named winner. Like the
 * hero's finding sentence, it is true — that is what makes the reveal land.
 */
export function findingSentence(winner: PlayerName, t: number, idx: number[]): string {
  const years = idx.map((i) => JUSTICE.seasons[i]!.year);
  const span = `${years[0]}–${String(years[years.length - 1]!).slice(2)}`;
  const wj = pooledAt(winner === 'Jeter' ? JETER : JUSTICE, t, idx);
  const loser: PlayerName = winner === 'Jeter' ? 'Justice' : 'Jeter';
  const wl = pooledAt(loser === 'Jeter' ? JETER : JUSTICE, t, idx);
  const how =
    zoneOf(t) === 'real'
      ? 'Weighting each season by how often he actually batted'
      : zoneOf(t) === 'equal'
        ? 'Counting each season equally'
        : 'On the weighting you chose';
  return (
    `${how}, ${winner === 'Jeter' ? 'Derek Jeter' : 'David Justice'} was the better hitter ` +
    `across ${span}, ${fmtAvg(wj)} to ${fmtAvg(wl)}.`
  );
}
