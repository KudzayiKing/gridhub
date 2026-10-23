import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * The suite is deliberately small and split into two kinds of test:
 *
 *   1. Public-surface tests that pass with no environment variables at all. These are the
 *      ones that can run in CI on a bare checkout.
 *   2. Authenticated flows, which are skipped unless E2E_EMAIL / E2E_PASSWORD style
 *      credentials are supplied. A test that silently passes because it never actually
 *      signed in is worse than no test.
 *
 * See docs/TESTING.md for what is still missing.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
