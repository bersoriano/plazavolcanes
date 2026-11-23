/**
 * Browser analytics entry point. Copy to `lib/analytics.client.ts`.
 *
 * - Start it once from `instrumentation-client.ts` (Next.js >= 15.3) so it runs
 *   before hydration and needs no inline <script> (CSP- and Rocket Loader-safe).
 * - Every event goes through `track()` / `trackPageView()`, which fan out to
 *   each destination. GA4 is built in; add PostHog as a second destination.
 * - Strict privacy baseline: canonical host only, Do Not Track / GPC honored,
 *   campaign-only URLs, Google signals and ad personalization off.
 */
import {
  type AnalyticsEvent,
  type AnalyticsParams,
  GA_ID_PATTERN,
  campaignUrl,
  cleanReferrer,
  isProductionHost,
  limitParams,
  privacySignal,
} from "./analytics";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [disable: `ga-disable-${string}`]: boolean | undefined;
  }
}

/** Bump when the core's contract changes; both skills' audits compare it with the skill asset. */
export const ANALYTICS_CORE_VERSION = "2026-11-15.2";

export type AnalyticsConfig = {
  gaId?: string;
  siteUrl?: string;
  /** Send from localhost/preview hosts with debug_mode for GA DebugView. Ignored on the production host. */
  debug?: boolean;
  /** Return false for paths whose URL is a credential (manage links, tokens, private dashboards). */
  isTrackablePath?: (pathname: string) => boolean;
  /**
   * More destinations (e.g. PostHog from the landing-page-posthog skill). Each
   * factory runs after the shared gates (DNT/GPC, trackable path) and decides
   * from `production` whether it runs off the canonical host; return null to skip.
   */
  destinations?: DestinationFactory[];
};

export type PageFields = { page_location: string; page_referrer: string; page_title: string };
export type DestinationFactory = (context: { production: boolean }) => Destination | null;

export type Destination = {
  pageView(page: PageFields, params: Record<string, string | number | boolean>): void;
  event(name: AnalyticsEvent, params: Record<string, string | number | boolean>, beacon: boolean): void;
  /** Stop sending for the rest of this document (a secret URL was reached). */
  disable(): void;
};

/**
 * Next.js inlines NEXT_PUBLIC_* only for literal `process.env.NAME` reads at
 * build time. Destructuring or dynamic keys ship `undefined` to the browser.
 */
function configFromEnv(): AnalyticsConfig {
  return {
    gaId: process.env.NEXT_PUBLIC_GA_ID,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    debug: process.env.NEXT_PUBLIC_GA_DEBUG === "true",
  };
}

/**
 * A fresh analytics instance. The app uses the module-level one below; tests
 * create their own so every case starts from a clean state.
 */
export function createAnalytics() {
  let started = false;
  let disabled = false;
  let page: PageFields | undefined;
  let trackable: (pathname: string) => boolean = () => true;
  const destinations: Destination[] = [];

  /** Values passed here override the NEXT_PUBLIC_* defaults. */
  function init(overrides: AnalyticsConfig = {}) {
    if (started || typeof window === "undefined") return;
    started = true;
    try {
      const config = { ...configFromEnv(), ...overrides };
      const production = isProductionHost(window.location.href, config.siteUrl);
      trackable = config.isTrackablePath ?? trackable;
      if (privacySignal(window.navigator as Navigator & { globalPrivacyControl?: boolean })) return;
      // A secret URL never initializes: nothing can read it later.
      if (!trackable(window.location.pathname)) return;
      // Off the canonical host, GA runs only in debug mode (DebugView).
      const gaDebug = Boolean(config.debug) && !production;
      const gaId = config.gaId?.trim();
      if (gaId && GA_ID_PATTERN.test(gaId) && (production || gaDebug)) destinations.push(createGoogleDestination(gaId, gaDebug));
      for (const factory of config.destinations ?? []) {
        try {
          const destination = factory({ production });
          if (destination) destinations.push(destination);
        } catch { /* One failing tool never blocks the others. */ }
      }
    } catch { /* Analytics must never break the page. */ }
  }

  function enabled() {
    return destinations.length > 0 && !disabled;
  }

  /** Call once per route (PageAnalytics does). Initial load included: config sends no page view itself. */
  function pageView(params: AnalyticsParams = {}) {
    if (!enabled()) return;
    if (!trackable(window.location.pathname)) {
      disabled = true;
      for (const destination of destinations) safe(() => destination.disable());
      return;
    }
    const location = campaignUrl(window.location.href);
    // After a client-side navigation the referrer is the previous page, not document.referrer.
    const referrer = page && page.page_location !== location
      ? page.page_location.split("?", 1)[0]
      : page?.page_referrer ?? cleanReferrer(document.referrer, window.location.href);
    page = { page_location: location, page_referrer: referrer, page_title: document.title.slice(0, 100) };
    const extra = limitParams(params);
    for (const destination of destinations) safe(() => destination.pageView(page!, extra));
  }

  /** Clicks that leave the page use beacon transport so the hit survives unload. */
  function track(event: Exclude<AnalyticsEvent, "page_view">, params: AnalyticsParams = {}, options: { beacon?: boolean } = {}) {
    if (!enabled()) return;
    const beacon = options.beacon ?? event === "cta_click";
    const extra = limitParams(params);
    for (const destination of destinations) safe(() => destination.event(event, extra, beacon));
  }

  return { init, enabled, pageView, track };
}

const analytics = createAnalytics();
export const initAnalytics = analytics.init;
export const analyticsEnabled = analytics.enabled;
export const trackPageView = analytics.pageView;
export const track = analytics.track;

function safe(send: () => void) {
  try { send(); } catch { /* Best effort: visitor actions still work. */ }
}

function createGoogleDestination(id: string, debug: boolean): Destination {
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the `arguments` object itself: this must not push an array.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  const initial = {
    page_location: campaignUrl(window.location.href),
    page_referrer: cleanReferrer(document.referrer, window.location.href),
  };
  const settings = {
    ...initial,
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: 60 * 60 * 24 * 395, // about 13 months; match the privacy notice
    ...(window.location.protocol === "https:" && { cookie_flags: "SameSite=Lax;Secure" }),
    ...(debug && { debug_mode: true }),
  };
  // The Google tag loads a container whose own GA tag can fire on
  // initialization with default settings, ignoring `config`: an extra
  // page_view with the raw URL and ad personalization on. Settings queued
  // with "set" BEFORE "js" reach that tag too. Keep this order.
  window.gtag("set", settings);
  window.gtag("js", new Date());
  window.gtag("config", id, settings);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  let current: PageFields = { ...initial, page_title: "" };
  return {
    pageView(next, params) {
      current = next;
      // Automatic hits (user_engagement, session_start) read these globals.
      window.gtag!("set", next);
      window.gtag!("event", "page_view", { ...next, ...params });
    },
    event(name, params, beacon) {
      window.gtag!("event", name, { ...current, ...params, ...(beacon && { transport_type: "beacon" }) });
    },
    disable() {
      // Google's documented opt-out flag; stays set until a full page load.
      window[`ga-disable-${id}`] = true;
    },
  };
}
