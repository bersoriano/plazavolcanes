import { pageContainer } from "@/components/layout/container";

export default function ShopLoading() {
  return (
    <div aria-label="Cargando tienda" className={`${pageContainer} animate-pulse py-4 sm:py-6`}>
      <div className="h-11" />
      <div className="mt-2 aspect-[16/7] rounded-[1.25rem] bg-line/50 sm:aspect-[5/1] sm:rounded-[2rem] lg:aspect-[6/1]" />
      <div className="mt-5 h-9 w-64 max-w-full rounded-full bg-line/50" />
      <div className="mt-3 h-5 w-96 max-w-full rounded-full bg-line/50" />
      <div className="mt-12 grid grid-cols-2 gap-x-3.5 gap-y-7 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="aspect-[4/5] rounded-[1.125rem] bg-line/50 sm:rounded-[1.5rem]" key={index} />
        ))}
      </div>
    </div>
  );
}
