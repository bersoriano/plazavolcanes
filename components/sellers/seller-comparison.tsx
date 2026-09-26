import { Accent, Eyebrow, TYPE } from "@/components/home/landing/primitives";

type Platform = { name: string; ours?: boolean };

const PLATFORMS: Platform[] = [
  { name: "Plaza Volcanes", ours: true },
  { name: "Mercado Libre" },
  { name: "Facebook Marketplace" },
  { name: "eBay" },
];

/**
 * One row per question a seller asks, one cell per platform in PLATFORMS
 * order. The other platforms' cells stay general on purpose: their fees vary
 * by category and listing type, and they change. Comparative advertising:
 * every cell is checked against each platform's public policy and reviewed by
 * counsel before launch (docs/launch-package.md).
 */
const ROWS: { label: string; cells: [string, string, string, string] }[] = [
  {
    label: "Comisión",
    cells: ["0% en pago directo", "Cobra por venta, según categoría", "Sin cargo en venta local", "Cobra por venta, según categoría"],
  },
  {
    label: "Retención",
    cells: ["No: el dinero es tuyo al cobrar", "Libera el pago después de la entrega", "No: acuerdan directo", "Paga según su calendario de pagos"],
  },
  {
    label: "Tienda permanente",
    cells: ["Sí, con tu nombre y tu enlace", "Perfil de vendedor", "No: publicaciones sueltas", "Con suscripción"],
  },
  {
    label: "Cómo cobras",
    cells: ["Directo de tu cliente", "A través de Mercado Pago", "Directo de tu cliente", "A través de eBay"],
  },
  {
    label: "Reputación",
    cells: [
      "Nivel propio y tus perfiles de ML y Facebook a la vista",
      "Se queda en Mercado Libre",
      "Calificaciones en tu perfil",
      "Se queda en eBay",
    ],
  },
  {
    label: "Pedido por escrito",
    cells: ["Sí: acuerdos, envío y entrega", "Sí", "Solo el chat", "Sí"],
  },
];

const FOOTNOTE =
  "Resumen general de las condiciones públicas de cada plataforma. Pueden variar por categoría, país y tipo de publicación, y cambiar sin aviso: consulta cada plataforma. Mercado Libre, Facebook Marketplace y eBay son marcas de sus dueños; Plaza Volcanes no está afiliada a ellas.";

/**
 * #compara: Plaza Volcanes beside the three places a seller already uses. A
 * table from md, with our column in lime; on a phone, one card per platform
 * (ours first), since six rows by four columns cannot fit 320px. Only one of
 * the two is displayed at a time, so assistive tech reads it once.
 */
export function SellerComparison() {
  return (
    <section
      aria-labelledby="compara-heading"
      className="scroll-mt-20 px-5 pb-16 pt-4 sm:px-8 lg:scroll-mt-24 lg:pb-20 xl:px-20"
      id="compara"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:gap-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Compara</Eyebrow>
            <h2 className={`${TYPE.h2} text-ink`} id="compara-heading">
              Dónde se queda <Accent>tu dinero.</Accent>
            </h2>
          </div>
          <p className={`${TYPE.aside} lg:max-w-[400px] lg:pb-2`}>
            Sigue vendiendo donde ya vendes. Aquí sumas una tienda propia donde te pagan directo.
          </p>
        </div>

        <div className="hidden overflow-hidden rounded-[28px] border border-line bg-surface md:block">
          <table className="w-full table-fixed border-collapse text-left text-[14px] leading-[1.45] lg:text-[15px]">
            <caption className="sr-only">Plaza Volcanes comparada con Mercado Libre, Facebook Marketplace y eBay</caption>
            <thead>
              <tr>
                <td className="w-[18%] p-4 lg:p-5" />
                {PLATFORMS.map((platform) => (
                  <th
                    className={`p-4 font-display text-[16px] font-semibold tracking-[-0.02em] lg:p-5 lg:text-[18px] ${
                      platform.ours ? "bg-accent text-brand" : "text-ink"
                    }`}
                    key={platform.name}
                    scope="col"
                  >
                    {platform.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr className="border-t border-line" key={row.label}>
                  <th className="p-4 font-semibold text-ink lg:p-5" scope="row">
                    {row.label}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      className={`p-4 lg:p-5 ${PLATFORMS[index].ours ? "bg-lime-tint font-semibold text-brand" : "text-muted"}`}
                      key={PLATFORMS[index].name}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="flex flex-col gap-3 md:hidden">
          {PLATFORMS.map((platform, index) => (
            <li
              className={`rounded-[22px] p-5 ${platform.ours ? "bg-accent text-brand" : "border border-line bg-surface text-ink"}`}
              key={platform.name}
            >
              <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">{platform.name}</h3>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px] leading-[1.45]">
                {ROWS.map((row) => (
                  <div className="contents" key={row.label}>
                    <dt className="font-semibold">{row.label}</dt>
                    <dd className={platform.ours ? "" : "text-muted"}>{row.cells[index]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        <p className="text-[13px] leading-[1.55] text-muted">{FOOTNOTE}</p>
      </div>
    </section>
  );
}
