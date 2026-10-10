import { defineConfig } from "@playwright/test";
import { platform } from "node:os";

const python = platform() === "win32" ? "../backend/.venv/Scripts/python.exe" : "../backend/.venv/bin/python";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5174", headless: true, screenshot: "only-on-failure" },
  webServer: [
    {
      command:
        `${python} -m uvicorn tests.browser_server:app --app-dir ../backend --host 127.0.0.1 --port 8001`,
      url: "http://127.0.0.1:8001/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174",
      url: "http://127.0.0.1:5174",
      env: { VITE_API_BASE_URL: "http://127.0.0.1:8001", VITE_DEMO_MODE: "false" },
      reuseExistingServer: false,
    },
  ],
});
