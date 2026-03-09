/**
 * Tests for session routing features:
 *   1. Stream route passes sessionKey to gateway when provided
 *   2. Stream route works normally (no session header) when sessionKey is absent
 *   3. Sessions list returns array from CLI output
 *   4. Sessions list returns empty array when CLI fails
 *
 * Requires: `npm install --save-dev @types/jest jest ts-jest`
 * (The project currently uses Playwright for e2e only; these unit tests need
 * Jest + ts-jest added as dev dependencies before running with `npm test`.)
 */

/// <reference types="jest" />

// ---------------------------------------------------------------------------
// Mock setup — must be before any module imports
// ---------------------------------------------------------------------------

// Paths / auth mocks
const mockGetGatewayUrl = jest.fn().mockResolvedValue("http://localhost:9090");
const mockGetGatewayToken = jest.fn().mockReturnValue("test-token");

// Request log mocks (fire-and-forget, no assertions needed)
const mockLogRequest = jest.fn();
const mockLogError = jest.fn();

// Responses endpoint mocks (pre-enabled in tests)
const mockTriggerResponsesEndpointSetup = jest.fn();
const mockWaitForResponsesEndpoint = jest.fn().mockResolvedValue(undefined);

// openclaw lib mock (for sessions list tests)
const mockRunCliJson = jest.fn();

jest.mock("@/lib/paths", () => ({
  getGatewayUrl: mockGetGatewayUrl,
  getGatewayToken: mockGetGatewayToken,
}));

jest.mock("@/lib/openresponses", () => ({
  guessMime: jest.fn().mockReturnValue("application/octet-stream"),
}));

jest.mock("@/lib/request-log", () => ({
  logRequest: mockLogRequest,
  logError: mockLogError,
}));

jest.mock("@/lib/responses-endpoint", () => ({
  triggerResponsesEndpointSetup: mockTriggerResponsesEndpointSetup,
  waitForResponsesEndpoint: mockWaitForResponsesEndpoint,
}));

jest.mock("@/lib/openclaw", () => ({
  runCliJson: mockRunCliJson,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal SSE-style streaming response from the "gateway". */
function makeStreamResponse(body = "data: {}\n\n"): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** Create a minimal POST request for the stream route. */
function makeStreamRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests: stream route — session routing
// ---------------------------------------------------------------------------

describe("POST /api/chat/stream — session routing", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(makeStreamResponse());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // Dynamically require the route under test so mocks are applied first
  function getRoute() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../output/stream-route-updated").POST as (req: Request) => Promise<Response>;
  }

  test("1. passes x-openclaw-session-key header when sessionKey is provided", async () => {
    jest.resetModules();
    const { POST } = await import("../output/stream-route-updated");

    const req = makeStreamRequest({
      messages: [{ role: "user", content: "hello" }],
      sessionKey: "agent:scotty:session-abc123",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, fetchInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["x-openclaw-session-key"]).toBe("agent:scotty:session-abc123");
    expect(headers["x-openclaw-agent-id"]).toBe("main");
  });

  test("2. omits x-openclaw-session-key header when sessionKey is absent", async () => {
    jest.resetModules();
    const { POST } = await import("../output/stream-route-updated");

    const req = makeStreamRequest({
      messages: [{ role: "user", content: "hello" }],
      // no sessionKey
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, fetchInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["x-openclaw-session-key"]).toBeUndefined();
    // All other core headers still present
    expect(headers["x-openclaw-agent-id"]).toBe("main");
    expect(headers["Authorization"]).toBe("Bearer test-token");
  });

  test("2a. omits x-openclaw-session-key when sessionKey is an empty string", async () => {
    jest.resetModules();
    const { POST } = await import("../output/stream-route-updated");

    const req = makeStreamRequest({
      messages: [{ role: "user", content: "hello" }],
      sessionKey: "   ", // whitespace-only — should be treated as absent
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const [, fetchInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["x-openclaw-session-key"]).toBeUndefined();
  });

  test("2b. uses trimmed sessionKey value", async () => {
    jest.resetModules();
    const { POST } = await import("../output/stream-route-updated");

    const req = makeStreamRequest({
      messages: [{ role: "user", content: "hello" }],
      sessionKey: "  my-session  ",
    });

    await POST(req);

    const [, fetchInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["x-openclaw-session-key"]).toBe("my-session");
  });

  test("1a. agentId from body is forwarded to gateway alongside sessionKey", async () => {
    jest.resetModules();
    const { POST } = await import("../output/stream-route-updated");

    const req = makeStreamRequest({
      messages: [{ role: "user", content: "run status" }],
      agentId: "scotty",
      sessionKey: "agent:scotty:xyz",
    });

    await POST(req);

    const [gwUrl, fetchInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(gwUrl).toContain("/v1/responses");
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["x-openclaw-agent-id"]).toBe("scotty");
    expect(headers["x-openclaw-session-key"]).toBe("agent:scotty:xyz");
    const body = JSON.parse(fetchInit.body as string) as { model: string };
    expect(body.model).toBe("openclaw:scotty");
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/sessions/list
// ---------------------------------------------------------------------------

describe("GET /api/sessions/list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function callSessionsList(): Promise<Response> {
    jest.resetModules();
    const { GET } = await import("../output/sessions-list-route");
    return GET();
  }

  test("3. returns mapped SessionSummary array from CLI output (object shape)", async () => {
    mockRunCliJson.mockResolvedValueOnce({
      sessions: [
        { key: "agent:build:main", sessionId: "build", ageMs: 30_000 },
        { key: "agent:scotty:chat", sessionId: "scotty", ageMs: 5 * 60_000 },
        { key: "agent:main:default", sessionId: "main", ageMs: 15 * 60_000 },
      ],
    });

    const res = await callSessionsList();
    expect(res.status).toBe(200);

    const data = await res.json() as Array<{
      key: string;
      label: string;
      agentId: string;
      status: string;
    }>;

    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);

    // First session — recently active
    expect(data[0]).toMatchObject({
      key: "agent:build:main",
      agentId: "build",
      status: "active",
    });
    expect(data[0].label).toBe("build — agent:build:main".slice(0, 40));

    // Second session — idle (within 10 min)
    expect(data[1]).toMatchObject({
      key: "agent:scotty:chat",
      agentId: "scotty",
      status: "idle",
    });

    // Third session — inactive (older than 10 min)
    expect(data[2]).toMatchObject({
      key: "agent:main:default",
      agentId: "main",
      status: "inactive",
    });
  });

  test("3a. returns mapped SessionSummary array from CLI output (bare array shape)", async () => {
    mockRunCliJson.mockResolvedValueOnce([
      { key: "agent:x:y", sessionId: "x", ageMs: 60_000 },
    ]);

    const res = await callSessionsList();
    const data = await res.json() as Array<{ key: string; agentId: string; status: string }>;

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ key: "agent:x:y", agentId: "x", status: "active" });
  });

  test("3b. label is truncated to 40 chars", async () => {
    const longAgentId = "verylongagentidentifier";
    const longKey = "agent:verylongagentidentifier:somekey123";
    mockRunCliJson.mockResolvedValueOnce({
      sessions: [{ key: longKey, sessionId: longAgentId, ageMs: 0 }],
    });

    const res = await callSessionsList();
    const data = await res.json() as Array<{ label: string }>;

    expect(data[0].label.length).toBeLessThanOrEqual(40);
  });

  test("3c. sessions with no sessionId fall back to using key as agentId", async () => {
    mockRunCliJson.mockResolvedValueOnce({
      sessions: [{ key: "agent:noname:session", ageMs: 1000 }],
    });

    const res = await callSessionsList();
    const data = await res.json() as Array<{ agentId: string }>;

    expect(data[0].agentId).toBe("agent:noname:session");
  });

  test("3d. filters out sessions with missing or empty keys", async () => {
    mockRunCliJson.mockResolvedValueOnce({
      sessions: [
        { key: "valid-key", sessionId: "a", ageMs: 0 },
        { key: "", sessionId: "b", ageMs: 0 }, // empty key — filtered
        { sessionId: "c", ageMs: 0 }, // no key — filtered
      ],
    });

    const res = await callSessionsList();
    const data = await res.json() as Array<{ key: string }>;

    expect(data).toHaveLength(1);
    expect(data[0].key).toBe("valid-key");
  });

  test("4. returns empty array when CLI throws", async () => {
    mockRunCliJson.mockRejectedValueOnce(new Error("CLI binary not found"));

    const res = await callSessionsList();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual([]);
  });

  test("4a. returns empty array when CLI returns empty sessions list", async () => {
    mockRunCliJson.mockResolvedValueOnce({ sessions: [] });

    const res = await callSessionsList();
    const data = await res.json();
    expect(data).toEqual([]);
  });

  test("4b. returns empty array when CLI returns unexpected shape", async () => {
    mockRunCliJson.mockResolvedValueOnce({ error: "daemon not running" });

    const res = await callSessionsList();
    const data = await res.json();
    expect(data).toEqual([]);
  });

  test("status classification boundaries", async () => {
    mockRunCliJson.mockResolvedValueOnce({
      sessions: [
        { key: "s1", sessionId: "a", ageMs: 0 },                   // active (0ms)
        { key: "s2", sessionId: "b", ageMs: 2 * 60 * 1000 },       // active (exactly 2min)
        { key: "s3", sessionId: "c", ageMs: 2 * 60 * 1000 + 1 },   // idle (just over 2min)
        { key: "s4", sessionId: "d", ageMs: 10 * 60 * 1000 },      // idle (exactly 10min)
        { key: "s5", sessionId: "e", ageMs: 10 * 60 * 1000 + 1 },  // inactive (just over 10min)
        { key: "s6", sessionId: "f", ageMs: undefined },            // inactive (no age)
      ],
    });

    const res = await callSessionsList();
    const data = await res.json() as Array<{ key: string; status: string }>;

    const byKey = Object.fromEntries(data.map((s) => [s.key, s.status]));
    expect(byKey["s1"]).toBe("active");
    expect(byKey["s2"]).toBe("active");
    expect(byKey["s3"]).toBe("idle");
    expect(byKey["s4"]).toBe("idle");
    expect(byKey["s5"]).toBe("inactive");
    expect(byKey["s6"]).toBe("inactive");
  });
});
