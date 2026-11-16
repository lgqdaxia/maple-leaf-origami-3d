import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const browserPath =
  process.env.BROWSER_EXECUTABLE ||
  [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].find(existsSync);
if (!browserPath)
  throw new Error(
    "Set BROWSER_EXECUTABLE to an installed Chromium-based browser.",
  );

const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
await server.listen();
const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function painted() {
  return page.locator("#scene canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return 0;
    const pixels = new Uint8Array(
      gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
    );
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    let count = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 10) count++;
    return count;
  });
}

async function requirePaint(label) {
  for (let i = 0; i < 30; i++) {
    if ((await painted()) > 200) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`3D canvas is empty ${label}`);
}

try {
  await page.goto(server.resolvedUrls.local[0], {
    waitUntil: "domcontentloaded",
  });
  await requirePaint("on initial load");
  if (!(await page.locator("#stage-step").textContent()).includes("34 / 34"))
    throw new Error("The finished maple leaf is not the initial view.");
  if (process.env.MAPLE_SCREENSHOT)
    await page
      .locator("#stage")
      .screenshot({ path: process.env.MAPLE_SCREENSHOT });
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-model").click();
  const download = await downloadPromise;
  const glb = await readFile(await download.path());
  if (
    glb.readUInt32LE(0) !== 0x46546c67 ||
    glb.readUInt32LE(4) !== 2 ||
    glb.readUInt32LE(8) !== glb.length
  )
    throw new Error("The final model download is not a valid GLB.");
  if (process.env.MAPLE_OUTPUT_DIR) {
    await mkdir(process.env.MAPLE_OUTPUT_DIR, { recursive: true });
    await writeFile(join(process.env.MAPLE_OUTPUT_DIR, "maple-leaf.glb"), glb);
    const png = await page
      .locator("#scene canvas")
      .evaluate((canvas) => canvas.toDataURL("image/png"));
    await writeFile(
      join(process.env.MAPLE_OUTPUT_DIR, "maple-leaf.png"),
      Buffer.from(png.split(",")[1], "base64"),
    );
  }
  await page.locator('[data-step="8"]').click();
  await page.waitForTimeout(700);
  await requirePaint("at step 8");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await requirePaint("after resizing to mobile");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(700);
  await requirePaint("after resizing back to desktop");
  await page.locator('[data-step="1"]').click();
  await page.waitForTimeout(700);
  const paperNoise = await page.locator("#scene canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const x = Math.floor(gl.drawingBufferWidth / 2), y = Math.floor(gl.drawingBufferHeight * 0.64);
    const differences = [];
    for (let row = y - 20; row < y + 20; row++) for (let col = x - 20; col < x + 19; col++) {
      const index = (row * gl.drawingBufferWidth + col) * 4;
      differences.push(Math.abs(pixels[index] - pixels[index + 4]));
    }
    differences.sort((a, b) => a - b);
    return differences[Math.floor(differences.length * 0.9)];
  });
  if (paperNoise > 3) throw new Error(`Overlapping paper has stippled surface shading (90th percentile: ${paperNoise}).`);
  await page.locator("#next").click();
  await page.waitForTimeout(350);
  if ((await page.locator("#play").getAttribute("aria-label")) !== "暂停")
    throw new Error("Next step did not start playback.");
  await page.locator("#play").click();
  if ((await page.locator("#play").getAttribute("aria-label")) !== "播放")
    throw new Error("Pause did not stop playback.");
  await page.locator("#play").click();
  await page.waitForFunction(() => document.querySelector("#completed")?.textContent === "2");
  await page.waitForTimeout(700);
  if ((await page.locator("#completed").textContent()) !== "2")
    throw new Error("Resuming one step unexpectedly continued playback.");
  for (let step = 9; step <= 34; step++) {
    await page.locator(`[data-step="${step - 1}"]`).click();
    await page.locator("#next").click();
    await page.waitForFunction(
      (n) => document.querySelector("#completed")?.textContent === String(n),
      step,
    );
    await requirePaint(`after playing step ${step}`);
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  console.log(
    "Browser: final maple visible, valid GLB download, desktop/mobile resize, pause and steps 9–34 playback passed.",
  );
} finally {
  await browser.close();
  await server.close();
}
