"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Client-side refresh button for the Daily Briefing page.
 * Uses router.refresh() to re-run server data fetches without a full navigation.
 */
export function BriefingRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isPending}
      aria-label="Refresh briefing"
      className="gap-1.5"
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{isPending ? "Refreshing…" : "Refresh"}</span>
    </Button>
  );
}
