import { describe,expect,it } from "vitest";
import { interestRate,metricChange,parseAnalyticsFilters } from "@/lib/seller-analytics";

describe("seller analytics definitions",()=>{
  it("uses only measured sessions for interest rate",()=>{
    expect(interestRate({tracked_views:8,interests:2})).toBe(25);
    expect(interestRate({tracked_views:0,interests:0})).toBeNull();
  });
  it("does not invent percentage growth from zero",()=>{
    expect(metricChange(5,0)).toBe("Sin base anterior");
    expect(metricChange(0,0)).toBe("Sin cambios");
    expect(metricChange(15,10)).toBe("+50% vs. periodo anterior");
    expect(metricChange(5,10)).toBe("−50% vs. periodo anterior");
  });
  it("accepts supported windows and safe shop IDs",()=>{
    expect(parseAnalyticsFilters({dias:"7",tienda:"41"})).toEqual({days:7,shopId:41,invalidShop:false});
    expect(parseAnalyticsFilters({dias:"365"})).toEqual({days:30,shopId:null,invalidShop:false});
  });
  it.each(["-1","0","1e2","1.5","9007199254740993",["1","2"]])("rejects ambiguous or unsafe shop filters %s",(tienda)=>{
    expect(parseAnalyticsFilters({tienda}).invalidShop).toBe(true);
  });
});
