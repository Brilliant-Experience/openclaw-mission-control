/**
 * Tests for OpsContextProvider + useOpsContext + useOpsConsoleContext
 *
 * Test runner: vitest + @testing-library/react
 *
 * To run (once vitest is added to the project):
 *   npx vitest run src/components/ops-context-provider.test.tsx
 *
 * Required devDependencies (not yet in package.json):
 *   vitest, @vitejs/plugin-react, @testing-library/react, @testing-library/user-event,
 *   @testing-library/jest-dom, jsdom
 */

import React, { useRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, renderHook } from "@testing-library/react";
import {
  OpsContextProvider,
  useOpsConsoleContext,
  type OpsContextMeta,
} from "./ops-context-provider";
// In the real project, import from "@/hooks/use-ops-context"
import { useOpsContext } from "./use-ops-context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return <OpsContextProvider>{children}</OpsContextProvider>;
}

const baseMeta: OpsContextMeta = {
  page: "budget",
  title: "Budget",
  summary: "OpenRouter spend at 42%",
  data: { spendPercent: 42 },
};

// ─── Test 1: Provider renders children ───────────────────────────────────────

describe("OpsContextProvider", () => {
  it("renders children without crashing", () => {
    render(
      <OpsContextProvider>
        <span data-testid="child">Hello</span>
      </OpsContextProvider>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("provides a non-null context value to consumers", () => {
    const { result } = renderHook(() => useOpsConsoleContext(), { wrapper });
    expect(result.current).not.toBeNull();
    expect(typeof result.current.setMeta).toBe("function");
  });
});

// ─── Test 2: useOpsContext sets meta on mount ─────────────────────────────────

describe("useOpsContext — registration", () => {
  it("sets meta on mount", () => {
    const { result } = renderHook(
      () => {
        useOpsContext(baseMeta);
        return useOpsConsoleContext();
      },
      { wrapper },
    );

    expect(result.current.meta).toEqual(baseMeta);
  });

  it("updates meta when props change", () => {
    const meta1: OpsContextMeta = { page: "budget", title: "Budget" };
    const meta2: OpsContextMeta = {
      page: "budget",
      title: "Budget",
      summary: "Updated summary",
    };

    // We test this by rendering a component that calls useOpsContext with
    // different values and checking the context updates.
    function TestComponent({ meta }: { meta: OpsContextMeta }) {
      useOpsContext(meta);
      return null;
    }

    function ReadContext() {
      const { meta } = useOpsConsoleContext();
      return <div data-testid="meta">{meta?.summary ?? "none"}</div>;
    }

    const { rerender } = render(
      <OpsContextProvider>
        <TestComponent meta={meta1} />
        <ReadContext />
      </OpsContextProvider>,
    );

    // Initial: no summary
    expect(screen.getByTestId("meta").textContent).toBe("none");

    // Rerender with updated meta
    rerender(
      <OpsContextProvider>
        <TestComponent meta={meta2} />
        <ReadContext />
      </OpsContextProvider>,
    );

    expect(screen.getByTestId("meta").textContent).toBe("Updated summary");
  });
});

// ─── Test 3: useOpsContext clears meta on unmount ─────────────────────────────

describe("useOpsContext — cleanup", () => {
  it("clears meta (sets to null) when the component unmounts", () => {
    function PageComponent() {
      useOpsContext(baseMeta);
      return null;
    }

    function ReadMeta() {
      const { meta } = useOpsConsoleContext();
      return (
        <div data-testid="meta-page">{meta ? meta.page : "null"}</div>
      );
    }

    const { rerender } = render(
      <OpsContextProvider>
        <PageComponent />
        <ReadMeta />
      </OpsContextProvider>,
    );

    // Meta is set after mount
    expect(screen.getByTestId("meta-page").textContent).toBe("budget");

    // Unmount PageComponent by removing it from the tree
    rerender(
      <OpsContextProvider>
        <ReadMeta />
      </OpsContextProvider>,
    );

    // Meta should now be null
    expect(screen.getByTestId("meta-page").textContent).toBe("null");
  });
});

// ─── Test 4: useOpsConsoleContext throws outside provider ─────────────────────

describe("useOpsConsoleContext — error boundary", () => {
  it("throws when called outside OpsContextProvider", () => {
    // Suppress React's console.error for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useOpsConsoleContext());
    }).toThrow(
      "useOpsConsoleContext must be called inside <OpsContextProvider>",
    );

    spy.mockRestore();
  });
});

// ─── Test 5: setMeta can be called directly (OpsConsole usage) ───────────────

describe("OpsConsoleContextValue.setMeta", () => {
  it("allows the OpsConsole to read and update meta directly", () => {
    const { result } = renderHook(() => useOpsConsoleContext(), { wrapper });

    expect(result.current.meta).toBeNull();

    act(() => {
      result.current.setMeta(baseMeta);
    });

    expect(result.current.meta).toEqual(baseMeta);

    act(() => {
      result.current.setMeta(null);
    });

    expect(result.current.meta).toBeNull();
  });
});
