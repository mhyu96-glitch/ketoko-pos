import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Printer, 
  Banknote, 
  QrCode, 
  CreditCard,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Wallet,
  DollarSign
} from 'lucide-react';
import type { Transaction, StoreProfile } from '../types';
import { formatRupiah, printShiftReport } from '../services/escposService';
import { exportReportToPDF } from '../services/pdfReportService';
import { db } from '../db';
import { resolveStoreFromCurrentHost } from '../config/storeConfig';

const getLocalDateKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getYesterdayDateKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
};

const formatDateLabelId = (yyyyMmDd: string): string => {
  const parts = yyyyMmDd.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return yyyyMmDd;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Helper: format angka ke string titik ribuan (contoh: 10950 -> "10.950")
const formatRupiahInput = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('id-ID');
};

const parseRupiahInput = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) || 0;
};

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  cashierName?: string;
  branchId?: string;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({
  isOpen,
  onClose,
  transactions: initialTransactions,
  cashierName = 'Siti Kasir',
  branchId = 'BR-01'
}) => {
  const [localTrx, setLocalTrx] = useState<Transaction[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [shiftDateMode, setShiftDateMode] = useState<'date' | 'all'>('date');
  const [targetDate, setTargetDate] = useState<string>(() => getLocalDateKey());

  const todayKey = getLocalDateKey();
  const yesterdayKey = getYesterdayDateKey();

  const resolvedBranchLabel = useMemo(() => {
    const resolvedStore = resolveStoreFromCurrentHost();
    try {
      const saved = localStorage.getItem('ketoko_store_profile');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StoreProfile>;
        if (parsed.branch_name && !parsed.branch_name.toLowerCase().includes('samarinda')) {
          return `${branchId} (${parsed.branch_name})`;
        }
      }
    } catch {}
    return `${branchId} (${resolvedStore.branch})`;
  }, [branchId, isOpen]);

  // Shift Cash Balancing States
  const [openingCashInput, setOpeningCashInput] = useState<string>(() => {
    const saved = localStorage.getItem('ketoko_shift_opening_cash');
    const val = saved ? Number(saved) : 100000;
    return val ? val.toLocaleString('id-ID') : '100.000';
  });
  const [actualCashInput, setActualCashInput] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      setShiftDateMode('date');
      setTargetDate(getLocalDateKey());
      db.transactions.toArray().then(setLocalTrx);
    }
  }, [isOpen]);

  // Real-time synchronization listeners for shift calculations
  React.useEffect(() => {
    if (!isOpen) return;

    const handleTrxCreated = (e: any) => {
      const trx = e.detail?.transaction;
      if (trx && trx.id) {
        setLocalTrx((prev) => {
          if (prev.some((t) => t.id === trx.id)) return prev;
          return [trx, ...prev];
        });
      }
    };

    const handleTrxDeleted = (e: any) => {
      const id = e.detail?.id;
      if (id) {
        setLocalTrx((prev) => prev.filter((t) => t.id !== id));
      }
    };

    const handleTrxRefreshed = () => {
      db.transactions.toArray().then(setLocalTrx).catch(() => {});
    };

    window.addEventListener('ketoko_transaction_created', handleTrxCreated);
    window.addEventListener('ketoko_transaction_deleted', handleTrxDeleted);
    window.addEventListener('ketoko_transactions_refreshed', handleTrxRefreshed);

    return () => {
      window.removeEventListener('ketoko_transaction_created', handleTrxCreated);
      window.removeEventListener('ketoko_transaction_deleted', handleTrxDeleted);
      window.removeEventListener('ketoko_transactions_refreshed', handleTrxRefreshed);
    };
  }, [isOpen]);

  const rawTransactions = initialTransactions !== undefined ? initialTransactions : localTrx;

  // Filter berdasarkan toko aktif dan tanggal shift yang dituju
  const transactions = useMemo(() => {
    const activeStoreId = typeof window !== 'undefined'
      ? (localStorage.getItem('ketoko_active_store_id') || resolveStoreFromCurrentHost().id)
      : 'store-01';

    return rawTransactions.filter((t: any) => {
      if (activeStoreId === 'store-01') {
        if (t.store_id && t.store_id !== 'store-01') return false;
      } else {
        if (t.store_id && t.store_id !== activeStoreId) return false;
      }
      if (shiftDateMode === 'date' && targetDate) {
        const trxDateKey = getLocalDateKey(new Date(t.created_at));
        if (trxDateKey !== targetDate) return false;
      }
      return true;
    });
  }, [rawTransactions, shiftDateMode, targetDate]);

  if (!isOpen) return null;

  const shiftPeriodLabel = shiftDateMode === 'all'
    ? 'Semua Tanggal'
    : targetDate === todayKey
      ? `Hari Ini (${formatDateLabelId(targetDate)})`
      : targetDate === yesterdayKey
        ? `Kemarin (${formatDateLabelId(targetDate)})`
        : formatDateLabelId(targetDate);

  const totalTrx = transactions.length;
  const grossSales = transactions.reduce((sum, t) => sum + t.subtotal, 0);
  const totalDiscounts = transactions.reduce((sum, t) => sum + t.discount_amount, 0);
  const netSales = transactions.reduce((sum, t) => sum + t.grand_total, 0);

  const cashTotal = transactions
    .filter((t) => t.payment_method === 'CASH')
    .reduce((sum, t) => sum + t.grand_total, 0);

  const saldoTotal = transactions
    .filter((t) => t.payment_method === 'SALDO')
    .reduce((sum, t) => sum + t.grand_total, 0);

  const qrisTotal = transactions
    .filter((t) => t.payment_method === 'QRIS')
    .reduce((sum, t) => sum + t.grand_total, 0);

  const debitTotal = transactions
    .filter((t) => t.payment_method === 'DEBIT')
    .reduce((sum, t) => sum + t.grand_total, 0);

  const transferTotal = transactions
    .filter((t) => t.payment_method === 'TRANSFER')
    .reduce((sum, t) => sum + t.grand_total, 0);

  // Opening Float parsed from formatted input
  const openingCash = parseRupiahInput(openingCashInput);

  // Expected Cash in Drawer = Opening Float + Cash Sales
  const expectedCash = openingCash + cashTotal;
  const actualCash = actualCashInput ? parseRupiahInput(actualCashInput) : expectedCash;
  const variance = actualCash - expectedCash;

  const handleExportShiftPDF = () => {
    const savedStore = localStorage.getItem('ketoko_store_profile');
    const storeProfile: StoreProfile | undefined = savedStore ? JSON.parse(savedStore) : undefined;

    exportReportToPDF({
      title: 'LAPORAN REKAPITULASI TUTUP SHIFT KASIR (Z-REPORT)',
      subtitle: `Petugas Kasir: ${cashierName} • Cabang: ${resolvedBranchLabel}`,
      periodText: `Tanggal Shift: ${shiftPeriodLabel}`,
      storeProfile,
      kpis: [
        { label: 'Total Transaksi', value: `${totalTrx} Struk` },
        { label: 'Modal Awal Kasir', value: formatRupiah(openingCash) },
        { label: 'Penjualan Tunai', value: formatRupiah(cashTotal) },
        { label: 'Penjualan Bersih', value: formatRupiah(netSales), highlight: true }
      ],
      table: {
        headers: ['No', 'Item Pembukuan Shift', 'Keterangan', 'Jumlah (Rp)'],
        rows: [
          [1, 'Modal Awal Kasir (Cash Float)', 'Uang kembalian awal shift', formatRupiah(openingCash)],
          [2, 'Penerimaan Tunai (Cash)', `${transactions.filter(t => t.payment_method === 'CASH').length} Transaksi`, formatRupiah(cashTotal)],
          [3, 'Penerimaan Potong Saldo Member', `${transactions.filter(t => t.payment_method === 'SALDO').length} Transaksi`, formatRupiah(saldoTotal)],
          [4, 'Penerimaan Transfer Bank (TF)', `${transactions.filter(t => t.payment_method === 'TRANSFER').length} Transaksi`, formatRupiah(transferTotal)],
          [5, 'Penerimaan QRIS Digital', `${transactions.filter(t => t.payment_method === 'QRIS').length} Transaksi`, formatRupiah(qrisTotal)],
          [6, 'Penerimaan Kartu Debit', `${transactions.filter(t => t.payment_method === 'DEBIT').length} Transaksi`, formatRupiah(debitTotal)],
          [7, 'Ekspektasi Uang Fisik di Laci', 'Modal Awal + Penjualan Tunai', formatRupiah(expectedCash)],
          [8, 'Uang Fisik Kasir (Hasil Hitung)', 'Diserahkan saat tutup kasir', formatRupiah(actualCash)],
          [9, 'Status Selisih Kasir', variance === 0 ? 'SEIMBANG / PAS' : variance > 0 ? 'LEBIH KAS' : 'KURANG KAS', (variance >= 0 ? '+' : '') + formatRupiah(variance)]
        ],
        alignments: ['center', 'left', 'left', 'right'],
        footers: ['TOTAL SETTLEMENT', 'SEMUA SALURAN PEMBAYARAN', `${totalTrx} Trx`, formatRupiah(netSales)]
      },
      notes: 'Laporan Tutup Shift Kasir divalidasi oleh petugas kasir yang bertugas dan diserahkan bersama setoran uang fisik cash drawer.'
    });
  };

  const handlePrintShiftReport = async () => {
    setIsPrinting(true);
    setPrintStatus('Menghubungkan ke printer POS thermal...');

    const res = await printShiftReport({
      cashierName,
      branchId,
      startTime: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      endTime: new Date().toISOString(),
      totalTransactions: totalTrx,
      grossSales,
      totalDiscounts,
      netSales,
      paymentSummary: {
        CASH: cashTotal,
        QRIS: qrisTotal,
        DEBIT: debitTotal,
        TRANSFER: transferTotal
      },
      openingCash,
      actualCash,
      variance
    });

    setPrintStatus(res.message);
    setIsPrinting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c] shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight text-white">Laporan & Tutup Shift Kasir</h3>
              <p className="text-xs text-[#fcefe3] font-medium">Rekapitulasi kas laci, setoran & cetak Z-Report</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-[#83532e] hover:bg-[#6f4021] text-white border border-[#a6744c] text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Tutup</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-4 text-xs bg-[#fcf9f5] flex-1 max-w-3xl mx-auto w-full">
          
          {/* Filter Tanggal Shift */}
          <div className="p-3.5 bg-[#f5ece3] rounded-2xl border border-[#dfcebe] flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#7c4e2f]" />
              <span className="text-[11px] font-extrabold text-[#543c2e] uppercase tracking-wider">Tanggal Shift:</span>
              <span className="text-xs font-black text-[#7c4e2f] bg-white px-2.5 py-1 rounded-lg border border-[#dfcebe]">
                {shiftPeriodLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShiftDateMode('date');
                  setTargetDate(todayKey);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  shiftDateMode === 'date' && targetDate === todayKey
                    ? 'bg-[#2d5a40] text-white shadow-xs'
                    : 'bg-white text-[#543c2e] border border-[#dfcebe] hover:bg-[#faebd7]'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setShiftDateMode('date');
                  setTargetDate(yesterdayKey);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  shiftDateMode === 'date' && targetDate === yesterdayKey
                    ? 'bg-[#2d5a40] text-white shadow-xs'
                    : 'bg-white text-[#543c2e] border border-[#dfcebe] hover:bg-[#faebd7]'
                }`}
              >
                Kemarin
              </button>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setShiftDateMode('date');
                    setTargetDate(e.target.value);
                  }
                }}
                className="px-2.5 py-1 rounded-xl border border-[#dfcebe] bg-white text-xs font-mono font-bold text-[#3d2617] focus:outline-none focus:border-[#2d5a40]"
                title="Pilih tanggal shift yang dituju"
              />
              <button
                type="button"
                onClick={() => setShiftDateMode('all')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  shiftDateMode === 'all'
                    ? 'bg-[#96633b] text-white shadow-xs'
                    : 'bg-white text-[#543c2e] border border-[#dfcebe] hover:bg-[#faebd7]'
                }`}
              >
                Semua
              </button>
            </div>
          </div>

          {/* Shift Metadata */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
            <div>
              <span className="text-[#8a6b53] text-[11px] font-bold uppercase tracking-wider block">Kasir Bertugas:</span>
              <span className="font-extrabold text-sm text-[#3d2617]">{cashierName}</span>
            </div>
            <div>
              <span className="text-[#8a6b53] text-[11px] font-bold uppercase tracking-wider block">Cabang Toko:</span>
              <span className="font-extrabold text-sm text-[#3d2617]">{resolvedBranchLabel}</span>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="p-4 bg-white rounded-3xl border border-[#e5d0be] space-y-2.5 shadow-xs">
            <div className="flex justify-between items-center text-[#5c3c26]">
              <span>Total Nota Terbit ({shiftPeriodLabel}):</span>
              <span className="font-mono font-bold text-sm text-[#3d2617]">{totalTrx} Transaksi</span>
            </div>
            <div className="flex justify-between items-center text-[#5c3c26]">
              <span>Penjualan Kotor (Gross):</span>
              <span className="font-mono font-bold text-[#3d2617]">{formatRupiah(grossSales)}</span>
            </div>
            {totalDiscounts > 0 && (
              <div className="flex justify-between items-center text-[#166534]">
                <span>Total Potongan Diskon:</span>
                <span className="font-mono font-bold">-{formatRupiah(totalDiscounts)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-[#f2e5d8] text-[#3d2617]">
              <span className="font-black text-sm">Penjualan Bersih (Net):</span>
              <span className="font-mono font-black text-xl text-[#166534]">{formatRupiah(netSales)}</span>
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div>
            <span className="text-[#5c3c26] font-extrabold text-xs mb-2 block">Rincian Penerimaan Pembayaran:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <div className="p-3 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
                <div className="flex items-center space-x-1.5 text-[#166534] font-bold mb-1">
                  <Banknote className="w-4 h-4" />
                  <span>Tunai</span>
                </div>
                <div className="font-mono font-black text-xs text-[#3d2617]">{formatRupiah(cashTotal)}</div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
                <div className="flex items-center space-x-1.5 text-amber-800 font-bold mb-1">
                  <Wallet className="w-4 h-4" />
                  <span>Potong Saldo</span>
                </div>
                <div className="font-mono font-black text-xs text-[#3d2617]">{formatRupiah(saldoTotal)}</div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
                <div className="flex items-center space-x-1.5 text-[#7c4e2f] font-bold mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span>Transfer (TF)</span>
                </div>
                <div className="font-mono font-black text-xs text-[#3d2617]">{formatRupiah(transferTotal)}</div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
                <div className="flex items-center space-x-1.5 text-sky-700 font-bold mb-1">
                  <QrCode className="w-4 h-4" />
                  <span>QRIS</span>
                </div>
                <div className="font-mono font-black text-xs text-[#3d2617]">{formatRupiah(qrisTotal)}</div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
                <div className="flex items-center space-x-1.5 text-indigo-700 font-bold mb-1">
                  <CreditCard className="w-4 h-4" />
                  <span>Debit</span>
                </div>
                <div className="font-mono font-black text-xs text-[#3d2617]">{formatRupiah(debitTotal)}</div>
              </div>
            </div>
          </div>

          {/* Cash Drawer Float & Variance Section */}
          <div className="p-4 bg-white rounded-3xl border border-[#ddc3aa] space-y-3 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-[#f2e5d8] pb-2">
              <Calculator className="w-4 h-4 text-[#96633b]" />
              <h4 className="font-extrabold text-xs text-[#3d2617]">Rekapitulasi Uang Kas & Tutup Laci</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Modal Awal */}
              <div>
                <label className="block text-[11px] font-bold text-[#5c3c26] mb-1">
                  Modal Awal Kasir (Rp):
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={openingCashInput}
                  onChange={(e) => {
                    const formatted = formatRupiahInput(e.target.value);
                    setOpeningCashInput(formatted);
                    const val = parseRupiahInput(formatted);
                    localStorage.setItem('ketoko_shift_opening_cash', String(val));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfaf7] border border-[#ddc3aa] text-xs font-mono font-bold text-[#3d2617] focus:outline-none focus:ring-2 focus:ring-[#96633b]"
                />
              </div>

              {/* Uang Fisik Kasir */}
              <div>
                <label className="block text-[11px] font-bold text-[#5c3c26] mb-1">
                  Uang Fisik Dihitung (Rp):
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(formatRupiahInput(e.target.value))}
                  placeholder={expectedCash.toLocaleString('id-ID')}
                  className="w-full px-3 py-2 rounded-xl bg-[#fdfaf7] border border-[#ddc3aa] text-xs font-mono font-bold text-[#3d2617] focus:outline-none focus:ring-2 focus:ring-[#96633b]"
                />
              </div>
            </div>

            {/* Expected vs Actual Summary */}
            <div className="p-3 bg-[#fbf7f2] rounded-2xl border border-[#eed7c4] space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-[#5c3c26]">
                <span>Ekspektasi Uang di Laci (Modal + Tunai):</span>
                <span className="font-mono font-bold">{formatRupiah(expectedCash)}</span>
              </div>
              <div className="flex justify-between items-center text-[#5c3c26]">
                <span>Uang Fisik Kasir:</span>
                <span className="font-mono font-bold">{formatRupiah(actualCash)}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-[#eed7c4]">
                <span className="font-extrabold text-[#3d2617]">Selisih Kasir:</span>
                <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-md flex items-center space-x-1 ${
                  variance === 0 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : variance > 0 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-rose-100 text-rose-800'
                }`}>
                  {variance === 0 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                      <span>SEIMBANG / PAS</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 mr-1 inline" />
                      <span>{(variance > 0 ? '+' : '') + formatRupiah(variance)}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {printStatus && (
            <div className="p-3 bg-[#faebd7] rounded-xl border border-[#eed7c4] text-center font-mono text-xs font-bold text-[#96633b]">
              {printStatus}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportShiftPDF}
              className="w-full py-3.5 bg-white hover:bg-[#faebd7] text-[#7c4e2f] border border-[#ddc3aa] font-black text-xs rounded-2xl shadow-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
            >
              <FileText className="w-4 h-4 text-[#7c4e2f]" />
              <span>Export PDF (A4 Kop Surat)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintShiftReport}
              disabled={isPrinting}
              className="w-full py-3.5 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 text-white font-black text-xs rounded-2xl shadow-lg shadow-[#96633b]/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
            >
              <Printer className="w-4 h-4 text-amber-200" />
              <span>{isPrinting ? 'Mencetak...' : 'Cetak Struk Shift (ESC/POS)'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

