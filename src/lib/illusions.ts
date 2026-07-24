/**
 * The illusion registry — ONE array.
 *
 * Adding an illusion to the site is one entry here plus one page under
 * src/pages/. It is never a Shell.astro edit; if a new exhibit needs the
 * shell changed, the graduation contract broke (see README).
 *
 * Numbering is the author's route, NEVER a prerequisite chain. No exhibit
 * may reference another having been read. `live: false` entries appear in
 * the chrome list, unlinked, and are described in the hub essay as prose.
 */
export interface Illusion {
  /** Zero-padded position, as rendered. */
  number: string;
  /** Route slug, without a leading slash. */
  slug: string;
  /** Reader-facing name. The reader's word is "illusion", never "exhibit". */
  name: string;
  /** The thing absent from the table. Composed into the kicker. */
  mechanism: string;
  /** One-line premise, rendered as the Frame slot's lede. */
  lede?: string;
  /** Does the route exist yet? */
  live: boolean;
}

export const ILLUSIONS: Illusion[] = [
  {
    number: '01',
    slug: 'the-forking-paths',
    name: 'The Forking Paths',
    mechanism: 'MANUFACTURED SIGNIFICANCE',
    lede: 'You can pull a discovery out of nothing at all.',
    live: true,
  },
  {
    number: '02',
    slug: 'the-reversal',
    name: 'The Reversal',
    mechanism: 'A HIDDEN VARIABLE',
    lede: 'He is better every year, and he still loses.',
    live: true,
  },
  {
    number: '03',
    slug: 'the-positive',
    name: 'The Positive',
    mechanism: 'A FORGOTTEN BASE RATE',
    live: false,
  },
  {
    number: '04',
    slug: 'the-missing-planes',
    name: 'The Missing Planes',
    mechanism: 'AN UNCOUNTED POPULATION',
    live: false,
  },
];

/** `ILLUSION 01 · MANUFACTURED SIGNIFICANCE` — a protected string; see the spec. */
export const kickerOf = (i: Illusion) => `ILLUSION ${i.number} · ${i.mechanism}`;

export const bySlug = (slug: string) => ILLUSIONS.find((i) => i.slug === slug);

/** The next illusion in author order, if it has graduated. Otherwise nothing renders. */
export const nextLiveAfter = (slug: string) => {
  const at = ILLUSIONS.findIndex((i) => i.slug === slug);
  return at < 0 ? undefined : ILLUSIONS.slice(at + 1).find((i) => i.live);
};
