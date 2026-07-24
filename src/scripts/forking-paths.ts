/**
 * Illusion 01 · The Forking Paths — the controller.
 *
 * The rule set lives in `forking-paths.model.ts`; this file only turns it into
 * an interface. It owns the marks inside the one `<svg>` (Figure.astro owns the
 * frame around them), the knobs, the slot gating, and the two sweeps.
 *
 * Ported from the verified ticket-06 prototype. Behaviours that look
 * incidental and are not:
 *
 *  - The seed is never curated (see `seedFromUrl`).
 *  - PUBLISHING FREEZES THE ANALYSIS. Knobs disable, reset disables. Commit has
 *    to feel one-way, and the freeze is also what stops the update loop from
 *    reaching into a readout that the Reveal has already rewritten.
 *  - The Reveal transforms THIS figure. Axis, scale, threshold and the reader's
 *    indigo mark persist; the other ~250 paths bloom in around them.
 *  - The 600-study sweep chunks across frames with the counters climbing.
 *    Blocking the main thread for 700ms would be visible.
 */
import { seedFromUrl } from '../lib/rng';
import { marginOfError95, percent } from '../lib/stats';
import {
  INDIGO,
  INDIGO_INK,
  PANEL,
  drawGarden,
  drawScaffold,
  midY,
  node,
  tx,
  x0,
  x1,
  xOf,
  y0,
  y1,
} from './field';
import {
  JUSTIFICATIONS,
  MEASURES,
  OUTLIERS,
  SUBGROUPS,
  THRESHOLD,
  anySignificantOneMeasure,
  comboCount,
  display,
  findingSentence,
  garden,
  makeStudy,
  preRegisteredHit,
  runPath,
  stopsFor,
  sweepSeed,
  type OutlierKey,
  type Path,
  type Subject,
} from './forking-paths.model';

const el = <T extends Element = HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  // Loud, not silent. A quietly missing node is how the prototype's one crash
  // got as far as it did.
  if (!found) throw new Error(`forking-paths: ${sel} is missing from the page`);
  return found;
};
const maybe = <T extends Element = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

const figFrame = el('[data-figure="field"]');
const reduced = () => figFrame.dataset.motion === 'reduce';

/**
 * Gate a slot. `data-locked` carries the dimming; `inert` is what actually
 * keeps its controls out of the tab order until the reader has earned them, so
 * the two always move together.
 */
function setLocked(slot: string, locked: boolean, note: string) {
  const section = el(slot);
  section.dataset.locked = locked ? '1' : '0';
  if (locked) section.setAttribute('inert', '');
  else section.removeAttribute('inert');
  const lockmsg = section.querySelector('.lockmsg');
  if (lockmsg) lockmsg.textContent = note;
}
const unlock = (slot: string, note = '') => setLocked(slot, false, note);

// ── state ───────────────────────────────────────────────────────────────────

const SEED = seedFromUrl();
let N = 40;
let study: Subject[] = makeStudy(SEED, N);
let sel: { k: number; sub: number; out: OutlierKey; stop: number } = {
  k: 0,
  sub: 0,
  out: 'keep',
  stop: 40,
};

/** Every analysis the reader has walked past, keyed by its four settings. */
const tried = new Map<string, number>();
let published: Path | null = null;

const currentKey = () => `${sel.k}|${sel.sub}|${sel.out}|${sel.stop}`;
const current = () => runPath(study, sel.k, sel.sub, sel.out, sel.stop);

// ── the figure ──────────────────────────────────────────────────────────────

const svg = el<SVGSVGElement>('#field');

/** Geometry, palette and the two shared draws live in `field.ts`; the teaser
    on the hub renders the same axis out of the same file. */
let layerField: SVGGElement;
let layerYou: SVGGElement;

/** The reader's own thread: rings for paths walked, a filled mark for the live one. */
function drawYou() {
  while (layerYou.firstChild) layerYou.removeChild(layerYou.firstChild);

  let i = 0;
  for (const [key, p] of tried) {
    if (key === currentKey()) continue;
    const yy = midY + (i % 2 ? 1 : -1) * (14 + Math.floor(i / 2) * 11);
    i++;
    layerYou.appendChild(
      node('circle', {
        cx: xOf(p),
        cy: Math.max(y0 + 6, Math.min(y1 - 6, yy)),
        r: 4,
        fill: 'none',
        stroke: INDIGO,
        'stroke-width': '1.4',
        opacity: '.42',
        class: 'dot',
      }),
    );
  }

  const cur = current();
  if (!cur) return;
  const cx = xOf(cur.p);
  layerYou.appendChild(node('circle', { cx, cy: midY, r: 11, fill: INDIGO, opacity: '.13', class: 'yous' }));
  layerYou.appendChild(
    node('circle', {
      cx,
      cy: midY,
      r: 5.5,
      fill: INDIGO,
      stroke: PANEL,
      'stroke-width': '1.5',
      class: 'yous',
    }),
  );

  // The label sits OFF the mark, with a leader. It also has to dodge the
  // p = 0.05 annotation, because a hacked finding lands next to the threshold
  // BY DEFINITION — that collision is systematic, not incidental.
  const ay = y0 + 4;
  const near = Math.abs(cx - tx) < 78;
  let lx = cx;
  let anchor = 'middle';
  if (near) {
    lx = cx + (cx >= tx ? 92 : -92);
    anchor = cx >= tx ? 'start' : 'end';
  } else if (cx > x1 - 120) anchor = 'end';
  else if (cx < x0 + 120) anchor = 'start';
  lx = Math.max(x0 + 4, Math.min(x1 - 4, lx));

  const g = node('g', {});
  const elbow = lx + (anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0);
  g.appendChild(
    node('path', {
      d: `M ${cx} ${midY - 13} L ${cx} ${ay + 18} L ${elbow} ${ay + 7}`,
      class: 'leader',
      stroke: INDIGO,
      fill: 'none',
    }),
  );
  const label = node('text', { x: lx, y: ay, class: 'annot', 'text-anchor': anchor, fill: INDIGO_INK });
  label.textContent =
    (published && published.p === cur.p ? 'published — ' : 'your analysis — ') +
    'p = ' +
    cur.p.toFixed(3);
  g.appendChild(label);
  layerYou.appendChild(g);
}

/** The Reveal: every other path blooms in around the reader's, left to right. */
function drawField(paths: Path[]) {
  drawGarden(layerField, paths, SEED ^ 0xabcdef, reduced());
  el('#lg-ramp').hidden = false; // the ramp is the reveal's vocabulary; it must not leak earlier
  wireHover();
}

/**
 * Per-path detail on hover. Deliberately NOT the only route to any fact — the
 * counters state every finding in text, which is what makes keyboard access to
 * individual marks a post-ship concern rather than a ship blocker.
 */
let tip: HTMLDivElement | null = null;
function wireHover() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
  }
  const box = tip;
  layerField.addEventListener('mousemove', (e) => {
    const t = e.target as SVGElement;
    if (t.tagName === 'circle' && t.dataset.p) {
      const p = parseFloat(t.dataset.p);
      box.textContent = 'p = ' + p.toFixed(3) + (p < THRESHOLD ? '  ✦ “significant”' : '  · null');
      box.style.left = e.clientX + 12 + 'px';
      box.style.top = e.clientY - 30 + 'px';
      box.style.opacity = '1';
    } else box.style.opacity = '0';
  });
  layerField.addEventListener('mouseleave', () => {
    box.style.opacity = '0';
  });
}

// ── the knobs ───────────────────────────────────────────────────────────────

interface Option {
  /** Key into JUSTIFICATIONS. */
  id: string;
  label: string;
  on: boolean;
  set: () => void;
}

function drawKnobs() {
  const host = el('#knobs');
  // Rebuilding drops focus, which strands a keyboard reader mid-knob. Restore it.
  const activeOpt = (document.activeElement as HTMLElement | null)?.dataset?.opt;
  host.innerHTML = '';

  const groups: { label: string; count: string; opts: Option[] }[] = [
    {
      label: 'Outcome measure',
      count: String(MEASURES.length),
      opts: MEASURES.map((m, i) => ({
        id: 'measure:' + i,
        label: m.name[0]!.toUpperCase() + m.name.slice(1),
        on: sel.k === i,
        set: () => (sel.k = i),
      })),
    },
    {
      label: 'Subgroup',
      count: String(SUBGROUPS.length),
      opts: SUBGROUPS.map((s, i) => ({
        id: 'sub:' + i,
        label: s.label,
        on: sel.sub === i,
        set: () => (sel.sub = i),
      })),
    },
    {
      label: 'Outlier rule',
      count: String(OUTLIERS.length),
      opts: OUTLIERS.map((o) => ({
        id: 'out:' + o.key,
        label: o.label,
        on: sel.out === o.key,
        set: () => (sel.out = o.key),
      })),
    },
    {
      label: 'Stop collecting at',
      count: String(stopsFor(N).length),
      opts: stopsFor(N).map((s) => ({
        id: 'stop',
        label: s + ' subjects',
        on: sel.stop === s,
        set: () => (sel.stop = s),
      })),
    },
  ];

  for (const g of groups) {
    const card = document.createElement('div');
    card.className = 'knob';
    card.setAttribute('role', 'radiogroup');
    card.setAttribute('aria-label', g.label);
    card.innerHTML = `<div class="kl"><span>${g.label}</span><span class="cnt">${g.count}</span></div>`;

    for (const o of g.opts) {
      const b = document.createElement('button');
      b.className = 'opt';
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', o.on ? 'true' : 'false');
      // Unique per option; `id` alone is not (every stopping point shares "stop").
      b.dataset.opt = `${g.label}:${o.label}`;
      b.innerHTML = `<span class="dotm"></span><span>${o.label}</span><span class="pv"></span>`;

      if (published) {
        b.disabled = true;
        b.style.cursor = 'default';
      } else {
        b.onmouseenter = () => showJustification(o.id);
        b.onfocus = () => showJustification(o.id);
        b.onclick = () => {
          o.set();
          showJustification(o.id);
          update();
        };
      }
      card.appendChild(b);
    }
    host.appendChild(card);
  }

  if (activeOpt) {
    const again = host.querySelector<HTMLButtonElement>(`[data-opt="${CSS.escape(activeOpt)}"]`);
    again?.focus();
  }
}

function showJustification(id: string) {
  const j = JUSTIFICATIONS[id];
  if (!j) return;
  el('#jt').textContent = j.reason;
  el('#jc').innerHTML = j.cost;
}

// ── the update loop ─────────────────────────────────────────────────────────

function update() {
  drawKnobs();
  const cur = current();
  if (cur) tried.set(currentKey(), cur.p);

  // After the Reveal the readout belongs to the garden, not to one path, so
  // these two nodes legitimately stop existing.
  const roP = maybe('#ro-p');
  if (roP) {
    roP.textContent = cur ? cur.p.toFixed(3) : '—';
    roP.classList.toggle('hit', !!cur && cur.p < THRESHOLD);
  }
  const roTried = maybe('#ro-tried');
  if (roTried) roTried.textContent = String(tried.size);

  drawYou();
  if (published) return; // the analysis is frozen the moment it becomes a finding

  const hit = !!cur && cur.p < THRESHOLD;
  el<HTMLButtonElement>('#publish').disabled = !hit;
  setLocked(
    '#s-commit',
    !hit,
    hit ? '— you have a result' : '— unlocks when an analysis crosses p < 0.05',
  );

  // The uncooperative sample (~8% of seeds). The escape hatch is not a patch:
  // it is the peeking knob, the fourth degree of freedom, applied honestly.
  const best = Math.min(...garden(study, N).map((p) => p.p));
  const stuck = best >= THRESHOLD;
  el<HTMLButtonElement>('#more').hidden = !stuck || N >= 70;
  el('#opnote').textContent = stuck
    ? N < 70
      ? 'No path in this sample crosses 0.05 — this happens to about 8% of samples. Collect a few more subjects; that is itself one of the knobs.'
      : 'This sample will not cooperate at any size you would plausibly run. That is the honest 2%, and it is worth seeing.'
    : 'Nothing here is irreversible. Yet.';
}

// ── Setup · the complete table ──────────────────────────────────────────────

let showingAll = false;
function drawTable() {
  const body = el('#datarows');
  body.innerHTML = '';
  const rows = showingAll ? study : study.slice(0, 8);
  for (const d of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${d.i}</td>` +
      `<td class="${d.arm ? 'arm-nap' : ''}">${d.arm ? 'nap' : 'control'}</td>` +
      `<td>${display(d.ys[0]!, MEASURES[0]!).toFixed(0)}</td>` +
      `<td>${display(d.ys[1]!, MEASURES[1]!).toFixed(1)}</td>` +
      `<td>${display(d.ys[2]!, MEASURES[2]!).toFixed(1)}</td>` +
      `<td>${d.sex ? 'F' : 'M'}</td><td>${d.age}</td><td>${d.slept.toFixed(1)}h</td>`;
    body.appendChild(tr);
  }
  el('#tblcount').textContent = `showing ${rows.length} of ${study.length} subjects`;
  el('#showall').textContent = showingAll ? 'Show first 8' : `Show all ${study.length}`;
}

el('#showall').onclick = () => {
  showingAll = !showingAll;
  drawTable();
};

// ── Commit ──────────────────────────────────────────────────────────────────

el('#publish').onclick = () => {
  const cur = current();
  if (!cur || cur.p >= THRESHOLD) return;
  published = cur;

  el('#finding').textContent = findingSentence(cur);
  const total = garden(study, N).length;
  el('#pubmeta').innerHTML =
    `Measure: ${MEASURES[sel.k]!.name} · Subgroup: ${SUBGROUPS[sel.sub]!.label} · ` +
    `Outliers: ${OUTLIERS.find((o) => o.key === sel.out)!.label} · Stopped at n = ${sel.stop}<br>` +
    `Paths you tried before this one: ${tried.size - 1} · Paths you did not try: ${total - tried.size}`;
  el('#pubcard').classList.add('on');
  el<HTMLButtonElement>('#publish').disabled = true;

  // One way. Freezing is what "there is no unpublish button" looks like in an
  // interface — and it is also what keeps the update loop out of the readout
  // the Reveal is about to rewrite.
  drawKnobs();
  el<HTMLButtonElement>('#reset').disabled = true;
  el<HTMLButtonElement>('#more').hidden = true;
  el('#opnote').textContent =
    'Frozen. This is the analysis you published; the others are still down there.';
  unlock('#s-commit', '— done');

  openReveal();
  el('#s-reveal').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
};

// ── Reveal ──────────────────────────────────────────────────────────────────

function openReveal() {
  unlock('#s-reveal');

  const paths = garden(study, N);
  const sig = paths.filter((p) => p.p < THRESHOLD).length;

  el('#pathtotal').textContent = String(paths.length);
  el('#c-paths').textContent = String(paths.length);

  // Honest arithmetic: state the subtraction rather than rounding it away.
  const combos = comboCount(N);
  const dropped = combos - paths.length;
  el('#c-pathsnote').innerHTML =
    `3 measures × 7 subgroups × 3 outlier rules × ${stopsFor(N).length} stopping points = ${combos}` +
    (dropped
      ? `; ${dropped === 1 ? 'one leaves' : dropped + ' of them leave'} fewer than three subjects in an arm and cannot be tested`
      : '');

  el('#c-sig').textContent = String(sig);
  el('#c-signote').textContent =
    `${((100 * sig) / paths.length).toFixed(1)}% of your garden, on data with no effect in it`;

  // Scoped to this figure's frame: Figure.astro owns these rails, and there is
  // exactly one chart on the site precisely so the Reveal can rewrite them.
  figFrame.querySelector('.figtitle')!.innerHTML =
    'The garden of forking paths<span class="q"> — every analysis of these same forty subjects</span>';
  figFrame.querySelector('.readout')!.innerHTML =
    `<span><span class="big hit">${sig}</span> of ${paths.length} paths crossed p&lt;.05</span>`;

  // Name the p-curve — but only now. The significant paths stack in a column
  // just past the line because a finding hunted until it crossed lands just
  // under 0.05 rather than far past it. Honest code draws that shape for free;
  // saying so in the caption before the reveal would give the reveal away.
  const caption = svg.closest('figure')!.querySelector('figcaption');
  if (caption)
    caption.textContent =
      'Fig. 1 — every testable analysis of the same forty subjects, on the same axis, ' +
      'the same scale and the same threshold. The significant paths pile into a narrow ' +
      'column just past the line rather than spreading out beyond it. That shape is the ' +
      'p-curve, and nothing here draws it deliberately: a result hunted until it crossed ' +
      'has no reason to travel any further than it had to.';

  drawField(paths);
  drawYou();

  el('#revealbody').textContent =
    `The figure has not changed its axis, its scale, or its data. Every other analysis you ` +
    `could have run on these same forty subjects has been drawn in alongside yours. ` +
    `${sig} of the ${paths.length} cross the line. You found one of them in ${tried.size} tries.`;
}

/** 600 fresh studies, chunked across frames so the counters climb visibly. */
el('#runmany').onclick = () => {
  el<HTMLButtonElement>('#runmany').disabled = true;
  const TOTAL = 600;
  let any = 0;
  let anyOne = 0;
  let done = 0;

  el('#ctr-many').classList.remove('pending');
  el('#ctr-repro').classList.remove('pending');

  const step = () => {
    const end = Math.min(done + 20, TOTAL);
    for (; done < end; done++) {
      const s = makeStudy(sweepSeed(done), 40);
      if (garden(s, 40).some((p) => p.p < THRESHOLD)) any++;
      if (anySignificantOneMeasure(s, 40)) anyOne++;
    }

    el('#c-many').textContent = percent(any, done);
    el('#c-manynote').textContent = `${any} of ${done} studies · ±${marginOfError95(any, done).toFixed(1)} pts`;
    el('#c-repro').textContent = percent(anyOne, done);
    el('#c-repronote').textContent =
      `published figure: 60.7% · ours ±${marginOfError95(anyOne, done).toFixed(1)} pts`;
    el('#c-hack').textContent = percent(any, done);

    if (done < TOTAL) requestAnimationFrame(step);
    else {
      el('#manynote').innerHTML =
        `${TOTAL} fresh studies, none of them curated. The 2011 paper’s single-measure ` +
        `simulation reported <b>60.7%</b>; this browser just got ` +
        `<b>${percent(anyOne, TOTAL)} ± ${marginOfError95(anyOne, TOTAL).toFixed(1)}</b>. ` +
        // Protected verbatim through the voice pass.
        `The margin is shown because a piece about small samples should not hide its own.`;
      openRepair();
    }
  };
  requestAnimationFrame(step);
};

// ── Repair ──────────────────────────────────────────────────────────────────

function openRepair() {
  unlock('#s-repair');
}

el('#runpre').onclick = () => {
  el<HTMLButtonElement>('#runpre').disabled = true;
  const TOTAL = 600;
  let hit = 0;
  // Same generator, same seeds, same test. One path, fixed before the data existed.
  for (let i = 0; i < TOTAL; i++) if (preRegisteredHit(makeStudy(sweepSeed(i), 40), 40)) hit++;

  el('#ctr-pre').classList.remove('pending');
  el('#c-pre').textContent = percent(hit, TOTAL);
  el('#c-prenote').textContent =
    `${hit} of ${TOTAL} · ±${marginOfError95(hit, TOTAL).toFixed(1)} pts · nominal rate: 5%`;
  el('#repairbody').hidden = false;

  unlock('#s-debrief');
};

// ── controls ────────────────────────────────────────────────────────────────

el('#reset').onclick = () => {
  tried.clear();
  sel = { k: 0, sub: 0, out: 'keep', stop: N };
  update();
};

el('#more').onclick = () => {
  // Not a patch. This is the peeking knob, applied honestly — and it extends
  // the same sample rather than redrawing a friendlier one.
  N = Math.min(70, N + 10);
  study = makeStudy(SEED, N);
  sel.stop = N;
  drawTable();
  update();
};

/**
 * The exhibit's last affordance: release the freeze.
 *
 * A fresh seed and a full reload, which is the only reset with no chance of a
 * stale corner. It is also the exit the ~8% uncooperative and ~2% terminal
 * readers otherwise never got.
 */
el('#rerun').onclick = () => {
  const url = new URL(location.href);
  url.searchParams.set('seed', String(Math.floor(Math.random() * 1e9)));
  location.href = url.toString();
};

// ── boot ────────────────────────────────────────────────────────────────────

({ layerField, layerYou } = drawScaffold(svg));
drawTable();
update();
