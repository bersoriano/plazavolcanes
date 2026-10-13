import { DEFAULT_CATALOG_LOCALE } from "@/lib/catalog-locale";

export function formatCurrency(
  value: number | string,
  currencyCode: string,
  locale = DEFAULT_CATALOG_LOCALE,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatMxn(value: number | string) {
  return formatCurrency(value, "MXN");
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(typeof value === "string" ? new Date(value) : value);
}

type Instant = string | Date;

function toDate(value: Instant) {
  return typeof value === "string" ? new Date(value) : value;
}

/** Some ICU builds separate "a.m." with a narrow no-break space; plain text reads the same everywhere. */
function plainSpaces(text: string) {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

/** The calendar day an instant falls on in a zone, as [year, month, day]. */
function calendarDay(value: Instant, timeZone: string) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  })
    .format(toDate(value))
    .split("-")
    .map(Number);

  return { day, month, year };
}

/** Whole calendar days from `value` to `now`, as the reader's zone counts them. */
function daysBefore(value: Instant, now: Instant, timeZone: string) {
  const then = calendarDay(value, timeZone);
  const today = calendarDay(now, timeZone);

  return Math.round(
    (Date.UTC(today.year, today.month - 1, today.day) -
      Date.UTC(then.year, then.month - 1, then.day)) /
      86_400_000,
  );
}

export function formatMessageTime(value: Instant, timeZone: string) {
  return plainSpaces(
    new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone }).format(
      toDate(value),
    ),
  );
}

/** A row in the inbox: the time for today, the day otherwise, the year once it differs. */
export function formatInboxDate(value: Instant, now: Instant, timeZone: string) {
  if (daysBefore(value, now, timeZone) === 0) return formatMessageTime(value, timeZone);

  const sameYear = calendarDay(value, timeZone).year === calendarDay(now, timeZone).year;

  return plainSpaces(
    new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      timeZone,
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(toDate(value)),
  );
}

/** The heading over a day of messages. */
export function formatMessageDay(value: Instant, now: Instant, timeZone: string) {
  const days = daysBefore(value, now, timeZone);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";

  const sameYear = calendarDay(value, timeZone).year === calendarDay(now, timeZone).year;

  return plainSpaces(
    new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "long",
      timeZone,
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(toDate(value)),
  );
}

/** Messages sent on the same calendar day share one heading. */
export function sameCalendarDay(left: Instant, right: Instant, timeZone: string) {
  return daysBefore(left, right, timeZone) === 0;
}
