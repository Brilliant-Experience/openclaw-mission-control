import { expect, test, type Page } from "@playwright/test";

const BASE =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3030";
const E2E_SECRET = process.env.E2E_TEST_SECRET || "";

/**
 * Authenticate via the NextAuth Credentials provider (e2e-test).
 * This posts directly to the NextAuth signIn endpoint.
 */
async function authenticate(page: Page) {
  // Use NextAuth's built-in credentials sign-in endpoint
  await page.goto(`${BASE}/api/auth/signin/e2e-test`);

  // Fill in the secret field and submit
  const secretInput = page.locator('input[name="secret"]');
  if (await secretInput.isVisible({ timeout: 5000 })) {
    await secretInput.fill(E2E_SECRET);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard|\//, { timeout: 15000 });
  } else {
    // Fallback: POST directly via fetch
    const csrfRes = await page.request.get(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();

    await page.request.post(`${BASE}/api/auth/callback/e2e-test`, {
      form: {
        secret: E2E_SECRET,
        csrfToken,
      },
    });
    await page.goto(`${BASE}/dashboard`);
  }
}

// Links that are directly visible in the sidebar (no submenu expansion needed)
const SIDEBAR_LINKS = [
  "/dashboard",
  "/chat",
  "/agents",
  "/sessions",
  "/tasks",
  "/cron",
  "/memory",
  "/skills",
  "/models",
  "/usage",
  "/logs",
  "/config",
];

test.describe("Authenticated Mission Control", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!E2E_SECRET, "E2E_TEST_SECRET not set — skipping authenticated tests");
    await authenticate(page);
  });

  test("dashboard loads after authentication", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    // Should see the sidebar nav
    const sidebar = page.locator("nav").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test("sidebar is visible and has navigation links", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    const sidebar = page.locator("nav").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    for (const href of SIDEBAR_LINKS) {
      const link = sidebar.locator(`a[href="${href}"]`).first();
      await expect(
        link,
        `Missing sidebar link: ${href}`,
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("sidebar navigation works — each page loads without error", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`${BASE}/dashboard`);

    const sidebar = page.locator("nav").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    for (const href of SIDEBAR_LINKS) {
      await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
      // Should NOT redirect to login
      await expect(page).not.toHaveURL(/\/login/);
      // Should not show "Could not connect" error
      await expect(page.locator("main, [role='main'], body")).not.toContainText(
        /could not connect/i,
        { timeout: 5000 },
      );
    }
  });

  test("authenticated API calls succeed (not 401)", async ({ page }) => {
    // First authenticate to get the session cookie
    const apiEndpoints = [
      "/api/onboard",
      "/api/agents",
      "/api/system",
    ];

    for (const endpoint of apiEndpoints) {
      const response = await page.request.get(`${BASE}${endpoint}`, {
        failOnStatusCode: false,
      });
      expect(
        response.status(),
        `${endpoint} should not return 401, got ${response.status()}`,
      ).not.toBe(401);
    }
  });

  test("ops console toggle button is present", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.setViewportSize({ width: 1600, height: 1000 });
    // The ops console has a toggle button visible on the page
    const toggle = page.getByRole("button", { name: /ops console/i }).first();
    await expect(toggle).toBeVisible({ timeout: 10000 });
  });
});
