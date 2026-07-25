/**
 * Illusion 03 · The Positive — the controller.
 *
 * The rule set lives in `the-positive.model.ts`; this file turns it into an
 * interface. It owns the thousand dots inside the one `<svg>` (Figure.astro
 * owns the frame around them), the three test-design sliders, the slot gating,
 * the one-way guess, and the reveal.
 *
 * Behaviours that look incidental and are not:
 *  - The array shows PREVALENCE during Operate; the flags are held back until
 *    the reader commits a guess, so the ratio is theirs to confront, not read.
 *  - COMMITTING FREEZES the sliders, the same way publishing froze the hero and
 *    naming froze the Reversal.
 *  - The Reveal recolours THIS array (the flagged wash into a contiguous block);
 *    it never draws a second chart.
 *  - Sensitivity and specificity read out as counts per hundred, never as a
 *    population-level PPV before the reveal (§4.3a).
 */
import {
  DEFAULT,
  GIGERENZER,
  RANGE,
  type TestDesign,
  findingSentence,
  fmtPct,
  frequencies,
  oneIn,
  ppv,
  prevalenceForPPV,
} from './the-positive.model';
import {
  FALSE_INK,
  SICK_INK,
  annotateResolve,
  drawPopulation,
  drawScaffold,
  resolve,
} from './positive-figure';

const el = <T extends Element = HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  if (!found) throw new Error(`the-positive: ${sel} is missing from the page`);
  return found;
};

const figFrame = el('[data-figure="pfield"]');
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

// ── slider scales (presentation only; the model holds the ranges) ────────────
// Sensitivity and specificity are linear in whole percents; prevalence is
// logarithmic so 0.1% to 20% is navigable and 1% sits comfortably mid-track.

const pct1 = (x: number): string => `${Math.round(x * 100)}%`;
const snap = (x: number): number => Math.round(x * 100) / 100;

const linOf = (v: number, r: { min: number; max: number }) => snap(r.min + v * (r.max - r.min));
const vOfLin = (x: number, r: { min: number; max: number }) => (x - r.min) / (r.max - r.min);
const prevOf = (v: number) => RANGE.prev.min * Math.pow(RANGE.prev.max / RANGE.prev.min, v);
const vOfPrev = (p: number) => Math.log(p / RANGE.prev.min) / Math.log(RANGE.prev.max / RANGE.prev.min);

// ── state ────────────────────────────────────────────────────────────────────

let operated = false;
let committedGuess: number | null = null; // the reader's guessed PPV, 0..1
let revealed = false;

const svg = el<SVGSVGElement>('#pfield');
let dots: SVGCircleElement[];
let annot: SVGGElement;

const design = (): TestDesign => ({
  prev: prevOf(el<HTMLInputElement>('#p-prev').valueAsNumber),
  sens: linOf(el<HTMLInputElement>('#p-sens').valueAsNumber, RANGE.sens),
  spec: linOf(el<HTMLInputElement>('#p-spec').valueAsNumber, RANGE.spec),
});

// ── Operate · the sliders and the plain-words test line ──────────────────────

function drawSliderLabels(d: TestDesign) {
  el('#p-sens-v').textContent = pct1(d.sens);
  el('#p-spec-v').textContent = pct1(d.spec);
  el('#p-prev-v').textContent = d.prev >= 0.01 ? `${(d.prev * 100).toFixed(0)}%` : `${(d.prev * 100).toFixed(1)}%`;
}

function drawTestLine(d: TestDesign) {
  const f = frequencies(d, 1000);
  // Test quality stated per hundred (what the reader dialled), plus the
  // population it screens. No PPV, no population false-alarm total, yet.
  const sickPer1000 = Math.round(d.prev * 1000);
  el('#p-testline').innerHTML =
    `Your test catches <b>${Math.round(d.sens * 100)} of every 100</b> people who have it, ` +
    `and clears <b>${Math.round(d.spec * 100)} of every 100</b> who do not. ` +
    `You are screening a population where <b>${sickPer1000} in 1,000</b> actually have it.`;
  // the figure's readout: the base rate, as a count
  const ro = figFrame.querySelector('.readout');
  if (ro && !revealed)
    ro.innerHTML = `<span class="mono" style="color:var(--faint)">${f.sick} of 1,000 people here actually have it</span>`;
}

function drawOperate() {
  const d = design();
  drawSliderLabels(d);
  drawTestLine(d);
  drawPopulation(dots, frequencies(d, 1000));
}

for (const id of ['#p-sens', '#p-spec', '#p-prev']) {
  el<HTMLInputElement>(id).oninput = () => {
    if (committedGuess !== null) return;
    operated = true;
    drawOperate();
    // Commit unlocks once the reader has actually designed something.
    setLocked('#p-commit', false, '· name what a positive is worth, then lock it in');
    syncGuessScale();
  };
}

// ── Commit · guess the PPV, one way ──────────────────────────────────────────

const guessValue = () => el<HTMLInputElement>('#p-guess').valueAsNumber / 100; // 0..1

function drawGuessLabel() {
  const g = Math.round(guessValue() * 100);
  el('#p-guessout').textContent = `${g} in 100`;
}
el<HTMLInputElement>('#p-guess').oninput = () => {
  if (committedGuess !== null) return;
  drawGuessLabel();
};

el('#p-lock').onclick = () => {
  if (committedGuess !== null) return;
  const d = design();
  committedGuess = guessValue();
  const f = frequencies(d, 1000);

  el('#p-finding').textContent = `You said a positive from your test is worth about ${Math.round(committedGuess * 100)} in 100.`;
  el('#p-pubmeta').innerHTML =
    `Your test: ${Math.round(d.sens * 100)}% sensitivity, ${Math.round(d.spec * 100)}% specificity, ` +
    `screening ${f.sick} in 1,000. You have not seen the crowd of false alarms yet.`;
  el('#p-pubcard').classList.add('on');

  // freeze the design and the guess, the way the earlier illusions froze
  for (const id of ['#p-sens', '#p-spec', '#p-prev', '#p-guess'])
    el<HTMLInputElement>(id).disabled = true;
  el<HTMLButtonElement>('#p-lock').disabled = true;
  unlock('#p-commit', '· locked');

  reveal(d);
};

// ── Reveal · resolve the flags on the same array ─────────────────────────────

function reveal(d: TestDesign) {
  unlock('#p-reveal');
  revealed = true;
  const f = frequencies(d, 1000);

  resolve(dots, f, reduced());
  annotateResolve(annot, f);
  rewriteCaption(d, f);
  fillCounters(d, f);
  drawGuessTruth(d, f);

  el('#p-reveal').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  unlock('#p-repair');
}

function rewriteCaption(d: TestDesign, f: ReturnType<typeof frequencies>) {
  const cap = svg.closest('figure')!.querySelector('figcaption');
  if (cap)
    cap.textContent =
      `Fig. 1 · the same 1,000 people, now with your test run on them. The ${f.flagged} at the top are ` +
      `everyone it flagged; only the ${f.truePos} coral among them actually have the condition. The ` +
      `rest of the flags are healthy people the test cried wolf on. Nothing here is weighted or ` +
      `sampled; it is the arithmetic of a rare condition meeting a test that is wrong now and then.`;
}

function fillCounters(d: TestDesign, f: ReturnType<typeof frequencies>) {
  el('#p-c-flagged').textContent = String(f.flagged);
  el('#p-c-sick').textContent = String(f.truePos);
  el('#p-c-sick').style.color = SICK_INK;
  el('#p-c-ppv').textContent = oneIn(f);
}

function drawGuessTruth(d: TestDesign, f: ReturnType<typeof frequencies>) {
  const guessN = Math.round((committedGuess ?? 0) * 100);
  const truth = ppv(d);
  const truthN = Math.round(truth * 100);
  el('#p-guess-mark').style.left = `${Math.min(100, guessN)}%`;
  el('#p-truth-mark').style.left = `${Math.min(100, truthN)}%`;
  el('#p-guess-num').textContent = `you guessed ${guessN} in 100`;
  el('#p-truth-num').textContent = `a positive is worth ${oneIn(f)}`;

  // the crossover, named: how common would it have to be to be worth a coin flip?
  const cross = prevalenceForPPV(0.5, d.sens, d.spec);
  const head =
    `You built a test that catches ${Math.round(d.sens * 100)} in 100 and clears ${Math.round(d.spec * 100)} in 100. ` +
    `It is a good test. But it is looking for something that only <b>${f.sick} in 1,000</b> people here have, and ` +
    `there are so many more healthy people that even its small error rate turns up <b>${f.falsePos}</b> false alarms ` +
    `against <b>${f.truePos}</b> real ones. A positive from it means ${oneIn(f)}, ${fmtPct(truth)} of the time. `;
  const tail =
    truth < 0.5
      ? `To make a positive worth even a coin flip, you would have to point this same test at a group where more than <b>${fmtPct(cross)}</b> already have it.`
      : `The way out was never a better test. It was pointing the test at a group where the condition is common enough, here <b>${fmtPct(f.sick / 1000)}</b>, that a positive finally means more than a coin flip.`;
  el('#p-revealbody').innerHTML = head + tail;
}

// ── Repair · the honest version, natural frequencies ─────────────────────────

el('#p-repair-btn').onclick = () => {
  el<HTMLButtonElement>('#p-repair-btn').disabled = true;
  el('#p-repairbody').hidden = false;
  unlock('#p-debrief');
};

// ── Foot · reset ─────────────────────────────────────────────────────────────

function syncGuessScale() {
  // place the "coin flip" 50 tick on the guess scale (it is a fixed 50%)
  const t = el<HTMLElement | null>('#p-scale-mid');
  if (t) t.style.left = '50%';
}

el('#p-reset').onclick = () => {
  committedGuess = null;
  revealed = false;
  operated = false;
  for (const id of ['#p-sens', '#p-spec', '#p-prev', '#p-guess'])
    el<HTMLInputElement>(id).disabled = false;
  el<HTMLButtonElement>('#p-lock').disabled = false;
  el('#p-pubcard').classList.remove('on');
  el('#p-repairbody').hidden = true;
  el<HTMLButtonElement>('#p-repair-btn').disabled = false;
  while (annot.firstChild) annot.removeChild(annot.firstChild);
  setDefaults();
  for (const s of ['#p-commit', '#p-reveal', '#p-repair', '#p-debrief'])
    setLocked(s, true, s === '#p-commit' ? '· unlocks once you design the test' : '· locked');
  drawOperate();
};

// ── boot ─────────────────────────────────────────────────────────────────────

function setDefaults() {
  el<HTMLInputElement>('#p-sens').value = String(vOfLin(DEFAULT.sens, RANGE.sens));
  el<HTMLInputElement>('#p-spec').value = String(vOfLin(DEFAULT.spec, RANGE.spec));
  el<HTMLInputElement>('#p-prev').value = String(vOfPrev(DEFAULT.prev));
  el<HTMLInputElement>('#p-guess').value = '50';
  drawGuessLabel();
}

({ dots, annot } = drawScaffold(svg));
setDefaults();
syncGuessScale();
drawOperate();

// The Gigerenzer beat is static copy in the page; nothing to compute here, but
// its numbers are pinned in the model so they cannot drift from the exhibit.
void GIGERENZER;
