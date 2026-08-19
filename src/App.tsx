import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, ArrowDownCircle, ArrowUpCircle, RefreshCcw, Trash2, Wallet,
  Calendar, Tag, AlignLeft, X, Download, PiggyBank, BarChart3,
  PieChart as PieChartIcon, Filter, LogOut, LogIn, Moon, Sun,
  Edit2, CreditCard, RefreshCw, Handshake, DollarSign, ChevronDown, Search, FileSpreadsheet, ExternalLink, Settings
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User, GoogleAuthProvider, browserPopupRedirectResolver } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { LOCAL_USER, isLocalUser, enableLocalMode, subscribeLocal, readLocal, writeLocal, deleteLocal, hydrateFromServer } from './localStore';

const FinancialAnalysis = ({ transactions, balance, periodLabel, expandedBox }: { transactions: Transaction[], balance: number, periodLabel: string, expandedBox: TransactionType | 'balance' | null }) => {
  const [expenseMetric, setExpenseMetric] = useState<'amount' | 'count'>('amount');

  const analysis = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const refunds = transactions.filter(t => t.type === 'refund');
    const incomes = transactions.filter(t => t.type === 'income');
    const savings = transactions.filter(t => t.type === 'saving');
    
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0) - refunds.reduce((sum, t) => sum + t.amount, 0);
    const totalIncomes = incomes.reduce((sum, t) => sum + t.amount, 0);
    const totalSavings = savings.reduce((sum, t) => sum + t.amount, 0);

    const getCategoriesData = (txs: Transaction[]) => {
      const amounts: Record<string, number> = {};
      const counts: Record<string, number> = {};
      
      txs.forEach(t => {
        const categoryName = getGroupedCategory(t.category, t.type, t.description);
        amounts[categoryName] = (amounts[categoryName] || 0) + t.amount;
        counts[categoryName] = (counts[categoryName] || 0) + 1;
      });
      
      return { amounts, counts };
    };

    const expenseData = getCategoriesData(expenses);
    const topExpenseByAmount = Object.entries(expenseData.amounts).sort((a, b) => b[1] - a[1])[0];
    const topExpenseByCount = Object.entries(expenseData.counts).sort((a, b) => b[1] - a[1])[0];

    const savingData = getCategoriesData(savings);
    const topSaving = Object.entries(savingData.amounts).sort((a, b) => b[1] - a[1])[0];

    const tips = [];
    
    if (!expandedBox || expandedBox === 'balance') {
      if (totalIncomes > 0) {
        const ratio = totalExpenses / totalIncomes;
        if (ratio > 1) tips.push("Tus gastos superan tus ingresos. Revisa si es un mes excepcional o si necesitas ajustar tu presupuesto.");
        else if (ratio > 0.7) tips.push("Estás gastando una gran parte de tus ingresos. Intenta reducir gastos variables.");
        else if (ratio < 0.3) tips.push("¡Excelente control! Tu nivel de gasto es muy bajo respecto a tus ingresos.");
      }
      if (totalSavings > 0) tips.push(`Has ahorrado el ${((totalSavings / (totalIncomes || 1)) * 100).toFixed(1)}% de tus ingresos.`);
      else if (balance > 50000) tips.push("Tienes capital ocioso. Considera opciones de inversión para que no pierda valor.");
    } else if (expandedBox === 'expense') {
      if (topExpenseByAmount) tips.push(`Tu mayor gasto monetario es "${topExpenseByAmount[0]}".`);
      if (topExpenseByCount) tips.push(`"${topExpenseByCount[0]}" es tu categoría más frecuente (${topExpenseByCount[1]} veces).`);
      if (totalExpenses > totalIncomes && totalIncomes > 0) tips.push("Alerta: Estás gastando más de lo que ingresas en este periodo.");
    } else if (expandedBox === 'saving') {
      if (totalSavings > 0) {
        tips.push(`Has sumado ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalSavings)} a tus ahorros.`);
        if (topSaving) tips.push(`Tu principal destino de ahorro es "${topSaving[0]}".`);
      } else {
        tips.push("No has registrado ahorros en este periodo. ¡Incluso montos pequeños suman a largo plazo!");
      }
    } else if (expandedBox === 'income') {
      if (totalIncomes > 0) tips.push(`Has recibido un total de ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalIncomes)}.`);
      if (totalSavings > 0) tips.push(`Destinaste el ${((totalSavings / totalIncomes) * 100).toFixed(1)}% de tus ingresos al ahorro.`);
    }

    if (tips.length === 0) tips.push("Sigue registrando tus movimientos para obtener consejos personalizados.");

    return {
      totalExpenses: Math.max(0, totalExpenses),
      totalIncomes,
      topExpenseByAmount,
      topExpenseByCount,
      topSaving,
      tips
    };
  }, [transactions, balance, expandedBox]);

  const getTitle = () => {
    if (!expandedBox || expandedBox === 'balance') return "Análisis General";
    if (expandedBox === 'expense') return "Análisis de Gastos";
    if (expandedBox === 'saving') return "Análisis de Ahorros";
    if (expandedBox === 'income') return "Análisis de Ingresos";
    return "Análisis y Consejos";
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 mt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-violet-500 dark:text-violet-400" />
          <h2 className="text-lg font-semibold">{getTitle()}</h2>
        </div>
        {expandedBox === 'expense' && (
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button 
              onClick={() => setExpenseMetric('amount')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${expenseMetric === 'amount' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Por Monto
            </button>
            <button 
              onClick={() => setExpenseMetric('count')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${expenseMetric === 'count' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Por Frecuencia
            </button>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              {expandedBox === 'saving' ? 'Ahorro del Periodo' : expandedBox === 'income' ? 'Ingresos del Periodo' : 'Estado del Periodo'} ({periodLabel})
            </p>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              {expandedBox === 'saving' ? (
                <p>Total ahorrado: <span className="font-bold text-zinc-900 dark:text-zinc-100">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(transactions.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0))}</span></p>
              ) : expandedBox === 'income' ? (
                <p>Total ingresos: <span className="font-bold text-zinc-900 dark:text-zinc-100">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(analysis.totalIncomes)}</span></p>
              ) : analysis.totalIncomes > 0 ? (
                <p>Has gastado un <span className="font-bold text-zinc-900 dark:text-zinc-100">{((analysis.totalExpenses / analysis.totalIncomes) * 100).toFixed(1)}%</span> de tus ingresos.</p>
              ) : (
                <span className="text-zinc-500 italic">Sin ingresos registrados.</span>
              )}
            </div>
          </div>
          
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              {expandedBox === 'saving' ? 'Principal Destino' : expandedBox === 'expense' ? (expenseMetric === 'amount' ? 'Principal Gasto' : 'Gasto más Activo') : 'Principal Gasto'}
            </p>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              {expandedBox === 'saving' ? (
                analysis.topSaving ? <span className="font-bold text-zinc-900 dark:text-zinc-100">{analysis.topSaving[0]}</span> : 'N/A'
              ) : expandedBox === 'expense' ? (
                expenseMetric === 'amount' ? (
                  analysis.topExpenseByAmount ? <span className="font-bold text-zinc-900 dark:text-zinc-100">{analysis.topExpenseByAmount[0]}</span> : 'N/A'
                ) : (
                  analysis.topExpenseByCount ? <span className="font-bold text-zinc-900 dark:text-zinc-100">{analysis.topExpenseByCount[0]} ({analysis.topExpenseByCount[1]} veces)</span> : 'N/A'
                )
              ) : (
                analysis.topExpenseByAmount ? <span className="font-bold text-zinc-900 dark:text-zinc-100">{analysis.topExpenseByAmount[0]}</span> : 'N/A'
              )}
            </div>
          </div>
        </div>

        <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-xl border border-violet-100 dark:border-violet-800/50">
          <h3 className="text-sm font-bold text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-2">
            <PiggyBank size={16} />
            Consejos y Observaciones
          </h3>
          <ul className="space-y-2">
            {analysis.tips.map((tip, i) => (
              <li key={i} className="text-sm text-violet-800 dark:text-violet-200 flex gap-2">
                <span className="text-violet-400">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}



const MercadoPagoIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <div 
    className={`bg-[#009EE3] rounded-full flex items-center justify-center flex-shrink-0 ${className}`} 
    style={{ width: size, height: size }}
  >
    <Handshake size={size * 0.65} color="white" strokeWidth={2.5} />
  </div>
);

type TransactionType = 'expense' | 'income' | 'refund' | 'saving';

interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt?: any;
}

const DEFAULT_CATEGORIES: Record<TransactionType, string[]> = {
  expense: ['Comida', 'Transporte', 'Ropa', 'Impuestos', 'Uber', 'Shows', 'Recreativo', 'Transferencias', 'Otros'],
  income: ['Sueldo', 'Transferencias', 'Ventas', 'Otros'],
  refund: ['Devolución/Promoción', 'Transferencias', 'Otros'],
  saving: ['Plazo Fijo', 'FCI', 'Dólares', 'Efectivo', 'Otros'],
};

const getGroupedCategory = (category: string, type: TransactionType, description?: string) => {
  if (type === 'saving') {
    const desc = description?.toLowerCase() || '';
    if (category === 'FCI' || category === 'Ahorros' || category === 'Otros') {
      if (desc.includes('mercado pago') || desc.includes('mp')) return 'FCI Mercado Pago';
      if (desc.includes('cocos')) return 'FCI Cocos';
      if (desc.includes('personal pay')) return 'FCI Personal Pay';
      if (desc.includes('naranja x')) return 'FCI Naranja X';
      if (desc.includes('ualla') || desc.includes('uala')) return 'FCI Ualá';
      if (desc.includes('santander')) return 'FCI Santander';
      if (desc.includes('galicia')) return 'FCI Galicia';
      if (desc.includes('bbva')) return 'FCI BBVA';
    }
    return category;
  }
  
  const social = ['Comida social', 'Shows', 'Recreativo', 'Salidas', 'Cine', 'Teatro', 'Restaurante', 'Bar'];
  const transporte = ['Transporte', 'Uber', 'Nafta', 'Combustible', 'Taxi', 'Cabify', 'Estacionamiento'];
  
  const catLower = category.toLowerCase();
  if (social.some(s => catLower.includes(s.toLowerCase()))) return 'Social';
  if (transporte.some(t => catLower.includes(t.toLowerCase()))) return 'Transporte';
  
  return category;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const handleFirestoreError = useCallback((error: unknown, operationType: OperationType, path: string | null) => {
    const message = error instanceof Error ? error.message : String(error);
    const errInfo = {
      error: message,
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    
    let userMessage = 'Error al conectar con la base de datos de Firebase.';
    if (message.includes('permission-denied') || message.includes('Missing or insufficient permissions') || message.includes('insufficient permissions')) {
      userMessage = 'Error de permisos: No estás autorizado para realizar esta acción o tu sesión ha expirado.';
    } else if (message.includes('not-found')) {
      userMessage = 'El registro solicitado no fue encontrado.';
    } else if (message.includes('quota') || message.includes('resource-exhausted')) {
      userMessage = 'Se ha superado la cuota de consultas gratuitas de Firebase de hoy.';
    } else if (message.includes('offline') || message.includes('failed-precondition')) {
      userMessage = 'Error de conexión: Por favor, verifica tu conexión a internet.';
    } else {
      userMessage = `Error de base de datos: ${message.slice(0, 80)}`;
    }
    
    showToast(userMessage, 'error');
  }, [showToast]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customCategories, setCustomCategories] = useState<Record<TransactionType, string[]>>({
    expense: [], income: [], refund: [], saving: []
  });

  // Form State
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES['expense'][0]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [showMPModal, setShowMPModal] = useState(false);
  const [isMPLinked, setIsMPLinked] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('mp_access_token');
    }
    return false;
  });
  const [isSyncingMP, setIsSyncingMP] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Google Sheets state
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [sheetConfig, setSheetConfig] = useState<{ id: string; url: string; lastSynced: string | null; customTabName?: string } | null>(null);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isImportingSheets, setIsImportingSheets] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [sheetsSyncError, setSheetsSyncError] = useState<string | null>(null);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [customSheetsUrlOrId, setCustomSheetsUrlOrId] = useState('');
  const [customTabName, setCustomTabName] = useState('Control de Finanzas');

  // Savings Adjustment State
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  const [savingsInput, setSavingsInput] = useState('');

  // Income Adjustment State
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');

  // Expense Adjustment State
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [expenseInput, setExpenseInput] = useState('');

  // Expanded Box State
  const [expandedBox, setExpandedBox] = useState<TransactionType | 'balance' | null>(null);

  // Currency Conversion State
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [rates, setRates] = useState<{ blue: number, mep: number }>({ blue: 0, mep: 0 });
  const [rateType, setRateType] = useState<'blue' | 'mep' | 'custom'>('blue');
  const [customRate, setCustomRate] = useState<string>('');
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  const exchangeRate = useMemo(() => {
    if (rateType === 'custom') return Number(customRate) || 0;
    return rates[rateType] || 0;
  }, [rateType, customRate, rates]);

  useEffect(() => {
    const fetchRates = async () => {
      setIsFetchingRate(true);
      try {
        const [blueRes, mepRes] = await Promise.all([
          fetch('https://dolarapi.com/v1/dolares/blue'),
          fetch('https://dolarapi.com/v1/dolares/bolsa')
        ]);
        
        const newRates = { ...rates };
        
        if (blueRes.ok) {
          const data = await blueRes.json();
          newRates.blue = data.venta;
        }
        
        if (mepRes.ok) {
          const data = await mepRes.json();
          newRates.mep = data.venta;
        }
        
        setRates(newRates);
      } catch (error) {
        console.error("Error fetching exchange rates:", error);
      } finally {
        setIsFetchingRate(false);
      }
    };
    fetchRates();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.token) {
        localStorage.setItem('mp_access_token', event.data.token);
        setIsMPLinked(true);
        setShowMPModal(false);
        handleMPSync(event.data.token);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  const handleMPConnect = async () => {
    try {
      // Fetch the OAuth URL from our server
      const response = await fetch('/api/auth/mp/url');
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();

      // Open the OAuth PROVIDER's URL directly in popup
      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Por favor, permite las ventanas emergentes (popups) para vincular tu cuenta.');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      alert('Error al iniciar la vinculación con Mercado Pago.');
    }
  };

  const handleMPDisconnect = () => {
    localStorage.removeItem('mp_access_token');
    setIsMPLinked(false);
    setShowMPModal(false);
  };

  const handleMPSync = async (token?: string) => {
    const activeToken = token || localStorage.getItem('mp_access_token');
    if (!activeToken || !user) return;

    setIsSyncingMP(true);
    try {
      const res = await fetch('/api/mp/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken })
      });
      
      if (!res.ok) throw new Error('Failed to fetch MP transactions');
      
      const data = await res.json();
      
      if (data.results && Array.isArray(data.results)) {
        let syncedCount = 0;
        const mpUserId = data.mpUserId;
        
        // Process each payment
        for (const payment of data.results) {
          // Only process approved payments
          if (payment.status !== 'approved') continue;
          
          const mpId = `mp_${payment.id}`;
          const amount = payment.transaction_amount;
          
          // Determine type
          let isExpense = payment.operation_type === 'regular_payment';
          const descLower = (payment.description || '').toLowerCase();
          
          if (mpUserId) {
            if (payment.payer?.id === mpUserId) {
              isExpense = true;
            } else if (payment.collector?.id === mpUserId) {
              isExpense = false;
            }
          } else {
            // Fallback heuristics
            if (descLower.startsWith('transferencia a ') || descLower.includes('enviaste') || descLower.includes('pago a ')) {
              isExpense = true;
            } else if (descLower.startsWith('transferencia de ') || descLower.includes('recibiste')) {
              isExpense = false;
            }
          }

          const type: TransactionType = isExpense ? 'expense' : 'income';
          
          let category = 'Mercado Pago';
          if (descLower.includes('sueldo') || descLower.includes('haberes') || descLower.includes('honorarios')) {
            category = 'Sueldo';
          } else if (descLower.includes('transferencia') || payment.operation_type === 'money_transfer') {
            category = 'Transferencias';
          }
          
          // Check if transaction already exists
          const exists = transactions.some(t => t.id === mpId);
          
          if (!exists) {
            const docRef = doc(collection(db, `users/${user.uid}/transactions`), mpId);
            await setDoc(docRef, {
              userId: user.uid,
              type,
              amount,
              category,
              description: payment.description || 'Transacción de Mercado Pago',
              date: payment.date_created.split('T')[0],
              createdAt: serverTimestamp()
            });
            syncedCount++;
          }
        }
        if (syncedCount > 0) {
          alert(`¡Se sincronizaron ${syncedCount} transacciones nuevas!`);
        } else {
          alert('No hay transacciones nuevas para sincronizar.');
        }
      } else {
        alert('No se encontraron transacciones o el token es inválido.');
      }
    } catch (error) {
      console.error("Error syncing MP:", error);
      alert('Error al sincronizar con Mercado Pago. Verifica tu token o conexión.');
    } finally {
      setIsSyncingMP(false);
    }
  };

  const [timeFilter, setTimeFilter] = useState<'all' | 'year' | 'month' | 'week' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Test connection on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const [accessUrls, setAccessUrls] = useState<string[]>([]);
  const runningLocally = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  );

  // Auth Listener
  useEffect(() => {
    if (runningLocally) {
      enableLocalMode();
      setUser(LOCAL_USER as unknown as User);
      setIsAuthReady(true);
      hydrateFromServer();
      fetch('/api/info')
        .then((res) => (res.ok ? res.json() : null))
        .then((info) => {
          if (info?.urls) setAccessUrls(info.urls.filter((url: string) => !url.includes('localhost')));
        })
        .catch(() => {});
      return;
    }

    getRedirectResult(auth)
      .then((result) => {
        if (!result) return;
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) setGoogleAccessToken(credential.accessToken);
      })
      .catch((error) => console.error('Google redirect login failed', error));

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [runningLocally]);

  // Data Fetching
  useEffect(() => {
    if (!isAuthReady || !user) {
      setTransactions([]);
      setCustomCategories({ expense: [], income: [], refund: [], saving: [] });
      return;
    }

    if (isLocalUser(user)) {
      const applyLocal = () => {
        const local = readLocal();
        const txs = Object.values(local.transactions).map((row) => ({ id: String(row.id), ...row })) as Transaction[];
        txs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setTransactions(txs);
        setCustomCategories(local.customCategories);
        if (local.sheets) {
          setSheetConfig({
            id: String(local.sheets.id || ''),
            url: String(local.sheets.url || ''),
            lastSynced: (local.sheets.lastSynced as string | null) || null,
            customTabName: String(local.sheets.customTabName || 'Control de Finanzas'),
          });
        } else {
          setSheetConfig(null);
        }
      };
      applyLocal();
      return subscribeLocal(applyLocal);
    }

    const txPath = `users/${user.uid}/transactions`;
    const q = query(collection(db, txPath));
    
    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((doc) => {
        txs.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      
      // Sort in-memory to prevent requiring composite indexes in Firestore
      txs.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA); // Newest date first
        }
        
        const getMs = (val: any): number => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (val.seconds !== undefined) return val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1000000 : 0);
          if (val instanceof Date) return val.getTime();
          const parsed = new Date(val);
          return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        };

        return getMs(b.createdAt) - getMs(a.createdAt); // Newest created first
      });

      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, txPath);
    });

    const catPath = `users/${user.uid}/customCategories/categories`;
    const unsubscribeCat = onSnapshot(doc(db, catPath), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCustomCategories({
          expense: data.expense || [],
          income: data.income || [],
          refund: data.refund || [],
          saving: data.saving || []
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, catPath);
    });

    const sheetPath = `users/${user.uid}/settings/googlesheets`;
    const unsubscribeSheet = onSnapshot(doc(db, sheetPath), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSheetConfig({
          id: data.id || '',
          url: data.url || '',
          lastSynced: data.lastSynced || null,
          customTabName: data.customTabName || 'Control de Finanzas'
        });
      } else {
        setSheetConfig(null);
      }
    }, (error) => {
      console.error("Error reading sheets config:", error);
    });

    return () => {
      unsubscribeTx();
      unsubscribeCat();
      unsubscribeSheet();
    };
  }, [user, isAuthReady]);

  // Recurring Transactions Processor
  useEffect(() => {
    if (!isAuthReady || !user || isLocalUser(user)) return;
    
    const recurringPath = `users/${user.uid}/recurringTransactions`;
    const q = query(collection(db, recurringPath));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const currentDay = new Date().getDate();
      
      snapshot.forEach(async (docSnap) => {
        const data = docSnap.data();
        if (data.lastProcessedMonth !== currentMonth && currentDay >= data.dayOfMonth) {
          const txId = crypto.randomUUID();
          const txPath = `users/${user.uid}/transactions/${txId}`;
          const txDate = `${currentMonth}-${String(data.dayOfMonth).padStart(2, '0')}`;
          
          try {
            await setDoc(doc(db, txPath), {
              userId: user.uid,
              type: data.type,
              amount: data.amount,
              category: data.category,
              description: data.description + ' (Automático)',
              date: txDate,
              createdAt: serverTimestamp()
            });
            
            await updateDoc(doc(db, recurringPath, docSnap.id), {
              lastProcessedMonth: currentMonth
            });
          } catch (error) {
            console.error("Error processing recurring transaction", error);
          }
        }
      });
    }, (error) => {
      console.error("Error fetching recurring transactions", error);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Update category when type changes
  useEffect(() => {
    setIsCustomCategory(false);
    setCustomCategoryName('');
    setCategory(DEFAULT_CATEGORIES[type][0]);
  }, [type]);

  // Sync Sheets configuration inputs when sheetConfig changes
  useEffect(() => {
    if (sheetConfig) {
      setCustomSheetsUrlOrId(sheetConfig.url || sheetConfig.id || '');
      setCustomTabName(sheetConfig.customTabName || 'Control de Finanzas');
    } else {
      setCustomSheetsUrlOrId('');
      setCustomTabName('Control de Finanzas');
    }
  }, [sheetConfig]);

  const extractSpreadsheetId = (urlOrId: string): string => {
    const clean = urlOrId.trim();
    if (clean.includes('docs.google.com/spreadsheets')) {
      const match = clean.match(/\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : clean;
    }
    return clean;
  };

  const handleLogin = async () => {
    setLoginError(null);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    try {
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      }
    } catch (error) {
      console.error("Error logging in", error);
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      const message = error instanceof Error ? error.message : String(error);
      let text = `No se pudo iniciar sesión: ${message.slice(0, 120)}`;
      if (code === 'auth/unauthorized-domain') {
        text = `Firebase no autoriza este sitio (${window.location.hostname}). En Firebase → Autenticación → Settings → Authorized domains agregá exactamente ese dominio.`;
      } else if (code === 'auth/popup-blocked') {
        text = 'Chrome bloqueó la ventana de Google. Permití popups y volvé a intentar.';
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        text = 'Inicio de sesión cancelado.';
      } else if (message.toLowerCase().includes('requested action is invalid')) {
        text = 'Cerrá Control de Finanzas.app y abrí localhost:3001 en una pestaña de Chrome.';
      }
      setLoginError(text);
      showToast(text, 'error');
    }
  };

  const handleLocalMode = () => {
    enableLocalMode();
    setLoginError(null);
    setUser(LOCAL_USER as unknown as User);
  };

  const persistSet = async (path: string, data: Record<string, unknown>, mode: 'set' | 'update' = 'set') => {
    if (isLocalUser(user)) {
      writeLocal(path, data, mode);
      return;
    }
    try {
      if (mode === 'update') {
        await updateDoc(doc(db, path), data);
      } else {
        await setDoc(doc(db, path), data);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  };

  const persistDelete = async (path: string) => {
    if (isLocalUser(user)) {
      deleteLocal(path);
      return;
    }
    await deleteDoc(doc(db, path));
  };

  const handleLogout = async () => {
    try {
      if (!isLocalUser(user)) {
        await signOut(auth);
      }
      enableLocalMode();
      setUser(LOCAL_USER as unknown as User);
      setGoogleAccessToken(null);
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    setType(t.type);
    setAmount(t.amount.toString());
    setDescription(t.description);
    setDate(t.date);
    
    const isDefault = DEFAULT_CATEGORIES[t.type].includes(t.category);
    const isExistingCustom = customCategories[t.type]?.includes(t.category);
    if (!isDefault && !isExistingCustom) {
      setIsCustomCategory(true);
      setCustomCategoryName(t.category);
    } else {
      setIsCustomCategory(false);
      setCustomCategoryName('');
      setCategory(t.category);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    const finalCategory = isCustomCategory ? customCategoryName.trim() : category;
    if (!finalCategory) return;

    let finalAmount = Number(amount);
    if (currency === 'USD' && exchangeRate > 0) {
      finalAmount = finalAmount * exchangeRate;
    }

    let finalType = type;
    if (finalType === 'expense' && finalCategory.toLowerCase().includes('ahorro')) {
      finalType = 'saving';
    }

    if (isCustomCategory) {
      const exists = DEFAULT_CATEGORIES[finalType].includes(finalCategory) || customCategories[finalType].includes(finalCategory);
      if (!exists) {
        const newCats = {
          ...customCategories,
          [finalType]: [...customCategories[finalType], finalCategory]
        };
        const catPath = `users/${user.uid}/customCategories/categories`;
        try {
          await persistSet(catPath, {
            userId: user.uid,
            ...newCats
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, catPath);
        }
      }
    }

    try {
      if (editingId) {
        const txPath = `users/${user.uid}/transactions/${editingId}`;
        await persistSet(txPath, {
          type: finalType,
          amount: finalAmount,
          category: finalCategory,
          description: description || 'Sin descripción',
          date
        }, 'update');
        setEditingId(null);
        showToast('¡Transacción actualizada con éxito!', 'success');
      } else {
        const txId = crypto.randomUUID();
        const txPath = `users/${user.uid}/transactions/${txId}`;
        await persistSet(txPath, {
          userId: user.uid,
          type: finalType,
          amount: finalAmount,
          category: finalCategory,
          description: description || 'Sin descripción',
          date,
          createdAt: serverTimestamp()
        });

        if (isRecurring) {
          const recurringPath = `users/${user.uid}/recurringTransactions/${txId}`;
          await persistSet(recurringPath, {
            userId: user.uid,
            type: finalType,
            amount: finalAmount,
            category: finalCategory,
            description: description || 'Sin descripción',
            dayOfMonth: new Date(date).getDate(),
            lastProcessedMonth: new Date(date).toISOString().slice(0, 7),
            createdAt: serverTimestamp()
          });
        }
        showToast('¡Transacción agregada con éxito!', 'success');
      }
      
      setAmount('');
      setDescription('');
      setCurrency('ARS');
      setRateType('blue');
      setCustomRate('');
      setIsRecurring(false);
      if (isCustomCategory) {
        setCategory(finalCategory);
        setIsCustomCategory(false);
        setCustomCategoryName('');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/transactions`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const txPath = `users/${user.uid}/transactions/${id}`;
    try {
      await persistDelete(txPath);
      showToast('Transacción eliminada con éxito.', 'info');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, txPath);
    }
  };

  const handleDeleteSelected = () => {
    if (!user || selectedTransactionIds.length === 0) return;
    setShowDeleteConfirmModal(true);
  };

  const executeDeleteSelected = async () => {
    if (!user || selectedTransactionIds.length === 0) return;
    
    try {
      await Promise.all(
        selectedTransactionIds.map(id =>
          persistDelete(`users/${user.uid}/transactions/${id}`)
        )
      );
      setSelectedTransactionIds([]);
      setShowDeleteConfirmModal(false);
      showToast('Transacciones seleccionadas eliminadas.', 'info');
    } catch (error) {
      console.error("Error deleting multiple transactions:", error);
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transactions`);
    }
  };

  const toggleTransactionSelection = (id: string) => {
    setSelectedTransactionIds(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const toggleAllTransactionsSelection = () => {
    if (selectedTransactionIds.length === filteredTransactions.length) {
      setSelectedTransactionIds([]);
    } else {
      setSelectedTransactionIds(filteredTransactions.map(t => t.id));
    }
  };

  const handleSavingsAdjustment = async () => {
    if (!user || isNaN(Number(savingsInput))) return;
    
    const newTotal = Number(savingsInput);
    const diff = newTotal - totalSaving;
    
    if (diff === 0) {
      setIsEditingSavings(false);
      return;
    }

    try {
      const txId = crypto.randomUUID();
      const txPath = `users/${user.uid}/transactions/${txId}`;
      await persistSet(txPath, {
        userId: user.uid,
        type: 'saving',
        amount: diff,
        category: 'Ajuste',
        description: 'Ajuste manual de ahorros',
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });
      setIsEditingSavings(false);
      showToast('¡Ahorros ajustados con éxito!', 'success');
    } catch (error) {
      console.error("Error adjusting savings:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/transactions`);
    }
  };

  const handleIncomeAdjustment = async () => {
    if (!user || isNaN(Number(incomeInput))) return;
    
    const newTotal = Number(incomeInput);
    const diff = newTotal - totalIncome;
    
    if (diff === 0) {
      setIsEditingIncome(false);
      return;
    }

    try {
      const txId = crypto.randomUUID();
      const txPath = `users/${user.uid}/transactions/${txId}`;
      await persistSet(txPath, {
        userId: user.uid,
        type: 'income',
        amount: diff,
        category: 'Ajuste',
        description: 'Ajuste manual de ingresos',
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });
      setIsEditingIncome(false);
      showToast('¡Ingresos ajustados con éxito!', 'success');
    } catch (error) {
      console.error("Error adjusting income:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/transactions`);
    }
  };

  const handleExpenseAdjustment = async () => {
    if (!user || isNaN(Number(expenseInput))) return;
    
    const newTotal = Number(expenseInput);
    const diff = newTotal - totalExpense;
    
    if (diff === 0) {
      setIsEditingExpense(false);
      return;
    }

    try {
      const txId = crypto.randomUUID();
      const txPath = `users/${user.uid}/transactions/${txId}`;
      await persistSet(txPath, {
        userId: user.uid,
        type: 'expense',
        amount: diff,
        category: 'Ajuste',
        description: 'Ajuste manual de gastos',
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });
      setIsEditingExpense(false);
      showToast('¡Gastos ajustados con éxito!', 'success');
    } catch (error) {
      console.error("Error adjusting expense:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/transactions`);
    }
  };

  // Calculations
  const timeFilteredTransactions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

    return transactions.filter(t => {
      const [year, month, day] = t.date.split('-').map(Number);
      const txDateObj = new Date(year, month - 1, day);
      
      if (timeFilter === 'year') {
        return year === currentYear;
      } else if (timeFilter === 'month') {
        return year === currentYear && month === currentMonth + 1;
      } else if (timeFilter === 'week') {
        return txDateObj >= sevenDaysAgo;
      } else if (timeFilter === 'custom') {
        if (!startDate && !endDate) return true;
        
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        
        if (start && txDateObj < start) return false;
        if (end && txDateObj > end) return false;
        return true;
      }
      return true;
    });
  }, [transactions, timeFilter, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    let result = timeFilteredTransactions;
    
    if (expandedBox && expandedBox !== 'balance') {
      result = result.filter(t => t.type === expandedBox);
    }
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.category.toLowerCase().includes(lowerSearch) || 
        t.description.toLowerCase().includes(lowerSearch)
      );
    }
    
    return result;
  }, [timeFilteredTransactions, expandedBox, searchTerm]);

  const { totalIncome, totalExpense, totalRefund, totalSaving, balance } = useMemo(() => {
    // If searching, we use filteredTransactions to show the sum of results
    // Otherwise we use timeFilteredTransactions for the period totals
    const source = searchTerm ? filteredTransactions : timeFilteredTransactions;

    return source.reduce(
      (acc, curr) => {
        if (curr.type === 'income') {
          acc.totalIncome += curr.amount;
          acc.balance += curr.amount;
        } else if (curr.type === 'expense') {
          acc.totalExpense += curr.amount;
          acc.balance -= curr.amount;
        } else if (curr.type === 'refund') {
          acc.totalRefund += curr.amount;
          acc.balance += curr.amount;
          acc.totalExpense -= curr.amount;
        } else if (curr.type === 'saving') {
          acc.totalSaving += curr.amount;
          acc.balance -= curr.amount;
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, totalRefund: 0, totalSaving: 0, balance: 0 }
    );
  }, [timeFilteredTransactions, filteredTransactions, searchTerm]);

  const boxBreakdown = useMemo(() => {
    if (!expandedBox || expandedBox === 'balance') return null;
    
    let relevantTx = filteredTransactions.filter(t => t.type === expandedBox);
    
    // If we are looking at expenses, we should also include refunds as negative expenses
    // to match the net totalExpense calculation
    if (expandedBox === 'expense') {
      const refunds = filteredTransactions.filter(t => t.type === 'refund');
      relevantTx = [...relevantTx, ...refunds.map(r => ({ ...r, amount: -r.amount }))];
    }

    const grouped = relevantTx.reduce((acc, curr) => {
      const categoryName = getGroupedCategory(curr.category, curr.type, curr.description);
      acc[categoryName] = (acc[categoryName] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, expandedBox]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDisplayValue = (value: number, categoryName?: string) => {
    if ((categoryName === 'Dólares' || categoryName === 'Dolares') && exchangeRate > 0) {
      return `USD ${(value / exchangeRate).toFixed(2)}`;
    }
    return formatCurrency(value);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Tipo', 'Monto', 'Categoría', 'Descripción', 'Fecha'];
    
    // Sort transactions by date, category, and amount
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
      // Date ascending
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      // Category ascending
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      // Amount descending
      return b.amount - a.amount;
    });

    const rows = sortedTransactions.map(t => [
      t.id,
      t.type === 'expense' ? 'Gasto' : t.type === 'income' ? 'Ingreso' : t.type === 'refund' ? 'Reembolso' : 'Ahorro',
      t.amount,
      t.category,
      `"${t.description.replace(/"/g, '""')}"`,
      t.date
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'finanzas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    // Sort transactions by date, category, and amount
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
      // Date ascending
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      // Category ascending
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      // Amount descending
      return b.amount - a.amount;
    });

    const data = sortedTransactions.map(t => ({
      'Fecha': t.date,
      'Tipo': t.type === 'expense' ? 'Gasto' : t.type === 'income' ? 'Ingreso' : t.type === 'refund' ? 'Reembolso' : 'Ahorro',
      'Categoría': t.category,
      'Monto': t.amount,
      'Descripción': t.description,
      'ID': t.id
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Finanzas");

    // Trigger download
    XLSX.writeFile(workbook, "finanzas.xlsx");
  };

  const handleDisconnectSheets = async () => {
    if (!user) return;
    try {
      if (confirm('¿Estás seguro de que deseas desvincular esta planilla? Los datos no se borrarán de Google Sheets, pero la aplicación ya no los sincronizará automáticamente aquí.')) {
        await deleteDoc(doc(db, `users/${user.uid}/settings/googlesheets`));
        setSheetConfig(null);
        setCustomSheetsUrlOrId('');
        setCustomTabName('Control de Finanzas');
        alert('Planilla desvinculada del sistema.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al desvincular la planilla.');
    }
  };

  const saveSheetsConfigOnly = async () => {
    if (!user) return;
    setIsSavingConfig(true);
    let token = googleAccessToken;

    try {
      let spreadsheetId = extractSpreadsheetId(customSheetsUrlOrId);
      let tabName = customTabName.trim() || 'Control de Finanzas';

      if (!spreadsheetId) {
        alert('Por favor introduce un enlace o ID de planilla válido.');
        setIsSavingConfig(false);
        return;
      }

      if (!token) {
        const sheetsProvider = new GoogleAuthProvider();
        sheetsProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
        sheetsProvider.addScope('https://www.googleapis.com/auth/drive.file');

        const result = await signInWithPopup(auth, sheetsProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          token = credential.accessToken;
          setGoogleAccessToken(token);
        } else {
          throw new Error('No se pudo obtener el token de acceso de Google con permisos de Sheets.');
        }
      }

      // Verify spreadsheet access and get webViewLink
      const getMetaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=webViewLink`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let webViewLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      if (getMetaRes.ok) {
        const metaData = await getMetaRes.json();
        if (metaData && metaData.webViewLink) {
          webViewLink = metaData.webViewLink;
        }
      } else {
        const errorData = await getMetaRes.json();
        throw new Error(errorData.error?.message || 'No se pudo acceder a la planilla. Asegúrate de que el enlace sea correcto y tengas permisos de acceso.');
      }

      // Save to Firestore
      const lastSyncedStr = sheetConfig?.lastSynced || null;
      await setDoc(doc(db, `users/${user.uid}/settings/googlesheets`), {
        id: spreadsheetId,
        url: webViewLink,
        lastSynced: lastSyncedStr,
        customTabName: tabName
      });

      alert('¡Planilla vinculada con éxito! Ahora se sincronizará o recuperará usando esta planilla.');
      setShowSheetsModal(false);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al vincular la planilla.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const importFromGoogleSheets = async () => {
    if (!user) return;
    setIsImportingSheets(true);
    setImportProgress('Verificando acceso a Google Sheets...');

    const formatTo10CharDate = (rawDate: string): string => {
      if (!rawDate) return new Date().toISOString().split('T')[0];
      let clean = rawDate.trim();
      
      const yyyymmddRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (yyyymmddRegex.test(clean)) {
        return clean;
      }
      
      const parts = clean.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          const y = parts[0];
          const m = parts[1].padStart(2, '0');
          const d = parts[2].padStart(2, '0');
          return `${y}-${m}-${d}`;
        } else {
          let first = parts[0].padStart(2, '0');
          let second = parts[1].padStart(2, '0');
          let third = parts[2];
          if (third.length === 2) {
            third = '20' + third;
          }
          return `${third}-${second}-${first}`;
        }
      }
      
      try {
        const parsed = new Date(clean);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error("Failed to parse date:", rawDate);
      }
      return new Date().toISOString().split('T')[0];
    };

    let token = googleAccessToken;

    try {
      let spreadsheetId = customSheetsUrlOrId || sheetConfig?.id || '';
      let tabName = customTabName.trim() || 'Control de Finanzas';

      spreadsheetId = extractSpreadsheetId(spreadsheetId);
      if (!spreadsheetId) {
        throw new Error('Primero debes introducir el enlace o ID de tu planilla existente.');
      }

      if (!token) {
        const sheetsProvider = new GoogleAuthProvider();
        sheetsProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
        sheetsProvider.addScope('https://www.googleapis.com/auth/drive.file');

        const result = await signInWithPopup(auth, sheetsProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          token = credential.accessToken;
          setGoogleAccessToken(token);
        } else {
          throw new Error('No se pudo obtener el token de acceso de Google con permisos de Sheets.');
        }
      }

      setImportProgress('Obteniendo datos de la planilla...');
      const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:Z10000`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!getRes.ok) {
        const errorData = await getRes.json();
        throw new Error(errorData.error?.message || `No se pudo obtener datos de la pestaña "${tabName}". Verifica que el nombre de la pestaña sea exacto.`);
      }

      const response = await getRes.json();
      const rows = response.values as any[][];

      if (!rows || rows.length <= 1) {
        throw new Error(`La pestaña "${tabName}" no contiene filas con datos para importar.`);
      }

      setImportProgress('Analizando registros...');

      // Find headers
      const headers = rows[0].map((h: any) => (h || '').toString().toLowerCase().trim());
      const dateIdx = headers.findIndex((h: string) => h.includes('fech') || h.includes('date'));
      const typeIdx = headers.findIndex((h: string) => h.includes('tip') || h.includes('type'));
      const catIdx = headers.findIndex((h: string) => h.includes('cat'));
      const amountIdx = headers.findIndex((h: string) => h.includes('mont') || h.includes('val') || h.includes('cant') || h.includes('amou'));
      const descIdx = headers.findIndex((h: string) => h.includes('desc') || h.includes('det'));
      const idIdx = headers.findIndex((h: string) => h === 'id' || h.includes('identif'));

      const dIdx = dateIdx !== -1 ? dateIdx : 0;
      const tIdx = typeIdx !== -1 ? typeIdx : 1;
      const cIdx = catIdx !== -1 ? catIdx : 2;
      const aIdx = amountIdx !== -1 ? amountIdx : 3;
      const dsIdx = descIdx !== -1 ? descIdx : 4;
      const iIdx = idIdx !== -1 ? idIdx : 5;

      let importedCount = 0;
      setImportProgress(`Guardando transacciones en la base de datos...`);

      // Let's import all rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || !row[dIdx]) continue;

        const rawDate = row[dIdx].toString().trim();
        const rawType = (row[tIdx] || 'gasto').toString().toLowerCase().trim();
        const category = (row[cIdx] || 'Otros').toString().trim();
        
        // Parse amount robustly
        let rawAmountStr = (row[aIdx] || '0').toString().trim();
        let cleanAmountStr = rawAmountStr.replace(/[^0-9,.-]/g, '');
        let amountVal = 0;
        if (cleanAmountStr.includes(',') && cleanAmountStr.includes('.')) {
          if (cleanAmountStr.indexOf('.') < cleanAmountStr.indexOf(',')) {
            amountVal = parseFloat(cleanAmountStr.replace(/\./g, '').replace(',', '.'));
          } else {
            amountVal = parseFloat(cleanAmountStr.replace(/,/g, ''));
          }
        } else if (cleanAmountStr.includes(',')) {
          amountVal = parseFloat(cleanAmountStr.replace(',', '.'));
        } else {
          amountVal = parseFloat(cleanAmountStr);
        }

        if (isNaN(amountVal)) amountVal = 0;

        const description = (row[dsIdx] || 'Importado de Sheets').toString().trim();
        let txId = (row[iIdx] || '').toString().trim();
        if (!txId) {
          txId = crypto.randomUUID();
        }

        // Map type
        let txType: TransactionType = 'expense';
        if (rawType.includes('ingres') || rawType.includes('inco')) {
          txType = 'income';
        } else if (rawType.includes('reembol') || rawType.includes('refu')) {
          txType = 'refund';
        } else if (rawType.includes('ahorr') || rawType.includes('savi') || rawType.includes('guar')) {
          txType = 'saving';
        }

        // Save to Firestore
        const txPath = `users/${user.uid}/transactions/${txId}`;
        await setDoc(doc(db, txPath), {
          userId: user.uid,
          type: txType,
          amount: amountVal,
          category: category,
          description: description,
          date: formatTo10CharDate(rawDate),
          createdAt: new Date()
        });

        importedCount++;
        if (importedCount % 15 === 0 || importedCount === rows.length - 1) {
          setImportProgress(`Importando transacciones: ${importedCount} guardadas...`);
        }
      }

      // Save sheets settings config too
      const lastSyncedStr = new Date().toLocaleString('es-AR');
      await setDoc(doc(db, `users/${user.uid}/settings/googlesheets`), {
        id: spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        lastSynced: lastSyncedStr,
        customTabName: tabName
      });

      showToast(`¡Recuperación exitosa! Se importaron ${importedCount} transacciones de tu planilla directamente a la base de datos de Firebase.`, 'success');
      alert(`¡Recuperación exitosa! Se importaron ${importedCount} transacciones de tu planilla directamente a Firebase Firestore.`);
      setShowSheetsModal(false);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al recuperar e importar registros.');
    } finally {
      setIsImportingSheets(false);
      setImportProgress(null);
    }
  };

  const syncToGoogleSheets = async (targetSpreadsheetId?: string, targetTabName?: string) => {
    if (!user) return;
    setIsSyncingSheets(true);
    setSheetsSyncError(null);

    let token = googleAccessToken;

    try {
      // If we don't have a token, we must request one with Google Sheets scopes (incremental consent)
      if (!token) {
        const sheetsProvider = new GoogleAuthProvider();
        sheetsProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
        sheetsProvider.addScope('https://www.googleapis.com/auth/drive.file');

        const result = await signInWithPopup(auth, sheetsProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          token = credential.accessToken;
          setGoogleAccessToken(token);
        } else {
          throw new Error('No se pudo obtener el token de acceso de Google con permisos de Sheets.');
        }
      }

      let spreadsheetId = targetSpreadsheetId || customSheetsUrlOrId || sheetConfig?.id || '';
      let webViewLink = sheetConfig?.url || '';
      let tabName = targetTabName || customTabName || sheetConfig?.customTabName || 'Control de Finanzas';

      // Clean inputs
      spreadsheetId = extractSpreadsheetId(spreadsheetId);
      tabName = tabName.trim() || 'Control de Finanzas';

      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      if (!spreadsheetId) {
        // Search or create a spreadsheet named 'Mis Finanzas Personales'
        const queryStr = encodeURIComponent("name = 'Mis Finanzas Personales' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${queryStr}&fields=files(id,name,webViewLink)`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!searchRes.ok) {
          const errorData = await searchRes.json();
          throw new Error(errorData.error?.message || 'Error al buscar la planilla en tu Google Drive.');
        }

        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          spreadsheetId = searchData.files[0].id;
          webViewLink = searchData.files[0].webViewLink;
        } else {
          const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
              properties: {
                title: 'Mis Finanzas Personales'
              }
            })
          });

          if (!createRes.ok) {
            const errorData = await createRes.json();
            throw new Error(errorData.error?.message || 'Error al crear la planilla de Google Sheets en Drive.');
          }

          const createData = await createRes.json();
          spreadsheetId = createData.spreadsheetId;
          webViewLink = createData.spreadsheetUrl;
        }
      } else {
        // Fetch spreadsheet metadata to get the actual webViewLink
        const getMetaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=webViewLink`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (getMetaRes.ok) {
          const metaData = await getMetaRes.json();
          webViewLink = metaData.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        } else {
          webViewLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        }
      }

      // Check if the tab (sheet name) exists in the spreadsheet
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!metaRes.ok) {
        const errorData = await metaRes.json();
        throw new Error(errorData.error?.message || 'Error al verificar la planilla. Asegúrate de tener permisos de acceso y edición, y de que el enlace sea correcto.');
      }

      const metaData = await metaRes.json();
      const existingSheets = metaData.sheets?.map((s: any) => s.properties?.title) || [];
      const tabExists = existingSheets.includes(tabName);

      if (!tabExists) {
        // Create the individual sheet/tab inside the spreadsheet
        const addSheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: tabName
                  }
                }
              }
            ]
          })
        });

        if (!addSheetRes.ok) {
          const errorData = await addSheetRes.json();
          throw new Error(errorData.error?.message || `Error al crear la pestaña "${tabName}" en el archivo.`);
        }
      }

      // Clear existing values inside ONLY that specific tab: tabName + '!A1:Z10000'
      const clearRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:Z10000:clear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!clearRes.ok) {
        const errorData = await clearRes.json();
        throw new Error(errorData.error?.message || `Error al borrar los datos antiguos de la pestaña "${tabName}".`);
      }

      // Formulate the transaction entries
      const sortedTransactions = [...filteredTransactions].sort((a, b) => {
        return a.date.localeCompare(b.date);
      });

      const cols = ['Fecha', 'Tipo', 'Categoría', 'Monto', 'Descripción', 'ID'];
      const rows = sortedTransactions.map(t => [
        t.date,
        t.type === 'expense' ? 'Gasto' : t.type === 'income' ? 'Ingreso' : t.type === 'refund' ? 'Reembolso' : 'Ahorro',
        t.category,
        t.amount,
        t.description || '',
        t.id
      ]);

      const values = [cols, ...rows];

      // Update values in range tabName + '!A1'
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
          range: `${tabName}!A1`,
          majorDimension: 'ROWS',
          values: values
        })
      });

      if (!updateRes.ok) {
        const errorData = await updateRes.json();
        throw new Error(errorData.error?.message || 'Error al guardar los datos en las celdas.');
      }

      // Save back to Firestore
      const lastSyncedStr = new Date().toLocaleString('es-AR');
      await setDoc(doc(db, `users/${user.uid}/settings/googlesheets`), {
        id: spreadsheetId,
        url: webViewLink,
        lastSynced: lastSyncedStr,
        customTabName: tabName
      });

      alert(`¡Sincronización exitosa en la pestaña "${tabName}"!`);
      return true;
    } catch (error) {
      console.error("Error syncing Google Sheets:", error);
      setSheetsSyncError(error instanceof Error ? error.message : 'Error desconocido al sincronizar.');
      return false;
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Chart Data
  const chartPieData = useMemo(() => {
    if (!expandedBox || expandedBox === 'balance') {
      // Default: Gastos + Ahorros
      const expenses = filteredTransactions.filter(t => t.type === 'expense' || t.type === 'saving');
      const grouped = expenses.reduce((acc, curr) => {
        const categoryName = getGroupedCategory(curr.category, curr.type, curr.description);
        acc[categoryName] = (acc[categoryName] || 0) + curr.amount;
        return acc;
      }, {} as Record<string, number>);
      return Object.entries(grouped)
        .map(([name, value]) => ({ name, value: Number(value) }))
        .sort((a, b) => b.value - a.value);
    }
    
    // If a box is expanded, show its categories
    return boxBreakdown || [];
  }, [expandedBox, filteredTransactions, boxBreakdown]);

  const COLORS = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];

  const chartBarData = useMemo(() => {
    if (!expandedBox || expandedBox === 'balance') {
      return [
        { name: 'Ingresos', valor: totalIncome + totalRefund, fill: '#10b981' },
        { name: 'Gastos', valor: totalExpense, fill: '#ef4444' },
        { name: 'Ahorros', valor: totalSaving, fill: '#8b5cf6' }
      ];
    }
    
    // If a box is expanded, show top categories for that box
    return (boxBreakdown || []).slice(0, 8).map((item, index) => ({
      name: item.name,
      valor: item.value,
      fill: COLORS[index % COLORS.length]
    }));
  }, [expandedBox, totalIncome, totalRefund, totalExpense, totalSaving, boxBreakdown]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 max-w-md w-full text-center">
          <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-4 rounded-2xl inline-block mb-6">
            <Wallet size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">Control de Finanzas</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">Entrá con Google para ver las mismas finanzas en la computadora y el celular, también con datos móviles.</p>
          {loginError && (
            <p className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 mb-4">{loginError}</p>
          )}
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 px-4 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium"
          >
            <LogIn size={18} />
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans pb-12 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 sticky top-0 z-10 transition-colors duration-200">
        {accessUrls[0] && (
          <p className="max-w-7xl mx-auto mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            En el celular (Safari): abrí {accessUrls[0]} → Compartir → Agregar a inicio
          </p>
        )}
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-2 rounded-xl">
              <Wallet size={24} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight hidden sm:block">Control de Finanzas</h1>
            {accessUrls[0] && (
              <p className="hidden lg:block text-xs text-zinc-500 truncate max-w-xs">
                Celular: {accessUrls[0]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden md:flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-xl">
              <Filter size={16} className="text-zinc-500 dark:text-zinc-400" />
              <div className="flex items-center gap-3">
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="bg-transparent text-sm font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                >
                  <option value="all">Todo el tiempo</option>
                  <option value="year">Este año</option>
                  <option value="month">Este mes</option>
                  <option value="week">Últimos 7 días</option>
                  <option value="custom">Personalizado</option>
                </select>
                {timeFilter === 'custom' && (
                  <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-700 pl-3 animate-in fade-in slide-in-from-left-2 duration-200">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                    />
                    <span className="text-zinc-400 text-xs">a</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => isMPLinked ? handleMPSync() : setShowMPModal(true)}
              disabled={isSyncingMP}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                isMPLinked 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              } ${isSyncingMP ? 'opacity-70 cursor-not-allowed' : ''}`}
              title={isMPLinked ? "Cuenta vinculada (clic para sincronizar)" : "Vincular cuenta"}
            >
              {isSyncingMP ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <MercadoPagoIcon size={16} />
              )}
              <span className="hidden sm:inline">
                {isSyncingMP ? 'Sincronizando...' : isMPLinked ? 'Cuenta vinculada' : 'Vincular cuenta'}
              </span>
            </button>
            {sheetConfig && (
              <a
                href={sheetConfig.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                title={`Última sincronización: ${sheetConfig.lastSynced}`}
              >
                <FileSpreadsheet size={16} />
                <span>Ver Planilla</span>
                <ExternalLink size={12} />
              </a>
            )}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="hidden sm:flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                title="Exportar datos"
              >
                <Download size={16} />
                <span>Exportar</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showExportDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showExportDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowExportDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        exportToCSV();
                        setShowExportDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Download size={14} />
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={() => {
                        exportToExcel();
                        setShowExportDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <CreditCard size={14} />
                      <span>Excel</span>
                    </button>
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                    <button
                      onClick={() => {
                        if (!sheetConfig) {
                          setShowSheetsModal(true);
                        } else {
                          syncToGoogleSheets();
                        }
                        setShowExportDropdown(false);
                      }}
                      disabled={isSyncingSheets}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                      title={sheetConfig ? `Última sincronización: ${sheetConfig.lastSynced}` : "Sincronizar planilla en Google Drive"}
                    >
                      <FileSpreadsheet size={14} className={isSyncingSheets ? "animate-spin text-emerald-500" : "text-emerald-500"} />
                      <span>{isSyncingSheets ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowSheetsModal(true);
                        setShowExportDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Settings size={14} className="text-zinc-500" />
                      <span>Ajustes de Sheets</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 pl-2 sm:pl-4 sm:border-l border-zinc-200 dark:border-zinc-800">
              {isLocalUser(user) ? (
                <button
                  onClick={handleLogin}
                  className="text-xs font-medium px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  title="Sincronizar con Google"
                >
                  Sincronizar
                </button>
              ) : (
                <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800" />
              )}
              <button
                onClick={handleLogout}
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Filter */}
        <div className="md:hidden mt-4 space-y-3">
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-xl">
            <Filter size={16} className="text-zinc-500 dark:text-zinc-400" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="bg-transparent text-sm font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer w-full"
            >
              <option value="all">Todo el tiempo</option>
              <option value="year">Este año</option>
              <option value="month">Este mes</option>
              <option value="week">Últimos 7 días</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {timeFilter === 'custom' && (
            <div className="flex items-center justify-between gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer w-full"
              />
              <span className="text-zinc-400 text-xs px-2">a</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer w-full"
              />
            </div>
          )}
          {sheetConfig && (
            <a
              href={sheetConfig.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-4 py-2 rounded-xl text-sm font-medium transition-all animate-in fade-in duration-200"
              title={`Última sincronización: ${sheetConfig.lastSynced}`}
            >
              <FileSpreadsheet size={16} />
              <span>Ver Planilla en Sheets</span>
              <ExternalLink size={12} />
            </a>
          )}
          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="w-full flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Download size={16} />
              <span>Exportar datos</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showExportDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showExportDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowExportDropdown(false)}
                />
                <div className="absolute left-0 right-0 bottom-full mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-20 animate-in fade-in slide-in-from-bottom-2 duration-100">
                  <button
                    onClick={() => {
                      exportToCSV();
                      setShowExportDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Download size={16} />
                    <span>Descargar CSV</span>
                  </button>
                  <div className="h-px bg-zinc-200 dark:border-zinc-800 mx-2" />
                  <button
                    onClick={() => {
                      exportToExcel();
                      setShowExportDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <CreditCard size={16} />
                    <span>Descargar Excel</span>
                  </button>
                  <div className="h-px bg-zinc-200 dark:border-zinc-800 mx-2" />
                  <button
                    onClick={() => {
                      if (!sheetConfig) {
                        setShowSheetsModal(true);
                      } else {
                        syncToGoogleSheets();
                      }
                      setShowExportDropdown(false);
                    }}
                    disabled={isSyncingSheets}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    <FileSpreadsheet size={16} className={isSyncingSheets ? "animate-spin text-emerald-500" : "text-emerald-500"} />
                    <span>{isSyncingSheets ? 'Sincronizando Sheets...' : 'Sincronizar con Google Sheets'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowSheetsModal(true);
                      setShowExportDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Settings size={16} className="text-zinc-500" />
                    <span>Ajustes de Google Sheets</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {sheetsSyncError && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex items-center justify-between gap-3 text-sm text-red-700 dark:text-red-400 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Error al sincronizar con Sheets:</span>
              <span>{sheetsSyncError}</span>
            </div>
            <button 
              onClick={() => setSheetsSyncError(null)}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg animate-in fade-in"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div 
            className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border transition-all cursor-pointer ${
              expandedBox === 'balance' ? 'border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
            onClick={() => setExpandedBox(expandedBox === 'balance' ? null : 'balance')}
          >
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Disponible</p>
            <p className={`text-3xl font-light tracking-tight ${balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
          
          <div 
            className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border transition-all relative group cursor-pointer ${
              expandedBox === 'saving' ? 'border-violet-500 ring-1 ring-violet-500' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
            onClick={(e) => {
              if (isEditingSavings) return;
              setExpandedBox(expandedBox === 'saving' ? null : 'saving');
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <PiggyBank size={16} className="text-violet-500 dark:text-violet-400" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Ahorros</p>
              </div>
              {!isEditingSavings && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSavingsInput(totalSaving.toString());
                    setIsEditingSavings(true);
                    setExpandedBox(null);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 transition-all"
                  title="Ajustar ahorros"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            {isEditingSavings ? (
              <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="number"
                    value={savingsInput}
                    onChange={(e) => setSavingsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavingsAdjustment();
                      if (e.key === 'Escape') setIsEditingSavings(false);
                    }}
                    onBlur={handleSavingsAdjustment}
                    className="text-2xl font-light tracking-tight text-violet-600 dark:text-violet-400 bg-zinc-50 dark:bg-zinc-800 border-none outline-none w-full p-0"
                  />
                </div>
                {exchangeRate > 0 && (
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    Equiv. USD ({rateType === 'custom' ? 'Propio' : rateType.toUpperCase()}): {(Number(savingsInput) / exchangeRate).toFixed(2)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-3xl font-light tracking-tight text-violet-600 dark:text-violet-400">
                {formatCurrency(totalSaving)}
              </p>
            )}
          </div>

          <div 
            className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border transition-all relative group cursor-pointer ${
              expandedBox === 'income' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
            onClick={() => {
              if (isEditingIncome) return;
              setExpandedBox(expandedBox === 'income' ? null : 'income');
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ArrowUpCircle size={16} className="text-emerald-500 dark:text-emerald-400" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Ingresos</p>
              </div>
              {!isEditingIncome && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIncomeInput(totalIncome.toString());
                    setIsEditingIncome(true);
                    setExpandedBox(null);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 transition-all"
                  title="Ajustar ingresos"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            {isEditingIncome ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  type="number"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleIncomeAdjustment();
                    if (e.key === 'Escape') setIsEditingIncome(false);
                  }}
                  onBlur={handleIncomeAdjustment}
                  className="text-2xl font-light tracking-tight text-emerald-600 dark:text-emerald-400 bg-zinc-50 dark:bg-zinc-800 border-none outline-none w-full p-0"
                />
              </div>
            ) : (
              <p className="text-3xl font-light tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalIncome)}
              </p>
            )}
          </div>

          <div 
            className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border transition-all relative group cursor-pointer ${
              expandedBox === 'expense' ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
            onClick={() => {
              if (isEditingExpense) return;
              setExpandedBox(expandedBox === 'expense' ? null : 'expense');
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ArrowDownCircle size={16} className="text-red-500 dark:text-red-400" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Gastos</p>
              </div>
              {!isEditingExpense && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpenseInput(totalExpense.toString());
                    setIsEditingExpense(true);
                    setExpandedBox(null);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 transition-all"
                  title="Ajustar gastos"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            {isEditingExpense ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  type="number"
                  value={expenseInput}
                  onChange={(e) => setExpenseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExpenseAdjustment();
                    if (e.key === 'Escape') setIsEditingExpense(false);
                  }}
                  onBlur={handleExpenseAdjustment}
                  className="text-2xl font-light tracking-tight text-red-600 dark:text-red-400 bg-zinc-50 dark:bg-zinc-800 border-none outline-none w-full p-0"
                />
              </div>
            ) : (
              <p className="text-3xl font-light tracking-tight text-red-600 dark:text-red-400">
                {formatCurrency(totalExpense)}
              </p>
            )}
          </div>

          <div 
            className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border transition-all cursor-pointer ${
              expandedBox === 'refund' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
            onClick={() => setExpandedBox(expandedBox === 'refund' ? null : 'refund')}
          >
            <div className="flex items-center gap-2 mb-1">
              <RefreshCcw size={16} className="text-blue-500 dark:text-blue-400" />
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Reembolsos</p>
            </div>
            <p className="text-3xl font-light tracking-tight text-blue-600 dark:text-blue-400">
              {formatCurrency(totalRefund)}
            </p>
          </div>
        </div>

        {/* Breakdown Section */}
        {expandedBox && expandedBox !== 'balance' && boxBreakdown && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Desglose de {
                  expandedBox === 'saving' ? 'Ahorros' : 
                  expandedBox === 'income' ? 'Ingresos' : 
                  expandedBox === 'expense' ? 'Gastos' : 'Reembolsos'
                }
                {expandedBox === 'saving' && exchangeRate > 0 && (
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full ml-2">
                    Total USD ({rateType === 'custom' ? 'Propio' : rateType.toUpperCase()}): {(totalSaving / exchangeRate).toFixed(2)}
                  </span>
                )}
              </h3>
              <button 
                onClick={() => setExpandedBox(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {boxBreakdown.map((item, idx) => (
                <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">{item.name}</p>
                  <p className="text-xl font-medium">{formatDisplayValue(item.value, item.name)}</p>
                  <div className="mt-2 w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        expandedBox === 'saving' ? 'bg-violet-500' : 
                        expandedBox === 'income' ? 'bg-emerald-500' : 
                        expandedBox === 'expense' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ 
                        width: `${(() => {
                          const total = (
                            expandedBox === 'saving' ? totalSaving : 
                            expandedBox === 'income' ? totalIncome : 
                            expandedBox === 'expense' ? totalExpense : totalRefund
                          );
                          if (total === 0) return 0;
                          return (item.value / total) * 100;
                        })()}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
              {boxBreakdown.length === 0 && (
                <p className="col-span-full text-center py-8 text-zinc-500">No hay datos para mostrar en este período.</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold mb-6">Nueva Transacción</h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Type Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-2 text-sm font-medium rounded-lg transition-colors ${
                      type === 'expense' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-2 text-sm font-medium rounded-lg transition-colors ${
                      type === 'income' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Ingreso
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('refund')}
                    className={`py-2 text-sm font-medium rounded-lg transition-colors ${
                      type === 'refund' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Reembolso
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('saving')}
                    className={`py-2 text-sm font-medium rounded-lg transition-colors ${
                      type === 'saving' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Ahorro
                  </button>
                </div>

                {/* Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Monto</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-zinc-500 dark:text-zinc-400 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="block w-full pl-7 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Moneda</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign size={16} className="text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')}
                        className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all outline-none appearance-none"
                      >
                        <option value="ARS">ARS (Pesos)</option>
                        <option value="USD">USD (Dólares)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {currency === 'USD' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setRateType('blue')}
                        className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                          rateType === 'blue' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        Blue
                      </button>
                      <button
                        type="button"
                        onClick={() => setRateType('mep')}
                        className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                          rateType === 'mep' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        MEP
                      </button>
                      <button
                        type="button"
                        onClick={() => setRateType('custom')}
                        className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                          rateType === 'custom' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        Propio
                      </button>
                    </div>

                    {rateType === 'custom' ? (
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Edit2 size={14} className="text-zinc-400 dark:text-zinc-500" />
                        </div>
                        <input
                          type="number"
                          value={customRate}
                          onChange={(e) => setCustomRate(e.target.value)}
                          className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none text-sm"
                          placeholder="Tipo de cambio acordado"
                        />
                      </div>
                    ) : (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                          <RefreshCw size={14} className={isFetchingRate ? 'animate-spin' : ''} />
                          <span>Cambio {rateType === 'blue' ? 'Blue' : 'MEP'}: <strong>{formatCurrency(exchangeRate)}</strong></span>
                        </div>
                        <div className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                          Total: {formatCurrency(Number(amount) * exchangeRate)}
                        </div>
                      </div>
                    )}
                    
                    {rateType === 'custom' && Number(amount) > 0 && Number(customRate) > 0 && (
                      <div className="px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400 flex justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                        <span>Total convertido:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(Number(amount) * Number(customRate))}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Categoría</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Tag size={16} className="text-zinc-400 dark:text-zinc-500" />
                    </div>
                    {isCustomCategory ? (
                      <div className="flex items-center">
                        <input
                          type="text"
                          required
                          value={customCategoryName}
                          onChange={(e) => setCustomCategoryName(e.target.value)}
                          className="block w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all outline-none"
                          placeholder="Escribe tu categoría..."
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(false);
                            setCustomCategoryName('');
                            setCategory(DEFAULT_CATEGORIES[type][0]);
                          }}
                          className="absolute right-2 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={category}
                        onChange={(e) => {
                          if (e.target.value === 'custom_new') {
                            setIsCustomCategory(true);
                          } else {
                            setCategory(e.target.value);
                          }
                        }}
                        className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all outline-none appearance-none"
                      >
                        {DEFAULT_CATEGORIES[type].map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        {(customCategories[type] || []).map((cat) => (
                          <option key={`custom-${cat}`} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="custom_new" className="font-semibold text-zinc-900 dark:text-zinc-100">
                          + Agregar personalizada...
                        </option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Descripción (Opcional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <AlignLeft size={16} className="text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all outline-none"
                      placeholder="Ej. Cena con amigos"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Fecha</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar size={16} className="text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all outline-none"
                    />
                  </div>
                </div>

                {!editingId && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="recurring"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-zinc-100"
                    />
                    <label htmlFor="recurring" className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      Hacer recurrente (mensual)
                    </label>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 px-4 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium mt-2"
                  >
                    {editingId ? <RefreshCw size={18} /> : <Plus size={18} />}
                    {editingId ? 'Actualizar' : 'Agregar Transacción'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setAmount('');
                        setDescription('');
                      }}
                      className="flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 py-3 px-4 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium mt-2"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Transactions List Section */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <h2 className="text-lg font-semibold whitespace-nowrap">Historial de Transacciones</h2>
                  
                  <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-all duration-200 w-full sm:w-64">
                    <Search size={14} className="text-zinc-400 dark:text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 outline-none w-full"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {filteredTransactions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.length === filteredTransactions.length && filteredTransactions.length > 0}
                        onChange={toggleAllTransactionsSelection}
                        className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-zinc-100 cursor-pointer"
                        title="Seleccionar todas"
                      />
                      {selectedTransactionIds.length > 0 && (
                        <button
                          onClick={handleDeleteSelected}
                          className="text-xs flex items-center gap-1 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          <Trash2 size={14} />
                          Eliminar ({selectedTransactionIds.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                  {filteredTransactions.length} registros
                </span>
              </div>
              
              {filteredTransactions.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                  <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-full mb-4">
                    <Wallet size={32} className="text-zinc-300 dark:text-zinc-600" />
                  </div>
                  <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">No hay transacciones</p>
                  <p className="text-sm">No se encontraron registros para este período.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[600px] overflow-y-auto">
                  {filteredTransactions.map((t) => (
                    <div key={t.id} className={`p-4 sm:px-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between group ${selectedTransactionIds.includes(t.id) ? 'bg-zinc-50 dark:bg-zinc-800/30' : ''}`}>
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={selectedTransactionIds.includes(t.id)}
                          onChange={() => toggleTransactionSelection(t.id)}
                          className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-zinc-100 cursor-pointer"
                        />
                        <div className={`p-3 rounded-full flex-shrink-0 ${
                          t.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                          t.type === 'expense' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                          t.type === 'saving' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' :
                          'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}>
                          {t.type === 'income' && <ArrowUpCircle size={20} />}
                          {t.type === 'expense' && <ArrowDownCircle size={20} />}
                          {t.type === 'refund' && <RefreshCcw size={20} />}
                          {t.type === 'saving' && <PiggyBank size={20} />}
                        </div>
                        
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{t.category}</p>
                          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                            <span>{t.description}</span>
                            <span>•</span>
                            <span>{new Date(t.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`font-medium whitespace-nowrap ${
                          t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' :
                          t.type === 'expense' ? 'text-red-600 dark:text-red-400' :
                          t.type === 'saving' ? 'text-violet-600 dark:text-violet-400' :
                          'text-blue-600 dark:text-blue-400'
                        }`}>
                          {(() => {
                            const isNegative = t.amount < 0;
                            const absAmount = Math.abs(t.amount);
                            if (t.type === 'income' || t.type === 'refund') {
                              return (isNegative ? '-' : '+') + formatCurrency(absAmount);
                            } else {
                              // expense or saving
                              return (isNegative ? '+' : '-') + formatCurrency(absAmount);
                            }
                          })()}
                        </span>
                        <div className="flex opacity-0 group-hover:opacity-100 transition-all focus-within:opacity-100">
                          <button
                            onClick={() => handleEdit(t)}
                            className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metrics & Charts Section */}
        {filteredTransactions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 size={20} className="text-zinc-400 dark:text-zinc-500" />
                <h2 className="text-lg font-semibold">
                  {expandedBox === 'saving' ? 'Ahorros por Categoría' : 
                   expandedBox === 'income' ? 'Ingresos por Categoría' : 
                   expandedBox === 'expense' ? 'Gastos por Categoría' : 
                   expandedBox === 'refund' ? 'Reembolsos por Categoría' : 'Resumen General'}
                </h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartBarData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#3f3f46" : "#e4e4e7"} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#a1a1aa' : '#71717a' }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} width={80} tick={{ fill: isDarkMode ? '#a1a1aa' : '#71717a' }} />
                    <Tooltip 
                      formatter={(value: number, _name: string, props: any) => [formatDisplayValue(value, props.payload.name), 'Monto']}
                      cursor={{ fill: isDarkMode ? '#27272a' : '#f4f4f5' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDarkMode ? '#18181b' : '#ffffff', color: isDarkMode ? '#f4f4f5' : '#18181b' }}
                      itemStyle={{ color: isDarkMode ? '#f4f4f5' : '#18181b' }}
                      labelStyle={{ color: isDarkMode ? '#a1a1aa' : '#71717a' }}
                    />
                    <Bar dataKey="valor" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center gap-2 mb-6">
                <PieChartIcon size={20} className="text-zinc-400 dark:text-zinc-500" />
                <h2 className="text-lg font-semibold">
                  {expandedBox === 'saving' ? 'Distribución de Ahorros' : 
                   expandedBox === 'income' ? 'Distribución de Ingresos' : 
                   expandedBox === 'expense' ? 'Distribución de Gastos' : 
                   expandedBox === 'refund' ? 'Distribución de Reembolsos' : 'Gastos por Categoría'}
                </h2>
              </div>
              {chartPieData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={chartPieData.slice(0, 10)}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? "#3f3f46" : "#e4e4e7"} />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: isDarkMode ? '#a1a1aa' : '#71717a', fontSize: 12 }}
                        width={100}
                      />
                      <Tooltip 
                        formatter={(value: number, _name: string, props: any) => [formatDisplayValue(value, props.payload.name), 'Monto']}
                        cursor={{ fill: isDarkMode ? '#27272a' : '#f4f4f5' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDarkMode ? '#18181b' : '#ffffff', color: isDarkMode ? '#f4f4f5' : '#18181b' }}
                        itemStyle={{ color: isDarkMode ? '#f4f4f5' : '#18181b' }}
                        labelStyle={{ color: isDarkMode ? '#a1a1aa' : '#71717a' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 text-center">
                  No hay datos registrados para analizar en esta sección.
                </div>
              )}
            </div>
          </div>
        )}

        {filteredTransactions.length > 0 && (
          <FinancialAnalysis 
            transactions={filteredTransactions} 
            balance={balance} 
            periodLabel={timeFilter === 'all' ? 'Todo' : timeFilter === 'month' ? 'Mes' : 'Semana'} 
            expandedBox={expandedBox}
          />
        )}
      </main>
      
      {showMPModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <MercadoPagoIcon size={32} />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Vincular Mercado Pago</h3>
            </div>
            
            {!isMPLinked ? (
              <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                Al vincular tu cuenta, tus transacciones recientes se sincronizarán automáticamente con la aplicación.
              </p>
            ) : (
              <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                Tu cuenta de Mercado Pago está vinculada. ¿Deseas desvincularla?
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowMPModal(false)} 
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={isMPLinked ? handleMPDisconnect : handleMPConnect} 
                className={`px-4 py-2 rounded-xl text-white font-medium transition-colors ${
                  isMPLinked ? 'bg-red-600 hover:bg-red-700' : 'bg-[#009EE3] hover:bg-[#0080B7]'
                }`}
              >
                {isMPLinked ? 'Desvincular' : 'Conectar con Mercado Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSheetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-lg w-full shadow-xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={24} />
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Configurar Google Sheets</h3>
              </div>
              <button 
                onClick={() => setShowSheetsModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {sheetConfig ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 text-xs space-y-1.5">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Planilla actualmente vinculada:</p>
                  <p className="text-zinc-600 dark:text-zinc-400 truncate">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Enlace: </span>
                    <a href={sheetConfig.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-600">
                      {sheetConfig.url}
                    </a>
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Pestaña activa: </span>
                    "{sheetConfig.customTabName || 'Control de Finanzas'}"
                  </p>
                  {sheetConfig.lastSynced && (
                    <p className="text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">Última sincronización: </span>
                      {sheetConfig.lastSynced}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-4 text-xs text-zinc-600 dark:text-zinc-400">
                  No hay ninguna planilla vinculada. Si dejas el enlace vacío, buscaremos o crearemos una planilla llamada <span className="font-semibold text-zinc-800 dark:text-zinc-200">"Mis Finanzas Personales"</span> de forma automática.
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Enlace o ID de tu planilla existente (opcional):
                </label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={customSheetsUrlOrId}
                  onChange={(e) => setCustomSheetsUrlOrId(e.target.value)}
                  className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  Pega la URL de tu planilla de finanzas personal para vincular el sistema directamente a ella.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nombre de la pestaña para exportar datos:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Control de Finanzas"
                  value={customTabName}
                  onChange={(e) => setCustomTabName(e.target.value)}
                  className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  Se creará esta pestaña en tu planilla (si no existe) y se sincronizarán únicamente los registros en ella. El resto de las pestañas no se verán afectadas.
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-xl p-3 text-[11px] text-amber-800 dark:text-amber-400 leading-relaxed">
                <span className="font-semibold block mb-0.5">⚠️ Nota importante sobre permisos de Google:</span>
                Como esta aplicación es de uso personal y se encuentra en desarrollo, la primera vez que intentes sincronizar verás una advertencia de Google ("Google no verificó esta app"). Haz clic en <span className="font-bold">Configuración Avanzada</span> y luego en <span className="font-bold">Ir a [Nombre de App] (no seguro)</span> para autorizar la sincronización de archivos.
              </div>

              {importProgress && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-pulse">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent" />
                  <span>{importProgress}</span>
                </div>
              )}

              {customSheetsUrlOrId && (
                <div className="border border-zinc-150 dark:border-zinc-800 rounded-xl p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-800/20">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Recuperación e Importación de datos</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Si tienes transacciones guardadas en tu planilla y deseas recuperarlas en esta aplicación tras iniciar sesión, haz clic aquí. Se leerá el archivo y se cargarán los registros en la base de datos de Firebase instantáneamente.
                  </p>
                  <button
                    type="button"
                    onClick={importFromGoogleSheets}
                    disabled={isImportingSheets || isSyncingSheets || isSavingConfig}
                    className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Download size={14} className={isImportingSheets ? "animate-spin" : ""} />
                    <span>{isImportingSheets ? 'Importando desde Sheets...' : 'Importar / Recuperar datos desde Sheets'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-6">
              <div>
                {sheetConfig && (
                  <button
                    onClick={handleDisconnectSheets}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
                  >
                    Desvincular planilla
                  </button>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => setShowSheetsModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-xs font-semibold"
                >
                  Cerrar
                </button>
                <button
                  onClick={saveSheetsConfigOnly}
                  disabled={isSavingConfig || isSyncingSheets || isImportingSheets}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-950 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white transition-colors text-xs font-semibold disabled:opacity-50"
                  title="Guarda la ID de la planilla en tu base de datos Firebase sin sobrescribir ningún dato en Sheets"
                >
                  {isSavingConfig ? 'Vinculando...' : 'Vincular sin Sincronizar'}
                </button>
                <button
                  onClick={async () => {
                    if (filteredTransactions.length === 0) {
                      if (!confirm('Tu lista actual de transacciones está vacía. Si inicias la sincronización ahora, se borrarán los datos de la pestaña de Sheets para que coincidan. Si lo que quieres es recuperar tus datos de Sheets a Firebase, usa el botón "Importar / Recuperar datos desde Sheets" arriba. ¿Deseas continuar con la sincronización vacía?')) {
                        return;
                      }
                    }
                    const ok = await syncToGoogleSheets(customSheetsUrlOrId, customTabName);
                    if (ok) {
                      setShowSheetsModal(false);
                    }
                  }}
                  disabled={isSyncingSheets || isSavingConfig || isImportingSheets}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  title="Sobrescribe los datos de la hoja en Sheets con tus transacciones de Firebase"
                >
                  {isSyncingSheets ? (
                    <>
                      <FileSpreadsheet size={14} className="animate-spin" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <span>Exportar y Sincronizar</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full text-red-600 dark:text-red-400">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Eliminar Transacciones</h3>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              ¿Estás seguro de que deseas eliminar las {selectedTransactionIds.length} transacciones seleccionadas? Esta acción no se puede deshacer.
            </p>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirmModal(false)} 
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={executeDeleteSelected} 
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification HUD */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-lg border text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
              t.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-100 dark:border-emerald-900/50'
                : t.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-100 dark:border-rose-900/50'
                : 'bg-zinc-800/95 dark:bg-zinc-900/95 text-zinc-100 dark:text-zinc-200 border-zinc-700/50'
            }`}
          >
            <div className="flex items-center gap-2">
              {t.type === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              {t.type === 'error' && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              {t.type === 'info' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
