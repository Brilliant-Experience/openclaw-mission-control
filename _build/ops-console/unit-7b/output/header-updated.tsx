"use client";

import { usePathname } from "next/navigation";
import { AgentChatPanel } from "@/components/agent-chat-panel";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/chat": "Chat",
  "/briefing": "Daily Briefing",
  "/runs": "Runs",
  "/cron": "Cron",
  "/budget": "Budget",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Mission Control";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-stone-200 px-4 dark:border-stone-800">
      <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
        {title}
      </span>
      <AgentChatPanel />
    </header>
  );
}
