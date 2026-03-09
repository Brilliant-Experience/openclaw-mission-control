"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  Clock,
  Settings2,
} from "lucide-react";
import { getChatUnreadCount, subscribeChatStore } from "@/lib/chat-store";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const MOBILE_TABS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", section: "dashboard" },
  { label: "Agents",    icon: Users,           href: "/agents",    section: "agents"    },
  { label: "Chat",      icon: MessageCircle,   href: "/chat",      section: "chat"      },
  { label: "Cron",      icon: Clock,           href: "/cron",      section: "cron"      },
  { label: "Settings",  icon: Settings2,       href: "/settings",  section: "settings"  },
] as const;

// ─── Section derivation (mirrors sidebar logic) ───────────────────────────────

function deriveSectionFromPath(pathname: string): string | null {
  if (!pathname || pathname === "/") return null;
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  const aliases: Record<string, string> = {
    onboard: "setup",
    documents: "docs",
    memories: "memory",
    permissions: "security",
    heartbeat: "cron",
  };
  return aliases[first] ?? first;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileNav() {
  // Avoid hydration mismatch — only render after mount on the client
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const pathname = usePathname();
  const activeSection = deriveSectionFromPath(pathname);

  // Reactive unread badge — same pattern as sidebar.tsx
  const chatUnread = useSyncExternalStore(
    subscribeChatStore,
    getChatUnreadCount,
    () => 0 // SSR fallback
  );

  // Don't render on server or desktop
  if (!mounted || !isMobile) return null;

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "border-t border-stone-200 bg-stone-50 dark:border-[#23282e] dark:bg-[#0d0f12]",
        "pb-safe"
      )}
    >
      <div className="flex h-14 items-stretch">
        {MOBILE_TABS.map((tab) => {
          const isActive = activeSection === tab.section;
          const showBadge = tab.section === "chat" && chatUnread > 0;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.section}
              href={tab.href}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150",
                isActive
                  ? "bg-stone-100 text-stone-900 font-semibold dark:bg-[#171b1f] dark:text-[#f5f7fa]"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-[#a8b0ba] dark:hover:bg-[#171b1f] dark:hover:text-[#f5f7fa]"
              )}
            >
              {/* Icon with optional unread badge */}
              <span className="relative inline-flex shrink-0">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-stone-50 dark:ring-[#0d0f12]"
                    title={`${chatUnread} unread`}
                  />
                )}
              </span>

              {/* Label */}
              <span className="text-[10px] leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
