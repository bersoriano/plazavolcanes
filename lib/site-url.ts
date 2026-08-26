const FALLBACK_SITE_URL = "http://localhost:3000";

/**
 * The public origin this deployment is reachable at, without a trailing slash.
 *
 * Auth email links, `metadataBase`, `robots.txt` and the sitemap all have to
 * agree on one host, so they read it from here instead of each keeping their
 * own copy of the environment variable.
 */
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return FALLBACK_SITE_URL;

  // A bare host is not an absolute URL: Supabase drops it from the redirect
  // allowlist and `new URL()` throws. Assume https rather than fail.
  const withScheme = /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;

  try {
    const url = new URL(withScheme);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export function buildSiteUrl(path: string) {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
