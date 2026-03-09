"use client";

import React, { createContext, useContext, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpsContextMeta {
  /** Programmatic page identifier, e.g. "budget", "dashboard", "cron" */
  page: string;
  /** Human-readable page title shown to the AI */
  title: string;
  /** Optional: current state summary for the AI */
  summary?: string;
  /** Optional: structured data for richer context injection */
  data?: Record<string, unknown>;
}

export interface OpsConsoleContextValue {
  meta: OpsContextMeta | null;
  setMeta: (meta: OpsContextMeta | null) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const OpsConsoleContext = createContext<OpsConsoleContextValue | null>(null);
OpsConsoleContext.displayName = "OpsConsoleContext";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OpsContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [meta, setMeta] = useState<OpsContextMeta | null>(null);

  return (
    <OpsConsoleContext.Provider value={{ meta, setMeta }}>
      {children}
    </OpsConsoleContext.Provider>
  );
}

// ─── Consumer hook (for OpsConsole panel) ────────────────────────────────────

/**
 * Read the current page context registered by `useOpsContext`.
 * Must be called inside `<OpsContextProvider>`.
 *
 * @example
 * const { meta } = useOpsConsoleContext();
 */
export function useOpsConsoleContext(): OpsConsoleContextValue {
  const ctx = useContext(OpsConsoleContext);
  if (ctx === null) {
    throw new Error(
      "useOpsConsoleContext must be called inside <OpsContextProvider>. " +
        "Make sure OpsContextProvider wraps your app in layout.tsx.",
    );
  }
  return ctx;
}
