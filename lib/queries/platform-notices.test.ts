import { expect, test } from "vitest";

import {
  mapAudienceCounts,
  mapNoticeBatches,
  mapPlatformNotice,
  type NoticeBatchRow,
  type PlatformNoticeRow,
} from "@/lib/queries/platform-notices";

const row: PlatformNoticeRow = {
  id: 12,
  kind: "announcement",
  title: "Mantenimiento",
  body: "El sábado por la noche.",
  action_href: "/panel",
  action_label: "Ir a mi panel",
  created_at: "2026-10-12T16:42:00Z",
  read_at: null,
};

test("carries a notice through with its link as one action", () => {
  expect(mapPlatformNotice(row)).toEqual({
    id: 12,
    kind: "announcement",
    title: "Mantenimiento",
    body: "El sábado por la noche.",
    action: { href: "/panel", label: "Ir a mi panel" },
    created_at: "2026-10-12T16:42:00Z",
    read_at: null,
  });
});

test("gives a notice without a link no action", () => {
  expect(mapPlatformNotice({ ...row, action_href: null, action_label: null }).action).toBeNull();
});

test("never builds half an action", () => {
  // The table keeps the two together; a row that somehow has one is shown without a button.
  expect(mapPlatformNotice({ ...row, action_label: null }).action).toBeNull();
});

const batch: NoticeBatchRow = {
  batch_id: "b-1",
  audience: "everyone",
  recipient_label: null,
  title: "Mantenimiento",
  body: "El sábado por la noche.",
  action_href: null,
  action_label: null,
  recipient_count: 214,
  read_count: 131,
  created_at: "2026-10-12T16:42:00Z",
  retracted_at: null,
};

test("maps the history of what was sent", () => {
  expect(mapNoticeBatches([batch])).toEqual([
    {
      id: "b-1",
      audience: "everyone",
      recipientLabel: null,
      title: "Mantenimiento",
      body: "El sábado por la noche.",
      action: null,
      recipientCount: 214,
      readCount: 131,
      createdAt: "2026-10-12T16:42:00Z",
      retractedAt: null,
    },
  ]);
});

test("keeps who a direct notice went to, and when a send was retracted", () => {
  const [direct] = mapNoticeBatches([
    { ...batch, audience: "person", recipient_label: "Ana Ruiz", retracted_at: "2026-10-13T10:00:00Z" },
  ]);

  expect(direct.recipientLabel).toBe("Ana Ruiz");
  expect(direct.retractedAt).toBe("2026-10-13T10:00:00Z");
});

test("reads audience counts by name, and an audience left out as nobody", () => {
  expect(
    mapAudienceCounts([
      { audience: "everyone", people: 214 },
      { audience: "sellers", people: 38 },
    ]),
  ).toEqual({ everyone: 214, sellers: 38, buyers: 0 });
});
