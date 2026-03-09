import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Each agent maps to an env var name.
// Key name → display label.
const AGENT_KEYS: Record<string, string> = {
  OPENROUTER_KEY_EA_JOHN: "EA — John",
  OPENROUTER_KEY_EA_JO: "EA — Jo",
  OPENROUTER_KEY_BUILD: "Build (Hamilton)",
  OPENROUTER_KEY_DELIVERY_ACS: "Delivery ACS",
  OPENROUTER_KEY_DEAL_CLOSER: "Deal Closer",
  OPENROUTER_KEY_MARKET_INTEL: "Market Intel",
  OPENROUTER_KEY_WATCH_SYSTEMS: "Watch Systems",
  OPENROUTER_KEY_ORCHESTRATOR: "Orchestrator",
};

type OpenRouterKeyData = {
  label: string;
  usage: number;      // spend in USD (credits consumed)
  limit: number | null;
  is_free_tier: boolean;
  rate_limit: {
    requests: number;
    interval: string;
  } | null;
};

export type BudgetEntry = {
  envKey: string;
  agentLabel: string;
  /** null = key not configured */
  data: OpenRouterKeyData | null;
  /** null = key not configured; "error" means fetch failed */
  status: "ok" | "error" | "missing";
  errorMessage?: string;
};

async function fetchKeyInfo(apiKey: string): Promise<OpenRouterKeyData> {
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: OpenRouterKeyData };
  if (!json.data) throw new Error("Unexpected response shape from OpenRouter");
  return json.data;
}

export async function GET() {
  const entries: BudgetEntry[] = await Promise.all(
    Object.entries(AGENT_KEYS).map(async ([envKey, agentLabel]) => {
      const apiKey = process.env[envKey];
      if (!apiKey) {
        return {
          envKey,
          agentLabel,
          data: null,
          status: "missing" as const,
        };
      }
      try {
        const data = await fetchKeyInfo(apiKey);
        return {
          envKey,
          agentLabel,
          data,
          status: "ok" as const,
        };
      } catch (err) {
        return {
          envKey,
          agentLabel,
          data: null,
          status: "error" as const,
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return NextResponse.json({ entries });
}
