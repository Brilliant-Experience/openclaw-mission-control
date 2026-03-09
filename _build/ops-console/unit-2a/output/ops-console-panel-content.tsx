"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpsConsoleContext } from "@/components/ops-context-provider";
import { useGatewayStatusStore } from "@/lib/gateway-status-store";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

type ActiveTab = "scotty" | "claude";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_ACTIVE_TAB = "ops-console-active-tab";

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

function appendToLastAssistantMessage(
  messages: ChatMessage[],
  chunk: string
): ChatMessage[] {
  const copy = [...messages];
  const lastIdx = copy.length - 1;
  if (lastIdx >= 0 && copy[lastIdx].role === "assistant") {
    copy[lastIdx] = {
      ...copy[lastIdx],
      content: copy[lastIdx].content + chunk,
    };
  }
  return copy;
}

function markLastAssistantDone(messages: ChatMessage[]): ChatMessage[] {
  const copy = [...messages];
  const lastIdx = copy.length - 1;
  if (lastIdx >= 0 && copy[lastIdx].role === "assistant") {
    copy[lastIdx] = { ...copy[lastIdx], isStreaming: false };
  }
  return copy;
}

// ─── Gateway status dot ────────────────────────────────────────────────────────

function GatewayStatusDot(): JSX.Element {
  const { status } = useGatewayStatusStore();

  const dotClass =
    status === "online"
      ? "bg-green-500"
      : status === "degraded" || status === "loading"
        ? "bg-amber-400 animate-pulse"
        : "bg-red-500";

  return (
    <span
      aria-hidden
      className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)}
    />
  );
}

// ─── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator(): JSX.Element {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="AI is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 150}ms` }}
          className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-stone-500 animate-bounce"
        />
      ))}
    </div>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const [relTime, setRelTime] = useState(() =>
    formatRelativeTime(message.timestamp)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRelTime(formatRelativeTime(message.timestamp));
    }, 30_000);
    return () => clearInterval(id);
  }, [message.timestamp]);

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] rounded-2xl bg-blue-600 px-3 py-2 text-sm text-white">
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        </div>
        <span className="px-1 text-[10px] text-stone-400 dark:text-stone-500">
          {relTime}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[92%] border-l-2 border-stone-300 pl-3 dark:border-stone-600">
        {message.isStreaming && message.content === "" ? (
          <TypingIndicator />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-stone-800 dark:text-stone-200">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {!message.isStreaming && (
        <span className="px-1 text-[10px] text-stone-400 dark:text-stone-500">
          {relTime}
        </span>
      )}
    </div>
  );
}

// ─── Conversation starters — lazy require ──────────────────────────────────────

type StartersComponent = React.ComponentType<{
  onSelect: (text: string) => void;
}>;

let ConversationStarters: StartersComponent | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/components/ops-console-starters") as {
    ConversationStarters?: StartersComponent;
  };
  ConversationStarters = mod.ConversationStarters;
} catch {
  // Module not yet available — provided by unit-4
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  onSelect,
}: {
  tab: ActiveTab;
  onSelect: (text: string) => void;
}): JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <p className="text-sm text-stone-400 dark:text-stone-500">
        {tab === "scotty"
          ? "Ask Scotty about your agents, logs, or system status."
          : "Ask Claude anything."}
      </p>
      {typeof ConversationStarters !== "undefined" && (
        <ConversationStarters onSelect={onSelect} />
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function OpsConsolePanelContent(): JSX.Element {
  const { meta } = useOpsConsoleContext();

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window === "undefined") return "scotty";
    const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
    return stored === "claude" ? "claude" : "scotty";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab]);

  // ── Message histories ─────────────────────────────────────────────────────
  const [scottyMessages, setScottyMessages] = useState<ChatMessage[]>([]);
  const [claudeMessages, setClaudeMessages] = useState<ChatMessage[]>([]);

  // ── Streaming state — per-tab ─────────────────────────────────────────────
  const [scottyStreaming, setScottyStreaming] = useState(false);
  const [claudeStreaming, setClaudeStreaming] = useState(false);
  const scottyAbortRef = useRef<AbortController | null>(null);
  const claudeAbortRef = useRef<AbortController | null>(null);

  const isStreaming = activeTab === "scotty" ? scottyStreaming : claudeStreaming;
  const messages = activeTab === "scotty" ? scottyMessages : claudeMessages;

  // ── Input ─────────────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || !autoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scottyMessages, claudeMessages, activeTab, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollRef.current = distFromBottom <= 60;
  }, []);

  // ── Auto-grow textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`; // max ~4 lines
  }, [input]);

  // ── Abort ─────────────────────────────────────────────────────────────────
  const handleAbort = useCallback(() => {
    if (activeTab === "scotty") {
      scottyAbortRef.current?.abort();
      setScottyStreaming(false);
      setScottyMessages((prev) => markLastAssistantDone(prev));
    } else {
      claudeAbortRef.current?.abort();
      setClaudeStreaming(false);
      setClaudeMessages((prev) => markLastAssistantDone(prev));
    }
  }, [activeTab]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (rawInput: string) => {
      const userText = rawInput.trim();
      if (!userText || isStreaming) return;

      const contentToSend =
        activeTab === "scotty" && meta
          ? `[Context: ${meta.title}${meta.summary ? ` — ${meta.summary}` : ""}]\n\n${userText}`
          : userText;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userText,
        timestamp: new Date(),
      };

      const assistantPlaceholder: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      const setMsgs =
        activeTab === "scotty" ? setScottyMessages : setClaudeMessages;
      const setStreamingFlag =
        activeTab === "scotty" ? setScottyStreaming : setClaudeStreaming;
      const abortRef =
        activeTab === "scotty" ? scottyAbortRef : claudeAbortRef;

      // Snapshot messages before state update for request payload
      const currentMessages = (
        activeTab === "scotty" ? scottyMessages : claudeMessages
      ).filter((m) => !m.isStreaming);

      setMsgs((prev) => [...prev, userMsg, assistantPlaceholder]);
      setInput("");
      setStreamingFlag(true);
      autoScrollRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const requestMessages = [
          ...currentMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user" as const, content: contentToSend },
        ];

        const endpoint =
          activeTab === "scotty" ? "/api/chat/stream" : "/api/chat/claude";

        const bodyPayload =
          activeTab === "scotty"
            ? { messages: requestMessages }
            : {
                messages: requestMessages,
                systemContext: meta
                  ? `${meta.title}${meta.summary ? ` — ${meta.summary}` : ""}`
                  : undefined,
              };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            if (data) {
              setMsgs((prev) => appendToLastAssistantMessage(prev, data));
            }
          }
        }

        // Flush remaining buffer
        if (buffer.startsWith("data: ")) {
          const data = buffer.slice(6).trim();
          if (data && data !== "[DONE]") {
            setMsgs((prev) => appendToLastAssistantMessage(prev, data));
          }
        }

        setMsgs((prev) => markLastAssistantDone(prev));
        setStreamingFlag(false);
      } catch (err) {
        if (
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("abort"))
        ) {
          // User aborted — already handled in handleAbort
          return;
        }

        // Show error bubble
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Something went wrong. Try again.",
          timestamp: new Date(),
          isStreaming: false,
        };

        setMsgs((prev) => {
          // Replace the empty streaming placeholder if present, else append
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.isStreaming) {
            return [...prev.slice(0, -1), errorMsg];
          }
          return [...prev, errorMsg];
        });
        setStreamingFlag(false);
      }
    },
    [activeTab, isStreaming, meta, scottyMessages, claudeMessages]
  );

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend(input);
      }
    },
    [handleSend, input]
  );

  // ── Tab switch ────────────────────────────────────────────────────────────
  const switchTab = useCallback(
    (tab: ActiveTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      autoScrollRef.current = true;
    },
    [activeTab]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const placeholder =
    activeTab === "scotty"
      ? "Ask about your agents..."
      : "Ask Claude anything...";

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-stone-50 dark:bg-[#0d0f12]">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Chat tabs"
        className="flex shrink-0 border-b border-stone-200 bg-stone-50 px-2 dark:border-[#23282e] dark:bg-[#0d0f12]"
      >
        {/* Scotty tab */}
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "scotty"}
          aria-controls="ops-tab-panel-scotty"
          onClick={() => switchTab("scotty")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
            "border-b-2 -mb-px",
            activeTab === "scotty"
              ? "border-blue-500 text-stone-900 dark:text-[#f5f7fa]"
              : "border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          )}
        >
          <GatewayStatusDot />
          Scotty
        </button>

        {/* Claude tab */}
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "claude"}
          aria-controls="ops-tab-panel-claude"
          onClick={() => switchTab("claude")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
            "border-b-2 -mb-px",
            activeTab === "claude"
              ? "border-blue-500 text-stone-900 dark:text-[#f5f7fa]"
              : "border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          )}
        >
          Claude
        </button>
      </div>

      {/* Message area */}
      <div
        id={`ops-tab-panel-${activeTab}`}
        role="tabpanel"
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 py-3"
        >
          {isEmpty ? (
            <EmptyState tab={activeTab} onSelect={(text) => void handleSend(text)} />
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Streaming indicator row with abort button */}
              {isStreaming && (
                <div className="flex items-center gap-2">
                  {/* Show typing indicator only when last message has no content yet */}
                  {messages[messages.length - 1]?.isStreaming &&
                    messages[messages.length - 1].content !== "" && (
                      <TypingIndicator />
                    )}
                  <button
                    type="button"
                    onClick={handleAbort}
                    aria-label="Stop generating"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-stone-600 transition-colors hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-300 dark:hover:bg-stone-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-3 py-3 dark:border-[#23282e] dark:bg-[#0d0f12]">
          <div className="flex items-end gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 focus-within:border-stone-300 focus-within:ring-1 focus-within:ring-stone-200 dark:border-[#23282e] dark:bg-[#171b1f] dark:focus-within:border-[#3d4752] dark:focus-within:ring-[#23282e]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isStreaming}
              aria-label="Message input"
              className="flex-1 resize-none bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none disabled:opacity-50 dark:text-[#f5f7fa] dark:placeholder:text-stone-500"
              style={{ maxHeight: 96 }}
            />
            <button
              type="button"
              onClick={() => void handleSend(input)}
              disabled={isStreaming || !input.trim()}
              aria-label="Send message"
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                input.trim() && !isStreaming
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500"
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
