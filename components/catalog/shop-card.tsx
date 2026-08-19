import Link from "next/link";
import { ArrowUpRight, MapPin, Store } from "lucide-react";

import type { CatalogShop } from "@/lib/queries/catalog.server";
import { formatShopLocation } from "@/lib/shop-location";

export function PublicShopCard({ shop }: { shop: CatalogShop }) {
  return (
    <Link className="group min-w-[260px] flex-1 overflow-hidden rounded-[1.5rem] border border-line bg-surface" href={`/tiendas/${shop.slug}`}>
      <div className="aspect-[16/10] overflow-hidden bg-[#eee8e1]">
        {shop.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" src={shop.imageUrl} />
        ) : <div className="grid size-full place-items-center text-brand/35"><Store aria-hidden="true" className="size-9" /></div>}
      </div>
      <div className="flex items-start justify-between gap-4 p-5"><div><h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{shop.name}</h3><p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted"><MapPin aria-hidden="true" className="size-3.5" />{formatShopLocation(shop.country_code, shop.administrative_area_code)}</p><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{shop.description}</p></div><ArrowUpRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
    </Link>
  );
}
