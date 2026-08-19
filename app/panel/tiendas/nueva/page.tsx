import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ShopForm } from "@/components/shops/shop-form";
import { createShop } from "@/lib/actions/shops";

export default function NewShopPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/panel"><ArrowLeft aria-hidden="true" className="size-4" />Mis tiendas</Link>
      <div className="mt-7 rounded-[2rem] border border-line bg-surface p-6 sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Nuevo escaparate</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Crea tu tienda</h1><p className="mb-8 mt-3 leading-7 text-muted">Empieza con una historia clara. Podrás agregar productos enseguida.</p>
        <ShopForm action={createShop} />
      </div>
    </section>
  );
}
