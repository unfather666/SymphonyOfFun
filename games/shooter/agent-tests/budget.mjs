// Measures the shooter step under a 4x CPU throttle with 200 enemies and 512 bullets alive (dev cheat 'stress'); prints the numbers for docs/budgets.md (shooter, 2026-10-17).
// Run: npm run dev, then PW=$(npm root -g)/playwright URL=http://localhost:5173/ node games/shooter/agent-tests/budget.mjs [shot.png]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright-core');
const url = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 768, height: 432 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const loads = [];
page.on('console', (m) => m.text().includes('stress load') && loads.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(`${url}?game=shooter&seed=5`);
await wait(1200);
await page.evaluate(() => window.sof.cheat('points'));
await page.keyboard.press('j');
await wait(1200);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.evaluate(() => window.sof.cheat('stress'));
await wait(6000);
const warm = await page.evaluate(() => window.sof.stats());
await page.keyboard.down('j');
await page.keyboard.down('d');
await wait(8000);
const st = await page.evaluate(() => window.sof.stats());
if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
console.log(JSON.stringify({ warm, st }));
console.log('last load:', loads.slice(-1)[0] ?? 'none logged');
console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'no page errors');
await browser.close();
