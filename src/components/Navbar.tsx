import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag,
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Store, 
  ShieldCheck, 
  UserCheck, 
  LogOut, 
  Maximize, 
  Minimize,
  Touchpad,
  KeyRound,
  Lock,
  Network,
  Server,
  Laptop,
  Download
} from 'lucide-react';
import type { User } from '../types';
import { licenseService, type LicenseStatus } from '../services/licenseService';
import { lanService, type LanConfig } from '../services/lanService';

interface NavbarProps {
  cartCount: number;
  onToggleCart: () => void;
  pendingSyncCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  simulatedOffline: boolean;
  onToggleOffline: () => void;
  onManualSync: () => void;
  currentUser: User | null;
  onLogout: () => void;
  isTouchscreenMode?: boolean;
  onToggleTouchscreen?: () => void;
  storeName?: string;
  branchName?: string;
  storeLogo?: string;
  onOpenStoreSettings?: (tab?: 'profile' | 'theme' | 'csv' | 'backup' | 'users') => void;
  onOpenLicense?: () => void;
  onOpenLanSettings?: () => void;
  onSecretDevTrigger?: () => void;
  isPWAInstalled?: boolean;
  onOpenPWAInstall?: () => void;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  cartCount,
  onToggleCart,
  pendingSyncCount,
  isSyncing,
  isOnline,
  simulatedOffline,
  onToggleOffline,
  onManualSync,
  currentUser,
  onLogout,
  isTouchscreenMode = false,
  onToggleTouchscreen,
  storeName = 'CV. Tumbuh Makmur Air Conindo',
  branchName = 'Cabang Samarinda (BR-01)',
  storeLogo,
  onOpenStoreSettings,
  onOpenLicense,
  onOpenLanSettings,
  onSecretDevTrigger,
  isPWAInstalled = false,
  onOpenPWAInstall
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN' || currentUser?.username?.toLowerCase() === 'superadmin';
  const isAdmin = isSuperAdmin || currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);

  const [lanConfig, setLanConfig] = useState<LanConfig>(lanService.getConfig());
  const [isLanConnected, setIsLanConnected] = useState(true);

  // Secret Dev Trigger: 5 rapid clicks on logo to open Master Dev PIN prompt
  const logoClicksRef = React.useRef(0);
  const logoTimerRef = React.useRef<any>(null);

  const handleLogoClick = () => {
    logoClicksRef.current += 1;
    if (logoTimerRef.current) clearTimeout(logoTimerRef.current);
    logoTimerRef.current = setTimeout(() => {
      logoClicksRef.current = 0;
    }, 2000);

    if (logoClicksRef.current >= 5) {
      logoClicksRef.current = 0;
      onSecretDevTrigger?.();
      return;
    }

    if (isAdmin) {
      onOpenStoreSettings?.('profile');
    }
  };

  useEffect(() => {
    licenseService.getStatus().then(setLicenseStatus);
    const handleLicenseUpdated = () => {
      licenseService.getStatus().then(setLicenseStatus);
    };
    window.addEventListener('ketoko_license_updated', handleLicenseUpdated);
    return () => window.removeEventListener('ketoko_license_updated', handleLicenseUpdated);
  }, []);

  useEffect(() => {
    const handleLanUpdate = (e: any) => {
      setLanConfig(e.detail || lanService.getConfig());
    };
    const handleStatus = (e: any) => {
      setIsLanConnected(e.detail?.connected ?? true);
    };
    window.addEventListener('ketoko_lan_config_updated', handleLanUpdate);
    window.addEventListener('ketoko_lan_status_changed', handleStatus);
    return () => {
      window.removeEventListener('ketoko_lan_config_updated', handleLanUpdate);
      window.removeEventListener('ketoko_lan_status_changed', handleStatus);
    };
  }, []);

  // Sync fullscreen status with actual browser window state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen API error or not supported:', err);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#e4d5c7] shadow-xs select-none">
      <div className="w-full px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* 1. Branding & Branch ID (Clickable to Edit Store / POS Name for Admin Only, 5x click opens Master Dev PIN) */}
          <button
            type="button"
            onClick={handleLogoClick}
            title={
              isAdmin 
                ? "Klik untuk ubah Nama POS & Profil Toko (Klik 5x untuk Akses Superadmin Developer)" 
                : storeName
            }
            className={`flex items-center space-x-2 sm:space-x-3 shrink min-w-0 text-left group p-1 -ml-1 rounded-2xl transition-all ${
              isAdmin ? 'hover:bg-[#faebd7]/50 cursor-pointer' : 'cursor-pointer'
            }`}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#96633b] to-[#a6744c] text-white flex items-center justify-center shadow-sm shadow-[#96633b]/20 border border-[#83532e]/30 group-hover:scale-105 transition-transform overflow-hidden shrink-0">
              {storeLogo ? (
                <img src={storeLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-base font-black tracking-tight text-[#332219] leading-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs md:max-w-md">
                {storeName}
              </span>
              <span className="text-[9px] sm:text-[10px] text-[#8a6b53] font-semibold truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs">
                {branchName}
              </span>
            </div>
          </button>

          {/* 2. Action Tools: Layar Penuh, Touchscreen Mode, Online/Offline, Sync Queue, Cart, Role & Profile */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">

            {/* Tombol Layar Penuh (Desktop Only) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Keluar dari Layar Penuh (ESC)" : "Aktifkan Mode Layar Penuh Monitor POS"}
              className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 ${
                isFullscreen
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] ring-2 ring-[#7c4e2f]/20'
                  : 'bg-[#fdfaf7] hover:bg-[#faebd7] text-[#543c2e] border-[#dfcebe]'
              }`}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline">Layar Normal</span>
                </>
              ) : (
                <>
                  <Maximize className="w-3.5 h-3.5 text-[#7c4e2f]" />
                  <span className="hidden sm:inline">Layar Penuh</span>
                </>
              )}
            </button>

            {/* Mode Touchscreen Monitor Toggle Button (Desktop Only) */}
            {onToggleTouchscreen && (
              <button
                type="button"
                onClick={onToggleTouchscreen}
                title="Klik untuk Mengaktifkan / Menonaktifkan Mode Layar Sentuh Monitor Kasir"
                className={`hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 ${
                  isTouchscreenMode
                    ? 'bg-[#7c4e2f] hover:bg-[#633e26] text-white border-[#633e26] ring-2 ring-[#7c4e2f]/20'
                    : 'bg-[#fdfaf7] hover:bg-[#faebd7] text-[#543c2e] border-[#dfcebe]'
                }`}
              >
                <Touchpad className={`w-4 h-4 ${isTouchscreenMode ? 'text-amber-200 animate-pulse' : 'text-[#8a6b53]'}`} />
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold">Touchscreen:</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                    isTouchscreenMode ? 'bg-white text-[#7c4e2f] shadow-2xs' : 'bg-[#ebdccf] text-[#543c2e]'
                  }`}>
                    {isTouchscreenMode ? 'ON' : 'OFF'}
                  </span>
                </div>
              </button>
            )}

            {/* Online / Offline Simulator Toggle */}
            <button
              onClick={onToggleOffline}
              title={isOnline ? 'Online (Klik untuk simulasi offline)' : simulatedOffline ? 'Offline (Mode Simulasi)' : 'Offline (Tidak ada koneksi)'}
              className={`flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs ${
                isOnline
                  ? 'bg-[#edf5ee] text-[#166534] border-[#cce2cf] hover:bg-[#e1efe3]'
                  : 'bg-[#fdf3f2] text-[#991b1b] border-[#fecaca] hover:bg-[#fee2e2]'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-[#166534]" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-[#991b1b] animate-pulse" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </button>

            {/* Tombol Install PWA (Jika belum terpasang di HP / Desktop) */}
            {!isPWAInstalled && onOpenPWAInstall && (
              <button
                type="button"
                onClick={onOpenPWAInstall}
                title="Pasang Aplikasi Ketoko POS di Layar Utama (PWA Offline-First)"
                className="flex items-center space-x-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 active:scale-95 animate-fadeIn"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">Pasang PWA</span>
              </button>
            )}

            {/* Tombol Status LAN Multi-Kasir Terpusat & Cloud (HANYA UNTUK SUPERADMIN / DEVELOPER VENDOR) */}
            {isSuperAdmin && onOpenLanSettings && (
              <button
                type="button"
                onClick={onOpenLanSettings}
                title="Superadmin: Pengaturan Jaringan Multi-Kasir (LAN), Cloudflare Tunnel & Supabase Cloud"
                className={`flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 ${
                  lanConfig.mode === 'SERVER'
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                    : lanConfig.mode === 'CLIENT'
                      ? isLanConnected
                        ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                      : 'bg-[#fdfaf7] hover:bg-[#faebd7] text-[#543c2e] border-[#dfcebe]'
                }`}
              >
                {lanConfig.mode === 'SERVER' ? (
                  <>
                    <Server className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">LAN Server</span>
                  </>
                ) : lanConfig.mode === 'CLIENT' ? (
                  <>
                    <Laptop className="w-3.5 h-3.5 text-sky-600" />
                    <span className="hidden sm:inline">{isLanConnected ? 'Klien LAN' : 'LAN Putus'}</span>
                  </>
                ) : (
                  <>
                    <Network className="w-3.5 h-3.5 text-[#7c4e2f]" />
                    <span className="hidden sm:inline">LAN Kasir</span>
                  </>
                )}
              </button>
            )}

            {/* Sync Status Button */}
            {pendingSyncCount > 0 && (
              <button
                onClick={onManualSync}
                disabled={!isOnline || isSyncing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#faebd7] hover:bg-[#ebdccf] text-[#7c4e2f] border border-[#ddc3aa] font-bold text-xs shadow-2xs active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{pendingSyncCount} Sync</span>
              </button>
            )}


            {/* License Status Badge (HANYA UNTUK SUPERADMIN / DEVELOPER VENDOR) */}
            {isSuperAdmin && licenseStatus && (
              <button
                type="button"
                onClick={onOpenLicense}
                title="Status Lisensi & Aktivasi Aplikasi (Superadmin Developer)"
                className={`flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 ${
                  licenseStatus.isActivated
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    : licenseStatus.isExpired
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {licenseStatus.isActivated ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">PRO Lifetime</span>
                  </>
                ) : licenseStatus.isExpired ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    <span className="hidden sm:inline">Trial Habis</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span className="hidden sm:inline">Trial: {licenseStatus.remainingTransactions} Nota</span>
                  </>
                )}
              </button>
            )}

            {/* Cart Button with Coffee Tone & Amber Badge */}
            <button
              onClick={onToggleCart}
              title="Buka Keranjang Kasir"
              className="relative p-2 rounded-xl bg-[#7c4e2f] hover:bg-[#633e26] text-white transition-all shadow-sm active:scale-95 flex items-center justify-center border border-[#633e26]"
            >
              <ShoppingBag className="w-4 h-4 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-amber-400 text-[#332219] font-black text-[9px] rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
                  {cartCount}
                </span>
              )}
            </button>

            {/* User Profile & Role Info Badge with Logout */}
            <div className="flex items-center space-x-2 pl-2 sm:pl-3 border-l border-[#e4d5c7]">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-2xs ring-2 ring-[#eed7c4] ${
                  isSuperAdmin 
                    ? 'bg-gradient-to-br from-purple-700 to-indigo-800' 
                    : isAdmin 
                      ? 'bg-gradient-to-br from-[#6f4021] to-[#85532f]' 
                      : 'bg-[#8c5e3c]'
                }`}>
                  {isSuperAdmin ? <Server className="w-4 h-4 text-purple-200" /> : isAdmin ? <ShieldCheck className="w-4 h-4 text-amber-200" /> : <UserCheck className="w-4 h-4 text-white" />}
                </div>

                <div className="hidden md:flex flex-col text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-xs text-[#332219] leading-none">
                      {currentUser?.name || 'Kasir'}
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase border ${
                      isSuperAdmin 
                        ? 'bg-purple-100 text-purple-800 border-purple-200' 
                        : isAdmin 
                          ? 'bg-[#faebd7] text-[#7c4e2f] border-[#eed7c4]' 
                          : 'bg-stone-100 text-stone-700 border-stone-200'
                    }`}>
                      {currentUser?.role || 'KASIR'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#8a6b53] font-medium mt-0.5">
                    {isSuperAdmin ? 'Master Developer / Vendor' : isAdmin ? 'Owner Toko / Manajemen' : 'Khusus Kasir & POS'}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                title="Keluar / Ganti Akun"
                className="p-1.5 rounded-xl text-[#8a6b53] hover:text-rose-600 hover:bg-[#fdf3f2] border border-transparent hover:border-[#fecaca] transition-colors ml-1 active:scale-95"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
});
