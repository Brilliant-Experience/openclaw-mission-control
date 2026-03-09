/**
 * Tests for OpsConsolePanelContent
 *
 * Test suite covers:
 * 1. Renders tab bar with Scotty and Claude tabs
 * 2. Tab switching preserves message history
 * 3. Sends message on Enter key
 * 4. Shows typing indicator during streaming
 * 5. Abort button cancels in-flight request
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsConsolePanelContent } from "./ops-console-panel-content";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock useOpsConsoleContext
jest.mock("@/components/ops-context-provider", () => ({
  useOpsConsoleContext: () => ({
    meta: { page: "dashboard", title: "Dashboard" },
    setMeta: jest.fn(),
  }),
}));

// Mock useGatewayStatusStore
jest.mock("@/lib/gateway-status-store", () => ({
  useGatewayStatusStore: () => ({ status: "online" }),
}));

// Mock react-markdown — renders children as plain text for easier testing
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

// Mock crypto.randomUUID
let uuidCounter = 0;
Object.defineProperty(global.crypto, "randomUUID", {
  value: () => `test-uuid-${++uuidCounter}`,
  configurable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ─── SSE stream helpers ───────────────────────────────────────────────────────

/**
 * Creates a ReadableStream that emits SSE chunks line by line.
 */
function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let idx = 0;
  return new ReadableStream({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(encoder.encode(`data: ${chunks[idx++]}\n\n`));
      } else {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

function mockFetchWithStream(chunks: string[]) {
  const stream = makeSseStream(chunks);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: stream,
  } as unknown as Response);
}

function mockFetchHanging(): { abort: jest.Mock } {
  const abortMock = jest.fn();
  global.fetch = jest.fn().mockImplementation(
    (_url: string, opts: RequestInit) => {
      return new Promise((_resolve, reject) => {
        (opts.signal as AbortSignal).addEventListener("abort", () => {
          const err = new Error("AbortError");
          err.name = "AbortError";
          reject(err);
        });
      });
    }
  );
  return { abort: abortMock };
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  uuidCounter = 0;
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OpsConsolePanelContent", () => {
  // 1. Renders tab bar with Scotty and Claude tabs
  test("renders tab bar with Scotty and Claude tabs", () => {
    render(<OpsConsolePanelContent />);

    const scottyTab = screen.getByRole("tab", { name: /scotty/i });
    const claudeTab = screen.getByRole("tab", { name: /claude/i });

    expect(scottyTab).toBeInTheDocument();
    expect(claudeTab).toBeInTheDocument();

    // Scotty is active by default
    expect(scottyTab).toHaveAttribute("aria-selected", "true");
    expect(claudeTab).toHaveAttribute("aria-selected", "false");
  });

  // 2. Tab switching preserves message history
  test("tab switching preserves message history", async () => {
    mockFetchWithStream(["Hello from Scotty!"]);
    const user = userEvent.setup();

    render(<OpsConsolePanelContent />);

    // Send a Scotty message
    const input = screen.getByRole("textbox", { name: /message input/i });
    await user.type(input, "ping");
    await user.keyboard("{Enter}");

    // Wait for the message to appear
    await waitFor(() => {
      expect(screen.getByText("ping")).toBeInTheDocument();
    });

    // Switch to Claude tab
    const claudeTab = screen.getByRole("tab", { name: /claude/i });
    await user.click(claudeTab);

    // Scotty message should be gone from view
    expect(screen.queryByText("ping")).not.toBeInTheDocument();

    // Switch back to Scotty
    const scottyTab = screen.getByRole("tab", { name: /scotty/i });
    await user.click(scottyTab);

    // Scotty message should be back
    expect(screen.getByText("ping")).toBeInTheDocument();
  });

  // 3. Sends message on Enter key
  test("sends message on Enter key and calls fetch", async () => {
    mockFetchWithStream(["Hi!"]);
    const user = userEvent.setup();

    render(<OpsConsolePanelContent />);

    const input = screen.getByRole("textbox", { name: /message input/i });
    await user.type(input, "Hello");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Verify correct endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat/stream",
      expect.objectContaining({
        method: "POST",
      })
    );

    // Input should be cleared
    expect(input).toHaveValue("");
  });

  test("Shift+Enter inserts newline instead of sending", async () => {
    mockFetchWithStream([]);
    const user = userEvent.setup();

    render(<OpsConsolePanelContent />);

    const input = screen.getByRole("textbox", { name: /message input/i });
    await user.type(input, "Hello");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    // fetch should NOT have been called
    expect(global.fetch).not.toHaveBeenCalled();
    // Input should still have content (plus a newline)
    expect((input as HTMLTextAreaElement).value).toContain("Hello");
  });

  // 4. Shows typing indicator during streaming
  test("shows typing indicator while streaming", async () => {
    // Create a stream that pauses before completing
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response);

    const user = userEvent.setup();
    render(<OpsConsolePanelContent />);

    const input = screen.getByRole("textbox", { name: /message input/i });
    await user.type(input, "test");
    await user.keyboard("{Enter}");

    // Typing indicator (or the AI streaming placeholder) should appear
    await waitFor(() => {
      expect(screen.getByLabelText("AI is typing")).toBeInTheDocument();
    });

    // Finish the stream
    act(() => {
      streamController.enqueue(encoder.encode("data: [DONE]\n\n"));
      streamController.close();
    });
  });

  // 5. Abort button cancels in-flight request
  test("abort button cancels in-flight request", async () => {
    // Use a hanging fetch that listens for abort signal
    const encoder = new TextEncoder();
    let resolveAbort: () => void;
    const abortPromise = new Promise<void>((res) => { resolveAbort = res; });

    let capturedSignal: AbortSignal | null = null;

    global.fetch = jest.fn().mockImplementation(
      (_url: string, opts: RequestInit) => {
        capturedSignal = opts.signal as AbortSignal;
        // Return a stream that never ends (until aborted)
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            // Emit one chunk so streaming state is active
            controller.enqueue(encoder.encode("data: partial\n\n"));
            // Then hang
          },
        });
        return Promise.resolve({
          ok: true,
          status: 200,
          body: stream,
        } as unknown as Response);
      }
    );

    const user = userEvent.setup();
    render(<OpsConsolePanelContent />);

    const input = screen.getByRole("textbox", { name: /message input/i });
    await user.type(input, "test streaming");
    await user.keyboard("{Enter}");

    // Wait for abort button to appear
    const abortButton = await screen.findByRole("button", {
      name: /stop generating/i,
    });

    expect(abortButton).toBeInTheDocument();

    // Click abort
    await user.click(abortButton);

    // Abort button should disappear
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /stop generating/i })).not.toBeInTheDocument();
    });

    // The captured signal should be aborted
    expect(capturedSignal?.aborted).toBe(true);
  });

  // Bonus: error state
  test("shows error bubble on fetch failure", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();

    render(<OpsConsolePanelContent />);

    const input = screen.getByRole("textbox", { name: /message input/i });
    await user.type(input, "test");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        screen.getByText("Something went wrong. Try again.")
      ).toBeInTheDocument();
    });
  });

  // Bonus: Claude tab sends to correct endpoint
  test("Claude tab sends to /api/chat/claude", async () => {
    mockFetchWithStream(["Claude response"]);
    const user = userEvent.setup();

    render(<OpsConsolePanelContent />);

    // Switch to Claude
    await user.click(screen.getByRole("tab", { name: /claude/i }));

    const input = screen.getByRole("textbox", { name: /message input/i });
    await user.type(input, "hello claude");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/chat/claude",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  // Bonus: active tab is persisted to localStorage
  test("active tab is persisted to localStorage", async () => {
    const user = userEvent.setup();
    render(<OpsConsolePanelContent />);

    await user.click(screen.getByRole("tab", { name: /claude/i }));

    expect(localStorageMock.getItem("ops-console-active-tab")).toBe("claude");
  });

  // Bonus: active tab is restored from localStorage
  test("restores active tab from localStorage", () => {
    localStorageMock.setItem("ops-console-active-tab", "claude");
    render(<OpsConsolePanelContent />);

    expect(
      screen.getByRole("tab", { name: /claude/i })
    ).toHaveAttribute("aria-selected", "true");
  });
});
