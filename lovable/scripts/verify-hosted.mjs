import { chromium, expect } from "@playwright/test";

const base = process.argv[2] || "http://127.0.0.1:8002";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${base}/api/health`, { timeout: 5000 })).ok();
        } catch {
          return false;
        }
      },
      { timeout: 30000 },
    )
    .toBe(true);
  const health = await page.request.get(`${base}/api/health`);
  expect(health.ok()).toBe(true);
  expect((await health.json()).status).toBe("ok");
  await page.goto(base);
  await expect(page.getByRole("link", { name: "Investigate", exact: true }).first()).toBeVisible();
  await page.goto(`${base}/investigate`);
  await expect(page.locator("#q")).toBeVisible();
  await expect(page.getByText("Setup required:", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Investigate", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: /View Austin demo report/ })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const blocked = await page.request.post(`${base}/api/investigations`, {
    data: { question: "Where should I open an EV charging station in Austin?" },
  });
  expect(blocked.status()).toBe(503);
  expect((await blocked.json()).detail).toContain("NLR_API_KEY");
  await page.goto(`${base}/investigations/austin-ev`);
  await expect(page.getByRole("heading", { name: "Candidate ranking" })).toBeVisible();
  await expect(page.getByText("Demo data", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Candidate ranking" })).toBeVisible();
  await page.goto(`${base}/compare?inv=austin-ev`);
  await expect(page.getByRole("heading", { name: "Compare candidate locations." })).toBeVisible();
  expect(failures).toEqual([]);
  console.log(
    `Hosted smoke passed: ${base} (health, SPA routes, API, labeled demo, reload, comparison)`,
  );
} finally {
  await browser.close();
}
