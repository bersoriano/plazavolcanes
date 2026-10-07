"use client";

import { useEffect, useRef, useState } from "react";

type Section = { id: string; label: string };

/** In page order. The founders package is only on the page while the promotion runs. */
const FOUNDERS: Section = { id: "fundadoras", label: "Fundadoras" };
const SECTIONS: Section[] = [
  { id: "beneficios", label: "Beneficios" },
  { id: "compara", label: "Compara" },
  { id: "catalogo", label: "Catálogo" },
  { id: "pasos", label: "Cómo empezar" },
  { id: "niveles", label: "Niveles" },
  { id: "preguntas", label: "Preguntas" },
];

function sectionsFor(promoActive: boolean) {
  return promoActive ? [FOUNDERS, ...SECTIONS] : SECTIONS;
}

/**
 * /vender's own navigation: the page's sections, in a plum bar under the
 * header. The header's links are the plaza's, the same everywhere; these
 * belong to this page alone, which is why they live here and not up there.
 *
 * The bar is the page's one fixed strip. `data-seller-section-nav` is what
 * vender.css looks for to let the header scroll away above it.
 *
 * Below lg the links scroll sideways as one row. The section crossing the
 * middle of the screen is marked as the reader's location, and on a narrow
 * row its link is brought into view (the row returns to its start at the
 * hero); only the row scrolls, never the page.
 */
export function SellerSectionNav({ promoActive }: { promoActive: boolean }) {
  const sections = sectionsFor(promoActive);
  const [active, setActive] = useState<string | null>(null);
  const row = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // Without an observer the links still work; nothing is marked.
    if (typeof IntersectionObserver === "undefined") return;
    const crossing = new Set<string>();
    const ids = sectionsFor(promoActive).map((section) => section.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) crossing.add(id);
          else crossing.delete(id);
        }
        setActive(ids.find((id) => crossing.has(id)) ?? null);
      },
      // A line across the middle of the screen: one section crosses it at a time.
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const id of ids) {
      const target = document.getElementById(id);
      if (target) observer.observe(target);
    }
    return () => observer.disconnect();
  }, [promoActive]);

  useEffect(() => {
    const list = row.current;
    if (!list || list.scrollWidth <= list.clientWidth || typeof list.scrollTo !== "function") return;
    // Centred on the marked link; back at the start once the reader is at the hero.
    const link = active ? list.querySelector<HTMLElement>(`a[href="#${active}"]`) : null;
    const left = link ? link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2 : 0;
    list.scrollTo({ behavior: "smooth", left });
  }, [active]);

  return (
    <nav
      aria-label="Secciones de Vender"
      className="sticky top-0 z-30 border-b border-white/10 bg-brand text-white"
      data-seller-section-nav
      data-surface="dark"
    >
      <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-6 px-2 sm:px-5 lg:px-12 xl:px-20">
        <p className="hidden shrink-0 font-display text-[17px] font-bold tracking-[-0.02em] lg:block">
          Vender en Plaza Volcanes
        </p>
        <ul
          className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] lg:-mr-3 lg:justify-end"
          ref={row}
        >
          {sections.map((section) => (
            <li className="shrink-0" key={section.id}>
              <a
                aria-current={active === section.id ? "location" : undefined}
                className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-[14px] font-semibold text-white/70 transition-colors hover:text-white aria-[current=location]:bg-white/10 aria-[current=location]:text-accent"
                href={`#${section.id}`}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
