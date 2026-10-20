import type { SellerAnalytics } from "@/lib/seller-analytics";

const dayLabel = (day: string) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/** Both series use the same count axis. The table provides exact daily values. */
export function ActivityChart({ daily }: { daily: SellerAnalytics["daily"] }) {
  const max = Math.max(2, Math.ceil(Math.max(0, ...daily.map((day) => Math.max(day.views, day.interests))) / 2) * 2);
  const points = (key: "views" | "interests") => daily.map((day, index) =>
    `${index / Math.max(1, daily.length - 1) * 720},${160 - day[key] / max * 160}`,
  ).join(" ");
  return <section aria-labelledby="activity-chart-title" className="rounded-[2rem] border border-line bg-surface p-5 sm:p-8">
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-display text-2xl font-semibold text-ink" id="activity-chart-title">Cómo cambia el interés</h2>
      <p className="flex gap-4 text-xs text-muted"><span>● Visitas</span><span className="text-success">● Sesiones con interés</span></p>
    </div>
    <div className="mt-6 grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-2">
      <div aria-label="Escala de visitas" className="flex h-52 flex-col justify-between text-right text-xs tabular-nums text-muted">
        {[max, max / 2, 0].map((value) => <span key={value}>{value}</span>)}
      </div>
    <svg aria-label="Visitas e interés por día, misma escala" className="h-52 w-full overflow-visible py-1 text-brand" preserveAspectRatio="none" role="img" viewBox="0 0 720 160">
      <title>Visitas e interés por día</title>
      <desc>Las cifras exactas están en la tabla de datos diarios debajo de la gráfica.</desc>
      {[0, 0.5, 1].map((fraction) => <g key={fraction}>
        <line stroke="var(--border)" vectorEffect="non-scaling-stroke" x1="0" x2="720" y1={160 - fraction * 160} y2={160 - fraction * 160} />
      </g>)}
      <polyline fill="none" points={points("views")} stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      <polyline fill="none" points={points("interests")} stroke="var(--success)" strokeDasharray="5 4" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
      {daily.length ? <div className="col-start-2 flex justify-between text-xs text-muted">
        <span>{dayLabel(daily[0].day)}</span><span>{dayLabel(daily[daily.length - 1].day)}</span>
      </div> : null}
    </div>
    <details className="mt-4 text-sm text-muted">
      <summary className="w-fit cursor-pointer py-2 font-semibold text-brand">Ver datos diarios</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line">
        <table aria-label="Datos diarios" className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-background"><tr><th className="p-3" scope="col">Fecha</th><th scope="col">Visitas</th><th scope="col">Sesiones con interés</th><th className="pr-3" scope="col">Solicitudes</th></tr></thead>
          <tbody>{daily.map((day) => <tr className="border-t border-line" key={day.day}><th className="p-3 font-normal" scope="row">{dayLabel(day.day)}</th><td>{day.views}</td><td>{day.interests}</td><td>{day.orders}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
