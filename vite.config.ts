import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// kuromoji's browser dictionary loader fetches these *.dat.gz files itself
// and gunzips them manually (see @sglkc/kuromoji's BrowserDictionaryLoader).
// Standard static-file middleware (including Vite's own) auto-sets
// `Content-Encoding: gzip` for anything ending in .gz, which makes the
// browser transparently decompress the response before kuromoji ever sees
// it — kuromoji's own gunzip then fails on the already-decompressed bytes
// ("invalid gzip data"). Intercept these specific paths and serve the raw
// bytes with no Content-Encoding so kuromoji's manual gunzip is the only
// decompression step, matching what a plain static host would send.
function serveKuromojiDictRaw(): Plugin {
  function handler(rootDir: string) {
    return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const url = req.url?.split('?')[0];
      if (url && /^\/dict\/[\w.-]+\.dat\.gz$/.test(url)) {
        const filePath = join(rootDir, url);
        if (existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/octet-stream');
          res.end(readFileSync(filePath));
          return;
        }
      }
      next();
    };
  }
  return {
    name: 'serve-kuromoji-dict-raw',
    configureServer(server) {
      server.middlewares.use(handler(resolve(server.config.root, server.config.publicDir)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler(resolve(server.config.root, server.config.build.outDir)));
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    serveKuromojiDictRaw(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: "Maiyun's Trip Planner",
        short_name: 'Trips',
        description: 'Personal travel itinerary companion',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
      },
      workbox: {
        runtimeCaching: [
          {
            // kuroshiro/kuromoji dictionary files (src/utils/kanjiReading.ts) —
            // fetched lazily on first "show reading" use, then cached so the
            // feature keeps working offline afterward.
            urlPattern: /\/dict\/.*\.dat\.gz$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kuroshiro-dict-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true, // required for file watching inside Docker on macOS
    },
  },
  preview: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // MUI/Emotion inject <style> tags at runtime
        "img-src 'self' data: blob: https://tiles.openfreemap.org",
        "font-src 'self'",
        "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://tiles.openfreemap.org",
        "worker-src 'self' blob:", // maplibre-gl workers + the PWA service worker
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; '),
    },
  },
});
