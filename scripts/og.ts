/**
 * Build-time OG cards. satori -> SVG -> resvg -> PNG, one per ship-1 route.
 *
 * Font trap (spec §2.2): Archivo's normal distribution is a variable font and
 * satori's opentype.js parser crashes on its `fvar` table. `@fontsource`
 * already ships static per-weight instances, so `og-fonts/` holds copies of
 * those (not the variable original) — gitignored, build-only, never served.
 *
 * `loadSystemFonts: false` matters for the same reason it did on Namesake and
 * Where America Moves: satori vectorizes every glyph to an SVG `<path>`, so
 * there is no `<text>` left for resvg to shape. Without the flag, resvg scans
 * the whole Windows font database first — about 2s per image instead of 65ms.
 *
 * Run: `npm run og`. Output (public/og/*.png) is committed; og-fonts/ is not.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { ILLUSIONS, kickerOf } from '../src/lib/illusions.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = join(ROOT, 'og-fonts');
const OUT_DIR = join(ROOT, 'public', 'og');
const W = 1200;
const H = 630;

// The locked palette (src/styles/tokens.css) — copied, not imported: this
// script runs outside Astro, against plain CSS-in-JS-shaped objects.
const BG = '#F8F9FA';
const INK = '#16181D';
const MUTED = '#565C68';
const FAINT = '#8A909C';
const LINE = '#E6E8EC';
const ACCENT = '#4A3AAB';
const ACCENT_SOFT = '#EDEBF7';
const NULL_C = '#2E9E96';
const THRESH = '#9A968D';
const SIG_1 = '#EBA23C';
const SIG_2 = '#E1583F';
const SIG_3 = '#C42E1A';

interface CardOpts {
  kicker?: string;
  title: string;
  description: string;
}

// The p-curve field, stylised: a fixed brand mark for the card, not a redraw
// of any exhibit's live data. Dots climb from calm teal to hot red crossing
// the p = .05 line, with one indigo ring for "the reader's own mark" — the
// same visual grammar as Figure.astro, reused as a signature rather than a
// second chart (the site's one-chart rule governs the reader's experience,
// not this build-time social-share asset).
function fieldMark() {
  const fieldW = 1040;
  const fieldH = 72;
  const baseY = 46;
  const threshX = 760;
  const dots = [
    60, 110, 165, 210, 260, 305, 350, 400, 450, 495, 540, 585, 630, 670, 705,
    740, 790, 835, 880, 925, 965, 1000,
  ];
  const colorFor = (x: number) => {
    if (x < threshX) return NULL_C;
    const t = (x - threshX) / (fieldW - threshX);
    if (t < 0.35) return SIG_1;
    if (t < 0.7) return SIG_2;
    return SIG_3;
  };
  const circles = dots.map((x, i) => {
    const c = colorFor(x);
    const hot = c === SIG_3;
    const r = 5 + (i % 3);
    return [
      hot &&
        { type: 'circle', props: { cx: x, cy: baseY, r: r + 7, fill: c, opacity: 0.14 } },
      { type: 'circle', props: { cx: x, cy: baseY, r, fill: c } },
    ];
  });
  return {
    type: 'svg',
    props: {
      width: fieldW,
      height: fieldH,
      viewBox: `0 0 ${fieldW} ${fieldH}`,
      children: [
        {
          type: 'line',
          props: {
            x1: threshX, y1: 4, x2: threshX, y2: fieldH - 4,
            stroke: THRESH, strokeWidth: 1.5, strokeDasharray: '5 4',
          },
        },
        ...circles.flat().filter(Boolean),
        // the reader's own mark: an indigo ring around one significant dot
        { type: 'circle', props: { cx: 835, cy: baseY, r: 12, fill: 'none', stroke: ACCENT_SOFT, strokeWidth: 4 } },
        { type: 'circle', props: { cx: 835, cy: baseY, r: 6, fill: ACCENT } },
      ],
    },
  };
}

function cardTree({ kicker, title, description }: CardOpts) {
  const children: any[] = [
    {
      type: 'div',
      props: {
        style: { display: 'flex', fontFamily: 'Fragment Mono', fontSize: 17, letterSpacing: 2, color: FAINT, textTransform: 'uppercase' },
        children: 'Statistical Illusions · nobody has to lie',
      },
    },
  ];

  if (kicker) {
    children.push({
      type: 'div',
      props: {
        style: { display: 'flex', marginTop: 46, fontFamily: 'Fragment Mono', fontSize: 18, letterSpacing: 2, color: MUTED, textTransform: 'uppercase' },
        children: kicker,
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex', marginTop: kicker ? 18 : 54,
        fontFamily: 'Archivo', fontWeight: 600, fontSize: 74, lineHeight: 1.08,
        letterSpacing: -1.5, color: INK, maxWidth: 1040,
      },
      children: title,
    },
  });

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex', marginTop: 22,
        fontFamily: 'Archivo', fontWeight: 400, fontSize: 27, lineHeight: 1.45,
        color: MUTED, maxWidth: 900,
      },
      children: description,
    },
  });

  return {
    type: 'div',
    props: {
      style: {
        width: W, height: H, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '64px 80px',
        background: BG, fontFamily: 'Archivo',
      },
      children: [
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column' }, children } },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex', flexDirection: 'column', gap: 14,
              borderTop: `1px solid ${LINE}`, paddingTop: 20,
            },
            children: [
              fieldMark(),
              {
                type: 'div',
                props: {
                  style: { display: 'flex', fontFamily: 'Fragment Mono', fontSize: 16, color: FAINT, letterSpacing: 1 },
                  children: 'illusions.dustincoledata.com',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function render(opts: CardOpts, fonts: satori.SatoriOptions['fonts']) {
  const svg = await satori(cardTree(opts) as any, { width: W, height: H, fonts });
  return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
}

async function main() {
  const [archivo400, archivo500, archivo600, fragmentMono400] = await Promise.all([
    readFile(join(FONT_DIR, 'archivo-400.woff')),
    readFile(join(FONT_DIR, 'archivo-500.woff')),
    readFile(join(FONT_DIR, 'archivo-600.woff')),
    readFile(join(FONT_DIR, 'fragment-mono-400.woff')),
  ]);
  const fonts: satori.SatoriOptions['fonts'] = [
    { name: 'Archivo', data: archivo400, weight: 400, style: 'normal' },
    { name: 'Archivo', data: archivo500, weight: 500, style: 'normal' },
    { name: 'Archivo', data: archivo600, weight: 600, style: 'normal' },
    { name: 'Fragment Mono', data: fragmentMono400, weight: 400, style: 'normal' },
  ];

  await mkdir(OUT_DIR, { recursive: true });

  const forkingPaths = ILLUSIONS[0]!;
  const routes: Array<{ slug: string; opts: CardOpts }> = [
    {
      slug: 'index',
      opts: {
        title: 'Statistical Illusions',
        description: 'Nobody has to lie for a number to mislead you. Here, you do it yourself.',
      },
    },
    {
      slug: 'the-forking-paths',
      opts: {
        kicker: kickerOf(forkingPaths),
        title: forkingPaths.name,
        description: forkingPaths.lede!,
      },
    },
    {
      slug: 'sources',
      opts: {
        title: 'Sources',
        description: 'Every primary source behind Statistical Illusions, grouped by illusion.',
      },
    },
  ];

  for (const { slug, opts } of routes) {
    const png = await render(opts, fonts);
    await writeFile(join(OUT_DIR, `${slug}.png`), png);
    console.log(`wrote public/og/${slug}.png (${(png.length / 1024).toFixed(1)}KB)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
