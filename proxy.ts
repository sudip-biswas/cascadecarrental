import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirect } from "@/lib/utils";

const PROTECTED_GUEST_PATHS = ["/trips", "/messages", "/profile"];
const CHECKOUT_PATH = /^\/cars\/[^/]+\/checkout/;
const PROTECTED_HOST_PATHS = ["/host"];
const AUTH_PATHS = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not remove this block
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Signed-in users skip the auth pages and carry on where they were headed.
  if (user && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    const next = safeRedirect(request.nextUrl.searchParams.get("redirectTo"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  const isProtected =
    PROTECTED_GUEST_PATHS.some((p) => pathname.startsWith(p)) ||
    PROTECTED_HOST_PATHS.some((p) => pathname.startsWith(p)) ||
    CHECKOUT_PATH.test(pathname);

  if (!user && isProtected) {
    const loginUrl = new URL("/login", request.url);
    // Keep the query so booking dates survive the trip through login.
    loginUrl.searchParams.set("redirectTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
