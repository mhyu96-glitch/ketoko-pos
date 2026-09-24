import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Package, 
  AlertTriangle, 
  ArrowRight, 
  Receipt, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  Clock, 
  Beaker, 
  FileText, 
  PlusCircle, 
  HardDrive, 
  Banknote, 
  QrCode, 
  ChevronRight, 
  MapPin, 
  Barcode, 
  Printer, 
  Users, 
  ShieldCheck, 
  Tag, 
  Boxes, 
  Activity, 
  Coins, 
  Store,
  CheckCircle2,
  Search
} from 'lucide-react';
import type { Product, Transaction, User } from '../types';
import { formatRupiah } from '../services/escposService';
import { db } from '../db';

interface DashboardViewProps {
  products?: Product[];
  transactions?: Transaction[];
  currentUser?: User | null;
  userRole?: 'ADMIN' | 'CASHIER' | 'MANAGER' | string;
  onGoToPOS: () => void;
  onOpenRecentTrx: () => void;
  onOpenQATest?: () => void;
  onOpenRestock?: () => void;
  onOpenShiftReport?: () => void;
  onOpenFullReports?: () => void;
  onOpenNewProduct?: () => void;
  onOpenMemberModal?: () => void;
  onOpenPrinterSettings?: () => void;
  isOnline?: boolean;
  pendingSyncCount?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = React.memo(({
  products: initialProducts,
  transactions: initialTransactions,
  currentUser,
  userRole,
  onGoToPOS,
  onOpenRecentTrx,
  onOpenQATest,
  onOpenRestock,
  onOpenShiftReport,
  onOpenFullReports,
  onOpenNewProduct,
  onOpenMemberModal,
  onOpenPrinterSettings,
  isOnline = true,
  pendingSyncCount = 0
}) => {
  const [localProducts, setLocalProducts] = React.useState<Product[]>([]);
  const [localTransactions, setLocalTransactions] = React.useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    if (!initialProducts) {
      db.products.toArray().then(setLocalProducts);
    }
    if (!initialTransactions) {
      db.transactions.toArray().then(setLocalTransactions);
    }
  }, [initialProducts, initialTransactions]);

  const products = initialProducts || localProducts;
  const transactions = initialTransactions || localTransactions;
  const effectiveRole = userRole || currentUser?.role || 'CASHIER';
  const isAdmin = effectiveRole === 'ADMIN' || effectiveRole === 'MANAGER';

  // Fast Single-Pass O(N) Metrics & Aggregations
  const { 
    totalRevenue, 
    totalTransactions, 
    totalItemsSold, 
    lowStockCount, 
    topLowStockProducts,
    cashRevenue,
    nonCashRevenue,
    cashPercent,
    nonCashPercent,
    avgBasketValue,
    recentTrxList
  } = useMemo(() => {
    let revenue = 0;
    let itemsSold = 0;
    let cash = 0;
    let nonCash = 0;

    const tLen = transactions.length;
    for (let i = 0; i < tLen; i++) {
      const t = transactions[i];
      revenue += t.grand_total;
      if (t.payment_method === 'CASH') {
        cash += t.grand_total;
      } else {
        nonCash += t.grand_total;
      }
      const itLen = t.items.length;
      for (let j = 0; j < itLen; j++) {
        itemsSold += t.items[j].qty;
      }
    }

    let count = 0;
    const topLow: Product[] = [];
    const pLen = products.length;
    const q = searchQuery.toLowerCase().trim();

    for (let i = 0; i < pLen; i++) {
      const p = products[i];
      if (p.stock <= p.min_stock_alert) {
        count++;
        if (topLow.length < 25) {
          if (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.id.toLowerCase().includes(q)) {
            topLow.push(p);
          }
        }
      }
    }

    const cPct = revenue > 0 ? Math.round((cash / revenue) * 100) : 100;
    const ncPct = revenue > 0 ? 100 - cPct : 0;
    const avgBasket = tLen > 0 ? Math.round(revenue / tLen) : 0;
    const recent = [...transactions].reverse().slice(0, 4);

    return {
      totalRevenue: revenue,
      totalTransactions: tLen,
      totalItemsSold: itemsSold,
      lowStockCount: count,
      topLowStockProducts: topLow,
      cashRevenue: cash,
      nonCashRevenue: nonCash,
      cashPercent: cPct,
      nonCashPercent: ncPct,
      avgBasketValue: avgBasket,
      recentTrxList: recent
    };
  }, [products, transactions, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f5f1] p-4 sm:p-6 space-y-5">
      
      {/* 1. Modern Executive Command Bar (Redesigned Header) */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#e4d5c7] shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Store Title & Badges */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4] text-[11px] font-extrabold shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7c4e2f]" />
              <span>{isAdmin ? 'Mode Owner & Manager' : 'Sesi Kasir Aktif'}</span>
            </div>

            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#fcf8f4] text-[#6b4832] border border-[#dfcebe] text-[11px] font-bold font-mono">
              <MapPin className="w-3.5 h-3.5 text-[#7c4e2f]" />
              <span>{currentUser?.branch_id ? `Cabang (${currentUser.branch_id})` : 'Cabang Utama'}</span>
            </div>

            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#edf5ee] text-[#166534] border border-[#cce2cf] text-[11px] font-bold">
              <span className={`w-2 h-2 rounded-full ${products.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>
                {products.length > 0
                  ? `Database Offline Ready (${products.length.toLocaleString('id-ID')} SKU)`
                  : 'Database Bersih (0 SKU)'}
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2a1a12] tracking-tight flex items-center space-x-2">
              <Store className="w-6 h-6 text-[#7c4e2f] shrink-0" />
              <span>Pusat Kendali Operasional & Analitik Kasir</span>
            </h1>
            <p className="text-xs text-[#8a6b53] mt-0.5 font-medium">
              Sistem kasir offline-first berkecepatan tinggi • Siap melayani transaksi tanpa delay jaringan
            </p>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {onOpenFullReports && (
            <button
              onClick={onOpenFullReports}
              className="px-4 py-2.5 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#7c4e2f] text-xs font-bold rounded-2xl border border-[#dfcebe] transition-all flex items-center space-x-1.5 shadow-2xs active:scale-95"
            >
              <FileText className="w-4 h-4 text-[#7c4e2f]" />
              <span>Laporan Lengkap</span>
            </button>
          )}

          <button
            onClick={onGoToPOS}
            className="flex-1 lg:flex-none px-6 py-3 bg-[#7c4e2f] hover:bg-[#683f24] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-md flex items-center justify-center space-x-2 transition-all active:scale-95 border border-[#6b4226]"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            <span>Buka Kasir POS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* 2. Top Bento 4-KPI Summary Grid (Luxury Dual-Tone FinTech Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Omset Penjualan */}
        <div className="bg-gradient-to-b from-white to-[#fcf9f5] p-5 rounded-3xl border border-[#e5d5c5] shadow-xs hover:shadow-md hover:border-[#c8a88f] transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-100/80 text-amber-900 border border-amber-200/80 shadow-2xs group-hover:scale-105 transition-transform">
                  <Coins className="w-5 h-5 text-[#7c4e2f]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#8a6b53] block leading-tight">Total Omset Penjualan</span>
                  <span className="text-[10px] text-[#a08573] font-medium">Sesi Kasir Hari Ini</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center shrink-0">
                <TrendingUp className="w-3 h-3 mr-1" />
                Live
              </span>
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black font-mono text-[#7c4e2f] tracking-tight">
                {formatRupiah(totalRevenue)}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#f0e4d7]/80">
            {/* Mini Payment Breakdown Pill */}
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#166534] font-bold flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#166534] mr-1.5 inline-block" />
                Tunai: {formatRupiah(cashRevenue)}
              </span>
              <span className="text-[#0369a1] font-bold flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0369a1] mr-1.5 inline-block" />
                Non-Tunai: {formatRupiah(nonCashRevenue)}
              </span>
            </div>
            {/* Visual mini bar */}
            <div className="w-full h-1.5 bg-[#ebdccf] rounded-full overflow-hidden flex mt-1.5">
              <div style={{ width: `${cashPercent}%` }} className="bg-[#166534] h-full" />
              <div style={{ width: `${nonCashPercent}%` }} className="bg-[#0369a1] h-full" />
            </div>
          </div>
        </div>

        {/* KPI 2: Total Nota Transaksi */}
        <div className="bg-gradient-to-b from-white to-[#fcf9f5] p-5 rounded-3xl border border-[#e5d5c5] shadow-xs hover:shadow-md hover:border-[#c8a88f] transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-2xl bg-orange-100/80 text-orange-900 border border-orange-200/80 shadow-2xs group-hover:scale-105 transition-transform">
                  <Receipt className="w-5 h-5 text-[#96633b]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#8a6b53] block leading-tight">Total Nota Transaksi</span>
                  <span className="text-[10px] text-[#a08573] font-medium">Struk Tercetak</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center shrink-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {totalTransactions} Sukses
              </span>
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black font-mono text-[#3d2617] tracking-tight">
                {totalTransactions} <span className="text-sm font-bold text-[#8a6b53]">Nota</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#f0e4d7]/80 flex items-center justify-between text-[11px] text-[#8a6b53]">
            <span className="font-medium">Rata-rata keranjang:</span>
            <span className="font-mono font-bold text-[#3d2617]">{formatRupiah(avgBasketValue)}</span>
          </div>
        </div>

        {/* KPI 3: Volume Barang Terjual */}
        <div className="bg-gradient-to-b from-white to-[#fcf9f5] p-5 rounded-3xl border border-[#e5d5c5] shadow-xs hover:shadow-md hover:border-[#c8a88f] transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-2xl bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4] shadow-2xs group-hover:scale-105 transition-transform">
                  <Boxes className="w-5 h-5 text-[#7c4e2f]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#8a6b53] block leading-tight">Volume Item Terjual</span>
                  <span className="text-[10px] text-[#a08573] font-medium">Kuantitas Fisik</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4] flex items-center shrink-0">
                <Activity className="w-3 h-3 mr-1" />
                Pcs Keluar
              </span>
            </div>

            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black font-mono text-[#3d2617] tracking-tight">
                {totalItemsSold} <span className="text-sm font-bold text-[#8a6b53]">Pcs</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#f0e4d7]/80 flex items-center justify-between text-[11px] text-[#8a6b53]">
            <span className="font-medium">Perputaran stok:</span>
            <span className="font-bold text-[#166534] flex items-center">
              <TrendingUp className="w-3 h-3 mr-1 inline" />
              Lancar
            </span>
          </div>
        </div>

        {/* KPI 4: Peringatan Stok Menipis */}
        <div className="bg-gradient-to-b from-white to-[#fcf9f5] p-5 rounded-3xl border border-[#e5d5c5] shadow-xs hover:shadow-md hover:border-[#c8a88f] transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2.5 rounded-2xl border shadow-2xs group-hover:scale-105 transition-transform ${lowStockCount > 0 ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#8a6b53] block leading-tight">Peringatan Stok Menipis</span>
                  <span className="text-[10px] text-[#a08573] font-medium">Batas Alert Min.</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border flex items-center shrink-0 ${lowStockCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                <Tag className="w-3 h-3 mr-1" />
                {lowStockCount > 0 ? 'Perlu Restok' : 'Aman'}
              </span>
            </div>

            <div className="mt-4">
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${lowStockCount > 0 ? 'text-rose-800' : 'text-[#3d2617]'}`}>
                {lowStockCount} <span className="text-sm font-bold text-[#8a6b53]">SKU</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#f0e4d7]/80 flex items-center justify-between text-[11px] text-[#8a6b53]">
            <span className="font-medium">{lowStockCount > 0 ? 'Di bawah batas minimum' : 'Semua produk dalam batas aman'}</span>
            {lowStockCount > 0 && (
              <span className="text-rose-700 font-bold flex items-center">
                Urgent
              </span>
            )}
          </div>
        </div>

      </div>

      {/* 3. Balanced Two-Column Section: Low Stock Table & Multi-Widget Ops Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        
        {/* Left Column: Structured Low Stock Table & Distribution (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Card: Low Stock Table */}
          <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs p-4 sm:p-5 flex flex-col space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#f0e4d7] gap-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#3d2617] text-sm leading-tight flex items-center space-x-1.5">
                    <span>Daftar Produk Stok Menipis</span>
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-200">
                      Restok Prioritas
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#8a6b53]">Barang di bawah batas minimum alert yang perlu dipesan ke supplier</p>
                </div>
              </div>

              {/* Mini Search within low stock */}
              <div className="relative w-full sm:w-44">
                <Search className="w-3.5 h-3.5 text-[#8a6b53] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari barang..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#fcf8f4] text-[#2a1a12] rounded-xl border border-[#dfcebe] text-xs focus:bg-white focus:border-[#7c4e2f]"
                />
              </div>
            </div>

            {lowStockCount === 0 ? (
              <div className="py-12 text-center text-[#8a6b53] text-xs flex flex-col items-center">
                <Sparkles className="w-8 h-8 text-[#96633b] mb-2 opacity-60" />
                <p className="font-bold text-[#3d2617]">Semua Stok Produk Aman</p>
                <p className="text-[11px] text-[#8a6b53] mt-0.5">Tidak ada barang yang berada di bawah ambang batas alert.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                {topLowStockProducts.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-[#fcfaf7] hover:bg-[#f6eee4] border border-[#ebdccf] flex items-center justify-between text-xs transition-colors group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="w-5 text-center font-mono text-[10px] font-bold text-[#a08573] shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[#2a1a12] truncate max-w-[190px] sm:max-w-[260px] flex items-center space-x-1.5">
                          <Package className="w-3.5 h-3.5 text-[#7c4e2f] shrink-0" />
                          <span className="truncate">{p.name}</span>
                        </div>
                        <div className="text-[10px] text-[#8a6b53] font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="flex items-center">
                            <Barcode className="w-3 h-3 mr-0.5 inline text-[#a08573]" />
                            {p.barcode || p.id}
                          </span>
                          {p.rack_location && (
                            <span className="px-1.5 py-0.2 bg-[#f0e4d7] text-[#5c3c26] rounded border border-[#dfcebe] flex items-center">
                              <MapPin className="w-2.5 h-2.5 mr-0.5 text-[#7c4e2f]" />
                              Rak: {p.rack_location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2 flex items-center space-x-2">
                      <div>
                        <span className="font-mono font-extrabold text-xs text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 inline-block">
                          Sisa: {p.stock} {p.unit || 'PCS'}
                        </span>
                        <div className="text-[10px] text-[#8a6b53] mt-0.5 font-medium">
                          Min Alert: {p.min_stock_alert} {p.unit || 'PCS'}
                        </div>
                      </div>

                      {onOpenRestock && (
                        <button
                          onClick={onOpenRestock}
                          title={`Restok ${p.name}`}
                          className="px-2.5 py-1 rounded-xl bg-[#faebd7] hover:bg-[#eed7c4] text-[#7c4e2f] font-bold text-[11px] border border-[#ebdccf] transition-all flex items-center space-x-1 shadow-2xs active:scale-95"
                        >
                          <PlusCircle className="w-3 h-3" />
                          <span>Restok</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {lowStockCount > 25 && (
                  <div className="text-center py-2.5 text-[11px] font-bold text-[#7c4e2f] bg-[#faebd7] rounded-2xl border border-[#eed7c4] flex items-center justify-center space-x-1.5">
                    <Boxes className="w-3.5 h-3.5 text-[#7c4e2f]" />
                    <span>Menampilkan 25 dari total {lowStockCount} produk yang perlu restok</span>
                  </div>
                )}
              </div>
            )}

            {onOpenRestock && (
              <div className="pt-2 border-t border-[#f0e4d7] flex justify-between items-center text-xs">
                <span className="text-[11px] text-[#8a6b53] font-medium">
                  Total SKU di bawah batas alert: <b className="text-[#3d2617]">{lowStockCount} barang</b>
                </span>
                <button
                  onClick={onOpenRestock}
                  className="px-4 py-2 bg-[#7c4e2f] hover:bg-[#683f24] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Buka Form Penerimaan Restok</span>
                </button>
              </div>
            )}
          </div>

          {/* Card: Payment Distribution Summary */}
          <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[#3d2617] text-sm flex items-center space-x-1.5">
                <Banknote className="w-4 h-4 text-[#7c4e2f]" />
                <span>Distribusi Metode Pembayaran Hari Ini</span>
              </h3>
              <span className="text-[11px] font-mono text-[#8a6b53] font-bold">
                {totalTransactions} Transaksi
              </span>
            </div>

            {/* Split Progress Bar */}
            <div className="w-full h-2.5 bg-[#ebdccf] rounded-full overflow-hidden flex">
              <div 
                style={{ width: `${cashPercent}%` }} 
                className="bg-[#166534] h-full transition-all duration-500" 
                title={`Tunai: ${cashPercent}%`}
              />
              <div 
                style={{ width: `${nonCashPercent}%` }} 
                className="bg-[#0369a1] h-full transition-all duration-500" 
                title={`Non-Tunai: ${nonCashPercent}%`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-[#edf5ee] border border-[#cce2cf] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#166534]" />
                  <Banknote className="w-4 h-4 text-[#166534]" />
                  <div>
                    <div className="font-bold text-[#166534]">Tunai (Cash Laci)</div>
                    <div className="text-[10px] text-[#15803d] font-mono">{cashPercent}% dari total omset</div>
                  </div>
                </div>
                <span className="font-mono font-black text-sm text-[#166534]">
                  {formatRupiah(cashRevenue)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#f0f7fb] border border-[#cfe2ed] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0369a1]" />
                  <QrCode className="w-4 h-4 text-[#0369a1]" />
                  <div>
                    <div className="font-bold text-[#0369a1]">Non-Tunai (QRIS/EDC)</div>
                    <div className="text-[10px] text-[#0284c7] font-mono">{nonCashPercent}% dari total omset</div>
                  </div>
                </div>
                <span className="font-mono font-black text-sm text-[#0369a1]">
                  {formatRupiah(nonCashRevenue)}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Command Center, Recent Trx & Hardware Hub (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Widget 1: Pintasan Cepat Operasional (6 Interactive Shortcuts) */}
          <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[#3d2617] text-sm flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-[#7c4e2f]" />
                <span>Pintasan Aksi Cepat</span>
              </h3>
              <span className="text-[10px] text-[#8a6b53] font-bold bg-[#fcf8f4] px-2 py-0.5 rounded-lg border border-[#dfcebe]">
                Shortcut POS
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <button
                onClick={onGoToPOS}
                className="p-3 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#7c4e2f] rounded-2xl border border-[#dfcebe] font-bold transition-all text-left flex flex-col justify-between group shadow-2xs active:scale-95"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="p-1.5 rounded-xl bg-white border border-[#dfcebe] text-[#7c4e2f] shadow-2xs">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-[#a08573] bg-white px-1.5 py-0.2 rounded border border-[#dfcebe]">F9</span>
                </div>
                <div>
                  <div className="text-xs font-extrabold">Buka Kasir</div>
                  <div className="text-[10px] text-[#8a6b53] font-normal">Transaksi nota baru</div>
                </div>
              </button>

              <button
                onClick={onOpenRecentTrx}
                className="p-3 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#7c4e2f] rounded-2xl border border-[#dfcebe] font-bold transition-all text-left flex flex-col justify-between group shadow-2xs active:scale-95"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="p-1.5 rounded-xl bg-white border border-[#dfcebe] text-[#7c4e2f] shadow-2xs">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#a08573] group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div>
                  <div className="text-xs font-extrabold">Riwayat Nota</div>
                  <div className="text-[10px] text-[#8a6b53] font-normal">Cetak ulang & refund</div>
                </div>
              </button>

              {onOpenNewProduct && (
                <button
                  onClick={onOpenNewProduct}
                  className="p-3 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#7c4e2f] rounded-2xl border border-[#dfcebe] font-bold transition-all text-left flex flex-col justify-between group shadow-2xs active:scale-95"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="p-1.5 rounded-xl bg-white border border-[#dfcebe] text-[#7c4e2f] shadow-2xs">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#a08573] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold">Tambah Produk</div>
                    <div className="text-[10px] text-[#8a6b53] font-normal">Master data barang</div>
                  </div>
                </button>
              )}

              {onOpenRestock && (
                <button
                  onClick={onOpenRestock}
                  className="p-3 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#7c4e2f] rounded-2xl border border-[#dfcebe] font-bold transition-all text-left flex flex-col justify-between group shadow-2xs active:scale-95"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="p-1.5 rounded-xl bg-white border border-[#dfcebe] text-[#7c4e2f] shadow-2xs">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#a08573] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold">Restok Barang</div>
                    <div className="text-[10px] text-[#8a6b53] font-normal">Penerimaan gudang</div>
                  </div>
                </button>
              )}

              {onOpenShiftReport && (
                <button
                  onClick={onOpenShiftReport}
                  className="p-3 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#7c4e2f] rounded-2xl border border-[#dfcebe] font-bold transition-all text-left flex flex-col justify-between group shadow-2xs active:scale-95"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="p-1.5 rounded-xl bg-white border border-[#dfcebe] text-[#7c4e2f] shadow-2xs">
                      <FileText className="w-4 h-4" />
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#a08573] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold">Rekap Shift</div>
                    <div className="text-[10px] text-[#8a6b53] font-normal">Tutup kasir & uang laci</div>
                  </div>
                </button>
              )}

              {onOpenMemberModal && (
                <button
                  onClick={onOpenMemberModal}
                  className="p-3 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#7c4e2f] rounded-2xl border border-[#dfcebe] font-bold transition-all text-left flex flex-col justify-between group shadow-2xs active:scale-95"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="p-1.5 rounded-xl bg-white border border-[#dfcebe] text-[#7c4e2f] shadow-2xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#a08573] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold">Pelanggan</div>
                    <div className="text-[10px] text-[#8a6b53] font-normal">Diskon member & data</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Widget 2: Transaksi Kasir Terbaru (Live Feed) */}
          <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[#3d2617] text-sm flex items-center space-x-1.5">
                <Receipt className="w-4 h-4 text-[#7c4e2f]" />
                <span>Transaksi Kasir Terbaru</span>
              </h3>
              <button
                onClick={onOpenRecentTrx}
                className="text-[11px] font-bold text-[#7c4e2f] hover:underline flex items-center"
              >
                <span>Semua Nota</span>
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>

            {recentTrxList.length === 0 ? (
              <div className="py-6 text-center text-[#8a6b53] text-xs">
                Belum ada transaksi pada sesi ini
              </div>
            ) : (
              <div className="space-y-2">
                {recentTrxList.map((t) => (
                  <div
                    key={t.id}
                    onClick={onOpenRecentTrx}
                    className="p-2.5 rounded-2xl bg-[#fcfaf7] hover:bg-[#f6eee4] border border-[#ebdccf] flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-bold text-[#2a1a12] flex items-center space-x-1.5">
                        <span className="font-mono text-[11px]">{t.id}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${t.payment_method === 'CASH' ? 'bg-[#edf5ee] text-[#166534]' : 'bg-[#f0f7fb] text-[#0369a1]'}`}>
                          {t.payment_method}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#8a6b53] mt-0.5">
                        {t.items.length} item • {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#7c4e2f]">
                        {formatRupiah(t.grand_total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Widget 3: Status Hardware & Sinkronisasi */}
          <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[#3d2617] text-sm flex items-center space-x-1.5">
                <HardDrive className="w-4 h-4 text-[#7c4e2f]" />
                <span>Status Sinkronisasi & Hardware</span>
              </h3>
              {onOpenPrinterSettings && (
                <button
                  onClick={onOpenPrinterSettings}
                  className="text-[10px] text-[#7c4e2f] hover:text-[#5c371e] font-bold flex items-center space-x-1"
                >
                  <Printer className="w-3 h-3" />
                  <span>Atur</span>
                </button>
              )}
            </div>
            
            <div className="space-y-2 text-xs">
              {/* Cloud Sync Status */}
              <div className="p-3 rounded-2xl bg-[#fcf9f5] border border-[#e5d0be] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {isOnline ? (
                    <Wifi className="w-4 h-4 text-[#166534]" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-[#c25e10] animate-pulse" />
                  )}
                  <div>
                    <span className="font-bold text-[#3d2617]">Koneksi Cloud</span>
                    <div className="text-[10px] text-[#8a6b53]">Backend sync service</div>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${isOnline ? 'bg-[#edf5ee] text-[#166534] border border-[#cce2cf]' : 'bg-[#faebd7] text-[#96633b] border border-[#eed7c4]'}`}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>

              {/* Offline Queue */}
              <div className="p-3 rounded-2xl bg-[#fcf9f5] border border-[#e5d0be] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#7c4e2f]" />
                  <div>
                    <span className="font-bold text-[#3d2617]">Antrean Sinkronisasi</span>
                    <div className="text-[10px] text-[#8a6b53]">Transaksi offline menunggu</div>
                  </div>
                </div>
                <span className="font-mono font-black text-[#3d2617] bg-[#f5ebe0] px-2.5 py-0.5 rounded-full border border-[#ddc3aa]">
                  {pendingSyncCount} nota
                </span>
              </div>

              {/* Thermal Printer Hardware */}
              <div className="p-3 rounded-2xl bg-[#fcf9f5] border border-[#e5d0be] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Printer className="w-4 h-4 text-[#7c4e2f]" />
                  <div>
                    <span className="font-bold text-[#3d2617]">Printer Struk Thermal</span>
                    <div className="text-[10px] text-[#8a6b53]">ESC/POS Serial & USB</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-[11px] text-[#166534] bg-[#edf5ee] px-2.5 py-0.5 rounded-full border border-[#cce2cf] flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 inline-block" />
                  Siap Cetak
                </span>
              </div>
            </div>

            {isAdmin && onOpenQATest && (
              <div className="pt-1">
                <button
                  onClick={onOpenQATest}
                  className="w-full py-2.5 bg-[#faebd7] hover:bg-[#f6dfc4] text-[#7c4e2f] text-xs font-bold rounded-xl border border-[#eed7c4] transition-colors flex items-center justify-center space-x-1.5 shadow-2xs active:scale-95"
                >
                  <Beaker className="w-3.5 h-3.5 text-[#7c4e2f]" />
                  <span>Uji QA Matrix Offline / Online</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
});
