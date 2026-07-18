import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
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
