import type { Metadata } from "next";
import Link from "next/link";

import { BroadcastForm } from "@/components/admin/broadcast-form";
import { NoticeHistory } from "@/components/admin/notice-history";
import { pageContainer } from "@/components/layout/container";
import { requireAdmin } from "@/lib/admin-auth.server";
import { getNoticeAudienceCounts, listNoticeBatches } from "@/lib/queries/platform-notices.server";

export const metadata: Metadata = { title: "Avisos y anuncios" };

/**
 * Where administration writes to an audience, and where everything it has sent
 * is kept. A notice to one person is written from that person's card instead.
 */
export default async function AdminNoticesPage() {
  await requireAdmin();
  const [counts, batches] = await Promise.all([getNoticeAudienceCounts(), listNoticeBatches()]);

  return (
    <section className={`${pageContainer} py-10 sm:py-14`}>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Administración</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Avisos y anuncios</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        Lo que envíes llega a la bandeja de mensajes de cada persona, firmado por Plaza Volcanes y
        sin opción de responder. Para escribirle a una sola persona, usa su tarjeta en{" "}
        <Link
          className="tap inline-flex items-center font-semibold text-brand underline underline-offset-4"
          href="/admin/usuarios"
        >
          Usuarios
        </Link>
        .
      </p>

      <div className="mt-8 max-w-3xl">
        <BroadcastForm counts={counts} />
      </div>

      <section aria-labelledby="sent-notices" className="mt-12 max-w-3xl">
        <h2 className="font-display text-2xl font-semibold" id="sent-notices">
          Enviados
        </h2>
        <div className="mt-4">
          <NoticeHistory batches={batches} />
        </div>
      </section>
    </section>
  );
}
