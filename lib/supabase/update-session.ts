import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-compatible session refresh + /courier route protection.
 * Imported by root middleware.ts via a relative path (not @/) so Vercel Edge can bundle it.
 */
export async function updateSession(request: NextRequest) {
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
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isCourierLogin = pathname === "/courier/login";
  const isCourierArea =
    pathname === "/courier" || pathname.startsWith("/courier/");

  if (isCourierArea && !isCourierLogin && !user) {
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
