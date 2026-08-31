import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";

import type { Shop } from "@/lib/database.types";

export function ShopCard({ shop }: { shop: Shop & { imageUrl: string | null } }) {
  return (
    <Link className="group overflow-hidden rounded-[1.5rem] border border-line bg-surface" href={`/panel/tiendas/${shop.id}`}>
      <div className="aspect-[16/9] overflow-hidden bg-background">
        {shop.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" src={shop.imageUrl} />
        ) : <div className="grid size-full place-items-center text-brand/35"><Store aria-hidden="true" className="size-9" /></div>}
      </div>
      <div className="flex items-start justify-between gap-4 p-5">
        <div><h2 className="font-display text-xl font-semibold tracking-[-0.02em]">{shop.name}</h2><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{shop.description}</p></div>
        <ArrowUpRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
