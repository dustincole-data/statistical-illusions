import { describe, expect, it } from 'vitest';
import { mulberry32, standardNormal } from '../src/lib/rng';

describe('the seeded stream', () => {
  it('is reproducible, which is what makes a shared ?seed= honest', () => {
    const a = Array.from({ length: 20 }, mulberry32(12345));
    const b = Array.from({ length: 20 }, mulberry32(12345));
    expect(a).toEqual(b);
  });

  it('pins its opening draws, so a change to the generator cannot pass quietly', () => {
    const r = mulberry32(1);
    expect(r()).toBeCloseTo(0.6270739405881613, 15);
    expect(r()).toBeCloseTo(0.002735721180215478, 15);
    expect(r()).toBeCloseTo(0.5274470399599522, 15);
  });

  it('gives different seeds different streams', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays inside [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is roughly uniform across ten buckets', () => {
    const r = mulberry32(2026);
    const buckets = new Array(10).fill(0);
    const N = 100_000;
    for (let i = 0; i < N; i++) buckets[Math.floor(r() * 10)]++;
    for (const b of buckets) expect(Math.abs(b - N / 10) / (N / 10)).toBeLessThan(0.05);
  });
});

describe('the normal draw', () => {
  it('has mean 0 and variance 1 over 200k draws', () => {
    // Bands are ~6 standard errors wide (se of the variance is sqrt(2/N)
    // ≈ .003). Tight enough to catch a broken transform, loose enough that it
    // is testing the generator rather than one seed's luck.
    const r = mulberry32(4242);
    const N = 200_000;
    let sum = 0;
    let sumsq = 0;
    for (let i = 0; i < N; i++) {
      const z = standardNormal(r);
      sum += z;
      sumsq += z * z;
    }
    const mean = sum / N;
    const variance = sumsq / N - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.015);
    expect(variance).toBeGreaterThan(0.98);
    expect(variance).toBeLessThan(1.02);
  });

  it('puts about 95% of its mass inside two standard deviations', () => {
    const r = mulberry32(11);
    const N = 100_000;
    let within = 0;
    for (let i = 0; i < N; i++) if (Math.abs(standardNormal(r)) <= 1.96) within++;
    expect(within / N).toBeCloseTo(0.95, 2);
  });

  it('consumes exactly two uniforms per draw', () => {
    let calls = 0;
    const base = mulberry32(5);
    const counted = () => {
      calls++;
      return base();
    };
    standardNormal(counted);
    expect(calls).toBe(2);
  });
});
