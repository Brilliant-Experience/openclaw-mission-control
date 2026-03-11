import { expect, test } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3030";

test.describe("Google OAuth auth", () => {
  test("unauthenticated visit to /dashboard redirects to /login", async ({
    page,
  }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("login page renders with Google sign-in button", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    const button = page.getByRole("button", { name: /sign in with google/i });
    await expect(button).toBeVisible();
  });

  test("login page shows Mission Control branding", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByText("Mission Control")).toBeVisible();
    await expect(
      page.getByText("Dark Ops Intelligence Center"),
    ).toBeVisible();
    await expect(
      page.getByText("Restricted to Brilliant Experience accounts"),
    ).toBeVisible();
  });

  test("unauthenticated API calls return 401", async ({ request }) => {
    const endpoints = [
      "/api/agents",
      "/api/gateway",
      "/api/system",
      "/api/models",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${BASE}${endpoint}`, {
        failOnStatusCode: false,
      });
      expect(
        response.status(),
        `${endpoint} should return 401, got ${response.status()}`,
      ).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    }
  });

  test("NextAuth callback route is accessible (not blocked by middleware)", async ({
    request,
  }) => {
    // The callback route should not return 401 — it's in PUBLIC_PATHS
    const response = await request.get(
      `${BASE}/api/auth/callback/google`,
      { failOnStatusCode: false },
    );
    // Should get a redirect or error from NextAuth (not our 401 middleware)
    expect(response.status()).not.toBe(401);
  });

  test("Google sign-in button initiates OAuth flow", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    const button = page.getByRole("button", { name: /sign in with google/i });

    // Click and check it navigates toward Google OAuth
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/auth/signin/google") ||
          r.url().includes("accounts.google.com"),
        { timeout: 10000 },
      ).catch(() => null),
      button.click(),
    ]);

    // Should navigate away from login page (toward Google or NextAuth signin)
    await page.waitForTimeout(2000);
    const url = page.url();
    const navigatedAway =
      url.includes("accounts.google.com") ||
      url.includes("/api/auth/signin") ||
      url.includes("/api/auth/callback");

    expect(
      navigatedAway,
      `Expected OAuth redirect, but stayed at: ${url}`,
    ).toBe(true);
  });
});
