import { NextResponse, type NextRequest } from "next/server";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

const LIMITED_PREFIXES = [
  "/api/payments/",
  "/api/webhooks/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const shouldLimit = LIMITED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!shouldLimit) {
    return NextResponse.next();
  }

  // Webhooks get a higher ceiling; payment creates stay stricter.
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

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

export const config = {
  matcher: ["/api/payments/:path*", "/api/webhooks/:path*"],
};
