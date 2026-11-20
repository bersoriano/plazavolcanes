// @vitest-environment node
/**
 * Contract tests for analytics.posthog.ts, ported from the landing-page-posthog
 * skill (assets/analytics.posthog.test.ts). A fake SDK replaces posthog-js, so no network is used.
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { POSTHOG_EVENTS, posthogDestination, sanitizePostHogEvent, type PostHogOptions } from "./analytics.posthog";

const SITE = "https://example.com";
const page = (path: string, referrer = "") => ({ page_location: `${SITE}${path}`, page_referrer: referrer, page_title: "T" });

function fakeSdk() {
  const calls = { init: [] as unknown[][], capture: [] as unknown[][] };
  // Like the real SDK in cookieless "always": no working opt-out. Only before_send can stop an event.
  const sdk = {
    init: (...args: unknown[]) => { calls.init.push(args); },
    capture: (...args: unknown[]) => { calls.capture.push(args); },
  };
  let resolve!: () => void;
  const ready = new Promise<void>((r) => { resolve = r; });
  const load = () => ready.then(() => ({ default: sdk as never }));
  return { calls, load, resolve };
}

function make(production: boolean, options: PostHogOptions) {
  return posthogDestination({ key: "phc_test", host: "/ingest", ...options })({ production });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

test("only taxonomy events and PostHog's page events pass before_send", () => {
  for (const name of ["$pageview", "$pageleave", "cta_click", "generate_lead"]) assert.ok(POSTHOG_EVENTS.has(name), name);
  for (const name of ["$autocapture", "$rageclick", "$exception", "$web_vitals", "page_view", "whatsapp_click"])
    assert.equal(sanitizePostHogEvent({ event: name, properties: {} }), null, name);
});

test("URLs keep campaign tags only; other sites' referrers keep their origin; click IDs vanish everywhere", () => {
  const result = sanitizePostHogEvent({
    event: "$pageview",
    properties: {
      $current_url: `${SITE}/p?utm_source=li&utm_id=9&gclid=x&email=a%40b.c#top`,
      $pathname: "/p?x=1",
      $referrer: "https://www.google.com/search?q=private",
      $referring_domain: "www.google.com",
      utm_source: "li", utm_id: "9", gclid: "x", oppref: "x", $session_entry_bfcid: "x",
      $raw_user_agent: "UA",
      $set_once: { $initial_current_url: `${SITE}/?token=secret`, $initial_gclid: "x", $initial_utm_campaign: "spring" },
      $session_entry_url: `${SITE}/?coupon=SECRET&utm_medium=cpc`,
    },
  })!;
  const p = result.properties!;
  assert.equal(p.$current_url, `${SITE}/p?utm_source=li`);
  assert.equal(p.$pathname, "/p");
  assert.equal(p.$referrer, "https://www.google.com");
  assert.equal(p.$referring_domain, "www.google.com");
  assert.equal(p.utm_source, "li");
  assert.equal(p.utm_id, undefined);
  assert.equal(p.gclid, undefined);
  assert.equal(p.oppref, undefined);
  assert.equal(p.$session_entry_bfcid, undefined);
  assert.equal(p.$raw_user_agent, "UA", "cookieless hashing needs the user agent");
  assert.deepEqual(p.$set_once, { $initial_current_url: `${SITE}/`, $initial_utm_campaign: "spring" });
  assert.equal(p.$session_entry_url, `${SITE}/?utm_medium=cpc`);
  assert.ok(!JSON.stringify(result).includes("SECRET") && !JSON.stringify(result).includes("secret"));
});

test("runs on the production host; off it only with debug; never without a phc_ key or a host", () => {
  assert.ok(make(true, {}));
  assert.equal(make(false, {}), null, "preview/localhost");
  assert.ok(make(false, { debug: true }), "debug on preview");
  assert.ok(make(true, { debug: true }), "debug never blocks production");
  assert.equal(make(true, { key: "phx_personal" }), null, "personal API key rejected");
  assert.equal(make(true, { key: "" }), null);
  assert.equal(make(true, { host: "" }), null, "no proxy host configured");
});

test("init uses the cookieless, events-only baseline through the proxy", async () => {
  const fake = fakeSdk();
  make(true, { load: fake.load, host: "https://e.example.com/", region: "eu" });
  fake.resolve();
  await flush();
  const [key, config] = fake.calls.init[0] as [string, Record<string, unknown>];
  assert.equal(key, "phc_test");
  assert.equal(config.api_host, "https://e.example.com");
  assert.equal(config.ui_host, "https://eu.posthog.com");
  assert.equal(config.cookieless_mode, "always");
  assert.equal(config.person_profiles, "never");
  assert.equal(config.persistence, "memory");
  for (const flag of ["autocapture", "capture_pageview", "capture_heatmaps", "capture_dead_clicks", "capture_performance", "capture_exceptions", "rageclick", "save_campaign_params", "save_referrer"]) assert.equal(config[flag], false, flag);
  for (const flag of ["disable_persistence", "disable_session_recording", "disable_surveys", "disable_product_tours", "disable_conversations", "advanced_disable_flags", "disable_external_dependency_loading", "capture_pageleave"]) assert.equal(config[flag], true, flag);
  // The filter handed to the SDK is the real one, not just any function.
  const beforeSend = config.before_send as (event: unknown) => { properties: Record<string, unknown> } | null;
  assert.equal(beforeSend({ event: "$autocapture", properties: {} }), null);
  assert.equal(beforeSend(null), null);
  assert.equal(beforeSend({ event: "$pageleave", properties: { $current_url: `${SITE}/p?token=secret` } })!.properties.$current_url, `${SITE}/p`);
});

test("calls made before the SDK loads are kept in order with their own page", async () => {
  const fake = fakeSdk();
  const destination = make(true, { load: fake.load })!;
  destination.pageView(page("/", "https://news.site"), { page_type: "landing" });
  destination.event("cta_click", { cta_type: "whatsapp" }, true);
  destination.pageView(page("/pricing", `${SITE}/`), { page_type: "supporting" });
  destination.event("generate_lead", { form_name: "contact" }, false);
  assert.equal(fake.calls.capture.length, 0);
  fake.resolve();
  await flush();
  const captured = fake.calls.capture as [string, Record<string, unknown>, unknown][];
  assert.deepEqual(captured.map(([name]) => name), ["$pageview", "cta_click", "$pageview", "generate_lead"]);
  assert.equal(captured[0][1].$current_url, `${SITE}/`);
  assert.equal(captured[0][1].$referrer, "https://news.site");
  assert.equal(captured[1][1].$current_url, `${SITE}/`, "click belongs to the page it happened on");
  assert.deepEqual(captured[1][2], { send_instantly: true, transport: "sendBeacon" });
  assert.equal(captured[2][1].$current_url, `${SITE}/pricing`);
  assert.equal(captured[3][2], undefined, "non-navigation events batch normally");
});

test("disable stops everything, including the SDK's own $pageleave; a failed SDK load never throws", async () => {
  const fake = fakeSdk();
  const destination = make(true, { load: fake.load })!;
  fake.resolve();
  await flush();
  const beforeSend = (fake.calls.init[0][1] as { before_send: (event: unknown) => unknown }).before_send;
  const leave = { event: "$pageleave", properties: { $current_url: `${SITE}/manage/tok_123` } };
  assert.ok(beforeSend(leave), "before disable the event passes");
  destination.disable();
  destination.event("cta_click", { cta_type: "booking" }, true);
  assert.equal(fake.calls.capture.length, 0);
  assert.equal(beforeSend(leave), null, "automatic events are dropped after a secret URL");

  // Disabled while the SDK is still downloading: it must never initialize.
  const late = fakeSdk();
  const pending = make(true, { load: late.load })!;
  pending.pageView(page("/"), {});
  pending.disable();
  late.resolve();
  await flush();
  assert.equal(late.calls.init.length, 0);
  assert.equal(late.calls.capture.length, 0);

  // A stuck load cannot grow the queue without bound.
  const stuck = fakeSdk();
  const waiting = make(true, { load: stuck.load })!;
  for (let index = 0; index < 80; index += 1) waiting.event("section_view", { section_id: `s${index}` }, false);
  stuck.resolve();
  await flush();
  assert.equal(stuck.calls.capture.length, 50);

  const broken = make(true, { load: () => Promise.reject(new Error("blocked")) })!;
  broken.pageView(page("/"), {});
  await flush();
  assert.doesNotThrow(() => broken.event("cta_click", {}, true));
});
