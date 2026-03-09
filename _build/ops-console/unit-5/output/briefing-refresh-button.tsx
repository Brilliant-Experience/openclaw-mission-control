"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Client-side refresh button. Calls `router.refresh()` to revalidate the
 * server-rendered briefing page without a full navigation.
 */
export function BriefingRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setLastRefreshed(new Date());
    });
  }, [router]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isPending}
        className="gap-1.5"
        aria-label="Refresh briefing"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
          aria-hidden
        />
        <span>{isPending ? "Refreshing…" : "Refresh"}</span>
      </Button>
      {lastRefreshed && !isPending && (
        <span className="text-[11px] text-stone-400 dark:text-[#7a8591]">
          Updated{" "}
          {lastRefreshed.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}
