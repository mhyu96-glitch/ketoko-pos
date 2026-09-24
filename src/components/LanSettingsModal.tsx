import React, { useState, useEffect } from 'react';
import { 
  X, 
  Network, 
  Server, 
  Laptop, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  RefreshCw, 
  Globe, 
  ShieldCheck, 
  Info,
  Radio,
  Cloud,
  ExternalLink,
  Upload,
  Download,
  FileCode2,
  Zap,
  Check
} from 'lucide-react';
import { lanService, type LanConfig, type LanMode, type LanServerStatus } from '../services/lanService';
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection, clearSupabaseConfig } from '../api/supabaseClient';
import { syncService } from '../services/syncService';

interface LanSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: (config: LanConfig) => void;
  onProductsSyncRequired?: () => Promise<void>;
}

export const LanSettingsModal: React.FC<LanSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
  onProductsSyncRequired
}) => {
  const [config, setConfig] = useState<LanConfig>(lanService.getConfig());
  const [activeTab, setActiveTab] = useState<LanMode | 'SUPABASE'>(config.mode);
  const [serverUrlInput, setServerUrlInput] = useState(config.serverUrl);
  const [terminalIdInput, setTerminalIdInput] = useState(config.terminalId);
  const [terminalNameInput, setTerminalNameInput] = useState(config.terminalName);

  // Status states
  const [electronStatus, setElectronStatus] = useState<LanServerStatus | null>(null);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs: number; error?: string; storeName?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedTunnel, setCopiedTunnel] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cloudflare Tunnel State
  const [tunnelInfo, setTunnelInfo] = useState<{ active: boolean; url: string | null; status: string; error: string | null }>({
    active: false,
    url: null,
    status: 'stopped',
    error: null
  });
  const [isTogglingTunnel, setIsTogglingTunnel] = useState(false);

  // Supabase State
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; latencyMs?: number; message?: string } | null>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [supabaseSyncMessage, setSupabaseSyncMessage] = useState<string | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;

    const current = lanService.getConfig();
    setConfig(current);
    if (activeTab !== 'SUPABASE') {
      setActiveTab(current.mode);
    }
    setServerUrlInput(current.serverUrl);
    setTerminalIdInput(current.terminalId);
    setTerminalNameInput(current.terminalName);
    setPingResult(null);

    // Load Supabase Config
    const supaCfg = getSupabaseConfig();
    setSupabaseUrlInput(supaCfg.url);
    setSupabaseKeyInput(supaCfg.anonKey);
    setSupabaseTestResult(null);
    setSupabaseSyncMessage(null);

    // Count pending offline queue
    syncService.getPendingCount().then(c => setPendingQueueCount(c));

    // Fetch server status from electron backend if in electron
    lanService.getLocalElectronServerStatus().then(st => {
      if (st) setElectronStatus(st);
    });

    // Check Cloudflare Tunnel status
    lanService.getTunnelStatus().then(t => {
      setTunnelInfo(t);
    });

    // Probe current configured serverUrl if in CLIENT mode
    if (current.serverUrl) {
      lanService.testConnection(current.serverUrl).then(res => {
        setPingResult({
          success: res.success,
          latencyMs: res.latencyMs,
          error: res.error,
          storeName: res.status?.store_profile?.name
        });
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setPingResult(null);
    try {
      const res = await lanService.testConnection(serverUrlInput);
      setPingResult({
        success: res.success,
        latencyMs: res.latencyMs,
        error: res.error,
        storeName: res.status?.store_profile?.name
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleTunnel = async () => {
    setIsTogglingTunnel(true);
    try {
      if (tunnelInfo.active || tunnelInfo.status === 'running') {
        await lanService.stopTunnel();
        setTunnelInfo({ active: false, url: null, status: 'stopped', error: null });
      } else {
        await lanService.startTunnel();
        setTunnelInfo(prev => ({ ...prev, status: 'starting' }));

        // Poll every 1.5 seconds for up to 15 seconds to grab the generated HTTPS URL
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const st = await lanService.getTunnelStatus();
          setTunnelInfo(st);
          if (st.active || attempts >= 10) {
            clearInterval(interval);
            setIsTogglingTunnel(false);
          }
        }, 1500);
        return;
      }
    } catch (err: any) {
      setTunnelInfo(prev => ({ ...prev, status: 'error', error: err.message }));
    } finally {
      setIsTogglingTunnel(false);
    }
  };

  const handleSaveAndApply = async () => {
    if (activeTab === 'SUPABASE') {
      saveSupabaseConfig(supabaseUrlInput.trim(), supabaseKeyInput.trim());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      return;
    }

    const updated = lanService.saveConfig({
      mode: activeTab,
      serverUrl: serverUrlInput.trim(),
      terminalId: terminalIdInput.trim() || 'KASIR-01',
      terminalName: terminalNameInput.trim() || 'Kasir',
      autoSync: true
    });
    setConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);

    if (onConfigChanged) {
      onConfigChanged(updated);
    }

    // Jika mode Klien, tawarkan sync produk langsung
    if (activeTab === 'CLIENT' && onProductsSyncRequired) {
      setIsSyncingProducts(true);
      try {
        await onProductsSyncRequired();
      } finally {
        setIsSyncingProducts(false);
      }
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyTunnel = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedTunnel(true);
    setTimeout(() => setCopiedTunnel(false), 2000);
  };

  const handleTestSupabase = async () => {
    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      setSupabaseTestResult({
        success: false,
        message: 'Masukkan URL dan Anon Public Key Supabase terlebih dahulu.'
      });
      return;
    }

    setIsTestingSupabase(true);
    setSupabaseTestResult(null);
    try {
      const res = await testSupabaseConnection(supabaseUrlInput.trim(), supabaseKeyInput.trim());
      setSupabaseTestResult(res);
      if (res.success) {
        saveSupabaseConfig(supabaseUrlInput.trim(), supabaseKeyInput.trim());
      }
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handlePushCatalog = async () => {
    setIsSyncingSupabase(true);
    setSupabaseSyncMessage(null);
    try {
      const res = await syncService.pushCatalogToSupabase((p) => {
        setSupabaseSyncMessage(`Mengupload ke Supabase Cloud: ${p.current} / ${p.total} produk (${p.percent}%)...`);
      });
      if (res.success) {
        setSupabaseSyncMessage(`✅ Berhasil mengupload ${res.totalUploaded.toLocaleString('id-ID')} produk ke Supabase Cloud!`);
      } else {
        setSupabaseSyncMessage(`❌ Gagal: ${res.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      setSupabaseSyncMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handlePullCatalog = async () => {
    setIsSyncingSupabase(true);
    setSupabaseSyncMessage(null);
    try {
      const res = await syncService.pullFromSupabase();
      if (res.error) {
        setSupabaseSyncMessage(`❌ Gagal: ${res.error}`);
      } else {
        setSupabaseSyncMessage(`✅ Berhasil mendownload ${res.count.toLocaleString('id-ID')} produk dari Supabase Cloud ke lokal!`);
        if (onProductsSyncRequired) await onProductsSyncRequired();
      }
    } catch (err: any) {
      setSupabaseSyncMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleFlushPendingQueue = async () => {
    setIsSyncingSupabase(true);
    try {
      const res = await syncService.reconcileQueue();
      const remain = await syncService.getPendingCount();
      setPendingQueueCount(remain);
      setSupabaseSyncMessage(`✅ Selesai: ${res.syncedCount} transaksi offline terkirim ke Supabase! (Sisa antrean: ${remain})`);
    } catch (err: any) {
      setSupabaseSyncMessage(`❌ Error saat sync: ${err.message}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header - Coklat Latte Elegan */}
        <div className="p-4 sm:p-5 border-b border-[#5e3519] bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#543017] text-amber-200 border border-[#9b663b]/50 shadow-xs">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <span>Jaringan LAN, Online Cloudflare & Supabase</span>
              </h3>
              <p className="text-xs text-[#fcefe3]">
                Kelola multi-kasir kabel LAN, akses online HP luar rumah, serta sinkronisasi cloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#fcefe3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#ebdccf] bg-[#f5ede4]/60 p-2 gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('SERVER')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shrink-0 ${
              activeTab === 'SERVER'
                ? 'bg-[#7c4e2f] text-white shadow-sm'
                : 'text-[#6c4830] hover:bg-[#ebdccf]/60'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Mode Server (Master)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CLIENT')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shrink-0 ${
              activeTab === 'CLIENT'
                ? 'bg-[#7c4e2f] text-white shadow-sm'
                : 'text-[#6c4830] hover:bg-[#ebdccf]/60'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Mode Klien (Kasir LAN)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SUPABASE')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shrink-0 ${
              activeTab === 'SUPABASE'
                ? 'bg-[#166534] text-white shadow-sm'
                : 'text-[#166534] bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>☁️ Cloud Supabase</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STANDALONE')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shrink-0 ${
              activeTab === 'STANDALONE'
                ? 'bg-[#7c4e2f] text-white shadow-sm'
                : 'text-[#6c4830] hover:bg-[#ebdccf]/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Mandiri (Single PC)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-[#3d2617] text-xs">

          {/* ================= TAB 1: SERVER MODE ================= */}
          {activeTab === 'SERVER' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">Server LAN Aktif di Komputer Ini</h4>
                  <p className="text-emerald-700 mt-0.5 leading-relaxed">
                    Komputer ini menyimpan <strong>Database Terpusat SQLite (ACID)</strong>. Semua kasir lain yang terhubung ke kabel LAN atau Wi-Fi toko akan membaca produk dan mengirim transaksi ke sini.
                  </p>
                </div>
              </div>

              {/* 1. Alamat IP LAN Lokal */}
              <div>
                <label className="font-bold text-[#5c3c26] block mb-1.5 flex items-center justify-between">
                  <span>Alamat IP Lokal (Untuk Kasir Satu Wi-Fi / Kabel LAN Toko):</span>
                  <span className="text-[10px] text-[#8a6b53] font-normal">Port Default: 5858</span>
                </label>

                <div className="space-y-2">
                  {electronStatus && electronStatus.ips && electronStatus.ips.length > 0 ? (
                    electronStatus.ips.map((ip, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#dfcebe] shadow-2xs"
                      >
                        <div className="flex items-center space-x-2.5">
                          <Globe className="w-4 h-4 text-[#7c4e2f]" />
                          <div>
                            <span className="font-mono font-bold text-sm text-[#166534]">{ip.url}</span>
                            <span className="text-[10px] text-[#8a6b53] ml-2">({ip.iface})</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(ip.url, idx)}
                          className="px-2.5 py-1 rounded-lg bg-[#faebd7] hover:bg-[#ebdccf] text-[#7c4e2f] font-bold text-[11px] flex items-center space-x-1 transition-all"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                      Mendeteksi jaringan... (Bila terhubung kabel LAN atau Wi-Fi, alamat IP lokal akan muncul otomatis di sini).
                    </div>
                  )}
                </div>
              </div>

              {/* 2. CARD KHUSUS: CLOUDFLARE TUNNEL (ONLINE LUAR RUMAH) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#fbf6f0] to-[#f4ebe1] border-2 border-[#dfcebe] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-[#7c4e2f] text-white">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[#3d2617] text-sm flex items-center gap-1.5">
                        <span>Akses Online Luar Rumah (Cloudflare Tunnel)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#faebd7] text-[#7c4e2f] border border-[#dfcebe]">
                          GRATIS & RESMI
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#8a6b53]">
                        Buka link agar HP konsumen di luar rumah (data seluler) bisa membuka katalog & kasir
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleTunnel}
                    disabled={isTogglingTunnel}
                    className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs flex items-center space-x-1.5 transition-all shadow-xs ${
                      tunnelInfo.active
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-[#166534] hover:bg-[#14532d] text-white'
                    }`}
                  >
                    {isTogglingTunnel ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menghubungkan...</span>
                      </>
                    ) : tunnelInfo.active ? (
                      <span>Matikan Tunnel</span>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>🚀 Aktifkan Akses Online</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Tunnel URL Box if Active */}
                {tunnelInfo.active && tunnelInfo.url ? (
                  <div className="p-3.5 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center text-emerald-800 font-bold text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-2" />
                        Link Website Online Publik Toko Aktif (HTTPS):
                      </span>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Siap Dibuka dari HP Luar
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={tunnelInfo.url}
                        className="flex-1 px-3 py-2 bg-[#f8fafc] text-[#166534] font-mono font-bold text-xs rounded-xl border border-emerald-200 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyTunnel(tunnelInfo.url!)}
                        className="px-3.5 py-2 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-all active:scale-95 shrink-0"
                      >
                        {copiedTunnel ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Link</span>
                          </>
                        )}
                      </button>
                      <a
                        href={tunnelInfo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-[#faebd7] hover:bg-[#ebdccf] text-[#7c4e2f] rounded-xl border border-[#dfcebe] transition-colors shrink-0"
                        title="Buka link di browser"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <p className="text-[11px] text-[#7c4e2f] bg-[#fcf8f4] p-2 rounded-lg border border-[#eed7c4]">
                      💡 <strong>Tips Toko:</strong> Salin link di atas lalu kirimkan via WhatsApp ke konsumen Anda. Konsumen di luar rumah cukup mengeklik link tersebut dari HP mereka untuk langsung melihat katalog toko!
                    </p>
                  </div>
                ) : tunnelInfo.status === 'starting' ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 flex items-center space-x-2 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                    <span>Sedang membuat tunnel aman via Cloudflare... URL publik akan otomatis muncul dalam beberapa detik.</span>
                  </div>
                ) : (
                  <div className="p-3 bg-white/70 rounded-xl border border-[#e4d5c7] text-[#8a6b53] text-[11px]">
                    Tekan tombol <strong>"🚀 Aktifkan Akses Online"</strong> di atas. Cloudflare akan secara otomatis menghubungkan komputer toko Anda ke link internet publik HTTPS secara gratis, aman, dan tanpa perlu IP publik statis!
                  </div>
                )}
              </div>

              {/* Petunjuk Langkah demi Langkah */}
              <div className="p-4 rounded-2xl bg-[#f5ede4] border border-[#ddc3aa] space-y-2">
                <h5 className="font-bold text-[#5c3c26] flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-[#7c4e2f]" />
                  <span>Petunjuk Multi-Kasir Toko:</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1.5 text-[#543c2e] leading-relaxed">
                  <li>Komputer kasir lain di toko cukup membuka browser (Google Chrome / Edge) lalu mengetik alamat IP lokal di atas.</li>
                  <li>Untuk konsumen di luar rumah, gunakan tombol **Cloudflare Tunnel** di atas dan bagikan link HTTPS ke mereka via WhatsApp.</li>
                  <li>Untuk mencadangkan seluruh data transaksi ke cloud secara otomatis, konfigurasikan tab <strong>☁️ Cloud Supabase</strong> di atas.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ================= TAB 2: CLIENT MODE ================= */}
          {activeTab === 'CLIENT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex items-start space-x-3">
                <Laptop className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sky-900 text-sm">Mode Klien (Terminal Kasir Cabang)</h4>
                  <p className="text-sky-700 mt-0.5 leading-relaxed">
                    Komputer ini akan mengambil stok dan mengirim seluruh transaksi langsung ke Komputer Server pusat via jaringan LAN.
                  </p>
                </div>
              </div>

              {/* Form Input Server URL */}
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-[#5c3c26] block mb-1">
                    Alamat URL Server LAN:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      placeholder="http://192.168.1.100:5858"
                      className="flex-1 px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] font-mono text-xs focus:border-[#7c4e2f] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || !serverUrlInput.trim()}
                      className="px-4 py-2 bg-[#7c4e2f] hover:bg-[#633e26] disabled:opacity-50 text-white font-bold rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                    </button>
                  </div>
                </div>

                {/* Hasil Tes Koneksi (Ping) */}
                {pingResult && (
                  <div className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                    pingResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {pingResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      {pingResult.success ? (
                        <>
                          <div className="font-bold flex items-center justify-between">
                            <span>Terhubung ke Server: {pingResult.storeName || 'Ketoko Central'}</span>
                            <span className="font-mono text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                              {pingResult.latencyMs} ms
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Koneksi LAN lancar. Komputer ini siap bertransaksi dengan database terpusat.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="font-bold">Gagal Terhubung ke Server</div>
                          <p className="text-[11px] text-rose-700 mt-0.5">
                            {pingResult.error || 'Server tidak merespons. Pastikan komputer server sudah menyala dan terhubung ke kabel LAN yang sama.'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Nama / ID Terminal Kasir */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-bold text-[#5c3c26] block mb-1">
                      ID Terminal Kasir:
                    </label>
                    <input
                      type="text"
                      value={terminalIdInput}
                      onChange={(e) => setTerminalIdInput(e.target.value)}
                      placeholder="KASIR-01"
                      className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] font-mono text-xs focus:border-[#7c4e2f]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[#5c3c26] block mb-1">
                      Nama Kasir / Lokasi:
                    </label>
                    <input
                      type="text"
                      value={terminalNameInput}
                      onChange={(e) => setTerminalNameInput(e.target.value)}
                      placeholder="Kasir Depan"
                      className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:border-[#7c4e2f]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: SUPABASE CLOUD DATABASE ================= */}
          {activeTab === 'SUPABASE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3">
                <Cloud className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                    <span>Arsitektur Hybrid Offline-First (Supabase PostgreSQL)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-200 text-emerald-900 font-extrabold">
                      ANTI MATI LAMPU
                    </span>
                  </h4>
                  <p className="text-emerald-800 mt-1 leading-relaxed">
                    Sistem kasir Anda <strong>tetap berjalan 100% saat offline</strong> (tanpa internet / Wi-Fi mati). Transaksi disimpan di antrean lokal. Begitu ada internet, data <strong>otomatis disinkronkan ke Supabase Cloud</strong> tanpa kehilangan data sedikitpun!
                  </p>
                </div>
              </div>

              {/* Form Input Supabase */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-[#dfcebe] shadow-2xs">
                <div>
                  <label className="font-bold text-[#5c3c26] block mb-1 flex items-center justify-between">
                    <span>Supabase Project URL:</span>
                    <span className="text-[10px] text-[#8a6b53]">Contoh: https://xyzcompany.supabase.co</span>
                  </label>
                  <input
                    type="text"
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full px-3 py-2 bg-[#fcf8f4] text-[#3d2617] rounded-xl border border-[#dfcebe] font-mono text-xs focus:border-[#166534] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#5c3c26] block mb-1 flex items-center justify-between">
                    <span>Supabase Anon Public Key:</span>
                    <span className="text-[10px] text-[#8a6b53]">Kunci publik anonim aman untuk client</span>
                  </label>
                  <textarea
                    rows={2}
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 bg-[#fcf8f4] text-[#3d2617] rounded-xl border border-[#dfcebe] font-mono text-xs focus:border-[#166534] focus:bg-white resize-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestSupabase}
                    disabled={isTestingSupabase}
                    className="px-4 py-2 bg-[#166534] hover:bg-[#14532d] disabled:opacity-50 text-white font-bold rounded-xl flex items-center space-x-1.5 transition-all shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                    <span>{isTestingSupabase ? 'Menguji Supabase...' : 'Uji Koneksi Supabase'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      saveSupabaseConfig(supabaseUrlInput.trim(), supabaseKeyInput.trim());
                      setSaveSuccess(true);
                      setTimeout(() => setSaveSuccess(false), 2000);
                    }}
                    className="px-3.5 py-2 bg-[#f5ece3] hover:bg-[#faebd7] text-[#5c3c26] font-bold rounded-xl border border-[#dfcebe] transition-colors"
                  >
                    Simpan Kredensial
                  </button>

                  {supabaseUrlInput && (
                    <button
                      type="button"
                      onClick={() => {
                        clearSupabaseConfig();
                        setSupabaseUrlInput('');
                        setSupabaseKeyInput('');
                        setSupabaseTestResult(null);
                      }}
                      className="px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl font-semibold transition-colors"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {/* Hasil Tes Koneksi Supabase */}
                {supabaseTestResult && (
                  <div className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                    supabaseTestResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {supabaseTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 text-xs">
                      <div className="font-bold flex items-center justify-between">
                        <span>{supabaseTestResult.success ? 'Koneksi Supabase Berhasil!' : 'Koneksi Supabase Gagal'}</span>
                        {supabaseTestResult.latencyMs && (
                          <span className="font-mono text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                            {supabaseTestResult.latencyMs} ms
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5">{supabaseTestResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Antrean Sinkronisasi Offline & Aksi Manual */}
              <div className="p-4 rounded-2xl bg-white border border-[#dfcebe] shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-[#3d2617] text-xs">Sinkronisasi Data Master & Transaksi</h5>
                    <p className="text-[11px] text-[#8a6b53]">Upload katalog produk ke cloud atau kirim antrean nota offline</p>
                  </div>
                  {pendingQueueCount > 0 ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                      {pendingQueueCount} Nota Belum Disinkronkan
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Semua Nota Terkirim ke Cloud
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handlePushCatalog}
                    disabled={isSyncingSupabase || !supabaseUrlInput}
                    className="p-2.5 bg-[#fcf8f4] hover:bg-[#faebd7] disabled:opacity-40 text-[#5c3c26] border border-[#dfcebe] rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#7c4e2f]" />
                    <span>Upload Master Produk</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePullCatalog}
                    disabled={isSyncingSupabase || !supabaseUrlInput}
                    className="p-2.5 bg-[#fcf8f4] hover:bg-[#faebd7] disabled:opacity-40 text-[#5c3c26] border border-[#dfcebe] rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-[#7c4e2f]" />
                    <span>Download dari Cloud</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFlushPendingQueue}
                    disabled={isSyncingSupabase || pendingQueueCount === 0}
                    className="p-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
                    <span>Sync Antrean ({pendingQueueCount})</span>
                  </button>
                </div>

                {supabaseSyncMessage && (
                  <div className="p-2.5 rounded-xl bg-[#f5ede4] text-[#5c3c26] text-[11px] font-semibold animate-fadeIn border border-[#ddc3aa]">
                    {supabaseSyncMessage}
                  </div>
                )}
              </div>

              {/* Info Skrip SQL Schema Supabase */}
              <div className="p-3.5 rounded-2xl bg-[#fcf8f4] border border-[#ddc3aa] space-y-1.5">
                <div className="flex items-center space-x-2 text-[#7c4e2f] font-bold">
                  <FileCode2 className="w-4 h-4" />
                  <span>Skrip SQL Tabel Supabase Sudah Siap:</span>
                </div>
                <p className="text-[11px] text-[#543c2e] leading-relaxed">
                  Skrip database lengkap (tabel produk, transaksi, pelanggan, hutang/piutang, dan trigger potong stok otomatis) telah dibuat di file: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#dfcebe] font-bold text-[#166534]">supabase_schema.sql</code> di folder aplikasi Ketoko POS. Anda cukup menyalin isi file tersebut dan menempelkannya di menu <strong>SQL Editor</strong> dashboard Supabase Anda.
                </p>
              </div>
            </div>
          )}

          {/* ================= TAB 4: STANDALONE MODE ================= */}
          {activeTab === 'STANDALONE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start space-x-3">
                <Radio className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900 text-sm">Mode Mandiri (Single PC / Offline Standalone)</h4>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    Mode ini cocok jika toko Anda hanya memiliki 1 komputer kasir tunggal tanpa jaringan multi-kasir. Semua data tersimpan di IndexedDB internal komputer ini secara penuh.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#ebdccf] bg-[#f5ede4]/70 flex items-center justify-between">
          <div className="text-[11px]">
            {saveSuccess && (
              <span className="text-emerald-700 font-bold flex items-center space-x-1 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pengaturan berhasil disimpan!</span>
              </span>
            )}
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#ddc3aa] bg-white hover:bg-[#faebd7] text-[#5c3c26] font-bold text-xs"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={isSyncingProducts || isSyncingSupabase}
              className="px-5 py-2 rounded-xl bg-[#7c4e2f] hover:bg-[#633e26] text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all"
            >
              {isSyncingProducts ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyinkronkan Produk...</span>
                </>
              ) : (
                <span>Terapkan Pengaturan</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
