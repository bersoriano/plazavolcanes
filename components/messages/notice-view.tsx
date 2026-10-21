"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

import { STICK_UNDER_HEADER } from "@/components/messages/inbox-layout";
import { ButtonLink } from "@/components/ui/button";
import { markPlatformNoticeRead } from "@/lib/actions/platform-notices";
import { formatMessageDay, formatMessageTime } from "@/lib/format";
import { PLATFORM_SENDER } from "@/lib/queries/messages";
import type { PlatformNotice } from "@/lib/queries/platform-notices";
import { useViewerTimeZone } from "@/lib/use-viewer-time-zone";

/**
 * A message from the plaza, open in the inbox. It is read, never answered, so
 * there is no box to write in: the foot of it says where to turn instead.
 *
 * The message is shown as the plain text it is. Nothing in it becomes a link;
 * the only way out is the notice's own button, which can only lead inside the
 * site.
 */
export function NoticeView({
  notice,
  now,
}: {
  notice: PlatformNotice;
  /** When the server rendered, so "Hoy" and "Ayer" are decided once. */
  now: string;
}) {
  const router = useRouter();
  const timeZone = useViewerTimeZone();
  const unread = notice.read_at === null;

  // Opening it reads it, from an effect and not from the render: a render is a
  // GET, and a GET must not write. The refresh clears the row and the badge.
  useEffect(() => {
    if (!unread) return;

    void (async () => {
      await markPlatformNoticeRead(notice.id);
      router.refresh();
    })();
  }, [notice.id, unread, router]);

  return (
    <>
      <header
        className={`${STICK_UNDER_HEADER} shrink-0 border-b border-line bg-surface px-4 py-3 sm:px-6`}
      >
        <div className="flex items-center gap-1">
          <Link
            aria-label="Volver a mensajes"
            className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-brand transition-colors hover:bg-background lg:hidden"
            href="/mensajes"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>

          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold tracking-[-0.02em]">
              {PLATFORM_SENDER}
            </h1>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {notice.kind === "announcement" ? "Anuncio" : "Aviso"}
            </p>
          </div>
        </div>
      </header>

      <article className="flex-1 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:overscroll-contain">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">{notice.title}</h2>
        <p className="mt-1 text-sm text-muted">
          <time dateTime={notice.created_at}>
            {formatMessageDay(notice.created_at, now, timeZone)} ·{" "}
            {formatMessageTime(notice.created_at, timeZone)}
          </time>
        </p>

        <p className="mt-5 max-w-prose whitespace-pre-wrap break-words leading-7 text-ink">
          {notice.body}
        </p>

        {notice.action ? (
          <ButtonLink
            className="mt-6 min-h-11 bg-brand px-5 text-sm text-white"
            href={notice.action.href}
          >
            {notice.action.label}
          </ButtonLink>
        ) : null}

        <p className="mt-8 max-w-prose border-t border-line pt-4 text-sm leading-6 text-muted">
          Este mensaje es de {PLATFORM_SENDER} y no admite respuesta. ¿Necesitas ayuda?{" "}
          <Link
            className="tap inline-flex items-center font-semibold text-brand underline underline-offset-4"
            href="/quejas-y-aclaraciones"
          >
            Quejas y aclaraciones
          </Link>
        </p>
      </article>
    </>
  );
}
