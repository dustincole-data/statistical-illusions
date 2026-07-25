import { describe, expect, it } from 'vitest';
import {
  DEFAULT,
  EFFECT_SIZE,
  GIGERENZER,
  GUARDRAIL,
  RANGE,
  type TestDesign,
  findingSentence,
  fmtPct,
  frequencies,
  oneIn,
  ppv,
  prevalenceForPPV,
} from '../src/scripts/the-positive.model';

describe('the closed-form PPV', () => {
  it('reproduces the published design space (§8.4)', () => {
    // A test the reader would call excellent, on a rare disease, is mostly wrong.
    expect(ppv({ prev: 0.01, sens: 0.95, spec: 0.95 })).toBeCloseTo(0.1610, 4);
    expect(ppv({ prev: 0.008, sens: 0.9, spec: 0.93 })).toBeCloseTo(0.0939, 4);
    expect(ppv({ prev: 0.001, sens: 0.99, spec: 0.99 })).toBeCloseTo(0.0902, 4);
  });

  it('reproduces Gigerenzer’s mammography number, 9 of 98', () => {
    expect(ppv(GIGERENZER.design)).toBeCloseTo(0.0917, 4);
  });

  it('is bounded in [0,1] and rises with prevalence, holding the test fixed', () => {
    let last = -1;
    for (const prev of [0.001, 0.005, 0.01, 0.05, 0.1, 0.2]) {
      const v = ppv({ prev, sens: 0.95, spec: 0.95 });
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThan(last);
      last = v;
    }
  });

  it('cannot be rescued by a better test while prevalence stays low', () => {
    // The whole lesson: crank both dials to 99% and 1% prevalence still loses.
    expect(ppv({ prev: 0.01, sens: 0.99, spec: 0.99 })).toBeLessThan(0.5);
  });
});

describe('the 50% crossover', () => {
  it('is exactly 5% prevalence for the 95/95 test', () => {
    expect(prevalenceForPPV(0.5, 0.95, 0.95)).toBeCloseTo(0.05, 12);
    // and the closed form agrees at that prevalence
    expect(ppv({ prev: 0.05, sens: 0.95, spec: 0.95 })).toBeCloseTo(0.5, 12);
  });

  it('places the reader’s default (1% prevalence) below the crossover', () => {
    expect(DEFAULT.prev).toBeLessThan(prevalenceForPPV(0.5, DEFAULT.sens, DEFAULT.spec));
    expect(ppv(DEFAULT)).toBeLessThan(0.5);
  });
});

describe('the thousand countable people', () => {
  const SETTINGS: TestDesign[] = [
    DEFAULT,
    GIGERENZER.design,
    { prev: 0.001, sens: 0.99, spec: 0.99 },
    { prev: 0.2, sens: 0.7, spec: 0.6 },
    { prev: 0.008, sens: 0.9, spec: 0.93 },
  ];

  it('always sums to exactly N, with no negative group', () => {
    for (const d of SETTINGS) {
      const f = frequencies(d, 1000);
      expect(f.truePos + f.falseNeg + f.falsePos + f.trueNeg).toBe(1000);
      expect(f.sick + f.healthy).toBe(1000);
      expect(f.flagged).toBe(f.truePos + f.falsePos);
      for (const g of [f.sick, f.healthy, f.truePos, f.falseNeg, f.falsePos, f.trueNeg])
        expect(g).toBeGreaterThanOrEqual(0);
    }
  });

  it('pins the reader’s default array: 10 sick, ~60 flagged, ~1 in 6', () => {
    const f = frequencies(DEFAULT, 1000);
    expect(f.sick).toBe(10);
    expect(f.healthy).toBe(990);
    expect(f.truePos).toBe(10);
    expect(f.falsePos).toBe(50);
    expect(f.flagged).toBe(60);
    expect(oneIn(f)).toBe('about 1 in 6');
  });

  it('pins Gigerenzer’s array exactly: 9 of 98', () => {
    const f = frequencies(GIGERENZER.design, 1000);
    expect(f.sick).toBe(10);
    expect(f.truePos).toBe(9);
    expect(f.falsePos).toBe(89);
    expect(f.flagged).toBe(98);
  });

  it('keeps the counted ratio and the closed form within one person of rounding', () => {
    for (const d of SETTINGS) {
      const f = frequencies(d, 1000);
      if (f.flagged > 0) expect(Math.abs(f.ppvInt - ppv(d))).toBeLessThan(0.03);
    }
  });
});

describe('the finding sentence', () => {
  it('states the reader’s result as a count, then a natural frequency', () => {
    expect(findingSentence(DEFAULT, 1000)).toBe(
      'Of the 60 people your test flagged, 10 actually had the condition. That is about 1 in 6.',
    );
  });

  it('never contains an em dash (the anthology sweep)', () => {
    expect(findingSentence(DEFAULT)).not.toContain('—');
    expect(GUARDRAIL).not.toContain('—');
    expect(GIGERENZER.problem).not.toContain('—');
    expect(GIGERENZER.naturalFrequency).not.toContain('—');
  });
});

describe('the protected constants', () => {
  it('keeps the honest effect size and the ranges intact', () => {
    expect(EFFECT_SIZE).toEqual({ withFrequencies: 24, withProbabilities: 4 });
    expect(RANGE.prev.max).toBeGreaterThan(0.05); // the rescue must be reachable
    expect(fmtPct(0.161)).toBe('16%');
  });
});
