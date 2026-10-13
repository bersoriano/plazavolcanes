# Unified Messages Inbox — Design Specification

## Objective

Redesign `/mensajes` as one inbox that holds buying and selling conversations together, in a list-and-thread layout: filters, a searchable conversation list, and the open conversation beside it.

## Scope

This project includes:

- One merged conversation list, newest first, with each row marked `Compra` or `Venta`
- Filters: `Todos`, `Sin leer`, `Compras`, `Ventas`
- Instant search over the loaded conversations
- A thread pane with a context card, day separators, message bubbles, and a compact composer
- A list that stays current while a thread is open
- The first item of an order, with its photo, on order threads (`public.list_conversations` gains three columns)
- Database, mapper, formatter, hook, component, route, and end-to-end tests

This project excludes:

- Row checkboxes, bulk actions, archive, delete, sent, and folders. The data model has none of them.
- Image attachments and a per-thread actions menu.
- Sending with the Enter key. Enter stays a line break, as it is today.
- Restyling the conversation card embedded in `/compras/[id]`, `/panel/pedidos/[id]`, and the cart. It keeps its look; it only shares the extracted live-thread hook.
- Searching message history. Search covers what each row shows.

## Routes

URLs do not change, so every existing link, redirect, and `revalidatePath` call keeps working.

| File | Role |
| --- | --- |
| `app/mensajes/layout.tsx` | Requires a session, loads both conversation lists, renders `InboxShell` around `children` |
| `app/mensajes/page.tsx` | The pane when nothing is open: an invitation to pick a conversation |
| `app/mensajes/[id]/page.tsx` | The open thread: header, context card, conversation |
| `app/mensajes/[id]/loading.tsx` | Pane skeleton, so opening a thread responds at once |
| `app/mensajes/[id]/not-found.tsx` | Pane-level "not found", so the list stays on screen |

The list lives in the layout because a layout persists across navigation: the list keeps its scroll position, filter, and search text while threads change. A layout is not re-rendered on navigation, so the list is kept current as described in "Keeping the list current".

A signed-out visitor is redirected to `/ingresar?continuar=/mensajes` by the layout. A thread the caller is not part of still reads as not found.

## Layout

| Width | Arrangement |
| --- | --- |
| `xl` and up | Three columns: filters, list, thread |
| `lg` to `xl` | Two columns: list with the filters as chips above it, thread |
| Below `lg` | One column. `/mensajes` shows title, chips, search, list. `/mensajes/[id]` shows only the thread, with a back link, and the composer pinned above the quick-access bar. |

From `lg` up the inbox is one bordered frame as tall as the viewport under the site header; each column scrolls on its own. Below `lg` the list page scrolls with the document and the thread fills the space between the header and the quick-access bar.

The title and the filters are one element that changes direction with width, so the page has a single `Mensajes` title and a single filter group. The title is the page's `h1` while no thread is open; with a thread open, the thread's counterpart name is the `h1`.

## Data

### Database

`public.list_conversations(p_role text)` is recreated with three columns appended:

- `order_item_name text` — the product name recorded on the order's first line (lowest `order_items.id`)
- `order_item_image_path text` — that product's current cover path, or `null` once the listing is deleted
- `order_item_count integer` — how many lines the order has

All three are `null` for a conversation that is not about an order. Both parties to the conversation are parties to the order, so nothing new is disclosed. The change is additive: an application version that does not read the columns is unaffected, so the migration is applied before the interface ships.

### Mapping

- `ConversationRow` gains the three columns. `ConversationSummary` gains `order_item: { name: string; image_url: string | null; more: number } | null`, where `more` is the number of further lines.
- `Thread` gains `order_item` so the context card can show it.
- `InboxEntry` is a `ConversationSummary` with a `role: "buyer" | "seller"`.
- `mergeInbox(buying, selling)` keeps started conversations only, tags each with its role, drops a duplicate id, and sorts by last message, newest first.
- `filterInbox(entries, filter, query)` applies the filter and the search. Search ignores case and accents and matches the counterpart, shop name, product name, order item name, `pedido #n`, and the last message.
- `unreadTotals(entries)` returns unread message totals for all, buying, and selling.

`listConversations` is wrapped in React `cache`, so the layout and the thread page share one round trip per role within a request.

### Dates

`lib/format.ts` gains three formatters that take the reference time and time zone as arguments:

- `formatInboxDate` — the time for today, `12 oct` within the year, `12 oct 2025` otherwise
- `formatMessageTime` — the time of day
- `formatMessageDay` — `Hoy`, `Ayer`, or the full date

Message times are shown in the viewer's own time zone. `useViewerTimeZone` returns `America/Mexico_City` during the server render and the browser's zone after hydration, through `useSyncExternalStore`, so the two renders never disagree.

## Interface

### Filters

A group of buttons with `aria-pressed`. `Sin leer`, `Compras`, and `Ventas` carry their unread message total when it is above zero. `Ventas` appears only when the viewer owns a shop or has a selling conversation. Filters and search are not rendered for an inbox with no conversations.

### List row

Each row is one link to `/mensajes/{id}`, marked `aria-current="page"` when open:

- An unread dot, and the name and date in bold, while the thread has unread messages
- A thumbnail: the product photo, the order's first item photo, a package tile for an order without one, or the counterpart's initial for a general enquiry. A small bag or shop badge on it repeats the role.
- Counterpart name and date
- `Compra` or `Venta`, then `Pedido #n`, `Consulta`, or `Consulta general`
- The subject: the product name, or the order's first item followed by `y n más`
- The last message, prefixed with `Tú:` when the viewer sent it, and the unread count labelled `n mensajes sin leer`

The open thread's row is shown as read immediately.

Empty states: no conversations at all (with a link to `/explorar`), and no conversation matching the filter or search.

### Thread pane

- Header: back link below `lg`, counterpart name, and `Compra` or `Venta · {shop}`
- Context card: an order shows its first item and `Ver el pedido #n` (to `/compras/{id}` for a buyer, `/panel/pedidos/{id}` for a seller); a product enquiry shows the listing with price and availability, linked while it is public; a general enquiry names the shop
- Messages in a `role="log"` region named `Conversación`, grouped under day separators, the viewer's on the right in the brand colour, the counterpart's on the left. Long words and links wrap.
- Composer: a labelled `Mensaje` text area that grows with its content and a round `Enviar mensaje` button. Errors show above it; a sent message is confirmed by appearing.
- The message area scrolls itself to the newest message; it does not scroll the document.

## Keeping the list current

- `subscribeToMessageInserts` (new, `lib/realtime-messages.ts`) holds the realtime subscription the thread already used: hand the session to realtime, then subscribe to `messages` inserts, optionally filtered to one conversation.
- `useLiveThread` (extracted from `MessageThread`) owns the live merge, the degraded-socket polling, the catch-up window, and marking the thread read. It marks read when the newest message changes, not on every render. With `refreshOnRead`, it refreshes the router after marking a counterpart's message read, which clears the row's unread state and the header badge.
- `InboxShell` subscribes to every message insert the viewer may see (row-level security scopes it) and refreshes the router, debounced. It also refreshes when the page becomes visible again.

`MessageThread` keeps its markup and behaviour and now uses `useLiveThread` without `refreshOnRead`.

## Testing

### Database (`supabase/tests/database/list_conversations.test.sql`)

- An order thread returns its first item's name and cover, and the order's line count
- A conversation that is not about an order returns `null` for all three

### Unit (Vitest)

- Mapper: `order_item` with `more`, `null` outside orders, image resolved through the media map
- `mergeInbox`: role tags, newest first, silent threads left out, duplicate ids dropped
- `filterInbox`: each filter; search by counterpart, product, order number, and message, ignoring accents
- `unreadTotals`
- The three date formatters, across the day and year boundaries and in two time zones

### Component (Vitest)

- `InboxShell`: merged rows with role labels and links; filters; search; `Ventas` hidden without selling; unread markers; the open row marked current and shown as read; both empty states; the title is an `h1` only when nothing is open
- `ThreadConversation`: bubbles, day separators, empty thread, composer names, error message, a live message appended
- `ThreadContext`: the existing cases, plus the order item
- `useLiveThread`: the existing `MessageThread` suite keeps passing; marks read once per newest message; refreshes after reading only when asked
- Routes: the layout redirects without a session and merges both lists; the thread page keeps its order links and revalidation paths

### End to end

- `tests/e2e/messaging.spec.ts` is updated to look for messages inside the conversation log, since the list now previews them too
- `tests/e2e/mobile-polish.spec.ts` keeps covering `/mensajes` for tap targets and overflow

### Verification gates

Focused Vitest files, `supabase test db`, `npm run typecheck`, `npm run lint`, full `npm test`, the messaging and mobile-polish end-to-end specs, and a production build that still links one global stylesheet from `/`.
