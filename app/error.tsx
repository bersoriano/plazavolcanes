"use client";

import { RotateCw } from "lucide-react";

import { pageContainer } from "@/components/layout/container";

/**
 * The public pages' last line of defence. A catalogue read that fails throws
 * rather than passing for an empty plaza, and lands here: the honest answer is
 * that the plaza could not load, with the one useful move.
 */
export default function PlazaError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className={`${pageContainer} py-16`} role="alert">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Plaza Volcanes</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">No pudimos cargar la plaza</h1>
      <p className="mt-3 leading-7 text-muted">Las tiendas y sus productos siguen ahí. Vuelve a intentarlo en un momento.</p>
      <button
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-on-brand"
        onClick={() => retry()}
        type="button"
      >
        <RotateCw aria-hidden="true" className="size-4" />
        Reintentar
      </button>
    </section>
  );
}
