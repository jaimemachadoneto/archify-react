import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the dev server: `pnpm e2e`. The ui-reviewer
// agent uses the screenshots they write to test-results/.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:5173" },
  projects: [
    { name: "light", use: { ...devices["Desktop Chrome"], colorScheme: "light" } },
    { name: "dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
  ],
  webServer: {
    command: "pnpm dev --port 5173 --strictPort",
    port: 5173,
    reuseExistingServer: true,
  },
});
