import { describe, expect, it } from "vitest";

import { IMPORT_MAX_LINKS, parseImportLinks } from "@/lib/listing-import";

describe("parseImportLinks", () => {
  it("keeps one trimmed link per line, without blanks or repeats", () => {
    expect(
      parseImportLinks(" https://articulo.mercadolibre.com.mx/MLM-1 \n\nhttps://www.facebook.com/marketplace/item/2\r\nhttps://articulo.mercadolibre.com.mx/MLM-1"),
    ).toEqual({
      links: ["https://articulo.mercadolibre.com.mx/MLM-1", "https://www.facebook.com/marketplace/item/2"],
    });
  });

  it("refuses text that is not a link, an empty paste and too many links", () => {
    expect(parseImportLinks("mi tienda en mercado libre")).toEqual({
      error: "Cada línea debe ser un enlace que empiece con https://.",
    });
    expect(parseImportLinks("  \n ")).toEqual({ error: "Pega al menos un enlace." });
    expect(
      parseImportLinks(Array.from({ length: IMPORT_MAX_LINKS + 1 }, (_, index) => `https://a.example/${index}`).join("\n")),
    ).toEqual({ error: "Pega hasta 50 enlaces por solicitud." });
  });
});
