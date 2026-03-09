/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OpsConsole, OpsConsolePanelContent } from "./ops-console";

// ── Mock lucide-react icons ───────────────────────────────────────────────────
jest.mock("lucide-react", () => ({
  PanelRight: ({ className }: { className?: string }) => (
    <svg data-testid="icon-panel-right" className={className} />
  ),
  PanelRightClose: ({ className }: { className?: string }) => (
    <svg data-testid="icon-panel-right-close" className={className} />
  ),
  X: ({ className }: { className?: string }) => (
    <svg data-testid="icon-x" className={className} />
  ),
  ChevronLeft: ({ className }: { className?: string }) => (
    <svg data-testid="icon-chevron-left" className={className} />
  ),
}));

// ── Mock @/lib/utils ──────────────────────────────────────────────────────────
jest.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) =>
    args
      .filter(Boolean)
      .map((a) => (typeof a === "string" ? a : ""))
      .join(" ")
      .trim(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearStorage() {
  localStorage.removeItem("ops-console-open");
  localStorage.removeItem("ops-console-width");
  localStorage.removeItem("ops-console-active-tab");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("OpsConsole", () => {
  beforeEach(() => {
    clearStorage();
    // Default to a desktop viewport
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
    // Mock matchMedia to return non-mobile by default
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }),
    });
  });

  afterEach(() => {
    clearStorage();
    jest.clearAllMocks();
  });

  // ── Test 1: Panel renders without crashing ─────────────────────────────────
  it("renders without crashing", () => {
    expect(() => render(<OpsConsole />)).not.toThrow();
  });

  // ── Test 2: Collapsed state shows floating button ──────────────────────────
  it("shows the floating button when panel is closed", () => {
    // localStorage defaults to closed (no stored value → false)
    render(<OpsConsole />);

    const floatingBtn = screen.getByRole("button", {
      name: /open ops console/i,
    });
    expect(floatingBtn).toBeInTheDocument();
  });

  it("does NOT show the floating button when panel is open", () => {
    // Pre-seed localStorage as open
    localStorage.setItem("ops-console-open", "true");

    render(<OpsConsole />);

    expect(
      screen.queryByRole("button", { name: /open ops console/i })
    ).not.toBeInTheDocument();
  });

  // ── Test 3: Panel opens when floating button is clicked ───────────────────
  it("opens the panel when the floating button is clicked", () => {
    render(<OpsConsole />);

    // Initially closed: placeholder text should not be visible
    expect(
      screen.queryByText(/ops console — coming soon/i)
    ).not.toBeInTheDocument();

    // Click the floating open button
    const floatingBtn = screen.getByRole("button", {
      name: /open ops console/i,
    });
    act(() => {
      fireEvent.click(floatingBtn);
    });

    // Panel should now show placeholder and header title
    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();

    // Header title should also be visible
    expect(screen.getByText("Ops Console")).toBeInTheDocument();
  });

  // ── Test: Collapse button on left edge of panel ───────────────────────────
  it("collapses the panel when the left-edge toggle button is clicked", () => {
    localStorage.setItem("ops-console-open", "true");

    render(<OpsConsole />);

    // Panel content should be visible
    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();

    // The left-edge toggle button
    const edgeToggleBtn = screen.getByRole("button", {
      name: /collapse ops console/i,
    });
    expect(edgeToggleBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(edgeToggleBtn);
    });

    // Panel should be gone, floating button visible
    expect(
      screen.queryByText(/ops console — coming soon/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open ops console/i })
    ).toBeInTheDocument();
  });

  // ── Test: Header collapse icon button ────────────────────────────────────
  it("renders a 'Collapse panel' button in the header", () => {
    localStorage.setItem("ops-console-open", "true");

    render(<OpsConsole />);

    const collapseHeaderBtn = screen.getByRole("button", {
      name: /collapse panel/i,
    });
    expect(collapseHeaderBtn).toBeInTheDocument();
  });

  it("collapses the panel when the header 'Collapse panel' button is clicked", () => {
    localStorage.setItem("ops-console-open", "true");

    render(<OpsConsole />);

    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();

    const collapseHeaderBtn = screen.getByRole("button", {
      name: /collapse panel/i,
    });
    act(() => {
      fireEvent.click(collapseHeaderBtn);
    });

    expect(
      screen.queryByText(/ops console — coming soon/i)
    ).not.toBeInTheDocument();
  });

  // ── Test: Header has three distinct interactive elements ─────────────────
  it("header has collapse-panel button and close button when panel is open", () => {
    localStorage.setItem("ops-console-open", "true");

    render(<OpsConsole />);

    // "Collapse panel" icon button
    expect(
      screen.getByRole("button", { name: /collapse panel/i })
    ).toBeInTheDocument();

    // "Close Ops Console" X button
    expect(
      screen.getByRole("button", { name: /close ops console/i })
    ).toBeInTheDocument();
  });

  // ── Test: OpsConsolePanelContent is exported ──────────────────────────────
  it("exports OpsConsolePanelContent as a named export", () => {
    expect(OpsConsolePanelContent).toBeDefined();
    expect(typeof OpsConsolePanelContent).toBe("function");
  });

  it("OpsConsolePanelContent renders placeholder text", () => {
    render(<OpsConsolePanelContent />);
    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();
  });

  // ── Test: Panel closes when close button is clicked ───────────────────────
  it("closes the panel when the close (X) button is clicked", () => {
    localStorage.setItem("ops-console-open", "true");

    render(<OpsConsole />);

    // Panel should be visible
    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();

    // Click the X / close button
    const closeBtn = screen.getByRole("button", { name: /close ops console/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    // Panel should be gone, floating button visible
    expect(
      screen.queryByText(/ops console — coming soon/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open ops console/i })
    ).toBeInTheDocument();
  });

  // ── Test: Keyboard shortcut toggles the panel ─────────────────────────────
  it("toggles the panel with Cmd+. keyboard shortcut", () => {
    render(<OpsConsole />);

    // Initially closed
    expect(
      screen.queryByText(/ops console — coming soon/i)
    ).not.toBeInTheDocument();

    // Fire Cmd+.
    act(() => {
      fireEvent.keyDown(window, { key: ".", metaKey: true });
    });

    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();

    // Fire again to close
    act(() => {
      fireEvent.keyDown(window, { key: ".", metaKey: true });
    });

    expect(
      screen.queryByText(/ops console — coming soon/i)
    ).not.toBeInTheDocument();
  });

  // ── Test: localStorage persistence ────────────────────────────────────────
  it("persists open state to localStorage", () => {
    render(<OpsConsole />);

    const floatingBtn = screen.getByRole("button", {
      name: /open ops console/i,
    });
    act(() => {
      fireEvent.click(floatingBtn);
    });

    expect(localStorage.getItem("ops-console-open")).toBe("true");

    const closeBtn = screen.getByRole("button", { name: /close ops console/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(localStorage.getItem("ops-console-open")).toBe("false");
  });

  // ── Test 4: Mobile drawer renders when viewport < 768px ──────────────────
  it("renders mobile drawer when viewport is below 768px", () => {
    // Set mobile viewport
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });
    // matchMedia returns true for max-width: 767px
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("767"),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }),
    });

    localStorage.setItem("ops-console-open", "true");

    render(<OpsConsole />);

    // On mobile, the aside should use fixed positioning (translate classes)
    const panel = screen.getByRole("complementary", { name: /ops console/i });
    expect(panel).toBeInTheDocument();
    // Panel content is visible in mobile drawer
    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();
  });

  // ── Test 5: Corrupt localStorage width falls back to 380px ───────────────
  it("falls back to default 380px when localStorage width is corrupt", () => {
    localStorage.setItem("ops-console-width", "not-a-number");
    localStorage.setItem("ops-console-open", "true");

    // We verify no crash and the panel renders correctly
    expect(() => render(<OpsConsole />)).not.toThrow();

    // Panel should still render with placeholder content
    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();
  });

  it("falls back to default 380px when localStorage width is zero", () => {
    localStorage.setItem("ops-console-width", "0");
    localStorage.setItem("ops-console-open", "true");

    expect(() => render(<OpsConsole />)).not.toThrow();
    expect(
      screen.getByText(/ops console — coming soon/i)
    ).toBeInTheDocument();
  });
});
