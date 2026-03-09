import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "mc_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getUsers(): Array<{ username: string; password: string }> {
  const users: Array<{ username: string; password: string }> = [];
  const u1 = process.env.AUTH_USERNAME_1;
  const p1 = process.env.AUTH_PASSWORD_1;
  if (u1 && p1) users.push({ username: u1, password: p1 });
  const u2 = process.env.AUTH_USERNAME_2;
  const p2 = process.env.AUTH_PASSWORD_2;
  if (u2 && p2) users.push({ username: u2, password: p2 });
  return users;
}

function sessionToken(username: string): string {
  const secret =
    process.env.AUTH_SESSION_SECRET ||
    `${process.env.AUTH_USERNAME_1}:${process.env.AUTH_PASSWORD_1}`;
  return Buffer.from(`${username}:${secret}`).toString("base64");
}

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const users = getUsers();
  const match = users.find(
    (u) => u.username === username && u.password === password,
  );

  if (!match) {
    // Constant-time-ish delay to discourage brute force
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = sessionToken(match.username);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // Tailscale handles TLS
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}
