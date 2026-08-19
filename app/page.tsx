import Link from "next/link";
import { ArrowRight, Sparkles, Store } from "lucide-react";

import { ProductGrid } from "@/components/catalog/product-grid";
import { SearchBar } from "@/components/catalog/search-bar";
import { VolcanoMark } from "@/components/brand/volcano-mark";
import { EmptyState } from "@/components/ui/empty-state";

export default function Home() {
  return (
    <>
      <section className="overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-14 sm:px-8 sm:pb-14 sm:pt-20 lg:px-12">
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-brand-hover">
              <Sparkles aria-hidden="true" className="size-4" />
              Hecho cerca. Encontrado aquí.
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-brand sm:text-6xl lg:text-7xl">
              Una plaza llena de cosas que no encuentras en cualquier lugar.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Explora productos de tiendas independientes y descubre quién está detrás de cada pieza.
            </p>
            <div className="relative z-10 mx-auto mt-9 max-w-2xl">
              <SearchBar />
            </div>
            <VolcanoMark className="pointer-events-none absolute -bottom-24 left-1/2 w-[760px] max-w-none -translate-x-1/2 text-brand/8" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand">Recién publicados</p>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">Descubrimientos de la plaza</h2>
          </div>
          <div aria-label="Filtros de productos" className="flex flex-wrap gap-2">
            <span className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-brand-hover">Todos</span>
            <span className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted">Más recientes</span>
            <span className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted">Tiendas</span>
          </div>
        </div>

        <ProductGrid>
          <EmptyState
            icon={<Store aria-hidden="true" className="size-7" />}
            title="Aún no hay productos publicados"
            description="Abre la primera tienda de la plaza y comparte lo que haces."
            action={
              <Link className="inline-flex items-center gap-2 font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4" href="/registro">
                Crear una tienda
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
          />
        </ProductGrid>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand px-7 py-10 text-white sm:px-12 sm:py-12">
          <VolcanoMark className="absolute -bottom-14 right-0 w-[520px] text-accent/20" />
          <div className="relative max-w-xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">Tu espacio en la plaza</p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">Tu tienda puede estar abierta hoy.</h2>
            <p className="mt-4 max-w-lg leading-7 text-white/75">Crea tu escaparate, publica tus productos y deja que nuevas personas te encuentren.</p>
            <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-brand-hover transition-transform hover:-translate-y-0.5" href="/registro">
              Comenzar
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
