"use client";

import { useEffect, useRef } from "react";
import {
  type OpsContextMeta,
  useOpsConsoleContext,
} from "@/components/ops-context-provider";

// Re-export the type so consumers can import from a single location.
export type { OpsContextMeta };

/**
 * Register the current page's metadata with the OpsConsole context.
 *
 * - Calls `setMeta(meta)` on mount and whenever `meta` changes.
 * - Calls `setMeta(null)` on unmount, so the context auto-clears when the
 *   page unmounts (e.g. the user navigates away).
 *
 * Safe to call in SSR — the `useEffect` body only runs in the browser.
 *
 * @example
 * // In a page component:
 * useOpsContext({
 *   page: "budget",
 *   title: "Budget",
 *   summary: "OpenRouter spend at 42% of monthly cap",
 *   data: { spendPercent: 42, alertThreshold: 80 },
 * });
 */
export function useOpsContext(meta: OpsContextMeta): void {
  const { setMeta } = useOpsConsoleContext();

  // Keep a stable ref so the cleanup closure always sees the latest value
  // without needing to list individual meta properties as deps.
  const metaRef = useRef<OpsContextMeta>(meta);
  metaRef.current = meta;

  // Register on mount; clear on unmount.
  useEffect(() => {
    setMeta(metaRef.current);
    return () => {
      setMeta(null);
    };
    // setMeta is stable (comes from useState setter), so this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMeta]);

  // Update live when any meta field changes (e.g. budget % refreshes).
  useEffect(() => {
    setMeta(meta);
    // Spread individual fields as a single dep would miss nested object changes.
    // We depend on `meta` directly — React will re-run when the reference
    // changes, which is the caller's responsibility (memo / inline object).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, setMeta]);
}
