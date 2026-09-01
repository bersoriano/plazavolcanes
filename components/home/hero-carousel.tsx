"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Sparkles, Store } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";

type Slide = {
  badge: string;
  icon: typeof Sparkles;
  title: string;
  body: string;
  image?: string;
};

const SLIDES: Slide[] = [
  {
    badge: "Gratis para las primeras tiendas",
    icon: Sparkles,
    title: "Bienvenido: crea tu tienda y sube lo que quieras vender.",
    body: "Es gratis para los primeros usuarios de Plaza Volcanes. Abre tu tienda, publica tus productos y empieza a recibir pedidos.",
    image: "/hero2.jpg",
  },
  {
    badge: "Hecho cerca. Encontrado aquí.",
    icon: MapPin,
    title: "Encuentra productos únicos cerca de ti.",
    body: "Explora artículos nuevos y usados, revisa quién vende y acuerda pago y entrega directamente con cada tienda.",
    image: "/hero1.jpg",
  },
  {
    badge: "Tu tienda, tu reputación",
    icon: Store,
    title: "Construye la reputación de tu tienda y vende a todo México.",
    body: "Cada venta cumplida suma a tu historial. Gana la confianza de quien compra y llega a clientes de cualquier estado.",
  },
];

/**
 * Manual-only hero carousel: nothing advances without a click or an arrow key.
 * Every slide stays mounted so the track can slide, but the inactive ones are
 * hidden from assistive tech and from the tab order.
 */
export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const go = (next: number) => setIndex((next + SLIDES.length) % SLIDES.length);

  return (
    <div
      aria-label="Novedades de Plaza Volcanes"
      aria-roledescription="carrusel"
      className="relative overflow-hidden bg-brand"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(index + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(index - 1);
        }
      }}
      role="region"
    >
      <div
        className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {SLIDES.map((slide, slideIndex) => {
          const active = slideIndex === index;
          const Icon = slide.icon;

          return (
            <div
              aria-hidden={active ? undefined : "true"}
              aria-roledescription="diapositiva"
              className="relative min-h-[440px] w-full shrink-0 sm:min-h-[480px]"
              inert={active ? undefined : true}
              key={slide.title}
              role="group"
            >
              {slide.image ? (
                <>
                  {/* The photographs are full-body cut-outs on white: cropping
                      them to fill the slide takes the subject's head off. */}
                  <div aria-hidden="true" className="absolute inset-0 bg-surface" />
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="object-contain object-center"
                    fetchPriority={slideIndex === 0 ? "high" : "auto"}
                    fill
                    loading={slideIndex === 0 ? "eager" : "lazy"}
                    sizes="(max-width: 1440px) 100vw, 1440px"
                    src={slide.image}
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-surface/45" />
                </>
              ) : (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-br from-brand via-brand-hover to-brand"
                  />
                  <VolcanoMark
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-24 left-1/2 w-[760px] max-w-none -translate-x-1/2 text-accent/15"
                  />
                </>
              )}
              <div className="relative z-10 flex min-h-[440px] flex-col items-center justify-center px-6 py-14 text-center sm:min-h-[480px] sm:px-20">
                <div
                  className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                    slide.image ? "bg-accent text-brand-hover" : "bg-accent/20 text-accent"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {slide.badge}
                </div>
                <h1
                  className={`max-w-4xl font-display text-[2rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl ${
                    slide.image ? "text-brand" : "text-white"
                  }`}
                >
                  {slide.title}
                </h1>
                <p
                  className={`mt-6 max-w-2xl text-base leading-7 sm:text-lg ${
                    slide.image ? "text-muted" : "text-white/80"
                  }`}
                >
                  {slide.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <button
        aria-label="Anterior"
        className="absolute left-2 top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-brand transition-colors hover:border-brand sm:left-4"
        onClick={() => go(index - 1)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <button
        aria-label="Siguiente"
        className="absolute right-2 top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-brand transition-colors hover:border-brand sm:right-4"
        onClick={() => go(index + 1)}
        type="button"
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>

      <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center gap-3">
        {SLIDES.map((slide, slideIndex) => (
          <button
            aria-current={slideIndex === index ? "true" : undefined}
            aria-label={`Ir a la diapositiva ${slideIndex + 1}`}
            className={`tap-halo size-3 rounded-full border border-brand/40 transition-colors ${
              slideIndex === index ? "bg-brand" : "bg-surface/70 hover:bg-surface"
            }`}
            key={slide.title}
            onClick={() => setIndex(slideIndex)}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
