"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  RefreshCw, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Zap, 
  Activity,
  CreditCard,
  ShieldAlert,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpsContext } from "@/hooks/use-ops-context";

/* ── Types ───────────────────────────────────────────────────────────────────── */

interface ActivityItem {
  id: string;
  type: string;
  timestamp: number;
  title: string;
  status: "ok" | "error" | "info" | "warning";
  source?: string;
  detail?: string;
}

interface BudgetEntry {
  envKey: string;
  agentLabel: string;
  data: {
    label: string;
    usage: number; // spend in USD
    limit: number | null;
  } | null;
  status: "ok" | "error" | "missing";
}

interface AgentHealth {
  id: string;
  name: string;
  status: "healthy" | "error" | "idle";
  lastActive: number;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(val);
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Returns a Tailwind bg colour class for a progress bar based on the spend
 * fraction (0–1).  Thresholds: >= 0.8 → red, >= 0.6 → amber, else green.
 */
export function budgetColor(pct: number): string {
  if (pct >= 0.8) return "bg-red-500";
  if (pct >= 0.6) return "bg-amber-500";
  return "bg-emerald-500";
}

/**
 * Returns a human-readable budget status label based on spend fraction (0–1).
 * Thresholds: >= 0.8 → "OVER BUDGET", >= 0.6 → "NEAR LIMIT", else "ON TRACK".
 */
export function budgetLabel(pct: number): string {
  if (pct >= 0.8) return "OVER BUDGET";
  if (pct >= 0.6) return "NEAR LIMIT";
  return "ON TRACK";
}

/**
 * Returns a Tailwind text colour class for the status label based on spend
 * fraction (0–1).  Thresholds: >= 0.8 → red, >= 0.6 → amber, else green.
 */
export function budgetLabelColor(pct: number): string {
  if (pct >= 0.8) return "text-red-500";
  if (pct >= 0.6) return "text-amber-500";
  return "text-emerald-500";
}

/* ── Components ─────────────────────────────────────────────────────────────── */

function BudgetHeroCard({
  title,
  amount,
  limit,
  subtext,
  icon: Icon,
}: {
  title: string;
  amount: number;
  limit: number | null;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pct = limit && limit > 0 ? Math.min(1, amount / limit) : 0;
  const pctDisplay = Math.round(pct * 100);

  return (
    <Card className="overflow-hidden border-stone-200 shadow-sm dark:border-[#2c343d] dark:bg-[#171a1d]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-stone-900 dark:text-[#f5f7fa]">
          {formatCurrency(amount)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {limit ? `of ${formatCurrency(limit)} budget` : subtext || "No limit set"}
        </p>
        {limit && (
          <>
            <div
              className="mt-4 h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800"
              role="progressbar"
              aria-valuenow={pctDisplay}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="budget-progress-bar"
            >
              <div
                className={cn("h-full rounded-full transition-all duration-500", budgetColor(pct))}
                style={{ width: `${pctDisplay}%` }}
                data-pct={pct}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetStatusCard({
  todaySpend,
  dailyLimit,
  monthlySpend,
  monthlyLimit,
}: {
  todaySpend: number;
  dailyLimit: number;
  monthlySpend: number;
  monthlyLimit: number;
}) {
  // Use monthly fraction for the overall status label
  const pct = monthlyLimit > 0 ? Math.min(1, monthlySpend / monthlyLimit) : 0;
  const status = budgetLabel(pct);
  const statusColor = budgetLabelColor(pct);
  const avgBurn = dailyLimit > 0 ? todaySpend : 0;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const projected = monthlySpend + avgBurn * daysRemaining;

  return (
    <Card className="border-stone-200 shadow-sm dark:border-[#2c343d] dark:bg-[#171a1d]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Budget Status
        </CardTitle>
        <ShieldAlert className="h-4 w-4 text-muted-foreground/50" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", statusColor)} data-testid="budget-status-label">
          {status}
        </div>
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground/70">
            Burn: <span className="text-foreground">{formatCurrency(avgBurn)}/day</span> avg
          </p>
          <p className="text-xs text-muted-foreground/70">
            Projected: <span className="text-foreground">{formatCurrency(projected)}</span> month-end
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentHealthChip({ agent }: { agent: AgentHealth }) {
  const dotColor = {
    healthy: "bg-emerald-500",
    error: "bg-red-500",
    idle: "bg-amber-400"
  }[agent.status];

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 shadow-sm transition-colors hover:bg-stone-50 dark:border-[#2c343d] dark:bg-[#171a1d] dark:hover:bg-[#20252a] cursor-pointer">
      <div className={cn("h-2 w-2 rounded-full", dotColor)} />
      <span className="text-xs font-medium text-foreground">{agent.name}</span>
      <span className="text-[10px] text-muted-foreground/60">{formatRelativeTime(agent.lastActive)}</span>
    </div>
  );
}

export function DashboardView() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [budget, setBudget] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [actRes, budRes] = await Promise.all([
        fetch("/api/activity"),
        fetch("/api/openrouter-budget")
      ]);
      const actData = await actRes.json();
      const budData = await budRes.json();
      setActivities(actData);
      setBudget(budData.entries || []);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => { void fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  const todaySpend = useMemo(
    () => budget.reduce((acc, curr) => acc + (curr.data?.usage ?? 0), 0),
    [budget]
  );

  const DAILY_LIMIT = 25.00;
  const MONTHLY_LIMIT = 500.00;
  const monthlySpend = todaySpend * 22.5; // Dummy aggregation

  // Stats for Ops Context
  const agentCount = budget.length;
  const recentErrors = activities.filter(a => a.status === "error").length;

  useOpsContext({
    page: "dashboard",
    title: "Dashboard",
    summary: `Today: ${formatCurrency(todaySpend)} spent, ${agentCount} agents, ${recentErrors} recent errors`
  });

  const agents: AgentHealth[] = useMemo(() => {
    return budget.map(b => ({
      id: b.envKey,
      name: b.agentLabel,
      status: b.status === "error" ? "error" : "healthy",
      lastActive: Date.now() - Math.floor(Math.random() * 10_000_000),
    }));
  }, [budget]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  const visibleRuns = activities.slice(0, 10);
  const hasMore = activities.length > 10;

  return (
    <div className="space-y-6">
      {/* 1. Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Mission Control</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => { void fetchData(); }}
          className="rounded-lg p-2 text-muted-foreground hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Budget Hero Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BudgetHeroCard
          title="Today's Spend"
          amount={todaySpend}
          limit={DAILY_LIMIT}
          icon={CreditCard}
        />
        <BudgetHeroCard
          title="Monthly Spend"
          amount={monthlySpend}
          limit={MONTHLY_LIMIT}
          subtext={`${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} days remaining`}
          icon={TrendingUp}
        />
        <BudgetStatusCard
          todaySpend={todaySpend}
          dailyLimit={DAILY_LIMIT}
          monthlySpend={monthlySpend}
          monthlyLimit={MONTHLY_LIMIT}
        />
      </div>

      {/* 3. Agent Health Row */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Health</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {agents.length > 0 ? (
            agents.map(agent => (
              <AgentHealthChip key={agent.id} agent={agent} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">No active agents</p>
          )}
        </div>
      </div>

      {/* 4. Recent Runs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h2>
          {hasMore && (
            <Link href="/activity" className="text-xs font-medium text-blue-600 hover:underline">
              View all {activities.length} runs
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm dark:border-[#2c343d] dark:bg-[#171a1d]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50 dark:border-stone-800 dark:bg-stone-900/50">
                <th className="px-4 py-2 font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 font-medium text-muted-foreground text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {visibleRuns.map((run) => (
                <tr key={run.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-900/50">
                  <td className="px-4 py-1.5 font-medium">{run.source ?? "System"}</td>
                  <td className="px-4 py-1.5 text-stone-600 dark:text-stone-400 truncate max-w-[200px]">{run.title}</td>
                  <td className="px-4 py-1.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      run.status === "ok"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : run.status === "error"
                          ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                          : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                    )}>
                      {run.status === "ok"
                        ? <CheckCircle2 className="h-2.5 w-2.5" />
                        : <AlertCircle className="h-2.5 w-2.5" />}
                      {run.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-right text-xs text-muted-foreground">
                    {formatRelativeTime(run.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Quick Actions */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ActionBtn label="View Briefing" icon={Zap} href="/briefing" />
          <ActionBtn label="Open Ops Console" icon={Activity} href="#" />
          <ActionBtn label="Export Report" icon={FileText} href="#" />
          <ActionBtn label="Configure Alerts" icon={ShieldAlert} href="#" />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  href,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition-all hover:border-stone-300 hover:bg-stone-50 dark:border-[#2c343d] dark:bg-[#171a1d] dark:hover:bg-[#20252a]"
    >
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-stone-100 p-1.5 dark:bg-stone-800">
          <Icon className="h-3.5 w-3.5 text-stone-600 dark:text-stone-400" />
        </div>
        <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{label}</span>
      </div>
      <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
    </Link>
  );
}
