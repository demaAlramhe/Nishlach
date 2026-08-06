import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge Runtime middleware only.
 * - Uses @supabase/ssr (not a direct @supabase/supabase-js import)
 * - No Node APIs (no path/fs/__dirname)
 * - All logic inlined here so the Edge bundle has a single entry with no @/ aliases
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session — required for Server Components + auth cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isCourierLogin = pathname === "/courier/login";
  const isCourierArea =
    pathname === "/courier" || pathname.startsWith("/courier/");
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  if ((isCourierArea && !isCourierLogin && !user) || (isAdminArea && !user)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/courier/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (isCourierLogin && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/courier";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
