/**
 * Pure analytics helpers: no DOM, no SDK, safe to unit test and to import on
 * the server. Copy to `lib/analytics.ts` and adapt the taxonomy unions.
 *
 * Shared landing-page taxonomy: see the skill's references/events.md.
 */

export const ANALYTICS_EVENTS = [
  "page_view",
  "cta_click",
  "form_start",
  "form_submit",
  "generate_lead",
  "form_error",
  "sign_up",
  "section_view",
  "read_progress",
  "select_content",
  "language_change",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type CtaType =
  | "booking" | "whatsapp" | "phone" | "email" | "form" | "signup" | "login" | "demo" | "directions" | "pricing"
  // Plaza Volcanes: a signed-in visitor without a shop goes straight to creating one.
  | "create_shop";

/** Page grouping sent as `page_type`; the marketplace adds catalogue, product, shop and auth pages. */
export type PageType =
  | "landing" | "blog_index" | "blog_post" | "supporting" | "legal"
  | "catalog" | "product" | "shop" | "auth";

/** Parameter values: short strings or finite numbers. Never PII, never form contents. */
export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

/** Only campaign tags survive in addresses sent to analytics. */
export const CAMPAIGN_TAGS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export const GA_ID_PATTERN = /^G-[A-Z0-9]{6,12}$/;

/** A page address with every query parameter removed except campaign tags; never a fragment. */
export function campaignUrl(href: string): string {
  try {
    const url = new URL(href);
    const kept = new URLSearchParams();
    for (const key of CAMPAIGN_TAGS) {
      const value = url.searchParams.get(key)?.trim().slice(0, 100);
      if (value) kept.set(key, value);
    }
    const query = kept.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return "";
  }
}

/**
 * Referrer safe to send: same-site referrers keep their path (no query),
 * other sites only their origin. Empty or invalid means direct traffic.
 */
export function cleanReferrer(referrer: string, currentHref: string): string {
  try {
    const source = new URL(referrer);
    if (source.protocol !== "http:" && source.protocol !== "https:") return "";
    return source.origin === new URL(currentHref).origin ? `${source.origin}${source.pathname}` : source.origin;
  } catch {
    return "";
  }
}

/**
 * Collect only on the canonical host. Gating on NODE_ENV or VERCEL_ENV is not
 * enough: production builds also answer on *.pages.dev, *.vercel.app and
 * per-deployment URLs.
 */
export function isProductionHost(href: string, siteUrl: string | undefined): boolean {
  if (!siteUrl) return false;
  try {
    return new URL(href).hostname === new URL(siteUrl).hostname;
  } catch {
    return false;
  }
}

/** Do Not Track or Global Privacy Control turned on. */
export function privacySignal(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | undefined): boolean {
  return nav?.doNotTrack === "1" || nav?.doNotTrack === "yes" || nav?.globalPrivacyControl === true;
}

/** GA limits: event/param names <= 40 chars, string values <= 100 chars, <= 25 params. */
export function limitParams(params: AnalyticsParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (Object.keys(out).length >= 25) break;
    if (value === undefined || key.length > 40) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    out[key] = typeof value === "string" ? value.slice(0, 100) : value;
  }
  return out;
}
