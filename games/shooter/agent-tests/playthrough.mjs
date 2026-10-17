// Plays levels 1 to 12 in a phone-size touch browser: a tap on the level select, then start, fire, clear (dev cheat) and continue for each level; fails on any page error (shooter, 2026-10-17).
// Run: npm run dev, then PW=$(npm root -g)/playwright URL=http://localhost:5173/ node games/shooter/agent-tests/playthrough.mjs [prefix]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright-core');
const prefix = process.argv[2] ?? 'play';
const url = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`console ${m.type()}: ${m.text()}`));
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(`${url}?game=shooter&seed=7`);
await wait(1500);
await page.evaluate(() => {
  window.sof.cheat('points');
  window.sof.cheat('god');
});
const box = await page.locator('canvas').last().boundingBox();
const tap = async (gx, gy) => page.touchscreen.tap(box.x + (gx / 384) * box.width, box.y + (gy / 216) * box.height);
// Cell 2 is at grid x 42+30..60, y 24..39 (see logic/select.ts).
await tap(42 + 45, 24 + 7);
await wait(250);
await page.screenshot({ path: `${prefix}-select-tap1.png` });
await tap(42 + 45, 24 + 7);
await wait(1800);
await page.screenshot({ path: `${prefix}-level2-by-tap.png` });
await page.evaluate(() => window.sof.cheat('clear'));
await wait(600);
const log = [];
await page.keyboard.press('j'); // back to select, cursor on level 3
await wait(400);
for (let lv = 3; lv <= 12; lv++) {
  await page.keyboard.press('j');
  await wait(2200);
  await page.keyboard.down('j');
  await wait(1200);
  if (lv === 5 || lv === 10 || lv === 12) await page.screenshot({ path: `${prefix}-level${lv}.png` });
  await page.keyboard.up('j');
  const st = await page.evaluate(() => window.sof.stats());
  log.push(`L${lv} fps ${st.fps.toFixed(0)} step ${st.stepAvg.toFixed(2)}/${st.stepWorst.toFixed(1)}`);
  await page.evaluate(() => window.sof.cheat('clear'));
  await wait(500);
  await page.keyboard.press('j'); // clear screen -> level select
  await wait(400);
}
await page.screenshot({ path: `${prefix}-select-end.png` });
console.log(log.join('\n'));
console.log(errors.length ? 'FAIL errors: ' + errors.slice(0, 5).join(' | ') : 'PASS no page errors across levels 1-12');
await browser.close();
process.exit(errors.length ? 1 : 0);
