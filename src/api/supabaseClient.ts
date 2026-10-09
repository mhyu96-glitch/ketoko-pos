import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export interface SupabaseCluster {
  id: string;
  name: string;
  url: string;
  anonKey: string;
  isDefault?: boolean;
  maxStores?: number;
  notes?: string;
  createdAt?: string;
}

export const DEFAULT_SUPABASE_URL = 'https://quhjgsoqjcumckoshjtv.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aGpnc29xamN1bWNrb3NoanR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMDE0MTQsImV4cCI6MjEwNTc3NzQxNH0.fh79f6QFSdBA3QD8f7vFZ7P1z29ilPeFq_htxy_OKgM';

const clientCache = new Map<string, SupabaseClient>();

/**
 * Mengambil definisi cluster default
 */
export function getDefaultCluster(): SupabaseCluster {
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  const localUrl = isBrowser ? (localStorage.getItem('ketoko_supabase_url')?.trim() || '') : '';
  const localKey = isBrowser ? (localStorage.getItem('ketoko_supabase_anon_key')?.trim() || '') : '';
  const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

  return {
    id: 'cluster-default',
    name: 'Cluster 1 (Default Cloud)',
    url: localUrl || envUrl || DEFAULT_SUPABASE_URL,
    anonKey: localKey || envKey || DEFAULT_SUPABASE_KEY,
    isDefault: true,
    maxStores: 20,
    notes: 'Cluster Supabase Gratis Utama (Kapasitas: 1-20 Toko, 500MB DB)'
  };
}

/**
 * Mengambil daftar seluruh cluster Supabase yang terdaftar
 */
export function getSupabaseClusters(): SupabaseCluster[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [getDefaultCluster()];
  }
  try {
    const raw = localStorage.getItem('ketoko_supabase_clusters');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  const defaultList = [getDefaultCluster()];
  localStorage.setItem('ketoko_supabase_clusters', JSON.stringify(defaultList));
  return defaultList;
}

/**
 * Menyimpan atau memperbarui cluster Supabase
 */
export function saveSupabaseCluster(cluster: SupabaseCluster): void {
  if (typeof localStorage === 'undefined') return;
  const clusters = getSupabaseClusters();
  const index = clusters.findIndex(c => c.id === cluster.id);
  if (index >= 0) {
    clusters[index] = cluster;
  } else {
    clusters.push(cluster);
  }
  localStorage.setItem('ketoko_supabase_clusters', JSON.stringify(clusters));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ketoko_supabase_clusters_changed', { detail: { clusters } }));
  }
}

/**
 * Menghapus cluster Supabase (cluster default tidak dapat dihapus)
 */
export function deleteSupabaseCluster(clusterId: string): boolean {
  if (clusterId === 'cluster-default' || typeof localStorage === 'undefined') return false;
  const clusters = getSupabaseClusters().filter(c => c.id !== clusterId);
  localStorage.setItem('ketoko_supabase_clusters', JSON.stringify(clusters));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ketoko_supabase_clusters_changed', { detail: { clusters } }));
  }
  return true;
}

/**
 * Mendapatkan kredensial Supabase dari store aktif, localStorage, atau default cluster
 */
export function getSupabaseConfig(storeId?: string): SupabaseConfig & { clusterId?: string; clusterName?: string } {
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  
  if (isBrowser) {
    // 1. Cek apakah ada profil toko aktif dengan kredensial custom
    const targetId = storeId || localStorage.getItem('ketoko_active_store_id');
    const profileRaw = localStorage.getItem('ketoko_store_profile');
    if (profileRaw) {
      try {
        const profile = JSON.parse(profileRaw);
        if (profile.supabase_url && profile.supabase_anon_key) {
          return {
            url: profile.supabase_url.trim(),
            anonKey: profile.supabase_anon_key.trim(),
            clusterId: profile.cluster_id || 'cluster-custom',
            clusterName: profile.cluster_name || 'Cluster Klien',
            isConfigured: true
          };
        }
      } catch {}
    }

    // 2. Cek apakah toko terdaftar memiliki spesifikasi cluster tersendiri
    const storesRaw = localStorage.getItem('ketoko_registered_stores');
    if (storesRaw && targetId) {
      try {
        const stores = JSON.parse(storesRaw);
        if (Array.isArray(stores)) {
          const matched = stores.find((s: any) => s.id === targetId);
          if (matched && matched.supabaseUrl && matched.supabaseAnonKey) {
            return {
              url: matched.supabaseUrl.trim(),
              anonKey: matched.supabaseAnonKey.trim(),
              clusterId: matched.clusterId || 'cluster-store',
              clusterName: matched.clusterName || matched.name,
              isConfigured: true
            };
          }
        }
      } catch {}
    }
  }

  // 3. Fallback ke Cluster Default
  const defaultCluster = getDefaultCluster();
  return {
    url: defaultCluster.url,
    anonKey: defaultCluster.anonKey,
    clusterId: defaultCluster.id,
    clusterName: defaultCluster.name,
    isConfigured: Boolean(defaultCluster.url && defaultCluster.anonKey && defaultCluster.url.startsWith('http'))
  };
}

/**
 * Menyimpan kredensial Supabase ke localStorage dan reset cache client
 */
export function saveSupabaseConfig(url: string, anonKey: string) {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('ketoko_supabase_url', cleanUrl);
    localStorage.setItem('ketoko_supabase_anon_key', cleanKey);
    // Sinkronkan ke default cluster
    const clusters = getSupabaseClusters();
    const def = clusters.find(c => c.id === 'cluster-default');
    if (def) {
      def.url = cleanUrl;
      def.anonKey = cleanKey;
      localStorage.setItem('ketoko_supabase_clusters', JSON.stringify(clusters));
    }
  }

  // Invalidate cached clients
  clientCache.clear();

  // Trigger global custom event for reactive UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ketoko_supabase_config_changed', {
      detail: { isConfigured: Boolean(cleanUrl && cleanKey) }
    }));
  }
}

/**
 * Menghapus konfigurasi Supabase dari browser
 */
export function clearSupabaseConfig() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('ketoko_supabase_url');
    localStorage.removeItem('ketoko_supabase_anon_key');
  }
  clientCache.clear();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ketoko_supabase_config_changed', {
      detail: { isConfigured: false }
    }));
  }
}

/**
 * Mengambil instance SupabaseClient aktif (multi-client caching berdasarkan URL dan AnonKey)
 */
export function getSupabaseClient(customUrl?: string, customKey?: string): SupabaseClient | null {
  let url = customUrl?.trim();
  let anonKey = customKey?.trim();

  if (!url || !anonKey) {
    const config = getSupabaseConfig();
    if (!config.isConfigured) {
      return null;
    }
    url = config.url;
    anonKey = config.anonKey;
  }

  const cacheKey = `${url}|${anonKey}`;
  const existing = clientCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  try {
    const client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    clientCache.set(cacheKey, client);
    return client;
  } catch (err) {
    console.error('[SupabaseClient] Gagal inisialisasi client:', err);
    return null;
  }
}

/**
 * Menguji konektivitas ke Supabase (Latency & Query Test)
 */
export async function testSupabaseConnection(customUrl?: string, customKey?: string): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const url = (customUrl || getSupabaseConfig().url).trim();
  const anonKey = (customKey || getSupabaseConfig().anonKey).trim();

  if (!url || !anonKey) {
    return {
      success: false,
      message: 'URL Project dan Anon Key tidak boleh kosong.'
    };
  }

  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return {
      success: false,
      message: 'Format URL tidak valid. Harus diawali dengan https://'
    };
  }

  const startTime = performance.now();
  try {
    const testClient = createClient(url, anonKey, {
      auth: { persistSession: false }
    });

    const { error } = await testClient.from('store_settings').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - startTime);

    if (error && error.code !== 'PGRST116') {
      if (
        error.code === '42P01' || 
        error.code === 'PGRST205' || 
        error.message?.includes('schema cache') || 
        error.message?.includes('does not exist')
      ) {
        return {
          success: true,
          message: `Terhubung ke Supabase (${latencyMs}ms), namun tabel database belum dibuat. Silakan jalankan skrip supabase_schema.sql di SQL Editor Supabase Anda.`,
          latencyMs
        };
      }
      return {
        success: false,
        message: `Gagal terhubung: ${error.message} (${error.code})`
      };
    }

    return {
      success: true,
      message: `Berhasil terhubung ke Supabase Cloud! Latensi: ${latencyMs}ms`,
      latencyMs
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Koneksi gagal: ${err.message || 'Periksa kembali URL dan koneksi internet.'}`
    };
  }
}
