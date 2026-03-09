import { NextRequest, NextResponse } from "next/server";
import { gatewayCall } from "@/lib/openclaw";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Action: purge-delivery-queue
// Counts and clears .json files in the delivery queue directory.
// ---------------------------------------------------------------------------
async function purgeDeliveryQueue(): Promise<{ cleared: number; failed: number; errors: string[] }> {
  const BASE = process.env.DELIVERY_QUEUE_PATH || "/home/node/.openclaw/delivery-queue";
  const dirs = [BASE, path.join(BASE, "failed")];
  let cleared = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(dir, f));
          cleared++;
        } catch (err) {
          failed++;
          errors.push(`${f}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { cleared, failed, errors };
}

// ---------------------------------------------------------------------------
// Action: backup-config
// Copies key config files to ~/config-backups/ with a timestamp.
// ---------------------------------------------------------------------------
async function backupConfig(): Promise<{ backedUp: string[]; skipped: string[]; destDir: string }> {
  const CONFIG_BASE = process.env.OPENCLAW_CONFIG_PATH || "/opt/openclaw/config";
  const DEST_BASE = process.env.CONFIG_BACKUP_PATH || path.join(process.env.HOME || "/root", "config-backups");

  const sources = [
    path.join(CONFIG_BASE, "openclaw.json"),
    path.join(CONFIG_BASE, "mcporter.json"),
    path.join(CONFIG_BASE, "exec-approvals.json"),
    path.join(CONFIG_BASE, "cron/jobs.json"),
  ];

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const destDir = path.join(DEST_BASE, ts);

  fs.mkdirSync(destDir, { recursive: true });

  const backedUp: string[] = [];
  const skipped: string[] = [];

  for (const src of sources) {
    const name = path.basename(src);
    const dest = path.join(destDir, name);
    try {
      if (!fs.existsSync(src)) {
        skipped.push(name);
        continue;
      }
      fs.copyFileSync(src, dest);
      backedUp.push(name);
    } catch {
      skipped.push(name);
    }
  }

  return { backedUp, skipped, destDir };
}

// ---------------------------------------------------------------------------
// Action: validate-config
// Calls openclaw gateway diagnostics endpoint.
// ---------------------------------------------------------------------------
async function validateConfig(): Promise<{ valid: boolean; result: unknown }> {
  try {
    const result = await gatewayCall<Record<string, unknown>>("config.validate", {}, 15000);
    return { valid: true, result };
  } catch (err) {
    return { valid: false, result: { error: err instanceof Error ? err.message : String(err) } };
  }
}

// ---------------------------------------------------------------------------
// Action: count-delivery-queue
// Returns queue sizes without clearing.
// ---------------------------------------------------------------------------
async function countDeliveryQueue(): Promise<{ pending: number; failed: number }> {
  const BASE = process.env.DELIVERY_QUEUE_PATH || "/home/node/.openclaw/delivery-queue";
  function countJson(dir: string): number {
    try {
      if (!fs.existsSync(dir)) return 0;
      return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }
  return {
    pending: countJson(BASE),
    failed: countJson(path.join(BASE, "failed")),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  let body: { action?: string; [k: string]: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  try {
    switch (action) {
      case "purge-delivery-queue": {
        const result = await purgeDeliveryQueue();
        return NextResponse.json({ ok: true, action, ...result });
      }

      case "backup-config": {
        const result = await backupConfig();
        return NextResponse.json({ ok: true, action, ...result });
      }

      case "validate-config": {
        const result = await validateConfig();
        return NextResponse.json({ ok: result.valid, action, ...result });
      }

      case "count-delivery-queue": {
        const result = await countDeliveryQueue();
        return NextResponse.json({ ok: true, action, ...result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error(`Quick action '${action}' failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
