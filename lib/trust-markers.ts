// There is no verification marker here on purpose. `user_trust_profiles
// .verification_level` defaults to 'unverified' and nothing writes it, so any
// badge derived from it asserts a review that never happened — which LFPC
// art. 32 forbids. A marker returns when a review workflow exists to back it.

type MemberSinceInput = {
  join_date: string;
  current_date?: string;
};

const DAY_IN_MS = 86_400_000;

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatCurrentDate() {
  return new Date().toISOString().slice(0, 10);
}

function addUtcMonths(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)),
  );
}

export function generateMemberSinceMarker({
  join_date,
  current_date = formatCurrentDate(),
}: MemberSinceInput) {
  const joinDate = parseDate(join_date);
  const currentDate = parseDate(current_date);
  const daysActive = Math.floor(
    (currentDate.getTime() - joinDate.getTime()) / DAY_IN_MS,
  );
  const sixMonthAnniversary = addUtcMonths(joinDate, 6);
  const twentyFourMonthAnniversary = addUtcMonths(joinDate, 24);
  let trustSignal = "Vendedor nuevo";

  if (currentDate > twentyFourMonthAnniversary) {
    trustSignal = "Vendedor de larga trayectoria";
  } else if (currentDate >= sixMonthAnniversary) {
    trustSignal = "Vendedor establecido";
  } else if (daysActive >= 30) {
    trustSignal = "Vendedor en crecimiento";
  }

  const joinedMonth = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(joinDate);

  return {
    primary_text: `Miembro desde ${joinedMonth}`,
    tooltip:
      "La antigüedad muestra cuánto tiempo lleva este vendedor activo en Plaza Volcanes y ayuda a evaluar su trayectoria.",
    trust_signal: trustSignal,
    days_active: daysActive,
  };
}
