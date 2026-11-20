import posthog from "posthog-js";

import { initAnalytics } from "./lib/analytics.client";
import { isPublicAnalyticsPath } from "./lib/analytics-pages";
import { cleanAnalyticsUrl, sanitizeAnalyticsEvent, trackNavigation, trackSellerSubmission } from "./lib/visitor-analytics";

// Google Analytics: inert unless NEXT_PUBLIC_GA_ID is set and the page is
// served from NEXT_PUBLIC_SITE_URL's host. Public pages only; see
// docs/google-analytics.md. Independent of PostHog below.
initAnalytics({ isTrackablePath: isPublicAnalyticsPath });

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

// Both values are required so local development and previews remain inert
// unless deliberately configured. Analytics must never block the application.
if (projectToken && host) {
  try {
    posthog.init(projectToken, {
      api_host: host,
      defaults: "2026-08-30",
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_product_tours: true,
      advanced_disable_feature_flags: true,
      person_profiles: "never",
      persistence: "localStorage",
      save_campaign_params: false,
      respect_dnt: true,
      get_current_url: cleanAnalyticsUrl,
      before_send: sanitizeAnalyticsEvent,
    });
    document.addEventListener("click", trackNavigation);
    document.addEventListener("submit", trackSellerSubmission, true);
  } catch {
    // A failed analytics setup must not affect hydration, auth or navigation.
  }
}
