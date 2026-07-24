import { describe, expect, it } from 'vitest';
import { ibeta, lgamma, marginOfError95, pFromT, percent, welch } from '../src/lib/stats';

/**
 * The statistics core is the piece's credential. If these drift, the colophon
 * is lying, so they are pinned against values that exist outside this repo.
 */
describe('the p-value engine, against published critical values', () => {
  // Every textbook t-table: these are the criticals, so the p must come back
  // to the significance level that defines them.
  it.each([
    [2.228, 10, 0.05],
    [2.086, 20, 0.05],
    [3.169, 10, 0.01],
    [1.96, 100000, 0.05],
    [1.0, 30, 0.3253],
    [2.0, 10, 0.0734],
  ])('t = %f on df = %i gives p ≈ %f', (t, df, expected) => {
    expect(pFromT(t, df)).toBeCloseTo(expected, 3);
  });

  // Exact to five decimals, which is the standard the ticket-06 probe set.
  it('is exact to five decimals at the three criticals that matter', () => {
    expect(pFromT(2.228, 10).toFixed(5)).toBe('0.05001');
    expect(pFromT(2.086, 20).toFixed(5)).toBe('0.05000');
    expect(pFromT(3.169, 10).toFixed(5)).toBe('0.01000');
  });

  it('is symmetric in the sign of t, because the test is two-tailed', () => {
    expect(pFromT(-2.228, 10)).toBe(pFromT(2.228, 10));
  });

  it('runs from 1 at t = 0 to 0 in the far tail', () => {
    expect(pFromT(0, 12)).toBeCloseTo(1, 12);
    expect(pFromT(50, 12)).toBeLessThan(1e-12);
  });
});

describe('the special functions underneath it', () => {
  it('reproduces log Γ at the factorials', () => {
    expect(Math.exp(lgamma(5))).toBeCloseTo(24, 8); // Γ(5) = 4!
    expect(Math.exp(lgamma(1))).toBeCloseTo(1, 10);
    expect(Math.exp(lgamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 10);
  });

  it('pins the incomplete beta at its boundaries and its symmetry point', () => {
    expect(ibeta(2, 3, 0)).toBe(0);
    expect(ibeta(2, 3, 1)).toBe(1);
    expect(ibeta(3, 3, 0.5)).toBeCloseTo(0.5, 12);
  });
});

describe("Welch's t-test", () => {
  it('finds nothing between two identical samples', () => {
    const v = [3, 1, 4, 1, 5, 9, 2, 6];
    const w = welch(v, v);
    expect(w.t).toBe(0);
    expect(w.p).toBeCloseTo(1, 12);
  });

  it('pins a hand-checkable pair exactly', () => {
    const w = welch([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(w.ma).toBe(3);
    expect(w.mb).toBe(6);
    expect(w.t).toBeCloseTo(-1.8973665961010275, 15);
    // Welch, not Student: unequal variances pull df below n1 + n2 - 2 = 8.
    expect(w.df).toBeCloseTo(5.882352941176471, 12);
    expect(w.p).toBeCloseTo(0.10753119493062253, 15);
  });

  it('is antisymmetric in argument order but returns the same p', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    expect(welch(b, a).t).toBe(-welch(a, b).t);
    expect(welch(b, a).p).toBeCloseTo(welch(a, b).p, 15);
  });

  it('is unmoved by a shared linear rescale, which is why display units are inert', () => {
    const a = [0.4, -1.2, 0.9, 0.1, 2.0, -0.3];
    const b = [-0.8, 0.2, -1.4, 0.6, -0.1, 1.1];
    const scale = (v: number[]) => v.map((z) => 380 + 45 * z);
    expect(welch(scale(a), scale(b)).p).toBeCloseTo(welch(a, b).p, 14);
  });
});

describe('the margin the piece shows on its own numbers', () => {
  it('is the textbook 95% half-width, in percentage points', () => {
    // p = .5, n = 100 -> 1.96 * .05 = 9.8 points
    expect(marginOfError95(50, 100)).toBeCloseTo(9.8, 10);
  });

  it('narrows as the sample grows', () => {
    expect(marginOfError95(300, 600)).toBeLessThan(marginOfError95(50, 100));
  });

  it('renders a proportion to one decimal', () => {
    expect(percent(545, 600)).toBe('90.8%');
    expect(percent(0, 600)).toBe('0.0%');
  });
});
