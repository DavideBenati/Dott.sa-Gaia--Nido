import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  projects: [
    {
      name: "mobile-web",
      testMatch: "mobile.spec.ts",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        baseURL: process.env.MOBILE_URL || "http://127.0.0.1:8081",
      },
    },
    {
      name: "admin",
      testMatch: "admin.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.ADMIN_URL || "http://127.0.0.1:3000",
      },
    },
  ],
  webServer: [
    {
      command: "npm run web --workspace @nido/mobile -- --port 8081",
      url: "http://127.0.0.1:8081",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        EXPO_OFFLINE: "1",
        EXPO_NO_TELEMETRY: "1",
        XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || "/workspace/.cache",
      },
    },
    {
      command:
        "npm run dev --workspace @nido/admin -- --hostname 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
