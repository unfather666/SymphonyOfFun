// Proves the launcher boots at ~60 fps, opens each stub game, returns via the pause menu, and ?crash=1 shows the crash screen (core/launcher, 2026-10-17).
// Run: npm run dev (port 5173) then PW=/path/to/node_modules/playwright-core node agent-tests/launcher-smoke.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright-core');
const URL = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const state = () => page.evaluate(() => window.sof.state());
const wait = (ms) => page.waitForTimeout(ms);
const key = async (k) => { await page.keyboard.press(k); await wait(120); };
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

await page.goto(URL);
await wait(2500);
const fps = (await page.evaluate(() => window.sof.stats())).fps;
check('launcher fps >= 55', fps >= 55, `fps ${fps.toFixed(1)}`);
check('title screen', (await state()).screen === 'title');
await key('Enter');
check('games screen after Enter', (await state()).screen === 'games');
await page.screenshot({ path: process.env.SHOT ?? 'launcher.png' });
for (const [i, id] of ['shooter', 'racer', 'mrfart'].entries()) {
  for (let k = 0; k < i; k++) await key('ArrowRight');
  await key('Enter');
  await wait(300);
  let s = await state();
  check(`${id} opens`, s.game === id && s.ready, JSON.stringify(s));
  await key('Escape');
  check(`${id} pauses on Esc`, (await state()).paused);
  await key('ArrowDown');
  await key('Enter');
  s = await state();
  check(`${id} back to launcher`, s.game === null && s.screen === 'games', JSON.stringify(s));
}
await page.goto(URL + '?game=racer&crash=1');
await wait(800);
const cs = await state();
check('crash guard returns to launcher crash screen', cs.game === null && cs.screen === 'crash', JSON.stringify(cs));
await key('Enter');
check('crash screen dismisses to games', (await state()).screen === 'games');
check('no page errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
