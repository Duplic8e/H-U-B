/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The standalone site lives at /ledger/. The Hub build serves Ledger from a
// sub-path of its own site and passes that path in BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/ledger/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // The chart library (recharts and friends) is kept out of the eager
      // entry graph two ways: nothing on the always-mounted Command Palette
      // path imports a component that pulls in recharts (see
      // scripts/check-eager-graph.mjs, which fails the build if that is ever
      // undone), and the Dashboard/Planner widgets that do use recharts are
      // React.lazy-loaded. Naming those chunks with a `charts-` prefix used
      // to rely on manual `codeSplitting.groups` entries for `charts` and
      // `charts-vendor`, but that API force-links every declared group's
      // chunk into the entry for this rolldown version regardless of true
      // reachability, which defeated the whole point once the entry no
      // longer actually needed recharts. The `charts-` naming is done in
      // output.chunkFileNames below instead, which only affects the
      // filename, not what gets linked into the entry. The chart chunk is
      // now genuinely deferred, but it is still kept in the PWA precache
      // deliberately: e2e/offline.spec.ts guards against a blank page when
      // offline before the runtime cache has filled in, and re-excluding
      // the chart chunk from precache to chase the "on demand" ideal would
      // need a new e2e case proving no such regression, which was not
      // attempted here.
      manifest: {
        name: 'Ledger',
        short_name: 'Ledger',
        description: 'A highly scalable, cross-platform financial dashboard',
        // Only the install-time default. The runtime value is kept in step
        // with the active theme by the theme effect in src/App.tsx.
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192x192-v2.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512-v2.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512x512-maskable-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/worktrees/**', 'e2e/**'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Vite's `manualChunks` function is translated by rolldown into a
        // single dynamic-name codeSplitting group, which silently merged the
        // recharts-only redux/immer modules back into the `charts` chunk
        // instead of honoring the separate name returned for them. Using
        // `codeSplitting.groups` directly (rolldown's non-deprecated,
        // documented API) gives each named chunk its own group so the split
        // actually takes effect.
        //
        // recharts and its redux/immer/d3/victory-vendor dependencies are
        // deliberately NOT declared as a codeSplitting group here (unlike
        // motion/vendor-react/vendor-router below). For this rolldown
        // version, a codeSplitting.groups entry force-links its chunk into
        // the entry unconditionally, regardless of whether anything on the
        // entry's actual import graph still reaches it. That was harmless
        // while recharts truly was eagerly reachable (via the Command
        // Palette's planner tool registry), but once that reachability was
        // fixed (see scripts/check-eager-graph.mjs), the group declaration
        // itself became the thing keeping the chart chunk linked into the
        // entry. Leaving recharts out of codeSplitting.groups lets
        // rolldown's default chunking correctly defer it; the `charts-`
        // filename prefix (for naming and precache-matching purposes) is
        // applied in chunkFileNames below instead, which affects only the
        // output filename, not what gets linked into the entry.
        codeSplitting: {
          groups: [
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom)[\\/]/,
              priority: 2,
            },
            {
              // react-dom and react-router-dom are on every route from
              // first paint, so pulling them out of the entry chunk into a
              // dedicated vendor chunk keeps the app's own code (the
              // actual entry) under budget without changing what loads on
              // first visit.
              name: 'vendor-react',
              test: /node_modules[\\/](react-dom|react|scheduler|use-sync-external-store)[\\/]/,
              priority: 1,
            },
            {
              name: 'vendor-router',
              test: /node_modules[\\/]react-router[\\/]/,
              priority: 1,
            },
          ],
        },
        // recharts's own module graph (recharts itself, d3-*, victory-vendor,
        // and its redux/immer/reselect state management) is not declared as
        // a codeSplitting group (see the comment above) so rolldown's
        // default chunking decides where those modules land based on true
        // reachability. This chunkFileNames hook only renames whichever
        // chunk(s) end up containing those modules to a `charts-` prefixed
        // name, so scripts/check-bundle.mjs and the PWA precache matching
        // that expect a `charts-*.js` chunk keep working.
        chunkFileNames: (chunkInfo) => {
          const CHART_MODULE_RE = /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|@reduxjs[\\/]toolkit|redux|redux-thunk|react-redux|reselect|immer)[\\/]/
          const isChartChunk = chunkInfo.moduleIds.some((id) => CHART_MODULE_RE.test(id))
          return isChartChunk ? 'assets/charts-[name]-[hash].js' : 'assets/[name]-[hash].js'
        },
      },
    },
  }
})
