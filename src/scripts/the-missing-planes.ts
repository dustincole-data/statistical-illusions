/**
 * Illusion 04 · The Missing Planes — the controller.
 *
 * The rule set lives in `the-missing-planes.model.ts`; this file turns it into
 * an interface. It owns the marks inside the one `<svg>` (Figure.astro owns the
 * frame around them), the four armor toggles and their weight budget, the slot
 * gating, the one-way commit-freeze, and the two-stage reveal.
 *
 * Behaviours that look incidental and are not:
 *  - ONE FLEET, from `seedFromUrl`, never curated. Its survivors are the map,
 *    its full population is the reveal, and flying with armor re-runs THE SAME
 *    planes and hits under the reader's plate (the model keeps the counterfactual
 *    clean). So the reveal lands on the exact fleet the reader studied.
 *  - COMMITTING FREEZES the toggles, the way publishing froze the hero and naming
 *    froze the Reversal.
 *  - The Reveal transforms THIS silhouette: the hidden "missing" marks bloom in,
 *    flooding the engines. It never draws a second chart.
 *  - The damage map is always the UNARMORED population; armor moves the survival
 *    number, not the picture of where the danger was.
 */
import { seedFromUrl } from '../lib/rng';
import {
  ARMOR_BUDGET,
  CAVEAT,
  NO_ARMOR,
  PROVENANCE,
  type Armor,
  type ZoneKey,
  armorOf,
  platesUsed,
  simulateFleet,
} from './the-missing-planes.model';
import {
  ZONE_ORDER,
  annotateEngine,
  drawArmor,
  drawScaffold,
  drawSurvivorMap,
  revealPopulation,
  type Scaffold,
} from './planes-figure';

const el = <T extends Element = HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  if (!found) throw new Error(`the-missing-planes: ${sel} is missing from the page`);
  return found;
};

const figFrame = el('[data-figure="pfleet"]');
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

// ── state ────────────────────────────────────────────────────────────────────

const SEED = seedFromUrl();
const fleet = simulateFleet(SEED, NO_ARMOR); // the returning-fleet map + the population
const armor: Armor = { ...NO_ARMOR };
let committed = false;

const svg = el<SVGSVGElement>('#pfleet');
let scaffold: Scaffold;

// ── Operate · the survivors' map and the armor toggles ───────────────────────

function drawMapAndCounts() {
  drawSurvivorMap(scaffold, fleet);
  for (const z of ZONE_ORDER) el(`[data-hits="${z}"]`).textContent = String(fleet.hitsHome[z]);
}

function syncToggles() {
  const used = platesUsed(armor);
  const full = used >= ARMOR_BUDGET;

  for (const z of ZONE_ORDER) {
    const btn = el<HTMLButtonElement>(`.ptoggle[data-zone="${z}"]`);
    const on = armor[z];
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.disabled = committed || (!on && full);
    const state = btn.querySelector('.pz-state');
    if (state) state.textContent = on ? '✓ armored' : full ? 'no plates left' : 'plate this';
  }

  drawArmor(scaffold, armor);

  const plated = ZONE_ORDER.filter((z) => armor[z]).map((z) => (z === 'engine' ? 'engines' : z));
  const budget = el('#mp-budget');
  budget.classList.toggle('full', full);
  budget.innerHTML =
    used === 0
      ? 'No armor placed yet. Plate <b>two</b> zones, then send up the fleet.'
      : `Plated: <b>${plated.join(' and ')}</b> · ${used} of ${ARMOR_BUDGET} plates used.` +
        (full ? ' Armor is heavy; two plates is the whole weight budget.' : ' One plate left.');

  if (used >= 1) unlock('#mp-commit', '· lock the loadout and fly');
}

for (const z of ZONE_ORDER) {
  el<HTMLButtonElement>(`.ptoggle[data-zone="${z}"]`).onclick = () => {
    if (committed) return;
    if (armor[z]) armor[z] = false;
    else {
      if (platesUsed(armor) >= ARMOR_BUDGET) return;
      armor[z] = true;
    }
    syncToggles();
  };
}

// ── Commit · lock the loadout, fly ───────────────────────────────────────────

el('#mp-fly').onclick = () => {
  if (committed) return;
  committed = true;

  const armored = simulateFleet(SEED, armor);
  const plated = ZONE_ORDER.filter((z) => armor[z]).map((z) => (z === 'engine' ? 'engines' : z));

  el('#mp-loadline').textContent = plated.length
    ? `You armored the ${plated.join(' and ')}.`
    : 'You flew them with no armor at all.';
  el('#mp-loadmeta').innerHTML =
    `${armored.returned} of 400 will come home. You have not seen where the ones that do not were hit yet.`;
  el('#mp-loadcard').classList.add('on');

  // freeze the loadout, the way the earlier illusions froze
  for (const z of ZONE_ORDER) el<HTMLButtonElement>(`.ptoggle[data-zone="${z}"]`).disabled = true;
  el<HTMLButtonElement>('#mp-fly').disabled = true;
  unlock('#mp-commit', '· locked');

  reveal(armored);
};

// ── Reveal · fly, then count the missing ─────────────────────────────────────

function reveal(armored: ReturnType<typeof simulateFleet>) {
  unlock('#mp-reveal');

  const base = fleet.survival;
  const you = armored.survival;
  fillSurvival(base, you);
  fillReveal(armored);

  // transform THIS silhouette to the full population: the missing marks bloom in
  revealPopulation(scaffold, reduced());
  annotateEngine(scaffold.annot, fleet);
  rewriteCaption();

  el('#mp-reveal').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  unlock('#mp-repair');
}

function fillSurvival(base: number, you: number) {
  el('#mp-base-mark').style.left = `${base * 100}%`;
  el('#mp-you-mark').style.left = `${you * 100}%`;
  el('#mp-base-num').textContent = `no armor: ${Math.round(base * 400)} home`;
  el('#mp-you-num').textContent = `your armor: ${Math.round(you * 400)} home`;
}

function fillReveal(armored: ReturnType<typeof simulateFleet>) {
  const you = Math.round(armored.survival * 400);
  const base = Math.round(fleet.survival * 400);
  const saved = you - base;
  el('#mp-c-surv').textContent = String(you);
  el('#mp-c-delta').textContent = saved > 0 ? `+${saved}` : String(saved);
  el('#mp-c-engine').textContent = `${fleet.hitsHome.engine} → ${fleet.hitsAll.engine}`;

  const savedPhrase =
    saved <= 2 ? 'almost none more than flying them bare' : `${saved} more than flying them bare`;
  el('#mp-revealbody').innerHTML =
    `Your armor brought home <b>${you}</b> of 400, ${savedPhrase}. The engines you could see took ` +
    `only <b>${fleet.hitsHome.engine}</b> hits, so you left them open; across the whole fleet they were ` +
    `hit <b>${fleet.hitsAll.engine}</b> times. That gap is every plane the engines downed before it could ` +
    `land to be counted, and it is the zone your map called safest.`;
}

function rewriteCaption() {
  const cap = svg.closest('figure')!.querySelector('figcaption');
  if (cap)
    cap.textContent =
      'Fig. 1 · the same fleet, now with the hits from the planes that never came home drawn in red. ' +
      'They flood the engines, the one zone the survivors made look clean. Nothing here is a record of a ' +
      'real raid; it is a simulation, and it is the arithmetic of a sample that filtered itself.';
}

// ── Repair · plate the engines and fly again ─────────────────────────────────

el('#mp-repair-btn').onclick = () => {
  el<HTMLButtonElement>('#mp-repair-btn').disabled = true;

  const correct = simulateFleet(SEED, armorOf('engine', 'tail'));
  const yourReturned = simulateFleet(SEED, armor).returned;
  const correctReturned = correct.returned;
  const more = correctReturned - yourReturned;

  // move the "you" mark to where the right armor lands
  el('#mp-you-mark').style.left = `${correct.survival * 100}%`;
  el('#mp-you-num').textContent = `engines plated: ${correctReturned} home`;

  el('#mp-repairline').innerHTML =
    `With the engines and tail plated instead, <b>${correctReturned}</b> of 400 come home, ` +
    `<b>${more > 0 ? more : 'about the same number'}</b>${more > 0 ? ' more' : ''} than your loadout brought back. ` +
    `The armor went where the map said there was nothing to protect.`;
  el('#mp-repairbody').hidden = false;

  unlock('#mp-debrief');
};

// ── Foot · send up a new, uncurated fleet ────────────────────────────────────

el('#mp-reset').onclick = () => {
  // A fresh seed and a full reload, the only reset with no chance of a stale
  // corner, and the same honesty the hero's rerun buys: the fleet is never chosen.
  const url = new URL(location.href);
  url.searchParams.set('seed', String(Math.floor(Math.random() * 1e9)));
  location.href = url.toString();
};

// ── boot ─────────────────────────────────────────────────────────────────────

el('#mp-prov').textContent = PROVENANCE;
el('#mp-caveat').textContent = CAVEAT;

scaffold = drawScaffold(svg);
drawMapAndCounts();
syncToggles();
