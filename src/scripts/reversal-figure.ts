/**
 * Illusion 02 · The Reversal — the figure's geometry, palette and marks.
 *
 * The analogue of the hero's `field.ts`, and deliberately independent of it:
 * that file owns a compressed p-value axis, this one owns a linear
 * batting-average axis. There is still exactly one chart on the reader's page —
 * the Reveal transforms THIS figure rather than drawing a second one — but the
 * two illusions do not share a coordinate space, so they do not share a file.
 *
 * Colour reuse, not colour invention: the two player hues are the null-teal and
 * significant-coral already CVD-validated in the ticket-04 look-lock. They carry
 * no good/bad meaning here (there is no p-value); they are two people, and the
 * lane labels name them so colour is never the only cue. Indigo stays reserved
 * for the reader's own committed pick, exactly as on the hero.
 */

export const NS = 'http://www.w3.org/2000/svg';

export const W = 880;
export const H = 300;
export const x0 = 66; // room for the lane names on the left
export const x1 = W - 30;
export const yJustice = 96;
export const yJeter = 190;
export const yAxis = 250;

/** The visible batting-average window. Linear — a batting average already is. */
export const AVG_LO = 0.24;
export const AVG_HI = 0.335;
export const xOf = (avg: number): number => x0 + ((avg - AVG_LO) / (AVG_HI - AVG_LO)) * (x1 - x0);

// The two players, in the validated look-lock hues. Text variants are darkened
// for contrast on the light ground; the light fills carry the marks.
export const JUSTICE_C = '#E1583F'; // coral — the man ahead every single year
export const JUSTICE_INK = '#B23A28';
export const JETER_C = '#2E9E96'; // teal — the man ahead on the total
export const JETER_INK = '#1F7A73';
export const INDIGO = '#4A3AAB';
export const INDIGO_INK = '#3A2D88';
export const PANEL = '#FCFCFB';

export const colourOf = (name: 'Justice' | 'Jeter'): string =>
  name === 'Justice' ? JUSTICE_C : JETER_C;
export const inkOf = (name: 'Justice' | 'Jeter'): string =>
  name === 'Justice' ? JUSTICE_INK : JETER_INK;
export const yOf = (name: 'Justice' | 'Jeter'): number => (name === 'Justice' ? yJustice : yJeter);

export function node<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

/** Circle radius for an at-bat count. Area ∝ at-bats, floored so 48 stays visible. */
const RSCALE = 0.782;
export const radiusFor = (ab: number): number => Math.max(5, Math.min(22, Math.sqrt(ab) * RSCALE));

/**
 * The static frame: the batting-average axis, its ticks, and the two named
 * lanes. Returns the two layers the controller redraws into — `marks` for the
 * live dots and pooled markers, `annot` for the Reveal's labels — so a redraw
 * never has to reach back through the scaffold.
 */
export function drawScaffold(svg: SVGSVGElement): {
  marks: SVGGElement;
  annot: SVGGElement;
} {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // axis
  const ax = node('g', {});
  ax.appendChild(node('line', { x1: x0, y1: yAxis, x2: x1, y2: yAxis, stroke: '#C3C2B7', 'stroke-width': '1' }));
  for (const v of [0.25, 0.27, 0.29, 0.31, 0.33]) {
    const x = xOf(v);
    ax.appendChild(node('line', { x1: x, y1: yAxis, x2: x, y2: yAxis + 5, stroke: '#C3C2B7', 'stroke-width': '1' }));
    const t = node('text', { x, y: yAxis + 18, class: 'axislab', 'text-anchor': 'middle' });
    t.textContent = '.' + Math.round(v * 1000);
    ax.appendChild(t);
  }
  // Axis title on its own line, centred, so it never collides with a tick label.
  const alabel = node('text', { x: (x0 + x1) / 2, y: yAxis + 34, class: 'axislab', 'text-anchor': 'middle' });
  alabel.textContent = 'batting average →';
  ax.appendChild(alabel);
  svg.appendChild(ax);

  // the two lanes, named
  for (const name of ['Justice', 'Jeter'] as const) {
    const y = yOf(name);
    const g = node('g', {});
    g.appendChild(node('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: '#EEEFF1', 'stroke-width': '1' }));
    const lab = node('text', { x: x0 - 12, y: y + 4, class: 'lanelab', 'text-anchor': 'end', fill: inkOf(name) });
    lab.textContent = name;
    g.appendChild(lab);
    svg.appendChild(g);
  }

  const marks = node('g', {});
  svg.appendChild(marks);
  const annot = node('g', {});
  svg.appendChild(annot);
  return { marks, annot };
}

export interface MarkOpts {
  /** Show the big weighted-average markers (false at Setup, before Operate). */
  showPooled: boolean;
  /** 'uniform' at Setup; 'ab' once the slider is live and size means at-bats. */
  sizeMode: 'uniform' | 'ab';
  /** The player the reader committed to, if any — gets the indigo ring. */
  committed?: 'Justice' | 'Jeter' | null;
}

interface PlayerFrame {
  name: 'Justice' | 'Jeter';
  /** [avg, currentAb] per shown season, in view order. */
  seasons: { avg: number; ab: number; year: number }[];
  /** The weighted average at the current slider position. */
  pooled: number;
}

/**
 * Redraw the marks for the current slider position. `frames` carries the
 * already-computed geometry (the controller owns the model), so this function
 * is pure drawing: season circles sized by their current at-bats, and — once
 * the reader is operating — the pooled diamond with a stem to the axis and a
 * value label sat off the mark.
 */
export function drawMarks(layer: SVGGElement, frames: PlayerFrame[], opts: MarkOpts): void {
  while (layer.firstChild) layer.removeChild(layer.firstChild);

  for (const f of frames) {
    const y = yOf(f.name);
    const c = colourOf(f.name);

    for (const s of f.seasons) {
      const r = opts.sizeMode === 'ab' ? radiusFor(s.ab) : 7;
      layer.appendChild(
        node('circle', {
          cx: xOf(s.avg),
          cy: y,
          r,
          fill: c,
          opacity: '0.5',
          stroke: PANEL,
          'stroke-width': '1',
          class: 'rdot',
        }),
      );
      const yl = node('text', { x: xOf(s.avg), y: y - Math.max(r, 7) - 5, class: 'yearlab', 'text-anchor': 'middle' });
      yl.textContent = String(s.year).slice(2);
      layer.appendChild(yl);
    }

    if (!opts.showPooled) continue;

    // the weighted-average marker: a diamond on the lane, a stem to the axis,
    // and its value labelled off the mark (look-lock: labels never on the line)
    const px = xOf(f.pooled);
    const committed = opts.committed === f.name;
    layer.appendChild(
      node('line', { x1: px, y1: y, x2: px, y2: yAxis, stroke: c, 'stroke-width': '1', 'stroke-dasharray': '3 3', opacity: '.5' }),
    );
    if (committed)
      layer.appendChild(node('circle', { cx: px, cy: y, r: 15, fill: 'none', stroke: INDIGO, 'stroke-width': '2', opacity: '.9', class: 'rpick' }));
    const dsz = 8.5;
    layer.appendChild(
      node('path', {
        d: `M ${px} ${y - dsz} L ${px + dsz} ${y} L ${px} ${y + dsz} L ${px - dsz} ${y} Z`,
        fill: c,
        stroke: PANEL,
        'stroke-width': '1.5',
        class: 'rpool',
      }),
    );
    const above = f.name === 'Justice';
    const lab = node('text', {
      x: px,
      y: above ? y - dsz - 8 : y + dsz + 16,
      class: 'rpoollab',
      'text-anchor': 'middle',
      fill: inkOf(f.name),
    });
    lab.textContent = '.' + f.pooled.toFixed(3).slice(2);
    layer.appendChild(lab);
  }
}

interface AnnotFrame {
  name: 'Justice' | 'Jeter';
  seasons: { avg: number; ab: number; year: number }[];
  pooled: number;
}

/**
 * The Reveal's two labels, sat OFF the marks with leaders (look-lock: never on
 * the line). Justice's names the per-season truth; Jeter's names the pooled
 * one. Drawn into the annotation layer at home, after the markers have slid.
 */
export function annotateReveal(layer: SVGGElement, frames: AnnotFrame[]): void {
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  const jus = frames.find((f) => f.name === 'Justice')!;
  const jet = frames.find((f) => f.name === 'Jeter')!;

  // Justice: above his lane, over his highest-average season, pointing down
  const jBest = jus.seasons.reduce((a, s) => (s.avg > a.avg ? s : a));
  const jx = xOf(jBest.avg);
  const jy = yJustice - 40;
  const t1 = node('text', { x: jx, y: jy, class: 'annot', 'text-anchor': 'middle', fill: JUSTICE_INK });
  t1.textContent = 'higher every season';
  layer.appendChild(t1);
  layer.appendChild(node('line', { x1: jx, y1: jy + 6, x2: jx, y2: yJustice - radiusFor(jBest.ab) - 5, class: 'leader' }));

  // Jeter: below his lane, at his pooled marker, pointing up
  const kx = xOf(jet.pooled);
  const ky = yJeter + 42;
  const t2 = node('text', { x: kx, y: ky, class: 'annot', 'text-anchor': 'middle', fill: JETER_INK });
  t2.textContent = 'higher on the total';
  layer.appendChild(t2);
  layer.appendChild(node('line', { x1: kx, y1: ky - 12, x2: kx, y2: yJeter + 10, class: 'leader' }));
}
