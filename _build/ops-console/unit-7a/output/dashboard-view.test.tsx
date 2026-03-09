import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DashboardView, budgetColor, budgetLabel, budgetLabelColor } from "./dashboard-view";

// ── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("../unit-3b/output/use-ops-context", () => ({
  useOpsContext: jest.fn(),
}));

const mockActivities = Array.from({ length: 15 }, (_, i) => ({
  id: `run-${i}`,
  type: "session",
  timestamp: Date.now() - i * 1000 * 60,
  title: `Run ${i}`,
  status: "ok" as const,
  source: "TestAgent",
}));

const mockBudget = {
  entries: [
    {
      envKey: "agent-1",
      agentLabel: "Agent One",
      data: { label: "Agent 1", usage: 5.0, limit: 10.0 },   // 50% → green
      status: "ok",
    },
    {
      envKey: "agent-2",
      agentLabel: "Agent Two",
      data: { label: "Agent 2", usage: 7.0, limit: 10.0 },   // 70% → amber
      status: "ok",
    },
    {
      envKey: "agent-3",
      agentLabel: "Agent Three",
      data: { label: "Agent 3", usage: 8.5, limit: 10.0 },   // 85% → red
      status: "ok",
    },
  ],
};

function setupFetch() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url === "/api/activity")
      return Promise.resolve({ json: () => Promise.resolve(mockActivities) });
    if (url === "/api/openrouter-budget")
      return Promise.resolve({ json: () => Promise.resolve(mockBudget) });
    return Promise.reject(new Error(`Unknown URL: ${url}`));
  });
}

// ── Unit tests for pure helper functions ─────────────────────────────────────

describe("budgetColor()", () => {
  it("returns green class at 50% spend (below 60% threshold)", () => {
    expect(budgetColor(0.5)).toBe("bg-emerald-500");
  });

  it("returns amber class at 70% spend (>= 60%, < 80%)", () => {
    expect(budgetColor(0.7)).toBe("bg-amber-500");
  });

  it("returns red class at 85% spend (>= 80%)", () => {
    expect(budgetColor(0.85)).toBe("bg-red-500");
  });

  it("returns green at the lower boundary (0%)", () => {
    expect(budgetColor(0)).toBe("bg-emerald-500");
  });

  it("returns amber exactly at 60% boundary", () => {
    expect(budgetColor(0.6)).toBe("bg-amber-500");
  });

  it("returns red exactly at 80% boundary", () => {
    expect(budgetColor(0.8)).toBe("bg-red-500");
  });

  it("returns red at 100%", () => {
    expect(budgetColor(1.0)).toBe("bg-red-500");
  });
});

describe("budgetLabel()", () => {
  it('returns "ON TRACK" at 50%', () => {
    expect(budgetLabel(0.5)).toBe("ON TRACK");
  });

  it('returns "NEAR LIMIT" at 70%', () => {
    expect(budgetLabel(0.7)).toBe("NEAR LIMIT");
  });

  it('returns "OVER BUDGET" at 85%', () => {
    expect(budgetLabel(0.85)).toBe("OVER BUDGET");
  });

  it('returns "NEAR LIMIT" exactly at 60% boundary', () => {
    expect(budgetLabel(0.6)).toBe("NEAR LIMIT");
  });

  it('returns "OVER BUDGET" exactly at 80% boundary', () => {
    expect(budgetLabel(0.8)).toBe("OVER BUDGET");
  });
});

describe("budgetLabelColor()", () => {
  it("returns green text class at 50%", () => {
    expect(budgetLabelColor(0.5)).toBe("text-emerald-500");
  });

  it("returns amber text class at 70%", () => {
    expect(budgetLabelColor(0.7)).toBe("text-amber-500");
  });

  it("returns red text class at 85%", () => {
    expect(budgetLabelColor(0.85)).toBe("text-red-500");
  });

  it("returns amber text class exactly at 60% boundary", () => {
    expect(budgetLabelColor(0.6)).toBe("text-amber-500");
  });

  it("returns red text class exactly at 80% boundary", () => {
    expect(budgetLabelColor(0.8)).toBe("text-red-500");
  });
});

// ── Integration / render tests ───────────────────────────────────────────────

describe("DashboardView", () => {
  beforeEach(() => {
    setupFetch();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the main heading", async () => {
    render(<DashboardView />);
    expect(await screen.findByText("Mission Control")).toBeInTheDocument();
  });

  it("renders budget hero cards", async () => {
    render(<DashboardView />);

    expect(await screen.findByText("Today's Spend")).toBeInTheDocument();
    expect(screen.getByText("Monthly Spend")).toBeInTheDocument();
    expect(screen.getByText("Budget Status")).toBeInTheDocument();
  });

  it("renders agent health chips — one per entry", async () => {
    render(<DashboardView />);

    for (const entry of mockBudget.entries) {
      expect(await screen.findByText(entry.agentLabel)).toBeInTheDocument();
    }
  });

  it("shows at most 10 rows in the activity table", async () => {
    render(<DashboardView />);

    // Wait for data to load
    await screen.findByText("Recent Activity");

    // Header row + up to 10 data rows = at most 11 rows total
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeLessThanOrEqual(11);
  });

  it("shows a 'View all' link when there are more than 10 activities", async () => {
    render(<DashboardView />);

    const viewAll = await screen.findByRole("link", { name: /view all/i });
    expect(viewAll).toBeInTheDocument();
    expect(viewAll).toHaveAttribute("href", "/activity");
  });

  it("renders the 'Open Ops Console' quick action with href='#'", async () => {
    render(<DashboardView />);

    await screen.findByText("Quick Actions");
    const link = screen.getByRole("link", { name: /open ops console/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#");
  });

  it("renders the 'View Briefing' quick action with correct href", async () => {
    render(<DashboardView />);

    await screen.findByText("Quick Actions");
    const link = screen.getByRole("link", { name: /view briefing/i });
    expect(link).toHaveAttribute("href", "/briefing");
  });

  it("progress bars reflect correct colour class for each spend band", async () => {
    render(<DashboardView />);

    // Wait for render
    await screen.findByText("Today's Spend");

    // The BudgetHeroCard progress bars use data-pct attributes set to the
    // fractional spend value so we can assert the correct colour class.
    const bars = screen
      .getAllByTestId("budget-progress-bar")
      .map(el => el.firstElementChild as HTMLElement);

    // Today's Spend: 20.5 / 25 = 0.82 → red
    // (mockBudget total: 5 + 7 + 8.5 = 20.5)
    const todayBar = bars[0];
    expect(todayBar.className).toContain("bg-red-500");

    // Monthly Spend: 20.5 * 22.5 = 461.25 / 500 = 0.9225 → red
    const monthlyBar = bars[1];
    expect(monthlyBar.className).toContain("bg-red-500");
  });

  it("calls /api/activity and /api/openrouter-budget on mount", async () => {
    render(<DashboardView />);

    await screen.findByText("Mission Control");

    expect(global.fetch).toHaveBeenCalledWith("/api/activity");
    expect(global.fetch).toHaveBeenCalledWith("/api/openrouter-budget");
  });
});
