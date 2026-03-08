import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Auth middleware — simple username/password, session cookie.
// Enabled only when AUTH_USERNAME_1 env var is set.
// Users: up to 2, configured via env vars:
//   AUTH_USERNAME_1 / AUTH_PASSWORD_1
//   AUTH_USERNAME_2 / AUTH_PASSWORD_2
// Session secret: AUTH_SESSION_SECRET (falls back to AUTH_USERNAME_1+AUTH_PASSWORD_1)
// ---------------------------------------------------------------------------

const COOKIE_NAME = "mc_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Paths that are always public (no auth required)
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/login",
  "/icons/",
  "/_next/",
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

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

function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_USERNAME_1);
}

function sessionToken(username: string): string {
  // Simple deterministic token: base64(username:secret)
  // In production use a proper HMAC; this is sufficient for Tailscale-only access.
  const secret =
    process.env.AUTH_SESSION_SECRET ||
    `${process.env.AUTH_USERNAME_1}:${process.env.AUTH_PASSWORD_1}`;
  return Buffer.from(`${username}:${secret}`).toString("base64");
}

function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const users = getUsers();
  return users.some((u) => sessionToken(u.username) === token);
}

export function middleware(request: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (isValidSession(sessionCookie)) return NextResponse.next();

  // Not authenticated — redirect to login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
