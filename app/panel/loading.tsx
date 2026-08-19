export default function PanelLoading() {
  return <div aria-label="Cargando panel" className="mx-auto grid max-w-[1200px] animate-pulse gap-5 px-5 py-20 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div className="h-72 rounded-[1.5rem] bg-line/50" key={index} />)}</div>;
}
