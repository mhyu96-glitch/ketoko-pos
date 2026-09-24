import type { Product, Transaction } from '../types';

export type LanMode = 'SERVER' | 'CLIENT' | 'STANDALONE';

export interface LanConfig {
  mode: LanMode;
  serverUrl: string; // e.g. "http://192.168.1.100:5858"
  terminalId: string; // e.g. "KASIR-01"
  terminalName: string; // e.g. "Kasir Depan"
  autoSync: boolean;
}

export interface LanServerStatus {
  status?: string;
  running: boolean;
  port: number;
  ips: Array<{ iface: string; address: string; url: string }>;
  connectedClients?: number;
  total_products?: number;
  total_transactions?: number;
  store_profile?: any;
  tunnel?: {
    status: 'stopped' | 'starting' | 'running' | 'error';
    url: string | null;
    error: string | null;
  };
}

const STORAGE_KEY = 'ketoko_lan_config';

const DEFAULT_CONFIG: LanConfig = {
  mode: 'STANDALONE',
  serverUrl: 'http://192.168.1.100:5858',
  terminalId: 'KASIR-01',
  terminalName: 'Kasir Utama',
  autoSync: true
};

class LanService {
  private config: LanConfig;
  private eventSource: EventSource | null = null;
  private isOnlineWithServer = false;

  constructor() {
    this.config = this.loadConfig();
  }

  public loadConfig(): LanConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {}
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(updates: Partial<LanConfig>): LanConfig {
    this.config = { ...this.config, ...updates };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      window.dispatchEvent(new CustomEvent('ketoko_lan_config_updated', { detail: this.config }));
    } catch {}
    return this.config;
  }

  public getConfig(): LanConfig {
    return { ...this.config };
  }

  public isServerMode(): boolean {
    return this.config.mode === 'SERVER';
  }

  public isClientMode(): boolean {
    return this.config.mode === 'CLIENT';
  }

  public getIsConnected(): boolean {
    return this.isOnlineWithServer;
  }

  /**
   * Tes koneksi ke Server LAN dengan menghitung latency (ping)
   */
  public async testConnection(serverUrl: string = this.config.serverUrl): Promise<{
    success: boolean;
    latencyMs: number;
    status?: any;
    error?: string;
  }> {
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${cleanUrl}/api/lan/status`, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      this.isOnlineWithServer = true;
      return { success: true, latencyMs, status: data };
    } catch (err: any) {
      this.isOnlineWithServer = false;
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs,
        error: err.name === 'AbortError' ? 'Koneksi timeout (Server tidak merespons)' : err.message
      };
    }
  }

  /**
   * Mengambil status server lokal dari Electron main process jika aplikasi berjalan di desktop Electron
   */
  public async getLocalElectronServerStatus(): Promise<LanServerStatus | null> {
    try {
      const electronApi = (window as any).electronAPI;
      if (electronApi && electronApi.lan && typeof electronApi.lan.getStatus === 'function') {
        const raw = await electronApi.lan.getStatus();
        return {
          running: !!raw.running,
          port: raw.port || 5858,
          ips: raw.ips || [],
          connectedClients: raw.connectedClients || 0
        };
      }
    } catch (err) {
      console.warn('[LanService] Error fetching electron lan status:', err);
    }
    return null;
  }

  /**
   * Ambil seluruh produk dari server pusat (untuk mode Klien)
   */
  public async fetchCentralProducts(serverUrl: string = this.config.serverUrl): Promise<Product[]> {
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/lan/products`, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil data produk dari server: HTTP ${res.status}`);
    }

    const json = await res.json();
    return json.data || [];
  }

  /**
   * Kirim transaksi kasir langsung ke Server Pusat (Atomic Checkout)
   */
  public async submitTransaction(
    trx: Transaction,
    config: LanConfig = this.config
  ): Promise<{
    success: boolean;
    error?: string;
    updatedStocks?: Array<{ id: string; stock: number }>;
  }> {
    const cleanUrl = config.serverUrl.replace(/\/+$/, '');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const payload = {
        ...trx,
        terminal_id: config.terminalId,
        cashier_name: trx.cashier_name || config.terminalName
      };

      const res = await fetch(`${cleanUrl}/api/lan/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Terminal-Id': config.terminalId
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      this.isOnlineWithServer = true;
      return {
        success: true,
        updatedStocks: result.updated_stocks || []
      };
    } catch (err: any) {
      this.isOnlineWithServer = false;
      return {
        success: false,
        error: err.name === 'AbortError' ? 'Koneksi ke Server terputus saat checkout' : err.message
      };
    }
  }

  /**
   * Kirim batch transaksi offline ke Server setelah reconnect
   */
  public async pushOfflineTransactions(
    transactions: Transaction[],
    serverUrl: string = this.config.serverUrl
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!transactions || transactions.length === 0) {
      return { success: true, count: 0 };
    }

    const cleanUrl = serverUrl.replace(/\/+$/, '');
    try {
      const res = await fetch(`${cleanUrl}/api/lan/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions })
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      return { success: true, count: data.synced_count || 0 };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  }

  /**
   * Listen Real-Time Stock Updates & Events dari Server via SSE
   */
  public initEventSource(
    onStockUpdate: (stocks: Array<{ id: string; stock: number }>) => void,
    onProductUpdate?: (prod: Product) => void,
    onTransactionCreated?: (data: any) => void
  ): () => void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.config.mode !== 'CLIENT') {
      return () => {};
    }

    const cleanUrl = this.config.serverUrl.replace(/\/+$/, '');
    const sseUrl = `${cleanUrl}/api/lan/events`;

    try {
      const es = new EventSource(sseUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.isOnlineWithServer = true;
        window.dispatchEvent(new CustomEvent('ketoko_lan_status_changed', { detail: { connected: true } }));
      };

      es.onerror = () => {
        this.isOnlineWithServer = false;
        window.dispatchEvent(new CustomEvent('ketoko_lan_status_changed', { detail: { connected: false } }));
      };

      es.addEventListener('transaction_created', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.updated_stocks) {
            onStockUpdate(data.updated_stocks);
          }
          if (onTransactionCreated) {
            onTransactionCreated(data);
          }
        } catch {}
      });

      es.addEventListener('product_updated', (e: MessageEvent) => {
        try {
          const prod = JSON.parse(e.data);
          if (prod && onProductUpdate) {
            onProductUpdate(prod);
          }
        } catch {}
      });

      es.addEventListener('purchase_created', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.updated_stocks) {
            onStockUpdate(data.updated_stocks);
          }
        } catch {}
      });

      return () => {
        es.close();
        if (this.eventSource === es) {
          this.eventSource = null;
        }
      };
    } catch (err) {
      console.warn('[LanService] SSE Connection error:', err);
      return () => {};
    }
  }

  /**
   * Mengambil status Cloudflare Tunnel (Akses Online Publik)
   */
  public async getTunnelStatus(serverUrl: string = ''): Promise<{
    active: boolean;
    url: string | null;
    status: string;
    error: string | null;
  }> {
    try {
      const base = serverUrl.replace(/\/+$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
      const res = await fetch(`${base}/api/lan/tunnel`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) return { active: false, url: null, status: 'stopped', error: `HTTP ${res.status}` };
      const data = await res.json();
      const t = data.tunnel || {};
      return {
        active: t.status === 'running' && Boolean(t.url),
        url: t.url || null,
        status: t.status || 'stopped',
        error: t.error || null
      };
    } catch (err: any) {
      return { active: false, url: null, status: 'stopped', error: err.message };
    }
  }

  /**
   * Menyalakan Cloudflare Tunnel untuk membuka akses online HP konsumen dari luar
   */
  public async startTunnel(serverUrl: string = ''): Promise<{ success: boolean; message?: string; tunnel?: any }> {
    try {
      const base = serverUrl.replace(/\/+$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
      const res = await fetch(`${base}/api/lan/tunnel/start`, { method: 'POST' });
      const data = await res.json();
      return { success: true, ...data };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Mematikan Cloudflare Tunnel
   */
  public async stopTunnel(serverUrl: string = ''): Promise<{ success: boolean }> {
    try {
      const base = serverUrl.replace(/\/+$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
      await fetch(`${base}/api/lan/tunnel/stop`, { method: 'POST' });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Mengambil riwayat transaksi dari Server LAN terpusat
   */
  public async fetchCentralTransactions(limit = 100, serverUrl: string = this.config.serverUrl): Promise<Transaction[]> {
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    try {
      const res = await fetch(`${cleanUrl}/api/lan/transactions?limit=${limit}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('[LanService] Gagal fetch transaksi dari server:', err);
      return [];
    }
  }

  /**
   * Mengambil data pembelian barang dari Server LAN terpusat
   */
  public async fetchCentralPurchases(serverUrl: string = this.config.serverUrl): Promise<any[]> {
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    try {
      const res = await fetch(`${cleanUrl}/api/lan/purchases`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Kirim faktur pembelian baru ke Server LAN terpusat
   */
  public async submitPurchase(purchase: any, serverUrl: string = this.config.serverUrl): Promise<{ success: boolean; updatedStocks?: any[]; error?: string }> {
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    try {
      const res = await fetch(`${cleanUrl}/api/lan/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchase)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      return { success: true, updatedStocks: data.updated_stocks || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Kirim perubahan produk / stok ke Server LAN terpusat
   * Otomatis memicu broadcast SSE 'product_updated' ke semua kasir yang terhubung
   */
  public async submitProduct(
    prod: Partial<Product> & { id: string },
    serverUrl?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const urlsToTry: string[] = [];
    if (serverUrl) {
      urlsToTry.push(serverUrl);
    }
    if (this.isClientMode() && this.config.serverUrl) {
      urlsToTry.push(this.config.serverUrl);
    }
    urlsToTry.push('http://127.0.0.1:4040', 'http://localhost:4040');
    if (typeof window !== 'undefined' && window.location.origin) {
      urlsToTry.push(window.location.origin);
    }

    const uniqueUrls = Array.from(new Set(urlsToTry.map(u => u.replace(/\/+$/, ''))));

    for (const base of uniqueUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`${base}/api/lan/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Terminal-Id': this.config.terminalId
          },
          body: JSON.stringify(prod),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          return { success: true, data: json.data };
        }
      } catch {}
    }

    return { success: false, error: 'Tidak dapat terhubung ke LAN Server' };
  }
}

export const lanService = new LanService();

