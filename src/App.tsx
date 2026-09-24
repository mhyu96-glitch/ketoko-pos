import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { KeyRound, ShieldAlert, X } from 'lucide-react';
import { useCart } from './hooks/useCart';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { db } from './db';
import { api } from './api/client';
import { syncService } from './services/syncService';
import { DEFAULT_STORE_PROFILE } from './api/mockData';
import type { Product, Transaction, User, DebtItem, ReceivableItem } from './types';

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
import { LicenseModal } from './components/LicenseModal';
import { licenseService } from './services/licenseService';
import { AppUpdateNotifierModal } from './components/AppUpdateNotifierModal';
import { checkForAppUpdates, type AppVersionInfo } from './services/updateService';
import { LanSettingsModal } from './components/LanSettingsModal';
import { lanService } from './services/lanService';
import { SuperadminPortalView } from './components/SuperadminPortalView';

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

  // Master Data Products & Enterprise entities
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isCatalogSeeding] = useState<boolean>(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState<number>(0);

  // Modals state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);
  const [isRecentTrxOpen, setIsRecentTrxOpen] = useState(false);
  const [isQATestOpen, setIsQATestOpen] = useState(false);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isShiftReportOpen, setIsShiftReportOpen] = useState(false);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isFullReportsOpen, setIsFullReportsOpen] = useState(false);
  const [fullReportsInitialTab, setFullReportsInitialTab] = useState<'sales' | 'products' | 'profit' | 'inventory' | 'payment'>('sales');
  const [isOmsetChartOpen, setIsOmsetChartOpen] = useState(false);
  const [isBarcodeLabelOpen, setIsBarcodeLabelOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);

  // Master Developer / Superadmin Security State
  const [isDevUnlocked, setIsDevUnlocked] = useState(false);
  const [isDevPinModalOpen, setIsDevPinModalOpen] = useState(false);
  const [devPinInput, setDevPinInput] = useState('');
  const [devPinError, setDevPinError] = useState('');

  // Global Developer Shortcut: Ctrl + Shift + S to trigger Superadmin unlock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setIsDevPinModalOpen(true);
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
  const [purchasesReturnsTab, setPurchasesReturnsTab] = useState<'history' | 'purchase_return' | 'sales_return'>('history');

  const [isStockAdjustmentsOpen, setIsStockAdjustmentsOpen] = useState(false);
  const [stockAdjustmentsTab, setStockAdjustmentsTab] = useState<'in' | 'out' | 'opname'>('in');

  const [isStoreSettingsOpen, setIsStoreSettingsOpen] = useState(false);
  const [storeSettingsTab, setStoreSettingsTab] = useState<'profile' | 'theme' | 'csv' | 'backup' | 'users'>('profile');

  // Store Profile State (Custom POS Name & Branch Subtitle)
  const [storeProfile, setStoreProfile] = useState<{
    name: string;
    branch_name: string;
    logo_base64?: string;
  }>(() => {
    const saved = localStorage.getItem('ketoko_store_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name && parsed.name !== 'Ketoko POS') {
          return {
            name: parsed.name,
            branch_name: parsed.branch_name || 'Cabang Samarinda (BR-01)',
            logo_base64: parsed.logo_base64 || ''
          };
        }
      } catch {}
    }
    const defaultProfile = {
      ...DEFAULT_STORE_PROFILE,
      branch_name: 'Cabang Samarinda (BR-01)'
    };
    localStorage.setItem('ketoko_store_profile', JSON.stringify(defaultProfile));
    return {
      name: defaultProfile.name,
      branch_name: defaultProfile.branch_name,
      logo_base64: defaultProfile.logo_base64 || ''
    };
  });

  const handleProfileUpdated = useCallback(() => {
    const saved = localStorage.getItem('ketoko_store_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStoreProfile({
          name: parsed.name || DEFAULT_STORE_PROFILE.name,
          branch_name: parsed.branch_name || 'Cabang Samarinda (BR-01)',
          logo_base64: parsed.logo_base64 || ''
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
    setMemberId,
    taxEnabled,
    setTaxEnabled,
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
  } = useCart();

  const isSyncingRef = useRef(false);

  // Sync products from Central LAN Server (if client mode)
  const syncProductsFromLanServer = useCallback(async () => {
    try {
      const serverProds = await lanService.fetchCentralProducts();
      if (serverProds && serverProds.length > 0) {
        await db.products.clear();
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

  // Load products & count overdue debts/receivables once on startup
  const loadLocalProducts = useCallback(async () => {
    try {
      if (lanService.isClientMode()) {
        try {
          const serverProds = await lanService.fetchCentralProducts();
          if (serverProds && serverProds.length > 0) {
            await db.products.clear();
            const chunkSize = 2500;
            for (let i = 0; i < serverProds.length; i += chunkSize) {
              await db.products.bulkPut(serverProds.slice(i, i + chunkSize));
            }
            setProducts(serverProds);
          } else {
            const all = await db.products.toArray();
            setProducts(all);
          }
        } catch {
          const all = await db.products.toArray();
          setProducts(all);
        }
      } else {
        // 1. Fetch all products into state (Clean start; products are injected/imported per store as needed)
        const all = await db.products.toArray();
        setProducts(all);
      }

      // Ensure active users for CV. Tumbuh Makmur Air Conindo are registered
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

      const pendingCount = await syncService.getPendingCount();
      setPendingSyncCount(pendingCount);

      // Calculate overdue debts & receivables for top bar alert
      const nowStr = new Date().toISOString().split('T')[0];
      const debts = await db.debts.toArray();
      const recs = await db.receivables.toArray();
      const overdueDebts = debts.filter((d: DebtItem) => d.status !== 'PAID' && d.due_date < nowStr).length;
      const overdueRecs = recs.filter((r: ReceivableItem) => r.status !== 'PAID' && r.due_date < nowStr).length;
      setOverdueCount(overdueDebts + overdueRecs);
    } catch (err) {
      console.error('Error during initial product load:', err);
    }
  }, []);

  // Initialize DB and Products on mount & global shortcut events & update checker
  useEffect(() => {
    // Ensure clean initial state (wipe any old dummy products on first launch of this update)
    const cleanMigrated = localStorage.getItem('ketoko_clean_fresh_v2');
    if (!cleanMigrated) {
      db.products.clear().then(() => {
        localStorage.setItem('ketoko_clean_fresh_v2', 'true');
        loadLocalProducts();
      }).catch(() => {
        loadLocalProducts();
      });
    } else {
      loadLocalProducts();
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

    // Listen to Real-time SSE Stock Updates from Central LAN Server when in Client Mode
    let unsubSse: (() => void) | null = null;
    if (lanService.isClientMode()) {
      unsubSse = lanService.initEventSource(
        // onStockUpdate
        (updatedStocks) => {
          if (!updatedStocks || updatedStocks.length === 0) return;
          const stockMap = new Map(updatedStocks.map(s => [s.id, s.stock]));
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
              copy[idx] = prod;
              return copy;
            }
            return [prod, ...prev];
          });
        }
      );
    }

    return () => {
      clearTimeout(updateTimer);
      if (unsubSse) unsubSse();
      window.removeEventListener('ketoko_open_shift_report', handleOpenShift);
      window.removeEventListener('ketoko_open_cash_drawer', handleOpenDrawer);
    };
  }, [loadLocalProducts]);

  // Manual Sync trigger
  const handleManualSync = useCallback(async () => {
    if (!isOnline || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncService.reconcileQueue();
      const count = await syncService.getPendingCount();
      setPendingSyncCount(count);
    } catch (e) {
      console.warn('Manual sync deferred:', e);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline]);

  // Non-blocking background sync timer (every 60s without infinite loops)
  useEffect(() => {
    if (!isOnline) return;

    // Recurring sync every 60 seconds
    const interval = setInterval(() => {
      handleManualSync();
    }, 60000);

    return () => clearInterval(interval);
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
    payment_method: 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER';
    cash_given: number;
    change_returned: number;
  }) => {
    if (cartItems.length === 0) return;

    // Validate License / Trial Status before recording transactions
    const lic = await licenseService.getStatus();
    if (lic.isExpired) {
      setIsLicenseModalOpen(true);
      alert('Masa Coba (Trial) Ketoko POS telah habis (maks 50 transaksi / 14 hari).\nSilakan aktivasi lisensi resmi untuk melanjutkan transaksi kasir.');
      return;
    }

    const now = new Date();
    const receiptNumber = `TRX-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTrx: Transaction = {
      id: `trx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      receipt_number: receiptNumber,
      cashier_id: currentUser?.id || 'USR-001',
      cashier_name: currentUser?.name || 'Kasir',
      branch_id: currentUser?.branch_id || 'BR-01',
      member_id: memberId || undefined,
      items: [...cartItems],
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      payment_method: paymentData.payment_method,
      cash_given: paymentData.cash_given,
      change_returned: paymentData.change_returned,
      synced: false,
      created_at: now.toISOString()
    };

    // Submit to Central LAN Server if running in CLIENT mode
    if (lanService.isClientMode()) {
      try {
        const lanRes = await lanService.submitTransaction(newTrx);
        if (lanRes.success) {
          newTrx.synced = true;
          if (lanRes.updatedStocks && lanRes.updatedStocks.length > 0) {
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
    }

    // 1. Record transaction into IndexedDB & SyncQueue (local offline resilience)
    await syncService.saveTransactionOffline(newTrx);

    // Update in-memory stock instantly without heavy full DB reload
    setProducts((prev) => {
      const soldMap = new Map(newTrx.items.map(i => [i.product_id, i.qty]));
      return prev.map(p => {
        const qtySold = soldMap.get(p.id);
        return qtySold ? { ...p, stock: Math.max(0, p.stock - qtySold) } : p;
      });
    });

    const pending = await syncService.getPendingCount();
    setPendingSyncCount(pending);

    // 2. Clear cart & Show receipt
    clearCart();
    setIsPaymentOpen(false);
    setActiveReceipt(newTrx);
    setIsReceiptOpen(true);
  };

  // Handle Direct 1-Step Payment from POS Screen (Direct checkout, no duplicate modal)
  const handleDirectPayment = async (
    method: 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER',
    cashGiven?: number
  ) => {
    if (cartItems.length === 0) return;
    const finalCash = method === 'CASH' ? (cashGiven && cashGiven >= grandTotal ? cashGiven : grandTotal) : grandTotal;
    const change = method === 'CASH' ? Math.max(0, finalCash - grandTotal) : 0;
    await handleProcessPayment({
      payment_method: method,
      cash_given: finalCash,
      change_returned: change
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
          onEnterStorePos={() => setCurrentView('pos')}
          onOpenLanModal={() => setIsLanModalOpen(true)}
          onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
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
              Anda sedang membuka kasir toko: <strong>CV. Tumbuh Makmur Air Conindo</strong>
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
            setCustomerSupplierTab(tab);
            setIsCustomerSupplierOpen(true);
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
          pendingSyncCount={pendingSyncCount}
          lowStockCount={lowStockCount}
          overdueCount={overdueCount}
          userRole={currentUser?.role}
        />
      </div>

      {/* 3. Main Dynamic Content View (Full Width) */}
      {currentView === 'dashboard' ? (
        <DashboardView
          products={products}
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
          setMemberId={setMemberId}
          taxEnabled={taxEnabled}
          setTaxEnabled={setTaxEnabled}
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
        />
      )}

      {/* Interactive Modals (Rendered conditionally to keep DOM & memory ultra lightweight) */}
      {isPaymentOpen && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          grandTotal={grandTotal}
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
          onSelectMember={(selectedId) => setMemberId(selectedId)}
          currentMemberId={memberId}
        />
      )}

      {isShiftReportOpen && (
        <ShiftReportModal
          isOpen={isShiftReportOpen}
          onClose={() => setIsShiftReportOpen(false)}
          cashierName={currentUser?.name}
          branchId={currentUser?.branch_id}
        />
      )}

      {isNewProductOpen && (
        <NewProductModal
          isOpen={isNewProductOpen}
          onClose={() => setIsNewProductOpen(false)}
          onProductCreated={loadLocalProducts}
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

    </div>
  );
};
