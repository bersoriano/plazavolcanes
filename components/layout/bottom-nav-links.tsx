"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, LayoutDashboard, MessageCircle, Search, ShoppingBag, Store } from "lucide-react";

const icons = {
  account: CircleUserRound,
  explore: Search,
  messages: MessageCircle,
  orders: ShoppingBag,
  panel: LayoutDashboard,
  sell: Store,
} as const;

export type BottomNavItem = {
  badge?: number;
  href: string;
  icon: keyof typeof icons;
  label: string;
};

/**
 * Marks the destination the reader is already at. `/` would otherwise prefix
 * every route, so the home entry only matches itself.
 *
 * Compared on the path alone: an entry may carry a query string to say where
 * the visit came from, and `usePathname` never returns one, so matching the
 * whole href would quietly stop marking that entry as current.
 */
function isCurrent(pathname: string, href: string) {
  const path = href.split(/[?#]/)[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

export function BottomNavLinks({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();

  return (
    <ul className="flex items-stretch justify-around">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const current = isCurrent(pathname, item.href);

        return (
          <li className="flex-1" key={item.href}>
            <Link
              aria-current={current ? "page" : undefined}
              className={`tap relative flex h-18 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-semibold transition-colors ${
                current ? "text-brand" : "text-muted"
              }`}
              href={item.href}
            >
              <span className="relative">
                <Icon aria-hidden="true" className="size-6" />
                {item.badge ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.625rem] font-semibold leading-4 text-white"
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
              {item.badge ? <span className="sr-only">{item.badge} mensajes sin leer</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
