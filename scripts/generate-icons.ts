/**
 * Rasterize the app logo (src/app/icon.svg) into the PNG sizes PWA installs
 * need: regular launcher icons, a full-bleed maskable icon, and the iOS
 * apple-touch-icon. Run with:
 *
 *   npx tsx scripts/generate-icons.ts
 *
 * Uses playwright-core (already a devDependency); point CHROMIUM_PATH at a
 * Chromium/Chrome binary if auto-discovery doesn't find one.
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const LOGO = readFileSync(path.join(ROOT, 'src/app/icon.svg'), 'utf8');

// The leaf glyph from icon.svg without the rounded-rect background, viewBox 0 0 20 20.
const GLYPH = `
  <path d="M10 17C10 11 13 5 18 3C18 10 15 15 10 17Z" fill="#C9A22B"/>
  <path d="M10 17C10 12 8 7 2 5C2 11 5 15 10 17Z" fill="#7FB88B"/>
  <path d="M10 17V9" stroke="#FAF8F2" stroke-width="1.4" stroke-linecap="round"/>`;

/** Full-bleed square (edge-to-edge background) — the OS applies its own mask/corners. */
function fullBleedSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#17402B"/>
  <g transform="translate(15.2 15.2) scale(1.68)">${GLYPH}</g>
</svg>`;
}

async function render(page: import('playwright-core').Page, svg: string, size: number, out: string) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>*{margin:0;padding:0}</style><div style="width:${size}px;height:${size}px">${svg.replace(
      /width="\d+" height="\d+"/,
      `width="${size}" height="${size}"`
    )}</div>`
  );
  const png = await page.screenshot({ omitBackground: true });
  writeFileSync(path.join(ROOT, out), png);
  console.log(`wrote ${out} (${size}x${size}, ${png.length} bytes)`);
}

async function main() {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
  const page = await browser.newPage();

  // Launcher icons keep the rounded-rect look on transparency.
  await render(page, LOGO, 192, 'public/icon-192.png');
  await render(page, LOGO, 512, 'public/icon-512.png');
  // Maskable + iOS icons must be full-bleed; the platform crops its own shape.
  await render(page, fullBleedSvg(512), 512, 'public/icon-maskable-512.png');
  await render(page, fullBleedSvg(180), 180, 'src/app/apple-icon.png');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
