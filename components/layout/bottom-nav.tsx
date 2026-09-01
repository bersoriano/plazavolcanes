import { BottomNavLinks, type BottomNavItem } from "@/components/layout/bottom-nav-links";
import { getCurrentUserAdminStatus } from "@/lib/admin-auth.server";
import { fetchUnreadCount } from "@/lib/queries/messages.server";

/**
 * The phone's navigation. The header can only hold a couple of controls at
 * 320px, which used to leave `/compras` with no link at all below the small
 * breakpoint; the bar carries the destinations instead, and the header keeps
 * the brand and the account. Above `md` the header has the room again and the
 * bar steps aside.
 */
export async function BottomNav() {
  const { signedIn } = await getCurrentUserAdminStatus();
  const unread = signedIn ? await fetchUnreadCount() : 0;

  const items: BottomNavItem[] = signedIn
    ? [
        { href: "/", icon: "explore", label: "Explorar" },
        { badge: unread, href: "/mensajes", icon: "messages", label: "Mensajes" },
        { href: "/compras", icon: "orders", label: "Compras" },
        { href: "/panel", icon: "panel", label: "Panel" },
      ]
    : [
        { href: "/", icon: "explore", label: "Explorar" },
        { href: "/vender", icon: "sell", label: "Vender" },
        { href: "/ingresar", icon: "account", label: "Ingresar" },
      ];

  return (
    <nav
      aria-label="Navegación rápida"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      data-bottom-nav="true"
    >
      <BottomNavLinks items={items} />
    </nav>
  );
}
