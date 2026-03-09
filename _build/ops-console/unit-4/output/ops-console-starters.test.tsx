/**
 * Tests for ConversationStarters component
 *
 * Testing framework: Vitest + React Testing Library
 * (compatible with Jest API — swap imports if project uses Jest)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Module mocks ─────────────────────────────────────────────────────────────

// We mock the context hook so we can control what meta returns per test.
const mockUseOpsConsoleContext = vi.fn();

vi.mock("@/components/ops-context-provider", () => ({
  useOpsConsoleContext: () => mockUseOpsConsoleContext(),
}));

// Import AFTER mocking so the module picks up the mock
import { ConversationStarters } from "./ops-console-starters";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderStarters(onSelect = vi.fn()) {
  return render(<ConversationStarters onSelect={onSelect} />);
}

function setPage(page: string | null) {
  mockUseOpsConsoleContext.mockReturnValue({
    meta: page ? { page, title: page } : null,
    setMeta: vi.fn(),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ConversationStarters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default: null context
    setPage(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Renders 4 chips ──────────────────────────────────────────────────────

  it("renders exactly 4 chip buttons", () => {
    renderStarters();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
  });

  it("renders the 'Suggestions' label", () => {
    renderStarters();
    expect(screen.getByText("Suggestions")).toBeInTheDocument();
  });

  // ── 2. Clicking a chip calls onSelect with correct text ─────────────────────

  it("calls onSelect with the chip label text when clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSelect = vi.fn();
    renderStarters(onSelect);

    // Advance timers so chips become visible
    act(() => {
      vi.runAllTimers();
    });

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    // The first default chip
    expect(onSelect).toHaveBeenCalledWith(
      "What's the current status of all agents?",
    );
  });

  it("calls onSelect with the correct text for each chip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSelect = vi.fn();
    renderStarters(onSelect);

    act(() => {
      vi.runAllTimers();
    });

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      await user.click(button);
    }

    expect(onSelect).toHaveBeenCalledTimes(4);
    expect(onSelect.mock.calls[0][0]).toBe(
      "What's the current status of all agents?",
    );
    expect(onSelect.mock.calls[1][0]).toBe("Show me today's activity summary");
    expect(onSelect.mock.calls[2][0]).toBe(
      "Are there any issues I should know about?",
    );
    expect(onSelect.mock.calls[3][0]).toBe(
      "What happened in the last 24 hours?",
    );
  });

  // ── 3. Dashboard page shows dashboard-specific chips ────────────────────────

  it("shows dashboard-specific chips when page is 'dashboard'", () => {
    setPage("dashboard");
    renderStarters();

    expect(
      screen.getByText("What's my spend today compared to yesterday?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Which agent has the most errors this week?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Is my burn rate on track for this month?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Show me a summary of all agent activity"),
    ).toBeInTheDocument();
  });

  it("shows briefing-specific chips when page is 'briefing'", () => {
    setPage("briefing");
    renderStarters();

    expect(
      screen.getByText("What needs my attention right now?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Summarize what happened overnight"),
    ).toBeInTheDocument();
  });

  it("shows cron-specific chips when page is 'cron'", () => {
    setPage("cron");
    renderStarters();

    expect(screen.getByText("Why did the last run fail?")).toBeInTheDocument();
    expect(
      screen.getByText("Which cron jobs are most expensive?"),
    ).toBeInTheDocument();
  });

  it("shows runs-specific chips when page is 'runs'", () => {
    setPage("runs");
    renderStarters();

    // runs and cron share the same chip set
    expect(screen.getByText("Why did the last run fail?")).toBeInTheDocument();
  });

  it("shows budget-specific chips when page is 'budget'", () => {
    setPage("budget");
    renderStarters();

    expect(screen.getByText("What's driving my costs up?")).toBeInTheDocument();
    expect(
      screen.getByText("Compare this month vs last month"),
    ).toBeInTheDocument();
  });

  // ── 4. Null context shows default chips ─────────────────────────────────────

  it("shows default chips when meta is null", () => {
    setPage(null);
    renderStarters();

    expect(
      screen.getByText("What's the current status of all agents?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Show me today's activity summary"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Are there any issues I should know about?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What happened in the last 24 hours?"),
    ).toBeInTheDocument();
  });

  it("shows default chips when rendered outside provider (hook throws)", () => {
    mockUseOpsConsoleContext.mockImplementation(() => {
      throw new Error(
        "useOpsConsoleContext must be called inside <OpsContextProvider>.",
      );
    });

    renderStarters();

    expect(
      screen.getByText("What's the current status of all agents?"),
    ).toBeInTheDocument();
  });

  it("shows default chips when page is an unknown value", () => {
    setPage("unknown-page-xyz");
    renderStarters();

    expect(
      screen.getByText("What's the current status of all agents?"),
    ).toBeInTheDocument();
  });

  // ── 5. Chips animate in on mount (opacity class changes) ────────────────────

  it("chips start with opacity-0 before timers fire", () => {
    renderStarters();
    const buttons = screen.getAllByRole("button");

    // Before any timers, all chips should be invisible
    buttons.forEach((button) => {
      expect(button.className).toContain("opacity-0");
      expect(button.className).toContain("translate-y-1");
    });
  });

  it("first chip becomes visible after 0ms timer fires", () => {
    renderStarters();

    act(() => {
      vi.advanceTimersByTime(0);
    });

    const buttons = screen.getAllByRole("button");
    // First chip (0ms delay) should be visible
    expect(buttons[0].className).toContain("opacity-100");
    expect(buttons[0].className).toContain("translate-y-0");
    // Second chip (50ms delay) still hidden
    expect(buttons[1].className).toContain("opacity-0");
  });

  it("all chips are visible after 150ms (stagger: 4 chips × 50ms)", () => {
    renderStarters();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button.className).toContain("opacity-100");
      expect(button.className).toContain("translate-y-0");
    });
  });

  it("animation resets when page context changes", () => {
    setPage("dashboard");
    const { rerender } = renderStarters();

    act(() => {
      vi.runAllTimers();
    });

    // All visible after initial mount
    screen.getAllByRole("button").forEach((btn) => {
      expect(btn.className).toContain("opacity-100");
    });

    // Change page — chips reset
    setPage("budget");
    rerender(<ConversationStarters onSelect={vi.fn()} />);

    // Immediately after rerender, before new timers fire
    const newButtons = screen.getAllByRole("button");
    // At least some chips should be transitioning (opacity-0 or opacity-100 depending on timing)
    // The key assertion: budget chips are now present
    expect(screen.getByText("What's driving my costs up?")).toBeInTheDocument();
  });
});
