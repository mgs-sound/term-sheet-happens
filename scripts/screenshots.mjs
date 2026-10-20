/**
 * Store screenshots: drives the game through the ?dev panel with a headless
 * browser and saves PNGs at store-friendly sizes. Not part of the app.
 *
 *   npm i -D playwright && npx playwright install chromium   (once)
 *   npm run dev                                               (in another tab)
 *   node scripts/screenshots.mjs                    (store set, both formats)
 *   node scripts/screenshots.mjs landscape          (one format)
 *   node scripts/screenshots.mjs portrait extras    (the extra screens too)
 *
 * Scenes that depend on luck (a winning minigame, a unicorn, a counter-offer)
 * are retried in a fresh game until they come out right.
 *
 * Output: screenshots/<format>/<scene>.png
 *   landscape → 3840×2160 (16:9; Steam / Mac — crop the sides for 16:10)
 *   portrait  → 1290×2796 (iPhone 6.7"/6.9" App Store size)
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5173/?dev';
const OUT = 'screenshots';

const FORMATS = {
  landscape: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 },
  portrait: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** In-page helpers: click a DEV panel button / any button by text. */
async function dev(page, label) {
  await page.evaluate(async (label) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (!document.querySelector('.dev-body')) {
      document.querySelector('.dev-toggle')?.click();
      await sleep(150);
    }
    const b = [...document.querySelectorAll('.dev-body button')].find((x) => x.textContent.trim() === label);
    if (!b) throw new Error(`dev button not found: ${label}`);
    b.click();
    await sleep(150);
    if (document.querySelector('.dev-body')) document.querySelector('.dev-toggle')?.click();
  }, label);
  await sleep(400);
}

async function click(page, pattern) {
  const ok = await page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const b = [...document.querySelectorAll('button')].find((x) => re.test(x.textContent ?? ''));
    b?.click();
    return Boolean(b);
  }, pattern);
  if (!ok) throw new Error(`button not found: /${pattern}/`);
  await sleep(700);
}

/** Taps a button N times with pointer events (minigames listen to pointerdown). */
async function tap(page, selector, times, gapMs) {
  for (let i = 0; i < times; i++) {
    await page.evaluate((sel) => {
      document.querySelector(sel)?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, isPrimary: true }),
      );
    }, selector);
    await sleep(gapMs);
  }
}

/** From the 5-year recap to the memorandum (skips the reveal if it's running). */
async function toScorecard(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => /^skip$/i.test(b.textContent?.trim() ?? ''))?.click();
  });
  await sleep(500);
  await click(page, 'to the scorecard');
  await sleep(3500); // DPI count-up lands
}

/** Into a Partner fund, first pitch card up. */
async function partnerRun(page) {
  await dev(page, 'partner');
  await click(page, 'take the meetings');
}

/** In-page: is the card on screen on-thesis? */
const isOnThesis = (page) => page.evaluate(() => Boolean(document.querySelector('.card-lift .thesis-tab')));

/** Pass cards until one matches `want` (on/off thesis). */
async function findCard(page, wantOnThesis, tries = 14) {
  for (let i = 0; i < tries; i++) {
    if ((await isOnThesis(page)) === wantOnThesis) return true;
    await page.evaluate(() => {
      // Resolve a mid-run interrupt (keep the reserves) if one pops up.
      const diluted = [...document.querySelectorAll('button')].find((b) => /get diluted/i.test(b.textContent ?? ''));
      diluted?.click();
      document.querySelector('button[aria-label="Pass on this deal"]')?.click();
    });
    await sleep(1000);
  }
  return (await isOnThesis(page)) === wantOnThesis;
}

/** Sets a React-controlled range slider to `t` (0..1 of its range). */
async function setSlider(page, index, t) {
  await page.evaluate(
    ([index, t]) => {
      const el = document.querySelectorAll('.sheet input[type="range"]')[index];
      if (!el) return;
      const min = Number(el.min);
      const max = Number(el.max);
      const v = (min + (max - min) * t).toFixed(1);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [index, t],
  );
  await sleep(200);
}

/** Flappy autopilot running inside the page (keeps flying after we return). */
const startFlappyPilot = (page) =>
  page.evaluate(() => {
    const gs = document.querySelectorAll('.flappy-art > g');
    const crane = [...gs].find((g) => g.querySelector('.crane-paper'));
    const btn = document.querySelector('.flappy-btn');
    const tris = [...document.querySelectorAll('.flappy-art path.flappy-tri')].map((p) => {
      const n = p.getAttribute('d').match(/-?[\d.]+/g).map(Number);
      return { x: n[0], tip: n[1], fromTop: n[3] < n[1] };
    });
    const flap = () => btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, isPrimary: true }));
    flap();
    let prevY = 500;
    let last = performance.now();
    const tick = () => {
      if (document.querySelector('.result-stamp')) return;
      const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(crane.getAttribute('transform'));
      const cx = +m[1];
      const y = +m[2];
      const i = tris.findIndex((o) => o.x + 150 > cx);
      const pair = i < 0 ? [] : tris.slice(Math.max(0, i - 1), i + 2);
      const top = Math.max(...pair.filter((o) => o.fromTop).map((o) => o.tip), 0);
      const bot = Math.min(...pair.filter((o) => !o.fromTop).map((o) => o.tip), 1000);
      if (y > (top + bot) / 2 + 20 && y >= prevY && performance.now() - last > 110) {
        flap();
        last = performance.now();
      }
      prevY = y;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

/**
 * Enrique's store set. Each returns false when luck didn't cooperate (the
 * scene is then retried in a fresh game).
 */
const STORE = {
  // Fund I: an on-thesis pitch dragged right, tilted, OFFER stamp fading in.
  '1-fund1-offer': async (p) => {
    await dev(p, 'fundI');
    await click(p, 'start using');
    await click(p, 'take the meetings');
    if (!(await findCard(p, true))) return false;
    await p.addStyleTag({ content: '.dev-panel { display: none !important; }' });
    const box = await p.locator('.card-lift').boundingBox();
    if (!box) return false;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await p.mouse.move(x, y);
    await p.mouse.down();
    for (let i = 1; i <= 10; i++) await p.mouse.move(x + i * 9, y + i * 1.5);
    await sleep(150);
    // Pose it: a gentle tilt that keeps the card in frame, OFFER stamp at full.
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find((n) => n.style?.transform?.includes('translateX'));
      if (el) el.style.transform = 'translateX(34px) rotate(5deg)';
      document.querySelectorAll('.stamp-offer').forEach((s) => (s.style.opacity = '1'));
    });
    await sleep(100);
    return 'hold'; // shoot mid-drag, don't release
  },
  // Fund II: an off-thesis deal mid-negotiation, the founder's counter on the table.
  '2-fund2-negotiation': async (p) => {
    await dev(p, 'associate');
    await click(p, 'take the meetings');
    if (!(await findCard(p, false))) return false;
    await click(p, 'draft terms');
    await click(p, '^negotiate$');
    await setSlider(p, 0, 0.75); // check
    await setSlider(p, 1, 0.3); // valuation: a lowball
    await click(p, 'send the offer');
    return p.evaluate(() => Boolean(document.querySelector('.counter-block')));
  },
  // Fund II: a partner-veto minigame, YOU WIN stamped on it.
  '3-fund2-partner-minigame-win': async (p) => {
    await dev(p, 'associate');
    await click(p, 'take the meetings');
    await dev(p, 'dice');
    await p.evaluate(() => document.querySelector('.challenge-actions button')?.click());
    await sleep(2100);
    return p.evaluate(() => /win/i.test(document.querySelector('.result-stamp')?.textContent ?? ''));
  },
  // Alt for 3: the sword in the stone, untouched (no taps, no stamp).
  '3b-sword-in-the-stone': async (p) => {
    await partnerRun(p);
    await dev(p, 'sword');
    await p.addStyleTag({ content: '.dev-panel { display: none !important; }' });
    await sleep(400);
    return p.evaluate(() => Boolean(document.querySelector('.sword-pull-btn')) && !document.querySelector('.result-stamp'));
  },
  // Fund II: the 5-year recap with a unicorn in it.
  '4-fund2-unicorn': async (p) => {
    await dev(p, 'associate');
    await click(p, 'take the meetings');
    await dev(p, 'autoplay');
    await sleep(800);
    await p.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /^skip$/i.test(b.textContent?.trim() ?? ''))?.click();
    });
    await sleep(900);
    return p.evaluate(() => {
      const u = document.querySelector('.label-unicorn');
      u?.closest('li')?.scrollIntoView({ block: 'center' });
      return Boolean(u);
    });
  },
  // Partner fund: a skill minigame mid-play (flappy crane between the triangles).
  '5-fund3-skill-minigame': async (p) => {
    await dev(p, 'partner');
    await click(p, 'take the meetings');
    await dev(p, 'flappy');
    await p.addStyleTag({ content: '.dev-panel { display: none !important; }' });
    await startFlappyPilot(p);
    await sleep(1700);
    return p.evaluate(() => !document.querySelector('.result-stamp'));
  },
  // Partner fund closed: stay at your firm, or take the sealed offers?
  '6-fund3-stay-or-leave': async (p) => {
    await dev(p, 'partner');
    await click(p, 'take the meetings');
    await dev(p, 'autoplay');
    await dev(p, 'all met');
    await dev(p, '1.2x');
    await toScorecard(p);
    await click(p, 'what now');
    return p.evaluate(() => Boolean(document.querySelector('.rehire-stay:not(.is-locked)')));
  },
};

/** The rest of the game, for variety (`extras`). */
const EXTRAS = {
  'x-profile': async (p) => dev(p, 'fundI'),
  'x-offer-letter': async (p) => dev(p, 'partner'),
  'x-terms-board-seat': async (p) => {
    await partnerRun(p);
    await click(p, 'draft terms');
    await p.evaluate(() => {
      const cb = document.querySelector('.seat-label input');
      if (cb && !cb.checked) cb.click();
    });
  },
  'x-sword': async (p) => {
    await partnerRun(p);
    await dev(p, 'sword');
    await tap(p, '.sword-pull-btn', 18, 90);
  },
  'x-wheel': async (p) => {
    await partnerRun(p);
    await dev(p, 'wheel');
  },
  'x-cranes': async (p) => {
    await partnerRun(p);
    await dev(p, 'crane');
    await sleep(2600);
  },
  'x-scorecard': async (p) => {
    await partnerRun(p);
    await dev(p, 'autoplay');
    await dev(p, '2.5x');
    await toScorecard(p);
  },
  'x-resignation': async (p) => {
    await partnerRun(p);
    await dev(p, 'autoplay');
    await dev(p, '−0.15x (fired)');
    await toScorecard(p);
    await click(p, 'what now');
  },
  'x-enlightenment': async (p) => {
    await dev(p, 'gate');
    await click(p, 'take the meetings');
    await dev(p, 'autoplay');
    await dev(p, '3.4x+gate');
    await toScorecard(p);
    await click(p, 'what now');
  },
};

const ATTEMPTS = 25;
const args = process.argv.slice(2);
const onlyFormat = args.find((a) => a in FORMATS);
const allScenes = args.includes('extras') ? { ...STORE, ...EXTRAS } : STORE;
// Any other arg filters scenes by name prefix, e.g. `npm run screenshots -- 1 5`.
const filters = args.filter((a) => !(a in FORMATS) && a !== 'extras');
const scenes = filters.length
  ? Object.fromEntries(Object.entries(allScenes).filter(([k]) => filters.some((f) => k.startsWith(f))))
  : allScenes;

const browser = await chromium.launch();
for (const [format, options] of Object.entries(FORMATS)) {
  if (onlyFormat && onlyFormat !== format) continue;
  await mkdir(`${OUT}/${format}`, { recursive: true });
  for (const [name, run] of Object.entries(scenes)) {
    let done = false;
    for (let attempt = 1; attempt <= ATTEMPTS && !done; attempt++) {
      // A fresh context per try: clean save, a new random game.
      const context = await browser.newContext(options);
      const page = await context.newPage();
      try {
        await page.goto(URL, { waitUntil: 'networkidle' });
        await sleep(800);
        const result = await run(page);
        if (result === false) continue;
        // Hide the dev panel in the shot (already hidden mid-drag scenes).
        await page.addStyleTag({ content: '.dev-panel { display: none !important; }' });
        if (result !== 'hold') await sleep(300);
        await page.screenshot({ path: `${OUT}/${format}/${name}.png` });
        console.log(`✓ ${format}/${name}.png${attempt > 1 ? ` (try ${attempt})` : ''}`);
        done = true;
      } catch (err) {
        if (attempt === ATTEMPTS) console.log(`✗ ${format}/${name}: ${err.message}`);
      } finally {
        await context.close();
      }
    }
    if (!done) console.log(`✗ ${format}/${name}: no luck in ${ATTEMPTS} tries`);
  }
}
await browser.close();
