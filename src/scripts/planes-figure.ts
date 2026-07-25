/**
 * Illusion 04 · The Missing Planes — the figure's geometry, palette and marks.
 *
 * The analogue of the hero's `field.ts` and the Positive's `positive-figure.ts`,
 * and deliberately independent of both: they own axes and a grid, this one owns
 * a bomber seen from above, divided into four zones. There is still exactly one
 * chart on the reader's page — the Reveal transforms THIS silhouette rather than
 * drawing a second one — but the illusions do not share a coordinate space, so
 * they do not share a file.
 *
 * ⚠ THE AIRCRAFT IS DRAWN IN-HOUSE (§5.4). The famous bullet-hole diagram is a
 * 2016 Wikipedia illustration of a Lockheed PV-1 Ventura, an aircraft in none of
 * Wald's examples, under a share-alike licence. This silhouette is a generic
 * four-engine heavy bomber, ours, so the piece owes no attribution and shows no
 * mislabelled type.
 *
 * The encoding is the whole argument. A bullet mark is a hit. DARK marks are
 * hits on planes that came home — the map the reader is given. HOT marks are the
 * hits that only appear once the planes that did NOT come home are counted; they
 * are hidden until the Reveal, and they flood the engines, because a plane hit
 * in the engine rarely came home to show it. Indigo is the reader's armor,
 * never a hit — the site's one reserved colour for "you".
 */
import { mulberry32 } from '../lib/rng';
import type { FleetResult, ZoneKey } from './the-missing-planes.model';

export const NS = 'http://www.w3.org/2000/svg';
export const W = 880;
export const H = 460;

// Palette — the locked tokens, copied as literals (this file draws SVG attrs).
const HULL = '#E9ECF0'; // silhouette fill
const HULL_LINE = '#B9C0CB'; // silhouette outline
const SEEN = '#3A3F4A'; // a hit on a plane that came home (dark bullet hole)
const MISSING = '#C42E1A'; // a hit from a plane that never came home (hot)
const MISSING_SOFT = '#E1583F';
const ARMOR = '#4A3AAB'; // indigo — the reader's plate
const ARMOR_SOFT = '#EDEBF7';
export const INK = '#16181D';
const FAINT = '#8A909C';

export function node<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

// ── geometry: one generic four-engine bomber, nose up ────────────────────────

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Geo {
  /** Silhouette path(s), drawn back-to-front to build one cohesive plane. */
  hull: string[];
  /** Where bullet marks scatter for this zone. */
  boxes: Box[];
  /** The armor plate outline(s) for this zone. */
  plate: string[];
  /** Zone-name label anchor and text alignment. */
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

const WINGS_D = 'M440,200 L792,246 L812,300 L716,298 L440,268 L164,298 L68,300 L88,246 Z';
const FUSELAGE_D =
  'M440,34 C422,58 414,116 414,178 L414,300 C414,362 422,402 440,424 C458,402 466,362 466,300 L466,178 C466,116 458,58 440,34 Z';
const TAIL_D = 'M440,356 L556,382 L578,398 L512,396 L440,384 L368,396 L302,398 L324,382 Z';
const NACELLES: Box[] = [
  { x: 214, y: 228, w: 26, h: 52 },
  { x: 316, y: 232, w: 26, h: 52 },
  { x: 540, y: 232, w: 26, h: 52 },
  { x: 642, y: 228, w: 26, h: 52 },
];
const nacellePlate = (b: Box) =>
  `M${b.x},${b.y + 8} q0,-8 8,-8 h${b.w - 16} q8,0 8,8 v${b.h - 16} q0,8 -8,8 h${-(b.w - 16)} q-8,0 -8,-8 Z`;

const GEO: Record<ZoneKey, Geo> = {
  fuselage: {
    hull: [FUSELAGE_D],
    boxes: [{ x: 418, y: 66, w: 44, h: 328 }],
    plate: [FUSELAGE_D],
    label: { x: 476, y: 120, anchor: 'start' },
  },
  wings: {
    hull: [WINGS_D],
    boxes: [
      { x: 104, y: 250, w: 246, h: 40 },
      { x: 530, y: 250, w: 246, h: 40 },
    ],
    plate: [WINGS_D],
    label: { x: 706, y: 262, anchor: 'start' },
  },
  tail: {
    hull: [TAIL_D],
    boxes: [{ x: 330, y: 376, w: 220, h: 20 }],
    plate: [TAIL_D],
    label: { x: 590, y: 392, anchor: 'start' },
  },
  engine: {
    hull: NACELLES.map((b) => nacellePlate(b)),
    boxes: NACELLES,
    plate: NACELLES.map((b) => nacellePlate(b)),
    label: { x: 150, y: 214, anchor: 'end' },
  },
};

export const ZONE_ORDER: ZoneKey[] = ['fuselage', 'wings', 'tail', 'engine'];

// ── how many marks stand in for a count ──────────────────────────────────────
// A readable stand-in, not one dot per hit: the exact counts live in the slot's
// HTML counters, so the marks are density the eye can read, never the only route
// to a number.

const MARK_DIV = 9;
const MARK_CAP = 46;
const marksFor = (count: number): number => Math.min(MARK_CAP, Math.round(count / MARK_DIV));

/** Deterministic scatter of `n` points across boxes, weighted by area. */
function scatter(boxes: Box[], n: number, seed: number): { x: number; y: number }[] {
  const rnd = mulberry32(seed);
  const area = boxes.map((b) => b.w * b.h);
  const total = area.reduce((a, b) => a + b, 0);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let u = rnd() * total;
    let bi = 0;
    for (; bi < boxes.length - 1; bi++) {
      if (u < area[bi]!) break;
      u -= area[bi]!;
    }
    const b = boxes[bi]!;
    pts.push({ x: b.x + 3 + rnd() * (b.w - 6), y: b.y + 3 + rnd() * (b.h - 6) });
  }
  return pts;
}

// ── scaffold: build the plane once ───────────────────────────────────────────

export interface Scaffold {
  hullLayer: SVGGElement;
  armorLayer: SVGGElement;
  markLayer: SVGGElement;
  labelLayer: SVGGElement;
  annot: SVGGElement;
  /** Per zone: the mark <circle>s, ordered [seen…, missing…]. */
  marks: Record<ZoneKey, SVGCircleElement[]>;
}

/**
 * Draw the silhouette (wings, tail, fuselage, then the four nacelles), the zone
 * labels, and the empty layers the controller draws into. Marks are created for
 * a fixed maximum so the survivor→population transform only reveals and recolours
 * existing nodes rather than churning the DOM.
 */
export function drawScaffold(svg: SVGSVGElement): Scaffold {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const hullLayer = node('g', {});
  // back-to-front so the plane reads as one body
  for (const d of [WINGS_D, TAIL_D, FUSELAGE_D])
    hullLayer.appendChild(node('path', { d, fill: HULL, stroke: HULL_LINE, 'stroke-width': 1.5 }));
  for (const b of NACELLES)
    hullLayer.appendChild(
      node('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, fill: HULL, stroke: HULL_LINE, 'stroke-width': 1.5 }),
    );
  svg.appendChild(hullLayer);

  const armorLayer = node('g', {});
  svg.appendChild(armorLayer);

  const markLayer = node('g', {});
  svg.appendChild(markLayer);

  const labelLayer = node('g', {});
  for (const z of ZONE_ORDER) {
    const g = GEO[z];
    const t = node('text', { x: g.label.x, y: g.label.y, class: 'plabel', 'text-anchor': g.label.anchor, fill: FAINT });
    t.textContent = z === 'engine' ? 'Engines' : z[0]!.toUpperCase() + z.slice(1);
    labelLayer.appendChild(t);
  }
  svg.appendChild(labelLayer);

  const annot = node('g', {});
  svg.appendChild(annot);

  const marks: Record<ZoneKey, SVGCircleElement[]> = { fuselage: [], wings: [], tail: [], engine: [] };
  return { hullLayer, armorLayer, markLayer, labelLayer, annot, marks };
}

// ── the survivors' map: dark marks only ──────────────────────────────────────

/**
 * Draw the map the reader is handed: bullet holes on the planes that came home.
 * The full set of marks (up to the population count) is created now, but only
 * the survivor prefix is shown; the rest are the "missing" marks, created hidden
 * and hot, ready for the Reveal to bloom them in.
 */
export function drawSurvivorMap(s: Scaffold, res: FleetResult): void {
  while (s.markLayer.firstChild) s.markLayer.removeChild(s.markLayer.firstChild);
  for (const z of ZONE_ORDER) {
    const all = marksFor(res.hitsAll[z]);
    const home = Math.min(all, marksFor(res.hitsHome[z]));
    const pts = scatter(GEO[z].boxes, all, 1000 + ZONE_ORDER.indexOf(z) * 97);
    const circles: SVGCircleElement[] = [];
    pts.forEach((p, i) => {
      const seen = i < home;
      const c = node('circle', {
        cx: p.x,
        cy: p.y,
        r: seen ? 2.6 : 2.9,
        fill: seen ? SEEN : MISSING,
        'fill-opacity': seen ? '0.9' : '0', // missing marks start invisible
        class: seen ? 'hit seen' : 'hit missing',
      });
      circles.push(c);
      s.markLayer.appendChild(c);
    });
    s.marks[z] = circles;
  }
}

// ── the population reveal: bloom the hot marks in ────────────────────────────

/**
 * Reveal every hit, including the ones that never came home. The hidden hot
 * marks fade in; the engine floods, because that is where survivorship hid the
 * most. Reduced motion snaps; otherwise the missing marks wave in from the
 * order they were created.
 */
export function revealPopulation(s: Scaffold, reduced: boolean): void {
  for (const z of ZONE_ORDER) {
    let shown = 0;
    for (const c of s.marks[z]) {
      if (!c.classList.contains('missing')) continue;
      if (reduced) {
        c.style.transition = '';
        c.setAttribute('fill-opacity', '0.92');
      } else {
        c.style.transition = 'fill-opacity .5s ease';
        c.style.transitionDelay = `${Math.min(shown, 30) * 22}ms`;
        c.setAttribute('fill-opacity', '0.92');
      }
      shown++;
    }
  }
}

/** The reveal's callout, pointing at the engines: what the survivors' map hid. */
export function annotateEngine(annot: SVGGElement, res: FleetResult): void {
  while (annot.firstChild) annot.removeChild(annot.firstChild);
  // a leader from a label up-left down to the left engine nacelle
  const nx = NACELLES[0]!.x + NACELLES[0]!.w / 2;
  const ny = NACELLES[0]!.y - 2;
  const lx = 150;
  const ly = 150;
  annot.appendChild(
    node('path', {
      d: `M${lx},${ly + 6} C ${lx + 20},${ly + 40} ${nx - 30},${ny - 30} ${nx},${ny}`,
      fill: 'none',
      stroke: MISSING_SOFT,
      'stroke-width': 1.4,
    }),
  );
  const t1 = node('text', { x: lx, y: ly, class: 'pannot', fill: MISSING });
  t1.textContent = `Engines: ${res.hitsHome.engine} seen, ${res.hitsAll.engine} flew`;
  annot.appendChild(t1);
  const t2 = node('text', { x: lx, y: ly + 17, class: 'pannotsub', fill: FAINT });
  t2.textContent = 'the red hits never came home';
  annot.appendChild(t2);
}

// ── the reader's armor: indigo plates ────────────────────────────────────────

export function drawArmor(s: Scaffold, armored: Record<ZoneKey, boolean>): void {
  while (s.armorLayer.firstChild) s.armorLayer.removeChild(s.armorLayer.firstChild);
  for (const z of ZONE_ORDER) {
    if (!armored[z]) continue;
    for (const d of GEO[z].plate)
      s.armorLayer.appendChild(
        node('path', {
          d,
          fill: ARMOR_SOFT,
          'fill-opacity': '0.55',
          stroke: ARMOR,
          'stroke-width': 2,
          'stroke-dasharray': '5 3',
        }),
      );
  }
}
