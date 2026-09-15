import Link from "next/link";
import { ChevronRight, MessageCircle, PackageCheck, ShoppingBag } from "lucide-react";

import { formatWaiting, type AttentionItem } from "@/lib/seller-dashboard";

const KIND = {
  purchase_request: { icon: ShoppingBag, label: "Solicitud de compra", cta: "Revisar" },
  buyer_waiting: { icon: MessageCircle, label: "Comprador esperando", cta: "Responder" },
  fulfill_order: { icon: PackageCheck, label: "Pedido aceptado", cta: "Ver pedido" },
} as const;

function timing(item: AttentionItem, now: Date) {
  if (item.kind === "fulfill_order") {
    if (item.step === "confirm_payment") return "Confirma el pago para continuar";
    if (item.dueAt) {
      const due = new Date(item.dueAt);
      return due.getTime() < now.getTime()
        ? "La fecha de envío ya pasó"
        : `Entrega antes del ${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }).format(due)}`;
    }
    return `Aceptado ${formatWaiting(item.since, now)}`;
  }
  return item.kind === "buyer_waiting"
    ? `Escribió ${formatWaiting(item.since, now)}`
    : `Recibida ${formatWaiting(item.since, now)}`;
}

/**
 * Everything a buyer is waiting on, above any setup advice.
 *
 * Only work lives here: an order that ended, or a thread where the seller had
 * the last word, never shows up, however many unread messages it carries.
 */
export function AttentionList({
  items,
  now,
  unavailable,
}: {
  items: AttentionItem[];
  now: Date;
  unavailable: boolean;
}) {
  if (!items.length && !unavailable) return null;

  return (
    <section aria-labelledby="attention-title" className="rounded-[2rem] border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]" id="attention-title">
          Requiere tu atención
        </h2>
        {items.length ? (
          <span className="rounded-full bg-sale/15 px-3 py-1 text-xs font-bold text-sale">
            {items.length} {items.length === 1 ? "pendiente" : "pendientes"}
          </span>
        ) : null}
      </div>

      {unavailable ? (
        <p className="mt-4 rounded-2xl bg-background p-4 text-sm leading-6 text-muted" role="status">
          No pudimos revisar todos tus mensajes y pedidos, así que esta lista puede estar incompleta. Revisa{" "}
          <Link className="font-semibold text-brand underline underline-offset-4" href="/mensajes">Mensajes</Link> y{" "}
          <Link className="font-semibold text-brand underline underline-offset-4" href="/panel/pedidos">Pedidos</Link>{" "}
          o recarga el panel.
        </p>
      ) : null}

      {items.length ? (
        <ul className="mt-4 divide-y divide-line">
          {items.map((item) => {
            const kind = KIND[item.kind];
            const Icon = kind.icon;
            return (
              <li key={item.id}>
                <Link className="group flex items-center gap-4 py-4" href={item.href}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-brand">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                      {kind.label} · {item.shop.name}
                    </span>
                    <span className="mt-0.5 block truncate font-semibold text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      <time dateTime={item.kind === "fulfill_order" && item.dueAt ? item.dueAt : item.since}>{timing(item, now)}</time>
                    </span>
                  </span>
                  <span className="hidden text-sm font-semibold text-brand sm:inline">{kind.cta}</span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
