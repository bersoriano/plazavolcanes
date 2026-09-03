"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CatalogJumpLink } from "@/components/catalog/catalog-jump-link";

type Message = {
  /** Small uppercase line above the headline. */
  kicker: string;
  /** The headline, split so the closing phrase can carry the only colour in it. */
  headline: [lead: string, emphasis: string];
  deck: string;
};

const MESSAGES: Message[] = [
  {
    kicker: "Hecho cerca. Encontrado aquí.",
    headline: ["Encuentra productos únicos ", "cerca de ti."],
    deck: "Explora artículos nuevos y usados, revisa quién vende y acuerda pago y entrega directamente con cada tienda.",
  },
  {
    kicker: "Bienvenido",
    headline: ["Crea tu tienda y sube ", "lo que quieras vender."],
    deck: "Es gratis para los primeros usuarios de Plaza Volcanes. Abre tu tienda, publica tus productos y empieza a recibir pedidos.",
  },
  {
    kicker: "Tu tienda, tu reputación",
    headline: ["Construye tu reputación y vende ", "a todo México."],
    deck: "Cada venta cumplida suma a tu historial. Gana la confianza de quien compra y llega a clientes de cualquier estado.",
  },
];

const ROTATION_MS = 7_000;

/** The three collage slots, waiting on real photography. */
const SLOTS = [
  { key: "puesto", className: "col-span-2 aspect-[16/10]" },
  { key: "producto", className: "aspect-square" },
  { key: "vendedora", className: "aspect-square" },
];

/**
 * The empty state of a photo slot: a hairline hatch on paper, so a missing
 * photograph reads as a reserved frame rather than as a hole in the layout.
 */
const HATCH = {
  backgroundColor: "#f2ece6",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(50,23,77,0.08) 0 2px, transparent 2px 12px)",
};

/** One soft wash of accent behind the top-right corner. Nothing louder. */
const WASH = {
  background:
    "radial-gradient(58% 52% at 84% 6%, rgba(184,255,106,0.26) 0%, rgba(184,255,106,0.10) 42%, transparent 72%)",
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** `matchMedia` is missing under jsdom; its absence reads as no preference. */
function motionQuery() {
  return typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION) : null;
}

function subscribeToMotionPreference(onChange: () => void) {
  const query = motionQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/**
 * Reports the reader's motion preference, and keeps reporting it if they change
 * it mid-visit. The server cannot know it, so the first paint assumes motion is
 * welcome and the client corrects it before the first rotation is due.
 */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => motionQuery()?.matches ?? false,
    () => false,
  );
}

/**
 * The home hero: one message at a time on the left, a collage of the plaza on
 * the right. The two columns are one intrinsic grid — they stack on their own
 * when the viewport can no longer hold two 400px tracks, with no breakpoint.
 */
export function HomeHero() {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // A reader who asked for less motion gets the first message and no rotation.
    if (reducedMotion) return;

    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % MESSAGES.length),
      ROTATION_MS,
    );
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const message = MESSAGES[index];

  return (
    <section
      aria-label="Novedades de Plaza Volcanes"
      className="relative overflow-hidden border-b border-line bg-background px-10 pb-[72px] pt-16"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={WASH} />

      <div className="relative mx-auto grid max-w-[1240px] items-center gap-16 [grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))]">
        <div>
          <p className="mb-[30px] inline-flex items-center gap-2 rounded-full border border-[#c9b3dd] bg-[rgba(184,255,106,0.16)] py-[6px] pl-[9px] pr-[14px] text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-hover">
            <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-accent" />
            Gratis para las primeras tiendas
          </p>

          {/* The message swaps in place: one kicker, one heading, one deck. It
              is not announced as it changes — a heading re-read every seven
              seconds interrupts far more than it informs. */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              {message.kicker}
            </p>
            <h1 className="mt-3 text-pretty font-display text-[clamp(2.5rem,8.5vw,70px)] font-normal leading-[1] tracking-[-0.02em] text-ink">
              {message.headline[0]}
              <em className="italic text-brand">{message.headline[1]}</em>
            </h1>
            <p className="mt-5 max-w-[30em] text-[18px] leading-[1.55] text-muted">
              {message.deck}
            </p>
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <CatalogJumpLink className="rounded-full bg-brand px-[26px] py-[15px] font-semibold text-[#fbf8f4] transition-colors hover:bg-brand-hover">
              Explorar productos
            </CatalogJumpLink>
            <Link
              className="rounded-full border border-line px-[26px] py-[15px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
              href="/registro"
            >
              Abrir mi tienda
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-3">
            {MESSAGES.map((item, itemIndex) => (
              <button
                aria-current={itemIndex === index ? "true" : undefined}
                aria-label={`Ver mensaje ${itemIndex + 1}`}
                className={`tap-halo h-[9px] rounded-full [transition:width_.35s_ease,background-color_.35s_ease] ${
                  itemIndex === index ? "w-[30px] bg-brand" : "w-[9px] bg-line"
                }`}
                key={item.kicker}
                onClick={() => setIndex(itemIndex)}
                type="button"
              />
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="grid grid-cols-2 gap-[14px]">
          {SLOTS.map((slot) => (
            <div
              className={`rounded-[3px] border border-line ${slot.className}`}
              key={slot.key}
              style={HATCH}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
