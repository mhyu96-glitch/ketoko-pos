import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { KeyRound, ShieldAlert, X } from 'lucide-react';
import { useCart } from './hooks/useCart';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { db } from './db';
import { api } from './api/client';
import { syncService } from './services/syncService';
import type { Product, Transaction, User, DebtItem, ReceivableItem, Customer, MemberDepositMutation, CartItem } from './types';
import { formatRupiah } from './services/escposService';
import { getStoreDisplayName, clampEmployeeAllowance, clampEmployeeBalance, isCustomerCardBlocked } from './utils/customerAccess';

import { Navbar } from './components/Navbar';
import { TopMenuBar, type NavView } from './components/TopMenuBar';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { PosCashierView } from './components/PosCashierView';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { RecentTransactionsModal } from './components/RecentTransactionsModal';
import { QATestModal } from './components/QATestModal';
import { LoginModal } from './components/LoginModal';
import { PrinterSettingsModal } from './components/PrinterSettingsModal';
import { RestockModal } from './components/RestockModal';
import { PurchaseOrderModal } from './components/PurchaseOrderModal';
import { MemberModal } from './components/MemberModal';
import { ShiftReportModal } from './components/ShiftReportModal';
import { NewProductModal } from './components/NewProductModal';
import { ProductPriceListView } from './components/ProductPriceListView';
import { FullReportsCenterModal } from './components/FullReportsCenterModal';
import { OmsetChartModal } from './components/OmsetChartModal';
import { CustomerSupplierModal } from './components/CustomerSupplierModal';
import { DebtReceivableModal } from './components/DebtReceivableModal';
import { PurchasesAndReturnsModal } from './components/PurchasesAndReturnsModal';
import { StockAdjustmentsModal } from './components/StockAdjustmentsModal';
import { StoreSettingsModal } from './components/StoreSettingsModal';
import { BarcodeLabelModal } from './components/BarcodeLabelModal';
import { InvoiceModal } from './components/InvoiceModal';
import { LicenseModal } from './components/LicenseModal';
import { licenseService } from './services/licenseService';
import { AppUpdateNotifierModal } from './components/AppUpdateNotifierModal';
import { checkForAppUpdates, type AppVersionInfo } from './services/updateService';
import { LanSettingsModal } from './components/LanSettingsModal';
import { lanService } from './services/lanService';
import { employeeAllowanceService } from './services/employeeAllowanceService';
import QRCode from 'qrcode';
import { SuperadminPortalView } from './components/SuperadminPortalView';
import { usePWA } from './hooks/usePWA';
import { PWAInstallModal } from './components/PWAInstallModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { ErrorMonitoringModal } from './components/ErrorMonitoringModal';
import { CashierHelpChatModal } from './components/CashierHelpChatModal';
import { 
  resolveStoreFromCurrentHost, 
  fetchStoresFromCloud, 
  saveStoresList,
  getStoredStores
} from './services/storeRegistry';
import { checkCustomerBranchAccess, normalizeStoreId, isCustomerBelongsToStoreOrCluster } from './utils/customerAccess';

function resolveInitialTerminalStore() {
  const hostStore = resolveStoreFromCurrentHost();
  const stores = getStoredStores();
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryStoreId = urlParams.get('store')?.trim();
    if (queryStoreId) {
      const matchedQuery = stores.find((s) => s.id === queryStoreId);
      return matchedQuery || { ...hostStore, id: queryStoreId, name: queryStoreId, branch: queryStoreId };
    }
    const hostname = window.location.hostname.toLowerCase();
    const isGenericHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.endsWith('.localhost');

    if (isGenericHost && hostStore.id === 'store-01') {
      const savedId = localStorage.getItem('ketoko_active_store_id')?.trim();
      if (savedId && savedId !== 'store-01') {
        const matchedSaved = stores.find((s) => s.id === savedId);
        return matchedSaved || { ...hostStore, id: savedId, name: savedId, branch: savedId };
      }
    }
  } catch {}
  return hostStore;
}

/**
 * Seed otomatis data resmi Koperasi Karyawan PT. MSL (akun kasir, produk & stok, 1.601 karyawan)
 * ke IndexedDB lokal bila masih kosong. Data lalu disegarkan dari Supabase Cloud.
 */
async function seedKoperasiMslIfNeeded(storeId: string): Promise<void> {
  if (!storeId || !storeId.startsWith('store-koperasimsl')) return;
  try {
    const isCabang = storeId === 'store-koperasimsl-cabang';
    await db.users.bulkPut([
      { id: 'usr-000', username: 'superadmin', name: 'Master Superadmin (Developer)', role: 'SUPERADMIN', branch_id: isCabang ? 'BR-03' : 'BR-02' },
      { id: 'usr-msl-admin', username: 'satria', name: 'SATRIA HARDIANSYAH', role: 'ADMIN', branch_id: isCabang ? 'BR-03' : 'BR-02' },
      isCabang
        ? { id: 'usr-msl-norbayah', username: 'norbayah', name: 'NORBAYAH', role: 'CASHIER', branch_id: 'BR-03' }
        : { id: 'usr-msl-sinta', username: 'sinta', name: 'SINTA NELA', role: 'CASHIER', branch_id: 'BR-02' }
    ] as any);
  } catch {}

  try {
    const localProds = (await db.products.toArray()).filter((p: any) => p.store_id === storeId);
    if (localProds.length === 0) {
      const res = await fetch('/data/koperasi_msl_products.json');
      if (res.ok) {
        const all = (await res.json()) as any[];
        const mine = all.filter((p) => p.store_id === storeId);
        for (let i = 0; i < mine.length; i += 500) await db.products.bulkPut(mine.slice(i, i + 500));
      }
    }
  } catch (e) {
    console.warn('[Koperasi MSL] Seed produk lokal gagal:', e);
  }

  try {
    const localEmps = (await db.customers.toArray()).filter((c: any) => c.type === 'KARYAWAN' && String(c.store_id || '').startsWith('store-koperasimsl'));
    if (localEmps.length === 0) {
      const res = await fetch('/data/koperasi_msl_employees.json');
      if (res.ok) {
        const all = (await res.json()) as any[];
        for (let i = 0; i < all.length; i += 500) await db.customers.bulkPut(all.slice(i, i + 500));
      }
    }
  } catch (e) {
    console.warn('[Koperasi MSL] Seed karyawan lokal gagal:', e);
  }

  if (navigator.onLine) {
    syncService.pullCustomersFromSupabase().catch(() => {});
  }
  employeeAllowanceService.checkAndAutoResetMonthlyAllowance(storeId).catch(() => {});
}

export const App: React.FC = () => {
  // Navigation View ('pos' | 'dashboard' | 'inventory' | 'products' | 'settings' | 'superadmin')
  const [currentView, setCurrentView] = useState<NavView>(() => {
    try {
      const sessionSaved = sessionStorage.getItem('ketoko_current_user');
      if (sessionSaved) {
        const parsed = JSON.parse(sessionSaved);
        if (parsed?.role === 'SUPERADMIN' || parsed?.username?.toLowerCase() === 'superadmin') {
          return 'superadmin';
        }
      }
    } catch {}
    return 'pos';
  });

  // Authentication state (Wajib login untuk seluruh akses Online & Offline)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // 1. Cek sesi login aktif di tab browser saat ini
    const sessionSaved = sessionStorage.getItem('ketoko_current_user');
    if (sessionSaved) {
      try {
        const parsed = JSON.parse(sessionSaved);
        if (parsed && parsed.role && parsed.name) {
          return parsed;
        }
      } catch {}
    }
    // 2. Bersihkan jejak auto-login lawas dari localStorage agar wajib login
    try {
      localStorage.removeItem('ketoko_current_user');
    } catch {}
    return null;
  });

  // Master Data Products, Transactions & Enterprise entities
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [isCatalogSeeding] = useState<boolean>(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState<number>(0);

  // Modals state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const isPaymentProcessingRef = useRef(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);
  const [selectedInvoiceTrx, setSelectedInvoiceTrx] = useState<Transaction | null>(null);
  const [isRecentTrxOpen, setIsRecentTrxOpen] = useState(false);
  const [isQATestOpen, setIsQATestOpen] = useState(false);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isShiftReportOpen, setIsShiftReportOpen] = useState(false);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isFullReportsOpen, setIsFullReportsOpen] = useState(false);
  const [fullReportsInitialTab, setFullReportsInitialTab] = useState<'sales' | 'products' | 'profit' | 'inventory' | 'payment' | 'customer_items'>('sales');
  const [isOmsetChartOpen, setIsOmsetChartOpen] = useState(false);
  const [isBarcodeLabelOpen, setIsBarcodeLabelOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const { isInstallable, isInstalled, isIOS, installApp } = usePWA();
  const [isPWAInstallOpen, setIsPWAInstallOpen] = useState(false);

  // Master Developer / Superadmin Security State
  const [isDevUnlocked, setIsDevUnlocked] = useState(false);
  const [isDevPinModalOpen, setIsDevPinModalOpen] = useState(false);
  const [devPinInput, setDevPinInput] = useState('');
  const [devPinError, setDevPinError] = useState('');

  // Error Monitoring Modal State
  const [isErrorMonitoringOpen, setIsErrorMonitoringOpen] = useState(false);

  // Cashier Help & Bug Report Chat State
  const [isHelpChatOpen, setIsHelpChatOpen] = useState(false);

  // Global Developer Shortcut: Ctrl + Shift + S (Superadmin), Ctrl + Shift + E (Error Monitoring)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setIsDevPinModalOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        setIsErrorMonitoringOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // New Enterprise Modals State
  const [isCustomerSupplierOpen, setIsCustomerSupplierOpen] = useState(false);
  const [customerSupplierTab, setCustomerSupplierTab] = useState<'customer' | 'supplier'>('customer');

  const [isDebtReceivableOpen, setIsDebtReceivableOpen] = useState(false);
  const [debtReceivableTab, setDebtReceivableTab] = useState<'debt' | 'receivable' | 'report'>('debt');

  const [isPurchasesReturnsOpen, setIsPurchasesReturnsOpen] = useState(false);
  const [purchasesReturnsTab, setPurchasesReturnsTab] = useState<'history' | 'purchase_return' | 'sales_return' | 'add_purchase'>('history');

  const [isStockAdjustmentsOpen, setIsStockAdjustmentsOpen] = useState(false);
  const [stockAdjustmentsTab, setStockAdjustmentsTab] = useState<'in' | 'out' | 'opname'>('in');

  const [isStoreSettingsOpen, setIsStoreSettingsOpen] = useState(false);
  const [storeSettingsTab, setStoreSettingsTab] = useState<'profile' | 'theme' | 'csv' | 'backup' | 'users'>('profile');

  // Active Store Tracking (Dynamic Host Detection + Local Terminal Override)
  const [activeStoreId, setActiveStoreId] = useState<string>(() => {
    const store = resolveInitialTerminalStore();
    return store.id;
  });

  // Store Profile State (Custom POS Name & Branch Subtitle)
  const [storeProfile, setStoreProfile] = useState<{
    name: string;
    branch_name: string;
    logo_base64?: string;
    owner_name?: string;
    phone?: string;
  }>(() => {
    const store = resolveInitialTerminalStore();
    try {
      localStorage.setItem('ketoko_active_store_id', store.id);
      localStorage.setItem('ketoko_is_clean_store', store.isClean ? 'true' : 'false');
    } catch {}
    const saved = localStorage.getItem('ketoko_store_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name && parsed.name === store.name) {
          return {
            name: parsed.name,
            branch_name: parsed.branch_name || store.branch || 'Cabang Utama',
            logo_base64: parsed.logo_base64 || '',
            owner_name: parsed.owner_name || store.ownerName || '',
            phone: parsed.phone || store.phone || ''
          };
        }
      } catch {}
    }
    const profile = {
      name: store.name,
      branch_name: store.branch || `${store.name} (${store.branchId || 'BR-01'})`,
      logo_base64: '',
      owner_name: store.ownerName || '',
      phone: store.phone || ''
    };
    try {
      localStorage.setItem('ketoko_store_profile', JSON.stringify(profile));
    } catch {}
    return profile;
  });

  const handleProfileUpdated = useCallback(() => {
    const saved = localStorage.getItem('ketoko_store_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hostStore = resolveStoreFromCurrentHost();
        setStoreProfile({
          name: parsed.name || hostStore.name,
          branch_name: parsed.branch_name || hostStore.branch,
          logo_base64: parsed.logo_base64 || '',
          owner_name: parsed.owner_name || hostStore.ownerName || '',
          phone: parsed.phone || hostStore.phone || ''
        });
      } catch {}
    }
  }, []);

  // Persistent Touchscreen Mode (Default false/desktop or saved choice)
  const [isTouchscreenMode, setIsTouchscreenMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('ketoko_touchscreen_mode');
    return saved !== null ? saved === 'true' : false;
  });

  const handleToggleTouchscreen = useCallback(() => {
    setIsTouchscreenMode((prev) => {
      const next = !prev;
      localStorage.setItem('ketoko_touchscreen_mode', String(next));
      return next;
    });
  }, []);

  // Network & Offline Status
  const { isOnline, simulatedOffline, toggleSimulatedOffline } = useNetworkStatus();

  // Cart Hook
  const {
    items: cartItems,
    memberId,
    customerName,
    setCustomerName,
    setMemberId,
    memberBlockedInfo,
    clearMemberBlockedInfo,
    taxEnabled,
    setTaxEnabled,
    taxRate,
    setTaxRate,
    addItem: addToCart,
    updateQuantity: updateCartQty,
    removeItem: removeCartItem,
    clearCart,
    subtotal,
    wholesaleSavings,
    discountAmount,
    taxAmount,
    grandTotal,
    totalItemCount
  } = useCart(activeStoreId);

  // Listen for global tax rate updates
  useEffect(() => {
    const handleTaxRateChanged = (e: any) => {
      if (typeof e.detail === 'number') {
        setTaxRate(e.detail);
      }
    };
    window.addEventListener('ketoko_tax_rate_changed', handleTaxRateChanged);
    return () => window.removeEventListener('ketoko_tax_rate_changed', handleTaxRateChanged);
  }, [setTaxRate]);

  // Listen for active terminal branch switch from StoreSettingsModal
  useEffect(() => {
    const handleStoreChanged = (e: any) => {
      const nextStoreId = normalizeStoreId(e?.detail);
      setActiveStoreId(nextStoreId);
      try {
        localStorage.setItem('ketoko_active_store_id', nextStoreId);
      } catch {}
      syncService.resetCloudLiveChannel();
    };
    window.addEventListener('ketoko_active_store_changed', handleStoreChanged);
    return () => window.removeEventListener('ketoko_active_store_changed', handleStoreChanged);
  }, []);

  // Auto-detect store from subdomain (e.g. https://tokoberkah.ketokopos.online)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hostname = window.location.hostname.toLowerCase();
    
    // Skip localhost and internal IP addresses
    if (
      hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      hostname.startsWith('192.168.') || 
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return;
    }

    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      try {
        const saved = localStorage.getItem('ketoko_registered_stores');
        if (saved) {
          const stores = JSON.parse(saved);
          const matched = stores.find((s: any) => 
            s.subdomain?.toLowerCase() === subdomain ||
            s.onlineDomain?.toLowerCase().includes(`//${subdomain}.`)
          );
          if (matched) {
            const currentActive = localStorage.getItem('ketoko_active_store_id');
            if (currentActive !== matched.id) {
              localStorage.setItem('ketoko_active_store_id', matched.id);
              localStorage.setItem('ketoko_is_clean_store', matched.isClean ? 'true' : 'false');
              setActiveStoreId(matched.id);
              const targetProfile = {
                name: matched.name,
                branch_name: matched.branch || 'Cabang Utama',
                logo_base64: '',
                owner_name: matched.ownerName || '',
                phone: matched.phone || ''
              };
              localStorage.setItem('ketoko_store_profile', JSON.stringify(targetProfile));
              setStoreProfile({
                name: targetProfile.name,
                branch_name: targetProfile.branch_name,
                logo_base64: ''
              });
            }
          }
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    fetchStoresFromCloud().catch(() => {});
  }, []);

  const isSyncingRef = useRef(false);

  // Safety watchdog: jika isSyncing aktif lebih dari 8 detik karena alasan apapun, paksa kembali ke normal (anti-nyangkut)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSyncing) {
      timer = setTimeout(() => {
        setIsSyncing(false);
        isSyncingRef.current = false;
      }, 8000);
    }
    return () => clearTimeout(timer);
  }, [isSyncing]);

  // Sync products from Central LAN Server (if client mode)
  const syncProductsFromLanServer = useCallback(async () => {
    try {
      const serverProds = await lanService.fetchCentralProducts();
      if (serverProds && serverProds.length > 0) {
        const chunkSize = 2500;
        for (let i = 0; i < serverProds.length; i += chunkSize) {
          await db.products.bulkPut(serverProds.slice(i, i + chunkSize));
        }
        setProducts(serverProds);
      }
    } catch (err) {
      console.warn('[App] Gagal sinkronisasi produk dari LAN Server:', err);
    }
  }, []);

  const sortProductsForDisplay = useCallback((list: Product[], storeFilter?: string): Product[] => {
    const isStore01 = storeFilter === 'store-01';
    const filtered = storeFilter
      ? list.filter((p: any) => {
          if (isStore01) {
            // CV. Tumbuh Makmur Air Conindo (Toko AC): HANYA produk AC store-01!
            if (p.store_id && p.store_id !== 'store-01') return false;
            const cat = (p.category || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            if (cat === 'sembako') return false;
            if (name.includes('minyak goreng') || name.includes('beras premium') || name.includes('koperasi')) return false;
            return true;
          }
          return p.store_id === storeFilter;
        })
      : list;

    return [...filtered].sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;

      const aIsCustom = !/^\d+$/.test(String(a.id).trim());
      const bIsCustom = !/^\d+$/.test(String(b.id).trim());
      if (aIsCustom !== bIsCustom) return aIsCustom ? -1 : 1;
      return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
    });
  }, []);

  const filterTrxForActiveStore = useCallback((trxList: Transaction[], activeStoreId: string): Transaction[] => {
    return trxList.filter((t: any) => {
      if (activeStoreId === 'store-01') {
        if (t.store_id && t.store_id !== 'store-01') return false;
        const cashier = (t.cashier_name || '').toLowerCase();
        if (cashier.includes('toko b') || cashier.includes('koperasi b')) return false;
        const items = Array.isArray(t.items) ? t.items : [];
        if (items.some((it: any) => {
          const n = (it.name || '').toLowerCase();
          return n.includes('minyak goreng') || n.includes('koperasi b') || n.includes('beras premium');
        })) return false;
        return true;
      }
      return t.store_id === activeStoreId;
    });
  }, []);

  // Load products & count overdue debts/receivables once on startup
  const loadLocalProducts = useCallback(async () => {
    try {
      const currentHostStore = resolveStoreFromCurrentHost();
      const activeStore = localStorage.getItem('ketoko_active_store_id') || currentHostStore.id;
      const isCleanStore = localStorage.getItem('ketoko_is_clean_store') === 'true' || (activeStore !== 'store-01' && currentHostStore.isClean);

      // Mode Toko Bersih Baru: JANGAN auto-seed produk katalog CV Tumbuh Makmur!
      if (isCleanStore && activeStore !== 'store-01') {
        await seedKoperasiMslIfNeeded(activeStore);
        const storeProds = await db.products.toArray();
        setProducts(sortProductsForDisplay(storeProds, activeStore));
        setOverdueCount(0);

        // Bersihkan data pelanggan toko luar yang bocor dari IndexedDB toko baru ini
        try {
          const allCust = await db.customers.toArray();
          const leaked = allCust.filter((c) => !isCustomerBelongsToStoreOrCluster(c.store_id, activeStore));
          if (leaked.length > 0) {
            await db.customers.bulkDelete(leaked.map((c) => c.id));
            console.log(`[App] Berhasil membersihkan ${leaked.length} data pelanggan luar yang bocor dari toko (${activeStore}).`);
          }
        } catch {}

        if (navigator.onLine) {
          syncService.pullFromSupabase().then(async (res) => {
            if (res && res.products) {
              const fresh = await db.products.toArray();
              setProducts(sortProductsForDisplay(fresh, activeStore));
            }
          }).catch(() => {});
        }
        return;
      }

      if (lanService.isLanActive()) {
        try {
          const serverProds = await lanService.fetchCentralProducts();
          if (serverProds && serverProds.length > 0) {
            const chunkSize = 2500;
            for (let i = 0; i < serverProds.length; i += chunkSize) {
              await db.products.bulkPut(serverProds.slice(i, i + chunkSize));
            }
            setProducts(sortProductsForDisplay(serverProds, activeStore));
          } else {
            const all = await db.products.toArray();
            setProducts(sortProductsForDisplay(all, activeStore));
          }
        } catch {
          const all = await db.products.toArray();
          setProducts(sortProductsForDisplay(all, activeStore));
        }
      } else {
        // 1. Fetch all products into state (Auto-seed from /data/products.json ONLY for initial store-01 and NOT clean store)
        let all = await db.products.toArray();
        if (!isCleanStore && activeStore === 'store-01') {
          const hasOldDummy = all.some(p => p.name === 'Sister Gunting Ks 818' || p.barcode === '8994292112843');
          if (all.length === 0 || hasOldDummy) {
            try {
              const res = await fetch('/data/products.json');
              if (res.ok) {
                const defaultProds = await res.json();
                if (defaultProds && defaultProds.length > 0) {
                  await db.products.clear();
                  const chunkSize = 1000;
                  for (let i = 0; i < defaultProds.length; i += chunkSize) {
                    await db.products.bulkPut(defaultProds.slice(i, i + chunkSize));
                  }
                  all = defaultProds;
                  console.log(`[App] Berhasil memuat ${defaultProds.length} produk katalog master AC.`);
                }
              }
            } catch (err) {
              console.warn('[App] Gagal auto-load /data/products.json:', err);
            }
          }
          setProducts(sortProductsForDisplay(all, 'store-01'));

          // 2. Tarik pembaruan produk & tombstones terbaru dari Cloud Supabase untuk store-01
          if (navigator.onLine) {
            syncService.pullFromSupabase().then(async (res) => {
              if (res && res.products) {
                const fresh = await db.products.toArray();
                setProducts(sortProductsForDisplay(fresh, 'store-01'));
              }
            }).catch(() => {});
          }
        } else {
          // Toko lain: filter produk berdasarkan activeStore saja
          setProducts(sortProductsForDisplay(all, activeStore));
        }
      }

      // Ensure active users: seed store-specific users
      if (!isCleanStore && activeStore === 'store-01') {
        try {
          await db.users.bulkPut([
            {
              id: 'usr-000',
              username: 'superadmin',
              name: 'Master Superadmin (Developer)',
              role: 'SUPERADMIN',
              branch_id: 'BR-01'
            },
            {
              id: 'usr-001',
              username: 'suciawati',
              name: 'suciawati Ramadhani',
              role: 'ADMIN',
              branch_id: 'BR-01'
            },
            {
              id: 'usr-002',
              username: 'noor',
              name: 'Noor Afifah',
              role: 'CASHIER',
              branch_id: 'BR-01'
            },
            {
              id: 'usr-003',
              username: 'admin',
              name: 'suciawati Ramadhani',
              role: 'ADMIN',
              branch_id: 'BR-01'
            },
            {
              id: 'usr-004',
              username: 'kasir',
              name: 'Noor Afifah',
              role: 'CASHIER',
              branch_id: 'BR-01'
            }
          ]);
        } catch {}
      } else {
        try {
          await db.users.bulkPut([
            {
              id: 'usr-000',
              username: 'superadmin',
              name: 'Master Superadmin (Developer)',
              role: 'SUPERADMIN',
              branch_id: currentHostStore.branchId || 'BR-02'
            },
            {
              id: 'usr-001',
              username: 'admin',
              name: currentHostStore.ownerName ? `${currentHostStore.ownerName} (Owner)` : `Admin ${currentHostStore.name}`,
              role: 'ADMIN',
              branch_id: currentHostStore.branchId || 'BR-02'
            },
            {
              id: 'usr-002',
              username: 'kasir',
              name: currentHostStore.cashierUser || `Kasir ${currentHostStore.name}`,
              role: 'CASHIER',
              branch_id: currentHostStore.branchId || 'BR-02'
            }
          ]);
        } catch {}
      }

      const pendingCount = await syncService.getPendingCount();
      setPendingSyncCount(pendingCount);

      // Calculate overdue debts & receivables for top bar alert
      const nowStr = new Date().toISOString().split('T')[0];
      const debts = (await db.debts.toArray()).filter((d: any) => !d.store_id || d.store_id === activeStore);
      const recs = (await db.receivables.toArray()).filter((r: any) => !r.store_id || r.store_id === activeStore);
      const overdueDebts = debts.filter((d: DebtItem) => d.status !== 'PAID' && d.due_date < nowStr).length;
      const overdueRecs = recs.filter((r: ReceivableItem) => r.status !== 'PAID' && r.due_date < nowStr).length;
      setOverdueCount(overdueDebts + overdueRecs);
    } catch (err) {
      console.error('Error during initial product load:', err);
    }
  }, []);

  // Load latest cashier transactions from LAN Server, Supabase, or local Dexie
  const loadTransactions = useCallback(async (): Promise<Transaction[]> => {
    try {
      const currentHostStore = resolveStoreFromCurrentHost();
      const activeStore = localStorage.getItem('ketoko_active_store_id') || currentHostStore.id;

      // Always try to fetch transactions from central LAN server if accessible
      try {
        const centralTrx = await lanService.fetchCentralTransactions(100, undefined, activeStore);
        if (centralTrx && centralTrx.length > 0) {
          await db.transactions.bulkPut(centralTrx);
        }
        await lanService.fetchCustomersFromLan().catch(() => {});
        employeeAllowanceService.checkAndAutoResetMonthlyAllowance().catch(() => {});
      } catch (err) {
        // LAN offline or unreachable, fallback to local IndexedDB
      }

      if (navigator.onLine && activeStore === 'store-01') {
        await Promise.allSettled([
          syncService.pushLocalTransactionsToSupabase(),
          syncService.pullTransactionsFromSupabase(100),
          syncService.pullCustomersFromSupabase().catch(() => {})
        ]);
      }

      const allTrx = await db.transactions.orderBy('created_at').reverse().limit(100).toArray();
      const filteredTrx = filterTrxForActiveStore(allTrx, activeStore);
      setTransactions(filteredTrx);
      return filteredTrx;
    } catch (err) {
      console.warn('[App] Gagal memuat data transaksi:', err);
      return [];
    }
  }, [filterTrxForActiveStore]);

  // Initialize DB, Products and Transactions on mount & global shortcut events & update checker
  useEffect(() => {
    // 1. Pembersihan otomatis data sembako & transaksi dummy toko B di CV Tumbuh Makmur (Toko AC)
    const sembakoCleaned = localStorage.getItem('ketoko_clean_ac_store_sembako_v4');
    if (!sembakoCleaned) {
      Promise.all([
        db.products.filter((p: any) => {
          const c = (p.category || '').toLowerCase();
          const n = (p.name || '').toLowerCase();
          return c === 'sembako' || n.includes('minyak goreng') || n.includes('beras premium') || n.includes('koperasi');
        }).delete(),
        db.transactions.filter((t: any) => {
          const cashier = (t.cashier_name || '').toLowerCase();
          const sid = (t.store_id || '').toLowerCase();
          const items = Array.isArray(t.items) ? t.items : [];
          return sid === 'store-02' || sid.includes('toko-b') || sid.includes('koperasi') ||
                 cashier.includes('toko b') || cashier.includes('koperasi b') ||
                 items.some((it: any) => {
                   const iname = (it.name || '').toLowerCase();
                   return iname.includes('minyak goreng') || iname.includes('koperasi b') || iname.includes('beras');
                 });
        }).delete()
      ]).then(() => {
        localStorage.setItem('ketoko_clean_ac_store_sembako_v4', 'true');
        loadLocalProducts();
        loadTransactions();
      }).catch(() => {
        loadLocalProducts();
        loadTransactions();
      });
    } else {
      loadLocalProducts();
      loadTransactions();
    }

    const handleOpenShift = () => setIsShiftReportOpen(true);
    const handleOpenDrawer = () => {
      // ESC/POS Cash Drawer Pulse simulation or notification
      const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
      audio.play().catch(() => {});
      alert('⚡ Sinyal Kick-Drawer (Buka Laci Kasir) Berhasil Dikirim ke Printer!');
    };

    window.addEventListener('ketoko_open_shift_report', handleOpenShift);
    window.addEventListener('ketoko_open_cash_drawer', handleOpenDrawer);

    // Auto-reset saldo karyawan tiap Tanggal 1 (cek tiap 10 menit selama aplikasi terbuka)
    const allowanceResetTimer = setInterval(() => {
      employeeAllowanceService.checkAndAutoResetMonthlyAllowance().catch(() => {});
    }, 10 * 60 * 1000);

    // Check for App Updates in background 2s after startup
    const updateTimer = setTimeout(async () => {
      try {
        const info = await checkForAppUpdates();
        if (info && info.hasUpdate) {
          setUpdateInfo(info);
          setIsUpdateModalOpen(true);
        }
      } catch {}
    }, 2500);

    // 1. Listen to Real-time SSE Stock, Customer & Transaction Updates from Central LAN Server
    let unsubSse: (() => void) | null = null;
    const isDirectServerOrigin = typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.startsWith('file:') && window.location.origin !== 'null';
    if (lanService.isLanActive() || isDirectServerOrigin) {
      unsubSse = lanService.initEventSource(
        // onStockUpdate
        (updatedStocks) => {
          if (!updatedStocks || updatedStocks.length === 0) return;
          const stockMap = new Map(updatedStocks.map(s => [s.id, s.stock]));
          for (const s of updatedStocks) {
            db.products.update(s.id, { stock: Number(s.stock) || 0 }).catch(() => {});
          }
          setProducts((prev) => prev.map(p => {
            const newStock = stockMap.get(p.id);
            return newStock !== undefined ? { ...p, stock: newStock } : p;
          }));
        },
        // onProductUpdate
        (prod) => {
          if (!prod) return;
          db.products.put(prod).catch(() => {});
          setProducts((prev) => {
            const idx = prev.findIndex(p => p.id === prod.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...prod };
              return copy;
            }
            return [prod, ...prev];
          });
        },
        // onTransactionCreated (Live sync into Admin dashboard)
        (data) => {
          const trx = data?.transaction;
          if (trx && trx.id) {
            db.transactions.put(trx).catch(() => {});
            const currentHost = resolveStoreFromCurrentHost();
            const activeStoreId = localStorage.getItem('ketoko_active_store_id') || currentHost.id;
            const filtered = filterTrxForActiveStore([trx], activeStoreId);
            if (filtered.length > 0) {
              setTransactions((prev) => {
                if (prev.some(t => t.id === trx.id)) return prev;
                return [trx, ...prev];
              });
              window.dispatchEvent(new CustomEvent('ketoko_transaction_created', { detail: { transaction: trx } }));
            }
          } else {
            loadTransactions();
          }
          if (data?.updated_stocks && Array.isArray(data.updated_stocks)) {
            const stockMap = new Map<string, number>(data.updated_stocks.map((s: any) => [s.id, Number(s.stock) || 0]));
            for (const s of data.updated_stocks) {
              db.products.update(s.id, { stock: Number(s.stock) || 0 }).catch(() => {});
            }
            setProducts((prev) => prev.map(p => {
              const s = stockMap.get(p.id);
              return s !== undefined ? { ...p, stock: s } : p;
            }));
          }
        },
        // onTransactionDeleted (Live sync across LAN cashiers)
        (trxId) => {
          if (!trxId) return;
          syncService.markTransactionDeletedLocally(trxId);
          db.transactions.delete(trxId).catch(() => {});
          db.syncQueue.delete(trxId).catch(() => {});
          setTransactions((prev) => prev.filter((t) => t.id !== trxId));
          window.dispatchEvent(new CustomEvent('ketoko_transaction_deleted', { detail: { id: trxId } }));
        },
        // onCustomerUpdate (Live customer sync across LAN cashiers)
        (cust) => {
          if (!cust) return;
          db.customers.put(cust).catch(() => {});
          window.dispatchEvent(new CustomEvent('ketoko_customer_updated', { detail: cust }));
        },
        // onCustomerDelete (Live customer sync across LAN cashiers)
        (custId) => {
          if (!custId) return;
          db.customers.delete(custId).catch(() => {});
          window.dispatchEvent(new CustomEvent('ketoko_customer_deleted', { detail: { id: custId } }));
        }
      );
    }

    // 2. Multi-tab / Same-browser Real-time BroadcastChannel sync
    let bc: BroadcastChannel | null = null;
    let bcCust: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bcCust = new BroadcastChannel('ketoko_customer_sync');
        bcCust.onmessage = (event) => {
          if (event.data?.type === 'CUSTOMER_UPDATED' && event.data.customer) {
            db.customers.put(event.data.customer).catch(() => {});
            window.dispatchEvent(new CustomEvent('ketoko_customer_updated', { detail: event.data.customer }));
          } else if (event.data?.type === 'CUSTOMER_DELETED' && event.data.id) {
            db.customers.delete(event.data.id).catch(() => {});
            window.dispatchEvent(new CustomEvent('ketoko_customer_deleted', { detail: { id: event.data.id } }));
          }
        };

        bc = new BroadcastChannel('ketoko_product_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'product_deleted') {
            const prodId = event.data.product_id;
            if (prodId) {
              syncService.markProductDeletedLocally(prodId);
              db.products.delete(prodId).catch(() => {});
              setProducts((prev) => prev.filter((p) => String(p.id) !== String(prodId)));
              window.dispatchEvent(new CustomEvent('ketoko_product_deleted', { detail: { id: prodId } }));
            }
            return;
          }

          if (event.data?.type === 'transaction_deleted') {
            const trxId = event.data.transaction_id;
            if (trxId) {
              syncService.markTransactionDeletedLocally(trxId);
              db.transactions.delete(trxId).catch(() => {});
              db.syncQueue.delete(trxId).catch(() => {});
              setTransactions((prev) => prev.filter((t) => t.id !== trxId));
              window.dispatchEvent(new CustomEvent('ketoko_transaction_deleted', { detail: { id: trxId } }));
            }
            if (event.data?.updated_stocks && Array.isArray(event.data.updated_stocks)) {
              const stockMap = new Map<string, number>(event.data.updated_stocks.map((s: any) => [s.id, Number(s.stock) || 0]));
              for (const s of event.data.updated_stocks) {
                db.products.update(s.id, { stock: Number(s.stock) || 0 }).catch(() => {});
              }
              setProducts((prev) => prev.map(p => {
                const s = stockMap.get(p.id);
                return s !== undefined ? { ...p, stock: s } : p;
              }));
            }
            return;
          }

          if (event.data?.type === 'transaction_created') {
            const trx = event.data.transaction;
            if (trx && trx.id) {
              db.transactions.put(trx).catch(() => {});
              const currentHost = resolveStoreFromCurrentHost();
              const activeStoreId = localStorage.getItem('ketoko_active_store_id') || currentHost.id;
              const filtered = filterTrxForActiveStore([trx], activeStoreId);
              if (filtered.length > 0) {
                setTransactions((prev) => {
                  if (prev.some(t => t.id === trx.id)) return prev;
                  return [trx, ...prev];
                });
                window.dispatchEvent(new CustomEvent('ketoko_transaction_created', { detail: { transaction: trx } }));
              }
            }
            if (event.data?.updated_stocks && Array.isArray(event.data.updated_stocks)) {
              const stockMap = new Map<string, number>(event.data.updated_stocks.map((s: any) => [s.id, Number(s.stock) || 0]));
              for (const s of event.data.updated_stocks) {
                db.products.update(s.id, { stock: Number(s.stock) || 0 }).catch(() => {});
              }
              setProducts((prev) => prev.map(p => {
                const s = stockMap.get(p.id);
                return s !== undefined ? { ...p, stock: s } : p;
              }));
            }
            return;
          }

          if (event.data?.type === 'transaction_updated') {
            const trx = event.data.transaction;
            if (trx && trx.id) {
              db.transactions.put(trx).catch(() => {});
              setTransactions((prev) => prev.map((t) => (t.id === trx.id ? trx : t)));
              window.dispatchEvent(new CustomEvent('ketoko_transaction_updated', { detail: { transaction: trx, updated_stocks: event.data.updated_stocks } }));
            }
            if (event.data?.updated_stocks && Array.isArray(event.data.updated_stocks)) {
              const stockMap = new Map<string, number>(event.data.updated_stocks.map((s: any) => [s.id, Number(s.stock) || 0]));
              for (const s of event.data.updated_stocks) {
                db.products.update(s.id, { stock: Number(s.stock) || 0 }).catch(() => {});
              }
              setProducts((prev) => prev.map(p => {
                const s = stockMap.get(p.id);
                return s !== undefined ? { ...p, stock: s } : p;
              }));
            }
            return;
          }

          const prod = event.data?.product || event.data;
          if (prod && prod.id) {
            db.products.put(prod).catch(() => {});
            setProducts((prev) => {
              const idx = prev.findIndex(p => p.id === prod.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...prod };
                return copy;
              }
              return [prod, ...prev];
            });
          }
        };
      }
    } catch {}

    // 3. Supabase Cloud Realtime listener for cross-device & cross-network live sync
    try {
      syncService.initCloudLiveChannel({
        onProductUpdated: (prod) => {
          setProducts((prev) => {
            const idx = prev.findIndex((p) => String(p.id) === String(prod.id));
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...prod };
              return copy;
            }
            return [prod, ...prev];
          });
        },
        onProductDeleted: (prodId) => {
          setProducts((prev) => prev.filter((p) => String(p.id) !== String(prodId)));
          window.dispatchEvent(new CustomEvent('ketoko_product_deleted', { detail: { id: prodId } }));
        },
        onCatalogRefreshed: async () => {
          const activeStore = localStorage.getItem('ketoko_active_store_id') || resolveStoreFromCurrentHost().id;
          const fresh = await db.products.toArray();
          setProducts(sortProductsForDisplay(fresh, activeStore));
        },
        onStockUpdated: (stocks) => {
          const map = new Map(stocks.map((s: any) => [String(s.id), Number(s.stock) || 0]));
          setProducts((prev) => prev.map((p) => {
            const s = map.get(String(p.id));
            return s !== undefined ? { ...p, stock: s } : p;
          }));
        },
        onTransactionCreated: (data) => {
          const trx = data?.transaction || data;
          if (trx && trx.id) {
            const currentHost = resolveStoreFromCurrentHost();
            const activeStoreId = localStorage.getItem('ketoko_active_store_id') || currentHost.id;
            const filtered = filterTrxForActiveStore([trx], activeStoreId);
            if (filtered.length > 0) {
              setTransactions((prev) => {
                if (prev.some((t) => t.id === trx.id)) return prev;
                return [trx, ...prev];
              });
              window.dispatchEvent(new CustomEvent('ketoko_transaction_created', { detail: { transaction: trx } }));
            }
          } else {
            loadTransactions();
          }
          if (data?.updated_stocks && Array.isArray(data.updated_stocks)) {
            const stockMap = new Map<string, number>(data.updated_stocks.map((s: any) => [String(s.id), Number(s.stock) || 0]));
            setProducts((prev) => prev.map((p) => {
              const s = stockMap.get(String(p.id));
              return s !== undefined ? { ...p, stock: s } : p;
            }));
          }
        },
        onTransactionDeleted: (data) => {
          const trxId = data?.transaction_id || data?.id;
          if (trxId) {
            setTransactions((prev) => prev.filter((t) => t.id !== trxId));
            window.dispatchEvent(new CustomEvent('ketoko_transaction_deleted', { detail: { id: trxId } }));
          }
          if (data?.updated_stocks && Array.isArray(data.updated_stocks)) {
            const stockMap = new Map<string, number>(data.updated_stocks.map((s: any) => [String(s.id), Number(s.stock) || 0]));
            setProducts((prev) => prev.map((p) => {
              const s = stockMap.get(String(p.id));
              return s !== undefined ? { ...p, stock: s } : p;
            }));
          }
        },
        onPurchaseCreated: async (payload) => {
          if (payload && Array.isArray(payload.items)) {
            for (const it of payload.items) {
              const prodId = it.product_id || it.id;
              const addQty = Number(it.qty) || 0;
              if (prodId && addQty > 0) {
                const existing = await db.products.get(String(prodId));
                if (existing) {
                  const updated = {
                    ...existing,
                    stock: (existing.stock || 0) + addQty,
                    buy_price: it.buy_price || existing.buy_price
                  };
                  await db.products.put(updated);
                  setProducts((prev) => prev.map((p) => String(p.id) === String(prodId) ? updated : p));
                }
              }
            }
          }
        },
        onDebtReceivableUpdated: async () => {
          await syncService.syncDebtsAndReceivables().catch(() => {});
          const nowStr = new Date().toISOString().split('T')[0];
          const debts = await db.debts.toArray();
          const recs = await db.receivables.toArray();
          const overdueDebts = debts.filter((d: DebtItem) => d.status !== 'PAID' && d.due_date < nowStr).length;
          const overdueRecs = recs.filter((r: ReceivableItem) => r.status !== 'PAID' && r.due_date < nowStr).length;
          setOverdueCount(overdueDebts + overdueRecs);
        },
        onReceivableCreated: async () => {
          const nowStr = new Date().toISOString().split('T')[0];
          const debts = await db.debts.toArray();
          const recs = await db.receivables.toArray();
          const overdueDebts = debts.filter((d: DebtItem) => d.status !== 'PAID' && d.due_date < nowStr).length;
          const overdueRecs = recs.filter((r: ReceivableItem) => r.status !== 'PAID' && r.due_date < nowStr).length;
          setOverdueCount(overdueDebts + overdueRecs);
        },
        onCustomerUpdated: (cust) => {
          if (!cust) return;
          db.customers.put(cust).catch(() => {});
          window.dispatchEvent(new CustomEvent('ketoko_customer_updated', { detail: cust }));
        },
        onCustomerDeleted: (custId) => {
          if (!custId) return;
          db.customers.delete(custId).catch(() => {});
          window.dispatchEvent(new CustomEvent('ketoko_customer_deleted', { detail: { id: custId } }));
        }
      });
    } catch (err) {
      console.warn('[App] Realtime Supabase subscription error:', err);
    }

    const handleCatalogSynced = async () => {
      const activeStore = localStorage.getItem('ketoko_active_store_id') || resolveStoreFromCurrentHost().id;
      const fresh = await db.products.toArray();
      setProducts(sortProductsForDisplay(fresh, activeStore));
    };

    const handleLocalProductUpdated = (e: any) => {
      const prod = e.detail?.product as Product | undefined;
      if (!prod || !prod.id) return;
      setProducts((prev) => {
        const idx = prev.findIndex((p) => String(p.id) === String(prod.id));
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...prod };
          return copy;
        }
        return [prod, ...prev];
      });
    };

    const handleLocalProductDeleted = (e: any) => {
      const singleId = e.detail?.id;
      const batchIds = e.detail?.ids;
      if (singleId) {
        setProducts((prev) => prev.filter((p) => String(p.id) !== String(singleId)));
      } else if (Array.isArray(batchIds) && batchIds.length > 0) {
        const delSet = new Set(batchIds.map(String));
        setProducts((prev) => prev.filter((p) => !delSet.has(String(p.id))));
      }
    };

    window.addEventListener('ketoko_catalog_synced', handleCatalogSynced);
    window.addEventListener('ketoko_product_updated', handleLocalProductUpdated);
    window.addEventListener('ketoko_product_deleted', handleLocalProductDeleted);

    return () => {
      clearTimeout(updateTimer);
      clearInterval(allowanceResetTimer);
      if (unsubSse) unsubSse();
      if (bc) {
        try { bc.close(); } catch {}
      }
      if (bcCust) {
        try { bcCust.close(); } catch {}
      }
      window.removeEventListener('ketoko_catalog_synced', handleCatalogSynced);
      window.removeEventListener('ketoko_product_updated', handleLocalProductUpdated);
      window.removeEventListener('ketoko_product_deleted', handleLocalProductDeleted);
      window.removeEventListener('ketoko_open_shift_report', handleOpenShift);
      window.removeEventListener('ketoko_open_cash_drawer', handleOpenDrawer);
    };
  }, [loadLocalProducts, loadTransactions, sortProductsForDisplay]);

  // Auto-refresh transactions whenever admin navigates to dashboard (with 5s polling interval)
  useEffect(() => {
    if (currentView === 'dashboard') {
      loadTransactions();
      const interval = setInterval(() => {
        loadTransactions();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [currentView, loadTransactions]);

  // Cross-tab real-time sync via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ketoko_last_trx_sync') {
        loadTransactions();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadTransactions]);

  // Manual & Auto-sync trigger: synchronizes transactions, restocks, debts/receivables
  const handleManualSync = useCallback(async () => {
    const isCleanStore = localStorage.getItem('ketoko_is_clean_store') === 'true';
    const activeStore = localStorage.getItem('ketoko_active_store_id') || 'store-01';
    if (!isOnline || isSyncingRef.current || isCleanStore || activeStore !== 'store-01') return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      // Timeout maksimal 12 detik agar UI tidak pernah macet/berputar lama jika cloud bermasalah
      const result: any = await Promise.race([
        syncService.syncAllData(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Koneksi Cloud Timeout (12 detik)')), 12000))
      ]);

      const updatedTrx = await loadTransactions();
      await loadLocalProducts();
      const count = await syncService.getPendingCount();
      setPendingSyncCount(count);

      if (result && !result.success) {
        setSyncToastMessage(`ℹ️ ${result.message || 'Mode lokal toko aktif'}`);
      } else {
        const trxCount = updatedTrx ? updatedTrx.length : 0;
        setSyncToastMessage(`✅ Sinkron Selesai! (${trxCount} Transaksi aktif)`);
      }
      setTimeout(() => setSyncToastMessage(null), 4000);
    } catch (e: any) {
      console.warn('Manual sync deferred:', e);
      setSyncToastMessage(`⚠️ Sinkronisasi Cloud: ${e?.message || 'Gagal terhubung'}`);
      setTimeout(() => setSyncToastMessage(null), 4000);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, loadTransactions, loadLocalProducts]);

  // Non-blocking background sync timer (hemat Disk IO Cloud Supabase)
  useEffect(() => {
    if (!isOnline) return;

    // 1. Cek dan dorong transaksi offline yang masih antre setiap 60 detik (sangat ringan)
    const queueInterval = setInterval(async () => {
      try {
        const pending = await syncService.getPendingCount();
        if (pending > 0 && navigator.onLine) {
          await syncService.pushLocalTransactionsToSupabase();
          await syncService.reconcileQueue();
        }
      } catch {}
    }, 60000);

    // 2. Sinkronisasi penuh berkala setiap 5 menit (mencegah penipisan Disk IO Supabase)
    const fullSyncInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        handleManualSync();
      }
    }, 300000);

    let lastFocusSync = Date.now();
    const handleVisibilityOrFocus = () => {
      // Hanya sinkron saat tab aktif jika sudah lewat minimal 2 menit sejak sinkronisasi terakhir
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastFocusSync > 120000) {
        lastFocusSync = Date.now();
        handleManualSync();
      }
    };

    const handleTrxDeleted = (e: any) => {
      const id = e.detail?.id;
      if (id) {
        syncService.markTransactionDeletedLocally(id);
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      }
    };

    const handleTrxCreated = (e: any) => {
      const trx = e.detail?.transaction;
      if (trx && trx.id) {
        const currentHost = resolveStoreFromCurrentHost();
        const activeStoreId = localStorage.getItem('ketoko_active_store_id') || currentHost.id;
        const filtered = filterTrxForActiveStore([trx], activeStoreId);
        if (filtered.length > 0) {
          setTransactions((prev) => {
            if (prev.some((t) => t.id === trx.id)) return prev;
            return [trx, ...prev];
          });
        }
      }
    };

    const handleTrxUpdated = (e: any) => {
      const trx = e.detail?.transaction;
      if (trx && trx.id) {
        setTransactions((prev) => prev.map((t) => (t.id === trx.id ? trx : t)));
      }
      const updatedStocks = e.detail?.updated_stocks;
      if (Array.isArray(updatedStocks) && updatedStocks.length > 0) {
        const stockMap = new Map<string, number>(updatedStocks.map((s: any) => [s.id, Number(s.stock) || 0]));
        setProducts((prev) =>
          prev.map((p) => {
            const s = stockMap.get(p.id);
            return s !== undefined ? { ...p, stock: s } : p;
          })
        );
      }
    };

    const handleTrxRefreshed = async () => {
      try {
        const currentHost = resolveStoreFromCurrentHost();
        const activeStoreId = localStorage.getItem('ketoko_active_store_id') || currentHost.id;
        const allTrx = await db.transactions.orderBy('created_at').reverse().limit(100).toArray();
        setTransactions(filterTrxForActiveStore(allTrx, activeStoreId));
      } catch {}
    };

    const handleProductDeleted = (e: any) => {
      const id = e.detail?.id;
      if (id) {
        syncService.markProductDeletedLocally(id);
        setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('ketoko_transactions_refreshed', handleTrxRefreshed);
    window.addEventListener('ketoko_transaction_deleted', handleTrxDeleted);
    window.addEventListener('ketoko_transaction_created', handleTrxCreated);
    window.addEventListener('ketoko_transaction_updated', handleTrxUpdated);
    window.addEventListener('ketoko_product_deleted', handleProductDeleted);

    return () => {
      clearInterval(queueInterval);
      clearInterval(fullSyncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('ketoko_transactions_refreshed', handleTrxRefreshed);
      window.removeEventListener('ketoko_transaction_deleted', handleTrxDeleted);
      window.removeEventListener('ketoko_transaction_created', handleTrxCreated);
      window.removeEventListener('ketoko_transaction_updated', handleTrxUpdated);
      window.removeEventListener('ketoko_product_deleted', handleProductDeleted);
    };
  }, [isOnline, handleManualSync]);

  // In-memory Barcode & SKU Map for Sub-millisecond (0.01ms) O(1) Lookups
  const { barcodeIndex, idIndex } = useMemo(() => {
    const bMap = new Map<string, Product>();
    const iMap = new Map<string, Product>();
    const len = products.length;
    for (let i = 0; i < len; i++) {
      const p = products[i];
      if (p.barcode) bMap.set(p.barcode.trim(), p);
      if (p.id) iMap.set(p.id.trim().toLowerCase(), p);
    }
    return { barcodeIndex: bMap, idIndex: iMap };
  }, [products]);

  // Handle barcode scanned & smart product search (O(1) Map Lookup + Fast in-memory search)
  const handleBarcodeScan = useCallback(
    async (query: string) => {
      const start = performance.now();
      const raw = query.trim();
      const clean = raw.toLowerCase();
      if (!clean) return { found: false, latencyMs: 0 };

      // 0. Auto-Detect Member / Customer QR or Barcode Scan
      try {
        const custs = await db.customers.toArray();
        const queryClean = clean.replace(/^ketoko:member:/i, '');
        const queryDigits = queryClean.replace(/[^0-9]/g, '');
        // Prioritas 1: kecocokan persis kode/NIK (mis. 52/5221/0911/324) atau ID agar tidak tertukar nama mirip
        let matchedCust = custs.find((c) => {
          const cCode = (c.code || '').toLowerCase();
          const cId = (c.id || '').toLowerCase();
          return cCode === queryClean || cId === queryClean;
        });
        // Prioritas 2: nama persis / HP / nama sebagian
        if (!matchedCust) {
          matchedCust = custs.find((c) => {
            const cName = (c.name || '').toLowerCase();
            const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
            return (
              cName === queryClean ||
              (queryClean.length >= 4 && cName.includes(queryClean) && !/^\d+$/.test(queryClean)) ||
              (queryDigits.length >= 8 && cPhone === queryDigits)
            );
          });
        }

        if (matchedCust) {
          const access = checkCustomerBranchAccess(matchedCust, activeStoreId);
          setMemberId(matchedCust.id, matchedCust.name);
          if (!access.allowed) {
            setSyncToastMessage(`🚫 ${access.reason || `Member "${matchedCust.name}" terdaftar di cabang lain`}`);
            setTimeout(() => setSyncToastMessage(null), 5000);
            return {
              found: true,
              latencyMs: performance.now() - start,
              isMember: true,
              branchBlocked: true,
              blockedMessage: access.reason,
              memberName: matchedCust.name
            };
          }
          setCustomerName(matchedCust.name);
          try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const qrUrl = await QRCode.toDataURL(matchedCust.code || matchedCust.id, { width: 128, margin: 1 }).catch(() => '');
              const channel = new BroadcastChannel('ketoko_customer_display');
              channel.postMessage({
                type: 'CARD_TAP',
                customerName: matchedCust.name,
                card: {
                  holderName: matchedCust.name,
                  nik: matchedCust.code || matchedCust.id,
                  limit: matchedCust.credit_limit || 1500000,
                  balance: 500000,
                  qrDataUrl: qrUrl
                }
              });
              channel.close();
            }
          } catch {}
          return { found: true, latencyMs: performance.now() - start, isMember: true, memberName: matchedCust.name };
        }
      } catch {}

      // 1. Instant O(1) Barcode Map Lookup (< 0.05ms)
      let product = barcodeIndex.get(raw);

      // 2. Instant O(1) SKU / Product ID Lookup (< 0.05ms)
      if (!product) {
        product = idIndex.get(clean);
      }

      // 3. Fast In-Memory Substring Search (with Early Exit)
      if (!product) {
        const len = products.length;
        for (let i = 0; i < len; i++) {
          const p = products[i];
          if (
            p.name.toLowerCase().includes(clean) ||
            p.id.toLowerCase().includes(clean) ||
            p.barcode.includes(clean) ||
            (p.category && p.category.toLowerCase().includes(clean))
          ) {
            product = p;
            break; // Early exit
          }
        }
      }

      const end = performance.now();
      const latencyMs = end - start;

      if (product) {
        addToCart(product, 1);
        return { found: true, product, latencyMs };
      }

      return { found: false, latencyMs };
    },
    [barcodeIndex, idIndex, products, addToCart]
  );

  // Handle Payment Completion
  const handleProcessPayment = async (paymentData: {
    payment_method: 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER' | 'TEMPO' | 'SALDO';
    cash_given: number;
    change_returned: number;
    customer_name?: string;
    due_date?: string;
    notes?: string;
    custom_created_at?: string;
  }) => {
    if (cartItems.length === 0 || isPaymentProcessingRef.current) return;
    isPaymentProcessingRef.current = true;
    setIsPaymentProcessing(true);

    try {

    // Validate License / Trial Status before recording transactions
    const lic = await licenseService.getStatus();
    if (lic.isExpired) {
      setIsLicenseModalOpen(true);
      alert('Masa Coba (Trial) Ketoko POS telah habis (maks 50 transaksi / 14 hari).\nSilakan aktivasi lisensi resmi untuk melanjutkan transaksi kasir.');
      return;
    }

    const now = paymentData.custom_created_at ? new Date(paymentData.custom_created_at) : new Date();
    const currentHost = resolveStoreFromCurrentHost();
    const activeStoreId = localStorage.getItem('ketoko_active_store_id') || currentHost.id;
    const receiptNumber = `TRX-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Resolve clean customer name (real name, not ID/Member #)
    let finalCustName = (paymentData.customer_name || '').trim() || (customerName || '').trim();
    if (!finalCustName && memberId) {
      try {
        const cust = await db.customers.get(memberId);
        if (cust?.name) {
          finalCustName = cust.name;
        } else {
          const byCode = await db.customers.where('code').equalsIgnoreCase(memberId).first();
          if (byCode?.name) finalCustName = byCode.name;
        }
      } catch {}
    }

      // Consolidate duplicate items in cart to guarantee 100% strictly 1 row per product
      const consolidatedItemsMap = new Map<string, CartItem>();
      for (const item of cartItems) {
        const pId = String(item.product_id).trim();
        const existing = consolidatedItemsMap.get(pId);
        if (existing) {
          const totalQty = existing.qty + item.qty;
          const isWholesale = existing.min_wholesale_qty ? totalQty >= existing.min_wholesale_qty : false;
          const price = isWholesale && existing.wholesale_price ? existing.wholesale_price : (existing.retail_price || existing.price_applied);
          consolidatedItemsMap.set(pId, {
            ...existing,
            qty: totalQty,
            is_wholesale: isWholesale,
            price_applied: price,
            subtotal_item: totalQty * price
          });
        } else {
          consolidatedItemsMap.set(pId, { ...item });
        }
      }
      const finalCartItems = Array.from(consolidatedItemsMap.values());

      const newTrx: Transaction = {
        id: `trx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        store_id: activeStoreId || 'store-01',
        receipt_number: receiptNumber,
        cashier_id: currentUser?.id || 'USR-001',
        cashier_name: currentUser?.name || 'Kasir',
        branch_id: currentUser?.branch_id || 'BR-01',
        member_id: memberId || undefined,
        customer_name: finalCustName || (memberId ? undefined : 'PELANGGAN UMUM'),
        items: finalCartItems,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      payment_method: paymentData.payment_method,
      cash_given: paymentData.cash_given,
      change_returned: paymentData.change_returned,
      due_date: paymentData.due_date,
      notes: paymentData.notes,
      synced: false,
      created_at: now.toISOString()
    };

    // Submit to Central LAN Server if running in LAN mode or local server is active
    let lanUpdatedStocks: Array<{ id: string; stock: number }> | undefined;
    try {
      const lanRes = await lanService.submitTransaction(newTrx);
      if (lanRes && lanRes.success) {
        newTrx.synced = true;
        if (lanRes.updatedStocks && lanRes.updatedStocks.length > 0) {
          lanUpdatedStocks = lanRes.updatedStocks;
          const stockMap = new Map(lanRes.updatedStocks.map(s => [s.id, s.stock]));
          setProducts((prev) => prev.map(p => {
            const updatedStock = stockMap.get(p.id);
            return updatedStock !== undefined ? { ...p, stock: updatedStock } : p;
          }));
        }
      }
    } catch (err) {
      console.warn('[App] Gagal kirim transaksi ke LAN Server, fallback ke offline syncQueue:', err);
    }

    // 1. Record transaction into IndexedDB & SyncQueue (local offline resilience)
    await syncService.saveTransactionOffline(newTrx, lanUpdatedStocks);

    // 1.b Catat Piutang Pelanggan otomatis jika transaksi dibayar secara TEMPO / BON
    if (paymentData.payment_method === 'TEMPO') {
      try {
        const custName = finalCustName || 'Pelanggan Umum';
        const dp = Number(paymentData.cash_given) || 0;
        const remaining = Math.max(0, grandTotal - dp);
        const dueDateVal = paymentData.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

        const newRec: ReceivableItem = {
          id: `REC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          store_id: activeStoreId || 'store-01',
          customer_id: memberId || `PLG-${Date.now()}`,
          customer_name: custName,
          receipt_number: receiptNumber,
          transaction_id: newTrx.id,
          invoice_date: now.toISOString().split('T')[0],
          total_amount: grandTotal,
          paid_amount: dp,
          remaining_amount: remaining,
          due_date: dueDateVal,
          status: remaining === 0 ? 'PAID' : (dp > 0 ? 'PARTIAL' : 'UNPAID'),
          notes: paymentData.notes || `Penjualan Bon Nota ${receiptNumber}`,
          created_at: now.toISOString()
        };

        await db.receivables.put(newRec);

        // Update overdue badge
        const nowStr = now.toISOString().split('T')[0];
        const debts = await db.debts.toArray();
        const recs = await db.receivables.toArray();
        const overdueDebts = debts.filter((d: DebtItem) => d.status !== 'PAID' && d.due_date < nowStr).length;
        const overdueRecs = recs.filter((r: ReceivableItem) => r.status !== 'PAID' && r.due_date < nowStr).length;
        setOverdueCount(overdueDebts + overdueRecs);

        // Broadcast piutang baru ke semua terminal
        syncService.broadcastCloudEvent('receivable_created', newRec);
        if (navigator.onLine) {
          syncService.syncDebtsAndReceivables().catch(() => {});
        }
      } catch (err) {
        console.warn('[App] Gagal mencatat piutang pelanggan:', err);
      }
    }

    // 1.c Potong Saldo Simpanan Anggota secara lokal jika transaksi dibayar dengan SALDO
    if (paymentData.payment_method === 'SALDO' && memberId) {
      try {
        const cust = await db.customers.get(memberId) || await db.customers.where('code').equalsIgnoreCase(memberId).first();
        if (cust) {
          const maxQuota = cust.type === 'KARYAWAN'
            ? clampEmployeeAllowance(cust.monthly_allowance ?? cust.credit_limit)
            : Infinity;
          const oldBalance = cust.type === 'KARYAWAN'
            ? clampEmployeeBalance(cust.deposit_balance, maxQuota)
            : (Number(cust.deposit_balance) || 0);
          const newBalance = Math.max(0, oldBalance - grandTotal);
          const updatedCust: Customer = {
            ...cust,
            deposit_balance: newBalance,
            current_debt: cust.type === 'KARYAWAN' ? Math.max(0, maxQuota - newBalance) : cust.current_debt,
            updated_at: now.toISOString()
          };
          await db.customers.put(updatedCust);
          // Sinkron potongan saldo ke Cloud/LAN agar langsung terlihat di HP karyawan & kasir lain
          syncService.syncCustomerChange(updatedCust).catch(() => {});

          const mutId = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const mutationRecord: MemberDepositMutation = {
            id: mutId,
            customer_id: cust.id,
            customer_name: cust.name,
            customer_code: cust.code,
            type: 'PAYMENT',
            amount: grandTotal,
            balance_before: oldBalance,
            balance_after: newBalance,
            payment_method: 'CASH',
            store_id: activeStoreId || 'store-01',
            store_name: getStoreDisplayName(activeStoreId),
            cashier_id: currentUser?.id || 'USR-001',
            cashier_name: currentUser?.name || 'Kasir',
            receipt_number: receiptNumber,
            notes: `Pembayaran Belanja Nota ${receiptNumber}`,
            created_at: now.toISOString()
          };
          await db.memberDeposits.put(mutationRecord);

          window.dispatchEvent(new CustomEvent('ketoko_customer_updated', { detail: updatedCust }));
          window.dispatchEvent(new CustomEvent('ketoko_member_deposit_updated', { detail: { customer: updatedCust, mutation: mutationRecord } }));
          
          try {
            if (typeof BroadcastChannel !== 'undefined') {
              const bc = new BroadcastChannel('ketoko_customer_sync');
              bc.postMessage({ type: 'CUSTOMER_UPDATED', customer: updatedCust });
              bc.postMessage({ type: 'MEMBER_DEPOSIT_UPDATED', customer: updatedCust, mutation: mutationRecord });
              bc.close();
            }
          } catch {}
        }
      } catch (err) {
        console.error('[App] Gagal potong saldo member di Dexie:', err);
      }
    }

    // Update in-memory stock instantly without heavy full DB reload (only if not already updated by LAN server authoritative stock)
    if (!lanUpdatedStocks) {
      setProducts((prev) => {
        const soldMap = new Map<string, number>();
        for (const item of newTrx.items) {
          const pId = String(item.product_id).trim();
          soldMap.set(pId, (soldMap.get(pId) || 0) + (Number(item.qty) || 0));
        }
        return prev.map(p => {
          const pId = String(p.id).trim();
          const qtySold = soldMap.get(pId);
          return qtySold ? { ...p, stock: Math.max(0, p.stock - qtySold) } : p;
        });
      });
    }

    // Update in-memory transactions state immediately if matches active store
    if (filterTrxForActiveStore([newTrx], activeStoreId).length > 0) {
      setTransactions((prev) => [newTrx, ...prev]);
    }

    // Live broadcast to Admin views in this window (Dashboard, Reports, Recent Transactions)
    window.dispatchEvent(new CustomEvent('ketoko_transaction_created', {
      detail: { transaction: newTrx, updated_stocks: lanUpdatedStocks }
    }));
    window.dispatchEvent(new CustomEvent('ketoko_transactions_refreshed'));

    // Cross-tab and cross-window real-time BroadcastChannel sync
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const prodBc = new BroadcastChannel('ketoko_product_sync');
        prodBc.postMessage({
          type: 'transaction_created',
          transaction: newTrx,
          updated_stocks: lanUpdatedStocks
        });
        prodBc.close();
      }
    } catch {}

    // Storage event for fallback cross-tab reactivity
    try {
      localStorage.setItem('ketoko_last_trx_sync', JSON.stringify({
        id: newTrx.id,
        created_at: newTrx.created_at,
        time: Date.now()
      }));
    } catch {}

    const pending = await syncService.getPendingCount();
    setPendingSyncCount(pending);

    // 2. Clear cart & Show receipt
    clearCart();
    setIsPaymentOpen(false);
    setActiveReceipt(newTrx);
    setIsReceiptOpen(true);

    // Notify Customer Facing Display of transaction completion
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('ketoko_customer_display');
        channel.postMessage({
          type: 'TRANSACTION_SUCCESS',
          invoiceNo: newTrx.receipt_number,
          paymentMethod: newTrx.payment_method,
          grandTotal: newTrx.grand_total,
          change: paymentData.change_returned
        });
        channel.close();
      }
    } catch (e) {}
    } finally {
      isPaymentProcessingRef.current = false;
      setIsPaymentProcessing(false);
    }
  };

  // Handle Direct 1-Step Payment from POS Screen (Direct checkout, no duplicate modal)
  const handleDirectPayment = async (
    method: 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER' | 'SALDO',
    cashGiven?: number,
    customDate?: string
  ) => {
    if (cartItems.length === 0 || isPaymentProcessingRef.current) return;
    if (memberBlockedInfo) {
      setSyncToastMessage(`🚫 ${memberBlockedInfo.reason || 'Akses member ditolak untuk cabang ini. Batalkan pilihan member untuk melanjutkan sebagai Pembeli Umum.'}`);
      setTimeout(() => setSyncToastMessage(null), 5000);
      return;
    }

    if (method === 'SALDO') {
      if (!memberId) {
        setSyncToastMessage('⚠️ Pilih Anggota / Konsumen terlebih dahulu untuk pembayaran via Saldo.');
        setTimeout(() => setSyncToastMessage(null), 4000);
        return;
      }
      const cust = await db.customers.get(memberId) || await db.customers.where('code').equalsIgnoreCase(memberId).first();
      if (isCustomerCardBlocked(cust)) {
        setSyncToastMessage(`🚫 TRANSAKSI DITOLAK: Kartu "${cust?.name || memberId}" sedang diblokir karena dilaporkan hilang.`);
        setTimeout(() => setSyncToastMessage(null), 5000);
        return;
      }
      const currentBalance = cust?.type === 'KARYAWAN'
        ? clampEmployeeBalance(cust.deposit_balance, cust.monthly_allowance ?? cust.credit_limit)
        : (Number(cust?.deposit_balance) || 0);
      if (currentBalance < grandTotal) {
        setSyncToastMessage(`⚠️ Saldo Anggota tidak mencukupi (Saldo: ${formatRupiah(currentBalance)} | Belanja: ${formatRupiah(grandTotal)}). Silakan Top Up terlebih dahulu.`);
        setTimeout(() => setSyncToastMessage(null), 5000);
        return;
      }
      // Untuk karyawan koperasi, wajib buka PaymentModal agar verifikasi 6-digit PIN dijalankan
      if (cust?.type === 'KARYAWAN') {
        setIsPaymentOpen(true);
        return;
      }
    }

    const finalCash = method === 'CASH' ? (cashGiven && cashGiven >= grandTotal ? cashGiven : grandTotal) : grandTotal;
    const change = method === 'CASH' ? Math.max(0, finalCash - grandTotal) : 0;
    await handleProcessPayment({
      payment_method: method,
      cash_given: finalCash,
      change_returned: change,
      custom_created_at: customDate
    });
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('ketoko_current_user', JSON.stringify(user));
    if (user.role === 'SUPERADMIN' || user.username?.toLowerCase() === 'superadmin') {
      setCurrentView('superadmin');
    } else {
      setCurrentView('pos');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('ketoko_current_user');
      localStorage.removeItem('ketoko_current_user');
    } catch {}
    api.setToken(null);
  };

  const handleInjectCatalog = async () => {
    try {
      const res = await fetch('/data/products.json');
      if (res.ok) {
        const prods = await res.json();
        if (prods && prods.length > 0) {
          await db.products.clear();
          const chunkSize = 1000;
          for (let i = 0; i < prods.length; i += chunkSize) {
            await db.products.bulkPut(prods.slice(i, i + chunkSize));
          }
          setProducts(prods);
          localStorage.setItem('ketoko_is_clean_store', 'false');
          alert(`Berhasil menginjeksi ${prods.length.toLocaleString('id-ID')} data produk sparepart AC CV. Tumbuh Makmur ke sistem kasir!`);
        }
      }
    } catch (err) {
      alert('Gagal menginjeksi katalog: ' + err);
    }
  };

  // Superadmin Store Creation & Switching Handlers
  const handleCreateNewStore = async (storeData: {
    name: string;
    ownerName: string;
    phone: string;
    subdomain: string;
    branchId: string;
    clusterId?: string;
    clusterName?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }) => {
    const storeId = `store-${Date.now()}`;
    const clusterId = storeData.clusterId || 'cluster-default';
    const clusterName = storeData.clusterName || 'Cluster 1 (Default Cloud)';
    const supabaseUrl = storeData.supabaseUrl || '';
    const supabaseAnonKey = storeData.supabaseAnonKey || '';

    // 1. Bersihkan seluruh database secara tuntas (data kosong bersih)
    await Promise.all([
      db.products.clear(),
      db.transactions.clear(),
      db.syncQueue.clear(),
      db.customers.clear(),
      db.suppliers.clear(),
      db.debts.clear(),
      db.receivables.clear(),
      db.purchases.clear(),
      db.purchaseReturns.clear(),
      db.salesReturns.clear(),
      db.stockMovements.clear(),
      db.users.clear(),
      db.usersLocal.clear()
    ]);

    // 2. Daftarkan akun awal untuk toko baru
    const cleanUsers: User[] = [
      {
        id: 'usr-000',
        username: 'superadmin',
        name: 'Master Superadmin (Developer)',
        role: 'SUPERADMIN',
        branch_id: storeData.branchId || 'BR-02'
      },
      {
        id: 'usr-001',
        username: 'admin',
        name: storeData.ownerName ? `${storeData.ownerName} (Owner)` : `Admin ${storeData.name}`,
        role: 'ADMIN',
        branch_id: storeData.branchId || 'BR-02'
      },
      {
        id: 'usr-002',
        username: 'kasir',
        name: `Kasir ${storeData.name}`,
        role: 'CASHIER',
        branch_id: storeData.branchId || 'BR-02'
      }
    ];

    if (storeData.ownerName && storeData.ownerName.trim()) {
      const ownerSimple = storeData.ownerName.trim().toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '');
      if (ownerSimple && !cleanUsers.some(u => u.username === ownerSimple)) {
        cleanUsers.push({
          id: 'usr-003',
          username: ownerSimple,
          name: `${storeData.ownerName} (Owner)`,
          role: 'ADMIN',
          branch_id: storeData.branchId || 'BR-02'
        });
      }
    }
    await db.users.bulkPut(cleanUsers);

    // 3. Simpan flag toko bersih di localStorage & cluster profile
    localStorage.setItem('ketoko_active_store_id', storeId);
    localStorage.setItem('ketoko_is_clean_store', 'true');
    localStorage.setItem('ketoko_has_initialized_v2', 'true');
    localStorage.removeItem('ketoko_held_carts');

    const newProfile = {
      name: storeData.name,
      branch_name: `${storeData.name} (${storeData.branchId || 'BR-02'})`,
      logo_base64: '',
      owner_name: storeData.ownerName || '',
      phone: storeData.phone || '',
      cluster_id: clusterId,
      cluster_name: clusterName,
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey
    };
    localStorage.setItem('ketoko_store_profile', JSON.stringify(newProfile));
    setStoreProfile({
      name: newProfile.name,
      branch_name: newProfile.branch_name,
      logo_base64: '',
      owner_name: newProfile.owner_name,
      phone: newProfile.phone
    });
    setActiveStoreId(storeId);

    // 4. Perbarui daftar toko tersimpan
    let list: any[] = [];
    try {
      const saved = localStorage.getItem('ketoko_registered_stores');
      list = saved ? JSON.parse(saved) : [];
    } catch {}
    if (!list || list.length === 0) {
      list = [
        {
          id: 'store-01',
          name: 'CV. Tumbuh Makmur Air Conindo',
          branch: 'Cabang Samarinda (BR-01)',
          branchId: 'BR-01',
          ownerName: 'suciawati Ramadhani',
          phone: '08123456789',
          onlineDomain: 'https://tumbuhmakmur.ketokopos.online',
          localServer: 'http://localhost:5858',
          licensePlan: 'PRO LIFETIME (Aktif)',
          adminUser: 'suciawati (Owner)',
          cashierUser: 'noor (Kasir Toko)',
          productsCount: '1.503 Produk Sparepart AC',
          status: 'ONLINE',
          isClean: false,
          clusterId: 'cluster-default',
          clusterName: 'Cluster 1 (Default Cloud)'
        }
      ];
    }
    const newStoreItem = {
      id: storeId,
      name: storeData.name,
      branch: `${storeData.name} (${storeData.branchId || 'BR-02'})`,
      branchId: storeData.branchId || 'BR-02',
      ownerName: storeData.ownerName,
      phone: storeData.phone,
      subdomain: storeData.subdomain,
      onlineDomain: storeData.subdomain ? `https://${storeData.subdomain}.ketokopos.online` : 'Belum diatur',
      localServer: 'http://localhost:5858',
      licensePlan: 'PRO LIFETIME (Aktif)',
      adminUser: `${storeData.ownerName || 'admin'} (Owner)`,
      cashierUser: `kasir (Kasir ${storeData.name})`,
      productsCount: '0 Produk (Toko Bersih Baru)',
      status: 'ONLINE',
      isClean: true,
      clusterId,
      clusterName,
      supabaseUrl,
      supabaseAnonKey
    };
    list.push(newStoreItem);
    await saveStoresList(list);

    // Reset realtime channel untuk cluster toko baru
    syncService.resetCloudLiveChannel();
    syncService.initCloudLiveChannel();

    // 5. Reset semua state produk, keranjang, dan transaksi ke 0
    setProducts([]);
    setTransactions([]);
    clearCart();
    setOverdueCount(0);
    setPendingSyncCount(0);

    // 6. Langsung masuk ke tampilan POS dalam kondisi toko kosong bersih
    setCurrentView('pos');
  };

  const handleSelectStorePos = async (store?: any) => {
    if (!store) {
      setCurrentView('pos');
      return;
    }

    const currentActive = localStorage.getItem('ketoko_active_store_id') || 'store-01';
    if (store.id === currentActive) {
      setCurrentView('pos');
      return;
    }

    localStorage.setItem('ketoko_active_store_id', store.id);
    localStorage.setItem('ketoko_is_clean_store', store.isClean ? 'true' : 'false');
    setActiveStoreId(store.id);

    const targetProfile = {
      name: store.name,
      branch_name: store.branch || 'Cabang Utama',
      logo_base64: '',
      owner_name: store.ownerName || '',
      phone: store.phone || '',
      cluster_id: store.clusterId || 'cluster-default',
      cluster_name: store.clusterName || 'Cluster 1 (Default Cloud)',
      supabase_url: store.supabaseUrl || '',
      supabase_anon_key: store.supabaseAnonKey || ''
    };
    localStorage.setItem('ketoko_store_profile', JSON.stringify(targetProfile));
    setStoreProfile({
      name: targetProfile.name,
      branch_name: targetProfile.branch_name,
      logo_base64: '',
      owner_name: targetProfile.owner_name,
      phone: targetProfile.phone
    });

    // Reset realtime channel ke cluster toko yang ditargetkan
    syncService.resetCloudLiveChannel();
    syncService.initCloudLiveChannel();

    if (store.isClean || store.id !== 'store-01') {
      await seedKoperasiMslIfNeeded(store.id);
      const allProds = await db.products.toArray();
      setProducts(allProds.filter((p: any) => p.store_id === store.id));
      const allTrxs = await db.transactions.toArray();
      setTransactions(allTrxs.filter((t: any) => t.store_id === store.id));

      // Jika toko bersih baru, bersihkan pelanggan luar yang bocor dari IndexedDB toko ini
      try {
        const allCust = await db.customers.toArray();
        const leaked = allCust.filter((c) => !isCustomerBelongsToStoreOrCluster(c.store_id, store.id));
        if (leaked.length > 0) {
          await db.customers.bulkDelete(leaked.map((c) => c.id));
        }
      } catch {}

      try {
        await db.users.bulkPut([
          {
            id: 'usr-000',
            username: 'superadmin',
            name: 'Master Superadmin (Developer)',
            role: 'SUPERADMIN',
            branch_id: store.branchId || 'BR-02'
          },
          {
            id: 'usr-001',
            username: 'admin',
            name: store.ownerName ? `${store.ownerName} (Owner)` : `Admin ${store.name}`,
            role: 'ADMIN',
            branch_id: store.branchId || 'BR-02'
          },
          {
            id: 'usr-002',
            username: 'kasir',
            name: store.cashierUser || `Kasir ${store.name}`,
            role: 'CASHIER',
            branch_id: store.branchId || 'BR-02'
          }
        ]);
      } catch {}
    } else {
      const count = await db.products.count();
      if (count === 0) {
        await handleInjectCatalog();
      } else {
        await loadLocalProducts();
        await loadTransactions();
      }
    }

    clearCart();
    setCurrentView('pos');
  };

  const handleClearStoreData = async (storeId: string) => {
    await Promise.all([
      db.products.clear(),
      db.transactions.clear(),
      db.syncQueue.clear(),
      db.customers.clear(),
      db.suppliers.clear(),
      db.debts.clear(),
      db.receivables.clear(),
      db.purchases.clear(),
      db.purchaseReturns.clear(),
      db.salesReturns.clear(),
      db.stockMovements.clear()
    ]);
    localStorage.setItem('ketoko_is_clean_store', 'true');
    localStorage.removeItem('ketoko_held_carts');
    setProducts([]);
    setTransactions([]);
    clearCart();
    setOverdueCount(0);
    setPendingSyncCount(0);

    try {
      const saved = localStorage.getItem('ketoko_registered_stores');
      if (saved) {
        const list = JSON.parse(saved);
        const updated = list.map((s: any) => {
          if (s.id === storeId) {
            return { ...s, productsCount: '0 Produk (Dibersihkan)', isClean: true };
          }
          return s;
        });
        await saveStoresList(updated);
      }
    } catch {}
  };

  const handleDeleteStore = async (storeId: string) => {
    try {
      const saved = localStorage.getItem('ketoko_registered_stores');
      if (saved) {
        const list = JSON.parse(saved);
        const updated = list.filter((s: any) => s.id !== storeId);
        await saveStoresList(updated);
      }
    } catch {}
  };

  // If not logged in, render login modal
  if (!currentUser) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  // If logged in as Superadmin / Vendor and in superadmin view, render Dedicated Superadmin Portal
  if (currentView === 'superadmin' && (currentUser?.role === 'SUPERADMIN' || currentUser?.username?.toLowerCase() === 'superadmin')) {
    return (
      <>
        <SuperadminPortalView
          currentUser={currentUser}
          onLogout={handleLogout}
          onEnterStorePos={handleSelectStorePos}
          onCreateNewStore={handleCreateNewStore}
          onClearStoreData={handleClearStoreData}
          onDeleteStore={handleDeleteStore}
          onOpenLanModal={() => setIsLanModalOpen(true)}
          onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
          onInjectCatalog={handleInjectCatalog}
          totalProductsLoaded={products.length}
          activeStoreId={activeStoreId}
          activeStoreName={storeProfile.name}
        />

        {/* LAN Network, Cloudflare Tunnel & Supabase Cloud */}
        {isLanModalOpen && (
          <LanSettingsModal
            isOpen={isLanModalOpen}
            onClose={() => setIsLanModalOpen(false)}
            onConfigChanged={async (cfg) => {
              if (cfg.mode === 'CLIENT') {
                await syncProductsFromLanServer();
              } else {
                await loadLocalProducts();
              }
            }}
            onProductsSyncRequired={syncProductsFromLanServer}
          />
        )}

        {/* License Modal */}
        {isLicenseModalOpen && (
          <LicenseModal
            isOpen={isLicenseModalOpen}
            onClose={() => setIsLicenseModalOpen(false)}
            onActivated={() => setIsLicenseModalOpen(false)}
          />
        )}
      </>
    );
  }

  const lowStockCount = products.filter((p) => p.stock <= p.min_stock_alert).length;

  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-[#f8fafc] text-slate-900 lg:overflow-hidden lg:select-none">
      
      {/* Superadmin Store Inspection Top Banner */}
      {(currentUser?.role === 'SUPERADMIN' || currentUser?.username?.toLowerCase() === 'superadmin') && (
        <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-purple-800 shadow-md shrink-0 z-50">
          <div className="flex items-center space-x-2">
            <span className="font-black px-2.5 py-0.5 rounded-full bg-purple-500/40 text-purple-200 border border-purple-400/40 text-[10px] uppercase">
              👑 Mode Inspeksi Toko Klien
            </span>
            <span className="font-semibold text-purple-100">
              Anda sedang membuka kasir toko: <strong>{storeProfile.name}</strong> ({storeProfile.branch_name})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCurrentView('superadmin')}
            className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs rounded-lg shadow-sm flex items-center space-x-1.5 transition-all active:scale-95"
          >
            <span>Kembali ke Portal Superadmin</span>
            <span>→</span>
          </button>
        </div>
      )}
      
      {/* 1. Header (Brand Logo, Status, Touchscreen Switch, Menu ERP Toggle & Cart) */}
      <div className="shrink-0">
        <Navbar
          currentUser={currentUser}
          isOnline={isOnline}
          simulatedOffline={simulatedOffline}
          onToggleOffline={toggleSimulatedOffline}
          pendingSyncCount={pendingSyncCount}
          isSyncing={isSyncing}
          onManualSync={handleManualSync}
          onLogout={handleLogout}
          cartCount={totalItemCount}
          onToggleCart={() => setIsMobileCartOpen(!isMobileCartOpen)}
          isTouchscreenMode={isTouchscreenMode}
          onToggleTouchscreen={handleToggleTouchscreen}
          storeName={storeProfile.name}
          branchName={storeProfile.branch_name}
          storeLogo={storeProfile.logo_base64}
          onOpenStoreSettings={(tab: 'profile' | 'theme' | 'csv' | 'backup' | 'users' = 'profile') => {
            if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'SUPERADMIN' && !isDevUnlocked) return;
            setStoreSettingsTab(tab);
            setIsStoreSettingsOpen(true);
          }}
          onOpenLicense={() => {
            if (currentUser?.role !== 'SUPERADMIN' && currentUser?.username?.toLowerCase() !== 'superadmin' && !isDevUnlocked) return;
            setIsLicenseModalOpen(true);
          }}
          onOpenLanSettings={() => {
            if (currentUser?.role !== 'SUPERADMIN' && currentUser?.username?.toLowerCase() !== 'superadmin' && !isDevUnlocked) return;
            setIsLanModalOpen(true);
          }}
          onSecretDevTrigger={() => {
            setIsDevPinModalOpen(true);
          }}
          isPWAInstalled={isInstalled}
          onOpenPWAInstall={() => setIsPWAInstallOpen(true)}
          onOpenErrorMonitoring={() => setIsErrorMonitoringOpen(true)}
        />
      </div>

      {/* 2. Top ERP / POS Menu Navigation */}
      <div className="shrink-0">
        <TopMenuBar
          currentView={currentView}
          onNavigate={(view) => {
            if (currentUser?.role === 'CASHIER' && (view === 'products' || view === 'inventory')) {
              setCurrentView('pos');
              return;
            }
            setCurrentView(view);
          }}
          onOpenRecentTrx={() => setIsRecentTrxOpen(true)}
          onOpenQATest={() => setIsQATestOpen(true)}
          onOpenPrinterSettings={() => setIsPrinterSettingsOpen(true)}
          onOpenRestock={() => setIsRestockOpen(true)}
          onOpenPurchaseOrder={() => setIsPurchaseOrderOpen(true)}
          onOpenMemberModal={() => setIsMemberModalOpen(true)}
          onOpenShiftReport={() => setIsShiftReportOpen(true)}
          onOpenBarcodeLabels={() => setIsBarcodeLabelOpen(true)}
          onOpenLicense={() => setIsLicenseModalOpen(true)}
          onOpenNewProduct={() => setIsNewProductOpen(true)}
          onOpenFullReports={(tab = 'sales') => {
            setFullReportsInitialTab(tab);
            setIsFullReportsOpen(true);
          }}
          onOpenOmsetChart={() => setIsOmsetChartOpen(true)}
          onOpenCustomerSupplier={(tab = 'customer') => {
            if (tab === 'customer') {
              setIsMemberModalOpen(true);
            } else {
              setCustomerSupplierTab(tab);
              setIsCustomerSupplierOpen(true);
            }
          }}
          onOpenDebtReceivable={(tab = 'debt') => {
            setDebtReceivableTab(tab);
            setIsDebtReceivableOpen(true);
          }}
          onOpenPurchasesAndReturns={(tab = 'history') => {
            setPurchasesReturnsTab(tab);
            setIsPurchasesReturnsOpen(true);
          }}
          onOpenStockAdjustments={(tab = 'in') => {
            setStockAdjustmentsTab(tab);
            setIsStockAdjustmentsOpen(true);
          }}
          onOpenStoreSettings={(tab: 'profile' | 'theme' | 'csv' | 'backup' | 'users' = 'profile') => {
            setStoreSettingsTab(tab);
            setIsStoreSettingsOpen(true);
          }}
          onOpenPWAInstall={() => setIsPWAInstallOpen(true)}
          onOpenErrorMonitoring={() => setIsErrorMonitoringOpen(true)}
          onOpenHelpChat={() => setIsHelpChatOpen(true)}
          pendingSyncCount={pendingSyncCount}
          lowStockCount={lowStockCount}
          overdueCount={overdueCount}
          userRole={currentUser?.role}
        />
      </div>

      {/* Sync Feedback Toast Notification Banner */}
      {syncToastMessage && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 animate-bounce">
          <div className="bg-[#2a1a12] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-2xl border border-[#ddc3aa] flex items-center space-x-2">
            <span>{syncToastMessage}</span>
          </div>
        </div>
      )}

      {/* 3. Main Dynamic Content View (Full Width) */}
      {currentView === 'dashboard' ? (
        <DashboardView
          products={products}
          transactions={transactions}
          onRefreshTransactions={loadTransactions}
          currentUser={currentUser}
          onGoToPOS={() => setCurrentView('pos')}
          onOpenRecentTrx={() => setIsRecentTrxOpen(true)}
          onOpenQATest={() => setIsQATestOpen(true)}
          onOpenRestock={() => setIsRestockOpen(true)}
          onOpenShiftReport={() => setIsShiftReportOpen(true)}
          onOpenFullReports={() => setIsFullReportsOpen(true)}
          onOpenNewProduct={() => setIsNewProductOpen(true)}
          onOpenMemberModal={() => setIsMemberModalOpen(true)}
          onOpenPrinterSettings={() => setIsPrinterSettingsOpen(true)}
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          userRole={currentUser?.role}
        />
      ) : currentView === 'products' ? (
        <ProductPriceListView
          products={products}
          onGoToPOS={() => setCurrentView('pos')}
          onOpenNewProduct={() => setIsNewProductOpen(true)}
          onProductsUpdated={loadLocalProducts}
        />
      ) : currentView === 'inventory' ? (
        <InventoryView
          products={products}
          onGoToPOS={() => setCurrentView('pos')}
          onOpenRestockModal={() => setIsRestockOpen(true)}
        />
      ) : (
        /* Focused Supermarket POS Cashier Workspace */
        <PosCashierView
          products={products}
          cartItems={cartItems}
          memberId={memberId}
          customerName={customerName}
          setMemberId={setMemberId}
          memberBlockedInfo={memberBlockedInfo}
          onDismissMemberBlocked={clearMemberBlockedInfo}
          activeStoreId={activeStoreId}
          taxEnabled={taxEnabled}
          setTaxEnabled={setTaxEnabled}
          taxRate={taxRate}
          onTaxRateChange={setTaxRate}
          subtotal={subtotal}
          wholesaleSavings={wholesaleSavings}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          grandTotal={grandTotal}
          totalItemCount={totalItemCount}
          onAddToCart={(prod, qty) => addToCart(prod, qty || 1)}
          onUpdateQty={updateCartQty}
          onRemoveItem={removeCartItem}
          onClearCart={clearCart}
          onBarcodeScan={handleBarcodeScan}
          onOpenRecentTrx={() => setIsRecentTrxOpen(true)}
          onDirectPayment={handleDirectPayment}
          isCatalogSeeding={isCatalogSeeding}
          isTouchscreenMode={isTouchscreenMode}
          isPaymentProcessing={isPaymentProcessing}
          onOpenMemberModal={() => setIsMemberModalOpen(true)}
        />
      )}

      {/* Interactive Modals (Rendered conditionally to keep DOM & memory ultra lightweight) */}
      {isPaymentOpen && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          grandTotal={grandTotal}
          memberId={memberId}
          customerName={customerName || ''}
          onProcessPayment={handleProcessPayment}
          isTouchscreenMode={isTouchscreenMode}
          onToggleTouchscreen={handleToggleTouchscreen}
        />
      )}

      {isReceiptOpen && (
        <ReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          transaction={activeReceipt}
          onOpenPrinterSettings={() => setIsPrinterSettingsOpen(true)}
          onOpenInvoice={(trx) => setSelectedInvoiceTrx(trx)}
        />
      )}

      {selectedInvoiceTrx && (
        <InvoiceModal
          isOpen={!!selectedInvoiceTrx}
          onClose={() => setSelectedInvoiceTrx(null)}
          transaction={selectedInvoiceTrx}
        />
      )}

      {isRecentTrxOpen && (
        <RecentTransactionsModal
          isOpen={isRecentTrxOpen}
          onClose={() => setIsRecentTrxOpen(false)}
          onSelectReceipt={(trx) => {
            setActiveReceipt(trx);
            setIsReceiptOpen(true);
          }}
          userRole={currentUser?.role}
          products={products}
          onTransactionDeleted={(deletedId) => {
            setTransactions((prev) => prev.filter((t) => t.id !== deletedId));
            db.products.toArray().then((all) => setProducts(sortProductsForDisplay(all, activeStoreId))).catch(() => {});
          }}
          onTransactionUpdated={(updated) => {
            setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            db.products.toArray().then((all) => setProducts(sortProductsForDisplay(all, activeStoreId))).catch(() => {});
          }}
        />
      )}

      {isQATestOpen && (
        <QATestModal
          isOpen={isQATestOpen}
          onClose={() => setIsQATestOpen(false)}
        />
      )}

      {isPrinterSettingsOpen && (
        <PrinterSettingsModal
          isOpen={isPrinterSettingsOpen}
          onClose={() => setIsPrinterSettingsOpen(false)}
        />
      )}

      {isRestockOpen && (
        <RestockModal
          isOpen={isRestockOpen}
          onClose={() => setIsRestockOpen(false)}
          products={products}
          onRestockSuccess={loadLocalProducts}
        />
      )}

      {isPurchaseOrderOpen && (
        <PurchaseOrderModal
          isOpen={isPurchaseOrderOpen}
          onClose={() => setIsPurchaseOrderOpen(false)}
          products={products}
        />
      )}

      {isMemberModalOpen && (
        <MemberModal
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          onSelectMember={async (selectedId, member) => {
            if (member) {
              const access = checkCustomerBranchAccess(member, activeStoreId);
              if (!access.allowed) {
                setMemberId(selectedId, member.name);
                setSyncToastMessage(`🚫 ${access.reason || `Member "${member.name}" terdaftar di cabang lain`}`);
                setTimeout(() => setSyncToastMessage(null), 5000);
                return;
              }
            }
            setMemberId(selectedId, member?.name);
            if (member && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              try {
                const qrUrl = await QRCode.toDataURL(member.code || member.id, { width: 128, margin: 1 }).catch(() => '');
                const channel = new BroadcastChannel('ketoko_customer_display');
                channel.postMessage({
                  type: 'CARD_TAP',
                  customerName: member.name,
                  card: {
                    holderName: member.name,
                    nik: member.code || member.id,
                    limit: member.credit_limit || 1500000,
                    balance: 500000,
                    qrDataUrl: qrUrl
                  }
                });
                channel.close();
              } catch {}
            }
          }}
          currentMemberId={memberId}
        />
      )}

      {isShiftReportOpen && (
        <ShiftReportModal
          isOpen={isShiftReportOpen}
          onClose={() => setIsShiftReportOpen(false)}
          cashierName={currentUser?.name}
          branchId={currentUser?.branch_id}
          transactions={transactions}
        />
      )}

      {isNewProductOpen && (
        <NewProductModal
          isOpen={isNewProductOpen}
          onClose={() => setIsNewProductOpen(false)}
          onProductCreated={async (newProd) => {
            if (newProd) {
              setProducts((prev) => [newProd, ...prev.filter((p) => String(p.id) !== String(newProd.id))]);
            }
            await loadLocalProducts();
          }}
        />
      )}

      {isFullReportsOpen && (
        <FullReportsCenterModal
          isOpen={isFullReportsOpen}
          onClose={() => setIsFullReportsOpen(false)}
          initialTab={fullReportsInitialTab}
          userRole={currentUser?.role}
          cashierName={currentUser?.name}
          branchId={currentUser?.branch_id}
        />
      )}

      {isOmsetChartOpen && (
        <OmsetChartModal
          isOpen={isOmsetChartOpen}
          onClose={() => setIsOmsetChartOpen(false)}
        />
      )}

      {/* Enterprise ERP Modals */}
      {isCustomerSupplierOpen && (
        <CustomerSupplierModal
          isOpen={isCustomerSupplierOpen}
          onClose={() => setIsCustomerSupplierOpen(false)}
          initialTab={customerSupplierTab}
          onUpdated={loadLocalProducts}
        />
      )}

      {isDebtReceivableOpen && (
        <DebtReceivableModal
          isOpen={isDebtReceivableOpen}
          onClose={() => setIsDebtReceivableOpen(false)}
          initialTab={debtReceivableTab}
          onUpdated={loadLocalProducts}
        />
      )}

      {isPurchasesReturnsOpen && (
        <PurchasesAndReturnsModal
          isOpen={isPurchasesReturnsOpen}
          onClose={() => setIsPurchasesReturnsOpen(false)}
          initialTab={purchasesReturnsTab}
          onUpdated={loadLocalProducts}
        />
      )}

      {isStockAdjustmentsOpen && (
        <StockAdjustmentsModal
          isOpen={isStockAdjustmentsOpen}
          onClose={() => setIsStockAdjustmentsOpen(false)}
          initialTab={stockAdjustmentsTab}
          onUpdated={loadLocalProducts}
        />
      )}

      {isStoreSettingsOpen && (
        <StoreSettingsModal
          isOpen={isStoreSettingsOpen}
          onClose={() => setIsStoreSettingsOpen(false)}
          initialTab={storeSettingsTab}
          onProfileUpdated={handleProfileUpdated}
          onUpdated={loadLocalProducts}
        />
      )}

      {isBarcodeLabelOpen && (
        <BarcodeLabelModal
          isOpen={isBarcodeLabelOpen}
          onClose={() => setIsBarcodeLabelOpen(false)}
        />
      )}

      {isLicenseModalOpen && (
        <LicenseModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
          onActivated={() => {
            setIsLicenseModalOpen(false);
          }}
        />
      )}

      {/* Auto-Update Notification Banner/Modal */}
      <AppUpdateNotifierModal
        isOpen={isUpdateModalOpen}
        updateInfo={updateInfo}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      {/* LAN Network, Cloudflare Tunnel & Supabase Cloud (HANYA UNTUK SUPERADMIN / VENDOR DEVELOPER) */}
      {(currentUser?.role === 'SUPERADMIN' || currentUser?.username?.toLowerCase() === 'superadmin' || isDevUnlocked) && isLanModalOpen && (
        <LanSettingsModal
          isOpen={isLanModalOpen}
          onClose={() => setIsLanModalOpen(false)}
          onConfigChanged={async (cfg) => {
            if (cfg.mode === 'CLIENT') {
              await syncProductsFromLanServer();
            } else {
              await loadLocalProducts();
            }
          }}
          onProductsSyncRequired={syncProductsFromLanServer}
        />
      )}

      {/* Secret Master Superadmin / Developer PIN Modal */}
      {isDevPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#ebdccf]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#3d2617]">Mode Superadmin</h3>
                  <p className="text-[10px] text-[#8a6b53]">Khusus Pengembang / Vendor POS</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsDevPinModalOpen(false);
                  setDevPinInput('');
                  setDevPinError('');
                }}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const pin = devPinInput.trim().toLowerCase();
                if (['5858', 'superadmin', 'developer58', 'tumbuhmakmur', 'admin5858'].includes(pin)) {
                  setIsDevUnlocked(true);
                  setIsDevPinModalOpen(false);
                  setDevPinInput('');
                  setDevPinError('');
                  setIsLanModalOpen(true);
                } else {
                  setDevPinError('PIN Superadmin salah! Akses ditolak.');
                }
              }}
              className="mt-4 space-y-3"
            >
              <p className="text-xs text-[#5c3c26]">
                Masukkan <strong>Master PIN Developer</strong> untuk mengakses konfigurasi LAN Server, Supabase Cloud & Cloudflare Tunnel:
              </p>

              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="Master PIN / Sandi Vendor (e.g. 5858)"
                  value={devPinInput}
                  onChange={(e) => {
                    setDevPinInput(e.target.value);
                    if (devPinError) setDevPinError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ddc3aa] bg-white text-xs font-mono font-bold text-[#3d2617] focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                {devPinError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{devPinError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDevPinModalOpen(false);
                    setDevPinInput('');
                    setDevPinError('');
                  }}
                  className="flex-1 py-2 text-xs font-bold text-[#7c4e2f] bg-[#faebd7] hover:bg-[#ebdccf] rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-sm transition-all"
                >
                  Buka Akses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PWA Install Modal & Floating Prompt Banner */}
      <PWAInstallModal
        isOpen={isPWAInstallOpen}
        onClose={() => setIsPWAInstallOpen(false)}
        onInstall={installApp}
        isInstallable={isInstallable}
        isIOS={isIOS}
        isInstalled={isInstalled}
      />

      <PWAInstallBanner
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        onOpenModal={() => setIsPWAInstallOpen(true)}
        onInstall={installApp}
      />

      {/* Pusat Monitoring & Tracking Eror Sistem */}
      {isErrorMonitoringOpen && (
        <ErrorMonitoringModal
          isOpen={isErrorMonitoringOpen}
          onClose={() => setIsErrorMonitoringOpen(false)}
        />
      )}

      {/* Cashier Assistance & Bug Reporting Chat Modal */}
      {isHelpChatOpen && (
        <CashierHelpChatModal
          isOpen={isHelpChatOpen}
          onClose={() => setIsHelpChatOpen(false)}
          storeName={storeProfile.name}
          branchName={storeProfile.branch_name}
          cashierName={currentUser?.name || 'Kasir Bertugas'}
          activeCartTotal={grandTotal}
          activeItemCount={cartItems.length}
          supportPhone={storeProfile.phone || '081255558900'}
        />
      )}

    </div>
  );
};
