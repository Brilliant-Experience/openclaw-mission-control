import { NextResponse } from "next/server";
import { runCliJson } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by `openclaw sessions list --json`. */
interface CliSession {
  key: string;
  /** The agent/session identifier (e.g. "main", "build", "scotty"). */
  sessionId?: string;
  /** Age of the last activity in milliseconds. */
  ageMs?: number;
  /** Human-readable kind/type of the session. */
  kind?: string;
}

interface CliSessionsListResponse {
  sessions?: CliSession[];
  // Some versions return a top-level array directly
  [key: string]: unknown;
}

/** Simplified session summary returned by this endpoint. */
export interface SessionSummary {
  key: string;
  label: string;
  agentId: string;
  status: "active" | "idle" | "inactive";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable status from the session's last-activity age.
 *
 * Thresholds chosen to match observable OpenClaw behaviour:
 *   active   — activity within the last 2 minutes
 *   idle     — activity within the last 10 minutes
 *   inactive — older than 10 minutes or unknown age
 */
function deriveStatus(ageMs: number | undefined): "active" | "idle" | "inactive" {
  if (ageMs === undefined || ageMs < 0) return "inactive";
  if (ageMs <= 2 * 60 * 1000) return "active";
  if (ageMs <= 10 * 60 * 1000) return "idle";
  return "inactive";
}

/**
 * Build the display label for a session.
 * Format: "<agentId> — <sessionKey>" truncated to 40 characters.
 */
function buildLabel(agentId: string, key: string): string {
  const full = `${agentId} — ${key}`;
  return full.length > 40 ? full.slice(0, 40) : full;
}

/**
 * Transform a raw CLI session into the simplified SessionSummary shape.
 */
function toSessionSummary(raw: CliSession): SessionSummary {
  const agentId = raw.sessionId ?? raw.key;
  return {
    key: raw.key,
    label: buildLabel(agentId, raw.key),
    agentId,
    status: deriveStatus(raw.ageMs),
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/sessions/list
 *
 * Returns a simplified list of all active sessions, suitable for populating
 * the session selector dropdown in the Scotty tab of the OpsConsole.
 *
 * Calls `openclaw sessions list --json` via the CLI and transforms the output
 * into a flat array of SessionSummary objects.  Returns an empty array (not
 * an error) if the CLI call fails — the UI should handle missing data
 * gracefully.
 */
export async function GET(): Promise<NextResponse<SessionSummary[]>> {
  try {
    // runCliJson automatically appends --json to the args
    const data = await runCliJson<CliSessionsListResponse | CliSession[]>(
      ["sessions", "list"],
      15000,
    );

    // The CLI may return either `{ sessions: [...] }` or a bare array
    let rawSessions: CliSession[];
    if (Array.isArray(data)) {
      rawSessions = data;
    } else if (Array.isArray(data.sessions)) {
      rawSessions = data.sessions as CliSession[];
    } else {
      rawSessions = [];
    }

    const summaries: SessionSummary[] = rawSessions
      .filter((s): s is CliSession => typeof s?.key === "string" && s.key.trim() !== "")
      .map(toSessionSummary);

    return NextResponse.json(summaries);
  } catch {
    // CLI unavailable, parse error, or session daemon not running — return
    // empty array so callers don't need to handle errors for optional UI data.
    return NextResponse.json([]);
  }
}
