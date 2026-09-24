import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Store, 
  KeyRound, 
  Database, 
  Network, 
  Smartphone, 
  Monitor, 
  Server, 
  ExternalLink, 
  Plus, 
  Copy, 
  Check, 
  Sparkles,
  LogOut,
  Users,
  CheckCircle2,
  Settings
} from 'lucide-react';
import type { User } from '../types';
import { generateSuperAdminKey } from '../services/licenseService';

interface SuperadminPortalViewProps {
  currentUser: User;
  onLogout: () => void;
  onEnterStorePos: () => void;
  onOpenLanModal: () => void;
  onOpenLicenseModal: () => void;
}

export const SuperadminPortalView: React.FC<SuperadminPortalViewProps> = ({
  currentUser,
  onLogout,
  onEnterStorePos,
  onOpenLanModal,
  onOpenLicenseModal
}) => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'keygen' | 'topology' | 'cloud'>('tenants');

  // Generator Lisensi State
  const [targetStoreName, setTargetStoreName] = useState('CV. Tumbuh Makmur Air Conindo');
  const [targetMachineId, setTargetMachineId] = useState('');
  const [targetPlan, setTargetPlan] = useState<'PRO_LIFETIME' | 'ENTERPRISE_1Y' | 'MULTI_BRANCH'>('PRO_LIFETIME');
  const [generatedKey, setGeneratedKey] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // New Client Store Modal
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [newStoreForm, setNewStoreForm] = useState({
    name: '',
    ownerName: '',
    phone: '',
    subdomain: '',
    branchId: 'BR-02'
  });
  const [registeredStores, setRegisteredStores] = useState([
    {
      id: 'store-01',
      name: 'CV. Tumbuh Makmur Air Conindo',
      branch: 'Cabang Samarinda (BR-01)',
      onlineDomain: 'https://tumbuhmakmur.ketokopos.online',
      localServer: 'http://localhost:5858',
      licensePlan: 'PRO LIFETIME (Aktif)',
      adminUser: 'suciawati (Owner)',
      cashierUser: 'noor (Kasir Toko)',
      productsCount: '24.531 Produk Ready',
      status: 'ONLINE'
    }
  ]);

  const handleGenerateKey = () => {
    const key = generateSuperAdminKey(
      targetMachineId.trim() || 'KTK-POS-TM-2026',
      targetStoreName.trim(),
      targetPlan
    );
    setGeneratedKey(key);
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreForm.name.trim()) return;

    setRegisteredStores(prev => [
      ...prev,
      {
        id: `store-0${prev.length + 1}`,
        name: newStoreForm.name,
        branch: `${newStoreForm.name} (${newStoreForm.branchId})`,
        onlineDomain: newStoreForm.subdomain ? `https://${newStoreForm.subdomain}.ketokopos.online` : 'Belum diatur',
        localServer: 'http://localhost:5858',
        licensePlan: 'PRO LIFETIME (Aktif)',
        adminUser: `${newStoreForm.ownerName || 'admin'} (Owner)`,
        cashierUser: 'kasir (Kasir Toko)',
        productsCount: 'Siap Digunakan',
        status: 'ONLINE'
      }
    ]);

    setNewStoreForm({
      name: '',
      ownerName: '',
      phone: '',
      subdomain: '',
      branchId: `BR-0${registeredStores.length + 2}`
    });
    setIsNewStoreModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#200d04] via-[#3a1b0b] to-[#1a0a03] text-stone-100 flex flex-col font-sans select-none">
      
      {/* 1. TOP HEADER BRANDING SUPERADMIN */}
      <header className="border-b border-[#5e321b] bg-[#2a1307]/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-amber-500 to-amber-300 p-0.5 shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-[#200d04] rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Ketoko POS <span className="text-amber-400 font-extrabold text-xs uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">Vendor Hub</span>
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40">
                MASTER SUPERADMIN
              </span>
            </div>
            <p className="text-[11px] text-stone-400 font-medium">
              {currentUser.name} • Pusat Kontrol Pengembang, Manajemen Klien Toko & Lisensi
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Quick Enter Store POS Simulation */}
          <button
            type="button"
            onClick={onEnterStorePos}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-extrabold text-xs flex items-center space-x-2 shadow-lg transition-all active:scale-95"
            title="Buka Kasir POS Toko CV. Tumbuh Makmur untuk mencoba transaksi / inspeksi"
          >
            <Monitor className="w-4 h-4 text-amber-200" />
            <span>Buka Kasir POS Toko</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl bg-[#442211] hover:bg-rose-950/70 text-stone-300 hover:text-rose-200 border border-[#6b381d] transition-all"
            title="Keluar dari Akun Superadmin"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. SUB-BANNER VENDOR STATUS CARDS */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          {/* Card 1: Lisensi Vendor */}
          <div className="p-4 rounded-2xl bg-[#32170a]/90 border border-[#63331b] shadow-md flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Status Lisensi Vendor</div>
              <div className="text-sm font-black text-emerald-300">MASTER UNLIMITED</div>
              <div className="text-[10px] text-stone-400">Bebas Transaksi & Tanpa Batas</div>
            </div>
          </div>

          {/* Card 2: Toko Terdaftar */}
          <div className="p-4 rounded-2xl bg-[#32170a]/90 border border-[#63331b] shadow-md flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Klien Toko Aktif</div>
              <div className="text-sm font-black text-white">{registeredStores.length} Toko Terdaftar</div>
              <div className="text-[10px] text-amber-300">CV. Tumbuh Makmur (Aktif)</div>
            </div>
          </div>

          {/* Card 3: Cloud Database (Supabase) */}
          <div className="p-4 rounded-2xl bg-[#32170a]/90 border border-[#63331b] shadow-md flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Cloud Database (Supabase)</div>
              <div className="text-sm font-black text-sky-300">24.531 Produk Ready</div>
              <div className="text-[10px] text-stone-400">quhjgsoqjcumckoshjtv</div>
            </div>
          </div>

          {/* Card 4: Multi-Kasir LAN Server */}
          <div className="p-4 rounded-2xl bg-[#32170a]/90 border border-[#63331b] shadow-md flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Arsitektur Multi-Kasir</div>
              <div className="text-sm font-black text-purple-300">1 Server + 4 Klien</div>
              <div className="text-[10px] text-stone-400">Port 5858 + Cloudflare Live</div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 mt-6">
        <div className="flex items-center space-x-2 border-b border-[#542a15] pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shrink-0 ${
              activeTab === 'tenants'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-[#3d1c0c]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Daftar Klien / Toko Terdaftar ({registeredStores.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('topology')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shrink-0 ${
              activeTab === 'topology'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-[#3d1c0c]'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Topologi Jaringan (1 Server + 4 Klien & HP)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('keygen')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shrink-0 ${
              activeTab === 'keygen'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-[#3d1c0c]'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Pusat Generator Serial Key Lisensi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shrink-0 ${
              activeTab === 'cloud'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-[#3d1c0c]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Status Supabase & Cloudflare</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN BODY VIEW */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex-1">
        
        {/* TAB 1: DAFTAR KLIEN TOKO */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">Daftar Toko / Usaha Klien (Tenants)</h2>
                <p className="text-xs text-stone-400">
                  Kelola toko yang membeli software Ketoko POS. Setiap toko memiliki database, subdomain, dan lisensi tersendiri.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewStoreModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs flex items-center space-x-2 shadow-lg transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Daftarkan Klien / Toko Baru</span>
              </button>
            </div>

            {/* Store Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredStores.map(store => (
                <div 
                  key={store.id} 
                  className="rounded-3xl bg-[#2e1509] border border-[#5c2e17] p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-amber-600/50 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase mb-1.5">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{store.status}</span>
                        </div>
                        <h3 className="text-base font-black text-white">{store.name}</h3>
                        <p className="text-xs text-stone-400 font-medium">{store.branch}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-extrabold text-amber-300 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 block">
                          {store.licensePlan}
                        </span>
                      </div>
                    </div>

                    {/* Detail Items */}
                    <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#4d2511] text-xs">
                      <div>
                        <span className="text-stone-500 text-[10px] block">Akses Online (Cloudflare):</span>
                        <a 
                          href={store.onlineDomain} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="font-bold text-sky-400 hover:text-sky-300 truncate block flex items-center space-x-1"
                        >
                          <span className="truncate">{store.onlineDomain}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                      <div>
                        <span className="text-stone-500 text-[10px] block">Database Master:</span>
                        <span className="font-bold text-emerald-300">{store.productsCount}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 text-[10px] block">Owner / Admin:</span>
                        <span className="font-bold text-stone-200">{store.adminUser}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 text-[10px] block">Akun Kasir Toko:</span>
                        <span className="font-bold text-stone-200">{store.cashierUser}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this store */}
                  <div className="pt-3 border-t border-[#4d2511] flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onEnterStorePos}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center space-x-1.5 shadow-md transition-all active:scale-95"
                    >
                      <Monitor className="w-4 h-4 text-amber-200" />
                      <span>Masuk ke POS Toko Ini</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenLanModal}
                      className="py-2.5 px-3 rounded-xl bg-[#442110] hover:bg-[#592b15] text-stone-200 font-bold text-xs flex items-center space-x-1.5 border border-[#6b381d] transition-all"
                      title="Pengaturan Jaringan LAN & Cloud Toko"
                    >
                      <Network className="w-4 h-4 text-purple-300" />
                      <span>Jaringan</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenLicenseModal}
                      className="py-2.5 px-3 rounded-xl bg-[#442110] hover:bg-[#592b15] text-stone-200 font-bold text-xs flex items-center space-x-1.5 border border-[#6b381d] transition-all"
                      title="Kelola Lisensi Toko"
                    >
                      <KeyRound className="w-4 h-4 text-amber-300" />
                      <span>Lisensi</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: TOPOLOGI JARINGAN (1 SERVER + 4 KLIEN + HP) */}
        {activeTab === 'topology' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-amber-400" />
                <span>Arsitektur Jaringan: 1 Server Pusat + 4 Klien Kasir & Akses HP Online</span>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Berikut adalah skema praktis dan panduan bagaimana sistem Ketoko POS bekerja dalam satu jaringan toko (LAN/Wi-Fi) serta terhubung online ke HP lewat Cloudflare.
              </p>
            </div>

            {/* Visual Diagram */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Kolom 1: Komputer Server Pusat */}
              <div className="p-5 rounded-3xl bg-gradient-to-b from-[#3a1b0b] to-[#250f04] border-2 border-amber-500/50 shadow-xl flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-stone-950">
                    KOMPUTER 1 (SERVER PUSAT)
                  </span>
                  <Server className="w-5 h-5 text-amber-400" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-white">Server Database Toko</h3>
                  <p className="text-xs text-stone-300 mt-1">
                    Komputer utama toko yang menyala sepanjang jam operasional kasir.
                  </p>
                </div>

                <div className="space-y-2 text-xs bg-[#1f0b02] p-3 rounded-2xl border border-[#4d2511]">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Mode Sistem:</span>
                    <span className="font-bold text-amber-300">SERVER (Port 5858)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Alamat LAN Toko:</span>
                    <span className="font-bold text-emerald-300 font-mono">http://192.168.1.X:5858</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Aplikasi Desktop:</span>
                    <span className="font-bold text-stone-200">Ketoko POS Desktop</span>
                  </div>
                </div>

                <div className="text-[11px] text-amber-200 bg-amber-950/40 p-3 rounded-xl border border-amber-800/30">
                  💡 <strong>Tugas:</strong> Menyimpan seluruh data 24.500 produk, memproses transaksi secara realtime, dan memotong stok otomatis untuk semua kasir.
                </div>
              </div>

              {/* Kolom 2: 4 Komputer Klien Kasir */}
              <div className="p-5 rounded-3xl bg-gradient-to-b from-[#2e1509] to-[#1c0b03] border border-[#5c2e17] shadow-xl flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    KOMPUTER 2, 3, 4, 5 (4 KASIR KLIEN)
                  </span>
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-white">Terminal Kasir Meja</h3>
                  <p className="text-xs text-stone-300 mt-1">
                    4 Komputer kasir yang berada di meja kasir toko, terhubung ke Wi-Fi / kabel LAN yang sama.
                  </p>
                </div>

                <div className="space-y-2 text-xs bg-[#1f0b02] p-3 rounded-2xl border border-[#4d2511]">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Mode Sistem:</span>
                    <span className="font-bold text-purple-300">CLIENT (Klien LAN)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Akses:</span>
                    <span className="font-bold text-stone-200">Desktop / Google Chrome</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Akun Kasir:</span>
                    <span className="font-bold text-amber-300">noor / kasir1 / kasir2</span>
                  </div>
                </div>

                <div className="text-[11px] text-purple-200 bg-purple-950/40 p-3 rounded-xl border border-purple-800/30">
                  💡 <strong>Cara Pakai:</strong> Buka Ketoko POS Desktop di PC Klien (atau buka Chrome ke <code className="font-mono bg-black/40 px-1 rounded">http://IP-SERVER:5858</code>), kasir langsung bisa scan barcode & cetak nota!
                </div>
              </div>

              {/* Kolom 3: HP / Tablet Online via Cloudflare */}
              <div className="p-5 rounded-3xl bg-gradient-to-b from-[#2e1509] to-[#1c0b03] border border-[#5c2e17] shadow-xl flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-sky-500/30 text-sky-200 border border-sky-400/30">
                    HP / TABLET (ONLINE DI MANAPUN)
                  </span>
                  <Smartphone className="w-5 h-5 text-sky-400" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-white">Owner & Kasir Mobile</h3>
                  <p className="text-xs text-stone-300 mt-1">
                    Bisa diakses dari HP android/iPhone dari luar kota atau di perjalanan tanpa kabel LAN.
                  </p>
                </div>

                <div className="space-y-2 text-xs bg-[#1f0b02] p-3 rounded-2xl border border-[#4d2511]">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Jalur Akses:</span>
                    <span className="font-bold text-sky-300">Cloudflare Pages & Tunnel</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Domain Resmi:</span>
                    <span className="font-bold text-amber-300 font-mono text-[10px]">tumbuhmakmur.ketokopos.online</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Cloud Sync:</span>
                    <span className="font-bold text-emerald-300">Supabase Cloud Live</span>
                  </div>
                </div>

                <div className="text-[11px] text-sky-200 bg-sky-950/40 p-3 rounded-xl border border-sky-800/30">
                  💡 <strong>Keuntungan:</strong> Owner bisa memantau omzet toko dan laporan penjualan langsung dari HP secara live dari rumah.
                </div>
              </div>

            </div>

            {/* Quick Action to LAN Modal */}
            <div className="p-4 rounded-2xl bg-[#32170a] border border-[#5c2e17] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-white">Ingin Mengatur IP Server atau Cloudflare Tunnel Sekarang?</h4>
                <p className="text-[11px] text-stone-400">Buka panel konfigurasi LAN & Supabase untuk melihat alamat IP server toko Anda saat ini.</p>
              </div>
              <button
                type="button"
                onClick={onOpenLanModal}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center space-x-1.5 shadow-md transition-all shrink-0 active:scale-95"
              >
                <Network className="w-4 h-4" />
                <span>Buka Pengaturan Jaringan LAN Toko</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: GENERATOR SERIAL KEY LISENSI */}
        {activeTab === 'keygen' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>Pusat Pembuatan Serial Key Lisensi Klien</span>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Gunakan alat ini untuk membuat Kunci Lisensi Resmi bagi toko pembeli aplikasi Ketoko POS. Kunci ini dimasukkan pada layar aktivasi komputer klien.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#2e1509] border border-[#5c2e17] shadow-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Nama Toko / Usaha Pembeli:
                </label>
                <input
                  type="text"
                  value={targetStoreName}
                  onChange={(e) => setTargetStoreName(e.target.value)}
                  placeholder="Contoh: CV. Tumbuh Makmur Air Conindo"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1c0b03] border border-[#5c2e17] text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Kode Mesin Komputer Klien (Machine ID):
                </label>
                <input
                  type="text"
                  value={targetMachineId}
                  onChange={(e) => setTargetMachineId(e.target.value)}
                  placeholder="Contoh: KPOS-7E3A-9F2B-XXXX (Didapat dari layar aktivasi klien)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1c0b03] border border-[#5c2e17] text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  *Kosongkan jika ingin membuat lisensi umum berbasis nama toko saja.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Paket Lisensi:
                </label>
                <select
                  value={targetPlan}
                  onChange={(e) => setTargetPlan(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1c0b03] border border-[#5c2e17] text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="PRO_LIFETIME">PRO LIFETIME — Permanen Selamanya (Rekomendasi Jual)</option>
                  <option value="ENTERPRISE_1Y">ENTERPRISE 1 TAHUN — Langganan Tahunan</option>
                  <option value="MULTI_BRANCH">MULTI-CABANG ENTERPRISE — Paket Banyak Cabang</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateKey}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>GENERATE SERIAL KEY LISENSI RESMI</span>
              </button>

              {/* Generated Result */}
              {generatedKey && (
                <div className="mt-4 p-4 rounded-2xl bg-[#1c0b03] border-2 border-emerald-500/50 space-y-3 animate-smooth-modal">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-400">
                      ✔ Kunci Lisensi Berhasil Dibuat
                    </span>
                    <span className="text-[10px] text-stone-400">{targetPlan}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedKey}
                      className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-emerald-500/30 text-emerald-300 font-mono font-black text-sm tracking-wider select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all"
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{isCopied ? 'Tersalin!' : 'Salin'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-stone-300 flex items-center justify-between pt-1 border-t border-[#3d1908]">
                    <span>Kirimkan kunci ini ke WhatsApp pemilik toko pembeli.</span>
                    <button
                      type="button"
                      onClick={() => {
                        const text = encodeURIComponent(
                          `Halo ${targetStoreName},\nBerikut adalah Kunci Lisensi Resmi Aplikasi Ketoko POS Anda:\n\n` +
                          `🔑 KUNCI LISENSI: ${generatedKey}\n` +
                          `🏷️ Paket: ${targetPlan === 'PRO_LIFETIME' ? 'PRO LIFETIME (Permanen)' : targetPlan}\n\n` +
                          `Silakan masukkan kunci di atas pada menu Lisensi & Aktivasi di aplikasi Anda. Terima kasih!`
                        );
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                      }}
                      className="text-amber-400 hover:underline font-bold text-xs"
                    >
                      Kirim via WhatsApp →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: STATUS SUPABASE & CLOUDFLARE */}
        {activeTab === 'cloud' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-sky-400" />
                <span>Pusat Database Cloud Supabase & Cloudflare</span>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Database pusat di cloud yang menjaga data 24.500 produk dan transaksi seluruh cabang tetap aman dan tersinkronisasi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Supabase Status */}
              <div className="p-5 rounded-3xl bg-[#2e1509] border border-[#5c2e17] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-black text-white">Supabase Cloud Database</h3>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    TERHUBUNG
                  </span>
                </div>

                <div className="space-y-2 text-xs bg-[#1f0b02] p-3 rounded-2xl border border-[#4d2511]">
                  <div>
                    <span className="text-stone-500 text-[10px] block">Project URL:</span>
                    <span className="font-mono font-bold text-stone-200">https://quhjgsoqjcumckoshjtv.supabase.co</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-stone-500 text-[10px] block">Total Produk di Cloud:</span>
                    <span className="font-bold text-emerald-300">24.531 Produk Master</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-stone-500 text-[10px] block">Status Sinkronisasi:</span>
                    <span className="font-bold text-sky-300">Multi-Cabang Realtime</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenLanModal}
                  className="w-full py-2.5 rounded-xl bg-[#442110] hover:bg-[#592b15] text-stone-200 font-bold text-xs border border-[#6b381d] transition-all flex items-center justify-center space-x-2"
                >
                  <Settings className="w-4 h-4 text-amber-300" />
                  <span>Ubah Kunci Supabase / Sinkronkan Data</span>
                </button>
              </div>

              {/* Cloudflare Pages & Tunnel */}
              <div className="p-5 rounded-3xl bg-[#2e1509] border border-[#5c2e17] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5 text-sky-400" />
                    <h3 className="text-sm font-black text-white">Cloudflare Pages & Tunnel</h3>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    ACTIVE LIVE
                  </span>
                </div>

                <div className="space-y-2 text-xs bg-[#1f0b02] p-3 rounded-2xl border border-[#4d2511]">
                  <div>
                    <span className="text-stone-500 text-[10px] block">Domain Utama Toko:</span>
                    <a 
                      href="https://tumbuhmakmur.ketokopos.online" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-mono font-bold text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <span>https://tumbuhmakmur.ketokopos.online</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="pt-1">
                    <span className="text-stone-500 text-[10px] block">Akses Kompatibel:</span>
                    <span className="font-bold text-stone-200">HP Android, iOS (iPhone/iPad), PC Laptop</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-stone-500 text-[10px] block">Protokol Keamanan:</span>
                    <span className="font-bold text-emerald-300">SSL / HTTPS Enkripsi Penuh</span>
                  </div>
                </div>

                <div className="text-[11px] text-stone-400 bg-[#1f0b02] p-3 rounded-xl border border-[#4d2511]">
                  Setiap pembaruan kode di GitHub branch <code>main</code> otomatis terpasang ke Cloudflare Pages ini dalam hitungan menit.
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* 5. MODAL DAFTARKAN TOKO BARU */}
      {isNewStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#2a1307] border border-[#6b381d] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-smooth-modal">
            <div className="flex items-center justify-between pb-3 border-b border-[#4d2511]">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-400" />
                <span>Daftarkan Klien / Toko Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewStoreModalOpen(false)}
                className="text-stone-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStore} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-300 mb-1">Nama Toko / Perusahaan:</label>
                <input
                  type="text"
                  required
                  value={newStoreForm.name}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, name: e.target.value })}
                  placeholder="Contoh: Toko Berkah Abadi"
                  className="w-full px-3 py-2 rounded-xl bg-[#1c0b03] border border-[#5c2e17] text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-300 mb-1">Nama Pemilik (Owner):</label>
                <input
                  type="text"
                  value={newStoreForm.ownerName}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, ownerName: e.target.value })}
                  placeholder="Contoh: Haji Ahmad"
                  className="w-full px-3 py-2 rounded-xl bg-[#1c0b03] border border-[#5c2e17] text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-300 mb-1">Subdomain Cloudflare:</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newStoreForm.subdomain}
                    onChange={(e) => setNewStoreForm({ ...newStoreForm, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="berkahabadi"
                    className="flex-1 px-3 py-2 rounded-l-xl bg-[#1c0b03] border border-[#5c2e17] text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="px-3 py-2 bg-[#3d1c0c] border border-l-0 border-[#5c2e17] rounded-r-xl text-stone-400 font-mono text-[11px]">
                    .ketokopos.online
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-300 mb-1">Kode Cabang:</label>
                <input
                  type="text"
                  value={newStoreForm.branchId}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1c0b03] border border-[#5c2e17] text-stone-300 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewStoreModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-bold hover:bg-stone-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md"
                >
                  Simpan Toko
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
