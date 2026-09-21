import { ImageIcon, Plus, Search } from "lucide-react";

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

const ROW_COLUMNS = "grid-cols-[minmax(0,1fr)_150px_96px_56px]";

/** A painted switch, not a control: the preview is a picture of the panel. */
function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative block h-6 w-[42px] shrink-0 rounded-full ${on ? "bg-success" : "bg-line"}`}
    >
      <span
        className={`absolute top-[3px] size-[18px] rounded-full bg-surface ${on ? "right-[3px]" : "left-[3px]"}`}
      />
    </span>
  );
}

function Thumbnail({ size }: { size: "sm" | "md" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[0.625rem] bg-photo-backdrop text-muted/70 ${size === "sm" ? "size-10" : "size-[42px]"}`}
    >
      <ImageIcon className={size === "sm" ? "size-[17px]" : "size-[18px]"} strokeWidth={1.6} />
    </span>
  );
}

function Tabs({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "flex gap-1.5 px-4 py-2.5" : "flex gap-2 px-[22px] py-3.5"}>
      {TABS.map((tab, index) => (
        <span
          className={`flex items-center rounded-full font-semibold ${
            compact ? "h-7 px-[11px] text-[12px]" : "h-[30px] px-3 text-[13px]"
          } ${index === 0 ? "bg-brand text-white" : "bg-photo-backdrop/60 text-brand"}`}
          key={tab}
        >
          {tab}
        </span>
      ))}
    </div>
  );
}

export function CatalogPreview() {
  return (
    <>
      <p className="sr-only">{CATALOG_SUMMARY}</p>

      <div
        aria-hidden="true"
        className="mt-1.5 overflow-hidden rounded-[1.125rem] border border-brand-hover/10 bg-surface text-ink shadow-[0_28px_56px_-30px_rgba(36,16,53,0.5)] lg:mt-0 lg:rounded-[1.25rem] lg:shadow-[0_32px_64px_-32px_rgba(36,16,53,0.5)]"
      >
        {/* Phone header: the whole toolbar collapses into one add button. */}
        <div className="flex items-center justify-between border-b border-line/60 py-3 pl-4 pr-3 lg:hidden">
          <span className="flex flex-col gap-px">
            <span className="font-display text-[17px] font-bold">Mi catálogo</span>
            <span className="text-[12px] text-muted">{PRODUCTS.length} productos</span>
          </span>
          <span className="grid size-11 place-items-center rounded-full bg-brand text-white">
            <Plus className="size-5" strokeWidth={2.4} />
          </span>
        </div>

        <div className="hidden items-center justify-between gap-3 border-b border-line/60 px-[22px] py-[18px] lg:flex">
          <span className="flex items-baseline gap-2.5">
            <span className="font-display text-[19px] font-bold">Mi catálogo</span>
            <span className="text-[13px] text-muted">{PRODUCTS.length} productos</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="flex h-[38px] w-[170px] items-center gap-2 rounded-full border border-line bg-background px-3.5 text-[13px] text-muted">
              <Search className="size-4" strokeWidth={2} />
              Buscar
            </span>
            <span className="flex h-[38px] items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-bold text-white">
              <Plus className="size-4" strokeWidth={2.4} />
              Agregar producto
            </span>
          </span>
        </div>

        <div className="lg:hidden">
          <Tabs compact />
        </div>
        <div className="hidden lg:block">
          <Tabs />
        </div>

        <div
          className={`hidden gap-3 border-t border-line/60 bg-background px-[22px] py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted lg:grid ${ROW_COLUMNS}`}
        >
          <span>Producto</span>
          <span>Estado</span>
          <span>Precio</span>
          <span>Visible</span>
        </div>

        {PRODUCTS.map((product) => (
          <div key={product.name}>
            <div className="flex items-center gap-3 border-t border-line/60 px-4 py-2.5 lg:hidden">
              <Thumbnail size="sm" />
              <span className="flex min-w-0 grow flex-col gap-px">
                <span className="truncate text-[14px] font-bold">{product.name}</span>
                <span className="text-[12px] text-muted tabular-nums">
                  {product.price} · {product.shortState}
                </span>
              </span>
              <Switch on={product.visible} />
            </div>

            <div
              className={`hidden items-center gap-3 border-t border-line/60 px-[22px] py-3 lg:grid ${ROW_COLUMNS}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Thumbnail size="md" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-bold">{product.name}</span>
                  <span className="text-[12px] text-muted">{product.category}</span>
                </span>
              </span>
              <span className="justify-self-start whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-1 text-[12px] font-semibold">
                {product.state}
              </span>
              <span
                className={`text-[14px] font-bold tabular-nums ${product.visible ? "" : "text-muted"}`}
              >
                {product.price}
              </span>
              <Switch on={product.visible} />
            </div>
          </div>
        ))}

        {/* The mockup's last row carries 4px more bottom padding than the rest. */}
        <div className="h-1" />
      </div>
    </>
  );
}
