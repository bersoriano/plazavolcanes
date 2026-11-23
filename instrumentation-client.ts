import { initAnalytics } from "./lib/analytics.client";
import { isPublicAnalyticsPath } from "./lib/analytics-pages";
import { posthogDestination } from "./lib/analytics.posthog";

// The only analytics start-up: Google Analytics and PostHog share the core's
// gates (canonical host, Do Not Track / GPC, public pages only) and receive
// the same events. Each stays inert without its variables. posthog-js is
// downloaded in its own chunk, and only once the gates pass.
// See docs/google-analytics.md and docs/posthog-analytics.md.
initAnalytics({ isTrackablePath: isPublicAnalyticsPath, destinations: [posthogDestination()] });
