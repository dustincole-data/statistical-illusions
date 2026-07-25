/**
 * Illusion 04 · The Missing Planes — THE RULE SET.
 *
 * Survivorship bias with no interface attached: a fleet of bombers, each taking
 * a few hits, each downed or not by where those hits land, and the two damage
 * maps that fall out of it — the one you can see (the planes that came home) and
 * the one you cannot (every plane that flew). `the-missing-planes.ts` is the
 * controller that draws it; this file is what the tests and the verification
 * gate run against, because the numbers are the credential and a number that
 * only exists inside a DOM handler cannot be pinned.
 *
 * Nothing here touches `document`, `location`, or `Math.random`. The population
 * is generated from a seed the reader can see, so a shared URL reproduces a
 * reader's exact fleet — the same honesty the hero's seed buys.
 *
 * ⚠ THE MAP IS A SIMULATION. Wald's memoranda published no damage table, so any
 * bullet map the piece renders is ours. The generator below is the honest source
 * of that map; the exhibit says so in plain words (see PROVENANCE). The opposite
 * temptation — dressing generated data in 1943 provenance — is the trap here.
 */
import { mulberry32 } from '../lib/rng';

// ── the fleet's four zones ────────────────────────────────────────────────────

export type ZoneKey = 'fuselage' | 'wings' | 'tail' | 'engine';

export interface Zone {
  key: ZoneKey;
  name: string;
  /** Share of all hits that land here. The four sum to 1. */
  share: number;
  /** P(the plane is downed | a hit lands here). The hidden variable. */
  lethality: number;
}

/**
 * The verified §8.5 generator params (design asset `03-feasibility.mjs`). The
 * engine takes the fewest hits and is by far the most lethal when it does — which
 * is exactly why the survivors' map, drawn from the planes that lived, shows the
 * engine almost clean. Order is load-bearing: the zone draw walks this array.
 */
export const ZONES: Zone[] = [
  { key: 'fuselage', name: 'Fuselage', share: 0.4, lethality: 0.05 },
  { key: 'wings', name: 'Wings', share: 0.35, lethality: 0.1 },
  { key: 'tail', name: 'Tail', share: 0.15, lethality: 0.25 },
  { key: 'engine', name: 'Engines', share: 0.1, lethality: 0.85 },
];

// ── the armor the reader places ───────────────────────────────────────────────

export type Armor = Record<ZoneKey, boolean>;

/** No plate anywhere — the baseline the reader's loadout is measured against. */
export const NO_ARMOR: Armor = { fuselage: false, wings: false, tail: false, engine: false };

/** Armor is heavy. You cannot plate the whole plane; two zones is the budget. */
export const ARMOR_BUDGET = 2;

/**
 * What a plate does: it stops most, not all, of the otherwise-lethal hits in the
 * zone it covers. Free to tune — it changes how hard the reveal lands, never the
 * survivors' map (which is drawn unarmored), so the published §8.5 table is
 * invariant to it.
 */
export const ARMOR_FACTOR = 0.15;

/** Build a loadout from the zones to plate, e.g. `armorOf('engine', 'tail')`. */
export function armorOf(...keys: ZoneKey[]): Armor {
  const a: Armor = { fuselage: false, wings: false, tail: false, engine: false };
  for (const k of keys) a[k] = true;
  return a;
}

/** How many plates a loadout spends. The budget cap lives in the controller. */
export const platesUsed = (a: Armor): number =>
  (Object.values(a) as boolean[]).filter(Boolean).length;

// ── one fleet ─────────────────────────────────────────────────────────────────

export interface FleetResult {
  n: number;
  /** Hits across every plane that flew — the map nobody could see. */
  hitsAll: Record<ZoneKey, number>;
  /** Hits among the planes that came home — the map the reader is handed. */
  hitsHome: Record<ZoneKey, number>;
  returned: number;
  downed: number;
  /** returned / n, in [0, 1]. */
  survival: number;
}

const zero = (): Record<ZoneKey, number> => ({ fuselage: 0, wings: 0, tail: 0, engine: 0 });

/**
 * Simulate `n` bombers under a given armor loadout.
 *
 * Each plane takes k = 1 + floor(4·u) hits (1 to 4). Each hit lands in a zone
 * drawn by `share`, and independently downs the plane with that zone's
 * (armored) lethality. A plane returns iff none of its hits downed it; only then
 * do its hits enter the survivors' map.
 *
 * THE LETHALITY DRAW IS CONSUMED WHETHER OR NOT THE ZONE IS ARMORED — armor
 * changes the threshold it is compared against, never the draw itself. So
 * `simulateFleet(seed, X)` and `simulateFleet(seed, Y)` are the SAME planes
 * taking the SAME hits under different armor, which is the counterfactual the
 * reveal rests on: "these exact planes, had you plated differently." The RNG
 * consumption order (k, then per hit: zone, then lethality) is load-bearing; the
 * gate pins exact counts, so any reorder silently moves every published figure.
 */
export function simulateFleet(seed: number, armor: Armor, n = 400): FleetResult {
  const rnd = mulberry32(seed);
  const hitsAll = zero();
  const hitsHome = zero();
  let returned = 0;

  for (let i = 0; i < n; i++) {
    let downed = false;
    const mine: ZoneKey[] = [];
    const k = 1 + Math.floor(rnd() * 4);

    for (let h = 0; h < k; h++) {
      let u = rnd();
      let zone = ZONES[0]!;
      for (const z of ZONES) {
        if (u < z.share) {
          zone = z;
          break;
        }
        u -= z.share;
      }
      mine.push(zone.key);
      hitsAll[zone.key]++;
      const lethal = armor[zone.key] ? zone.lethality * ARMOR_FACTOR : zone.lethality;
      if (rnd() < lethal) downed = true;
    }

    if (!downed) {
      returned++;
      for (const z of mine) hitsHome[z]++;
    }
  }

  return { n, hitsAll, hitsHome, returned, downed: n - returned, survival: returned / n };
}

// ── what Wald actually did (§5) — baked, and labelled as his ──────────────────

/**
 * Wald's own worked example, from the reprint by way of Mangel & Samaniego and
 * Casselman. It is a HYPOTHETICAL illustration in his paper, not a real damage
 * table — the exhibit presents it as such. Eight numbers and one estimate: of
 * 400 planes, 380 came back; the returners carried 0..5 hits in these counts;
 * and from survivor damage alone he estimated the per-hit survival probability.
 */
export const WALD = {
  flew: 400,
  returned: 380,
  downed: 20,
  /** Returners carrying 0, 1, 2, 3, 4, 5 hits. Sums to 380. */
  returningByHits: [320, 32, 20, 4, 2, 2],
  /** His per-hit survival estimate, q̂. */
  qHat: 0.851,
} as const;

// ── the two lines the model owns, kept free of em dashes (anthology sweep) ─────

/**
 * The §5 provenance trap, closed in one sentence: the map is a simulation, and
 * the exhibit says so where the reader can see it.
 */
export const PROVENANCE =
  'This fleet is simulated in your browser from the seed in the address bar; ' +
  'Wald never published a damage table, so every bullet on this plane is ours, not a record of 1943.';

/**
 * Berger's honest caveat, which Wald agreed with: the estimator assumes the same
 * survival probability for every hit, and survivor-only data cannot check that
 * assumption. Rendered with a semicolon in place of a dash, like the rest.
 */
export const CAVEAT =
  'Wald leaned on one assumption his own data could not test: that every hit carries the same chance ' +
  'of downing the plane. Survivor damage alone can never check it, so he said to use the method only ' +
  'where that already holds.';
