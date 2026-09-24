import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu,
  LayoutDashboard,
  Package, 
  Truck, 
  ShoppingBasket, 
  Layers, 
  Settings, 
  ChevronDown,
  Store,
  Receipt,
  Users,
  Printer,
  Beaker,
  RefreshCw,
  FileText,
  Sparkles,
  BarChart3,
  TrendingUp,
  Flame,
  CreditCard,
  ArrowRight,
  RotateCcw,
  PlusCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  FileSpreadsheet,
  Database,
  UserPlus,
  Palette,
  Tag,
  KeyRound,
  ShieldCheck,
  Download
} from 'lucide-react';

export type NavView = 'pos' | 'dashboard' | 'inventory' | 'products' | 'settings' | 'superadmin';

interface TopMenuBarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  onOpenRecentTrx: () => void;
  onOpenQATest: () => void;
  onOpenPrinterSettings: () => void;
  onOpenRestock: () => void;
  onOpenPurchaseOrder?: () => void;
  onOpenMemberModal: () => void;
  onOpenShiftReport: () => void;
  onOpenBarcodeLabels?: () => void;
  onOpenLicense?: () => void;
  onOpenNewProduct: () => void;
  onOpenFullReports?: (initialTab?: 'sales' | 'products' | 'profit' | 'inventory' | 'payment') => void;
  onOpenOmsetChart?: () => void;
  onOpenCustomerSupplier?: (tab?: 'customer' | 'supplier') => void;
  onOpenDebtReceivable?: (tab?: 'debt' | 'receivable' | 'report') => void;
  onOpenPurchasesAndReturns?: (tab?: 'history' | 'purchase_return' | 'sales_return' | 'add_purchase') => void;
  onOpenStockAdjustments?: (tab?: 'in' | 'out' | 'opname') => void;
  onOpenStoreSettings?: (tab?: 'profile' | 'theme' | 'csv' | 'backup' | 'users') => void;
  onOpenPWAInstall?: () => void;
  pendingSyncCount: number;
  lowStockCount: number;
  overdueCount?: number;
  userRole?: string;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = React.memo(({
  currentView,
  onNavigate,
  onOpenRecentTrx,
  onOpenQATest,
  onOpenPrinterSettings,
  onOpenRestock,
  onOpenPurchaseOrder: _onOpenPurchaseOrder,
  onOpenMemberModal,
  onOpenShiftReport,
  onOpenBarcodeLabels,
  onOpenLicense,
  onOpenNewProduct,
  onOpenFullReports,
  onOpenOmsetChart,
  onOpenCustomerSupplier,
  onOpenDebtReceivable,
  onOpenPurchasesAndReturns,
  onOpenStockAdjustments,
  onOpenStoreSettings,
  onOpenPWAInstall,
  lowStockCount,
  overdueCount = 0,
  userRole = 'CASHIER'
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = userRole === 'SUPERADMIN';
  const isAdmin = isSuperAdmin || userRole === 'ADMIN' || userRole === 'MANAGER';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  const navButtonBase = "inline-flex items-center space-x-2 px-3.5 py-1.5 h-9 rounded-xl text-xs font-semibold transition-all border shadow-xs select-none cursor-pointer";

  return (
    <nav 
      ref={menuRef} 
      className="bg-white border-b border-[#e4d5c7] px-3 sm:px-5 py-2 select-none z-40 relative shadow-xs overflow-visible w-full"
    >
      <div className="w-full flex items-center justify-between overflow-visible gap-2">
        
        {/* MOBILE MENU HEADER: Visible only on mobile screens (< md) */}
        <div className="flex md:hidden items-center justify-between w-full">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onNavigate('pos');
                setIsMobileMenuOpen(false);
              }}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                currentView === 'pos'
                  ? 'bg-[#7c4e2f] text-white border-[#633e26] shadow-xs'
                  : 'bg-[#fcf8f4] text-[#543c2e] border-[#dfcebe]'
              }`}
            >
              <ShoppingBasket className="w-3.5 h-3.5" />
              <span>Kasir POS</span>
            </button>

            {currentView !== 'pos' && (
              <span className="px-2.5 py-1 rounded-lg bg-[#faebd7] text-[#7c4e2f] font-bold text-[10px] border border-[#ecdac5] uppercase">
                {currentView}
              </span>
            )}
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              isMobileMenuOpen
                ? 'bg-[#f5ece3] text-[#6d4327] border-[#dfcebe] ring-2 ring-[#7c4e2f]/20'
                : 'bg-white text-[#543c2e] border-[#e4d5c7]'
            }`}
          >
            <Menu className="w-3.5 h-3.5 text-[#7c4e2f]" />
            <span>Menu Toko</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isMobileMenuOpen ? 'rotate-180 text-[#7c4e2f]' : ''}`} />
          </button>
        </div>

        {/* DESKTOP MENU: Ordered Navigation (hidden on mobile, visible on md+) */}
        <div className="hidden md:flex items-center space-x-2 sm:space-x-2.5 overflow-visible flex-nowrap">
          
          {/* 1. Dashboard */}
          <button
            onClick={() => {
              onNavigate('dashboard');
              setOpenDropdown(null);
            }}
            className={`${navButtonBase} ${
              currentView === 'dashboard'
                ? 'bg-[#f5ece3] text-[#6d4327] border-[#dfcebe] ring-2 ring-[#7c4e2f]/20 font-bold'
                : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${currentView === 'dashboard' ? 'text-[#7c4e2f]' : 'text-[#8c7766]'}`} />
            <span>Dashboard</span>
          </button>

          {/* 2. Master Data (Khusus ADMIN) */}
          {isAdmin && (
            <div className="relative shrink-0 overflow-visible">
              <button
                onClick={() => toggleDropdown('master')}
                className={`${navButtonBase} ${
                  currentView === 'products' || openDropdown === 'master'
                    ? 'bg-[#f5ece3] text-[#6d4327] border-[#dfcebe] ring-2 ring-[#7c4e2f]/20 font-bold'
                    : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
                }`}
              >
                <Package className={`w-4 h-4 ${currentView === 'products' || openDropdown === 'master' ? 'text-[#7c4e2f]' : 'text-[#8c7766]'}`} />
                <span>Master Data</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#a08573] transition-transform duration-150 ${openDropdown === 'master' ? 'rotate-180 text-[#7c4e2f]' : ''}`} />
              </button>

              {openDropdown === 'master' && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-md border border-[#e4d5c7] rounded-2xl shadow-2xl p-1.5 z-50 animate-fadeIn space-y-1 ring-1 ring-black/5">
                  {/* Item Baru */}
                  <button
                    onClick={() => {
                      onOpenNewProduct();
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl bg-[#fcf5ed] text-[#96633b] hover:bg-[#f7ece0] flex items-center space-x-3 transition-colors border border-[#eed7c4] group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0 shadow-2xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#96633b] whitespace-nowrap">+ Item Baru</div>
                      <div className="text-[10px] text-[#8c5e3c] font-medium whitespace-nowrap">Tambah SKU & harga baru</div>
                    </div>
                  </button>

                  {/* Daftar Item & Harga */}
                  <button
                    onClick={() => {
                      onNavigate('products');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Daftar Item & Harga</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Tabel harga beli, eceran, & grosir</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-[#f0e4d7]" />

                  {/* Data Pelanggan (+ Kode) */}
                  <button
                    onClick={() => {
                      onOpenCustomerSupplier?.('customer');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#edf5ee] text-[#166534] flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Data Pelanggan (+ Kode)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Kode PLG, limit piutang & WhatsApp</div>
                    </div>
                  </button>

                  {/* Data Supplier (+ Kode) */}
                  <button
                    onClick={() => {
                      onOpenCustomerSupplier?.('supplier');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#6d4327] flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Data Supplier (+ Kode)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Kode SUP, sales person & TOP tempo hari</div>
                    </div>
                  </button>
                  
                  <div className="my-1 border-t border-[#f0e4d7]" />

                  {/* Lokasi Rak & Gudang */}
                  <button
                    onClick={() => {
                      onNavigate('inventory');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Lokasi Rak & Gudang</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Manajemen tata letak rak toko</div>
                    </div>
                  </button>

                  {/* Member & Pelanggan Diskon */}
                  <button
                    onClick={() => {
                      onOpenMemberModal();
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Member & Diskon Kasir</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Diskon 5% otomatis & riwayat poin</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-[#f0e4d7]" />

                  {/* Cetak Label Barcode & Rak */}
                  <button
                    onClick={() => {
                      onOpenBarcodeLabels?.();
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#96633b] flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#3d2617] whitespace-nowrap">Cetak Label Barcode & Rak</div>
                      <div className="text-[10px] text-[#8a6b53] font-medium whitespace-nowrap">Stiker barcode & price tag rak toko</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Pembelian (Khusus ADMIN) */}
          {isAdmin && (
            <div className="relative shrink-0 overflow-visible">
              <button
                onClick={() => toggleDropdown('pembelian')}
                className={`${navButtonBase} ${
                  openDropdown === 'pembelian'
                    ? 'bg-[#f5ece3] text-[#6d4327] border-[#dfcebe] ring-2 ring-[#7c4e2f]/20 font-bold'
                    : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
                }`}
              >
                <Truck className={`w-4 h-4 ${openDropdown === 'pembelian' ? 'text-[#7c4e2f]' : 'text-[#8c7766]'}`} />
                <span>Pembelian</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#a08573] transition-transform duration-150 ${openDropdown === 'pembelian' ? 'rotate-180 text-[#7c4e2f]' : ''}`} />
              </button>

              {openDropdown === 'pembelian' && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-md border border-[#e4d5c7] rounded-2xl shadow-2xl p-1.5 z-50 animate-fadeIn space-y-1 ring-1 ring-black/5">
                  {/* Histori Pembelian */}
                  <button
                    onClick={() => {
                      onOpenPurchasesAndReturns?.('history');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Histori Faktur Pembelian</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Riwayat nota beli & input faktur baru</div>
                    </div>
                  </button>

                  {/* Tambah Pembelian (Input Faktur Beli Baru) */}
                  <button
                    onClick={() => {
                      onOpenPurchasesAndReturns?.('add_purchase');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#edf5ee] text-[#166534] flex items-center justify-center shrink-0">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Tambah Pembelian</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Input faktur masuk, supplier & tempo</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-[#f0e4d7]" />

                  {/* Retur Pembelian ke Supplier */}
                  <button
                    onClick={() => {
                      onOpenPurchasesAndReturns?.('purchase_return');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#fbeeed] text-[#992828] flex items-center justify-center shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Retur Pembelian (Supplier)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Kembalikan barang rusak/cacat/expired</div>
                    </div>
                  </button>

                  {/* Hutang ke Supplier */}
                  <button
                    onClick={() => {
                      onOpenDebtReceivable?.('debt');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Hutang ke Supplier (A/P)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Faktur tempo & pengingat jatuh tempo</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. Penjualan (Kasir POS - Primary Cocoa Button) */}
          <div className="relative shrink-0 overflow-visible">
            <button
              onClick={() => toggleDropdown('penjualan')}
              className={`${navButtonBase} ${
                currentView === 'pos' || openDropdown === 'penjualan'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] ring-2 ring-[#8c5e3c]/20 font-bold'
                  : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
              }`}
            >
              <ShoppingBasket className={`w-4 h-4 ${currentView === 'pos' || openDropdown === 'penjualan' ? 'text-amber-200' : 'text-[#8c7766]'}`} />
              <span>Penjualan</span>
              <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-150 ${openDropdown === 'penjualan' ? 'rotate-180 text-amber-200' : ''}`} />
            </button>

            {openDropdown === 'penjualan' && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-md border border-[#e4d5c7] rounded-2xl shadow-2xl p-1.5 z-50 animate-fadeIn space-y-1 ring-1 ring-black/5">
                <button
                  onClick={() => {
                    onNavigate('pos');
                    setOpenDropdown(null);
                  }}
                  className="w-full p-2 text-left rounded-xl bg-[#fcf5ed] text-[#96633b] hover:bg-[#f7ece0] flex items-center space-x-3 transition-colors border border-[#eed7c4] group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#7c4e2f] text-amber-200 flex items-center justify-center shrink-0 shadow-2xs">
                    <ShoppingBasket className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[#96633b] font-black text-xs whitespace-nowrap">Kasir POS (Aktif)</div>
                    <div className="text-[10px] text-[#8c5e3c] font-medium whitespace-nowrap">Scan barcode & bayar nota kasir</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onOpenRecentTrx();
                    setOpenDropdown(null);
                  }}
                  className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Riwayat Transaksi & Struk</div>
                    <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Cetak ulang nota kasir penjualan</div>
                  </div>
                </button>

                <div className="my-1 border-t border-[#f0e4d7]" />

                {/* Retur Penjualan dari Pelanggan */}
                <button
                  onClick={() => {
                    onOpenPurchasesAndReturns?.('sales_return');
                    setOpenDropdown(null);
                  }}
                  className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#edf5ee] text-[#166534] flex items-center justify-center shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Retur Penjualan (Pelanggan)</div>
                    <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Tukar barang cacat & kembalikan dana</div>
                  </div>
                </button>

                {/* Piutang Pelanggan (Buku Bon) */}
                <button
                  onClick={() => {
                    onOpenDebtReceivable?.('receivable');
                    setOpenDropdown(null);
                  }}
                  className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Piutang Pelanggan (Buku Bon)</div>
                    <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Tagihan bon & reminder jatuh tempo</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 5. Persediaan (Khusus ADMIN) */}
          {isAdmin && (
            <div className="relative shrink-0 overflow-visible">
              <button
                onClick={() => toggleDropdown('persediaan')}
                className={`${navButtonBase} ${
                  currentView === 'inventory' || openDropdown === 'persediaan'
                    ? 'bg-[#f5ece3] text-[#6d4327] border-[#dfcebe] ring-2 ring-[#7c4e2f]/20 font-bold'
                    : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
                }`}
              >
                <Layers className={`w-4 h-4 ${currentView === 'inventory' || openDropdown === 'persediaan' ? 'text-[#7c4e2f]' : 'text-[#8c7766]'}`} />
                <span>Persediaan</span>
                {lowStockCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-pulse" />
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-[#a08573] transition-transform duration-150 ${openDropdown === 'persediaan' ? 'rotate-180 text-[#7c4e2f]' : ''}`} />
              </button>

              {openDropdown === 'persediaan' && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-md border border-[#e4d5c7] rounded-2xl shadow-2xl p-1.5 z-50 animate-fadeIn space-y-1 ring-1 ring-black/5">
                  <button
                    onClick={() => {
                      onNavigate('inventory');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Daftar Stok Produk</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Status stok & mutasi barang rak</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-[#f0e4d7]" />

                  {/* Item Masuk (Bonus Sales) */}
                  <button
                    onClick={() => {
                      onOpenStockAdjustments?.('in');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#edf5ee] text-[#166534] flex items-center justify-center shrink-0">
                      <ArrowDownToLine className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Item Masuk (Bonus/Sampel)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Bonus sales dari distributor</div>
                    </div>
                  </button>

                  {/* Item Keluar (Pemberian/Rusak) */}
                  <button
                    onClick={() => {
                      onOpenStockAdjustments?.('out');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <ArrowUpFromLine className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Item Keluar (Hadiah/Rusak)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Diberikan ke orang, rusak, expired</div>
                    </div>
                  </button>

                  {/* Stok Opname */}
                  <button
                    onClick={() => {
                      onOpenStockAdjustments?.('opname');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#edf5ee] text-[#166534] flex items-center justify-center shrink-0">
                      <ClipboardCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Stok Opname Fisik</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Hitung riil & rekonsiliasi selisih stok</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-[#f0e4d7]" />

                  <button
                    onClick={() => {
                      onOpenRestock();
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Restock Masuk Cepat</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Tambah kuantitas barang toko</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 6. Laporan (Comprehensive Reporting Dropdown) */}
          <div className="relative shrink-0 overflow-visible">
            <button
              onClick={() => toggleDropdown('laporan')}
              className={`${navButtonBase} ${
                openDropdown === 'laporan'
                  ? 'bg-[#f5ece3] text-[#6d4327] border-[#dfcebe] ring-2 ring-[#7c4e2f]/20 font-bold'
                  : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
              }`}
            >
              <BarChart3 className={`w-4 h-4 ${openDropdown === 'laporan' ? 'text-[#7c4e2f]' : 'text-[#8c7766]'}`} />
              <span>Laporan</span>
              {overdueCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-[#a08573] transition-transform duration-150 ${openDropdown === 'laporan' ? 'rotate-180 text-[#7c4e2f]' : ''}`} />
            </button>

            {openDropdown === 'laporan' && (
              <div className="absolute left-0 top-full mt-2 w-84 bg-white/95 backdrop-blur-md border border-[#e4d5c7] rounded-3xl shadow-2xl overflow-hidden z-50 animate-fadeIn p-2 space-y-2 ring-1 ring-black/5">
                
                {/* Executive Center Banner Trigger - Warm Milk Chocolate */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenFullReports?.('sales');
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left p-3 bg-gradient-to-br from-[#96633b] to-[#7c4e2f] text-white rounded-2xl flex items-center justify-between shadow-xs hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div>
                    <div className="text-xs font-black text-white flex items-center space-x-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-amber-200" />
                      <span>Pusat Laporan Lengkap</span>
                    </div>
                    <p className="text-[10px] text-[#e8d5c4] mt-0.5 whitespace-nowrap">Semua data analitik terpusat</p>
                  </div>

                  <div className="px-2.5 py-1.5 bg-white text-[#96633b] rounded-xl text-[11px] font-black flex items-center space-x-1 transition-all shadow-xs group-hover:bg-[#faebd7]">
                    <span>Buka</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>

                {/* Section 1: Laporan Kasir & Penjualan */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7766] px-2.5 pt-1 block">
                    Penjualan & Kasir
                  </span>

                  {/* Laporan Penjualan Shift Kasir */}
                  <button
                    onClick={() => {
                      onOpenShiftReport();
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Laporan Penjualan (Shift)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Rekap omset harian kasir</div>
                    </div>
                  </button>

                  {/* Laporan Produk Terlaris */}
                  <button
                    onClick={() => {
                      onOpenFullReports?.('products');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Laporan Produk Terlaris (Top 5)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Ranking produk paling laku</div>
                    </div>
                  </button>

                  {/* Laporan Metode Pembayaran */}
                  <button
                    onClick={() => {
                      onOpenFullReports?.('payment');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Laporan Metode Pembayaran</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Analisis Cash, QRIS, & Transfer</div>
                    </div>
                  </button>
                </div>

                {/* Section 2: Finansial & Persediaan */}
                {isAdmin && (
                  <div className="space-y-0.5 pt-1 border-t border-[#f0e4d7]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7766] px-2.5 pt-1 block">
                      Finansial & Gudang
                    </span>

                    {/* Laporan Hutang Piutang */}
                    <button
                      onClick={() => {
                        onOpenDebtReceivable?.('report');
                        setOpenDropdown(null);
                      }}
                      className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#fbeeed] text-[#992828] flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#332219] flex items-center space-x-1 whitespace-nowrap">
                          <span>Laporan Hutang & Piutang</span>
                          {overdueCount > 0 && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-red-500 text-white font-black animate-pulse">
                              {overdueCount} Lewat
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Rekap hutang supplier & bon pelanggan</div>
                      </div>
                    </button>

                    {/* Laporan Laba Rugi */}
                    <button
                      onClick={() => {
                        onOpenFullReports?.('profit');
                        setOpenDropdown(null);
                      }}
                      className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#edf5ee] text-[#166534] flex items-center justify-center shrink-0">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Laporan Laba Kotor & Bersih</div>
                        <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Margin keuntungan riil toko</div>
                      </div>
                    </button>

                    {/* Laporan Valuasi & Mutasi Persediaan */}
                    <button
                      onClick={() => {
                        onOpenFullReports?.('inventory');
                        setOpenDropdown(null);
                      }}
                      className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Laporan Nilai Aset Persediaan</div>
                        <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Valuasi rupiah stok rak & gudang</div>
                      </div>
                    </button>

                    {/* Grafik Analisis Omset */}
                    <button
                      onClick={() => {
                        if (onOpenOmsetChart) {
                          onOpenOmsetChart();
                        } else {
                          onNavigate('dashboard');
                        }
                        setOpenDropdown(null);
                      }}
                      className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Grafik Omset & Statistik</div>
                        <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Visualisasi tren & grafik batang harian</div>
                      </div>
                    </button>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* 7. Pengaturan (Khusus ADMIN) */}
          {isAdmin && (
            <div className="relative shrink-0 overflow-visible">
              <button
                onClick={() => toggleDropdown('pengaturan')}
                className={`${navButtonBase} ${
                  openDropdown === 'pengaturan'
                    ? 'bg-[#f5ece3] text-[#6d4327] border-[#dfcebe] ring-2 ring-[#7c4e2f]/20 font-bold'
                    : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
                }`}
              >
                <Settings className={`w-4 h-4 ${openDropdown === 'pengaturan' ? 'text-[#7c4e2f]' : 'text-[#8c7766]'}`} />
                <span>Pengaturan</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#a08573] transition-transform duration-150 ${openDropdown === 'pengaturan' ? 'rotate-180 text-[#7c4e2f]' : ''}`} />
              </button>

              {openDropdown === 'pengaturan' && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-md border border-[#e4d5c7] rounded-2xl shadow-2xl p-1.5 z-50 animate-fadeIn space-y-1 ring-1 ring-black/5">
                  {/* Tema & Palet Warna */}
                  <button
                    onClick={() => {
                      onOpenStoreSettings?.('theme');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#96633b] flex items-center justify-center shrink-0">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#3d2617] whitespace-nowrap">Tema & Palet Warna</div>
                      <div className="text-[10px] text-[#8a6b53] font-medium whitespace-nowrap">Pilihan warna soft, cerah & dark mode</div>
                    </div>
                  </button>

                  {/* Data Toko & Input Logo */}
                  <button
                    onClick={() => {
                      onOpenStoreSettings?.('profile');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#3d2617] whitespace-nowrap">Data Toko & Input Logo</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Upload logo & alamat cabang</div>
                    </div>
                  </button>

                  {/* Import / Export Item CSV */}
                  <button
                    onClick={() => {
                      onOpenStoreSettings?.('csv');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#edf5ee] text-[#166534] flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Import / Export Item (CSV)</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Download Excel & impor masal</div>
                    </div>
                  </button>


                  {/* Backup & Restore DB */}
                  <button
                    onClick={() => {
                      onOpenStoreSettings?.('backup');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Backup & Restore DB</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Cadangkan seluruh database POS</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-[#f0e4d7]" />

                  {/* Manajemen User (Admin & Kasir) */}
                  <button
                    onClick={() => {
                      onOpenStoreSettings?.('users');
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#faebd7] text-[#7c4e2f] flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Manajemen User Role</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Tambah akun Admin & Kasir</div>
                    </div>
                  </button>

                  {/* Setting Printer */}
                  <button
                    onClick={() => {
                      onOpenPrinterSettings();
                      setOpenDropdown(null);
                    }}
                    className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Setting Printer Thermal</div>
                      <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">USB / Bluetooth / WebSerial ESC/POS</div>
                    </div>
                  </button>

                  {/* Pasang Aplikasi PWA */}
                  {onOpenPWAInstall && (
                    <button
                      onClick={() => {
                        onOpenPWAInstall();
                        setOpenDropdown(null);
                      }}
                      className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Pasang Aplikasi (PWA)</div>
                        <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Install di layar utama HP & Komputer</div>
                      </div>
                    </button>
                  )}

                  {/* Lisensi & Aktivasi (Khusus Superadmin / Vendor) */}
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        onOpenLicense?.();
                        setOpenDropdown(null);
                      }}
                      className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Lisensi & Aktivasi Aplikasi</div>
                        <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Kode mesin, status PRO & aktivasi</div>
                      </div>
                    </button>
                  )}

                  {/* Panel QA (Khusus Superadmin / Vendor) */}
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        onOpenQATest();
                        setOpenDropdown(null);
                      }}
                      className="w-full p-2 text-left rounded-xl text-[#96633b] hover:bg-[#fbf7f2] flex items-center space-x-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#f5ece3] text-[#543c2e] flex items-center justify-center shrink-0">
                        <Beaker className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#332219] whitespace-nowrap">Panel Simulasi QA & Lab</div>
                        <div className="text-[10px] text-[#856b59] font-medium whitespace-nowrap">Test grosir, offline, & latensi</div>
                      </div>
                    </button>
                  )}

                  {/* Portal Vendor (Khusus Superadmin) */}
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        onNavigate('superadmin');
                        setOpenDropdown(null);
                      }}
                      className="w-full p-2 text-left rounded-xl bg-purple-50 text-purple-900 hover:bg-purple-100 flex items-center space-x-3 transition-colors group border border-purple-200"
                    >
                      <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-purple-900 whitespace-nowrap">👑 Portal Vendor Superadmin</div>
                        <div className="text-[10px] text-purple-700 font-medium whitespace-nowrap">Kelola toko klien, lisensi & server</div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Direct Portal Superadmin Button in Navigation Bar */}
          {isSuperAdmin && (
            <button
              onClick={() => {
                onNavigate('superadmin');
                setOpenDropdown(null);
              }}
              className={`${navButtonBase} ${
                currentView === 'superadmin'
                  ? 'bg-purple-900 text-purple-100 border-purple-700 ring-2 ring-purple-500/30 font-bold'
                  : 'bg-purple-100/80 hover:bg-purple-200 text-purple-950 border-purple-300 font-extrabold'
              }`}
              title="Pusat Kontrol Vendor & Superadmin"
            >
              <ShieldCheck className="w-4 h-4 text-purple-700" />
              <span>Portal Vendor</span>
            </button>
          )}

        </div>

        {/* Right Info Badges */}
        <div className="flex items-center space-x-2 text-xs text-[#856b59] shrink-0">
          <div className="hidden sm:flex items-center space-x-1.5 bg-[#fbf7f2] px-2.5 py-1 rounded-lg border border-[#e4d5c7]">
            <Store className="w-3.5 h-3.5 text-[#7c4e2f]" />
            <span className="font-semibold text-[#332219]">Toko Samarinda</span>
          </div>
        </div>

      </div>

      {/* MOBILE ERP DRAWER / POPOVER MENU (Only shown when Menu Toko is toggled on mobile) */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-2 pt-2 border-t border-[#ebdccf] grid grid-cols-2 gap-2 pb-1 animate-fadeIn">
          {/* 1. Dashboard */}
          <button
            onClick={() => {
              onNavigate('dashboard');
              setIsMobileMenuOpen(false);
            }}
            className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
          >
            <LayoutDashboard className="w-4 h-4 text-[#7c4e2f]" />
            <span>Dashboard</span>
          </button>

          {/* 2. Master Data / Daftar Produk */}
          {isAdmin && (
            <button
              onClick={() => {
                onNavigate('products');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
            >
              <Package className="w-4 h-4 text-[#7c4e2f]" />
              <span>Daftar Produk</span>
            </button>
          )}

          {/* 3. + Item Baru */}
          {isAdmin && (
            <button
              onClick={() => {
                onOpenNewProduct();
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#fcf5ed] hover:bg-[#f7ece0] border border-[#eed7c4] text-left flex items-center space-x-2 text-xs font-bold text-[#96633b]"
            >
              <Sparkles className="w-4 h-4 text-[#7c4e2f]" />
              <span>+ Item Baru</span>
            </button>
          )}

          {/* 4. Riwayat Transaksi */}
          <button
            onClick={() => {
              onOpenRecentTrx();
              setIsMobileMenuOpen(false);
            }}
            className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
          >
            <Receipt className="w-4 h-4 text-[#7c4e2f]" />
            <span>Riwayat Transaksi</span>
          </button>

          {/* 5. Restock Barang */}
          <button
            onClick={() => {
              onOpenRestock();
              setIsMobileMenuOpen(false);
            }}
            className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
          >
            <Truck className="w-4 h-4 text-[#7c4e2f]" />
            <span>Restock Barang</span>
          </button>

          {/* 6. Pusat Laporan */}
          <button
            onClick={() => {
              onOpenFullReports?.();
              setIsMobileMenuOpen(false);
            }}
            className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
          >
            <BarChart3 className="w-4 h-4 text-[#7c4e2f]" />
            <span>Pusat Laporan</span>
          </button>

          {/* 7. Rekap Shift Kasir */}
          <button
            onClick={() => {
              onOpenShiftReport();
              setIsMobileMenuOpen(false);
            }}
            className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
          >
            <FileText className="w-4 h-4 text-[#7c4e2f]" />
            <span>Rekap Shift</span>
          </button>

          {/* 8. Grafik Omset */}
          <button
            onClick={() => {
              onOpenOmsetChart?.();
              setIsMobileMenuOpen(false);
            }}
            className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
          >
            <TrendingUp className="w-4 h-4 text-[#7c4e2f]" />
            <span>Grafik Omset</span>
          </button>

          {/* 9. Printer Kasir */}
          <button
            onClick={() => {
              onOpenPrinterSettings();
              setIsMobileMenuOpen(false);
            }}
            className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
          >
            <Printer className="w-4 h-4 text-[#7c4e2f]" />
            <span>Printer Kasir</span>
          </button>

          {/* 10. Pengaturan Toko */}
          {isAdmin && (
            <button
              onClick={() => {
                onOpenStoreSettings?.('profile');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-[#fcf8f4] hover:bg-[#faebd7] border border-[#ebdccf] text-left flex items-center space-x-2 text-xs font-bold text-[#5c3c26]"
            >
              <Settings className="w-4 h-4 text-[#7c4e2f]" />
              <span>Pengaturan Toko</span>
            </button>
          )}

          {/* 11. Portal Vendor (Superadmin) */}
          {isSuperAdmin && (
            <button
              onClick={() => {
                onNavigate('superadmin');
                setIsMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-300 text-left flex items-center space-x-2 text-xs font-extrabold text-purple-950 col-span-2"
            >
              <ShieldCheck className="w-4 h-4 text-purple-700" />
              <span>👑 Portal Vendor Superadmin</span>
            </button>
          )}
        </div>
      )}
    </nav>
  );
});
