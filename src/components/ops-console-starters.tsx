"use client";

import React, { useEffect, useState } from "react";
import { useOpsConsoleContext } from "@/components/ops-context-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationStartersProps {
  onSelect: (text: string) => void;
}

interface Chip {
  label: string;
  icon?: React.ReactNode;
}

// ─── Chip Sets ────────────────────────────────────────────────────────────────

const CHIP_SETS: Record<string, Chip[]> = {
  dashboard: [
    { label: "What's my spend today compared to yesterday?" },
    { label: "Which agent has the most errors this week?" },
    { label: "Is my burn rate on track for this month?" },
    { label: "Show me a summary of all agent activity" },
  ],
  briefing: [
    { label: "What needs my attention right now?" },
    { label: "Summarize what happened overnight" },
    { label: "Are all agents running as expected?" },
    { label: "What's the highest-priority item to address?" },
  ],
  cron: [
    { label: "Why did the last run fail?" },
    { label: "What's the average run duration this week?" },
    { label: "Which cron jobs are most expensive?" },
    { label: "Show me runs that took longer than usual" },
  ],
  runs: [
    { label: "Why did the last run fail?" },
    { label: "What's the average run duration this week?" },
    { label: "Which cron jobs are most expensive?" },
    { label: "Show me runs that took longer than usual" },
  ],
  budget: [
    { label: "What's driving my costs up?" },
    { label: "Which model is most expensive?" },
    { label: "How do I reduce spending this month?" },
    { label: "Compare this month vs last month" },
  ],
};

const DEFAULT_CHIPS: Chip[] = [
  { label: "What's the current status of all agents?" },
  { label: "Show me today's activity summary" },
  { label: "Are there any issues I should know about?" },
  { label: "What happened in the last 24 hours?" },
];

function getChips(page: string | undefined): Chip[] {
  if (!page) return DEFAULT_CHIPS;
  return CHIP_SETS[page] ?? DEFAULT_CHIPS;
}

// ─── Inner component (consumes context) ──────────────────────────────────────

interface InnerProps extends ConversationStartersProps {
  page: string | undefined;
}

function StarterChips({ page, onSelect }: InnerProps): JSX.Element {
  const chips = getChips(page);

  // Staggered fade-up: track which chip indices are visible
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Reset on page change so animation re-runs
    setVisibleIndices(new Set());

    const timers = chips.map((_, i) =>
      setTimeout(() => {
        setVisibleIndices((prev) => {
          const next = new Set(prev);
          next.add(i);
          return next;
        });
      }, i * 50),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  // chips reference changes when page changes — use page as the dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-xs text-stone-400">Suggestions</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {chips.map((chip, i) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onSelect(chip.label)}
            className={[
              "rounded-lg border border-stone-200 dark:border-stone-700",
              "bg-stone-50 dark:bg-stone-800/50",
              "hover:bg-stone-100 dark:hover:bg-stone-800",
              "px-3 py-2 text-sm text-left",
              "transition-[opacity,transform] duration-200",
              visibleIndices.has(i)
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1",
            ].join(" ")}
          >
            {chip.icon != null && (
              <span className="mr-1.5 inline-flex shrink-0 items-center">
                {chip.icon}
              </span>
            )}
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Context-aware wrapper ────────────────────────────────────────────────────

/**
 * Safely reads OpsConsole context. Returns undefined page if outside provider.
 */
function usePageSafe(): string | undefined {
  try {
    // Rules of hooks: this is always called unconditionally inside a component.
    // The try/catch only handles the throw from the hook's guard check.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { meta } = useOpsConsoleContext();
    return meta?.page ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * Renders contextual conversation starter chips when the chat is empty.
 * Chip content adapts to the current page via `OpsContextMeta`.
 *
 * @example
 * // Inside OpsConsolePanelContent when messages.length === 0 && !isStreaming:
 * <ConversationStarters onSelect={(text) => setInput(text)} />
 */
export function ConversationStarters({
  onSelect,
}: ConversationStartersProps): JSX.Element {
  const page = usePageSafe();
  return <StarterChips page={page} onSelect={onSelect} />;
}
