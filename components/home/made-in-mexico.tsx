import { StatementBand } from "@/components/home/statement-band";

/** The home page's closing statement, just above the purple footer. */
export function MadeInMexico() {
  return (
    <StatementBand headingId="mexicana-heading">
      Plaza Volcanes es una plataforma <em className="italic text-brand">100% Mexicana 🇲🇽.</em>
    </StatementBand>
  );
}
