import Link from "next/link";

/**
 * A notice that is not there, said inside the inbox so the list stays in reach.
 * It reads the same whether the notice never existed, was retracted, or was
 * sent to somebody else.
 */
export default function NoticeNotFound() {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          No encontramos ese aviso
        </h1>
        <p className="mt-2 leading-7 text-muted">Puede que ya no esté disponible.</p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white"
          href="/mensajes"
        >
          Volver a mensajes
        </Link>
      </div>
    </div>
  );
}
