"use client";

import { useOpsContext } from "@/hooks/use-ops-context";

/**
 * Thin client-component island that registers the Briefing page with the
 * OpsConsole context. Mount this inside the (server) briefing page so the
 * context is always populated while the route is active.
 *
 * Renders nothing — purely a side-effect component.
 */
export function BriefingContextRegistrar() {
  useOpsContext({
    page: "briefing",
    title: "Daily Briefing",
    summary: "Overview of all agents and operational status",
  });

  return null;
}
