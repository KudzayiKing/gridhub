import { expect, test } from "@playwright/test";

/**
 * Public-surface smoke tests.
 *
 * These run with no environment variables, no account and no database, so they are safe to
 * run on a bare checkout. They assert structure (a page rendered, a heading exists, the
 * expected route resolved) rather than exact copy, because copy changes far more often than
 * the thing being protected here: that the route exists and renders.
 */

const PUBLIC_ROUTES = [
  "/",
  "/tools",
  "/free-tools",
  "/collections",
  "/pricing",
  "/how-it-works",
  "/offline",
  "/about",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/refund-policy",
];

for (const route of PUBLIC_ROUTES) {
  test(`public route ${route} renders`, async ({ page }) => {
    const response = await page.goto(route);

    expect(response, `no response for ${route}`).not.toBeNull();
    expect(response!.status(), `${route} did not return 200`).toBe(200);

    // Every marketing page must have a visible top-level heading. A blank page that returns
    // 200 is the failure this catches.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
}

test("public free calculator pages render without an account", async ({ page }) => {
  const slugs = [
    "debt-payoff-calculator",
    "monthly-budget-calculator",
    "rental-property-calculator",
    "savings-goal-calculator",
    "profit-margin-calculator",
    "invoice-total-calculator",
  ];

  for (const slug of slugs) {
    const response = await page.goto(`/free-tools/${slug}`);
    expect(response!.status(), `/free-tools/${slug} did not return 200`).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
});

test("tool detail page renders for every catalog slug", async ({ page }) => {
  // These are the `slug` values from lib/catalog.ts, not the tool ids. They differ:
  // the id is "budget", the marketing slug is "annual-budget-planner".
  const slugs = [
    "annual-budget-planner",
    "paycheck-budget-planner",
    "debt-payoff-tracker",
    "savings-goals",
    "net-worth-tracker",
    "small-business-bookkeeping",
    "inventory-management",
    "sales-revenue-tracker",
    "invoice-manager",
    "cash-flow-forecast",
    "wedding-planner",
    "rental-property-manager",
    "calorie-tracker",
    "project-management",
    "habit-tracker",
    "social-media-content-planner",
  ];

  for (const slug of slugs) {
    const response = await page.goto(`/tools/${slug}`);
    expect(response!.status(), `/tools/${slug} did not return 200`).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
});

test("pricing lists all five tiers", async ({ page }) => {
  await page.goto("/pricing");

  for (const tier of ["Free", "Single", "Plus", "Pro", "Unlimited"]) {
    await expect(page.getByText(tier, { exact: true }).first()).toBeVisible();
  }
});

test("unknown routes return 404", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response!.status()).toBe(404);
});

test("unknown tool slug returns 404", async ({ page }) => {
  const response = await page.goto("/tools/not-a-real-tool");
  expect(response!.status()).toBe(404);
});

test("workspace is reachable or correctly gated", async ({ page }) => {
  await page.goto("/app");

  // With no Supabase configuration the app runs in local-only mode and /app renders.
  // With Supabase configured and no session, middleware redirects to /login.
  // Both are correct; a 500 or a blank page is not.
  expect(page.url()).toMatch(/\/(app|login)/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("theme toggle does not break the page", async ({ page }) => {
  await page.goto("/");

  const before = await page.locator("html").getAttribute("class");

  // The toggle is a dropdown; open it and pick dark if the control is present.
  const toggle = page.getByRole("button", { name: /theme/i }).first();
  if (await toggle.count()) {
    await toggle.click();
    const dark = page.getByRole("menuitem", { name: /dark/i }).first();
    if (await dark.count()) {
      await dark.click();
      await expect(page.locator("html")).toHaveClass(/dark/);
    }
  }

  // Whatever happened, the document must still be interactive and the heading visible.
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  expect(before === null || typeof before === "string").toBe(true);
});
