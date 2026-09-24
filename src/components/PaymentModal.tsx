import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Banknote, 
  QrCode, 
  CreditCard, 
  CheckCircle, 
  Keyboard, 
  Touchpad,
  Delete,
  Calendar,
  Clock,
  AlertCircle
} from 'lucide-react';
import { formatRupiah } from '../services/escposService';
import { db } from '../db';
import type { Customer } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  customerName?: string;
  onProcessPayment: (paymentData: {
    payment_method: 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER' | 'TEMPO';
    cash_given: number;
    change_returned: number;
    customer_name?: string;
    due_date?: string;
    notes?: string;
  }) => Promise<void>;
  isTouchscreenMode?: boolean;
  onToggleTouchscreen?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  customerName: initialCustomerName = '',
  onProcessPayment,
  isTouchscreenMode = false,
  onToggleTouchscreen
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER' | 'TEMPO'>('CASH');
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // States for TEMPO / Piutang Pelanggan
  const [customerName, setCustomerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dpGiven, setDpGiven] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [customerList, setCustomerList] = useState<Customer[]>([]);

  // Quick preset nominal uang pas & pecahan umum
  const quickCashPresets = [
    { label: 'Uang Pas', value: grandTotal },
    { label: 'Rp 20.000', value: 20000 },
    { label: 'Rp 50.000', value: 50000 },
    { label: 'Rp 100.000', value: 100000 },
    { label: 'Rp 200.000', value: 200000 }
  ].filter((p) => p.value >= grandTotal || p.label === 'Uang Pas');

  const changeReturned = Math.max(0, cashGiven - grandTotal);
  const remainingTempo = Math.max(0, grandTotal - dpGiven);

  const isFormValid = () => {
    if (paymentMethod === 'CASH') return cashGiven >= grandTotal;
    if (paymentMethod === 'TEMPO') return customerName.trim().length > 0 && dueDate.length > 0;
    return true;
  };

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('CASH');
      setCashGiven(grandTotal);
      setDpGiven(0);
      setNotes('');
      setCustomerName(initialCustomerName || '');

      // Default jatuh tempo 14 hari dari sekarang
      const d = new Date();
      d.setDate(d.getDate() + 14);
      setDueDate(d.toISOString().split('T')[0]);

      setIsProcessing(false);

      // Load customers for suggestion
      db.customers.toArray().then((list) => {
        setCustomerList(list || []);
      }).catch(() => {});
      
      // Auto-focus input on keyboard mode
      if (!isTouchscreenMode) {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 100);
      }
    }
  }, [isOpen, grandTotal, initialCustomerName, isTouchscreenMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid() || isProcessing) return;

    setIsProcessing(true);
    try {
      if (paymentMethod === 'TEMPO') {
        await onProcessPayment({
          payment_method: 'TEMPO',
          cash_given: dpGiven,
          change_returned: 0,
          customer_name: customerName.trim(),
          due_date: dueDate,
          notes: notes.trim()
        });
      } else {
        await onProcessPayment({
          payment_method: paymentMethod,
          cash_given: paymentMethod === 'CASH' ? cashGiven : grandTotal,
          change_returned: paymentMethod === 'CASH' ? changeReturned : 0
        });
      }
      onClose();
    } catch (err: any) {
      alert('Gagal memproses pembayaran: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNumpadPress = (val: string) => {
    if (val === 'C') {
      setCashGiven(0);
    } else if (val === 'DEL') {
      const str = cashGiven.toString();
      setCashGiven(str.length > 1 ? parseInt(str.slice(0, -1), 10) : 0);
    } else if (val === '000') {
      setCashGiven(prev => prev * 1000);
    } else {
      const currentStr = cashGiven === 0 ? '' : cashGiven.toString();
      setCashGiven(parseInt(currentStr + val, 10) || 0);
    }
  };

  const setPresetDueDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className={`bg-[#fcf9f5] border border-[#e5d0be] w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all ${
        isTouchscreenMode ? 'max-w-xl max-h-[94vh]' : 'max-w-md max-h-[90vh]'
      }`}>
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                Pembayaran Kasir
              </h3>

              {/* Direct Clickable Touchscreen Switcher in Modal */}
              {onToggleTouchscreen ? (
                <button
                  type="button"
                  onClick={onToggleTouchscreen}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center space-x-1 cursor-pointer transition-all active:scale-95 ${
                    isTouchscreenMode 
                      ? 'bg-[#83532e] text-white border border-[#a6744c] shadow-xs' 
                      : 'bg-[#faebd7] text-[#96633b] border border-[#eed7c4] hover:bg-white'
                  }`}
                  title="Klik untuk berpindah antara Keyboard dan Touchscreen"
                >
                  {isTouchscreenMode ? (
                    <>
                      <Touchpad className="w-3 h-3 text-amber-200" />
                      <span>Touchscreen: ON</span>
                    </>
                  ) : (
                    <>
                      <Keyboard className="w-3 h-3 text-[#96633b]" />
                      <span>Mode Keyboard</span>
                    </>
                  )}
                  <span className="text-[9px] opacity-85 font-normal underline ml-0.5">Ganti</span>
                </button>
              ) : (
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-black uppercase ${
                  isTouchscreenMode 
                    ? 'bg-[#83532e] text-white border border-[#a6744c]' 
                    : 'bg-[#faebd7] text-[#96633b] border border-[#eed7c4]'
                }`}>
                  {isTouchscreenMode ? 'Touchscreen ON' : 'Mode Keyboard'}
                </span>
              )}
            </div>

            <p className="text-xs text-[#fcefe3] font-medium mt-0.5">
              {paymentMethod === 'TEMPO'
                ? 'Catat hutang/bon pelanggan dengan tanggal jatuh tempo'
                : isTouchscreenMode 
                  ? 'Mode Sentuh Monitor / POS Touchscreen Friendly' 
                  : 'Ketik nominal uang lalu tekan Enter untuk simpan & cetak'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#fcf9f5]">
          
          {/* Grand Total Display */}
          <div className="bg-white border border-[#e5d0be] rounded-2xl p-3 sm:p-4 text-center shadow-xs">
            <span className="text-xs text-[#8a6b53] font-bold uppercase tracking-wider">Total Tagihan Belanja</span>
            <div className="text-2xl sm:text-3xl font-black text-[#96633b] font-mono mt-0.5">
              {formatRupiah(grandTotal)}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-bold text-[#5c3c26] mb-1.5 block">Metode Pembayaran</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('CASH');
                  setCashGiven(grandTotal);
                  if (!isTouchscreenMode) inputRef.current?.focus();
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 ${
                  paymentMethod === 'CASH'
                    ? 'bg-[#96633b] text-white border-[#96633b] shadow-md shadow-[#96633b]/20'
                    : 'bg-white text-[#5c3c26] border-[#ddc3aa] hover:bg-[#f5ebe0]'
                }`}
              >
                <Banknote className="w-5 h-5 mb-1 text-amber-200" />
                <span>TUNAI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('QRIS');
                  setCashGiven(grandTotal);
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 ${
                  paymentMethod === 'QRIS'
                    ? 'bg-[#96633b] text-white border-[#96633b] shadow-md shadow-[#96633b]/20'
                    : 'bg-white text-[#5c3c26] border-[#ddc3aa] hover:bg-[#f5ebe0]'
                }`}
              >
                <QrCode className="w-5 h-5 mb-1 text-sky-300" />
                <span>QRIS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('DEBIT');
                  setCashGiven(grandTotal);
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 ${
                  paymentMethod === 'DEBIT'
                    ? 'bg-[#96633b] text-white border-[#96633b] shadow-md shadow-[#96633b]/20'
                    : 'bg-white text-[#5c3c26] border-[#ddc3aa] hover:bg-[#f5ebe0]'
                }`}
              >
                <CreditCard className="w-5 h-5 mb-1 text-indigo-300" />
                <span>DEBIT/TF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('TEMPO');
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 ${
                  paymentMethod === 'TEMPO'
                    ? 'bg-[#b45309] text-white border-[#b45309] shadow-md shadow-[#b45309]/20'
                    : 'bg-white text-[#b45309] border-[#fcd34d] hover:bg-amber-50'
                }`}
              >
                <Clock className="w-5 h-5 mb-1 text-amber-300" />
                <span>TEMPO / BON</span>
              </button>
            </div>
          </div>

          {/* Cash Input Section */}
          {paymentMethod === 'CASH' && (
            <div className="space-y-3">
              {/* Quick Nominal Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {quickCashPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCashGiven(preset.value)}
                    className="py-1.5 px-2 bg-white hover:bg-[#faebd7] border border-[#ddc3aa] text-[#5c3c26] rounded-xl text-xs font-mono font-bold transition-all active:scale-95 shadow-2xs"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Touchscreen Numpad View */}
              {isTouchscreenMode ? (
                <div className="space-y-3">
                  {/* Digital Cash Readout Display */}
                  <div className="bg-white border-2 border-[#ddc3aa] rounded-2xl p-3 shadow-inner text-right">
                    <span className="text-[10px] text-[#8a6b53] font-bold uppercase tracking-wider block">Uang Tunai Diterima:</span>
                    <div className="font-mono font-black text-3xl text-[#3d2617] tracking-tight">
                      {formatRupiah(cashGiven)}
                    </div>
                  </div>

                  {/* High Sensitivity Touch Keypad */}
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '000'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleNumpadPress(val)}
                        className={`h-12 sm:h-14 rounded-2xl font-black font-mono text-lg sm:text-xl border shadow-sm transition-all active:scale-95 flex items-center justify-center ${
                          val === 'C' 
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            : 'bg-white text-[#3d2617] border-[#ddc3aa] hover:bg-[#faebd7]'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>

                  {/* Large Backspace Bar */}
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('DEL')}
                    className="w-full py-2.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 font-bold text-xs flex items-center justify-center space-x-1.5 hover:bg-amber-100 transition-colors"
                  >
                    <Delete className="w-4 h-4 text-amber-700" />
                    <span>Hapus Digit Terakhir (Backspace)</span>
                  </button>
                </div>
              ) : (
                /* Keyboard Mode: Single Direct Focusable Input */
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[#5c3c26] mb-1 block">Uang Diterima dari Pembeli (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-[#96633b] font-bold text-lg font-mono">Rp</span>
                      <input
                        ref={inputRef}
                        type="number"
                        min="0"
                        step="1000"
                        value={cashGiven || ''}
                        onChange={(e) => setCashGiven(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full pl-12 pr-4 py-3 bg-white text-[#3d2617] font-mono font-black text-2xl rounded-2xl border-2 border-[#ddc3aa] focus:border-[#96633b] focus:ring-4 focus:ring-[#96633b]/20 shadow-xs selection:bg-[#faebd7] selection:text-[#96633b] transition-all"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-[#e5d0be] flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#5c3c26] font-bold block">Uang Kembalian:</span>
                      <span className="text-[11px] text-[#8a6b53]">Dihitung otomatis</span>
                    </div>
                    <span className={`font-mono font-black text-2xl tracking-tight ${changeReturned > 0 ? 'text-[#96633b]' : 'text-[#3d2617]'}`}>
                      {formatRupiah(changeReturned)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TEMPO / PIUTANG PELANGGAN SECTION */}
          {paymentMethod === 'TEMPO' && (
            <div className="space-y-3 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pencatatan Piutang / Bon Pelanggan</span>
              </div>

              {/* Nama Pelanggan */}
              <div>
                <label className="text-[11px] font-bold text-[#5c3c26] mb-1 block">
                  Nama Pelanggan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  list="customer-suggestions"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Pak Budi, Bu Ani (wajib)"
                  className="w-full px-3 py-2 bg-white text-[#3d2617] font-bold text-xs rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-200 shadow-2xs"
                  required
                />
                <datalist id="customer-suggestions">
                  {customerList.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.phone ? `${c.name} (${c.phone})` : c.name}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Tanggal Jatuh Tempo */}
              <div>
                <label className="text-[11px] font-bold text-[#5c3c26] mb-1 block">
                  Tanggal Jatuh Tempo <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <button
                    type="button"
                    onClick={() => setPresetDueDate(7)}
                    className="flex-1 py-1 px-2 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-bold text-amber-900 transition-colors"
                  >
                    +7 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDueDate(14)}
                    className="flex-1 py-1 px-2 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-bold text-amber-900 transition-colors"
                  >
                    +14 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDueDate(30)}
                    className="flex-1 py-1 px-2 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-bold text-amber-900 transition-colors"
                  >
                    +30 Hari
                  </button>
                </div>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-amber-700 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white text-[#3d2617] font-mono font-bold text-xs rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-200 shadow-2xs"
                    required
                  />
                </div>
              </div>

              {/* Uang Muka / DP */}
              <div>
                <label className="text-[11px] font-bold text-[#5c3c26] mb-1 block">
                  Uang Muka / DP (Opsional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-amber-800 font-bold text-xs font-mono">Rp</span>
                  <input
                    type="number"
                    min="0"
                    max={grandTotal}
                    step="1000"
                    value={dpGiven || ''}
                    onChange={(e) => setDpGiven(Math.min(grandTotal, Math.max(0, Number(e.target.value) || 0)))}
                    placeholder="0 (jika belum bayar sama sekali)"
                    className="w-full pl-9 pr-3 py-2 bg-white text-[#3d2617] font-mono font-bold text-xs rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-200 shadow-2xs"
                  />
                </div>
              </div>

              {/* Rincian Sisa Piutang */}
              <div className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs">
                <span className="font-bold text-[#5c3c26]">Sisa Piutang (Tagihan):</span>
                <span className="font-mono font-black text-amber-900 text-sm">
                  {formatRupiah(remainingTempo)}
                </span>
              </div>

              {/* Catatan / Keterangan Bon */}
              <div>
                <label className="text-[11px] font-bold text-[#5c3c26] mb-1 block">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Titip tetangga, bon warung..."
                  className="w-full px-3 py-1.5 bg-white text-[#3d2617] text-xs rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-200 shadow-2xs"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid() || isProcessing}
            className={`w-full py-3.5 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-[0.98] ${
              paymentMethod === 'TEMPO'
                ? 'bg-[#b45309] hover:bg-[#92400e] shadow-[#b45309]/20'
                : 'bg-[#96633b] hover:bg-[#83532e] shadow-[#96633b]/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isProcessing ? (
              <span>Memproses & Menyimpan Transaksi...</span>
            ) : paymentMethod === 'TEMPO' ? (
              <>
                <CheckCircle className="w-5 h-5 text-amber-200" />
                <span>SIMPAN BON TEMPO (SISA: {formatRupiah(remainingTempo)})</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 text-amber-200" />
                <span>SIMPAN TRANSAKSI & CETAK STRUK {!isTouchscreenMode && '(ENTER)'}</span>
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};
