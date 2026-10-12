import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "../scripts/backend.sh --packaged",
      url: "http://127.0.0.1:8080/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "npm run preview -- --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
  reporter: "list",
});
