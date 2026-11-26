import React, { useState, useEffect, useRef } from 'react';
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
  Download,
  Activity,
  MessageSquare,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import type { User } from '../types';
import { licenseService, type LicenseStatus } from '../services/licenseService';
import { lanService, type LanConfig } from '../services/lanService';
import { errorTracker } from '../services/errorTracker';

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
  onOpenErrorMonitoring?: () => void;
  onOpenHelpChat?: () => void;
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
  onOpenPWAInstall,
  onOpenErrorMonitoring,
  onOpenHelpChat
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN' || currentUser?.username?.toLowerCase() === 'superadmin';
  const isAdmin = isSuperAdmin || currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [errorCount, setErrorCount] = useState<number>(() => errorTracker.getUnresolvedCount());

  useEffect(() => {
    const unsub = errorTracker.subscribe(() => {
      setErrorCount(errorTracker.getUnresolvedCount());
    });
    return () => unsub();
  }, []);

  const [lanConfig, setLanConfig] = useState<LanConfig>(lanService.getConfig());
  const [isLanConnected, setIsLanConnected] = useState(true);

  // Close unified menu on outside click or Escape
  useEffect(() => {
    if (!isQuickMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setIsQuickMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsQuickMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isQuickMenuOpen]);

  // Secret Dev Trigger: 5 rapid clicks on logo to open Master Dev PIN prompt
  const logoClicksRef = useRef(0);
  const logoTimerRef = useRef<any>(null);

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
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen API error or not supported:', err);
    }
  };

  const badgeAlertCount = pendingSyncCount + (isSuperAdmin ? errorCount : 0);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#e4d5c7] shadow-xs select-none">
      <div className="w-full px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* 1. Branding & Branch ID */}
          <button
            type="button"
            onClick={handleLogoClick}
            title={
              isAdmin 
                ? "Klik untuk ubah Nama POS & Profil Toko (Klik 5x untuk Akses Superadmin Developer)" 
                : storeName
            }
            className={`flex items-center space-x-2.5 sm:space-x-3 shrink min-w-0 text-left group p-1 -ml-1 rounded-2xl transition-all ${
              isAdmin ? 'hover:bg-[#faebd7]/50 cursor-pointer' : 'cursor-pointer'
            }`}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#96633b] to-[#a6744c] text-white flex items-center justify-center shadow-sm shadow-[#96633b]/20 border border-[#83532e]/30 group-hover:scale-105 transition-transform overflow-hidden shrink-0">
              {storeLogo ? (
                <img src={storeLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-base font-black tracking-tight text-[#332219] leading-tight truncate max-w-[180px] sm:max-w-md md:max-w-lg lg:max-w-2xl">
                {storeName}
              </span>
              <span className="text-[10px] text-[#8a6b53] font-semibold truncate max-w-[180px] sm:max-w-md">
                {branchName}
              </span>
            </div>
          </button>

          {/* 2. Unified Clean Control Pill + Cart + Profile */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">

            {/* UNIFIED SYSTEM & QUICK TOOLS MENU (Menggabungkan Layar Penuh, Touchscreen, Online, PWA, Lapor Kendala & Sinkron Cloud jadi 1) */}
            <div className="relative" ref={quickMenuRef}>
              <button
                type="button"
                onClick={() => setIsQuickMenuOpen((prev) => !prev)}
                title="Panel Kontrol Kasir, Status Koneksi & Sinkronisasi Cloud"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs active:scale-95 ${
                  isQuickMenuOpen
                    ? 'bg-[#faebd7] text-[#332219] border-[#96633b]'
                    : 'bg-[#fdfaf7] hover:bg-[#faebd7]/70 text-[#332219] border-[#dfcebe]'
                }`}
              >
                {/* Live Online/Sync Indicator */}
                <span className="inline-flex items-center gap-1.5">
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#7c4e2f] animate-spin" />
                  ) : isOnline ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-500/25" />
                  )}
                  <span className={`font-extrabold ${isOnline ? 'text-emerald-800' : 'text-rose-700'}`}>
                    {isSyncing ? 'Sinkron...' : isOnline ? 'Online' : 'Offline'}
                  </span>
                </span>

                <span className="h-3.5 w-px bg-[#dfcebe] hidden sm:block" />

                <span className="hidden sm:inline-flex items-center gap-1.5 text-[#543c2e]">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#7c4e2f]" />
                  <span>Menu Sistem</span>
                </span>

                {badgeAlertCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-black">
                    {badgeAlertCount}
                  </span>
                )}

                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#8a6b53] transition-transform duration-200 ${
                    isQuickMenuOpen ? 'rotate-180 text-[#7c4e2f]' : ''
                  }`}
                />
              </button>

              {/* Floating Popover Control Center */}
              {isQuickMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-76 sm:w-80 bg-white border border-[#e4d5c7] rounded-2xl shadow-[0_18px_45px_-8px_rgba(25,18,12,0.2)] p-3 z-50 space-y-2.5 animate-fadeIn">
                  
                  {/* Cloud & Connection Card */}
                  <div className="p-3 rounded-xl bg-[#fcf9f5] border border-[#eed7c4] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-[#332219]">
                            {isOnline ? 'Terhubung ke Cloud' : simulatedOffline ? 'Mode Offline Simulasi' : 'Koneksi Terputus'}
                          </div>
                          <div className="text-[10px] text-[#8a6b53] font-medium">
                            {pendingSyncCount > 0 ? `${pendingSyncCount} antrean belum tersinkron` : 'Semua data tersinkronisasi'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onToggleOffline}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                          isOnline
                            ? 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                            : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {isOnline ? 'Set Offline' : 'Set Online'}
                      </button>
                    </div>

                    {onManualSync && (
                      <button
                        type="button"
                        onClick={() => {
                          onManualSync();
                          setIsQuickMenuOpen(false);
                        }}
                        disabled={!isOnline || isSyncing}
                        className="w-full py-2 px-3 rounded-xl bg-[#7c4e2f] hover:bg-[#633e26] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Menyinkronkan Data...' : 'Sinkronisasi Cloud Sekarang'}</span>
                        {pendingSyncCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-[#7c4e2f] font-black">
                            {pendingSyncCount}
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Display & Input Toggles */}
                  <div className="space-y-1">
                    <div className="px-2 pt-0.5 text-[10px] font-black uppercase tracking-wider text-[#8a6b53]">
                      Tampilan & Perangkat
                    </div>

                    {/* Fullscreen Toggle Row */}
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="w-full px-2.5 py-2 rounded-xl hover:bg-[#fcf5ed] flex items-center justify-between text-xs font-semibold text-[#332219] transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        {isFullscreen ? (
                          <Minimize className="w-4 h-4 text-[#7c4e2f]" />
                        ) : (
                          <Maximize className="w-4 h-4 text-[#7c4e2f]" />
                        )}
                        <span>Layar Penuh Monitor</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isFullscreen
                            ? 'bg-[#7c4e2f] text-white'
                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                      >
                        {isFullscreen ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    {/* Touchscreen Toggle Row */}
                    {onToggleTouchscreen && (
                      <button
                        type="button"
                        onClick={onToggleTouchscreen}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-[#fcf5ed] flex items-center justify-between text-xs font-semibold text-[#332219] transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Touchpad className="w-4 h-4 text-[#7c4e2f]" />
                          <span>Mode Touchscreen</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isTouchscreenMode
                              ? 'bg-[#7c4e2f] text-white'
                              : 'bg-stone-100 text-stone-600 border border-stone-200'
                          }`}
                        >
                          {isTouchscreenMode ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    )}

                    {/* Install PWA */}
                    {!isPWAInstalled && onOpenPWAInstall && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickMenuOpen(false);
                          onOpenPWAInstall();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-[#fcf5ed] flex items-center justify-between text-xs font-semibold text-[#332219] transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Download className="w-4 h-4 text-emerald-600" />
                          <span>Pasang Aplikasi (PWA)</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Install
                        </span>
                      </button>
                    )}

                    {/* Lapor Kendala / Help Chat */}
                    {onOpenHelpChat && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickMenuOpen(false);
                          onOpenHelpChat();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-[#fcf5ed] flex items-center justify-between text-xs font-semibold text-[#332219] transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                          <span>Lapor Kendala & Bantuan</span>
                        </span>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Chat
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Superadmin Section */}
                  {isSuperAdmin && (
                    <div className="pt-2 border-t border-[#f0e4d7] space-y-1">
                      <div className="px-2 text-[10px] font-black uppercase tracking-wider text-purple-700">
                        Developer & Superadmin
                      </div>

                      {onOpenErrorMonitoring && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsQuickMenuOpen(false);
                            onOpenErrorMonitoring();
                          }}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors"
                        >
                          <span className="flex items-center gap-2.5">
                            <Activity className={`w-4 h-4 ${errorCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                            <span>Monitoring Sistem</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            errorCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {errorCount > 0 ? `${errorCount} Eror` : 'Sehat'}
                          </span>
                        </button>
                      )}

                      {onOpenLanSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsQuickMenuOpen(false);
                            onOpenLanSettings();
                          }}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors"
                        >
                          <span className="flex items-center gap-2.5">
                            {lanConfig.mode === 'SERVER' ? (
                              <Server className="w-4 h-4 text-emerald-600" />
                            ) : lanConfig.mode === 'CLIENT' ? (
                              <Laptop className="w-4 h-4 text-sky-600" />
                            ) : (
                              <Network className="w-4 h-4 text-[#7c4e2f]" />
                            )}
                            <span>Jaringan Multi-Kasir (LAN)</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {lanConfig.mode === 'SERVER' ? 'Server' : lanConfig.mode === 'CLIENT' ? (isLanConnected ? 'Klien' : 'Putus') : 'Standby'}
                          </span>
                        </button>
                      )}

                      {licenseStatus && onOpenLicense && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsQuickMenuOpen(false);
                            onOpenLicense();
                          }}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors"
                        >
                          <span className="flex items-center gap-2.5">
                            {licenseStatus.isActivated ? (
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            ) : licenseStatus.isExpired ? (
                              <Lock className="w-4 h-4 text-rose-600" />
                            ) : (
                              <KeyRound className="w-4 h-4 text-amber-600" />
                            )}
                            <span>Lisensi Aplikasi</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800">
                            {licenseStatus.isActivated ? 'PRO' : licenseStatus.isExpired ? 'Habis' : `${licenseStatus.remainingTransactions} Nota`}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Cart Button */}
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
