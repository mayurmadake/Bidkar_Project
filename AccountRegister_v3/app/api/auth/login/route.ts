import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE, AUTH_PASSWORD, AUTH_USERNAME, authCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const credentials = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;

  if (credentials?.username !== AUTH_USERNAME || credentials?.password !== AUTH_PASSWORD) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE, authCookieOptions);
  return response;
}
