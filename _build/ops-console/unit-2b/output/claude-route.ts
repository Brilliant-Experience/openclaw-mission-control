import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude streaming chat endpoint for the Ops Console.
 *
 * POST /api/chat/claude
 * Body: { messages: [{ role, content }][], systemContext?: string }
 *
 * Streams back SSE events in the same format as /api/chat/stream:
 *   data: <token text>\n\n
 *   data: [DONE]\n\n
 *   data: [ERROR] <message>\n\n
 */

interface ClaudeChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  systemContext?: string;
}

const BASE_SYSTEM_PROMPT = `You are an AI assistant embedded in the Mission Control dashboard for Brilliant Experience — an AI agency. You help the team understand their agent operations, budgets, and run statuses. Be concise, direct, and technical. You have no access to live data unless it's included in the context below.

## Current Dashboard View`;

function buildSystemPrompt(systemContext?: string): string {
  const context = systemContext?.trim() || "None";
  return `${BASE_SYSTEM_PROMPT}\n${context}`;
}

export async function POST(request: Request): Promise<Response> {
  // Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse and validate request body
  let body: ClaudeChatRequest;
  try {
    body = (await request.json()) as ClaudeChatRequest;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages, systemContext } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages array must be present and non-empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const anthropic = new Anthropic({ apiKey });

  const transformStream = new TransformStream();
  const writer = transformStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Run async generation without blocking response return
  (async () => {
    try {
      const anthropicStream = anthropic.messages.stream({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: buildSystemPrompt(systemContext),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Listen for client abort and cancel the stream
      if (request.signal) {
        request.signal.addEventListener(
          "abort",
          () => {
            anthropicStream.abort();
          },
          { once: true },
        );
      }

      for await (const event of anthropicStream) {
        // Stop if client disconnected
        if (request.signal?.aborted) break;

        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          await writer.write(
            encoder.encode(`data: ${event.delta.text}\n\n`),
          );
        }
      }

      await writer.write(encoder.encode(`data: [DONE]\n\n`));
      await writer.close();
    } catch (err: unknown) {
      // Don't write error if client already disconnected
      if (!request.signal?.aborted) {
        const message = err instanceof Error ? err.message : String(err);
        await writer
          .write(encoder.encode(`data: [ERROR] ${message}\n\n`))
          .catch(() => {});
      }
      await writer.close().catch(() => {});
    }
  })();

  return new Response(transformStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
