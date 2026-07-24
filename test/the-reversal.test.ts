import { describe, expect, it } from 'vitest';
import {
  JETER,
  JUSTICE,
  VIEWS,
  diffAt,
  findingSentence,
  flipT,
  fmtAvg,
  pooledAt,
  pooledReal,
  seasonAvg,
  seasonWinner,
  shareAt,
  winnerAt,
  zoneOf,
} from '../src/scripts/the-reversal.model';

const TWO = VIEWS.two;
const THREE = VIEWS.three;

describe('the real data', () => {
  it('is the twelve integers from Baseball-Reference, and derives the printed averages', () => {
    // The batting averages the reader sees are computed from these, so pinning
    // the averages pins the integers: any typo in an at-bat count moves a dot.
    expect(JUSTICE.seasons.map((s) => fmtAvg(seasonAvg(s)))).toEqual(['.253', '.321', '.329']);
    expect(JETER.seasons.map((s) => fmtAvg(seasonAvg(s)))).toEqual(['.250', '.314', '.291']);
  });

  it('has Justice ahead in every single season', () => {
    // The claim the whole exhibit rests on, asserted rather than assumed.
    for (let i = 0; i < 3; i++) expect(seasonWinner(i)).toBe('Justice');
  });

  it('has Jeter ahead on the real pooled average, both views', () => {
    // Two-season: decisive. Three-season: on a hair, but still a reversal.
    expect(pooledReal(JETER, TWO)).toBeGreaterThan(pooledReal(JUSTICE, TWO));
    expect(pooledReal(JETER, THREE)).toBeGreaterThan(pooledReal(JUSTICE, THREE));

    expect(fmtAvg(pooledReal(JUSTICE, TWO))).toBe('.270');
    expect(fmtAvg(pooledReal(JETER, TWO))).toBe('.310');
    expect(fmtAvg(pooledReal(JUSTICE, THREE))).toBe('.298');
    expect(fmtAvg(pooledReal(JETER, THREE))).toBe('.300');
  });
});

describe('re-weighting holds every batting average fixed', () => {
  it('changes only the shares, never a season average, at any t', () => {
    // The ethical invariant: the reader moves weight, never data.
    for (const p of [JUSTICE, JETER])
      for (let i = 0; i < 3; i++) {
        const a = seasonAvg(p.seasons[i]!);
        for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(seasonAvg(p.seasons[i]!)).toBe(a);
      }
  });

  it('makes each player’s shares sum to one at every t', () => {
    for (const p of [JUSTICE, JETER])
      for (const idx of [TWO, THREE])
        for (const t of [0, 0.3, 0.7, 1]) {
          const total = idx.reduce((a, i) => a + shareAt(p, i, t, idx), 0);
          expect(total).toBeCloseTo(1, 12);
        }
  });

  it('equal weighting (t=0) is the plain mean of the season averages', () => {
    for (const p of [JUSTICE, JETER])
      for (const idx of [TWO, THREE]) {
        const mean = idx.reduce((a, i) => a + seasonAvg(p.seasons[i]!), 0) / idx.length;
        expect(pooledAt(p, 0, idx)).toBeCloseTo(mean, 12);
      }
  });

  it('HOME (t=1) is exactly the real pooled average, not merely close', () => {
    for (const p of [JUSTICE, JETER])
      for (const idx of [TWO, THREE]) expect(pooledAt(p, 1, idx)).toBeCloseTo(pooledReal(p, idx), 12);
  });

  it('moves each player’s pooled average monotonically in t', () => {
    // Justice falls (his weight shifts onto his worst, biggest season); Jeter
    // rises. Monotone is what guarantees a single crossing.
    for (const idx of [TWO, THREE]) {
      let lastJ = -1;
      let lastD = 2;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const j = pooledAt(JETER, t, idx);
        const d = pooledAt(JUSTICE, t, idx);
        expect(j).toBeGreaterThanOrEqual(lastJ - 1e-9);
        expect(d).toBeLessThanOrEqual(lastD + 1e-9);
        lastJ = j;
        lastD = d;
      }
    }
  });
});

describe('the flip', () => {
  it('crosses exactly once, from Justice to Jeter, on both views', () => {
    for (const idx of [TWO, THREE]) {
      const f = flipT(idx);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThan(1);
      expect(winnerAt(f - 0.01, idx)).toBe('Justice');
      expect(winnerAt(f + 0.01, idx)).toBe('Jeter');
      // and the root really zeroes the difference
      expect(diffAt(f, idx)).toBeCloseTo(0, 12);
    }
  });

  it('pins the flip point for each view', () => {
    expect(flipT(TWO)).toBeCloseTo(0.1137, 4);
    expect(flipT(THREE)).toBeCloseTo(0.9122, 4);
  });

  it('puts real playing time (home) on the Jeter side of the flip', () => {
    // Home is t = 1, past the flip: the reversal is in the actual record, not
    // something the reader has to manufacture.
    for (const idx of [TWO, THREE]) {
      expect(1).toBeGreaterThan(flipT(idx));
      expect(winnerAt(1, idx)).toBe('Jeter');
      expect(winnerAt(0, idx)).toBe('Justice');
    }
  });
});

describe('the committed finding sentence', () => {
  it('names the reader’s winner and their two pooled numbers, at home', () => {
    expect(findingSentence('Jeter', 1, TWO)).toBe(
      'Weighting each season by how often he actually batted, Derek Jeter was the better hitter across 1995–96, .310 to .270.',
    );
  });

  it('names Justice under equal weighting', () => {
    expect(findingSentence('Justice', 0, TWO)).toBe(
      'Counting each season equally, David Justice was the better hitter across 1995–96, .287 to .282.',
    );
  });

  it('reads the three-season span when that view is on', () => {
    expect(findingSentence('Jeter', 1, THREE)).toContain('across 1995–97');
  });
});

describe('the justification zones', () => {
  it('splits the slider into equal / between / real', () => {
    expect(zoneOf(0)).toBe('equal');
    expect(zoneOf(0.5)).toBe('between');
    expect(zoneOf(1)).toBe('real');
  });
});
