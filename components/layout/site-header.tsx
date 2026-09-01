import Link from "next/link";
import { CircleUserRound, Scale, UsersRound } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { fetchUnreadCount } from "@/lib/queries/messages.server";
import { getCurrentUserAdminStatus } from "@/lib/admin-auth.server";

/**
 * Below `md` the header carries the brand and the account only: the quick
 * access bar at the foot of the screen owns the destinations, which is what
 * gives `/compras` a link on a phone at all. From `md` up there is room for
 * the full row again and the bar hides itself.
 */
export async function SiteHeader() {
  const { isAdmin, signedIn } = await getCurrentUserAdminStatus();

  const unread = signedIn ? await fetchUnreadCount() : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-brand/10 bg-accent/95 backdrop-blur-lg" data-site-header>
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-1 px-3 sm:gap-5 sm:px-8 lg:px-12">
        <Link className="group flex min-h-11 min-w-11 items-center gap-2.5 text-brand" href="/" aria-label="Plaza Volcanes, inicio">
          <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-brand text-accent">
            <VolcanoMark className="absolute left-1/2 top-1/2 w-12 -translate-x-1/2 -translate-y-1/2" />
          </span>
          <span className="hidden font-display text-lg font-bold tracking-[-0.03em] sm:inline sm:text-xl">Plaza Volcanes</span>
        </Link>

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
              <Link className="hidden min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-background sm:inline-flex" href="/registro">
                Publica tu tienda
              </Link>
              <Link aria-label="Ingresar" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-brand transition-colors hover:border-brand sm:px-4" href="/ingresar">
                <CircleUserRound aria-hidden="true" className="size-5" />
                <span className="hidden sm:inline">Ingresar</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
