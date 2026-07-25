import { describe, expect, it } from 'vitest';
import {
  ARMOR_BUDGET,
  CAVEAT,
  NO_ARMOR,
  PROVENANCE,
  WALD,
  ZONES,
  type ZoneKey,
  armorOf,
  platesUsed,
  simulateFleet,
} from '../src/scripts/the-missing-planes.model';

const KEYS: ZoneKey[] = ['fuselage', 'wings', 'tail', 'engine'];
const seedOf = (i: number) => i + 1;

describe('the seeded fleet', () => {
  it('is reproducible, which is what makes a shared ?seed= honest', () => {
    const a = simulateFleet(12345, NO_ARMOR);
    const b = simulateFleet(12345, NO_ARMOR);
    expect(a).toEqual(b);
  });

  it('reproduces the published §8.5 fleet exactly at seed 7', () => {
    // The design asset's verified probe (03-feasibility.mjs, planes(7)) IS the
    // source of the §8.5 table. Byte-for-byte agreement is the credential: a
    // browser with no dataset reproduces the published damage maps.
    const f = simulateFleet(7, NO_ARMOR);
    expect(f.hitsAll).toEqual({ fuselage: 370, wings: 368, tail: 142, engine: 96 });
    expect(f.hitsHome).toEqual({ fuselage: 228, wings: 239, tail: 63, engine: 10 });
    expect(f.returned).toBe(249);
    expect(f.downed).toBe(151);
  });

  it('keeps every fleet internally consistent, at any seed', () => {
    for (let i = 0; i < 40; i++) {
      const f = simulateFleet(seedOf(i), NO_ARMOR);
      expect(f.returned + f.downed).toBe(f.n);
      expect(f.survival).toBeGreaterThanOrEqual(0);
      expect(f.survival).toBeLessThanOrEqual(1);
      for (const k of KEYS) {
        expect(f.hitsHome[k]).toBeLessThanOrEqual(f.hitsAll[k]); // survivors are a subset
        expect(f.hitsAll[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('the illusion, as an invariant', () => {
  it('makes the survivors map show the engine as the safest zone', () => {
    // On every fleet, the engine takes the fewest hits AMONG RETURNERS — the map
    // the reader is handed says the engine is the least of their worries.
    for (const s of [7, 1, 2, 3, 42, 100]) {
      const h = simulateFleet(s, NO_ARMOR).hitsHome;
      const engineIsMin = KEYS.every((k) => k === 'engine' || h.engine <= h[k]);
      expect(engineIsMin).toBe(true);
    }
  });

  it('hides engine damage far more than any other zone (all ÷ home)', () => {
    // The precise statement of survivorship bias here: the survivors' map
    // understates the engine by ~10×, and every other zone by under ~3×.
    for (const s of [7, 1, 2, 3, 42]) {
      const f = simulateFleet(s, NO_ARMOR);
      const ratio = (k: ZoneKey) => f.hitsAll[k] / Math.max(1, f.hitsHome[k]);
      expect(ratio('engine')).toBeGreaterThanOrEqual(4);
      for (const k of KEYS)
        if (k !== 'engine') expect(ratio(k)).toBeLessThan(3.2);
    }
  });
});

describe('the armor the reader places', () => {
  it('counts plates and starts from a bare plane', () => {
    expect(platesUsed(NO_ARMOR)).toBe(0);
    expect(platesUsed(armorOf('engine'))).toBe(1);
    expect(platesUsed(armorOf('engine', 'tail'))).toBe(2);
    expect(ARMOR_BUDGET).toBe(2);
  });

  it('never changes the hits, only who survives them (the counterfactual)', () => {
    // Same planes, same hits, different armor: the population map is invariant to
    // what the reader plates. This is what lets the reveal land on their own map.
    const bare = simulateFleet(99, NO_ARMOR).hitsAll;
    for (const load of [armorOf('engine'), armorOf('wings', 'fuselage'), armorOf('engine', 'tail')]) {
      expect(simulateFleet(99, load).hitsAll).toEqual(bare);
    }
  });

  it('rewards armoring the lethal-but-invisible zones over the riddled ones', () => {
    // Mean survival over a batch, so the ordering is structural, not one seed's
    // luck. Armoring the engine (which the survivors' map hides) beats armoring
    // the wings and fuselage (where the visible holes are), which beats nothing.
    const meanSurvival = (load: Parameters<typeof simulateFleet>[1], batch = 500) => {
      let s = 0;
      for (let i = 0; i < batch; i++) s += simulateFleet(seedOf(i), load).survival;
      return s / batch;
    };
    const none = meanSurvival(NO_ARMOR);
    const naive = meanSurvival(armorOf('wings', 'fuselage'));
    const correct = meanSurvival(armorOf('engine', 'tail'));
    const engineOnly = meanSurvival(armorOf('engine'));
    expect(correct).toBeGreaterThan(naive);
    expect(naive).toBeGreaterThan(none);
    // even one engine plate beats two plates on the visible holes
    expect(engineOnly).toBeGreaterThan(naive);
  });
});

describe("Wald's baked worked example", () => {
  it('is internally consistent and pins his estimate', () => {
    expect(WALD.returningByHits).toHaveLength(6); // 0..5 hits
    expect(WALD.returningByHits.reduce((a, b) => a + b, 0)).toBe(WALD.returned);
    expect(WALD.flew - WALD.returned).toBe(WALD.downed);
    expect(WALD.qHat).toBe(0.851);
  });
});

describe('the rendered strings', () => {
  it('carry no em dash (the anthology sweep)', () => {
    expect(PROVENANCE).not.toContain('—');
    expect(CAVEAT).not.toContain('—');
  });

  it('keeps the four zones summing to one share of hits', () => {
    expect(ZONES.reduce((a, z) => a + z.share, 0)).toBeCloseTo(1, 12);
  });
});
