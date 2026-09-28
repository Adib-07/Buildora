import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { supabaseConfig } from "@/lib/config/env";

/**
 * Optimistic route guard.
 *
 * Redirects a signed-out visitor away from the application before the request
 * reaches a page, and a signed-in one away from the sign-in page. This is a
 * convenience and a first line of defence, not the boundary: the docs are
 * explicit that Proxy must not be the only check, so every protected page also
 * calls `requireSession()` and every query runs through the data layer, where
 * the JWT is revalidated and RLS applies. Deleting this file would lose the
 * redirect, not the security.
 *
 * `getUser()` revalidates against the Auth server rather than reading a decoded
 * cookie, so an expired or forged token counts as signed out here too.
 */

const PUBLIC_PATHS = ["/", "/login"];

/** Every page inside the authenticated shell. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/attendance",
  "/tasks",
  "/disputes",
  "/hazards",
  "/workers",
  "/summary",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let signedIn = false;
  try {
    // Must be constructed per request: this client reads and refreshes the
    // caller's cookies, so a shared instance would leak one visitor's session
    // into another's request.
    const supabase = createServerClient(
      supabaseConfig.url(),
      supabaseConfig.publishableKey(),
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            for (const cookie of cookies) {
              request.cookies.set(cookie.name, cookie.value);
            }
          },
        },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    const { data } = await supabase.auth.getUser();
    signedIn = data.user !== null;
  } catch {
    // Supabase unreachable or unconfigured. Fail closed: treat as signed out
    // and let the page-level guard produce the real error message, rather than
    // letting an unchecked request through.
    signedIn = false;
  }

  if (isProtected(pathname) && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (PUBLIC_PATHS.includes(pathname) && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except the API (it has its own auth), Next internals and
    // static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
