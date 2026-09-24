import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface PWAInstallBannerProps {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onOpenModal: () => void;
  onInstall: () => Promise<boolean>;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  isInstallable,
  isInstalled,
  isIOS,
  onOpenModal,
  onInstall
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // If already installed, don't show
    if (isInstalled) {
      setIsVisible(false);
      return;
    }

    // Check if dismissed recently
    const dismissedTime = localStorage.getItem('ketoko_pwa_banner_dismissed');
    if (dismissedTime) {
      const parsed = Number(dismissedTime);
      // Suppress for 3 days
      if (Date.now() - parsed < 3 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Show banner after 2.5 seconds if installable or iOS
    const timer = setTimeout(() => {
      if (isInstallable || isIOS) {
        setIsVisible(true);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled, isIOS]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('ketoko_pwa_banner_dismissed', Date.now().toString());
  };

  const handleAction = async () => {
    if (isInstallable) {
      const success = await onInstall();
      if (success) {
        setIsVisible(false);
      }
    } else {
      onOpenModal();
    }
  };

  if (!isVisible || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-slideUp">
      <div className="bg-[#3d2617] text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-[#7c4e2f] flex items-center justify-between gap-3 backdrop-blur-md">
        
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#96633b] to-[#633e26] p-1.5 shrink-0 flex items-center justify-center border border-amber-300/30 shadow-xs">
            <img src="/icon.svg" alt="Ketoko POS" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-xs sm:text-sm text-white leading-tight truncate">
              Pasang Ketoko POS (PWA)
            </h4>
            <p className="text-[10.5px] text-[#fcefe3]/80 leading-tight truncate mt-0.5">
              Buka cepat dari layar utama & akses offline
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={handleAction}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-900/30 flex items-center space-x-1 transition-all active:scale-95 whitespace-nowrap"
          >
            {isInstallable ? <Download className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
            <span>Pasang</span>
          </button>

          <button
            onClick={handleDismiss}
            title="Tutup banner"
            className="p-1.5 rounded-xl text-[#fcefe3]/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
