import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  CreditCard, 
  Building2, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Printer, 
  DollarSign, 
  TrendingDown
} from 'lucide-react';
import { db } from '../db';
import type { DebtRecord, ReceivableRecord } from '../types';
import { formatRupiah, ESCPOSBuilder, printToWebSerial } from '../services/escposService';

interface DebtReceivableModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'debt' | 'receivable' | 'report';
  branchId?: string;
  cashierName?: string;
  onUpdated?: () => void;
}



export const DebtReceivableModal: React.FC<DebtReceivableModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'debt',
  branchId = 'BR-01',
  cashierName = 'Kasir Utama',
  onUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'debt' | 'receivable' | 'report'>(initialTab);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);

  // Repayment form states
  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null);
  const [payingReceivable, setPayingReceivable] = useState<ReceivableRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadData();
    }
  }, [isOpen, initialTab]);

  const loadData = async () => {
    const allDebts = await db.debts.toArray();
    const allReceivables = await db.receivables.toArray();
    setDebts(allDebts);
    setReceivables(allReceivables);
    onUpdated?.();
  };

  // Helper for due date status calculations
  const getDueDateStatus = (dueDateStr: string, status: string) => {
    if (status === 'PAID') return { label: 'Lunas', color: 'bg-[#edf5ee] text-[#166534] border-[#cce2cf]' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        label: `Lewat ${Math.abs(diffDays)} Hari! (Jatuh Tempo: ${dueDateStr})`, 
        color: 'bg-[#fbeeed] text-red-800 border-[#f4cfcf] font-bold animate-pulse' 
      };
    } else if (diffDays <= 3) {
      return { 
        label: `Mendekati (${diffDays === 0 ? 'Hari Ini' : `${diffDays} Hari Lagi`})`, 
        color: 'bg-[#faebd7] text-[#7c4e2f] border-[#ecdac5] font-bold' 
      };
    } else {
      return { 
        label: `Tempo: ${dueDateStr} (${diffDays} hari lagi)`, 
        color: 'bg-[#f5ece3] text-[#543c2e] border-[#dfcebe]' 
      };
    }
  };

  // Summary Metrics
  const summary = useMemo(() => {
    const totalDebt = debts.reduce((acc, d) => acc + (d.status !== 'PAID' ? d.remaining_amount : 0), 0);
    const overdueDebts = debts.filter(d => d.status !== 'PAID' && new Date(d.due_date) < new Date());
    const nearDebts = debts.filter(d => {
      if (d.status === 'PAID') return false;
      const diff = Math.round((new Date(d.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 3;
    });

    const totalReceivable = receivables.reduce((acc, r) => acc + (r.status !== 'PAID' ? r.remaining_amount : 0), 0);
    const overdueReceivables = receivables.filter(r => r.status !== 'PAID' && new Date(r.due_date) < new Date());
    const nearReceivables = receivables.filter(r => {
      if (r.status === 'PAID') return false;
      const diff = Math.round((new Date(r.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 3;
    });

    return {
      totalDebt,
      overdueDebtCount: overdueDebts.length,
      nearDebtCount: nearDebts.length,
      totalReceivable,
      overdueReceivableCount: overdueReceivables.length,
      nearReceivableCount: nearReceivables.length
    };
  }, [debts, receivables]);

  // Handle Pay Debt (Toko bayar ke supplier)
  const handlePayDebt = async () => {
    if (!payingDebt || paymentAmount <= 0) return;
    const newPaid = payingDebt.paid_amount + paymentAmount;
    const newRemaining = Math.max(0, payingDebt.total_amount - newPaid);
    const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL';

    await db.debts.update(payingDebt.id, {
      paid_amount: newPaid,
      remaining_amount: newRemaining,
      status: newStatus
    });

    setPayingDebt(null);
    setPaymentAmount(0);
    loadData();
  };

  // Handle Collect Receivable (Pelanggan bayar bon ke toko)
  const handleCollectReceivable = async () => {
    if (!payingReceivable || paymentAmount <= 0) return;
    const newPaid = payingReceivable.paid_amount + paymentAmount;
    const newRemaining = Math.max(0, payingReceivable.total_amount - newPaid);
    const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL';

    await db.receivables.update(payingReceivable.id, {
      paid_amount: newPaid,
      remaining_amount: newRemaining,
      status: newStatus
    });

    setPayingReceivable(null);
    setPaymentAmount(0);
    loadData();
  };

  // Print Thermal Report for Debt & Receivables
  const handlePrintThermalReport = async () => {
    setIsPrinting(true);
    setPrintStatus('Mencetak Laporan Rekap Hutang Piutang...');

    const builder = new ESCPOSBuilder();
    builder
      .alignCenter()
      .bold(true)
      .addLine('=== REKAP HUTANG PIUTANG ===')
      .bold(false)
      .addLine(`Cabang: ${branchId} | Petugas: ${cashierName}`)
      .addLine(`Waktu: ${new Date().toLocaleString('id-ID')}`)
      .addLine('--------------------------------')
      .alignLeft()
      .bold(true)
      .addLine('A. HUTANG KE SUPPLIER:')
      .bold(false);

    debts.filter(d => d.status !== 'PAID').forEach((d) => {
      builder.addLine(`- ${d.supplier_name.slice(0, 16).padEnd(16)}: ${formatRupiah(d.remaining_amount)}`);
      builder.addLine(`  Due: ${d.due_date} | Fkt: ${d.invoice_number}`);
    });
    builder
      .bold(true)
      .addLine(`TOTAL SISA HUTANG: ${formatRupiah(summary.totalDebt)}`)
      .bold(false)
      .addLine('--------------------------------')
      .bold(true)
      .addLine('B. PIUTANG DARI PELANGGAN:')
      .bold(false);

    receivables.filter(r => r.status !== 'PAID').forEach((r) => {
      builder.addLine(`- ${r.customer_name.slice(0, 16).padEnd(16)}: ${formatRupiah(r.remaining_amount)}`);
      builder.addLine(`  Due: ${r.due_date} | Nota: ${r.receipt_number}`);
    });
    builder
      .bold(true)
      .addLine(`TOTAL SISA PIUTANG: ${formatRupiah(summary.totalReceivable)}`)
      .bold(false)
      .addLine('================================')
      .bold(true)
      .addLine(`SELISIH KAS BERSIH: ${formatRupiah(summary.totalReceivable - summary.totalDebt)}`)
      .bold(false)
      .alignCenter()
      .addLine('Dicetak dari KetokoPOS Official')
      .cut();

    const bytes = builder.getUint8Array();
    const res = await printToWebSerial(bytes);
    setPrintStatus(res.message);
    setIsPrinting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-lg leading-tight tracking-tight text-white">Manajemen & Laporan Hutang Piutang</h3>
                {(summary.overdueDebtCount > 0 || summary.overdueReceivableCount > 0) && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-700 text-white animate-pulse">
                    ⚠️ {summary.overdueDebtCount + summary.overdueReceivableCount} Jatuh Tempo Lewat!
                  </span>
                )}
              </div>
              <p className="text-xs text-[#fcefe3] font-medium mt-0.5">
                Monitoring faktur hutang supplier, buku piutang pelanggan, dan peringatan jatuh tempo
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrintThermalReport}
              disabled={isPrinting}
              className="px-3.5 py-2 bg-white text-[#96633b] hover:bg-[#faebd7] rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-xs transition-all border border-white/20 active:scale-95 whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-[#96633b]" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Strip - Coklat Susu Foam Bar */}
        <div className="px-4 py-3 border-b border-[#e4d5c7] bg-[#f5ece3] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('debt')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'debt'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-amber-200" />
              <span>Hutang ke Supplier ({debts.filter(d => d.status !== 'PAID').length})</span>
            </button>

            <button
              onClick={() => setActiveTab('receivable')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'receivable'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-200" />
              <span>Piutang Pelanggan ({receivables.filter(r => r.status !== 'PAID').length})</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'report'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-amber-200" />
              <span>Laporan Rekap Posisi Kas</span>
            </button>
          </div>
        </div>

        {/* Content Body - Coklat Susu Milky Cocoa Background */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-[#f6f0ea] min-h-0">
          
          {/* TAB 1: HUTANG KE SUPPLIER */}
          {activeTab === 'debt' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* KPI Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#856b59] uppercase tracking-wider">Total Sisa Hutang Toko</span>
                    <DollarSign className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-rose-800 mt-2 tracking-tight whitespace-nowrap">
                    {formatRupiah(summary.totalDebt)}
                  </div>
                  <span className="text-[11px] text-[#a08573] mt-1 block">Kewajiban bayar ke distributor</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#856b59] uppercase tracking-wider">Faktur Lewat Jatuh Tempo</span>
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-red-700 mt-2 tracking-tight">
                    {summary.overdueDebtCount} <span className="text-sm font-semibold text-[#856b59]">Faktur</span>
                  </div>
                  <span className="text-[11px] text-red-600 font-bold mt-1 block">Segera selesaikan pembayaran</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#856b59] uppercase tracking-wider">Mendekati Tempo (&le; 3 Hari)</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-700 mt-2 tracking-tight">
                    {summary.nearDebtCount} <span className="text-sm font-semibold text-[#856b59]">Faktur</span>
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium mt-1 block">Persiapkan dana kas toko</span>
                </div>
              </div>

              {/* Form Bayar Hutang */}
              {payingDebt && (
                <div className="p-4 bg-[#fcf5ed] border border-[#eed7c4] rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#3d2617]">
                      Pelunasan / Cicil Hutang: {payingDebt.supplier_name} (Faktur: {payingDebt.invoice_number})
                    </span>
                    <button onClick={() => setPayingDebt(null)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[#856b59] block mb-1">Total Tagihan:</span>
                      <span className="font-mono font-bold text-[#332219] whitespace-nowrap">{formatRupiah(payingDebt.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-[#856b59] block mb-1">Sisa Hutang Saat Ini:</span>
                      <span className="font-mono font-black text-rose-800 text-sm whitespace-nowrap">{formatRupiah(payingDebt.remaining_amount)}</span>
                    </div>
                    <div>
                      <span className="text-[#856b59] block mb-1">Nominal Pembayaran (Rp):</span>
                      <input
                        type="number"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(Math.min(payingDebt.remaining_amount, Number(e.target.value)))}
                        placeholder="Masukkan nominal bayar..."
                        className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setPaymentAmount(payingDebt.remaining_amount)}
                      className="px-3 py-1 bg-[#faebd7] text-[#7c4e2f] rounded-xl text-xs font-bold border border-[#eed7c4]"
                    >
                      Bayar Lunas Penuh
                    </button>
                    <button
                      onClick={handlePayDebt}
                      className="px-4 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan Pembayaran
                    </button>
                  </div>
                </div>
              )}

              {/* Table Hutang */}
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">No. Faktur</th>
                        <th className="py-3 px-4">Supplier & Distributor</th>
                        <th className="py-3 px-4 text-right">Total Tagihan</th>
                        <th className="py-3 px-4 text-right">Sisa Hutang</th>
                        <th className="py-3 px-4 text-center">Status Jatuh Tempo</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {debts.map((d) => {
                        const dueStatus = getDueDateStatus(d.due_date, d.status);
                        return (
                          <tr key={d.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-[#332219] whitespace-nowrap">{d.invoice_number}</td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#332219] text-sm">{d.supplier_name}</div>
                              <div className="text-[11px] text-[#856b59] font-mono">Kode: {d.supplier_code} • {d.notes}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-[#543c2e] whitespace-nowrap">
                              {formatRupiah(d.total_amount)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-rose-800 text-sm whitespace-nowrap">
                              {formatRupiah(d.remaining_amount)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] border whitespace-nowrap inline-flex items-center justify-center ${dueStatus.color}`}>
                                {dueStatus.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {d.status !== 'PAID' ? (
                                <button
                                  onClick={() => {
                                    setPayingDebt(d);
                                    setPaymentAmount(d.remaining_amount);
                                  }}
                                  className="px-3.5 py-1 bg-[#96633b] hover:bg-[#83532e] text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95"
                                >
                                  Bayar
                                </button>
                              ) : (
                                <span className="text-[#166534] font-bold flex items-center justify-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> <span>Lunas</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: PIUTANG PELANGGAN */}
          {activeTab === 'receivable' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* KPI Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#856b59] uppercase tracking-wider">Total Piutang Belum Tertagih</span>
                    <DollarSign className="w-4 h-4 text-[#7c4e2f]" />
                  </div>
                  <div className="text-2xl font-black font-mono text-[#7c4e2f] mt-2 tracking-tight whitespace-nowrap">
                    {formatRupiah(summary.totalReceivable)}
                  </div>
                  <span className="text-[11px] text-[#a08573] mt-1 block">Dana tertahan di pelanggan/bon</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#856b59] uppercase tracking-wider">Piutang Lewat Jatuh Tempo</span>
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-red-700 mt-2 tracking-tight">
                    {summary.overdueReceivableCount} <span className="text-sm font-semibold text-[#856b59]">Nota</span>
                  </div>
                  <span className="text-[11px] text-red-600 font-bold mt-1 block">Hubungi & tagih pelanggan</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#856b59] uppercase tracking-wider">Mendekati Tempo (&le; 3 Hari)</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-700 mt-2 tracking-tight">
                    {summary.nearReceivableCount} <span className="text-sm font-semibold text-[#856b59]">Nota</span>
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium mt-1 block">Kirim pengingat WhatsApp</span>
                </div>
              </div>

              {/* Form Terima Pembayaran Piutang */}
              {payingReceivable && (
                <div className="p-4 bg-[#fcf5ed] border border-[#eed7c4] rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#3d2617]">
                      Terima Setoran Piutang: {payingReceivable.customer_name} (Nota: {payingReceivable.receipt_number})
                    </span>
                    <button onClick={() => setPayingReceivable(null)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[#856b59] block mb-1">Total Piutang Awal:</span>
                      <span className="font-mono font-bold text-[#332219] whitespace-nowrap">{formatRupiah(payingReceivable.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-[#856b59] block mb-1">Sisa Tagihan Belum Dibayar:</span>
                      <span className="font-mono font-black text-[#7c4e2f] text-sm whitespace-nowrap">{formatRupiah(payingReceivable.remaining_amount)}</span>
                    </div>
                    <div>
                      <span className="text-[#856b59] block mb-1">Nominal Diterima Kasir (Rp):</span>
                      <input
                        type="number"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(Math.min(payingReceivable.remaining_amount, Number(e.target.value)))}
                        placeholder="Nominal diterima..."
                        className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setPaymentAmount(payingReceivable.remaining_amount)}
                      className="px-3 py-1 bg-[#faebd7] text-[#7c4e2f] rounded-xl text-xs font-bold border border-[#eed7c4]"
                    >
                      Pelunasan Total
                    </button>
                    <button
                      onClick={handleCollectReceivable}
                      className="px-4 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan Penerimaan
                    </button>
                  </div>
                </div>
              )}

              {/* Table Piutang */}
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">No. Struk</th>
                        <th className="py-3 px-4">Nama Pelanggan</th>
                        <th className="py-3 px-4 text-right">Total Bon</th>
                        <th className="py-3 px-4 text-right">Sisa Piutang</th>
                        <th className="py-3 px-4 text-center">Status Jatuh Tempo</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {receivables.map((r) => {
                        const dueStatus = getDueDateStatus(r.due_date, r.status);
                        return (
                          <tr key={r.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-[#332219] whitespace-nowrap">{r.receipt_number}</td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#332219] text-sm">{r.customer_name}</div>
                              <div className="text-[11px] text-[#856b59] font-mono">Kode: {r.customer_code} • {r.notes}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-[#543c2e] whitespace-nowrap">
                              {formatRupiah(r.total_amount)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-[#7c4e2f] text-sm whitespace-nowrap">
                              {formatRupiah(r.remaining_amount)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] border whitespace-nowrap inline-flex items-center justify-center ${dueStatus.color}`}>
                                {dueStatus.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {r.status !== 'PAID' ? (
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    onClick={() => {
                                      setPayingReceivable(r);
                                      setPaymentAmount(r.remaining_amount);
                                    }}
                                    className="px-3.5 py-1 bg-[#96633b] hover:bg-[#83532e] text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95"
                                  >
                                    Terima Bayar
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[#166534] font-bold flex items-center justify-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> <span>Lunas</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: LAPORAN REKAP POSISI */}
          {activeTab === 'report' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-6 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#f0e4d7] pb-3">
                  <h4 className="font-extrabold text-sm text-[#332219]">Rekapitulasi Posisi Hutang Piutang Retail</h4>
                  <span className="text-xs font-mono text-[#856b59]">{new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[#fbeeed] border border-[#f4cfcf]">
                    <span className="text-xs font-bold text-rose-900 block mb-1">Total Kewajiban Hutang ke Supplier:</span>
                    <span className="text-2xl font-black font-mono text-rose-900 whitespace-nowrap">{formatRupiah(summary.totalDebt)}</span>
                    <p className="text-[11px] text-rose-700 mt-1">Harus dilunasi sesuai batas TOP distributor</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#fcf5ed] border border-[#eed7c4]">
                    <span className="text-xs font-bold text-[#3d2617] block mb-1">Total Hak Piutang dari Pelanggan:</span>
                    <span className="text-2xl font-black font-mono text-[#7c4e2f] whitespace-nowrap">{formatRupiah(summary.totalReceivable)}</span>
                    <p className="text-[11px] text-[#8c5e3c] mt-1">Estimasi kas masuk dari tagihan bon</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#96633b] text-white flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-xs font-semibold text-[#fcefe3] block">Selisih Bersih (Net Receivables - Payables):</span>
                    <span className="text-lg font-black font-mono text-amber-200 whitespace-nowrap">
                      {formatRupiah(summary.totalReceivable - summary.totalDebt)}
                    </span>
                  </div>
                  <button
                    onClick={handlePrintThermalReport}
                    className="px-4 py-2 bg-white text-[#96633b] hover:bg-[#faebd7] rounded-xl text-xs font-bold flex items-center space-x-1.5 whitespace-nowrap shadow-xs"
                  >
                    <Printer className="w-4 h-4 text-[#96633b]" />
                    <span>Cetak ke Struk</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e5d0be] bg-white flex items-center justify-between text-xs text-[#8a6b53] shrink-0">
          <span>{printStatus || 'Data Hutang Piutang otomatis terintegrasi dengan laporan keuangan KetokoPOS'}</span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl font-bold transition-all shadow-xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
