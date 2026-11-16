/**
 * Error Monitoring & Telemetry Tracking Service (Ketoko POS)
 * 100% Offline-First, Cross-Tab BroadcastChannel & LocalStorage Ring Buffer
 */

export type ErrorSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type ErrorModule =
  | 'KASIR'
  | 'CUSTOMER_DISPLAY'
  | 'LAN_SERVER'
  | 'CLOUD_SYNC'
  | 'DATABASE'
  | 'PRINTER'
  | 'BARCODE_SCANNER'
  | 'AUTH'
  | 'SYSTEM'
  | 'CHAT_KASIR';

export interface ErrorLogItem {
  id: string;
  timestamp: string;
  timeEpoch: number;
  severity: ErrorSeverity;
  module: ErrorModule;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  storeName?: string;
  branchName?: string;
  userRole?: string;
  userName?: string;
  url?: string;
  userAgent?: string;
  isResolved?: boolean;
  isCashierReport?: boolean;
  chatCategory?: string;
}

export interface SystemHealthReport {
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  indexedDbHealthy: boolean;
  lanHealthy: boolean;
  cloudHealthy: boolean;
  serviceWorkerActive: boolean;
  unresolvedErrorCount: number;
  memoryUsageMb?: number;
  uptimeSeconds: number;
  lastCheckedAt: string;
}

const STORAGE_KEY = 'ketoko_error_logs_v1';
const MAX_LOGS = 100;
const appStartTime = Date.now();

type ErrorListener = (logs: ErrorLogItem[]) => void;

class ErrorTrackerService {
  private logs: ErrorLogItem[] = [];
  private listeners: Set<ErrorListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private isInitialized = false;

  constructor() {
    this.loadLogsFromStorage();
    this.initBroadcastChannel();
    this.initGlobalHandlers();
  }

  private loadLogsFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.logs = parsed.slice(0, MAX_LOGS);
        }
      }
    } catch (e) {
      console.warn('[ErrorTracker] Gagal membaca storage error logs:', e);
      this.logs = [];
    }
  }

  private saveLogsToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs.slice(0, MAX_LOGS)));
    } catch (e) {
      console.warn('[ErrorTracker] Gagal menyimpan error logs:', e);
    }
  }

  private initBroadcastChannel(): void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel('ketoko_error_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'NEW_ERROR') {
          const item = event.data.payload as ErrorLogItem;
          // Avoid duplicate insertion
          if (!this.logs.some((l) => l.id === item.id)) {
            this.logs.unshift(item);
            if (this.logs.length > MAX_LOGS) this.logs.pop();
            this.saveLogsToStorage();
            this.notifyListeners();
          }
        } else if (event.data && event.data.type === 'CLEAR_ERRORS') {
          this.logs = [];
          this.saveLogsToStorage();
          this.notifyListeners();
        }
      };
    } catch {}
  }

  private initGlobalHandlers(): void {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // 1. Capture unhandled runtime JavaScript errors
    window.addEventListener('error', (event: ErrorEvent) => {
      // Ignore benign ResizeObserver loop limit errors
      if (event.message && event.message.includes('ResizeObserver')) return;

      this.captureError(
        event.error || event.message,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        },
        'CRITICAL',
        'SYSTEM'
      );
    });

    // 2. Capture unhandled Promise Rejections (e.g. failed async fetch or DB ops)
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason || 'Unhandled Promise Rejection');
      const stack = reason instanceof Error ? reason.stack : undefined;

      this.captureError(
        reason || message,
        {
          type: 'UnhandledPromiseRejection',
          stack
        },
        'CRITICAL',
        'SYSTEM'
      );
    });
  }

  public captureError(
    err: unknown,
    context?: Record<string, any>,
    severity: ErrorSeverity = 'CRITICAL',
    module: ErrorModule = 'SYSTEM'
  ): ErrorLogItem {
    let message = 'Unknown Error';
    let stack: string | undefined;

    if (err instanceof Error) {
      message = err.message || err.name;
      stack = err.stack;
    } else if (typeof err === 'string') {
      message = err;
    } else if (err && typeof err === 'object') {
      try {
        message = (err as any).message || JSON.stringify(err);
      } catch {
        message = String(err);
      }
    }

    // Ignore known noisy network disconnects during normal offline mode
    if (context?.suppressLog) {
      // return dummy
      return {
        id: `suppressed-${Date.now()}`,
        timestamp: new Date().toISOString(),
        timeEpoch: Date.now(),
        severity,
        module,
        message
      };
    }

    // Resolve store and user context silently
    let storeName = 'Toko Berkah Jaya';
    let branchName = 'Cabang Samarinda';
    let userRole = 'KASIR';
    let userName = 'Kasir Toko';

    try {
      const sess = sessionStorage.getItem('ketoko_current_user');
      if (sess) {
        const u = JSON.parse(sess);
        userRole = u.role || userRole;
        userName = u.name || u.username || userName;
      }
      const prof = localStorage.getItem('ketoko_store_profile_v1');
      if (prof) {
        const p = JSON.parse(prof);
        storeName = p.name || storeName;
        branchName = p.branch_name || branchName;
      }
    } catch {}

    const logItem: ErrorLogItem = {
      id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WITA',
      timeEpoch: Date.now(),
      severity,
      module,
      message: message.substring(0, 300),
      stack: stack ? stack.substring(0, 1000) : undefined,
      context,
      storeName: context?.storeName || storeName,
      branchName: context?.branchName || branchName,
      userRole: context?.userRole || userRole,
      userName: context?.userName || userName,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      isResolved: false
    };

    // Prepend to list
    this.logs.unshift(logItem);
    if (this.logs.length > MAX_LOGS) {
      this.logs.pop();
    }

    this.saveLogsToStorage();
    this.notifyListeners();

    // Broadcast across other tabs (e.g., Customer Display <-> Cashier)
    try {
      this.broadcastChannel?.postMessage({
        type: 'NEW_ERROR',
        payload: logItem
      });
    } catch {}

    // Also dispatch DOM event
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('ketoko_error_logged', { detail: logItem }));
      } catch {}
    }

    console.error(`[ErrorTracker] [${severity}] [${module}]`, message, { context, stack });
    return logItem;
  }

  /**
   * Mengirim laporan kendala / bug langsung dari chat kasir ke Superadmin
   */
  public reportFromCashier(params: {
    message: string;
    category?: string;
    severity?: ErrorSeverity;
    storeName?: string;
    branchName?: string;
    cashierName?: string;
    context?: Record<string, any>;
  }): ErrorLogItem {
    let storeName = params.storeName || 'Toko Default';
    let branchName = params.branchName || 'Cabang Utama';
    let userName = params.cashierName || 'Kasir';
    let userRole = 'CASHIER';

    try {
      const rawUser = sessionStorage.getItem('ketoko_current_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        userRole = u.role || userRole;
        userName = u.name || u.username || userName;
      }
      const prof = localStorage.getItem('ketoko_store_profile_v1');
      if (prof) {
        const p = JSON.parse(prof);
        storeName = p.name || storeName;
        branchName = p.branch_name || branchName;
      }
    } catch {}

    const logItem: ErrorLogItem = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WITA',
      timeEpoch: Date.now(),
      severity: params.severity || 'WARNING',
      module: 'CHAT_KASIR',
      message: `[Laporan Chat Kasir]: ${params.message}`,
      context: {
        category: params.category || 'Umum',
        ...params.context
      },
      storeName: params.storeName || storeName,
      branchName: params.branchName || branchName,
      userRole,
      userName: params.cashierName || userName,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      isResolved: false,
      isCashierReport: true,
      chatCategory: params.category || 'Umum'
    };

    this.logs.unshift(logItem);
    if (this.logs.length > MAX_LOGS) {
      this.logs.pop();
    }

    this.saveLogsToStorage();
    this.notifyListeners();

    try {
      this.broadcastChannel?.postMessage({
        type: 'NEW_ERROR',
        payload: logItem
      });
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('ketoko_error_logged', { detail: logItem }));
        window.dispatchEvent(new CustomEvent('ketoko_cashier_report_sent', { detail: logItem }));
      } catch {}
    }

    return logItem;
  }

  public getLogs(): ErrorLogItem[] {
    return [...this.logs];
  }

  public getUnresolvedCount(): number {
    return this.logs.filter((l) => !l.isResolved && l.severity !== 'INFO').length;
  }

  public markAsResolved(id: string): void {
    this.logs = this.logs.map((l) => (l.id === id ? { ...l, isResolved: true } : l));
    this.saveLogsToStorage();
    this.notifyListeners();
  }

  public markAllAsResolved(): void {
    this.logs = this.logs.map((l) => ({ ...l, isResolved: true }));
    this.saveLogsToStorage();
    this.notifyListeners();
  }

  public clearLogs(): void {
    this.logs = [];
    this.saveLogsToStorage();
    this.notifyListeners();
    try {
      this.broadcastChannel?.postMessage({ type: 'CLEAR_ERRORS' });
    } catch {}
  }

  public subscribe(listener: ErrorListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const current = this.getLogs();
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (e) {
        console.error('[ErrorTracker] Listener error:', e);
      }
    });
  }

  /**
   * Run live system health diagnostics
   */
  public async checkSystemHealth(): Promise<SystemHealthReport> {
    const unresolved = this.getUnresolvedCount();
    let indexedDbHealthy = true;
    let lanHealthy = true;
    let cloudHealthy = navigator.onLine;
    let serviceWorkerActive = false;

    // 1. Check IndexedDB
    try {
      if (typeof indexedDB !== 'undefined') {
        await indexedDB.databases?.().catch(() => []);
        indexedDbHealthy = true;
      }
    } catch {
      indexedDbHealthy = false;
    }

    // 2. Check ServiceWorker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      serviceWorkerActive = true;
    }

    // 3. Check memory if supported in Chromium
    let memoryUsageMb: number | undefined;
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      memoryUsageMb = Math.round((mem.usedJSHeapSize || 0) / (1024 * 1024));
    }

    // 4. Overall status
    let overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (!indexedDbHealthy || unresolved > 5) {
      overall = 'CRITICAL';
    } else if (unresolved > 0 || !cloudHealthy) {
      overall = 'DEGRADED';
    }

    return {
      overall,
      indexedDbHealthy,
      lanHealthy,
      cloudHealthy,
      serviceWorkerActive,
      unresolvedErrorCount: unresolved,
      memoryUsageMb,
      uptimeSeconds: Math.floor((Date.now() - appStartTime) / 1000),
      lastCheckedAt: new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WITA'
    };
  }

  /**
   * Export error logs to formatted JSON file
   */
  public exportLogsJson(): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Ketoko_Error_Logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  /**
   * Copy diagnostic text for sharing with developer / tech support
   */
  public async copyDiagnosticSummary(): Promise<string> {
    const health = await this.checkSystemHealth();
    const summary = [
      '==============================================',
      '  KETOKO POS - LAPORAN DIAGNOSTIK & MONITORING',
      '==============================================',
      `Waktu: ${new Date().toLocaleString('id-ID')}`,
      `Status Keseluruhan: ${health.overall}`,
      `IndexedDB Database: ${health.indexedDbHealthy ? 'NORMAL' : 'GANGGUAN'}`,
      `Koneksi Internet: ${health.cloudHealthy ? 'ONLINE' : 'OFFLINE'}`,
      `Service Worker (PWA): ${health.serviceWorkerActive ? 'AKTIF' : 'TIDAK AKTIF'}`,
      `Memori Digunakan: ${health.memoryUsageMb ? health.memoryUsageMb + ' MB' : 'N/A'}`,
      `Uptime: ${health.uptimeSeconds} detik`,
      `Total Log Eror: ${this.logs.length} (Belum Ditangani: ${health.unresolvedErrorCount})`,
      '----------------------------------------------',
      'DAFTAR EROR TERAKHIR:',
      ...this.logs.slice(0, 10).map((l, i) => 
        `[${i + 1}] [${l.timestamp}] [${l.severity}] [${l.module}] ${l.message}\n` +
        (l.stack ? `    Stack: ${l.stack.split('\n')[0]}\n` : '')
      ),
      '=============================================='
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(summary);
    }
    return summary;
  }
}

export const errorTracker = new ErrorTrackerService();
