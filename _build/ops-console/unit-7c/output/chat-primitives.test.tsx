/**
 * Tests for chat-primitives.tsx
 *
 * Uses React Testing Library + jest-dom.
 * Assumes jsdom environment (standard Next.js / Vitest / Jest setup).
 */

import React, { createRef } from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  ChatBubble,
  TypingIndicator,
  ChatScrollContainer,
  MessageTimestamp,
  type ChatScrollContainerRef,
} from "./chat-primitives";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date();

// ─── 1. ChatBubble: user message right-aligned ─────────────────────────────────

describe("ChatBubble — user role", () => {
  it("renders user message right-aligned with blue bubble", () => {
    const { container } = render(
      <ChatBubble role="user" content="Hello!" timestamp={NOW} />
    );

    // Outer wrapper has items-end (right-align)
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("items-end");

    // Bubble has blue background
    const bubble = wrapper.querySelector("div");
    expect(bubble).toHaveClass("bg-blue-600");
    expect(bubble).toHaveClass("text-white");

    // Content is rendered
    expect(screen.getByText("Hello!")).toBeInTheDocument();
  });

  it("shows blinking cursor when isStreaming is true", () => {
    const { container } = render(
      <ChatBubble role="user" content="Typing..." timestamp={NOW} isStreaming />
    );

    // The cursor span uses the blink animation class
    const cursor = container.querySelector(
      'span[class*="animate-"]'
    );
    expect(cursor).toBeInTheDocument();
    expect(cursor?.textContent).toBe("|");
  });

  it("timestamp is right-aligned for user", () => {
    const { container } = render(
      <ChatBubble role="user" content="Hi" timestamp={NOW} />
    );
    const timestamp = container.querySelector("span.text-\\[11px\\]");
    expect(timestamp).toHaveClass("text-right");
  });
});

// ─── 2. ChatBubble: assistant message with left border ─────────────────────────

describe("ChatBubble — assistant role", () => {
  it("renders assistant message with left border (no background)", () => {
    const { container } = render(
      <ChatBubble
        role="assistant"
        content="Hello from assistant!"
        timestamp={NOW}
      />
    );

    // Outer wrapper has items-start (left-align)
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("items-start");

    // Inner div has left border
    const contentDiv = wrapper.querySelector("div");
    expect(contentDiv).toHaveClass("border-l-2");
    expect(contentDiv).toHaveClass("border-stone-300");

    // No background colour class
    expect(contentDiv).not.toHaveClass("bg-blue-600");

    // Content rendered
    expect(screen.getByText("Hello from assistant!")).toBeInTheDocument();
  });

  it("timestamp is left-aligned for assistant", () => {
    const { container } = render(
      <ChatBubble role="assistant" content="Hi" timestamp={NOW} />
    );
    const timestamp = container.querySelector("span.text-\\[11px\\]");
    expect(timestamp).toHaveClass("text-left");
  });
});

// ─── 3. TypingIndicator has aria-label ─────────────────────────────────────────

describe("TypingIndicator", () => {
  it("has aria-label 'AI is typing'", () => {
    render(<TypingIndicator />);
    expect(screen.getByLabelText("AI is typing")).toBeInTheDocument();
  });

  it("renders three animated dots", () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll(
      "span.h-1\\.5.w-1\\.5.rounded-full"
    );
    expect(dots).toHaveLength(3);
  });

  it("dots have staggered animation delays", () => {
    const { container } = render(<TypingIndicator />);
    const dots = Array.from(
      container.querySelectorAll("span.animate-bounce")
    ) as HTMLElement[];
    expect(dots[0].style.animationDelay).toBe("0ms");
    expect(dots[1].style.animationDelay).toBe("150ms");
    expect(dots[2].style.animationDelay).toBe("300ms");
  });

  it("is wrapped in the left-border assistant container", () => {
    const { container } = render(<TypingIndicator />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("border-l-2");
    expect(wrapper).toHaveClass("border-stone-300");
  });
});

// ─── 4. ChatScrollContainer scrollToBottom scrolls to bottom ──────────────────

describe("ChatScrollContainer", () => {
  it("renders children", () => {
    render(
      <ChatScrollContainer>
        <p>Some content</p>
      </ChatScrollContainer>
    );
    expect(screen.getByText("Some content")).toBeInTheDocument();
  });

  it("exposes scrollToBottom() via ref", () => {
    const ref = createRef<ChatScrollContainerRef>();
    const { container } = render(
      <ChatScrollContainer ref={ref}>
        <p>content</p>
      </ChatScrollContainer>
    );

    const div = container.querySelector("div") as HTMLDivElement;

    // Manually set scrollHeight so jsdom can reflect it
    Object.defineProperty(div, "scrollHeight", { value: 500, configurable: true });
    div.scrollTop = 0;

    act(() => {
      ref.current?.scrollToBottom();
    });

    expect(div.scrollTop).toBe(500);
  });

  it("has overflow-y-auto class", () => {
    const { container } = render(
      <ChatScrollContainer>content</ChatScrollContainer>
    );
    expect(container.firstChild).toHaveClass("overflow-y-auto");
  });

  it("merges additional className", () => {
    const { container } = render(
      <ChatScrollContainer className="h-64">content</ChatScrollContainer>
    );
    expect(container.firstChild).toHaveClass("h-64");
  });
});

// ─── 5. MessageTimestamp updates after 30 seconds (fake timers) ───────────────

describe("MessageTimestamp", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders relative time initially", () => {
    const date = new Date(Date.now() - 5000); // 5 seconds ago → "just now"
    render(<MessageTimestamp date={date} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("updates relative time after 30 seconds", () => {
    // Set a fixed reference point: timestamp is 5s in the past
    const baseDate = new Date(Date.now() - 5_000);
    render(<MessageTimestamp date={baseDate} />);

    // Initially shows "just now"
    expect(screen.getByText("just now")).toBeInTheDocument();

    // Advance 30 seconds (the update interval)
    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    // Now the diff is ~35 seconds → "35s ago"
    expect(screen.queryByText("just now")).not.toBeInTheDocument();
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it("cleans up interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(globalThis, "clearInterval");
    const date = new Date();
    const { unmount } = render(<MessageTimestamp date={date} />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("respects align prop", () => {
    const { container } = render(
      <MessageTimestamp date={new Date()} align="right" />
    );
    expect(container.firstChild).toHaveClass("text-right");
  });
});
