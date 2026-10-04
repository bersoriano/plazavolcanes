# Seller Email Notifications — Design Specification

## Objective

A seller hears about new activity without opening the panel. Within about a minute of a new purchase request or a buyer message, and once before a request expires, the shop owner receives a short Spanish email that links to the right page. Sellers can switch these emails off.

This is part 2b of fix 2 from the seller audit; request expiry (2a) shipped separately.

## Scope

This project includes:

- Email to shop owners for: a new purchase request, a buyer message (throttled per conversation), and a request with less than 24 hours left
- A durable outbox in the database, filled by triggers and a scheduled job
- A Supabase Edge Function that sends the outbox through Resend, with retries
- A per-user "Avisos por correo" switch in Mi cuenta
- Seller-side copy that stops saying no notifications are sent

This project excludes:

- Emails to buyers (their pages keep saying no notifications are sent)
- Push, SMS or in-app notification centres
- Digests
- Configuring Supabase Auth to send through Resend SMTP (unblocked by this work, configured in the dashboard)
- Any use of the Supabase service-role key by the Next.js app

## Approved Product Policies

- Provider: Resend. Sender `Plaza Volcanes <avisos@plazavolcanes.com>` unless `NOTIFICATIONS_FROM` overrides it.
- Recipients: shop owners only, at their account email.
- Emails are on by default; a seller can turn them off in Mi cuenta. The switch is read when an email is about to be sent, not when it is queued.
- A buyer message emails the seller unless that conversation already produced an email in the last hour and the seller has not written since.
- The "expiring" email is sent once per request, when fewer than 24 hours remain.
- Emails never contain the buyer's message text, address or contact details. They name the product and shop and link to the panel.
- A request already accepted, rejected or closed by the time its email would go out is skipped.

## Data

- `public.notification_preferences (user_id, email_enabled default true, updated_at)` with row-level security: a user reads and writes only their own row. No row means enabled.
- `private.notification_outbox`: `recipient_id`, `kind` (`purchase_request`, `buyer_message`, `request_expiring`), `order_id`, `conversation_id`, unique `dedupe_key`, `status` (`pending`, `sending`, `sent`, `failed`, `skipped`), `attempts`, `available_at`, `locked_until`, `sent_at`, `last_error`, `created_at`. Not exposed through the API.

Producers:

1. `after insert on public.orders`: one `purchase_request` row for the shop owner, key `purchase_request:<order id>`.
2. `after insert on public.messages`: when the sender is the conversation's buyer, one `buyer_message` row for the shop owner, key `buyer_message:<message id>`, unless the throttle rule above suppresses it.
3. `private.enqueue_expiring_request_notifications()`, scheduled every five minutes as `plaza-warn-expiring-requests`: one `request_expiring` row per requested order whose `decide_by_at` falls within the next 24 hours, key `request_expiring:<order id>`.

## Sending

- `public.claim_notification_batch(p_limit)` (service role only) first marks as `skipped` pending rows whose recipient switched emails off or whose request is no longer `requested`, then claims up to `p_limit` due rows (`pending` and available, or `sending` with an expired lease) with `for update skip locked`, sets `status = 'sending'`, a five-minute lease and `attempts + 1`, and returns each row with the recipient email and the context its template needs.
- `public.complete_notification(p_id, p_sent, p_error)` (service role only) marks a row `sent`, or returns it to `pending` with `available_at = now() + 2^attempts minutes`, or marks it `failed` after five attempts.
- `private.dispatch_notifications()`, scheduled every minute as `plaza-dispatch-notifications`, does nothing unless due rows exist and both Vault secrets `notifications_function_url` and `notifications_dispatch_token` are set; otherwise it posts to the Edge Function with the token through `pg_net`.
- Edge Function `send-notifications`: rejects requests without the bearer token; does nothing without `RESEND_API_KEY`; claims a batch of 20 through PostgREST with the injected service-role key; sends each email to Resend with `Idempotency-Key` set to the row's `dedupe_key`, at most two per second; and reports each outcome through `complete_notification`.
- The function's logic lives in `supabase/functions/_shared/seller-notifications.ts`, which imports nothing, so the Next.js typecheck and Vitest cover it. The Deno entry point only wires `Deno.serve`, the environment and `fetch` to it.

## Emails

- Purchase request — subject `Nueva solicitud de compra: <producto>`; body names quantity, product and shop, the deadline to answer in the shop's time zone, and links to `/panel/pedidos/<id>`.
- Buyer message — subject `Un comprador te escribió sobre <producto>` (or `… sobre tu pedido #<id>`); links to `/mensajes/<conversation id>`.
- Expiring request — subject `Tu solicitud vence pronto: <producto>`; says the request expires at the deadline and the units return to the catalogue; links to the order.
- Every email ends: `Recibes este correo porque tienes una tienda en Plaza Volcanes. Puedes desactivar estos avisos en Mi cuenta: <site>/panel/cuenta`.

## Application

- `/panel/cuenta`: an "Avisos por correo" form with one checkbox, saved by a server action that upserts the signed-in user's row.
- Seller copy in `components/seller-dashboard/action-queue.tsx`, `app/panel/pedidos/page.tsx` and `app/panel/pedidos/[id]/page.tsx` says sellers are emailed about new requests and messages and can turn it off in Mi cuenta. Buyer pages are unchanged.

## Operations

Set up once, by the project owner:

1. Resend account; verify `plazavolcanes.com` with the DNS records Resend lists; create an API key.
2. `supabase secrets set RESEND_API_KEY=… NOTIFICATIONS_DISPATCH_TOKEN=<random> SITE_URL=https://plazavolcanes.com`
3. `supabase functions deploy send-notifications --no-verify-jwt` (the function checks its own token).
4. In SQL: `select vault.create_secret('<function url>', 'notifications_function_url'); select vault.create_secret('<same token>', 'notifications_dispatch_token');`

Until all of these are in place, rows wait in the outbox and nothing is sent.

## Legal

Resend processes recipients' email addresses and is based in the United States. The privacy notice likely needs to name it and the transfer; this is for counsel to confirm before emails are switched on in production.

## Testing

- pgTAP `supabase/tests/database/seller_notifications.test.sql`: preferences row-level security; each producer; the throttle (repeat buyer message suppressed, resumes after a seller reply); the once-only expiring warning; claiming, leasing and skipping (opted out, request no longer pending); completion, backoff and final failure; RPCs callable by the service role only; the dispatcher is a no-op without Vault secrets and posts when they exist; both schedules exist.
- Vitest: the three templates (subjects, links, deadline wording, no message text); the dispatch handler (rejects a bad token, no-ops without an API key, sends with the idempotency key and completes each row, records a failure); the preferences form and action; the seller copy.
