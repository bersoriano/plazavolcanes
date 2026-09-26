"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { FOUNDERS_CAP, resolveFoundersProgress } from "@/lib/launch";

/**
 * The phone's sticky invitation on /vender: once the hero's CTA has scrolled
 * away, a dark pill with the spots left and "Crear mi tienda" rides above the
 * quick access bar, and it leaves for good the moment the closing call comes
 * into view (so it never sits over the footer either).
 *
 * The page renders it only for somebody who could still open a founding
 * store (signed out, or signed in without one) while the promotion is open.
 * It starts hidden, so the server HTML never flashes it; hidden, it is out of
 * the tab order and the accessibility tree.
 */
export function StickyCta({ href, spotsTaken }: { href: string; spotsTaken: number | null }) {
  const [heroGone, setHeroGone] = useState(false);
  const [finalReached, setFinalReached] = useState(false);
  const progress = resolveFoundersProgress(spotsTaken);

  useEffect(() => {
    // Without an observer the page still has its own CTAs; the bar stays away.
    if (typeof IntersectionObserver === "undefined") return;
    const hero = document.querySelector("[data-hero-cta]");
    const final = document.querySelector("[data-final-cta]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        // Above the viewport counts as passed; below it, as not reached yet.
        const passed = entry.boundingClientRect.top < 0;
        if (entry.target === hero) setHeroGone(!entry.isIntersecting && passed);
        if (entry.target === final) setFinalReached(entry.isIntersecting || passed);
      }
    });
    if (hero) observer.observe(hero);
    if (final) observer.observe(final);
    return () => observer.disconnect();
  }, []);

  const shown = heroGone && !finalReached;

  return (
    <aside
      aria-label="Tiendas fundadoras"
      className="fixed inset-x-0 bottom-[calc(4.5rem+1px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-background/90 px-3 py-3 backdrop-blur-md md:hidden"
      data-sticky-cta
      hidden={!shown}
    >
      <div className="flex h-[68px] items-center justify-between gap-3 rounded-full bg-ink pl-[18px] pr-2 text-white shadow-[0_16px_36px_-12px_rgb(0_0_0/0.6)]">
        <p className="flex min-w-0 flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">Tiendas fundadoras</span>
          <span className="truncate text-[14px] font-semibold">
            {progress ? (
              <>
                Quedan <span className="tabular-nums">{progress.left}</span> lugares
              </>
            ) : (
              `Primeras ${FOUNDERS_CAP} tiendas`
            )}
          </span>
        </p>
        <Link
          className="flex h-[52px] shrink-0 items-center gap-1.5 rounded-full bg-accent px-5 text-[15px] font-bold text-brand"
          href={href}
        >
          Crear mi tienda
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2.4} />
        </Link>
      </div>
    </aside>
  );
}
