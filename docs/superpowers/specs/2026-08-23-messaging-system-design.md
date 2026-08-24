# Messaging System — Design Specification

## Objective

Give Plaza Volcanes a complete buyer–seller messaging system: pre-sale conversations reachable from any shop or product page, split buyer and seller inboxes with unread counts, live message delivery, and an audited path for administrators who read conversations while arbitrating disputes.

Messages remain server-readable plaintext. Privacy is protected by scoped row-level security, an accountable admin access path, and retention limits rather than end-to-end encryption.

## Scope

This project includes:

- Pre-sale conversation entry points on shop and product pages
- A buyer display name, collected at registration and editable afterwards, so sellers can address a person in pre-sale chat
- Buyer inbox at `/mensajes` and seller inbox at `/panel/mensajes`, each listing pre-sale and order threads
- Per-participant read tracking and unread counts, including a header badge
- Realtime message delivery layered over authoritative server rendering
- A single shared thread component used by the inboxes and the existing order pages
- Audited administrator conversation access replacing direct row-level select
- Send and conversation-creation rate limits
- Scheduled retention purge for idle pre-sale conversations

This project excludes:

- End-to-end encryption. Evaluated and rejected; see "Rejected Alternatives".
- Attachments, images, or any non-text message body
- Group conversations. Every conversation stays exactly one buyer and one shop.
- Push notifications and email notification of new messages
- Message editing, deletion by participants, or reactions
- Any change to buyer trust metrics
- Message search

## Approved Product Policies

- A conversation is always between one buyer and one shop. Pre-sale conversations are unique per `(buyer_id, shop_id)`; order conversations are unique per order. Both constraints already exist.
- A shop owner cannot open a conversation with their own shop. Already enforced by `start_pre_sale_conversation`.
- Message bodies are plaintext, between 1 and 2000 characters, and readable by both participants and by administrators through an audited path.
- Administrators retain full ability to read any conversation. Every such read is recorded with the reading administrator, the conversation, and a stated reason.
- The seller response-time clock measures order conversations only. Pre-sale messages never start or close it.
- Pre-sale conversations idle for 180 days are purged. Order conversations are never automatically purged, because disputes and reviews depend on them.
- Realtime delivery is an accelerator. Durable history always comes from the server.
- A buyer's display name is visible only to people they are actually in a conversation with, and to administrators through the audited path. It is never public and never joined onto the catalog.
- A user without a display name is labelled `Comprador #XXXX`, derived from their id. Existing accounts are never blocked or nagged into setting one.

## Canonical Data Model

### `public.user_display_names` (new)

```sql
create table public.user_display_names (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 40),
  updated_at timestamptz not null default now()
);
```

No select grant to `authenticated`. Names are never read through row-level security; they surface only inside the conversation RPCs below, which already establish that the caller is a participant. That is tighter than a policy joining conversations on every read, and it keeps display names out of catalog queries by construction.

The owner may read and update their own row through `public.set_display_name(p_display_name text)`, exposed on `/panel/cuenta`.

Registration collects the name alongside the phone number already gathered by `signUp`, passed through `options.data.display_name` and written by the existing new-user trigger, extending the pattern established for `user_contact_details`.

Existing accounts have no row. Every read path falls back to `Comprador #` plus the first four uppercase hex characters of the user id, which is stable per person, so a seller still recognizes a returning shopper. No backfill migration and no forced prompt.

### `public.conversation_reads` (new)

```sql
create table public.conversation_reads (
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_message_id bigint not null references public.messages (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
```

Unread count for a participant is the number of messages in the conversation with `id > last_read_message_id` and `sender_id <> user_id`. A participant with no row has every message from the other party unread.

Row-level security: a participant may select and upsert only their own row, and only for a conversation they participate in. Administrators have no access; unread state is personal and carries no arbitration value.

### `public.admin_read_events` (new)

```sql
create table public.admin_read_events (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users (id) on delete restrict,
  conversation_id bigint not null references public.conversations (id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

create index admin_read_events_conversation_idx
on public.admin_read_events (conversation_id, created_at desc);
```

Append-only. No participant-facing exposure. Administrators may select it, so the audit trail is itself reviewable by administration.

### `private.message_rate_limits` (new)

```sql
create table private.message_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_hour timestamptz not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  conversations_opened integer not null default 0 check (conversations_opened >= 0),
  primary key (user_id, window_hour)
);
```

Follows the shape established by `private.telemetry_rate_limits`: revoked from all browser roles, written only by security-definer functions.

Limits:

- 60 messages per user per rolling hour, read from the current `window_hour` row
- 10 new pre-sale conversations per user per rolling 24 hours, read as the sum of `conversations_opened` across rows where `window_hour > now() - interval '24 hours'`

Both counters live in the same hourly table; only the read window differs. Rows older than 24 hours are dropped by the same daily job that runs the retention purge.

Exceeding either raises `P0001` with Spanish user-facing copy. Existing conversations remain readable when a limit is hit; only sending is refused.

### Changes to existing objects

`private.record_message_evidence` gains a guard so the seller response clock and the `seller_message` activity record fire only when the conversation type is `order`:

```sql
if v_conversation.type <> 'order' then
  update public.conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end if;
```

The `updated_at` bump stays unconditional — it already lives in this trigger and drives inbox ordering, so pre-sale threads must keep bumping it.

The administrator branches are dropped from `conversation_participants_select` and `message_participants_select`, leaving those policies scoped to participants alone. Administrator access moves entirely to `public.read_conversation_as_admin`. The administrator branch on `response_event_participants_select` is unaffected; response events carry no message text.

`public.messages` is added to the `supabase_realtime` publication. Postgres change events honor the participant policy above, so this adds no read surface.

## RPCs

All are `security definer` with `set search_path = ''`, matching house style.

### `public.list_conversations(p_role text) returns table (...)`

Declared with an explicit `returns table` column list so callers need no column definition list. `p_role` is `'buyer'` or `'seller'`; any other value raises `22023`. Returns, ordered by `updated_at` descending:

`conversation_id bigint`, `type text`, `order_id bigint`, `shop_id bigint`, `shop_name text`, `shop_slug text`, `counterpart_label text`, `last_message_body text`, `last_message_at timestamptz`, `last_message_sender_id uuid`, `unread_count integer`.

For `'buyer'`, rows are conversations where `buyer_id = auth.uid()` and `counterpart_label` is the shop name. For `'seller'`, rows are conversations whose shop is owned by `auth.uid()` and `counterpart_label` is the buyer's `user_display_names` entry, falling back to the `Comprador #XXXX` handle. The latest message comes from a lateral join, so no message text is denormalized onto `conversations`.

### `public.mark_conversation_read(p_conversation_id bigint, p_last_message_id bigint) returns void`

Upserts `conversation_reads` for the caller. The stored value is `greatest(existing, p_last_message_id)`, so an out-of-order call cannot regress unread state. Refuses when the caller is not a participant or the message does not belong to the conversation.

### `public.unread_message_count() returns integer`

Total unread across every conversation the caller participates in, as buyer or as seller. Drives the header badge in one query.

### `public.read_conversation_as_admin(p_conversation_id bigint, p_reason text) returns table (...)`

Raises `42501` unless `public.is_current_user_admin()`. Inserts one `admin_read_events` row, then returns the conversation's messages as `id bigint`, `sender_id uuid`, `sender_label text`, `body text`, `created_at timestamptz`. The audit insert happens before the read in the same transaction, so a read cannot succeed without being recorded.

### Changes to `public.send_conversation_message`

Gains the per-hour rate-limit check before insert. Behavior is otherwise unchanged, including idempotency on `(conversation_id, idempotency_key)`.

### Changes to `public.start_pre_sale_conversation`

Gains the per-day conversation-creation limit. The limit counts only rows that actually insert; re-opening an existing thread with the same shop still returns the existing id and does not consume quota.

## Retention

A `pg_cron` job, `messaging-presale-purge`, runs daily and deletes pre-sale conversations whose `updated_at` is older than 180 days. It never touches `type = 'order'`. `pg_cron` is already enabled by `20260820173552_add_fulfillment_communication.sql`.

Every existing foreign key onto `conversations` and `messages` in this schema is `on delete restrict`, so the purge deletes in dependency order within one transaction: `conversation_reads`, then `messages`, then the conversation. `conversation_reads.last_read_message_id` is likewise `on delete restrict`, which is why read rows go first. The same job prunes `private.message_rate_limits` rows older than 24 hours.

Where the extension is unavailable, the same function is callable by an operator on a schedule of their choosing. A purge that silently stops running is the failure mode worth alerting on.

## Application Layer

Follows the existing split of pure mapper module and server-only fetch module, as in `lib/queries/orders.ts` and `lib/queries/orders.server.ts`.

| Module | Responsibility |
| --- | --- |
| `lib/queries/messages.ts` | Types and pure mappers for inbox rows and threads. Unit-tested. |
| `lib/queries/messages.server.ts` | `listConversations(role)`, `fetchThread(id)`, `fetchUnreadCount()` |
| `lib/actions/messages.ts` | `sendMessage`, `startPreSaleConversation`, `markConversationRead` |
| `lib/validation/message.ts` | Zod schemas, moved out of `order-events.ts` now that messages are not order-specific |
| `lib/display-name.ts` | `displayNameOrHandle(name, userId)`, the single fallback implementation used by both server and client renders |
| `lib/actions/auth.ts` | `signUp` passes `display_name` through `options.data` beside the existing `phone` |
| `lib/actions/account.ts` | `setDisplayName` for `/panel/cuenta` |

`sendMessage` currently hardcodes revalidation of `/compras/{orderId}` and `/panel/pedidos/{orderId}`. It is generalized to take the paths to revalidate, so the same action serves order pages and the new thread routes.

The idempotency key moves from a hidden form input to generation inside the action on each submit. The current component computes `crypto.randomUUID()` during render; because `send_conversation_message` returns the existing row id for a repeated key, a stale key silently discards a second message rather than sending it.

## Routes and Components

```
/mensajes                buyer inbox
/mensajes/[id]           buyer thread
/panel/mensajes          seller inbox
/panel/mensajes/[id]     seller thread
```

Buyer and seller inboxes stay separate, matching the `/compras` and `/panel` division users already understand. A person who both buys and sells has a thread list in each place. Both inboxes list pre-sale and order threads; an order thread links to its order.

| Component | Notes |
| --- | --- |
| `components/messages/conversation-list.tsx` | Server component. Thread rows, unread pills, relative timestamps. Shared by both inboxes. |
| `components/messages/message-thread.tsx` | Client component. Renders server-provided history, subscribes to Realtime, hosts the composer. Replaces `components/orders/conversation.tsx`. |
| `components/messages/start-conversation-button.tsx` | Server action form. Placed on `/tiendas/[slug]` and `/productos/[slug]`. Hidden from a shop's own owner and from signed-out visitors, who are sent to `/ingresar`. |

`app/compras/[id]/page.tsx` and `app/panel/pedidos/[id]/page.tsx` swap their inline conversation for `message-thread`, so order chat gains live delivery with no second implementation.

`components/layout/site-header.tsx` gains a Mensajes link carrying the unread count from `unread_message_count()`.

`app/admin/disputas/page.tsx` reads conversations through `read_conversation_as_admin` and prompts for a reason before revealing message text.

## Realtime

`message-thread` subscribes to Postgres change events on `public.messages` filtered by `conversation_id`, using the existing browser client in `lib/supabase/client.ts`. Arriving messages are appended, deduplicated by message id against the server-rendered history.

Subscription status is handled explicitly. On `CHANNEL_ERROR` or `TIMED_OUT`, the component falls back to `router.refresh()` on window focus plus a slow interval. A dropped socket degrades to today's request-response behavior rather than to a thread that appears empty or frozen.

A subscription also reports `SUBSCRIBED` before the server has finished registering it, and a message sent into that window reaches no socket while the status still reads healthy. For the first thirty seconds after subscribing the thread therefore also asks the server every few seconds, then stops and trusts the socket. The window is short against a warm Realtime and several seconds against one that has just restarted, when every client reconnects at once.

Marking a thread read fires when it mounts and again when a message arrives while the window is focused.

## Error Handling

- Send failures return the existing `ActionState` shape and preserve typed input, consistent with `components/forms-preserve-input.test.tsx`.
- Rate-limit refusals surface distinct Spanish copy from generic send failures, so a user understands they are throttled rather than broken.
- `mark_conversation_read` never regresses, so a slow request completing out of order cannot resurrect read messages as unread.
- The admin read form requires a non-empty reason; the RPC re-checks rather than trusting the client.
- Opening a thread the caller does not participate in returns Next.js `notFound()` rather than an authorization error, so thread existence is not disclosed.

## Testing

**Database, pgTAP, `supabase/tests/database/messaging_inbox.test.sql`:**

- Unread counts: no read row, partial read, fully read, own messages never counted
- `mark_conversation_read` refuses non-participants and does not regress on an older id
- Inbox rows scoped correctly for buyer role and seller role, and a dual-role user sees the right threads in each
- Administrator direct select on `messages` and `conversations` is now denied
- `read_conversation_as_admin` writes exactly one audit row and returns the messages; a non-administrator is refused and writes no row
- Pre-sale messages do not create `seller_response_events`; order messages still do
- Pre-sale messages still bump `conversations.updated_at`
- Rate limits refuse past the message and conversation thresholds and reset across windows
- Retention purge removes idle pre-sale threads and leaves order threads untouched, in an order the restrict constraints permit
- A display name is readable through `list_conversations` only by the counterpart; a non-participant reading the same buyer's threads gets nothing, and no direct select on `user_display_names` succeeds as `authenticated`
- A user with no display-name row is labelled with the fallback handle rather than a null

**Unit, vitest:** mappers in `lib/queries/messages.ts`, `lib/display-name.ts` including the fallback, `conversation-list`, `message-thread` including the Realtime append and deduplication paths, and the actions.

**End to end, playwright:** a buyer opens a pre-sale thread from a shop page, the seller replies from `/panel/mensajes`, the buyer's unread badge appears and then clears on opening the thread.

## Rejected Alternatives

**End-to-end encryption via `reusable-secure-messaging`.** The SDK is complete and production-shaped, but its threat model does not match this application. End-to-end encryption protects users from the operator; this marketplace's operator is the arbiter, with `resolve_dispute`, administrator conversation access, and trust tiers all premised on the platform being able to see and judge. Its schema also permits one active device per user, so a buyer moving between phone and laptop would lose message history and force the seller to re-verify a fingerprint. The proportional protections adopted instead are participant-scoped row-level security, audited administrator reads, and retention limits.

**A single unified inbox.** Rejected because it cuts against the established `/compras` and `/panel` division and obscures which role a thread belongs to.

**Denormalized last-message columns on `conversations`.** Rejected because it duplicates message text and introduces a second copy to keep consistent. A lateral join in `list_conversations` is sufficient at this scale.

**Anonymous buyer handles instead of display names.** Rejected in favour of real names, which read better in pre-sale conversation. The handle survives only as the fallback for accounts that have not set a name.

**Storing the display name on `user_trust_profiles`.** Rejected because that table's select policy exposes rows for shop owners to anyone, and a buyer name must not be public.

**Client-reported read receipts shown to the other party.** Out of scope. Read state stays private to its owner.
