import Link from "next/link";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { interestRate, metricChange, type SellerAnalytics } from "@/lib/seller-analytics";

const number = new Intl.NumberFormat("es-MX");

export function SellerAnalyticsReport({ report }: { report: SellerAnalytics }) {
  const { current, previous } = report;
  const rate = interestRate(current);
  const beforeRate = interestRate(previous);
  const cards = [
    { label: "Visitas a productos", value: number.format(current.views), change: metricChange(current.views, previous.views) },
    { label: "Interés por visita", value: rate === null ? "Sin datos" : `${number.format(rate)}%`, change: beforeRate === null ? "Sin base anterior" : `Periodo anterior: ${number.format(beforeRate)}%` },
    { label: "Preguntas recibidas", value: number.format(current.questions), change: metricChange(current.questions, previous.questions) },
    { label: "Solicitudes creadas", value: number.format(current.orders), change: metricChange(current.orders, previous.orders) },
  ];
  const products = [...report.products].sort((a, b) => b.current.views - a.current.views || a.name.localeCompare(b.name, "es"));
  const quiet = products.filter((product) => product.status === "published" && product.current.tracked_views >= 10 &&
    product.current.interests === 0 && product.current.questions === 0 && product.current.orders === 0).slice(0, 5);
  const started = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" }).format(new Date(report.tracking_started_at));
  return <div className="space-y-6">
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => <div className="rounded-2xl border border-line bg-surface p-5" key={card.label}>
        <dt className="text-sm font-medium text-muted">{card.label}</dt>
        <dd className="mt-3 font-display text-4xl font-semibold tabular-nums text-ink">{card.value}</dd>
        <dd className="mt-2 text-xs text-muted">{card.change}</dd>
      </div>)}
    </dl>
    <p className="text-sm leading-6 text-muted">Un clic no confirma una pregunta, un pedido ni un pago. Las preguntas son conversaciones nuevas y las solicitudes son pedidos guardados; cada pedido cuenta una vez en el resumen.</p>
    {current.views === 0 && current.questions === 0 && current.orders === 0 ? <div className="rounded-2xl bg-accent/30 p-5">
      <h2 className="font-display text-xl font-semibold text-brand">Tus primeras señales empiezan aquí</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Comparte tus productos para recibir las primeras visitas. Si aún no publicas, completa tu catálogo.</p>
      <Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4" href="/panel/tiendas">Ir a mis tiendas</Link>
    </div> : null}
    <ActivityChart daily={report.daily} trackingStartedAt={report.tracking_started_at} />
    {quiet.length ? <section className="rounded-2xl border border-brand/20 bg-accent/20 p-5 sm:p-6" aria-labelledby="quiet-products-title">
      <h2 className="font-display text-xl font-semibold text-brand" id="quiet-products-title">Productos para revisar</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Reciben visitas, pero todavía no generan preguntas ni intención de compra. Revisa foto, precio y descripción.</p>
      <ul className="mt-3 flex flex-wrap gap-3">{quiet.map((product) => <li key={product.id}><Link className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm font-semibold text-brand underline underline-offset-4" href={`/panel/productos/${product.id}/editar`}>{product.name}</Link></li>)}</ul>
      <p className="mt-3 text-xs text-muted">Se muestra desde 10 visitas medidas con el nuevo contador; es una señal para investigar.</p>
    </section> : null}
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface" aria-labelledby="products-activity-title">
      <div className="px-5 py-6 sm:px-8"><h2 className="font-display text-2xl font-semibold text-ink" id="products-activity-title">Actividad por producto</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Ordenados por visitas. Cada interacción cuenta una vez por tipo, producto y sesión de 30 minutos. En móvil, desliza la tabla.</p>
      </div>
      <div className="overflow-x-auto">
        <table aria-label="Actividad por producto" className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-y border-line bg-background text-xs text-muted"><tr>{["Producto", "Visitas", "Preguntar", "Solicitar compra", "Compartir", "Preguntas", "Solicitudes", "Interés"].map((label) => <th className="px-4 py-3 font-semibold first:pl-5 sm:first:pl-8" key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{products.map((product) => {
            const rate = interestRate(product.current);
            return <tr key={product.id}>
              <th className="min-w-52 px-5 py-4 font-medium sm:pl-8" scope="row">
                {product.status === "deleted" ? <span>{product.name} (retirado)</span> : <Link className="text-brand underline underline-offset-4" href={`/panel/productos/${product.id}/editar`}>{product.name}</Link>}
                <span className="mt-1 block text-xs font-normal text-muted">{product.shop_name}</span>
              </th>
              {[product.current.views, product.current.question_clicks, product.current.purchase_clicks, product.current.share_clicks, product.current.questions, product.current.orders].map((value, index) => <td className="px-4 py-4 tabular-nums" key={index}>{number.format(value)}</td>)}
              <td className="px-4 py-4 tabular-nums">{rate === null ? "—" : `${number.format(rate)}%`}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!products.length ? <p className="px-5 py-6 text-sm text-muted sm:px-8">No hay productos en esta selección.</p> : null}
    </section>
    <aside className="text-xs leading-6 text-muted">
      <p>Interés = sesiones con clic en Preguntar o Solicitar compra ÷ visitas medidas con el nuevo contador. Compartir se informa por separado. No son visitantes únicos.</p>
      <p>Actividad de botones disponible desde el {started}. Las visitas anteriores se conservan; no se reconstruyen clics históricos. Se excluye la actividad de quien administra la tienda cuando tiene sesión iniciada. Las cifras pueden verse afectadas por bloqueo de scripts o manipulación del navegador.</p>
      <p>Fechas en Ciudad de México. El periodo actual incluye hoy, todavía incompleto.</p>
    </aside>
  </div>;
}
