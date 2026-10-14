import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The way up from a page to the one it was opened from: an order to the order
 * list, a product to its shop. Only for a real parent. The panel's areas are in
 * its bar (see PanelNav), so no page links back to the panel itself.
 */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="tap inline-flex items-center gap-2 text-sm font-semibold text-brand" href={href}>
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}
