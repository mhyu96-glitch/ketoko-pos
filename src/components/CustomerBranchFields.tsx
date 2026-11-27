import React from 'react';
import { ArrowRightLeft, Globe, Lock, Store } from 'lucide-react';
import type { Customer } from '../types';
import type { RegisteredStoreInfo } from '../services/storeRegistry';
import {
  checkCustomerBranchAccess,
  getStoreDisplayName,
  normalizeAccessScope,
  normalizeStoreId,
  type CustomerAccessScope,
} from '../utils/customerAccess';
import { CustomSelect } from './CustomSelect';

interface CustomerBranchFieldsProps {
  storeId: string;
  onStoreIdChange: (storeId: string) => void;
  accessScope: CustomerAccessScope;
  onAccessScopeChange: (scope: CustomerAccessScope) => void;
  stores: RegisteredStoreInfo[];
  originalStoreId?: string | null;
}

/**
 * Shared form controls for assigning a customer's registered home branch
 * (plus branch transfer / Mutasi indicator) and cross-branch permission scope.
 */
export const CustomerBranchFields: React.FC<CustomerBranchFieldsProps> = ({
  storeId,
  onStoreIdChange,
  accessScope,
  onAccessScopeChange,
  stores,
  originalStoreId,
}) => {
  const normalizedSelected = normalizeStoreId(storeId);
  const normalizedOriginal = originalStoreId ? normalizeStoreId(originalStoreId) : null;
  const isTransferring = Boolean(normalizedOriginal && normalizedOriginal !== normalizedSelected);

  const hasCurrentInList = stores.some((s) => s.id === normalizedSelected);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
      <div>
        <label className="text-[11px] font-bold text-[#543c2e] flex items-center justify-between mb-1">
          <span className="inline-flex items-center gap-1">
            <Store className="w-3 h-3 text-[#7c4e2f]" />
            <span>Cabang Terdaftar (Mutasi):</span>
          </span>
          {isTransferring && normalizedOriginal && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black">
              <ArrowRightLeft className="w-2.5 h-2.5" />
              <span>Pindah dari {getStoreDisplayName(normalizedOriginal)}</span>
            </span>
          )}
        </label>
        <CustomSelect
          value={normalizedSelected}
          onChange={(val) => onStoreIdChange(val)}
          size="sm"
          options={[
            ...stores.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.id})`,
            })),
            ...(!hasCurrentInList
              ? [
                  {
                    value: normalizedSelected,
                    label: `${getStoreDisplayName(normalizedSelected)} (${normalizedSelected})`,
                  },
                ]
              : []),
          ]}
        />
      </div>

      <div>
        <label className="text-[11px] font-bold text-[#543c2e] flex items-center gap-1 mb-1">
          <Lock className="w-3 h-3 text-[#7c4e2f]" />
          <span>Izin Transaksi Cabang:</span>
        </label>
        <CustomSelect
          value={normalizeAccessScope(accessScope)}
          onChange={(val) => onAccessScopeChange(val as CustomerAccessScope)}
          size="sm"
          options={[
            { value: 'HOME_ONLY', label: 'Khusus Cabang Terdaftar (Terkunci 1 Cabang)' },
            { value: 'ALL_STORES', label: 'Semua Cabang (Akses Bebas / Manajemen)' },
          ]}
        />
      </div>
    </div>
  );
};

interface CustomerBranchBadgeProps {
  customer: Pick<Customer, 'name' | 'code' | 'store_id' | 'store_name' | 'access_scope'>;
  activeStoreId: string;
}

/**
 * Shared compact pill displaying which cooperative branch owns this member
 * and whether they are unlocked or locked for the current cashier's store.
 */
export const CustomerBranchBadge: React.FC<CustomerBranchBadgeProps> = ({
  customer,
  activeStoreId,
}) => {
  const access = checkCustomerBranchAccess(customer, activeStoreId);

  const shortBranchLabel = (() => {
    const raw = access.homeStoreName || '';
    if (/mill/i.test(raw)) return 'Cabang Mill';
    if (/muaratoyu|koperasi\s+karyawan\s+pt\.\s*msl/i.test(raw)) return 'Toko Utama';
    if (/tumbuh\s*makmur/i.test(raw)) return 'Pusat Samarinda';
    return raw.length > 26 ? `${raw.slice(0, 24)}…` : raw;
  })();

  if (access.scope === 'ALL_STORES') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap"
        title={`Terdaftar di ${access.homeStoreName}, diizinkan transaksi di semua cabang`}
      >
        <Globe className="w-2.5 h-2.5 shrink-0" />
        <span>Semua Cabang</span>
      </span>
    );
  }

  if (access.allowed) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap"
        title={`Terdaftar dan aktif untuk transaksi di ${access.homeStoreName}`}
      >
        <Store className="w-2.5 h-2.5 shrink-0" />
        <span>{shortBranchLabel}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap"
      title={`Terkunci: hanya bisa transaksi member di ${access.homeStoreName}`}
    >
      <Lock className="w-2.5 h-2.5 shrink-0" />
      <span>Khusus {shortBranchLabel}</span>
    </span>
  );
};
