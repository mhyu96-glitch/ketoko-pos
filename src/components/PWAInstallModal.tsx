import React from 'react';
import { 
  X, 
  Download, 
  Smartphone, 
  Monitor, 
  Zap, 
  WifiOff, 
  CheckCircle2, 
  Share, 
  PlusSquare,
  ArrowRight
} from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => Promise<boolean>;
  isInstallable: boolean;
  isIOS: boolean;
  isInstalled: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  onInstall,
  isInstallable,
  isIOS,
  isInstalled
}) => {
  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await onInstall();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] via-[#85532f] to-[#6f4021] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-1.5 shadow-inner">
              <img src="/icon.svg" alt="Ketoko POS" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight tracking-tight text-white">
                Pasang Ketoko POS (PWA)
              </h3>
              <p className="text-xs text-[#fcefe3]/90 font-medium">
                Install di HP, Tablet, atau Komputer Desktop
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#fcefe3] hover:text-white hover:bg-black/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-[#fcf9f5]">
          
          {isInstalled ? (
            <div className="p-4 rounded-2xl bg-[#edf5ee] border border-[#cce2cf] text-[#166534] text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-[#166534]" />
              <div className="font-bold text-sm">Ketoko POS Sudah Terpasang!</div>
              <p className="text-[11px] text-[#2e5e3b]">
                Aplikasi sudah terinstal di perangkat Anda dalam mode Standalone. Anda dapat membukanya langsung dari layar utama atau daftar aplikasi.
              </p>
            </div>
          ) : (
            <>
              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-white border border-[#e5d0be] shadow-2xs space-y-1">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-1">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-[#3d2617] text-[11px]">Buka Instan</div>
                  <div className="text-[10px] text-[#8a6b53] leading-tight">Langsung dari ikon layar utama tanpa buka browser dulu</div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-[#e5d0be] shadow-2xs space-y-1">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-1">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-[#3d2617] text-[11px]">Tetap Jalan Offline</div>
                  <div className="text-[10px] text-[#8a6b53] leading-tight">Kasir tetap bisa jualan meski internet mati atau sinyal lemah</div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-[#e5d0be] shadow-2xs space-y-1">
                  <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center mb-1">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-[#3d2617] text-[11px]">Tampilan Layar Penuh</div>
                  <div className="text-[10px] text-[#8a6b53] leading-tight">Bebas bilah alamat browser, mirip software kasir profesional</div>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-[#e5d0be] shadow-2xs space-y-1">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center mb-1">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-[#3d2617] text-[11px]">Ringan & Cepat</div>
                  <div className="text-[10px] text-[#8a6b53] leading-tight">Hanya menggunakan sedikit memori dibanding aplikasi toko biasa</div>
                </div>
              </div>

              {/* Instructions based on platform */}
              {isIOS ? (
                <div className="p-3.5 bg-white rounded-2xl border border-[#ddc3aa] space-y-2">
                  <div className="font-bold text-[#5c3c26] flex items-center space-x-1.5 text-xs">
                    <Smartphone className="w-4 h-4 text-[#96633b]" />
                    <span>Petunjuk Pemasangan di iPhone / iPad (Safari):</span>
                  </div>
                  <ol className="space-y-2 pl-1 text-[11px] text-[#543c2e]">
                    <li className="flex items-start space-x-2">
                      <span className="font-bold text-[#96633b]">1.</span>
                      <span>Ketuk tombol <b>Bagikan (Share)</b> <Share className="w-3.5 h-3.5 inline text-sky-600 mx-0.5" /> di bilah bawah browser Safari.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="font-bold text-[#96633b]">2.</span>
                      <span>Gulir ke bawah dan ketuk opsi <b>"Tambah ke Layar Utama" (Add to Home Screen)</b> <PlusSquare className="w-3.5 h-3.5 inline text-stone-700 mx-0.5" />.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="font-bold text-[#96633b]">3.</span>
                      <span>Ketuk tombol <b>"Tambah" (Add)</b> di sudut kanan atas. Selesai!</span>
                    </li>
                  </ol>
                </div>
              ) : !isInstallable ? (
                <div className="p-3.5 bg-[#f5ede3] rounded-2xl border border-[#ddc3aa] space-y-2">
                  <div className="font-bold text-[#5c3c26] text-xs">
                    Petunjuk Pemasangan di Chrome / Edge / Browser Lain:
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-[#543c2e]">
                    <li className="flex items-center space-x-1.5">
                      <ArrowRight className="w-3 h-3 text-[#96633b] shrink-0" />
                      <span>Klik ikon <b>Pasang / Install</b> <Download className="w-3.5 h-3.5 inline text-[#166534] mx-0.5" /> di bilah alamat browser (URL bar).</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <ArrowRight className="w-3 h-3 text-[#96633b] shrink-0" />
                      <span>Atau buka menu titik tiga <b>(⋮)</b> di kanan atas &gt; pilih <b>"Pasang Ketoko POS"</b> / <b>"Install app"</b>.</span>
                    </li>
                  </ul>
                </div>
              ) : null}
            </>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-[#e5d0be] flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#ddc3aa] bg-[#fcf9f5] hover:bg-[#faebd7] text-[#5c3c26] font-bold text-xs transition-colors"
          >
            {isInstalled ? 'Tutup' : 'Nanti Saja'}
          </button>

          {!isInstalled && isInstallable && (
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 px-4 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-800/20 flex items-center justify-center space-x-2 transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span>Pasang Sekarang (Install)</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
