/**
 * Illusion 01 · The Forking Paths — THE RULE SET.
 *
 * This is the illusion, with no interface attached: the study generator, the
 * four knobs, the enumeration of the garden, and the sentence a reader
 * publishes. `forking-paths.ts` is the controller that draws it; this file is
 * what the tests and the verification gate run against, because the numbers
 * are the credential and a number that only exists inside a DOM handler cannot
 * be pinned.
 *
 * Nothing here touches `document`, `location`, or `Math.random`.
 */
import { mulberry32, standardNormal } from '../lib/rng';
import { welch } from '../lib/stats';

/** The convention on trial. Not a law — see the Frame slot's sidenote. */
export const THRESHOLD = 0.05;

// ── the study ───────────────────────────────────────────────────────────────

export interface Subject {
  /** 1-based, as printed in the Setup table. */
  i: number;
  /** 1 = took the nap, 0 = sat quietly with a magazine. */
  arm: 0 | 1;
  /** The three outcome measures, in standard units. Correlated at about r = .5. */
  ys: number[];
  sex: 0 | 1;
  old: 0 | 1;
  rested: 0 | 1;
  /** Display only. Never enters a test. */
  age: number;
  /** Display only. Never enters a test. */
  slept: number;
}

/**
 * Forty adults with THE TRUE DIFFERENCE SET TO EXACTLY ZERO.
 *
 * Three measures of one construct, correlated at about r = .5 the way real
 * measures of one construct are — `.7 * common + .714 * noise`. The reader is
 * told all of this at Setup before touching a knob, because the illusion has
 * to survive full disclosure or it is a jump scare instead of an argument.
 *
 * Growing `n` extends the same sample rather than redrawing it: subject `i`
 * always consumes the same eleven draws in the same order, so
 * `makeStudy(seed, 50)` opens with the forty subjects of `makeStudy(seed, 40)`.
 * That is what makes "collect 10 more subjects" an honest continuation.
 */
export function makeStudy(seed: number, n: number): Subject[] {
  const rnd = mulberry32(seed);
  const subjects: Subject[] = [];

  for (let i = 0; i < n; i++) {
    const common = standardNormal(rnd);
    const ys: number[] = [];
    for (let k = 0; k < 3; k++) ys.push(0.7 * common + 0.714 * standardNormal(rnd));
    subjects.push({
      i: i + 1,
      arm: (i % 2) as 0 | 1,
      ys,
      sex: rnd() < 0.5 ? 0 : 1,
      old: rnd() < 0.5 ? 0 : 1,
      rested: rnd() < 0.5 ? 0 : 1,
      age: 0,
      slept: 0,
    });
  }

  // Intake attributes, on their own stream so they can never perturb an outcome.
  const rnd2 = mulberry32(seed ^ 0x5f3759df);
  for (const d of subjects) {
    d.age = d.old ? 30 + Math.floor(rnd2() * 24) : 19 + Math.floor(rnd2() * 11);
    d.slept = d.rested ? 7 + Math.round(rnd2() * 20) / 10 : 4.5 + Math.round(rnd2() * 24) / 10;
  }
  return subjects;
}

// ── the four knobs ──────────────────────────────────────────────────────────

export interface Measure {
  name: string;
  unit: string;
  /** Display centre. A linear map, so no p-value depends on it. */
  mu: number;
  /** Display spread. Also linear, also irrelevant to every test. */
  sd: number;
  dec: number;
  lowerBetter: boolean;
  /** [what a good result did, what a bad result did]. The verb is computed. */
  verb: [string, string];
}

export const MEASURES: Measure[] = [
  {
    name: 'reaction time',
    unit: 'ms',
    mu: 380,
    sd: 45,
    dec: 0,
    lowerBetter: true,
    verb: ['improved', 'slowed'],
  },
  { name: 'accuracy', unit: '%', mu: 86, sd: 6, dec: 1, lowerBetter: false, verb: ['raised', 'lowered'] },
  { name: 'alertness', unit: 'pts', mu: 4.4, sd: 1.1, dec: 1, lowerBetter: false, verb: ['raised', 'lowered'] },
];

/** Standard units to the units the reader reads. Linear, therefore inert. */
export const display = (z: number, m: Measure): number => m.mu + m.sd * z;

export interface Subgroup {
  /** How the finding sentence names it: "Among men, …". */
  name: string;
  /** How the knob labels it. */
  label: string;
  f: (d: Subject) => boolean;
}

export const SUBGROUPS: Subgroup[] = [
  { name: 'everyone', label: 'Everyone', f: () => true },
  { name: 'women', label: 'Women only', f: (d) => d.sex === 1 },
  { name: 'men', label: 'Men only', f: (d) => d.sex === 0 },
  { name: 'adults 30+', label: 'Aged 30 and over', f: (d) => d.old === 1 },
  { name: 'adults under 30', label: 'Aged under 30', f: (d) => d.old === 0 },
  { name: 'well-rested subjects', label: 'Slept 7h or more', f: (d) => d.rested === 1 },
  { name: 'sleep-deprived subjects', label: 'Slept under 7h', f: (d) => d.rested === 0 },
];

export type OutlierKey = 'keep' | 'sd2' | 'trim';

export const OUTLIERS: { key: OutlierKey; label: string }[] = [
  { key: 'keep', label: 'Keep everyone' },
  { key: 'sd2', label: 'Drop beyond 2 SD' },
  { key: 'trim', label: 'Trim fastest & slowest 2.5%' },
];

export function applyOutlierRule(d: Subject[], k: number, rule: OutlierKey): Subject[] {
  if (rule === 'keep') return d;

  if (rule === 'sd2') {
    const mu = d.reduce((a, x) => a + x.ys[k]!, 0) / d.length;
    const sd = Math.sqrt(d.reduce((a, x) => a + (x.ys[k]! - mu) ** 2, 0) / (d.length - 1));
    return d.filter((x) => Math.abs((x.ys[k]! - mu) / sd) <= 2);
  }

  // Symmetric percentile trim — the rule that makes the cutoff survey literal.
  const sorted = [...d].sort((a, b) => a.ys[k]! - b.ys[k]!);
  const c = Math.max(1, Math.round(d.length * 0.025));
  return sorted.slice(c, sorted.length - c);
}

/**
 * Where a reader might have stopped collecting: the planned end, three earlier
 * peeks, and every ten from fifty up once the sample has grown that far.
 */
export const stopsFor = (n: number): number[] => {
  const s = [n, Math.round(n * 0.85), Math.round(n * 0.75), Math.round(n * 0.6)];
  for (let m = 50; m <= n; m += 10) if (!s.includes(m)) s.push(m);
  return [...new Set(s)].sort((a, b) => b - a);
};

// ── walking the garden ──────────────────────────────────────────────────────

export interface Path {
  k: number;
  sub: number;
  out: OutlierKey;
  stop: number;
  p: number;
  /** Subjects surviving the subgroup filter and the outlier rule. */
  n: number;
  /** Nap-arm mean, standard units. */
  ma: number;
  /** Control-arm mean, standard units. */
  mb: number;
}

/**
 * One analysis. `null` when the filters leave fewer than three subjects in an
 * arm — the honest reason a combination is untestable, and the one the Reveal
 * states out loud rather than rounding away.
 */
export function runPath(
  s: Subject[],
  k: number,
  sub: number,
  rule: OutlierKey,
  stop: number,
): Path | null {
  const d = applyOutlierRule(s.slice(0, stop).filter(SUBGROUPS[sub]!.f), k, rule);
  const a = d.filter((x) => x.arm === 1).map((x) => x.ys[k]!);
  const b = d.filter((x) => x.arm === 0).map((x) => x.ys[k]!);
  if (a.length < 3 || b.length < 3) return null;

  const w = welch(a, b);
  return { k, sub, out: rule, stop, p: w.p, n: a.length + b.length, ma: w.ma, mb: w.mb };
}

/** Every testable analysis of one sample. Enumeration order is load-bearing. */
export function garden(s: Subject[], n: number): Path[] {
  const out: Path[] = [];
  for (let k = 0; k < MEASURES.length; k++)
    for (let sub = 0; sub < SUBGROUPS.length; sub++)
      for (const o of OUTLIERS)
        for (const stop of stopsFor(n)) {
          const r = runPath(s, k, sub, o.key, stop);
          if (r) out.push(r);
        }
  return out;
}

/** Combinations attempted, testable or not. The Reveal shows the subtraction. */
export const comboCount = (n: number): number =>
  MEASURES.length * SUBGROUPS.length * OUTLIERS.length * stopsFor(n).length;

/** Did any path in this sample cross the line? The headline question. */
export const anySignificant = (paths: Path[]): boolean => paths.some((p) => p.p < THRESHOLD);

// ── what the reader publishes ───────────────────────────────────────────────

/**
 * The finding, in the register of an abstract, generated from the reader's own
 * four settings.
 *
 * THE VERB IS COMPUTED, not fixed. Noise has a random direction, so roughly
 * half of all published findings here say the nap made people worse — honest,
 * quietly damning, and free.
 */
export function findingSentence(path: Path): string {
  const m = MEASURES[path.k]!;
  const sg = SUBGROUPS[path.sub]!;
  const dm = display(path.ma, m) - display(path.mb, m); // nap minus control, display units
  const better = m.lowerBetter ? dm < 0 : dm > 0;
  const verb = better ? m.verb[0] : m.verb[1];
  const magnitude = Math.abs(dm).toFixed(m.dec);
  const where = path.sub === 0 ? 'In a sample of forty adults' : 'Among ' + sg.name;
  return (
    `${where}, a twenty-minute nap ${verb} ${m.name} by ${magnitude} ${m.unit} ` +
    `(n = ${path.n}, p = ${path.p.toFixed(3)}).`
  );
}

// ── the justifications ──────────────────────────────────────────────────────

/**
 * Every knob option carries a REAL PUBLISHED JUSTIFICATION. That pairing is
 * the argument of the whole piece, not decoration: the reason is one a careful
 * person would give, and the citation beneath it is what the reason costs.
 *
 * They render in a persistent panel rather than tooltips — tooltips die on
 * touch, the cutoff-survey quotation is far too long for one, and a panel
 * means no choice is ever made without a citation sitting beside it.
 */
export interface Justification {
  /** Plain text. The reason a careful person would give. */
  reason: string;
  /** Trusted inline markup, authored here. What the reason costs. */
  cost: string;
}

export const JUSTIFICATIONS: Record<string, Justification> = {
  'measure:0': {
    reason:
      'Reaction time is the standard objective index of alertness; self-report is known to be unreliable in sleep-deprived subjects.',
    cost: 'Simmons et al. Table 1: <b>two dependent variables correlated at r = .50 raise the false-positive rate to 9.5%</b> on their own. Collecting several measures of one construct is normal practice; reporting the one that behaved is where it turns.',
  },
  'measure:1': {
    reason:
      'Accuracy guards against a speed–accuracy tradeoff: a subject who simply responds faster and wronger would look improved on reaction time alone.',
    cost: 'Simmons et al. Table 1: <b>two dependent variables correlated at r = .50 raise the false-positive rate to 9.5%</b> on their own.',
  },
  'measure:2': {
    reason:
      'Self-rated alertness measures the thing the intervention is actually for. A nap that shortens reaction time by 4 ms but leaves people feeling wrecked has not worked.',
    cost: 'Simmons et al. Table 1: <b>two dependent variables correlated at r = .50 raise the false-positive rate to 9.5%</b> on their own.',
  },
  'sub:0': {
    reason: 'No subsetting. The pre-specified comparison, on everyone who took part.',
    cost: 'This is the only one of the seven that requires no justification at all — which is precisely why it is rarely the one reported.',
  },
  'sub:1': {
    reason:
      'Sleep research reports sex differences in homeostatic sleep pressure and in recovery from restriction, so analysing women separately is routine.',
    cost: 'Simmons et al. Table 1: <b>controlling for gender, or for gender × treatment, raises the false-positive rate to 11.7%</b> — the single largest of their four measured degrees of freedom.',
  },
  'sub:2': {
    reason:
      'The same literature supports analysing men separately; whichever group is reported, the justification is symmetric.',
    cost: 'Simmons et al. Table 1: <b>gender or gender × treatment → 11.7%</b>. Note that “we analysed men and women separately” and “we analysed women” are the same decision, disclosed differently.',
  },
  'sub:3': {
    reason:
      'Nap benefit is strongly age-moderated; older adults show different slow-wave dynamics, so pooling ages can mask a real effect.',
    cost: 'A moderator with genuine literature behind it doubles as a licence to split the sample. Gelman &amp; Loken’s point exactly: the choice is contingent on the data, not on fraud.',
  },
  'sub:4': {
    reason:
      'Younger adults have the largest reported nap effects, so restricting to them is the higher-powered test of the hypothesis.',
    cost: '“Higher-powered test of the hypothesis” is a real methodological argument and a real forking path at the same time.',
  },
  'sub:5': {
    reason:
      'A nap cannot restore what was not lost. Subjects who slept normally have little room to improve, so including them dilutes the effect.',
    cost: 'Every one of these seven has appeared as a reported subgroup in the sleep literature. None is incorrect.',
  },
  'sub:6': {
    reason:
      'Sleep debt determines how much a nap can restore, so the deprived group is where the effect should be largest.',
    // Protected verbatim through the voice pass. The cheapest, sharpest line here.
    cost: 'Note that this justification and the one above it are opposites, and both are publishable.',
  },
  'out:keep': {
    reason: 'No exclusions. Every observation collected is analysed.',
    cost: 'The honest default — and the one that most often fails to produce a result.',
  },
  'out:sd2': {
    reason:
      'Responses more than two standard deviations from the mean are conventionally treated as lapses of attention rather than measurements of the task.',
    cost: 'Simmons et al. surveyed ~30 <i>Psychological Science</i> articles and found “too fast” defined as <b>the fastest 2.5%, or more than 2 SD from the mean, or faster than 100, 150, 200, or 300 ms</b>; “too slow” as <b>the slowest 2.5% or 10%, or 2, 2.5, or 3 SD, or slower than 1,000, 1,200, 1,500, 2,000, 3,000, or 5,000 ms</b>.',
  },
  'out:trim': {
    reason:
      'Symmetric percentile trimming removes anticipations at one end and lapses at the other without assuming the distribution is normal.',
    cost: 'Their verdict on the whole list: <b>“None of these decisions is necessarily incorrect, but that fact makes any of them justifiable.”</b>',
  },
  stop: {
    reason:
      'You watched the numbers come in and stopped when the pattern looked clear. Nobody stops a study at a moment chosen by lottery.',
    cost: 'Simmons et al.: testing after every new observation from n = 10 to n = 50 yields a <b>22%</b> false-positive rate from optional stopping alone.',
  },
};

// ── the sweep the Reveal and the Repair both run ────────────────────────────

/**
 * The seed family for every simulated cohort of studies.
 *
 * The browser sweep and the verification gate use the SAME family, so the gate
 * reproduces the numbers a reader actually sees rather than a private set of
 * its own.
 */
export const sweepSeed = (i: number): number => 1e6 + i * 7919;

/** The one-measure garden — the 2011 paper's simulation, reproduced. */
export function anySignificantOneMeasure(s: Subject[], n: number): boolean {
  for (let sub = 0; sub < SUBGROUPS.length; sub++)
    for (const o of OUTLIERS)
      for (const stop of stopsFor(n)) {
        const r = runPath(s, 0, sub, o.key, stop);
        if (r && r.p < THRESHOLD) return true;
      }
  return false;
}

/** The path fixed in advance, before the data existed. The Repair. */
export function preRegisteredHit(s: Subject[], n: number): boolean {
  const r = runPath(s, 0, 0, 'keep', n);
  return !!r && r.p < THRESHOLD;
}
