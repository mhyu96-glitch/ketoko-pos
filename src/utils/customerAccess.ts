import { Customer } from '../types';
import { getStoredStores, RegisteredStoreInfo, resolveStoreFromCurrentHost } from '../services/storeRegistry';

export type CustomerAccessScope = 'HOME_ONLY' | 'ALL_STORES';

/** Plafon maksimal saldo kuota belanja bulanan karyawan Koperasi (Rp 2.000.000, reset tiap tanggal 1) */
export const MAX_EMPLOYEE_ALLOWANCE = 2000000;

export interface BranchAccessCheckResult {
  allowed: boolean;
  homeStoreId: string;
  homeStoreName: string;
  activeStoreId: string;
  activeStoreName: string;
  scope: CustomerAccessScope;
  reason?: string;
}

export interface ParsedEmployeeMeta {
  unit_profile: string;
  afdeling: string;
  job_code: string;
  emp_status: string;
  clean_address: string;
  reset_month: string;
  has_pin: boolean;
  is_blocked: boolean;
}

/**
 * Menghitung hash SHA-256 untuk PIN karyawan
 */
export async function hashEmployeePin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const rawText = 'KOPMSL:' + String(salt || '').toLowerCase().trim() + ':' + String(pin).trim();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(rawText));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mengecek apakah kartu fisik karyawan berstatus DIBLOKIR / HILANG
 */
export function isCustomerCardBlocked(customer?: Partial<Customer> | null): boolean {
  if (!customer) return false;
  if (customer.is_card_blocked === true) return true;
  return String(customer.address || '').includes('[STATUS:BLOCKED]');
}

/**
 * Mengubah status blokir kartu (Blokir saat hilang atau Buka Blokir)
 */
export function setCustomerCardBlocked(customer: Customer, blocked: boolean): Customer {
  const cleanAddr = String(customer.address || '').replace(/\s*\[STATUS:BLOCKED\]\s*/gi, '').trim();
  const newAddress = blocked ? `${cleanAddr} [STATUS:BLOCKED]`.trim() : cleanAddr;
  return {
    ...customer,
    address: newAddress,
    is_card_blocked: blocked,
    updated_at: new Date().toISOString()
  };
}

/**
 * Membatasi plafon kuota karyawan maksimal Rp 2.000.000
 */
export function clampEmployeeAllowance(val?: number | null): number {
  const num = Number(val);
  if (isNaN(num) || num <= 0) return MAX_EMPLOYEE_ALLOWANCE;
  return Math.min(MAX_EMPLOYEE_ALLOWANCE, Math.round(num));
}

/**
 * Membatasi sisa saldo karyawan antara Rp 0 s/d maksimal plafon (Rp 2.000.000)
 */
export function clampEmployeeBalance(val?: number | null, maxAllowance = MAX_EMPLOYEE_ALLOWANCE): number {
  const cap = Math.min(MAX_EMPLOYEE_ALLOWANCE, Math.max(0, Number(maxAllowance) || MAX_EMPLOYEE_ALLOWANCE));
  if (val === undefined || val === null || isNaN(Number(val))) return cap;
  return Math.min(cap, Math.max(0, Math.round(Number(val))));
}

/**
 * Membersihkan tag metadata [RST:YYYY-MM], [PIN:...], dan [STATUS:BLOCKED] dari teks alamat untuk tampilan UI
 */
export function formatCustomerAddressDisplay(address?: string | null): string {
  if (!address) return '-';
  const cleaned = String(address)
    .replace(/\s*\[RST:\d{4}-\d{2}\]\s*/gi, '')
    .replace(/\s*\[PIN:[a-f0-9]+\]\s*/gi, '')
    .replace(/\s*\[STATUS:BLOCKED\]\s*/gi, '')
    .trim();
  return cleaned || '-';
}

/**
 * Mengekstrak PIN hash dari objek Customer / teks alamat
 */
export function extractEmployeePinHash(customer?: Partial<Customer> | null): string | null {
  const addr = String(customer?.address || '');
  const m = addr.match(/\[PIN:([a-f0-9]{32,64})\]/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Mengecek apakah karyawan telah mengaktifkan PIN keamanan
 */
export function hasEmployeePin(customer?: Partial<Customer> | null): boolean {
  return Boolean(extractEmployeePinHash(customer));
}

/**
 * Menyisipkan atau mengganti tag [PIN:hash] ke dalam teks alamat atau objek Customer
 */
export function setEmployeePinInAddress(customer: Customer, pinHash: string): Customer;
export function setEmployeePinInAddress(address: string | undefined | null, pinHash: string): string;
export function setEmployeePinInAddress(target: any, pinHash: string): any {
  if (target && typeof target === 'object' && 'id' in target) {
    const cust = target as Customer;
    const base = String(cust.address || '').replace(/\s*\[PIN:[a-f0-9]+\]\s*/gi, '').trim();
    const newAddress = `${base} [PIN:${pinHash.toLowerCase().trim()}]`.trim();
    return {
      ...cust,
      address: newAddress,
      pin_hash: pinHash.toLowerCase().trim(),
      updated_at: new Date().toISOString()
    };
  }
  const base = String(target || '').replace(/\s*\[PIN:[a-f0-9]+\]\s*/gi, '').trim();
  return `${base} [PIN:${pinHash.toLowerCase().trim()}]`.trim();
}

/**
 * Menghapus tag [PIN:...] dari teks alamat atau objek Customer (digunakan saat Kasir / Admin Reset PIN)
 */
export function removeEmployeePinFromAddress(customer: Customer): Customer;
export function removeEmployeePinFromAddress(address: string | undefined | null): string;
export function removeEmployeePinFromAddress(target: any): any {
  if (target && typeof target === 'object' && 'id' in target) {
    const cust = target as Customer;
    const newAddress = String(cust.address || '').replace(/\s*\[PIN:[a-f0-9]+\]\s*/gi, '').trim();
    return {
      ...cust,
      address: newAddress,
      pin_hash: undefined,
      updated_at: new Date().toISOString()
    };
  }
  return String(target || '').replace(/\s*\[PIN:[a-f0-9]+\]\s*/gi, '').trim();
}

/**
 * Mengekstrak informasi Unit, Afdeling, Jabatan, Status, dan Bulan Reset dari objek Customer / teks alamat
 */
export function parseEmployeeMeta(customer?: Partial<Customer> | null): ParsedEmployeeMeta {
  const rawAddr = String(customer?.address || '');
  const rstMatch = rawAddr.match(/\[RST:(\d{4}-\d{2})\]/i);
  const reset_month = customer?.last_allowance_reset || (rstMatch ? rstMatch[1] : '');
  const clean_address = formatCustomerAddressDisplay(rawAddr);
  const pin_hash = extractEmployeePinHash(customer);

  let unit_profile = customer?.unit_profile || '';
  let afdeling = customer?.afdeling || '';
  let job_code = customer?.job_code || '';
  let emp_status = customer?.emp_status || '';

  // Parse pola "MSL INTI-1 • Afd A • MANDOR PANEN (KT)" bila field eksplisit belum terisi
  if ((!unit_profile || !afdeling || !job_code) && clean_address.includes('•')) {
    const parts = clean_address.split('•').map((p) => p.trim());
    if (!unit_profile && parts[0]) unit_profile = parts[0];
    if (!afdeling && parts[1]) {
      afdeling = parts[1].replace(/^Afd\s*:?\s*/i, '').trim();
    }
    if (parts[2]) {
      const stMatch = parts[2].match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (stMatch) {
        if (!job_code) job_code = stMatch[1].trim();
        if (!emp_status) emp_status = stMatch[2].trim();
      } else if (!job_code) {
        job_code = parts[2];
      }
    }
  }

  return {
    unit_profile: unit_profile || (customer?.store_id === 'store-koperasimsl-cabang' ? 'MSL MILL-1' : 'UMUM'),
    afdeling: afdeling || (customer?.store_id === 'store-koperasimsl-cabang' ? 'MILL' : 'UMUM'),
    job_code: job_code || '-',
    emp_status: emp_status || '-',
    clean_address,
    reset_month,
    has_pin: Boolean(pin_hash),
    is_blocked: isCustomerCardBlocked(customer)
  };
}

/**
 * Menyusun string address dengan tag [RST:YYYY-MM] agar sinkron ke kolom standar Supabase
 */
export function encodeEmployeeAddressWithReset(
  cleanAddress: string,
  resetMonth?: string | null,
  isEmployee?: boolean
): string {
  const base = formatCustomerAddressDisplay(cleanAddress);
  if (!isEmployee) return base;
  const month = (resetMonth || new Date().toISOString().slice(0, 7)).trim();
  return `${base === '-' ? 'Koperasi PT. MSL' : base} [RST:${month}]`;
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
  if (normalized === 'store-koperasimsl') return 'Koperasi Karyawan PT. MSL (Toko Utama)';
  if (normalized === 'store-koperasimsl-cabang') return 'Koperasi Karyawan PT. MSL (Cabang Mill)';
  return normalized;
}

/**
 * Mendapatkan ID Cluster Bisnis untuk isolasi toko (misal Koperasi MSL vs Tumbuh Makmur).
 */
export function getStoreClusterId(storeId?: string | null): string {
  const normalized = normalizeStoreId(storeId);
  if (normalized.startsWith('store-koperasimsl')) {
    return 'cluster-koperasi-msl';
  }
  if (normalized === 'store-borneoetam') {
    return 'cluster-borneoetam';
  }
  if (normalized === 'store-01') {
    return 'cluster-tumbuhmakmur';
  }
  try {
    const stores: RegisteredStoreInfo[] = getStoredStores();
    const found = stores.find((s) => s.id === normalized);
    if (found?.clusterId) return found.clusterId;
  } catch {}
  return `cluster-${normalized}`;
}

/**
 * Mengambil daftar toko/cabang yang hanya satu cluster dengan toko aktif.
 */
export function getStoresForCluster(activeStoreId?: string | null): RegisteredStoreInfo[] {
  const activeCluster = getStoreClusterId(activeStoreId);
  try {
    const allStores = getStoredStores();
    const filtered = allStores.filter((s) => getStoreClusterId(s.id) === activeCluster);
    if (filtered.length > 0) return filtered;
  } catch {}
  return [];
}

/**
 * Memeriksa apakah pelanggan berasal dari cluster toko yang sama dengan toko aktif.
 */
export function isCustomerBelongsToStoreOrCluster(
  customerStoreId?: string | null,
  activeStoreId?: string | null
): boolean {
  const normCustomerStore = normalizeStoreId(customerStoreId);
  const normActiveStore = normalizeStoreId(activeStoreId || getCurrentActiveStoreId());

  if (normCustomerStore === normActiveStore) return true;

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
