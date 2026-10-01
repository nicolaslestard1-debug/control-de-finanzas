export type TimeFilter = 'all' | 'year' | 'month' | 'week' | 'custom';

export type PinnedPeriod = { start: string; end: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PINNED_PERIOD_KEY = 'finanzas.pinnedPeriod';

export function parsePinnedPeriod(raw: string | null): PinnedPeriod | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { start?: unknown; end?: unknown };
    const start = typeof parsed?.start === 'string' && ISO_DATE.test(parsed.start) ? parsed.start : '';
    const end = typeof parsed?.end === 'string' && ISO_DATE.test(parsed.end) ? parsed.end : '';
    if (!start && !end) return null;
    if (start && end && start > end) return null;
    return { start, end };
  } catch {
    return null;
  }
}

export function isRangeInvalid(startDate: string, endDate: string): boolean {
  return !!startDate && !!endDate && startDate > endDate;
}

export function transactionInPeriod(
  date: string,
  timeFilter: TimeFilter,
  startDate: string,
  endDate: string,
  now = new Date(),
): boolean {
  if (timeFilter === 'all') return true;
  if (!date || !ISO_DATE.test(date)) return false;

  const [year, month, day] = date.split('-').map(Number);

  if (timeFilter === 'year') return year === now.getFullYear();
  if (timeFilter === 'month') return year === now.getFullYear() && month === now.getMonth() + 1;
  if (timeFilter === 'week') {
    const txDate = new Date(year, month - 1, day);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return txDate >= sevenDaysAgo;
  }

  if (isRangeInvalid(startDate, endDate)) return true;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatShort(iso: string): string {
  if (!ISO_DATE.test(iso)) return '';
  const [, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${iso.slice(0, 4)}`;
}

export function formatPeriodLabel(timeFilter: TimeFilter, startDate: string, endDate: string): string {
  if (timeFilter === 'all') return 'Todo';
  if (timeFilter === 'year') return 'Este año';
  if (timeFilter === 'month') return 'Este mes';
  if (timeFilter === 'week') return 'Últimos 7 días';
  if (isRangeInvalid(startDate, endDate)) return 'Rango inválido';
  const start = formatShort(startDate);
  const end = formatShort(endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Desde ${start}`;
  if (end) return `Hasta ${end}`;
  return 'Personalizado';
}
