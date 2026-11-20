// @vitest-environment node
/** Contract tests for the PostHog proxy helper (landing-page-posthog skill); no network, no Next.js runtime. */
import { test } from "vitest";
import assert from "node:assert/strict";
import { posthogProxyTarget } from "./posthog-proxy";

const incoming = () => new Headers({
  cookie: "session=secret",
  referer: "https://example.com/p?email=a%40b.c&token=secret",
  authorization: "Basic abc",
  "user-agent": "UA",
  "x-forwarded-for": "203.0.113.7",
});

test("events go to the regional API without cookies, Referer or foreign credentials", () => {
  const target = posthogProxyTarget("/ingest/i/v0/e/", "?compression=gzip-js", incoming(), "eu")!;
  assert.equal(target.url, "https://eu.i.posthog.com/i/v0/e/?compression=gzip-js");
  assert.equal(target.headers.get("host"), "eu.i.posthog.com");
  assert.equal(target.headers.get("cookie"), null);
  assert.equal(target.headers.get("referer"), null);
  assert.equal(target.headers.get("authorization"), null);
  assert.equal(target.headers.get("user-agent"), "UA", "cookieless hashing needs the user agent");
  assert.equal(target.headers.get("x-forwarded-for"), "203.0.113.7", "the platform's client IP header is left alone");
  assert.ok(!JSON.stringify([target.url, [...target.headers]]).includes("secret"));
});

test("static and remote-config assets go to the assets host; PostHog keys pass; region defaults to US", () => {
  const headers = new Headers({ authorization: "Bearer phc_abc" });
  assert.equal(posthogProxyTarget("/ingest/static/array.js", "", headers)!.url, "https://us-assets.i.posthog.com/static/array.js");
  assert.equal(posthogProxyTarget("/ingest/array/phc_abc/config", "", headers)!.url, "https://us-assets.i.posthog.com/array/phc_abc/config");
  assert.equal(posthogProxyTarget("/ingest/flags/", "", headers)!.headers.get("authorization"), "Bearer phc_abc");
});

test("only the prefix is proxied", () => {
  for (const path of ["/", "/ingestion", "/blog/ingest/x", "/api/ingest"]) assert.equal(posthogProxyTarget(path, "", new Headers()), null, path);
  assert.equal(posthogProxyTarget("/ingest", "", new Headers())!.url, "https://us.i.posthog.com/");
  assert.equal(posthogProxyTarget("/e/x/", "", new Headers(), "us", "/e")!.url, "https://us.i.posthog.com/x/");
});
