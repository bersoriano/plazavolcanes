import { pageContainer } from "@/components/layout/container";

export default function ProductLoading() {
  return <div aria-label="Cargando producto" className={`${pageContainer} grid animate-pulse gap-8 py-14 lg:grid-cols-[1.2fr_.8fr]`}><div className="aspect-[4/3] rounded-[2rem] bg-line/50" /><div className="space-y-5 pt-12"><div className="h-7 w-32 rounded-full bg-line/50" /><div className="h-14 rounded-2xl bg-line/50" /><div className="h-9 w-40 rounded-xl bg-line/50" /></div></div>;
}
