import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Receipt,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import type { Transaction } from '../types';
import type { PrinterConfig } from './PrinterSettingsModal';
import { 
  formatRupiah, 
  ESCPOSBuilder, 
  printReceiptUniversal,
  printToWebUSB,
  printToWebSerial,
  printToWebBluetooth,
  printEpsonLX310Invoice
} from '../services/escposService';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  cashierName?: string;
}

const DEFAULT_CONFIG: PrinterConfig = {
  driverType: 'USB',
  paperWidth: '58mm',
  autoCut: true,
  headerText: 'CV. TUMBUH MAKMUR AIR CONINDO\nJl. P Antasari No.106, Samarinda Ulu\nTelp: 0811 5121 215',
  footerText: 'Terima kasih atas kunjungan Anda!\nBarang yang dibeli dapat ditukar dlm 24 jam.',
  receiptStyle: 'modern',
  showLogo: true,
  logoUrl: '',
  showCashier: true,
  showQueueNumber: true,
  showDiscountSaving: true,
  showBarcodeFooter: true
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  cashierName = 'Kasir Toko'
}) => {
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_CONFIG);
  const [printStatus, setPrintStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('ketoko_printer_settings');
      if (saved) {
        try {
          setConfig(JSON.parse(saved));
        } catch {
          // fallback to DEFAULT_CONFIG
        }
      }
      setPrintStatus(null);
    }
  }, [isOpen]);

  // Keyboard shortcut: Enter or Esc for fast New Transaction
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const cashGiven = transaction.cash_given || transaction.grand_total;
  const changeDue = Math.max(0, cashGiven - transaction.grand_total);
  const totalItemCount = transaction.items.reduce((sum, item) => sum + item.qty, 0);

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintStatus({ success: true, message: `Menghubungkan via ${config.driverType} printer...` });
    try {
      const builder = new ESCPOSBuilder({ paperWidth: config.paperWidth === '58mm' ? 58 : 80 });
      const rawBytes = builder.buildConfiguredReceipt(transaction, config);
      
      let res;
      if (config.driverType === 'USB') {
        res = await printToWebUSB(rawBytes);
      } else if (config.driverType === 'SERIAL') {
        res = await printToWebSerial(rawBytes, config.baudRate || 9600);
      } else if (config.driverType === 'BLUETOOTH') {
        res = await printToWebBluetooth(rawBytes);
      } else {
        res = await printReceiptUniversal(rawBytes, 'BROWSER');
      }

      setPrintStatus(res);
    } catch (err: any) {
      setPrintStatus({
        success: false,
        message: `Gagal mencetak: ${err.message || 'Perangkat printer tidak merespons'}`
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintDotMatrix = async () => {
    setIsPrinting(true);
    setPrintStatus({ success: true, message: 'Menyiapkan Faktur Continuous Form Epson LX-310...' });
    try {
      const res = await printEpsonLX310Invoice(transaction, config);
      setPrintStatus(res);
    } catch (err: any) {
      setPrintStatus({
        success: false,
        message: `Gagal mencetak LX-310: ${err.message || 'Perangkat tidak merespons'}`
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleSelectPaperSize = (size: any) => {
    const updated = { ...config, dotMatrixPaperSize: size };
    setConfig(updated);
    try {
      localStorage.setItem('ketoko_printer_settings', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* 1. Modal Header - Transaksi Berhasil & Lunas */}
        <div className="p-4 sm:p-5 border-b border-[#5e3519] bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-emerald-700/80 text-white shadow-inner border border-emerald-400/40">
              <CheckCircle2 className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-base sm:text-lg leading-tight tracking-tight text-white">
                  Transaksi Selesai & Lunas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-800 text-emerald-100 border border-emerald-500/40 uppercase tracking-wider">
                  {transaction.payment_method}
                </span>
              </div>
              <p className="text-xs text-[#fcefe3]/90 font-mono mt-0.5">
                {transaction.receipt_number} • {new Date(transaction.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#543017] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Content Body - Fast Cashier Settlement Info */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs bg-[#fcf9f5]">
          
          {/* Change Amount Box (Uang Kembalian / Status Pembayaran) */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-white to-[#fcf9f5] border-2 border-[#ddc3aa] shadow-sm text-center space-y-1 relative overflow-hidden">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8a6b53]">
              {transaction.payment_method === 'CASH' ? 'Uang Kembalian Kasir' : 'Status Pelunasan'}
            </span>
            <div className="font-mono font-black text-2xl sm:text-3xl text-[#166534] tracking-tight">
              {transaction.payment_method === 'CASH' ? formatRupiah(changeDue) : 'LUNAS (NON-TUNAI)'}
            </div>

            {transaction.payment_method === 'CASH' && (
              <div className="flex items-center justify-center space-x-4 pt-1 text-xs text-[#5c3c26]">
                <span>Uang Diterima: <b className="font-mono text-[#3d2617]">{formatRupiah(cashGiven)}</b></span>
                <span className="text-[#ddc3aa]">•</span>
                <span>Total Belanja: <b className="font-mono text-[#3d2617]">{formatRupiah(transaction.grand_total)}</b></span>
              </div>
            )}
          </div>

          {/* Quick Transaction Breakdown Summary */}
          <div className="p-4 bg-white rounded-2xl border border-[#e5d0be] shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#f0e4d7] font-bold text-[#3d2617]">
              <span className="flex items-center space-x-1.5">
                <Receipt className="w-4 h-4 text-[#96633b]" />
                <span>Rincian Pembelian ({totalItemCount} Item)</span>
              </span>
              <span className="text-[11px] text-[#8a6b53] font-mono">
                Kasir: {transaction.cashier_name || cashierName}
              </span>
            </div>

            {/* Item list scrollable box */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#f7ede3]">
              {transaction.items.map((item, idx) => (
                <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold text-[#3d2617] truncate">{item.product_name}</div>
                    <div className="text-[10px] text-[#8a6b53] font-mono">
                      {item.qty} x {formatRupiah(item.price_applied)}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-[#3d2617] shrink-0">
                    {formatRupiah(item.subtotal_item)}
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotal, Diskon, Grand Total */}
            <div className="pt-2 border-t border-[#f0e4d7] space-y-1 text-xs text-[#5c3c26]">
              <div className="flex justify-between">
                <span className="text-[#8a6b53]">Subtotal:</span>
                <span className="font-mono font-bold text-[#3d2617]">{formatRupiah(transaction.subtotal)}</span>
              </div>
              {transaction.discount_amount > 0 && (
                <div className="flex justify-between text-rose-700 font-semibold">
                  <span>Diskon Promo / Member:</span>
                  <span className="font-mono">-{formatRupiah(transaction.discount_amount)}</span>
                </div>
              )}
              {transaction.tax_amount > 0 && (
                <div className="flex justify-between text-[#8a6b53]">
                  <span>PPN (11%):</span>
                  <span className="font-mono font-bold text-[#3d2617]">{formatRupiah(transaction.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-[#ddc3aa] text-sm font-black text-[#3d2617]">
                <span>TOTAL AKHIR:</span>
                <span className="font-mono text-[#96633b]">{formatRupiah(transaction.grand_total)}</span>
              </div>
            </div>
          </div>

          {/* Quick Paper Size Selector for Faktur */}
          <div className="p-3 bg-[#f5ede3] rounded-2xl border border-[#e5d0be] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shadow-2xs">
            <div className="flex items-center space-x-1.5 font-bold text-[#5c3c26]">
              <FileSpreadsheet className="w-4 h-4 text-[#166534]" />
              <span>Ukuran Kertas Faktur:</span>
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {/* Option: A4 Di Bagi 2 (Default & Paling Sering) */}
              <button
                type="button"
                onClick={() => handleSelectPaperSize('A4_HALF')}
                className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center space-x-1 ${
                  config.dotMatrixPaperSize === 'A4_HALF' || config.dotMatrixPaperSize === 'HALF_LETTER' || !config.dotMatrixPaperSize
                    ? 'bg-[#166534] text-white shadow-xs ring-1 ring-[#166534]'
                    : 'bg-white text-[#5c3c26] border border-[#ddc3aa] hover:bg-[#faebd7]'
                }`}
                title="Kertas HVS A4 standar dipotong menjadi 2 bagian (A5 Landscape 210 x 148 mm) - Paling Hemat"
              >
                <span>📄 A4 Di Bagi 2</span>
                <span className="text-[9px] opacity-80 font-normal">(A5)</span>
              </button>

              {/* Option: A4 Full */}
              <button
                type="button"
                onClick={() => handleSelectPaperSize('A4_FULL')}
                className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center space-x-1 ${
                  config.dotMatrixPaperSize === 'A4_FULL'
                    ? 'bg-[#166534] text-white shadow-xs ring-1 ring-[#166534]'
                    : 'bg-white text-[#5c3c26] border border-[#ddc3aa] hover:bg-[#faebd7]'
                }`}
                title="Satu lembar kertas HVS A4 utuh penuh (Portrait 210 x 297 mm)"
              >
                <span>📃 A4 Full</span>
              </button>

              {/* Option: Continuous Form 1/2 */}
              <button
                type="button"
                onClick={() => handleSelectPaperSize('CONTINUOUS_HALF')}
                className={`px-2 py-1 rounded-xl font-bold text-[11px] transition-all flex items-center space-x-1 ${
                  config.dotMatrixPaperSize === 'CONTINUOUS_HALF'
                    ? 'bg-[#166534] text-white shadow-xs ring-1 ring-[#166534]'
                    : 'bg-white text-[#5c3c26] border border-[#ddc3aa] hover:bg-[#faebd7]'
                }`}
                title="Kertas Continuous Form rangkap berlubang 1/2 Wartel (9.5 x 5.5 inch)"
              >
                <span>Cont. 1/2</span>
              </button>
            </div>
          </div>

          {/* Status printer notification */}
          {printStatus && (
            <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center space-x-2 animate-fadeIn ${
              printStatus.success 
                ? 'bg-[#edf5ee] border-[#cce2cf] text-[#166534]' 
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {printStatus.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#166534]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span className="flex-1">{printStatus.message}</span>
            </div>
          )}

        </div>

        {/* 3. Action Buttons - Instant Print & New Transaction */}
        <div className="p-4 bg-white border-t border-[#e5d0be] flex flex-col sm:flex-row items-center gap-2 shrink-0">
          {config.printerType === 'DOT_MATRIX' ? (
            <>
              <button
                onClick={handlePrintDotMatrix}
                disabled={isPrinting}
                className="w-full sm:flex-1 py-3 bg-[#166534] hover:bg-[#14532d] disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-800/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>
                  {isPrinting
                    ? 'Mencetak...'
                    : `Cetak Faktur (${
                        config.dotMatrixPaperSize === 'A4_FULL'
                          ? 'A4 Full'
                          : config.dotMatrixPaperSize === 'CONTINUOUS_HALF'
                          ? 'Continuous 1/2'
                          : config.dotMatrixPaperSize === 'CONTINUOUS_FULL' || config.dotMatrixPaperSize === 'FULL_CONTINUOUS'
                          ? 'Continuous Full'
                          : 'A4 Di Bagi 2'
                      })`}
                </span>
              </button>

              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="w-full sm:w-auto px-4 py-3 bg-[#faebd7] hover:bg-[#ebd7c5] text-[#5c3c26] rounded-2xl font-bold text-xs border border-[#ddc3aa] flex items-center justify-center space-x-1.5 transition-colors"
                title="Cetak struk thermal kasir"
              >
                <Printer className="w-4 h-4 text-[#7c4e2f]" />
                <span className="hidden sm:inline">Struk Thermal</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="w-full sm:flex-1 py-3 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-md shadow-[#96633b]/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 text-amber-200" />
                <span>{isPrinting ? 'Mencetak...' : `Cetak Struk (${config.driverType})`}</span>
              </button>

              <button
                onClick={handlePrintDotMatrix}
                disabled={isPrinting}
                className="w-full sm:w-auto px-4 py-3 bg-[#edf5ee] hover:bg-[#dceede] text-[#166534] rounded-2xl font-bold text-xs border border-[#cce2cf] flex items-center justify-center space-x-1.5 transition-colors shadow-2xs"
                title="Cetak Faktur Penjualan"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#166534]" />
                <span className="hidden sm:inline">
                  Faktur (
                  {config.dotMatrixPaperSize === 'A4_FULL'
                    ? 'A4 Full'
                    : config.dotMatrixPaperSize === 'CONTINUOUS_HALF'
                    ? 'Cont. 1/2'
                    : 'A4 Bagi 2'}
                  )
                </span>
              </button>
            </>
          )}

          <button
            onClick={handleBrowserPrint}
            className="w-full sm:w-auto px-3.5 py-3 bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] rounded-2xl font-bold text-xs border border-[#ddc3aa] flex items-center justify-center space-x-1.5 transition-colors"
            title="Cetak via dialog browser standar"
          >
            <FileText className="w-4 h-4 text-[#7c4e2f]" />
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 bg-[#3d2617] hover:bg-[#28180e] text-white rounded-2xl font-black text-xs shadow-sm flex items-center justify-center space-x-1.5 transition-all active:scale-95 whitespace-nowrap"
          >
            <span>Transaksi Baru</span>
            <span className="text-[10px] text-amber-200/80 font-mono">(Enter)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
