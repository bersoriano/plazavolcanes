import { Plus, Search } from "lucide-react";

/**
 * Four real listings from the marketplace, frozen here as an illustration.
 *
 * `state` uses the catalog's own vocabulary — a product is Publicado or
 * Borrador — so nobody learns a status from this picture that the panel will
 * not show them later.
 */
const PRODUCTS = [
  {
    name: "Micrófono Rode",
    category: "Audio y video",
    state: "Usado · Buen estado",
    shortState: "Usado",
    price: "$1,999.00",
    visible: true,
  },
  {
    name: "Reloj Citizen Eco Drive",
    category: "Joyería y relojes",
    state: "Usado · Buen estado",
    shortState: "Usado",
    price: "$1,899.00",
    visible: true,
  },
  {
    name: "Apple iPhone 13 Pro (128 GB)",
    category: "Celulares y accesorios",
    state: "Usado · Buen estado",
    shortState: "Usado",
    price: "$8,499.00",
    visible: true,
  },
  {
    name: "Motorola Razr Foldable 5G",
    category: "Celulares y accesorios",
    state: "Borrador",
    shortState: "Borrador",
    price: "$4,999.00",
    visible: false,
  },
];

const TABS = ["Todos", "Publicados", "Borradores"];

const CATALOG_SUMMARY =
  "Ejemplo del panel: cuatro productos con su categoría, precio y estado; tres publicados y uno guardado como borrador.";

const ROW_COLUMNS = "grid-cols-[2.2fr_1.3fr_1fr_60px]";

/** A painted switch, not a control: the preview is a picture of the panel. */
function Switch({ on }: { on: boolean }) {
  return (
    <span className={`relative block h-6 w-10 shrink-0 rounded-full ${on ? "bg-success" : "bg-line"}`}>
      <span className={`absolute top-[3px] size-[18px] rounded-full bg-surface ${on ? "right-[3px]" : "left-[3px]"}`} />
    </span>
  );
}

function StateChip({ state, draft }: { state: string; draft: boolean }) {
  return (
    <span
      className={`flex h-[26px] items-center justify-self-start whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold ${
        draft ? "bg-photo-backdrop text-muted" : "bg-lime-tint text-brand"
      }`}
    >
      {state}
    </span>
  );
}

/**
 * The seller panel's catalogue, drawn: a white card tilted 1°, with its
 * toolbar, tabs and a table of four frozen listings. Nothing in it is a
 * control, and all of it is aria-hidden; the summary above says what it
 * shows. A phone gets a stacked header and two-line rows.
 */
export function CatalogPreview() {
  return (
    <>
      <p className="sr-only">{CATALOG_SUMMARY}</p>

      <div
        aria-hidden="true"
        className="flex rotate-1 flex-col gap-4 rounded-[22px] bg-surface p-4 text-ink shadow-[0_40px_70px_-34px_rgb(50_23_77/0.6)] sm:p-[26px] lg:rounded-[28px]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2.5">
            <span className="whitespace-nowrap font-display text-[20px] font-semibold sm:text-[24px]">Mi catálogo</span>
            <span className="whitespace-nowrap text-[13px] text-muted sm:text-[14px]">{PRODUCTS.length} productos</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="hidden h-10 w-[170px] items-center gap-2 rounded-full border border-line bg-background px-3.5 text-[14px] text-muted lg:flex">
              <Search className="size-4" strokeWidth={2} />
              Buscar
            </span>
            <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-4 text-[13px] font-bold text-white sm:text-[14px]">
              <Plus className="size-4" strokeWidth={2.4} />
              Agregar producto
            </span>
          </span>
        </div>

        <div className="flex gap-2 text-[13px] font-semibold">
          {TABS.map((tab, index) => (
            <span
              className={`flex h-8 items-center rounded-full px-3.5 ${index === 0 ? "bg-brand text-white" : "bg-photo-backdrop/60 text-ink"}`}
              key={tab}
            >
              {tab}
            </span>
          ))}
        </div>

        <div>
          <div
            className={`hidden gap-2.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted sm:grid ${ROW_COLUMNS}`}
          >
            <span>Producto</span>
            <span>Estado</span>
            <span>Precio</span>
            <span>Visible</span>
          </div>

          {PRODUCTS.map((product) => (
            <div key={product.name}>
              <div className={`hidden items-center gap-2.5 border-t border-hairline px-2 py-3.5 text-[15px] sm:grid ${ROW_COLUMNS}`}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-bold">{product.name}</span>
                  <span className="text-[12px] text-muted">{product.category}</span>
                </span>
                <StateChip draft={!product.visible} state={product.state} />
                <span className={`font-bold tabular-nums ${product.visible ? "" : "text-muted"}`}>{product.price}</span>
                <Switch on={product.visible} />
              </div>

              <div className="flex items-center gap-3 border-t border-hairline py-3 sm:hidden">
                <span className="flex min-w-0 grow flex-col gap-1">
                  <span className="truncate text-[14px] font-bold">{product.name}</span>
                  <span className="text-[12px] text-muted">{product.category}</span>
                  <span className="flex items-center gap-2">
                    <StateChip draft={!product.visible} state={product.state} />
                    <span className="text-[13px] font-bold tabular-nums">{product.price}</span>
                  </span>
                </span>
                <Switch on={product.visible} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
