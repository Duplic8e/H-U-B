import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { APPS } from './src/apps';

// GitHub Pages serves the site from /<repo-name>/. The deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Hub',
        short_name: 'Hub',
        description: 'One home for all my helpers',
        display: 'standalone',
        start_url: './',
        // The whole site, so opening a helper from the Hub stays inside the installed app.
        scope: './',
        theme_color: '#0d1014',
        background_color: '#0d1014',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        // Each helper has its own service worker and offline cache. The Hub's must never answer for them.
        navigateFallbackDenylist: APPS.map((app) => new RegExp(`/${app.id}/`)),
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
