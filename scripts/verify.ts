/**
 * THE REPRODUCTION GATE. `npm run verify`, and `npm run build` will not
 * proceed without it.
 *
 * The load-bearing claim of this piece is that a browser with no dataset and
 * no server behind it independently reproduces a published result. Ticket 06
 * established that offline, in a throwaway script; this runs the SAME
 * assertions against the code that actually ships, so the two can never drift
 * apart quietly. A wrong degrees-of-freedom or a trim off by one yields
 * numbers that still look entirely plausible — which is exactly why this
 * cannot be a matter of reading the output and nodding.
 *
 * Two checks per row, and they do different jobs:
 *
 *   1. EXACT counts against pinned goldens. The simulation is seeded, so this
 *      is deterministic rather than flaky, and it fails on any change to the
 *      generator, the test, the knobs or the enumeration.
 *   2. The derived percentage against the figure THE PIECE PUBLISHES, with a
 *      stated tolerance. This is what stops a future re-pin from quietly
 *      walking a golden away from the claim it is supposed to support.
 *
 * Seeds 1..N here, deliberately not the `sweepSeed` family the browser runs
 * live. The reader's 600-study sweep is a small sample that shows its own
 * margin of error; the gate is the large one. Agreement between two different
 * seed families is worth more than agreement with itself.
 *
 * Run with VERIFY_PRINT=1 to see observed values without failing — the only
 * honest way to re-pin a golden after a deliberate change.
 */
import {
  THRESHOLD,
  anySignificantOneMeasure,
  comboCount,
  garden,
  makeStudy,
  preRegisteredHit,
  runPath,
  stopsFor,
  SUBGROUPS,
  MEASURES,
  OUTLIERS,
} from '../src/scripts/forking-paths.model';

const TRIALS_GARDEN = 4_000;
const TRIALS_SINGLE = 20_000;
const seedOf = (i: number) => i + 1;
const PRINT = process.env.VERIFY_PRINT === '1';

interface Row {
  label: string;
  hits: number;
  of: number;
  /** Pinned exact count. Deterministic; changes only on a deliberate re-pin. */
  golden: number;
  /** The figure the piece publishes, and how far the gate lets it wander. */
  claim: number;
  band: number;
}

const rows: Row[] = [];
const t0 = performance.now();

// ── the garden sweep ────────────────────────────────────────────────────────

let withAPath = 0;
const stuck: number[] = [];
for (let i = 0; i < TRIALS_GARDEN; i++) {
  const s = makeStudy(seedOf(i), 40);
  if (garden(s, 40).some((p) => p.p < THRESHOLD)) withAPath++;
  else stuck.push(i);
}

rows.push({
  label: '3 measures · at least one significant path',
  hits: withAPath,
  of: TRIALS_GARDEN,
  golden: 3679,
  claim: 92.0,
  band: 0.6,
});
rows.push({
  label: 'no significant path anywhere at n = 40',
  hits: stuck.length,
  of: TRIALS_GARDEN,
  golden: 321,
  claim: 8.2,
  band: 0.6,
});

// ── one measure only: the 2011 paper, reproduced ────────────────────────────

let oneMeasure = 0;
let preRegistered = 0;
for (let i = 0; i < TRIALS_SINGLE; i++) {
  const s = makeStudy(seedOf(i), 40);
  if (anySignificantOneMeasure(s, 40)) oneMeasure++;
  if (preRegisteredHit(s, 40)) preRegistered++;
}

rows.push({
  label: 'one measure only — against a published 60.7%',
  hits: oneMeasure,
  of: TRIALS_SINGLE,
  golden: 11813,
  claim: 59.7,
  band: 1.0,
});
rows.push({
  label: 'a single path fixed in advance — nominal 5%',
  hits: preRegistered,
  of: TRIALS_SINGLE,
  golden: 949,
  claim: 4.7,
  band: 0.6,
});

// ── the rescue rates behind "collect 10 more subjects" ──────────────────────

const rescued: Record<number, number> = { 50: 0, 60: 0, 70: 0 };
for (const i of stuck) {
  let found = false;
  for (const n of [50, 60, 70]) {
    if (!found && garden(makeStudy(seedOf(i), n), n).some((p) => p.p < THRESHOLD)) found = true;
    if (found) rescued[n]!++;
  }
}
const RESCUE_GOLDEN: Record<number, { golden: number; claim: number }> = {
  50: { golden: 139, claim: 41 },
  60: { golden: 202, claim: 62 },
  70: { golden: 240, claim: 75 },
};
for (const n of [50, 60, 70]) {
  rows.push({
    label: `uncooperative samples rescued by n = ${n}`,
    hits: rescued[n]!,
    of: stuck.length,
    golden: RESCUE_GOLDEN[n]!.golden,
    claim: RESCUE_GOLDEN[n]!.claim,
    band: 3.0,
  });
}

// ── structural assertions: the enumeration itself ───────────────────────────

const failures: string[] = [];

const combos = comboCount(40);
if (combos !== 252) failures.push(`enumeration: ${combos} combinations at n = 40, expected 252`);
if (MEASURES.length !== 3 || SUBGROUPS.length !== 7 || OUTLIERS.length !== 3)
  failures.push('enumeration: the knob set moved');
if (stopsFor(40).join() !== '40,34,30,24')
  failures.push(`enumeration: stopping points are ${stopsFor(40).join()}`);

/**
 * Untestable combinations must be untestable FOR THE RIGHT REASON. The exhibit
 * states this subtraction out loud rather than rounding it away, so the reason
 * has to be true: fewer than three subjects in one of the two arms, never a
 * thrown error or a silent NaN.
 */
let droppedChecked = 0;
for (let i = 0; i < 200; i++) {
  const s = makeStudy(seedOf(i), 40);
  for (let k = 0; k < MEASURES.length; k++)
    for (let sub = 0; sub < SUBGROUPS.length; sub++)
      for (const o of OUTLIERS)
        for (const stop of stopsFor(40)) {
          if (runPath(s, k, sub, o.key, stop)) continue;
          droppedChecked++;
          const kept = s.slice(0, stop).filter(SUBGROUPS[sub]!.f);
          const nap = kept.filter((d) => d.arm === 1).length;
          const ctl = kept.filter((d) => d.arm === 0).length;
          if (nap >= 3 && ctl >= 3) {
            // the outlier rule can also take an arm under three; only a bare
            // pre-filter count of >= 3 in both arms AND a 'keep' rule is wrong
            if (o.key === 'keep')
              failures.push(
                `seed ${seedOf(i)} k${k}/sub${sub}/keep/stop${stop}: dropped with ${nap} and ${ctl} in arm`,
              );
          }
        }
}
if (droppedChecked === 0) failures.push('enumeration: no untestable path seen in 200 samples');

// ── report ──────────────────────────────────────────────────────────────────

const pct = (r: Row) => (100 * r.hits) / r.of;
const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

console.log(`\n  Reproduction gate — ${TRIALS_GARDEN} gardens, ${TRIALS_SINGLE} single-path trials\n`);
for (const r of rows) {
  const drift = r.hits !== r.golden;
  const wandered = Math.abs(pct(r) - r.claim) > r.band;
  const mark = drift || wandered ? '  FAIL' : '  ok  ';
  console.log(
    `${mark} ${pct(r).toFixed(1).padStart(5)}%  ${String(r.hits).padStart(6)}/${String(r.of).padEnd(6)} ` +
      `golden ${String(r.golden).padEnd(6)} claim ${r.claim}% ±${r.band}   ${r.label}`,
  );
  if (drift) failures.push(`${r.label}: got ${r.hits}/${r.of}, golden is ${r.golden}/${r.of}`);
  if (wandered)
    failures.push(
      `${r.label}: ${pct(r).toFixed(2)}% is outside ${r.claim}% ±${r.band} — the published claim no longer holds`,
    );
}
console.log(`\n  ${droppedChecked} untestable paths audited · ${elapsed}s\n`);

if (PRINT) {
  console.log('  VERIFY_PRINT — observed counts, for a deliberate re-pin:');
  for (const r of rows) console.log(`    ${r.label}: ${r.hits}`);
  console.log();
  process.exit(0);
}

if (failures.length) {
  console.error('  The numbers moved. This gate exists because that is not always visible:\n');
  for (const f of failures) console.error(`    · ${f}`);
  console.error(
    '\n  If the change was deliberate, re-run with VERIFY_PRINT=1 and re-pin the goldens\n' +
      '  in scripts/verify.ts — the claim bands will still hold you to the published figures.\n',
  );
  process.exit(1);
}

console.log('  The browser still reproduces the published result.\n');
