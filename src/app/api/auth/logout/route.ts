import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  // NextAuth handles session cleanup via /api/auth/signout
  // This route exists for backwards compatibility with any UI calling POST /api/auth/logout
  const response = NextResponse.redirect(
    new URL("/api/auth/signout", process.env.NEXTAUTH_URL || "http://localhost:3000"),
  );
  return response;
}
