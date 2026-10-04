// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  handleDispatch,
  renderNotification,
  type ClaimedNotification,
  type DispatchEnv,
} from "./seller-notifications";

const SITE = "https://plazavolcanes.com";

function claimed(overrides: Partial<ClaimedNotification> = {}): ClaimedNotification {
  return {
    id: 1,
    kind: "purchase_request",
    dedupe_key: "purchase_request:12",
    attempts: 1,
    recipient_email: "tienda@example.com",
    order_id: 12,
    conversation_id: null,
    shop_name: "Tienda de Bear",
    product_name: "Florero",
    item_count: 1,
    quantity: 2,
    decide_by_at: "2026-10-07T18:00:00.000Z",
    time_zone: "America/Mexico_City",
    ...overrides,
  };
}

describe("renderNotification", () => {
  it("announces a purchase request with its deadline and a link to decide", () => {
    const email = renderNotification(claimed(), SITE);

    expect(email.subject).toBe("Nueva solicitud de compra: Florero");
    expect(email.text).toContain("Recibiste una solicitud de compra en Tienda de Bear: Florero (2 unidades).");
    expect(email.text).toMatch(/Tienes hasta el 7 de octubre.*12:00.* para aceptarla o rechazarla\./);
    expect(email.text).toContain(`${SITE}/panel/pedidos/12`);
    expect(email.text).toContain(`${SITE}/panel/cuenta`);
    expect(email.html).toContain(`href="${SITE}/panel/pedidos/12"`);
  });

  it("names an order of several products by its first one", () => {
    expect(renderNotification(claimed({ item_count: 3, quantity: 1 }), SITE).subject).toBe(
      "Nueva solicitud de compra: Florero y 2 más",
    );
  });

  it("points a buyer message at the conversation without quoting it", () => {
    const email = renderNotification(
      claimed({ kind: "buyer_message", dedupe_key: "buyer_message:90", order_id: null, conversation_id: 33, item_count: null, quantity: null, decide_by_at: null }),
      SITE,
    );

    expect(email.subject).toBe("Un comprador te escribió sobre Florero");
    expect(email.text).toContain("Un comprador te escribió en Tienda de Bear sobre Florero.");
    expect(email.text).toContain(`${SITE}/mensajes/33`);
  });

  it("warns that a request is about to expire and what happens then", () => {
    const email = renderNotification(claimed({ kind: "request_expiring", dedupe_key: "request_expiring:12" }), SITE);

    expect(email.subject).toBe("Tu solicitud vence pronto: Florero");
    expect(email.text).toMatch(/vence el 7 de octubre.*\. Si no la aceptas o rechazas antes, vence sola y las unidades vuelven a tu catálogo\./);
    expect(email.text).toContain(`${SITE}/panel/pedidos/12`);
  });

  it("escapes what sellers typed and keeps subjects on one line", () => {
    const email = renderNotification(claimed({ product_name: "<b>Jarra</b>\r\nBcc: x@y.z", shop_name: "Tom & Jerry" }), SITE);

    expect(email.subject).toBe("Nueva solicitud de compra: <b>Jarra</b> Bcc: x@y.z");
    expect(email.html).toContain("&lt;b&gt;Jarra&lt;/b&gt;");
    expect(email.html).toContain("Tom &amp; Jerry");
    expect(email.html).not.toContain("<b>Jarra</b>");
  });
});

describe("handleDispatch", () => {
  const env: DispatchEnv = {
    NOTIFICATIONS_DISPATCH_TOKEN: "secreto",
    RESEND_API_KEY: "re_test",
    SUPABASE_URL: "https://proyecto.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    SITE_URL: SITE,
  };

  function request(token: string | null) {
    return new Request("https://proyecto.supabase.co/functions/v1/send-notifications", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }

  function fakeFetch(rows: ClaimedNotification[], resend: (call: number) => Response | Error) {
    let resendCalls = 0;
    return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/rest/v1/rpc/claim_notification_batch")) return json(rows);
      if (url.endsWith("/rest/v1/rpc/complete_notification")) return new Response(null, { status: 204 });
      if (url === "https://api.resend.com/emails") {
        const outcome = resend(resendCalls++);
        if (outcome instanceof Error) throw outcome;
        return outcome;
      }
      throw new Error(`unexpected ${url} ${init?.method}`);
    });
  }

  function callsTo(fetchMock: ReturnType<typeof fakeFetch>, suffix: string) {
    return fetchMock.mock.calls.filter(([input]) => String(input).endsWith(suffix));
  }

  const noSleep = async () => {};

  it("turns away a caller without the dispatch token", async () => {
    const fetchMock = fakeFetch([], () => json({}));

    for (const token of [null, "otro"]) {
      const response = await handleDispatch(request(token), { env, fetch: fetchMock, sleep: noSleep });
      expect(response.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves the outbox alone until Resend is configured", async () => {
    const fetchMock = fakeFetch([claimed()], () => json({}));

    const response = await handleDispatch(request("secreto"), { env: { ...env, RESEND_API_KEY: undefined }, fetch: fetchMock, sleep: noSleep });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false, claimed: 0, sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends each claimed email once and reports every outcome", async () => {
    const rows = [claimed(), claimed({ id: 2, dedupe_key: "purchase_request:13", order_id: 13 })];
    const fetchMock = fakeFetch(rows, (call) => (call === 0 ? json({ id: "email-1" }) : new Response("caído", { status: 500 })));

    const response = await handleDispatch(request("secreto"), { env, fetch: fetchMock, sleep: noSleep });

    expect(await response.json()).toEqual({ configured: true, claimed: 2, sent: 1, failed: 1 });

    const [claim] = callsTo(fetchMock, "/rpc/claim_notification_batch");
    expect(JSON.parse(String(claim[1]?.body))).toEqual({ p_limit: 20 });
    expect(new Headers(claim[1]?.headers).get("authorization")).toBe("Bearer service-key");

    const sends = callsTo(fetchMock, "/emails");
    expect(sends).toHaveLength(2);
    const firstHeaders = new Headers(sends[0][1]?.headers);
    expect(firstHeaders.get("idempotency-key")).toBe("purchase_request:12");
    expect(firstHeaders.get("authorization")).toBe("Bearer re_test");
    expect(JSON.parse(String(sends[0][1]?.body))).toMatchObject({
      from: "Plaza Volcanes <avisos@plazavolcanes.com>",
      to: ["tienda@example.com"],
      subject: "Nueva solicitud de compra: Florero",
    });

    const completions = callsTo(fetchMock, "/rpc/complete_notification").map(([, init]) => JSON.parse(String(init?.body)));
    expect(completions).toEqual([
      { p_id: 1, p_sent: true, p_error: null },
      { p_id: 2, p_sent: false, p_error: "Resend 500: caído" },
    ]);
  });

  it("records a network failure instead of losing the email", async () => {
    const fetchMock = fakeFetch([claimed()], () => new Error("ECONNRESET"));

    const response = await handleDispatch(request("secreto"), { env, fetch: fetchMock, sleep: noSleep });

    expect(await response.json()).toMatchObject({ sent: 0, failed: 1 });
    const [completion] = callsTo(fetchMock, "/rpc/complete_notification").map(([, init]) => JSON.parse(String(init?.body)));
    expect(completion).toEqual({ p_id: 1, p_sent: false, p_error: "ECONNRESET" });
  });

  it("spaces sends to stay inside Resend's rate limit", async () => {
    const sleep = vi.fn(async () => {});
    const rows = [claimed(), claimed({ id: 2 }), claimed({ id: 3 })];

    await handleDispatch(request("secreto"), { env, fetch: fakeFetch(rows, () => json({ id: "x" })), sleep });

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(550);
  });

  it("reports a claim it could not make", async () => {
    const fetchMock = vi.fn(async () => new Response("boom", { status: 500 }));

    const response = await handleDispatch(request("secreto"), { env, fetch: fetchMock, sleep: noSleep });

    expect(response.status).toBe(502);
  });
});
