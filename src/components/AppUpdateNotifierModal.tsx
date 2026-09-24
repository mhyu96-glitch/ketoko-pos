import React from 'react';
import { Sparkles, Download, X, CheckCircle2, ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';
import type { AppVersionInfo } from '../services/updateService';

interface AppUpdateNotifierModalProps {
  isOpen: boolean;
  updateInfo: AppVersionInfo | null;
  onClose: () => void;
}

export const AppUpdateNotifierModal: React.FC<AppUpdateNotifierModalProps> = ({
  isOpen,
  updateInfo,
  onClose
}) => {
  if (!isOpen || !updateInfo || !updateInfo.hasUpdate) return null;

  const handleDownload = () => {
    if (updateInfo.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
        
        {/* Header Ribbon */}
        <div className="p-5 bg-gradient-to-r from-[#96633b] via-[#a6744c] to-[#83532e] text-white relative">
          {!updateInfo.isMandatory && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-[#faebd7] text-[#96633b] flex items-center justify-center shrink-0 shadow-md">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30 text-[10px] font-black uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3" />
                <span>Pembaruan Resmi</span>
              </div>
              <h3 className="text-base font-extrabold text-white mt-1 leading-tight">
                Versi Baru Tersedia!
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          
          {/* Version Pill Progression */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#e5d0be] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8a6b53] block">Versi Saat Ini</span>
              <span className="text-xs font-mono font-bold text-[#5c3c26]">v{updateInfo.currentVersion}</span>
            </div>
            
            <div className="flex items-center text-[#96633b]">
              <ArrowRight className="w-5 h-5" />
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#166534] block">Versi Terbaru</span>
              <span className="text-sm font-mono font-black text-[#166534] bg-[#edf5ee] px-2 py-0.5 rounded-lg border border-[#cce2cf]">
                v{updateInfo.latestVersion}
              </span>
            </div>
          </div>

          {/* Changelog Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <h4 className="font-extrabold text-[#3d2617] text-xs">Apa yang baru di versi ini:</h4>
              <span className="text-[10px] text-[#8a6b53] font-medium">{updateInfo.releaseDate}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#fbf5ee] border border-[#ddc3aa] space-y-2 max-h-40 overflow-y-auto text-xs text-[#5c3c26]">
              {updateInfo.changelog.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#166534] shrink-0 mt-0.5" />
                  <span className="leading-snug text-[11px] font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-[#8a6b53] text-center leading-relaxed">
            Database lokal produk, transaksi, dan pengaturan toko Anda akan tetap aman dan tidak terhapus selama pembaruan.
          </p>

        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-[#f5ebe0] border-t border-[#e5d0be] flex items-center justify-end gap-2.5">
          {!updateInfo.isMandatory && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#ebd7c5] text-[#5c3c26] text-xs font-bold border border-[#ddc3aa] transition-colors"
            >
              Nanti Saja
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#96633b] hover:bg-[#83532e] text-white text-xs font-extrabold flex items-center justify-center space-x-2 shadow-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Update Sekarang</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </button>
        </div>

      </div>
    </div>
  );
};

