import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Printer, 
  Banknote, 
  QrCode, 
  CreditCard,
  Calculator,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { Transaction, StoreProfile } from '../types';
import { formatRupiah, printShiftReport } from '../services/escposService';
import { exportReportToPDF } from '../services/pdfReportService';
import { db } from '../db';

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

  // Shift Cash Balancing States
  const [openingCash, setOpeningCash] = useState<number>(() => {
    const saved = localStorage.getItem('ketoko_shift_opening_cash');
    return saved ? Number(saved) : 100000;
  });
  const [actualCashInput, setActualCashInput] = useState<string>('');

  React.useEffect(() => {
    if (isOpen && !initialTransactions) {
      db.transactions.toArray().then(setLocalTrx);
    }
  }, [isOpen, initialTransactions]);

  if (!isOpen) return null;

  const transactions = initialTransactions || localTrx;
  const totalTrx = transactions.length;
  const grossSales = transactions.reduce((sum, t) => sum + t.subtotal, 0);
  const totalDiscounts = transactions.reduce((sum, t) => sum + t.discount_amount, 0);
  const netSales = transactions.reduce((sum, t) => sum + t.grand_total, 0);

  const cashTotal = transactions
    .filter((t) => t.payment_method === 'CASH')
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

  // Expected Cash in Drawer = Opening Float + Cash Sales
  const expectedCash = openingCash + cashTotal;
  const actualCash = actualCashInput ? Number(actualCashInput.replace(/\D/g, '')) : expectedCash;
  const variance = actualCash - expectedCash;

  const handleExportShiftPDF = () => {
    const savedStore = localStorage.getItem('ketoko_store_profile');
    const storeProfile: StoreProfile | undefined = savedStore ? JSON.parse(savedStore) : undefined;

    exportReportToPDF({
      title: 'LAPORAN REKAPITULASI TUTUP SHIFT KASIR (Z-REPORT)',
      subtitle: `Petugas Kasir: ${cashierName} • ID Cabang: ${branchId}`,
      periodText: `Shift Aktif: ${new Date(Date.now() - 8 * 3600 * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} s/d ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (${new Date().toLocaleDateString('id-ID')})`,
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
          [3, 'Penerimaan QRIS Digital', `${transactions.filter(t => t.payment_method === 'QRIS').length} Transaksi`, formatRupiah(qrisTotal)],
          [4, 'Penerimaan Kartu Debit', `${transactions.filter(t => t.payment_method === 'DEBIT').length} Transaksi`, formatRupiah(debitTotal)],
          [5, 'Penerimaan Transfer Bank', `${transactions.filter(t => t.payment_method === 'TRANSFER').length} Transaksi`, formatRupiah(transferTotal)],
          [6, 'Ekspektasi Uang Fisik di Laci', 'Modal Awal + Penjualan Tunai', formatRupiah(expectedCash)],
          [7, 'Uang Fisik Kasir (Hasil Hitung)', 'Diserahkan saat tutup kasir', formatRupiah(actualCash)],
          [8, 'Status Selisih Kasir', variance === 0 ? 'SEIMBANG / PAS' : variance > 0 ? 'LEBIH KAS' : 'KURANG KAS', (variance >= 0 ? '+' : '') + formatRupiah(variance)]
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
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
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs bg-[#fcf9f5]">
          
          {/* Shift Metadata */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
            <div>
              <span className="text-[#8a6b53] text-[11px] font-bold uppercase tracking-wider block">Kasir Bertugas:</span>
              <span className="font-extrabold text-sm text-[#3d2617]">{cashierName}</span>
            </div>
            <div>
              <span className="text-[#8a6b53] text-[11px] font-bold uppercase tracking-wider block">Cabang Toko:</span>
              <span className="font-extrabold text-sm text-[#3d2617]">{branchId} (Samarinda)</span>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="p-4 bg-white rounded-3xl border border-[#e5d0be] space-y-2.5 shadow-xs">
            <div className="flex justify-between items-center text-[#5c3c26]">
              <span>Total Nota Terbit:</span>
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
              <span className="font-mono font-black text-xl text-[#96633b]">{formatRupiah(netSales)}</span>
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div>
            <span className="text-[#5c3c26] font-extrabold text-xs mb-2 block">Rincian Penerimaan Pembayaran:</span>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
                <div className="flex items-center space-x-1.5 text-[#96633b] font-bold mb-1">
                  <Banknote className="w-4 h-4" />
                  <span>Tunai</span>
                </div>
                <div className="font-mono font-black text-xs text-[#3d2617]">{formatRupiah(cashTotal)}</div>
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
                  type="number"
                  value={openingCash}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setOpeningCash(val);
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
                  type="number"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  placeholder={String(expectedCash)}
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

