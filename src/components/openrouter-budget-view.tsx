"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertCircle, RefreshCw, TrendingUp, DollarSign, AlertTriangle, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/ui/loading-state";
import { SectionBody, SectionHeader, SectionLayout } from "@/components/section-layout";
import type { BudgetEntry } from "@/app/api/openrouter-budget/route";

/* ── helpers ──────────────────────────────────────── */

function usagePct(entry: BudgetEntry): number | null {
  if (!entry.data || entry.data.limit === null || entry.data.limit === 0) return null;
  return Math.min((entry.data.usage / entry.data.limit) * 100, 100);
}

type Tier = "green" | "amber" | "red" | "black" | "unknown";

function tier(entry: BudgetEntry): Tier {
  if (entry.status === "missing") return "unknown";
  if (entry.status === "error") return "red";
  if (!entry.data) return "unknown";
  const pct = usagePct(entry);
  if (pct === null) return "unknown";
  if (pct >= 100) return "black";
  if (pct >= 80) return "red";
  if (pct >= 60) return "amber";
  return "green";
}

const TIER_COLORS: Record<Tier, { bar: string; badge: string; text: string; bg: string }> = {
  green: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    text: "text-emerald-400",
    bg: "border-emerald-500/10",
  },
  amber: {
    bar: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    text: "text-amber-400",
    bg: "border-amber-500/20",
  },
  red: {
    bar: "bg-red-500",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    text: "text-red-400",
    bg: "border-red-500/20",
  },
  black: {
    bar: "bg-zinc-700",
    badge: "bg-zinc-900 text-zinc-400 border-zinc-700",
    text: "text-zinc-400",
    bg: "border-zinc-700",
  },
  unknown: {
    bar: "bg-zinc-700",
    badge: "bg-zinc-800 text-zinc-500 border-zinc-700",
    text: "text-zinc-500",
    bg: "border-foreground/5",
  },
};

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toFixed(4)}`;
}

function TierIcon({ t }: { t: Tier }) {
  if (t === "green") return <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />;
  if (t === "amber") return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  if (t === "red") return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
  if (t === "black") return <XCircle className="h-3.5 w-3.5 text-zinc-400" />;
  return <HelpCircle className="h-3.5 w-3.5 text-zinc-500" />;
}

function BudgetCard({ entry }: { entry: BudgetEntry }) {
  const t = tier(entry);
  const pct = usagePct(entry);
  const colors = TIER_COLORS[t];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 transition-all",
        colors.bg,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground/90">{entry.agentLabel}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/50">
            {entry.envKey}
          </p>
        </div>
        <div className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", colors.badge)}>
          <TierIcon t={t} />
          {t === "unknown" && entry.status === "missing" ? "not configured" : t}
        </div>
      </div>

      {/* Status: error */}
      {entry.status === "error" && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {entry.errorMessage || "Failed to fetch"}
        </p>
      )}

      {/* Status: missing */}
      {entry.status === "missing" && (
        <p className="text-xs text-muted-foreground/60">
          Set <code className="rounded bg-foreground/5 px-1">{entry.envKey}</code> in your .env to enable tracking.
        </p>
      )}

      {/* Data */}
      {entry.status === "ok" && entry.data && (
        <>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground/70">Spend</p>
              <p className={cn("text-lg font-bold tabular-nums", colors.text)}>
                {fmtUsd(entry.data.usage)}
              </p>
            </div>
            {entry.data.limit !== null && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground/70">Limit</p>
                <p className="text-sm font-semibold text-foreground/80 tabular-nums">
                  {fmtUsd(entry.data.limit)}
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {pct !== null && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={cn("h-full rounded-full transition-all", colors.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-right text-[10px] text-muted-foreground/60 tabular-nums">
                {pct.toFixed(1)}% used
              </p>
            </div>
          )}

          {/* No limit set */}
          {entry.data.limit === null && (
            <p className="text-xs text-muted-foreground/50">No spending limit configured</p>
          )}
        </>
      )}
    </div>
  );
}

/* ── fleet summary ────────────────────────────────── */

function FleetSummaryBar({ entries }: { entries: BudgetEntry[] }) {
  const configured = entries.filter((e) => e.status !== "missing");
  const alerting = entries.filter((e) => {
    const t = tier(e);
    return t === "red" || t === "black";
  });
  const warning = entries.filter((e) => tier(e) === "amber");
  const healthy = entries.filter((e) => tier(e) === "green");
  const missing = entries.filter((e) => e.status === "missing");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/5 bg-muted/30 px-4 py-3 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <DollarSign className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground/80">{configured.length} / {entries.length}</span>
        <span>keys configured</span>
      </div>
      {healthy.length > 0 && (
        <div className="flex items-center gap-1 text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{healthy.length} healthy</span>
        </div>
      )}
      {warning.length > 0 && (
        <div className="flex items-center gap-1 text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>{warning.length} warning</span>
        </div>
      )}
      {alerting.length > 0 && (
        <div className="flex items-center gap-1 text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="font-semibold">{alerting.length} alert</span>
        </div>
      )}
      {missing.length > 0 && (
        <div className="flex items-center gap-1 text-muted-foreground/50">
          <span>{missing.length} not configured</span>
        </div>
      )}
    </div>
  );
}

/* ── main view ────────────────────────────────────── */

export function OpenRouterBudgetView() {
  const [entries, setEntries] = useState<BudgetEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBudget = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/openrouter-budget");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { entries: BudgetEntry[] };
      setEntries(data.entries);
      setLastFetched(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const alertCount = entries
    ? entries.filter((e) => {
        const t = tier(e);
        return t === "red" || t === "black";
      }).length
    : 0;

  return (
    <SectionLayout>
      <SectionHeader
        title="OpenRouter Budget"
        description="Per-agent API key spend vs. limit"
        
        actions={
          <div className="flex items-center gap-2">
            {lastFetched && (
              <span className="text-xs text-muted-foreground/50">
                Updated {new Date(lastFetched).toLocaleTimeString()}
              </span>
            )}
            {alertCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/20">
                <AlertCircle className="h-3 w-3" />
                {alertCount} alert{alertCount > 1 ? "s" : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchBudget(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        }
      />
      <SectionBody>
        {loading && <LoadingState label="Fetching OpenRouter key status…" />}
        {error && !loading && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Failed to load budget data</p>
              <p className="mt-1 text-xs text-red-400/80">{error}</p>
            </div>
          </div>
        )}
        {!loading && entries && (
          <div className="space-y-4">
            <FleetSummaryBar entries={entries} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {entries.map((entry) => (
                <BudgetCard key={entry.envKey} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </SectionBody>
    </SectionLayout>
  );
}
