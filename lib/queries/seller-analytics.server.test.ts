import { beforeEach,describe,expect,it,vi } from "vitest";
import { sellerAnalyticsFixture } from "@/tests/fixtures/seller-analytics";
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabase/config",()=>({isSupabaseConfigured:()=>true}));
vi.mock("@/lib/supabase/server",()=>({createServerSupabaseClient:async()=>({rpc:mocks.rpc})}));
import { getSellerAnalytics } from "@/lib/queries/seller-analytics.server";
beforeEach(()=>vi.clearAllMocks());
describe("seller analytics reader",()=>{
  it("uses validated shop and date filters",async()=>{
    mocks.rpc.mockResolvedValue({data:sellerAnalyticsFixture(),error:null});
    expect((await getSellerAnalytics({days:7,shopId:1,invalidShop:false})).status).toBe("ready");
    expect(mocks.rpc).toHaveBeenCalledWith("seller_product_analytics",{p_days:7,p_shop_id:1});
  });
  it("does not turn denied access into all-shop analytics",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"42501"}});
    expect((await getSellerAnalytics({days:30,shopId:2,invalidShop:false})).status).toBe("invalid_shop");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects unsafe URL shop IDs before querying",async()=>{
    expect((await getSellerAnalytics({days:30,shopId:null,invalidShop:true})).status).toBe("invalid_shop");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("shows a load error instead of inventing zero statistics",async()=>{
    mocks.rpc.mockResolvedValue({data:{},error:null});
    expect((await getSellerAnalytics({days:30,shopId:null,invalidShop:false})).status).toBe("error");
  });
});
