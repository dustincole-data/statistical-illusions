/**
 * The statistics core. Illusion-agnostic and dependency-free — Illusion 04
 * imports the same file.
 *
 * This module is the credential of the whole piece: the colophon claims every
 * number is computed in the reader's browser and viewable in source, so this
 * is the source it means. It is deliberately a transcription of textbook
 * numerical recipes rather than anything clever, and it is pinned against
 * published critical values by the test suite (see test/stats.test.ts).
 */

/** Lanczos approximation to log Γ(x), the standard 6-term coefficients. */
const LANCZOS = [
  76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
  0.1208650973866179e-2, -0.5395239384953e-5,
];

export function lgamma(x: number): number {
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += LANCZOS[j]! / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Continued-fraction expansion for the incomplete beta (Numerical Recipes). */
function betacf(a: number, b: number, x: number): number {
  const EPS = 3e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;

    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** The regularised incomplete beta function, I_x(a, b). */
export function ibeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed p-value for Student's t with `df` degrees of freedom. */
export const pFromT = (t: number, df: number): number => ibeta(df / 2, 0.5, df / (df + t * t));

export interface WelchResult {
  t: number;
  df: number;
  /** Two-tailed. */
  p: number;
  /** Mean of `a`, in whatever units `a` arrived in. */
  ma: number;
  /** Mean of `b`. */
  mb: number;
}

/**
 * Welch's two-sample t-test — unequal variances, unequal n, which is what the
 * subgroup knob produces on almost every path.
 */
export function welch(a: number[], b: number[]): WelchResult {
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const variance = (v: number[], mu: number) =>
    v.reduce((s, x) => s + (x - mu) ** 2, 0) / (v.length - 1);

  const ma = mean(a);
  const mb = mean(b);
  const sa = variance(a, ma);
  const sb = variance(b, mb);
  const se2 = sa / a.length + sb / b.length;

  const t = (ma - mb) / Math.sqrt(se2);
  const df =
    se2 ** 2 /
    ((sa / a.length) ** 2 / (a.length - 1) + (sb / b.length) ** 2 / (b.length - 1));

  return { t, df, p: pFromT(t, df), ma, mb };
}

/**
 * Half-width of the 95% normal-approximation interval for a proportion, in
 * percentage points.
 *
 * The exhibit renders this beside its own headline numbers on purpose: a piece
 * about overclaiming from small samples that hid the margin on its own six
 * hundred draws would deserve everything a hostile statistician did to it.
 */
export const marginOfError95 = (hits: number, n: number): number =>
  1.96 * Math.sqrt((hits / n) * (1 - hits / n) / n) * 100;

/** A proportion as a one-decimal percentage string. */
export const percent = (hits: number, n: number): string => `${((100 * hits) / n).toFixed(1)}%`;
