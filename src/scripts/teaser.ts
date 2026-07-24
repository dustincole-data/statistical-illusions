/**
 * The hub teaser — Illusion 01's figure in garden mode, and nothing else.
 *
 * One control. No knobs, no justification panel, no counters, no Commit, no
 * Repair, no Debrief. Committing to a false finding is the exhibit's job and
 * must not be spent on the landing page, so the teaser shows only the garden:
 * every analysis of one study with nothing in it, and how many crossed.
 *
 * The sample is never curated. Each press takes a fresh random seed and draws
 * whatever it gives, which is the rule the exhibit runs under too — searching
 * for a cooperative sample is the exact sin the piece is about.
 */
import { drawGarden, drawScaffold } from './field';
import { THRESHOLD, garden, makeStudy } from './forking-paths.model';

const el = <T extends Element = HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  if (!found) throw new Error(`teaser: ${sel} is missing from the page`);
  return found;
};

const frame = el('[data-figure="teaser"]');
const svg = el<SVGSVGElement>('#teaser');
const button = el<HTMLButtonElement>('#t-again');

const N = 40;
const { layerField } = drawScaffold(svg);
let drawn = 0;

function draw(seed: number) {
  const paths = garden(makeStudy(seed, N), N);
  const sig = paths.filter((p) => p.p < THRESHOLD).length;

  el('#t-sig').textContent = String(sig);
  el('#t-total').textContent = String(paths.length);

  // The label carries the state, because there is only one control: the first
  // press is an invitation, every press after it is what the press does.
  drawn++;
  if (drawn > 1) button.textContent = 'Fresh noise';

  // aria-label, never a <desc> child — the redraw wipes children.
  svg.setAttribute(
    'aria-label',
    `A horizontal p-value axis carrying ${paths.length} analyses of one study with no effect in it. ` +
      `${sig} of them fall left of the p = 0.05 threshold and count as significant.`,
  );

  drawGarden(layerField, paths, seed ^ 0xabcdef, frame.dataset.motion === 'reduce');
}

/** Never `?seed=`, never a stored favourite. Whatever the generator gives. */
const freshSeed = () => Math.floor(Math.random() * 1e9);

button.onclick = () => draw(freshSeed());
draw(freshSeed());
