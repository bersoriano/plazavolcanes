/**
 * Seller notification emails: what each one says, and the dispatch run that
 * sends whatever the outbox has due.
 *
 * The Edge Function in `send-notifications/index.ts` only wires Deno to this
 * module. Nothing here imports anything, so the same file runs under Deno and
 * under the app's typecheck and Vitest. The database decides what deserves an
 * email (`private.notification_outbox`); this file never reads a message body,
 * an address or a phone number, because the claim RPC never returns one.
 */

export type NotificationKind = "purchase_request" | "buyer_message" | "request_expiring";

/** One row of `public.claim_notification_batch`. */
export type ClaimedNotification = {
  id: number;
  kind: NotificationKind;
  dedupe_key: string;
  attempts: number;
  recipient_email: string;
  order_id: number | null;
  conversation_id: number | null;
  shop_name: string | null;
  product_name: string | null;
  item_count: number | null;
  quantity: number | null;
  decide_by_at: string | null;
  time_zone: string | null;
};

export type RenderedEmail = { subject: string; text: string; html: string };

type Block = { text: string; link?: { label: string; href: string } };

const FALLBACK_TIME_ZONE = "America/Mexico_City";
const DEFAULT_FROM = "Plaza Volcanes <avisos@plazavolcanes.com>";
const DEFAULT_SITE_URL = "https://plazavolcanes.com";
const BATCH_SIZE = 20;
/** Resend allows two requests a second on its standard plan. */
const SEND_SPACING_MS = 550;

function formatDeadline(value: string, timeZone: string | null) {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat("es-MX", { ...options, timeZone: timeZone ?? FALLBACK_TIME_ZONE }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("es-MX", { ...options, timeZone: FALLBACK_TIME_ZONE }).format(new Date(value));
  }
}

function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function productLabel(notification: ClaimedNotification) {
  const name = notification.product_name ? oneLine(notification.product_name) : null;
  if (!name) return notification.order_id ? `tu pedido #${notification.order_id}` : "uno de tus productos";
  const others = (notification.item_count ?? 1) - 1;
  return others > 0 ? `${name} y ${others} más` : name;
}

function unitsLabel(quantity: number | null) {
  if (!quantity) return "";
  return ` (${quantity} ${quantity === 1 ? "unidad" : "unidades"})`;
}

function footer(siteUrl: string): Block {
  return {
    text: "Recibes este correo porque tienes una tienda en Plaza Volcanes. Puedes desactivar estos avisos en Mi cuenta:",
    link: { label: "Mi cuenta", href: `${siteUrl}/panel/cuenta` },
  };
}

function compose(subject: string, blocks: Block[]): RenderedEmail {
  const text = blocks
    .map((block) => (block.link ? `${block.text}\n${block.link.href}` : block.text))
    .join("\n\n");
  const html = blocks
    .map((block) => {
      const link = block.link ? ` <a href="${escapeHtml(block.link.href)}">${escapeHtml(block.link.label)}</a>` : "";
      return `<p>${escapeHtml(block.text)}${link}</p>`;
    })
    .join("\n");
  return { subject: oneLine(subject), text, html };
}

export function renderNotification(notification: ClaimedNotification, siteUrl: string): RenderedEmail {
  const shop = notification.shop_name ? oneLine(notification.shop_name) : "tu tienda";
  const label = productLabel(notification);
  const orderHref = `${siteUrl}/panel/pedidos/${notification.order_id}`;
  const deadline = notification.decide_by_at ? formatDeadline(notification.decide_by_at, notification.time_zone) : null;

  switch (notification.kind) {
    case "purchase_request":
      return compose(`Nueva solicitud de compra: ${label}`, [
        { text: `Recibiste una solicitud de compra en ${shop}: ${label}${unitsLabel(notification.quantity)}.` },
        {
          text: deadline
            ? `Tienes hasta el ${deadline} para aceptarla o rechazarla. Si no respondes, la solicitud vence y las unidades vuelven a tu catálogo.`
            : "Acéptala o recházala en tu panel. Si no respondes a tiempo, la solicitud vence y las unidades vuelven a tu catálogo.",
        },
        { text: "Revisa la solicitud:", link: { label: "Revisar solicitud", href: orderHref } },
        footer(siteUrl),
      ]);
    case "buyer_message":
      return compose(`Un comprador te escribió sobre ${label}`, [
        { text: `Un comprador te escribió en ${shop} sobre ${label}.` },
        {
          text: "Responde desde Plaza Volcanes:",
          link: { label: "Ver conversación", href: `${siteUrl}/mensajes/${notification.conversation_id}` },
        },
        footer(siteUrl),
      ]);
    case "request_expiring":
      return compose(`Tu solicitud vence pronto: ${label}`, [
        {
          text: `La solicitud de compra de ${label} en ${shop} vence el ${deadline ?? "pronto"}. Si no la aceptas o rechazas antes, vence sola y las unidades vuelven a tu catálogo.`,
        },
        { text: "Revísala:", link: { label: "Revisar solicitud", href: orderHref } },
        footer(siteUrl),
      ]);
  }
}

export type DispatchEnv = {
  NOTIFICATIONS_DISPATCH_TOKEN?: string;
  RESEND_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SITE_URL?: string;
  NOTIFICATIONS_FROM?: string;
};

export type DispatchDeps = {
  env: DispatchEnv;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

/** Compares the whole string every time, so the reply time says nothing about the token. */
function sameSecret(given: string, expected: string) {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * One dispatch run: claim what is due, send it, report each outcome. A row is
 * only ever completed once; one the run never reaches keeps its lease and is
 * claimed again after it expires. Resend's idempotency key is the row's dedupe
 * key, so a row retried after an ambiguous failure is not delivered twice.
 */
export async function handleDispatch(request: Request, { env, fetch, sleep }: DispatchDeps): Promise<Response> {
  const expected = env.NOTIFICATIONS_DISPATCH_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !sameSecret(given, expected)) return reply({ error: "unauthorized" }, 401);

  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = env.RESEND_API_KEY;
  if (!supabaseUrl || !serviceKey || !resendKey) {
    return reply({ configured: false, claimed: 0, sent: 0, failed: 0 });
  }

  const siteUrl = (env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const from = env.NOTIFICATIONS_FROM || DEFAULT_FROM;
  const wait = sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const rpc = (name: string, body: unknown) =>
    fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const claim = await rpc("claim_notification_batch", { p_limit: BATCH_SIZE });
  if (!claim.ok) return reply({ error: `claim failed: ${claim.status}` }, 502);
  const rows = (await claim.json()) as ClaimedNotification[];

  let sent = 0;
  let failed = 0;
  for (const [index, row] of rows.entries()) {
    if (index > 0) await wait(SEND_SPACING_MS);
    const email = renderNotification(row, siteUrl);
    let error: string | null = null;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": row.dedupe_key,
        },
        body: JSON.stringify({ from, to: [row.recipient_email], subject: email.subject, text: email.text, html: email.html }),
      });
      if (!response.ok) error = `Resend ${response.status}: ${(await response.text()).slice(0, 200)}`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }

    if (error) failed += 1;
    else sent += 1;
    await rpc("complete_notification", { p_id: row.id, p_sent: error === null, p_error: error });
  }

  return reply({ configured: true, claimed: rows.length, sent, failed });
}
