import { NextResponse, type NextRequest } from "next/server";

import { posthogProxyTarget } from "@/lib/posthog-proxy";
import { updateSession } from "@/lib/supabase/proxy";

// The same variable the PostHog destination reads (lib/analytics.posthog.ts).
const region = process.env.NEXT_PUBLIC_POSTHOG_REGION === "eu" ? "eu" : "us";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // PostHog first, and nothing else for it: no session refresh, no redirect,
  // and the helper drops the site's cookies and the Referer before forwarding.
  const target = posthogProxyTarget(pathname, search, request.headers, region);
  if (target) return NextResponse.rewrite(new URL(target.url), { request: { headers: target.headers } });

  // next.config.ts sets skipTrailingSlashRedirect because PostHog's paths end
  // in "/". Pages keep Next's default instead: /vender/ → /vender, permanently.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    // Only the path changes, on a copy of this request's own URL: resolving a
    // string such as "//evil.example" would leave the site. (A plain URL, not
    // NextURL, which keeps the trailing slash it parsed.)
    const url = new URL(request.url);
    url.pathname = pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/ingest/:path*",
  ],
};
