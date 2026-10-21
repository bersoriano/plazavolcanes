import { ButtonLink } from "@/components/ui/button";

/**
 * A conversation that is not there, said inside the inbox so the list stays in
 * reach. It reads the same whether the thread never existed or belongs to
 * somebody else.
 */
export default function ThreadNotFound() {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          No encontramos esa conversación
        </h1>
        <p className="mt-2 leading-7 text-muted">Revisa el enlace o ábrela desde tu lista.</p>
        <ButtonLink
          className="mt-5 min-h-11 bg-brand px-5 text-sm text-white"
          href="/mensajes"
        >
          Volver a mensajes
        </ButtonLink>
      </div>
    </div>
  );
}
