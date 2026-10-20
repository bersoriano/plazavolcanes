import { afterEach,describe,expect,it,vi } from "vitest";
import { createProductTracker } from "@/lib/product-activity";

afterEach(()=>{sessionStorage.clear();vi.restoreAllMocks();vi.useRealTimers();document.body.innerHTML="";});

describe("product activity collection",()=>{
  it("persists session identity before an in-flight view can remount",async()=>{
    let finish!: (value:boolean)=>void;
    const record=vi.fn().mockImplementation(()=>new Promise<boolean>(resolve=>{finish=resolve;}));
    const first=createProductTracker(21,record)("view");
    const firstFinish=finish;
    const second=createProductTracker(21,record)("view");
    expect(record.mock.calls[0][2]).toBe(record.mock.calls[1][2]);
    firstFinish(true);finish(true);await Promise.all([first,second]);
  });
  it("deduplicates each action within the same tab session",async()=>{
    const record=vi.fn().mockResolvedValue(true);
    const tracker=createProductTracker(17,record);
    await tracker("view");await tracker("view");await tracker("question");await tracker("question");await tracker("purchase");
    expect(record.mock.calls.map(c=>[c[0],c[1]])).toEqual([[17,"view"],[17,"question"],[17,"purchase"]]);
    expect(new Set(record.mock.calls.map(c=>c[2])).size).toBe(1);
  });
  it("survives remounts and starts a new session after thirty minutes",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    const record=vi.fn().mockResolvedValue(true);
    await createProductTracker(18,record)("view");await createProductTracker(18,record)("view");
    expect(record).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-20T12:30:01Z"));
    await createProductTracker(18,record)("view");
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[0][2]).not.toBe(record.mock.calls[1][2]);
  });
  it("retries failed collection and never breaks the product flow",async()=>{
    const record=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(true);
    const tracker=createProductTracker(19,record);
    await expect(tracker("question")).resolves.toBeUndefined();
    await tracker("question");await tracker("question");
    expect(record).toHaveBeenCalledTimes(2);
  });
  it("works with storage blocked",async()=>{
    vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new Error("blocked");});
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("blocked");});
    const record=vi.fn().mockResolvedValue(true);
    const tracker=createProductTracker(20,record);await tracker("view");await tracker("view");
    expect(record).toHaveBeenCalledTimes(1);
  });
});
