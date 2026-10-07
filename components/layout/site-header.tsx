import Link from "next/link";
import { Scale, UsersRound } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavLink } from "@/components/layout/nav-link";
import { SignedOutHeaderNav } from "@/components/layout/signed-out-header-nav";
import { SiteFrame } from "@/components/layout/site-frame";
import { fetchUnreadCount } from "@/lib/queries/messages.server";
import { getCurrentUserAdminStatus } from "@/lib/admin-auth.server";

/**
 * Below `md` the header carries the brand and the account only: the quick
 * access bar at the foot of the screen owns the destinations, which is what
 * gives `/compras` a link on a phone at all. From `md` up there is room for
 * the full row again and the bar hides itself.
 *
 * The links are the same on every page, signed in or out, and the one for the
 * page being read is marked; a page's own sections belong to the page (see
 * /vender's section bar), never to the header.
 */

/** At md the row is full: the tighter padding is what keeps it inside 768px. */
const SIGNED_IN_LINK =
  "hidden min-h-11 items-center rounded-full px-3 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-background aria-[current=page]:bg-background md:inline-flex lg:px-4";

export async function SiteHeader() {
  const { isAdmin, signedIn } = await getCurrentUserAdminStatus();

  const unread = signedIn ? await fetchUnreadCount() : 0;

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-accent/95 backdrop-blur-lg ${signedIn ? "border-brand/10" : "border-brand/10"}`}
      data-site-header
    >
      <SiteFrame
        className={
          signedIn
            ? "flex h-[76px] items-center justify-between gap-1 sm:gap-5"
            : "flex h-16 items-center justify-between gap-2 sm:gap-5 lg:h-20"
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

        {signedIn ? (
          <div className="flex items-center gap-1 sm:gap-3">
            <nav aria-label="Navegación principal" className="flex items-center gap-1 sm:gap-3">
              <NavLink className={SIGNED_IN_LINK} href="/explorar">
                Explorar
              </NavLink>
              <NavLink className={SIGNED_IN_LINK} href="/panel">
                Mi panel
              </NavLink>
              <NavLink className={SIGNED_IN_LINK} href="/compras">
                Mis compras
              </NavLink>
              <NavLink className={`relative ${SIGNED_IN_LINK}`} href="/mensajes">
                Mensajes
                {unread > 0 ? (
                  <span
                    aria-label={`${unread} mensajes sin leer`}
                    className="ml-2 grid min-w-5 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-white"
                  >
                    {unread}
                  </span>
                ) : null}
              </NavLink>
              {isAdmin ? (
                <>
                  {/*
                    Administration has no slot in the quick access bar, so these
                    stay reachable from the header at every width.
                  */}
                  <NavLink aria-label="Usuarios" className="tap grid place-items-center rounded-full text-sm font-semibold text-brand transition-colors hover:bg-background aria-[current=page]:bg-background md:inline-flex md:min-w-0 md:px-4 md:py-2.5" href="/admin/usuarios">
                    <UsersRound aria-hidden="true" className="size-5 md:hidden" />
                    <span className="hidden md:inline">Usuarios</span>
                  </NavLink>
                  <NavLink aria-label="Disputas" className="tap grid place-items-center rounded-full text-sm font-semibold text-brand transition-colors hover:bg-background aria-[current=page]:bg-background md:inline-flex md:min-w-0 md:px-4 md:py-2.5" href="/admin/disputas">
                    <Scale aria-hidden="true" className="size-5 md:hidden" />
                    <span className="hidden md:inline">Disputas</span>
                  </NavLink>
                </>
              ) : null}
              <SignOutButton />
            </nav>
          </div>
        ) : (
          <SignedOutHeaderNav />
        )}
      </SiteFrame>
    </header>
  );
}
