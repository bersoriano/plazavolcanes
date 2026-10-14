import type { Metadata } from "next";
import Link from "next/link";

import { ContactMessages } from "@/components/admin/contact-messages";
import { pageContainer } from "@/components/layout/container";
import { requireAdmin } from "@/lib/admin-auth.server";
import { listContactMessages } from "@/lib/queries/contact.server";

export const metadata: Metadata = { title: "Contacto" };

/** What people have written to the plaza, and whether it has been answered. */
export default async function AdminContactPage() {
  await requireAdmin();
  const messages = await listContactMessages();

  return (
    <section className={`${pageContainer} py-10 sm:py-14`}>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Administración</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Contacto</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        Lo que llega desde{" "}
        <Link
          className="tap inline-flex items-center font-semibold text-brand underline underline-offset-4"
          href="/quejas-y-aclaraciones"
        >
          Quejas y aclaraciones
        </Link>
        . Responde por correo o por teléfono y márcalo como atendido.
      </p>

      <div className="mt-8 max-w-3xl">
        <ContactMessages messages={messages} />
      </div>
    </section>
  );
}
