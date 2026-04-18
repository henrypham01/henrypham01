import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { verifyToken } from "./lib/auth/jwt";
import { SESSION_COOKIE } from "./lib/auth/session";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = ["/login"];

function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/(vi|en)(\/.*)?$/);
  if (match) return match[2] || "/";
  return pathname;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let i18n middleware handle locale resolution first
  const pathWithoutLocale = stripLocale(pathname);

  // Public paths — skip auth check
  const isPublic = PUBLIC_PATHS.some((p) => pathWithoutLocale.startsWith(p));
  if (isPublic) {
    return intlMiddleware(request);
  }

  // Check session cookie
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    // Redirect to /login with locale prefix
    const localeMatch = pathname.match(/^\/(vi|en)/);
    const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
