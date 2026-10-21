import { pageContainer } from "@/components/layout/container";
import { ShopForm } from "@/components/shops/shop-form";
import { Card } from "@/components/ui/card";
import { createShop } from "@/lib/actions/shops";

export default function NewShopPage() {
  return (
    <section className={`${pageContainer} py-10 sm:py-14`}>
      <Card padding="md" className="sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Nuevo escaparate</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Crea tu tienda</h1><p className="mb-8 mt-3 leading-7 text-muted">Empieza con una historia clara. Podrás agregar productos enseguida.</p>
        <ShopForm action={createShop} />
      </Card>
    </section>
  );
}
