import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED = ["/browse", "/matches", "/chat", "/profile", "/admin211208"];
const ONBOARDING = ["/onboarding"];
const PUBLIC = ["/login", "/terms", "/privacy", "/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isOnboarding = ONBOARDING.some((p) => pathname.startsWith(p));
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p));

  // Always allow Next internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Supabase server client inside middleware
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // Not logged in -> kick out from protected
  if (!user && (isProtected || isOnboarding)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in
  if (user) {
    // Admin route is handled in its own page too, but extra safety is fine

    // If user is trying to access protected pages, ensure profile complete
    if (isProtected) {
      const { data: ok } = await supabase.rpc("profile_is_complete", {
        p_user: user.id,
      });

      if (!ok) {
        const url = req.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }

    // If they go to /login while logged -> send to browse
    if (pathname.startsWith("/login")) {
      const url = req.nextUrl.clone();
      url.pathname = "/browse";
      return NextResponse.redirect(url);
    }
  }

  // Public pages are ok
  if (isPublic) return res;

  return res;
}

export const config = {
  matcher: ["/((?!api).*)"],
};
