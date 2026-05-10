import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isPublicPath =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/register") ||
    path.startsWith("/pending");

  if (!user && !isPublicPath) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    supabaseResponse.cookies.getAll().forEach(cookie =>
      redirectResponse.cookies.set(cookie.name, cookie.value)
    );
    return redirectResponse;
  }

  if (user && (path === "/login" || path === "/register")) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    supabaseResponse.cookies.getAll().forEach(cookie =>
      redirectResponse.cookies.set(cookie.name, cookie.value)
    );
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
