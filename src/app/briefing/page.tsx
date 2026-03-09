import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BriefingContextRegistrar } from "./briefing-context-registrar";
import { BriefingRefreshButton } from "./briefing-refresh-button";

export const metadata = {
  title: "Daily Briefing — Mission Control",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentStatusCard {
  id: string;
  name: string;
  status: "online" | "idle" | "offline";
  lastActive: string; // ISO8601
  heartbeatActive: boolean;
}

interface ActivityItem {
  agentId: string;
  agentName: string;
  action: string;
  timestamp: string; // ISO8601
  status: "success" | "error" | "running";
}

interface BudgetEntry {
  envKey: string;
  agentLabel: string;
  data: {
    label: string;
    usage: number;
    limit: number | null;
    is_free_tier: boolean;
    rate_limit: { requests: number; interval: string } | null;
  } | null;
  status: "ok" | "error" | "missing";
  errorMessage?: string;
}

interface AttentionItem {
  id: string;
  title: string;
  description: string;
  href: string;
  severity: "high" | "medium" | "low";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatRelativeTime(isoString: string): string {
  try {
    const ts = new Date(isoString).getTime();
    if (!Number.isFinite(ts)) return "unknown";
    const diffMs = Date.now() - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch {
    return "unknown";
  }
}

function deriveAgentStatus(
  sessionKey: string,
  updatedAt: number,
  ageMs: number,
): "online" | "idle" | "offline" {
  const THIRTY_MIN_MS = 30 * 60 * 1000;
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  if (!updatedAt || ageMs > TWO_HOURS_MS) return "offline";
  if (ageMs > THIRTY_MIN_MS) return "idle";
  return "online";
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchAgentCards(): Promise<AgentStatusCard[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/sessions`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Sessions API returned ${res.status}`);

  const data = (await res.json()) as {
    sessions?: Array<{
      key: string;
      sessionId: string;
      updatedAt: number;
      ageMs: number;
      [key: string]: unknown;
    }>;
  };

  const sessions = Array.isArray(data.sessions) ? data.sessions : [];

  // Group by agentId / key prefix and produce one card per agent.
  const agentMap = new Map<string, AgentStatusCard>();

  for (const session of sessions) {
    const rawKey = String(session.key ?? session.sessionId ?? "");
    // Extract agent ID from "agent:<id>:<...>" format
    let agentId = rawKey;
    let agentName = rawKey;
    if (rawKey.startsWith("agent:")) {
      const parts = rawKey.split(":");
      agentId = parts[1] ?? rawKey;
      agentName = parts[1] ?? rawKey;
    }

    const updatedAt = typeof session.updatedAt === "number" ? session.updatedAt : 0;
    const ageMs = typeof session.ageMs === "number" ? session.ageMs : Infinity;
    const status = deriveAgentStatus(rawKey, updatedAt, ageMs);

    // Only keep the most-recently-active session per agent.
    const existing = agentMap.get(agentId);
    if (!existing || updatedAt > new Date(existing.lastActive).getTime()) {
      agentMap.set(agentId, {
        id: agentId,
        name: agentName,
        status,
        lastActive: updatedAt ? new Date(updatedAt).toISOString() : new Date(0).toISOString(),
        heartbeatActive: ageMs < 5 * 60 * 1000, // active = seen within 5 min
      });
    }
  }

  return [...agentMap.values()].sort((a, b) =>
    new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
  );
}

async function fetchBudgetData(): Promise<BudgetEntry[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/openrouter-budget`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Budget API returned ${res.status}`);
  const data = (await res.json()) as { entries?: BudgetEntry[] };
  return Array.isArray(data.entries) ? data.entries : [];
}

async function fetchActivityItems(): Promise<ActivityItem[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/activity`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Activity API returned ${res.status}`);

  const data = (await res.json()) as Array<{
    id: string;
    type: string;
    timestamp: number;
    title: string;
    status?: string;
    source?: string;
  }>;

  if (!Array.isArray(data)) return [];

  return data.slice(0, 10).map((item) => ({
    agentId: item.source ?? item.id,
    agentName: item.source ?? item.type,
    action: item.title,
    timestamp: new Date(item.timestamp).toISOString(),
    status: (item.status === "error" ? "error" : item.status === "info" ? "running" : "success") as
      | "success"
      | "error"
      | "running",
  }));
}

// ── Section: Agent Status Grid ────────────────────────────────────────────────

function StatusDot({ status }: { status: "online" | "idle" | "offline" }) {
  const colors = {
    online: "bg-green-500",
    idle: "bg-amber-400",
    offline: "bg-red-500",
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status]} shrink-0`}
      aria-label={status}
    />
  );
}

function AgentCard({ agent }: { agent: AgentStatusCard }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-4 dark:border-[#23282e] dark:bg-[#0d0f12]">
      <StatusDot status={agent.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900 dark:text-[#f5f7fa]">
          {agent.name}
        </p>
        <p className="mt-0.5 text-xs text-stone-500 dark:text-[#7a8591]">
          Last active: {formatRelativeTime(agent.lastActive)}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              agent.status === "online"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : agent.status === "idle"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {agent.status}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
              agent.heartbeatActive
                ? "bg-stone-100 text-stone-600 dark:bg-[#171a1d] dark:text-[#a8b0ba]"
                : "bg-stone-100 text-stone-400 dark:bg-[#171a1d] dark:text-stone-500"
            }`}
          >
            Heartbeat: {agent.heartbeatActive ? "active" : "paused"}
          </span>
        </div>
      </div>
    </div>
  );
}

async function AgentStatusSection() {
  let agents: AgentStatusCard[] = [];
  let error: string | null = null;

  try {
    agents = await fetchAgentCards();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Agent Status</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <SectionError message={error} />
        ) : agents.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-[#7a8591]">No active sessions found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section: Budget Snapshot ──────────────────────────────────────────────────

function BudgetStatusLabel({
  percent,
}: {
  percent: number;
}) {
  if (percent > 100) {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
        Over budget
      </span>
    );
  }
  if (percent >= 80) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Near limit ({Math.round(percent)}%)
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
      On track
    </span>
  );
}

async function BudgetSnapshotSection() {
  let entries: BudgetEntry[] = [];
  let error: string | null = null;

  try {
    entries = await fetchBudgetData();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // Compute aggregate totals across all configured keys.
  const configured = entries.filter((e) => e.status === "ok" && e.data);
  const totalUsage = configured.reduce((sum, e) => sum + (e.data?.usage ?? 0), 0);
  const totalLimit = configured.reduce(
    (sum, e) => (e.data?.limit != null ? sum + e.data.limit : sum),
    0,
  );
  const percent = totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0;
  const clampedPercent = Math.min(percent, 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Budget Snapshot</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <SectionError message={error} />
        ) : (
          <div className="space-y-4">
            {/* Aggregate bar */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm text-stone-600 dark:text-[#a8b0ba]">
                  Total spend: ${totalUsage.toFixed(2)}
                  {totalLimit > 0 ? ` / $${totalLimit.toFixed(2)}` : ""}
                </span>
                <BudgetStatusLabel percent={percent} />
              </div>
              {totalLimit > 0 && (
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-[#23282e]"
                  role="progressbar"
                  aria-valuenow={Math.round(clampedPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      percent > 100
                        ? "bg-red-500"
                        : percent >= 80
                          ? "bg-amber-400"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${clampedPercent}%` }}
                  />
                </div>
              )}
            </div>

            {/* Per-key breakdown */}
            {entries.length > 0 && (
              <div className="space-y-2">
                {entries.map((entry) => {
                  if (entry.status === "missing") return null;
                  const usage = entry.data?.usage ?? 0;
                  const limit = entry.data?.limit ?? null;
                  const keyPercent = limit != null && limit > 0 ? (usage / limit) * 100 : null;
                  return (
                    <div key={entry.envKey} className="flex items-center justify-between text-xs">
                      <span className="min-w-0 truncate text-stone-600 dark:text-[#a8b0ba]">
                        {entry.agentLabel}
                      </span>
                      <span className="ml-2 shrink-0 text-stone-500 dark:text-[#7a8591]">
                        {entry.status === "error"
                          ? "Error"
                          : limit != null
                            ? `$${usage.toFixed(2)} / $${limit.toFixed(2)} (${Math.round(keyPercent ?? 0)}%)`
                            : `$${usage.toFixed(2)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section: Recent Activity Feed ─────────────────────────────────────────────

function ActivityStatusBadge({ status }: { status: "success" | "error" | "running" }) {
  const styles = {
    success:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    error:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    running:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}

async function RecentActivitySection() {
  let items: ActivityItem[] = [];
  let error: string | null = null;

  try {
    items = await fetchActivityItems();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <SectionError message={error} />
        ) : items.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-[#7a8591]">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-[#1a1e23]">
            {items.map((item, idx) => (
              <li key={`${item.agentId}-${item.timestamp}-${idx}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <ActivityStatusBadge status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-stone-800 dark:text-[#d6dce3]">
                    {item.action}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400 dark:text-[#7a8591]">
                    {item.agentName} · {formatRelativeTime(item.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section: Attention Required ───────────────────────────────────────────────

async function computeAttentionItems(
  agents: AgentStatusCard[],
  activity: ActivityItem[],
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  // Failed runs
  const failedRuns = activity.filter((a) => a.status === "error");
  for (const run of failedRuns.slice(0, 5)) {
    items.push({
      id: `failed-${run.agentId}-${run.timestamp}`,
      title: `Failed run: ${run.agentName}`,
      description: run.action,
      href: "/activity",
      severity: "high",
    });
  }

  // Offline agents
  const offlineAgents = agents.filter((a) => a.status === "offline");
  for (const agent of offlineAgents) {
    items.push({
      id: `offline-${agent.id}`,
      title: `Agent offline: ${agent.name}`,
      description: `Last seen ${formatRelativeTime(agent.lastActive)}`,
      href: "/agents",
      severity: "medium",
    });
  }

  // Paused heartbeats
  const pausedAgents = agents.filter((a) => !a.heartbeatActive && a.status !== "offline");
  for (const agent of pausedAgents) {
    items.push({
      id: `heartbeat-paused-${agent.id}`,
      title: `Heartbeat paused: ${agent.name}`,
      description: "Agent is idle but heartbeat is not active",
      href: "/heartbeat",
      severity: "low",
    });
  }

  return items;
}

async function AttentionRequiredSection() {
  let items: AttentionItem[] = [];
  let error: string | null = null;

  try {
    const [agents, activity] = await Promise.all([
      fetchAgentCards().catch(() => [] as AgentStatusCard[]),
      fetchActivityItems().catch(() => [] as ActivityItem[]),
    ]);
    items = await computeAttentionItems(agents, activity);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const severityStyles = {
    high: "border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/10",
    medium: "border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10",
    low: "border-stone-200 bg-stone-50 dark:border-[#23282e] dark:bg-[#0d0f12]",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Attention Required</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <SectionError message={error} />
        ) : items.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800/30 dark:bg-green-900/10">
            <span className="text-lg" aria-hidden>
              ✅
            </span>
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              All clear — no items require attention.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={`block rounded-lg border p-3 transition-opacity hover:opacity-80 ${severityStyles[item.severity]}`}
                >
                  <p className="text-sm font-medium text-stone-900 dark:text-[#f5f7fa]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-[#7a8591]">
                    {item.description}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Error card ────────────────────────────────────────────────────────────────

function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/30 dark:bg-red-900/10">
      <span className="mt-0.5 text-base" aria-hidden>
        ⚠️
      </span>
      <div>
        <p className="text-sm font-medium text-red-800 dark:text-red-400">
          Failed to load this section
        </p>
        <p className="mt-0.5 text-xs text-red-600 dark:text-red-500">{message}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BriefingPage() {
  const today = formatDate(new Date());

  return (
    <>
      {/* Context registrar — client island, renders nothing */}
      <BriefingContextRegistrar />

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-[#f5f7fa]">
              Daily Briefing
            </h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-[#7a8591]">{today}</p>
          </div>
          <BriefingRefreshButton />
        </div>

        {/* Sections — each has its own try/catch; an error in one won't crash others */}
        <Suspense
          fallback={
            <Card>
              <CardContent className="flex items-center gap-2 py-6 text-sm text-stone-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading agent status…
              </CardContent>
            </Card>
          }
        >
          <AgentStatusSection />
        </Suspense>

        <Suspense
          fallback={
            <Card>
              <CardContent className="flex items-center gap-2 py-6 text-sm text-stone-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading budget…
              </CardContent>
            </Card>
          }
        >
          <BudgetSnapshotSection />
        </Suspense>

        <Suspense
          fallback={
            <Card>
              <CardContent className="flex items-center gap-2 py-6 text-sm text-stone-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading activity…
              </CardContent>
            </Card>
          }
        >
          <RecentActivitySection />
        </Suspense>

        <Suspense
          fallback={
            <Card>
              <CardContent className="flex items-center gap-2 py-6 text-sm text-stone-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking for items needing attention…
              </CardContent>
            </Card>
          }
        >
          <AttentionRequiredSection />
        </Suspense>
      </div>
    </>
  );
}
