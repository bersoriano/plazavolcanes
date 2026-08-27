import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { pickupPointFrom, savePickupPoint } from "@/lib/actions/shop-pickup-point";
import type { Database } from "@/lib/database.types";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

type StubResult = { error: { message: string } | null };

type StubCall =
  | { method: "delete"; table: string; column: string; value: unknown }
  | { method: "upsert"; table: string; payload: unknown };

/**
 * The codebase has no mocking library, so this is a hand-written stand-in for
 * the two query shapes `savePickupPoint` actually calls: a `.delete().eq()`
 * chain and a bare `.upsert()`. It records what it was called with so tests
 * can assert on the payload, and returns a caller-supplied result so both the
 * success and database-error paths can be exercised.
 */
function stubSupabase(options: { deleteResult?: StubResult; upsertResult?: StubResult } = {}) {
  const calls: StubCall[] = [];

  const client = {
    from(table: string) {
      return {
        delete() {
          return {
            eq(column: string, value: unknown) {
              calls.push({ method: "delete", table, column, value });
              return Promise.resolve(options.deleteResult ?? { error: null });
            },
          };
        },
        upsert(payload: unknown) {
          calls.push({ method: "upsert", table, payload });
          return Promise.resolve(options.upsertResult ?? { error: null });
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient<Database>, calls };
}

describe("pickupPointFrom", () => {
  it("reports no offer when the checkbox is absent", () => {
    const result = pickupPointFrom(form({ name: "Tienda" }));
    expect(result.offered).toBe(false);
    expect(result.parsed).toBeNull();
  });

  it("parses the pickup fields when the checkbox is on", () => {
    const result = pickupPointFrom(
      form({
        offers_pickup: "on",
        pickup_address_line1: "Av. Vallarta 1234",
        pickup_locality: "Zapopan",
        pickup_administrative_area_code: "MX-JAL",
        pickup_postal_code: "45010",
        pickup_notes: "Portón verde",
      }),
    );

    expect(result.offered).toBe(true);
    expect(result.parsed?.success).toBe(true);
    expect(result.parsed?.data?.address_line1).toBe("Av. Vallarta 1234");
  });

  it("reports the failure when the checkbox is on and a field is missing", () => {
    const result = pickupPointFrom(
      form({ offers_pickup: "on", pickup_address_line1: "Av. Vallarta 1234" }),
    );

    expect(result.offered).toBe(true);
    expect(result.parsed?.success).toBe(false);
  });
});

const VALID_PICKUP_FIELDS = {
  offers_pickup: "on",
  pickup_address_line1: "Av. Vallarta 1234",
  pickup_locality: "Zapopan",
  pickup_administrative_area_code: "MX-JAL",
  pickup_postal_code: "45010",
  pickup_notes: "Portón verde",
};

describe("savePickupPoint", () => {
  it("deletes the row when the checkbox is unchecked", async () => {
    const { client, calls } = stubSupabase();

    const result = await savePickupPoint(client, 42, form({}));

    expect(result).toBeNull();
    expect(calls).toEqual([
      { method: "delete", table: "shop_pickup_points", column: "shop_id", value: 42 },
    ]);
  });

  it("upserts the shop_id plus the five unprefixed fields when the input is valid", async () => {
    const { client, calls } = stubSupabase();

    const result = await savePickupPoint(client, 7, form(VALID_PICKUP_FIELDS));

    expect(result).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "upsert", table: "shop_pickup_points" });
    const payload = (calls[0] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({
      shop_id: 7,
      address_line1: "Av. Vallarta 1234",
      locality: "Zapopan",
      administrative_area_code: "MX-JAL",
      postal_code: "45010",
      notes: "Portón verde",
    });
    expect(typeof payload.updated_at).toBe("string");
  });

  it("returns exactly the pickup_-prefixed field errors and writes nothing", async () => {
    const { client, calls } = stubSupabase();

    const result = await savePickupPoint(
      client,
      7,
      form({ offers_pickup: "on", pickup_address_line1: "Av. Vallarta 1234" }),
    );

    expect(calls).toEqual([]);
    expect(result?.status).toBe("error");
    expect(result?.message).toBe("Revisa los datos de recolección.");
    expect(Object.keys(result?.errors ?? {}).sort()).toEqual(
      [
        "pickup_administrative_area_code",
        "pickup_locality",
        "pickup_postal_code",
      ].sort(),
    );
  });

  it("reports a Spanish error when the delete fails", async () => {
    const { client } = stubSupabase({ deleteResult: { error: { message: "boom" } } });

    const result = await savePickupPoint(client, 42, form({}));

    expect(result).toEqual({ status: "error", message: "No pudimos quitar la recolección." });
  });

  it("reports a Spanish error when the upsert fails", async () => {
    const { client } = stubSupabase({ upsertResult: { error: { message: "boom" } } });

    const result = await savePickupPoint(client, 7, form(VALID_PICKUP_FIELDS));

    expect(result).toEqual({ status: "error", message: "No pudimos guardar la recolección." });
  });
});
