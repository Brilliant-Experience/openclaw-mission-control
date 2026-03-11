"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { OpsConsole } from "@/components/ops-console";

/**
 * Wraps authenticated pages with Sidebar + OpsConsole.
 * On /login, renders children without the app chrome.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <main className="relative flex flex-1 flex-col overflow-hidden min-w-0">
        {children}
      </main>
      <OpsConsole />
    </div>
  );
}
