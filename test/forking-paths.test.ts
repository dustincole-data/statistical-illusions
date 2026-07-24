import { describe, expect, it } from 'vitest';
import {
  MEASURES,
  OUTLIERS,
  SUBGROUPS,
  THRESHOLD,
  anySignificant,
  anySignificantOneMeasure,
  applyOutlierRule,
  comboCount,
  display,
  findingSentence,
  garden,
  makeStudy,
  preRegisteredHit,
  runPath,
  stopsFor,
} from '../src/scripts/forking-paths.model';

/** The sample every golden below is measured on. */
const SEED = 20260724;
const study = makeStudy(SEED, 40);

describe('the study', () => {
  it('draws the requested number of subjects, alternating arms', () => {
    expect(study).toHaveLength(40);
    expect(study.filter((d) => d.arm === 1)).toHaveLength(20);
    expect(study.filter((d) => d.arm === 0)).toHaveLength(20);
    expect(study.map((d) => d.arm).slice(0, 4)).toEqual([0, 1, 0, 1]);
  });

  it('is reproducible from its seed', () => {
    expect(makeStudy(SEED, 40)).toEqual(study);
  });

  it('has NO TRUE EFFECT: the arms are drawn from one distribution', () => {
    // Averaged over many samples the difference has to vanish. This is the
    // claim the whole exhibit rests on, so it is asserted rather than assumed.
    for (let k = 0; k < 3; k++) {
      let total = 0;
      const TRIALS = 400;
      for (let seed = 1; seed <= TRIALS; seed++) {
        const s = makeStudy(seed, 40);
        const nap = s.filter((d) => d.arm === 1).map((d) => d.ys[k]!);
        const ctl = s.filter((d) => d.arm === 0).map((d) => d.ys[k]!);
        total += nap.reduce((a, x) => a + x, 0) / 20 - ctl.reduce((a, x) => a + x, 0) / 20;
      }
      expect(Math.abs(total / TRIALS)).toBeLessThan(0.05);
    }
  });

  it('correlates its three measures at about r = .5, as measures of one construct do', () => {
    const xs: number[][] = [[], [], []];
    for (let seed = 1; seed <= 200; seed++)
      for (const d of makeStudy(seed, 40)) for (let k = 0; k < 3; k++) xs[k]!.push(d.ys[k]!);
    const corr = (a: number[], b: number[]) => {
      const ma = a.reduce((s, x) => s + x, 0) / a.length;
      const mb = b.reduce((s, x) => s + x, 0) / b.length;
      let num = 0;
      let da = 0;
      let db = 0;
      for (let i = 0; i < a.length; i++) {
        num += (a[i]! - ma) * (b[i]! - mb);
        da += (a[i]! - ma) ** 2;
        db += (b[i]! - mb) ** 2;
      }
      return num / Math.sqrt(da * db);
    };
    expect(corr(xs[0]!, xs[1]!)).toBeCloseTo(0.49, 1);
    expect(corr(xs[0]!, xs[2]!)).toBeCloseTo(0.49, 1);
  });

  it('EXTENDS rather than redraws when the sample grows', () => {
    // "Collect 10 more subjects" has to be an honest continuation of the same
    // study, not a quiet reroll into a friendlier sample.
    const bigger = makeStudy(SEED, 70);
    expect(bigger.slice(0, 40).map((d) => d.ys)).toEqual(study.map((d) => d.ys));
    expect(bigger).toHaveLength(70);
  });

  it('keeps intake attributes off the outcome stream', () => {
    // age and hours-slept are display only; they must never move a p-value.
    for (const d of study) {
      expect(d.age).toBeGreaterThanOrEqual(19);
      expect(d.age).toBeLessThan(54);
      expect(d.slept).toBeGreaterThan(4);
      expect(d.slept).toBeLessThan(10);
      expect(d.old === 1 ? d.age >= 30 : d.age < 30).toBe(true);
      expect(d.rested === 1 ? d.slept >= 7 : d.slept < 7).toBe(true);
    }
  });
});

describe('the seven subgroup filters', () => {
  it('partitions the sample into three complementary pairs plus everyone', () => {
    expect(SUBGROUPS).toHaveLength(7);
    const n = (i: number) => study.filter(SUBGROUPS[i]!.f).length;
    expect(n(0)).toBe(40);
    expect(n(1) + n(2)).toBe(40); // women + men
    expect(n(3) + n(4)).toBe(40); // 30+ and under 30
    expect(n(5) + n(6)).toBe(40); // rested and deprived
  });

  it('pins each filter on the golden sample', () => {
    expect(SUBGROUPS.map((g) => study.filter(g.f).length)).toEqual([40, 20, 20, 21, 19, 18, 22]);
  });

  it('selects on the attribute it names', () => {
    expect(study.filter(SUBGROUPS[1]!.f).every((d) => d.sex === 1)).toBe(true);
    expect(study.filter(SUBGROUPS[3]!.f).every((d) => d.age >= 30)).toBe(true);
    expect(study.filter(SUBGROUPS[6]!.f).every((d) => d.slept < 7)).toBe(true);
  });
});

describe('the three outlier rules', () => {
  it('pins what each leaves on the golden sample', () => {
    expect(OUTLIERS.map((o) => applyOutlierRule(study, 0, o.key).length)).toEqual([40, 39, 38]);
  });

  it('keeps everyone when told to keep everyone', () => {
    expect(applyOutlierRule(study, 0, 'keep')).toBe(study);
  });

  it('drops only what lies beyond two standard deviations', () => {
    const kept = applyOutlierRule(study, 0, 'sd2');
    const mu = study.reduce((a, x) => a + x.ys[0]!, 0) / study.length;
    const sd = Math.sqrt(study.reduce((a, x) => a + (x.ys[0]! - mu) ** 2, 0) / (study.length - 1));
    for (const d of kept) expect(Math.abs((d.ys[0]! - mu) / sd)).toBeLessThanOrEqual(2);
    for (const d of study)
      if (!kept.includes(d)) expect(Math.abs((d.ys[0]! - mu) / sd)).toBeGreaterThan(2);
  });

  it('trims symmetrically from both tails, at least one per end', () => {
    const kept = applyOutlierRule(study, 0, 'trim');
    expect(kept).toHaveLength(38); // 40 - 2 * max(1, round(40 * .025))
    const sorted = [...study].sort((a, b) => a.ys[0]! - b.ys[0]!);
    expect(kept).not.toContain(sorted[0]);
    expect(kept).not.toContain(sorted[sorted.length - 1]);
    // and it is measure-specific: trimming on alertness cuts different subjects
    expect(applyOutlierRule(study, 2, 'trim')).not.toEqual(kept);
  });

  it('leaves the outcome values themselves untouched', () => {
    for (const o of OUTLIERS)
      for (const d of applyOutlierRule(study, 1, o.key)) expect(study).toContain(d);
  });
});

describe('the stopping points', () => {
  it('offers the planned end and three earlier peeks at n = 40', () => {
    expect(stopsFor(40)).toEqual([40, 34, 30, 24]);
  });

  it('adds each further ten once the sample has grown that far', () => {
    expect(stopsFor(50)).toEqual([50, 43, 38, 30]);
    expect(stopsFor(60)).toEqual([60, 51, 50, 45, 36]);
    expect(stopsFor(70)).toEqual([70, 60, 53, 50, 42]);
  });

  it('never repeats a stop', () => {
    for (const n of [40, 50, 60, 70]) expect(new Set(stopsFor(n)).size).toBe(stopsFor(n).length);
  });
});

describe('enumerating the garden', () => {
  it('offers 252 combinations at n = 40', () => {
    expect(MEASURES).toHaveLength(3);
    expect(OUTLIERS).toHaveLength(3);
    expect(comboCount(40)).toBe(252);
    expect(comboCount(40)).toBe(3 * 7 * 3 * 4);
  });

  it('excludes untestable combinations FOR THE RIGHT REASON', () => {
    // The exhibit states this subtraction out loud instead of rounding it
    // away, so the stated reason has to be the true one: an arm left under
    // three subjects. Never an exception, never a silent NaN.
    let dropped = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = makeStudy(seed, 40);
      for (let k = 0; k < 3; k++)
        for (let sub = 0; sub < 7; sub++)
          for (const o of OUTLIERS)
            for (const stop of stopsFor(40)) {
              const path = runPath(s, k, sub, o.key, stop);
              if (path) {
                expect(Number.isFinite(path.p)).toBe(true);
                expect(path.p).toBeGreaterThan(0);
                expect(path.p).toBeLessThanOrEqual(1);
                continue;
              }
              dropped++;
              const kept = applyOutlierRule(s.slice(0, stop).filter(SUBGROUPS[sub]!.f), k, o.key);
              const nap = kept.filter((d) => d.arm === 1).length;
              const ctl = kept.filter((d) => d.arm === 0).length;
              expect(Math.min(nap, ctl)).toBeLessThan(3);
            }
    }
    expect(dropped).toBeGreaterThan(0); // the exclusion path is genuinely exercised
  });

  it('never enumerates more paths than there are combinations', () => {
    for (let seed = 1; seed <= 40; seed++)
      expect(garden(makeStudy(seed, 40), 40).length).toBeLessThanOrEqual(252);
  });

  it('walks measure, then subgroup, then outlier rule, then stopping point', () => {
    const g = garden(study, 40);
    expect(g[0]).toMatchObject({ k: 0, sub: 0, out: 'keep', stop: 40 });
    expect(g[1]).toMatchObject({ k: 0, sub: 0, out: 'keep', stop: 34 });
    expect(g[4]).toMatchObject({ k: 0, sub: 0, out: 'sd2', stop: 40 });
    expect(g[12]).toMatchObject({ k: 0, sub: 1, out: 'keep', stop: 40 });
    expect(g[g.length - 1]).toMatchObject({ k: 2, sub: 6 });
  });

  it('PINS every p-value in a fixed-seed garden', () => {
    // An order-sensitive checksum over all 246 paths: any change to the
    // generator, the test, a filter, a rule or the enumeration order moves it.
    const g = garden(study, 40);
    expect(g).toHaveLength(246);
    expect(comboCount(40) - g.length).toBe(6);

    const checksum = g.reduce((acc, path, i) => acc + path.p * (i + 1), 0);
    expect(checksum).toBeCloseTo(17400.007292792714, 9);
    expect(g.reduce((a, path) => a + path.p, 0)).toBeCloseTo(136.87315708238316, 11);

    expect(g[0]!.p).toBeCloseTo(0.6288302399708495, 15);
    expect(g[g.length - 1]!.p).toBeCloseTo(0.8445679330822808, 15);
    expect(Math.min(...g.map((p) => p.p))).toBeCloseTo(0.02153582122570391, 15);
    expect(g.filter((p) => p.p < THRESHOLD)).toHaveLength(2);
  });

  it('agrees with runPath on every path it reports', () => {
    for (const path of garden(study, 40))
      expect(runPath(study, path.k, path.sub, path.out, path.stop)!.p).toBe(path.p);
  });

  it('finds a significant path in this sample, and says so', () => {
    expect(anySignificant(garden(study, 40))).toBe(true);
    expect(anySignificant([{ p: 0.4 } as never])).toBe(false);
  });
});

describe('the two sweeps behind the Reveal and the Repair', () => {
  it('agrees with the full garden restricted to one measure', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const s = makeStudy(seed, 40);
      const byGarden = garden(s, 40).some((p) => p.k === 0 && p.p < THRESHOLD);
      expect(anySignificantOneMeasure(s, 40)).toBe(byGarden);
    }
  });

  it('runs the pre-registered path on everyone, keeping everyone, at the planned end', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const s = makeStudy(seed, 40);
      expect(preRegisteredHit(s, 40)).toBe(runPath(s, 0, 0, 'keep', 40)!.p < THRESHOLD);
    }
  });

  it('finds fewer results down one fixed path than across the whole garden', () => {
    // The entire argument of the Repair slot, asserted.
    let free = 0;
    let fixed = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = makeStudy(seed, 40);
      if (anySignificant(garden(s, 40))) free++;
      if (preRegisteredHit(s, 40)) fixed++;
    }
    expect(free / 400).toBeGreaterThan(0.85);
    expect(fixed / 400).toBeLessThan(0.1);
  });
});

describe('the finding sentence', () => {
  const sentenceFor = (seed: number, k: number, sub: number, out: 'keep' | 'sd2' | 'trim', stop: number) =>
    findingSentence(runPath(makeStudy(seed, 40), k, sub, out, stop)!);

  it('names the whole sample when no subgroup was chosen', () => {
    expect(sentenceFor(8, 0, 0, 'keep', 24)).toBe(
      'In a sample of forty adults, a twenty-minute nap slowed reaction time by 32 ms (n = 24, p = 0.015).',
    );
  });

  it('names the subgroup when one was', () => {
    expect(sentenceFor(3, 0, 1, 'keep', 24)).toBe(
      'Among women, a twenty-minute nap slowed reaction time by 62 ms (n = 15, p = 0.016).',
    );
  });

  it('COMPUTES THE VERB, so about half of all findings say the nap made people worse', () => {
    // Noise has a random direction. Reporting that honestly costs nothing and
    // is quietly the most damning thing on the page.
    expect(sentenceFor(1, 0, 2, 'keep', 34)).toContain('improved reaction time');
    expect(sentenceFor(3, 0, 1, 'keep', 24)).toContain('slowed reaction time');
    expect(sentenceFor(8, 1, 1, 'keep', 24)).toContain('raised accuracy');
    expect(sentenceFor(2, 1, 3, 'sd2', 34)).toContain('lowered accuracy');
  });

  it('reads the direction against each measure’s polarity', () => {
    // Lower is better for reaction time; higher is better for the other two.
    expect(MEASURES[0]!.lowerBetter).toBe(true);
    expect(MEASURES[1]!.lowerBetter).toBe(false);
    expect(MEASURES[2]!.lowerBetter).toBe(false);

    for (let seed = 1; seed <= 120; seed++)
      for (let k = 0; k < 3; k++) {
        const path = runPath(makeStudy(seed, 40), k, 0, 'keep', 40)!;
        const m = MEASURES[k]!;
        const diff = display(path.ma, m) - display(path.mb, m);
        const good = m.lowerBetter ? diff < 0 : diff > 0;
        expect(findingSentence(path)).toContain(good ? m.verb[0] : m.verb[1]);
      }
  });

  it('splits both directions roughly evenly across many findings', () => {
    let better = 0;
    let worse = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const path = runPath(makeStudy(seed, 40), 0, 0, 'keep', 40)!;
      if (findingSentence(path).includes('improved')) better++;
      else worse++;
    }
    expect(better / (better + worse)).toBeGreaterThan(0.4);
    expect(better / (better + worse)).toBeLessThan(0.6);
  });

  it('reports the surviving n and the p to three decimals', () => {
    const path = runPath(study, 0, 0, 'keep', 40)!;
    expect(findingSentence(path)).toContain(`(n = ${path.n}, p = ${path.p.toFixed(3)}).`);
  });
});

describe('display units', () => {
  it('are a linear map, so no p-value can depend on them', () => {
    expect(display(0, MEASURES[0]!)).toBe(380);
    expect(display(1, MEASURES[0]!)).toBe(425);
    expect(display(-1, MEASURES[1]!)).toBe(80);
  });
});
