/**
 * Copies @sglkc/kuromoji's dictionary files (dict/*.dat.gz) into public/dict/
 * so they're served as static assets at /dict/*.dat.gz (both `npm run dev`
 * and the production build), and can be picked up by the workbox
 * runtimeCaching rule in vite.config.ts. Runs via the "postinstall" script.
 *
 * Never fails npm install: contributors who haven't touched this feature
 * shouldn't have their install broken if this step has an issue.
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

try {
  const kuromojiPackageJson = require.resolve('@sglkc/kuromoji/package.json');
  const dictSourceDir = join(dirname(kuromojiPackageJson), 'dict');

  if (!existsSync(dictSourceDir)) {
    console.warn(`[copy-kuroshiro-dict] No dict/ directory found at ${dictSourceDir}, skipping.`);
    process.exit(0);
  }

  const dictDestDir = join(process.cwd(), 'public', 'dict');
  mkdirSync(dictDestDir, { recursive: true });

  const dictFiles = readdirSync(dictSourceDir).filter((file) => file.endsWith('.dat.gz'));
  for (const file of dictFiles) {
    copyFileSync(join(dictSourceDir, file), join(dictDestDir, file));
  }

  console.log(`[copy-kuroshiro-dict] Copied ${dictFiles.length} dict file(s) to public/dict/.`);
} catch (err) {
  console.warn(`[copy-kuroshiro-dict] Skipping dict copy: ${err.message}`);
  process.exit(0);
}
