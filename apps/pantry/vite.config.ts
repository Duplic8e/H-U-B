import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from <hub>/pantry/; the Hub workflow sets BASE_PATH and VITE_HUB_URL.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Pantry',
        short_name: 'Pantry',
        description: 'What is in the pantry',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,wasm}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Product photos are cached the first time each is shown, so the list looks the same offline.
        runtimeCaching: [{ urlPattern: /^https:\/\/images\.openfoodfacts\.org\//, handler: 'CacheFirst', options: { cacheName: 'pantry-product-photos', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 500 } } }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
