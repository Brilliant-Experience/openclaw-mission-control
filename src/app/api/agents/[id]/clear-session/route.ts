import { runCli } from "@/lib/openclaw";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params;
    const body = await req.json();

    if (!body?.confirm) {
      return Response.json({ error: "confirm: true required" }, { status: 400 });
    }

    await runCli(["sessions", "clear", agentId]);

    return Response.json({
      success: true,
      agentId,
      action: "clear-session",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
