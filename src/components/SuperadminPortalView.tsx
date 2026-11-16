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
  LogOut, 
  Users, 
  Settings, 
  Trash2, 
  RefreshCw, 
  Send, 
  Search, 
  Bell, 
  MoreVertical, 
  ChevronDown, 
  ChevronUp,
  ChevronRight,
  Wifi,
  HardDrive,
  LayoutDashboard, 
  CheckCircle, 
  Lightbulb,
  Globe,
  Activity,
  AlertTriangle,
  MessageSquare,
  Download,
  Copy,
  Check,
  Zap,
  Terminal
} from 'lucide-react';
import type { User } from '../types';
import { generateSuperAdminKey } from '../services/licenseService';
import { errorTracker, type ErrorLogItem, type SystemHealthReport } from '../services/errorTracker';
import { 
  getSupabaseClusters, 
  saveSupabaseCluster, 
  deleteSupabaseCluster, 
  testSupabaseConnection, 
  type SupabaseCluster,
  DEFAULT_SUPABASE_URL
} from '../api/supabaseClient';
import {
  testTelegramConnection,
  triggerWorkerSync,
  fetchWorkerHealth
} from '../services/telegramService';
import { fetchStoresFromCloud } from '../services/storeRegistry';

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

// -----------------------------------------------------------------------
// ENHANCED 3D CLAYMORPHISM SOFT ILLUSTRATIONS (FinTrack Warm Clay Style)
// -----------------------------------------------------------------------

// 3D Purple Clay Wallet
const ClayWallet3D = () => (
  <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
    <div className="w-13 h-12 rounded-[22px] bg-gradient-to-br from-[#9B87F5] via-[#6C5CE7] to-[#4834D4] shadow-[inset_-3px_-4px_8px_rgba(0,0,0,0.32),inset_3px_3px_6px_rgba(255,255,255,0.5),0_12px_24px_rgba(108,92,231,0.38)] transform rotate-[-4deg] relative flex items-center justify-center">
      <div className="absolute -top-2 right-2.5 w-5 h-5 rounded-full bg-gradient-to-br from-[#FFEAA7] via-[#FDCB6E] to-[#E17055] shadow-[inset_-1px_-1px_3px_rgba(0,0,0,0.25),0_4px_8px_rgba(253,203,110,0.6)] flex items-center justify-center text-[10px] font-black text-amber-900 border border-amber-200/70">
        ★
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4.5 h-4 bg-gradient-to-r from-[#5F27CD] to-[#4834D4] rounded-l-md shadow-inner flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FFEAA7] shadow-sm" />
      </div>
    </div>
  </div>
);

// 3D Green Clay Money Pouch
const ClayMoneyBag3D = () => (
  <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
    <div className="w-12 h-13 rounded-full bg-gradient-to-br from-[#55EFC4] via-[#2ECC71] to-[#009432] shadow-[inset_-3px_-4px_8px_rgba(0,0,0,0.32),inset_3px_3px_6px_rgba(255,255,255,0.5),0_12px_24px_rgba(46,204,113,0.38)] relative flex items-center justify-center">
      <div className="absolute -top-1.5 w-7 h-3 rounded-full bg-[#FFEAA7] shadow-sm border border-amber-300" />
      <span className="text-white font-black text-sm drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">Rp</span>
    </div>
  </div>
);

// 3D Coral Pink Clay Shopping Bag
const ClayShoppingBag3D = () => (
  <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
    <div className="w-12 h-13 rounded-[22px] bg-gradient-to-br from-[#FF9FF3] via-[#FF6B6B] to-[#EE5253] shadow-[inset_-3px_-4px_8px_rgba(0,0,0,0.28),inset_3px_3px_6px_rgba(255,255,255,0.5),0_12px_24px_rgba(238,82,83,0.35)] relative flex flex-col items-center">
      <div className="w-7 h-4.5 border-2 border-[#FFD2D2] rounded-t-full -mt-2.5 bg-transparent" />
      <div className="mt-2.5 w-3.5 h-4.5 bg-white/35 rounded-sm shadow-sm" />
    </div>
  </div>
);

// 3D Golden Clay Coins Stack
const ClayCoinsStack3D = () => (
  <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
    <div className="relative flex flex-col items-center">
      <div className="w-9 h-3 rounded-full bg-gradient-to-r from-[#FDCB6E] via-[#FFEAA7] to-[#E17055] shadow-[0_2px_4px_rgba(0,0,0,0.2)] border border-amber-300 -mb-1 z-30" />
      <div className="w-10 h-3.5 rounded-full bg-gradient-to-r from-[#FDCB6E] via-[#FFEAA7] to-[#E17055] shadow-[0_2px_4px_rgba(0,0,0,0.2)] border border-amber-300 -mb-1 z-20" />
      <div className="w-11 h-4.5 rounded-full bg-gradient-to-r from-[#FDCB6E] via-[#FFEAA7] to-[#E17055] shadow-[0_6px_12px_rgba(253,203,110,0.55)] border border-amber-300 z-10" />
      <div className="absolute -right-2 top-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#FFEAA7] to-[#FDCB6E] shadow-md border border-amber-200 flex items-center justify-center text-[10px] font-black text-amber-900">
        $
      </div>
    </div>
  </div>
);

// 3D Cute Pink Clay Piggy Bank
const ClayPiggyBank3D = () => (
  <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
    <div className="w-12 h-10 rounded-[20px] bg-gradient-to-br from-[#FFAFC5] via-[#FF80A5] to-[#E84393] shadow-[inset_-2px_-3px_6px_rgba(0,0,0,0.2),inset_3px_3px_5px_rgba(255,255,255,0.6),0_8px_18px_rgba(232,67,147,0.35)] relative flex items-center justify-center">
      <div className="absolute -top-1 left-2 w-3 h-3 rounded-tl-full bg-[#E84393] transform rotate-[-20deg]" />
      <div className="absolute -top-1 right-2 w-3 h-3 rounded-tr-full bg-[#E84393] transform rotate-[20deg]" />
      <div className="w-4 h-3 rounded-full bg-[#FFD1DC] shadow-inner flex items-center justify-center gap-0.5">
        <div className="w-1 h-1 rounded-full bg-[#C23616]" />
        <div className="w-1 h-1 rounded-full bg-[#C23616]" />
      </div>
      <div className="absolute top-2.5 left-2.5 w-1 h-1 rounded-full bg-slate-900" />
      <div className="absolute -top-2.5 w-4 h-4 rounded-full bg-gradient-to-br from-[#FFEAA7] to-[#FDCB6E] shadow-md border border-amber-200" />
    </div>
  </div>
);

// 3D Clay Yellow Lightbulb
const ClayLightbulb3D = () => (
  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFEAA7] via-[#FDCB6E] to-[#F39C12] shadow-[inset_-2px_-2px_5px_rgba(0,0,0,0.2),inset_2px_2px_5px_rgba(255,255,255,0.6),0_8px_16px_rgba(243,156,18,0.35)] flex items-center justify-center shrink-0">
    <Lightbulb className="w-5.5 h-5.5 text-amber-950 drop-shadow-sm fill-amber-200/50" />
  </div>
);

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tenants' | 'topology' | 'keygen' | 'cloud' | 'monitoring'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tab');
      if (t === 'monitoring' || t === 'tenants' || t === 'topology' || t === 'keygen' || t === 'cloud') {
        return t;
      }
    }
    return 'dashboard';
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Monitoring & Bug Tracker State (Vendor Telemetry)
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>(() => errorTracker.getLogs());
  const [systemHealth, setSystemHealth] = useState<SystemHealthReport | null>(null);
  const [unresolvedBugCount, setUnresolvedBugCount] = useState<number>(() => errorTracker.getUnresolvedCount());
  const [monitoringFilterModule, setMonitoringFilterModule] = useState<string>('ALL');
  const [monitoringFilterSeverity, setMonitoringFilterSeverity] = useState<string>('ALL');
  const [monitoringFilterStore, setMonitoringFilterStore] = useState<string>('ALL');
  const [monitoringSearch, setMonitoringSearch] = useState<string>('');
  const [expandedBugId, setExpandedBugId] = useState<string | null>(null);
  const [copiedBugId, setCopiedBugId] = useState<string | null>(null);
  const [copiedAllReport, setCopiedAllReport] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  useEffect(() => {
    const unsub = errorTracker.subscribe((logs) => {
      setErrorLogs(logs);
      setUnresolvedBugCount(errorTracker.getUnresolvedCount());
    });
    errorTracker.checkSystemHealth().then(setSystemHealth);
    return () => unsub();
  }, []);

  const handleRefreshHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const report = await errorTracker.checkSystemHealth();
      setSystemHealth(report);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const handleCopySingleBug = (item: ErrorLogItem) => {
    const text = `[${item.timestamp}] [${item.severity}] [${item.module}] [Toko: ${item.storeName || 'N/A'}] [Kasir: ${item.userName || 'N/A'}]\n` +
      `Pesan: ${item.message}\n` +
      (item.stack ? `Stack Trace:\n${item.stack}\n` : '') +
      (item.context ? `Konteks:\n${JSON.stringify(item.context, null, 2)}\n` : '');
    navigator.clipboard.writeText(text);
    setCopiedBugId(item.id);
    setTimeout(() => setCopiedBugId(null), 2000);
  };

  const handleCopyAllDiagnosticReport = async () => {
    await errorTracker.copyDiagnosticSummary();
    setCopiedAllReport(true);
    setTimeout(() => setCopiedAllReport(false), 2500);
  };

  const handleSimulateStoreBug = () => {
    errorTracker.captureError(
      new Error(`[Simulasi QA Superadmin] Gangguan kasir terdeteksi pada ${new Date().toLocaleTimeString('id-ID')}`),
      {
        simulatedBy: 'Superadmin Developer',
        activeStore: activeStoreName,
        url: window.location.href,
        userAgent: navigator.userAgent
      },
      'CRITICAL',
      'KASIR'
    );
  };

  // Filtered error logs
  const filteredErrorLogs = errorLogs.filter((l) => {
    if (monitoringFilterSeverity !== 'ALL' && l.severity !== monitoringFilterSeverity) return false;
    if (monitoringFilterModule !== 'ALL' && l.module !== monitoringFilterModule) return false;
    if (monitoringFilterStore !== 'ALL') {
      const storeName = l.storeName || '';
      if (!storeName.toLowerCase().includes(monitoringFilterStore.toLowerCase())) return false;
    }
    if (monitoringSearch.trim()) {
      const q = monitoringSearch.toLowerCase();
      const matchMsg = l.message.toLowerCase().includes(q);
      const matchMod = l.module.toLowerCase().includes(q);
      const matchStore = (l.storeName || '').toLowerCase().includes(q);
      const matchUser = (l.userName || '').toLowerCase().includes(q);
      const matchStack = l.stack ? l.stack.toLowerCase().includes(q) : false;
      return matchMsg || matchMod || matchStore || matchUser || matchStack;
    }
    return true;
  });

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
  const [clusterTestResults, setClusterTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }>>({});
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [isSubmittingStore, setIsSubmittingStore] = useState(false);

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
        productsCount: '1.503 Produk Sparepart AC (Aktif & Siap Digunakan)',
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
          const updated = parsed.map((s: RegisteredStore) => {
            if (s.productsCount && s.productsCount.includes('3.380')) {
              return { ...s, productsCount: s.productsCount.replace('3.380', '1.503') };
            }
            return s;
          });
          setRegisteredStores(updated);
          localStorage.setItem('ketoko_registered_stores', JSON.stringify(updated));
        }
      }
    } catch {}
  };

  useEffect(() => {
    syncStoresFromStorage();
    fetchStoresFromCloud().then(stores => {
      if (stores && stores.length > 0) {
        setRegisteredStores(stores as RegisteredStore[]);
      }
    });
    const handleClusterChange = () => {
      setClusters(getSupabaseClusters());
    };
    const handleStoresChange = () => {
      syncStoresFromStorage();
    };
    window.addEventListener('ketoko_supabase_clusters_changed', handleClusterChange);
    window.addEventListener('ketoko_registered_stores_changed', handleStoresChange);
    return () => {
      window.removeEventListener('ketoko_supabase_clusters_changed', handleClusterChange);
      window.removeEventListener('ketoko_registered_stores_changed', handleStoresChange);
    };
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
    try {
      const res = await testTelegramConnection();
      alert(res.message);
    } catch (e: any) {
      alert('Gagal: ' + (e?.message || 'Error jaringan'));
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTriggerWorkerSync = async () => {
    setIsTriggeringSync(true);
    try {
      const res = await triggerWorkerSync();
      alert(res.message);
    } catch (e: any) {
      alert('Gagal: ' + (e?.message || 'Error worker'));
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const handleCheckWorkerHealth = async () => {
    try {
      const res = await fetchWorkerHealth();
      alert(`Status Cloudflare Worker: ${res.data?.status || 'Active'}\nTotal Node: ${res.data?.configured_nodes || 2} Node Supabase\nJadwal Cron: ${res.data?.schedule || '08:00, 16:00, 23:00 WITA'}\nNode 1 Status: ${res.data?.nodes?.[0]?.status || 'healthy'}`);
    } catch (e: any) {
      alert('Gagal cek worker: ' + (e?.message || 'Error'));
    }
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

  const getStoreInitials = (name: string) => {
    const clean = name.replace(/^(cv\.|pt\.|ud\.|tb\.)\s*/i, '').trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (clean.slice(0, 2) || 'TK').toUpperCase();
  };

  const filteredStores = registeredStores.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.branch.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.ownerName && s.ownerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.subdomain && s.subdomain.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    // 🎨 WARM CREAM / OATMEAL CLAY BACKGROUND (Exact match to reference image #F5EFE6)
    <div className="min-h-screen bg-[#F5EFE6] text-slate-800 flex flex-col font-sans select-none antialiased p-3 sm:p-5">
      
      {/* Outer Layout: Floating Sidebar + Main Canvas */}
      <div className="flex-1 flex flex-col lg:flex-row gap-5 max-w-[1600px] w-full mx-auto">
        
        {/* ============================================================== */}
        {/* 1. LEFT FLOATING WHITE SIDEBAR (Exact match to "FinTrack")    */}
        {/* ============================================================== */}
        <aside className="w-full lg:w-64 xl:w-72 bg-white rounded-[32px] p-5 shadow-[0_12px_40px_rgba(160,150,140,0.12)] border border-white/80 flex flex-col justify-between shrink-0">
          
          <div className="space-y-6">
            {/* Logo / Brand Header */}
            <div className="flex items-center space-x-3 px-1 pt-1">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#7C4DFF] via-[#6C5CE7] to-[#5F27CD] shadow-[0_8px_18px_rgba(108,92,231,0.35)] flex items-center justify-center text-white">
                <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  Ketoko<span className="text-[#6C5CE7]">POS</span>
                </h1>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Superadmin Hub</span>
              </div>
            </div>

            {/* Navigation Menu List */}
            <nav className="space-y-1.5">
              
              {/* Tab: Dashboard */}
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`w-full px-4 py-3 rounded-2xl font-black text-xs flex items-center space-x-3 transition-all duration-200 ${
                  activeTab === 'dashboard'
                    ? 'bg-[#6C5CE7] text-white shadow-[0_8px_20px_rgba(108,92,231,0.35)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-bold'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard Utama</span>
              </button>

              {/* Tab: Daftar Klien / Toko */}
              <button
                type="button"
                onClick={() => setActiveTab('tenants')}
                className={`w-full px-4 py-3 rounded-2xl font-black text-xs flex items-center justify-between transition-all duration-200 ${
                  activeTab === 'tenants'
                    ? 'bg-[#6C5CE7] text-white shadow-[0_8px_20px_rgba(108,92,231,0.35)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-bold'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Store className="w-4 h-4 shrink-0" />
                  <span>Klien Toko (Tenants)</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'tenants' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {registeredStores.length}
                </span>
              </button>

              {/* Tab: Topologi Jaringan */}
              <button
                type="button"
                onClick={() => setActiveTab('topology')}
                className={`w-full px-4 py-3 rounded-2xl font-black text-xs flex items-center space-x-3 transition-all duration-200 ${
                  activeTab === 'topology'
                    ? 'bg-[#6C5CE7] text-white shadow-[0_8px_20px_rgba(108,92,231,0.35)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-bold'
                }`}
              >
                <Network className="w-4 h-4 shrink-0" />
                <span>Topologi Multi-Kasir</span>
              </button>

              {/* Tab: Keygen Lisensi */}
              <button
                type="button"
                onClick={() => setActiveTab('keygen')}
                className={`w-full px-4 py-3 rounded-2xl font-black text-xs flex items-center space-x-3 transition-all duration-200 ${
                  activeTab === 'keygen'
                    ? 'bg-[#6C5CE7] text-white shadow-[0_8px_20px_rgba(108,92,231,0.35)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-bold'
                }`}
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Generator Lisensi</span>
              </button>

              {/* Tab: Supabase & Cloudflare */}
              <button
                type="button"
                onClick={() => setActiveTab('cloud')}
                className={`w-full px-4 py-3 rounded-2xl font-black text-xs flex items-center space-x-3 transition-all duration-200 ${
                  activeTab === 'cloud'
                    ? 'bg-[#6C5CE7] text-white shadow-[0_8px_20px_rgba(108,92,231,0.35)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-bold'
                }`}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>Supabase & Cloudflare</span>
              </button>

              {/* Tab: Monitoring & Bug Tracker Toko (Vendor Telemetry) */}
              <button
                type="button"
                onClick={() => setActiveTab('monitoring')}
                className={`w-full px-4 py-3 rounded-2xl font-black text-xs flex items-center justify-between transition-all duration-200 ${
                  activeTab === 'monitoring'
                    ? 'bg-[#6C5CE7] text-white shadow-[0_8px_20px_rgba(108,92,231,0.35)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-bold'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Activity className="w-4 h-4 shrink-0" />
                  <span>Monitoring & Bug Toko</span>
                </div>
                {unresolvedBugCount > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-500 text-white animate-pulse">
                    {unresolvedBugCount} Bug
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                    Sehat
                  </span>
                )}
              </button>

              {/* Action: Pengaturan LAN */}
              <button
                type="button"
                onClick={onOpenLanModal}
                className="w-full px-4 py-3 rounded-2xl font-bold text-xs flex items-center space-x-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all duration-200"
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>Pengaturan Jaringan</span>
              </button>

            </nav>
          </div>

          {/* Bottom Card: Cute Purple Clay Card with Piggy Bank Illustration (Clean, No Clipping) */}
          <div className="mt-5 p-5 rounded-[26px] bg-gradient-to-br from-[#7C4DFF] via-[#6C5CE7] to-[#5F27CD] text-white shadow-[0_12px_24px_rgba(108,92,231,0.35)] relative overflow-hidden">
            <div className="relative z-10 space-y-2 pr-12">
              <h4 className="text-xs font-black tracking-tight leading-snug">
                Multi-Toko Bebas 🚀
              </h4>
              <p className="text-[11px] text-white/85 leading-relaxed font-medium">
                Daftarkan toko klien baru dengan database bersih mandiri.
              </p>
              
              <button
                type="button"
                onClick={() => setIsNewStoreModalOpen(true)}
                className="mt-2 w-full py-2.5 px-3 rounded-xl bg-white text-[#6C5CE7] font-black text-xs shadow-md hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ Daftarkan Toko</span>
              </button>
            </div>

            {/* 3D Piggy Bank Illustration */}
            <div className="absolute -bottom-1 -right-1 opacity-90 pointer-events-none transform scale-90">
              <ClayPiggyBank3D />
            </div>
          </div>

          {/* User Profile / Logout footer */}
          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFEAA7] via-[#FDCB6E] to-[#E17055] border-2 border-white shadow-sm flex items-center justify-center font-black text-xs text-amber-950 shrink-0">
                S
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-800 truncate">{currentUser.name}</div>
                <div className="text-[10px] text-emerald-600 font-bold truncate">Online • Master Developer</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
              title="Keluar dari Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </aside>

        {/* ============================================================== */}
        {/* 2. MAIN CONTENT CANVAS                                        */}
        {/* ============================================================== */}
        <main className="flex-1 flex flex-col space-y-5 min-w-0">
          
          {/* TOP HEADER: GREETING & SEARCH & AVATAR (Clean, No Truncation) */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Selamat pagi, Superadmin!</span>
                <span className="text-2xl">👋</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Berikut ringkasan operasional seluruh toko klien & infrastruktur cloud hari ini.
              </p>
            </div>

            {/* Right: Search Pill + Notification Bell + Avatar */}
            <div className="flex items-center space-x-3">
              {/* Search Pill */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari toko, subdomain..."
                  className="pl-9 pr-4 py-2.5 rounded-full bg-white border border-slate-200/70 shadow-[0_4px_16px_rgba(160,150,140,0.06)] text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/30 transition-all w-48 sm:w-60"
                />
              </div>

              {/* Notification Bell with Red Dot */}
              <button 
                type="button"
                onClick={() => alert(`Status Cloudflare: 100% Live (${registeredStores.length} Toko Terdaftar)`)}
                className="w-10 h-10 rounded-full bg-white border border-slate-200/70 shadow-[0_4px_16px_rgba(160,150,140,0.06)] flex items-center justify-center text-slate-700 hover:text-slate-900 hover:shadow-md transition-all relative shrink-0"
              >
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2.5 right-2.5 border-2 border-white" />
              </button>

              {/* 3D Character Avatar Circle */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A29BFE] via-[#6C5CE7] to-[#4834D4] border-2 border-white shadow-md flex items-center justify-center text-white font-black text-xs shrink-0">
                👨‍💻
              </div>

              {/* Direct POS CTA Button (Clean Text, No Truncation) */}
              <button
                type="button"
                onClick={() => onEnterStorePos()}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition-all active:scale-95 shrink-0"
                title={`Buka Kasir POS ${activeStoreName}`}
              >
                <Monitor className="w-3.5 h-3.5 text-amber-400" />
                <span>Buka Kasir POS</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </header>

          {/* VIEW: 1. DASHBOARD UTAMA (EXACT MATCH TO REFERENCE SCREENSHOT) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              
              {/* Telemetry & Health Alert Quick Banner (Superadmin Hub) */}
              <div className="bg-white rounded-[24px] p-4 shadow-[0_6px_20px_rgba(160,150,140,0.06)] border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
                <div className="flex items-center space-x-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    unresolvedBugCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {unresolvedBugCount > 0 ? <AlertTriangle className="w-5 h-5 animate-pulse" /> : <Activity className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800">
                        Telemetri & Bug Tracker Multi-Toko (Superadmin Developer)
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        unresolvedBugCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {unresolvedBugCount > 0 ? `${unresolvedBugCount} Bug Terdeteksi` : 'Terminal Sehat (100% Normal)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {unresolvedBugCount > 0
                        ? 'Ada gangguan operasional pada terminal kasir klien yang ditangkap secara senyap oleh sistem.'
                        : 'Kasir POS, Customer Display, Sinkronisasi LAN (Port 5858), dan Printer di seluruh toko beroperasi lancar.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('monitoring')}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shrink-0 active:scale-95 shadow-sm"
                >
                  <Activity className="w-3.5 h-3.5 text-[#A29BFE]" />
                  <span>Buka Bug Tracker Toko</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* ROW 1: 4 METRIC CARDS (Exact Match to 4 Clay Cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                
                {/* Card 1: Status Lisensi Vendor */}
                <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(160,150,140,0.08)] border border-white/80 flex items-center justify-between transition-transform hover:-translate-y-0.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Status Lisensi Vendor</span>
                      <button type="button" onClick={onOpenLicenseModal} className="text-slate-400 hover:text-slate-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      UNLIMITED
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        ↑ 100% Lifetime
                      </span>
                      <span className="text-[10px] text-slate-400">Multi-Toko Bebas</span>
                    </div>
                  </div>
                  <ClayWallet3D />
                </div>

                {/* Card 2: Klien Toko Terdaftar */}
                <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(160,150,140,0.08)] border border-white/80 flex items-center justify-between transition-transform hover:-translate-y-0.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Klien Toko Terdaftar</span>
                      <button type="button" onClick={() => setIsNewStoreModalOpen(true)} className="text-slate-400 hover:text-slate-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {registeredStores.length} Toko Aktif
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        ↑ 100% Online
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Toko Utama Aktif</span>
                    </div>
                  </div>
                  <ClayMoneyBag3D />
                </div>

                {/* Card 3: Database Master Kasir */}
                <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(160,150,140,0.08)] border border-white/80 flex items-center justify-between transition-transform hover:-translate-y-0.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Database Produk Kasir</span>
                      <button type="button" onClick={onInjectCatalog} className="text-slate-400 hover:text-slate-600" title="Inject Katalog">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {totalProductsLoaded.toLocaleString('id-ID')} Produk
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-bold text-[#6C5CE7] bg-[#6C5CE7]/10 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        ★ Siap Jual
                      </span>
                      {onInjectCatalog && (
                        <button 
                          type="button" 
                          onClick={onInjectCatalog} 
                          className="text-[10px] font-bold text-emerald-600 hover:underline"
                        >
                          + Inject 1.503
                        </button>
                      )}
                    </div>
                  </div>
                  <ClayShoppingBag3D />
                </div>

                {/* Card 4: Arsitektur Multi-Kasir */}
                <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(160,150,140,0.08)] border border-white/80 flex items-center justify-between transition-transform hover:-translate-y-0.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Arsitektur Multi-Kasir</span>
                      <button type="button" onClick={onOpenLanModal} className="text-slate-400 hover:text-slate-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      1 Server + 4 Klien
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        ↑ Port 5858
                      </span>
                      <span className="text-[10px] text-slate-400">LAN + Cloud Live</span>
                    </div>
                  </div>
                  <ClayCoinsStack3D />
                </div>

              </div>

              {/* ROW 2: SPENDING OVERVIEW (DONUT) & RECENT TRANSACTIONS (LIST) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Left Card (5 cols): "Spending Overview" -> Distribusi Master Data & Kategori */}
                <div className="lg:col-span-5 bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.1)] border border-white/80 flex flex-col justify-between">
                  
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-black text-slate-900">Distribusi Katalog Produk</h3>
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1">
                      <span>Semua Kategori</span>
                      <ChevronDown className="w-3 h-3" />
                    </span>
                  </div>

                  {/* Donut Chart & Legend */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                    
                    <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F1F2F6" strokeWidth="15" />
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#6C5CE7" strokeWidth="15" strokeDasharray="98 141" strokeDashoffset="0" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#2ECC71" strokeWidth="15" strokeDasharray="56 183" strokeDashoffset="-100" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#FDCB6E" strokeWidth="15" strokeDasharray="41 198" strokeDashoffset="-158" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#FF7675" strokeWidth="15" strokeDasharray="28 211" strokeDashoffset="-201" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#74B9FF" strokeWidth="15" strokeDasharray="16 223" strokeDashoffset="-231" strokeLinecap="round" />
                      </svg>
                      
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                        <span className="text-lg font-black text-slate-900 tracking-tight">1.503</span>
                        <span className="text-[10px] font-bold text-[#6C5CE7]">Produk AC</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-2.5 text-xs font-bold">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#6C5CE7]" />
                          <span className="text-slate-600 font-medium">Sparepart AC</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-900">620</span>
                          <span className="text-[11px] text-slate-400 font-normal">41%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71]" />
                          <span className="text-slate-600 font-medium">Pipa & Tembaga</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-900">350</span>
                          <span className="text-[11px] text-slate-400 font-normal">23%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FDCB6E]" />
                          <span className="text-slate-600 font-medium">Freon & Kimia</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-900">260</span>
                          <span className="text-[11px] text-slate-400 font-normal">17%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF7675]" />
                          <span className="text-slate-600 font-medium">Kompresor AC</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-900">175</span>
                          <span className="text-[11px] text-slate-400 font-normal">12%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#74B9FF]" />
                          <span className="text-slate-600 font-medium">Lain-lain / Tool</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-900">98</span>
                          <span className="text-[11px] text-slate-400 font-normal">7%</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Clean Bottom Pill Status */}
                  <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Toko: <b className="text-slate-900">{activeStoreName}</b></span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Sinkronisasi Otomatis</span>
                    </span>
                  </div>

                </div>

                {/* Right Card (7 cols): "Recent Transactions" -> Daftar Usaha Klien & Node Cloud Aktif */}
                <div className="lg:col-span-7 bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.1)] border border-white/80 flex flex-col justify-between">
                  
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Daftar Usaha Klien & Node Sistem</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Koneksi toko kasir, database cluster & edge deployment</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNewStoreModalOpen(true)}
                      className="text-xs font-bold text-[#6C5CE7] hover:underline bg-[#6C5CE7]/10 px-3 py-1.5 rounded-full"
                    >
                      + Tambah Toko
                    </button>
                  </div>

                  {/* Rich 4-Row System List (FinTrack Density) */}
                  <div className="space-y-2.5">
                    
                    {/* Item 1: Toko Utama Kasir (CV. Tumbuh Makmur) */}
                    <div className="p-3.5 rounded-2xl bg-[#F9F7FF] border border-[#6C5CE7]/30 shadow-sm flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#6C5CE7] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                          TM
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-slate-900 truncate">{activeStoreName}</h4>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">
                              AKTIF
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                            Cabang Samarinda ({activeStoreId}) • <a href="https://tumbuhmakmur.ketokopos.online" target="_blank" rel="noreferrer" className="text-[#6C5CE7] font-bold hover:underline">tumbuhmakmur.ketokopos.online</a>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEnterStorePos()}
                          className="px-3 py-1.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5F27CD] text-white font-black text-xs flex items-center space-x-1 shadow-sm transition-all active:scale-95"
                        >
                          <Monitor className="w-3 h-3" />
                          <span>Buka Kasir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearStore(registeredStores[0])}
                          className="p-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                          title="Kosongkan database toko ini"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={onOpenLicenseModal}
                          className="p-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          title="Lisensi Toko"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Item 2: Cluster 1 Database (Supabase Cloud) */}
                    <div className="p-3 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                          <Database className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 truncate">Cluster 1 Database (Supabase Cloud)</h4>
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              ● Terhubung
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            quhjgsoqjcumckoshjtv • 1.503 Produk Cloud Aktif
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-800 shrink-0">Free Tier 500 MB</span>
                    </div>

                    {/* Item 3: Cloudflare Pages Live Edge */}
                    <div className="p-3 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 truncate">Cloudflare Pages Live Edge</h4>
                            <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                              ● HTTP 200 OK
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            ketoko-pos.pages.dev • Deployment Otomatis GitHub
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-emerald-600 shrink-0">SSL Global</span>
                    </div>

                    {/* Item 4: Keep-Alive Cron Worker & Telegram */}
                    <div className="p-3 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#6C5CE7] flex items-center justify-center font-bold text-xs shrink-0">
                          <Send className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 truncate">Keep-Alive Cron & Bot Telegram</h4>
                            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                              ● Anti-Pause 24/7
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            @supabotborneo_bot • Ping otomatis 08:00, 16:00, 23:00 WITA
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-purple-600 shrink-0">2 Node Sehat</span>
                    </div>

                  </div>

                  {/* Direct Live Cloudflare Link Fallback Banner */}
                  <div className="mt-3.5 p-3 rounded-2xl bg-[#E8F8F5] border border-emerald-200 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-emerald-900 font-bold truncate">
                        Akses Cepat Cloudflare: <code className="text-emerald-800 font-mono">https://ketoko-pos.pages.dev</code>
                      </span>
                    </div>
                    <a
                      href="https://ketoko-pos.pages.dev"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-emerald-700 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Buka Langsung</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                </div>

              </div>

              {/* ROW 3: GOALS PROGRESS & SMART TIP (Exact Match & Balanced) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Goals Progress -> Status Infrastruktur Kasir */}
                <div className="lg:col-span-8 bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.1)] border border-white/80">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-black text-slate-900">Kesiapan Infrastruktur Sistem</h3>
                    <span className="text-xs font-bold text-[#6C5CE7] hover:underline cursor-pointer" onClick={() => setActiveTab('cloud')}>
                      Kelola Cloud & LAN
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Server LAN Toko */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#A8E6CF] to-[#3EDBF0] shadow-sm flex items-center justify-center shrink-0">
                        <Server className="w-6 h-6 text-slate-800" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-slate-900">Server Kasir LAN Toko</span>
                          <span className="text-[11px] font-bold text-emerald-600">Port 5858 (100%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full w-full" />
                        </div>
                        <div className="text-[10px] text-slate-500 flex justify-between font-medium">
                          <span>1 Server + 4 Klien Meja</span>
                          <span>Offline-First Siap</span>
                        </div>
                      </div>
                    </div>

                    {/* Cloudflare Pages */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DED2F9] to-[#7C4DFF] shadow-sm flex items-center justify-center shrink-0">
                        <Smartphone className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-slate-900">Cloudflare Pages & Tunnel</span>
                          <span className="text-[11px] font-bold text-[#6C5CE7]">SSL Aktif (100%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-[#6C5CE7] rounded-full w-full" />
                        </div>
                        <div className="text-[10px] text-slate-500 flex justify-between font-medium">
                          <span>HP & Tablet Owner</span>
                          <span>Edge Global Live</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Developer Studio & Smart Tips (Balanced & Useful) */}
                <div className="lg:col-span-4 bg-[#EDF7E7] rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.08)] border border-[#E0EFD5] flex flex-col justify-between space-y-3">
                  <div className="flex items-start space-x-3.5">
                    <ClayLightbulb3D />
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <span>Developer Studio</span>
                        <span>✨</span>
                      </h4>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        Database Supabase & Cloudflare Pages sinkron otomatis 24/7.
                      </p>
                    </div>
                  </div>

                  {/* 3 Status Pills */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                    <div className="p-2 rounded-xl bg-white/80 border border-emerald-200/60 text-emerald-800">
                      ⚡ 28ms Ping
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 border border-emerald-200/60 text-emerald-800">
                      🔒 SSL Aktif
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 border border-emerald-200/60 text-emerald-800">
                      ● Real-Time
                    </div>
                  </div>

                  {/* Quick Developer Action */}
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCheckWorkerHealth}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-white text-emerald-900 font-black text-[11px] shadow-sm hover:bg-emerald-50 transition-all text-center"
                    >
                      🩺 Cek /health
                    </button>
                    {onInjectCatalog && (
                      <button
                        type="button"
                        onClick={onInjectCatalog}
                        className="py-2 px-3 rounded-xl bg-emerald-700 text-white font-black text-[11px] shadow-sm hover:bg-emerald-800 transition-all text-center"
                      >
                        ⚡ Inject 1.503
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* VIEW: 2. TAB TENANTS (DETAIL TOKO) */}
          {activeTab === 'tenants' && (
            <div className="bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.1)] border border-white/80 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Manajemen Toko Klien (Tenants)</h3>
                  <p className="text-xs text-slate-500 font-medium">Setiap toko memiliki database dan subdomain tersendiri.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewStoreModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-[#6C5CE7] hover:bg-[#5F27CD] text-white font-black text-xs flex items-center space-x-1.5 shadow-md shadow-[#6C5CE7]/30 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Daftarkan Toko Baru</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStores.map(store => (
                  <div key={store.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-[#6C5CE7] text-white flex items-center justify-center font-black text-xs">
                          {getStoreInitials(store.name)}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{store.name}</h4>
                          <span className="text-xs text-slate-500">{store.branch}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {store.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                      <div>Akses Online: <a href={store.onlineDomain} target="_blank" rel="noreferrer" className="text-[#6C5CE7] font-bold hover:underline">{store.onlineDomain}</a></div>
                      <div>Kasir: <span className="font-bold">{store.cashierUser}</span> • Admin: <span className="font-bold">{store.adminUser}</span></div>
                      <div>Cluster: <span className="font-mono text-emerald-700 font-bold">{store.clusterName || 'Cluster 1 (Default)'}</span></div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onEnterStorePos(store)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#6C5CE7] text-white font-black text-xs flex items-center justify-center space-x-1"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Buka Kasir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearStore(store)}
                        className="p-2 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200"
                        title="Kosongkan data"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      {store.id !== 'store-01' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStoreClick(store)}
                          className="p-2 rounded-xl bg-rose-100 text-rose-800 hover:bg-rose-200"
                          title="Hapus toko"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: 3. TAB TOPOLOGY */}
          {activeTab === 'topology' && (
            <div className="bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.1)] border border-white/80 space-y-5">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">Arsitektur Topologi Multi-Kasir</h3>
                <p className="text-xs text-slate-500 font-medium">1 Server Pusat di toko + 4 Klien Meja Kasir (Port 5858) & Akses Online HP via Cloudflare.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="font-black text-amber-900 flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    <span>Komputer 1 (Server Pusat)</span>
                  </div>
                  <p className="text-slate-600">Komputer utama di toko yang menjalankan engine kasir di port 5858.</p>
                  <div className="bg-white p-2.5 rounded-xl font-mono text-[11px] text-slate-800 border border-amber-100">
                    http://IP-SERVER:5858
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
                  <div className="font-black text-purple-900 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Komputer 2, 3, 4, 5 (Kasir Klien)</span>
                  </div>
                  <p className="text-slate-600">Terminal kasir di meja kasir toko, terhubung lewat Wi-Fi / kabel LAN.</p>
                  <div className="bg-white p-2.5 rounded-xl font-mono text-[11px] text-slate-800 border border-purple-100">
                    Mode Client (Kasir Meja)
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
                  <div className="font-black text-sky-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span>HP / Tablet (Cloudflare Edge)</span>
                  </div>
                  <p className="text-slate-600">Akses online owner & kasir mobile dari mana saja lewat SSL HTTPS.</p>
                  <div className="bg-white p-2.5 rounded-xl font-mono text-[11px] text-slate-800 border border-sky-100">
                    tumbuhmakmur.ketokopos.online
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: 4. TAB KEYGEN */}
          {activeTab === 'keygen' && (
            <div className="bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.1)] border border-white/80 space-y-5 max-w-2xl">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">Generator Kunci Lisensi Resmi</h3>
                <p className="text-xs text-slate-500 font-medium">Buat serial key aktivasi aplikasi untuk komputer kasir pembeli.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Toko Pembeli:</label>
                  <input
                    type="text"
                    value={targetStoreName}
                    onChange={(e) => setTargetStoreName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium focus:ring-2 focus:ring-[#6C5CE7]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Machine ID Komputer Klien (Opsional):</label>
                  <input
                    type="text"
                    value={targetMachineId}
                    onChange={(e) => setTargetMachineId(e.target.value)}
                    placeholder="KPOS-XXXX-XXXX-XXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold focus:ring-2 focus:ring-[#6C5CE7]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Paket Lisensi:</label>
                  <select
                    value={targetPlan}
                    onChange={(e) => setTargetPlan(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold focus:ring-2 focus:ring-[#6C5CE7]"
                  >
                    <option value="PRO_LIFETIME">PRO LIFETIME — Permanen Selamanya</option>
                    <option value="ENTERPRISE_1Y">ENTERPRISE 1 TAHUN — Langganan</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="w-full py-3 rounded-xl bg-[#6C5CE7] hover:bg-[#5F27CD] text-white font-black text-xs shadow-md shadow-[#6C5CE7]/30 transition-all active:scale-95"
                >
                  Generate Serial Key Lisensi
                </button>

                {generatedKey && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <span className="text-[11px] font-black text-emerald-800 uppercase">Kunci Lisensi Berhasil Dibuat:</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedKey}
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-emerald-200 font-mono font-bold text-emerald-900 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                      >
                        {isCopied ? 'Tersalin!' : 'Salin'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: 5. TAB CLOUD */}
          {activeTab === 'cloud' && (
            <div className="bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.1)] border border-white/80 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Cluster Supabase & Cloudflare Keep-Alive</h3>
                  <p className="text-xs text-slate-500 font-medium">Monitoring status multi-cluster database gratis & bot Telegram anti-pause.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewClusterModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#6C5CE7] text-white font-black text-xs shadow-md"
                >
                  + Tambah Cluster
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clusters.map(cluster => (
                  <div key={cluster.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900">{cluster.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {cluster.isDefault ? 'Cluster Utama' : 'Cluster Eksternal'}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 truncate">{cluster.url}</div>
                    
                    {clusterTestResults[cluster.id] && (
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                        {clusterTestResults[cluster.id].message} ({clusterTestResults[cluster.id].latencyMs}ms)
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => handleTestCluster(cluster)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-700"
                      >
                        Uji Latensi Ping
                      </button>
                      {!cluster.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCluster(cluster)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Telegram & Worker Trigger Bar */}
              <div className="p-4 rounded-2xl bg-[#F0F3FA] border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <Send className="w-4 h-4 text-[#6C5CE7]" />
                  <span className="font-bold text-slate-800">Bot Telegram: @supabotborneo_bot (Keep-Alive Cron Aktif)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={isTestingTelegram}
                    onClick={handleTestTelegram}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-700"
                  >
                    {isTestingTelegram ? 'Mengirim...' : 'Kirim Tes Pesan'}
                  </button>
                  <button
                    type="button"
                    disabled={isTriggeringSync}
                    onClick={handleTriggerWorkerSync}
                    className="px-3 py-1.5 rounded-xl bg-[#6C5CE7] text-white font-bold"
                  >
                    Trigger Worker Sync
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckWorkerHealth}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    Cek /health
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: 6. TAB MONITORING & BUG TRACKER TOKO (VENDOR TELEMETRY) */}
          {activeTab === 'monitoring' && (
            <div className="space-y-6">
              
              {/* Top Banner / Heading */}
              <div className="bg-white rounded-[32px] p-6 shadow-[0_12px_36px_rgba(160,150,140,0.1)] border border-white/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#4834D4] text-white flex items-center justify-center shadow-lg shadow-[#6C5CE7]/30 shrink-0">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">
                        Pusat Monitoring & Telemetri Toko
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                        systemHealth?.overall === 'HEALTHY'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : systemHealth?.overall === 'DEGRADED'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                        {systemHealth?.overall || 'CHECKING'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Eror dari kasir, customer display, LAN sync, dan printer ditangkap secara senyap tanpa mengganggu kasir.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshHealth}
                    disabled={isLoadingHealth}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all active:scale-95"
                    title="Periksa Ulang Kesehatan Runtime"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin text-[#6C5CE7]' : ''}`} />
                    <span>Cek Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulateStoreBug}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition-all active:scale-95"
                    title="Kirim simulasi eror untuk menguji penangkapan telemetri"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tes Simulasi Bug</span>
                  </button>
                </div>
              </div>

              {/* 4 Clay Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                
                {/* Card 1: Total Bug Terdeteksi */}
                <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(160,150,140,0.08)] border border-white/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Total Bug Terdeteksi</span>
                    <Terminal className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {errorLogs.length} <span className="text-xs font-bold text-slate-400">Kejadian</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                    <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                      {errorLogs.filter(l => l.severity === 'CRITICAL').length} Kritis
                    </span>
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      {errorLogs.filter(l => l.severity === 'WARNING').length} Warning
                    </span>
                  </div>
                </div>

                {/* Card 2: Bug Belum Ditangani */}
                <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(160,150,140,0.08)] border border-white/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Belum Ditangani</span>
                    <AlertTriangle className={`w-4 h-4 ${unresolvedBugCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
                  </div>
                  <div className={`text-2xl font-black tracking-tight ${unresolvedBugCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {unresolvedBugCount} <span className="text-xs font-bold text-slate-400">Bug Aktif</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">Perlu Review Superadmin</span>
                    {unresolvedBugCount > 0 && (
                      <button
                        type="button"
                        onClick={() => errorTracker.markAllAsResolved()}
                        className="text-[10px] font-black text-[#6C5CE7] hover:underline"
                      >
                        Selesaikan Semua
                      </button>
                    )}
                  </div>
                </div>

                {/* Card 3: LAN Server & Jaringan Kasir */}
                <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(160,150,140,0.08)] border border-white/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Server LAN (Port 5858)</span>
                    <Wifi className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>PORT 5858</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-max">
                    ✓ Multi-Kasir SSE Aktif
                  </div>
                </div>

                {/* Card 4: Database & Resource RAM */}
                <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_30px_rgba(160,150,140,0.08)] border border-white/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Database & Heap RAM</span>
                    <HardDrive className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {systemHealth?.memoryUsageMb ? `${systemHealth.memoryUsageMb} MB` : 'Ringan'}
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full w-max">
                    ✓ IndexedDB + Supabase
                  </div>
                </div>

              </div>

              {/* Filter Toolbar */}
              <div className="bg-white rounded-[28px] p-4 shadow-[0_8px_24px_rgba(160,150,140,0.08)] border border-white/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                  
                  {/* Search Input */}
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={monitoringSearch}
                      onChange={(e) => setMonitoringSearch(e.target.value)}
                      placeholder="Cari pesan error, kasir, atau modul..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/30"
                    />
                  </div>

                  {/* Filter by Toko */}
                  <select
                    value={monitoringFilterStore}
                    onChange={(e) => setMonitoringFilterStore(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/30"
                  >
                    <option value="ALL">🏢 Semua Toko Klien</option>
                    {registeredStores.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  {/* Filter by Module */}
                  <select
                    value={monitoringFilterModule}
                    onChange={(e) => setMonitoringFilterModule(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/30"
                  >
                    <option value="ALL">📦 Semua Modul</option>
                    <option value="CHAT_KASIR">💬 Laporan Chat Kasir</option>
                    <option value="KASIR">Kasir POS</option>
                    <option value="CUSTOMER_DISPLAY">Customer Display (Layar Pembeli)</option>
                    <option value="LAN_SERVER">LAN Server & Sinkronisasi</option>
                    <option value="CLOUD_SYNC">Cloud Supabase</option>
                    <option value="DATABASE">IndexedDB Database</option>
                    <option value="PRINTER">Printer Kasir</option>
                    <option value="BARCODE_SCANNER">Barcode Scanner</option>
                    <option value="SYSTEM">Sistem Core</option>
                  </select>

                  {/* Filter by Severity */}
                  <select
                    value={monitoringFilterSeverity}
                    onChange={(e) => setMonitoringFilterSeverity(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/30"
                  >
                    <option value="ALL">⚠️ Semua Severity</option>
                    <option value="CRITICAL">🔴 Kritis (Critical)</option>
                    <option value="WARNING">🟠 Peringatan (Warning)</option>
                    <option value="INFO">🔵 Informasi (Info)</option>
                  </select>
                </div>

                <div className="text-[11px] font-bold text-slate-400">
                  Menampilkan <span className="text-slate-800 font-black">{filteredErrorLogs.length}</span> dari {errorLogs.length} log
                </div>
              </div>

              {/* Bug Logs Feed / List */}
              <div className="space-y-3">
                {filteredErrorLogs.length === 0 ? (
                  <div className="bg-white rounded-[32px] p-12 text-center shadow-[0_12px_36px_rgba(160,150,140,0.08)] border border-white/80 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-black text-slate-900">
                      Sistem Kasir 100% Bersih & Sehat
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Tidak ada rekaman gangguan operasional dari kasir atau customer display toko klien.
                    </p>
                  </div>
                ) : (
                  filteredErrorLogs.map((item) => {
                    const isExpanded = expandedBugId === item.id;
                    const isCritical = item.severity === 'CRITICAL';
                    const isWarning = item.severity === 'WARNING';

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-[24px] p-4 sm:p-5 shadow-[0_6px_20px_rgba(160,150,140,0.06)] border transition-all ${
                          item.isResolved
                            ? 'border-slate-200/60 opacity-75'
                            : isCritical
                            ? 'border-rose-300 shadow-[0_8px_24px_rgba(244,63,94,0.12)]'
                            : isWarning
                            ? 'border-amber-300'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Header Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Severity / Chat Pill */}
                            {item.isCashierReport || item.module === 'CHAT_KASIR' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center gap-1 shadow-sm">
                                <MessageSquare className="w-3 h-3" />
                                <span>CHAT KASIR</span>
                              </span>
                            ) : (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isCritical
                                    ? 'bg-rose-500 text-white'
                                    : isWarning
                                    ? 'bg-amber-400 text-amber-950'
                                    : 'bg-sky-500 text-white'
                                }`}
                              >
                                {item.severity}
                              </span>
                            )}

                            {/* Store Name Badge */}
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center gap-1">
                              <Store className="w-3 h-3" />
                              <span>{item.storeName || activeStoreName}</span>
                            </span>

                            {/* Cashier / User Badge */}
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              <span>{item.userName || 'Kasir Default'}</span>
                            </span>

                            {/* Module Badge / Category */}
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                              [{item.chatCategory || item.context?.category || item.module}]
                            </span>

                            {/* Timestamp */}
                            <span className="text-[10px] text-slate-400 font-medium">
                              {item.timestamp}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            {/* Resolved status button */}
                            {item.isResolved ? (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Terselesaikan</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => errorTracker.markAsResolved(item.id)}
                                className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                                title="Tandai bug ini sudah diperbaiki"
                              >
                                <Check className="w-3 h-3" />
                                <span>Tandai Selesai</span>
                              </button>
                            )}

                            {/* Copy single button */}
                            <button
                              type="button"
                              onClick={() => handleCopySingleBug(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Salin Data Eror"
                            >
                              {copiedBugId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Accordion toggle */}
                            <button
                              type="button"
                              onClick={() => setExpandedBugId(isExpanded ? null : item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Buka / Tutup Detail Stack Trace"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Error Message / Cashier Chat */}
                        <div className="pt-2.5">
                          {item.isCashierReport || item.module === 'CHAT_KASIR' ? (
                            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/80 via-[#fcf8f4] to-indigo-50/50 border border-purple-200/80 space-y-1.5 shadow-2xs">
                              <div className="flex items-center justify-between text-[11px] text-purple-950 font-black">
                                <span className="flex items-center gap-1.5">
                                  <MessageSquare className="w-3.5 h-3.5 text-[#6C5CE7]" />
                                  <span>Laporan Masuk dari Kasir ({item.userName}):</span>
                                </span>
                                {item.context?.cartTotalFormatted && (
                                  <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                    🛒 {item.context.cartItemCount} Item ({item.context.cartTotalFormatted})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-slate-900 leading-relaxed italic">
                                "{item.message.replace(/^\[Laporan Chat Kasir\]:\s*/, '')}"
                              </p>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs font-black text-slate-900 leading-relaxed font-mono">
                                {item.message}
                              </p>
                              {item.url && (
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                  Halaman: {item.url}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Expanded Stack Trace & Device Diagnostics */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 animate-fadeIn">
                            {item.stack && (
                              <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                  Stack Trace (Jejak Baris Kode):
                                </div>
                                <pre className="p-3 rounded-xl bg-slate-900 text-rose-300 font-mono text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-48 border border-slate-800">
                                  {item.stack}
                                </pre>
                              </div>
                            )}

                            {item.context && Object.keys(item.context).length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                  Parameter Konteks Diagnostik:
                                </div>
                                <pre className="p-2.5 rounded-xl bg-slate-50 text-slate-700 font-mono text-[10px] border border-slate-200 overflow-x-auto">
                                  {JSON.stringify(item.context, null, 2)}
                                </pre>
                              </div>
                            )}

                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                              <span><strong>Browser:</strong> {item.userAgent || 'Chrome/Windows'}</span>
                              <span><strong>Cabang:</strong> {item.branchName || 'Cabang Utama'}</span>
                              <span><strong>User Role:</strong> {item.userRole || 'CASHIER'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Action Footer */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
                <div className="flex items-center space-x-2 text-slate-600 font-bold">
                  <Activity className="w-4 h-4 text-[#6C5CE7]" />
                  <span>Sistem Telemetri & Crash Reporting Vendor Ketoko POS</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllDiagnosticReport}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                  >
                    {copiedAllReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAllReport ? 'Laporan Disalin!' : 'Salin Laporan Lengkap'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => errorTracker.exportLogsJson()}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Hapus seluruh riwayat log eror dari memori?')) {
                        errorTracker.clearLogs();
                      }
                    }}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bersihkan Log</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* MODAL 1: DAFTARKAN TOKO BARU (Clay White Style)               */}
          {/* ============================================================== */}
          {isNewStoreModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white border border-slate-100 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-4 animate-smooth-modal">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-[#6C5CE7] text-white flex items-center justify-center shadow-md">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">Daftarkan Toko Klien Baru</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Database & Lisensi Terisolasi</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewStoreModalOpen(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddStore} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Toko / Usaha:</label>
                    <input
                      type="text"
                      required
                      value={newStoreForm.name}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, name: e.target.value })}
                      placeholder="Contoh: Toko Berkah Abadi"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Pemilik (Owner):</label>
                    <input
                      type="text"
                      value={newStoreForm.ownerName}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, ownerName: e.target.value })}
                      placeholder="Contoh: Haji Ahmad"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Subdomain Cloudflare:</label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={newStoreForm.subdomain}
                        onChange={(e) => setNewStoreForm({ ...newStoreForm, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        placeholder="berkahabadi"
                        className="flex-1 px-3.5 py-2.5 rounded-l-xl bg-slate-50 border border-slate-200 text-[#6C5CE7] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                      <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-slate-500 font-mono text-[11px]">
                        .ketokopos.online
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Database Cloud (Cluster Supabase):</label>
                    <select
                      value={newStoreForm.clusterChoice}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, clusterChoice: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]"
                    >
                      {clusters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Supabase Cloud Free Tier)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                    💡 Toko baru otomatis dimulai dengan <strong>data bersih (0 Produk, 0 Transaksi)</strong>.
                  </div>

                  <div className="pt-2 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsNewStoreModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingStore}
                      className="px-5 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5F27CD] text-white font-black shadow-md shadow-[#6C5CE7]/30 transition-all active:scale-95"
                    >
                      {isSubmittingStore ? 'Menyimpan...' : 'Buat Toko Baru'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* MODAL 2: DAFTARKAN CLUSTER SUPABASE BARU                       */}
          {/* ============================================================== */}
          {isNewClusterModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white border border-slate-100 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-4 animate-smooth-modal">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-black text-sm text-slate-900">Daftarkan Cluster Supabase Baru</h3>
                  <button
                    type="button"
                    onClick={() => setIsNewClusterModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveNewClusterFromTab} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Cluster:</label>
                    <input
                      type="text"
                      required
                      value={newClusterForm.name}
                      onChange={(e) => setNewClusterForm({ ...newClusterForm, name: e.target.value })}
                      placeholder={`Cluster ${clusters.length + 1}`}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Project URL Supabase:</label>
                    <input
                      type="url"
                      required
                      value={newClusterForm.url}
                      onChange={(e) => setNewClusterForm({ ...newClusterForm, url: e.target.value })}
                      placeholder="https://xyz.supabase.co"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Anon Public Key:</label>
                    <textarea
                      required
                      rows={2}
                      value={newClusterForm.anonKey}
                      onChange={(e) => setNewClusterForm({ ...newClusterForm, anonKey: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px]"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsNewClusterModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#6C5CE7] text-white font-bold"
                    >
                      Simpan Cluster
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>

      </div>

    </div>
  );
};
