import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Adorno, Copos, Mono, anclaje } from "@/components/navidad/adornos";
import { ConGorro, SoloEnInicio } from "@/components/navidad/solo-en-inicio";

const season = { on: true };
const route = { pathname: "/" };

vi.mock("@/lib/navidad", () => ({
  get NAVIDAD_ACTIVA() {
    return season.on;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(() => {
  cleanup();
  season.on = true;
  route.pathname = "/";
});

describe("Adorno", () => {
  it("hangs one hidden picture inside a non-interactive overlay", () => {
    const { container } = render(<Adorno className="nv--gorro" src="gorro.svg" />);

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.tagName).toBe("DIV");
    expect(overlay).toHaveClass("nv", "nv--gorro");
    expect(overlay).toHaveAttribute("aria-hidden", "true");

    const img = overlay.querySelector("img");
    expect(img).toHaveAttribute("src", "/navidad/gorro.svg");
    expect(img).toHaveAttribute("alt", "");
    expect(img).not.toHaveAttribute("loading");
  });

  it("waits to load below the fold and renders as a span inside phrasing content", () => {
    const { container } = render(<Adorno as="span" className="nv--nieve" lazy src="nieve.svg" />);

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.tagName).toBe("SPAN");
    expect(overlay.querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("renders nothing out of season", () => {
    season.on = false;
    const { container } = render(<Adorno className="nv--gorro" src="gorro.svg" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("Copos", () => {
  it("scatters faint flakes by percentage", () => {
    const { container } = render(
      <Copos
        copos={[
          { src: "copo-pino.svg", left: "6%", top: "20%", opacity: 0.13 },
          { src: "copo-lima.svg", left: "60%", top: "70%", opacity: 0.22 },
        ]}
      />,
    );

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay).toHaveClass("nv", "nv--copos");
    expect(overlay).toHaveAttribute("aria-hidden", "true");

    const flakes = overlay.querySelectorAll("img");
    expect(flakes).toHaveLength(2);
    expect(flakes[0]).toHaveAttribute("src", "/navidad/copo-pino.svg");
    expect(flakes[0]).toHaveAttribute("alt", "");
    expect(flakes[0]).toHaveStyle({ left: "6%", top: "20%", opacity: "0.13" });
    expect(flakes[1]).toHaveStyle({ left: "60%", top: "70%", opacity: "0.22" });
  });

  it("renders nothing out of season", () => {
    season.on = false;
    const { container } = render(<Copos copos={[{ src: "copo-pino.svg", left: "6%", top: "20%", opacity: 0.13 }]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("anclaje", () => {
  it("adds the anchor class only in season, with its own leading space", () => {
    expect(anclaje()).toBe(" nv-anclaje");
    season.on = false;
    expect(anclaje()).toBe("");
  });
});

describe("Mono", () => {
  it("is a bow that fits inside the link it decorates", () => {
    const { container } = render(<Mono lazy />);

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.tagName).toBe("SPAN");
    expect(overlay).toHaveClass("nv", "nv--mono");
    expect(overlay.querySelector("img")).toHaveAttribute("loading", "lazy");
  });
});

describe("SoloEnInicio", () => {
  it("shows its overlays on the landing only", () => {
    const overlay = <Adorno className="nv--guirnalda" src="guirnalda.svg" />;

    const { container, rerender } = render(<SoloEnInicio>{overlay}</SoloEnInicio>);
    expect(container.querySelector(".nv--guirnalda")).not.toBeNull();

    route.pathname = "/explorar";
    rerender(<SoloEnInicio>{overlay}</SoloEnInicio>);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing out of season", () => {
    season.on = false;
    const { container } = render(
      <SoloEnInicio>
        <span>adorno</span>
      </SoloEnInicio>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ConGorro", () => {
  const mark = <span className="relative grid size-9 overflow-hidden">logo</span>;

  it("puts the hat on the logo mark from outside its clipping box on the landing", () => {
    const { container } = render(<ConGorro>{mark}</ConGorro>);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("SPAN");
    expect(wrapper).toHaveClass("nv-anclaje");
    expect(wrapper.firstElementChild).toHaveClass("overflow-hidden");
    expect(wrapper.lastElementChild).toHaveClass("nv", "nv--gorro");
  });

  it("leaves the mark untouched elsewhere and out of season", () => {
    route.pathname = "/panel";
    const { container, rerender } = render(<ConGorro>{mark}</ConGorro>);
    expect(container.innerHTML).toBe('<span class="relative grid size-9 overflow-hidden">logo</span>');

    route.pathname = "/";
    season.on = false;
    rerender(<ConGorro>{mark}</ConGorro>);
    expect(container.innerHTML).toBe('<span class="relative grid size-9 overflow-hidden">logo</span>');
  });
});
