"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { ImageIcon, MessageCircle, Package, Search, ShoppingBag, Store } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { pageContainer } from "@/components/layout/container";
import { INBOX_FRAME_HEIGHT, THREAD_MIN_HEIGHT } from "@/components/messages/inbox-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { formatInboxDate } from "@/lib/format";
import {
  filterInbox,
  orderItemLabel,
  unreadTotals,
  type InboxEntry,
  type InboxFilter,
} from "@/lib/queries/messages";
import { subscribeToMessageInserts } from "@/lib/realtime-messages";
import { useViewerTimeZone } from "@/lib/use-viewer-time-zone";

/** Long enough to fold a burst of messages into one request. */
const REFRESH_DEBOUNCE_MS = 400;

/**
 * The list is rendered by a layout, and a layout is not rendered again when the
 * reader moves between threads. So the list asks for itself: when a message
 * lands in any conversation the reader is part of, and when they come back to
 * the tab after the socket may have slept.
 */
function useInboxSync() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };
    const whenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const unsubscribe = subscribeToMessageInserts({ name: "inbox", onInsert: refresh });
    document.addEventListener("visibilitychange", whenVisible);

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, [router]);
}

/** What the thread is: an order, a question about one listing, or one about the shop. */
function threadKind(entry: InboxEntry) {
  if (entry.type === "order" && entry.order_id) return `Pedido #${entry.order_id}`;

  return entry.product ? "Consulta" : "Consulta general";
}

function threadSubject(entry: InboxEntry) {
  if (entry.product) return entry.product.name;

  return entry.order_item ? orderItemLabel(entry.order_item) : null;
}

/**
 * The picture a row is recognised by. The words beside it already name the
 * product, so the image is decoration to a screen reader, and the small badge
 * repeats the side the row states in text.
 */
function Thumbnail({ entry }: { entry: InboxEntry }) {
  const image = entry.product?.image_url ?? entry.order_item?.image_url ?? null;
  const RoleIcon = entry.role === "buyer" ? ShoppingBag : Store;

  return (
    <span className="relative size-12 shrink-0">
      <span className="grid size-12 place-items-center overflow-hidden rounded-xl bg-photo-backdrop font-display text-lg font-semibold text-brand">
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt="" className="size-full object-cover" src={image} />
        ) : entry.type === "order" ? (
          <Package aria-hidden="true" className="size-6 text-brand/30" />
        ) : entry.product ? (
          <ImageIcon aria-hidden="true" className="size-6 text-brand/30" />
        ) : (
          <span aria-hidden="true">{entry.counterpart_label.trim().charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border border-line bg-surface text-brand"
      >
        <RoleIcon className="size-3" />
      </span>
    </span>
  );
}

function InboxRow({
  currentUserId,
  entry,
  now,
  open,
  timeZone,
}: {
  currentUserId: string;
  entry: InboxEntry;
  now: string;
  open: boolean;
  timeZone: string;
}) {
  const unread = entry.unread_count > 0;
  const subject = threadSubject(entry);
  const last = entry.last_message;

  return (
    <li>
      <Link
        aria-current={open ? "page" : undefined}
        className="flex gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-background aria-[current=page]:bg-background"
        href={`/mensajes/${entry.id}`}
      >
        <span
          aria-hidden="true"
          className={`mt-5 size-2 shrink-0 rounded-full ${unread ? "bg-brand" : ""}`}
        />
        <Thumbnail entry={entry} />

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`truncate ${unread ? "font-bold" : "font-semibold"}`}>
              {entry.counterpart_label}
            </span>
            {last ? (
              <time
                className={`shrink-0 text-xs ${unread ? "font-bold text-ink" : "text-muted"}`}
                dateTime={last.created_at}
              >
                {formatInboxDate(last.created_at, now, timeZone)}
              </time>
            ) : null}
          </span>

          <span className="mt-0.5 block truncate text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            {entry.role === "buyer" ? "Compra" : "Venta"} · {threadKind(entry)}
          </span>

          {subject ? (
            <span className="mt-0.5 block truncate text-[0.8125rem] font-semibold leading-5 text-ink">
              {subject}
            </span>
          ) : null}

          <span className="mt-0.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-muted">
              {last ? `${last.sender_id === currentUserId ? "Tú: " : ""}${last.body}` : null}
            </span>
            {unread ? (
              <span
                aria-label={`${entry.unread_count} mensajes sin leer`}
                className="grid min-w-6 shrink-0 place-items-center rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white"
              >
                {entry.unread_count}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * The inbox: every conversation the reader is in, buying and selling together,
 * with the open one beside the list.
 *
 * From `lg` it is one frame, the list on the left and the thread on the right;
 * from `xl` the filters take a column of their own. Below `lg` the list and the
 * thread are separate screens, which is what the two routes already are.
 */
export function InboxShell({
  children,
  currentUserId,
  entries,
  now,
  showSelling,
}: {
  children: ReactNode;
  currentUserId: string;
  entries: InboxEntry[];
  /** When the server rendered, so "today" is decided once for every row. */
  now: string;
  showSelling: boolean;
}) {
  const segment = useSelectedLayoutSegment();
  const threadOpen = segment !== null;
  const openId = segment !== null && /^\d+$/.test(segment) ? Number(segment) : null;
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const timeZone = useViewerTimeZone();

  useInboxSync();

  // The thread on screen is being read right now, whatever the last fetch said.
  const current = useMemo(
    () => entries.map((entry) => (entry.id === openId ? { ...entry, unread_count: 0 } : entry)),
    [entries, openId],
  );

  if (!entries.length && !threadOpen) {
    return (
      <section className={`${pageContainer} py-10 sm:py-14`}>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
          Mensajes
        </h1>
        <div className="mt-8">
          <EmptyState
            action={
              <Link
                className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
                href="/explorar"
              >
                Explorar productos
              </Link>
            }
            description="Aquí verás las preguntas que hagas a una tienda, las que reciban las tuyas y la conversación de cada pedido."
            icon={<MessageCircle aria-hidden="true" className="size-7" />}
            title="Aún no tienes mensajes"
          />
        </div>
      </section>
    );
  }

  const totals = unreadTotals(current);
  const visible = filterInbox(current, filter, query, openId);
  const filters: { id: InboxFilter; label: string; unread: number }[] = [
    { id: "all", label: "Todos", unread: 0 },
    { id: "unread", label: "Sin leer", unread: totals.all },
    { id: "buying", label: "Compras", unread: totals.buying },
    ...(showSelling ? [{ id: "selling" as const, label: "Ventas", unread: totals.selling }] : []),
  ];
  // The open conversation names itself, and a page has one heading at the top.
  const Title = threadOpen ? "p" : "h1";
  const besideThread = threadOpen ? "max-lg:hidden" : "";

  return (
    <div className={`${pageContainer} ${threadOpen ? "max-lg:px-0" : "max-lg:py-8"} lg:py-6`}>
      <div
        className={`lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-line lg:bg-surface xl:grid-cols-[13rem_24rem_minmax(0,1fr)] ${INBOX_FRAME_HEIGHT}`}
      >
        <div
          className={`${besideThread} lg:col-start-1 lg:row-start-1 lg:border-r lg:border-line lg:px-4 lg:pt-5 xl:row-span-2 xl:pb-5`}
        >
          <Title className="font-display text-4xl font-semibold tracking-[-0.04em] lg:text-2xl">
            Mensajes
          </Title>

          {entries.length ? (
            <div
              aria-label="Filtrar conversaciones"
              className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0 lg:mt-4 lg:flex-wrap lg:overflow-visible xl:flex-col xl:flex-nowrap xl:gap-1"
              role="group"
            >
              {filters.map((item) => (
                <button
                  aria-pressed={filter === item.id}
                  className="inline-flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-full border border-line px-4 text-sm font-semibold text-muted transition-colors aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white xl:border-transparent"
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  type="button"
                >
                  {item.label}
                  {item.unread > 0 ? (
                    <span
                      aria-label={item.id === "unread" ? `${item.unread} mensajes` : `${item.unread} sin leer`}
                      className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-brand"
                    >
                      {item.unread}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className={`${besideThread} flex min-h-0 flex-col max-lg:mt-5 lg:col-start-1 lg:row-start-2 lg:border-r lg:border-line xl:col-start-2 xl:row-span-2 xl:row-start-1`}
        >
          {entries.length ? (
            <div className="relative lg:m-4 lg:mb-2">
              <label className="sr-only" htmlFor="inbox-search">
                Buscar en tus mensajes
              </label>
              {/* 16px text in the box: anything smaller makes a phone zoom in on focus. */}
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <input
                className="min-h-11 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-ink focus:border-brand focus:outline-none"
                id="inbox-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Persona, tienda o producto"
                type="search"
                value={query}
              />
            </div>
          ) : null}

          {visible.length ? (
            <ul
              aria-label="Conversaciones"
              className="mt-4 min-h-0 flex-1 space-y-1 rounded-[2rem] border border-line bg-surface p-2 lg:mt-0 lg:overflow-y-auto lg:overscroll-contain lg:rounded-none lg:border-0"
            >
              {visible.map((entry) => (
                <InboxRow
                  currentUserId={currentUserId}
                  entry={entry}
                  key={entry.id}
                  now={now}
                  open={entry.id === openId}
                  timeZone={timeZone}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-4 px-4 py-8 text-center text-sm leading-6 text-muted lg:mt-0">
              {entries.length ? "No hay conversaciones aquí." : "Tus conversaciones aparecerán aquí."}
            </p>
          )}
        </div>

        <div
          className={`${threadOpen ? "flex" : "hidden lg:flex"} flex-col bg-surface lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:overflow-hidden xl:col-start-3 ${THREAD_MIN_HEIGHT}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
