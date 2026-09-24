import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Banknote, 
  QrCode, 
  CreditCard, 
  CheckCircle, 
  Keyboard, 
  Touchpad,
  Delete 
} from 'lucide-react';
import { formatRupiah } from '../services/escposService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  onProcessPayment: (paymentData: {
    payment_method: 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER';
    cash_given: number;
    change_returned: number;
  }) => Promise<void>;
  isTouchscreenMode?: boolean;
  onToggleTouchscreen?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  onProcessPayment,
  isTouchscreenMode = false,
  onToggleTouchscreen
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER'>('CASH');
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick preset nominal uang pas & pecahan umum
  const quickCashPresets = [
    { label: 'Uang Pas', value: grandTotal },
    { label: 'Rp 20.000', value: 20000 },
    { label: 'Rp 50.000', value: 50000 },
    { label: 'Rp 100.000', value: 100000 },
    { label: 'Rp 200.000', value: 200000 }
  ].filter((p) => p.value >= grandTotal || p.label === 'Uang Pas');

  const changeReturned = Math.max(0, cashGiven - grandTotal);
  const isCashSufficient = paymentMethod !== 'CASH' || cashGiven >= grandTotal;

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('CASH');
      setCashGiven(grandTotal);
      setIsProcessing(false);
      
      // Auto-focus input on keyboard mode
      if (!isTouchscreenMode) {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 100);
      }
    }
  }, [isOpen, grandTotal, isTouchscreenMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCashSufficient || isProcessing) return;

    setIsProcessing(true);
    try {
      await onProcessPayment({
        payment_method: paymentMethod,
        cash_given: paymentMethod === 'CASH' ? cashGiven : grandTotal,
        change_returned: paymentMethod === 'CASH' ? changeReturned : 0
      });
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
                  title="Klik untuk beralih antara Mode Sentuh Layar dan Mode Keyboard Komputer"
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 border ${
                    isTouchscreenMode 
                      ? 'bg-[#83532e] text-white border-[#a6744c]' 
                      : 'bg-[#faebd7] hover:bg-[#f5e0c6] text-[#96633b] border-[#eed7c4]'
                  }`}
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
              {isTouchscreenMode 
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
            <div className="grid grid-cols-3 gap-2">
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
                <span>KARTU DEBIT</span>
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
                    onClick={() => {
                      setCashGiven(preset.value);
                      if (!isTouchscreenMode) inputRef.current?.focus();
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all active:scale-95 ${
                      cashGiven === preset.value
                        ? 'bg-[#faebd7] text-[#96633b] border-[#eed7c4] shadow-xs'
                        : 'bg-white text-[#5c3c26] border-[#ddc3aa] hover:bg-[#f5ebe0]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Cash Input & Change Display */}
              {isTouchscreenMode ? (
                /* Mode Touchscreen ON */
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white p-2.5 rounded-2xl border border-[#e5d0be]">
                      <label className="text-[11px] font-bold text-[#8a6b53] block">Uang Diterima:</label>
                      <div className="text-lg font-bold font-mono text-[#3d2617]">
                        {formatRupiah(cashGiven)}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl border border-[#e5d0be]">
                      <label className="text-[11px] font-bold text-[#8a6b53] block">Uang Kembalian:</label>
                      <div className={`text-lg font-bold font-mono ${changeReturned > 0 ? 'text-[#96633b]' : 'text-[#3d2617]'}`}>
                        {formatRupiah(changeReturned)}
                      </div>
                    </div>
                  </div>

                  {/* On-Screen Touchscreen Numpad */}
                  <div className="grid grid-cols-4 gap-1.5 p-2 bg-[#f5ebe0] rounded-2xl border border-[#e5d0be]">
                    {['7', '8', '9', '+10rb', '4', '5', '6', '+20rb', '1', '2', '3', '+50rb', 'C', '0', '000', 'DEL'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          if (k === '+10rb') setCashGiven(prev => prev + 10000);
                          else if (k === '+20rb') setCashGiven(prev => prev + 20000);
                          else if (k === '+50rb') setCashGiven(prev => prev + 50000);
                          else handleNumpadPress(k);
                        }}
                        className={`h-11 sm:h-12 rounded-xl font-mono text-sm sm:text-base font-bold flex items-center justify-center shadow-xs transition-all active:scale-90 ${
                          k.startsWith('+')
                            ? 'bg-[#faebd7] text-[#96633b] border border-[#eed7c4]'
                            : k === 'C' || k === 'DEL'
                            ? 'bg-[#fbeeed] text-rose-700 border border-[#f4cfcf]'
                            : 'bg-white text-[#3d2617] border border-[#ddc3aa] hover:bg-[#fcf9f5]'
                        }`}
                      >
                        {k === 'DEL' ? <Delete className="w-4 h-4" /> : k}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                /* Mode Keyboard Desktop */
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[#5c3c26] mb-1.5 flex items-center justify-between">
                      <span className="flex items-center text-[#3d2617] font-extrabold">
                        <Keyboard className="w-3.5 h-3.5 mr-1.5 text-[#96633b]" />
                        Uang Tunai Diterima (Rp):
                      </span>
                      <span className="text-[11px] text-[#96633b] font-semibold bg-[#faebd7] px-2 py-0.2 rounded border border-[#eed7c4]">
                        Ketik angka & tekan Enter
                      </span>
                    </label>
                    
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-base font-black font-mono text-[#8a6b53] pointer-events-none select-none">
                        Rp
                      </div>
                      <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        value={cashGiven === 0 ? '' : cashGiven.toLocaleString('id-ID')}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setCashGiven(raw ? parseInt(raw, 10) : 0);
                        }}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isCashSufficient || isProcessing}
            className="w-full py-3.5 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 text-white font-black text-sm rounded-2xl shadow-lg shadow-[#96633b]/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            {isProcessing ? (
              <span>Memproses & Menyimpan Transaksi...</span>
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
