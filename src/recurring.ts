export type AutomaticRow = {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt?: unknown;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calendarMonth(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function dayFromIsoDate(iso: string): number {
  const match = ISO_DATE.exec(iso);
  if (!match) return new Date(iso).getDate();
  return Number(match[3]);
}

export function monthFromIsoDate(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return new Date(iso).toISOString().slice(0, 7);
  return `${match[1]}-${match[2]}`;
}

export function recurringChargeId(recurringId: string, month: string): string {
  return `recur_${recurringId}_${month}`;
}

export function chargeDate(month: string, dayOfMonth: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const day = Math.min(Math.max(1, Math.trunc(dayOfMonth) || 1), lastDay || 1);
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function shouldGenerateRecurring(lastProcessedMonth: unknown, dayOfMonth: unknown, now: Date): boolean {
  const day = typeof dayOfMonth === 'number' ? dayOfMonth : Number(dayOfMonth);
  if (!Number.isFinite(day) || day < 1) return false;
  if (lastProcessedMonth === calendarMonth(now)) return false;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() >= Math.min(day, lastDay);
}

function createdAtMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object') {
    const stamp = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof stamp.toMillis === 'function') return stamp.toMillis();
    if (typeof stamp.seconds === 'number') return stamp.seconds * 1000 + (stamp.nanoseconds || 0) / 1e6;
  }
  return 0;
}

export function automaticDuplicateIds(rows: AutomaticRow[]): string[] {
  const groups = new Map<string, AutomaticRow[]>();
  for (const row of rows) {
    if (!row.description?.endsWith(' (Automático)')) continue;
    const key = `${row.type}|${row.amount}|${row.category}|${row.description}|${row.date}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const drop: string[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const ranked = [...list].sort((a, b) => {
      const aGenerated = a.id.startsWith('recur_') ? 0 : 1;
      const bGenerated = b.id.startsWith('recur_') ? 0 : 1;
      if (aGenerated !== bGenerated) return aGenerated - bGenerated;
      const created = createdAtMs(a.createdAt) - createdAtMs(b.createdAt);
      if (created !== 0) return created;
      return a.id < b.id ? -1 : 1;
    });
    drop.push(...ranked.slice(1).map((row) => row.id));
  }
  return drop;
}
