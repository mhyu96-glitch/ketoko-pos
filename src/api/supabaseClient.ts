import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

/**
 * Mendapatkan kredensial Supabase dari localStorage atau environment variables
 */
export function getSupabaseConfig(): SupabaseConfig {
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  const localUrl = isBrowser ? (localStorage.getItem('ketoko_supabase_url')?.trim() || '') : '';
  const localKey = isBrowser ? (localStorage.getItem('ketoko_supabase_anon_key')?.trim() || '') : '';

  const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

  const DEFAULT_SUPABASE_URL = 'https://quhjgsoqjcumckoshjtv.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aGpnc29xamN1bWNrb3NoanR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMDE0MTQsImV4cCI6MjEwNTc3NzQxNH0.fh79f6QFSdBA3QD8f7vFZ7P1z29ilPeFq_htxy_OKgM';

  const url = localUrl || envUrl || DEFAULT_SUPABASE_URL;
  const anonKey = localKey || envKey || DEFAULT_SUPABASE_KEY;

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey && url.startsWith('http'))
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
  }

  // Invalidate cached client
  cachedClient = null;
  lastUsedUrl = '';
  lastUsedKey = '';

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
  cachedClient = null;
  lastUsedUrl = '';
  lastUsedKey = '';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ketoko_supabase_config_changed', {
      detail: { isConfigured: false }
    }));
  }
}

/**
 * Mengambil instance SupabaseClient aktif
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return null;
  }

  if (cachedClient && lastUsedUrl === config.url && lastUsedKey === config.anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    lastUsedUrl = config.url;
    lastUsedKey = config.anonKey;
    return cachedClient;
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
