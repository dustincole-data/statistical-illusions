/**
 * Illusion 03 · The Positive — the figure's geometry, palette and marks.
 *
 * The analogue of the hero's `field.ts` and the Reversal's `reversal-figure.ts`,
 * and deliberately independent of both: they own axes, this one owns a grid of
 * one thousand individuals. There is still exactly one chart on the reader's
 * page — the Reveal recolours THIS array rather than drawing a second one — but
 * the three illusions do not share a coordinate space, so they do not share a
 * file.
 *
 * §4.3(a) is a correctness constraint on this file: the units must be countable
 * and groupable. So the layout is disease-sorted (the sick cluster) and, on the
 * reveal, the flagged sit contiguously at the top in two CVD-validated hues —
 * coral for the sick, the token null-teal for the healthy who were flagged.
 * Nothing here is random; the surprise is in a fixed arrangement.
 *
 * The thousand nodes are created once and only ever recoloured, never moved or
 * recreated. A redraw is a fill sweep, so it costs nothing even at N = 1000.
 */
import type { Freq } from './the-positive.model';

export const NS = 'http://www.w3.org/2000/svg';

export const W = 880;
export const H = 440;
export const COLS = 50;
export const ROWS = 20;
export const N = COLS * ROWS; // 1000
const PITCH = 16.8;
const MX = (W - COLS * PITCH) / 2; // centred: 20
const TY = 62; // room above the grid for the reveal's block label
export const R = 5.4;

// Disease truth is the fill; the two flagged hues are the CVD-validated pair
// (coral vs the token null-teal). Cleared healthy recede to a faint grey so the
// sick cluster reads at a glance. Indigo stays reserved for the reader's guess.
export const SICK = '#E1583F'; // has the condition
export const SICK_INK = '#B23A28';
export const FALSE = '#2E9E96'; // flagged, but healthy — a false alarm
export const FALSE_INK = '#1F7A73';
export const CLEAR = '#DCDFE4'; // healthy and cleared
export const MISS = '#F1B3A8'; // sick and missed (faded coral) — the rare false negative
export const INDIGO = '#4A3AAB';
export const INK = '#16181D';
export const FAINT = '#8A909C';

export const xOf = (slot: number): number => MX + (slot % COLS) * PITCH + PITCH / 2;
export const yOf = (slot: number): number => TY + Math.floor(slot / COLS) * PITCH + PITCH / 2;

export function node<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

/**
 * Create the 1,000 dots once, at their fixed grid positions, plus the two
 * layers the controller draws into: the dots themselves and an annotation layer
 * for the reveal's labels. Returns the dot array so recolours never re-query.
 */
export function drawScaffold(svg: SVGSVGElement): {
  dots: SVGCircleElement[];
  annot: SVGGElement;
} {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const grid = node('g', {});
  const dots: SVGCircleElement[] = [];
  for (let s = 0; s < N; s++) {
    const c = node('circle', { cx: xOf(s), cy: yOf(s), r: R, fill: CLEAR, class: 'pdot' });
    dots.push(c);
    grid.appendChild(c);
  }
  svg.appendChild(grid);

  const annot = node('g', {});
  svg.appendChild(annot);
  return { dots, annot };
}

/**
 * Operate state: disease only. The sick cluster in the top-left, the healthy
 * are faint. The test's flags are held back until the reader commits a guess,
 * so specificity and sensitivity move the readout, not this picture — only
 * prevalence changes how many dots are sick.
 */
export function drawPopulation(dots: SVGCircleElement[], f: Freq): void {
  for (let s = 0; s < N; s++) {
    const d = dots[s]!;
    d.style.transition = '';
    d.style.transitionDelay = '';
    d.setAttribute('fill', s < f.sick ? SICK : CLEAR);
    d.setAttribute('fill-opacity', '1');
  }
}

/**
 * Reveal state: the flags resolve. Slots are already sorted disease-first, so
 * the flagged land contiguously at the top — caught sick (solid coral), then
 * any missed sick (faded), then the false alarms (teal) — above the cleared
 * grey field. A short staggered fill sweep makes the teal wash in; reduced
 * motion snaps.
 */
export function resolve(dots: SVGCircleElement[], f: Freq, reduced: boolean): void {
  const fpEnd = f.sick + f.falsePos; // slots [sick, fpEnd) are the false alarms
  for (let s = 0; s < N; s++) {
    const d = dots[s]!;
    let fill = CLEAR;
    let op = '1';
    if (s < f.truePos) fill = SICK; // sick, caught
    else if (s < f.sick) (fill = MISS), (op = '1'); // sick, missed
    else if (s < fpEnd) fill = FALSE; // healthy, flagged
    if (reduced) {
      d.style.transition = '';
      d.style.transitionDelay = '';
    } else {
      d.style.transition = 'fill .45s ease';
      // wave the flagged in from left to right; the cleared just settle
      d.style.transitionDelay = s < fpEnd ? `${Math.min(s, 60) * 6}ms` : '0ms';
    }
    d.setAttribute('fill', fill);
    d.setAttribute('fill-opacity', op);
  }
}

/**
 * The reveal's labels, drawn in the band above the grid and pointing down at the
 * flagged block. The hard counts live in the slot's counters as well, so this is
 * grouping the eye can follow, never the only route to a number.
 */
export function annotateResolve(annot: SVGGElement, f: Freq): void {
  while (annot.firstChild) annot.removeChild(annot.firstChild);
  const fpEnd = f.sick + f.falsePos;

  // the block's horizontal extent on its first (top) row
  const firstRowEnd = Math.min(fpEnd, COLS);
  const bx0 = xOf(0) - R;
  const bx1 = xOf(firstRowEnd - 1) + R;

  // a light bracket under the label, spanning the top row of the flagged block
  const by = TY - 12;
  annot.appendChild(node('line', { x1: bx0, y1: by, x2: bx1, y2: by, stroke: FAINT, 'stroke-width': 1 }));
  annot.appendChild(node('line', { x1: bx0, y1: by, x2: bx0, y2: by + 6, stroke: FAINT, 'stroke-width': 1 }));
  annot.appendChild(node('line', { x1: bx1, y1: by, x2: bx1, y2: by + 6, stroke: FAINT, 'stroke-width': 1 }));

  const t1 = node('text', { x: bx0, y: by - 20, class: 'pannot', fill: INK });
  t1.textContent = `Everyone your test flagged: ${f.flagged}`;
  annot.appendChild(t1);

  const t2 = node('text', { x: bx0, y: by - 5, class: 'pannotsub' });
  t2.innerHTML =
    `<tspan fill="${SICK_INK}">${f.truePos} actually have it</tspan>` +
    `<tspan fill="${FAINT}">  ·  </tspan>` +
    `<tspan fill="${FALSE_INK}">${f.falsePos} false alarms</tspan>`;
  annot.appendChild(t2);
}
