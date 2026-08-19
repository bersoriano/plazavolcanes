import Link from "next/link";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-20 text-center"><div className="grid size-16 place-items-center rounded-2xl bg-accent text-brand"><MapPinOff aria-hidden="true" className="size-7" /></div><p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-brand">Ruta sin puesto</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">No encontramos esta publicación</h1><p className="mt-4 leading-7 text-muted">Pudo haberse movido, despublicado o todavía no existe.</p><Link className="mt-7 rounded-full bg-brand px-6 py-3 font-semibold text-white" href="/">Volver a la plaza</Link></section>;
}
