/**
 * Generates PWA manifest icon PNGs from src/assets/app-icon.svg.
 * Reuses the playwright devDependency (already used by scripts/dast.mjs)
 * instead of adding an image-processing library just for this.
 *
 * Usage: npm run generate:icons
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SVG_PATH = resolve(ROOT, 'src/assets/app-icon.svg');
const OUT_DIR = resolve(ROOT, 'public/icons');
const SIZES = [192, 512];

const svg = readFileSync(SVG_PATH, 'utf-8');

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

try {
  for (const size of SIZES) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.setContent(
      `<!doctype html><html><head><style>
        html, body { margin: 0; padding: 0; background: transparent; }
        svg { display: block; width: ${size}px; height: ${size}px; }
      </style></head><body>${svg}</body></html>`,
    );
    const outPath = resolve(OUT_DIR, `icon-${size}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
    await page.close();
    console.log(`  wrote ${outPath}`);
  }
} finally {
  await browser.close();
}
