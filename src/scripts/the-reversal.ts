/**
 * Illusion 02 · The Reversal — the controller.
 *
 * The rule set lives in `the-reversal.model.ts`; this file turns it into an
 * interface. It owns the marks inside the one `<svg>` (Figure.astro owns the
 * frame around them), the playing-time slider, the slot gating, the one-way
 * commit, and the reveal.
 *
 * Behaviours that look incidental and are not:
 *  - The slider changes only WEIGHTS. No batting average moves, ever — that is
 *    the invariant the model enforces and the reason the reader is an explorer,
 *    not a forger.
 *  - COMMITTING FREEZES the slider, the same way publishing froze the hero.
 *  - The Reveal transforms THIS figure: on commit it slides the weighted
 *    markers to home (the real at-bats) and, if the reader had flattened the
 *    seasons, the winner visibly crosses on the way. Never a second chart.
 *  - The slider position is eased (u^2.7) so the flip sits mid-track instead of
 *    bunched against the equal end. That is an input scale, not a data change.
 */
import {
  JETER,
  JUSTICE,
  JUSTIFICATIONS,
  VIEWS,
  type PlayerName,
  type ViewKey,
  fmtAvg,
  findingSentence,
  flipT,
  pooledAt,
  seasonAvg,
  seasonWinner,
  shareAt,
  winnerAt,
  zoneOf,
} from './the-reversal.model';
import { annotateReveal, drawMarks, drawScaffold, inkOf } from './reversal-figure';

const el = <T extends Element = HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  if (!found) throw new Error(`the-reversal: ${sel} is missing from the page`);
  return found;
};

const figFrame = el('[data-figure="rfield"]');
const reduced = () => figFrame.dataset.motion === 'reduce';

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

const SLIDER_CURVE = 2.7;
const tOfU = (u: number) => Math.pow(u, SLIDER_CURVE);
const uOfT = (t: number) => Math.pow(t, 1 / SLIDER_CURVE);

let view: ViewKey = 'two';
let uForced: number | null = null; // set during the reveal animation; else read the slider
let operated = false;
let committed: PlayerName | null = null;
let committedT = 1;
let revealed = false;

const idx = () => VIEWS[view];
const sliderU = () => (uForced ?? (el<HTMLInputElement>('#r-slider').valueAsNumber || 0));
const currentT = () => (committed && revealed ? 1 : committed ? committedT : tOfU(sliderU()));

// ── the figure ──────────────────────────────────────────────────────────────

const svg = el<SVGSVGElement>('#rfield');
let marks: SVGGElement;
let annot: SVGGElement;

interface Frame {
  name: PlayerName;
  seasons: { avg: number; ab: number; year: number }[];
  pooled: number;
}

function framesAt(t: number): Frame[] {
  return [JUSTICE, JETER].map((p) => {
    const totalAb = idx().reduce((a, i) => a + p.seasons[i]!.ab, 0);
    return {
      name: p.name,
      seasons: idx().map((i) => ({
        avg: seasonAvg(p.seasons[i]!),
        ab: shareAt(p, i, t, idx()) * totalAb,
        year: p.seasons[i]!.year,
      })),
      pooled: pooledAt(p, t, idx()),
    };
  });
}

function drawFigure(t: number) {
  drawMarks(marks, framesAt(t), {
    showPooled: operated,
    sizeMode: operated ? 'ab' : 'uniform',
    committed,
  });

  // the readout above the figure: who the current weighting favours
  const w = winnerAt(t, idx());
  const pj = pooledAt(JUSTICE, t, idx());
  const pk = pooledAt(JETER, t, idx());
  const hi = w === 'Jeter' ? pk : pj;
  const lo = w === 'Jeter' ? pj : pk;
  const ro = figFrame.querySelector('.readout');
  if (ro && operated)
    ro.innerHTML =
      `<span>the total: <b style="color:${inkOf(w)}">${w}</b> ahead, ` +
      `<span class="mono">${fmtAvg(hi)}</span> to <span class="mono">${fmtAvg(lo)}</span></span>`;
}

// ── Setup · the table and the 1997 toggle ───────────────────────────────────

function drawTable() {
  const body = el('#r-rows');
  body.innerHTML = '';
  const rows: string[] = [];
  for (const p of [JUSTICE, JETER]) {
    for (const i of idx()) {
      const s = p.seasons[i]!;
      const win = seasonWinner(i) === p.name;
      rows.push(
        `<tr><td>${p.name}</td><td>${s.year}</td><td>${s.ab}</td><td>${s.h}</td>` +
          `<td class="${win ? 'r-win' : ''}">${fmtAvg(seasonAvg(s))}</td></tr>`,
      );
    }
  }
  body.innerHTML = rows.join('');
  el('#r-toggle').textContent = view === 'two' ? 'Add the 1997 season →' : 'Two seasons only';
}

el('#r-toggle').onclick = () => {
  if (committed) return;
  view = view === 'two' ? 'three' : 'two';
  drawTable();
  syncSlider();
  update();
};

// ── Operate · the slider and the justification panel ─────────────────────────

function syncSlider() {
  // place the "the total flips here" tick at the eased position of the flip
  const uFlip = uOfT(flipT(idx()));
  el('#r-flip').style.left = `${(uFlip * 100).toFixed(1)}%`;
}

function showJustification(t: number) {
  const j = JUSTIFICATIONS[zoneOf(t)];
  el('#r-just-reason').textContent = j.reason;
  el('#r-just-cost').textContent = j.cost;
}

el<HTMLInputElement>('#r-slider').oninput = () => {
  if (committed) return;
  operated = true;
  update();
};

// ── the update loop ─────────────────────────────────────────────────────────

function update() {
  const t = currentT();
  drawFigure(t);
  if (!committed) showJustification(t);

  // Commit unlocks once the reader has actually re-weighted something.
  if (!committed)
    setLocked(
      '#r-commit',
      !operated,
      operated ? '· pick the one you would defend' : '· unlocks once you move the slider',
    );
}

// ── Commit · name the better hitter, one way ─────────────────────────────────

function name(winner: PlayerName) {
  if (committed) return;
  committed = winner;
  committedT = tOfU(sliderU());

  el('#r-finding').textContent = findingSentence(winner, committedT, idx());
  const loser: PlayerName = winner === 'Jeter' ? 'Justice' : 'Jeter';
  el('#r-pubmeta').innerHTML =
    `Your weighting: ${zoneOf(committedT) === 'real' ? 'by at-bats, as played' : zoneOf(committedT) === 'equal' ? 'each season counts once' : 'somewhere in between'} · ` +
    `you moved ${loser}’s batting averages by exactly nothing.`;
  el('#r-pubcard').classList.add('on');

  // freeze: the slider and the toggle stop, the way the hero's knobs did
  el<HTMLInputElement>('#r-slider').disabled = true;
  el<HTMLButtonElement>('#r-toggle').disabled = true;
  el<HTMLButtonElement>('#r-name-justice').disabled = true;
  el<HTMLButtonElement>('#r-name-jeter').disabled = true;
  el<HTMLButtonElement>(`#r-name-${winner.toLowerCase()}`).classList.add('picked');
  unlock('#r-commit', '· done');

  reveal();
}

el('#r-name-justice').onclick = () => name('Justice');
el('#r-name-jeter').onclick = () => name('Jeter');

// ── Reveal · slide the markers home, then annotate the same figure ───────────

function reveal() {
  unlock('#r-reveal');

  const finish = () => {
    revealed = true;
    drawFigure(1);
    annotateReveal(annot, framesAt(1));
    rewriteCaption();
    fillCounters();
    el('#r-reveal').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    openRepairGate();
  };

  // If they committed anywhere but home, animate the weighting to the real
  // at-bats — the markers slide and, if they had flattened the seasons, the
  // winner crosses on the way. This IS the reveal: the same figure, transformed.
  const from = committedT;
  if (reduced() || Math.abs(from - 1) < 0.01) return finish();

  const t0 = performance.now();
  const DUR = 900;
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / DUR);
    const eased = 1 - Math.pow(1 - k, 3);
    uForced = uOfT(from + (1 - from) * eased);
    drawFigure(tOfU(uForced));
    if (k < 1) requestAnimationFrame(step);
    else {
      uForced = null;
      finish();
    }
  };
  requestAnimationFrame(step);
}

/** The caption earns its reveal only now: name the p-curve's analogue here. */
function rewriteCaption() {
  const cap = svg.closest('figure')!.querySelector('figcaption');
  if (cap)
    cap.textContent =
      'Fig. 1 · the same batting averages, now sized by the at-bats behind them. Each man’s ' +
      'combined marker (the diamond) sits at his total hits over his total at-bats, so it is ' +
      'dragged toward whichever season he played most. Justice’s biggest season was his worst; ' +
      'Jeter’s were his best. Nothing here is weighted wrong; the pooled average simply answers a ' +
      'different question from the per-season one.';
}

function fillCounters() {
  const won = idx().length;
  el('#r-c-seasons').textContent = `${won} of ${won}`;
  el('#r-c-total').textContent = 'Jeter';
  el('#r-c-total').style.color = inkOf('Jeter');
  el('#r-c-changed').textContent = '0';

  const pj = pooledAt(JUSTICE, 1, idx());
  const pk = pooledAt(JETER, 1, idx());
  const span = view === 'two' ? '1995–96' : '1995–97';
  el('#r-revealbody').textContent =
    `Nothing on the figure moved but the weight. Across ${span}, Justice hit for a higher average ` +
    `in every season, and Jeter hit for a higher average once the at-bats are pooled ` +
    `(${fmtAvg(pk)} to ${fmtAvg(pj)}). The at-bats are the whole story: each man’s combined ` +
    `number is pulled toward the season he played most, and they played their best years by very ` +
    `different amounts. Same twelve numbers, opposite winners.`;
}

// ── Repair · which number is right ───────────────────────────────────────────

function openRepairGate() {
  unlock('#r-repair');
}

el('#r-split').onclick = () => {
  el<HTMLButtonElement>('#r-split').disabled = true;
  el('#r-repairbody').hidden = false;
  unlock('#r-debrief');
};

// ── Foot · reset the weighting ──────────────────────────────────────────────

el('#r-reset').onclick = () => {
  committed = null;
  revealed = false;
  operated = false;
  uForced = null;
  el<HTMLInputElement>('#r-slider').disabled = false;
  el<HTMLInputElement>('#r-slider').value = '1';
  el<HTMLButtonElement>('#r-toggle').disabled = false;
  el<HTMLButtonElement>('#r-name-justice').disabled = false;
  el<HTMLButtonElement>('#r-name-jeter').disabled = false;
  el<HTMLButtonElement>('#r-name-justice').classList.remove('picked');
  el<HTMLButtonElement>('#r-name-jeter').classList.remove('picked');
  el('#r-pubcard').classList.remove('on');
  el('#r-repairbody').hidden = true;
  el<HTMLButtonElement>('#r-split').disabled = false;
  for (const s of ['#r-commit', '#r-reveal', '#r-repair', '#r-debrief'])
    setLocked(s, true, s === '#r-commit' ? '· unlocks once you move the slider' : '· locked');
  update();
};

// ── boot ────────────────────────────────────────────────────────────────────

({ marks, annot } = drawScaffold(svg));
drawTable();
syncSlider();
update();
