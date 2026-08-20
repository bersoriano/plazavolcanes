export type VerificationLevel =
  | "unverified"
  | "basic"
  | "verified"
  | "highly_verified";

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

const verificationMarkers = {
  unverified: {
    primary_text: "Sin verificar",
    badge_label: "Sin verificar",
    tooltip:
      "Este vendedor aún no completa la verificación de identidad. Recomendamos tomar precauciones adicionales.",
  },
  basic: {
    primary_text: "Verificación básica",
    badge_label: "Básica",
    tooltip:
      "Este vendedor verificó su teléfono y correo electrónico. Sus documentos de identidad aún no han sido revisados por completo.",
  },
  verified: {
    primary_text: "Vendedor verificado",
    badge_label: "Verificado",
    tooltip:
      "Este vendedor completó la verificación de identidad. Sus datos personales fueron revisados y confirmados.",
  },
  highly_verified: {
    primary_text: "Altamente verificado",
    badge_label: "Altamente verificado",
    tooltip:
      "Este vendedor completó una verificación avanzada con documentos oficiales y controles de seguridad adicionales.",
  },
} as const satisfies Record<
  VerificationLevel,
  { primary_text: string; badge_label: string; tooltip: string }
>;

export function generateVerificationMarker(level: VerificationLevel) {
  return { ...verificationMarkers[level], level };
}
