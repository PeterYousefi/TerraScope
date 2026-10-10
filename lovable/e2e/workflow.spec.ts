import { test, expect } from "@playwright/test";

test("preserved landing navigation and persisted Austin workflow with TEST fixtures", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Investigate", exact: true }).first()).toBeVisible();
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
  // Check visible map markers where the public basemap successfully loads.
  if (await page.getByRole("button", { name: /^Candidate 1:/ }).count()) {
    await page.getByRole("button", { name: /^Candidate 1:/ }).click();
    await expect(
      page.getByText("calculated screening proxy", { exact: false }).first(),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: /ZONE-.*estimated people/i })
    .first()
    .click();
  await expect(page.getByText("TEST FIXTURE", { exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: /Open full report/ }).click();
  await expect(page.getByRole("heading", { name: "Candidate ranking" })).toBeVisible();
  await expect(page.getByText("Inspect normalized source records and identifiers")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Candidate ranking" })).toBeVisible();
  await page.getByRole("link", { name: "Compare candidates" }).click();
  await expect(page.getByRole("heading", { name: "Compare candidate locations." })).toBeVisible();
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
