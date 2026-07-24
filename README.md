# Statistical Illusions

An anthology of statistical illusions: the same numbers, made to say opposite things, by you.

> Nobody has to lie for a number to mislead you. Here, you do it yourself.

Live at **[illusions.dustincoledata.com](https://illusions.dustincoledata.com)**.

This repo is public on purpose. The piece claims that every number in it is computed in the
reader's browser while they read, with no dataset and no server behind it. On a piece arguing that
the damage came from method nobody could see, an unverifiable claim about our own method would be a
small version of the same sin, so the method is here to check rather than asserted.

## Hard constraints

These define the piece, not just the build. Breaking one does not only break a rule, it breaks the
argument.

- No API, no data vendor, no paid service.
- **No dataset, no fetch, no backend, no cron.** Roughly fifty inline constants across the whole
  anthology; everything else is computed live.
- Fully in-browser computed, verified by a seeded reproduction gate rather than assumed.
- Static site, low upkeep. The only maintenance surface is citation link rot.

## Stack

Astro 5, static output, no UI framework. Astro owns the shared chrome, the routes, the prose, the
font pipeline and the build-time OG cards. Exhibit logic is a plain ES module plus one imperatively
drawn SVG: one figure redrawn in about a millisecond does not need a virtual DOM, and a 40KB runtime
is a poor thing to ship on a page whose credential is "computed in your browser, viewable in
source."

Fonts are self-hosted via `@fontsource` (Archivo 400/500/600, Fragment Mono 400, latin subset only).

```
npm install
npm run dev        # verify in a browser; this is the check that counts
npm test           # fast, every commit
npm run verify     # the reproduction gate, ~13s
npm run build      # runs verify first, and fails on drift
```

Node 22.

## Verification

The load-bearing claim of this piece is that a browser with no dataset and no server behind it
independently reproduces a published result. That claim is checked rather than asserted, which is
part of why this repo is public.

`npm test` pins the statistics core against values that exist outside this repo — the t-table
criticals, Γ at the factorials — then pins the illusion itself: each subgroup filter, each outlier
rule, the path enumeration, an order-sensitive checksum over every p-value in a fixed-seed garden,
and the finding sentence including its computed direction.

`npm run verify` re-runs the ticket-06 simulation against the code that actually ships, and
**fails the build on drift**. Every row is checked twice: an exact count against a pinned golden,
which is deterministic because the simulation is seeded, and the derived percentage against the
figure the piece publishes, so a future re-pin cannot quietly walk a number away from its claim.

| Assertion | Published figure |
|---|---|
| Three measures, at least one significant path | 92.0% |
| One measure only | 59.7%, against a published 60.7% |
| A single path fixed in advance | 4.7%, nominal 5% |
| No significant path anywhere at n = 40 | 8.2% |
| Uncooperative samples rescued at n = 50 / 60 / 70 | 41% / 62% / 75% |

The gate runs seeds 1..N; the reader's live 600-study sweep runs a different seed family and shows
its own margin of error. Agreement between two families is worth more than agreement with itself.
A wrong degrees-of-freedom or a trim off by one produces numbers that still look entirely
plausible, which is exactly why this cannot be a matter of reading the output and nodding.

## Routes

| Route | What it is |
|---|---|
| `/` | The hub essay, plus a live teaser of Illusion 01 |
| `/the-forking-paths` | Illusion 01, the full exhibit |
| `/sources` | Every primary source, grouped by illusion |

Illusions 02 to 04 ship later, as prose paragraphs of the argument in the hub essay until then.

## The graduation contract

Illusions 02 to 04 must each land as **a new route plus a rule set, never a shell edit.** That only
holds in code if the shell exposes a real interface, so here it is.

- **`src/lib/illusions.ts` is one array.** Adding an illusion to the site is one entry plus one
  page. The chrome list, the current-page marker and the foot nav all read from it.
- **`layouts/Shell.astro`** takes `{ title, description, illusion? }`, where `illusion` is the
  registry entry carrying `number`, `name`, `mechanism` (composed into the kicker) and `lede`. It
  renders the chrome, the editorial container, the gutter and the foot nav. **The scaffold order is
  fixed in the layout**: Shell declares the seven named slots in order, and a page fills them
  without being able to reorder them.
- **`components/Slot.astro`** renders any of the seven slots. It does not know which one it is. Slot
  1 (Frame) is the only one that passes a heading and a lede.
- **`components/Figure.astro`** owns the SVG frame, the readout live region, the legend and caption
  rails, the `aria-label` on the `<svg>` and the reduced-motion switch, which it publishes as
  `data-motion` on the frame. It does not own the marks: a controller looks up the id and draws.
  **There is exactly one chart component on this site.** The Reveal transforms the same visual; the
  hub teaser is the same component in another mode.
- **`components/Sidenote.astro`** is the right-gutter citation, collapsing inline under 900px.
- **`src/lib/stats.ts`** and **`src/lib/rng.ts`** are illusion-agnostic. Illusion 04 imports the
  same core. An illusion's own rule set lives beside its controller instead — for Illusion 01 that
  is `src/scripts/forking-paths.model.ts`, a pure module with no DOM in it, which is what makes the
  numbers testable rather than trapped inside an event handler.

**A new exhibit that requires editing `Shell.astro` is the signal that the contract broke.**

The numbering is the author's route, never a prerequisite chain. No exhibit may reference another
having been read or assume vocabulary taught elsewhere; every exhibit teaches its own terms in its
Frame slot. That is what makes each one shareable standalone and lets them graduate in any order.

## The seven slots

Fixed order, every slot required.

| # | Slot | Job |
|---|---|---|
| 1 | Frame | Orient a cold arrival. Assumes zero prior reading. |
| 2 | Setup | Put the numbers on the table honestly. The illusion must survive full disclosure. |
| 3 | Operate | The reader builds the illusion. Every knob carries a real published justification. |
| 4 | Commit | The reader locks a decision before seeing the truth. One-way, always after Operate. |
| 5 | Reveal | Same numbers, opposite conclusion, on the same visual. |
| 6 | Repair | The honest version of the same move. Non-negotiable. |
| 7 | Debrief | What was absent from the table, who caught this, and one honest caveat. |

## Author

Dustin Cole, [dustincoledata.com](https://dustincoledata.com).
