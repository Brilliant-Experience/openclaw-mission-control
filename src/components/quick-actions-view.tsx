"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Zap,
  RefreshCw,
  Network,
  Trash2,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Copy,
  Check,
  Loader2,
  ShieldAlert,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionBody, SectionHeader, SectionLayout } from "@/components/section-layout";

/* ── types ────────────────────────────────────────── */

type ActionStatus = "idle" | "confirming" | "running" | "done" | "error";

type ActionResult = {
  ok?: boolean;
  [key: string]: unknown;
};

/* ── VPS shell commands (require docker/sudo — must be run by Scotty or John) */
const VPS_COMMANDS = {
  "restart-gateway":
    "cd /opt/openclaw/openclaw && docker compose down && docker compose up -d",
  "reconnect-networks":
    "docker network connect openclaw_default litellm-proxy && docker network connect openclaw_default n8n-n8n-1",
} as const;

/* ── CopyButton ───────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:min-h-auto md:min-w-auto"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/* ── VPS action card (command copy only — requires Scotty/John to run) ─── */

function VpsActionCard({
  title,
  description,
  icon: Icon,
  command,
  warning,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  command: string;
  warning?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-foreground/5 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
          <Icon className="h-4 w-4 text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground/90">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      {warning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      <div className="rounded-lg border border-foreground/10 bg-foreground/5">
        <div className="flex items-center justify-between gap-2 border-b border-foreground/5 px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Terminal className="h-3 w-3" />
            Run on VPS (Scotty or John)
          </div>
          <CopyButton text={command} />
        </div>
        <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground/80">
          {command}
        </pre>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
        <Info className="h-3 w-3 shrink-0" />
        Requires Docker/sudo — ask Scotty to run, or paste into VPS terminal
      </div>
    </div>
  );
}

/* ── local action card (runs server-side in Next.js) ──────────────────── */

function LocalActionCard({
  title,
  description,
  icon: Icon,
  iconColor,
  actionKey,
  confirmPrompt,
  warning,
  renderResult,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  actionKey: string;
  confirmPrompt?: string;
  warning?: string;
  renderResult?: (result: ActionResult) => React.ReactNode;
}) {
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setStatus("running");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionKey }),
      });
      const data = (await res.json()) as ActionResult;
      if (!res.ok || data.ok === false) {
        setError(typeof data.error === "string" ? data.error : "Action failed");
        setStatus("error");
      } else {
        setResult(data);
        setStatus("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [actionKey]);

  const handleClick = () => {
    if (status === "confirming") {
      run();
    } else if (confirmPrompt) {
      setStatus("confirming");
    } else {
      run();
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-foreground/5 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", `bg-${iconColor}-500/10`)}>
          <Icon className={cn("h-4 w-4", `text-${iconColor}-400`)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground/90">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      {warning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {status === "confirming" && confirmPrompt && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
          <p className="font-medium">{confirmPrompt}</p>
          <p className="mt-1 text-red-400/70">This action cannot be undone.</p>
        </div>
      )}

      {status === "done" && result && renderResult && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-400">
          {renderResult(result)}
        </div>
      )}

      {status === "error" && error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        {(status === "done" || status === "error") && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Reset
          </button>
        )}
        <div className="flex-1" />
        {status === "confirming" && (
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={status === "running"}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
            status === "confirming"
              ? "bg-red-600 text-white hover:bg-red-700"
              : status === "done"
              ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
          {status === "done" && <CheckCircle2 className="h-3 w-3" />}
          {status === "error" && <AlertTriangle className="h-3 w-3" />}
          {status === "confirming" ? "Confirm — run it" : status === "running" ? "Running…" : status === "done" ? "Done" : status === "error" ? "Retry" : "Run"}
        </button>
      </div>
    </div>
  );
}

/* ── delivery queue preview ────────────────────────── */

function DeliveryQueueCard() {
  const [counts, setCounts] = useState<{ pending: number; failed: number } | null>(null);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [result, setResult] = useState<ActionResult | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "count-delivery-queue" }),
      });
      const data = (await res.json()) as { pending: number; failed: number };
      setCounts(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const purge = useCallback(async () => {
    setStatus("running");
    setResult(null);
    try {
      const res = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purge-delivery-queue" }),
      });
      const data = (await res.json()) as ActionResult;
      setResult(data);
      setStatus(data.ok === false ? "error" : "done");
      if (data.ok !== false) fetchCounts();
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
      setStatus("error");
    }
  }, [fetchCounts]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-foreground/5 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
          <Trash2 className="h-4 w-4 text-red-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground/90">Purge Delivery Queue</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Clear pending and failed delivery queue entries.
          </p>
        </div>
      </div>

      {counts && (
        <div className="flex gap-4 rounded-lg border border-foreground/5 bg-muted/30 px-3 py-2.5 text-xs">
          <div>
            <span className="font-semibold text-foreground/80 tabular-nums">{counts.pending}</span>{" "}
            <span className="text-muted-foreground">pending</span>
          </div>
          <div>
            <span className={cn("font-semibold tabular-nums", counts.failed > 0 ? "text-red-400" : "text-foreground/80")}>
              {counts.failed}
            </span>{" "}
            <span className="text-muted-foreground">failed</span>
          </div>
        </div>
      )}

      {status === "confirming" && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
          <p className="font-medium">
            This will delete {counts ? counts.pending + counts.failed : "all"} queue files permanently.
          </p>
          <p className="mt-1 text-red-400/70">Messages in the queue will not be delivered.</p>
        </div>
      )}

      {status === "done" && result && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-400">
          Cleared {String(result.cleared)} file(s).
          {Number(result.failed) > 0 && ` ${result.failed} could not be deleted.`}
        </div>
      )}

      {status === "error" && result && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
          {typeof result.error === "string" ? result.error : "Purge failed"}
        </div>
      )}

      <div className="flex items-center gap-2">
        {(status === "done" || status === "error") && (
          <button
            type="button"
            onClick={() => { setStatus("idle"); setResult(null); fetchCounts(); }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Reset
          </button>
        )}
        <div className="flex-1" />
        {status === "confirming" && (
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={status === "running"}
          onClick={() => {
            if (status === "confirming") purge();
            else setStatus("confirming");
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
            status === "confirming"
              ? "bg-red-600 text-white hover:bg-red-700"
              : status === "done"
              ? "bg-emerald-600/20 text-emerald-400"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
          {status === "done" && <CheckCircle2 className="h-3 w-3" />}
          {status === "confirming" ? "Confirm — Purge Now" : status === "running" ? "Purging…" : status === "done" ? "Purged" : "Purge Queue"}
        </button>
      </div>
    </div>
  );
}

/* ── main view ────────────────────────────────────── */

export function QuickActionsView() {
  return (
    <SectionLayout>
      <SectionHeader
        title="Quick Actions"
        description="Operational controls — no SSH needed"
        
      />
      <SectionBody>
        <div className="space-y-6">
          {/* VPS actions note */}
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>Restart Gateway</strong> and <strong>Reconnect Networks</strong> require Docker access on the VPS.
              Copy the command and ask Scotty (full exec) to run it, or paste it directly into the VPS terminal.
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* ── VPS commands (copy only) ── */}
            <VpsActionCard
              title="Restart Gateway"
              description="Bring the OpenClaw gateway Docker container down and back up. Run this when the gateway is unresponsive."
              icon={RefreshCw}
              command={VPS_COMMANDS["restart-gateway"]}
              warning="This will disconnect all active agent sessions and interrupt in-flight tasks."
            />

            <VpsActionCard
              title="Reconnect Docker Networks"
              description="Reconnect litellm-proxy and n8n containers to the openclaw_default network. Run this after a gateway restart."
              icon={Network}
              command={VPS_COMMANDS["reconnect-networks"]}
            />

            {/* ── Local actions (run via Next.js API) ── */}
            <DeliveryQueueCard />

            <LocalActionCard
              title="Backup Config"
              description="Snapshot openclaw.json, mcporter.json, exec-approvals.json, and cron/jobs.json to ~/config-backups/ with a timestamp."
              icon={HardDrive}
              iconColor="emerald"
              actionKey="backup-config"
              renderResult={(r) => (
                <div>
                  <p>Backed up to: <code className="font-mono">{String(r.destDir)}</code></p>
                  {Array.isArray(r.backedUp) && r.backedUp.length > 0 && (
                    <p className="mt-1">Files: {(r.backedUp as string[]).join(", ")}</p>
                  )}
                  {Array.isArray(r.skipped) && r.skipped.length > 0 && (
                    <p className="mt-1 text-emerald-400/60">Skipped (not found): {(r.skipped as string[]).join(", ")}</p>
                  )}
                </div>
              )}
            />

            <LocalActionCard
              title="Validate Config"
              description="Run a gateway config validation check and display the result."
              icon={CheckCircle2}
              iconColor="sky"
              actionKey="validate-config"
              renderResult={(r) => (
                <div>
                  <p className="font-medium">{r.valid as boolean ? "Config is valid ✓" : "Config has issues"}</p>
                  {r.result && (
                    <pre className="mt-2 overflow-x-auto rounded bg-black/20 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-emerald-300/80 max-h-32">
                      {JSON.stringify(r.result as Record<string, unknown>, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            />
          </div>
        </div>
      </SectionBody>
    </SectionLayout>
  );
}
