import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Paths that never require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/", // NextAuth routes (OAuth callbacks, session, etc.)
  "/icons/",
  "/_next/",
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (!req.auth) {
    // API routes get 401, pages get redirected to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
