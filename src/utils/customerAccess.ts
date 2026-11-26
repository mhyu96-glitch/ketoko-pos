import { Customer } from '../types';
import { getStoredStores, RegisteredStoreInfo, resolveStoreFromCurrentHost } from '../services/storeRegistry';

export type CustomerAccessScope = 'HOME_ONLY' | 'ALL_STORES';

export interface BranchAccessCheckResult {
  allowed: boolean;
  homeStoreId: string;
  homeStoreName: string;
  activeStoreId: string;
  activeStoreName: string;
  scope: CustomerAccessScope;
  reason?: string;
}

/**
 * Normalizes missing or empty store IDs to the default main branch ('store-01')
 * so legacy customer rows remain backward-compatible.
 */
export function normalizeStoreId(storeId?: string | null): string {
  const trimmed = String(storeId || '').trim();
  return trimmed || 'store-01';
}

/**
 * Normalizes access_scope. Default for cooperative members is 'ALL_STORES'
 * so members can seamlessly transact, check balance, and top up across all branches (A & B).
 * Returns 'HOME_ONLY' only if explicitly configured.
 */
export function normalizeAccessScope(scope?: string | null): CustomerAccessScope {
  return scope === 'HOME_ONLY' ? 'HOME_ONLY' : 'ALL_STORES';
}

/**
 * Resolves the currently active store ID from localStorage / host mapping / settings.
 */
export function getCurrentActiveStoreId(): string {
  try {
    const lsStore = localStorage.getItem('ketoko_active_store_id');
    if (lsStore && lsStore.trim()) return lsStore.trim();
  } catch {}
  try {
    const hostStore = resolveStoreFromCurrentHost();
    if (hostStore?.id) return hostStore.id;
  } catch {}
  return 'store-01';
}

/**
 * Returns the human-readable branch name for a given store_id.
 */
export function getStoreDisplayName(storeId?: string | null, fallbackName?: string | null): string {
  const normalized = normalizeStoreId(storeId);
  try {
    const stores: RegisteredStoreInfo[] = getStoredStores();
    const found = stores.find((s) => s.id === normalized);
    if (found?.name) return found.name;
  } catch {}
  if (fallbackName && String(fallbackName).trim()) {
    return String(fallbackName).trim();
  }
  if (normalized === 'store-01') return 'Cabang Samarinda (BR-01)';
  if (normalized === 'store-koperasimsl') return 'Koperasi MSL (Toko Utama)';
  if (normalized === 'store-koperasimsl-cabang') return 'Koperasi MSL (Cabang 1)';
  return normalized;
}

/**
 * Mendapatkan ID Cluster Bisnis untuk isolasi toko (misal Koperasi MSL vs Tumbuh Makmur).
 * Toko dalam satu cluster (misal Toko Utama & Cabang Koperasi) berbagi data anggota.
 * Toko beda cluster (misal CV Tumbuh Makmur vs Koperasi MSL) TERISOLASI TOTAL!
 */
export function getStoreClusterId(storeId?: string | null): string {
  const normalized = normalizeStoreId(storeId);
  try {
    const stores: RegisteredStoreInfo[] = getStoredStores();
    const found = stores.find((s) => s.id === normalized);
    if (found?.clusterId) return found.clusterId;
  } catch {}

  // Heuristic fallbacks jika storeRegistry belum selesai hydrate
  if (normalized.startsWith('store-koperasimsl')) {
    return 'cluster-koperasi-msl';
  }
  if (normalized === 'store-borneoetam') {
    return 'cluster-borneoetam';
  }
  if (normalized === 'store-01') {
    return 'cluster-tumbuhmakmur';
  }
  return `cluster-${normalized}`;
}

/**
 * Mengambil daftar toko/cabang yang hanya satu cluster dengan toko aktif.
 * Digunakan agar dropdown cabang di MemberModal tidak menampilkan toko dari bisnis lain.
 */
export function getStoresForCluster(activeStoreId?: string | null): RegisteredStoreInfo[] {
  const activeCluster = getStoreClusterId(activeStoreId);
  try {
    const allStores = getStoredStores();
    const filtered = allStores.filter((s) => (s.clusterId || getStoreClusterId(s.id)) === activeCluster);
    if (filtered.length > 0) return filtered;
  } catch {}
  return [];
}

/**
 * Memeriksa apakah pelanggan berasal dari cluster toko yang sama dengan toko aktif.
 * Pelanggan CV Tumbuh Makmur (store-01) TIDAK BOLEH tampil di Toko Koperasi MSL, dan sebaliknya!
 */
export function isCustomerBelongsToStoreOrCluster(
  customerStoreId?: string | null,
  activeStoreId?: string | null
): boolean {
  const normCustomerStore = normalizeStoreId(customerStoreId);
  const normActiveStore = normalizeStoreId(activeStoreId || getCurrentActiveStoreId());

  // Cocok ID toko secara langsung
  if (normCustomerStore === normActiveStore) return true;

  // Cocok cluster bisnis (misal: store-koperasimsl dengan store-koperasimsl-cabang)
  const custCluster = getStoreClusterId(normCustomerStore);
  const activeCluster = getStoreClusterId(normActiveStore);

  return Boolean(custCluster && activeCluster && custCluster === activeCluster);
}

/**
 * Filter array pelanggan secara ketat hanya untuk cluster toko aktif saat ini.
 */
export function filterCustomersForStore<T extends { store_id?: string | null }>(
  customers: T[],
  activeStoreId?: string | null
): T[] {
  const resolvedActive = normalizeStoreId(activeStoreId || getCurrentActiveStoreId());
  return customers.filter((c) => isCustomerBelongsToStoreOrCluster(c?.store_id, resolvedActive));
}

/**
 * Checks whether a customer/cooperative member is allowed to transact as a member
 * at the given active branch.
 */
export function checkCustomerBranchAccess(
  customer: Pick<Customer, 'name' | 'code' | 'store_id' | 'store_name' | 'access_scope'> | null | undefined,
  activeStoreId?: string | null
): BranchAccessCheckResult {
  const resolvedActiveId = normalizeStoreId(activeStoreId || getCurrentActiveStoreId());
  const activeStoreName = getStoreDisplayName(resolvedActiveId);

  if (!customer) {
    return {
      allowed: true,
      homeStoreId: resolvedActiveId,
      homeStoreName: activeStoreName,
      activeStoreId: resolvedActiveId,
      activeStoreName,
      scope: 'HOME_ONLY',
    };
  }

  const homeStoreId = normalizeStoreId(customer.store_id);
  const homeStoreName = getStoreDisplayName(homeStoreId, customer.store_name);
  const scope = normalizeAccessScope(customer.access_scope);
  const label = customer.name || customer.code || 'Pelanggan ini';

  // 1. ISOLASI BISNIS/CLUSTER: Jika toko pelanggan bukan dalam cluster yang sama, TOLAK MUTLAK!
  if (!isCustomerBelongsToStoreOrCluster(homeStoreId, resolvedActiveId)) {
    return {
      allowed: false,
      homeStoreId,
      homeStoreName,
      activeStoreId: resolvedActiveId,
      activeStoreName,
      scope,
      reason: `Akses Ditolak: "${label}" terdaftar di ${homeStoreName} (${homeStoreId}) dan bukan pelanggan/karyawan ${activeStoreName}.`,
    };
  }

  // 2. Dalam cluster yang sama (misal: Toko Utama vs Cabang 1 Koperasi MSL)
  if (scope === 'ALL_STORES' || homeStoreId === resolvedActiveId) {
    return {
      allowed: true,
      homeStoreId,
      homeStoreName,
      activeStoreId: resolvedActiveId,
      activeStoreName,
      scope,
    };
  }

  return {
    allowed: false,
    homeStoreId,
    homeStoreName,
    activeStoreId: resolvedActiveId,
    activeStoreName,
    scope,
    reason: `Akses Terkunci: "${label}" terdaftar di ${homeStoreName} dan hanya diizinkan transaksi di cabang asalnya.`,
  };
}
