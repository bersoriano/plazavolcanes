import Link from "next/link";
import { ArrowRight, Scale, UsersRound } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { HeaderMenu, type HeaderMenuLink } from "@/components/layout/header-menu";
import { fetchUnreadCount } from "@/lib/queries/messages.server";
import { getCurrentUserAdminStatus } from "@/lib/admin-auth.server";

/**
 * Below `md` the header carries the brand and the account only: the quick
 * access bar at the foot of the screen owns the destinations, which is what
 * gives `/compras` a link on a phone at all. From `md` up there is room for
 * the full row again and the bar hides itself.
 *
 * Signed out, the header follows the seller-first landing: the home page's
 * sections in the middle from xl, a sheet with the same links below it, and
 * a way in for would-be sellers at every width. The section links are rooted
 * at "/" so they lead home from any other page.
 */
const SECTION_LINKS: HeaderMenuLink[] = [
  { href: "/#explorar", label: "Explorar" },
  { href: "/#tiendas", label: "Tiendas" },
  { href: "/#pasos", label: "Cómo funciona" },
  { href: "/#vender", label: "Para vender" },
];

export async function SiteHeader() {
  const { isAdmin, signedIn } = await getCurrentUserAdminStatus();

  const unread = signedIn ? await fetchUnreadCount() : 0;

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-accent/95 backdrop-blur-lg ${signedIn ? "border-brand/10" : "border-brand/10"}`}
      data-site-header
    >
      <div
        className={
          signedIn
            ? "mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-1 px-3 sm:gap-5 sm:px-8 lg:px-12"
            : "mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 pl-5 pr-4 sm:gap-5 sm:px-8 lg:h-20 lg:px-12 xl:px-20"
        }
      >
        {signedIn ? (
          <Link className="group flex min-h-11 min-w-11 items-center gap-2.5 text-brand" href="/" aria-label="Plaza Volcanes, inicio">
            <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-brand text-accent">
              <VolcanoMark className="absolute left-1/2 top-1/2 w-12 -translate-x-1/2 -translate-y-1/2" />
            </span>
            <span className="hidden font-display text-lg font-bold tracking-[-0.03em] sm:inline sm:text-xl">Plaza Volcanes</span>
          </Link>
        ) : (
          <Link className="group flex min-h-11 min-w-11 items-center gap-2.5 text-ink lg:gap-3" href="/" aria-label="Plaza Volcanes, inicio">
            <span className="relative grid size-9 place-items-center overflow-hidden rounded-[10px] bg-brand text-accent lg:size-[42px] lg:rounded-xl">
              <VolcanoMark className="absolute left-1/2 top-1/2 w-12 -translate-x-1/2 -translate-y-1/2 lg:w-14" />
            </span>
            <span className="whitespace-nowrap font-display text-[19px] font-bold tracking-[-0.02em] lg:text-[22px]">Plaza Volcanes</span>
          </Link>
        )}

        {signedIn ? null : (
          <nav aria-label="Secciones de la plaza" className="hidden items-center gap-1 xl:flex 2xl:gap-4">
            {SECTION_LINKS.map((link) => (
              <Link
                className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-[15px] font-semibold text-brand transition-colors hover:bg-background"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1 sm:gap-3">
          <nav aria-label="Navegación principal" className="flex items-center gap-1 sm:gap-3">
            {signedIn ? (
              <>
                <Link className="hidden min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-background md:inline-flex" href="/panel">
                  Mi panel
                </Link>
                <Link className="hidden min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-background md:inline-flex" href="/compras">
                  Mis compras
                </Link>
                <Link className="relative hidden min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-background md:inline-flex" href="/mensajes">
                  Mensajes
                  {unread > 0 ? (
                    <span
                      aria-label={`${unread} mensajes sin leer`}
                      className="ml-2 grid min-w-5 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-white"
                    >
                      {unread}
                    </span>
                  ) : null}
                </Link>
                {isAdmin ? (
                  <>
                    {/*
                      Administration has no slot in the quick access bar, so these
                      stay reachable from the header at every width.
                    */}
                    <Link aria-label="Usuarios" className="tap grid place-items-center rounded-full text-sm font-semibold text-brand transition-colors hover:bg-background md:inline-flex md:min-w-0 md:px-4 md:py-2.5" href="/admin/usuarios">
                      <UsersRound aria-hidden="true" className="size-5 md:hidden" />
                      <span className="hidden md:inline">Usuarios</span>
                    </Link>
                    <Link aria-label="Disputas" className="tap grid place-items-center rounded-full text-sm font-semibold text-brand transition-colors hover:bg-background md:inline-flex md:min-w-0 md:px-4 md:py-2.5" href="/admin/disputas">
                      <Scale aria-hidden="true" className="size-5 md:hidden" />
                      <span className="hidden md:inline">Disputas</span>
                    </Link>
                  </>
                ) : null}
                <SignOutButton />
              </>
            ) : (
              <>
                {/* A phone reaches Ingresar from the quick access bar and the sheet. */}
                <Link aria-label="Ingresar" className="hidden min-h-11 items-center rounded-full px-4 text-[15px] font-semibold text-brand transition-colors hover:bg-background sm:inline-flex lg:px-5" href="/ingresar">
                  Ingresar
                </Link>
                <Link className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover sm:hidden" href="/vender?desde=header">
                  Vender
                </Link>
                <Link className="hidden h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover sm:inline-flex" href="/vender?desde=header">
                  Abrir mi tienda
                  <ArrowRight aria-hidden="true" className="size-[18px] text-accent" strokeWidth={2.2} />
                </Link>
              </>
            )}
          </nav>
          {signedIn ? null : <HeaderMenu links={[...SECTION_LINKS, { href: "/ingresar", label: "Ingresar" }]} />}
        </div>
      </div>
    </header>
  );
}
