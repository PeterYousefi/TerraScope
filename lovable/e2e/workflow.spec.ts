import { test, expect } from "@playwright/test";

// Opt-in documentation captures reuse the asserted API workflow, never live-data claims.
const captureDocs = process.env.CAPTURE_DOCS === "true";

async function screenshot(page: import("@playwright/test").Page, name: string) {
  if (!captureDocs) return;
  await page.evaluate(() => document.fonts.ready);
  if (name !== "landing") {
    await expect(page.getByRole("button", { name: /^Candidate 1:/ }).first()).toBeVisible();
    await expect(page.getByText("Loading basemap…", { exact: false })).toHaveCount(0);
    await page.evaluate(() => {
      document.querySelectorAll("*").forEach((element) => {
        if (element.scrollTop) element.scrollTop = 0;
      });
      window.scrollTo(0, 0);
    });
  }
  await page.screenshot({ path: `../docs/screenshots/${name}.png`, fullPage: true });
}

test("preserved landing navigation and persisted Austin workflow with TEST fixtures", async ({
  page,
}) => {
  if (captureDocs) await page.setViewportSize({ width: 1440, height: 1000 });
  // Keep routine acceptance independent of public tile service uptime.
  await page.route("https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          { id: "test-background", type: "background", paint: { "background-color": "#f7f7f7" } },
        ],
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Investigate", exact: true }).first()).toBeVisible();
  await screenshot(page, "landing");
  await page.getByRole("link", { name: "Investigate", exact: true }).first().click();
  await expect(page.locator("#q")).toBeVisible();
  await expect(page.getByText("Setup required:", { exact: false })).toBeVisible();
  await page.locator("#q").fill("Where should I open a new EV charging station in Austin?");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByText("Execution activity · completed_with_warnings")).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("Statistical summary:", { exact: false })).toBeVisible();
  await expect(page.getByText("Test partial OSM failure", { exact: false }).first()).toBeVisible();
  const firstCandidate = page.getByRole("button").filter({ hasText: "Opportunity area" }).first();
  await firstCandidate.click();
  await expect(page.getByText("population:", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("estimated people", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Candidate 1:/ })).toBeVisible();
  await page.getByRole("button", { name: /^Candidate 1:/ }).click();
  await expect(
    page.getByText("calculated screening proxy", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /ZONE-.*estimated people/i })
    .first()
    .click();
  await expect(page.getByText("TEST FIXTURE", { exact: false }).first()).toBeVisible();
  await screenshot(page, "investigation");
  await page.getByRole("link", { name: /Open full report/ }).click();
  await expect(page.getByRole("heading", { name: "Candidate ranking" })).toBeVisible();
  await screenshot(page, "report");
  await expect(page.getByText("Inspect normalized source records and identifiers")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Candidate ranking" })).toBeVisible();
  await page.getByRole("link", { name: "Compare candidates" }).click();
  await expect(page.getByRole("heading", { name: "Compare candidate locations." })).toBeVisible();
  await screenshot(page, "comparison");
  await page.screenshot({ path: "test-results/connected-comparison.png", fullPage: true });
});

test("backend unavailable displays connection error without demo fallback", async ({ page }) => {
  await page.route("http://127.0.0.1:8001/api/**", (route) => route.abort("failed"));
  await page.goto("/investigate");
  await expect(page.getByRole("alert")).toContainText("Cannot connect to SiteSignal backend");
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot connect");
});
