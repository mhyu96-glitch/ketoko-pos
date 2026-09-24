import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Printer, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Banknote, 
  QrCode, 
  CreditCard, 
  Receipt, 
  Eye,
  Trash2,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { db } from '../db';
import type { Transaction } from '../types';
import { formatRupiah } from '../services/escposService';
import { syncService } from '../services/syncService';

interface RecentTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReceipt: (trx: Transaction) => void;
  userRole?: 'SUPERADMIN' | 'ADMIN' | 'CASHIER' | 'MANAGER';
  onTransactionDeleted?: (trxId: string) => void;
}

export const RecentTransactionsModal: React.FC<RecentTransactionsModalProps> = ({
  isOpen,
  onClose,
  onSelectReceipt,
  userRole,
  onTransactionDeleted
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [viewingItemsTrx, setViewingItemsTrx] = useState<Transaction | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<{ success: boolean; message: string } | null>(null);

  const canDelete = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
      setDeleteStatus(null);
    }
  }, [isOpen]);

  // Real-time listener: jika transaksi dihapus oleh admin di terminal/tab lain, hapus dari list langsung tanpa refresh
  useEffect(() => {
    const handleRemoteDelete = (e: any) => {
      const id = e.detail?.id;
      if (id) {
        setTransactions(prev => prev.filter(t => t.id !== id));
      }
    };
    window.addEventListener('ketoko_transaction_deleted', handleRemoteDelete);
    return () => window.removeEventListener('ketoko_transaction_deleted', handleRemoteDelete);
  }, []);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const allTrx = await db.transactions.reverse().sortBy('created_at');
      setTransactions(allTrx);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTransaction = async (trxId: string) => {
    try {
      // Hapus transaksi secara realtime (Lokal, LAN, Cloud Supabase) & otomatis kembalikan stok
      await syncService.deleteTransaction(trxId);
      setTransactions(prev => prev.filter(t => t.id !== trxId));
      setDeleteConfirmId(null);
      setDeleteStatus({ success: true, message: 'Transaksi berhasil dihapus & stok barang otomatis dikembalikan.' });
      onTransactionDeleted?.(trxId);
      setTimeout(() => setDeleteStatus(null), 3000);
    } catch (err: any) {
      setDeleteStatus({ success: false, message: 'Gagal menghapus: ' + err.message });
    }
  };

  const handlePrintDailyReport = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrx = transactions.filter(t => new Date(t.created_at) >= today);
    
    const totalSales = todayTrx.reduce((s, t) => s + t.grand_total, 0);
    const totalItems = todayTrx.reduce((s, t) => s + t.items.reduce((a, it) => a + it.qty, 0), 0);
    const cashSales = todayTrx.filter(t => t.payment_method === 'CASH').reduce((s, t) => s + t.grand_total, 0);
    const qrisSales = todayTrx.filter(t => t.payment_method === 'QRIS').reduce((s, t) => s + t.grand_total, 0);
    const debitSales = todayTrx.filter(t => t.payment_method === 'DEBIT').reduce((s, t) => s + t.grand_total, 0);
    const transferSales = todayTrx.filter(t => t.payment_method === 'TRANSFER').reduce((s, t) => s + t.grand_total, 0);
    const totalDiscount = todayTrx.reduce((s, t) => s + t.discount_amount, 0);
    const totalTax = todayTrx.reduce((s, t) => s + t.tax_amount, 0);

    const savedStore = localStorage.getItem('ketoko_store_profile');
    const store = savedStore ? JSON.parse(savedStore) : {};
    const storeName = store.name || 'CV. TUMBUH MAKMUR AIR CONINDO';

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Laporan Penjualan Hari Ini - ${today.toLocaleDateString('id-ID')}</title>
  <style>
    @page { size: 210mm 148.5mm; margin: 6mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 10.5px; color: #000; background: #fff; }
    .report { width: 100%; padding: 2px 0; }
    h1 { font-size: 15px; font-weight: 900; text-align: center; margin-bottom: 2px; }
    h2 { font-size: 11px; font-weight: 700; text-align: center; margin-bottom: 6px; color: #333; }
    .sep { border-top: 1.5px dashed #000; margin: 5px 0; }
    .summary-tbl { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .summary-tbl td { padding: 2.5px 4px; font-size: 10.5px; }
    .summary-tbl .label { font-weight: 700; width: 55%; }
    .summary-tbl .val { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }
    .item-tbl { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .item-tbl th { text-align: left; font-size: 9.5px; padding: 3px 2px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; font-weight: 900; background: #f5f5f5; }
    .item-tbl td { padding: 2px; font-size: 9.5px; border-bottom: 1px dotted #ddd; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: 'Courier New', monospace; }
    .grand { font-size: 13px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0 !important; }
    .footer { margin-top: 8px; font-size: 8.5px; text-align: center; color: #666; }
    @media print { body { background: transparent; } }
  </style>
</head>
<body>
  <div class="report">
    <h1>${storeName.toUpperCase()}</h1>
    <h2>LAPORAN PENJUALAN HARIAN — ${today.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h2>
    <div class="sep"></div>
    
    <table class="summary-tbl">
      <tr><td class="label">Total Transaksi:</td><td class="val">${todayTrx.length} Nota</td></tr>
      <tr><td class="label">Total Produk Terjual:</td><td class="val">${totalItems} Pcs</td></tr>
    </table>
    <div class="sep"></div>

    <table class="summary-tbl">
      <tr><td class="label">💵 Penjualan CASH:</td><td class="val font-mono">${formatRupiah(cashSales)}</td></tr>
      <tr><td class="label">📱 Penjualan QRIS:</td><td class="val font-mono">${formatRupiah(qrisSales)}</td></tr>
      <tr><td class="label">💳 Penjualan DEBIT:</td><td class="val font-mono">${formatRupiah(debitSales)}</td></tr>
      <tr><td class="label">🏦 Penjualan TRANSFER:</td><td class="val font-mono">${formatRupiah(transferSales)}</td></tr>
    </table>
    <div class="sep"></div>

    <table class="summary-tbl">
      <tr><td class="label">Subtotal Penjualan:</td><td class="val font-mono">${formatRupiah(todayTrx.reduce((s, t) => s + t.subtotal, 0))}</td></tr>
      ${totalDiscount > 0 ? `<tr><td class="label" style="color:#b91c1c;">Potongan Diskon:</td><td class="val font-mono" style="color:#b91c1c;">-${formatRupiah(totalDiscount)}</td></tr>` : ''}
      ${totalTax > 0 ? `<tr><td class="label">PPN / Pajak:</td><td class="val font-mono">${formatRupiah(totalTax)}</td></tr>` : ''}
      <tr class="grand"><td class="label">TOTAL PENJUALAN HARI INI:</td><td class="val font-mono">${formatRupiah(totalSales)}</td></tr>
    </table>

    ${todayTrx.length > 0 ? `
    <div class="sep"></div>
    <table class="item-tbl">
      <thead>
        <tr>
          <th class="text-center" style="width:5%">NO</th>
          <th style="width:30%">NO. STRUK</th>
          <th style="width:20%">WAKTU</th>
          <th style="width:12%">METODE</th>
          <th class="text-right" style="width:15%">ITEM</th>
          <th class="text-right" style="width:18%">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${todayTrx.map((t, i) => `
        <tr>
          <td class="text-center font-mono">${i + 1}.</td>
          <td class="font-mono" style="font-weight:700">${t.receipt_number}</td>
          <td>${new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${t.payment_method}</td>
          <td class="text-right font-mono">${t.items.reduce((a, it) => a + it.qty, 0)} pcs</td>
          <td class="text-right font-mono" style="font-weight:700">${formatRupiah(t.grand_total)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ` : ''}

    <div class="footer">
      Dicetak pada ${new Date().toLocaleString('id-ID')} • Laporan ini dihasilkan otomatis oleh Ketoko POS
    </div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body>
</html>`;
    
    const printWindow = window.open('', '_blank', 'width=850,height=600');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const filtered = transactions.filter((trx) => {
    const matchQuery =
      trx.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
      (trx.cashier_name && trx.cashier_name.toLowerCase().includes(search.toLowerCase())) ||
      (trx.member_id && trx.member_id.toLowerCase().includes(search.toLowerCase()));

    const matchMethod =
      selectedMethod === 'ALL' || trx.payment_method === selectedMethod;

    return matchQuery && matchMethod;
  });

  const totalVolume = filtered.reduce((acc, t) => acc + t.grand_total, 0);
  const totalItemsSold = filtered.reduce(
    (acc, t) => acc + t.items.reduce((sum, it) => sum + it.qty, 0),
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* 1. Modal Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c] shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base leading-tight">
                Laporan Transaksi Harian Kasir
              </h3>
              <p className="text-xs text-[#fcefe3] font-medium">
                Rekap transaksi offline-first tersimpan di database lokal browser (IndexedDB)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Top Summary KPI Strip - Warm Latte Strip */}
        <div className="grid grid-cols-3 divide-x divide-[#ddc3aa] bg-[#f5ebe0] text-[#3d2617] p-3.5 sm:p-4 border-b border-[#e5d0be]">
          <div className="px-2 sm:px-4">
            <span className="text-[11px] text-[#8a6b53] font-medium flex items-center">
              <Receipt className="w-3.5 h-3.5 mr-1 text-[#96633b]" /> Total Nota
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-[#3d2617] mt-0.5">
              {filtered.length} <span className="text-xs text-[#8a6b53] font-normal">Transaksi</span>
            </div>
          </div>

          <div className="px-2 sm:px-4">
            <span className="text-[11px] text-[#8a6b53] font-medium flex items-center">
              <DollarSign className="w-3.5 h-3.5 mr-1 text-[#166534]" /> Total Penjualan
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-[#166534] mt-0.5">
              {formatRupiah(totalVolume)}
            </div>
          </div>

          <div className="px-2 sm:px-4">
            <span className="text-[11px] text-[#8a6b53] font-medium flex items-center">
              <ShoppingBag className="w-3.5 h-3.5 mr-1 text-[#96633b]" /> Total Produk
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-[#3d2617] mt-0.5">
              {totalItemsSold} <span className="text-xs text-[#8a6b53] font-normal">Pcs</span>
            </div>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="p-3 sm:p-4 border-b border-[#e5d0be] bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8a6b53] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. struk, kasir, ID member..."
              className="w-full pl-9 pr-4 py-2 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:border-[#96633b] focus:ring-1 focus:ring-[#96633b] shadow-xs"
            />
          </div>

          {/* Payment Method Filter Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {['ALL', 'CASH', 'QRIS', 'DEBIT', 'TRANSFER'].map((method) => (
              <button
                key={method}
                onClick={() => setSelectedMethod(method)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                  selectedMethod === method
                    ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                    : 'bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
                }`}
              >
                {method === 'ALL' ? 'Semua Metode' : method}
              </button>
            ))}

            <button
              onClick={loadTransactions}
              title="Refresh data"
              className="p-1.5 rounded-xl bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] border border-[#ddc3aa] transition-colors shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4. Transactions List Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2 bg-[#fcf9f5]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#8a6b53]">
              <Receipt className="w-10 h-10 mb-2 opacity-30 text-[#8a6b53]" />
              <p className="text-xs font-bold text-[#5c3c26]">Tidak ada transaksi yang cocok</p>
              <p className="text-[11px] text-[#8a6b53] mt-0.5">Belum ada struk penjualan sesuai filter yang dipilih.</p>
            </div>
          ) : (
            filtered.map((trx) => (
              <div
                key={trx.id}
                className="p-3 rounded-2xl bg-white border border-[#e5d0be] hover:border-[#b8957c] hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
              >
                {/* Left Transaction Info */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-black text-sm text-[#3d2617]">
                      {trx.receipt_number}
                    </span>

                    {/* Payment Method Badge */}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f5ebe0] text-[#5c3c26] border border-[#ddc3aa] flex items-center">
                      {trx.payment_method === 'CASH' && <Banknote className="w-3 h-3 mr-1 text-[#96633b]" />}
                      {trx.payment_method === 'QRIS' && <QrCode className="w-3 h-3 mr-1 text-sky-600" />}
                      {trx.payment_method === 'DEBIT' && <CreditCard className="w-3 h-3 mr-1 text-indigo-600" />}
                      {trx.payment_method}
                    </span>

                    {/* Sync Status Badge */}
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                        trx.synced
                          ? 'bg-[#edf5ee] text-[#166534] border border-[#cce2cf]'
                          : 'bg-[#faebd7] text-[#96633b] border border-[#eed7c4]'
                      }`}
                    >
                      {trx.synced ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-[#166534]" />
                          <span>Synced</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-2.5 h-2.5 text-[#96633b]" />
                          <span>Lokal Offline</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#8a6b53] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1 text-[#8a6b53]" />
                      {new Date(trx.created_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}, {new Date(trx.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span>•</span>
                    <span>Kasir: <b className="text-[#5c3c26]">{trx.cashier_name || 'Siti Kasir'}</b></span>
                    <span>•</span>
                    <span>{trx.items.reduce((acc, it) => acc + it.qty, 0)} pcs ({trx.items.length} SKU)</span>
                    {trx.member_id && (
                      <>
                        <span>•</span>
                        <span className="text-[#96633b] font-semibold">Member: {trx.member_id}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Amount & Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f2e5d8]">
                  <div className="text-left sm:text-right">
                    <div className="text-sm sm:text-base font-black font-mono text-[#96633b]">
                      {formatRupiah(trx.grand_total)}
                    </div>
                    {trx.discount_amount > 0 && (
                      <div className="text-[10px] text-[#166534] font-semibold">
                        Diskon: -{formatRupiah(trx.discount_amount)}
                      </div>
                    )}
                  </div>

                  {/* Actions: View Items, Print Receipt & Delete (Admin) */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setViewingItemsTrx(viewingItemsTrx?.id === trx.id ? null : trx)}
                      title="Lihat Daftar Barang"
                      className="px-2.5 py-1.5 rounded-xl bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] text-xs font-semibold flex items-center space-x-1 transition-colors border border-[#ddc3aa]"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#8a6b53]" />
                      <span className="hidden sm:inline">Rincian</span>
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        onSelectReceipt(trx);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#96633b] hover:bg-[#83532e] text-white text-xs font-bold flex items-center space-x-1 transition-all shadow-xs"
                      title="Cetak Ulang Struk Kasir"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-200" />
                      <span>Cetak</span>
                    </button>

                    {canDelete && (
                      deleteConfirmId === trx.id ? (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleDeleteTransaction(trx.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center space-x-1 transition-all shadow-xs animate-fadeIn"
                            title="Konfirmasi Hapus Permanen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Ya, Hapus!</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1.5 rounded-xl bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] text-xs font-semibold border border-[#ddc3aa] transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(trx.id)}
                          className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                          title="Hapus Transaksi (Admin Only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Expandable Items Details Row */}
                {viewingItemsTrx?.id === trx.id && (
                  <div className="w-full mt-2 pt-2 border-t border-[#f2e5d8] bg-[#fcf9f5] rounded-xl p-2.5 animate-fadeIn space-y-1.5">
                    <div className="text-[11px] font-bold text-[#96633b] uppercase tracking-wider">
                      Daftar Barang Belanjaan:
                    </div>
                    <div className="divide-y divide-[#eed7c4] text-xs">
                      {trx.items.map((it, idx) => (
                        <div key={idx} className="py-1 flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-[#3d2617]">{it.product_name}</span>
                            <span className="text-[#8a6b53] ml-1.5 font-mono text-[11px]">
                              ({it.qty} x {formatRupiah(it.price_applied)})
                            </span>
                            {it.is_wholesale && (
                              <span className="ml-1 text-[9px] bg-[#faebd7] text-[#96633b] px-1 rounded font-bold">
                                Grosir
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-[#3d2617]">
                            {formatRupiah(it.subtotal_item)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Delete Status Notification */}
        {deleteStatus && (
          <div className={`mx-3 mt-2 p-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn ${
            deleteStatus.success
              ? 'bg-[#edf5ee] border border-[#cce2cf] text-[#166534]'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}>
            {deleteStatus.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{deleteStatus.message}</span>
          </div>
        )}

        {/* 5. Footer */}
        <div className="p-3.5 border-t border-[#e5d0be] bg-white flex items-center justify-between text-xs text-[#8a6b53]">
          <div className="flex items-center space-x-2">
            <span>Menampilkan {filtered.length} dari {transactions.length} transaksi</span>
            {canDelete && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold">
                🔐 Admin: Bisa Hapus
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrintDailyReport}
              className="px-3 py-2 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl font-bold shadow-xs transition-colors flex items-center space-x-1.5"
              title="Cetak Laporan Penjualan Hari Ini"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>Cetak Laporan Hari Ini</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl font-bold shadow-xs transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
