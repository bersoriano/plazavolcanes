"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { pageContainer } from "@/components/layout/container";
import { isCurrent } from "@/components/layout/nav-link";

type Section = { href: string; label: string; covers: string[] };

const SECTIONS: Section[] = [
  // Itself and nothing below: every panel route starts with /panel, so a
  // prefix here would mark the summary on all of them.
  { href: "/panel", label: "Resumen", covers: [] },
  { href: "/panel/pedidos", label: "Pedidos", covers: ["/panel/pedidos"] },
  // A product's editor lives outside its shop's path, but it is reached from
  // the shop's catalogue and returns to it.
  { href: "/panel/tiendas", label: "Tiendas", covers: ["/panel/tiendas", "/panel/productos"] },
  { href: "/panel/cuenta", label: "Cuenta", covers: ["/panel/cuenta"] },
];

function isOpen(pathname: string, section: Section) {
  return pathname === section.href || section.covers.some((path) => isCurrent(pathname, path));
}

/**
 * The panel's own navigation: its areas, in a band under the header, on every
 * panel route. The header's links are the plaza's; these belong to the panel,
 * and a page under it keeps only the link to its real parent.
 *
 * The panel's layout draws this once and does not render again on navigation,
 * which is why the links are fixed and the mark is worked out here, from the
 * path. A band rather than tabs or pills: a shop's workspace has underlined
 * tabs and the catalogue has pill filters, and both sit right below it.
 *
 * On a phone the row scrolls sideways if it runs out of room; only the row
 * moves, never the page.
 */
export function PanelNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Secciones del panel" className="border-b border-line bg-surface">
      <div className={`${pageContainer} overflow-x-auto [scrollbar-width:none]`}>
        {/* Pulled left by a link's padding, so the first label sits over the
            page's edge and the mark overhangs it. */}
        <ul className="-ml-3 flex w-max gap-1 py-1">
          {SECTIONS.map((section) => (
            <li key={section.href}>
              <Link
                aria-current={isOpen(pathname, section) ? "page" : undefined}
                className="tap inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-semibold text-muted transition-colors hover:text-brand aria-[current=page]:bg-accent aria-[current=page]:text-brand"
                href={section.href}
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
