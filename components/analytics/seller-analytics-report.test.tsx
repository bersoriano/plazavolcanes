import { cleanup,render,screen,within } from "@testing-library/react";
import { afterEach,describe,expect,it } from "vitest";
import { SellerAnalyticsReport } from "@/components/analytics/seller-analytics-report";
import { emptyMetrics,sellerAnalyticsFixture } from "@/tests/fixtures/seller-analytics";
afterEach(cleanup);
describe("seller analytics report",()=>{
  it("uses distinct integer count ticks for low-volume traffic",()=>{
    const report=sellerAnalyticsFixture();report.daily=[{day:"2026-10-20",...emptyMetrics,views:1}];
    render(<SellerAnalyticsReport report={report}/>);
    const axis=screen.getByLabelText("Escala de visitas");
    const labels=[...axis.querySelectorAll("span")].map(span=>span.textContent);
    expect(new Set(labels).size).toBe(labels.length);
  });
  it("shows measured interest, actual outcomes and product CTA activity",()=>{
    render(<SellerAnalyticsReport report={sellerAnalyticsFixture()} />);
    expect(screen.getByText("Interés por visita").nextSibling).toHaveTextContent("25%");
    expect(screen.getByRole("heading",{name:"Actividad por producto"})).toBeInTheDocument();
    const table=screen.getByRole("table",{name:"Actividad por producto"});
    expect(within(table).getByRole("link",{name:"Taza de barro"})).toHaveAttribute("href","/panel/productos/11/editar");
    expect(within(table).getByRole("columnheader",{name:"Compartir"})).toBeInTheDocument();
    expect(screen.getByText(/Un clic no confirma una pregunta/)).toBeInTheDocument();
    expect(screen.getByRole("img",{name:/Visitas e interés por día/})).toBeInTheDocument();
  });
  it("offers guidance with no activity instead of a fabricated rate",()=>{
    const data=sellerAnalyticsFixture();data.current={...emptyMetrics};data.products=[];
    render(<SellerAnalyticsReport report={data} />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.getByText(/Comparte tus productos/)).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
  it("does not suggest changes from a tiny sample",()=>{
    const data=sellerAnalyticsFixture();data.products[0].current={...emptyMetrics,views:2,tracked_views:2};
    render(<SellerAnalyticsReport report={data} />);
    expect(screen.queryByRole("heading",{name:"Productos para revisar"})).not.toBeInTheDocument();
  });
});
