import type { PublishedLegalDocument } from "@/lib/queries/legal.server";

const dateFormat = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

const identityLabelMap: Record<string, string> = {
  entityName: "Razón social",
  rfc: "RFC",
  address: "Domicilio",
  email: "Correo electrónico",
  phone: "Teléfono",
  attentionHours: "Horario de atención",
  privacyContact: "Contacto de datos personales",
};

export function LegalDocument({ document }: { document: PublishedLegalDocument }) {
  const identity = document.issuerIdentity;
  const hasIdentity = identity && Object.keys(identity).length > 0;

  return (
    <article className="mx-auto max-w-[68ch]">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink">
        {document.title}
      </h1>
      <p className="mt-3 text-sm text-muted">
        Vigente desde el {formatDate(document.effectiveAt)}.
      </p>

      {document.sections.map((section) => (
        <section className="mt-10" key={section.id}>
          <h2
            className="scroll-mt-24 font-display text-2xl font-semibold text-ink"
            id={`seccion-${section.id}`}
          >
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph, index) => (
            <p className="mt-4 leading-7 text-ink" key={`${section.id}-${index}`}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {hasIdentity ? (
        <section className="mt-12 rounded-[1.5rem] border border-line bg-surface p-6">
          <h2 className="font-display text-xl font-semibold" id="responsable-identidad">
            Responsable de este documento
          </h2>
          <dl className="mt-4 grid gap-2 text-sm leading-6 text-muted">
            {Object.entries(identityLabelMap)
              .filter(([key]) => key in identity)
              .map(([key, label]) => (
                <div className="flex flex-wrap gap-x-2" key={key}>
                  <dt className="font-semibold text-ink">{label}:</dt>
                  <dd>{identity[key as keyof typeof identity]}</dd>
                </div>
              ))
              .concat(
                Object.entries(identity)
                  .filter(([key]) => !(key in identityLabelMap))
                  .map(([key, value]) => (
                    <div className="flex flex-wrap gap-x-2" key={key}>
                      <dt className="font-semibold text-ink">{key}:</dt>
                      <dd>{value}</dd>
                    </div>
                  )),
              )}
          </dl>
        </section>
      ) : null}

      {/* The hash covers the section body and issuer identity, not this
          rendered title — see publish_legal_version. */}
      <p className="mt-10 border-t border-line pt-5 text-xs leading-5 text-muted">
        Versión {document.version} · publicada el {formatDate(document.publishedAt)} ·
        huella de contenido {document.contentHash}
      </p>
    </article>
  );
}
