export default function ShopLoading() {
  return <div aria-label="Cargando tienda" className="mx-auto max-w-[1440px] animate-pulse px-5 py-14 sm:px-8 lg:px-12"><div className="h-80 rounded-[2rem] bg-line/50" /><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div className="aspect-[4/3] rounded-[1.4rem] bg-line/50" key={index} />)}</div></div>;
}
