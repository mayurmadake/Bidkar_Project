import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/auth";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

function isAuthenticated(request: NextRequest) {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = isAuthenticated(request);

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath(pathname) || authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"]
};
