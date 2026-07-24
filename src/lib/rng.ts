/**
 * Seeded pseudo-randomness. Illusion-agnostic: Illusion 04 draws its
 * population of aircraft from this same generator.
 *
 * Every number in this piece is computed in the reader's browser, which means
 * every number has to be reproducible from a seed the reader can see, share,
 * and check. `mulberry32` is four lines, has no dependencies, and is stable
 * across engines — that is the entire requirement. Nothing here may ever
 * consult `Math.random` except when minting a brand new seed.
 */

/**
 * A uniform [0, 1) stream, deterministic in `seed`.
 *
 * The consumption ORDER of this stream is load-bearing: the verification gate
 * asserts exact golden values, so anything that reorders or inserts a draw
 * silently changes every published figure on the site.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller. One standard normal per call, consuming two uniforms. */
export function standardNormal(rnd: () => number): number {
  const u = 1 - rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * The reader's seed, read from `?seed=` or minted fresh and written back.
 *
 * THE SEED IS NEVER CURATED. A visit with no seed draws a random one, so the
 * study is reproducible and shareable but never chosen for being hackable.
 * Shipping a known-cooperative default seed would be precisely the sin
 * Illusion 01 indicts, committed in production by the piece itself.
 */
export function seedFromUrl(): number {
  const fromUrl = Number.parseInt(new URL(location.href).searchParams.get('seed') ?? '', 10);
  if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;

  const fresh = Math.floor(Math.random() * 1e9);
  try {
    const url = new URL(location.href);
    url.searchParams.set('seed', String(fresh));
    history.replaceState(null, '', url);
  } catch {
    /* a blocked history write costs the shareable URL, nothing else */
  }
  return fresh;
}
