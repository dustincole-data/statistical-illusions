/**
 * Illusion 03 · The Positive — THE RULE SET.
 *
 * Base-rate neglect with no interface attached: three numbers a person would
 * call a test's quality, the closed-form probability they imply, and the
 * thousand countable people that probability is really about. `the-positive.ts`
 * is the controller that draws it; this file is what the tests and the
 * verification gate run against, because the numbers are the credential and a
 * number that only exists inside a DOM handler cannot be pinned.
 *
 * There is no RNG here and none is possible: the whole claim is that a fixed,
 * deterministic layout of one thousand individuals — no sampling, no seed —
 * already contains the surprise. Nothing below touches `document`, `location`,
 * or `Math.random`.
 *
 * §4.3(a) is a CORRECTNESS constraint, not a style note: the reader counts the
 * individuals, so the integer breakdown is the single source of truth and the
 * human-facing answer is stated as a natural frequency ("about 1 in 6"), never
 * as a bare decimal set beside the array to be re-normalised.
 */

// ── the three numbers that design a test ─────────────────────────────────────

export interface TestDesign {
  /** Prevalence: the share of the screened population who are actually sick. */
  prev: number;
  /** Sensitivity: of the sick, the share the test catches. */
  sens: number;
  /** Specificity: of the healthy, the share the test correctly clears. */
  spec: number;
}

/**
 * The reader arrives here: a test they would happily call excellent — it
 * catches 95 of every 100 sick and clears 95 of every 100 healthy — pointed at
 * a population where the disease is rare. Every dial is defensible; the answer
 * is still not what anyone expects. That is the operator conversion (§1.3).
 */
export const DEFAULT: TestDesign = { prev: 0.01, sens: 0.95, spec: 0.95 };

/** Slider ranges, as fractions. Prevalence reaches high enough to find the rescue. */
export const RANGE = {
  prev: { min: 0.001, max: 0.2 },
  sens: { min: 0.5, max: 0.99 },
  spec: { min: 0.5, max: 0.99 },
} as const;

// ── the closed form ──────────────────────────────────────────────────────────

/**
 * Positive predictive value: given a positive result, the probability the
 * condition is present. One line of Bayes, and the whole exhibit.
 *
 *   PPV = (prev · sens) / (prev · sens + (1 − prev) · (1 − spec))
 *
 * The denominator is the point: (1 − prev) is enormous when the disease is
 * rare, so even a small false-positive rate (1 − spec) sends up more positives
 * than the sick group ever could.
 */
export function ppv(d: TestDesign): number {
  const tp = d.prev * d.sens;
  const fp = (1 - d.prev) * (1 - d.spec);
  return tp === 0 && fp === 0 ? 0 : tp / (tp + fp);
}

/**
 * The prevalence at which a given test reaches a target PPV, closed-form (the
 * root of the same line, not a search). For the 95/95 test the 50% crossover
 * is exactly 5% prevalence: below it, most positives are wrong.
 */
export function prevalenceForPPV(target: number, sens: number, spec: number): number {
  const b = 1 - spec; // false-positive rate
  return (target * b) / (sens * (1 - target) + target * b);
}

// ── the thousand countable people ────────────────────────────────────────────

export interface Freq {
  N: number;
  sick: number;
  healthy: number;
  /** Sick and flagged. */
  truePos: number;
  /** Sick and cleared (the miss). */
  falseNeg: number;
  /** Healthy and flagged (the false alarm). */
  falsePos: number;
  /** Healthy and cleared. */
  trueNeg: number;
  /** Everyone the test flags. */
  flagged: number;
  /** PPV as the reader would count it: truePos / flagged. */
  ppvInt: number;
}

/**
 * The integer natural-frequency breakdown of a test over `N` people. Rounded to
 * whole individuals because the reader counts them, and the four groups are
 * reconstructed so they always sum to exactly `N` (no drift from independent
 * rounding). This is what the icon array draws and what the reader tallies, so
 * the ratio on screen and the number in the readout can never disagree.
 */
export function frequencies(d: TestDesign, N = 1000): Freq {
  const sick = Math.round(d.prev * N);
  const healthy = N - sick;
  const truePos = Math.round(sick * d.sens);
  const falseNeg = sick - truePos;
  const falsePos = Math.round(healthy * (1 - d.spec));
  const trueNeg = healthy - falsePos;
  const flagged = truePos + falsePos;
  return {
    N,
    sick,
    healthy,
    truePos,
    falseNeg,
    falsePos,
    trueNeg,
    flagged,
    ppvInt: flagged === 0 ? 0 : truePos / flagged,
  };
}

// ── formatting ───────────────────────────────────────────────────────────────

/** A whole-number percent, e.g. `0.161` → `16%`. */
export const fmtPct = (x: number): string => `${Math.round(x * 100)}%`;

/**
 * The natural-frequency phrasing, e.g. 10 of 60 flagged → `about 1 in 6`. The
 * "1 in N" form is the whole register of this exhibit, and it is cleanest where
 * the exhibit lives, at low predictive value. Above a coin flip it degenerates
 * (1 in 1 reads like a bug), so the rare rescue case is named in words instead.
 */
export function oneIn(f: Freq): string {
  if (f.truePos === 0) return 'none of them';
  const n = Math.round(f.flagged / f.truePos);
  return n <= 1 ? 'nearly all of them' : `about 1 in ${n}`;
}

// ── what the reader commits to, and what the reveal states ────────────────────

/**
 * The finding, stated the way it should be read: as a count of people, not a
 * probability. Generated from the reader's own test so the reveal is theirs.
 * Kept free of em dashes, like every rendered string in the anthology.
 */
export function findingSentence(d: TestDesign, N = 1000): string {
  const f = frequencies(d, N);
  if (f.flagged === 0) return 'Your test flagged no one at all, so there is nothing to be right or wrong about.';
  if (f.truePos === 0)
    return `Of the ${f.flagged} people your test flagged, none actually had the condition.`;
  return (
    `Of the ${f.flagged} people your test flagged, ${f.truePos} actually had the condition. ` +
    `That is ${oneIn(f)}.`
  );
}

// ── the real-mammography beat, quoted verbatim (protected) ───────────────────

/**
 * Gigerenzer's published problem, and the natural-frequency translation he
 * teaches. His own rounding uses a 9% false-positive rate and lands on 9 of 98,
 * about 1 in 10. Quoted, not paraphrased, so it matches what his doctors saw.
 * The spelling is Graboys, though much of the literature prints "Grayboys".
 */
export const GIGERENZER = {
  design: { prev: 0.01, sens: 0.9, spec: 0.91 } as TestDesign, // 9% false-positive rate
  problem:
    'The probability that a woman has breast cancer is 1% (prevalence). If a woman has breast ' +
    'cancer, the probability that she tests positive is 90% (sensitivity). If a woman does not have ' +
    'breast cancer, the probability that she nevertheless tests positive is 9% (false-positive rate).',
  naturalFrequency:
    'Ten out of every 1,000 women have breast cancer. Of these 10 women with breast cancer, 9 test ' +
    'positive. Of the 990 women without cancer, about 89 nevertheless test positive.',
  /** 160 gynaecologists, a 2007 continuing-education session. */
  doctorsBefore: 21, // percent who gave the best answer; the rest mostly said 90% or 81%
  doctorsAfter: 87, // percent, once taught to translate into natural frequencies
} as const;

// ── the honest caveats, and the guardrail that is not negotiable ─────────────

/**
 * The honest effect size (§4.3b): natural frequencies help a great deal and are
 * still not a cure. McDowell & Jacobs's meta-analysis, 226 estimates across 35
 * articles, puts the correct-answer rate at 24% with counts against 4% with
 * probabilities. Six-fold, and three quarters of people still get it wrong.
 */
export const EFFECT_SIZE = { withFrequencies: 24, withProbabilities: 4 } as const;

/**
 * The one line that closes the only real harm surface in the anthology (§4.4).
 * Rendered with a semicolon in place of a dash, like the rest of the piece.
 */
export const GUARDRAIL =
  'Nothing here says do not get screened; it says know what a positive result is telling you.';
