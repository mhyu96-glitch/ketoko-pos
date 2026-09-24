import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Store, 
  MessageSquare,
  Sparkles,
  Lock
} from 'lucide-react';
import { licenseService, type LicenseStatus } from '../services/licenseService';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  developerWhatsApp?: string;
  onActivated?: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  developerWhatsApp = '6281234567890',
  onActivated
}) => {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [storeNameInput, setStoreNameInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [activationMessage, setActivationMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const loadStatus = async () => {
    const s = await licenseService.getStatus();
    setStatus(s);
    if (s.registeredStoreName) {
      setStoreNameInput(s.registeredStoreName);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setActivationMessage(null);
    }
  }, [isOpen]);

  if (!isOpen || !status) return null;

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(status.machineId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleActivate = () => {
    if (!keyInput.trim()) {
      setActivationMessage({ success: false, text: 'Silakan masukkan Kunci Lisensi (Serial Key) terlebih dahulu.' });
      return;
    }

    const res = licenseService.activate(keyInput, storeNameInput);
    if (res.success) {
      setActivationMessage({ success: true, text: res.message });
      loadStatus();
      onActivated?.();
    } else {
      setActivationMessage({ success: false, text: res.message });
    }
  };

  const handleWhatsAppOrder = () => {
    const cleanPhone = developerWhatsApp.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Halo Developer Ketoko POS,\nSaya ingin melakukan aktivasi lisensi resmi aplikasi kasir.\n\n` +
      `🏪 Nama Toko: ${storeNameInput || 'Toko Saya'}\n` +
      `📌 Kode Mesin: ${status.machineId}\n\n` +
      `Mohon dibantu pembuatan Serial Key aktivasi. Terima kasih!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c] shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight text-white">Lisensi & Aktivasi Aplikasi</h3>
              <p className="text-xs text-[#fcefe3] font-medium">Status lisensi resmi & registrasi perangkat kasir</p>
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
          
          {/* Status Banner */}
          {status.isActivated ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1 shadow-xs">
              <div className="flex items-center space-x-2 font-black text-sm text-emerald-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Lisensi Resmi: AKTIF (PRO Unlimited)</span>
              </div>
              <p className="text-xs text-emerald-700">
                Aplikasi telah diaktivasi seumur hidup (Lifetime) untuk perangkat ini. Semua fitur kasir, laporan, dan backup tidak terbatas.
              </p>
              {status.registeredStoreName && (
                <div className="text-[11px] font-mono pt-1 text-emerald-800">
                  Terdaftar atas nama: <b>{status.registeredStoreName}</b>
                </div>
              )}
            </div>
          ) : status.isExpired ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 space-y-1 shadow-xs animate-pulse">
              <div className="flex items-center space-x-2 font-black text-sm text-rose-800">
                <Lock className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Masa Coba (Trial) Telah Berakhir</span>
              </div>
              <p className="text-xs text-rose-700">
                Batas kuota trial (50 transaksi / 14 hari) telah habis. Silakan masukkan Serial Key resmi untuk membuka akses penuh kasir.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1 shadow-xs">
              <div className="flex items-center space-x-2 font-black text-sm text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Mode Trial / Masa Coba Aktif</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-amber-800">Sisa Kuota Transaksi:</span>
                <span className="font-mono font-black text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md">
                  {status.remainingTransactions} Nota
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-800">Sisa Waktu Trial:</span>
                <span className="font-mono font-black text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md">
                  {status.remainingDays} Hari
                </span>
              </div>
            </div>
          )}

          {/* Machine ID Box */}
          <div className="bg-white p-4 rounded-3xl border border-[#e5d0be] shadow-xs space-y-2">
            <label className="block text-xs font-bold text-[#5c3c26]">
              ID Mesin / Kode Perangkat Komputer Ini:
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={status.machineId}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf7f2] border border-[#ddc3aa] text-xs font-mono font-bold text-[#3d2617] tracking-wider select-all"
              />
              <button
                type="button"
                onClick={handleCopyMachineId}
                className="px-3.5 py-2.5 rounded-xl bg-[#faebd7] hover:bg-[#ebdccf] text-[#7c4e2f] border border-[#ddc3aa] font-bold text-xs flex items-center space-x-1.5 shrink-0 transition-all active:scale-95"
              >
                {copiedId ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#7c4e2f]" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-[#8a6b53]">
              Kirimkan Kode Mesin ini kepada penjual/developer untuk mendapatkan Kunci Lisensi resmi.
            </p>
          </div>

          {/* Activation Form */}
          {!status.isActivated && (
            <div className="bg-white p-4 rounded-3xl border border-[#e5d0be] shadow-xs space-y-3">
              <div className="flex items-center space-x-2 border-b border-[#f2e5d8] pb-2">
                <Sparkles className="w-4 h-4 text-[#96633b]" />
                <h4 className="font-extrabold text-xs text-[#3d2617]">Formulir Aktivasi Lisensi</h4>
              </div>

              {/* Store Name Input */}
              <div>
                <label className="block text-[11px] font-bold text-[#5c3c26] mb-1 flex items-center space-x-1">
                  <Store className="w-3.5 h-3.5 text-[#96633b]" />
                  <span>Nama Toko / Usaha:</span>
                </label>
                <input
                  type="text"
                  value={storeNameInput}
                  onChange={(e) => setStoreNameInput(e.target.value)}
                  placeholder="Contoh: Minimarket Berkah"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#fdfaf7] border border-[#ddc3aa] text-xs font-bold text-[#3d2617] focus:outline-none focus:ring-2 focus:ring-[#96633b]"
                />
              </div>

              {/* License Key Input */}
              <div>
                <label className="block text-[11px] font-bold text-[#5c3c26] mb-1 flex items-center space-x-1">
                  <KeyRound className="w-3.5 h-3.5 text-[#96633b]" />
                  <span>Kunci Lisensi (Serial Key):</span>
                </label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  placeholder="ACT-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#fdfaf7] border border-[#ddc3aa] text-xs font-mono font-bold tracking-wider text-[#3d2617] focus:outline-none focus:ring-2 focus:ring-[#96633b]"
                />
              </div>

              {/* Notification Message */}
              {activationMessage && (
                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center space-x-2 ${
                  activationMessage.success 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  {activationMessage.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{activationMessage.text}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleActivate}
                  className="w-full py-3 bg-[#96633b] hover:bg-[#83532e] text-white font-black text-xs rounded-2xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center space-x-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-200" />
                  <span>Aktivasi dengan Serial Key Manual</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setActivationMessage({ success: true, text: 'Melakukan handshake ke Cloud Supabase...' });
                    const res = await licenseService.syncHybridLicenseWithCloud();
                    if (res.autoActivated) {
                      setActivationMessage({ success: true, text: res.message });
                      loadStatus();
                      onActivated?.();
                    } else {
                      setActivationMessage({ success: false, text: 'Belum ada approval lisensi di Cloud untuk Machine ID ini. Silakan hubungi Vendor atau masukkan Serial Key.' });
                    }
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-2xl shadow-xs transition-all active:scale-[0.98] flex items-center justify-center space-x-1.5"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>⚡ Cek Aktivasi Otomatis (Cloud Hybrid)</span>
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp Fast Order Button */}
          <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="font-bold text-xs text-emerald-950">Belum memiliki Kunci Lisensi?</div>
              <div className="text-[10px] text-emerald-700 mt-0.5">Hubungi penjual untuk pembelian & aktivasi instan via WhatsApp.</div>
            </div>
            <button
              type="button"
              onClick={handleWhatsAppOrder}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs shrink-0 flex items-center space-x-1.5 transition-all active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Aktivasi via WhatsApp</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
