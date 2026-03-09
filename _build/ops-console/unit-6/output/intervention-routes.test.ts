/**
 * Tests for agent intervention API routes:
 *   - clear-session
 *   - pause-heartbeat
 *   - resume-heartbeat
 *   - emergency-stop
 *
 * Each route handler is imported directly and tested in isolation.
 * `runCli` is mocked at the module level.
 */

import { jest } from "@jest/globals";

// --- Mock @/lib/openclaw before importing route handlers ---
const mockRunCli = jest.fn<() => Promise<string>>();

jest.mock("@/lib/openclaw", () => ({
  runCli: mockRunCli,
}));

// Dynamic imports after mock setup
const { POST: clearSession } = await import("./clear-session-route");
const { POST: pauseHeartbeat } = await import("./pause-heartbeat-route");
const { POST: resumeHeartbeat } = await import("./resume-heartbeat-route");
const { POST: emergencyStop } = await import("./emergency-stop-route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/agents/test-agent/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "agent-abc"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// clear-session
// ---------------------------------------------------------------------------

describe("POST /api/agents/[id]/clear-session", () => {
  beforeEach(() => mockRunCli.mockReset());

  it("returns 400 when confirm is missing", async () => {
    const res = await clearSession(makeRequest({}), makeParams());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returns 400 when confirm is false", async () => {
    const res = await clearSession(makeRequest({ confirm: false }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    mockRunCli.mockResolvedValueOnce("ok");
    const res = await clearSession(makeRequest({ confirm: true }), makeParams("agent-abc"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      agentId: "agent-abc",
      action: "clear-session",
    });
    expect(typeof json.timestamp).toBe("string");
    expect(mockRunCli).toHaveBeenCalledWith(["sessions", "clear", "agent-abc"]);
  });

  it("returns 500 when runCli throws", async () => {
    mockRunCli.mockRejectedValueOnce(new Error("CLI error"));
    const res = await clearSession(makeRequest({ confirm: true }), makeParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("CLI error");
  });
});

// ---------------------------------------------------------------------------
// pause-heartbeat
// ---------------------------------------------------------------------------

describe("POST /api/agents/[id]/pause-heartbeat", () => {
  beforeEach(() => mockRunCli.mockReset());

  it("returns 400 when confirm is missing", async () => {
    const res = await pauseHeartbeat(makeRequest({}), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    mockRunCli.mockResolvedValueOnce("ok");
    const res = await pauseHeartbeat(makeRequest({ confirm: true }), makeParams("agent-xyz"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      agentId: "agent-xyz",
      action: "pause-heartbeat",
    });
    expect(mockRunCli).toHaveBeenCalledWith(["cron", "pause", "--agent", "agent-xyz"]);
  });

  it("returns 500 when runCli throws", async () => {
    mockRunCli.mockRejectedValueOnce(new Error("cron error"));
    const res = await pauseHeartbeat(makeRequest({ confirm: true }), makeParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("cron error");
  });
});

// ---------------------------------------------------------------------------
// resume-heartbeat
// ---------------------------------------------------------------------------

describe("POST /api/agents/[id]/resume-heartbeat", () => {
  beforeEach(() => mockRunCli.mockReset());

  it("returns 400 when confirm is missing", async () => {
    const res = await resumeHeartbeat(makeRequest({}), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    mockRunCli.mockResolvedValueOnce("ok");
    const res = await resumeHeartbeat(makeRequest({ confirm: true }), makeParams("agent-xyz"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      agentId: "agent-xyz",
      action: "resume-heartbeat",
    });
    expect(mockRunCli).toHaveBeenCalledWith(["cron", "resume", "--agent", "agent-xyz"]);
  });

  it("returns 500 when runCli throws", async () => {
    mockRunCli.mockRejectedValueOnce(new Error("resume error"));
    const res = await resumeHeartbeat(makeRequest({ confirm: true }), makeParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("resume error");
  });
});

// ---------------------------------------------------------------------------
// emergency-stop
// ---------------------------------------------------------------------------

describe("POST /api/agents/[id]/emergency-stop", () => {
  beforeEach(() => mockRunCli.mockReset());

  it("returns 400 when confirm is missing", async () => {
    const res = await emergencyStop(makeRequest({}), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 200 with steps on success", async () => {
    mockRunCli
      .mockResolvedValueOnce("ok") // cron pause
      .mockResolvedValueOnce("ok"); // message send
    const res = await emergencyStop(makeRequest({ confirm: true }), makeParams("agent-danger"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      agentId: "agent-danger",
      action: "emergency-stop",
      steps: ["crons_paused", "stop_message_sent"],
    });
    expect(typeof json.timestamp).toBe("string");
  });

  it("calls cron pause then message send in order", async () => {
    mockRunCli.mockResolvedValue("ok");
    await emergencyStop(makeRequest({ confirm: true }), makeParams("agent-danger"));
    expect(mockRunCli).toHaveBeenNthCalledWith(1, ["cron", "pause", "--agent", "agent-danger"]);
    expect(mockRunCli).toHaveBeenNthCalledWith(2, [
      "message",
      "send",
      "--to",
      "agent-danger",
      "--message",
      "STOP. Do not take any further actions. Wait for instructions from John or Jo.",
    ]);
  });

  it("returns 500 when cron pause fails", async () => {
    mockRunCli.mockRejectedValueOnce(new Error("cron pause failed"));
    const res = await emergencyStop(makeRequest({ confirm: true }), makeParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("cron pause failed");
  });

  it("returns 500 when message send fails", async () => {
    mockRunCli
      .mockResolvedValueOnce("ok") // cron pause succeeds
      .mockRejectedValueOnce(new Error("message failed")); // send fails
    const res = await emergencyStop(makeRequest({ confirm: true }), makeParams());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("message failed");
  });
});
