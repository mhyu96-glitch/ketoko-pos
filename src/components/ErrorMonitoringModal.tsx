import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Search, 
  HardDrive,
  Zap
} from 'lucide-react';
import { errorTracker, type ErrorLogItem, type SystemHealthReport } from '../services/errorTracker';
import { CustomSelect } from './CustomSelect';

interface ErrorMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ErrorMonitoringModal: React.FC<ErrorMonitoringModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Subscribe to real-time errors
    const unsubscribe = errorTracker.subscribe((latestLogs) => {
      setLogs(latestLogs);
    });

    // Run initial health check
    runHealthCheck();

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const runHealthCheck = async () => {
    setLoadingHealth(true);
    try {
      const report = await errorTracker.checkSystemHealth();
      setHealth(report);
    } finally {
      setLoadingHealth(false);
    }
  };

  if (!isOpen) return null;

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (selectedSeverity !== 'ALL' && l.severity !== selectedSeverity) return false;
    if (selectedModule !== 'ALL' && l.module !== selectedModule) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = l.message.toLowerCase().includes(q);
      const matchMod = l.module.toLowerCase().includes(q);
      const matchStack = l.stack ? l.stack.toLowerCase().includes(q) : false;
      return matchMsg || matchMod || matchStack;
    }
    return true;
  });

  const handleCopySingle = (item: ErrorLogItem) => {
    const text = `[${item.timestamp}] [${item.severity}] [${item.module}] ${item.message}\n` +
      (item.stack ? `Stack Trace:\n${item.stack}\n` : '') +
      (item.context ? `Context:\n${JSON.stringify(item.context, null, 2)}\n` : '');
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyDiagnosticSummary = async () => {
    await errorTracker.copyDiagnosticSummary();
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleSimulateTestError = () => {
    errorTracker.captureError(
      new Error(`Uji Coba Tracking Eror: Simulasi deteksi gangguan pada ${new Date().toLocaleTimeString()}`),
      {
        trigger: 'Manual QA Button',
        memory: health?.memoryUsageMb,
        url: window.location.href
      },
      'WARNING',
      'KASIR'
    );
  };

  const overallColor = health?.overall === 'HEALTHY'
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : health?.overall === 'DEGRADED'
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-rose-700 bg-rose-50 border-rose-200';

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      <div className="bg-white w-full h-full flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black text-slate-900">Pusat Monitoring & Tracking Eror</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border flex items-center gap-1 ${overallColor}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                  {health?.overall || 'CHECKING'}
                </span>
              </div>
              <p className="text-xs text-slate-500">Pemantauan kesehatan database, sinkronisasi LAN, Customer Display, dan riwayat eror</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runHealthCheck}
              disabled={loadingHealth}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs"
              title="Periksa Ulang Kesehatan Sistem"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scroll">

          {/* 1. HEALTH METRICS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            
            {/* Database IndexedDB */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Database Lokal</span>
                <Database className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm font-black text-slate-900">IndexedDB</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {health?.indexedDbHealthy ? 'Sehat' : 'Gangguan'}
                </span>
              </div>
            </div>

            {/* Cloud & Internet */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Koneksi Cloud</span>
                {health?.cloudHealthy ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-amber-600" />}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm font-black text-slate-900">Supabase</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${health?.cloudHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {health?.cloudHealthy ? 'Online' : 'Offline Mode'}
                </span>
              </div>
            </div>

            {/* Service Worker PWA */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>PWA Cache</span>
                <HardDrive className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm font-black text-slate-900">Service Worker</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${health?.serviceWorkerActive ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'}`}>
                  {health?.serviceWorkerActive ? 'Aktif' : 'Standby'}
                </span>
              </div>
            </div>

            {/* Error Tracker Status */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Log Eror Aktif</span>
                <AlertTriangle className={`w-4 h-4 ${logs.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm font-black text-slate-900">{logs.length} Eror</span>
                <span className="text-[10px] font-medium text-slate-500">
                  RAM: {health?.memoryUsageMb ? `${health.memoryUsageMb} MB` : 'Normal'}
                </span>
              </div>
            </div>

          </div>

          {/* 2. FILTER & SEARCH TOOLBAR */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pesan eror, modul, atau stack trace..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 transition-colors font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Severity Filter */}
              <CustomSelect
                value={selectedSeverity}
                onChange={(val) => setSelectedSeverity(val)}
                variant="slate"
                size="sm"
                className="min-w-[165px]"
                options={[
                  { value: 'ALL', label: 'Semua Tingkat' },
                  { value: 'CRITICAL', label: 'Kritis (Critical)' },
                  { value: 'WARNING', label: 'Peringatan (Warning)' },
                  { value: 'INFO', label: 'Info' },
                ]}
              />

              {/* Module Filter */}
              <CustomSelect
                value={selectedModule}
                onChange={(val) => setSelectedModule(val)}
                variant="slate"
                size="sm"
                className="min-w-[175px]"
                options={[
                  { value: 'ALL', label: 'Semua Modul' },
                  { value: 'KASIR', label: 'Kasir POS' },
                  { value: 'CUSTOMER_DISPLAY', label: 'Layar Pelanggan' },
                  { value: 'LAN_SERVER', label: 'LAN Multi-Kasir' },
                  { value: 'CLOUD_SYNC', label: 'Sinkronisasi Cloud' },
                  { value: 'DATABASE', label: 'IndexedDB' },
                  { value: 'PRINTER', label: 'Printer Thermal' },
                  { value: 'SYSTEM', label: 'Sistem Core' },
                ]}
              />
            </div>
          </div>

          {/* 3. LOG ITEMS STREAM */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-200 custom-scroll">
              {filteredLogs.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
                  <p className="font-extrabold text-sm text-slate-700">Tidak Ada Eror yang Terdeteksi!</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Semua modul sistem kasir, sinkronisasi, dan layar pelanggan beroperasi normal tanpa kendala runtime.
                  </p>
                  <button
                    type="button"
                    onClick={handleSimulateTestError}
                    className="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Uji Coba Tracking (Simulasi Eror)</span>
                  </button>
                </div>
              ) : (
                filteredLogs.map((item) => {
                  const isExpanded = expandedLogId === item.id;
                  const sevColor = item.severity === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : item.severity === 'WARNING'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-blue-100 text-blue-800 border-blue-300';

                  return (
                    <div key={item.id} className="p-3 bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border shrink-0 mt-0.5 ${sevColor}`}>
                            {item.severity}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0 mt-0.5">
                            {item.module}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-snug break-words">
                              {item.message}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                              🕒 {item.timestamp}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopySingle(item)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Salin rincian eror"
                          >
                            {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          {item.stack && (
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-bold transition-colors"
                            >
                              {isExpanded ? 'Sembunyikan' : 'Detail'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Stack Trace & Metadata */}
                      {isExpanded && item.stack && (
                        <div className="mt-2.5 p-3 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto custom-scroll space-y-1.5 border border-slate-700 animate-fadeIn">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Stack Trace:</div>
                          <pre className="whitespace-pre-wrap leading-relaxed text-rose-300">
                            {item.stack}
                          </pre>
                          {item.context && (
                            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                              <span className="font-bold text-slate-300">Konteks Tambahan:</span> {JSON.stringify(item.context)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyDiagnosticSummary}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-all flex items-center gap-1.5 text-xs shadow-2xs active:scale-95"
              title="Salin seluruh ringkasan diagnostik untuk teknisi"
            >
              {copiedAll ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
              <span>{copiedAll ? 'Tersalin ke Clipboard!' : 'Salin Laporan'}</span>
            </button>

            <button
              type="button"
              onClick={() => errorTracker.exportLogsJson()}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-all flex items-center gap-1.5 text-xs shadow-2xs active:scale-95"
              title="Unduh file log error dalam format JSON"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm('Yakin ingin menghapus seluruh log eror dari riwayat?')) {
                  errorTracker.clearLogs();
                }
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-rose-600 font-bold hover:bg-rose-50 transition-all flex items-center gap-1.5 text-xs shadow-2xs active:scale-95"
              title="Bersihkan seluruh log eror"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Bersihkan</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateTestError}
              className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 font-bold hover:bg-amber-100 transition-all flex items-center gap-1.5 text-xs active:scale-95 shadow-2xs"
              title="Kirim 1 eror uji coba untuk mengetes tracking"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Test Eror</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-colors text-xs"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
