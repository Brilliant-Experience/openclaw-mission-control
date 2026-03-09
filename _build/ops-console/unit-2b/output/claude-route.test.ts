// Simple test file that meets spec requirements
// Jest imports will be handled by build system

import { POST } from "./claude-route";

// Minimal mock for Anthropic SDK
const mockStream = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: { stream: mockStream },
  })),
}));

describe("POST /api/chat/claude", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  // Test 1: Returns 400 when messages array is missing
  it("returns 400 when messages is missing", async () => {
    const req = new Request("http://localhost/api/chat/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/messages/i);
  });

  // Test 2: Returns 500 when ANTHROPIC_API_KEY is not set
  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const req = new Request("http://localhost/api/chat/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("ANTHROPIC_API_KEY not configured");
  });

  // Test 3: Returns SSE stream with correct headers
  it("returns correct SSE headers", async () => {
    // Mock a stream that yields one token
    const mockIter = (async function* () {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "hi" } };
    })();
    mockStream.mockReturnValue({
      [Symbol.asyncIterator]: () => mockIter,
      abort: jest.fn(),
    });

    const req = new Request("http://localhost/api/chat/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });

  // Test 4: Streams token events in correct format
  it("streams token events as SSE", async () => {
    const tokens = ["Hello", ",", " world"];
    const mockIter = (async function* () {
      for (const token of tokens) {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: token } };
      }
    })();
    mockStream.mockReturnValue({
      [Symbol.asyncIterator]: () => mockIter,
      abort: jest.fn(),
    });

    const req = new Request("http://localhost/api/chat/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "greet" }] }),
    });
    const res = await POST(req);
    const text = await res.text();
    expect(text).toContain("data: Hello\n\n");
    expect(text).toContain("data: ,\n\n");
    expect(text).toContain("data:  world\n\n");
  });

  // Test 5: Ends stream with data: [DONE]
  it("ends stream with [DONE]", async () => {
    const mockIter = (async function* () {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "token" } };
    })();
    mockStream.mockReturnValue({
      [Symbol.asyncIterator]: () => mockIter,
      abort: jest.fn(),
    });

    const req = new Request("http://localhost/api/chat/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
    });
    const res = await POST(req);
    const text = await res.text();
    expect(text).toContain("data: token\n\n");
    expect(text).toContain("data: [DONE]\n\n");
  });
});