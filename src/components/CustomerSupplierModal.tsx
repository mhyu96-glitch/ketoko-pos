import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Truck, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Phone, 
  MapPin,
  Wallet,
  QrCode
} from 'lucide-react';
import { db } from '../db';
import type { Customer, Supplier } from '../types';
import { formatRupiah } from '../services/escposService';
import { syncService } from '../services/syncService';
import { lanService } from '../services/lanService';
import { getStoredStores, type RegisteredStoreInfo } from '../services/storeRegistry';
import {
  filterCustomersForStore,
  formatCustomerAddressDisplay,
  getCurrentActiveStoreId,
  getStoreDisplayName,
  getStoresForCluster,
  isCustomerBelongsToStoreOrCluster,
  normalizeAccessScope,
  normalizeStoreId,
  preserveCustomerSecurityMetadata,
  type CustomerAccessScope,
} from '../utils/customerAccess';
import { CustomerBranchBadge, CustomerBranchFields } from './CustomerBranchFields';
import { MemberCardModal } from './MemberCardModal';
import { MemberTopUpModal } from './MemberTopUpModal';
import { CustomSelect } from './CustomSelect';
import { filterSuppliersForStore } from './PurchasesAndReturnsModal';

interface CustomerSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'customer' | 'supplier';
  onUpdated?: () => void;
}



export const CustomerSupplierModal: React.FC<CustomerSupplierModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'customer',
  onUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>(initialTab);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [visibleCustLimit, setVisibleCustLimit] = useState(150);

  // Customer Form State
  const activeStoreId = getCurrentActiveStoreId();
  const [storesList, setStoresList] = useState<RegisteredStoreInfo[]>(() => getStoresForCluster(activeStoreId));
  const [isAddingCust, setIsAddingCust] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [custCode, setCustCode] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState<number>(1000000);
  const [custStoreId, setCustStoreId] = useState<string>(() => getCurrentActiveStoreId());
  const [custOriginalStoreId, setCustOriginalStoreId] = useState<string | null>(null);
  const [custAccessScope, setCustAccessScope] = useState<CustomerAccessScope>('ALL_STORES');

  // Supplier Form State
  const [isAddingSup, setIsAddingSup] = useState(false);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [supCode, setSupCode] = useState('');
  const [supName, setSupName] = useState('');
  const [supSalesContact, setSupSalesContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supTermDays, setSupTermDays] = useState<number>(14);

  // Delete inline confirmation states
  const [deleteConfirmCustId, setDeleteConfirmCustId] = useState<string | null>(null);
  const [deleteConfirmSupId, setDeleteConfirmSupId] = useState<string | null>(null);

  // Digital Card & Top Up Modals
  const [selectedCustForCard, setSelectedCustForCard] = useState<Customer | null>(null);
  const [selectedCustForTopUp, setSelectedCustForTopUp] = useState<Customer | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadData();
    }

    const handleSyncEvent = () => {
      loadData();
    };

    window.addEventListener('ketoko_customer_updated', handleSyncEvent);
    window.addEventListener('ketoko_customer_deleted', handleSyncEvent);
    window.addEventListener('ketoko_customers_synced', handleSyncEvent);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('ketoko_customer_sync');
        bc.onmessage = () => {
          loadData();
        };
      }
    } catch {}

    return () => {
      window.removeEventListener('ketoko_customer_updated', handleSyncEvent);
      window.removeEventListener('ketoko_customer_deleted', handleSyncEvent);
      window.removeEventListener('ketoko_customers_synced', handleSyncEvent);
      if (bc) {
        bc.close();
      }
    };
  }, [isOpen, initialTab]);

  const loadData = async () => {
    try {
      const allCust = await db.customers.toArray();
      const allSup = await db.suppliers.toArray();
      setCustomers(filterCustomersForStore(allCust, activeStoreId));
      setSuppliers(filterSuppliersForStore(allSup, activeStoreId));
      onUpdated?.();

      // Sinkronisasi background dari LAN server jika aktif
      if (lanService.isLanActive()) {
        try {
          await lanService.fetchCustomersFromLan(activeStoreId);
          const refreshedCust = await db.customers.toArray();
          setCustomers(filterCustomersForStore(refreshedCust, activeStoreId));
        } catch (e) {
          console.warn('[CustomerSupplierModal] LAN customer fetch deferred:', e);
        }
      }

      // Sinkronisasi background dari Cloud jika online
      if (navigator.onLine) {
        try {
          await syncService.pullCustomersFromSupabase();
          const refreshedCust = await db.customers.toArray();
          setCustomers(filterCustomersForStore(refreshedCust, activeStoreId));
        } catch (e) {
          console.warn('[CustomerSupplierModal] Supabase customer pull deferred:', e);
        }
      }
    } catch (err) {
      console.error('Error loading customers/suppliers:', err);
    }
  };

  // Reset Customer Form
  const resetCustForm = () => {
    setStoresList(getStoresForCluster(activeStoreId));
    setIsAddingCust(false);
    setEditingCustId(null);
    setCustCode('');
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustCreditLimit(1000000);
    setCustStoreId(getCurrentActiveStoreId());
    setCustOriginalStoreId(null);
    setCustAccessScope('ALL_STORES');
  };

  // Reset Supplier Form
  const resetSupForm = () => {
    setIsAddingSup(false);
    setEditingSupId(null);
    setSupCode('');
    setSupName('');
    setSupSalesContact('');
    setSupPhone('');
    setSupAddress('');
    setSupTermDays(14);
  };

  // Save / Update Customer
  const handleSaveCustomer = async () => {
    if (!custName.trim()) return;

    try {
      const targetStoreId = normalizeStoreId(custStoreId || activeStoreId);
      const existing = editingCustId ? await db.customers.get(editingCustId) : null;
      const targetCust = preserveCustomerSecurityMetadata(
        {
          ...(existing || {}),
          id: editingCustId || `cust-${Date.now()}`,
          store_id: targetStoreId,
          store_name: getStoreDisplayName(targetStoreId),
          access_scope: normalizeAccessScope(custAccessScope),
          type: existing?.type || 'MEMBER',
          code: custCode.trim() || existing?.code || `PLG-${String(customers.length + 1).padStart(3, '0')}`,
          name: custName.trim(),
          phone: custPhone.trim() || '-',
          address: formatCustomerAddressDisplay(custAddress.trim() || '-'),
          credit_limit: Number(custCreditLimit) || 0,
          current_debt: existing?.current_debt || 0,
          created_at: existing?.created_at || new Date().toISOString()
        },
        existing
      );

      await syncService.syncCustomerChange(targetCust);
    } catch (err) {
      console.error('Gagal menyimpan pelanggan:', err);
    }

    resetCustForm();
    loadData();
    onUpdated?.();
  };

  // Edit Customer Trigger
  const handleEditCustomer = (c: Customer) => {
    setStoresList(getStoredStores());
    setEditingCustId(c.id);
    setCustCode(c.code);
    setCustName(c.name);
    setCustPhone(c.phone || '');
    const cleanedAddr = formatCustomerAddressDisplay(c.address);
    setCustAddress(cleanedAddr !== '-' ? cleanedAddr : '');
    setCustCreditLimit(c.credit_limit || 0);
    setCustStoreId(normalizeStoreId(c.store_id));
    setCustOriginalStoreId(normalizeStoreId(c.store_id));
    setCustAccessScope(normalizeAccessScope(c.access_scope));
    setIsAddingCust(true);
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string) => {
    try {
      await syncService.deleteCustomer(id);
      setDeleteConfirmCustId(null);
      loadData();
      onUpdated?.();
    } catch (err) {
      console.error('Gagal menghapus pelanggan:', err);
    }
  };

  // Save / Update Supplier
  const handleSaveSupplier = async () => {
    if (!supName.trim()) return;

    if (editingSupId) {
      await db.suppliers.update(editingSupId, {
        code: supCode.trim() || `SUP-${Date.now().toString().slice(-4)}`,
        name: supName.trim(),
        sales_contact: supSalesContact.trim(),
        phone: supPhone.trim(),
        address: supAddress.trim(),
        payment_term_days: Number(supTermDays)
      });
    } else {
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        code: supCode.trim() || `SUP-${String(suppliers.length + 1).padStart(3, '0')}`,
        name: supName.trim(),
        sales_contact: supSalesContact.trim(),
        phone: supPhone.trim(),
        address: supAddress.trim(),
        payment_term_days: Number(supTermDays),
        store_id: normalizeStoreId(activeStoreId)
      } as Supplier;
      await db.suppliers.add(newSup);
    }

    resetSupForm();
    loadData();
  };

  // Edit Supplier Trigger
  const handleEditSupplier = (s: Supplier) => {
    setEditingSupId(s.id);
    setSupCode(s.code);
    setSupName(s.name);
    setSupSalesContact(s.sales_contact);
    setSupPhone(s.phone || '');
    setSupAddress(s.address || '');
    setSupTermDays(s.payment_term_days || 14);
    setIsAddingSup(true);
  };

  // Delete Supplier
  const handleDeleteSupplier = async (id: string) => {
    try {
      await db.suppliers.delete(id);
      setDeleteConfirmSupId(null);
      loadData();
    } catch (err) {
      console.error('Gagal menghapus supplier:', err);
    }
  };

  if (!isOpen) return null;

  const storeScopedCustomers = customers.filter((c) =>
    isCustomerBelongsToStoreOrCluster(c.store_id, activeStoreId)
  );

  const unitOptions = Array.from(
    new Set(
      storeScopedCustomers
        .map((c) => {
          const disp = formatCustomerAddressDisplay(c.address);
          if (!disp || disp === '-') return '';
          const parts = disp.split('•').map((s) => s.trim());
          return parts.length >= 2 ? `${parts[0]} • ${parts[1]}` : '';
        })
        .filter(Boolean)
    )
  ).sort();

  const filteredCustList = storeScopedCustomers.filter((c) => {
    if (unitFilter !== 'ALL') {
      const disp = formatCustomerAddressDisplay(c.address);
      if (!disp.startsWith(unitFilter)) return false;
    }
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      Boolean(c.phone && c.phone.includes(q)) ||
      formatCustomerAddressDisplay(c.address).toLowerCase().includes(q)
    );
  });

  const displayedCustList = filteredCustList.slice(0, visibleCustLimit);

  return (
    <div className="fixed inset-0 z-50 bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              {activeTab === 'customer' ? <Users className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-black text-base sm:text-xl leading-tight tracking-tight text-white">Master Data Pelanggan & Supplier</h3>
              <p className="text-xs text-[#fcefe3] font-medium">Kelola kode unik, kontak, unit/alamat, dan batas kredit rekanan toko</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-[#83532e] hover:bg-[#6f4021] text-white border border-[#a6744c] text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Tutup</span>
          </button>
        </div>

        {/* Tab & Search Bar */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-[#e4d5c7] bg-[#f5ece3] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('customer');
                resetCustForm();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'customer'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Data Pelanggan ({storeScopedCustomers.length.toLocaleString('id-ID')})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('supplier');
                resetSupForm();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'supplier'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Data Supplier ({suppliers.length})</span>
            </button>

            {activeTab === 'customer' && unitOptions.length > 1 && (
              <CustomSelect
                value={unitFilter}
                onChange={(val) => {
                  setUnitFilter(val);
                  setVisibleCustLimit(150);
                }}
                size="sm"
                className="min-w-[205px]"
                options={[
                  { value: 'ALL', label: 'Semua Unit / Afdeling' },
                  ...unitOptions.map((u) => ({ value: u, label: u })),
                ]}
              />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative w-64 sm:w-72">
              <Search className="w-4 h-4 text-[#856b59] absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCustLimit(150);
                }}
                placeholder={activeTab === 'customer' ? 'Cari nama / NIK / kode pelanggan...' : 'Cari supplier / distributor...'}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dfcebe] text-xs font-medium focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20 bg-white"
              />
            </div>

            {activeTab === 'customer' ? (
              <button
                onClick={() => {
                  resetCustForm();
                  setCustCode(`PLG-${String(customers.length + 1).padStart(3, '0')}`);
                  setIsAddingCust(true);
                }}
                className="px-3.5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>+ Pelanggan</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  resetSupForm();
                  setSupCode(`SUP-${String(suppliers.length + 1).padStart(3, '0')}`);
                  setIsAddingSup(true);
                }}
                className="px-3.5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>+ Supplier</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="px-4 sm:px-6 lg:px-8 py-5 overflow-y-auto flex-1 space-y-4 bg-[#fcf9f5] min-h-0 flex flex-col">
          
          {/* TAB 1: PELANGGAN */}
          {activeTab === 'customer' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Form Tambah/Edit Pelanggan */}
              {isAddingCust && (
                <div className="p-4 bg-[#fcf5ed] border border-[#eed7c4] rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#3d2617]">
                      {editingCustId ? 'Edit Data Pelanggan' : 'Form Input Pelanggan Baru'}
                    </span>
                    <button onClick={resetCustForm} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Kode Pelanggan:</label>
                      <input
                        type="text"
                        value={custCode}
                        onChange={(e) => setCustCode(e.target.value)}
                        placeholder="contoh: PLG-001"
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Nama Lengkap Pelanggan:</label>
                      <input
                        type="text"
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        placeholder="Nama pelanggan..."
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">No. WhatsApp / Telepon:</label>
                      <input
                        type="text"
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        placeholder="0812xxxx"
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Alamat Domisili:</label>
                      <input
                        type="text"
                        value={custAddress}
                        onChange={(e) => setCustAddress(e.target.value)}
                        placeholder="Alamat rumah/toko pelanggan..."
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Plafon Limit Piutang (Rp):</label>
                      <input
                        type="number"
                        value={custCreditLimit || ''}
                        onChange={(e) => setCustCreditLimit(Number(e.target.value))}
                        placeholder="1000000"
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <CustomerBranchFields
                    storeId={custStoreId}
                    onStoreIdChange={setCustStoreId}
                    accessScope={custAccessScope}
                    onAccessScopeChange={setCustAccessScope}
                    stores={storesList}
                    originalStoreId={custOriginalStoreId}
                  />

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={resetCustForm}
                      className="px-3.5 py-1.5 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveCustomer}
                      className="px-4 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan Pelanggan
                    </button>
                  </div>
                </div>
              )}

              {/* Table Data Pelanggan */}
              <div className="bg-white rounded-2xl border border-[#e4d5c7] shadow-xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto max-h-[calc(100vh-230px)] custom-scroll">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3.5 px-4">Kode / NIK</th>
                        <th className="py-3.5 px-4">Nama Pelanggan</th>
                        <th className="py-3.5 px-4">Unit / Alamat &amp; Kontak</th>
                        <th className="py-3.5 px-4 text-right">Saldo Member</th>
                        <th className="py-3.5 px-4 text-right">Plafon Piutang</th>
                        <th className="py-3.5 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {displayedCustList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-[#856b59]">
                            <Users className="w-9 h-9 mx-auto text-[#dfcebe] mb-2" />
                            <p className="font-bold text-sm text-[#543c2e]">Tidak ada data pelanggan yang cocok</p>
                          </td>
                        </tr>
                      ) : (
                        displayedCustList.map((c) => {
                          const cleanAddress = formatCustomerAddressDisplay(c.address);
                          const hasPhone = Boolean(c.phone && c.phone.trim() && c.phone.trim() !== '-');
                          const showNotes = Boolean(
                            c.notes &&
                              c.type !== 'KARYAWAN' &&
                              c.notes.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() !==
                                cleanAddress.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
                          );

                          return (
                            <tr key={c.id} className="hover:bg-[#fcf8f4] transition-colors">
                              <td className="py-3 px-4 whitespace-nowrap align-middle">
                                <span className="px-2.5 py-1 rounded-lg bg-[#fcf5ed] text-[#7c4e2f] font-mono font-bold text-xs border border-[#eed7c4]">
                                  {c.code}
                                </span>
                              </td>
                              <td className="py-3 px-4 align-middle">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <span className="font-extrabold text-[#332219] text-xs sm:text-sm">{c.name}</span>
                                  {c.type === 'KARYAWAN' && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                      Karyawan
                                    </span>
                                  )}
                                  <CustomerBranchBadge customer={c} activeStoreId={activeStoreId} />
                                </div>
                                {showNotes && <div className="text-[11px] text-[#856b59] mt-0.5">{c.notes}</div>}
                              </td>
                              <td className="py-3 px-4 align-middle">
                                <div className="flex items-center gap-1.5 text-[#332219] text-xs font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-[#8a6b53] shrink-0" />
                                  <span className="truncate max-w-[320px]">{cleanAddress || '-'}</span>
                                </div>
                                {hasPhone && (
                                  <div className="flex items-center gap-1.5 text-[#856b59] text-[11px] mt-0.5 tabular-nums">
                                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>{c.phone}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap align-middle">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <span className="tabular-nums font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs">
                                    {formatRupiah(Number(c.deposit_balance) || 0)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCustForTopUp(c)}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                                    title="Top Up Saldo Anggota"
                                  >
                                    <Wallet className="w-3 h-3" />
                                    <span>Top Up</span>
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums font-bold text-[#332219] text-xs whitespace-nowrap align-middle">
                                {formatRupiah(c.credit_limit || 0)}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                                {deleteConfirmCustId === c.id ? (
                                  <div className="flex items-center justify-center space-x-1.5 animate-fadeIn">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomer(c.id)}
                                      className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs"
                                    >
                                      Ya, Hapus
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmCustId(null)}
                                      className="px-2.5 py-1 text-[11px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => setSelectedCustForCard(c)}
                                      className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 transition-colors"
                                      title="Kartu Digital & Barcode"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleEditCustomer(c)}
                                      className="p-1.5 rounded-lg border border-[#e4d5c7] bg-[#fcf9f5] text-[#543c2e] hover:text-[#7c4e2f] hover:bg-[#faebd7] transition-colors"
                                      title="Edit Pelanggan"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmCustId(c.id)}
                                      className="p-1.5 rounded-lg border border-transparent text-[#a08573] hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                                      title="Hapus Pelanggan"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredCustList.length > visibleCustLimit && (
                  <div className="px-4 py-2.5 bg-[#fcf9f5] border-t border-[#e4d5c7] flex items-center justify-between text-xs">
                    <span className="text-[#856b59]">
                      Menampilkan <b>{displayedCustList.length}</b> dari <b>{filteredCustList.length.toLocaleString('id-ID')}</b> pelanggan
                    </span>
                    <button
                      type="button"
                      onClick={() => setVisibleCustLimit((prev) => prev + 200)}
                      className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#faebd7] text-[#7c4e2f] border border-[#ddc3aa] font-bold transition-colors"
                    >
                      Tampilkan Lebih Banyak (+200)
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: SUPPLIER */}
          {activeTab === 'supplier' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Form Tambah/Edit Supplier */}
              {isAddingSup && (
                <div className="p-4 bg-[#fcf5ed] border border-[#eed7c4] rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#3d2617]">
                      {editingSupId ? 'Edit Data Supplier' : 'Form Input Supplier / Distributor Baru'}
                    </span>
                    <button onClick={resetSupForm} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Kode Supplier:</label>
                      <input
                        type="text"
                        value={supCode}
                        onChange={(e) => setSupCode(e.target.value)}
                        placeholder="contoh: SUP-001"
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Nama Perusahaan / Distributor:</label>
                      <input
                        type="text"
                        value={supName}
                        onChange={(e) => setSupName(e.target.value)}
                        placeholder="PT / CV Supplier..."
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Nama Kontak Sales:</label>
                      <input
                        type="text"
                        value={supSalesContact}
                        onChange={(e) => setSupSalesContact(e.target.value)}
                        placeholder="Nama sales person..."
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">No. WhatsApp / Telepon:</label>
                      <input
                        type="text"
                        value={supPhone}
                        onChange={(e) => setSupPhone(e.target.value)}
                        placeholder="0811xxxx"
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Alamat Gudang / Kantor:</label>
                      <input
                        type="text"
                        value={supAddress}
                        onChange={(e) => setSupAddress(e.target.value)}
                        placeholder="Alamat kantor distributor..."
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Syarat Pembayaran (TOP Hari):</label>
                      <input
                        type="number"
                        value={supTermDays || ''}
                        onChange={(e) => setSupTermDays(Number(e.target.value))}
                        placeholder="14"
                        className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={resetSupForm}
                      className="px-3.5 py-1.5 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveSupplier}
                      className="px-4 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan Supplier
                    </button>
                  </div>
                </div>
              )}

              {/* Table Data Supplier */}
              <div className="bg-white rounded-2xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[calc(100vh-230px)] custom-scroll">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f1e5d8] z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">Kode</th>
                        <th className="py-3 px-4">Nama Supplier & Sales</th>
                        <th className="py-3 px-4">Kontak & Alamat</th>
                        <th className="py-3 px-4 text-center">Tempo Bayar</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {suppliers
                        .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()) || s.sales_contact.toLowerCase().includes(search.toLowerCase()))
                        .map((s) => (
                          <tr key={s.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-lg bg-[#faebd7] text-[#7c4e2f] font-mono font-black text-xs border border-[#eed7c4]">
                                {s.code}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#332219] text-sm">{s.name}</div>
                              <div className="text-[11px] text-[#856b59]">Sales: <b className="text-[#332219]">{s.sales_contact || '-'}</b></div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-1 text-[#543c2e]">
                                <Phone className="w-3 h-3 text-[#a08573]" />
                                <span>{s.phone || '-'}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-[#856b59] text-[11px] mt-0.5">
                                <MapPin className="w-3 h-3 text-[#a08573]" />
                                <span>{s.address || '-'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full bg-[#f5ece3] text-[#543c2e] font-mono font-bold text-xs whitespace-nowrap border border-[#dfcebe]">
                                {s.payment_term_days} Hari
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {deleteConfirmSupId === s.id ? (
                                <div className="flex items-center justify-center space-x-1 animate-fadeIn">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSupplier(s.id)}
                                    className="px-2 py-0.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs"
                                  >
                                    Ya, Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmSupId(null)}
                                    className="px-2 py-0.5 text-[11px] font-medium bg-[#ebdccf] hover:bg-[#dfcebe] text-[#5c3c26] rounded-lg"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    onClick={() => handleEditSupplier(s)}
                                    className="p-1.5 rounded-lg text-[#856b59] hover:text-[#7c4e2f] hover:bg-[#faebd7] transition-colors"
                                    title="Edit Supplier"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmSupId(s.id)}
                                    className="p-1.5 rounded-lg text-[#a08573] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Hapus Supplier"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-t border-[#e5d0be] bg-white flex items-center justify-between text-xs text-[#8a6b53] shrink-0">
          <span>Data Pelanggan & Supplier tersimpan aman di database offline KetokoPOS</span>
        </div>

      </div>

      {/* Modal Digital Card & Cetak Barcode/QR Member */}
      {selectedCustForCard && (
        <MemberCardModal
          isOpen={!!selectedCustForCard}
          member={selectedCustForCard}
          onClose={() => setSelectedCustForCard(null)}
        />
      )}

      {/* Modal Top Up Saldo Anggota */}
      {selectedCustForTopUp && (
        <MemberTopUpModal
          isOpen={!!selectedCustForTopUp}
          member={selectedCustForTopUp}
          activeStoreId={activeStoreId}
          onClose={() => setSelectedCustForTopUp(null)}
          onTopUpSuccess={(updatedCust) => {
            setCustomers((prev) => prev.map(c => c.id === updatedCust.id ? updatedCust : c));
          }}
        />
      )}
    </div>
  );
};
