import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import type { OngoingTask } from "@/lib/seller-dashboard";

/**
 * What replaces the first-sale guide once a buyer has confirmed an order:
 * the upkeep that keeps a shop selling, each task named with its shop.
 */
export function OngoingTasks({ tasks }: { tasks: OngoingTask[] }) {
  return (
    <section aria-labelledby="ongoing-title" className="rounded-[2rem] border border-line bg-surface p-5 sm:p-7">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Sigue vendiendo</p>
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]" id="ongoing-title">
        Mantén tus tiendas al día
      </h2>

      {tasks.length ? (
        <ul className="mt-4 divide-y divide-line">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link className="group flex items-center gap-4 py-4" href={task.action.href}>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-brand">{task.shop.name}</span>
                  <span className="mt-0.5 block font-semibold text-ink">{task.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{task.detail}</span>
                </span>
                <span className="hidden text-sm font-semibold text-brand sm:inline">{task.action.label}</span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          No encontramos pendientes en tus tiendas.
        </p>
      )}
    </section>
  );
}
