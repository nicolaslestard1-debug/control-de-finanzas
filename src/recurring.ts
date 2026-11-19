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

export type RecurringRule = {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string;
  dayOfMonth: number;
  lastProcessedMonth?: string;
  totalCount?: number;
  generatedCount?: number;
  active?: boolean;
  endedAt?: string;
};

const MONTH = /^\d{4}-\d{2}$/;
const MAX_CATCH_UP = 24;

export function addMonths(month: string, count: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(year, monthNumber - 1 + count, 1);
  return calendarMonth(next);
}

export function hasInstallments(rule: Pick<RecurringRule, 'totalCount'>): boolean {
  return typeof rule.totalCount === 'number' && rule.totalCount > 0;
}

export function isRuleActive(rule: RecurringRule): boolean {
  if (rule.active === false) return false;
  if (hasInstallments(rule) && (rule.generatedCount ?? 1) >= (rule.totalCount as number)) return false;
  return true;
}

function dayReached(month: string, dayOfMonth: number, now: Date): boolean {
  return now.getDate() >= Number(chargeDate(month, dayOfMonth).slice(8));
}

// Installment plans catch up on months that already passed so the count stays right.
// Plans without an end keep the original behavior and only charge the current month.
export function dueMonths(rule: RecurringRule, now: Date): string[] {
  if (!isRuleActive(rule)) return [];
  const day = Number(rule.dayOfMonth);
  if (!Number.isFinite(day) || day < 1) return [];

  if (!hasInstallments(rule)) {
    return shouldGenerateRecurring(rule.lastProcessedMonth, day, now) ? [calendarMonth(now)] : [];
  }

  const current = calendarMonth(now);
  const last = typeof rule.lastProcessedMonth === 'string' && MONTH.test(rule.lastProcessedMonth) ? rule.lastProcessedMonth : '';
  const remaining = (rule.totalCount as number) - (rule.generatedCount ?? 1);
  const months: string[] = [];
  let month = last ? addMonths(last, 1) : current;
  while (month <= current && months.length < remaining && months.length < MAX_CATCH_UP) {
    if (month === current && !dayReached(month, day, now)) break;
    months.push(month);
    month = addMonths(month, 1);
  }
  return months;
}

export function installmentTag(number: number, total: number): string {
  return `cuota ${number}/${total}`;
}

export function automaticDescription(base: string, installment?: { number: number; total: number }): string {
  if (!installment) return `${base} (Automático)`;
  return `${base} · ${installmentTag(installment.number, installment.total)} (Automático)`;
}

export function nextChargeDate(rule: RecurringRule, now: Date): string | null {
  if (!isRuleActive(rule)) return null;
  const current = calendarMonth(now);
  const last = typeof rule.lastProcessedMonth === 'string' && MONTH.test(rule.lastProcessedMonth) ? rule.lastProcessedMonth : '';
  let month = last ? addMonths(last, 1) : current;
  if (month < current) month = current;
  return chargeDate(month, Number(rule.dayOfMonth));
}

export function lastInstallmentMonth(rule: RecurringRule): string | null {
  if (!hasInstallments(rule) || !rule.lastProcessedMonth || !MONTH.test(rule.lastProcessedMonth)) return null;
  return addMonths(rule.lastProcessedMonth, (rule.totalCount as number) - (rule.generatedCount ?? 1));
}

export type RuleEdit = {
  description: string;
  amount: string;
  category: string;
  dayOfMonth: string;
  totalCount: string;
};

export const MAX_INSTALLMENTS = 120;

// Only future charges read the rule, so entries already saved keep their old values.
export function ruleEditUpdate(
  rule: RecurringRule,
  edit: RuleEdit,
  now: Date
): { update: Record<string, unknown> } | { error: string } {
  const amount = Number(edit.amount.replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Poné un monto mayor a 0.' };
  const category = edit.category.trim();
  if (!category) return { error: 'Elegí una categoría.' };
  const day = Number(edit.dayOfMonth);
  if (!Number.isInteger(day) || day < 1 || day > 31) return { error: 'El día tiene que ser entre 1 y 31.' };

  const update: Record<string, unknown> = {
    description: edit.description.trim() || category,
    amount,
    category,
    dayOfMonth: day,
  };

  if (hasInstallments(rule)) {
    const generated = rule.generatedCount ?? 1;
    const minimum = Math.max(2, generated);
    const total = Number(edit.totalCount);
    if (!Number.isInteger(total) || total < minimum || total > MAX_INSTALLMENTS) {
      return { error: `Las cuotas tienen que ser entre ${minimum} y ${MAX_INSTALLMENTS}.` };
    }
    update.totalCount = total;
    if (generated >= total) {
      update.active = false;
      update.endedAt = now.toISOString();
    }
  }
  return { update };
}

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatMonthShort(month: string): string {
  if (!MONTH.test(month)) return '';
  const [year, monthNumber] = month.split('-').map(Number);
  return `${SHORT_MONTHS[monthNumber - 1]} ${year}`;
}

export function formatDayShort(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return '';
  return `${Number(match[3])} ${SHORT_MONTHS[Number(match[2]) - 1]} ${match[1]}`;
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
