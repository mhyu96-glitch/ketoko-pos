import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wallet, 
  ArrowUpRight, 
  CheckCircle2, 
  Printer, 
  Store, 
  CreditCard, 
  Coins, 
  QrCode, 
  Building2,
  AlertCircle
} from 'lucide-react';
import type { Customer, MemberDepositMutation } from '../types';
import { formatRupiah } from '../services/escposService';
import { syncService } from '../services/syncService';
import { getStoreDisplayName, MAX_EMPLOYEE_ALLOWANCE } from '../utils/customerAccess';
import { getStoredStores, type RegisteredStoreInfo } from '../services/storeRegistry';
import { CustomSelect } from './CustomSelect';

interface MemberTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Customer | null;
  activeStoreId?: string;
  cashierName?: string;
  onTopUpSuccess?: (updatedMember: Customer, mutation: MemberDepositMutation) => void;
}

export const MemberTopUpModal: React.FC<MemberTopUpModalProps> = ({
  isOpen,
  onClose,
  member,
  activeStoreId = 'store-01',
  cashierName = 'Kasir Toko',
  onTopUpSuccess
}) => {
  const [amountInput, setAmountInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS' | 'DEBIT'>('CASH');
  const [selectedStoreId, setSelectedStoreId] = useState<string>(activeStoreId);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    customer: Customer;
    mutation: MemberDepositMutation;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [storesList] = useState<RegisteredStoreInfo[]>(() => getStoredStores());

  useEffect(() => {
    if (isOpen) {
      setAmountInput('');
      setPaymentMethod('CASH');
      setSelectedStoreId(activeStoreId);
      setNotes('');
      setIsSubmitting(false);
      setSuccessResult(null);
      setErrorMsg(null);
    }
  }, [isOpen, member, activeStoreId]);

  if (!isOpen || !member) return null;

  const isEmployee = member.type === 'KARYAWAN';
  const maxEmployeeCap = isEmployee ? Math.min(MAX_EMPLOYEE_ALLOWANCE, Number(member.monthly_allowance) || MAX_EMPLOYEE_ALLOWANCE) : Infinity;
  const currentBalance = Number(member.deposit_balance) || 0;
  const topUpAmount = Math.max(0, parseInt(amountInput.replace(/[^0-9]/g, ''), 10) || 0);
  const projectedBalance = currentBalance + topUpAmount;
  const exceedsEmployeeCap = isEmployee && projectedBalance > maxEmployeeCap;

  const quickPresets = [20000, 50000, 100000, 200000, 500000, 1000000];

  const handleSelectPreset = (val: number) => {
    setAmountInput(String(val));
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topUpAmount <= 0) {
      setErrorMsg('Masukkan nominal top up yang valid (minimal Rp 1.000)');
      return;
    }
    if (exceedsEmployeeCap) {
      setErrorMsg(`Saldo kuota karyawan maksimal ${formatRupiah(maxEmployeeCap)} per bulan dan otomatis di-reset setiap Tanggal 1.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const storeName = getStoreDisplayName(selectedStoreId);
      const res = await syncService.syncMemberTopup({
        customer_id: member.id,
        amount: topUpAmount,
        payment_method: paymentMethod,
        store_id: selectedStoreId,
        store_name: storeName,
        cashier_name: cashierName,
        notes: notes.trim() || `Top Up Saldo di ${storeName}`
      });

      if (res.success && res.customer && res.mutation) {
        setSuccessResult({
          customer: res.customer,
          mutation: res.mutation
        });
        onTopUpSuccess?.(res.customer, res.mutation);
      } else {
        setErrorMsg(res.error || 'Gagal memproses top up saldo member');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat top up');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!successResult) return;
    const { customer, mutation } = successResult;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    let storeTitle = 'KOPERASI KARYAWAN';
    try {
      const savedStore = localStorage.getItem('ketoko_store_profile');
      if (savedStore) {
        const parsed = JSON.parse(savedStore);
        if (parsed?.name) storeTitle = parsed.name;
      }
    } catch {}

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Struk Top Up Saldo - ${mutation.id}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 15px; color: #000; width: 280px; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .title { font-size: 14px; font-weight: bold; }
          .subtitle { font-size: 10px; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${storeTitle}</div>
          <div class="subtitle">${mutation.store_name || ''}</div>
          <div class="subtitle">BUKTI SETORAN / TOP UP SALDO</div>
        </div>
        <div class="row"><span>No. Ref:</span><span>${mutation.id}</span></div>
        <div class="row"><span>Waktu:</span><span>${new Date(mutation.created_at).toLocaleString('id-ID')}</span></div>
        <div class="row"><span>Kasir:</span><span>${mutation.cashier_name || cashierName}</span></div>
        <div class="divider"></div>
        <div class="row"><span>No. Anggota:</span><span class="bold">${customer.code || customer.id}</span></div>
        <div class="row"><span>Nama:</span><span class="bold">${customer.name}</span></div>
        <div class="row"><span>Metode:</span><span>${mutation.payment_method}</span></div>
        <div class="divider"></div>
        <div class="row"><span>Saldo Awal:</span><span>${formatRupiah(mutation.balance_before)}</span></div>
        <div class="row bold"><span>Setoran (Top Up):</span><span>+${formatRupiah(mutation.amount)}</span></div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 13px;"><span>SALDO AKHIR:</span><span>${formatRupiah(mutation.balance_after)}</span></div>
        <div class="divider"></div>
        <div class="footer">
          <div>Simpan bukti ini sebagai konfirmasi setoran yang sah.</div>
          <div>Dapat digunakan di Koperasi A & B. Terima kasih!</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
        
        {/* Header Full-Screen */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex items-center justify-between shrink-0 border-b border-[#5e3519]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#543017] text-amber-200 border border-[#9b663b]/50">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight flex items-center gap-2 text-white">
                <span>Top Up Saldo Anggota</span>
                <span className="text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold">
                  Multi-Cabang
                </span>
              </h3>
              <p className="text-xs text-[#fcefe3]">Isi ulang saldo simpanan belanja anggota koperasi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-[#fcefe3] hover:text-white rounded-xl bg-[#543017] hover:bg-[#422511] border border-[#9b663b]/50 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Tutup</span>
          </button>
        </div>

        {/* Full-Screen Body with Centered Workspace Card */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 text-xs">
          <div className="max-w-xl mx-auto bg-white rounded-3xl border border-[#e5d0be] shadow-xs p-5 sm:p-6 space-y-4">
          {successResult ? (
            /* Tampilan Sukses */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-200">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-lg font-black text-slate-800">Top Up Saldo Berhasil!</h4>
                <p className="text-slate-500 text-xs mt-0.5">Saldo telah disinkronkan ke Toko A dan Toko B</p>
              </div>

              <div className="bg-[#fcf8f4] border border-[#ebdccf] rounded-2xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Nama Anggota:</span>
                  <span className="font-bold text-slate-800">{successResult.customer.name}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>No. Anggota / Kode:</span>
                  <span className="font-mono font-bold text-slate-800">{successResult.customer.code || successResult.customer.id}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cabang Top Up:</span>
                  <span className="font-medium text-slate-800">{successResult.mutation.store_name}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Metode Pembayaran:</span>
                  <span className="font-bold text-slate-800">{successResult.mutation.payment_method}</span>
                </div>
                <div className="border-t border-dashed border-[#dfcebe] pt-2 flex justify-between text-emerald-700 font-extrabold text-sm">
                  <span>Nominal Ditambahkan:</span>
                  <span>+{formatRupiah(successResult.mutation.amount)}</span>
                </div>
                <div className="flex justify-between font-black text-base text-slate-900 pt-1">
                  <span>Saldo Baru:</span>
                  <span className="text-emerald-700">{formatRupiah(successResult.mutation.balance_after)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-300 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Cetak Struk Setoran</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 bg-[#7c4e2f] hover:bg-[#5c3c26] text-white font-extrabold rounded-xl transition-all shadow-md active:scale-95"
                >
                  Selesai
                </button>
              </div>
            </div>
          ) : (
            /* Form Pengisian Top Up */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Member Summary Card */}
              <div className="bg-[#fcf8f4] border border-[#ebdccf] rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-[#8a6b53] uppercase tracking-wider">Anggota Koperasi</div>
                  <div className="font-black text-slate-800 text-sm leading-snug">{member.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {member.code || member.id} • {member.phone && member.phone !== '-' ? member.phone : 'Tanpa HP'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Saldo Saat Ini</div>
                  <div className="font-mono font-black text-base text-emerald-800">
                    {formatRupiah(currentBalance)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {getStoreDisplayName(member.store_id, member.store_name)}
                  </div>
                </div>
              </div>

              {/* Input Nominal Top Up */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nominal Top Up (Rp):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    placeholder="0"
                    value={amountInput ? Number(amountInput.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '');
                      setAmountInput(digits);
                      setErrorMsg(null);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-[#eed7c4] focus:border-emerald-600 rounded-xl font-mono text-base font-extrabold text-slate-800 outline-none transition-all"
                  />
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {quickPresets.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelectPreset(val)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold border transition-all active:scale-95 ${
                        topUpAmount === val
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white hover:bg-[#faebd7] text-[#5c3c26] border-[#dfcebe]'
                      }`}
                    >
                      +{val >= 1000000 ? `${val / 1000000} Juta` : `${val / 1000}rb`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metode Pembayaran Top Up */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Metode Pembayaran Uang Setoran:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'CASH', label: 'Tunai', icon: Coins },
                    { id: 'TRANSFER', label: 'Transfer', icon: Building2 },
                    { id: 'QRIS', label: 'QRIS', icon: QrCode },
                    { id: 'DEBIT', label: 'EDC / Debit', icon: CreditCard }
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold transition-all ${
                          isSelected
                            ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-amber-200' : 'text-slate-500'}`} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cabang Penerima Setoran */}
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Store className="w-3 h-3 text-[#7c4e2f]" />
                    <span>Cabang Tempat Top Up (Toko Penerima Uang):</span>
                  </label>
                  <CustomSelect
                    value={selectedStoreId}
                    onChange={(val) => setSelectedStoreId(val)}
                    options={storesList.map((st) => ({
                      value: st.id,
                      label: `${st.name} (${st.id})`,
                    }))}
                  />
                </div>
              </div>

              {/* Preview Kalkulasi Saldo */}
              <div className={`rounded-xl p-3 flex items-center justify-between border ${exceedsEmployeeCap ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="space-y-0.5">
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${exceedsEmployeeCap ? 'text-rose-800' : 'text-emerald-800'}`}>Estimasi Saldo Baru</div>
                  <div className="text-slate-500 text-[11px]">
                    {formatRupiah(currentBalance)} + <span className="font-bold text-emerald-700">+{formatRupiah(topUpAmount)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-black text-lg ${exceedsEmployeeCap ? 'text-rose-700' : 'text-emerald-800'}`}>
                    {formatRupiah(projectedBalance)}
                  </div>
                  <div className={`text-[9px] font-bold ${exceedsEmployeeCap ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isEmployee ? `Maks Kuota Karyawan: ${formatRupiah(maxEmployeeCap)} (Reset Tgl 1)` : 'Siap Belanja Multi-Cabang'}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-300 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || topUpAmount <= 0}
                  className="w-2/3 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{isSubmitting ? 'Memproses...' : `Konfirmasi Top Up (${formatRupiah(topUpAmount)})`}</span>
                </button>
              </div>

            </form>
          )}
          </div>
        </div>

      </div>
    </div>
  );
};
