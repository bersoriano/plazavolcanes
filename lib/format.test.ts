import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatDate,
  formatInboxDate,
  formatMessageDay,
  formatMessageTime,
  formatMxn,
  sameCalendarDay,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("formats the requested currency using the requested locale", () => {
    expect(formatCurrency(1299, "USD", "en-US")).toBe("$1,299.00");
  });
});

describe("formatMxn", () => {
  it("formats whole-number prices in Mexican pesos", () => {
    expect(formatMxn(1299)).toBe("$1,299.00");
  });

  it("formats decimal strings without losing cents", () => {
    expect(formatMxn("49.5")).toBe("$49.50");
  });
});

describe("formatDate", () => {
  it("formats ISO timestamps as Spanish calendar dates", () => {
    expect(formatDate("2026-08-20T12:30:00.000Z")).toBe("20 de agosto de 2026");
  });
});

const MEXICO_CITY = "America/Mexico_City";
const TIJUANA = "America/Tijuana";
// 10:42 in Mexico City, 09:42 in Tijuana.
const sent = "2026-10-12T16:42:00Z";

describe("formatMessageTime", () => {
  it("reads the time of day in the zone it is given", () => {
    expect(formatMessageTime(sent, MEXICO_CITY)).toBe("10:42 a.m.");
    expect(formatMessageTime(sent, TIJUANA)).toBe("9:42 a.m.");
  });
});

describe("formatInboxDate", () => {
  it("shows the time for a message from today", () => {
    expect(formatInboxDate(sent, "2026-10-12T23:00:00Z", MEXICO_CITY)).toBe("10:42 a.m.");
  });

  it("shows the day for an earlier message this year", () => {
    expect(formatInboxDate(sent, "2026-10-14T16:00:00Z", MEXICO_CITY)).toBe("12 oct");
  });

  it("adds the year once the message is from another one", () => {
    expect(formatInboxDate(sent, "2027-01-03T16:00:00Z", MEXICO_CITY)).toBe("12 oct 2026");
  });

  it("decides what today is in the reader's zone, not in UTC", () => {
    // 03:30 UTC on the 13th is still the evening of the 12th in Mexico City.
    expect(formatInboxDate(sent, "2026-10-13T03:30:00Z", MEXICO_CITY)).toBe("10:42 a.m.");
    // And 19:30 on the 11th in Tijuana is already the 12th in UTC.
    expect(formatInboxDate("2026-10-12T02:30:00Z", "2026-10-12T20:00:00Z", TIJUANA)).toBe("11 oct");
  });
});

describe("formatMessageDay", () => {
  it("names today and yesterday", () => {
    expect(formatMessageDay(sent, "2026-10-12T23:00:00Z", MEXICO_CITY)).toBe("Hoy");
    expect(formatMessageDay(sent, "2026-10-13T23:00:00Z", MEXICO_CITY)).toBe("Ayer");
  });

  it("writes out an older day, with the year only when it differs", () => {
    expect(formatMessageDay(sent, "2026-10-20T16:00:00Z", MEXICO_CITY)).toBe("12 de octubre");
    expect(formatMessageDay(sent, "2027-02-01T16:00:00Z", MEXICO_CITY)).toBe("12 de octubre de 2026");
  });

  it("calls the day before yesterday across a month boundary by its date", () => {
    expect(formatMessageDay("2026-09-30T18:00:00Z", "2026-10-02T18:00:00Z", MEXICO_CITY)).toBe(
      "30 de septiembre",
    );
  });
});

describe("sameCalendarDay", () => {
  it("groups two instants by the reader's calendar, not by UTC", () => {
    // 23:30 and 00:30 in Mexico City straddle midnight there, not in UTC.
    expect(sameCalendarDay("2026-10-13T05:30:00Z", "2026-10-13T06:30:00Z", MEXICO_CITY)).toBe(false);
    expect(sameCalendarDay("2026-10-12T23:30:00Z", "2026-10-13T00:30:00Z", MEXICO_CITY)).toBe(true);
  });
});
