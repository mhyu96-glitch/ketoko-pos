import React, { useState, useEffect } from 'react';
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
  Settings, 
  Trash2, 
  RefreshCw,
  Layers,
  Activity,
  AlertCircle,
  Send
} from 'lucide-react';
import type { User } from '../types';
import { generateSuperAdminKey } from '../services/licenseService';
import { 
  getSupabaseClusters, 
  saveSupabaseCluster, 
  deleteSupabaseCluster, 
  testSupabaseConnection, 
  type SupabaseCluster,
  DEFAULT_SUPABASE_URL
} from '../api/supabaseClient';
import {
  getTelegramConfig,
  saveTelegramConfig,
  testTelegramConnection,
  triggerWorkerSync,
  fetchWorkerHealth,
  type TelegramConfig
} from '../services/telegramService';

export interface RegisteredStore {
  id: string;
  name: string;
  branch: string;
  branchId?: string;
  ownerName?: string;
  phone?: string;
  onlineDomain: string;
  localServer: string;
  licensePlan: string;
  adminUser: string;
  cashierUser: string;
  productsCount: string;
  status: 'ONLINE' | 'STANDALONE' | 'OFFLINE';
  isClean?: boolean;
  subdomain?: string;
  clusterId?: string;
  clusterName?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

interface SuperadminPortalViewProps {
  currentUser: User;
  onLogout: () => void;
  onEnterStorePos: (store?: RegisteredStore) => void;
  onCreateNewStore: (storeData: {
    name: string;
    ownerName: string;
    phone: string;
    subdomain: string;
    branchId: string;
    clusterId?: string;
    clusterName?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }) => Promise<void>;
  onClearStoreData?: (storeId: string) => Promise<void>;
  onDeleteStore?: (storeId: string) => void;
  onOpenLanModal: () => void;
  onOpenLicenseModal: () => void;
  onInjectCatalog?: () => void;
  totalProductsLoaded?: number;
  activeStoreId?: string;
  activeStoreName?: string;
}

export const SuperadminPortalView: React.FC<SuperadminPortalViewProps> = ({
  currentUser,
  onLogout,
  onEnterStorePos,
  onCreateNewStore,
  onClearStoreData,
  onDeleteStore,
  onOpenLanModal,
  onOpenLicenseModal,
  onInjectCatalog,
  totalProductsLoaded = 0,
  activeStoreId = 'store-01',
  activeStoreName = 'CV. Tumbuh Makmur Air Conindo'
}) => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'keygen' | 'topology' | 'cloud'>('tenants');

  // Generator Lisensi State
  const [targetStoreName, setTargetStoreName] = useState('CV. Tumbuh Makmur Air Conindo');
  const [targetMachineId, setTargetMachineId] = useState('');
  const [targetPlan, setTargetPlan] = useState<'PRO_LIFETIME' | 'ENTERPRISE_1Y' | 'MULTI_BRANCH'>('PRO_LIFETIME');
  const [generatedKey, setGeneratedKey] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  // Clusters Supabase State
  const [clusters, setClusters] = useState<SupabaseCluster[]>(() => getSupabaseClusters());
  const [isNewClusterModalOpen, setIsNewClusterModalOpen] = useState(false);
  const [newClusterForm, setNewClusterForm] = useState({
    name: '',
    url: '',
    anonKey: '',
    notes: ''
  });
  const [isTestingCluster, setIsTestingCluster] = useState(false);
  const [clusterTestResults, setClusterTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }>>({});
  const [isCopiedSql, setIsCopiedSql] = useState(false);

  // Telegram Bot & Cloudflare Keep-Alive State
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => getTelegramConfig());
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestFeedback, setTelegramTestFeedback] = useState<string | null>(null);
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const [syncTriggerFeedback, setSyncTriggerFeedback] = useState<string | null>(null);
  const [workerHealthData, setWorkerHealthData] = useState<any>(null);

  // New Client Store Modal & Cluster Selection State
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [isSubmittingStore, setIsSubmittingStore] = useState(false);
  const [isTestingModalCluster, setIsTestingModalCluster] = useState(false);
  const [modalClusterTestResult, setModalClusterTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  const [newStoreForm, setNewStoreForm] = useState({
    name: '',
    ownerName: '',
    phone: '',
    subdomain: '',
    branchId: 'BR-02',
    clusterChoice: 'cluster-default',
    newClusterName: '',
    newClusterUrl: '',
    newClusterKey: ''
  });

  const [registeredStores, setRegisteredStores] = useState<RegisteredStore[]>(() => {
    try {
      const saved = localStorage.getItem('ketoko_registered_stores');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'store-01',
        name: 'CV. Tumbuh Makmur Air Conindo',
        branch: 'Cabang Samarinda (BR-01)',
        branchId: 'BR-01',
        ownerName: 'suciawati Ramadhani',
        phone: '08123456789',
        onlineDomain: 'https://tumbuhmakmur.ketokopos.online',
        localServer: 'http://localhost:5858',
        licensePlan: 'PRO LIFETIME (Aktif)',
        adminUser: 'suciawati (Owner)',
        cashierUser: 'noor (Kasir Toko)',
        productsCount: '3.380 Produk Sparepart AC (Aktif & Siap Digunakan)',
        status: 'ONLINE',
        isClean: false,
        clusterId: 'cluster-default',
        clusterName: 'Cluster 1 (Default Cloud)',
        supabaseUrl: DEFAULT_SUPABASE_URL
      }
    ];
  });

  const syncStoresFromStorage = () => {
    try {
      const saved = localStorage.getItem('ketoko_registered_stores');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRegisteredStores(parsed);
        }
      }
    } catch {}
  };

  useEffect(() => {
    syncStoresFromStorage();
    const handleClusterChange = () => {
      setClusters(getSupabaseClusters());
    };
    window.addEventListener('ketoko_supabase_clusters_changed', handleClusterChange);
    return () => window.removeEventListener('ketoko_supabase_clusters_changed', handleClusterChange);
  }, []);

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

  const handleTestCluster = async (cluster: SupabaseCluster) => {
    setClusterTestResults(prev => ({
      ...prev,
      [cluster.id]: { success: false, message: 'Menguji koneksi...' }
    }));
    try {
      const res = await testSupabaseConnection(cluster.url, cluster.anonKey);
      setClusterTestResults(prev => ({
        ...prev,
        [cluster.id]: res
      }));
    } catch (err: any) {
      setClusterTestResults(prev => ({
        ...prev,
        [cluster.id]: { success: false, message: err?.message || 'Gagal koneksi' }
      }));
    }
  };

  const handleTestModalCluster = async () => {
    if (!newStoreForm.newClusterUrl.trim() || !newStoreForm.newClusterKey.trim()) {
      alert('Masukkan Project URL dan Anon Key terlebih dahulu.');
      return;
    }
    setIsTestingModalCluster(true);
    try {
      const res = await testSupabaseConnection(newStoreForm.newClusterUrl, newStoreForm.newClusterKey);
      setModalClusterTestResult(res);
    } catch (err: any) {
      setModalClusterTestResult({ success: false, message: err?.message || 'Gagal terhubung ke Supabase.' });
    } finally {
      setIsTestingModalCluster(false);
    }
  };

  const handleSaveNewClusterFromTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClusterForm.url.trim() || !newClusterForm.anonKey.trim()) {
      alert('Project URL dan Anon Key tidak boleh kosong.');
      return;
    }
    const created: SupabaseCluster = {
      id: `cluster-${Date.now()}`,
      name: newClusterForm.name.trim() || `Cluster ${clusters.length + 1} (Supabase Cloud)`,
      url: newClusterForm.url.trim(),
      anonKey: newClusterForm.anonKey.trim(),
      maxStores: 20,
      notes: newClusterForm.notes.trim() || 'Proyek Supabase Gratis'
    };
    saveSupabaseCluster(created);
    setNewClusterForm({ name: '', url: '', anonKey: '', notes: '' });
    setIsNewClusterModalOpen(false);
    alert(`Cluster "${created.name}" berhasil ditambahkan dan siap digunakan untuk toko!`);
  };

  const handleDeleteCluster = (cluster: SupabaseCluster) => {
    const storesInCluster = registeredStores.filter(s => (s.clusterId || 'cluster-default') === cluster.id);
    if (storesInCluster.length > 0) {
      alert(`Cluster "${cluster.name}" tidak dapat dihapus karena masih digunakan oleh ${storesInCluster.length} toko.`);
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus cluster database "${cluster.name}"?`)) {
      deleteSupabaseCluster(cluster.id);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramTestFeedback('Mengirim pesan tes ke bot @supabotborneo_bot...');
    try {
      const res = await testTelegramConnection();
      setTelegramTestFeedback(res.message);
    } catch (e: any) {
      setTelegramTestFeedback('Gagal: ' + (e?.message || 'Error jaringan'));
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTriggerWorkerSync = async () => {
    setIsTriggeringSync(true);
    setSyncTriggerFeedback('Menghubungi Cloudflare Worker untuk trigger sync Supabase...');
    try {
      const res = await triggerWorkerSync();
      setSyncTriggerFeedback(res.message);
    } catch (e: any) {
      setSyncTriggerFeedback('Gagal: ' + (e?.message || 'Error worker'));
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const handleCheckWorkerHealth = async () => {
    try {
      const res = await fetchWorkerHealth();
      setWorkerHealthData(res.data);
      alert(`Status Cloudflare Worker: ${res.data?.status || 'Active'}\nTotal Node: ${res.data?.configured_nodes || 2} Node Supabase\nJadwal Cron: ${res.data?.schedule || '08:00, 16:00, 23:00 WITA'}\nNode 1 Status: ${res.data?.nodes?.[0]?.status || 'healthy'}`);
    } catch (e: any) {
      alert('Gagal cek worker: ' + (e?.message || 'Error'));
    }
  };

  const handleToggleTelegramNotifySale = (enabled: boolean) => {
    const updated = saveTelegramConfig({ notifyOnSale: enabled });
    setTelegramConfig(updated);
  };

  const handleToggleTelegramNotifyShift = (enabled: boolean) => {
    const updated = saveTelegramConfig({ notifyOnShiftClose: enabled });
    setTelegramConfig(updated);
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreForm.name.trim() || isSubmittingStore) return;

    try {
      setIsSubmittingStore(true);
      let targetClusterId = newStoreForm.clusterChoice;
      let targetClusterName = 'Cluster 1 (Default Cloud)';
      let targetUrl = '';
      let targetAnonKey = '';

      if (newStoreForm.clusterChoice === 'new') {
        if (!newStoreForm.newClusterUrl.trim() || !newStoreForm.newClusterKey.trim()) {
          alert('Harap masukkan URL dan Anon Key untuk Cluster Supabase Baru.');
          setIsSubmittingStore(false);
          return;
        }
        const createdClusterId = `cluster-${Date.now()}`;
        const createdClusterName = newStoreForm.newClusterName.trim() || `Cluster ${clusters.length + 1}`;
        const createdCluster: SupabaseCluster = {
          id: createdClusterId,
          name: createdClusterName,
          url: newStoreForm.newClusterUrl.trim(),
          anonKey: newStoreForm.newClusterKey.trim(),
          maxStores: 20,
          notes: `Dibuat untuk toko ${newStoreForm.name.trim()}`
        };
        saveSupabaseCluster(createdCluster);
        targetClusterId = createdCluster.id;
        targetClusterName = createdCluster.name;
        targetUrl = createdCluster.url;
        targetAnonKey = createdCluster.anonKey;
      } else {
        const found = clusters.find(c => c.id === targetClusterId) || clusters[0];
        if (found) {
          targetClusterId = found.id;
          targetClusterName = found.name;
          targetUrl = found.url;
          targetAnonKey = found.anonKey;
        }
      }

      await onCreateNewStore({
        name: newStoreForm.name.trim(),
        ownerName: newStoreForm.ownerName.trim(),
        phone: newStoreForm.phone.trim(),
        subdomain: newStoreForm.subdomain.trim(),
        branchId: newStoreForm.branchId.trim() || `BR-0${registeredStores.length + 1}`,
        clusterId: targetClusterId,
        clusterName: targetClusterName,
        supabaseUrl: targetUrl,
        supabaseAnonKey: targetAnonKey
      });

      setNewStoreForm({
        name: '',
        ownerName: '',
        phone: '',
        subdomain: '',
        branchId: `BR-0${registeredStores.length + 2}`,
        clusterChoice: 'cluster-default',
        newClusterName: '',
        newClusterUrl: '',
        newClusterKey: ''
      });
      setModalClusterTestResult(null);
      setIsNewStoreModalOpen(false);
    } catch (err: any) {
      alert('Gagal membuat toko baru: ' + (err?.message || err));
    } finally {
      setIsSubmittingStore(false);
    }
  };

  const handleClearStore = async (store: RegisteredStore) => {
    if (confirm(`Apakah Anda yakin ingin MENGOSONGKAN SEMUA DATA (0 Produk, 0 Transaksi) untuk toko "${store.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      if (onClearStoreData) {
        await onClearStoreData(store.id);
        syncStoresFromStorage();
        alert(`Data toko "${store.name}" telah berhasil dikosongkan (0 Produk).`);
      }
    }
  };

  const handleDeleteStoreClick = (store: RegisteredStore) => {
    if (confirm(`Hapus toko "${store.name}" dari daftar pendaftaran sistem?`)) {
      if (onDeleteStore) {
        onDeleteStore(store.id);
      }
      setRegisteredStores(prev => {
        const updated = prev.filter(s => s.id !== store.id);
        localStorage.setItem('ketoko_registered_stores', JSON.stringify(updated));
        return updated;
      });
    }
  };
  // Helper to extract store initials
  const getStoreInitials = (name: string) => {
    const clean = name.replace(/^(cv\.|pt\.|ud\.|tb\.)\s*/i, '').trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (clean.slice(0, 2) || 'TK').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden selection:bg-amber-500/20 selection:text-amber-300">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.07),rgba(0,0,0,0))] z-0" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_40%_at_80%_15%,rgba(245,158,11,0.05),rgba(0,0,0,0))] z-0" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_40%_at_10%_40%,rgba(168,85,247,0.04),rgba(0,0,0,0))] z-0" />
      
      {/* 1. TOP HEADER BRANDING SUPERADMIN */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl shadow-black/40 relative z-10">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/30 via-indigo-500/30 to-sky-500/30 p-[1px] shadow-lg shadow-amber-500/10 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950/90 rounded-[15px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Ketoko POS <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">Vendor Hub</span>
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono tracking-wider">
                MASTER SUPERADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {currentUser.name} • Pusat Kontrol Pengembang, Manajemen Klien Toko & Lisensi
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Quick Enter Store POS Simulation */}
          <button
            type="button"
            onClick={() => onEnterStorePos()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            title={`Buka Kasir POS Toko ${activeStoreName}`}
          >
            <Monitor className="w-4 h-4 text-slate-950 shrink-0" />
            <span className="max-w-[180px] sm:max-w-xs truncate">Buka POS ({activeStoreName})</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0 text-slate-950" />
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-800/60 transition-all shadow-sm"
            title="Keluar dari Akun Superadmin"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. SUB-BANNER VENDOR STATUS CARDS */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-6 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Lisensi Vendor */}
          <div className="p-4.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 backdrop-blur-md shadow-lg shadow-black/20 flex items-center space-x-3.5 group transition-all">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Lisensi Vendor</div>
              <div className="text-sm font-black text-emerald-400">MASTER UNLIMITED</div>
              <div className="text-[10px] text-slate-400">Bebas Transaksi & Multi-Toko Lifetime</div>
            </div>
          </div>

          {/* Card 2: Toko Terdaftar */}
          <div className="p-4.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 backdrop-blur-md shadow-lg shadow-black/20 flex items-center space-x-3.5 group transition-all">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Klien Toko Terdaftar</div>
              <div className="text-sm font-black text-white">{registeredStores.length} Toko Terdaftar</div>
              <div className="text-[10px] text-amber-300 font-medium truncate max-w-[160px]">Aktif: {activeStoreName}</div>
            </div>
          </div>

          {/* Card 3: Cloud Database (Supabase) */}
          <div className="p-4.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 backdrop-blur-md shadow-lg shadow-black/20 flex items-center space-x-3.5 group transition-all">
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Database Kasir</div>
              <div className="text-sm font-black text-sky-400">{totalProductsLoaded.toLocaleString('id-ID')} Produk di Kasir</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold truncate">
                <span className="truncate">{activeStoreName}</span>
                {totalProductsLoaded === 0 && <span className="text-amber-300 font-bold shrink-0">(Kosong / Bersih)</span>}
              </div>
              {onInjectCatalog && (
                <button
                  type="button"
                  onClick={onInjectCatalog}
                  className="mt-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] transition-all active:scale-95 flex items-center gap-1 w-fit"
                >
                  ⚡ Inject 3.380 Produk ke POS
                </button>
              )}
            </div>
          </div>

          {/* Card 4: Multi-Kasir LAN Server */}
          <div className="p-4.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 backdrop-blur-md shadow-lg shadow-black/20 flex items-center space-x-3.5 group transition-all">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arsitektur Multi-Kasir</div>
              <div className="text-sm font-black text-purple-400">1 Server + 4 Klien</div>
              <div className="text-[10px] text-slate-400">Port 5858 + Cloudflare Live</div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 mt-6 relative z-10">
        <div className="p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex items-center space-x-1.5 overflow-x-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shrink-0 ${
              activeTab === 'tenants'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Status Supabase & Cloudflare</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN BODY VIEW */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex-1 relative z-10">
        
        {/* TAB 1: DAFTAR KLIEN TOKO */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-amber-400" />
                  <span>Daftar Toko / Usaha Klien (Tenants)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kelola toko yang membeli software Ketoko POS. Setiap toko memiliki database, subdomain, dan lisensi tersendiri.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewStoreModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Daftarkan Klien / Toko Baru</span>
              </button>
            </div>

            {/* Store Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredStores.map(store => {
                const isThisStoreActive = activeStoreId === store.id || (!activeStoreId && store.id === 'store-01');
                return (
                  <div 
                    key={store.id} 
                    className={`relative rounded-3xl bg-slate-900/80 border p-5 sm:p-6 shadow-xl backdrop-blur-md flex flex-col justify-between space-y-4 transition-all duration-300 overflow-hidden group ${
                      isThisStoreActive 
                        ? 'border-amber-500/70 ring-2 ring-amber-500/20 shadow-amber-500/5' 
                        : 'border-slate-800/80 hover:border-slate-700/80 hover:shadow-2xl'
                    }`}
                  >
                    {/* Top accent line if active */}
                    {isThisStoreActive && (
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300" />
                    )}

                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3.5">
                          {/* Store Avatar Badge */}
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                            isThisStoreActive
                              ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/40 text-amber-300'
                              : 'bg-gradient-to-br from-slate-800 to-slate-850 border border-slate-700/80 text-slate-300'
                          }`}>
                            {getStoreInitials(store.name)}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>{store.status}</span>
                              </span>
                              {isThisStoreActive && (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  ★ AKTIF DI KASIR
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-black text-white tracking-tight">{store.name}</h3>
                            <p className="text-xs text-slate-400 font-medium">{store.branch}</p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-[10px] font-extrabold text-amber-300 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 font-mono tracking-wider inline-block">
                            {store.licensePlan}
                          </span>
                        </div>
                      </div>

                      {/* 4-Metric Grid */}
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                          <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Akses Online (Cloudflare):</span>
                          <a 
                            href={store.onlineDomain} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="font-bold text-sky-400 hover:text-sky-300 truncate flex items-center space-x-1"
                          >
                            <span className="truncate">{store.onlineDomain.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          <div className="pt-0.5">
                            <a
                              href="https://ketoko-pos.pages.dev"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                              title="Akses langsung Cloudflare Pages (Live 100%)"
                            >
                              <span>⚡ Live: ketoko-pos.pages.dev</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                          <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Database Master:</span>
                          <span className="font-bold text-emerald-400 block truncate">
                            {isThisStoreActive ? `${totalProductsLoaded.toLocaleString('id-ID')} Produk (Kasir Aktif)` : store.productsCount}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                          <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Owner / Admin:</span>
                          <span className="font-bold text-slate-200 block truncate">{store.adminUser}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                          <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Akun Kasir Toko:</span>
                          <span className="font-bold text-slate-200 block truncate">{store.cashierUser}</span>
                        </div>

                        <div className="col-span-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                          <span className="text-slate-400 text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-wider">
                            <Layers className="w-3.5 h-3.5 text-sky-400" />
                            <span>Database Cloud:</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 font-mono font-bold text-[10px] flex items-center gap-1.5">
                            <Database className="w-3 h-3 text-sky-400" />
                            <span>{store.clusterName || 'Cluster 1 (Default Cloud)'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions for this store */}
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEnterStorePos(store)}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center space-x-1.5 shadow-md transition-all active:scale-95 ${
                          isThisStoreActive 
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20' 
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 hover:border-slate-600'
                        }`}
                      >
                        <Monitor className={`w-4 h-4 ${isThisStoreActive ? 'text-slate-950' : 'text-amber-400'}`} />
                        <span>{isThisStoreActive ? 'Buka POS Toko Ini (Aktif)' : 'Beralih & Buka POS Toko Ini'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleClearStore(store)}
                        className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-amber-950/50 text-amber-300 hover:text-amber-200 font-bold text-xs flex items-center space-x-1 border border-slate-700/80 hover:border-amber-700/50 transition-all active:scale-95"
                        title="Kosongkan database produk dan transaksi toko ini (0 Data)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Kosongkan</span>
                      </button>

                      {store.id !== 'store-01' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStoreClick(store)}
                          className="py-2.5 px-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 font-bold text-xs flex items-center space-x-1 border border-slate-700/80 hover:border-rose-800/50 transition-all active:scale-95"
                          title="Hapus toko dari pendaftaran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={onOpenLanModal}
                        className="py-2.5 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-purple-300 font-bold text-xs flex items-center space-x-1 border border-slate-700/80 transition-all active:scale-95"
                        title="Pengaturan Jaringan LAN & Cloud Toko"
                      >
                        <Network className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={onOpenLicenseModal}
                        className="py-2.5 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-amber-300 font-bold text-xs flex items-center space-x-1 border border-slate-700/80 transition-all active:scale-95"
                        title="Kelola Lisensi Toko"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
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
              <p className="text-xs text-slate-400 mt-1">
                Berikut adalah skema praktis dan panduan bagaimana sistem Ketoko POS bekerja dalam satu jaringan toko (LAN/Wi-Fi) serta terhubung online ke HP lewat Cloudflare.
              </p>
            </div>

            {/* Visual Diagram */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Kolom 1: Komputer Server Pusat */}
              <div className="p-5.5 rounded-3xl bg-slate-900/80 border border-amber-500/40 shadow-xl flex flex-col space-y-4 relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono">
                    KOMPUTER 1 (SERVER PUSAT)
                  </span>
                  <Server className="w-5 h-5 text-amber-400" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-white">Server Database Toko</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Komputer utama toko yang menyala sepanjang jam operasional kasir.
                  </p>
                </div>

                <div className="space-y-2 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mode Sistem:</span>
                    <span className="font-bold text-amber-400">SERVER (Port 5858)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Alamat LAN Toko:</span>
                    <span className="font-bold text-emerald-400 font-mono">http://192.168.1.X:5858</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Aplikasi Desktop:</span>
                    <span className="font-bold text-slate-200">Ketoko POS Desktop</span>
                  </div>
                </div>

                <div className="text-[11px] text-amber-200 bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20">
                  💡 <strong>Tugas:</strong> Menyimpan seluruh data 24.500 produk, memproses transaksi secara realtime, dan memotong stok otomatis untuk semua kasir.
                </div>
              </div>

              {/* Kolom 2: 4 Komputer Klien Kasir */}
              <div className="p-5.5 rounded-3xl bg-slate-900/80 border border-purple-500/40 shadow-xl flex flex-col space-y-4 relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-400 via-purple-500 to-indigo-400" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 font-mono">
                    KOMPUTER 2, 3, 4, 5 (4 KASIR KLIEN)
                  </span>
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-white">Terminal Kasir Meja</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    4 Komputer kasir yang berada di meja kasir toko, terhubung ke Wi-Fi / kabel LAN yang sama.
                  </p>
                </div>

                <div className="space-y-2 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mode Sistem:</span>
                    <span className="font-bold text-purple-400">CLIENT (Klien LAN)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Akses:</span>
                    <span className="font-bold text-slate-200">Desktop / Google Chrome</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Akun Kasir:</span>
                    <span className="font-bold text-amber-300">noor / kasir1 / kasir2</span>
                  </div>
                </div>

                <div className="text-[11px] text-purple-200 bg-purple-500/10 p-3.5 rounded-2xl border border-purple-500/20">
                  💡 <strong>Cara Pakai:</strong> Buka Ketoko POS Desktop di PC Klien (atau buka Chrome ke <code className="font-mono bg-black/40 px-1 rounded">http://IP-SERVER:5858</code>), kasir langsung bisa scan barcode & cetak nota!
                </div>
              </div>

              {/* Kolom 3: HP / Tablet Online via Cloudflare */}
              <div className="p-5.5 rounded-3xl bg-slate-900/80 border border-sky-500/40 shadow-xl flex flex-col space-y-4 relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-sky-500 to-blue-400" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 font-mono">
                    HP / TABLET (ONLINE DI MANAPUN)
                  </span>
                  <Smartphone className="w-5 h-5 text-sky-400" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-white">Owner & Kasir Mobile</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Bisa diakses dari HP android/iPhone dari luar kota atau di perjalanan tanpa kabel LAN.
                  </p>
                </div>

                <div className="space-y-2 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jalur Akses:</span>
                    <span className="font-bold text-sky-400">Cloudflare Pages & Tunnel</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Domain Resmi:</span>
                    <span className="font-bold text-amber-300 font-mono text-[10px]">tumbuhmakmur.ketokopos.online</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cloud Sync:</span>
                    <span className="font-bold text-emerald-400">Supabase Cloud Live</span>
                  </div>
                </div>

                <div className="text-[11px] text-sky-200 bg-sky-500/10 p-3.5 rounded-2xl border border-sky-500/20">
                  💡 <strong>Keuntungan:</strong> Owner bisa memantau omzet toko dan laporan penjualan langsung dari HP secara live dari rumah.
                </div>
              </div>

            </div>

            {/* Quick Action to LAN Modal */}
            <div className="p-4.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg backdrop-blur-md">
              <div>
                <h4 className="text-xs font-black text-white">Ingin Mengatur IP Server atau Cloudflare Tunnel Sekarang?</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Buka panel konfigurasi LAN & Supabase untuk melihat alamat IP server toko Anda saat ini.</p>
              </div>
              <button
                type="button"
                onClick={onOpenLanModal}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center space-x-1.5 shadow-md shadow-purple-600/20 transition-all shrink-0 active:scale-95"
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
              <p className="text-xs text-slate-400 mt-1">
                Gunakan alat ini untuk membuat Kunci Lisensi Resmi bagi toko pembeli aplikasi Ketoko POS. Kunci ini dimasukkan pada layar aktivasi komputer klien.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-4.5 backdrop-blur-md">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nama Toko / Usaha Pembeli:
                </label>
                <input
                  type="text"
                  value={targetStoreName}
                  onChange={(e) => setTargetStoreName(e.target.value)}
                  placeholder="Contoh: CV. Tumbuh Makmur Air Conindo"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Kode Mesin Komputer Klien (Machine ID):
                </label>
                <input
                  type="text"
                  value={targetMachineId}
                  onChange={(e) => setTargetMachineId(e.target.value)}
                  placeholder="Contoh: KPOS-7E3A-9F2B-XXXX (Didapat dari layar aktivasi klien)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  *Kosongkan jika ingin membuat lisensi umum berbasis nama toko saja.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Paket Lisensi:
                </label>
                <select
                  value={targetPlan}
                  onChange={(e) => setTargetPlan(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="PRO_LIFETIME">PRO LIFETIME — Permanen Selamanya (Rekomendasi Jual)</option>
                  <option value="ENTERPRISE_1Y">ENTERPRISE 1 TAHUN — Langganan Tahunan</option>
                  <option value="MULTI_BRANCH">MULTI-CABANG ENTERPRISE — Paket Banyak Cabang</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateKey}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>GENERATE SERIAL KEY LISENSI RESMI</span>
              </button>

              {/* Generated Result */}
              {generatedKey && (
                <div className="mt-4 p-4.5 rounded-2xl bg-slate-950/90 border-2 border-emerald-500/50 space-y-3 animate-smooth-modal">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Kunci Lisensi Berhasil Dibuat</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">{targetPlan}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedKey}
                      className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-emerald-500/30 text-emerald-300 font-mono font-black text-sm tracking-wider select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{isCopied ? 'Tersalin!' : 'Salin'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-300 flex items-center justify-between pt-2 border-t border-slate-800">
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
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs hover:underline flex items-center gap-1"
                    >
                      <span>Kirim via WhatsApp</span>
                      <ExternalLink className="w-3 h-3" />
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-400" />
                  <span>Pusat Database Cloud Supabase (Multi-Cluster Gratis) & Cloudflare</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Arsitektur multi-tenant berbasis cluster: Setiap akun Supabase Gratis menampung hingga 20 toko. Buat cluster baru untuk toko ke-21 dst tanpa biaya bulanan (100% Gratis).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsNewClusterModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-black text-xs flex items-center space-x-2 shadow-lg shadow-sky-600/20 transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Daftarkan Cluster Supabase Baru</span>
              </button>
            </div>

            {/* Quick KPI Cluster Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg flex items-center space-x-3.5 backdrop-blur-md">
                <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Cluster Aktif</div>
                  <div className="text-base font-black text-white">{clusters.length} Cluster Database</div>
                  <div className="text-[10px] text-emerald-400 font-medium">Semua Proyek Supabase Free Tier</div>
                </div>
              </div>

              <div className="p-4.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg flex items-center space-x-3.5 backdrop-blur-md">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Toko Terdistribusi</div>
                  <div className="text-base font-black text-white">{registeredStores.length} Toko Klien</div>
                  <div className="text-[10px] text-amber-300 font-medium">Tersebar di {clusters.length} Cluster</div>
                </div>
              </div>

              <div className="p-4.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg flex items-center space-x-3.5 backdrop-blur-md">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kapasitas Siap Pakai</div>
                  <div className="text-base font-black text-emerald-400">{clusters.length * 20} Toko Bebas Biaya</div>
                  <div className="text-[10px] text-slate-400 font-medium">Hemat Biaya Rp 400rb+/Bulan</div>
                </div>
              </div>
            </div>

            {/* DAFTAR CLUSTER SUPABASE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Daftar Cluster Database Supabase Aktif</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Rekomendasi aman: Maksimal 20 toko per akun Supabase gratis
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clusters.map((cluster) => {
                  const storesInCluster = registeredStores.filter(s => (s.clusterId || 'cluster-default') === cluster.id);
                  const maxCap = cluster.maxStores || 20;
                  const usagePercent = Math.min(100, Math.round((storesInCluster.length / maxCap) * 100));
                  const testRes = clusterTestResults[cluster.id];

                  return (
                    <div 
                      key={cluster.id} 
                      className="p-5.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4 flex flex-col justify-between backdrop-blur-md"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-black text-white">{cluster.name}</h4>
                              {cluster.isDefault ? (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  CLUSTER UTAMA
                                </span>
                              ) : (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30">
                                  CLUSTER TAMBAHAN
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{cluster.notes || 'Supabase Free Tier Project'}</p>
                          </div>

                          <span className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                            {storesInCluster.length} / {maxCap} Toko
                          </span>
                        </div>

                        {/* Capacity Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-medium">Pemakaian Kuota Akun Gratis:</span>
                            <span className={`font-bold ${usagePercent >= 100 ? 'text-rose-400' : usagePercent >= 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {usagePercent}% ({maxCap - storesInCluster.length} slot tersisa)
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 rounded-full ${
                                usagePercent >= 100 
                                  ? 'bg-rose-500' 
                                  : usagePercent >= 75 
                                  ? 'bg-amber-500' 
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(5, usagePercent)}%` }}
                            />
                          </div>
                          {storesInCluster.length >= maxCap && (
                            <p className="text-[10px] text-amber-300 font-bold flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Kapasitas 20 toko telah tercapai. Buat Cluster baru untuk pendaftaran toko berikutnya.</span>
                            </p>
                          )}
                        </div>

                        {/* Cluster Info Details */}
                        <div className="space-y-2 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                          <div>
                            <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Project URL:</span>
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-200 truncate max-w-[280px]">
                                {cluster.url}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(cluster.url);
                                  alert('Project URL disalin ke clipboard!');
                                }}
                                className="text-slate-400 hover:text-white p-1"
                                title="Salin URL"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="pt-1 border-t border-slate-850">
                            <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Toko yang Terdaftar di Cluster Ini:</span>
                            {storesInCluster.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {storesInCluster.map(s => (
                                  <span 
                                    key={s.id} 
                                    className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/80 text-slate-200 text-[10px] font-medium"
                                  >
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Belum ada toko yang menggunakan cluster ini.</span>
                            )}
                          </div>
                        </div>

                        {/* Realtime Ping / Test Result Feedback */}
                        {testRes && (
                          <div className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center justify-between ${
                            testRes.success 
                              ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-200' 
                              : 'bg-rose-950/60 border border-rose-700/60 text-rose-200'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              {testRes.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                              <span>{testRes.message}</span>
                            </div>
                            {testRes.latencyMs && (
                              <span className="font-mono font-bold text-[10px] bg-black/40 px-1.5 py-0.5 rounded">
                                {testRes.latencyMs}ms
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cluster Actions */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleTestCluster(cluster)}
                          className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 font-bold text-xs border border-slate-700/80 transition-all flex items-center space-x-1.5 active:scale-95"
                        >
                          <Activity className="w-3.5 h-3.5 text-amber-400" />
                          <span>Uji Latensi Ping</span>
                        </button>

                        <div className="flex items-center space-x-1.5">
                          {cluster.isDefault && (
                            <button
                              type="button"
                              onClick={onOpenLanModal}
                              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 font-bold text-xs border border-slate-700/80 transition-all flex items-center space-x-1.5 active:scale-95"
                            >
                              <Settings className="w-3.5 h-3.5 text-slate-400" />
                              <span>Pengaturan Kunci</span>
                            </button>
                          )}

                          {!cluster.isDefault && (
                            <button
                              type="button"
                              disabled={storesInCluster.length > 0}
                              onClick={() => handleDeleteCluster(cluster)}
                              className={`p-2 rounded-xl border transition-all ${
                                storesInCluster.length > 0
                                  ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                                  : 'bg-rose-950/40 hover:bg-rose-900 text-rose-300 border-rose-800/40 active:scale-95'
                              }`}
                              title={storesInCluster.length > 0 ? 'Tidak dapat menghapus cluster yang masih memiliki toko terdaftar' : 'Hapus Cluster'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PANDUAN PRAKTIS: MULTI-AKUN SUPABASE GRATIS */}
            <div className="p-5.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white">Panduan Multi-Akun Supabase Gratis (Bila Toko Sudah 20+)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`supabase_schema.sql`);
                    setIsCopiedSql(true);
                    setTimeout(() => setIsCopiedSql(false), 2500);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
                >
                  {isCopiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedSql ? 'Nama File Tersalin!' : 'Salin Lokasi: supabase_schema.sql'}</span>
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <p className="leading-relaxed">
                  Supabase menyediakan tier <strong>100% Gratis</strong> dengan batas 500 MB database dan ~50.000 transaksi per bulan per proyek. Dengan arsitektur Ketoko POS, Anda <strong>TIDAK PERLU membayar langganan Pro ($25/bulan)</strong> ketika toko klien bertambah. Cukup gunakan clustering multi-akun gratis:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="font-extrabold text-amber-400 block">Langkah 1</span>
                    <span className="text-[11px] text-slate-400">
                      Buka <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-sky-400 underline font-bold">supabase.com</a> dan buat akun baru dengan email/Google baru.
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="font-extrabold text-amber-400 block">Langkah 2</span>
                    <span className="text-[11px] text-slate-400">
                      Klik <strong>+ New Project</strong>, beri nama (misal: <code>ketoko-cluster-2</code>), pilih region <strong>Singapore</strong>.
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="font-extrabold text-amber-400 block">Langkah 3</span>
                    <span className="text-[11px] text-slate-400">
                      Buka <strong>SQL Editor</strong> di dashboard Supabase baru → Tempelkan isi file <code className="text-amber-300">supabase_schema.sql</code> → Klik <strong>Run</strong>.
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <span className="font-extrabold text-amber-400 block">Langkah 4</span>
                    <span className="text-[11px] text-slate-400">
                      Buka Project Settings → API, salin <strong>URL</strong> & <strong>anon key</strong>, lalu klik tombol <strong>+ Daftarkan Cluster Supabase Baru</strong> di atas. Selesai!
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* INTEGRASI BOT TELEGRAM & CLOUDFLARE KEEP-ALIVE WORKER */}
            <div className="p-5.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                    <Send className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <span>Integrasi Bot Telegram & Cloudflare Keep-Alive Worker</span>
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        AKTIF & TERHUBUNG 🟢
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Menjaga seluruh database Supabase tetap aktif 24/7 (anti-pause) serta mengirimkan laporan & notifikasi kasir otomatis ke Telegram.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    disabled={isTestingTelegram}
                    onClick={handleTestTelegram}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-sky-600/20 transition-all active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isTestingTelegram ? 'Mengirim Tes...' : '⚡ Kirim Pesan Tes ke Telegram'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isTriggeringSync}
                    onClick={handleTriggerWorkerSync}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringSync ? 'animate-spin' : ''}`} />
                    <span>Trigger Sync Sekarang</span>
                  </button>
                </div>
              </div>

              {/* Telegram Test / Sync Feedback Banner */}
              {(telegramTestFeedback || syncTriggerFeedback) && (
                <div className="p-3 rounded-2xl bg-sky-950/60 border border-sky-700/60 text-sky-200 text-xs flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>{telegramTestFeedback || syncTriggerFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTelegramTestFeedback(null);
                      setSyncTriggerFeedback(null);
                    }}
                    className="text-slate-400 hover:text-white font-bold text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Kartu 1: Bot Telegram Detail */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-400 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-sky-400" />
                      <span>Bot Telegram Penerima Laporan</span>
                    </span>
                    <a
                      href="https://t.me/supabotborneo_bot"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline flex items-center gap-1 font-bold text-[11px]"
                    >
                      <span>Buka @supabotborneo_bot</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="space-y-1.5 bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-mono text-[11px]">
                    <div>• Username Bot: <span className="text-emerald-400 font-bold">@supabotborneo_bot</span> (supabot_keeplive)</div>
                    <div>• Chat ID Tujuan: <span className="text-amber-300 font-bold">{telegramConfig.chatId}</span> (Wahyu)</div>
                    <div>• Token Bot: <span className="text-slate-400">8956076739:AAH4f...</span> (Terverifikasi)</div>
                  </div>

                  {/* Pengaturan Notifikasi Otomatis */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Pilihan Notifikasi Otomatis ke Telegram:</span>
                    
                    <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={telegramConfig.notifyOnSale}
                        onChange={(e) => handleToggleTelegramNotifySale(e.target.checked)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900"
                      />
                      <span className="text-slate-200 text-[11px]">Kirim Notifikasi Setiap Transaksi Kasir POS Selesai</span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={telegramConfig.notifyOnShiftClose}
                        onChange={(e) => handleToggleTelegramNotifyShift(e.target.checked)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900"
                      />
                      <span className="text-slate-200 text-[11px]">Kirim Ringkasan Tutup Shift & Total Kas Kasir Harian</span>
                    </label>
                  </div>
                </div>

                {/* Kartu 2: Cloudflare Keep-Alive Worker */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-400 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cloudflare Keep-Alive Worker</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCheckWorkerHealth}
                      className="text-emerald-400 hover:text-emerald-300 font-bold text-[11px] underline"
                    >
                      🩺 Cek /health
                    </button>
                  </div>

                  <div className="space-y-1.5 bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-mono text-[11px]">
                    <div>• Worker URL: <span className="text-sky-300 font-bold truncate block">{telegramConfig.workerUrl}</span></div>
                    <div>• Jadwal Ping Otomatis: <span className="text-emerald-400 font-bold">08:00, 16:00, dan 23:00 WITA</span></div>
                    <div>• Node 1 (Catatan Kehamilan): <span className="text-emerald-400 font-bold">Aktif ✅</span> <span className="text-slate-400 text-[10px]">(xukpisovkcflcwuhrzkx)</span></div>
                    <div>• Node 2 (Ketoko POS): <span className="text-emerald-400 font-bold">Aktif ✅</span> <span className="text-slate-400 text-[10px]">(quhjgsoqjcumckoshjtv)</span></div>
                  </div>

                  {workerHealthData && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px] space-y-0.5">
                      <div>Status Worker: <b>{workerHealthData.status}</b> • Node Sehat: <b>{workerHealthData.healthy_nodes}/{workerHealthData.configured_nodes}</b></div>
                      <div className="text-slate-400">Pemeriksaan Terakhir: {workerHealthData.checked_at ? new Date(workerHealthData.checked_at).toLocaleTimeString('id-ID') : '-'}</div>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Worker ini berjalan otomatis di jaringan Cloudflare tepi (*Edge Workers*) 3 kali sehari untuk menjaga database Supabase tetap hangat tanpa risiko di-pause. Hasil ping langsung dilaporkan ke Telegram Anda.
                  </p>

                  <div className="pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `CREATE TABLE IF NOT EXISTS public.app_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT NOT NULL UNIQUE,
    last_sync_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.app_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write app_configurations" ON public.app_configurations;
CREATE POLICY "Allow public read/write app_configurations" ON public.app_configurations FOR ALL USING (true) WITH CHECK (true);
DROP FUNCTION IF EXISTS public.sync_application_data();
CREATE OR REPLACE FUNCTION public.sync_application_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    affected_rows integer;
    db_size_bytes bigint;
    db_size_mb numeric;
    quota_mb numeric := 500.0;
    percent_used numeric;
BEGIN
    BEGIN
        SELECT pg_database_size(current_database()) INTO db_size_bytes;
        db_size_mb := ROUND((db_size_bytes::numeric / (1024 * 1024)), 2);
        percent_used := ROUND((db_size_mb / quota_mb) * 100, 1);
    EXCEPTION WHEN OTHERS THEN
        db_size_mb := 0;
        percent_used := 0;
    END;

    INSERT INTO public.app_configurations (key_name, last_sync_timestamp, metadata)
    VALUES ('system_sync_service', now(), jsonb_build_object('service', 'supabase_sync_worker', 'version', '2.1.0', 'last_status', 'success', 'db_size_mb', db_size_mb, 'percent_used', percent_used))
    ON CONFLICT (key_name) DO UPDATE
    SET last_sync_timestamp = excluded.last_sync_timestamp, metadata = coalesce(public.app_configurations.metadata, '{}'::jsonb) || excluded.metadata;
    GET DIAGNOSTICS affected_rows = row_count;
    RETURN jsonb_build_object('status', 'synchronized', 'timestamp', now(), 'affected_rows', affected_rows, 'version', '2.1.0', 'db_size_mb', db_size_mb, 'quota_mb', quota_mb, 'percent_used', percent_used);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_application_data() FROM public;
GRANT EXECUTE ON FUNCTION public.sync_application_data() TO anon, authenticated;
SELECT public.sync_application_data();`;
                        navigator.clipboard.writeText(sql);
                        alert('Skrip SQL RPC Keep-Alive & Storage Monitor v2.1.0 berhasil disalin! Silakan tempel dan Run di SQL Editor project Supabase (quhjgsoqjcumckoshjtv).');
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-[11px] border border-amber-500/30 transition-all flex items-center justify-center space-x-1.5 active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Salin Skrip SQL RPC & Kuota Storage untuk Node 2 (v2.1.0)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CLOUDFLARE & SUBDOMAIN INFRASTRUCTURE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Cloudflare Pages & Tunnel */}
              <div className="p-5.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5 text-sky-400" />
                    <h3 className="text-sm font-black text-white">Cloudflare Pages & Tunnel</h3>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30 font-mono">
                    ACTIVE LIVE
                  </span>
                </div>

                <div className="space-y-2.5 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Akses Langsung Cloudflare Pages (Live 100%):</span>
                    <a 
                      href="https://ketoko-pos.pages.dev" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1.5 mt-0.5"
                    >
                      <span>https://ketoko-pos.pages.dev</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                  <div className="pt-2 border-t border-slate-850">
                    <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Custom Domain Subdomain Toko:</span>
                    <a 
                      href="https://tumbuhmakmur.ketokopos.online" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-mono font-bold text-sky-400 hover:underline flex items-center gap-1.5 mt-0.5"
                    >
                      <span>https://tumbuhmakmur.ketokopos.online</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      *Memerlukan verifikasi kontak email domain di registrar & CNAME Cloudflare.
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-850">
                    <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Akses Kompatibel:</span>
                    <span className="font-bold text-slate-200">HP Android, iOS (iPhone/iPad), PC Laptop</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-850">
                    <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Protokol Keamanan:</span>
                    <span className="font-bold text-emerald-400">SSL / HTTPS Enkripsi Penuh</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
                  Setiap pembaruan kode di GitHub branch <code>main</code> otomatis terpasang ke Cloudflare Pages ini dalam hitungan menit.
                </div>
              </div>

              {/* Panduan Menghubungkan Subdomain Toko Baru */}
              <div className="p-5.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4 backdrop-blur-md">
                <div className="flex items-center space-x-2">
                  <Network className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white">Panduan Penambahan Subdomain Toko Baru di Cloudflare</h3>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Cara 1: Wildcard DNS */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-400">Cara 1: Wildcard DNS (Otomatis untuk Semua Toko) - DIREKOMENDASIKAN</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">1x Setup Selamanya</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Cukup buat 1 DNS Record di dashboard Cloudflare domain <code className="text-amber-300">ketokopos.online</code>:
                    </p>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200 space-y-1">
                      <div>• Type: <span className="text-emerald-400 font-bold">CNAME</span></div>
                      <div>• Name: <span className="text-amber-300 font-bold">*</span> (tanda bintang)</div>
                      <div>• Target: <span className="text-sky-300 font-bold">ketoko-pos.pages.dev</span> (atau domain Pages Anda)</div>
                      <div>• Proxy status: <span className="text-amber-400 font-bold">Proxied (Orange Cloud)</span></div>
                    </div>
                    <p className="text-[11px] text-emerald-400 font-medium">
                      ✓ Hasilnya: Setiap kali Anda membuat toko baru dengan subdomain apa pun (misal <code className="text-amber-200">tokoberkah</code>), subdomain tersebut <strong>langsung aktif otomatis seketika</strong> tanpa perlu setting DNS lagi!
                    </p>
                  </div>

                  {/* Cara 2: Custom Domains Pages */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                    <span className="font-extrabold text-amber-400">Cara 2: Custom Domain di Cloudflare Pages (Manual per Toko)</span>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Jika tidak memakai wildcard, Anda dapat menambahkan subdomain secara manual per toko:
                    </p>
                    <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-1 pl-1">
                      <li>Buka Cloudflare Dashboard → <strong>Workers & Pages</strong> → Pilih project <strong>Ketoko POS</strong>.</li>
                      <li>Pilih tab <strong>Custom domains</strong> → Klik <strong>Set up a custom domain</strong>.</li>
                      <li>Ketik subdomain toko, misal: <code className="text-amber-300">tokoberkah.ketokopos.online</code>.</li>
                      <li>Klik <strong>Continue</strong> dan <strong>Activate domain</strong>. Cloudflare akan menerbitkan SSL HTTPS otomatis.</li>
                    </ol>
                  </div>

                  {/* Cara 3: Cloudflare Tunnel */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                    <span className="font-extrabold text-amber-400">Cara 3: Cloudflare Tunnel (Jika Toko Pakai Server PC Lokal)</span>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Jika toko klien memasang server fisik di komputernya sendiri (port 5858):
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Buka <strong>Zero Trust</strong> → <strong>Networks</strong> → <strong>Tunnels</strong> → Tambahkan <strong>Public Hostname</strong> yang mengarah ke <code className="text-sky-300">HTTP localhost:5858</code>.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* 5. MODAL DAFTARKAN TOKO BARU */}
      {isNewStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl shadow-black/80 space-y-4 animate-smooth-modal">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-400" />
                <span>Daftarkan Klien / Toko Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewStoreModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStore} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nama Toko / Perusahaan:</label>
                <input
                  type="text"
                  required
                  value={newStoreForm.name}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, name: e.target.value })}
                  placeholder="Contoh: Toko Berkah Abadi"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Nama Pemilik (Owner):</label>
                <input
                  type="text"
                  value={newStoreForm.ownerName}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, ownerName: e.target.value })}
                  placeholder="Contoh: Haji Ahmad"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">No. WhatsApp / HP Toko:</label>
                <input
                  type="tel"
                  value={newStoreForm.phone}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, phone: e.target.value })}
                  placeholder="08123456789"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Subdomain Cloudflare:</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newStoreForm.subdomain}
                    onChange={(e) => setNewStoreForm({ ...newStoreForm, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="berkahabadi"
                    className="flex-1 px-3 py-2 rounded-l-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <span className="px-3 py-2 bg-slate-850 border border-l-0 border-slate-800 rounded-r-xl text-slate-400 font-mono text-[11px]">
                    .ketokopos.online
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Alamat akses online: <span className="text-amber-300 font-mono">https://{newStoreForm.subdomain || 'nama-toko'}.ketokopos.online</span>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Kode Cabang:</label>
                <input
                  type="text"
                  value={newStoreForm.branchId}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono"
                />
              </div>

              {/* Pilihan Cluster Database Supabase */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-300">Database Cloud (Cluster Supabase):</label>
                  <span className="text-[10px] text-emerald-400 font-bold">100% Free Tier</span>
                </div>

                <select
                  value={newStoreForm.clusterChoice}
                  onChange={(e) => {
                    setNewStoreForm({ ...newStoreForm, clusterChoice: e.target.value });
                    setModalClusterTestResult(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-medium text-xs transition-colors"
                >
                  {clusters.map((c) => {
                    const storesInC = registeredStores.filter(s => (s.clusterId || 'cluster-default') === c.id);
                    const isFull = storesInC.length >= (c.maxStores || 20);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} — {storesInC.length}/20 Toko {isFull ? '(Kapasitas 20 Penuh)' : '(Tersedia)'}
                      </option>
                    );
                  })}
                  <option value="new">+ Buat & Hubungkan Cluster Supabase Baru...</option>
                </select>

                {newStoreForm.clusterChoice === 'new' && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-2.5 mt-2 animate-fadeIn">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cluster Supabase Baru (Akun Free Tier Baru)</span>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Nama Cluster:</label>
                      <input
                        type="text"
                        value={newStoreForm.newClusterName}
                        onChange={(e) => setNewStoreForm({ ...newStoreForm, newClusterName: e.target.value })}
                        placeholder={`Cluster ${clusters.length + 1} (Supabase Cloud)`}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Project URL Supabase:</label>
                      <input
                        type="url"
                        value={newStoreForm.newClusterUrl}
                        onChange={(e) => setNewStoreForm({ ...newStoreForm, newClusterUrl: e.target.value })}
                        placeholder="https://xyzproject.supabase.co"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Anon Public Key:</label>
                      <input
                        type="password"
                        value={newStoreForm.newClusterKey}
                        onChange={(e) => setNewStoreForm({ ...newStoreForm, newClusterKey: e.target.value })}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        disabled={isTestingModalCluster || !newStoreForm.newClusterUrl || !newStoreForm.newClusterKey}
                        onClick={handleTestModalCluster}
                        className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-amber-200 text-[11px] font-bold border border-slate-750 transition-all flex items-center space-x-1"
                      >
                        <Activity className="w-3 h-3 text-amber-400" />
                        <span>{isTestingModalCluster ? 'Menguji...' : 'Uji Koneksi Supabase'}</span>
                      </button>

                      {modalClusterTestResult && (
                        <span className={`text-[10px] font-bold ${modalClusterTestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {modalClusterTestResult.success ? `✓ Terhubung (${modalClusterTestResult.latencyMs}ms)` : '✕ Gagal Konek'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Highlight Clean Database Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Database Toko Bersih Otomatis</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Toko baru akan langsung dimulai dengan <strong>data kosong bersih (0 Produk, 0 Transaksi)</strong>. Anda dapat menginput produk baru di Master Data atau import dari file Excel/CSV.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewStoreModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-750 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStore}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md flex items-center space-x-1.5 active:scale-95 transition-all shadow-emerald-600/20"
                >
                  <span>{isSubmittingStore ? 'Membuat Toko Bersih...' : 'Buat Toko Baru (Data Kosong)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL DAFTARKAN CLUSTER SUPABASE BARU */}
      {isNewClusterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl shadow-black/80 space-y-4 animate-smooth-modal">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                <span>Daftarkan Cluster Supabase Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewClusterModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewClusterFromTab} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nama Cluster Database:</label>
                <input
                  type="text"
                  required
                  value={newClusterForm.name}
                  onChange={(e) => setNewClusterForm({ ...newClusterForm, name: e.target.value })}
                  placeholder={`Contoh: Cluster ${clusters.length + 1} (Toko 21-40)`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Project URL Supabase:</label>
                <input
                  type="url"
                  required
                  value={newClusterForm.url}
                  onChange={(e) => setNewClusterForm({ ...newClusterForm, url: e.target.value })}
                  placeholder="https://xyzproject.supabase.co"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Anon Public API Key:</label>
                <textarea
                  required
                  rows={2}
                  value={newClusterForm.anonKey}
                  onChange={(e) => setNewClusterForm({ ...newClusterForm, anonKey: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-amber-500 text-[11px] transition-colors"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Catatan Tambahan (Opsional):</label>
                <input
                  type="text"
                  value={newClusterForm.notes}
                  onChange={(e) => setNewClusterForm({ ...newClusterForm, notes: e.target.value })}
                  placeholder="Contoh: Akun Supabase Kedua - Toko Samarinda Seberang"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Ping Live Test in New Cluster Modal */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  disabled={isTestingCluster || !newClusterForm.url || !newClusterForm.anonKey}
                  onClick={async () => {
                    setIsTestingCluster(true);
                    try {
                      const res = await testSupabaseConnection(newClusterForm.url, newClusterForm.anonKey);
                      alert(res.message);
                    } catch (e: any) {
                      alert('Gagal tes: ' + e?.message);
                    } finally {
                      setIsTestingCluster(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-amber-200 font-bold border border-slate-750 transition-all flex items-center space-x-1.5 active:scale-95"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isTestingCluster ? 'Menguji...' : 'Uji Koneksi Supabase'}</span>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewClusterModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-750 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black shadow-md flex items-center space-x-1.5 active:scale-95 transition-all shadow-sky-600/20"
                >
                  <span>Simpan Cluster Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
