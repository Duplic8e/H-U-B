import { defineConfig, devices } from '@playwright/test'

// The app is served under the /ledger/ base path with hash routing, so every
// spec navigates to `/` relative to this baseURL and then sets the hash.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/ledger/',
    trace: 'retain-on-failure',
  },
  projects: [
    // mobile-guards.spec.ts is phone-only (tap-target size, touch tooltips,
    // no-horizontal-scroll); it runs under mobile-narrow and mobile-landscape
    // below, not under a desktop viewport where those checks are meaningless.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile-guards\.spec\.ts/ },
    // 320px is the narrowest screen still in real use and the width at
    // which the audit found nine clipped strings on the dashboard.
    {
      name: 'mobile-narrow',
      testMatch: /mobile-guards\.spec\.ts/,
      use: { ...devices['iPhone 12'], viewport: { width: 320, height: 700 } },
    },
    // Landscape is where the sidebar used to appear and swallow Settings.
    {
      name: 'mobile-landscape',
      testMatch: /mobile-guards\.spec\.ts/,
      use: { ...devices['iPhone 12 landscape'] },
    },
    // iPad portrait sits exactly on the `desktop` breakpoint, where the
    // sidebar takes 256px and the card grid drops to 2 columns. That is the
    // width at which the audit found account names rendering as one letter.
    {
      name: 'tablet',
      testMatch: /desktop-guards\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    // 932x430 is landscape on a Pro Max class phone and also any desktop
    // window zoomed past the point where the CSS viewport drops under 500px
    // tall. `md:` matches here and `desktop:` does not, which is what used to
    // render sheet headers twice.
    {
      name: 'short-wide',
      testMatch: /desktop-guards\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 932, height: 430 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
