export const LOCAL_UID = 'local-guest';

export const LOCAL_USER = {
  uid: LOCAL_UID,
  email: 'local@localhost',
  displayName: 'Local',
} as const;

const STORAGE_KEY = 'finanzas_local_db';
const MODE_KEY = 'finanzas_local_mode';

type LocalDB = {
  transactions: Record<string, Record<string, unknown>>;
  customCategories: {
    expense: string[];
    income: string[];
    refund: string[];
    saving: string[];
  };
  recurring: Record<string, Record<string, unknown>>;
  sheets: Record<string, unknown> | null;
};

const emptyDb = (): LocalDB => ({
  transactions: {},
  customCategories: { expense: [], income: [], refund: [], saving: [] },
  recurring: {},
  sheets: null,
});

const listeners = new Set<() => void>();

export function isLocalUser(user: { uid?: string } | null | undefined): boolean {
  return user?.uid === LOCAL_UID;
}

export function isLocalModeEnabled(): boolean {
  return localStorage.getItem(MODE_KEY) === '1';
}

export function enableLocalMode(): void {
  localStorage.setItem(MODE_KEY, '1');
}

export function disableLocalMode(): void {
  localStorage.removeItem(MODE_KEY);
}

let hydrating = false;

export async function hydrateFromServer(): Promise<void> {
  hydrating = true;
  try {
    const res = await fetch('/api/data');
    if (!res.ok) return;
    const db = { ...emptyDb(), ...(await res.json()) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    listeners.forEach((fn) => fn());
  } catch {
    // Keep whatever is already in localStorage.
  } finally {
    hydrating = false;
  }
}

function loadDb(): LocalDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    return emptyDb();
  }
}

function saveDb(db: LocalDB): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  listeners.forEach((fn) => fn());
  if (!hydrating) {
    fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db),
    }).catch(() => {});
  }
}

function serialize(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object') {
      const method = (value as { _methodName?: string })._methodName;
      if (method === 'serverTimestamp' || method === 'serverTimestamp()') {
        out[key] = new Date().toISOString();
        continue;
      }
    }
    out[key] = value;
  }
  return out;
}

export function subscribeLocal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readLocal(): LocalDB {
  return loadDb();
}

export function writeLocal(path: string, data: Record<string, unknown>, mode: 'set' | 'update' = 'set'): void {
  const db = loadDb();
  const parts = path.split('/').filter(Boolean);
  const payload = serialize(data);

  if (parts[2] === 'transactions' && parts[3]) {
    db.transactions[parts[3]] = mode === 'update'
      ? { ...db.transactions[parts[3]], ...payload, id: parts[3] }
      : { ...payload, id: parts[3] };
  } else if (parts[2] === 'customCategories') {
    db.customCategories = {
      expense: (payload.expense as string[]) || db.customCategories.expense,
      income: (payload.income as string[]) || db.customCategories.income,
      refund: (payload.refund as string[]) || db.customCategories.refund,
      saving: (payload.saving as string[]) || db.customCategories.saving,
    };
  } else if (parts[2] === 'recurringTransactions' && parts[3]) {
    db.recurring[parts[3]] = mode === 'update'
      ? { ...db.recurring[parts[3]], ...payload, id: parts[3] }
      : { ...payload, id: parts[3] };
  } else if (parts[2] === 'settings') {
    db.sheets = mode === 'update' ? { ...(db.sheets || {}), ...payload } : payload;
  }

  saveDb(db);
}

export function deleteLocal(path: string): void {
  const db = loadDb();
  const parts = path.split('/').filter(Boolean);
  if (parts[2] === 'transactions' && parts[3]) {
    delete db.transactions[parts[3]];
  } else if (parts[2] === 'recurringTransactions' && parts[3]) {
    delete db.recurring[parts[3]];
  } else if (parts[2] === 'settings') {
    db.sheets = null;
  }
  saveDb(db);
}
