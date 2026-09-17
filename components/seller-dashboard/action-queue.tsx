import Link from "next/link";
import { ChevronRight, HandCoins, MessageCircle, PackageCheck, ShoppingBag } from "lucide-react";

import { attentionTiming, type AttentionGroup, type AttentionItem, type SellerDashboard } from "@/lib/seller-dashboard";

function describe(item: AttentionItem) {
  if (item.kind === "purchase_request") return { icon: ShoppingBag, label: "Solicitud", cta: "Revisar" };
  if (item.kind === "buyer_waiting") return { icon: MessageCircle, label: "Mensaje", cta: "Responder" };
  if (item.step === "confirm_payment") return { icon: HandCoins, label: "Pago", cta: "Ver pedido" };
  // A collected order is handed over, never shipped.
  return { icon: PackageCheck, label: item.step === "ship" ? "Envío" : "Entrega", cta: "Ver pedido" };
}

const URGENCY_STYLES = {
  overdue: "bg-sale/15 text-sale",
  due_soon: "bg-accent text-brand",
  none: "",
} as const;

function pendingCount(count: number) {
  return `${count} ${count === 1 ? "pendiente" : "pendientes"}`;
}

/**
 * Everything waiting on the seller, grouped by what it needs.
 *
 * The order inside comes from the dashboard: passed and close deadlines on
 * top, then decisions, replies, payments and hand-overs. Deadlines appear only
 * where the database keeps one, and nothing is sent anywhere, so the seller is
 * told to come back here rather than to wait for a notice.
 */
export function ActionQueue({
  groups,
  now,
  total,
  unavailable,
}: {
  groups: AttentionGroup[];
  now: Date;
  total: number;
  unavailable: SellerDashboard["unavailable"];
}) {
  const deadlinesMissing = unavailable.deadlines && groups.some((group) => group.id === "reply");

  return (
    <section aria-labelledby="attention-title" className="rounded-[2rem] border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]" id="attention-title">
          Requiere tu atención
        </h2>
        {total ? <span className="rounded-full bg-sale/15 px-3 py-1 text-xs font-bold text-sale">{pendingCount(total)}</span> : null}
      </div>

      {unavailable.attention || deadlinesMissing ? (
        <p className="mt-4 rounded-2xl bg-background p-4 text-sm leading-6 text-muted" role="status">
          {unavailable.attention ? (
            <>
              No pudimos revisar todos tus mensajes y pedidos, así que esta lista puede estar incompleta. Revisa{" "}
              <Link className="font-semibold text-brand underline underline-offset-4" href="/mensajes">Mensajes</Link> y{" "}
              <Link className="font-semibold text-brand underline underline-offset-4" href="/panel/pedidos">Pedidos</Link> o recarga el panel.{" "}
            </>
          ) : null}
          {deadlinesMissing ? "No pudimos revisar los plazos de respuesta, así que los mensajes aparecen sin su plazo de 24 h." : null}
        </p>
      ) : null}

      {!total && !unavailable.attention ? <p className="mt-4 text-sm text-muted">Nada pendiente por ahora.</p> : null}

      {groups.map((group) => (
        <section aria-labelledby={`attention-${group.id}`} className="mt-5" key={group.id}>
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink" id={`attention-${group.id}`}>
            {group.title}
            <span className="sr-only">,</span>{" "}
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-brand">{pendingCount(group.items.length)}</span>
          </h3>
          <ul className="mt-1 divide-y divide-line">
            {group.items.map((item) => {
              const { icon: Icon, label, cta } = describe(item);
              const timing = attentionTiming(item, now);
              return (
                <li key={item.id}>
                  <Link className="group flex items-center gap-4 py-4" href={item.href}>
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-brand">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                        {label} · {item.shop.name}
                      </span>
                      <span className="mt-0.5 block truncate font-semibold text-ink">{item.title}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        <time dateTime={item.since}>{timing.waiting}</time>
                      </span>
                      {timing.deadline && item.dueAt ? (
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          {timing.urgencyLabel ? (
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${URGENCY_STYLES[item.urgency]}`}>
                              {timing.urgencyLabel}
                            </span>
                          ) : null}
                          <time className={item.urgency === "overdue" ? "font-semibold text-sale" : "text-muted"} dateTime={item.dueAt}>
                            {timing.deadline}
                          </time>
                        </span>
                      ) : null}
                    </span>
                    <span className="hidden text-sm font-semibold text-brand sm:inline">{cta}</span>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="mt-5 text-xs leading-5 text-muted">
        Aún no enviamos avisos por correo ni notificaciones. Revisa esta lista cuando entres a tu panel.
      </p>
    </section>
  );
}
