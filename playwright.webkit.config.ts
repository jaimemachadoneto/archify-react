import { defineConfig, devices } from "@playwright/test";

// Optional: it runs only the test of the edge dot in WebKit, where the defect of the first frame was seen.
// It needs the WebKit browser (`pnpm exec playwright install webkit`), and the CI does not run it.
// Run it with `pnpm exec playwright test -c playwright.webkit.config.ts`.
export default defineConfig({
  testDir: "e2e",
  testMatch: /playground\.spec\.ts/,
  grep: /edge dot/,
  use: { baseURL: "http://localhost:5183" },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
  webServer: {
    command: "pnpm dev --port 5183 --strictPort",
    port: 5183,
    reuseExistingServer: true,
  },
});
