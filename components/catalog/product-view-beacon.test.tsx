import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,describe,expect,it,vi } from "vitest";
import { ProductViewBeacon } from "@/components/catalog/product-view-beacon";
const mocks=vi.hoisted(()=>({record:vi.fn().mockResolvedValue(true)}));
vi.mock("@/lib/actions/product-activity",()=>({recordProductActivity:mocks.record}));
afterEach(()=>{cleanup();sessionStorage.clear();vi.clearAllMocks();});
describe("product telemetry boundaries",()=>{
  it("counts explicit CTA interactions but never quantity inputs or unrelated forms",async()=>{
    render(<><ProductViewBeacon productId={73}/><section data-product-analytics="73">
      <form data-product-cta="purchase" onSubmit={e=>e.preventDefault()}><input aria-label="Cantidad"/><button type="submit">Comprar</button></form>
      <a data-product-cta="question" href="#" onClick={e=>e.preventDefault()}>Preguntar</a>
      <button data-product-cta="share">Compartir</button>
    </section><form data-product-cta="purchase" onSubmit={e=>e.preventDefault()} aria-label="Ajeno"/></>);
    await waitFor(()=>expect(mocks.record).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByLabelText("Cantidad"));
    fireEvent.submit(screen.getByRole("form",{name:"Ajeno"}));
    expect(mocks.record).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Preguntar"));
    fireEvent.click(screen.getByText("Compartir"));
    fireEvent.click(screen.getByText("Comprar"));
    await waitFor(()=>expect(mocks.record).toHaveBeenCalledTimes(4));
    expect(mocks.record.mock.calls.map(c=>c.slice(0,2))).toEqual([[73,"view"],[73,"question"],[73,"share"],[73,"purchase"]]);
  });
});
