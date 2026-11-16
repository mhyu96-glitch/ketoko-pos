import React, { useState } from 'react';
import { 
  X, 
  Send, 
  MessageSquare, 
  Store, 
  User, 
  CheckCircle2, 
  Check, 
  ExternalLink,
  Laptop,
  CreditCard,
  Monitor,
  Printer,
  Barcode,
  Wifi,
  HelpCircle,
  Clock
} from 'lucide-react';
import { errorTracker, type ErrorLogItem } from '../services/errorTracker';

interface CashierHelpChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  branchName?: string;
  cashierName?: string;
  activeCartTotal?: number;
  activeItemCount?: number;
  supportPhone?: string;
}

const CATEGORIES = [
  { id: 'KASIR', label: 'Kasir & Keranjang', icon: Laptop, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { id: 'MEMBER_ATM', label: 'Kartu Member / ATM', icon: CreditCard, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { id: 'CUSTOMER_DISPLAY', label: 'Layar Pembeli', icon: Monitor, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { id: 'PRINTER', label: 'Printer Struk', icon: Printer, color: 'text-sky-700 bg-sky-50 border-sky-200' },
  { id: 'BARCODE_SCANNER', label: 'Barcode Scanner', icon: Barcode, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { id: 'LAN_SYNC', label: 'Jaringan & LAN', icon: Wifi, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  { id: 'LAINNYA', label: 'Lainnya / Umum', icon: HelpCircle, color: 'text-slate-700 bg-slate-50 border-slate-200' },
];

const TEMPLATES: Record<string, string[]> = {
  KASIR: [
    'Tombol pembayaran tidak merespons',
    'Diskon member tidak otomatis terpotong di total belanja',
    'Produk barcode tidak muncul saat dicari'
  ],
  MEMBER_ATM: [
    'Saldo simpanan karyawan tidak otomatis terpotong setelah tap kartu',
    'QR Barcode member tidak terbaca oleh scanner kasir',
    'Nama member tidak sesuai dengan data di sistem'
  ],
  CUSTOMER_DISPLAY: [
    'Layar kedua pembeli blank atau tidak sinkron dengan kasir',
    'Tampilan kartu ATM koperasi tidak muncul di layar pembeli',
    'Total harga belanja di layar pembeli berbeda'
  ],
  PRINTER: [
    'Printer thermal tidak mencetak struk setelah bayar',
    'Kertas struk terpotong tidak rapi atau teks buram',
    'Laci uang (cash drawer) tidak otomatis terbuka saat cetak struk'
  ],
  BARCODE_SCANNER: [
    'Barcode scanner lambat membaca barcode fisik',
    'Scanner bunyi beep tapi kode tidak masuk ke keranjang'
  ],
  LAN_SYNC: [
    'Status koneksi LAN offline / tidak terhubung ke server utama',
    'Sinkronisasi stok dengan komputer sebelah lambat'
  ],
  LAINNYA: [
    'Ada error muncul di layar kasir',
    'Aplikasi terasa lambat saat transaksi ramai'
  ]
};

export const CashierHelpChatModal: React.FC<CashierHelpChatModalProps> = ({
  isOpen,
  onClose,
  storeName = 'CV. Tumbuh Makmur Air Conindo',
  branchName = 'Cabang Samarinda',
  cashierName = 'Kasir Bertugas',
  activeCartTotal = 0,
  activeItemCount = 0,
  supportPhone = '081255558900'
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('KASIR');
  const [message, setMessage] = useState<string>('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sentReports, setSentReports] = useState<Array<{ id: string; time: string; category: string; text: string }>>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCategoryInfo = CATEGORIES.find(c => c.id === selectedCategory) || CATEGORIES[0];
  const currentTemplates = TEMPLATES[selectedCategory] || TEMPLATES['LAINNYA'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMsg = message.trim();
    if (!cleanMsg) return;

    setIsSubmitting(true);

    try {
      const diagContext: Record<string, any> = {
        category: currentCategoryInfo.label,
        cartItemCount: activeItemCount,
        cartTotalFormatted: activeCartTotal > 0 ? `Rp ${activeCartTotal.toLocaleString('id-ID')}` : 'Rp 0',
        pageUrl: window.location.href,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        isOnline: navigator.onLine
      };

      const logItem: ErrorLogItem = errorTracker.reportFromCashier({
        message: cleanMsg,
        category: currentCategoryInfo.label,
        severity: 'WARNING',
        storeName,
        branchName,
        cashierName,
        context: includeDiagnostics ? diagContext : { category: currentCategoryInfo.label }
      });

      // Append to local session sent reports
      const newReport = {
        id: logItem.id,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        category: currentCategoryInfo.label,
        text: cleanMsg
      };
      setSentReports(prev => [newReport, ...prev]);

      setMessage('');
      setSuccessToast('Laporan berhasil dikirim ke Superadmin Developer!');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Gagal mengirim laporan kasir:', err);
      alert('Gagal mengirim laporan. Pastikan aplikasi berjalan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsAppSupport = () => {
    const cleanPhone = supportPhone.replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const cleanMsg = message.trim() || 'Mohon bantuan kendala operasional kasir';

    const waText = [
      `*LAPORAN KENDALA KASIR KETOKO POS* 🚨`,
      `🏢 *Toko*: ${storeName}`,
      `🏬 *Cabang*: ${branchName}`,
      `👤 *Petugas/Kasir*: ${cashierName}`,
      `📦 *Bagian/Kategori*: ${currentCategoryInfo.label}`,
      `🕒 *Waktu*: ${new Date().toLocaleString('id-ID')}`,
      `---------------------------------`,
      `📝 *Isi Kendala*:`,
      `"${cleanMsg}"`,
      `---------------------------------`,
      activeItemCount > 0 ? `ℹ️ *Transaksi Aktif*: ${activeItemCount} item (Total Rp ${activeCartTotal.toLocaleString('id-ID')})` : ''
    ].filter(Boolean).join('\n');

    const url = `https://wa.me/${waPhone}?text=${encodeURI(waText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-scaleUp">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#faebd7]/70 via-[#fcf8f4] to-white border-b border-[#ebdccf] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#7c4e2f] text-white flex items-center justify-center shadow-md">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-[#422919]">
                  Chat Bantuan & Lapor Kendala Kasir
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Superadmin
                </span>
              </div>
              <p className="text-xs text-[#8a6b53] font-medium">
                Pesan akan langsung muncul di layar pantau Superadmin developer
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#dfcebe] text-[#7c4e2f] hover:bg-[#faebd7] flex items-center justify-center text-xs font-bold transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Store & Cashier Identity Tag */}
        <div className="px-6 py-2.5 bg-[#fbf7f2] border-b border-[#ebdccf]/70 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6d4327]">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1 font-bold">
              <Store className="w-3.5 h-3.5 text-[#7c4e2f]" />
              <span>{storeName}</span>
              <span className="text-[#a88a75] font-normal">({branchName})</span>
            </span>
            <span className="flex items-center space-x-1 font-bold">
              <User className="w-3.5 h-3.5 text-[#7c4e2f]" />
              <span>{cashierName}</span>
            </span>
          </div>
          {activeItemCount > 0 && (
            <span className="text-[11px] font-semibold text-[#8a6b53] bg-white px-2 py-0.5 rounded-md border border-[#ecdac5]">
              Keranjang aktif: {activeItemCount} item (Rp {activeCartTotal.toLocaleString('id-ID')})
            </span>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* Success Toast */}
          {successToast && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn shadow-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successToast}</span>
              </div>
              <span className="text-[10px] text-emerald-600 uppercase font-mono">Terkirim ✓</span>
            </div>
          )}

          {/* 1. Pilih Bagian Kendala */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
              1. Di bagian mana kendala terjadi?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-2.5 rounded-2xl text-xs font-bold flex items-center space-x-2 border transition-all text-left ${
                      isSelected
                        ? 'bg-[#7c4e2f] text-white border-[#59351e] shadow-md scale-[1.02]'
                        : 'bg-white hover:bg-[#faebd7]/50 text-[#543c2e] border-[#ebdccf]'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-200' : 'text-[#7c4e2f]'}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Template Cepat */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500">
              Template cepat (klik untuk mengisi pesan):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {currentTemplates.map((tpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessage(tpl)}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-[#faebd7] hover:text-[#7c4e2f] text-slate-600 text-[11px] font-medium transition-colors border border-slate-200/60"
                >
                  + {tpl}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Textarea Pesan Kasir */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                2. Jelaskan kendala yang terjadi:
              </label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contoh: Tadi saat scan kartu member karyawan, nama muncul tapi saldo tidak otomatis terpotong di customer display..."
                className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7c4e2f] focus:bg-white transition-all leading-relaxed"
              />
            </div>

            {/* Diagnostics Checkbox */}
            <div className="flex items-center space-x-2 text-xs text-slate-600 font-medium">
              <input
                type="checkbox"
                id="includeDiag"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                className="w-4 h-4 rounded text-[#7c4e2f] focus:ring-[#7c4e2f] border-slate-300"
              />
              <label htmlFor="includeDiag" className="cursor-pointer select-none">
                Lampirkan ringkasan data transaksi & status teknis kasir saat ini
              </label>
            </div>

            {/* Actions: Send to Superadmin & WhatsApp */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handleOpenWhatsAppSupport}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm"
              >
                <span>💬 Chat WhatsApp Support</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-md ${
                  !message.trim() || isSubmitting
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#7c4e2f] hover:bg-[#633e26] text-white shadow-[#7c4e2f]/20'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Mengirim...' : 'Kirim Laporan ke Superadmin'}</span>
              </button>
            </div>
          </form>

          {/* 4. Riwayat Laporan Terkirim Sesi Ini */}
          {sentReports.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Riwayat Laporan Kasir Sesi Ini:</span>
              </div>
              <div className="space-y-2">
                {sentReports.map((r) => (
                  <div key={r.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-[#7c4e2f]">[{r.category}]</span>
                      <div className="flex items-center space-x-1 text-emerald-600 font-bold">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Terkirim ke Superadmin • {r.time}</span>
                      </div>
                    </div>
                    <p className="text-slate-800 font-medium">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
