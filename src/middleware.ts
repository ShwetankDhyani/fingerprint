import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

const LIMITED_PREFIXES = ["/api/payments/", "/api/webhooks/"];

const STAFF_PREFIXES = ["/admin"];
const CLIENT_PREFIXES = ["/client"];
const AUTH_ROUTES = ["/login", "/invite", "/forgot-password", "/update-password"];

function withSurface(request: NextRequest, surface: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-lynx-surface", surface);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const surface =
    pathname.startsWith("/admin") || pathname.startsWith("/client")
      ? "portal"
      : pathname.startsWith("/login") ||
          pathname.startsWith("/invite") ||
          pathname.startsWith("/forgot-password") ||
          pathname.startsWith("/update-password") ||
          pathname.startsWith("/auth/")
        ? "auth"
        : pathname.startsWith("/q/")
          ? "quote"
          : "marketing";

  // --- Payment/webhook rate limiting (existing behaviour) ---
  const shouldLimit = LIMITED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (shouldLimit) {
    const isWebhook = pathname.startsWith("/api/webhooks/");
    const ip = clientIpFromHeaders(request.headers);
    const result = rateLimit(
      `mw:${pathname}:${ip}`,
      isWebhook ? 120 : 20,
      60_000,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
            ),
          },
        },
      );
    }
    const limited = NextResponse.next();
    limited.headers.set("X-RateLimit-Remaining", String(result.remaining));
    return limited;
  }

  const needsAuth =
    STAFF_PREFIXES.some((p) => pathname.startsWith(p)) ||
    CLIENT_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!needsAuth && !isAuthRoute) {
    return withSurface(request, surface);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Soft-fail when auth isn't configured yet — show login empty state instead of 500.
  if (!url || !key) {
    if (needsAuth) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      login.searchParams.set("reason", "auth-unconfigured");
      return NextResponse.redirect(login);
    }
    return withSurface(request, surface);
  }

  let response = withSurface(request, surface);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = withSurface(request, surface);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (needsAuth && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (user && pathname === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, account_status")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile?.role as string | undefined;
    const dest =
      role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF"
        ? "/admin"
        : "/client";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (user && needsAuth) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, account_status")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile?.role as string | undefined) ?? "CLIENT";
    const isStaff =
      role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF";

    if ((profile?.account_status as string | undefined) === "dormant") {
      await supabase.auth.signOut();
      const login = new URL("/login", request.url);
      login.searchParams.set("reason", "dormant");
      return NextResponse.redirect(login);
    }

    if (pathname.startsWith("/admin") && !isStaff) {
      return NextResponse.redirect(new URL("/client", request.url));
    }
    // Staff should never sit in the client shell (e.g. shared /client links).
    if (pathname.startsWith("/client") && isStaff) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/api/payments/:path*",
    "/api/webhooks/:path*",
    "/admin/:path*",
    "/client/:path*",
    "/login",
    "/forgot-password",
    "/update-password",
    "/auth/callback",
    "/invite/:path*",
    "/q/:path*",
    "/payments/confirmation",
  ],
};
