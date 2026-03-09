"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatScrollContainerRef {
  scrollToBottom: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ─── MessageTimestamp ──────────────────────────────────────────────────────────

export interface MessageTimestampProps {
  date: Date;
  align?: "left" | "right";
}

export function MessageTimestamp({
  date,
  align = "left",
}: MessageTimestampProps): JSX.Element {
  const [relTime, setRelTime] = useState(() => formatRelativeTime(date));

  useEffect(() => {
    const id = setInterval(() => {
      setRelTime(formatRelativeTime(date));
    }, 30_000);
    return () => clearInterval(id);
  }, [date]);

  return (
    <span
      className={cn(
        "text-[11px] text-stone-400",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {relTime}
    </span>
  );
}

// ─── TypingIndicator ───────────────────────────────────────────────────────────

export function TypingIndicator(): JSX.Element {
  return (
    <div
      className="border-l-2 border-stone-300 pl-3 dark:border-stone-600"
      aria-label="AI is typing"
    >
      <div className="flex items-center gap-1 px-1 py-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ animationDelay: `${i * 150}ms` }}
            className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce dark:bg-stone-500"
          />
        ))}
      </div>
    </div>
  );
}

// ─── ChatBubble ────────────────────────────────────────────────────────────────

export function ChatBubble({
  role,
  content,
  timestamp,
  isStreaming = false,
}: ChatBubbleProps): JSX.Element {
  if (role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%] text-sm">
          <span className="whitespace-pre-wrap break-words">
            {content}
            {isStreaming && (
              <span className="animate-[blink_1s_step-end_infinite] ml-0.5 inline-block">
                |
              </span>
            )}
          </span>
        </div>
        <MessageTimestamp date={timestamp} align="right" />
      </div>
    );
  }

  // assistant
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="border-l-2 border-stone-300 pl-3 max-w-[95%] text-sm dark:border-stone-600">
        <span className="whitespace-pre-wrap break-words text-stone-800 dark:text-stone-200">
          {content}
          {isStreaming && (
            <span className="animate-[blink_1s_step-end_infinite] ml-0.5 inline-block">
              |
            </span>
          )}
        </span>
      </div>
      <MessageTimestamp date={timestamp} align="left" />
    </div>
  );
}

// ─── ChatScrollContainer ───────────────────────────────────────────────────────

interface ChatScrollContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const ChatScrollContainer = forwardRef<
  ChatScrollContainerRef,
  ChatScrollContainerProps
>(function ChatScrollContainer(
  { children, className },
  ref
): JSX.Element {
  const divRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollToBottom() {
      const el = divRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    },
  }));

  return (
    <div
      ref={divRef}
      className={cn(
        "overflow-y-auto",
        // Thin scrollbar — matches unit-7b scrollbar utility
        "[&::-webkit-scrollbar]:w-1.5",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb]:bg-stone-200",
        "dark:[&::-webkit-scrollbar-thumb]:bg-stone-700",
        className
      )}
    >
      {children}
    </div>
  );
});
