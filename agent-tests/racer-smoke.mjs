// Proves the racer boots in headless Chromium, draws with few calls, holds ~60 fps (optionally 4x CPU throttle) and survives driving (racer, 2026-10-17).
// Run: npm run dev, then PW=/path/to/node_modules/playwright-core [LEVEL=1] [SEED=1] [THROTTLE=4] [SECS=12] [SHOT=out.png [SHOT_EVERY=20]] [EXTRA=&bot=1] node agent-tests/racer-smoke.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright-core');
const URL = `${process.env.URL ?? 'http://localhost:5173/'}?game=racer&seed=${process.env.SEED ?? 1}&level=${process.env.LEVEL ?? 1}${process.env.EXTRA ?? ''}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
if (process.env.THROTTLE) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
}
await page.goto(URL);
await page.waitForTimeout(1500);
const bot = /bot=1/.test(process.env.EXTRA ?? '');
if (!bot) await page.keyboard.down('j');
const secs = Number(process.env.SECS ?? 12);
const samples = [];
for (let i = 0; i < secs; i++) {
  if (!bot) await page.keyboard.down(i % 4 < 2 ? 'ArrowLeft' : 'ArrowRight');
  await page.waitForTimeout(500);
  if (!bot) await page.keyboard.up(i % 4 < 2 ? 'ArrowLeft' : 'ArrowRight');
  await page.waitForTimeout(500);
  samples.push(await page.evaluate(() => ({ ...window.sof.stats(), ...window.sofRacer.info() })));
  if (process.env.SHOT && (process.env.SHOT_EVERY ? i % Number(process.env.SHOT_EVERY) === Number(process.env.SHOT_EVERY) - 1 : i === Math.floor(secs / 2))) await page.screenshot({ path: process.env.SHOT_EVERY ? process.env.SHOT.replace('.png', `-${i + 1}.png`) : process.env.SHOT });
}
const last = samples[samples.length - 1];
const avg = (k) => samples.reduce((a, s) => a + s[k], 0) / samples.length;
const worst = Math.max(...samples.map((s) => s.stepWorst));
console.log(JSON.stringify({ ahead: last.ahead, beat: last.beat, song: last.song, bars: last.bars, url: URL, throttle: process.env.THROTTLE ?? 1, fps: avg('fps').toFixed(1), stepAvg: avg('stepAvg').toFixed(3), stepWorst: worst.toFixed(3), drawAvg: avg('drawAvg').toFixed(3), calls: last.calls, tris: last.tris, dist: Math.round(last.s), deaths: last.deaths, phase: last.phase, minFps: Math.min(...samples.map((x) => x.fps)).toFixed(1), errors }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
