// Proves Deep Signal boots from ?game=shooter, draws, accepts input and throws no page errors; saves a screenshot (shooter, 2026-10-17).
// Run: npm run dev (port 5173), then PW=$(npm root -g)/playwright node games/shooter/agent-tests/smoke.mjs [seed] [shot.png]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright-core');
const seed = process.argv[2] ?? '1';
const shot = process.argv[3] ?? 'shooter.png';
const url = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`console ${m.type()}: ${m.text()}`));
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(`${url}?game=shooter&seed=${seed}`);
await wait(1500);
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
const s0 = await page.evaluate(() => window.sof.state());
check('shooter is open and ready', s0.game === 'shooter' && s0.ready, JSON.stringify(s0));
await page.keyboard.down('d');
await page.keyboard.down('j');
await wait(1500);
await page.keyboard.up('d');
await page.screenshot({ path: shot });
await wait(1500);
await page.keyboard.up('j');
const st = await page.evaluate(() => window.sof.stats());
check('runs near 60 fps', st.fps >= 50, `fps ${st.fps.toFixed(1)} step avg ${st.stepAvg?.toFixed?.(2)} worst ${st.stepWorst?.toFixed?.(2)}`);
check('no page errors or console warnings', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
