/** Mês civil anterior (ex.: agosto/2026 → julho/2026; janeiro/2026 → dezembro/2025). */
export function previousCalendarMonth(
  month: number,
  year: number,
): { month: number; year: number } {
  if (month === 1) {
    return { month: 12, year: year - 1 };
  }
  return { month: month - 1, year };
}

export function padMonth(month: number): string {
  return String(month).padStart(2, '0');
}

const SAO_PAULO_TZ = 'America/Sao_Paulo';

/** Mês/ano civil no fuso do cron de absenteísmo. */
export function calendarMonthInSaoPaulo(
  now = new Date(),
): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TZ,
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(now);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  return { month, year };
}

export function isCurrentCalendarMonth(
  month: number,
  year: number,
  now = new Date(),
): boolean {
  const current = calendarMonthInSaoPaulo(now);
  return current.month === month && current.year === year;
}
