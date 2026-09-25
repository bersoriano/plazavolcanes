import { StatementBand } from "@/components/home/statement-band";

/** The seller promise, stated before the catalogue opens. */
export function NoFeesStatement({ className }: { className?: string }) {
  return (
    <StatementBand className={className} headingId="sin-comisiones-heading">
      Sin retenciones <em className="italic text-brand">Ni Comisiones</em>
    </StatementBand>
  );
}
