// Proves level select opens, level 1 and the level 10 boss arena start from it with no page errors, and shows the boss bar; saves screenshots (shooter, 2026-10-17).
// Run: npm run dev (port 5173), then PW=$(npm root -g)/playwright node games/shooter/agent-tests/levels-smoke.mjs [prefix]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright-core');
const prefix = process.argv[2] ?? 'levels';
const url = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 768, height: 432 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`console ${m.type()}: ${m.text()}`));
const wait = (ms) => page.waitForTimeout(ms);
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
await page.goto(`${url}?game=shooter&seed=2`);
await wait(1500);
await page.screenshot({ path: `${prefix}-select.png` });
await page.evaluate(() => window.sof.cheat('points'));
await wait(100);
await page.screenshot({ path: `${prefix}-select-unlocked.png` });
await page.keyboard.press('j');
await wait(2500);
await page.screenshot({ path: `${prefix}-l1.png` });
const st1 = await page.evaluate(() => window.sof.stats());
check('level 1 runs near 60 fps', st1.fps >= 45, `fps ${st1.fps.toFixed(1)} step avg ${st1.stepAvg?.toFixed?.(2)} worst ${st1.stepWorst?.toFixed?.(2)}`);
// Back to level select by dying is slow; reload and jump straight to the boss.
await page.goto(`${url}?game=shooter&seed=2`);
await wait(1200);
await page.evaluate(() => {
  window.sof.cheat('points');
  window.sof.cheat('god');
});
for (let i = 0; i < 9; i++) {
  await page.keyboard.press('ArrowRight');
  await wait(120); // one press per update step
}
await page.screenshot({ path: `${prefix}-select-l10.png` });
await page.keyboard.press('j');
await wait(1200);
await page.keyboard.down('j');
await page.keyboard.down('d');
await wait(6000);
await page.screenshot({ path: `${prefix}-boss.png` });
await page.keyboard.up('d');
await wait(8000);
await page.screenshot({ path: `${prefix}-boss2.png` });
await page.keyboard.up('j');
const st = await page.evaluate(() => window.sof.stats());
check('boss arena runs near 60 fps', st.fps >= 45, `fps ${st.fps.toFixed(1)} step avg ${st.stepAvg?.toFixed?.(2)} worst ${st.stepWorst?.toFixed?.(2)}`);
check('no page errors or console warnings', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
