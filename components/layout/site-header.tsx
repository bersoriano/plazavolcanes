import Link from "next/link";
import { CircleUserRound, LayoutDashboard, MessageCircle } from "lucide-react";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { fetchUnreadCount } from "@/lib/queries/messages.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  let signedIn = false;

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims);
  }

  const unread = signedIn ? await fetchUnreadCount() : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/95 backdrop-blur-lg">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-1 px-3 min-[400px]:gap-5 min-[400px]:px-5 sm:px-8 lg:px-12">
        <Link className="group flex min-h-11 min-w-11 items-center gap-2.5 text-brand" href="/" aria-label="Plaza Volcanes, inicio">
          <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-brand text-accent">
            <VolcanoMark className="absolute left-1/2 top-1/2 w-12 -translate-x-1/2 -translate-y-1/2" />
          </span>
          <span className="hidden font-display text-lg font-bold tracking-[-0.03em] min-[400px]:inline sm:text-xl">Plaza Volcanes</span>
        </Link>

        <nav aria-label="Navegación principal" className="flex items-center gap-1 min-[400px]:gap-2 sm:gap-3">
          {signedIn ? (
            <>
              <Link aria-label="Mi panel" className="grid min-h-11 min-w-11 place-items-center rounded-full text-sm font-semibold text-brand transition-colors hover:bg-background min-[400px]:inline-flex min-[400px]:min-w-0 min-[400px]:px-4 min-[400px]:py-2.5" href="/panel">
                <LayoutDashboard aria-hidden="true" className="size-5 min-[400px]:hidden" />
                <span className="hidden min-[400px]:inline">Mi panel</span>
              </Link>
              <Link className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-background sm:inline-flex" href="/compras">
                Mis compras
              </Link>
              <Link aria-label="Mensajes" className="relative grid min-h-11 min-w-11 place-items-center rounded-full text-sm font-semibold text-brand transition-colors hover:bg-background min-[400px]:inline-flex min-[400px]:min-w-0 min-[400px]:px-4 min-[400px]:py-2.5" href="/mensajes">
                <MessageCircle aria-hidden="true" className="size-5 min-[400px]:hidden" />
                <span className="hidden min-[400px]:inline">Mensajes</span>
                {unread > 0 ? (
                  <span
                    aria-label={`${unread} mensajes sin leer`}
                    className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-white"
                  >
                    {unread}
                  </span>
                ) : null}
              </Link>
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
