import { expect, test } from "vitest";

import { displayNameOrHandle } from "@/lib/display-name";

test("uses the name a person set", () => {
  expect(displayNameOrHandle("Ana Ruiz", "3333cccc-cccc-4ccc-8ccc-cccccccccccc")).toBe("Ana Ruiz");
});

test("falls back to a stable handle when there is no name", () => {
  expect(displayNameOrHandle(null, "3333cccc-cccc-4ccc-8ccc-cccccccccccc")).toBe("Comprador #3333");
});

test("treats a blank name as no name", () => {
  expect(displayNameOrHandle("   ", "3333cccc-cccc-4ccc-8ccc-cccccccccccc")).toBe("Comprador #3333");
});

test("matches the handle private.display_label builds in SQL", () => {
  // The seller reads the database's answer in the inbox and this one in a
  // thread, so the two must agree character for character.
  expect(displayNameOrHandle(null, "ab12cdef-0000-4000-8000-000000000000")).toBe("Comprador #AB12");
  expect(displayNameOrHandle(null, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")).toBe("Comprador #EEEE");
});
