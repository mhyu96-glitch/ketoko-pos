import { getSupabaseClient } from '../api/supabaseClient';

export interface RegisteredStoreInfo {
  id: string;
  name: string;
  branch: string;
  branchId: string;
  ownerName: string;
  phone: string;
  subdomain?: string;
  onlineDomain: string;
  localServer: string;
  licensePlan: string;
  adminUser: string;
  cashierUser: string;
  productsCount: string;
  status: 'STANDALONE' | 'ONLINE' | 'OFFLINE';
  isClean: boolean;
  clusterId?: string;
  clusterName?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export const DEFAULT_REGISTERED_STORES: RegisteredStoreInfo[] = [
  {
    id: 'store-01',
    name: 'CV. Tumbuh Makmur Air Conindo',
    branch: 'Cabang Samarinda (BR-01)',
    branchId: 'BR-01',
    ownerName: 'suciawati Ramadhani',
    phone: '08123456789',
    subdomain: 'tumbuhmakmur',
    onlineDomain: 'https://tumbuhmakmur.ketokopos.online',
    localServer: 'http://localhost:5858',
    licensePlan: 'PRO LIFETIME (Aktif)',
    adminUser: 'suciawati (Owner)',
    cashierUser: 'noor (Kasir Toko)',
    productsCount: '1.503 Produk Sparepart AC',
    status: 'ONLINE',
    isClean: false,
    clusterId: 'cluster-default',
    clusterName: 'Cluster 1 (Default Cloud)'
  },
  {
    id: 'store-borneoetam',
    name: 'borneo etam',
    branch: 'borneo etam (BR-02)',
    branchId: 'BR-02',
    ownerName: 'muhammad wahyu',
    phone: '08123456789',
    subdomain: 'borneoetam',
    onlineDomain: 'https://borneoetam.ketokopos.online',
    localServer: 'http://localhost:5858',
    licensePlan: 'PRO LIFETIME (Aktif)',
    adminUser: 'muhammad wahyu (Owner)',
    cashierUser: 'kasir (Kasir borneo etam)',
    productsCount: '0 Produk (Toko Bersih Baru)',
    status: 'ONLINE',
    isClean: true,
    clusterId: 'cluster-default',
    clusterName: 'Cluster 1 (Default Cloud)'
  }
];

/**
 * Get current list of registered stores from localStorage with fallback
 */
export function getStoredStores(): RegisteredStoreInfo[] {
  if (typeof window === 'undefined') return DEFAULT_REGISTERED_STORES;
  try {
    const saved = localStorage.getItem('ketoko_registered_stores');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_REGISTERED_STORES;
}

/**
 * Save stores to localStorage and push to Supabase Cloud app_configurations
 */
export async function saveStoresList(stores: RegisteredStoreInfo[]): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ketoko_registered_stores', JSON.stringify(stores));
    window.dispatchEvent(new CustomEvent('ketoko_registered_stores_changed', { detail: stores }));
  }

  // Push to Supabase Cloud app_configurations for multi-subdomain cross-origin access
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('app_configurations').upsert({
        key_name: 'registered_stores',
        metadata: { stores }
      }, { onConflict: 'key_name' });
    }
  } catch (err) {
    console.warn('[StoreRegistry] Gagal sinkronkan daftar toko ke cloud:', err);
  }
}

/**
 * Synchronously detect store from hostname or localStorage
 */
export function resolveStoreFromCurrentHost(): RegisteredStoreInfo {
  if (typeof window === 'undefined') return DEFAULT_REGISTERED_STORES[0];

  const hostname = window.location.hostname.toLowerCase();
  const allStores = getStoredStores();

  // 1. Direct Subdomain Matching (e.g. borneoetam.ketokopos.online)
  if (hostname.includes('ketokopos.online') || hostname.includes('pages.dev')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const sub = parts[0];
      const matched = allStores.find(s => 
        s.subdomain?.toLowerCase() === sub || 
        s.id.toLowerCase() === `store-${sub}` ||
        s.onlineDomain?.toLowerCase().includes(`//${sub}.`)
      );
      if (matched) return matched;

      // Handle well-known subdomains
      if (sub === 'borneoetam') {
        return DEFAULT_REGISTERED_STORES[1];
      }
      if (sub === 'tumbuhmakmur') {
        return DEFAULT_REGISTERED_STORES[0];
      }

      // Dynamic sub-tenant fallback
      const cleanName = sub.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return {
        id: `store-${sub}`,
        name: cleanName,
        branch: `${cleanName} (BR-02)`,
        branchId: 'BR-02',
        ownerName: 'Admin ' + cleanName,
        phone: '',
        subdomain: sub,
        onlineDomain: `https://${sub}.ketokopos.online`,
        localServer: 'http://localhost:5858',
        licensePlan: 'PRO LIFETIME (Aktif)',
        adminUser: 'admin (Owner)',
        cashierUser: `kasir (Kasir ${cleanName})`,
        productsCount: '0 Produk (Toko Bersih Baru)',
        status: 'ONLINE',
        isClean: true,
        clusterId: 'cluster-default',
        clusterName: 'Cluster 1 (Default Cloud)'
      };
    }
  }

  // 2. Localhost or non-subdomain: check localStorage active_store_id
  try {
    const savedId = localStorage.getItem('ketoko_active_store_id');
    if (savedId) {
      const matched = allStores.find(s => s.id === savedId);
      if (matched) return matched;
    }
  } catch {}

  return DEFAULT_REGISTERED_STORES[0];
}

/**
 * Fetch latest registered stores from Supabase Cloud
 */
export async function fetchStoresFromCloud(): Promise<RegisteredStoreInfo[]> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return getStoredStores();

    const { data, error } = await supabase
      .from('app_configurations')
      .select('metadata')
      .eq('key_name', 'registered_stores')
      .single();

    if (error || !data?.metadata?.stores) {
      return getStoredStores();
    }

    const cloudStores: RegisteredStoreInfo[] = data.metadata.stores;
    if (Array.isArray(cloudStores) && cloudStores.length > 0) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ketoko_registered_stores', JSON.stringify(cloudStores));
      }
      return cloudStores;
    }
  } catch (err) {
    console.warn('[StoreRegistry] Gagal fetch stores dari cloud:', err);
  }
  return getStoredStores();
}
