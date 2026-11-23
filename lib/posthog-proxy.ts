/**
 * PostHog reverse proxy for Next.js on Vercel (or any Node host). Copy to
 * `lib/posthog-proxy.ts` and call it from `proxy.ts` (Next.js >= 16) or
 * `middleware.ts` (Next.js <= 15); see the skill's references/hosting.md.
 *
 * Why not `rewrites()` in next.config: a rewrite forwards every request
 * header, so the site's own cookies (sessions included) and the full Referer
 * (page URL with its query string) would reach PostHog. A proxy file can
 * remove them first. Based on PostHog's "Next.js proxy file" guide.
 */
export const POSTHOG_PROXY_PREFIX = "/ingest";

export type ProxyTarget = { url: string; headers: Headers };

/** Where a request under the prefix goes, and the headers it may carry. Null for other paths. */
export function posthogProxyTarget(
  pathname: string,
  search: string,
  incoming: Headers,
  region: "us" | "eu" = "us",
  prefix: string = POSTHOG_PROXY_PREFIX,
): ProxyTarget | null {
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;
  const path = pathname.slice(prefix.length) || "/";
  const assets = path.startsWith("/static/") || path.startsWith("/array/");
  const host = `${region}${assets ? "-assets" : ""}.i.posthog.com`;
  const headers = new Headers(incoming);
  headers.set("host", host); // PostHog answers 401 without it
  headers.delete("cookie");
  headers.delete("referer");
  // PostHog keys (phc_/phs_/phx_) pass; any other credential is stripped.
  if (!/^Bearer ph[csx]_/.test(headers.get("authorization") ?? "")) headers.delete("authorization");
  return { url: `https://${host}${path}${search}`, headers };
}
