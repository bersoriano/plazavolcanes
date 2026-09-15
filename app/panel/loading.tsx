/** Same shape as the dashboard, so nothing jumps when it arrives: next step first. */
export default function PanelLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando panel" className="mx-auto max-w-[1200px] animate-pulse px-5 py-8 sm:px-8 sm:py-12" role="status">
      <div className="h-4 w-24 rounded-full bg-line/60" />
      <div className="mt-3 h-10 w-64 max-w-full rounded-2xl bg-line/60" />
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <div className="h-52 rounded-[2rem] bg-brand/15" />
          <div className="h-72 rounded-[2rem] bg-line/50" />
        </div>
        <div className="h-96 rounded-[2rem] bg-line/50" />
      </div>
    </div>
  );
}
