import { cleanup,render,screen } from "@testing-library/react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { sellerAnalyticsFixture } from "@/tests/fixtures/seller-analytics";
const mocks=vi.hoisted(()=>({get:vi.fn(),signedIn:vi.fn().mockResolvedValue("seller")}));
vi.mock("@/lib/queries/seller-analytics.server",()=>({getSellerAnalytics:mocks.get}));
vi.mock("@/lib/require-signed-in.server",()=>({requireSignedIn:mocks.signedIn}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND");}}));
import Page from "@/app/panel/estadisticas/page";
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
describe("seller analytics section",()=>{
  it("shows every seller shop/date filters without a founders gate",async()=>{
    mocks.get.mockResolvedValue({status:"ready",report:sellerAnalyticsFixture()});
    render(await Page({searchParams:Promise.resolve({dias:"7",tienda:"1"})}));
    expect(mocks.signedIn).toHaveBeenCalledWith("/panel/estadisticas");
    expect(screen.getByRole("combobox",{name:"Tienda"})).toHaveValue("1");
    expect(screen.getByRole("combobox",{name:"Periodo"})).toHaveValue("7");
    expect(screen.getByRole("heading",{name:"Estadísticas"})).toBeInTheDocument();
  });
  it("does not show another seller's data",async()=>{
    mocks.get.mockResolvedValue({status:"invalid_shop"});
    await expect(Page({searchParams:Promise.resolve({tienda:"2"})})).rejects.toThrow("NOT_FOUND");
  });
  it("distinguishes unavailable statistics from no visits",async()=>{
    mocks.get.mockResolvedValue({status:"error"});render(await Page({searchParams:Promise.resolve({})}));
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tus estadísticas");
    expect(screen.queryByText("0%")).toBeNull();
  });
  it("invites sellers without shops to create one",async()=>{
    const report=sellerAnalyticsFixture();report.shops=[];mocks.get.mockResolvedValue({status:"ready",report});
    render(await Page({searchParams:Promise.resolve({})}));
    expect(screen.getByRole("link",{name:"Crear mi tienda"})).toHaveAttribute("href","/panel/tiendas/nueva");
  });
});
