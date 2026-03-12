import { expect, test, type Page } from "@playwright/test";

const BASE =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3030";
const E2E_SECRET = process.env.E2E_TEST_SECRET || "";

async function authenticate(page: Page) {
  // Get CSRF token
  const csrfRes = await page.request.get(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();

  // Sign in via POST to the e2e-test credentials callback
  await page.request.post(`${BASE}/api/auth/callback/e2e-test`, {
    form: {
      secret: E2E_SECRET,
      csrfToken,
    },
    maxRedirects: 0,
  }).catch(() => {});

  // The session cookie is now set — navigate to verify
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

const SIDEBAR_LINKS: Array<{ href: string; urlPattern: RegExp }> = [
  { href: "/dashboard", urlPattern: /\/dashboard(?:\?|$)/ },
  { href: "/chat", urlPattern: /\/chat(?:\?|$)/ },
  { href: "/channels", urlPattern: /\/channels(?:\?|$)/ },
  { href: "/agents", urlPattern: /\/agents(?:\?|$)/ },
  { href: "/tasks", urlPattern: /\/tasks(?:\?|$)/ },
  { href: "/sessions", urlPattern: /\/sessions(?:\?|$)/ },
  { href: "/cron", urlPattern: /\/cron(?:\?|$)/ },
  { href: "/memory", urlPattern: /\/memory(?:\?|$)/ },
  { href: "/documents", urlPattern: /\/documents(?:\?|$)/ },
  { href: "/vectors", urlPattern: /\/vectors(?:\?|$)/ },
  { href: "/skills", urlPattern: /\/skills(?:\?|$)/ },
  { href: "/models", urlPattern: /\/models(?:\?|$)/ },
  { href: "/accounts", urlPattern: /\/accounts(?:\?|$)/ },
  { href: "/audio", urlPattern: /\/audio(?:\?|$)/ },
  { href: "/browser", urlPattern: /\/browser(?:\?|$)/ },
  { href: "/search", urlPattern: /\/search(?:\?|$)/ },
  { href: "/tailscale", urlPattern: /\/tailscale(?:\?|$)/ },
  { href: "/usage", urlPattern: /\/usage(?:\?|$)/ },
  { href: "/terminal", urlPattern: /\/terminal(?:\?|$)/ },
  { href: "/logs", urlPattern: /\/logs(?:\?|$)/ },
  { href: "/config", urlPattern: /\/config(?:\?|$)/ },
];

const KEY_APIS = [
  "/api/live",
  "/api/system",
  "/api/channels?scope=status",
  "/api/agents",
  "/api/models?scope=status",
  "/api/audio",
  "/api/vector?scope=status",
  "/api/permissions",
  "/api/skills",
  "/api/heartbeat",
  "/api/cron?action=targets",
];

test.describe("Mission Control smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!E2E_SECRET, "E2E_TEST_SECRET not set — skipping");
    await authenticate(page);
  });

  test("sidebar routes open without load-failure banners", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`${BASE}/dashboard`);

    const sidebar = page.locator("nav").first();
    await expect(sidebar).toBeVisible();

    for (const entry of SIDEBAR_LINKS) {
      const link = sidebar.locator(`a[href="${entry.href}"]`).first();
      await expect(link, `Missing sidebar link: ${entry.href}`).toBeVisible();
      await page.goto(`${BASE}${entry.href}`, { waitUntil: "domcontentloaded" });
      await expect(page, `Unexpected URL after opening ${entry.href}`).toHaveURL(entry.urlPattern);
      await expect(page.locator("main")).not.toContainText(/failed to load/i, { timeout: 3000 });
    }
  });

  test("key APIs respond without server errors", async ({ page }) => {
    // page context carries the auth session cookie
    for (const endpoint of KEY_APIS) {
      const response = await page.request.get(`${BASE}${endpoint}`, { failOnStatusCode: false });
      expect(
        response.status(),
        `${endpoint} returned status ${response.status()}`
      ).toBeLessThan(500);
      const payload = await response.json();
      expect(payload, `${endpoint} returned empty JSON payload`).toBeTruthy();
    }
  });
});
