import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const browserPath = process.env.BROWSER_EXECUTABLE || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find(existsSync);
if (!browserPath) throw new Error('Set BROWSER_EXECUTABLE to an installed Chromium-based browser.');

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: browserPath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function painted() {
  return page.locator('#scene canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 0;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let count = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 10) count++;
    return count;
  });
}

async function requirePaint(label) {
  for (let i = 0; i < 30; i++) {
    if (await painted() > 200) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`3D canvas is empty ${label}`);
}

try {
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  await requirePaint('on initial load');
  await page.locator('[data-step="8"]').click();
  await page.waitForTimeout(700);
  await requirePaint('at step 8');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await requirePaint('after resizing to mobile');
  if (process.env.MAPLE_SCREENSHOT) await page.locator('#stage').screenshot({ path: process.env.MAPLE_SCREENSHOT });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(700);
  await requirePaint('after resizing back to desktop');
  await page.locator('[data-step="1"]').click();
  await page.locator('#next').click();
  await page.waitForTimeout(350);
  if (await page.locator('#play').getAttribute('aria-label') !== '暂停') throw new Error('Next step did not start playback.');
  await page.locator('#play').click();
  if (await page.locator('#play').getAttribute('aria-label') !== '播放') throw new Error('Pause did not stop playback.');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log('Browser: model visible, desktop/mobile resize, step selection and pause passed.');
} finally {
  await browser.close();
  await server.close();
}
