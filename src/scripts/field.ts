/**
 * The field — Illusion 01's figure geometry, its palette, and the two draws
 * that more than one page needs.
 *
 * The illusion renders in two places: the exhibit (`forking-paths.ts`) and the
 * hub teaser (`teaser.ts`). There is exactly one chart on this site, so there
 * is exactly one copy of its axis, its threshold and its colour ramp. A second
 * copy is how a teaser quietly drifts away from the exhibit it is a taste of.
 *
 * This file owns the scaffold and the garden bloom. It does not own the
 * reader's own indigo thread, the legend rails or the hover tip — those belong
 * to whichever controller has them.
 */
import { mulberry32 } from '../lib/rng';
import { THRESHOLD, type Path } from './forking-paths.model';

export const NS = 'http://www.w3.org/2000/svg';

export const W = 880;
export const H = 300;
export const x0 = 22;
export const x1 = W - 22;
export const y0 = 42;
export const y1 = H - 38;
export const midY = (y0 + y1) / 2;

/**
 * The p-axis, compressed by a power law so 0.05 sits where the convention sits
 * in practice: near the end, and easy to reach.
 */
const AXIS_POWER = 0.38;
export const xOf = (p: number) => x0 + (1 - Math.pow(p, AXIS_POWER)) * (x1 - x0);
export const tx = xOf(THRESHOLD);

// The spectral ramp, mirroring tokens.css. Interpolated per mark, so the values
// have to be literal here; if a token moves, these move with it.
const NULL_COOL = '#2E9E96';
const NULL_PALE = '#7FC7C1';
const SIG_1 = '#EBA23C';
const SIG_2 = '#E1583F';
const SIG_3 = '#C42E1A';
export const INDIGO = '#4A3AAB';
export const INDIGO_INK = '#3A2D88';
export const PANEL = '#FCFCFB';

export function node<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i]! - v) * t)).join(',') + ')';
}

/** Calm teal on the null side, hot coral past the line. Diverges at p = .05. */
export function colourOf(p: number): string {
  if (p > THRESHOLD) {
    const t = Math.min(1, (1 - p) / (1 - THRESHOLD));
    return mix(NULL_COOL, NULL_PALE, t * 0.6);
  }
  const t = 1 - p / THRESHOLD;
  return t < 0.5 ? mix(SIG_1, SIG_2, t / 0.5) : mix(SIG_2, SIG_3, (t - 0.5) / 0.5);
}

/**
 * The axis, the threshold and the two layers the marks go into. Returns the
 * layers rather than exporting them, so two figures on two pages can never
 * share a layer by accident.
 */
export function drawScaffold(svg: SVGSVGElement): {
  layerField: SVGGElement;
  layerYou: SVGGElement;
} {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const g = node('g', {});
  g.appendChild(
    node('rect', { x: tx, y: y0 - 8, width: x1 - tx, height: y1 - y0 + 14, fill: SIG_3, opacity: '.035' }),
  );
  g.appendChild(node('line', { x1: tx, y1: y0 - 8, x2: tx, y2: y1 + 4, class: 'thresh' }));
  g.appendChild(
    node('line', { x1: x0, y1: y1 + 4, x2: x1, y2: y1 + 4, stroke: '#C3C2B7', 'stroke-width': '1' }),
  );
  svg.appendChild(g);

  const ax = node('g', {});
  let t = node('text', { x: x0, y: y1 + 22, class: 'axislab' });
  t.textContent = 'p = 1   (nothing found)';
  ax.appendChild(t);
  t = node('text', { x: x1, y: y1 + 22, class: 'axislab', 'text-anchor': 'end' });
  t.textContent = 'p → 0   (“highly significant”)';
  ax.appendChild(t);
  svg.appendChild(ax);

  const an = node('g', {});
  t = node('text', { x: tx, y: y0 - 18, class: 'annot', 'text-anchor': 'middle' });
  t.textContent = 'p = 0.05';
  an.appendChild(t);
  an.appendChild(node('line', { x1: tx, y1: y0 - 12, x2: tx, y2: y0 - 4, class: 'leader' }));
  svg.appendChild(an);

  const layerField = node('g', {});
  svg.appendChild(layerField);
  const layerYou = node('g', {});
  svg.appendChild(layerYou);
  return { layerField, layerYou };
}

/**
 * Every path in a garden, blooming in left to right with the halos last.
 *
 * The vertical scatter is seeded rather than random so a shared URL redraws the
 * same picture, and `data-p` is left on each mark for whatever hover the host
 * page wires up. Nothing here is the only route to a fact.
 */
export function drawGarden(
  layer: SVGGElement,
  paths: Path[],
  seed: number,
  reduced: boolean,
): void {
  while (layer.firstChild) layer.removeChild(layer.firstChild);

  const rnd = mulberry32(seed);
  const items = paths.map((path) => ({
    p: path.p,
    cx: xOf(path.p),
    cy: y0 + 8 + rnd() * (y1 - y0 - 16),
    sig: path.p < THRESHOLD,
  }));

  for (const it of items)
    if (it.sig)
      layer.appendChild(
        node('circle', { cx: it.cx, cy: it.cy, r: 8, fill: colourOf(it.p), opacity: '0', class: 'dot halo' }),
      );

  const dots: { c: SVGCircleElement; sig: boolean; cx: number }[] = [];
  for (const it of items) {
    const c = node('circle', {
      cx: it.cx,
      cy: it.cy,
      r: it.sig ? 3.8 : 2.5,
      fill: colourOf(it.p),
      opacity: '0',
      class: 'dot',
      stroke: it.sig ? PANEL : 'none',
      'stroke-width': it.sig ? '1' : '0',
    });
    c.dataset.p = it.p.toFixed(4);
    layer.appendChild(c);
    dots.push({ c, sig: it.sig, cx: it.cx });
  }

  if (reduced) {
    layer.querySelectorAll('.halo').forEach((h) => h.setAttribute('opacity', '.45'));
    dots.forEach((d) => d.c.setAttribute('opacity', d.sig ? '1' : '.72'));
    return;
  }

  const order = dots.slice().sort((a, b) => a.cx - b.cx);
  order.forEach((d, i) => setTimeout(() => d.c.setAttribute('opacity', d.sig ? '1' : '.72'), i * 3));
  setTimeout(
    () => layer.querySelectorAll('.halo').forEach((h) => h.setAttribute('opacity', '.45')),
    order.length * 3 + 100,
  );
}
