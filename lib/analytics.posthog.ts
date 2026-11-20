/**
 * PostHog destination for the shared analytics core (landing-page-ga skill:
 * lib/analytics.ts + lib/analytics.client.ts). Copy to `lib/analytics.posthog.ts`.
 *
 * Baseline: cookieless (no cookies, no storage), explicit taxonomy events only,
 * no person profiles, no autocapture/replay/flags/surveys, traffic through a
 * reverse proxy on the site's domain, SDK in its own chunk (dynamic import
 * started at init, never in the main bundle; early calls wait in a queue).
 */
import type { PostHog, PostHogConfig } from "posthog-js";
import { ANALYTICS_EVENTS, CAMPAIGN_TAGS, campaignUrl, cleanReferrer } from "./analytics";
import type { Destination, DestinationFactory, PageFields } from "./analytics.client";

/** The only events allowed to leave the browser. Anything else the SDK emits is dropped. */
export const POSTHOG_EVENTS: ReadonlySet<string> = new Set([
  "$pageview",
  "$pageleave",
  ...ANALYTICS_EVENTS.filter((event) => event !== "page_view"),
]);

const CLICK_IDS = new Set(
  // posthog-js PERSONAL_DATA_CAMPAIGN_PARAMS (1.438) plus gad_source and mc_cid. Re-check on SDK upgrades.
  "gclid gclsrc dclid gbraid wbraid gad_source fbclid msclkid twclid li_fat_id igshid ttclid rdt_cid mc_cid epik qclid sccid oppref bfcid irclid _kx".split(" "),
);

type WireEvent = { event: string; properties?: Record<string, unknown> };

/**
 * `before_send` filter: allowlisted events only; URLs keep campaign tags only;
 * referrers from other sites keep only their origin; click IDs and unknown
 * utm_* are removed everywhere, including nested $set/$set_once and the SDK's
 * initial_/session_entry_ aliases.
 */
export function sanitizePostHogEvent<T extends WireEvent>(event: T): T | null {
  if (!POSTHOG_EVENTS.has(event.event)) return null;
  const properties = event.properties ?? {};
  const base = typeof properties.$current_url === "string" ? properties.$current_url : "https://invalid.local/";

  function clean(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const bare = key.replace(/^\$?(?:(?:initial|session_entry)_)?/, "");
      if (CLICK_IDS.has(bare)) continue;
      if (bare.startsWith("utm_") && !(CAMPAIGN_TAGS as readonly string[]).includes(bare)) continue;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        out[key] = clean(value as Record<string, unknown>);
      } else if (typeof value === "string" && /referrer$/i.test(key)) {
        out[key] = value === "$direct" ? value : cleanReferrer(value, base) || "$direct";
      } else if (typeof value === "string" && /(?:url|href)$/i.test(key)) {
        out[key] = campaignUrl(value) || value.split(/[?#]/, 1)[0];
      } else if (typeof value === "string" && /pathname$/i.test(key)) {
        out[key] = value.split(/[?#]/, 1)[0];
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  return { ...event, properties: clean(properties) };
}

type Loader = () => Promise<{ default: PostHog }>;

export type PostHogOptions = {
  key?: string;
  /** "/ingest" (Vercel proxy file) or "https://<subdomain>" (Cloudflare proxy Worker). */
  host?: string;
  region?: "us" | "eu";
  /** Collect from localhost/preview hosts (use a separate test project). Ignored on the production host. */
  debug?: boolean;
  /** Tests inject a fake SDK; the app uses the lazy import. */
  load?: Loader;
};

/**
 * Pass to the core: `initAnalytics({ destinations: [posthogDestination()] })`.
 * Literal process.env reads keep Next.js build-time inlining working.
 */
export function posthogDestination(options: PostHogOptions = {}): DestinationFactory {
  return ({ production }) => {
    const key = (options.key ?? process.env.NEXT_PUBLIC_POSTHOG_KEY)?.trim();
    const host = (options.host ?? process.env.NEXT_PUBLIC_POSTHOG_HOST)?.trim().replace(/\/$/, "");
    const region = (options.region ?? process.env.NEXT_PUBLIC_POSTHOG_REGION) === "eu" ? "eu" : "us";
    const debug = (options.debug ?? process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "true") && !production;
    // phc_ is the write-only project token. Never a personal (phx_) key.
    if (!key?.startsWith("phc_") || !host || !(production || debug)) return null;
    return createPostHogDestination(key, host, region, options.load ?? (() => import("posthog-js/no-external")));
  };
}

function createPostHogDestination(key: string, host: string, region: "us" | "eu", load: Loader): Destination {
  let client: PostHog | null = null;
  let off = false;
  let current: PageFields | undefined;
  const queue: Array<(posthog: PostHog) => void> = [];

  function run(send: (posthog: PostHog) => void) {
    if (off) return;
    if (client) { try { send(client); } catch { /* best effort */ } }
    else if (queue.length < 50) queue.push(send);
  }

  const config: Partial<PostHogConfig> = {
    api_host: host,
    ui_host: `https://${region}.posthog.com`,
    defaults: "2026-05-30", // bump to the date in PostHog's current docs when upgrading posthog-js
    cookieless_mode: "always", // requires the project toggle (references/project-settings.md)
    persistence: "memory",
    disable_persistence: true,
    person_profiles: "never",
    autocapture: false,
    capture_pageview: false, // page views come from PageAnalytics, same as GA
    capture_pageleave: true, // Web analytics needs it for duration and bounce rate
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    capture_exceptions: false,
    rageclick: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    save_campaign_params: false,
    save_referrer: false,
    respect_dnt: true, // inert in cookieless "always"; the core's DNT/GPC gate is what protects
    // `off` is the only working kill switch: in cookieless "always" the SDK
    // ignores its opt-out call and keeps sending automatic $pageleave.
    before_send: (event) => (off || !event ? null : sanitizePostHogEvent(event)),
  };

  // Lazy: the SDK stays out of the critical path; early calls wait in the queue.
  load()
    .then(({ default: posthog }) => {
      if (off) return;
      posthog.init(key, config);
      client = posthog;
      for (const send of queue.splice(0)) { try { send(posthog); } catch { /* best effort */ } }
    })
    .catch(() => { off = true; queue.length = 0; });

  const pageProps = () => current
    ? { $current_url: current.page_location, $referrer: current.page_referrer || "$direct" }
    : {};

  return {
    pageView(page, params) {
      current = page;
      // Computed now, not at flush time: a queued view must keep its own page.
      const props = { ...params, ...pageProps(), $title: page.page_title };
      run((posthog) => posthog.capture("$pageview", props));
    },
    event(name, params, beacon) {
      const props = { ...params, ...pageProps() };
      // Navigation can unload the page before a batch flush: send clicks now, by beacon.
      run((posthog) => posthog.capture(name, props, beacon ? { send_instantly: true, transport: "sendBeacon" } : undefined));
    },
    disable() {
      // before_send reads `off`, so this also drops the automatic $pageleave
      // that would otherwise carry the secret URL's path.
      off = true;
      queue.length = 0;
    },
  };
}
