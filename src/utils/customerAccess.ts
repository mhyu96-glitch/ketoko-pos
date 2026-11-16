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
  if (normalized === 'store-01') return 'Cabang Utama (store-01)';
  return normalized;
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

  const label = customer.name || customer.code || 'Pelanggan ini';
  return {
    allowed: false,
    homeStoreId,
    homeStoreName,
    activeStoreId: resolvedActiveId,
    activeStoreName,
    scope,
    reason: `Akses Ditolak: "${label}" terdaftar di ${homeStoreName} (${homeStoreId}) dan tidak bisa transaksi member di ${activeStoreName} (${resolvedActiveId}).`,
  };
}
