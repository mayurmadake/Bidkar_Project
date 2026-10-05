import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, authCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", { ...authCookieOptions, maxAge: 0 });
  return response;
}
