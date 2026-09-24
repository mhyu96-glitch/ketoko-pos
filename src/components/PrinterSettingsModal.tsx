import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Usb, 
  Bluetooth, 
  Save, 
  Play, 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Check, 
  Sparkles, 
  QrCode, 
  Sliders, 
  Eye, 
  Store, 
  Scissors, 
  Receipt, 
  FileSpreadsheet, 
  Zap, 
  Terminal, 
  Info,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';
import { 
  ESCPOSBuilder, 
  printToWebUSB, 
  printToWebSerial, 
  printToWebBluetooth, 
  printReceiptUniversal, 
  formatRupiah,
  printEpsonLX310Invoice,
  numberToWordsID
} from '../services/escposService';
import { convertImageFileToWebP } from '../utils/imageConverter';

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type ReceiptStyle = 'modern' | 'classic' | 'detailed' | 'compact';
export type DotMatrixPaperSize = 'A4_HALF' | 'A4_FULL' | 'CONTINUOUS_HALF' | 'CONTINUOUS_FULL' | 'HALF_LETTER' | 'FULL_CONTINUOUS';

export interface PrinterConfig {
  printerType?: 'THERMAL' | 'DOT_MATRIX';
  dotMatrixPaperSize?: DotMatrixPaperSize;
  driverType: 'USB' | 'SERIAL' | 'BLUETOOTH' | 'BROWSER';
  paperWidth: '58mm' | '80mm';
  autoCut: boolean;
  headerText: string;
  footerText: string;
  receiptStyle: ReceiptStyle;
  showLogo: boolean;
  logoUrl: string;
  showCashier: boolean;
  showQueueNumber: boolean;
  showDiscountSaving: boolean;
  showBarcodeFooter: boolean;
  baudRate?: number;
}

const DEFAULT_CONFIG: PrinterConfig = {
  printerType: 'THERMAL',
  dotMatrixPaperSize: 'A4_HALF',
  driverType: 'USB',
  paperWidth: '58mm',
  autoCut: true,
  headerText: 'CV. TUMBUH MAKMUR AIR CONINDO\nJl. P Antasari No.106, Samarinda Ulu\nTelp: 0811 5121 215',
  footerText: 'Terima kasih atas kunjungan Anda!\nBarang yang dibeli dapat ditukar dlm 24 jam.',
  receiptStyle: 'modern',
  showLogo: true,
  logoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80',
  showCashier: true,
  showQueueNumber: true,
  showDiscountSaving: true,
  showBarcodeFooter: true,
  baudRate: 9600
};

export const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [config, setConfig] = useState<PrinterConfig>(() => {
    const saved = localStorage.getItem('ketoko_printer_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate legacy SERIAL to USB if needed
      return { ...DEFAULT_CONFIG, ...parsed };
    }
    return DEFAULT_CONFIG;
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showLinuxGuide, setShowLinuxGuide] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('ketoko_printer_settings');
      if (saved) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
      }
      setTestResult(null);
      setSaveToast(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = () => {
    localStorage.setItem('ketoko_printer_settings', JSON.stringify(config));
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      onClose();
    }, 800);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const result = await convertImageFileToWebP(file, 300, 300, 0.9);
      setConfig((prev) => ({
        ...prev,
        logoUrl: result.dataUrl,
        showLogo: true
      }));
    } catch (err: any) {
      alert('Gagal memproses logo: ' + (err.message || 'Format gambar tidak valid'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setConfig((prev) => ({
      ...prev,
      logoUrl: '',
      showLogo: false
    }));
  };

  const handleTestPrint = async () => {
    setIsTesting(true);

    if (config.printerType === 'DOT_MATRIX') {
      setTestResult({ success: true, message: 'Menyiapkan faktur continuous form Epson LX-310...' });
      try {
        const dummyTransaction: any = {
          id: 'TEST-LX310-001',
          receipt_number: 'FAK-20260922-001',
          user_id: 'sample-user',
          cashier_name: 'Budi Santoso (Kasir)',
          items: [
            { product_id: 'p1', product_name: 'Minyak Goreng Tropical 2L', qty: 2, price_applied: 34000, subtotal_item: 68000, unit: 'BTL' },
            { product_id: 'p2', product_name: 'Beras Ramos Super Premium 5kg', qty: 1, price_applied: 65000, subtotal_item: 65000, unit: 'SAK' },
            { product_id: 'p3', product_name: 'Gula Pasir Gulaku Kuning 1kg', qty: 3, price_applied: 16500, subtotal_item: 49500, unit: 'BKS' },
            { product_id: 'p4', product_name: 'Indomie Goreng Spesial 85g', qty: 10, price_applied: 3100, subtotal_item: 31000, unit: 'BKS' }
          ],
          subtotal: 213500,
          discount_amount: 3500,
          tax_amount: 0,
          grand_total: 210000,
          payment_method: 'CASH',
          cash_given: 250000,
          change_returned: 40000,
          status: 'COMPLETED',
          created_at: new Date().toISOString()
        };
        const res = await printEpsonLX310Invoice(dummyTransaction, config);
        setTestResult(res);
      } catch (err: any) {
        setTestResult({
          success: false,
          message: `Gagal cetak LX-310: ${err.message || 'Driver tidak merespons'}`
        });
      } finally {
        setIsTesting(false);
      }
      return;
    }

    setTestResult({ success: true, message: 'Menghubungkan & mengirim raw byte ESC/POS ke printer...' });
    
    try {
      const builder = new ESCPOSBuilder({ paperWidth: config.paperWidth === '58mm' ? 58 : 80 });
      const raw = builder.buildTestPrint(config);
      
      let res;
      if (config.driverType === 'USB') {
        res = await printToWebUSB(raw);
      } else if (config.driverType === 'SERIAL') {
        res = await printToWebSerial(raw, config.baudRate || 9600);
      } else if (config.driverType === 'BLUETOOTH') {
        res = await printToWebBluetooth(raw);
      } else {
        res = await printReceiptUniversal(raw, 'BROWSER');
      }

      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Gagal cetak: ${err.message || 'Perangkat tidak merespons'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Sample items for live receipt preview
  const sampleItems = [
    { sku: 'BRG-001', name: 'Minyak Goreng Tropical 2L', category: 'Sembako', qty: 2, price: 34000, subtotal: 68000, disc: 2000 },
    { sku: 'BRG-002', name: 'Beras Ramos Super 5kg', category: 'Sembako', qty: 1, price: 65000, subtotal: 65000, disc: 0 },
    { sku: 'BRG-003', name: 'Kopi Kapal Api Spesial 165g', category: 'Minuman', qty: 3, price: 12500, subtotal: 37500, disc: 1500 },
    { sku: 'BRG-004', name: 'Indomie Goreng Original', category: 'Mie', qty: 5, price: 3100, subtotal: 15500, disc: 0 }
  ];

  const sampleSubtotal = 186000;
  const sampleDiscount = 3500;
  const sampleGrandTotal = sampleSubtotal - sampleDiscount;
  const sampleCash = 200000;
  const sampleChange = sampleCash - sampleGrandTotal;

  // Style presets metadata with distinctive visual badges
  const stylePresets = [
    {
      id: 'modern',
      title: 'Modern Bersih',
      badge: 'Cafe & Boutique',
      desc: 'Blok total tebal, logo bulat, & QR verifikasi elegan',
      icon: Sparkles
    },
    {
      id: 'classic',
      title: 'Klasik Toko',
      badge: 'Supermarket POS',
      desc: 'Gaya dot-matrix uppercase, garis = & - tradisional',
      icon: Receipt
    },
    {
      id: 'detailed',
      title: 'Detail Rinci',
      badge: 'Grosir & Faktur',
      desc: 'Tabel bergaris, info SKU, DPP pajak & tanda tangan',
      icon: FileSpreadsheet
    },
    {
      id: 'compact',
      title: 'Kompak Hemat',
      badge: 'Eco Fast-Food',
      desc: 'Spasi ultra rapat, 1-baris per item & hemat kertas',
      icon: Zap
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/50 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* 1. Modal Header - Luxury Coffee & Espresso Palette */}
        <div className="p-4 sm:p-5 border-b border-[#5e3519] bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#543017] text-amber-200 shadow-inner border border-[#9b663b]/50">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="font-black text-lg leading-tight tracking-tight text-white">
                  Pengaturan Hardware & Format Cetak Kasir
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#543017] text-amber-100 uppercase border border-[#9b663b]/50 tracking-wider shadow-2xs">
                  {config.printerType === 'DOT_MATRIX' ? 'Epson LX-310 (ESC/P)' : 'Thermal POS & Linux Ready'}
                </span>
              </div>
              <p className="text-xs text-[#fcefe3]/90 font-medium mt-0.5">
                {config.printerType === 'DOT_MATRIX' 
                  ? 'Konfigurasi cetak faktur continuous form rangkap 2-ply/3-ply kertas wartel Epson LX-310'
                  : 'Kustomisasi koneksi WebUSB/Serial, logo toko rata tengah, opsi tampilan, dan live thermal preview'}
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

        {/* Printer Mode Switcher Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#f5ebe0] border-b border-[#e5d0be] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs font-bold text-[#5c3c26] flex items-center space-x-1.5">
            <Sliders className="w-4 h-4 text-[#7c4e2f]" />
            <span>Pilih Jenis Hardware Printer:</span>
          </div>
          <div className="flex items-center p-1 bg-[#ede0d2] rounded-2xl border border-[#ddc3aa] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setConfig({ ...config, printerType: 'THERMAL' })}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
                config.printerType !== 'DOT_MATRIX'
                  ? 'bg-[#7c4e2f] text-white shadow-sm'
                  : 'text-[#5c3c26] hover:text-[#332219]'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Printer Thermal POS (58/80mm)</span>
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, printerType: 'DOT_MATRIX' })}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
                config.printerType === 'DOT_MATRIX'
                  ? 'bg-[#166534] text-white shadow-sm'
                  : 'text-[#5c3c26] hover:text-[#332219]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Dot Matrix Epson LX-310 (Faktur 2/3-Ply)</span>
            </button>
          </div>
        </div>

        {/* 2. Main Modal Content - Two Column Layout */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 bg-[#fcf9f5]">
          
          {/* LEFT COLUMN: Settings & Options (7 of 12 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {config.printerType === 'DOT_MATRIX' ? (
              <div className="space-y-4 animate-fadeIn">
                {/* 1. Model Info Card */}
                <div className="p-4 rounded-2xl bg-white border border-[#cce2cf] shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-2xl bg-[#166534] text-white shadow-xs">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-[#166534]">Epson LX-310 (9-Pin Impact Dot Matrix)</h4>
                        <p className="text-[11px] text-stone-500 font-medium">Faktur Penjualan Kertas Rangkap Continuous Form (2-Ply / 3-Ply / 4-Ply)</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide">
                      ESC/P Ready
                    </span>
                  </div>

                  <div className="p-3 bg-[#edf5ee] rounded-xl border border-[#cce2cf] text-[11px] text-[#166534] space-y-1.5">
                    <div className="font-bold flex items-center space-x-1.5">
                      <Check className="w-4 h-4 text-[#166534]" />
                      <span>Keunggulan Epson LX-310 untuk Toko & Usaha Anda:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[10.5px] pl-1 text-stone-700">
                      <li><b>Tembus Kertas Karbon (Rangkap):</b> Sekali cetak langsung terbit salinan untuk Pembeli, Kasir, dan Surat Jalan / Gudang.</li>
                      <li><b>Continuous Form Tractor-Feed:</b> Menarik kertas berlubang samping secara presisi tanpa slip dan sobekan pas di garis perforasi.</li>
                      <li><b>Faktur Berstandar Niaga:</b> Otomatis menghasilkan kalimat <b>Terbilang Rupiah</b> dan dua kotak tanda tangan resmi.</li>
                    </ul>
                  </div>
                </div>

                {/* 2. Paper Size Selector */}
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[#332219] font-bold text-xs flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-[#7c4e2f]" />
                      <span>Ukuran Kertas Faktur & Continuous Form</span>
                    </label>
                    <span className="text-[10px] font-mono font-bold text-[#166534] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {config.dotMatrixPaperSize === 'A4_FULL'
                        ? 'Kertas A4 Full (29.7 cm)'
                        : config.dotMatrixPaperSize === 'CONTINUOUS_FULL' || config.dotMatrixPaperSize === 'FULL_CONTINUOUS'
                        ? 'Continuous Folio (28 cm)'
                        : config.dotMatrixPaperSize === 'CONTINUOUS_HALF'
                        ? 'Continuous 1/2 (14 cm)'
                        : 'Kertas A4 Di Bagi 2 (14.8 cm)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option 1: A4 Di Bagi 2 (A5 Landscape) - Paling Sering Digunakan */}
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, dotMatrixPaperSize: 'A4_HALF' })}
                      className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        config.dotMatrixPaperSize === 'A4_HALF' || config.dotMatrixPaperSize === 'HALF_LETTER' || !config.dotMatrixPaperSize
                          ? 'bg-[#edf5ee] border-[#166534] ring-2 ring-[#166534]/25 shadow-xs'
                          : 'bg-[#fdfaf7] border-[#e4d5c7] hover:bg-[#faebd7]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-stone-900">Kertas A4 Di Bagi 2</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Paling Sering Digunakan
                        </span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-emerald-900">
                        210 x 148 mm (A5 Landscape)
                      </div>
                      <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                        Format setengah A4 paling hemat & standar toko/retail di Indonesia. Kertas HVS A4 standar cukup dipotong 2 bagian.
                      </p>
                    </button>

                    {/* Option 2: A4 Full (Portrait) */}
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, dotMatrixPaperSize: 'A4_FULL' })}
                      className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        config.dotMatrixPaperSize === 'A4_FULL'
                          ? 'bg-[#edf5ee] border-[#166534] ring-2 ring-[#166534]/25 shadow-xs'
                          : 'bg-[#fdfaf7] border-[#e4d5c7] hover:bg-[#faebd7]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-stone-900">Kertas A4 Full</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                          Faktur Banyak Item / Grosir
                        </span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-blue-900">
                        210 x 297 mm (A4 Portrait Utuh)
                      </div>
                      <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                        Satu lembar kertas A4 penuh utuh. Sangat cocok untuk transaksi grosir besar, puluhan item produk, atau surat jalan.
                      </p>
                    </button>

                    {/* Option 3: Continuous Form Bagi 2 (Wartel / Half-Letter) */}
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, dotMatrixPaperSize: 'CONTINUOUS_HALF' })}
                      className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        config.dotMatrixPaperSize === 'CONTINUOUS_HALF'
                          ? 'bg-[#edf5ee] border-[#166534] ring-2 ring-[#166534]/25 shadow-xs'
                          : 'bg-[#fdfaf7] border-[#e4d5c7] hover:bg-[#faebd7]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-stone-900">Continuous Form 1/2</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          Rangkap 2-4 Ply (33 Baris)
                        </span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-amber-900">
                        9.5" x 5.5" (216 x 140 mm)
                      </div>
                      <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                        Kertas rangkap berlubang traktor feed tembus karbon setengah folio untuk printer dot matrix Epson LX-310.
                      </p>
                    </button>

                    {/* Option 4: Continuous Form Penuh (Folio) */}
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, dotMatrixPaperSize: 'CONTINUOUS_FULL' })}
                      className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        config.dotMatrixPaperSize === 'CONTINUOUS_FULL' || config.dotMatrixPaperSize === 'FULL_CONTINUOUS'
                          ? 'bg-[#edf5ee] border-[#166534] ring-2 ring-[#166534]/25 shadow-xs'
                          : 'bg-[#fdfaf7] border-[#e4d5c7] hover:bg-[#faebd7]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-stone-900">Continuous Form Full</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-800">
                          Rangkap Penuh (66 Baris)
                        </span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-stone-800">
                        9.5" x 11" (216 x 280 mm)
                      </div>
                      <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                        Kertas rangkap continuous utuh satu lembar panjang untuk transaksi banyak item dengan rangkap tembus karbon.
                      </p>
                    </button>
                  </div>
                </div>

                {/* 3. Driver & Connection Setup Guide */}
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-2.5">
                  <label className="text-[#332219] font-bold text-xs flex items-center space-x-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#7c4e2f]" />
                    <span>Panduan Pengaturan Driver Epson LX-310</span>
                  </label>
                  <div className="p-3 bg-[#fdfaf7] rounded-xl border border-[#eed7c4] text-xs space-y-2 text-stone-700 leading-relaxed">
                    <div>
                      <span className="font-bold text-[#332219]">1. Instalasi Driver Printer:</span>
                      <p className="text-[11px] text-stone-600 mt-0.5">
                        • <b>Windows:</b> Pasang driver resmi Epson LX-310 atau driver bawaan Windows <i>Generic / Text Only</i>. Sambungkan printer via kabel USB.
                      </p>
                      <p className="text-[11px] text-stone-600">
                        • <b>Linux:</b> Printer langsung terdeteksi melalui CUPS (http://localhost:631). Pilih driver <i>EPSON 9-Pin Series</i>.
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-[#332219]">2. Ukuran Kertas di Driver:</span>
                      <p className="text-[11px] text-stone-600 mt-0.5">
                        Pilih ukuran kertas <b>Letter</b> atau buat Custom Paper Size <b>216 x 140 mm</b> (Wartel) agar sobekan kertas pas pada garis perforasi.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Kop Toko & Catatan Faktur */}
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
                  <div>
                    <label className="text-[#332219] font-bold text-xs mb-1 block">Identitas Kop Toko pada Faktur</label>
                    <textarea
                      value={config.headerText}
                      onChange={(e) => setConfig({ ...config, headerText: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 bg-[#fdfaf7] text-[#332219] rounded-xl border border-[#ddc3aa] text-xs font-mono focus:bg-white focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20"
                    />
                    <span className="text-[10px] text-stone-500">Baris 1: Nama Toko • Baris 2: Alamat • Baris 3: Kontak / Telepon</span>
                  </div>

                  <div>
                    <label className="text-[#332219] font-bold text-xs mb-1 block">Syarat / Catatan Bawah Faktur</label>
                    <textarea
                      value={config.footerText}
                      onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 bg-[#fdfaf7] text-[#332219] rounded-xl border border-[#ddc3aa] text-xs font-mono focus:bg-white focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* Connection Driver Selection (WebUSB, WebSerial, Bluetooth, Browser Print) */}
            <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[#332219] font-bold text-xs flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#7c4e2f]" />
                  <span>Metode Koneksi / Driver Hardware</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowLinuxGuide(!showLinuxGuide)}
                  className="text-[11px] font-bold text-[#7c4e2f] hover:underline flex items-center space-x-1"
                >
                  <Terminal className="w-3 h-3" />
                  <span>Panduan Linux USB</span>
                  {showLinuxGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Linux WebUSB / USB Permissions Guide Banner */}
              {showLinuxGuide && (
                <div className="p-3 bg-[#fcf5ed] rounded-xl border border-[#eed7c4] text-[11px] text-[#5c3c26] space-y-2 animate-fadeIn">
                  <div className="flex items-center space-x-1.5 font-bold text-[#7c4e2f]">
                    <Info className="w-4 h-4" />
                    <span>Petunjuk WebUSB di Linux (Ubuntu / Debian / Arch / Fedora):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-[10px]">
                    <li>Gunakan browser <b>Google Chrome</b> atau <b>Chromium / Brave / Edge</b>.</li>
                    <li>Jika muncul <i>"Access Denied"</i>, berikan izin USB di terminal Linux:
                      <pre className="mt-1 p-1.5 bg-stone-900 text-emerald-400 rounded-lg font-mono text-[9px] overflow-x-auto">sudo usermod -a -G dialout,lp $USER && sudo chmod 666 /dev/bus/usb/*/*</pre>
                    </li>
                    <li>Sambungkan kabel USB printer dan klik <b>Uji Cetak (Test Print)</b> di bawah.</li>
                  </ol>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. WebUSB Direct */}
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, driverType: 'USB' })}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    config.driverType === 'USB'
                      ? 'bg-[#faebd7] text-[#7c4e2f] border-[#ddc3aa] ring-2 ring-[#7c4e2f]/20 font-bold shadow-2xs'
                      : 'bg-[#fdfaf7] text-[#543c2e] border-[#e4d5c7] hover:bg-[#faebd7]'
                  }`}
                >
                  <Usb className="w-5 h-5 mb-1 text-[#7c4e2f]" />
                  <span className="text-xs font-bold">WebUSB (Direct)</span>
                  <span className="text-[8px] text-[#8a6b53] mt-0.5">Disarankan (Linux)</span>
                </button>

                {/* 2. Web Serial */}
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, driverType: 'SERIAL' })}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    config.driverType === 'SERIAL'
                      ? 'bg-[#faebd7] text-[#7c4e2f] border-[#ddc3aa] ring-2 ring-[#7c4e2f]/20 font-bold shadow-2xs'
                      : 'bg-[#fdfaf7] text-[#543c2e] border-[#e4d5c7] hover:bg-[#faebd7]'
                  }`}
                >
                  <Cpu className="w-5 h-5 mb-1 text-amber-700" />
                  <span className="text-xs font-bold">Web Serial</span>
                  <span className="text-[8px] text-[#8a6b53] mt-0.5">/dev/ttyUSB0</span>
                </button>

                {/* 3. Bluetooth */}
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, driverType: 'BLUETOOTH' })}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    config.driverType === 'BLUETOOTH'
                      ? 'bg-[#faebd7] text-[#7c4e2f] border-[#ddc3aa] ring-2 ring-[#7c4e2f]/20 font-bold shadow-2xs'
                      : 'bg-[#fdfaf7] text-[#543c2e] border-[#e4d5c7] hover:bg-[#faebd7]'
                  }`}
                >
                  <Bluetooth className="w-5 h-5 mb-1 text-sky-600" />
                  <span className="text-xs font-bold">Bluetooth POS</span>
                  <span className="text-[8px] text-[#8a6b53] mt-0.5">Wireless Mini</span>
                </button>

                {/* 4. Browser Print */}
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, driverType: 'BROWSER' })}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    config.driverType === 'BROWSER'
                      ? 'bg-[#faebd7] text-[#7c4e2f] border-[#ddc3aa] ring-2 ring-[#7c4e2f]/20 font-bold shadow-2xs'
                      : 'bg-[#fdfaf7] text-[#543c2e] border-[#e4d5c7] hover:bg-[#faebd7]'
                  }`}
                >
                  <FileText className="w-5 h-5 mb-1 text-[#85532f]" />
                  <span className="text-xs font-bold">Browser Print</span>
                  <span className="text-[8px] text-[#8a6b53] mt-0.5">CUPS / PDF</span>
                </button>
              </div>
            </div>

            {/* Receipt Style Presets */}
            <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[#332219] font-bold text-xs flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#7c4e2f]" />
                  <span>Pilihan Gaya & Layout Desain Nota</span>
                </label>
                <span className="text-[10px] text-[#856b59] font-semibold bg-[#faebd7] px-2 py-0.5 rounded-md border border-[#ddc3aa]">
                  Gaya: <b className="text-[#7c4e2f] uppercase">{config.receiptStyle}</b>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stylePresets.map((st) => {
                  const Icon = st.icon;
                  const isSelected = config.receiptStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setConfig({ ...config, receiptStyle: st.id as ReceiptStyle })}
                      className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#fcf5ed] border-[#7c4e2f] ring-2 ring-[#7c4e2f]/25 shadow-sm'
                          : 'bg-[#fdfaf7] border-[#e4d5c7] hover:bg-[#faebd7]/50 hover:border-[#ddc3aa]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-white ${
                            isSelected ? 'bg-[#7c4e2f]' : 'bg-[#a08573]'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-[#332219]">{st.title}</div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              isSelected ? 'bg-[#faebd7] text-[#7c4e2f]' : 'bg-stone-200 text-stone-600'
                            }`}>
                              {st.badge}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#7c4e2f] text-white flex items-center justify-center shrink-0 shadow-2xs animate-fadeIn">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] text-[#8a6b53] leading-snug mt-1 font-medium">
                        {st.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paper Width & Auto-Cut */}
            <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#332219] font-bold text-xs mb-1.5 block">Lebar Kertas Thermal</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, paperWidth: '58mm' })}
                      className={`py-2 rounded-xl border text-center font-mono text-xs font-bold transition-all ${
                        config.paperWidth === '58mm'
                          ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-2xs'
                          : 'bg-[#fdfaf7] text-[#543c2e] border-[#dfcebe] hover:bg-[#faebd7]'
                      }`}
                    >
                      58 mm (32 col)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, paperWidth: '80mm' })}
                      className={`py-2 rounded-xl border text-center font-mono text-xs font-bold transition-all ${
                        config.paperWidth === '80mm'
                          ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-2xs'
                          : 'bg-[#fdfaf7] text-[#543c2e] border-[#dfcebe] hover:bg-[#faebd7]'
                      }`}
                    >
                      80 mm (48 col)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[#332219] font-bold text-xs mb-1.5 block">Fitur Auto-Cut Kertas</label>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, autoCut: !config.autoCut })}
                    className={`w-full py-2 px-3 rounded-xl border text-xs text-center font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      config.autoCut
                        ? 'bg-[#edf5ee] text-[#166534] border-[#cce2cf]'
                        : 'bg-[#fdfaf7] text-[#8a6b53] border-[#dfcebe]'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>{config.autoCut ? 'Auto-Cut Aktif (ON)' : 'Manual Tear (OFF)'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Logo Toko Rata Tengah (Center Store Logo) */}
            <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-4 h-4 text-[#7c4e2f]" />
                  <span className="font-bold text-xs text-[#332219]">Logo Toko Rata Tengah (*Centered Logo*)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, showLogo: !config.showLogo })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    config.showLogo
                      ? 'bg-[#faebd7] text-[#7c4e2f] border border-[#ddc3aa]'
                      : 'bg-stone-100 text-stone-500 border border-stone-200'
                  }`}
                >
                  {config.showLogo ? '✓ Cetak Logo ON' : '✕ Logo OFF'}
                </button>
              </div>

              {config.showLogo && (
                <div className="p-3 bg-[#fdfaf7] rounded-xl border border-[#eed7c4] flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center space-x-3">
                    {config.logoUrl ? (
                      <img
                        src={config.logoUrl}
                        alt="Logo Toko"
                        className="w-12 h-12 object-contain rounded-xl border border-[#ddc3aa] bg-white p-1 shadow-2xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#faebd7] border border-[#ddc3aa] flex items-center justify-center text-[#7c4e2f]">
                        <Store className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-xs text-[#332219]">Gambar Logo Struk</div>
                      <div className="text-[10px] text-[#8a6b53]">Format WebP/PNG monokrom/warna</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <label className="px-3 py-1.5 bg-[#7c4e2f] hover:bg-[#633e26] text-white text-xs font-bold rounded-xl cursor-pointer flex items-center space-x-1.5 shadow-2xs transition-all active:scale-95">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingLogo ? 'Memproses...' : 'Upload Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={isUploadingLogo}
                      />
                    </label>

                    {config.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="p-1.5 rounded-xl text-rose-700 hover:bg-[#fdf3f2] border border-rose-200 transition-colors"
                        title="Hapus Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Elements Toggles */}
            <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-2">
              <label className="text-[#332219] font-bold text-xs block mb-1">Opsi Informasi Tambahan pada Struk</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center space-x-2 p-2 rounded-xl bg-[#fdfaf7] border border-[#e4d5c7] cursor-pointer hover:bg-[#faebd7]">
                  <input
                    type="checkbox"
                    checked={config.showQueueNumber}
                    onChange={(e) => setConfig({ ...config, showQueueNumber: e.target.checked })}
                    className="rounded text-[#7c4e2f] focus:ring-[#7c4e2f]"
                  />
                  <span className="font-semibold text-[#332219]">Nomor Antrean / Struk Besar</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-xl bg-[#fdfaf7] border border-[#e4d5c7] cursor-pointer hover:bg-[#faebd7]">
                  <input
                    type="checkbox"
                    checked={config.showCashier}
                    onChange={(e) => setConfig({ ...config, showCashier: e.target.checked })}
                    className="rounded text-[#7c4e2f] focus:ring-[#7c4e2f]"
                  />
                  <span className="font-semibold text-[#332219]">Nama Kasir & Waktu Lengkap</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-xl bg-[#fdfaf7] border border-[#e4d5c7] cursor-pointer hover:bg-[#faebd7]">
                  <input
                    type="checkbox"
                    checked={config.showDiscountSaving}
                    onChange={(e) => setConfig({ ...config, showDiscountSaving: e.target.checked })}
                    className="rounded text-[#7c4e2f] focus:ring-[#7c4e2f]"
                  />
                  <span className="font-semibold text-[#332219]">Total Diskon & Penghematan</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-xl bg-[#fdfaf7] border border-[#e4d5c7] cursor-pointer hover:bg-[#faebd7]">
                  <input
                    type="checkbox"
                    checked={config.showBarcodeFooter}
                    onChange={(e) => setConfig({ ...config, showBarcodeFooter: e.target.checked })}
                    className="rounded text-[#7c4e2f] focus:ring-[#7c4e2f]"
                  />
                  <span className="font-semibold text-[#332219]">Barcode / QRIS Footer Struk</span>
                </label>
              </div>
            </div>

            {/* Custom Header & Footer Text */}
            <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
              <div>
                <label className="text-[#332219] font-bold text-xs mb-1 block">Teks Header Nota (Nama Toko & Alamat)</label>
                <textarea
                  value={config.headerText}
                  onChange={(e) => setConfig({ ...config, headerText: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#fdfaf7] text-[#332219] rounded-xl border border-[#ddc3aa] text-xs font-mono focus:bg-white focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20"
                />
              </div>

              <div>
                <label className="text-[#332219] font-bold text-xs mb-1 block">Teks Footer Nota (Ucapan & Kebijakan)</label>
                <textarea
                  value={config.footerText}
                  onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#fdfaf7] text-[#332219] rounded-xl border border-[#ddc3aa] text-xs font-mono focus:bg-white focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20"
                />
              </div>
            </div>
              </>
            )}

          </div>

          {/* RIGHT COLUMN: Interactive Live Preview (5 of 12 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            {config.printerType === 'DOT_MATRIX' ? (
              <div className="flex flex-col space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-black text-[#166534]">
                    <Eye className="w-4 h-4 text-[#166534]" />
                    <span>Live Preview: Faktur Epson LX-310</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-[#166534] border border-emerald-300">
                    {config.dotMatrixPaperSize === 'A4_FULL'
                      ? 'Kertas A4 Full (29.7 cm)'
                      : config.dotMatrixPaperSize === 'CONTINUOUS_FULL' || config.dotMatrixPaperSize === 'FULL_CONTINUOUS'
                      ? 'Continuous Folio (28 cm)'
                      : config.dotMatrixPaperSize === 'CONTINUOUS_HALF'
                      ? 'Continuous 1/2 (14 cm)'
                      : 'Kertas A4 Di Bagi 2 (14.8 cm)'}
                  </span>
                </div>

                {/* Paper Simulation (Clean Sheet for A4 / Tractor Feed for Continuous) */}
                <div className="w-full bg-[#e3e8df] p-3 rounded-2xl border border-[#bcc8b6] flex justify-center items-start shadow-inner overflow-x-auto">
                  {(() => {
                    const isContinuous = config.dotMatrixPaperSize === 'CONTINUOUS_HALF' || config.dotMatrixPaperSize === 'CONTINUOUS_FULL' || config.dotMatrixPaperSize === 'FULL_CONTINUOUS';
                    const isA4Half = config.dotMatrixPaperSize === 'A4_HALF' || config.dotMatrixPaperSize === 'HALF_LETTER' || !config.dotMatrixPaperSize;
                    const isA4Full = config.dotMatrixPaperSize === 'A4_FULL';

                    return (
                      <div className={`w-full ${isA4Half ? 'max-w-[450px]' : 'max-w-[420px]'} bg-[#fbfdf9] border border-[#d2dbce] shadow-md rounded-xs p-3 font-mono text-stone-900 select-text text-[9.5px] leading-tight relative`}>
                        
                        {/* Left Tractor Feed Holes (Continuous only) */}
                        {isContinuous && (
                          <div className="absolute left-1 top-2 bottom-2 flex flex-col justify-between items-center pointer-events-none opacity-40">
                            {[...Array(14)].map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-full border border-stone-400 bg-[#e3e8df] my-0.5" />
                            ))}
                          </div>
                        )}

                        {/* Right Tractor Feed Holes (Continuous only) */}
                        {isContinuous && (
                          <div className="absolute right-1 top-2 bottom-2 flex flex-col justify-between items-center pointer-events-none opacity-40">
                            {[...Array(14)].map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-full border border-stone-400 bg-[#e3e8df] my-0.5" />
                            ))}
                          </div>
                        )}

                        {/* Main Invoice Sheet Content */}
                        <div className={isContinuous ? 'px-4' : 'px-2'}>
                          {/* Store Header & Faktur Badge */}
                          <div className="flex justify-between items-start border-b border-stone-800 pb-1.5">
                            <div>
                              <div className="font-black text-xs uppercase tracking-wide text-stone-950">
                                {config.headerText.split('\n')[0] || 'KETOKO POS'}
                              </div>
                              <div className="text-[8.5px] text-stone-600">
                                {config.headerText.split('\n')[1] || 'Jl. Pahlawan No. 45, Samarinda'}
                              </div>
                              <div className="text-[8.5px] text-stone-600">
                                {config.headerText.split('\n')[2] || 'Telp: 0812-3456-7890'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-black text-xs text-stone-950 tracking-wider">
                                FAKTUR PENJUALAN
                              </div>
                              <div className="text-[8px] text-emerald-800 font-bold">
                                {isA4Half ? '[A4 Di Bagi 2]' : isA4Full ? '[A4 Full]' : isContinuous ? '[Continuous Form]' : ''}
                              </div>
                              <div className="text-[8.5px] font-bold">No: FAK-20260922-001</div>
                              <div className="text-[8.5px] text-stone-500">Tgl: {new Date().toLocaleDateString('id-ID')}</div>
                            </div>
                          </div>

                          {/* Customer & Cashier Info */}
                          <div className="flex justify-between items-center py-1.5 text-[8.5px] border-b border-dashed border-stone-400">
                            <div>
                              <div>Kepada: <b>TOKO BERKAH JAYA</b></div>
                              <div>Status: <span className="font-bold text-emerald-800">LUNAS / TUNAI</span></div>
                            </div>
                            <div className="text-right">
                              <div>Kasir: {config.showCashier ? 'Budi Santoso' : '-'}</div>
                              <div>Bayar: CASH</div>
                            </div>
                          </div>

                          {/* Items Table */}
                          <table className="w-full my-1.5 border-collapse text-[8.5px]">
                            <thead>
                              <tr className="border-b border-stone-700 text-stone-900 font-bold">
                                <th className="py-1 text-left w-6">NO</th>
                                <th className="py-1 text-left">NAMA BARANG</th>
                                <th className="py-1 text-right w-8">QTY</th>
                                <th className="py-1 text-center w-8">SAT</th>
                                <th className="py-1 text-right w-16">HARGA</th>
                                <th className="py-1 text-right w-16">TOTAL</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                              <tr>
                                <td className="py-0.5">1.</td>
                                <td className="py-0.5 font-bold truncate max-w-[120px]">MINYAK GOR TROPICAL 2L</td>
                                <td className="py-0.5 text-right">2</td>
                                <td className="py-0.5 text-center">BTL</td>
                                <td className="py-0.5 text-right">34.000</td>
                                <td className="py-0.5 text-right">68.000</td>
                              </tr>
                              <tr>
                                <td className="py-0.5">2.</td>
                                <td className="py-0.5 font-bold truncate max-w-[120px]">BERAS RAMOS SUPER 5KG</td>
                                <td className="py-0.5 text-right">1</td>
                                <td className="py-0.5 text-center">SAK</td>
                                <td className="py-0.5 text-right">65.000</td>
                                <td className="py-0.5 text-right">65.000</td>
                              </tr>
                              <tr>
                                <td className="py-0.5">3.</td>
                                <td className="py-0.5 font-bold truncate max-w-[120px]">GULA PASIR GULAKU 1KG</td>
                                <td className="py-0.5 text-right">3</td>
                                <td className="py-0.5 text-center">BKS</td>
                                <td className="py-0.5 text-right">16.500</td>
                                <td className="py-0.5 text-right">49.500</td>
                              </tr>
                              <tr>
                                <td className="py-0.5">4.</td>
                                <td className="py-0.5 font-bold truncate max-w-[120px]">INDOMIE GORENG 85G</td>
                                <td className="py-0.5 text-right">10</td>
                                <td className="py-0.5 text-center">BKS</td>
                                <td className="py-0.5 text-right">3.100</td>
                                <td className="py-0.5 text-right">31.000</td>
                              </tr>
                            </tbody>
                          </table>

                          {/* Subtotals & Terbilang */}
                          <div className="border-t border-stone-800 pt-1.5 flex justify-between items-start text-[8.5px] gap-2">
                            <div className="flex-1">
                              <div className="p-1 border border-dashed border-stone-500 rounded bg-white text-[8px] italic">
                                <b>Terbilang:</b> {numberToWordsID(210000)}
                              </div>
                              <div className="text-[7.5px] text-stone-500 mt-1 leading-snug">
                                {config.footerText || '* Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.'}
                              </div>
                            </div>

                            <div className="w-36 space-y-0.5">
                              <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>Rp 213.500</span>
                              </div>
                              <div className="flex justify-between text-rose-700">
                                <span>Diskon:</span>
                                <span>-Rp 3.500</span>
                              </div>
                              <div className="flex justify-between font-black text-[9px] border-t border-stone-800 pt-0.5">
                                <span>TOTAL:</span>
                                <span>Rp 210.000</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Bayar:</span>
                                <span>Rp 250.000</span>
                              </div>
                              <div className="flex justify-between font-bold">
                                <span>Kembali:</span>
                                <span>Rp 40.000</span>
                              </div>
                            </div>
                          </div>

                          {/* Signatures */}
                          <div className="grid grid-cols-2 text-center text-[8px] pt-4 mt-2 border-t border-dashed border-stone-400">
                            <div>
                              <div>Tanda Terima / Pembeli,</div>
                              <div className="h-7"></div>
                              <div>( .......................... )</div>
                            </div>
                            <div>
                              <div>Hormat Kami / Kasir,</div>
                              <div className="h-7"></div>
                              <div>( Budi Santoso )</div>
                            </div>
                          </div>

                          {/* Perforation / Border Line */}
                          <div className="mt-3 pt-1 border-b border-dotted border-stone-400 text-center text-[7px] text-stone-400 select-none">
                            {config.dotMatrixPaperSize === 'A4_FULL'
                              ? '- - - BATAS KERTAS A4 FULL (210 x 297 MM) - - -'
                              : config.dotMatrixPaperSize === 'CONTINUOUS_FULL' || config.dotMatrixPaperSize === 'FULL_CONTINUOUS'
                              ? '- - - SOBEKAN PERFORASI CONTINUOUS FORM (66 BARIS / 28 CM) - - -'
                              : config.dotMatrixPaperSize === 'CONTINUOUS_HALF'
                              ? '- - - SOBEKAN PERFORASI CONTINUOUS FORM (33 BARIS / 14 CM) - - -'
                              : '- - - GARIS POTONG / SOBEKAN KERTAS A4 DI BAGI 2 (A5 LANDSCAPE) - - -'}
                          </div>
                        </div>

                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-black text-[#332219]">
                    <Eye className="w-4 h-4 text-[#7c4e2f]" />
                    <span>Live Preview: <span className="text-[#7c4e2f] uppercase">{stylePresets.find(s => s.id === config.receiptStyle)?.title}</span></span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#faebd7] text-[#7c4e2f] border border-[#ddc3aa]">
                    {config.paperWidth}
                  </span>
                </div>

                {/* Thermal Receipt Paper Mockup Container */}
                <div className="w-full bg-[#ede4da] p-3.5 sm:p-5 rounded-3xl border border-[#ddc3aa] flex justify-center items-start shadow-inner overflow-visible">
              
              {/* ======================================================== */}
              {/* 1. MODERN BERSIH (CAFE & BOUTIQUE STYLE) */}
              {/* ======================================================== */}
              {config.receiptStyle === 'modern' && (
                <div className={`bg-white rounded-t-2xl shadow-2xl p-4 sm:p-5 border border-stone-200 text-stone-900 leading-tight select-text transition-all font-sans animate-fadeIn ${
                  config.paperWidth === '58mm' ? 'w-full max-w-[280px] text-[11px]' : 'w-full max-w-[340px] text-xs'
                }`}>
                  
                  {/* Centered Logo with Rounded Card */}
                  {config.showLogo && config.logoUrl && (
                    <div className="flex justify-center mb-2.5">
                      <img
                        src={config.logoUrl}
                        alt="Logo Toko"
                        className="max-h-14 max-w-[130px] object-contain rounded-xl shadow-xs"
                      />
                    </div>
                  )}

                  {/* Header Title with Tag */}
                  <div className="text-center space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-stone-900 text-white text-[9px] font-bold tracking-widest uppercase mb-1">
                      OFFICIAL RECEIPT
                    </span>
                    <div className="font-extrabold text-sm text-stone-950 whitespace-pre-line tracking-tight leading-snug">
                      {config.headerText}
                    </div>
                  </div>

                  {config.showQueueNumber && (
                    <div className="my-2.5 py-1.5 bg-[#f5ece3] rounded-xl text-center font-black text-xs text-[#7c4e2f] border border-[#e5d0be]">
                      ORDER QUEUE: #042
                    </div>
                  )}

                  <div className="my-2 border-b border-stone-800" />

                  {/* Meta Bar */}
                  <div className="grid grid-cols-2 text-[10px] text-stone-600 gap-y-0.5">
                    <div><span className="text-stone-400">TRX:</span> #INV-26082901</div>
                    <div className="text-right">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div><span className="text-stone-400">Date:</span> {new Date().toLocaleDateString('id-ID')}</div>
                    {config.showCashier && (
                      <div className="text-right font-medium text-stone-800">Kasir: Siti</div>
                    )}
                  </div>

                  <div className="my-2 border-b border-stone-300" />

                  {/* Items List (Modern 2-Line Format) */}
                  <div className="space-y-2">
                    {sampleItems.map((it, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="font-bold text-stone-950 flex justify-between">
                          <span className="truncate pr-1">{it.name}</span>
                          <span className="font-mono">{formatRupiah(it.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                          <span>{it.qty}x @ {formatRupiah(it.price)}</span>
                          <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 text-[8px] font-sans">
                            {it.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="my-2.5 border-b border-stone-300" />

                  {/* Subtotals */}
                  <div className="space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span>{formatRupiah(sampleSubtotal)}</span>
                    </div>

                    {config.showDiscountSaving && (
                      <div className="flex justify-between text-rose-600 font-semibold">
                        <span>Diskon Promo</span>
                        <span>-{formatRupiah(sampleDiscount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Modern Highlighted Dark Total Pill */}
                  <div className="my-2 p-2.5 rounded-xl bg-stone-950 text-white flex items-center justify-between font-mono shadow-md">
                    <span className="text-xs font-bold font-sans tracking-wide">TOTAL BAYAR</span>
                    <span className="text-sm font-black text-amber-300">{formatRupiah(sampleGrandTotal)}</span>
                  </div>

                  <div className="space-y-0.5 text-[10px] font-mono text-stone-700">
                    <div className="flex justify-between">
                      <span>Tunai (Cash)</span>
                      <span>{formatRupiah(sampleCash)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-stone-900">
                      <span>Kembalian</span>
                      <span>{formatRupiah(sampleChange)}</span>
                    </div>
                  </div>

                  {config.showDiscountSaving && (
                    <div className="my-2 p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-center text-[10px] font-bold text-amber-900">
                      ✨ Anda Berhasil Hemat {formatRupiah(sampleDiscount)}!
                    </div>
                  )}

                  <div className="my-3 border-b border-stone-200" />

                  {/* Footer Text */}
                  <div className="text-center text-[10px] text-stone-500 whitespace-pre-line leading-relaxed font-sans">
                    {config.footerText}
                  </div>

                  {/* QRIS / Barcode */}
                  {config.showBarcodeFooter && (
                    <div className="mt-3 pt-2 flex flex-col items-center justify-center space-y-1">
                      <QrCode className="w-11 h-11 text-stone-900" />
                      <span className="text-[8px] font-mono text-stone-400">Scan untuk E-Receipt & QRIS</span>
                    </div>
                  )}

                  {/* Serrated Bottom Edge */}
                  <div className="mt-4 pt-2 border-b-4 border-dotted border-stone-300 text-center text-[8px] text-stone-400 select-none font-mono">
                    ✂ {config.autoCut ? 'AUTO-CUT PAPER' : 'POTONG DISINI'} ✂
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 2. KLASIK TOKO (SUPERMARKET DOT-MATRIX POS STYLE) */}
              {/* ======================================================== */}
              {config.receiptStyle === 'classic' && (
                <div className={`bg-white rounded-t-sm shadow-2xl p-4 sm:p-5 border border-stone-300 text-stone-950 font-mono text-[10px] uppercase tracking-wider select-text transition-all animate-fadeIn ${
                  config.paperWidth === '58mm' ? 'w-full max-w-[280px]' : 'w-full max-w-[340px]'
                }`}>
                  
                  {/* Centered Monokrom Logo */}
                  {config.showLogo && config.logoUrl && (
                    <div className="flex justify-center mb-2 filter grayscale contrast-200">
                      <img
                        src={config.logoUrl}
                        alt="Logo Toko"
                        className="max-h-11 max-w-[110px] object-contain"
                      />
                    </div>
                  )}

                  <div className="text-center select-none font-bold">================================</div>
                  <div className="text-center font-black whitespace-pre-line py-0.5 text-[11px] leading-tight">
                    {config.headerText}
                  </div>
                  <div className="text-center select-none font-bold">================================</div>

                  {config.showQueueNumber && (
                    <div className="text-center font-bold py-1 my-1 border-y border-dashed border-stone-400">
                      *** NO. ANTRIAN: 042 ***
                    </div>
                  )}

                  {/* Classic Cashier Meta */}
                  <div className="py-1 space-y-0.5 text-[9px]">
                    <div className="flex justify-between">
                      <span>NO: 20260829-089</span>
                      <span>POS-01 (TUNAI)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TGL: 29.08.2026</span>
                      <span>JAM: 09:30:15</span>
                    </div>
                    {config.showCashier && (
                      <div>KASIR: 01-SITI RAHMAH</div>
                    )}
                  </div>

                  <div className="text-center select-none font-bold">--------------------------------</div>
                  <div className="flex justify-between font-bold text-[9px]">
                    <span>ITEM BELANJA</span>
                    <span>TOTAL</span>
                  </div>
                  <div className="text-center select-none font-bold">--------------------------------</div>

                  {/* Items List (Classic Dot Matrix Format) */}
                  <div className="space-y-1.5">
                    {sampleItems.map((it, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="font-bold truncate">{idx + 1}. {it.name}</div>
                        <div className="flex justify-between pl-3 text-stone-700">
                          <span>{it.qty} X {formatRupiah(it.price)}</span>
                          <span>{formatRupiah(it.subtotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-center select-none font-bold my-1">--------------------------------</div>

                  {/* Total Calculations */}
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>SUBTOTAL ({sampleItems.length} ITEM):</span>
                      <span>{formatRupiah(sampleSubtotal)}</span>
                    </div>

                    {config.showDiscountSaving && (
                      <div className="flex justify-between">
                        <span>POTONGAN DISKON:</span>
                        <span>-{formatRupiah(sampleDiscount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-black text-xs pt-1 border-t border-dashed border-stone-900">
                      <span>TOTAL AKHIR :</span>
                      <span>{formatRupiah(sampleGrandTotal)}</span>
                    </div>

                    <div className="flex justify-between pt-1">
                      <span>TUNAI (CASH) :</span>
                      <span>{formatRupiah(sampleCash)}</span>
                    </div>

                    <div className="flex justify-between font-bold">
                      <span>KEMBALIAN    :</span>
                      <span>{formatRupiah(sampleChange)}</span>
                    </div>
                  </div>

                  {config.showDiscountSaving && (
                    <div className="my-1.5 text-center font-bold text-[9px] py-0.5 border border-stone-800">
                      *** ANDA HEMAT: {formatRupiah(sampleDiscount)} ***
                    </div>
                  )}

                  <div className="text-center select-none font-bold my-1">================================</div>

                  {/* Traditional Monospace Footer */}
                  <div className="text-center text-[9px] whitespace-pre-line leading-tight">
                    {config.footerText}
                  </div>

                  {/* Classic Authentic 1D Barcode SVG */}
                  {config.showBarcodeFooter && (
                    <div className="mt-3 pt-1 flex flex-col items-center justify-center space-y-1 select-none">
                      <svg className="h-7 w-40 text-stone-900" viewBox="0 0 160 28" fill="currentColor">
                        <rect x="0" y="0" width="3" height="28" />
                        <rect x="5" y="0" width="1" height="28" />
                        <rect x="8" y="0" width="4" height="28" />
                        <rect x="14" y="0" width="2" height="28" />
                        <rect x="18" y="0" width="1" height="28" />
                        <rect x="21" y="0" width="3" height="28" />
                        <rect x="26" y="0" width="2" height="28" />
                        <rect x="30" y="0" width="4" height="28" />
                        <rect x="36" y="0" width="1" height="28" />
                        <rect x="39" y="0" width="3" height="28" />
                        <rect x="44" y="0" width="2" height="28" />
                        <rect x="48" y="0" width="1" height="28" />
                        <rect x="51" y="0" width="4" height="28" />
                        <rect x="57" y="0" width="2" height="28" />
                        <rect x="61" y="0" width="3" height="28" />
                        <rect x="66" y="0" width="1" height="28" />
                        <rect x="69" y="0" width="4" height="28" />
                        <rect x="75" y="0" width="2" height="28" />
                        <rect x="79" y="0" width="1" height="28" />
                        <rect x="82" y="0" width="3" height="28" />
                        <rect x="87" y="0" width="4" height="28" />
                        <rect x="93" y="0" width="1" height="28" />
                        <rect x="96" y="0" width="2" height="28" />
                        <rect x="100" y="0" width="3" height="28" />
                        <rect x="105" y="0" width="1" height="28" />
                        <rect x="108" y="0" width="4" height="28" />
                        <rect x="114" y="0" width="2" height="28" />
                        <rect x="118" y="0" width="3" height="28" />
                        <rect x="123" y="0" width="1" height="28" />
                        <rect x="126" y="0" width="4" height="28" />
                        <rect x="132" y="0" width="2" height="28" />
                        <rect x="136" y="0" width="1" height="28" />
                        <rect x="139" y="0" width="3" height="28" />
                        <rect x="144" y="0" width="4" height="28" />
                        <rect x="150" y="0" width="2" height="28" />
                        <rect x="154" y="0" width="1" height="28" />
                        <rect x="157" y="0" width="3" height="28" />
                      </svg>
                      <span className="text-[8px] font-mono tracking-widest text-stone-700 font-bold">*TRX-20260829-089*</span>
                    </div>
                  )}

                  <div className="mt-4 pt-2 border-b-2 border-dashed border-stone-400 text-center text-[8px] select-none">
                    --- {config.autoCut ? 'CUT PAPER' : 'TEAR HERE'} ---
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 3. DETAIL RINCI (GROSIR & FAKTUR ENTERPRISE STYLE) */}
              {/* ======================================================== */}
              {config.receiptStyle === 'detailed' && (
                <div className={`bg-white rounded-t-xl shadow-2xl p-3.5 sm:p-4 border border-stone-300 text-stone-900 text-[10px] leading-tight select-text transition-all font-sans animate-fadeIn ${
                  config.paperWidth === '58mm' ? 'w-full max-w-[280px]' : 'w-full max-w-[340px]'
                }`}>
                  
                  {/* Centered Logo with Enterprise Badge */}
                  {config.showLogo && config.logoUrl && (
                    <div className="flex justify-center mb-1.5">
                      <img
                        src={config.logoUrl}
                        alt="Logo Toko"
                        className="max-h-12 max-w-[120px] object-contain rounded-md"
                      />
                    </div>
                  )}

                  {/* Faktur Header */}
                  <div className="text-center space-y-0.5 border-b-2 border-stone-800 pb-2">
                    <div className="font-black text-xs uppercase tracking-wide text-stone-950 whitespace-pre-line">
                      {config.headerText}
                    </div>
                    <div className="text-[9px] text-stone-500 font-mono">NPWP: 01.889.324.5-728.000</div>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-stone-100 text-stone-800 font-bold text-[8px] rounded border border-stone-300 uppercase">
                      FAKTUR PENJUALAN GROSIR & RETAIL
                    </span>
                  </div>

                  {/* Detailed Meta Box */}
                  <div className="my-2 p-2 bg-stone-50 rounded-lg border border-stone-200 text-[9px] space-y-0.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-stone-500">No. Faktur:</span>
                      <span className="font-bold text-stone-900">FAK/2026/08/00492</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Waktu Trx:</span>
                      <span>29-08-2026 09:30:20</span>
                    </div>
                    {config.showCashier && (
                      <div className="flex justify-between">
                        <span className="text-stone-500">Kasir / Shift:</span>
                        <span>Siti Rahmah (Shift 1)</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#7c4e2f] font-bold">
                      <span>Pelanggan:</span>
                      <span>PLG-001 (Member Gold)</span>
                    </div>
                  </div>

                  {/* Detailed Table Grid */}
                  <div className="border border-stone-300 rounded-lg overflow-hidden my-2">
                    <div className="bg-stone-200 text-stone-800 font-bold text-[8px] px-2 py-1 grid grid-cols-12 uppercase">
                      <span className="col-span-6">Item / SKU</span>
                      <span className="col-span-2 text-center">Qty</span>
                      <span className="col-span-4 text-right">Subtotal</span>
                    </div>

                    <div className="divide-y divide-stone-200 bg-white">
                      {sampleItems.map((it, idx) => (
                        <div key={idx} className="p-1.5 text-[9px]">
                          <div className="font-bold text-stone-950">{it.name}</div>
                          <div className="flex justify-between text-stone-500 font-mono text-[8px] mt-0.5">
                            <span>{it.sku} • @ {formatRupiah(it.price)}</span>
                            {it.disc > 0 && (
                              <span className="text-rose-600 font-semibold">Disc: -{formatRupiah(it.disc)}</span>
                            )}
                            <span className="font-bold text-stone-900">{formatRupiah(it.subtotal)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial & Tax Breakdown Box */}
                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-200 space-y-1 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span>Subtotal DPP:</span>
                      <span>{formatRupiah(sampleSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-stone-500">
                      <span>PPN / Pajak PB1 (Termasuk):</span>
                      <span>Rp 0</span>
                    </div>
                    {config.showDiscountSaving && (
                      <div className="flex justify-between text-rose-600 font-bold">
                        <span>Total Potongan Promo:</span>
                        <span>-{formatRupiah(sampleDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-xs text-stone-950 pt-1 border-t border-stone-300">
                      <span>TOTAL FAKTUR:</span>
                      <span>{formatRupiah(sampleGrandTotal)}</span>
                    </div>
                    <div className="flex justify-between pt-0.5 text-stone-700">
                      <span>Bayar (Tunai):</span>
                      <span>{formatRupiah(sampleCash)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-stone-950">
                      <span>Kembalian:</span>
                      <span>{formatRupiah(sampleChange)}</span>
                    </div>
                  </div>

                  {/* Member Loyalty Point Info */}
                  <div className="my-2 p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[8px] text-emerald-900 flex justify-between font-medium">
                    <span>Poin Transaksi: <b>+182 Poin</b></span>
                    <span>Total Poin: <b>1.450 Poin</b></span>
                  </div>

                  {/* Signature Box (Tanda Terima) */}
                  <div className="grid grid-cols-2 gap-2 text-center text-[8px] text-stone-500 pt-2 border-t border-stone-200 my-2">
                    <div>
                      <div>Kasir Toko,</div>
                      <div className="mt-6 border-b border-stone-300 mx-3"></div>
                      <div className="mt-0.5">( Siti Rahmah )</div>
                    </div>
                    <div>
                      <div>Penerima / Pembeli,</div>
                      <div className="mt-6 border-b border-stone-300 mx-3"></div>
                      <div className="mt-0.5">( .................... )</div>
                    </div>
                  </div>

                  <div className="text-center text-[8px] text-stone-500 whitespace-pre-line mt-2">
                    {config.footerText}
                  </div>

                  {/* QR Verification */}
                  {config.showBarcodeFooter && (
                    <div className="mt-2.5 flex flex-col items-center justify-center space-y-1">
                      <QrCode className="w-9 h-9 text-stone-800" />
                      <span className="text-[7px] font-mono text-stone-400">FAK-20260829-00492</span>
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-b-2 border-dotted border-stone-300 text-center text-[8px] text-stone-400 select-none font-mono">
                    ✂ {config.autoCut ? 'AUTO-CUT PAPER' : 'POTONG DISINI'} ✂
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* 4. KOMPAK HEMAT (ECO FAST-FOOD & SHORT RECEIPT STYLE) */}
              {/* ======================================================== */}
              {config.receiptStyle === 'compact' && (
                <div className={`bg-white rounded-t-sm shadow-2xl p-3 border border-stone-300 text-stone-950 font-mono text-[9px] leading-tight select-text transition-all animate-fadeIn ${
                  config.paperWidth === '58mm' ? 'w-full max-w-[260px]' : 'w-full max-w-[310px]'
                }`}>
                  
                  {/* Compact Logo */}
                  {config.showLogo && config.logoUrl && (
                    <div className="flex justify-center mb-1">
                      <img
                        src={config.logoUrl}
                        alt="Logo Toko"
                        className="max-h-8 max-w-[80px] object-contain"
                      />
                    </div>
                  )}

                  {/* 1-Line Compact Store Header */}
                  <div className="text-center font-bold text-[10px]">
                    ★ KETOKO POS SAMARINDA ★
                  </div>
                  <div className="text-center text-[8px] text-stone-600">
                    29/08/26 09:30 • {config.showCashier ? 'Kasir: Siti' : ''} • #TRX89
                  </div>

                  {config.showQueueNumber && (
                    <div className="text-center font-black text-[11px] py-0.5 bg-stone-100 rounded my-1 border border-stone-300">
                      ANTRIAN #{sampleGrandTotal.toString().slice(-2)}
                    </div>
                  )}

                  <div className="border-b border-dashed border-stone-400 my-1" />

                  {/* Compact Single-Line Item Format (Ultra Paper-Saving) */}
                  <div className="space-y-1">
                    {sampleItems.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[8.5px]">
                        <span className="truncate pr-1 font-semibold">{it.qty}x {it.name.split(' ')[0]} {it.name.split(' ')[1] || ''}</span>
                        <span className="shrink-0">{formatRupiah(it.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-b border-dashed border-stone-400 my-1" />

                  {/* Ultra-Dense Totals */}
                  <div className="space-y-0.5 text-[9px]">
                    <div className="flex justify-between font-black text-[10px]">
                      <span>TOTAL:</span>
                      <span>{formatRupiah(sampleGrandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-[8px] text-stone-600">
                      <span>BAYAR: {formatRupiah(sampleCash)}</span>
                      <span>KEMBALI: {formatRupiah(sampleChange)}</span>
                    </div>
                  </div>

                  {config.showDiscountSaving && (
                    <div className="my-1 text-center font-bold text-[8px] text-emerald-800 bg-emerald-50 py-0.5 rounded">
                      HEMAT: {formatRupiah(sampleDiscount)}
                    </div>
                  )}

                  <div className="border-b border-dashed border-stone-400 my-1" />

                  {/* Compact Eco Message */}
                  <div className="text-center text-[7.5px] text-stone-500">
                    *Terima Kasih • Struk Hemat Kertas*
                  </div>

                  {config.showBarcodeFooter && (
                    <div className="mt-1 flex justify-center">
                      <QrCode className="w-7 h-7 text-stone-800" />
                    </div>
                  )}

                  <div className="mt-2 pt-1 border-b border-dotted border-stone-300 text-center text-[7px] text-stone-400 select-none">
                    - - - {config.autoCut ? 'CUT' : 'TEAR'} - - -
                  </div>
                </div>
              )}

            </div>
              </>
            )}

          </div>

        </div>

        {/* 3. Modal Footer Banner & Action Buttons */}
        <div className="p-4 border-t border-[#e4d5c7] bg-[#f5ece3] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          <div className="text-xs text-[#856b59] font-medium flex items-center space-x-2">
            {testResult ? (
              <span className={`font-bold flex items-center space-x-1.5 ${
                testResult.success ? 'text-[#166534]' : 'text-rose-700'
              }`}>
                {testResult.success ? <Check className="w-4 h-4 text-[#166534]" /> : <Info className="w-4 h-4 text-rose-700" />}
                <span>{testResult.message}</span>
              </span>
            ) : saveToast ? (
              <span className="font-bold text-[#166534] flex items-center space-x-1">
                <Check className="w-4 h-4 text-[#166534]" />
                <span>Pengaturan hardware & nota kasir berhasil disimpan!</span>
              </span>
            ) : (
              <span>Pengaturan printer aktif di seluruh transaksi kasir</span>
            )}
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTesting}
              className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-[#faebd7] text-[#543c2e] font-bold rounded-xl border border-[#dfcebe] flex items-center justify-center space-x-1.5 transition-colors shadow-2xs active:scale-95 text-xs"
            >
              <Play className="w-3.5 h-3.5 text-[#7c4e2f]" />
              <span>
                {isTesting 
                  ? 'Mengirim...' 
                  : config.printerType === 'DOT_MATRIX' 
                    ? 'Uji Cetak Faktur (LX-310)' 
                    : 'Uji Cetak (Test Print)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex-1 sm:flex-none px-6 py-2 bg-[#7c4e2f] hover:bg-[#633e26] text-white font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 text-xs"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
