// tools/screenshot.mjs — Chụp ảnh tĩnh các trạng thái / biểu cảm bằng Chromium headless.
// Dùng:  node tools/screenshot.mjs [outDir] [baseUrl]
// Cần:   npm i playwright-core  (hoặc playwright) ; server tĩnh:  python3 -m http.server 8765
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'docs/images';
const base = process.argv[3] || 'http://127.0.0.1:8765/character/index.html';
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
mkdirSync(out, { recursive: true });

const SHOTS = [
  ['idle_front',  { state: 'idle', t: 0.3, cam: 'front' }],
  ['idle_tq',     { state: 'idle', t: 0.3, cam: 'tq' }],
  ['idle_side',   { state: 'idle', t: 0.3, cam: 'side' }],
  ['idle_back',   { state: 'idle', t: 0.3, cam: 'back' }],
  ['walk',        { state: 'walk', t: 0.12, cam: 'tq' }],
  ['run',         { state: 'run', t: 0.08, cam: 'tq' }],
  ['jump',        { state: 'jump', t: 0.5, cam: 'tq', lift: 1.0 }],
  ['roll',        { state: 'roll', t: 0.42, cam: 'side' }],
  ['slide',       { state: 'slide', t: 0.5, cam: 'side' }],
  ['fly',         { state: 'fly', t: 0.2, cam: 'side', lift: 1.3 }],
  ...['neutral','happy','laugh','sad','angry','surprised','scared','sleepy','love','wink','silly','focus','excited','wow']
    .map((f) => ['face_' + f, { state: 'idle', t: 0.3, cam: 'face', face: f }]),
];

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 560 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

for (const [name, q] of SHOTS) {
  const url = base + '?ui=0&' + new URLSearchParams(q).toString();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  await page.screenshot({ path: join(out, name + '.png') });
  console.log('ok', name);
}
await browser.close();
