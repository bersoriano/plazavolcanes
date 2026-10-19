import posthog, { type CaptureResult } from "posthog-js";

const sellerEvents = new Set([
  "seller_signup_submitted",
  "seller_shop_submitted",
  "seller_product_submitted",
]);
const allowedEvents = new Set(["$pageview", "$pageleave", "navigation_clicked", ...sellerEvents]);

// SDKs can derive search/campaign terms from URLs even when campaign storage
// is disabled. Admit only the metadata these reports need, including the SDK's
// ingestion and session identifiers; unknown future fields stay local.
const allowedProperties = new Set([
  "token", "distinct_id", "$device_id", "$session_id", "$window_id",
  "$is_identified", "$process_person_profile", "$lib", "$lib_version",
  "$insert_id", "$time", "$sent_at", "$current_url", "$host", "$pathname",
  "$referrer", "$referring_domain", "$browser", "$browser_version", "$browser_type",
  "$os", "$os_version", "$device", "$device_type", "$screen_height", "$screen_width",
  "$viewport_height", "$viewport_width", "$session_entry_url", "$session_entry_host",
  "$session_entry_pathname", "$session_entry_referrer", "$session_entry_referring_domain",
  "$pageview_id", "$prev_pageview_id", "$prev_pageview_pathname", "$prev_pageview_duration",
  "$prev_pageview_last_scroll", "$prev_pageview_last_scroll_percentage",
  "$prev_pageview_max_scroll", "$prev_pageview_max_scroll_percentage",
  "$prev_pageview_last_content", "$prev_pageview_last_content_percentage",
  "$prev_pageview_max_content", "$prev_pageview_max_content_percentage",
  "source_path", "destination_path", "source_section", "seller_intent", "target_section",
]);

/** Auth links and search URLs can contain credentials or personal input. */
export function cleanAnalyticsUrl(value: string): string {
  if (value === "$direct") return value;
  if (value.startsWith("/")) return value.split(/[?#]/, 1)[0];
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

/** Keep automatic SDK metadata from reintroducing tokens or person updates. */
export function sanitizeAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event || !allowedEvents.has(event.event)) return null;
  const properties = { ...event.properties };
  for (const [key, value] of Object.entries(properties)) {
    if (!allowedProperties.has(key)) {
      delete properties[key];
    } else if (typeof value === "string" && /(?:url|referrer|pathname|path)$/i.test(key)) {
      properties[key] = cleanAnalyticsUrl(value);
    }
  }
  const sanitized = { ...event, properties };
  delete sanitized.$set;
  delete sanitized.$set_once;
  delete sanitized.$unset;
  return sanitized;
}

/** Only public landing links; link text and arbitrary attributes stay local. */
export function trackNavigation(event: MouseEvent) {
  const sourcePath = window.location.pathname;
  if (sourcePath !== "/" && sourcePath !== "/vender") return;
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;
  const destination = new URL(link.href);
  if (destination.origin !== window.location.origin) return;

  const section = link.closest("section[id], header, footer, nav");
  const properties: Record<string, string | boolean> = {
    source_path: sourcePath,
    destination_path: destination.pathname,
    source_section: section?.id || section?.tagName.toLowerCase() || "page",
    seller_intent: destination.pathname === "/panel/tiendas/nueva" ||
      (destination.pathname === "/registro" &&
        (destination.searchParams.get("vender") === "1" || destination.searchParams.get("intent") === "vender")),
  };
  // Record only real document anchors, never arbitrary URL fragments.
  const targetSection = destination.hash.slice(1);
  if (destination.pathname === sourcePath && /^[a-z][a-z0-9-]{0,63}$/.test(targetSection) &&
      document.getElementById(targetSection)) {
    properties.target_section = targetSection;
  }
  posthog.capture("navigation_clicked", properties);
}

/** These are attempts, not proof of a successful account, shop or listing. */
export function trackSellerSubmission(event: Event) {
  if (!(event.target instanceof HTMLFormElement)) return;
  const name = event.target.dataset.analyticsEvent;
  if (name && sellerEvents.has(name)) posthog.capture(name);
}
