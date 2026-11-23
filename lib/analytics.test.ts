// @vitest-environment node
/**
 * Contract tests for analytics.ts + analytics.client.ts, ported from the
 * landing-page-ga skill (assets/analytics.test.ts) with node:assert kept. The
 * fake browser below stands in for the only external boundaries: window,
 * document and gtag.js, so the cases run without jsdom.
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { campaignUrl, cleanReferrer, limitParams, privacySignal } from "./analytics";
import { createAnalytics, type AnalyticsConfig, type Destination } from "./analytics.client";

const SITE = "https://example.com";
const ID = "G-TEST1234";

function browser({ href = `${SITE}/`, referrer = "", doNotTrack = null as string | null, gpc = false } = {}) {
  const scripts: { src: string }[] = [];
  const win: Record<string, unknown> & { location: URL; dataLayer?: IArguments[] } = {
    location: new URL(href),
    navigator: { doNotTrack, globalPrivacyControl: gpc },
  };
  const doc = {
    referrer,
    title: "Home",
    createElement: () => ({ async: false, src: "" }),
    head: { appendChild: (script: { src: string }) => scripts.push(script) },
  };
  Object.assign(globalThis, { window: win, document: doc });
  const navigate = (next: string, title = "Page") => { win.location = new URL(next, win.location); doc.title = title; };
  // gtag.js receives `arguments` objects; read them back as arrays.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- gtag commands are untyped; the cases read their fields directly.
  const commands = () => Array.from(win.dataLayer ?? [], (entry) => Array.from(entry) as [string, ...any[]]);
  return { win, scripts, commands, navigate };
}

function start(config: Partial<AnalyticsConfig> = {}) {
  const analytics = createAnalytics();
  analytics.init({ gaId: ID, siteUrl: SITE, ...config });
  return analytics;
}

test("addresses keep only campaign tags; referrers from other sites keep only their origin", () => {
  assert.equal(campaignUrl(`${SITE}/p?utm_source=li&gclid=x&email=a%40b.c#top`), `${SITE}/p?utm_source=li`);
  assert.equal(cleanReferrer("https://www.google.com/search?q=private", `${SITE}/`), "https://www.google.com");
  assert.equal(cleanReferrer(`${SITE}/blog?ref=x`, `${SITE}/`), `${SITE}/blog`);
  assert.equal(cleanReferrer("", `${SITE}/`), "");
});

test("params respect GA limits", () => {
  const out = limitParams({ long: "x".repeat(150), skip: undefined, bad: Number.NaN, ["k".repeat(41)]: 1 });
  assert.deepEqual(out, { long: "x".repeat(100) });
  const many = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`p${index}`, index]));
  assert.equal(Object.keys(limitParams(many)).length, 25);
  assert.equal(campaignUrl(`${SITE}/?utm_source=%20${"s".repeat(150)}%20`), `${SITE}/?utm_source=${"s".repeat(100)}`);
});

test("every spelling of the privacy signals counts", () => {
  for (const nav of [{ doNotTrack: "1" }, { doNotTrack: "yes" }, { globalPrivacyControl: true }]) assert.equal(privacySignal(nav), true, JSON.stringify(nav));
  for (const nav of [undefined, {}, { doNotTrack: "0" }, { doNotTrack: null, globalPrivacyControl: false }]) assert.equal(privacySignal(nav), false, JSON.stringify(nav));
});

test("GA stays off on preview hosts, without a valid ID, and under Do Not Track or GPC", () => {
  // Lookalike hosts too: the gate is an exact hostname match, not a suffix or prefix.
  for (const href of ["https://abc123.example.pages.dev/", "https://example-git-main.vercel.app/", "http://localhost:3000/", "https://notexample.com/", "https://example.com.evil.io/", "https://www.example.com/"]) {
    const { scripts } = browser({ href });
    assert.equal(start().enabled(), false, href);
    assert.equal(scripts.length, 0, href);
  }
  browser();
  assert.equal(start({ gaId: "UA-123" }).enabled(), false, "GA4 IDs only");
  browser({ doNotTrack: "1" });
  assert.equal(start().enabled(), false, "Do Not Track");
  browser({ gpc: true });
  assert.equal(start().enabled(), false, "Global Privacy Control");
});

test("settings are queued with set before js, so the Google tag's own GA tag uses them", () => {
  const { win, scripts, commands } = browser({ href: `${SITE}/?utm_campaign=x&gclid=secret`, referrer: "https://news.site/a?b=c" });
  const analytics = start();
  analytics.init({ gaId: ID, siteUrl: SITE });
  assert.equal(scripts.length, 1, "a second init is ignored");
  assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${ID}`);
  assert.deepEqual(commands().map(([command]) => command), ["set", "js", "config"]);
  // gtag.js ignores plain arrays: every queue entry must be an `arguments` object.
  for (const entry of win.dataLayer!) assert.equal(Object.prototype.toString.call(entry), "[object Arguments]");
  const [[, set], , [, id, config]] = commands();
  assert.equal(id, ID);
  for (const settings of [set, config]) {
    assert.equal(settings.send_page_view, false);
    assert.equal(settings.allow_google_signals, false);
    assert.equal(settings.allow_ad_personalization_signals, false);
    assert.equal(settings.page_location, `${SITE}/?utm_campaign=x`);
    assert.equal(settings.page_referrer, "https://news.site");
    assert.equal(settings.debug_mode, undefined);
    assert.equal(settings.cookie_expires, 60 * 60 * 24 * 395);
  }
});

test("debug mode reaches DebugView from localhost but never marks production traffic", () => {
  browser({ href: "http://localhost:3000/" });
  const local = browser({ href: "http://localhost:3000/" });
  start({ debug: true });
  assert.equal(local.commands()[0][1].debug_mode, true);
  const prod = browser();
  start({ debug: true });
  assert.equal(prod.commands()[0][1].debug_mode, undefined);
});

test("one page_view per route, previous page as referrer, events carry clean page fields", () => {
  const { commands, navigate } = browser({ href: `${SITE}/?utm_source=li&email=a`, referrer: "https://www.google.com/search?q=x" });
  const analytics = start();
  analytics.pageView({ page_type: "landing" });
  navigate("/pricing?coupon=SECRET", "Pricing");
  analytics.pageView({ page_type: "supporting" });
  analytics.track("cta_click", { cta_type: "whatsapp", cta_location: "hero" });
  analytics.track("generate_lead", { form_name: "contact" });

  const events = commands().filter(([command]) => command === "event");
  const views = events.filter(([, name]) => name === "page_view");
  assert.equal(views.length, 2);
  assert.equal(views[0][2].page_location, `${SITE}/?utm_source=li`);
  assert.equal(views[0][2].page_referrer, "https://www.google.com");
  assert.equal(views[1][2].page_location, `${SITE}/pricing`);
  assert.equal(views[1][2].page_referrer, `${SITE}/`);
  assert.equal(views[1][2].page_type, "supporting");
  assert.equal(views[1][2].page_title, "Pricing");
  const [, , click] = events.find(([, name]) => name === "cta_click")!;
  assert.equal(click.transport_type, "beacon");
  assert.equal(click.page_location, `${SITE}/pricing`);
  const [, , lead] = events.find(([, name]) => name === "generate_lead")!;
  assert.equal(lead.transport_type, undefined);
  // Automatic hits read globals: each view also updates them.
  assert.deepEqual(commands().filter(([command]) => command === "set").at(-1)?.[1].page_location, `${SITE}/pricing`);
});

test("secret URLs never initialize, and reaching one stops collection until reload", () => {
  const isTrackablePath = (path: string) => !path.startsWith("/manage/");
  const secret = browser({ href: `${SITE}/manage/tok_123` });
  assert.equal(start({ isTrackablePath }).enabled(), false);
  assert.equal(secret.scripts.length, 0);

  const { win, commands, navigate } = browser();
  const analytics = start({ isTrackablePath });
  analytics.pageView();
  navigate("/manage/tok_123");
  analytics.pageView();
  assert.equal(win[`ga-disable-${ID}`], true);
  navigate("/");
  analytics.pageView();
  analytics.track("cta_click", { cta_type: "booking" });
  assert.equal(commands().filter(([command, name]) => command === "event" && name !== "page_view").length, 0);
  assert.ok(!JSON.stringify(commands()).includes("tok_123"));
});

test("extra destinations get the same page views and events, and decide their own host rule", () => {
  const calls: string[] = [];
  const recorder = (label: string): Destination => ({
    pageView: (page) => calls.push(`${label}:page_view:${page.page_location}`),
    event: (name, params, beacon) => calls.push(`${label}:${name}:${params.cta_type}:${beacon}`),
    disable: () => calls.push(`${label}:disable`),
  });
  browser({ href: `${SITE}/?gclid=x` });
  const analytics = start({ destinations: [({ production }) => (production ? recorder("prod") : null), () => { throw new Error("broken tool"); }] });
  analytics.pageView();
  analytics.track("cta_click", { cta_type: "booking" });
  assert.deepEqual(calls, [`prod:page_view:${SITE}/`, "prod:cta_click:booking:true"]);

  // Preview host: GA stays off, but a destination may opt in (its own debug flag).
  const preview = browser({ href: "https://x.example.pages.dev/" });
  const previewCalls: string[] = [];
  const analyticsPreview = start({ destinations: [({ production }) => (production ? null : { ...recorder("p"), pageView: () => previewCalls.push("view") })] });
  analyticsPreview.pageView();
  assert.equal(preview.scripts.length, 0, "no GA on preview without debug");
  assert.deepEqual(previewCalls, ["view"]);

  // DNT stops every destination.
  browser({ doNotTrack: "1" });
  assert.equal(start({ destinations: [() => recorder("dnt")] }).enabled(), false);
});
